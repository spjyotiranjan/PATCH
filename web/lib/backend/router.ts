import "server-only";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/route";
import {
  entityAccess,
  fail,
  oid,
  view,
  type Context,
  type Entity,
} from "./context";
import * as documents from "./documents";
import * as chat from "./chat";
import * as logs from "./logs";
import * as procedures from "./procedures";
import { composedDocuments, resolveManifest } from "./scope";
import { recurrenceSchema } from "./recurrence";
import type { VersionRecord } from "./models";
import { revokeAccess } from "./access";
import { procedureSource } from "./procedure-evidence";

interface Endpoint {
  method: string;
  path: string;
  summary: string;
  schema?: z.ZodType;
  execute: (
    ctx: Context,
    params: Record<string, string>,
    request: Request,
  ) => Promise<unknown>;
}
export const endpoints: Endpoint[] = [];
function route<T>(
  method: string,
  path: string,
  summary: string,
  schema: z.ZodType<T> | undefined,
  handler: (
    ctx: Context,
    params: Record<string, string>,
    body: T,
    request: Request,
  ) => Promise<unknown>,
) {
  endpoints.push({
    method,
    path,
    summary,
    schema,
    execute: async (ctx, params, request) =>
      handler(
        ctx,
        params,
        schema ? await parseJsonBody(request, schema) : (undefined as T),
        request,
      ),
  });
}
const empty = z.object({}).strict();
route(
  "PATCH",
  "/api/documents/{documentId}",
  "Change library title or archive visibility; preserve originals",
  z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      archived: z.boolean().optional(),
    })
    .strict()
    .refine((v) => v.title !== undefined || v.archived !== undefined),
  (ctx, p, body) => documents.updateDocument(ctx, p.documentId, body),
);
route(
  "DELETE",
  "/api/documents/{documentId}",
  "Archive logical document; never delete immutable originals",
  undefined,
  (ctx, p) => documents.updateDocument(ctx, p.documentId, { archived: true }),
);
route(
  "DELETE",
  "/api/projects/{projectId}/memberships/{userId}",
  "Owner revokes Member access; Owners cannot be revoked",
  undefined,
  (ctx, p) => revokeAccess(ctx, "PROJECT", p.projectId, p.userId),
);
route(
  "DELETE",
  "/api/equipments/{equipmentId}/manage-access/{userId}",
  "Equipment owner revokes manage access",
  undefined,
  (ctx, p) => revokeAccess(ctx, "EQUIPMENT", p.equipmentId, p.userId),
);
const get = (
  path: string,
  summary: string,
  handler: (
    ctx: Context,
    params: Record<string, string>,
    request: Request,
  ) => Promise<unknown>,
) =>
  route("GET", path, summary, undefined, (ctx, params, _, request) =>
    handler(ctx, params, request),
  );

