import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { createAiServiceClient } from "@/lib/ai/client";
import { citationSchema } from "@/lib/ai/socket";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import {
  audit,
  entityAccess,
  fail,
  fingerprint,
  idSchema,
  invalidateEntity,
  oid,
  queue,
  view,
  type Context,
} from "./context";
import type { Schema, VersionRecord } from "./models";
import {
  recurrencePeriod,
  recurrenceSchema,
  type Recurrence,
} from "./recurrence";
import { resolveManifest, validateCitations } from "./scope";

export const revisionSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
export const stepSchema = z
  .object({
    stepId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    title: z.string().trim().min(1).max(300),
    instructions: z.string().trim().min(1).max(4000),
    required: z.boolean(),
    citationIds: z.array(z.string()).min(1).max(100),
  })
  .strict();
export const editProcedureSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    title: z.string().trim().min(1).max(300),
    steps: z.array(stepSchema).min(1).max(100),
    citations: z.array(citationSchema).max(100),
  })
  .strict()
  .refine((v) => new Set(v.steps.map((s) => s.stepId)).size === v.steps.length);
export const approvalSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    confirmHumanReview: z.literal(true),
    acknowledgedReasons: z.array(z.string()).max(100),
  })
  .strict();
export const completionSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    checked: z.boolean(),
    note: z.string().trim().max(2000).default(""),
    exception: z.string().trim().max(2000).nullable().default(null),
  })
  .strict();
export const regenerationSchema = z
  .object({
    supplementalEquipmentDocumentIds: z.array(idSchema).max(100).optional(),
  })
  .strict();
export type StoredStep = Schema["ProcedureStep"] & {
  citationReviewState: "CONFIRMED" | "NEEDS_REVIEW";
};
export interface Procedure {
  _id: ObjectId;
  tenantId: string;
  projectId: string;
  title: string;
  currentPublishedVersionId: string | null;
  nextVersion: number;
  schedule?: Recurrence;
  supplementalEquipmentDocumentIds?: string[];
  createdAt: Date;
}
export interface ProcedureVersion {
  _id: ObjectId;
  tenantId: string;
  projectId: string;
  procedureId: string;
  versionNumber: number;
  state: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED";
  revision: number;
  title: string;
  steps: StoredStep[];
  citations: Schema["Citation"][];
  reviewAnalysis: Schema["ReviewAnalysis"];
  inputFingerprint: string;
  generationRequestId: string;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  publishedAt?: Date;
}
interface RunStep {
  stepId: string;
  required: boolean;
  checked: boolean;
  note: string;
  exception: string | null;
  actorId: string | null;
  updatedAt: Date | null;
}
export interface ProcedureRun {
  _id: ObjectId;
  tenantId: string;
  projectId: string;
  procedureId: string;
  procedureVersionId: string;
  periodStart: Date;
  periodEnd: Date;
  timezone: string;
  state: "OPEN" | "COMPLETED";
  steps: RunStep[];
  revision: number;
  createdAt: Date;
  completedAt?: Date;
  completedBy?: string;
}

export async function procedureVersion(
  ctx: Context,
  projectId: string,
  procedureId: string,
  versionId: string,
  mutate = false,
) {
  await entityAccess(ctx, { type: "PROJECT", id: projectId }, mutate);
  const record = await ctx.db
    .collection<ProcedureVersion>("procedureVersions")
    .findOne(
      {
        _id: oid(versionId),
        tenantId: ctx.actor.tenantId,
        projectId,
        procedureId,
      },
      { session: ctx.session },
    );
  if (!record) fail("PROCEDURE_VERSION_NOT_FOUND", 404);
  return record;
}
export function assertPublishable(version: ProcedureVersion) {
  if (
    version.reviewAnalysis.reviewNeed === "SEVERE" ||
    version.reviewAnalysis.blockingFindings?.length ||
    !version.steps.length ||
    version.steps.some(
      (s) =>
        s.citationReviewState !== "CONFIRMED" ||
        s.evidenceState !== "SUPPORTED" ||
        !s.citationIds.length,
    )
  )
    fail("PROCEDURE_EVIDENCE_BLOCKED");
}
export function changedSteps(
  old: StoredStep[],
  steps: z.infer<typeof stepSchema>[],
  citationsChanged: boolean,
): StoredStep[] {
  return steps.map((s, i) => {
    const before = old.find((o) => o.stepId === s.stepId);
    const unchanged =
      !citationsChanged &&
      before &&
      before.title === s.title &&
      before.instructions === s.instructions &&
      before.required === s.required &&
      fingerprint(before.citationIds) === fingerprint(s.citationIds);
    return {
      ...s,
      position: i + 1,
      evidenceState: unchanged ? before.evidenceState : "UNVERIFIED",
      citationReviewState: unchanged
        ? before.citationReviewState
        : "NEEDS_REVIEW",
    };
  });
}

