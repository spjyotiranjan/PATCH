// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createAuthenticatedAiFetch } from "../lib/ai/client";
import {
  AI_CONTRACT_VERSION_HEADER,
  AI_REQUEST_ID_HEADER,
  AI_SIGNATURE_HEADER,
  AI_TIMESTAMP_HEADER,
  createAiRequestSignature,
} from "../lib/ai/signing";

const clientConfig = {
  AI_SERVICE_SHARED_SECRET: "a-very-long-non-placeholder-ai-service-secret",
  AI_SERVICE_TIMEOUT_MS: 30_000,
  AI_SERVICE_RETRY_COUNT: 1,
};

describe("AI service authentication", () => {
  it("creates a deterministic signature for a canonical request", () => {
    expect(
      createAiRequestSignature({
        secret: "phase-one-test-service-secret-that-is-long-enough",
        method: "post",
        pathname: "/v1/questions",
        body: '{"question":"status"}',
        requestId: "123e4567-e89b-12d3-a456-426614174000",
        timestamp: 1_700_000_000,
      }),
    ).toEqual({
      requestId: "123e4567-e89b-12d3-a456-426614174000",
      timestamp: 1_700_000_000,
      signature:
        "v1=fee49640534c5f5e100300284061261b35fec5c9aeaab6ed78c7919df6ed4b1d",
    });
  });

  it("adds contract, correlation, timestamp, and signature headers", async () => {
    const mockFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        expect(request.headers.get(AI_CONTRACT_VERSION_HEADER)).toBe("v1");
        expect(request.headers.get(AI_REQUEST_ID_HEADER)).toMatch(
          /^[0-9a-f-]{36}$/,
        );
        expect(request.headers.get(AI_TIMESTAMP_HEADER)).toMatch(/^\d+$/);
        expect(request.headers.get(AI_SIGNATURE_HEADER)).toMatch(
          /^v1=[a-f0-9]{64}$/,
        );
        return new Response(
          JSON.stringify({
            service: "patch-ai",
            status: "ready",
          }),
        );
      },
    );
    const fetchImplementation = mockFetch as unknown as typeof fetch;
    const authenticatedFetch = createAuthenticatedAiFetch(
      clientConfig,
      fetchImplementation,
    );

    await authenticatedFetch("http://localhost:8000/readiness");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("signs a typed request with the requestId from its JSON body", async () => {
    const requestId = "c5a876a0-cd09-4a2d-846d-cc6b75df7f2d";
    const mockFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        expect(request.headers.get(AI_REQUEST_ID_HEADER)).toBe(requestId);
        return new Response(JSON.stringify({ status: "upserted" }));
      },
    );
    const authenticatedFetch = createAuthenticatedAiFetch(
      clientConfig,
      mockFetch as unknown as typeof fetch,
    );

    await authenticatedFetch(
      "http://localhost:8000/v1/entity-profiles/upsert",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
