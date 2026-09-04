import "server-only";

import type { ClientSession } from "mongodb";

import type { AuthenticatedActor } from "@/lib/auth/authorization";
import type { ServerConfig } from "@/lib/config";
import { getDatabase } from "@/lib/database/mongodb";

export interface AuditEventInput {
  action: string;
  actor: AuthenticatedActor;
  requestId: string;
  context: Record<string, string | number | boolean | null | undefined>;
}

export interface AuditEvent extends AuditEventInput {
  occurredAt: Date;
}

/**
 * Every product mutation persists this envelope in the MongoDB AuditEvent
 * collection. Later transactional workflows can add an outbox in the same
 * database transaction.
 */
export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return { ...input, occurredAt: new Date() };
}

export async function persistAuditEvent(
  input: AuditEventInput,
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
  session?: ClientSession,
): Promise<void> {
  await getDatabase(config)
    .collection<AuditEvent>("auditEvents")
    .insertOne(createAuditEvent(input), { session });
}