export async function draftRequest(
  ctx: Context,
  projectId: string,
): Promise<Schema["ProcedureDraftRequest"] | null> {
  await entityAccess(ctx, { type: "PROJECT", id: projectId });
  const project = await ctx.db
    .collection("projects")
    .findOne(
      { _id: oid(projectId), tenantId: ctx.actor.tenantId },
      { session: ctx.session },
    );
  const manifest = await resolveManifest(ctx, {
    type: "PROJECT",
    id: projectId,
  });
  const procedure = await ctx.db
    .collection<Procedure>("safetyProcedures")
    .findOne(
      { tenantId: ctx.actor.tenantId, projectId },
      { session: ctx.session },
    );
  const selection = procedure?.supplementalEquipmentDocumentIds ?? [];
  const supplemental =
    manifest.allowedDocumentVersions?.filter(
      (v) =>
        selection.includes(v.documentId) &&
        v.inclusionPaths.includes("EQUIPMENT_DERIVED"),
    ) ?? [];
  if (new Set(supplemental.map((v) => v.documentId)).size !== selection.length)
    fail("SUPPLEMENTAL_SOURCE_NOT_CURRENT");
  const direct =
    manifest.allowedDocumentVersions?.filter(
      (v) =>
        v.inclusionPaths.includes("PROJECT_DIRECT") &&
        v.sourceEntityIds?.includes(projectId),
    ) ?? [];
  if (!direct.length) return null;
  const records = await ctx.db
    .collection<VersionRecord>("documentVersions")
    .find(
      {
        _id: {
          $in: [...direct, ...supplemental].map((d) =>
            oid(d.documentVersionId),
          ),
        },
        tenantId: ctx.actor.tenantId,
      },
      { session: ctx.session },
    )
    .toArray();
  const inputFingerprint = fingerprint({
    description: project!.description,
    versions: direct.map((v) => v.documentVersionId).sort(),
    equipmentIds: project!.includedEquipmentIds.map(String).sort(),
    supplementalVersionIds: supplemental.map((v) => v.documentVersionId).sort(),
    pipelineVersion: 1,
  });
  return {
    requestId: randomUUID(),
    contractVersion: "v1",
    tenantId: ctx.actor.tenantId,
    projectId,
    projectDescription: project!.description,
    inputFingerprint,
    generationRequestId: `${projectId}:${inputFingerprint}`,
    timezone: "UTC",
    retrievalScopeManifest: manifest,
    activeSources: records
      .filter((v) =>
        direct.some((d) => d.documentVersionId === v._id.toHexString()),
      )
      .map((v) => ({
        documentVersionId: v._id.toHexString(),
        documentTitle: v.reviewedMetadata!.title,
        revision: v.reviewedMetadata!.revision,
        inclusionPath: "PROJECT_DIRECT",
      })),
    supplementalEquipmentSources: records
      .filter((v) =>
        supplemental.some((d) => d.documentVersionId === v._id.toHexString()),
      )
      .map((v) => ({
        documentVersionId: v._id.toHexString(),
        applicability:
          "Explicitly selected by the Project Owner from this Project's included Equipment sources; verify exact hardware applicability during review.",
        equipmentId: supplemental
          .find((d) => d.documentVersionId === v._id.toHexString())!
          .sourceEntityIds!.find((id) =>
            project!.includedEquipmentIds.map(String).includes(id),
          )!,
      })),
  };
}

