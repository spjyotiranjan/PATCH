// @vitest-environment node

import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import {
  applyPhaseOneDatabaseMigration,
  applyPhaseTwoDatabaseMigration,
} from "../lib/database/bootstrap";

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

describe("Phase 2 database migration", () => {
  it("creates relationship/access indexes and a migration record", async () => {
    const createIndex = vi.fn().mockResolvedValue("index-name");
    const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const database = {
      collection: vi.fn(() => ({ createIndex, updateOne })),
    } as unknown as Db;

    await applyPhaseTwoDatabaseMigration(database);

    expect(createIndex).toHaveBeenCalledTimes(8);
    expect(createIndex).toHaveBeenCalledWith(
      { tenantId: 1, equipmentId: 1, userId: 1 },
      expect.objectContaining({
        unique: true,
        name: "equipment_manage_access_unique",
      }),
    );
    expect(createIndex).toHaveBeenCalledWith(
      { tenantId: 1, projectId: 1, userId: 1 },
      expect.objectContaining({
        unique: true,
        name: "project_membership_unique",
      }),
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "0002_equipment_project_access" },
      expect.objectContaining({ $setOnInsert: expect.any(Object) }),
      { upsert: true },
    );
  });
});
