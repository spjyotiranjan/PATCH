import "server-only";

import { MongoClient, type Db } from "mongodb";

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
