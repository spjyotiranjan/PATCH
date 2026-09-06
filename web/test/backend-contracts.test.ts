// @vitest-environment node
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { checkOrigin, workerAuthorized } from "../lib/backend/security";
import {
  assignedVersionIds,
  validateCitations,
  validateAnswer,
} from "../lib/backend/scope";
import {
  assertPublishable,
  assertRunMutable,
  changedSteps,
  type ProcedureVersion,
  type ProcedureRun,
  type StoredStep,
} from "../lib/backend/procedures";
import { recurrencePeriod, recurrenceSchema } from "../lib/backend/recurrence";
import { backendOpenApi } from "../lib/backend/openapi";
import { endpoints, matchEndpoint } from "../lib/backend/router";
import type { Context } from "../lib/backend/context";
import type { Schema } from "../lib/backend/models";
import { answerSchema } from "../lib/ai/socket";
import { parseJsonBody } from "../lib/api/route";
import { z } from "zod";

const documentId = "a".repeat(24),
  versionId = "b".repeat(24),
  projectId = "c".repeat(24),
  equipmentId = "d".repeat(24);
const manifest: Schema["RetrievalScopeManifest"] = {
  allowedDocumentVersions: [
    {
      documentId,
      documentVersionId: versionId,
      inclusionPaths: ["PROJECT_DIRECT"],
      sourceEntityIds: [projectId],
    },
  ],
  entities: [
    {
      id: projectId,
      type: "PROJECT",
      profileState: "MISSING",
      directDocumentVersionIds: [versionId],
    },
    {
      id: equipmentId,
      type: "EQUIPMENT",
      profileState: "MISSING",
      directDocumentVersionIds: [],
    },
  ],
  relationships: [
    {
      projectId,
      equipmentIds: [equipmentId],
      directDocumentVersionIds: [versionId],
    },
  ],
};
const citation: Schema["Citation"] = {
  id: "citation-1",
  documentId,
  documentVersionId: versionId,
  chunkId: `${versionId}:p1:0`,
  documentTitle: "Synthetic card",
  revision: "1",
  page: 1,
  section: "Text block 1",
  excerpt: "Synthetic label is amber.",
  approvalState: "APPROVED",
};
const step: StoredStep = {
  stepId: "step-1",
  position: 1,
  title: "Test label",
  instructions: "Synthetic label is amber.",
  required: true,
  citationIds: ["citation-1"],
  evidenceState: "SUPPORTED",
  citationReviewState: "CONFIRMED",
};
const analysis: Schema["ReviewAnalysis"] = {
  reviewNeed: "LOW",
  sourceCoverage: "COMPLETE",
  conflicts: "NONE_DETECTED",
  freshness: "CURRENT",
  hardwareCriticality: "NORMAL",
  blockingFindings: [],
  reasons: [],
  applicability: "CONFIRMED",
};
function context(): Context {
  const findOne = vi
    .fn()
    .mockResolvedValue({
      _id: new ObjectId(versionId),
      reviewedMetadata: { title: "Synthetic card", revision: "1" },
      extraction: {
        pages: [
          {
            page: 1,
            section: "Text block 1",
            text: "Synthetic label is amber.",
          },
        ],
      },
    });
  return {
    actor: { userId: "e".repeat(24), tenantId: "test" },
    requestId: "test",
    db: { collection: () => ({ findOne }) } as unknown as Db,
  } as Context;
}

