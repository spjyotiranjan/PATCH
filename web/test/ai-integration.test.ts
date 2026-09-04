// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createAiServiceClient, getAiReadiness } from "../lib/ai/client";

const integrationEnabled = process.env.PATCH_AI_INTEGRATION === "1";

const aiConfig = {
  AI_SERVICE_BASE_URL:
    process.env.AI_SERVICE_BASE_URL ?? "http://127.0.0.1:8000",
  AI_SERVICE_SHARED_SECRET:
    process.env.AI_SERVICE_SHARED_SECRET ??
    "phase-one-test-service-secret-that-is-long-enough",
  AI_SERVICE_TIMEOUT_MS: 5_000,
  AI_SERVICE_RETRY_COUNT: 0,
} as const;

describe.skipIf(!integrationEnabled)("live Web-to-AI contract", () => {
  it("authenticates and receives aggregate readiness", async () => {
    const readiness = await getAiReadiness(aiConfig);

    expect(readiness).toEqual({ service: "patch-ai", status: "ready" });
  });

  it("sends the generated Phase 2 profile contract through signed transport", async () => {
    const response = await createAiServiceClient(aiConfig).POST(
      "/v1/entity-profiles/upsert",
      {
        body: {
          contractVersion: "v1",
          requestId: "c5a876a0-cd09-4a2d-846d-cc6b75df7f2d",
          tenantId: "tenant-integration",
          inputFingerprint: "a".repeat(64),
          entity: {
            id: "equipment-integration",
            type: "EQUIPMENT",
            profileVersion: 1,
            userDescription: "Air compressor used by the integration test.",
            activeDocuments: [],
            includedEquipmentProfiles: [],
          },
        },
      },
    );

    expect(response.error).toBeUndefined();
    expect(response.data?.status).toBe("upserted");
    expect(response.data?.provenance).toMatchObject({
      tenantId: "tenant-integration",
      inputFingerprint: "a".repeat(64),
    });
  });
});
