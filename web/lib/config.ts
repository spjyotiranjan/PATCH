import "server-only";
import { isIP } from "node:net";

import { z } from "zod";

const nonPlaceholderSecret = z
  .string()
  .trim()
  .min(32)
  .refine(
    (value) => !value.startsWith("replace-with-"),
    "must not use the example placeholder",
  );

const requiredText = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !value.startsWith("replace-with-"),
    "must not use the example placeholder",
  );

const optionalUrl = z.union([z.literal(""), z.string().url()]).default("");

export const serverConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  AUTH_SECRET: nonPlaceholderSecret,
  AUTH_URL: z.string().url(),
  AUTH_TRUST_HOST: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MONGODB_URI: z
    .string()
    .trim()
    .startsWith(
      "mongodb+srv://",
      "must be a hosted MongoDB SRV connection string",
    )
    .refine(
      (value) => !value.includes("replace-with-"),
      "must not use the example placeholder",
    ),
  MONGODB_DB_NAME: requiredText,
  MONGODB_ADDRESS_FAMILY: z.coerce
    .number()
    .refine(
      (value) => value === 0 || value === 4 || value === 6,
      "must be automatic, IPv4 or IPv6",
    )
    .default(0),
  MONGODB_DNS_SERVERS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean),
    )
    .refine(
      (servers) =>
        servers.length <= 3 && servers.every((server) => isIP(server) !== 0),
      "must contain at most three DNS server IP addresses",
    ),
  AI_SERVICE_BASE_URL: z.string().url(),
  AI_SERVICE_SHARED_SECRET: nonPlaceholderSecret,
  AI_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(120_000)
    .default(120_000),
  AI_SERVICE_RETRY_COUNT: z.coerce.number().int().min(0).max(3).default(1),
  BACKEND_WORKER_SECRET: z.string().default(""),
  API_RATE_LIMIT_REQUESTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(120),
  API_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3600)
    .default(60),
  R2_ACCOUNT_ID: requiredText,
  R2_ACCESS_KEY_ID: requiredText,
  R2_SECRET_ACCESS_KEY: nonPlaceholderSecret,
  R2_BUCKET_NAME: requiredText,
  R2_ENDPOINT: z.string().url(),
  R2_REGION: requiredText,
  R2_DOCUMENT_KEY_PREFIX: requiredText,
  R2_PRESIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(3_600)
    .default(900),
  MAX_DOCUMENT_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(1_073_741_824)
    .default(52_428_800),
  ALLOWED_DOCUMENT_MIME_TYPES: requiredText.transform((value) =>
    value
      .split(",")
      .map((mimeType) => mimeType.trim())
      .filter(Boolean),
  ),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: requiredText.default("development"),
  OTEL_SERVICE_NAME: requiredText.default("patch-web"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type ServerEnvironment = Record<string, string | undefined>;

export type ConfigValidation =
  | { success: true; config: ServerConfig; missingConfiguration: [] }
  | {
      success: false;
      config: null;
      missingConfiguration: string[];
      issues: string[];
    };

function isMissingOrPlaceholder(value: string | undefined): boolean {
  return !value || value.trim().length === 0 || value.includes("replace-with-");
}

export function validateServerConfig(
  environment: ServerEnvironment = process.env,
): ConfigValidation {
  const parsed = serverConfigSchema.safeParse(environment);

  if (parsed.success) {
    return { success: true, config: parsed.data, missingConfiguration: [] };
  }

  const invalidKeys = new Set(
    parsed.error.issues.map((issue) => String(issue.path[0])),
  );
  const missingConfiguration = [...invalidKeys]
    .filter((key) => isMissingOrPlaceholder(environment[key]))
    .sort();

  return {
    success: false,
    config: null,
    missingConfiguration,
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  };
}

export function getServerConfig(
  environment: ServerEnvironment = process.env,
): ServerConfig {
  const validation = validateServerConfig(environment);

  if (!validation.success) {
    if (process.env.NODE_ENV !== "production") {
      return {
        NODE_ENV: "development",
        AUTH_SECRET: environment.AUTH_SECRET || "patch-development-secret-key-32chars-min-length",
        AUTH_URL: environment.AUTH_URL || "http://localhost:3000",
        AUTH_TRUST_HOST: true,
        MONGODB_URI: "mongodb+srv://mock-db.local/",
        MONGODB_DB_NAME: "patch",
        MONGODB_ADDRESS_FAMILY: 0,
        MONGODB_DNS_SERVERS: [],
        AI_SERVICE_BASE_URL: environment.AI_SERVICE_BASE_URL || "http://localhost:8000",
        AI_SERVICE_SHARED_SECRET: environment.AI_SERVICE_SHARED_SECRET || "patch-development-secret-key-32chars-min-length",
        AI_SERVICE_TIMEOUT_MS: 120000,
        AI_SERVICE_RETRY_COUNT: 1,
        BACKEND_WORKER_SECRET: "",
        API_RATE_LIMIT_REQUESTS: 120,
        API_RATE_LIMIT_WINDOW_SECONDS: 60,
        R2_ACCOUNT_ID: "mock-r2-account",
        R2_ACCESS_KEY_ID: "mock-r2-access-key",
        R2_SECRET_ACCESS_KEY: "mock-r2-secret-key-32chars-min-length",
        R2_BUCKET_NAME: "patch-documents-development",
        R2_ENDPOINT: "https://mock-account.r2.cloudflarestorage.com",
        R2_REGION: "auto",
        R2_DOCUMENT_KEY_PREFIX: "documents",
        R2_PRESIGNED_URL_TTL_SECONDS: 900,
        MAX_DOCUMENT_UPLOAD_BYTES: 52428800,
        ALLOWED_DOCUMENT_MIME_TYPES: ["application/pdf", "text/plain"],
        LOG_LEVEL: "INFO",
        SENTRY_DSN: "",
        SENTRY_ENVIRONMENT: "development",
        OTEL_SERVICE_NAME: "patch-web",
        OTEL_EXPORTER_OTLP_ENDPOINT: "",
      };
    }
    throw new Error("Web server configuration is invalid.");
  }

  return validation.config;
}

const serviceConfiguration = {
  authentication: ["AUTH_SECRET", "AUTH_URL"],
  mongodb: ["MONGODB_URI", "MONGODB_DB_NAME"],
  r2: [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_ENDPOINT",
    "R2_REGION",
  ],
  ai: ["AI_SERVICE_BASE_URL", "AI_SERVICE_SHARED_SECRET"],
} as const;

/** Returns service names only, never environment-variable names or values. */
export function getUnconfiguredServices(
  environment: ServerEnvironment = process.env,
): string[] {
  if (validateServerConfig(environment).success) {
    return [];
  }

  const services = Object.entries(serviceConfiguration)
    .filter(([, keys]) =>
      keys.some((key) => isMissingOrPlaceholder(environment[key])),
    )
    .map(([service]) => service);

  return services.length > 0 ? services : ["web-configuration"];
}
