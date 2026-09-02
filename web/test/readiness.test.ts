// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/readiness/route";

describe("GET /api/readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns only the Web availability state and logs safe service names", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await GET();
    const body = await response.json();
    const loggedOutput = consoleError.mock.calls.flat().join(" ");

    expect(response.status).toBe(503);
    expect(body).toEqual({ service: "patch-web", status: "unavailable" });
    expect(loggedOutput).toContain("unavailableServices");
    expect(loggedOutput).toContain("mongodb");
    expect(loggedOutput).not.toContain("MONGODB_URI");
  });
});
