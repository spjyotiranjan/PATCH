// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("identifies the Web service without leaking configuration values", async () => {
    vi.stubEnv("MONGODB_URI", "");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "patch-web",
      status: "unavailable",
    });
    expect(JSON.stringify(body)).not.toContain(
      "a-very-long-non-placeholder-ai-service-secret",
    );
  });
});
