import "server-only";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { z } from "zod";

import type { AuthenticatedActor } from "@/lib/auth/authorization";
import {
  AuthenticationRequiredError,
  requireAuthenticatedActor,
} from "@/lib/auth/session";
import { logEvent } from "@/lib/observability/logger";

const REQUEST_ID_HEADER = "x-request-id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export interface ApiRequestContext {
  actor: AuthenticatedActor | null;
  requestId: string;
}

type ApiRouteHandler = (
  request: Request,
  context: ApiRequestContext,
) => Promise<Response>;

function requestIdFor(request: Request): string {
  const supplied = request.headers.get(REQUEST_ID_HEADER);
  return supplied && UUID_PATTERN.test(supplied) ? supplied : randomUUID();
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
): NextResponse {
  return NextResponse.json(
    { error: { code }, requestId },
    { status, headers: { [REQUEST_ID_HEADER]: requestId } },
  );
}

function createApiRoute(
  authenticated: boolean,
  handler: ApiRouteHandler,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = requestIdFor(request);
    const startedAt = performance.now();
    const pathname = new URL(request.url).pathname;

    try {
      const actor = authenticated ? await requireAuthenticatedActor() : null;
      const response = await handler(request, { actor, requestId });
      response.headers.set(REQUEST_ID_HEADER, requestId);
      logEvent("info", "patch_web.api.completed", {
        requestId,
        method: request.method,
        pathname,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return response;
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return errorResponse(401, "AUTHENTICATION_REQUIRED", requestId);
      }
      if (error instanceof ApiError) {
        return errorResponse(error.status, error.code, requestId);
      }

      logEvent("error", "patch_web.api.failed", {
        requestId,
        method: request.method,
        pathname,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return errorResponse(500, "INTERNAL_ERROR", requestId);
    }
  };
}

export function authenticatedApiRoute(handler: ApiRouteHandler) {
  return createApiRoute(true, handler);
}

export function publicApiRoute(handler: ApiRouteHandler) {
  return createApiRoute(false, handler);
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return schema.parse(await request.json());
  } catch {
    throw new ApiError(400, "INVALID_REQUEST");
  }
}
