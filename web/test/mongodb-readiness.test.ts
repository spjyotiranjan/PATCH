// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ ping: vi.fn(), log: vi.fn() }));
vi.mock("mongodb", () => ({
  MongoClient: class {
    db() {
      return { command: mocks.ping };
    }
  },
}));
vi.mock("@/lib/observability/logger", () => ({ logEvent: mocks.log }));
import {
  checkMongoReadiness,
  mongoFailureCategory,
} from "@/lib/database/mongodb";
beforeEach(() => vi.clearAllMocks());
describe("safe MongoDB readiness diagnostics", () => {
  it.each([
    [{ code: "ETIMEOUT", message: "private cluster" }, "DNS_LOOKUP_TIMEOUT"],
    [{ code: "ENOTFOUND" }, "DNS_LOOKUP_FAILED"],
    [{ code: "ECONNREFUSED", syscall: "querySrv" }, "DNS_LOOKUP_REFUSED"],
    [{ code: 18 }, "AUTHENTICATION_FAILED"],
    [{ code: 13 }, "AUTHORIZATION_FAILED"],
    [{ cause: { code: "CERT_HAS_EXPIRED" } }, "TLS_VERIFICATION_FAILED"],
    [{ code: "EPERM" }, "NETWORK_ACCESS_DENIED"],
    [new Error("private unexpected error"), "CONNECTION_FAILED"],
  ])(
    "classifies known failures without copying private details",
    (error, category) => {
      expect(mongoFailureCategory(error)).toBe(category);
    },
  );
  it("inspects bounded nested topology errors without logging addresses", () => {
    expect(
      mongoFailureCategory({
        reason: {
          servers: new Map([
            ["private.example", { error: { cause: { code: "EACCES" } } }],
          ]),
        },
      }),
    ).toBe("NETWORK_ACCESS_DENIED");
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(mongoFailureCategory(cyclic)).toBe("CONNECTION_FAILED");
  });
  it("keeps readiness aggregate-only and logs only a fixed failure category", async () => {
    mocks.ping.mockRejectedValue({
      code: "ETIMEOUT",
      message: "mongodb+srv://private-user:private-password@private-cluster",
    });
    expect(
      await checkMongoReadiness({
        MONGODB_URI: "mongodb://fixture",
        MONGODB_DB_NAME: "fixture",
      }),
    ).toEqual({ status: "unavailable" });
    expect(mocks.log).toHaveBeenCalledExactlyOnceWith(
      "error",
      "patch_web.database.unavailable",
      { service: "mongodb", reason: "DNS_LOOKUP_TIMEOUT" },
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toMatch(
      /private|MONGODB|mongodb:\/\//,
    );
  });
  it("reports ready only after an actual successful ping", async () => {
    mocks.ping.mockResolvedValue({ ok: 1 });
    expect(
      await checkMongoReadiness({
        MONGODB_URI: "mongodb://fixture",
        MONGODB_DB_NAME: "fixture",
      }),
    ).toEqual({ status: "ready" });
    expect(mocks.ping).toHaveBeenCalledWith({ ping: 1 });
    expect(mocks.log).not.toHaveBeenCalled();
  });
});