get(
  "/api/documents",
  "List accessible logical documents; optional literal title search",
  async (ctx, _, request) => {
    const scope = await composedDocuments(ctx);
    const search =
      new URL(request.url).searchParams.get("search")?.toLowerCase() ?? "";
    return {
      items: scope.documents
        .filter((d) => d.title.toLowerCase().includes(search))
        .map(view),
    };
  },
);
route(
  "POST",
  "/api/documents/upload-sessions",
  "Create logical document and immutable upload session",
  documents.uploadSchema,
  (ctx, _, body) => documents.createUpload(ctx, body),
);
get(
  "/api/documents/{documentId}",
  "Read accessible logical document",
  async (ctx, p) => view(await documents.loadDocument(ctx, p.documentId)),
);
get(
  "/api/documents/{documentId}/versions",
  "Read immutable version history",
  async (ctx, p) => {
    await documents.loadDocument(ctx, p.documentId);
    return {
      items: (
        await ctx.db
          .collection<VersionRecord>("documentVersions")
          .find({ tenantId: ctx.actor.tenantId, documentId: p.documentId })
          .sort({ versionNumber: -1 })
          .limit(200)
          .toArray()
      ).map(documents.versionView),
    };
  },
);
route(
  "POST",
  "/api/documents/{documentId}/versions",
  "Add immutable document version",
  documents.versionUploadSchema,
  async (ctx, p, body) => {
    const doc = await documents.loadDocument(ctx, p.documentId, true);
    return documents.createUpload(
      ctx,
      {
        ...body,
        title: doc.title,
        documentType: doc.documentType as z.infer<
          typeof documents.uploadSchema
        >["documentType"],
        entity: doc.origin,
      },
      p.documentId,
    );
  },
);
get(
  "/api/document-versions/{versionId}",
  "Read extraction, review and indexing state",
  async (ctx, p) =>
    documents.versionView(
      (await documents.loadVersion(ctx, p.versionId)).version,
    ),
);
route(
  "POST",
  "/api/document-versions/{versionId}/complete-upload",
  "Verify staged upload and dispatch extraction",
  empty,
  (ctx, p) => documents.completeUpload(ctx, p.versionId),
);
route(
  "POST",
  "/api/document-versions/{versionId}/review",
  "Human review: approve for indexing or reject",
  documents.reviewSchema,
  (ctx, p, body) => documents.reviewVersion(ctx, p.versionId, body),
);
route(
  "POST",
  "/api/document-versions/{versionId}/activate",
  "Activate indexed version with compare-and-swap",
  empty,
  (ctx, p) => documents.activateVersion(ctx, p.versionId),
);
get(
  "/api/document-versions/{versionId}/source",
  "Get short-lived exact original source URL",
  (ctx, p) => documents.sourceAccess(ctx, p.versionId),
);
for (const [prefix, type] of [
  ["equipments", "EQUIPMENT"],
  ["projects", "PROJECT"],
] as const) {
  const entity = (p: Record<string, string>): Entity => ({
    type,
    id: p.entityId,
  });
  get(
    `/api/${prefix}/{entityId}/documents`,
    `List ${type} composed document links and pending sources`,
    async (ctx, p) => {
      const scope = await composedDocuments(ctx, entity(p));
      return { items: scope.documents.map(view), links: scope.links.map(view) };
    },
  );
  route(
    "POST",
    `/api/${prefix}/{entityId}/documents`,
    `Link existing logical document to ${type}`,
    documents.linkSchema,
    (ctx, p, body) => documents.linkDocument(ctx, entity(p), body),
  );
  route(
    "DELETE",
    `/api/${prefix}/{entityId}/documents/{documentId}`,
    "Unlink without deleting originals",
    undefined,
    (ctx, p) => documents.unlinkDocument(ctx, entity(p), p.documentId),
  );
  get(
    `/api/${prefix}/{entityId}/retrieval-profile`,
    "Read routing-profile freshness and provenance",
    async (ctx, p) => {
      await entityAccess(ctx, entity(p));
      const profile = await ctx.db.collection("entityProfiles").findOne({
        tenantId: ctx.actor.tenantId,
        entityType: type,
        entityId: p.entityId,
      });
      return profile ? view(profile) : { state: "MISSING" };
    },
  );
}
get("/api/chat/sessions", "List user-owned Chat sessions", async (ctx) => ({
  items: (
    await ctx.db
      .collection("chatSessions")
      .find({ tenantId: ctx.actor.tenantId, userId: ctx.actor.userId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray()
  ).map(view),
}));
route(
  "POST",
  "/api/chat/sessions",
  "Create user-owned Chat session",
  empty,
  (ctx) => chat.createSession(ctx),
);
get(
  "/api/chat/sessions/{sessionId}",
  "Read user-owned Chat session",
  async (ctx, p) => view(await chat.sessionAccess(ctx, p.sessionId)),
);
get(
  "/api/chat/sessions/{sessionId}/turns",
  "Recover persisted Chat turns after reconnect",
  async (ctx, p) => {
    await chat.sessionAccess(ctx, p.sessionId);
    return {
      items: (
        await ctx.db
          .collection("chatTurns")
          .find({ tenantId: ctx.actor.tenantId, sessionId: p.sessionId })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()
      )
        .reverse()
        .map(view),
    };
  },
);
route(
  "POST",
  "/api/chat/sessions/{sessionId}/turns",
  "Submit idempotent turn (Web uses private AI WebSocket)",
  chat.turnSchema,
  (ctx, p, body, request) =>
    chat.submitTurn(ctx, p.sessionId, body, request.signal),
);
get(
  "/api/chat/references",
  "List currently authorized assignment references",
  (ctx) => resolveManifest(ctx),
);
get(
  "/api/projects/{projectId}/maintenance-logs",
  "List Project-only maintenance logs",
  async (ctx, p) => {
    await logs.logScope(ctx, p.projectId, null);
    return {
      items: (
        await ctx.db
          .collection("maintenanceLogs")
          .find({ tenantId: ctx.actor.tenantId, projectId: p.projectId })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()
      ).map(view),
    };
  },
);
route(
  "POST",
  "/api/projects/{projectId}/maintenance-logs",
  "Create editable maintenance-log draft",
  logs.logSchema,
  (ctx, p, body) => logs.createLog(ctx, p.projectId, body),
);
route(
  "POST",
  "/api/projects/{projectId}/maintenance-logs/draft-helper",
  "AI formatting helper; does not submit or save",
  logs.logSchema,
  (ctx, p, body) => logs.draftLog(ctx, p.projectId, body),
);
route(
  "PATCH",
  "/api/projects/{projectId}/maintenance-logs/{logId}",
  "Edit draft with optimistic concurrency",
  logs.logUpdateSchema,
  (ctx, p, body) =>
    logs.updateLog(ctx, p.projectId, p.logId, body.expectedRevision, body.text),
);
route(
  "POST",
  "/api/projects/{projectId}/maintenance-logs/{logId}/submit",
  "Human submission freezes maintenance log",
  procedures.revisionSchema,
  (ctx, p, body) =>
    logs.updateLog(ctx, p.projectId, p.logId, body.expectedRevision),
);
get(
  "/api/projects/{projectId}/procedures",
  "List controlled procedures and generation state",
  async (ctx, p) => {
    await entityAccess(ctx, { type: "PROJECT", id: p.projectId });
    return {
      items: (
        await ctx.db
          .collection("safetyProcedures")
          .find({ tenantId: ctx.actor.tenantId, projectId: p.projectId })
          .limit(100)
          .toArray()
      ).map(view),
      generationRequests: (
        await ctx.db
          .collection("procedureGenerationRequests")
          .find({ tenantId: ctx.actor.tenantId, projectId: oid(p.projectId) })
          .sort({ updatedAt: -1 })
          .limit(100)
          .toArray()
      ).map(view),
    };
  },
);
get(
  "/api/projects/{projectId}/procedures/{procedureId}/versions",
  "Read procedure candidates and immutable publication history",
  async (ctx, p) => {
    await entityAccess(ctx, { type: "PROJECT", id: p.projectId });
    return {
      items: (
        await ctx.db
          .collection("procedureVersions")
          .find({
            tenantId: ctx.actor.tenantId,
            projectId: p.projectId,
            procedureId: p.procedureId,
          })
          .sort({ versionNumber: -1 })
          .limit(100)
          .toArray()
      ).map(view),
    };
  },
);
const versionPath =
  "/api/projects/{projectId}/procedures/{procedureId}/versions/{versionId}";
get(
  `${versionPath}/source`,
  "Read exact immutable published procedure export",
  async (ctx, p) => {
    await procedures.procedureVersion(
      ctx,
      p.projectId,
      p.procedureId,
      p.versionId,
    );
    return procedureSource(ctx, p.versionId);
  },
);
get(versionPath, "Read controlled procedure version", async (ctx, p) =>
  view(
    await procedures.procedureVersion(
      ctx,
      p.projectId,
      p.procedureId,
      p.versionId,
    ),
  ),
);
route(
  "PATCH",
  versionPath,
  "Edit/add/remove/reorder stable steps; invalidate changed evidence",
  procedures.editProcedureSchema,
  (ctx, p, body) =>
    procedures.editProcedure(
      ctx,
      p.projectId,
      p.procedureId,
      p.versionId,
      body,
    ),
);
route(
  "POST",
  `${versionPath}/fork`,
  "Fork a new editable version without changing history",
  empty,
  (ctx, p) =>
    procedures.forkProcedure(ctx, p.projectId, p.procedureId, p.versionId),
);
route(
  "POST",
  `${versionPath}/revalidate`,
  "Source-bounded revalidation of unchanged draft steps",
  procedures.revisionSchema,
  (ctx, p, body) =>
    procedures.revalidateProcedure(
      ctx,
      p.projectId,
      p.procedureId,
      p.versionId,
      body.expectedRevision,
    ),
);
for (const action of [
  "review",
  "request-changes",
  "approve",
  "publish",
] as const)
  route(
    "POST",
    `${versionPath}/${action}`,
    `Owner ${action} of controlled procedure version`,
    action === "approve"
      ? procedures.approvalSchema
      : procedures.revisionSchema,
    (ctx, p, body) =>
      procedures.transitionProcedure(
        ctx,
        p.projectId,
        p.procedureId,
        p.versionId,
        action,
        body,
      ),
  );
route(
  "POST",
  "/api/projects/{projectId}/procedures/{procedureId}/regenerate",
  "Queue separate source-fingerprinted candidate; never overwrite edits",
  procedures.regenerationSchema,
  (ctx, p, body) =>
    procedures.requestRegeneration(ctx, p.projectId, p.procedureId, body),
);
get(
  `${versionPath}/diff/{otherVersionId}`,
  "Compare stable steps with a generated or historical candidate",
  async (ctx, p) => {
    const a = await procedures.procedureVersion(
      ctx,
      p.projectId,
      p.procedureId,
      p.versionId,
    );
    const b = await procedures.procedureVersion(
      ctx,
      p.projectId,
      p.procedureId,
      p.otherVersionId,
    );
    return {
      fromVersionId: p.versionId,
      toVersionId: p.otherVersionId,
      before: a.steps,
      after: b.steps,
      reviewAnalysis: b.reviewAnalysis,
    };
  },
);
route(
  "POST",
  "/api/projects/{projectId}/procedures/{procedureId}/schedule",
  "Create immutable timezone-aware recurrence preset",
  recurrenceSchema,
  (ctx, p, body) =>
    procedures.scheduleProcedure(ctx, p.projectId, p.procedureId, body),
);
get(
  "/api/projects/{projectId}/procedures/{procedureId}/runs",
  "List isolated run completion history",
  async (ctx, p) => {
    await entityAccess(ctx, { type: "PROJECT", id: p.projectId });
    return {
      items: (
        await ctx.db
          .collection("procedureRuns")
          .find({
            tenantId: ctx.actor.tenantId,
            projectId: p.projectId,
            procedureId: p.procedureId,
          })
          .sort({ periodStart: -1 })
          .limit(100)
          .toArray()
      ).map(view),
    };
  },
);
route(
  "POST",
  "/api/projects/{projectId}/procedures/{procedureId}/runs",
  "Idempotently open current due period with unchecked steps",
  empty,
  (ctx, p) => procedures.createRun(ctx, p.projectId, p.procedureId),
);
get(
  "/api/procedure-runs/{runId}",
  "Read one run, with Project authorization",
  async (ctx, p) => {
    const run = await ctx.db
      .collection<procedures.ProcedureRun>("procedureRuns")
      .findOne({ _id: oid(p.runId), tenantId: ctx.actor.tenantId });
    if (!run) fail("RUN_NOT_FOUND", 404);
    await entityAccess(ctx, { type: "PROJECT", id: run.projectId });
    return view(run);
  },
);
route(
  "POST",
  "/api/procedure-runs/{runId}/steps/{stepId}/completion",
  "Check/uncheck or annotate current run step",
  procedures.completionSchema,
  (ctx, p, body) => procedures.changeRun(ctx, p.runId, body, p.stepId),
);
route(
  "POST",
  "/api/procedure-runs/{runId}/complete",
  "Complete only when all required steps are checked",
  procedures.revisionSchema,
  (ctx, p, body) => procedures.changeRun(ctx, p.runId, body),
);

export function matchEndpoint(method: string, path: string) {
  for (const endpoint of endpoints) {
    if (endpoint.method !== method) continue;
    const names = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const pattern = new RegExp(
      `^${endpoint.path.replace(/\{\w+\}/g, "([^/]+)")}$`,
    );
    const match = path.match(pattern);
    if (match)
      return {
        endpoint,
        params: Object.fromEntries(
          names.map((name, index) => [name, match[index + 1]]),
        ),
      };
  }
  return null;
}
