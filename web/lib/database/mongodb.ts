import "server-only";

import { MongoClient, type ClientSession, type Db } from "mongodb";

import type { ServerConfig } from "@/lib/config";

let mongoClient: MongoClient | undefined;

export function getMongoClient(
  config: Pick<ServerConfig, "MONGODB_URI">,
): MongoClient {
  if (!mongoClient) {
    mongoClient = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5_000,
      appName: "patch-web",
    });
  }

  return mongoClient;
}

export function getDatabase(
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Db {
  return getMongoClient(config).db(config.MONGODB_DB_NAME);
}

export async function checkMongoReadiness(
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Promise<{ status: "ready" | "unavailable" }> {
  try {
    await getDatabase(config).command({ ping: 1 });
    return { status: "ready" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function withDatabaseTransaction<T>(
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
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
