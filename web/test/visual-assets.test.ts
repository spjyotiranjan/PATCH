// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryDb } from "./support/memory-db";
import { type Context } from "../lib/backend/context";
import {
  requestVisualAsset,
  listVisualAssets,
  visualAssetSource,
  visualRequestSchema,
  requestVisualDescription,
} from "../lib/backend/visual-assets";
import { runJobs } from "../lib/backend/jobs";
import { retryJob } from "../lib/backend/operations";
import {
  requestDiscovery,
  discoveryStatus,
  commitRegions,
  descriptorFingerprint,
} from "../lib/backend/visual-pipeline";
import {
  prepareVisualChat,
  validateVisualAnswer,
} from "../lib/backend/visual-chat";
import { repairVisuals, afterVisualDelete } from "../lib/backend/visual-repair";
import type { Schema } from "../lib/backend/models";

const runtime = vi.hoisted(() => ({
  memory: null as unknown,
  post: vi.fn(),
  store: vi.fn(),
  source: vi.fn(),
}));
vi.mock("../lib/database/mongodb", () => ({
  withDatabaseTransaction: async (
    _: unknown,
    fn: (db: unknown, session: unknown) => Promise<unknown>,
  ) => (runtime.memory as MemoryDb).transaction(fn),
}));
vi.mock("../lib/storage/r2", () => ({
  sourceUrl: runtime.source,
  storeVisualDerivative: runtime.store,
}));
vi.mock("../lib/ai/client", () => ({
  createAiServiceClient: () => ({ POST: runtime.post }),
}));

const owner = "a".repeat(24),
  equipment = "c".repeat(24),
  doc = "e".repeat(24),
  version = "f".repeat(24);
const sha = "a".repeat(64);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0S8AAAAASUVORK5CYII=",
  "base64",
);
let memory: MemoryDb, ctx: Context;
beforeEach(() => {
  vi.resetAllMocks();
  memory = new MemoryDb();
  runtime.memory = memory;
  ctx = {
    db: memory.db,
    config: {
      VISUAL_RENDER_DPI: 144,
      R2_PRESIGNED_URL_TTL_SECONDS: 900,
    } as Context["config"],
    actor: { userId: owner, tenantId: "test" },
    requestId: randomUUID(),
  };
  memory.seed("equipments", [
    { _id: new ObjectId(equipment), tenantId: "test", ownerId: owner },
  ]);
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
      sha256: sha,
      contentType: "application/pdf",
      objectKey: "private-original-key",
      state: "ACTIVE",
      approvalState: "APPROVED",
      index: { status: "indexed" },
      extraction: { pages: [{ page: 1 }] },
    },
  ]);
  runtime.source.mockResolvedValue("https://fixture.example/expiring-source");
  runtime.store.mockResolvedValue(undefined);
  runtime.post.mockImplementation(async (_path, { body }) => ({
    data: {
      requestId: body.requestId,
      status: "rendered",
      errors: [],
      pngBase64: png.toString("base64"),
      asset: {
        assetId: body.assetId,
        documentId: doc,
        documentVersionId: version,
        page: body.page,
        bounds: body.bounds,
        originalSha256: sha,
        sha256: createHash("sha256").update(png).digest("hex"),
        byteCount: png.length,
        width: 1,
        height: 1,
        contentType: "image/png",
        renderDpi: body.renderDpi,
        rendererVersion: body.rendererVersion,
      },
    },
  }));
});
const request = () =>
  requestVisualAsset(ctx, version, visualRequestSchema.parse({ page: 1 }));

async function readyDescription() {
  const asset = await request();
  await runJobs(ctx, 1);
  runtime.post.mockImplementation(async (_path, { body }) => ({
    data: {
      requestId: body.requestId,
      assetId: body.asset.assetId,
      sha256: body.asset.sha256,
      status: "described",
      errors: [],
      description: {
        descriptionVersion: "vision-description-v1",
        summary: "A diagram.",
        labels: [],
        relationships: [],
        uncertainties: ["Labels unreadable."],
      },
    },
  }));
  return asset;
}

