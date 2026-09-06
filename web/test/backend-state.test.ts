// @vitest-environment node
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./support/memory-db";
import { entityAccess, queue, type Context } from "../lib/backend/context";
import { revokeAccess } from "../lib/backend/access";
import { resolveManifest } from "../lib/backend/scope";
import { createSession, submitTurn } from "../lib/backend/chat";
import { runJobs } from "../lib/backend/jobs";
import { retryJob } from "../lib/backend/operations";
import { scanBatch } from "../lib/backend/scan";
import {
  createRun,
  changeRun,
  editProcedure,
  transitionProcedure,
  type ProcedureVersion,
} from "../lib/backend/procedures";
import { logScope, createLog, updateLog } from "../lib/backend/logs";

const runtime = vi.hoisted(() => ({
  memory: null as unknown,
  ask: vi.fn(),
  post: vi.fn(),
}));
vi.mock("../lib/database/mongodb", () => ({
  withDatabaseTransaction: async (
    _c: unknown,
    fn: (db: unknown, session: unknown) => Promise<unknown>,
  ) => (runtime.memory as MemoryDb).transaction(fn),
  getDatabase: () => (runtime.memory as MemoryDb).db,
}));
vi.mock("../lib/storage/r2", () => ({
  sourceUrl: async () => "https://fixture.r2.cloudflarestorage.com/test.txt",
}));
vi.mock("../lib/ai/client", () => ({
  createAiServiceClient: () => ({ POST: runtime.post }),
}));
vi.mock("../lib/ai/socket", async (original) => ({
  ...(await original<typeof import("../lib/ai/socket")>()),
  askAiSocket: runtime.ask,
}));

const owner = "a".repeat(24),
  member = "b".repeat(24),
  equipment = "c".repeat(24),
  project = "d".repeat(24),
  doc = "e".repeat(24),
  version = "f".repeat(24),
  procedure = "1".repeat(24),
  pv = "2".repeat(24);
let memory: MemoryDb, ctx: Context;

it("repair cursors visit later records before wrapping to the first batch", async () => {
  memory.seed(
    "scanFixtures",
    [1, 2, 3].map((n) => ({ _id: new ObjectId(String(n).padStart(24, "0")) })),
  );
  const first = await scanBatch(ctx, "scanFixtures", "fixture-scan", {}, 2);
  const second = await scanBatch(ctx, "scanFixtures", "fixture-scan", {}, 2);
  expect(first).toHaveLength(2);
  expect(second).toHaveLength(1);
  expect(second[0]._id.toHexString()).toBe("000000000000000000000003");
  expect(await scanBatch(ctx, "scanFixtures", "fixture-scan", {}, 2)).toEqual(
    [],
  );
  expect(
    (await scanBatch(ctx, "scanFixtures", "fixture-scan", {}, 2))[0]._id.equals(
      first[0]._id,
    ),
  ).toBe(true);
});
const citation = {
  id: "c1",
  chunkId: `${version}:p1:0`,
  documentId: doc,
  documentVersionId: version,
  documentTitle: "Synthetic test",
  revision: "1",
  page: 1,
  section: "Text block 1",
  excerpt: "Test label is amber.",
  approvalState: "APPROVED" as const,
};
const steps = [
  {
    stepId: "s1",
    position: 1,
    title: "Test label",
    instructions: "Test label is amber.",
    required: true,
    citationIds: ["c1"],
    evidenceState: "SUPPORTED",
    citationReviewState: "CONFIRMED",
  },
];
beforeEach(() => {
  memory = new MemoryDb();
  runtime.memory = memory;
  runtime.ask.mockReset();
  runtime.post.mockReset();
  ctx = {
    db: memory.db,
    config: {} as Context["config"],
    actor: { userId: owner, tenantId: "test" },
    requestId: randomUUID(),
  };
  memory.seed("equipments", [
    { _id: new ObjectId(equipment), tenantId: "test", ownerId: owner },
  ]);
  memory.seed("projects", [
    {
      _id: new ObjectId(project),
      tenantId: "test",
      description: "Synthetic test project",
      includedEquipmentIds: [new ObjectId(equipment)],
    },
  ]);
  memory.seed(
    "projectMemberships",
    [owner, member].map((userId) => ({
      _id: new ObjectId(),
      tenantId: "test",
      projectId: new ObjectId(project),
      userId,
      role: userId === owner ? "OWNER" : "MEMBER",
      status: "ACTIVE",
    })),
  );
  memory.seed("documents", [
    {
      _id: new ObjectId(doc),
      tenantId: "test",
      origin: { type: "EQUIPMENT", id: equipment },
      activeVersionId: version,
    },
  ]);
  memory.seed("documentLinks", [
    {
      _id: new ObjectId(),
      tenantId: "test",
      documentId: doc,
      entity: { type: "EQUIPMENT", id: equipment },
      versionPolicy: "LATEST_APPROVED",
    },
  ]);
  memory.seed("documentVersions", [
    {
      _id: new ObjectId(version),
      tenantId: "test",
      documentId: doc,
      state: "ACTIVE",
      approvalState: "APPROVED",
      index: { status: "indexed" },
      reviewedMetadata: { title: "Synthetic test", revision: "1" },
      extraction: {
        pages: [
          { page: 1, section: "Text block 1", text: "Test label is amber." },
        ],
      },
    },
  ]);
});
const asMember = () => ({ ...ctx, actor: { ...ctx.actor, userId: member } });
function seedProcedure() {
  memory.seed("safetyProcedures", [
    {
      _id: new ObjectId(procedure),
      tenantId: "test",
      projectId: project,
      currentPublishedVersionId: pv,
      nextVersion: 1,
      schedule: {
        frequency: "DAILY",
        interval: 1,
        timezone: "UTC",
        localStart: "2020-01-01T00:00:00",
      },
    },
  ]);
  memory.seed("procedureVersions", [
    {
      _id: new ObjectId(pv),
      tenantId: "test",
      projectId: project,
      procedureId: procedure,
      versionNumber: 1,
      state: "PUBLISHED",
      revision: 1,
      title: "Synthetic test",
      steps,
      citations: [citation],
      reviewAnalysis: {
        reviewNeed: "LOW",
        sourceCoverage: "COMPLETE",
        blockingFindings: [],
        reasons: [],
        freshness: "CURRENT",
        applicability: "CONFIRMED",
      },
    },
  ]);
}

