import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { createAiServiceClient } from "@/lib/ai/client";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { sourceUrl } from "@/lib/storage/r2";
import { audit, fail, fingerprint, oid, queue, type Context } from "./context";
import type { Schema, VersionRecord } from "./models";
import {
  currentVisualVersion,
  descriptionSchema,
  type VisualAssetRecord,
  visualBoundsSchema,
} from "./visual-assets";

export interface DiscoveryRecord {
  _id: ObjectId;
  tenantId: string;
  originalSha256: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETE" | "PARTIAL" | "FAILED";
  pages: number[];
  completedPages: number[];
  partial: boolean;
  totalPages: number;
  scannedPages: number;
  createdAt: Date;
}
export async function enqueueDiscovery(ctx: Context, versionId: string) {
  const version = await currentVisualVersion(ctx, versionId, true);
  await ctx.db.collection<DiscoveryRecord>("visualDiscovery").updateOne(
    { _id: oid(versionId), tenantId: ctx.actor.tenantId },
    {
      $setOnInsert: {
        originalSha256: version.sha256.toLowerCase(),
        status: "QUEUED",
        pages: [],
        completedPages: [],
        partial: false,
        totalPages: 0,
        scannedPages: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true, session: ctx.session },
  );
  await queue(ctx, "VISUAL_TRIAGE", `visual-triage:${versionId}:v1`, {
    versionId,
  });
}
export async function requestDiscovery(ctx: Context, versionId: string) {
  await withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await enqueueDiscovery(tx, versionId);
    await audit(tx, "VISUAL_DISCOVERY_REQUESTED", { versionId });
  });
  return discoveryStatus(ctx, versionId);
}
export async function discoveryStatus(ctx: Context, versionId: string) {
  await currentVisualVersion(ctx, versionId);
  const record = await ctx.db
    .collection<DiscoveryRecord>("visualDiscovery")
    .findOne(
      { _id: oid(versionId), tenantId: ctx.actor.tenantId },
      { session: ctx.session },
    );
  const assets = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .find(
      { tenantId: ctx.actor.tenantId, documentVersionId: versionId },
      { session: ctx.session },
    )
    .limit(100)
    .toArray();
  const failed = assets.filter(
    (a) =>
      a.state === "FAILED" ||
      a.descriptionState === "FAILED" ||
      a.indexState === "FAILED",
  ).length;
  const pending = assets.some(
    (a) =>
      a.automatic && a.indexState !== "READY" && a.indexState !== "DISABLED",
  );
  const status = !record
    ? "NOT_REQUESTED"
    : failed
      ? "FAILED"
      : pending
        ? "PROCESSING"
        : record.status;
  return {
    status,
    detectionStatus: record?.status ?? "NOT_REQUESTED",
    candidatePages: record?.pages ?? [],
    completedPages: record?.completedPages ?? [],
    partial: record?.partial ?? false,
    totalPages: record?.totalPages ?? 0,
    scannedPages: record?.scannedPages ?? 0,
    assets: assets.length,
    rendered: assets.filter((a) => a.state === "READY").length,
    described: assets.filter((a) => a.descriptionState === "READY").length,
    indexed: assets.filter((a) => a.indexState === "READY").length,
    failed,
  };
}
export async function discoveryRequest(
  ctx: Context,
  versionId: string,
): Promise<Schema["VisualDocumentRequest"]> {
  const version = await currentVisualVersion(ctx, versionId);
  return {
    requestId: randomUUID(),
    contractVersion: "v1",
    tenantId: ctx.actor.tenantId,
    documentId: version.documentId,
    documentVersionId: versionId,
    approvalState: "APPROVED",
    pipelineVersion: "visual-discovery-v1",
    sourceFile: {
      url: await sourceUrl(ctx.config, version.objectKey),
      contentType: "application/pdf",
      sha256: version.sha256,
    },
  };
}
export async function triageVersion(ctx: Context, versionId: string) {
  const request = await discoveryRequest(ctx, versionId);
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/visual-assets/triage",
    { body: request },
  );
  const result = z
    .object({
      requestId: z.literal(request.requestId),
      documentVersionId: z.literal(versionId),
      originalSha256: z.literal(request.sourceFile.sha256.toLowerCase()),
      status: z.enum(["complete", "partial"]),
      pages: z.array(z.number().int().min(1).max(500)).max(12),
      totalPages: z.number().int().min(1).max(500),
      scannedPages: z.number().int().min(0).max(500),
    })
    .strict()
    .parse(response.data);
  if (
    new Set(result.pages).size !== result.pages.length ||
    result.scannedPages > result.totalPages ||
    result.pages.some((p) => p > result.scannedPages) ||
    (result.status === "complete" && result.scannedPages !== result.totalPages)
  )
    fail("VISUAL_TRIAGE_INVALID", 502);
  return result;
}
export const regionSchema = z
  .object({
    bounds: visualBoundsSchema,
    visualClass: z.enum([
      "SCHEMATIC",
      "DIAGRAM",
      "CHART",
      "TABLE",
      "PHOTO",
      "SCREENSHOT",
      "OTHER",
    ]),
    confidence: z.number().min(0).max(1),
    uncertainty: z.string().max(500),
  })
  .strict();

