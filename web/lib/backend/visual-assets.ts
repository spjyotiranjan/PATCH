import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { createAiServiceClient } from "@/lib/ai/client";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { sourceUrl, storeVisualDerivative } from "@/lib/storage/r2";
import { audit, fail, fingerprint, oid, queue, type Context } from "./context";
import { loadVersion } from "./documents";
import { resolveManifest } from "./scope";
import type { Schema, VersionRecord } from "./models";

export const visualBoundsSchema = z
  .object({
    left: z.number().min(0).max(1).default(0),
    top: z.number().min(0).max(1).default(0),
    right: z.number().min(0).max(1).default(1),
    bottom: z.number().min(0).max(1).default(1),
  })
  .strict()
  .refine((b) => b.left < b.right && b.top < b.bottom);
const fullPage = { left: 0, top: 0, right: 1, bottom: 1 };
export const visualRequestSchema = z
  .object({
    page: z.number().int().min(1).max(500),
    bounds: visualBoundsSchema.default(fullPage),
  })
  .strict();

export interface VisualAssetRecord {
  _id: ObjectId;
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  originalSha256: string;
  selectionFingerprint: string;
  page: number;
  bounds: Schema["VisualBounds"];
  renderDpi: number;
  rendererVersion: "pdfium-png-v1";
  state: "QUEUED" | "READY" | "FAILED";
  metadata?: Schema["VisualSourceAsset"];
  objectKey?: string;
  descriptionState?: "QUEUED" | "READY" | "FAILED";
  description?: Schema["VisualDescription"];
  createdAt: Date;
  updatedAt: Date;
}

function assetView(record: VisualAssetRecord) {
  // Explicit projection: never return storage keys, source URLs or private bytes.
  return {
    id: record._id.toHexString(),
    documentId: record.documentId,
    documentVersionId: record.documentVersionId,
    page: record.page,
    bounds: record.bounds,
    state: record.state,
    metadata: record.metadata ?? null,
    descriptionState: record.descriptionState ?? "NOT_REQUESTED",
    description: record.description ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function currentVisualVersion(
  ctx: Context,
  id: string,
  mutate = false,
) {
  const { document, version } = await loadVersion(ctx, id, mutate);
  if (
    document.archivedAt ||
    document.activeVersionId !== id ||
    version.state !== "ACTIVE" ||
    version.approvalState !== "APPROVED" ||
    version.index?.status !== "indexed" ||
    version.contentType !== "application/pdf"
  )
    fail("VISUAL_SOURCE_NOT_CURRENT");
  if (!ctx.system) {
    const manifest = await resolveManifest(ctx);
    if (
      !manifest.allowedDocumentVersions?.some(
        (v) =>
          v.documentId === version.documentId && v.documentVersionId === id,
      )
    )
      fail("VISUAL_SOURCE_ACCESS_REQUIRED", 403);
  }
  return version;
}

export async function requestVisualAsset(
  ctx: Context,
  versionId: string,
  input: z.infer<typeof visualRequestSchema>,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const version = await currentVisualVersion(tx, versionId, true);
    if (!version.extraction?.pages?.some((p) => p.page === input.page))
      fail("VISUAL_PAGE_NOT_FOUND", 400);
    const selection = {
      page: input.page,
      bounds: input.bounds,
      renderDpi: ctx.config.VISUAL_RENDER_DPI,
      rendererVersion: "pdfium-png-v1" as const,
    };
    const selectionFingerprint = fingerprint(selection);
    const filter = {
      tenantId: ctx.actor.tenantId,
      documentVersionId: versionId,
    };
    const assets = db.collection<VisualAssetRecord>("visualSourceAssets");
    const existing = await assets.findOne(
      { ...filter, selectionFingerprint },
      { session },
    );
    if (existing) return assetView(existing);
    // Serialize per-version allocation, including the quota check, across transactions.
    await db
      .collection<VersionRecord>("documentVersions")
      .updateOne(
        { _id: oid(versionId), tenantId: ctx.actor.tenantId, state: "ACTIVE" },
        { $inc: { visualAllocationRevision: 1 } },
        { session },
      );
    if (
      (await assets.find(filter, { session }).limit(101).toArray()).length >=
      100
    )
      fail("VISUAL_ASSET_LIMIT", 400);
    const record: VisualAssetRecord = {
      _id: new ObjectId(),
      ...filter,
      ...selection,
      selectionFingerprint,
      documentId: version.documentId,
      originalSha256: version.sha256.toLowerCase(),
      state: "QUEUED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await assets.insertOne(record, { session });
    await queue(tx, "VISUAL_RENDER", `visual:${record._id.toHexString()}`, {
      assetId: record._id.toHexString(),
    });
    await audit(tx, "VISUAL_ASSET_REQUESTED", {
      assetId: record._id.toHexString(),
      versionId,
      page: input.page,
    });
    return assetView(record);
  });
}

export async function listVisualAssets(ctx: Context, versionId: string) {
  await currentVisualVersion(ctx, versionId);
  const assets = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .find(
      { tenantId: ctx.actor.tenantId, documentVersionId: versionId },
      { session: ctx.session },
    )
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray();
  return { items: assets.map(assetView) };
}

export async function requestVisualDescription(ctx: Context, assetId: string) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const assets = db.collection<VisualAssetRecord>("visualSourceAssets");
    const asset = await assets.findOne(
      { _id: oid(assetId), tenantId: ctx.actor.tenantId },
      { session },
    );
    if (!asset) fail("VISUAL_ASSET_NOT_FOUND", 404);
    const version = await currentVisualVersion(
      tx,
      asset.documentVersionId,
      true,
    );
    if (
      asset.state !== "READY" ||
      !asset.metadata ||
      !asset.objectKey ||
      version.sha256.toLowerCase() !== asset.originalSha256
    )
      fail("VISUAL_ASSET_NOT_READY");
    if (asset.descriptionState) return assetView(asset);
    asset.descriptionState = "QUEUED";
    asset.updatedAt = new Date();
    await assets.replaceOne(
      { _id: asset._id, tenantId: asset.tenantId },
      asset,
      { session },
    );
    await queue(tx, "VISUAL_DESCRIBE", `visual-describe:${assetId}`, {
      assetId,
    });
    await audit(tx, "VISUAL_DESCRIPTION_REQUESTED", { assetId });
    return assetView(asset);
  });
}

