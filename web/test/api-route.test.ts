// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { publicApiRoute } from "../lib/api/route";
import { DomainError } from "../lib/domain/errors";

describe("API route conventions", () => {
  it("accepts a valid correlation ID and returns it on the response", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const requestId = "018f7f4a-2cab-7c42-8a5f-73130a9c2001";
    const route = publicApiRoute(async (_request, context) =>
      Response.json({ requestId: context.requestId }),
    );

    const response = await route(
      new Request("http://localhost/api/example", {
        headers: { "x-request-id": requestId },
      }),
    );

    expect(response.headers.get("x-request-id")).toBe(requestId);
    await expect(response.json()).resolves.toEqual({ requestId });
  });

  it("maps unexpected failures to a non-sensitive error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const route = publicApiRoute(async () => {
      throw new Error("database connection string must not be returned");
    });

    const response = await route(new Request("http://localhost/api/example"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual({ code: "INTERNAL_ERROR" });
    expect(JSON.stringify(body)).not.toContain("database connection string");
  });

  it("resolves dynamic route parameters for wrapped handlers", async () => {
    const route = publicApiRoute<{ equipmentId: string }>(
      async (_request, { params }) => Response.json(params),
    );

    const response = await route(
      new Request("http://localhost/api/equipments/equipment-1"),
      { params: Promise.resolve({ equipmentId: "equipment-1" }) },
    );

    await expect(response.json()).resolves.toEqual({
      equipmentId: "equipment-1",
    });
  });

  it("maps domain authorization failures to stable errors", async () => {
    const route = publicApiRoute(async () => {
      throw new DomainError(403, "EQUIPMENT_OWNER_REQUIRED");
    });

    const response = await route(new Request("http://localhost/api/example"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "EQUIPMENT_OWNER_REQUIRED" },
    });
  });
});
