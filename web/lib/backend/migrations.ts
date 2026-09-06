import type { Db } from "mongodb";

export async function applyBackendMigrations(db: Db) {
  const unique = async (
    collection: string,
    keys: Record<string, 1 | -1>,
    name: string,
  ) => db.collection(collection).createIndex(keys, { unique: true, name });
  await Promise.all([
    unique(
      "safetyProcedures",
      { tenantId: 1, projectId: 1 },
      "project_safety_procedure_unique",
    ),
    unique(
      "documentVersions",
      { tenantId: 1, documentId: 1, versionNumber: 1 },
      "document_version_unique",
    ),
    unique(
      "documentLinks",
      { tenantId: 1, "entity.type": 1, "entity.id": 1, documentId: 1 },
      "entity_document_unique",
    ),
    unique(
      "entityProfiles",
      { tenantId: 1, entityType: 1, entityId: 1 },
      "entity_profile_unique",
    ),
    unique("outboxEvents", { tenantId: 1, key: 1 }, "outbox_key_unique"),
    unique(
      "chatTurns",
      { tenantId: 1, sessionId: 1, clientTurnId: 1 },
      "chat_turn_idempotency",
    ),
    unique(
      "procedureVersions",
      { tenantId: 1, procedureId: 1, versionNumber: 1 },
      "procedure_version_unique",
    ),
    unique(
      "procedureRuns",
      {
        tenantId: 1,
        procedureId: 1,
        periodStart: 1,
      },
      "procedure_run_period_unique",
    ),
    db
      .collection("outboxEvents")
      .createIndex(
        { status: 1, availableAt: 1, leaseUntil: 1 },
        { name: "outbox_dispatch" },
      ),
    db
      .collection("documents")
      .createIndex(
        { tenantId: 1, ownerId: 1, updatedAt: -1 },
        { name: "document_owner_list" },
      ),
    db
      .collection("chatSessions")
      .createIndex(
        { tenantId: 1, userId: 1, updatedAt: -1 },
        { name: "chat_sessions_list" },
      ),
    db
      .collection("maintenanceLogs")
      .createIndex(
        { tenantId: 1, projectId: 1, createdAt: -1 },
        { name: "project_logs" },
      ),
    db
      .collection("rateLimits")
      .createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "rate_limit_expiry" },
      ),
    unique("rateLimits", { key: 1 }, "rate_limit_key"),
  ]);
  await db.collection<{ _id: string }>("schemaMigrations").updateOne(
    { _id: "0003_backend_workflows" },
    {
      $setOnInsert: {
        appliedAt: new Date(),
        description:
          "Additive document, job, chat, procedure, run and rate-limit indexes",
      },
    },
    { upsert: true },
  );
}
