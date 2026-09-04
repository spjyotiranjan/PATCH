import "server-only";

import createClient from "openapi-fetch";

import type { ServerConfig } from "@/lib/config";

import type { AiReadinessResponse, paths } from "./contracts";
import {
  AI_CONTRACT_VERSION,
  AI_CONTRACT_VERSION_HEADER,
  AI_REQUEST_ID_HEADER,
  AI_SIGNATURE_HEADER,
  AI_TIMESTAMP_HEADER,
  createAiRequestSignature,
} from "./signing";

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

export type FetchImplementation = typeof fetch;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function contractRequestId(body: string): string | undefined {
  if (!body) {
    return undefined;
  }
  try {
    const payload: unknown = JSON.parse(body);
    if (
      typeof payload === "object" &&
      payload !== null &&
      "requestId" in payload &&
      typeof payload.requestId === "string" &&
      UUID_PATTERN.test(payload.requestId)
    ) {
      return payload.requestId;
    }
  } catch {
    // Non-JSON payloads still receive an independently generated request ID.
  }
  return undefined;
}

export function createAuthenticatedAiFetch(
  config: Pick<
    ServerConfig,
    | "AI_SERVICE_SHARED_SECRET"
    | "AI_SERVICE_TIMEOUT_MS"
    | "AI_SERVICE_RETRY_COUNT"
  >,
  fetchImplementation: FetchImplementation = fetch,
): FetchImplementation {
  return async (input, init) => {
    const request = new Request(input, init);
    const body = await request.clone().text();
    const bodyRequestId = contractRequestId(body);
    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= config.AI_SERVICE_RETRY_COUNT;
      attempt += 1
    ) {
      const signature = createAiRequestSignature({
        secret: config.AI_SERVICE_SHARED_SECRET,
        method: request.method,
        pathname: new URL(request.url).pathname,
        body,
        requestId: bodyRequestId,
      });
      const headers = new Headers(request.headers);

      headers.set(AI_CONTRACT_VERSION_HEADER, AI_CONTRACT_VERSION);
      headers.set(AI_REQUEST_ID_HEADER, signature.requestId);
      headers.set(AI_TIMESTAMP_HEADER, String(signature.timestamp));
      headers.set(AI_SIGNATURE_HEADER, signature.signature);

      try {
        return await fetchImplementation(
          new Request(request, {
            headers,
            signal: AbortSignal.timeout(config.AI_SERVICE_TIMEOUT_MS),
          }),
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error && lastError.name === "TimeoutError") {
      throw new AiServiceError("AI service request timed out", lastError);
    }

    throw new AiServiceError("AI service request failed", lastError);
  };
}

export function createAiServiceClient(
  config: Pick<
    ServerConfig,
    | "AI_SERVICE_BASE_URL"
    | "AI_SERVICE_SHARED_SECRET"
    | "AI_SERVICE_TIMEOUT_MS"
    | "AI_SERVICE_RETRY_COUNT"
  >,
  fetchImplementation?: FetchImplementation,
) {
  return createClient<paths>({
    baseUrl: config.AI_SERVICE_BASE_URL,
    fetch: createAuthenticatedAiFetch(config, fetchImplementation),
  });
}

export async function getAiReadiness(
  config: Pick<
    ServerConfig,
    | "AI_SERVICE_BASE_URL"
    | "AI_SERVICE_SHARED_SECRET"
    | "AI_SERVICE_TIMEOUT_MS"
    | "AI_SERVICE_RETRY_COUNT"
  >,
  fetchImplementation?: FetchImplementation,
): Promise<AiReadinessResponse> {
  const response = await createAiServiceClient(config, fetchImplementation).GET(
    "/readiness",
  );

  if (!response.data) {
    throw new AiServiceError(
      "AI service returned an invalid readiness response",
    );
  }

  return response.data;
}