it("queues description once and persists a verified description independently of pixels", async () => {
  const asset = await readyDescription();
  expect((await requestVisualDescription(ctx, asset.id)).descriptionState).toBe(
    "QUEUED",
  );
  await requestVisualDescription(ctx, asset.id);
  expect(
    memory.data("outboxEvents").filter((j) => j.kind === "VISUAL_DESCRIBE"),
  ).toHaveLength(1);
  expect((await runJobs(ctx, 1)).items[0].status).toBe("COMPLETED");
  expect((await listVisualAssets(ctx, version)).items[0]).toMatchObject({
    state: "READY",
    descriptionState: "READY",
    description: { summary: "A diagram." },
  });
  expect(runtime.post.mock.calls.at(-1)?.[0]).toBe(
    "/v1/visual-assets/describe",
  );
  expect(runtime.store).toHaveBeenCalledOnce();
});

it("rejects description for queued, cross-tenant and superseded assets", async () => {
  const asset = await request();
  await expect(requestVisualDescription(ctx, asset.id)).rejects.toThrow(
    "VISUAL_ASSET_NOT_READY",
  );
  await runJobs(ctx, 1);
  await expect(
    requestVisualDescription(
      { ...ctx, actor: { ...ctx.actor, tenantId: "other" } },
      asset.id,
    ),
  ).rejects.toThrow("VISUAL_ASSET_NOT_FOUND");
  memory.data("documents")[0].activeVersionId = "0".repeat(24);
  await expect(requestVisualDescription(ctx, asset.id)).rejects.toThrow(
    "VISUAL_SOURCE_NOT_CURRENT",
  );
});

it("dead-letters invalid description provenance without losing the source and supports retry", async () => {
  const asset = await readyDescription();
  await requestVisualDescription(ctx, asset.id);
  runtime.post.mockResolvedValue({
    data: { status: "described", sha256: "wrong" },
  });
  const job = memory
    .data("outboxEvents")
    .find((j) => j.kind === "VISUAL_DESCRIBE")!;
  job.attempts = 4;
  await runJobs(ctx, 1);
  expect((await visualAssetSource(ctx, asset.id)).asset).toMatchObject({
    state: "READY",
    descriptionState: "FAILED",
    description: null,
  });
  await retryJob(
    ctx,
    (job._id as ObjectId).toHexString(),
    "Vision service restored",
  );
  expect((await listVisualAssets(ctx, version)).items[0].descriptionState).toBe(
    "QUEUED",
  );
});

it("does not commit a description after the parent becomes inactive during inference", async () => {
  const asset = await readyDescription();
  await requestVisualDescription(ctx, asset.id);
  const generate = runtime.post.getMockImplementation()!;
  runtime.post.mockImplementation(async (...args) => {
    const result = await generate(...args);
    memory.data("documents")[0].activeVersionId = "0".repeat(24);
    return result;
  });
  expect((await runJobs(ctx, 1)).items[0].status).not.toBe("COMPLETED");
  expect(memory.data("visualSourceAssets")[0].description).toBeUndefined();
});

it("deduplicates queued requests, stores a validated asset and exposes no private bytes in metadata", async () => {
  const first = await request();
  expect((await request()).id).toBe(first.id);
  expect(memory.data("outboxEvents")).toHaveLength(1);
  expect((await runJobs(ctx, 1)).items).toEqual([
    { jobId: expect.any(String), status: "COMPLETED" },
  ]);
  expect(runtime.store).toHaveBeenCalledOnce();
  const listed = await listVisualAssets(ctx, version);
  expect(listed.items[0].state).toBe("READY");
  expect(JSON.stringify(listed)).not.toMatch(
    /objectKey|pngBase64|private-original-key|https:/,
  );
  expect(await visualAssetSource(ctx, first.id)).toMatchObject({
    expiresInSeconds: 300,
    asset: { id: first.id },
  });
  expect(memory.data("auditEvents").map((e) => e.action)).toContain(
    "VISUAL_SOURCE_OPENED",
  );
});

it.each([
  "approval",
  "archive",
  "supersession",
  "unlink",
  "revocation",
  "tenant",
])("blocks visual reads after %s changes", async (change) => {
  const asset = await request();
  await runJobs(ctx, 1);
  if (change === "approval")
    memory.data("documentVersions")[0].approvalState = "REJECTED";
  if (change === "archive") memory.data("documents")[0].archivedAt = new Date();
  if (change === "supersession")
    memory.data("documents")[0].activeVersionId = "1".repeat(24);
  if (change === "unlink") memory.seed("documentLinks", []);
  if (change === "revocation") ctx.actor.userId = "b".repeat(24);
  if (change === "tenant") ctx.actor.tenantId = "other";
  runtime.source.mockClear();
  await expect(visualAssetSource(ctx, asset.id)).rejects.toThrow();
  await expect(listVisualAssets(ctx, version)).rejects.toThrow();
  expect(runtime.source).not.toHaveBeenCalled();
});

