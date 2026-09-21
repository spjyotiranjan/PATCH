import "server-only";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { currentVisualVersion, type VisualAssetRecord } from "./visual-assets";
import { enqueueVisualIndex, type DiscoveryRecord } from "./visual-pipeline";
import { oid, queue, type Context } from "./context";
import { scanBatch } from "./scan";

export async function repairVisuals(base: Context) {
  // Fair bounded scans; never start enrichment for historical, unrequested sources.
  const assets = await scanBatch<VisualAssetRecord>(
    base,
    "visualSourceAssets",
    "repair-visual-assets",
    {},
    100,
  );
  for (const candidate of assets) {
    const ctx: Context = {
      ...base,
      system: true,
      actor: { tenantId: candidate.tenantId, userId: "system:repair" },
    };
    await withDatabaseTransaction(ctx.config, async (db, session) => {
      const tx = { ...ctx, db, session };
      const asset = await db
        .collection<VisualAssetRecord>("visualSourceAssets")
        .findOne(
          { _id: candidate._id, tenantId: candidate.tenantId },
          { session },
        );
      if (!asset) return;
      let current = true;
      try {
        await currentVisualVersion(tx, asset.documentVersionId);
      } catch {
        current = false;
      }
      if (!current) {
        await db
          .collection<VisualAssetRecord>("visualSourceAssets")
          .updateOne(
            { _id: asset._id, tenantId: asset.tenantId },
            { $set: { indexState: "DISABLED" } },
            { session },
          );
        // Periodic idempotent cleanup also catches a stale external upsert whose
        // worker lost its lease before the database commit. Scope always excludes it.
        await queue(
          tx,
          "VISUAL_DELETE",
          `visual-delete:${asset.documentVersionId}:${new Date().toISOString().slice(0, 10)}`,
          { versionId: asset.documentVersionId },
        );
        return;
      }
      if (
        asset.indexState === "DISABLED" &&
        asset.descriptionState === "READY"
      ) {
        asset.indexGeneration = (asset.indexGeneration ?? 0) + 1;
        await db
          .collection<VisualAssetRecord>("visualSourceAssets")
          .updateOne(
            { _id: asset._id, tenantId: asset.tenantId },
            { $set: { indexGeneration: asset.indexGeneration } },
            { session },
          );
        await enqueueVisualIndex(tx, asset);
      } else if (asset.state === "QUEUED") {
        await queue(tx, "VISUAL_RENDER", `visual:${asset._id.toHexString()}`, {
          assetId: asset._id.toHexString(),
        });
      } else if (
        asset.state === "READY" &&
        (asset.descriptionState === "QUEUED" ||
          (asset.automatic && !asset.descriptionState))
      ) {
        await queue(
          tx,
          "VISUAL_DESCRIBE",
          `visual-describe:${asset._id.toHexString()}`,
          { assetId: asset._id.toHexString() },
        );
      } else if (
        asset.descriptionState === "READY" &&
        (!asset.indexState || asset.indexState === "QUEUED")
      ) {
        await enqueueVisualIndex(tx, asset);
      }
    });
  }
  const discoveries = await scanBatch<DiscoveryRecord>(
    base,
    "visualDiscovery",
    "repair-visual-discovery",
    { status: { $in: ["QUEUED", "PROCESSING"] } },
  );
  for (const record of discoveries) {
    const ctx: Context = {
      ...base,
      system: true,
      actor: { tenantId: record.tenantId, userId: "system:repair" },
    };
    try {
      await currentVisualVersion(ctx, record._id.toHexString());
    } catch {
      continue;
    }
    if (record.status === "QUEUED")
      await queue(
        ctx,
        "VISUAL_TRIAGE",
        `visual-triage:${record._id.toHexString()}:v1`,
        { versionId: record._id.toHexString() },
      );
    else
      for (const page of record.pages.filter(
        (p) => !record.completedPages.includes(p),
      ))
        await queue(
          ctx,
          "VISUAL_DISCOVER",
          `visual-discover:${record._id.toHexString()}:${page}:v1`,
          { versionId: record._id.toHexString(), page },
        );
  }
  return {
    inspectedAssets: assets.length,
    inspectedDiscoveries: discoveries.length,
  };
}

export async function afterVisualDelete(ctx: Context, versionId: string) {
  const assets = await ctx.db
    .collection<VisualAssetRecord>("visualSourceAssets")
    .find(
      { tenantId: ctx.actor.tenantId, documentVersionId: versionId },
      { session: ctx.session },
    )
    .limit(100)
    .toArray();
  let current = true;
  try {
    await currentVisualVersion(ctx, versionId);
  } catch {
    current = false;
  }
  for (const asset of assets) {
    await ctx.db.collection<VisualAssetRecord>("visualSourceAssets").updateOne(
      { _id: oid(asset._id.toHexString()), tenantId: asset.tenantId },
      {
        $set: {
          indexState: "DISABLED",
          indexGeneration: (asset.indexGeneration ?? 0) + 1,
        },
      },
      { session: ctx.session },
    );
    if (current && asset.descriptionState === "READY") {
      await enqueueVisualIndex(ctx, {
        ...asset,
        indexGeneration: (asset.indexGeneration ?? 0) + 1,
      });
    }
  }
}
