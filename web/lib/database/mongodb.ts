import "server-only";
import { getServers, setServers } from "node:dns/promises";

import { MongoClient, type ClientSession, type Db } from "mongodb";

import type { ServerConfig } from "@/lib/config";
import { logEvent } from "@/lib/observability/logger";

let mongoClient: MongoClient | undefined;
type MongoConfig = Pick<ServerConfig, "MONGODB_URI"> &
  Partial<Pick<ServerConfig, "MONGODB_DNS_SERVERS" | "MONGODB_ADDRESS_FAMILY">>;
type DatabaseConfig = MongoConfig & Pick<ServerConfig, "MONGODB_DB_NAME">;

export function getMongoClient(config: MongoConfig): MongoClient {
  if (!mongoClient) {
    const servers = config.MONGODB_DNS_SERVERS;
    if (servers?.length && servers.join(",") !== getServers().join(","))
      setServers(servers);
    mongoClient = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5_000,
      appName: "patch-web",
      family: config.MONGODB_ADDRESS_FAMILY || undefined,
    });
  }

  return mongoClient;
}

export function getDatabase(config: DatabaseConfig): Db {
  return getMongoClient(config).db(config.MONGODB_DB_NAME);
}

/** Fixed categories only: driver messages/topology can contain private addresses. */
export function mongoFailureCategory(error: unknown): string {
  const candidates: unknown[] = [error];
  const seen = new Set<unknown>();
  for (let index = 0; index < candidates.length && index < 12; index++) {
    const value = candidates[index];
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const failure = value as {
      code?: unknown;
      name?: unknown;
      syscall?: unknown;
      cause?: unknown;
      reason?: { servers?: unknown };
    };
    if (failure.code === 18 || failure.code === "AuthenticationFailed")
      return "AUTHENTICATION_FAILED";
    if (failure.code === 13) return "AUTHORIZATION_FAILED";
    if (failure.code === "ETIMEOUT") return "DNS_LOOKUP_TIMEOUT";
    if (
      ["ENOTFOUND", "ENODATA", "ESERVFAIL", "EREFUSED"].includes(
        String(failure.code),
      )
    )
      return "DNS_LOOKUP_FAILED";
    if (
      failure.code === "ECONNREFUSED" &&
      typeof failure.syscall === "string" &&
      failure.syscall.startsWith("query")
    )
      return "DNS_LOOKUP_REFUSED";
    if (
      [
        "CERT_HAS_EXPIRED",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "ERR_TLS_CERT_ALTNAME_INVALID",
      ].includes(String(failure.code))
    )
      return "TLS_VERIFICATION_FAILED";
    if (["EPERM", "EACCES"].includes(String(failure.code)))
      return "NETWORK_ACCESS_DENIED";
    if (failure.cause) candidates.push(failure.cause);
    if (failure.reason?.servers instanceof Map)
      for (const server of failure.reason.servers.values())
        candidates.push((server as { error?: unknown })?.error);
  }
  if (error instanceof Error && error.name === "MongoParseError")
    return "CONNECTION_CONFIGURATION_INVALID";
  if (error instanceof Error && error.name === "MongoServerSelectionError")
    return "SERVER_SELECTION_FAILED";
  return "CONNECTION_FAILED";
}

export async function checkMongoReadiness(
  config: DatabaseConfig,
): Promise<{ status: "ready" | "unavailable" }> {
  try {
    await getDatabase(config).command({ ping: 1 });
    return { status: "ready" };
  } catch (error) {
    logEvent("error", "patch_web.database.unavailable", {
      service: "mongodb",
      reason: mongoFailureCategory(error),
    });
    return { status: "unavailable" };
  }
}

export async function withDatabaseTransaction<T>(
  config: DatabaseConfig,
  operation: (database: Db, session: ClientSession) => Promise<T>,
): Promise<T> {
  const client = getMongoClient(config);
  const database = client.db(config.MONGODB_DB_NAME);
  const session = client.startSession();
  let result: { value: T } | undefined;

  try {
    await session.withTransaction(async () => {
      // A successful mutation may return void. Track completion separately
      // from its value so a committed transaction is not reported as failed.
      result = { value: await operation(database, session) };
    });
  } finally {
    await session.endSession();
  }

  if (result === undefined) {
    throw new Error("Database transaction completed without a result.");
  }
  return result.value;
}
