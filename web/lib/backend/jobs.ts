import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { createAiServiceClient } from "@/lib/ai/client";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { sourceUrl } from "@/lib/storage/r2";
import {
  audit,
  fail,
  fingerprint,
  invalidateEntity,
  oid,
  queue,
  type Context,
  type Entity,
} from "./context";
import { activateVersion } from "./documents";
import type {
  DocumentRecord,
  ProfileRecord,
  Schema,
  VersionRecord,
} from "./models";
import {
  createRun,
  draftRequest,
  type Procedure,
  type ProcedureVersion,
} from "./procedures";
import { composedDocuments, validateCitations } from "./scope";
import {
  buildProcedureEvidence,
  type ProcedureEvidence,
} from "./procedure-evidence";
import { scanBatch } from "./scan";
import { logEvent } from "@/lib/observability/logger";
import {
  buildVisualAsset,
  buildVisualDescription,
  currentVisualVersion,
  type VisualAssetRecord,
} from "./visual-assets";

interface Job {
  _id: ObjectId;
  tenantId: string;
  kind: string;
  key: string;
  payload: {
    versionId?: string;
    entity?: Entity;
    revision?: number;
    projectId?: string;
    procedureId?: string;
    assetId?: string;
  };
  status: string;
  attempts: number;
  leaseToken: string;
  leaseUntil: Date;
  availableAt: Date;
  requestId: string;
}

async function currentLease(ctx: Context, job: Job) {
  const valid = await ctx.db.collection<Job>("outboxEvents").findOne(
    {
      _id: job._id,
      status: "RUNNING",
      leaseToken: job.leaseToken,
      leaseUntil: { $gt: new Date() },
    },
    { session: ctx.session },
  );
  if (!valid) fail("JOB_LEASE_EXPIRED");
}
async function applyJob(
  ctx: Context,
  job: Job,
  apply: (tx: Context) => Promise<void>,
) {
  await withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await currentLease(tx, job);
    await apply(tx);
    await db
      .collection<Job>("outboxEvents")
      .updateOne(
        { _id: job._id, leaseToken: job.leaseToken },
        { $set: { status: "COMPLETED" } },
        { session },
      );
    await audit(tx, "BACKGROUND_JOB_COMPLETED", {
      jobId: job._id.toHexString(),
      kind: job.kind,
    });
    return true;
  });
}

async function processVersion(ctx: Context, job: Job) {
  const id = job.payload.versionId!;
  const version = await ctx.db
    .collection<VersionRecord>("documentVersions")
    .findOne({ _id: oid(id), tenantId: job.tenantId });
  if (!version?.uploadCompletedAt) fail("SOURCE_NOT_READY");
  const document = await ctx.db
    .collection<DocumentRecord>("documents")
    .findOne({ _id: oid(version.documentId), tenantId: job.tenantId });
  if (!document) fail("DOCUMENT_NOT_FOUND", 404);
  const client = createAiServiceClient(ctx.config);
  const requestId = randomUUID();
  const sourceFile = {
    url: await sourceUrl(ctx.config, version.objectKey),
    contentType: version.contentType,
    sha256: version.sha256,
  };
  if (job.kind === "EXTRACT") {
    const response = await client.POST("/v1/ingestions/extract", {
      body: {
        requestId,
        contractVersion: "v1",
        documentId: version.documentId,
        documentVersionId: id,
        versionNumber: String(version.versionNumber),
        sourceFile,
        declaredMetadata: {
          title: document.title,
          documentType: document.documentType,
        },
      },
    });
    const result = response.data;
    if (
      result?.requestId !== requestId ||
      result.status !== "needs_review" ||
      result.documentVersionId !== id ||
      !result.pages?.length ||
      !result.documentSummary
    )
      fail("EXTRACTION_FAILED", 503);
    await applyJob(ctx, job, async (tx) => {
      await tx.db.collection<VersionRecord>("documentVersions").updateOne(
        { _id: oid(id), state: { $in: ["EXTRACTING", "FAILED"] } },
        {
          $set: {
            state: "NEEDS_REVIEW",
            extraction: result,
            updatedAt: new Date(),
          },
        },
        { session: tx.session },
      );
    });
  } else if (job.kind === "INDEX") {
    if (version.approvalState !== "APPROVED" || !version.reviewedMetadata)
      fail("SOURCE_NOT_APPROVED");
    const response = await client.POST("/v1/ingestions/index", {
      body: {
        requestId,
        contractVersion: "v1",
        tenantId: job.tenantId,
        originalFileId: id,
        documentId: version.documentId,
        documentVersionId: id,
        approvalState: "APPROVED",
        reviewedMetadata: version.reviewedMetadata,
        sourceFile,
      },
    });
    const result = response.data;
    if (
      result?.requestId !== requestId ||
      result.status !== "indexed" ||
      result.documentVersionId !== id ||
      result.contentFingerprint !== version.sha256 ||
      result.chunkCount < 1
    )
      fail("INDEXING_FAILED", 503);
    await applyJob(ctx, job, async (tx) => {
      await tx.db.collection<VersionRecord>("documentVersions").updateOne(
        {
          _id: oid(id),
          state: { $in: ["INDEXING", "FAILED"] },
          approvalState: "APPROVED",
        },
        { $set: { state: "INDEXED", index: result, updatedAt: new Date() } },
        { session: tx.session },
      );
      await queue(tx, "ACTIVATE", `activate:${id}`, { versionId: id });
    });
  } else {
    await currentLease(ctx, job);
    await activateVersion(ctx, id);
    await applyJob(ctx, job, async () => {});
  }
}