const descriptionSchema = z
  .object({
    descriptionVersion: z.literal("vision-description-v1"),
    summary: z.string().min(1).max(4000),
    labels: z.array(z.string().min(1).max(200)).max(50),
    relationships: z.array(z.string().min(1).max(500)).max(30),
    uncertainties: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

export async function buildVisualDescription(ctx: Context, assetId: string) {
  const asset = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .findOne({
      _id: oid(assetId),
      tenantId: ctx.actor.tenantId,
    });
  if (!asset) fail("VISUAL_ASSET_NOT_FOUND", 404);
  const version = await currentVisualVersion(ctx, asset.documentVersionId);
  if (
    asset.state !== "READY" ||
    !asset.metadata ||
    !asset.objectKey ||
    version.sha256.toLowerCase() !== asset.originalSha256
  )
    fail("VISUAL_ASSET_NOT_READY");
  if (asset.descriptionState === "READY") return asset;
  const requestId = randomUUID();
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/visual-assets/describe",
    {
      body: {
        requestId,
        contractVersion: "v1",
        tenantId: ctx.actor.tenantId,
        approvalState: "APPROVED",
        asset: asset.metadata,
        sourceFile: {
          url: await sourceUrl(ctx.config, asset.objectKey),
          contentType: "image/png",
          sha256: asset.metadata.sha256,
        },
      },
    },
  );
  const parsed = z
    .object({
      requestId: z.literal(requestId),
      status: z.literal("described"),
      assetId: z.literal(assetId),
      sha256: z.literal(asset.metadata.sha256),
      description: descriptionSchema,
      errors: z.array(z.unknown()).max(0),
    })
    .strict()
    .safeParse(response.data);
  if (!parsed.success) fail("VISUAL_DESCRIPTION_FAILED", 503);
  return {
    ...asset,
    descriptionState: "READY" as const,
    description: parsed.data.description,
    updatedAt: new Date(),
  };
}

export async function visualAssetSource(ctx: Context, assetId: string) {
  const asset = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .findOne(
      { _id: oid(assetId), tenantId: ctx.actor.tenantId },
      { session: ctx.session },
    );
  if (!asset) fail("VISUAL_ASSET_NOT_FOUND", 404);
  const version = await currentVisualVersion(ctx, asset.documentVersionId);
  if (
    asset.state !== "READY" ||
    !asset.objectKey ||
    !asset.metadata ||
    version.sha256.toLowerCase() !== asset.originalSha256
  )
    fail("VISUAL_ASSET_NOT_READY");
  await audit(ctx, "VISUAL_SOURCE_OPENED", {
    assetId,
    versionId: asset.documentVersionId,
  });
  return {
    asset: assetView(asset),
    url: await sourceUrl(ctx.config, asset.objectKey),
    expiresInSeconds: Math.min(ctx.config.R2_PRESIGNED_URL_TTL_SECONDS, 300),
  };
}

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const metadataSchema = z
  .object({
    assetId: z.string(),
    documentId: z.string(),
    documentVersionId: z.string(),
    page: z.number().int().min(1).max(500),
    bounds: visualBoundsSchema,
    originalSha256: sha256,
    sha256,
    contentType: z.literal("image/png"),
    byteCount: z.number().int().min(1).max(2_000_000),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    renderDpi: z.number().int().min(72).max(200),
    rendererVersion: z.literal("pdfium-png-v1"),
  })
  .strict();
const renderResultSchema = z
  .object({
    requestId: z.string().uuid(),
    status: z.literal("rendered"),
    asset: metadataSchema,
    pngBase64: z.string().min(1).max(2_666_668),
    errors: z.array(z.unknown()).max(0),
  })
  .strict();

export async function buildVisualAsset(ctx: Context, assetId: string) {
  const asset = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .findOne({ _id: oid(assetId), tenantId: ctx.actor.tenantId });
  if (!asset) fail("VISUAL_ASSET_NOT_FOUND", 404);
  const version = await currentVisualVersion(ctx, asset.documentVersionId);
  if (version.sha256.toLowerCase() !== asset.originalSha256)
    fail("VISUAL_SOURCE_CHANGED");
  if (asset.state === "READY") return asset;
  const requestId = randomUUID();
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/visual-assets/render",
    {
      body: {
        requestId,
        contractVersion: "v1",
        tenantId: ctx.actor.tenantId,
        assetId,
        documentId: asset.documentId,
        documentVersionId: asset.documentVersionId,
        approvalState: "APPROVED",
        page: asset.page,
        bounds: asset.bounds,
        renderDpi: asset.renderDpi,
        rendererVersion: asset.rendererVersion,
        sourceFile: {
          url: await sourceUrl(ctx.config, version.objectKey),
          contentType: version.contentType,
          sha256: version.sha256,
        },
      },
    },
  );
  const parsed = renderResultSchema.safeParse(response.data);
  if (!parsed.success) fail("VISUAL_RENDER_FAILED", 503);
  const result = parsed.data;
  const meta = result.asset;
  if (
    result.requestId !== requestId ||
    meta.assetId !== assetId ||
    meta.documentId !== asset.documentId ||
    meta.documentVersionId !== asset.documentVersionId ||
    meta.originalSha256 !== asset.originalSha256 ||
    meta.page !== asset.page ||
    meta.renderDpi !== asset.renderDpi ||
    meta.rendererVersion !== asset.rendererVersion ||
    Object.keys(fullPage).some(
      (k) =>
        meta.bounds[k as keyof typeof fullPage] !==
        asset.bounds[k as keyof typeof fullPage],
    )
  )
    fail("VISUAL_PROVENANCE_INVALID", 502);
  const png = Buffer.from(result.pngBase64, "base64");
  if (
    png.toString("base64") !== result.pngBase64 ||
    png.length !== meta.byteCount ||
    png.length < 33 ||
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    png.readUInt32BE(8) !== 13 ||
    png.toString("ascii", 12, 16) !== "IHDR" ||
    png.readUInt32BE(16) !== meta.width ||
    png.readUInt32BE(20) !== meta.height ||
    meta.width * meta.height > 4_000_000 ||
    createHash("sha256").update(png).digest("hex") !== meta.sha256
  )
    fail("VISUAL_BYTES_INVALID", 502);
  const key = `visuals/${fingerprint(ctx.actor.tenantId)}/${asset.documentVersionId}/${meta.sha256}.png`;
  await storeVisualDerivative(ctx.config, key, png);
  return {
    ...asset,
    state: "READY" as const,
    metadata: meta,
    objectKey: key,
    updatedAt: new Date(),
  };
}