describe("Backend transactional state and authorization", () => {
  it("propagates the active Equipment version and removes Equipment-derived scope immediately", async () => {
    expect(
      (await resolveManifest(asMember(), { type: "PROJECT", id: project }))
        .allowedDocumentVersions,
    ).toHaveLength(1);
    const next = "3".repeat(24);
    memory.data("documents")[0].activeVersionId = next;
    memory
      .data("documentVersions")
      .push({ ...memory.data("documentVersions")[0], _id: new ObjectId(next) });
    expect(
      (
        await resolveManifest(asMember(), { type: "PROJECT", id: project })
      ).allowedDocumentVersions?.map((v) => v.documentVersionId),
    ).toEqual([next]);
    memory.data("projects")[0].includedEquipmentIds = [];
    expect(
      (await resolveManifest(asMember(), { type: "PROJECT", id: project }))
        .allowedDocumentVersions,
    ).toEqual([]);
  });
  it("revoked grants cannot mutate, and Equipment management does not confer Project ownership", async () => {
    memory.seed("equipmentManageAccess", [
      {
        _id: new ObjectId(),
        tenantId: "test",
        equipmentId: new ObjectId(equipment),
        userId: member,
        status: "ACTIVE",
      },
    ]);
    await expect(
      entityAccess(asMember(), { type: "EQUIPMENT", id: equipment }, true),
    ).resolves.toBeUndefined();
    await expect(
      entityAccess(asMember(), { type: "PROJECT", id: project }, true),
    ).rejects.toThrow("PROJECT_ACCESS_REQUIRED");
    await revokeAccess(ctx, "EQUIPMENT", equipment, member);
    await expect(
      entityAccess(asMember(), { type: "EQUIPMENT", id: equipment }, true),
    ).rejects.toThrow("EQUIPMENT_ACCESS_REQUIRED");
    await revokeAccess(ctx, "PROJECT", project, member);
    await expect(
      entityAccess(asMember(), { type: "PROJECT", id: project }),
    ).rejects.toThrow("PROJECT_ACCESS_REQUIRED");
    await expect(revokeAccess(ctx, "PROJECT", project, owner)).rejects.toThrow(
      "OWNER_CANNOT_BE_REVOKED",
    );
  });
  it("duplicate chat IDs do not re-run AI; access changes during generation discard the answer", async () => {
    const session = await createSession(asMember());
    runtime.ask.mockImplementation(async (_config, request) => {
      memory.data("projects")[0].includedEquipmentIds = [];
      return {
        requestId: request.requestId,
        chatSession: { id: session.id, suggestedTitle: "Test" },
        turnId: "test",
        status: "approved",
        routing: {
          selectedEntities: [],
          usedStructuralFallback: true,
          profileVersions: [],
        },
        answer: {
          summary: null,
          steps: [
            { id: "s1", text: "Test label is amber.", citationIds: ["c1"] },
          ],
        },
        citations: [citation],
        followUpAllowed: true,
      };
    });
    const input = {
      clientTurnId: randomUUID(),
      question: "Test label?",
      assignedReferences: [],
    };
    const first = await submitTurn(asMember(), session.id, input);
    expect(first.result?.status).toBe("unavailable");
    expect((await submitTurn(asMember(), session.id, input)).id).toBe(first.id);
    expect(runtime.ask).toHaveBeenCalledTimes(1);
    await expect(
      submitTurn(asMember(), session.id, { ...input, question: "Changed" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(
      submitTurn(ctx, session.id, { ...input, clientTurnId: randomUUID() }),
    ).rejects.toThrow("CHAT_SESSION_NOT_FOUND");
  });
  it("outbox retries are bounded, deduplicated, and require explicit dead-letter recovery", async () => {
    memory.data("documentVersions")[0] = {
      ...memory.data("documentVersions")[0],
      state: "EXTRACTING",
      uploadCompletedAt: new Date(),
      objectKey: "fixture",
      contentType: "text/plain",
      sha256: "a".repeat(64),
    };
    runtime.post.mockResolvedValue({ data: { status: "failed" } });
    await queue(ctx, "EXTRACT", `extract:${version}`, { versionId: version });
    await queue(ctx, "EXTRACT", `extract:${version}`, { versionId: version });
    expect(memory.data("outboxEvents")).toHaveLength(1);
    for (let i = 0; i < 5; i++) {
      memory.data("outboxEvents")[0].availableAt = new Date(0);
      await runJobs(ctx, 1);
    }
    const job = memory.data("outboxEvents")[0];
    expect(job.status).toBe("DEAD_LETTER");
    expect(memory.data("documentVersions")[0].state).toBe("FAILED");
    expect((await runJobs(ctx, 1)).items).toHaveLength(0);
    await retryJob(ctx, String(job._id), "Provider restored; retry test");
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(0);
  });
  it("a period retains one run even if a new definition is published during it", async () => {
    seedProcedure();
    const [first, duplicate] = await Promise.all([
      createRun(ctx, project, procedure),
      createRun(ctx, project, procedure),
    ]);
    expect(duplicate.id).toBe(first.id);
    memory.data("safetyProcedures")[0].currentPublishedVersionId = "4".repeat(
      24,
    );
    memory.data("procedureVersions").push({
      ...memory.data("procedureVersions")[0],
      _id: new ObjectId("4".repeat(24)),
    });
    expect((await createRun(ctx, project, procedure)).id).toBe(first.id);
    await expect(
      changeRun(ctx, first.id, { expectedRevision: 1 }),
    ).rejects.toThrow("REQUIRED_STEPS_INCOMPLETE");
    await changeRun(
      ctx,
      first.id,
      {
        expectedRevision: 1,
        checked: true,
        note: "Test only",
        exception: null,
      },
      "s1",
    );
    expect(
      (await changeRun(ctx, first.id, { expectedRevision: 2 })).state,
    ).toBe("COMPLETED");
    await expect(
      changeRun(ctx, first.id, { expectedRevision: 3, checked: false }, "s1"),
    ).rejects.toThrow("RUN_NOT_MUTABLE");
    const tomorrow = new Date(Date.now() + 86400000);
    const next = await createRun(ctx, project, procedure, tomorrow);
    expect(next.id).not.toBe(first.id);
    expect(next.steps.every((s) => !s.checked)).toBe(true);
    expect(memory.data("procedureRuns")[0].state).toBe("COMPLETED");
  });
  it("removing a draft step requires whole-procedure revalidation before approval", async () => {
    seedProcedure();
    memory.data("procedureVersions")[0].state = "DRAFT";
    const edited = await editProcedure(ctx, project, procedure, pv, {
      expectedRevision: 1,
      title: "Changed test",
      steps: [
        {
          stepId: "s1",
          title: "Test label",
          instructions: "Test label is amber.",
          required: true,
          citationIds: ["c1"],
        },
      ],
      citations: [citation],
    });
    expect(edited.reviewAnalysis.blockingFindings).toContain(
      "DRAFT_CHANGED_REVALIDATION_REQUIRED",
    );
    await transitionProcedure(ctx, project, procedure, pv, "review", {
      expectedRevision: 2,
    });
    await expect(
      transitionProcedure(ctx, project, procedure, pv, "approve", {
        expectedRevision: 3,
      }),
    ).rejects.toThrow("PROCEDURE_EVIDENCE_BLOCKED");
    expect(
      (memory.data("procedureVersions")[0] as unknown as ProcedureVersion)
        .state,
    ).toBe("IN_REVIEW");
  });
  it("logs require Project ownership and included Equipment; submitted wording is immutable", async () => {
    await expect(
      logScope(asMember(), project, equipment, true),
    ).rejects.toThrow("PROJECT_ACCESS_REQUIRED");
    await expect(logScope(ctx, project, "5".repeat(24), true)).rejects.toThrow(
      "EQUIPMENT_NOT_IN_PROJECT",
    );
    const log = await createLog(ctx, project, {
      scopeType: "EQUIPMENT",
      equipmentId: equipment,
      text: "Synthetic observation only",
      attachmentVersionIds: [],
      citations: [],
    });
    expect((await updateLog(ctx, project, log.id, 1)).state).toBe("SUBMITTED");
    await expect(
      updateLog(ctx, project, log.id, 2, "Overwrite"),
    ).rejects.toThrow("LOG_REVISION_CONFLICT");
    expect(memory.data("maintenanceLogs")[0].text).toBe(
      "Synthetic observation only",
    );
  });
});