async function processProfile(ctx: Context, job: Job) {
  const entity = job.payload.entity!;
  if (entity.type === "PERSONAL") return applyJob(ctx, job, async () => {});
  const stored = await ctx.db
    .collection<ProfileRecord>("entityProfiles")
    .findOne({
      tenantId: job.tenantId,
      entityType: entity.type,
      entityId: entity.id,
    });
  if (!stored || stored.revision !== job.payload.revision)
    return applyJob(ctx, job, async () => {});
  const source = await ctx.db
    .collection(entity.type === "PROJECT" ? "projects" : "equipments")
    .findOne({ _id: oid(entity.id), tenantId: job.tenantId });
  if (!source) return applyJob(ctx, job, async () => {});
  const { documents, links } = await composedDocuments(ctx, entity);
  const versions = await ctx.db
    .collection<VersionRecord>("documentVersions")
    .find({
      _id: {
        $in: documents.flatMap((d) =>
          d.activeVersionId ? [oid(d.activeVersionId)] : [],
        ),
      },
      tenantId: job.tenantId,
      state: "ACTIVE",
      approvalState: "APPROVED",
    })
    .toArray();
  const equipments =
    entity.type === "PROJECT"
      ? await ctx.db
          .collection<ProfileRecord>("entityProfiles")
          .find({
            tenantId: job.tenantId,
            entityType: "EQUIPMENT",
            entityId: { $in: source.includedEquipmentIds.map(String) },
          })
          .toArray()
      : [];
  const input: Schema["EntityProfileInput"] = {
    type: entity.type,
    id: entity.id,
    profileVersion: stored.revision,
    userDescription: source.description ?? null,
    workflowCoverage:
      entity.type === "PROJECT"
        ? (
            await ctx.db
              .collection<Procedure>("safetyProcedures")
              .find({
                tenantId: job.tenantId,
                projectId: entity.id,
                currentPublishedVersionId: { $ne: null },
              })
              .limit(100)
              .toArray()
          ).map((p) => p.title)
        : [],
    activeDocuments: versions.map((v) => ({
      documentId: v.documentId,
      documentVersionId: v._id.toHexString(),
      title: v.reviewedMetadata!.title,
      documentSummary: v.extraction!.documentSummary!.summary,
      inclusion:
        entity.type === "EQUIPMENT"
          ? "EQUIPMENT_DIRECT"
          : links.some(
                (l) =>
                  l.entity.id === entity.id && l.documentId === v.documentId,
              )
            ? "PROJECT_DIRECT"
            : "EQUIPMENT_DERIVED",
    })),
    includedEquipmentProfiles: equipments
      .filter((e) => !!e.result)
      .map((e) => ({
        equipmentId: e.entityId,
        profileId: e.result!.profileId,
        profileVersion: e.result!.profileVersion,
        profileFingerprint: e.result!.profileFingerprint,
        freshnessState: e.state === "FRESH" ? "FRESH" : "STALE",
        generatedDescription: e.result!.generatedDescription,
        coverageTopics: e.result!.coverage?.map((c) => c.topic) ?? [],
      })),
  };
  const requestId = randomUUID();
  const inputFingerprint = fingerprint(input);
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/entity-profiles/upsert",
    {
      body: {
        requestId,
        contractVersion: "v1",
        tenantId: job.tenantId,
        inputFingerprint,
        entity: input,
      },
    },
  );
  const result = response.data;
  if (
    result?.requestId !== requestId ||
    result.status !== "upserted" ||
    result.entityId !== entity.id ||
    result.profileVersion !== stored.revision ||
    result.provenance.inputFingerprint !== inputFingerprint ||
    result.provenance.tenantId !== job.tenantId
  )
    fail("PROFILE_REFRESH_FAILED", 503);
  await applyJob(ctx, job, async (tx) => {
    const updated = await tx.db
      .collection<ProfileRecord>("entityProfiles")
      .updateOne(
        { _id: stored._id, revision: job.payload.revision },
        { $set: { state: "FRESH", result } },
        { session: tx.session },
      );
    if (updated.modifiedCount && entity.type === "EQUIPMENT") {
      const projects = await tx.db
        .collection("projects")
        .find(
          { tenantId: job.tenantId, includedEquipmentIds: oid(entity.id) },
          { session: tx.session },
        )
        .toArray();
      for (const p of projects)
        await invalidateEntity(tx, {
          type: "PROJECT",
          id: p._id.toHexString(),
        });
    }
  });
}

