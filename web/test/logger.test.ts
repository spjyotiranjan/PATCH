// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { logEvent } from "../lib/observability/logger";

describe("structured logging", () => {
  it("removes sensitive fields from log context", () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    logEvent("info", "test.event", {
      requestId: "request-1",
      password: "not-for-logs",
      authorization: "not-for-logs",
    });

    const output = consoleInfo.mock.calls.flat().join(" ");
    expect(output).toContain("request-1");
    expect(output).not.toContain("not-for-logs");
    expect(output).not.toContain("password");
    expect(output).not.toContain("authorization");
  });
});
