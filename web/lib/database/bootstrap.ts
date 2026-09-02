import "server-only";

import type { Db } from "mongodb";

import type { ServerConfig } from "@/lib/config";

import { getDatabase } from "./mongodb";

const PHASE_ONE_MIGRATION = "0001_phase_one_foundation";
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

/**
 * Runs the idempotent Phase 1 migration once per process/database. There is no
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

  const bootstrap = applyPhaseOneDatabaseMigration(getDatabase(config)).catch(
    (error) => {
      bootstrapPromises.delete(key);
      throw error;
    },
  );
  bootstrapPromises.set(key, bootstrap);
  return bootstrap;
}
