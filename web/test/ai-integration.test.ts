// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getAiReadiness } from "../lib/ai/client";

const integrationEnabled = process.env.PATCH_AI_INTEGRATION === "1";

describe.skipIf(!integrationEnabled)("live Web-to-AI contract", () => {
  it("authenticates and receives aggregate readiness", async () => {
    const readiness = await getAiReadiness({
      AI_SERVICE_BASE_URL:
        process.env.AI_SERVICE_BASE_URL ?? "http://127.0.0.1:8000",
      AI_SERVICE_SHARED_SECRET:
        process.env.AI_SERVICE_SHARED_SECRET ??
        "phase-one-test-service-secret-that-is-long-enough",
      AI_SERVICE_TIMEOUT_MS: 5_000,
      AI_SERVICE_RETRY_COUNT: 0,
    });

    expect(readiness).toEqual({ service: "patch-ai", status: "ready" });
  });
});
