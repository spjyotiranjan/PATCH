// @vitest-environment node

import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { applyPhaseOneDatabaseMigration } from "../lib/database/bootstrap";

describe("Phase 1 database migration", () => {
  it("creates the required idempotent indexes and migration record", async () => {
    const createIndex = vi.fn().mockResolvedValue("index-name");
    const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const database = {
      collection: vi.fn(() => ({ createIndex, updateOne })),
    } as unknown as Db;

    await applyPhaseOneDatabaseMigration(database);

    expect(createIndex).toHaveBeenCalledTimes(3);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "0001_phase_one_foundation" },
      expect.objectContaining({ $setOnInsert: expect.any(Object) }),
      { upsert: true },
    );
  });
});