export async function editProcedure(
  ctx: Context,
  projectId: string,
  procedureId: string,
  versionId: string,
  input: z.infer<typeof editProcedureSchema>,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const version = await procedureVersion(
      tx,
      projectId,
      procedureId,
      versionId,
      true,
    );
    if (
      version.state === "PUBLISHED" ||
      version.revision !== input.expectedRevision
    )
      fail("PROCEDURE_REVISION_CONFLICT");
    const manifest = await resolveManifest(tx, {
      type: "PROJECT",
      id: projectId,
    });
    await validateCitations(tx, input.citations, manifest);
    if (
      input.steps.some((s) =>
        s.citationIds.some((id) => !input.citations.some((c) => c.id === id)),
      )
    )
      fail("STEP_CITATION_INVALID", 400);
    const steps = changedSteps(
      version.steps,
      input.steps,
      fingerprint(version.citations) !== fingerprint(input.citations),
    );
    const result = await db
      .collection<ProcedureVersion>("procedureVersions")
      .findOneAndUpdate(
        { _id: oid(versionId), revision: input.expectedRevision },
        {
          $set: {
            title: input.title,
            steps,
            citations: input.citations,
            reviewAnalysis: {
              ...version.reviewAnalysis,
              blockingFindings: [
                ...new Set([
                  ...(version.reviewAnalysis.blockingFindings ?? []),
                  "DRAFT_CHANGED_REVALIDATION_REQUIRED",
                ]),
              ],
            },
            state: "DRAFT",
            updatedAt: new Date(),
          },
          $unset: { approvedBy: "", approvedAt: "" },
          $inc: { revision: 1 },
        },
        { session, returnDocument: "after" },
      );
    await audit(tx, "PROCEDURE_DRAFT_EDITED", {
      projectId,
      procedureId,
      versionId,
    });
    return view(result!);
  });
}

export async function transitionProcedure(
  ctx: Context,
  projectId: string,
  procedureId: string,
  versionId: string,
  action: "review" | "request-changes" | "approve" | "publish",
  input: { expectedRevision: number; acknowledgedReasons?: string[] },
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const version = await procedureVersion(
      tx,
      projectId,
      procedureId,
      versionId,
      true,
    );
    if (
      version.state === "PUBLISHED" ||
      version.revision !== input.expectedRevision
    )
      fail("PROCEDURE_REVISION_CONFLICT");
    const states = {
      review: ["DRAFT"],
      "request-changes": ["IN_REVIEW", "APPROVED"],
      approve: ["IN_REVIEW"],
      publish: ["APPROVED"],
    };
    if (!states[action].includes(version.state))
      fail("INVALID_PROCEDURE_TRANSITION");
    if (action === "approve" || action === "publish") {
      assertPublishable(version);
      const currentInputs = await draftRequest(tx, projectId);
      if (currentInputs?.inputFingerprint !== version.inputFingerprint)
        fail("SOURCE_SET_CHANGED");
      await validateCitations(
        tx,
        version.citations,
        await resolveManifest(tx, { type: "PROJECT", id: projectId }),
      );
      if (
        action === "approve" &&
        version.reviewAnalysis.reasons?.some(
          (r) => !input.acknowledgedReasons?.includes(r),
        )
      )
        fail("REVIEW_REASONS_NOT_ACKNOWLEDGED", 400);
    }
    const state = (
      {
        review: "IN_REVIEW",
        "request-changes": "DRAFT",
        approve: "APPROVED",
        publish: "PUBLISHED",
      } as const
    )[action];
    const updated = await db
      .collection<ProcedureVersion>("procedureVersions")
      .findOneAndUpdate(
        { _id: oid(versionId), revision: input.expectedRevision },
        {
          $set: {
            state,
            updatedAt: new Date(),
            ...(action === "approve"
              ? { approvedBy: ctx.actor.userId, approvedAt: new Date() }
              : {}),
            ...(action === "publish" ? { publishedAt: new Date() } : {}),
          },
          $inc: { revision: 1 },
        },
        { session, returnDocument: "after" },
      );
    if (action === "publish") {
      await queue(tx, "PROCEDURE_EVIDENCE", `procedure-evidence:${versionId}`, {
        versionId,
      });
      await db.collection<Procedure>("safetyProcedures").updateOne(
        { _id: oid(procedureId), projectId, tenantId: ctx.actor.tenantId },
        {
          $set: {
            currentPublishedVersionId: versionId,
            title: version.title,
          },
        },
        { session },
      );
      await invalidateEntity(tx, { type: "PROJECT", id: projectId });
    }
    await audit(tx, `PROCEDURE_${action.toUpperCase().replaceAll("-", "_")}`, {
      projectId,
      procedureId,
      versionId,
    });
    return view(updated!);
  });
}

