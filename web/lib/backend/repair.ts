import "server-only";
import { randomUUID } from "node:crypto";
import { audit, queue, type Context } from "./context";
import type { ProfileRecord, VersionRecord } from "./models";
import type { ProcedureVersion } from "./procedures";
import { scanBatch } from "./scan";

export async function repairBackend(base: Context) {
  let repaired = 0;
  const published = await scanBatch<ProcedureVersion>(
    base,
    "procedureVersions",
    "repair-published",
    { state: "PUBLISHED" },
  );
  for (const version of published)
    await queue(
      {
        ...base,
        actor: { tenantId: version.tenantId, userId: "system:repair" },
      },
      "PROCEDURE_EVIDENCE",
      `procedure-evidence:${version._id.toHexString()}`,
      { versionId: version._id.toHexString() },
    );
  const profiles = await scanBatch<ProfileRecord>(
    base,
    "entityProfiles",
    "repair-profiles",
    { state: { $in: ["STALE", "FAILED"] } },
  );
  for (const profile of profiles) {
    const ctx = {
      ...base,
      actor: { tenantId: profile.tenantId, userId: "system:repair" },
    };
    await queue(
      ctx,
      "PROFILE",
      `profile:${profile.entityType}:${profile.entityId}:${profile.revision}`,
      {
        entity: { type: profile.entityType, id: profile.entityId },
        revision: profile.revision,
      },
    );
  }
  const versions = await scanBatch<VersionRecord>(
    base,
    "documentVersions",
    "repair-versions",
    { state: { $in: ["EXTRACTING", "INDEXING", "INDEXED"] } },
  );
  for (const version of versions) {
    const kind =
      version.state === "EXTRACTING"
        ? "EXTRACT"
        : version.state === "INDEXING"
          ? "INDEX"
          : "ACTIVATE";
    const id = version._id.toHexString();
    await queue(
      {
        ...base,
        actor: { tenantId: version.tenantId, userId: "system:repair" },
      },
      kind,
      `${kind.toLowerCase()}:${id}`,
      { versionId: id },
    );
  }
  // A crashed copy must not be silently overwritten. Preserve the version and
  // require a new upload; no original, vector or audit history is deleted.
  const failed = await base.db
    .collection<VersionRecord>("documentVersions")
    .updateMany(
      {
        state: { $in: ["UPLOADING", "FINALIZING"] },
        uploadExpiresAt: { $lt: new Date(Date.now() - 600000) },
      },
      { $set: { state: "FAILED", updatedAt: new Date() } },
    );
  repaired += failed.modifiedCount;
  const sessions = await base.db
    .collection("chatSessions")
    .find({ lockId: { $ne: null }, lockUntil: { $lt: new Date() } })
    .limit(100)
    .toArray();
  for (const session of sessions) {
    const requestId = randomUUID();
    const updated = await base.db.collection("chatTurns").updateOne(
      {
        tenantId: session.tenantId,
        sessionId: session._id.toHexString(),
        clientTurnId: session.lockId,
        state: "PENDING",
      },
      {
        $set: {
          state: "COMPLETED",
          completedAt: new Date(),
          result: {
            requestId,
            chatSession: {
              id: session._id.toHexString(),
              suggestedTitle: "Interrupted question",
            },
            turnId: requestId,
            status: "unavailable",
            routing: {
              selectedEntities: [],
              usedStructuralFallback: true,
              profileVersions: [],
            },
            answer: { summary: null, steps: [] },
            citations: [],
            warnings: [
              "Processing was interrupted. Submit a new turn to retry.",
            ],
            followUpAllowed: true,
          },
        },
      },
    );
    await base.db.collection("chatSessions").updateOne(
      {
        _id: session._id,
        lockId: session.lockId,
        lockUntil: { $lt: new Date() },
      },
      { $set: { lockId: null } },
    );
    repaired += updated.modifiedCount;
  }
  await audit(base, "BACKEND_CONSISTENCY_REPAIR", {
    repaired,
    inspectedProfiles: profiles.length,
    inspectedVersions: versions.length,
  });
  return {
    repaired,
    inspectedProfiles: profiles.length,
    inspectedVersions: versions.length,
  };
}
