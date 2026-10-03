// @vitest-environment node
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryDb } from "./support/memory-db";
import { resolveWorkspaceCatalog } from "../lib/backend/workspace-chat";
import { resolveManifest, validateAnswer } from "../lib/backend/scope";
import { createSession, submitTurn } from "../lib/backend/chat";
import { answerSchema } from "../lib/ai/socket";
import type { Context } from "../lib/backend/context";
import type { Schema } from "../lib/backend/models";

const runtime = vi.hoisted(() => ({ memory: null as unknown, ask: vi.fn() }));
vi.mock("../lib/database/mongodb", () => ({
  withDatabaseTransaction: async (
    _: unknown,
    fn: (db: unknown, session: unknown) => Promise<unknown>,
  ) => (runtime.memory as MemoryDb).transaction(fn),
}));
vi.mock("../lib/ai/socket", async (original) => ({
  ...(await original<typeof import("../lib/ai/socket")>()),
  askAiSocket: runtime.ask,
}));
const project = "1".repeat(24),
  equipment = "2".repeat(24),
  doc = "3".repeat(24),
  user = "4".repeat(24),
  other = "5".repeat(24);
let memory: MemoryDb, ctx: Context;
beforeEach(() => {
  memory = new MemoryDb();
  runtime.memory = memory;
  runtime.ask.mockReset();
  ctx = {
    db: memory.db,
    actor: { userId: user, tenantId: "fixture" },
    config: {} as Context["config"],
    requestId: randomUUID(),
  };
  memory.seed("projects", [
    {
      _id: new ObjectId(project),
      tenantId: "fixture",
      name: "Cooling water",
      description: "Saved test overview",
      status: "ACTIVE",
      includedEquipmentIds: [new ObjectId(equipment)],
    },
    {
      _id: new ObjectId(other),
      tenantId: "fixture",
      name: "Private project",
      description: "Secret",
      includedEquipmentIds: [],
    },
  ]);
  memory.seed("projectMemberships", [
    {
      _id: new ObjectId(),
      tenantId: "fixture",
      userId: user,
      projectId: new ObjectId(project),
      status: "ACTIVE",
      role: "MEMBER",
    },
  ]);
  memory.seed("equipments", [
    {
      _id: new ObjectId(equipment),
      tenantId: "fixture",
      ownerId: other,
      name: "Fixture pump",
      type: "Pump",
      location: "Test bay",
      description: "Saved Equipment description",
      operationalState: "UNKNOWN",
    },
  ]);
  memory.seed("documents", [
    {
      _id: new ObjectId(doc),
      tenantId: "fixture",
      title: "Pending source",
      documentType: "MANUAL",
      activeVersionId: null,
      archivedAt: null,
    },
  ]);
  memory.seed("documentLinks", [
    {
      _id: new ObjectId(),
      tenantId: "fixture",
      documentId: doc,
      entity: { type: "EQUIPMENT", id: equipment },
      versionPolicy: "LATEST_APPROVED",
    },
  ]);
  memory.seed("maintenanceLogs", [
    {
      _id: new ObjectId(),
      tenantId: "fixture",
      projectId: project,
      scopeType: "PROJECT",
      text: "Saved synthetic check",
      state: "SUBMITTED",
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      tenantId: "fixture",
      projectId: other,
      text: "Private log",
      state: "SUBMITTED",
    },
  ]);
});
function result(request: Schema["QuestionRequest"]): Schema["QuestionResult"] {
  return answerSchema.parse({
    requestId: request.requestId,
    chatSession: { id: request.chatSession.id, suggestedTitle: "Workspace" },
    turnId: "turn",
    status: "approved",
    answerKind: "WORKSPACE",
    answer: { summary: null, steps: [] },
    routing: { usedStructuralFallback: false },
    followUpAllowed: true,
    workspaceOverview: {
      scope: "PROJECTS",
      catalog: request.workspaceCatalog,
      passages: [
        {
          text: "The Cooling water Project is active.",
          recordIds: ["entity:0"],
        },
      ],
    },
  });
}
async function request(): Promise<Schema["QuestionRequest"]> {
  const manifest = await resolveManifest(ctx);
  return {
    requestId: randomUUID(),
    contractVersion: "v1",
    actor: { id: user, tenantId: "fixture" },
    chatSession: { id: "session" },
    question: "Show my Projects",
    retrievalScopeManifest: manifest,
    retrievalPolicy: {
      approvedOnly: true,
      requireSourceLocation: true,
      allowStructuralFallback: true,
    },
    workspaceCatalog: await resolveWorkspaceCatalog(ctx, manifest),
  };
}
it("automatically projects authorized records and pending document metadata without source citations", async () => {
  const req = await request();
  const catalog = req.workspaceCatalog!;
  expect(catalog.entities.map((e) => e.name)).toEqual([
    "Cooling water",
    "Fixture pump",
  ]);
  expect(catalog.entities[1].attributes?.location).toBe("Test bay");
  expect(catalog.documents[0].evidenceAvailable).toBe(false);
  expect(catalog.workflowRecords).toHaveLength(1);
  expect(JSON.stringify(catalog)).not.toContain("Private");
  await expect(validateAnswer(ctx, result(req), req)).resolves.toBeUndefined();
});
it("keeps explicit document assignments narrow and does not infer parent Project access", async () => {
  const req = await request();
  const catalog = await resolveWorkspaceCatalog(
    ctx,
    req.retrievalScopeManifest,
    [{ type: "DOCUMENT", id: doc }],
  );
  expect(catalog.entities).toEqual([]);
  expect(catalog.workflowRecords).toEqual([]);
  expect(catalog.documents).toHaveLength(1);
  expect(catalog.documents[0].entityIds).toEqual([]);
});
it("rejects invented metadata, unknown record bindings and false evidence responses", async () => {
  const req = await request();
  const invented = structuredClone(result(req));
  invented.workspaceOverview!.catalog.entities[0].name = "Invented";
  await expect(validateAnswer(ctx, invented, req)).rejects.toMatchObject({
    code: "AI_RESPONSE_INVALID",
  });
  const unbound = result(req);
  unbound.workspaceOverview!.passages![0].recordIds = ["entity:999"];
  await expect(validateAnswer(ctx, unbound, req)).rejects.toMatchObject({
    code: "AI_RESPONSE_INVALID",
  });
  const unsafe = result(req);
  unsafe.answerKind = "EVIDENCE";
  await expect(validateAnswer(ctx, unsafe, req)).rejects.toMatchObject({
    code: "AI_RESPONSE_INVALID",
  });
});
it("rechecks membership after generation and cannot save revoked workspace content", async () => {
  const session = await createSession(ctx);
  runtime.ask.mockImplementation(async (req: Schema["QuestionRequest"]) => {
    memory.data("projectMemberships")[0].status = "REVOKED";
    return result(req);
  });
  const saved = await submitTurn(ctx, session.id, {
    clientTurnId: randomUUID(),
    question: "Show my Projects",
    assignedReferences: [],
  });
  expect(saved.result?.status).toBe("unavailable");
  expect(saved.result?.workspaceOverview).toBeUndefined();
  expect(JSON.stringify(saved.result)).not.toContain("Saved test overview");
});
