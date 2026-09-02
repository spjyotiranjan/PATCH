// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  getUnconfiguredServices,
  validateServerConfig,
  type ServerEnvironment,
} from "../lib/config";

const validEnvironment: ServerEnvironment = {
  NODE_ENV: "test",
  AUTH_SECRET: "a-very-long-non-placeholder-authentication-secret",
  AUTH_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB_NAME: "patch_test",
  AI_SERVICE_BASE_URL: "http://localhost:8000",
  AI_SERVICE_SHARED_SECRET: "a-very-long-non-placeholder-ai-service-secret",
  AI_SERVICE_TIMEOUT_MS: "30000",
  AI_SERVICE_RETRY_COUNT: "1",
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key-id",
  R2_SECRET_ACCESS_KEY: "a-very-long-non-placeholder-r2-secret-key",
  R2_BUCKET_NAME: "patch-documents-test",
  R2_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
  R2_REGION: "auto",
  R2_DOCUMENT_KEY_PREFIX: "documents",
  R2_PRESIGNED_URL_TTL_SECONDS: "900",
  MAX_DOCUMENT_UPLOAD_BYTES: "52428800",
  ALLOWED_DOCUMENT_MIME_TYPES: "application/pdf,text/plain",
  LOG_LEVEL: "INFO",
  SENTRY_DSN: "",
  SENTRY_ENVIRONMENT: "test",
  OTEL_SERVICE_NAME: "patch-web",
  OTEL_EXPORTER_OTLP_ENDPOINT: "",
};

describe("server configuration", () => {
  it("parses the declared Web environment contract", () => {
    const validation = validateServerConfig(validEnvironment);

    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.config.ALLOWED_DOCUMENT_MIME_TYPES).toEqual([
        "application/pdf",
        "text/plain",
      ]);
      expect(validation.config.AUTH_TRUST_HOST).toBe(false);
    }
  });

  it("rejects example placeholders instead of treating them as credentials", () => {
    const validation = validateServerConfig({
      ...validEnvironment,
      AI_SERVICE_SHARED_SECRET: "replace-with-a-secret",
    });

    expect(validation.success).toBe(false);
    if (!validation.success) {
      expect(validation.missingConfiguration).toContain(
        "AI_SERVICE_SHARED_SECRET",
      );
    }
  });

  it("reports only unavailable service names for incomplete configuration", () => {
    const services = getUnconfiguredServices({
      ...validEnvironment,
      AI_SERVICE_SHARED_SECRET: "",
    });

    expect(services).toContain("ai");
    expect(services.join(",")).not.toContain("AI_SERVICE_SHARED_SECRET");
  });
});
