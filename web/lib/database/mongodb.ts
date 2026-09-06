import "server-only";
import { getServers, setServers } from "node:dns/promises";

import { MongoClient, type ClientSession, type Db } from "mongodb";

import type { ServerConfig } from "@/lib/config";

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

export async function checkMongoReadiness(
  config: DatabaseConfig,
): Promise<{ status: "ready" | "unavailable" }> {
  try {
    await getDatabase(config).command({ ping: 1 });
    return { status: "ready" };
  } catch {
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
  let result: T | undefined;

  try {
    await session.withTransaction(async () => {
      result = await operation(database, session);
    });
  } finally {
    await session.endSession();
  }

  if (result === undefined) {
    throw new Error("Database transaction completed without a result.");
  }
  return result;
}
