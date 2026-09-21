// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  db: {},
  session: { withTransaction: vi.fn(), endSession: vi.fn() },
}));
vi.mock("mongodb", () => ({
  MongoClient: class {
    db() {
      return runtime.db;
    }
    startSession() {
      return runtime.session;
    }
  },
}));
import { withDatabaseTransaction } from "../lib/database/mongodb";

const config = { MONGODB_URI: "mongodb://fixture", MONGODB_DB_NAME: "fixture" };
beforeEach(() => {
  vi.clearAllMocks();
  runtime.session.withTransaction.mockImplementation(async (fn) => fn());
});

it("accepts a committed void mutation and closes its session", async () => {
  const mutation = vi.fn(async () => undefined);
  await expect(
    withDatabaseTransaction(config, mutation),
  ).resolves.toBeUndefined();
  expect(mutation).toHaveBeenCalledWith(runtime.db, runtime.session);
  expect(runtime.session.endSession).toHaveBeenCalledOnce();
});

it("returns the final callback result after a transaction retry", async () => {
  runtime.session.withTransaction.mockImplementation(async (fn) => {
    await fn();
    await fn();
  });
  const mutation = vi
    .fn()
    .mockResolvedValueOnce("retry")
    .mockResolvedValueOnce("committed");
  await expect(withDatabaseTransaction(config, mutation)).resolves.toBe(
    "committed",
  );
  expect(runtime.session.endSession).toHaveBeenCalledOnce();
});

it("propagates transaction failure while closing its session", async () => {
  const failure = new Error("fixture transaction failed");
  await expect(
    withDatabaseTransaction(config, async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(runtime.session.endSession).toHaveBeenCalledOnce();
});

it("does not report success when the transaction never runs its callback", async () => {
  runtime.session.withTransaction.mockResolvedValue(undefined);
  await expect(
    withDatabaseTransaction(config, async () => undefined),
  ).rejects.toThrow("without a result");
  expect(runtime.session.endSession).toHaveBeenCalledOnce();
});