export async function forkProcedure(
  ctx: Context,
  projectId: string,
  procedureId: string,
  versionId: string,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const source = await procedureVersion(
      tx,
      projectId,
      procedureId,
      versionId,
      true,
    );
    const procedure = await db
      .collection<Procedure>("safetyProcedures")
      .findOneAndUpdate(
        { _id: oid(procedureId), tenantId: ctx.actor.tenantId, projectId },
        { $inc: { nextVersion: 1 } },
        { session, returnDocument: "after" },
      );
    if (!procedure) fail("PROCEDURE_NOT_FOUND", 404);
    const draft: ProcedureVersion = {
      ...source,
      _id: new ObjectId(),
      versionNumber: procedure.nextVersion,
      state: "DRAFT",
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    delete draft.approvedAt;
    delete draft.approvedBy;
    delete draft.publishedAt;
    await db
      .collection<ProcedureVersion>("procedureVersions")
      .insertOne(draft, { session });
    await audit(tx, "PROCEDURE_DRAFT_FORKED", {
      projectId,
      procedureId,
      sourceVersionId: versionId,
      versionId: draft._id.toHexString(),
    });
    return view(draft);
  });
}

export async function revalidateProcedure(
  ctx: Context,
  projectId: string,
  procedureId: string,
  versionId: string,
  revision: number,
) {
  const version = await procedureVersion(
    ctx,
    projectId,
    procedureId,
    versionId,
    true,
  );
  if (version.state === "PUBLISHED" || version.revision !== revision)
    fail("PROCEDURE_REVISION_CONFLICT");
  const request = await draftRequest(ctx, projectId);
  if (!request) fail("WAITING_FOR_SOURCES");
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/procedure-drafts/revalidate",
    {
      body: {
        ...request,
        steps: version.steps.map(({ citationReviewState: _state, ...step }) => {
          void _state;
          return step;
        }),
      },
    },
  );
  if (
    !response.data ||
    response.data.status === "unavailable" ||
    response.data.requestId !== request.requestId
  )
    fail("AI_UNAVAILABLE", 503);
  const result = response.data;
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await procedureVersion(tx, projectId, procedureId, versionId, true);
    const current = await draftRequest(tx, projectId);
    if (current?.inputFingerprint !== request.inputFingerprint)
      fail("SOURCE_SET_CHANGED");
    const selectedVersions = new Set([
      ...current.activeSources.map((source) => source.documentVersionId),
      ...(current.supplementalEquipmentSources ?? []).map(
        (source) => source.documentVersionId,
      ),
    ]);
    if (
      result.citations?.some(
        (citation) => !selectedVersions.has(citation.documentVersionId),
      )
    )
      fail("AI_RESPONSE_INVALID", 502);
    await validateCitations(
      tx,
      result.citations ?? [],
      current.retrievalScopeManifest,
    );
    if (
      result.supportedStepIds?.some(
        (id) => !version.steps.some((s) => s.stepId === id),
      )
    )
      fail("AI_RESPONSE_INVALID", 502);
    const bindings = new Map(
      (result.stepCitations ?? []).map((binding) => [
        binding.stepId,
        binding.citationIds,
      ]),
    );
    if (
      bindings.size !== (result.stepCitations ?? []).length ||
      bindings.size !== (result.supportedStepIds ?? []).length ||
      [...bindings].some(
        ([stepId, ids]) =>
          !result.supportedStepIds?.includes(stepId) ||
          !ids.length ||
          ids.some((id) => !result.citations?.some((c) => c.id === id)),
      ) ||
      (result.supportedStepIds ?? []).some((id) => !bindings.has(id))
    )
      fail("AI_RESPONSE_INVALID", 502);
    const steps = version.steps.map((s) => ({
      ...s,
      citationIds: result.supportedStepIds?.includes(s.stepId)
        ? bindings.get(s.stepId)!
        : s.citationIds,
      citationReviewState: result.supportedStepIds?.includes(s.stepId)
        ? ("CONFIRMED" as const)
        : ("NEEDS_REVIEW" as const),
      evidenceState: result.supportedStepIds?.includes(s.stepId)
        ? "SUPPORTED"
        : "UNVERIFIED",
    }));
    const updated = await db
      .collection<ProcedureVersion>("procedureVersions")
      .findOneAndUpdate(
        { _id: oid(versionId), revision, state: { $ne: "PUBLISHED" } },
        {
          $set: {
            steps,
            citations: result.citations ?? [],
            reviewAnalysis: result.reviewAnalysis,
            inputFingerprint: current.inputFingerprint,
            state: "DRAFT",
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
          $unset: { approvedAt: "", approvedBy: "" },
        },
        { session, returnDocument: "after" },
      );
    if (!updated) fail("PROCEDURE_REVISION_CONFLICT");
    await audit(tx, "PROCEDURE_EVIDENCE_REVALIDATED", {
      projectId,
      procedureId,
      versionId,
      status: result.status,
    });
    return view(updated);
  });
}