export function overlaps(a: Schema["VisualBounds"], b: Schema["VisualBounds"]) {
  const area = (r: Schema["VisualBounds"]) =>
    (r.right! - r.left!) * (r.bottom! - r.top!);
  const intersection =
    Math.max(0, Math.min(a.right!, b.right!) - Math.max(a.left!, b.left!)) *
    Math.max(0, Math.min(a.bottom!, b.bottom!) - Math.max(a.top!, b.top!));
  return intersection / Math.min(area(a), area(b)) >= 0.8;
}
export async function discoverPage(
  ctx: Context,
  versionId: string,
  page: number,
) {
  const request = { ...(await discoveryRequest(ctx, versionId)), page };
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/visual-assets/discover",
    { body: request },
  );
  return z
    .object({
      requestId: z.literal(request.requestId),
      documentVersionId: z.literal(versionId),
      originalSha256: z.literal(request.sourceFile.sha256.toLowerCase()),
      page: z.literal(page),
      status: z.enum(["complete", "partial"]),
      regions: z.array(regionSchema).max(4),
    })
    .strict()
    .parse(response.data);
}
export async function commitRegions(
  ctx: Context,
  versionId: string,
  result: Awaited<ReturnType<typeof discoverPage>>,
) {
  const version = await currentVisualVersion(ctx, versionId);
  const discovery = await ctx.db
    .collection<DiscoveryRecord>("visualDiscovery")
    .findOne(
      { _id: oid(versionId), tenantId: ctx.actor.tenantId },
      { session: ctx.session },
    );
  if (
    !discovery ||
    !discovery.pages.includes(result.page) ||
    discovery.originalSha256 !== result.originalSha256
  )
    fail("VISUAL_DISCOVERY_STALE");
  if (discovery.completedPages.includes(result.page)) return;
  await ctx.db
    .collection<VersionRecord>("documentVersions")
    .updateOne(
      { _id: oid(versionId), tenantId: ctx.actor.tenantId },
      { $inc: { visualAllocationRevision: 1 } },
      { session: ctx.session },
    );
  const collection = ctx.db.collection<VisualAssetRecord>("visualSourceAssets");
  const assets = await collection
    .find(
      { tenantId: ctx.actor.tenantId, documentVersionId: versionId },
      { session: ctx.session },
    )
    .limit(101)
    .toArray();
  for (const region of [...result.regions].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.bounds.top! - b.bounds.top! ||
      a.bounds.left! - b.bounds.left!,
  )) {
    if (region.confidence < 0.5) continue;
    const duplicate = assets.find(
      (a) => a.page === result.page && overlaps(a.bounds, region.bounds),
    );
    if (duplicate) {
      // Reusing an explicit page/crop must not leave discovery "complete" with
      // no indexed evidence merely because that manual render wasn't described.
      if (!duplicate.automatic && duplicate.indexState !== "READY") {
        if (assets.filter((a) => a.automatic).length >= 48) {
          discovery.partial = true;
          continue;
        }
        duplicate.automatic = true;
        await collection.updateOne(
          { _id: duplicate._id, tenantId: ctx.actor.tenantId },
          { $set: { automatic: true } },
          { session: ctx.session },
        );
        if (duplicate.state === "READY" && !duplicate.descriptionState) {
          await collection.updateOne(
            { _id: duplicate._id, tenantId: ctx.actor.tenantId },
            { $set: { descriptionState: "QUEUED" } },
            { session: ctx.session },
          );
          await queue(
            ctx,
            "VISUAL_DESCRIBE",
            `visual-describe:${duplicate._id.toHexString()}`,
            { assetId: duplicate._id.toHexString() },
          );
        } else if (
          duplicate.descriptionState === "READY" &&
          !duplicate.indexState
        ) {
          await enqueueVisualIndex(ctx, duplicate);
        }
      }
      continue;
    }
    if (
      assets.length >= 100 ||
      assets.filter((a) => a.automatic).length >= 48
    ) {
      discovery.partial = true;
      break;
    }
    const selection = {
      page: result.page,
      bounds: region.bounds,
      renderDpi: ctx.config.VISUAL_RENDER_DPI,
      rendererVersion: "pdfium-png-v1" as const,
    };
    const asset: VisualAssetRecord = {
      _id: new ObjectId(),
      tenantId: ctx.actor.tenantId,
      documentId: version.documentId,
      documentVersionId: versionId,
      originalSha256: result.originalSha256,
      ...selection,
      selectionFingerprint: fingerprint(selection),
      automatic: true,
      visualClass: region.visualClass,
      confidence: region.confidence,
      state: "QUEUED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await collection.insertOne(asset, { session: ctx.session });
    assets.push(asset);
    await queue(ctx, "VISUAL_RENDER", `visual:${asset._id.toHexString()}`, {
      assetId: asset._id.toHexString(),
    });
  }
  discovery.completedPages.push(result.page);
  discovery.partial ||= result.status === "partial";
  discovery.status =
    discovery.completedPages.length === discovery.pages.length
      ? discovery.partial
        ? "PARTIAL"
        : "COMPLETE"
      : "PROCESSING";
  await ctx.db
    .collection<DiscoveryRecord>("visualDiscovery")
    .replaceOne(
      { _id: discovery._id, tenantId: ctx.actor.tenantId },
      discovery,
      { session: ctx.session },
    );
}