it("requires mutation access, an actual page, a current PDF and available quota", async () => {
  ctx.actor.userId = "b".repeat(24);
  await expect(request()).rejects.toThrow();
  ctx.actor.userId = owner;
  await expect(
    requestVisualAsset(ctx, version, visualRequestSchema.parse({ page: 2 })),
  ).rejects.toThrow("VISUAL_PAGE_NOT_FOUND");
  memory.data("documentVersions")[0].contentType = "text/plain";
  await expect(request()).rejects.toThrow("VISUAL_SOURCE_NOT_CURRENT");
  memory.data("documentVersions")[0].contentType = "application/pdf";
  memory.seed(
    "visualSourceAssets",
    Array.from({ length: 100 }, () => ({
      _id: new ObjectId(),
      tenantId: "test",
      documentVersionId: version,
    })),
  );
  await expect(request()).rejects.toThrow("VISUAL_ASSET_LIMIT");
  expect(memory.data("outboxEvents")).toHaveLength(0);
});

it.each(["correlation", "provenance", "checksum", "dimensions", "base64"])(
  "rejects tampered %s without storing the derivative or changing source activation",
  async (kind) => {
    const original = runtime.post.getMockImplementation()!;
    runtime.post.mockImplementation(async (...args) => {
      const response = await original(...args);
      if (kind === "correlation") response.data.requestId = randomUUID();
      if (kind === "provenance")
        response.data.asset.documentVersionId = "wrong";
      if (kind === "checksum") response.data.asset.sha256 = "b".repeat(64);
      if (kind === "dimensions") response.data.asset.width = 2;
      if (kind === "base64") response.data.pngBase64 += "!";
      return response;
    });
    await request();
    expect((await runJobs(ctx, 1)).items[0].status).toBe("PENDING");
    expect(runtime.store).not.toHaveBeenCalled();
    expect(memory.data("documentVersions")[0].state).toBe("ACTIVE");
  },
);

it("fences stale workers and rechecks parent state after rendering", async () => {
  await request();
  runtime.store.mockImplementation(async () => {
    memory.data("documents")[0].archivedAt = new Date();
  });
  expect((await runJobs(ctx, 1)).items[0].status).toBe("PENDING");
  expect(memory.data("visualSourceAssets")[0].state).toBe("QUEUED");
  memory.data("documents")[0].archivedAt = null;
  memory.data("outboxEvents")[0].availableAt = new Date(0);
  runtime.store.mockImplementation(async () => {
    memory.data("outboxEvents")[0].leaseToken = "newer-lease";
  });
  await runJobs(ctx, 1);
  expect(memory.data("visualSourceAssets")[0].state).toBe("QUEUED");
});

it("marks dead letters failed and supports audited recovery without changing the source", async () => {
  const asset = await request();
  runtime.store.mockRejectedValueOnce(new Error("storage-unavailable"));
  memory.data("outboxEvents")[0].attempts = 4;
  expect((await runJobs(ctx, 1)).items[0].status).toBe("DEAD_LETTER");
  expect((await listVisualAssets(ctx, version)).items[0].state).toBe("FAILED");
  const jobId = String(memory.data("outboxEvents")[0]._id);
  await retryJob(ctx, jobId, "Storage connectivity restored");
  expect((await listVisualAssets(ctx, version)).items[0].state).toBe("QUEUED");
  expect((await runJobs(ctx, 1)).items[0].status).toBe("COMPLETED");
  expect((await visualAssetSource(ctx, asset.id)).asset.state).toBe("READY");
  expect(memory.data("documentVersions")[0].state).toBe("ACTIVE");
});

