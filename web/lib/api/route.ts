import "server-only";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { z } from "zod";

import type { AuthenticatedActor } from "@/lib/auth/authorization";
import {
  AuthenticationRequiredError,
  requireAuthenticatedActor,
} from "@/lib/auth/session";
import { DomainError } from "@/lib/domain/errors";
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

export interface ApiRouteContext<
  Params extends Record<string, string> = Record<string, never>,
> extends ApiRequestContext {
  params: Params;
}

interface NextRouteContext<Params extends Record<string, string>> {
  params: Promise<Params>;
}

type ApiRouteHandler<Params extends Record<string, string>> = (
  request: Request,
  context: ApiRouteContext<Params>,
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

function createApiRoute<Params extends Record<string, string>>(
  authenticated: boolean,
  handler: ApiRouteHandler<Params>,
): (
  request: Request,
  routeContext?: NextRouteContext<Params>,
) => Promise<Response> {
  return async (request, routeContext) => {
    const requestId = requestIdFor(request);
    const startedAt = performance.now();
    const pathname = new URL(request.url).pathname;

    try {
      const actor = authenticated ? await requireAuthenticatedActor() : null;
      const params = routeContext ? await routeContext.params : ({} as Params);
      const response = await handler(request, { actor, requestId, params });
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
      if (error instanceof DomainError) {
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

export function authenticatedApiRoute<
  Params extends Record<string, string> = Record<string, never>,
>(handler: ApiRouteHandler<Params>) {
  return createApiRoute(true, handler);
}

export function publicApiRoute<
  Params extends Record<string, string> = Record<string, never>,
>(handler: ApiRouteHandler<Params>) {
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
