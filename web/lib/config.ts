import "server-only";

import { z } from "zod";

const serverConfigSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1),
  AI_SERVICE_BASE_URL: z.string().url(),
  AI_SERVICE_SHARED_SECRET: z.string().min(1),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function getServerConfig(): ServerConfig {
  return serverConfigSchema.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    AI_SERVICE_BASE_URL: process.env.AI_SERVICE_BASE_URL,
    AI_SERVICE_SHARED_SECRET: process.env.AI_SERVICE_SHARED_SECRET,
  });
}