describe("Backend contract and safety boundaries", () => {
  it("every registered REST endpoint is represented in Swagger", () => {
    const spec = backendOpenApi();
    for (const e of endpoints)
      expect(spec.paths[e.path]?.[e.method.toLowerCase()]).toBeDefined();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(40);
    expect(matchEndpoint("POST", "/api/maintenance-logs")).toBeNull();
    expect(
      matchEndpoint("POST", `/api/document-versions/${versionId}/activate`)
        ?.params.versionId,
    ).toBe(versionId);
  });
  it("rejects cross-origin mutation and worker secrets in the wrong shape", () => {
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/documents", {
          headers: { origin: "https://evil.test" },
        }),
        "http://localhost:3000",
      ),
    ).toThrow("ORIGIN_REJECTED");
    expect(() =>
      workerAuthorized(new Request("http://localhost"), "x".repeat(40)),
    ).toThrow("WORKER_AUTH_REQUIRED");
    expect(() =>
      workerAuthorized(
        new Request("http://localhost", {
          headers: { authorization: `Bearer ${"x".repeat(40)}` },
        }),
        "x".repeat(40),
      ),
    ).not.toThrow();
  });
  it("body size is checked before JSON parsing", async () => {
    await expect(
      parseJsonBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "x".repeat(512001) }),
        }),
        z.object({ text: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      parseJsonBody(
        new Request("http://localhost", { method: "POST", body: "text=x" }),
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("assignments narrow, never grant access, and empty scopes stay empty", () => {
    expect([
      ...assignedVersionIds(manifest, [{ type: "PROJECT", id: projectId }]),
    ]).toEqual([versionId]);
    expect([
      ...assignedVersionIds(manifest, [{ type: "EQUIPMENT", id: equipmentId }]),
    ]).toEqual([]);
    expect(() =>
      assignedVersionIds(manifest, [{ type: "DOCUMENT", id: "unauthorized" }]),
    ).toThrow("REFERENCE_NOT_ACCESSIBLE");
    expect(assignedVersionIds({ allowedDocumentVersions: [] }, []).size).toBe(
      0,
    );
  });
  it("accepts only current exact source excerpts and metadata", async () => {
    await expect(
      validateCitations(context(), [citation], manifest),
    ).resolves.toBeUndefined();
    for (const mutation of [
      { documentVersionId: "f".repeat(24) },
      { documentId: "f".repeat(24) },
      { revision: "old" },
      { excerpt: "fabricated evidence" },
      { chunkId: "ENTITY_PROFILE:1" },
      { page: 2 },
    ]) {
      await expect(
        validateCitations(context(), [{ ...citation, ...mutation }], manifest),
      ).rejects.toThrow("AI_CITATIONS_INVALID");
    }
  });
  it("rejects unsupported summaries, missing citations and unauthorized routed entities", async () => {
    const request: Schema["QuestionRequest"] = {
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      contractVersion: "v1",
      actor: { id: "user", tenantId: "test" },
      chatSession: { id: "chat" },
      question: "Test?",
      retrievalScopeManifest: manifest,
      retrievalPolicy: {
        approvedOnly: true,
        requireSourceLocation: true,
        allowStructuralFallback: true,
      },
    };
    const result = answerSchema.parse({
      requestId: request.requestId,
      chatSession: { id: "chat", suggestedTitle: "Test" },
      turnId: "turn",
      status: "approved",
      routing: { usedStructuralFallback: true },
      answer: {
        steps: [
          {
            id: "s",
            text: "Synthetic label is amber.",
            citationIds: ["citation-1"],
          },
        ],
      },
      citations: [citation],
      followUpAllowed: true,
    });
    await expect(
      validateAnswer(context(), result, request),
    ).resolves.toBeUndefined();
    await expect(
      validateAnswer(
        context(),
        { ...result, answer: { summary: "unsupported", steps: [] } },
        request,
      ),
    ).rejects.toThrow("AI_RESPONSE_INVALID");
    await expect(
      validateAnswer(context(), { ...result, citations: [] }, request),
    ).rejects.toThrow("AI_CITATIONS_INVALID");
    await expect(
      validateAnswer(
        context(),
        {
          ...result,
          routing: {
            ...result.routing,
            selectedEntities: [
              { type: "PROJECT", id: "other", reason: "match" },
            ],
          },
        },
        request,
      ),
    ).rejects.toThrow("AI_ROUTING_INVALID");
  });
  it("stable reorder preserves evidence, but changed meaning or bindings need review", () => {
    const other = { ...step, stepId: "step-2", position: 2 };
    const {
      citationReviewState: _a,
      evidenceState: _b,
      position: _c,
      ...input
    } = step;
    void _a;
    void _b;
    void _c;
    const reordered = changedSteps(
      [step, other],
      [{ ...input, stepId: "step-2" }, input],
      false,
    );
    expect(reordered.map((s) => s.stepId)).toEqual(["step-2", "step-1"]);
    expect(reordered.every((s) => s.citationReviewState === "CONFIRMED")).toBe(
      true,
    );
    expect(
      changedSteps(
        [step],
        [{ ...input, instructions: "New meaning" }],
        false,
      )[0].citationReviewState,
    ).toBe("NEEDS_REVIEW");
    expect(changedSteps([step], [input], true)[0].citationReviewState).toBe(
      "NEEDS_REVIEW",
    );
  });
  it("severe findings, missing steps, and unreviewed edits cannot publish", () => {
    const version = {
      steps: [step],
      reviewAnalysis: analysis,
    } as ProcedureVersion;
    expect(() => assertPublishable(version)).not.toThrow();
    expect(() =>
      assertPublishable({
        ...version,
        reviewAnalysis: { ...analysis, reviewNeed: "SEVERE" },
      }),
    ).toThrow("PROCEDURE_EVIDENCE_BLOCKED");
    expect(() =>
      assertPublishable({
        ...version,
        reviewAnalysis: {
          ...analysis,
          blockingFindings: ["missing isolation"],
        },
      }),
    ).toThrow();
    expect(() =>
      assertPublishable({
        ...version,
        steps: [{ ...step, citationReviewState: "NEEDS_REVIEW" }],
      }),
    ).toThrow();
    expect(() => assertPublishable({ ...version, steps: [] })).toThrow();
  });
  it("old and completed runs cannot receive new ticks", () => {
    const run = {
      state: "OPEN",
      revision: 1,
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-10-01"),
    } as ProcedureRun;
    expect(() =>
      assertRunMutable(run, 1, new Date("2026-09-15")),
    ).not.toThrow();
    expect(() => assertRunMutable(run, 1, new Date("2026-10-01"))).toThrow(
      "RUN_NOT_MUTABLE",
    );
    expect(() =>
      assertRunMutable(
        { ...run, state: "COMPLETED" },
        1,
        new Date("2026-09-15"),
      ),
    ).toThrow();
    expect(() => assertRunMutable(run, 2, new Date("2026-09-15"))).toThrow();
  });
  it("IANA recurrence produces separate deterministic periods including DST", () => {
    const schedule = recurrenceSchema.parse({
      frequency: "MONTHLY",
      timezone: "Asia/Kolkata",
      localStart: "2026-09-01T00:00:00",
    });
    const september = recurrencePeriod(
      schedule,
      new Date("2026-09-10T00:00:00Z"),
    )!;
    const october = recurrencePeriod(
      schedule,
      new Date("2026-10-10T00:00:00Z"),
    )!;
    expect(september.periodStart.toISOString()).toBe(
      "2026-08-31T18:30:00.000Z",
    );
    expect(september.periodEnd).toEqual(october.periodStart);
    const dst = recurrencePeriod(
      {
        ...schedule,
        frequency: "DAILY",
        timezone: "America/New_York",
        localStart: "2026-03-07T00:00:00",
      },
      new Date("2026-03-08T12:00:00Z"),
    )!;
    expect(dst.periodEnd.getTime() - dst.periodStart.getTime()).toBe(
      23 * 3600000,
    );
    expect(
      recurrenceSchema.safeParse({ ...schedule, timezone: "not/a/timezone" })
        .success,
    ).toBe(false);
  });
});