async function processProcedure(ctx: Context, job: Job) {
  const projectId = job.payload.projectId!;
  const request = await draftRequest(ctx, projectId);
  if (!request) return applyJob(ctx, job, async () => {});
  const key = {
    tenantId: job.tenantId,
    projectId: oid(projectId),
    inputFingerprint: request.inputFingerprint,
  };
  const existing = await ctx.db
    .collection("procedureGenerationRequests")
    .findOne(key);
  if (existing?.status === "READY") return applyJob(ctx, job, async () => {});
  await ctx.db.collection("procedureGenerationRequests").updateOne(
    key,
    {
      $set: { status: "GENERATING", updatedAt: new Date() },
      $setOnInsert: {
        _id: new ObjectId(),
        generationRequestId: request.generationRequestId,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/procedure-drafts",
    { body: request },
  );
  const result = response.data;
  if (
    result?.requestId !== request.requestId ||
    result.status !== "generated" ||
    result.inputFingerprint !== request.inputFingerprint ||
    result.generationRequestId !== request.generationRequestId ||
    result.requiresHumanReview !== true
  )
    fail("PROCEDURE_GENERATION_FAILED", 503);
  await applyJob(ctx, job, async (tx) => {
    const latest = await draftRequest(tx, projectId);
    if (latest?.inputFingerprint !== request.inputFingerprint)
      fail("SOURCE_SET_CHANGED");
    if (
      (
        await tx.db
          .collection("procedureGenerationRequests")
          .findOne(key, { session: tx.session })
      )?.status === "READY"
    )
      return;
    await validateCitations(
      tx,
      result.citations ?? [],
      latest.retrievalScopeManifest,
      new Set(
        [
          ...request.activeSources,
          ...(request.supplementalEquipmentSources ?? []),
        ].map((s) => s.documentVersionId),
      ),
    );
    if (
      result.steps?.some(
        (s) =>
          !s.citationIds.length ||
          s.citationIds.some(
            (id) => !result.citations?.some((c) => c.id === id),
          ),
      ) ||
      new Set(result.steps?.map((s) => s.stepId)).size !==
        (result.steps?.length ?? 0)
    )
      fail("AI_PROCEDURE_INVALID", 502);
    let procedure = await tx.db
      .collection<Procedure>("safetyProcedures")
      .findOne(
        {
          tenantId: job.tenantId,
          projectId,
          ...(job.payload.procedureId
            ? { _id: oid(job.payload.procedureId) }
            : {}),
        },
        { session: tx.session },
      );
    if (!procedure) {
      procedure = {
        _id: new ObjectId(),
        tenantId: job.tenantId,
        projectId,
        title: result.title ?? "Source review required",
        currentPublishedVersionId: null,
        nextVersion: 0,
        createdAt: new Date(),
      };
      await tx.db
        .collection<Procedure>("safetyProcedures")
        .insertOne(procedure, { session: tx.session });
    }
    const updated = await tx.db
      .collection<Procedure>("safetyProcedures")
      .findOneAndUpdate(
        { _id: procedure._id },
        { $inc: { nextVersion: 1 } },
        { session: tx.session, returnDocument: "after" },
      );
    const version: ProcedureVersion = {
      _id: new ObjectId(),
      tenantId: job.tenantId,
      projectId,
      procedureId: procedure._id.toHexString(),
      versionNumber: updated!.nextVersion,
      state: "DRAFT",
      revision: 1,
      title: result.title ?? "Source review required",
      steps: (result.steps ?? []).map((s, i) => ({
        ...s,
        position: i + 1,
        citationReviewState: "CONFIRMED",
      })),
      citations: result.citations ?? [],
      reviewAnalysis: result.reviewAnalysis,
      inputFingerprint: request.inputFingerprint,
      generationRequestId: request.generationRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await tx.db
      .collection<ProcedureVersion>("procedureVersions")
      .insertOne(version, { session: tx.session });
    await tx.db.collection("procedureGenerationRequests").updateOne(
      key,
      {
        $set: {
          status: "READY",
          procedureId: version.procedureId,
          procedureVersionId: version._id.toHexString(),
          updatedAt: new Date(),
        },
      },
      { session: tx.session },
    );
    await audit(tx, "PROCEDURE_AI_DRAFT_SAVED", {
      projectId,
      procedureId: version.procedureId,
      versionId: version._id.toHexString(),
      inputFingerprint: request.inputFingerprint,
    });
  });
}

export async function runJobs(base: Context, limit = 10) {
  const outcomes = [];
  for (let i = 0; i < Math.min(limit, 25); i++) {
    const now = new Date();
    const job = await base.db.collection<Job>("outboxEvents").findOneAndUpdate(
      {
        $or: [
          { status: "PENDING", availableAt: { $lte: now } },
          { status: "RUNNING", leaseUntil: { $lt: now } },
        ],
      },
      {
        $set: {
          status: "RUNNING",
          leaseToken: randomUUID(),
          leaseUntil: new Date(Date.now() + 300000),
        },
        $inc: { attempts: 1 },
      },
      { sort: { availableAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!job) break;
    const started = performance.now();
    const ctx: Context = {
      ...base,
      actor: { tenantId: job.tenantId, userId: "system:worker" },
      requestId: job.requestId,
      system: true,
    };
    try {
      if (["EXTRACT", "INDEX", "ACTIVATE"].includes(job.kind))
        await processVersion(ctx, job);
      else if (job.kind === "PROFILE") await processProfile(ctx, job);
      else if (job.kind === "PROCEDURE") await processProcedure(ctx, job);
      else if (["VISUAL_RENDER", "VISUAL_DESCRIBE"].includes(job.kind)) {
        await currentLease(ctx, job);
        const asset =
          job.kind === "VISUAL_RENDER"
            ? await buildVisualAsset(ctx, job.payload.assetId!)
            : await buildVisualDescription(ctx, job.payload.assetId!);
        await applyJob(ctx, job, async (tx) => {
          const version = await currentVisualVersion(
            tx,
            asset.documentVersionId,
          );
          if (version.sha256.toLowerCase() !== asset.originalSha256)
            fail("VISUAL_SOURCE_CHANGED");
          await tx.db
            .collection<VisualAssetRecord>("visualSourceAssets")
            .replaceOne(
              {
                _id: asset._id,
                tenantId: job.tenantId,
                selectionFingerprint: asset.selectionFingerprint,
              },
              asset,
              { session: tx.session },
            );
          await audit(
            tx,
            job.kind === "VISUAL_RENDER"
              ? "VISUAL_ASSET_READY"
              : "VISUAL_DESCRIPTION_READY",
            {
              assetId: asset._id.toHexString(),
              versionId: asset.documentVersionId,
            },
          );
        });
      } else if (job.kind === "PROCEDURE_EVIDENCE") {
        const evidence = await buildProcedureEvidence(
          ctx,
          job.payload.versionId!,
        );
        await applyJob(ctx, job, async (tx) => {
          await tx.db
            .collection<ProcedureEvidence>("procedureEvidence")
            .updateOne(
              { _id: evidence._id, tenantId: job.tenantId },
              { $setOnInsert: evidence },
              { upsert: true, session: tx.session },
            );
          await invalidateEntity(tx, {
            type: "PROJECT",
            id: evidence.projectId,
          });
        });
      } else fail("UNKNOWN_JOB_KIND");
      outcomes.push({ jobId: job._id.toHexString(), status: "COMPLETED" });
      logEvent("info", "patch_web.worker.completed", {
        requestId: job.requestId,
        jobId: job._id.toHexString(),
        kind: job.kind,
        durationMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      const status = job.attempts >= 5 ? "DEAD_LETTER" : "PENDING";
      if (
        ["VISUAL_RENDER", "VISUAL_DESCRIBE"].includes(job.kind) &&
        status === "DEAD_LETTER"
      ) {
        // Fence the asset-state update with the lease, just like successful commits.
        try {
          await withDatabaseTransaction(ctx.config, async (db, session) => {
            const tx = { ...ctx, db, session };
            await currentLease(tx, job);
            await db
              .collection<VisualAssetRecord>("visualSourceAssets")
              .updateOne(
                {
                  _id: oid(job.payload.assetId!),
                  tenantId: job.tenantId,
                  ...(job.kind === "VISUAL_RENDER"
                    ? { state: { $ne: "READY" } }
                    : { descriptionState: { $ne: "READY" } }),
                },
                {
                  $set: {
                    ...(job.kind === "VISUAL_RENDER"
                      ? { state: "FAILED" as const }
                      : { descriptionState: "FAILED" as const }),
                    updatedAt: new Date(),
                  },
                },
                { session },
              );
          });
        } catch {
          /* A newer lease owns the result; do not overwrite it. */
        }
      }
      await base.db.collection<Job>("outboxEvents").updateOne(
        { _id: job._id, leaseToken: job.leaseToken, status: "RUNNING" },
        {
          $set: {
            status,
            availableAt: new Date(
              Date.now() + Math.min(300000, 1000 * 2 ** job.attempts),
            ),
          },
        },
      );
      if (job.payload.entity)
        await base.db.collection<ProfileRecord>("entityProfiles").updateOne(
          {
            tenantId: job.tenantId,
            entityId: job.payload.entity.id,
            revision: job.payload.revision,
          },
          { $set: { state: "FAILED" } },
        );
      if (job.payload.versionId && status === "DEAD_LETTER")
        await base.db.collection<VersionRecord>("documentVersions").updateOne(
          {
            _id: oid(job.payload.versionId),
            state: { $in: ["EXTRACTING", "INDEXING"] },
          },
          { $set: { state: "FAILED", updatedAt: new Date() } },
        );
      if (job.payload.projectId)
        await base.db.collection("procedureGenerationRequests").updateMany(
          {
            tenantId: job.tenantId,
            projectId: oid(job.payload.projectId),
            status: "GENERATING",
          },
          { $set: { status: "FAILED", updatedAt: new Date() } },
        );
      await audit(ctx, "BACKGROUND_JOB_FAILED", {
        jobId: job._id.toHexString(),
        kind: job.kind,
        attempts: job.attempts,
        status,
      });
      outcomes.push({ jobId: job._id.toHexString(), status });
      logEvent("error", "patch_web.worker.failed", {
        requestId: job.requestId,
        jobId: job._id.toHexString(),
        kind: job.kind,
        status,
        attempts: job.attempts,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  return { items: outcomes };
}

export async function runScheduler(base: Context) {
  const procedures = await scanBatch<Procedure>(
    base,
    "safetyProcedures",
    "scheduler-procedures",
    {
      schedule: { $exists: true },
      currentPublishedVersionId: { $ne: null },
    },
  );
  let createdOrExisting = 0;
  let failed = 0;
  for (const procedure of procedures) {
    try {
      await createRun(
        {
          ...base,
          system: true,
          actor: { tenantId: procedure.tenantId, userId: "system:scheduler" },
        },
        procedure.projectId,
        procedure._id.toHexString(),
      );
      createdOrExisting++;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "PROCEDURE_NOT_DUE")
        failed++;
    }
  }
  if (failed)
    logEvent("error", "patch_web.scheduler.failed", {
      requestId: base.requestId,
      failed,
    });
  return { checked: procedures.length, createdOrExisting, failed };
}
