import "server-only";
import { audit, fail, oid, type Context } from "./context";
import { withDatabaseTransaction } from "@/lib/database/mongodb";

export async function inspectJobs(ctx: Context) {
  const jobs = await ctx.db
    .collection("outboxEvents")
    .find(
      { status: { $ne: "COMPLETED" } },
      {
        projection: {
          kind: 1,
          status: 1,
          attempts: 1,
          availableAt: 1,
          createdAt: 1,
          requestId: 1,
          tenantId: 1,
        },
      },
    )
    .sort({ availableAt: 1, _id: 1 })
    .limit(100)
    .toArray();
  const counts = await ctx.db
    .collection("outboxEvents")
    .aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();
  return {
    items: jobs.map(({ _id, ...job }) => ({ id: _id.toHexString(), ...job })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  };
}

export async function retryJob(ctx: Context, jobId: string, reason: string) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const job = await db.collection("outboxEvents").findOneAndUpdate(
      { _id: oid(jobId), status: "DEAD_LETTER" },
      {
        $set: { status: "PENDING", attempts: 0, availableAt: new Date() },
        $unset: { leaseToken: "", leaseUntil: "" },
      },
      { returnDocument: "after", session },
    );
    if (!job) fail("DEAD_LETTER_JOB_REQUIRED", 409);
    if (
      ["VISUAL_RENDER", "VISUAL_DESCRIBE", "VISUAL_INDEX"].includes(job.kind)
    ) {
      await db.collection("visualSourceAssets").updateOne(
        {
          _id: oid(job.payload.assetId),
          tenantId: job.tenantId,
          ...(job.kind === "VISUAL_INDEX"
            ? {
                $or: [
                  { indexGeneration: job.payload.indexGeneration ?? 0 },
                  ...((job.payload.indexGeneration ?? 0) === 0
                    ? [{ indexGeneration: { $exists: false } }]
                    : []),
                ],
              }
            : {}),
          ...(job.kind === "VISUAL_RENDER"
            ? { state: "FAILED" }
            : job.kind === "VISUAL_DESCRIBE"
              ? { descriptionState: "FAILED" }
              : { indexState: "FAILED" }),
        },
        {
          $set: {
            ...(job.kind === "VISUAL_RENDER"
              ? { state: "QUEUED" }
              : job.kind === "VISUAL_DESCRIBE"
                ? { descriptionState: "QUEUED" }
                : { indexState: "QUEUED" }),
            updatedAt: new Date(),
          },
        },
        { session },
      );
    }
    if (["VISUAL_TRIAGE", "VISUAL_DISCOVER"].includes(job.kind))
      await db.collection("visualDiscovery").updateOne(
        { _id: oid(job.payload.versionId), tenantId: job.tenantId },
        {
          $set: {
            status: job.kind === "VISUAL_TRIAGE" ? "QUEUED" : "PROCESSING",
          },
        },
        { session },
      );
    await audit(
      {
        ...ctx,
        db,
        session,
        actor: { tenantId: job.tenantId, userId: "system:operator" },
      },
      "BACKGROUND_JOB_RETRIED",
      {
        jobId,
        reason,
      },
    );
    return { jobId, status: "PENDING" };
  });
}