export async function scheduleProcedure(
  ctx: Context,
  projectId: string,
  procedureId: string,
  schedule: Recurrence,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await entityAccess(tx, { type: "PROJECT", id: projectId }, true);
    const procedure = await db
      .collection<Procedure>("safetyProcedures")
      .findOne(
        { _id: oid(procedureId), tenantId: ctx.actor.tenantId, projectId },
        { session },
      );
    if (!procedure?.currentPublishedVersionId)
      fail("PUBLISHED_PROCEDURE_REQUIRED");
    if (procedure.schedule) fail("SCHEDULE_IMMUTABLE");
    await db
      .collection<Procedure>("safetyProcedures")
      .updateOne(
        { _id: procedure._id },
        { $set: { schedule: recurrenceSchema.parse(schedule) } },
        { session },
      );
    await audit(tx, "PROCEDURE_SCHEDULE_CREATED", { projectId, procedureId });
    return { scheduled: true };
  });
}

export async function createRun(
  ctx: Context,
  projectId: string,
  procedureId: string,
  now = new Date(),
) {
  let requestedPeriod: Date | undefined;
  try {
    return await withDatabaseTransaction(ctx.config, async (db, session) => {
      const tx = { ...ctx, db, session };
      await entityAccess(tx, { type: "PROJECT", id: projectId }, true);
      const procedure = await db
        .collection<Procedure>("safetyProcedures")
        .findOne(
          { _id: oid(procedureId), tenantId: ctx.actor.tenantId, projectId },
          { session },
        );
      if (!procedure?.currentPublishedVersionId || !procedure.schedule)
        fail("PROCEDURE_SCHEDULE_REQUIRED");
      const period = recurrencePeriod(procedure.schedule, now);
      if (!period) fail("PROCEDURE_NOT_DUE");
      requestedPeriod = period.periodStart;
      const version = await procedureVersion(
        tx,
        projectId,
        procedureId,
        procedure.currentPublishedVersionId,
      );
      const key = {
        tenantId: ctx.actor.tenantId,
        procedureId,
        periodStart: period.periodStart,
      };
      const existing = await db
        .collection<ProcedureRun>("procedureRuns")
        .findOne(key, { session });
      if (existing) return view(existing);
      const run: ProcedureRun = {
        _id: new ObjectId(),
        ...key,
        ...period,
        procedureVersionId: version._id.toHexString(),
        projectId,
        timezone: procedure.schedule.timezone,
        state: "OPEN",
        steps: version.steps.map((s) => ({
          stepId: s.stepId,
          required: s.required,
          checked: false,
          note: "",
          exception: null,
          actorId: null,
          updatedAt: null,
        })),
        revision: 1,
        createdAt: now,
      };
      await db
        .collection<ProcedureRun>("procedureRuns")
        .insertOne(run, { session });
      await audit(tx, "PROCEDURE_RUN_CREATED", {
        projectId,
        procedureId,
        runId: run._id.toHexString(),
        procedureVersionId: run.procedureVersionId,
      });
      return view(run);
    });
  } catch (error) {
    if (
      requestedPeriod &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      await entityAccess(ctx, { type: "PROJECT", id: projectId }, true);
      const existing = await ctx.db
        .collection<ProcedureRun>("procedureRuns")
        .findOne({
          tenantId: ctx.actor.tenantId,
          procedureId,
          periodStart: requestedPeriod,
        });
      if (existing) return view(existing);
    }
    throw error;
  }
}
export function assertRunMutable(
  run: ProcedureRun,
  revision: number,
  now = new Date(),
) {
  if (
    run.state !== "OPEN" ||
    run.revision !== revision ||
    now < run.periodStart ||
    now >= run.periodEnd
  )
    fail("RUN_NOT_MUTABLE");
}
export async function changeRun(
  ctx: Context,
  runId: string,
  input: {
    expectedRevision: number;
    checked?: boolean;
    note?: string;
    exception?: string | null;
  },
  stepId?: string,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const run = await db
      .collection<ProcedureRun>("procedureRuns")
      .findOne({ _id: oid(runId), tenantId: ctx.actor.tenantId }, { session });
    if (!run) fail("RUN_NOT_FOUND", 404);
    await entityAccess(tx, { type: "PROJECT", id: run.projectId }, true);
    assertRunMutable(run, input.expectedRevision);
    if (stepId) {
      const step = run.steps.find((s) => s.stepId === stepId);
      if (!step) fail("RUN_STEP_NOT_FOUND", 404);
      Object.assign(step, {
        checked: input.checked,
        note: input.note,
        exception: input.exception,
        actorId: ctx.actor.userId,
        updatedAt: new Date(),
      });
    } else {
      if (run.steps.some((s) => s.required && !s.checked))
        fail("REQUIRED_STEPS_INCOMPLETE");
      run.state = "COMPLETED";
      run.completedBy = ctx.actor.userId;
      run.completedAt = new Date();
    }
    run.revision++;
    const update = await db
      .collection<ProcedureRun>("procedureRuns")
      .replaceOne({ _id: run._id, revision: input.expectedRevision }, run, {
        session,
      });
    if (!update.modifiedCount) fail("RUN_REVISION_CONFLICT");
    await audit(
      tx,
      stepId ? "PROCEDURE_RUN_STEP_CHANGED" : "PROCEDURE_RUN_COMPLETED",
      { runId, stepId: stepId ?? null, checked: input.checked ?? false },
    );
    return view(run);
  });
}

