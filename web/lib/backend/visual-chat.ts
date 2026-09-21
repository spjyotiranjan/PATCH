import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAiServiceClient } from "@/lib/ai/client";
import { sourceUrl } from "@/lib/storage/r2";
import { fail, oid, type Context } from "./context";
import { assignedVersionIds } from "./scope";
import {
  currentVisualVersion,
  metadataSchema,
  type VisualAssetRecord,
} from "./visual-assets";
import type { Schema } from "./models";

export async function prepareVisualChat(
  ctx: Context,
  request: Schema["QuestionRequest"],
) {
  if (!ctx.config.VISUAL_RETRIEVAL_ENABLED) return;
  const allowed = assignedVersionIds(
    request.retrievalScopeManifest,
    request.assignedReferences ?? [],
  );
  const assets = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .find({
      tenantId: ctx.actor.tenantId,
      documentVersionId: { $in: [...allowed] },
      state: "READY",
      descriptionState: "READY",
      indexState: "READY",
    })
    .sort({ documentVersionId: 1, page: 1, _id: 1 })
    .limit(101)
    .toArray();
  request.visualScopePartial = assets.length > 100;
  const entries: Schema["VisualScopeEntry"][] = [];
  const usable = new Map<string, VisualAssetRecord>();
  const checkedVersions = new Set<string>();
  for (const asset of assets.slice(0, 100)) {
    if (
      !asset.metadata ||
      !asset.descriptionFingerprint ||
      !asset.embeddingModel ||
      !asset.objectKey
    )
      continue;
    try {
      if (!checkedVersions.has(asset.documentVersionId)) {
        await currentVisualVersion(ctx, asset.documentVersionId);
        checkedVersions.add(asset.documentVersionId);
      }
    } catch {
      continue;
    }
    entries.push({
      asset: metadataSchema.parse(asset.metadata),
      descriptionFingerprint: asset.descriptionFingerprint,
      embeddingModel: asset.embeddingModel,
      visualClass: asset.visualClass ?? "OTHER",
      confidence: asset.confidence ?? 1,
    });
    usable.set(asset._id.toHexString(), asset);
  }
  request.visualScopeManifest = entries;
  const requestId = randomUUID();
  try {
    const response = await createAiServiceClient(ctx.config).POST(
      "/v1/visual-assets/search",
      {
        body: { ...request, requestId },
        signal: AbortSignal.timeout(20000),
      },
    );
    const selection = z
      .object({
        requestId: z.literal(requestId),
        state: z.enum(["TEXT_ONLY", "AVAILABLE", "UNAVAILABLE"]),
        visualRequired: z.boolean(),
        selected: z
          .array(
            z
              .object({
                assetId: z.string(),
                relevanceRole: z.enum(["REQUIRED", "HELPFUL"]),
              })
              .strict(),
          )
          .max(3),
      })
      .strict()
      .parse(response.data);
    if (
      new Set(selection.selected.map((s) => s.assetId)).size !==
        selection.selected.length ||
      selection.selected.some((s) => !usable.has(s.assetId)) ||
      (selection.state === "AVAILABLE") !== selection.selected.length > 0
    )
      fail("VISUAL_SELECTION_INVALID", 502);
    request.visualSelection = selection;
    request.visualSources = [];
    for (const selected of selection.selected) {
      const record = usable.get(selected.assetId)!;
      await currentVisualVersion(ctx, record.documentVersionId);
      request.visualSources.push({
        requestId: request.requestId,
        contractVersion: "v1",
        tenantId: ctx.actor.tenantId,
        approvalState: "APPROVED",
        asset: record.metadata!,
        sourceFile: {
          url: await sourceUrl(ctx.config, record.objectKey!),
          contentType: "image/png",
          sha256: record.metadata!.sha256,
        },
      });
    }
  } catch {
    request.visualSelection = {
      requestId,
      state: "UNAVAILABLE",
      selected: [],
      visualRequired: request.visualSelection?.visualRequired ?? false,
    };
    request.visualSources = [];
  }
}