const description: Schema["VisualDescription"] = {
  descriptionVersion: "vision-description-v1",
  summary: "A diagram.",
  labels: ["A", "B"],
  relationships: ["A connects to B."],
  uncertainties: [],
};
const region = {
  bounds: { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 },
  visualClass: "DIAGRAM" as const,
  confidence: 0.9,
  uncertainty: "",
};
function pipeline() {
  const render = runtime.post.getMockImplementation()!;
  runtime.post.mockImplementation(async (path, options) => {
    const b = options.body;
    const base = {
      requestId: b.requestId,
      documentVersionId: version,
      originalSha256: sha,
    };
    if (path.endsWith("/triage"))
      return {
        data: {
          ...base,
          status: "complete",
          pages: [1],
          totalPages: 1,
          scannedPages: 1,
        },
      };
    if (path.endsWith("/discover"))
      return {
        data: {
          ...base,
          status: "complete",
          page: 1,
          regions: [region, region],
        },
      };
    if (path.endsWith("/describe"))
      return {
        data: {
          requestId: b.requestId,
          assetId: b.asset.assetId,
          sha256: b.asset.sha256,
          status: "described",
          description,
          errors: [],
        },
      };
    if (path.endsWith("/index"))
      return {
        data: {
          requestId: b.requestId,
          assetId: b.asset.assetId,
          descriptionFingerprint: b.descriptionFingerprint,
          status: "indexed",
          embeddingModel: "text-embedding-3-large",
        },
      };
    return render(path, options);
  });
}
async function indexed() {
  pipeline();
  await requestDiscovery(ctx, version);
  for (let i = 0; i < 5; i++)
    expect((await runJobs(ctx, 1)).items[0].status).toBe("COMPLETED");
  return (await listVisualAssets(ctx, version)).items[0];
}
it("reuses an undescribed manual page and finishes its enrichment during discovery", async () => {
  const manual = await request();
  await runJobs(ctx, 1);
  pipeline();
  await requestDiscovery(ctx, version);
  for (let i = 0; i < 4; i++)
    expect((await runJobs(ctx, 1)).items[0].status).toBe("COMPLETED");
  const result = (await listVisualAssets(ctx, version)).items;
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ id: manual.id, indexState: "READY" });
  expect(runtime.store).toHaveBeenCalledOnce();
});
function visualQuestion(): Schema["QuestionRequest"] {
  return {
    requestId: randomUUID(),
    contractVersion: "v1",
    actor: { id: owner, tenantId: "test" },
    chatSession: { id: "session" },
    question: "How are A and B connected?",
    assignedReferences: [],
    retrievalPolicy: {
      approvedOnly: true,
      requireSourceLocation: true,
      allowStructuralFallback: true,
    },
    retrievalScopeManifest: {
      allowedDocumentVersions: [
        {
          documentId: doc,
          documentVersionId: version,
          inclusionPaths: ["PERSONAL"],
        },
      ],
    },
  };
}
it("completes discovery, deduplicated rendering, description and indexing through durable jobs", async () => {
  const asset = await indexed();
  expect(asset).toMatchObject({
    state: "READY",
    descriptionState: "READY",
    indexState: "READY",
    visualClass: "DIAGRAM",
  });
  expect(await discoveryStatus(ctx, version)).toMatchObject({
    status: "COMPLETE",
    assets: 1,
    indexed: 1,
  });
  await requestDiscovery(ctx, version);
  expect(memory.data("outboxEvents")).toHaveLength(5);
  expect(runtime.store).toHaveBeenCalledOnce();
});
it("reports processing until automatic assets are indexed and partial detection at the quota", async () => {
  pipeline();
  await requestDiscovery(ctx, version);
  await runJobs(ctx, 1);
  await runJobs(ctx, 1);
  expect(await discoveryStatus(ctx, version)).toMatchObject({
    status: "PROCESSING",
    detectionStatus: "COMPLETE",
    indexed: 0,
  });
  memory.data("visualDiscovery")[0].completedPages = [];
  memory.seed(
    "visualSourceAssets",
    Array.from({ length: 48 }, () => ({
      _id: new ObjectId(),
      tenantId: "test",
      documentVersionId: version,
      automatic: true,
      page: 2,
    })),
  );
  await commitRegions(ctx, version, {
    requestId: randomUUID(),
    documentVersionId: version,
    originalSha256: sha,
    status: "complete",
    page: 1,
    regions: [region],
  });
  expect(memory.data("visualSourceAssets")).toHaveLength(48);
  expect(memory.data("visualDiscovery")[0]).toMatchObject({
    status: "PARTIAL",
    partial: true,
  });
});
it.each(["fingerprint", "generation"])(
  "fences an index response after concurrent %s changes",
  async (change) => {
    pipeline();
    await requestDiscovery(ctx, version);
    for (let i = 0; i < 4; i++) await runJobs(ctx, 1);
    const post = runtime.post.getMockImplementation()!;
    runtime.post.mockImplementation(async (...args) => {
      const result = await post(...args);
      if (change === "generation")
        memory.data("visualSourceAssets")[0].indexGeneration = 1;
      else
        memory.data("visualSourceAssets")[0].descriptionFingerprint =
          "b".repeat(64);
      return result;
    });
    expect((await runJobs(ctx, 1)).items[0].status).not.toBe("COMPLETED");
    expect(memory.data("visualSourceAssets")[0].indexState).toBe("QUEUED");
  },
);
it("signs only selected assets and validates exact citations before persistence", async () => {
  const asset = await indexed();
  ctx.config.VISUAL_RETRIEVAL_ENABLED = true;
  runtime.source.mockClear();
  runtime.post.mockImplementation(async (_path, { body }) => {
    expect(body.visualScopeManifest).toHaveLength(1);
    expect(body.visualSources).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("https:");
    return {
      data: {
        requestId: body.requestId,
        state: "AVAILABLE",
        visualRequired: false,
        selected: [{ assetId: asset.id, relevanceRole: "HELPFUL" }],
      },
    };
  });
  const request = visualQuestion();
  await prepareVisualChat(ctx, request);
  expect(runtime.source).toHaveBeenCalledOnce();
  const citation: Schema["VisualCitation"] = {
    id: `visual-${asset.id}`,
    assetId: asset.id,
    documentId: doc,
    documentVersionId: version,
    page: 1,
    bounds: asset.bounds,
    sha256: asset.metadata!.sha256,
    descriptionFingerprint: descriptorFingerprint(description),
    visualClass: "DIAGRAM",
    relevanceRole: "HELPFUL",
  };
  const result: Schema["QuestionResult"] = {
    requestId: request.requestId,
    chatSession: { id: "session", suggestedTitle: "Diagram" },
    turnId: "turn",
    status: "incomplete",
    routing: { usedStructuralFallback: true },
    answer: { summary: null, steps: [] },
    followUpAllowed: true,
    visualEvidenceState: "AVAILABLE",
    visualCitations: [citation],
    visualObservations: [
      { text: "A connects to B.", visualCitationIds: [citation.id] },
    ],
  };
  await expect(
    validateVisualAnswer(ctx, result, request),
  ).resolves.toBeUndefined();
  expect(JSON.stringify(result)).not.toMatch(/https:|objectKey|pngBase64/);
  citation.sha256 = "0".repeat(64);
  await expect(validateVisualAnswer(ctx, result, request)).rejects.toThrow(
    "AI_VISUAL_INVALID",
  );
  citation.sha256 = asset.metadata!.sha256;
  memory.seed("documentLinks", []);
  await expect(validateVisualAnswer(ctx, result, request)).rejects.toThrow();
});
it("rejects invented search selections without signing pixels", async () => {
  await indexed();
  ctx.config.VISUAL_RETRIEVAL_ENABLED = true;
  runtime.source.mockClear();
  runtime.post.mockImplementation(async (_path, { body }) => ({
    data: {
      requestId: body.requestId,
      state: "AVAILABLE",
      visualRequired: true,
      selected: [{ assetId: "0".repeat(24), relevanceRole: "REQUIRED" }],
    },
  }));
  const request = visualQuestion();
  await prepareVisualChat(ctx, request);
  expect(request.visualSelection?.state).toBe("UNAVAILABLE");
  expect(runtime.source).not.toHaveBeenCalled();
});
it("an old generation's dead letter cannot fail a newer queued index", async () => {
  pipeline();
  await requestDiscovery(ctx, version);
  for (let i = 0; i < 4; i++) await runJobs(ctx, 1);
  const old = memory
    .data("outboxEvents")
    .find((j) => j.kind === "VISUAL_INDEX")!;
  old.attempts = 4;
  memory.data("visualSourceAssets")[0].indexGeneration = 1;
  runtime.post.mockClear();
  expect((await runJobs(ctx, 1)).items[0].status).toBe("DEAD_LETTER");
  expect(memory.data("visualSourceAssets")[0].indexState).toBe("QUEUED");
  expect(runtime.post).not.toHaveBeenCalled();
});
it("disables orphaned vectors and rebuilds a restored source without deleting retained PNGs", async () => {
  await indexed();
  const links = memory.data("documentLinks");
  memory.seed("documentLinks", []);
  await repairVisuals(ctx);
  expect(memory.data("visualSourceAssets")[0].indexState).toBe("DISABLED");
  expect(
    memory.data("outboxEvents").filter((j) => j.kind === "VISUAL_DELETE"),
  ).toHaveLength(1);
  memory.seed("documentLinks", links);
  await afterVisualDelete({ ...ctx, system: true }, version);
  expect(memory.data("visualSourceAssets")[0]).toMatchObject({
    indexState: "QUEUED",
    indexGeneration: 1,
    state: "READY",
  });
  expect(runtime.store).toHaveBeenCalledOnce();
});
