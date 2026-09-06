// @vitest-environment node
import { ObjectId, type Db } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../lib/backend/context";
import { activateVersion, reviewVersion } from "../lib/backend/documents";

const runtime = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../lib/database/mongodb", () => ({
  getDatabase: () => runtime.db,
  withDatabaseTransaction: async (
    _config: unknown,
    operation: (db: unknown, session: unknown) => Promise<unknown>,
  ) => operation(runtime.db, {}),
}));
const userId = "a".repeat(24),
  documentId = "b".repeat(24),
  versionId = "c".repeat(24);
let document: Record<string, unknown>, version: Record<string, unknown>;
let docUpdate: ReturnType<typeof vi.fn>,
  versionUpdate: ReturnType<typeof vi.fn>;
let ctx: Context;
beforeEach(() => {
  document = {
    _id: new ObjectId(documentId),
    tenantId: "test",
    origin: { type: "PERSONAL", id: userId },
    activeVersionId: null,
  };
  version = {
    _id: new ObjectId(versionId),
    tenantId: "test",
    documentId,
    previousActiveVersionId: null,
    state: "INDEXED",
    approvalState: "APPROVED",
    sha256: "f".repeat(64),
    index: {
      status: "indexed",
      contentFingerprint: "f".repeat(64),
      chunkCount: 1,
    },
    reviewedMetadata: { title: "Synthetic card" },
  };
  docUpdate = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  versionUpdate = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  const db = {
    collection: (name: string) => ({
      findOne: async () =>
        name === "documents"
          ? document
          : name === "documentVersions"
            ? version
            : null,
      updateOne: name === "documents" ? docUpdate : versionUpdate,
      insertOne: vi.fn().mockResolvedValue({}),
      find: () => ({ toArray: async () => [] }),
    }),
  } as unknown as Db;
  runtime.db = db;
  ctx = {
    db,
    actor: { userId, tenantId: "test" },
    requestId: "test-request",
  } as Context;
});
describe("Atomic active-version transitions", () => {
  it("activates only with a compare-and-swap on the previous active pointer", async () => {
    await expect(activateVersion(ctx, versionId)).resolves.toMatchObject({
      activeVersionId: versionId,
    });
    expect(docUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ activeVersionId: null, tenantId: "test" }),
      expect.objectContaining({
        $set: expect.objectContaining({ activeVersionId: versionId }),
      }),
      expect.any(Object),
    );
  });
  it.each(["INDEXING", "FAILED", "NEEDS_REVIEW"])(
    "does not activate %s versions",
    async (state) => {
      version.state = state;
      await expect(activateVersion(ctx, versionId)).rejects.toThrow(
        "VERSION_NOT_ACTIVATABLE",
      );
      expect(docUpdate).not.toHaveBeenCalled();
    },
  );
  it("rejects a checksum mismatch even after an indexed response", async () => {
    version.sha256 = "0".repeat(64);
    await expect(activateVersion(ctx, versionId)).rejects.toThrow(
      "VERSION_NOT_ACTIVATABLE",
    );
    expect(docUpdate).not.toHaveBeenCalled();
  });
  it("does not replace a newer version when an older job finishes late", async () => {
    document.activeVersionId = "d".repeat(24);
    await expect(activateVersion(ctx, versionId)).rejects.toThrow(
      "ACTIVE_VERSION_CHANGED",
    );
    expect(docUpdate).not.toHaveBeenCalled();
  });
  it("checks compare-and-swap result before marking any version active", async () => {
    docUpdate.mockResolvedValue({ modifiedCount: 0 });
    await expect(activateVersion(ctx, versionId)).rejects.toThrow(
      "ACTIVE_VERSION_CHANGED",
    );
    expect(versionUpdate).not.toHaveBeenCalled();
  });
  it("duplicate activation is a no-op", async () => {
    document.activeVersionId = versionId;
    await expect(activateVersion(ctx, versionId)).resolves.toMatchObject({
      activeVersionId: versionId,
    });
    expect(docUpdate).not.toHaveBeenCalled();
  });
  it("requires extracted reviewable pages before human approval", async () => {
    version.state = "NEEDS_REVIEW";
    await expect(
      reviewVersion(ctx, versionId, {
        decision: "APPROVE",
        title: "Test",
        revision: "1",
        confirmSourceReviewed: true,
      }),
    ).rejects.toThrow("VERSION_NOT_REVIEWABLE");
    expect(versionUpdate).not.toHaveBeenCalled();
  });
});