export async function requestRegeneration(
  ctx: Context,
  projectId: string,
  procedureId: string,
  input: z.infer<typeof regenerationSchema> = {},
) {
  return withDatabaseTransaction(ctx.config, (db, session) =>
    regenerateTransaction(
      { ...ctx, db, session },
      projectId,
      procedureId,
      input,
    ),
  );
}

async function regenerateTransaction(
  ctx: Context,
  projectId: string,
  procedureId: string,
  input: z.infer<typeof regenerationSchema>,
) {
  await entityAccess(ctx, { type: "PROJECT", id: projectId }, true);
  const procedure = await ctx.db
    .collection<Procedure>("safetyProcedures")
    .findOne(
      {
        _id: oid(procedureId),
        tenantId: ctx.actor.tenantId,
        projectId,
      },
      { session: ctx.session },
    );
  if (!procedure) fail("PROCEDURE_NOT_FOUND", 404);
  if (input.supplementalEquipmentDocumentIds !== undefined) {
    const manifest = await resolveManifest(ctx, {
      type: "PROJECT",
      id: projectId,
    });
    if (
      new Set(input.supplementalEquipmentDocumentIds).size !==
        input.supplementalEquipmentDocumentIds.length ||
      input.supplementalEquipmentDocumentIds.some(
        (id) =>
          !manifest.allowedDocumentVersions?.some(
            (v) =>
              v.documentId === id &&
              v.inclusionPaths.includes("EQUIPMENT_DERIVED"),
          ),
      )
    )
      fail("SUPPLEMENTAL_SOURCE_NOT_CURRENT", 400);
    await ctx.db
      .collection<Procedure>("safetyProcedures")
      .updateOne(
        { _id: procedure._id, tenantId: ctx.actor.tenantId },
        {
          $set: {
            supplementalEquipmentDocumentIds:
              input.supplementalEquipmentDocumentIds,
          },
        },
        { session: ctx.session },
      );
  }
  const request = await draftRequest(ctx, projectId);
  if (!request) return { status: "WAITING_FOR_SOURCES" };
  const key = {
    tenantId: ctx.actor.tenantId,
    projectId: oid(projectId),
    inputFingerprint: request.inputFingerprint,
  };
  const existing = await ctx.db
    .collection("procedureGenerationRequests")
    .findOne(key, { session: ctx.session });
  if (existing?.status === "READY")
    return {
      status: "READY",
      procedureVersionId: existing.procedureVersionId,
      inputFingerprint: request.inputFingerprint,
    };
  await ctx.db
    .collection("procedureGenerationRequests")
    .updateOne(
      key,
      {
        $setOnInsert: {
          generationRequestId: request.generationRequestId,
          status: "QUEUED",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, session: ctx.session },
    );
  await queue(
    ctx,
    "PROCEDURE",
    `regenerate:${procedureId}:${request.inputFingerprint}`,
    { projectId, procedureId },
  );
  await audit(ctx, "PROCEDURE_REGENERATION_REQUESTED", {
    projectId,
    procedureId,
  });
  return { status: "QUEUED", inputFingerprint: request.inputFingerprint };
}
