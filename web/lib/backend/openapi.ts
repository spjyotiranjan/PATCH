import "server-only";
import { z } from "zod";
import { signUpSchema, settingsUpdateSchema } from "@/lib/auth/users";
import {
  equipmentCreateSchema,
  equipmentUpdateSchema,
} from "@/lib/domain/equipments";
import {
  projectCreateSchema,
  projectUpdateSchema,
} from "@/lib/domain/projects";
import { endpoints } from "./router";

export function backendOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  const definitions: {
    method: string;
    path: string;
    summary: string;
    schema?: z.ZodType;
  }[] = [
    ...endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      summary: e.summary,
      schema: e.schema,
    })),
    {
      method: "POST",
      path: "/api/auth/signup",
      summary: "Register email/password account",
      schema: signUpSchema,
    },
    {
      method: "GET",
      path: "/api/auth/csrf",
      summary: "Get Auth.js CSRF token and cookie",
    },
    {
      method: "GET",
      path: "/api/auth/session",
      summary: "Inspect current Auth.js session",
    },
    {
      method: "GET",
      path: "/api/settings",
      summary: "Read profile preferences",
    },
    {
      method: "PATCH",
      path: "/api/settings",
      summary: "Update profile preferences",
      schema: settingsUpdateSchema,
    },
    { method: "GET", path: "/api/health", summary: "Public liveness" },
    {
      method: "GET",
      path: "/api/readiness",
      summary: "Aggregate availability only",
    },
  ];
  for (const [resource, create, update] of [
    ["equipments", equipmentCreateSchema, equipmentUpdateSchema],
    ["projects", projectCreateSchema, projectUpdateSchema],
  ] as const) {
    definitions.push(
      { method: "GET", path: `/api/${resource}`, summary: `List ${resource}` },
      {
        method: "POST",
        path: `/api/${resource}`,
        summary: `Create ${resource}`,
        schema: create,
      },
      {
        method: "GET",
        path: `/api/${resource}/discover`,
        summary: "Discover request-safe identities",
      },
      {
        method: "GET",
        path: `/api/${resource}/{id}`,
        summary: `Read ${resource}`,
      },
      {
        method: "PATCH",
        path: `/api/${resource}/{id}`,
        summary: `Update ${resource}`,
        schema: update,
      },
      {
        method: "DELETE",
        path: `/api/${resource}/{id}`,
        summary: `Delete unused ${resource}`,
      },
    );
    const requests =
      resource === "projects" ? "membership-requests" : "access-requests";
    definitions.push(
      {
        method: "GET",
        path: `/api/${resource}/{id}/${requests}`,
        summary: "Owner list access requests",
      },
      {
        method: "POST",
        path: `/api/${resource}/{id}/${requests}`,
        summary: "Request access",
        schema: z.object({}).strict(),
      },
      {
        method: "POST",
        path: `/api/${resource}/{id}/${requests}/{requestId}/decision`,
        summary: "Owner approve or reject access",
        schema: z.object({ decision: z.enum(["APPROVE", "REJECT"]) }).strict(),
      },
    );
  }
  for (const endpoint of definitions) {
    const publicRoute =
      endpoint.path.startsWith("/api/auth/") ||
      ["/api/health", "/api/readiness"].includes(endpoint.path);
    const operation = {
      summary: endpoint.summary,
      operationId: `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
      tags: [endpoint.path.split("/")[2]],
      security: publicRoute ? [] : [{ sessionCookie: [] }],
      parameters: [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
        name: m[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      })),
      ...(endpoint.schema
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: z.toJSONSchema(endpoint.schema, {
                    unrepresentable: "any",
                    io: "input",
                  }),
                },
              },
            },
          }
        : {}),
      responses: {
        "200": {
          description:
            "Success; see endpoint workflow in Backend_Manual_Testing.md",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "400": { description: "Invalid request" },
        "401": { description: "Authentication required" },
        "403": { description: "Scope, role or origin rejected" },
        "409": { description: "State, revision or idempotency conflict" },
        "429": { description: "Rate limited" },
        "503": { description: "Safe unavailable state" },
      },
    };
    paths[endpoint.path] ??= {};
    paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
  }
  paths["/api/auth/callback/credentials"] = {
    post: {
      summary:
        "Email/password sign-in using CSRF token from GET /api/auth/csrf",
      tags: ["auth"],
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/x-www-form-urlencoded": {
            schema: {
              type: "object",
              required: ["csrfToken", "email", "password", "json"],
              properties: {
                csrfToken: { type: "string" },
                email: { type: "string", format: "email" },
                password: { type: "string", format: "password" },
                json: { type: "string", default: "true" },
                callbackUrl: { type: "string", default: "/api/docs" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description:
            "Session cookie set on success; inspect GET /api/auth/session",
        },
      },
    },
  };
  paths["/api/internal/jobs/run"] = {
    post: {
      summary:
        "Protected operator worker: inspect, dispatch, schedule, repair or retry",
      tags: ["operations"],
      security: [{ workerBearer: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["inspect", "dispatch", "schedule", "repair", "retry"],
                  default: "inspect",
                },
                limit: { type: "integer", minimum: 1, maximum: 25, default: 1 },
                jobId: { type: "string" },
                reason: { type: "string", minLength: 10, maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Safe job state/counts or execution outcomes" },
        "401": { description: "Worker authentication required" },
        "409": { description: "Retry requires a dead-letter job" },
      },
    },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "P.A.T.C.H. Web Backend",
      version: "1.0.0",
      description:
        "Backend REST testing without application UI. Cookies are HttpOnly: obtain CSRF then sign in using credentials; do not paste production cookies into tools. WebSocket /ws/chat is documented separately in Backend_Manual_Testing.md.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        workerBearer: {
          type: "http",
          scheme: "bearer",
          description:
            "Separate private worker credential. Never a browser user session.",
        },
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "next-auth.session-token",
          description:
            "Auth.js session; production uses __Secure-next-auth.session-token. Swagger same-origin requests send the cookie automatically.",
        },
      },
    },
    paths,
  };
}