export async function validateVisualAnswer(
  ctx: Context,
  result: Schema["QuestionResult"],
  request: Schema["QuestionRequest"],
) {
  const citations = result.visualCitations ?? [],
    observations = result.visualObservations ?? [];
  if (
    citations.length > 3 ||
    observations.length > 6 ||
    new Set(citations.map((c) => c.id)).size !== citations.length ||
    new Set(citations.map((c) => c.assetId)).size !== citations.length ||
    ((citations.length > 0 || observations.length > 0) &&
      result.visualEvidenceState !== "AVAILABLE") ||
    (result.visualEvidenceState === "AVAILABLE" &&
      (!citations.length || !observations.length))
  )
    fail("AI_VISUAL_INVALID", 502);
  const allowed = assignedVersionIds(
    request.retrievalScopeManifest,
    request.assignedReferences ?? [],
  );
  for (const citation of citations) {
    const entry = request.visualScopeManifest?.find(
      (e) => e.asset.assetId === citation.assetId,
    );
    const source = request.visualSources?.find(
      (s) => s.asset.assetId === citation.assetId,
    );
    const selection = request.visualSelection?.selected?.find(
      (s) => s.assetId === citation.assetId,
    );
    if (
      !entry ||
      !source ||
      !selection ||
      selection.relevanceRole !== citation.relevanceRole ||
      !allowed.has(citation.documentVersionId)
    )
      fail("AI_VISUAL_INVALID", 502);
    const stored = await ctx.db
      .collection<VisualAssetRecord>("visualSourceAssets")
      .findOne(
        { _id: oid(citation.assetId), tenantId: ctx.actor.tenantId },
        { session: ctx.session },
      );
    if (
      !stored ||
      stored.indexState !== "READY" ||
      stored.descriptionState !== "READY" ||
      stored.state !== "READY" ||
      stored.descriptionFingerprint !== citation.descriptionFingerprint ||
      stored.embeddingModel !== entry.embeddingModel ||
      citation.visualClass !== (stored.visualClass ?? "OTHER")
    )
      fail("AI_VISUAL_INVALID", 502);
    const version = await currentVisualVersion(ctx, citation.documentVersionId);
    for (const meta of [stored.metadata, entry.asset, source.asset]) {
      if (
        !meta ||
        meta.assetId !== citation.assetId ||
        meta.documentId !== citation.documentId ||
        meta.documentVersionId !== citation.documentVersionId ||
        meta.sha256 !== citation.sha256 ||
        meta.page !== citation.page ||
        meta.originalSha256 !== version.sha256.toLowerCase() ||
        ["left", "top", "right", "bottom"].some(
          (k) =>
            meta.bounds[k as keyof typeof meta.bounds] !==
            citation.bounds[k as keyof typeof citation.bounds],
        )
      )
        fail("AI_VISUAL_INVALID", 502);
    }
    if (entry.descriptionFingerprint !== citation.descriptionFingerprint)
      fail("AI_VISUAL_INVALID", 502);
  }
  const ids = new Set(citations.map((c) => c.id));
  for (const observation of observations)
    if (
      !observation.text.trim() ||
      observation.text.length > 2000 ||
      !observation.visualCitationIds.length ||
      observation.visualCitationIds.some((id) => !ids.has(id))
    )
      fail("AI_VISUAL_INVALID", 502);
  if (
    citations.some(
      (c) => !observations.some((o) => o.visualCitationIds.includes(c.id)),
    )
  )
    fail("AI_VISUAL_INVALID", 502);
  if (
    ["outdated", "conflicting", "unavailable"].includes(result.status) &&
    citations.length
  )
    fail("AI_VISUAL_INVALID", 502);
  if (
    request.visualSelection?.visualRequired &&
    result.visualEvidenceState !== "AVAILABLE" &&
    result.status === "approved"
  )
    fail("AI_VISUAL_INVALID", 502);
}
