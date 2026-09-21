// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const probes = vi.hoisted(() => ({ mongo: vi.fn(), r2: vi.fn(), ai: vi.fn() }));
vi.mock("../lib/config", () => ({
  validateServerConfig: () => ({
    success: true,
    config: { AI_SERVICE_TIMEOUT_MS: 120000 },
  }),
  getUnconfiguredServices: () => [],
}));
vi.mock("../lib/database/mongodb", () => ({
  checkMongoReadiness: probes.mongo,
}));
vi.mock("../lib/storage/r2", () => ({ checkR2Readiness: probes.r2 }));
vi.mock("../lib/ai/client", () => ({ getAiReadiness: probes.ai }));
vi.mock("../lib/observability/logger", () => ({ logEvent: vi.fn() }));
import { getReadinessReport } from "../lib/readiness";
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("bounds unresolved DNS, shares pending probes, and recovers after settlement", async () => {
  vi.useFakeTimers();
  let release!: (value: { status: "ready" }) => void;
  probes.mongo.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  probes.r2.mockResolvedValue({ status: "ready" });
  probes.ai.mockResolvedValue({ status: "ready" });
  const first = getReadinessReport();
  const second = getReadinessReport();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await first).toEqual({ service: "patch-web", status: "unavailable" });
  expect(await second).toEqual({ service: "patch-web", status: "unavailable" });
  expect(probes.mongo).toHaveBeenCalledTimes(1);
  expect(probes.ai).toHaveBeenCalledWith(
    expect.objectContaining({
      AI_SERVICE_TIMEOUT_MS: 5000,
      AI_SERVICE_RETRY_COUNT: 0,
    }),
  );
  const third = getReadinessReport();
  await vi.advanceTimersByTimeAsync(5000);
  expect((await third).status).toBe("unavailable");
  expect(probes.mongo).toHaveBeenCalledTimes(1);
  release({ status: "ready" });
  await vi.advanceTimersByTimeAsync(0);
  probes.mongo.mockResolvedValue({ status: "ready" });
  expect(await getReadinessReport()).toEqual({
    service: "patch-web",
    status: "ready",
  });
  expect(vi.getTimerCount()).toBe(0);
});

it("returns aggregate unavailable for rejected dependency calls without leaking errors", async () => {
  probes.mongo.mockRejectedValue(new Error("private diagnostic"));
  probes.r2.mockResolvedValue({ status: "ready" });
  probes.ai.mockResolvedValue({ status: "unavailable" });
  expect(await getReadinessReport()).toEqual({
    service: "patch-web",
    status: "unavailable",
  });
});
