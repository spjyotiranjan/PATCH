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
  idSchema,
  oid,
  view,
  type Context,
} from "./context";
import { resolveManifest, validateCitations } from "./scope";
import type { Schema } from "./models";

export const logSchema = z
  .object({
    scopeType: z.enum(["PROJECT", "EQUIPMENT"]),
    equipmentId: idSchema.nullable().default(null),
    text: z.string().trim().min(1).max(20000),
    attachmentVersionIds: z.array(idSchema).max(20).default([]),
    citations: z.array(citationSchema).max(50).default([]),
  })
  .strict()
  .refine((v) =>
    v.scopeType === "EQUIPMENT" ? !!v.equipmentId : v.equipmentId === null,
  );
export const logUpdateSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    text: z.string().trim().min(1).max(20000),
  })
  .strict();
interface LogRecord {
  _id: ObjectId;
  tenantId: string;
  projectId: string;
  createdBy: string;
  scopeType: "PROJECT" | "EQUIPMENT";
  equipmentId: string | null;
  text: string;
  attachmentVersionIds: string[];
  citations: Schema["Citation"][];
  state: "DRAFT" | "SUBMITTED";
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  submittedBy?: string;
  submittedAt?: Date;
}
export async function logScope(
  ctx: Context,
  projectId: string,
  equipmentId: string | null,
  mutate = false,
) {
  await entityAccess(ctx, { type: "PROJECT", id: projectId }, mutate);
  if (equipmentId) {
    const project = await ctx.db.collection("projects").findOne(
      {
        _id: oid(projectId),
        tenantId: ctx.actor.tenantId,
        includedEquipmentIds: oid(equipmentId),
      },
      { session: ctx.session },
    );
    if (!project) fail("EQUIPMENT_NOT_IN_PROJECT", 400);
  }
}
export async function createLog(
  ctx: Context,
  projectId: string,
  input: z.infer<typeof logSchema>,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await logScope(tx, projectId, input.equipmentId, true);
    const manifest = await resolveManifest(tx, {
      type: "PROJECT",
      id: projectId,
    });
    const allowed = new Set(
      manifest.allowedDocumentVersions?.map((v) => v.documentVersionId),
    );
    if (input.attachmentVersionIds.some((id) => !allowed.has(id)))
      fail("ATTACHMENT_OUTSIDE_PROJECT", 403);
    await validateCitations(tx, input.citations, manifest);
    const record: LogRecord = {
      _id: new ObjectId(),
      tenantId: ctx.actor.tenantId,
      projectId,
      createdBy: ctx.actor.userId,
      ...input,
      state: "DRAFT",
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db
      .collection<LogRecord>("maintenanceLogs")
      .insertOne(record, { session });
    await audit(tx, "MAINTENANCE_LOG_DRAFT_CREATED", {
      projectId,
      logId: record._id.toHexString(),
    });
    return view(record);
  });
}
export async function updateLog(
  ctx: Context,
  projectId: string,
  id: string,
  revision: number,
  text?: string,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const record = await db
      .collection<LogRecord>("maintenanceLogs")
      .findOne(
        { _id: oid(id), tenantId: ctx.actor.tenantId, projectId },
        { session },
      );
    if (!record) fail("LOG_NOT_FOUND", 404);
    await logScope(tx, projectId, record.equipmentId, true);
    if (record.state !== "DRAFT" || record.revision !== revision)
      fail("LOG_REVISION_CONFLICT");
    const updated = await db
      .collection<LogRecord>("maintenanceLogs")
      .findOneAndUpdate(
        { _id: oid(id), revision, state: "DRAFT" },
        {
          $set: {
            ...(text === undefined
              ? {
                  state: "SUBMITTED" as const,
                  submittedBy: ctx.actor.userId,
                  submittedAt: new Date(),
                }
              : { text }),
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { session, returnDocument: "after" },
      );
    if (!updated) fail("LOG_REVISION_CONFLICT");
    await audit(
      tx,
      text === undefined
        ? "MAINTENANCE_LOG_SUBMITTED"
        : "MAINTENANCE_LOG_UPDATED",
      { projectId, logId: id },
    );
    return view(updated);
  });
}
export async function draftLog(
  ctx: Context,
  projectId: string,
  input: z.infer<typeof logSchema>,
) {
  await logScope(ctx, projectId, input.equipmentId, true);
  const manifest = await resolveManifest(ctx, {
    type: "PROJECT",
    id: projectId,
  });
  await validateCitations(ctx, input.citations, manifest);
  const requestId = randomUUID();
  const response = await createAiServiceClient(ctx.config).POST(
    "/v1/log-drafts",
    {
      body: {
        requestId,
        contractVersion: "v1",
        projectId,
        scopeType: input.scopeType,
        equipmentId: input.equipmentId,
        sourceText: input.text,
        citationIds: input.citations.map((c) => c.id),
      },
    },
  );
  const parsed = z
    .object({
      requestId: z.string().uuid(),
      status: z.enum(["drafted", "unavailable"]),
      draftText: z.string().max(20000).nullable().optional(),
      suggestedFields: z.record(z.string(), z.string()).default({}),
      citationIds: z.array(z.string()).default([]),
      warnings: z.array(z.string()).default([]),
    })
    .parse(response.data);
  if (
    parsed.requestId !== requestId ||
    parsed.citationIds.some((id) => !input.citations.some((c) => c.id === id))
  )
    fail("AI_CITATIONS_INVALID", 502);
  await logScope(ctx, projectId, input.equipmentId, true);
  await audit(ctx, "MAINTENANCE_LOG_AI_DRAFTED", {
    projectId,
    status: parsed.status,
  });
  return parsed;
}
