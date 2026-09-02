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
        secret: clientConfig.AI_SERVICE_SHARED_SECRET,
        method: "post",
        pathname: "/v1/questions",
        body: '{"question":"status"}',
        requestId: "request-1",
        timestamp: 1_700_000_000,
      }),
    ).toMatchObject({
      requestId: "request-1",
      timestamp: 1_700_000_000,
      signature: expect.stringMatching(/^v1=[a-f0-9]{64}$/),
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
            missingConfiguration: [],
          }),
        );
      },
    );
    const fetchImplementation = mockFetch as unknown as typeof fetch;
    const authenticatedFetch = createAuthenticatedAiFetch(
      clientConfig,
      fetchImplementation,
    );

    await authenticatedFetch("http://localhost:8000/health");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
