import "server-only";

import type { Db } from "mongodb";

import type { ServerConfig } from "@/lib/config";

import { getDatabase } from "./mongodb";
import { applyBackendMigrations } from "@/lib/backend/migrations";

const PHASE_ONE_MIGRATION = "0001_phase_one_foundation";
const PHASE_TWO_MIGRATION = "0002_equipment_project_access";
const bootstrapPromises = new Map<string, Promise<void>>();

export async function applyPhaseOneDatabaseMigration(
  database: Db,
): Promise<void> {
  await Promise.all([
    database
      .collection("users")
      .createIndex({ email: 1 }, { unique: true, name: "users_email_unique" }),
    database
      .collection("auditEvents")
      .createIndex({ occurredAt: -1 }, { name: "audit_events_occurred_at" }),
    database
      .collection("auditEvents")
      .createIndex(
        { "actor.tenantId": 1, "actor.userId": 1, occurredAt: -1 },
        { name: "audit_events_actor_timeline" },
      ),
  ]);

  await database.collection<{ _id: string }>("schemaMigrations").updateOne(
    { _id: PHASE_ONE_MIGRATION },
    {
      $setOnInsert: {
        appliedAt: new Date(),
        description: "Phase 1 users and audit indexes",
      },
    },
    { upsert: true },
  );
}

export async function applyPhaseTwoDatabaseMigration(
  database: Db,
): Promise<void> {
  await Promise.all([
    database
      .collection("equipments")
      .createIndex(
        { tenantId: 1, ownerId: 1, updatedAt: -1 },
        { name: "equipments_owner_timeline" },
      ),
    database
      .collection("equipmentManageAccess")
      .createIndex(
        { tenantId: 1, equipmentId: 1, userId: 1 },
        { unique: true, name: "equipment_manage_access_unique" },
      ),
    database.collection("equipmentAccessRequests").createIndex(
      { tenantId: 1, equipmentId: 1, requesterId: 1, status: 1 },
      {
        unique: true,
        name: "equipment_pending_request_unique",
        partialFilterExpression: { status: "PENDING" },
      },
    ),
    database
      .collection("projects")
      .createIndex(
        { tenantId: 1, updatedAt: -1 },
        { name: "projects_tenant_timeline" },
      ),
    database
      .collection("projects")
      .createIndex(
        { tenantId: 1, includedEquipmentIds: 1 },
        { name: "projects_included_equipment" },
      ),
    database
      .collection("projectMemberships")
      .createIndex(
        { tenantId: 1, projectId: 1, userId: 1 },
        { unique: true, name: "project_membership_unique" },
      ),
    database.collection("projectMembershipRequests").createIndex(
      { tenantId: 1, projectId: 1, requesterId: 1, status: 1 },
      {
        unique: true,
        name: "project_pending_request_unique",
        partialFilterExpression: { status: "PENDING" },
      },
    ),
    database
      .collection("procedureGenerationRequests")
      .createIndex(
        { tenantId: 1, projectId: 1, inputFingerprint: 1 },
        { unique: true, name: "procedure_generation_input_unique" },
      ),
  ]);

  await database.collection<{ _id: string }>("schemaMigrations").updateOne(
    { _id: PHASE_TWO_MIGRATION },
    {
      $setOnInsert: {
        appliedAt: new Date(),
        description: "Phase 2 Equipment, Project, and access indexes",
      },
    },
    { upsert: true },
  );
}

/**
 * Runs every idempotent migration once per process/database. There is no
 * production user seed: accounts must be created through the audited sign-up
 * flow.
 */
export function ensureDatabaseBootstrap(
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Promise<void> {
  const key = `${config.MONGODB_URI}\u0000${config.MONGODB_DB_NAME}`;
  const existing = bootstrapPromises.get(key);
  if (existing) {
    return existing;
  }

  const bootstrap = (async () => {
    const database = getDatabase(config);
    await applyPhaseOneDatabaseMigration(database);
    await applyPhaseTwoDatabaseMigration(database);
    await applyBackendMigrations(database);
  })().catch((error) => {
    bootstrapPromises.delete(key);
    throw error;
  });
  bootstrapPromises.set(key, bootstrap);
  return bootstrap;
}