export function descriptorFingerprint(
  description: Schema["VisualDescription"],
) {
  return fingerprint(descriptionSchema.parse(description));
}
export async function enqueueVisualIndex(
  ctx: Context,
  asset: VisualAssetRecord,
) {
  if (
    !asset.description ||
    asset.descriptionState !== "READY" ||
    asset.state !== "READY"
  )
    fail("VISUAL_DESCRIPTION_REQUIRED");
  const hash = descriptorFingerprint(asset.description);
  await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .updateOne(
      { _id: asset._id, tenantId: asset.tenantId },
      { $set: { indexState: "QUEUED", descriptionFingerprint: hash } },
      { session: ctx.session },
    );
  await queue(
    ctx,
    "VISUAL_INDEX",
    `visual-index:${asset._id.toHexString()}:${hash}:${asset.indexGeneration ?? 0}`,
    {
      assetId: asset._id.toHexString(),
      indexGeneration: asset.indexGeneration ?? 0,
    },
  );
}
export async function requestIndex(ctx: Context, assetId: string) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const asset = await db
      .collection<VisualAssetRecord>("visualSourceAssets")
      .findOne(
        { _id: oid(assetId), tenantId: ctx.actor.tenantId },
        { session },
      );
    if (!asset) fail("VISUAL_ASSET_NOT_FOUND", 404);
    await currentVisualVersion(tx, asset.documentVersionId, true);
    if (asset.indexState === "READY") return { assetId, status: "READY" };
    await enqueueVisualIndex(tx, asset);
    await audit(tx, "VISUAL_INDEX_REQUESTED", { assetId });
    return { assetId, status: "QUEUED" };
  });
}
export async function buildVisualIndex(
  ctx: Context,
  assetId: string,
  generation: number,
) {
  const asset = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .findOne({ _id: oid(assetId), tenantId: ctx.actor.tenantId });
  if (
    !asset?.metadata ||
    !asset.description ||
    asset.descriptionState !== "READY" ||
    asset.state !== "READY"
  )
    fail("VISUAL_DESCRIPTION_REQUIRED");
  if ((asset.indexGeneration ?? 0) !== generation)
    fail("VISUAL_GENERATION_CHANGED");
  const version = await currentVisualVersion(ctx, asset.documentVersionId);
  if (version.sha256.toLowerCase() !== asset.originalSha256)
    fail("VISUAL_SOURCE_CHANGED");
  const requestId = randomUUID(),
    hash = descriptorFingerprint(asset.description);
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/visual-assets/index",
    {
      body: {
        requestId,
        contractVersion: "v1",
        tenantId: ctx.actor.tenantId,
        approvalState: "APPROVED",
        asset: asset.metadata,
        description: asset.description,
        descriptionFingerprint: hash,
        visualClass: asset.visualClass ?? "OTHER",
        confidence: asset.confidence ?? 1,
      },
    },
  );
  const result = z
    .object({
      requestId: z.literal(requestId),
      assetId: z.literal(assetId),
      descriptionFingerprint: z.literal(hash),
      status: z.literal("indexed"),
      embeddingModel: z.string().min(1).max(255),
    })
    .strict()
    .parse(response.data);
  return {
    ...asset,
    indexState: "READY" as const,
    descriptionFingerprint: hash,
    embeddingModel: result.embeddingModel,
    updatedAt: new Date(),
  };
}
