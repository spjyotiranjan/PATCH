// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ register: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/users")>()),
  registerUser: mocks.register,
}));
vi.mock("@/lib/audit/events", () => ({ persistAuditEvent: mocks.audit }));
vi.mock("@/lib/config", () => ({
  getServerConfig: () => ({ AUTH_URL: "http://localhost:3000" }),
}));
vi.mock("@/lib/backend/security", () => ({
  checkOrigin: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/observability/logger", () => ({ logEvent: vi.fn() }));
import { POST } from "@/app/api/auth/signup/route";
const request = () =>
  new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      name: "Test Owner",
      email: "owner@example.test",
      password: "strong-test-password",
      confirmPassword: "strong-test-password",
    }),
  });
beforeEach(() => {
  mocks.register.mockReset();
  mocks.audit.mockReset();
});
describe("registration never falls back to simulated success", () => {
  it("returns failure when persistence is unavailable", async () => {
    mocks.register.mockRejectedValue(new Error("private database detail"));
    const result = await POST(request());
    expect(result.status).toBe(500);
    expect(await result.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("does not return 201 when the required audit write fails", async () => {
    mocks.register.mockResolvedValue({ id: "owner", tenantId: "test" });
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    const result = await POST(request());
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toMatch(
      /owner|private|audit unavailable/,
    );
  });
});
