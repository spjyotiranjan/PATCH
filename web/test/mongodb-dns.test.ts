// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setServers: vi.fn(),
  client: vi.fn(function () {}),
}));
vi.mock("node:dns/promises", () => ({
  getServers: () => ["127.0.0.1"],
  setServers: mocks.setServers,
}));
vi.mock("mongodb", () => ({ MongoClient: mocks.client }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("MongoDB DNS configuration", () => {
  it("preserves system DNS when no override is configured", async () => {
    const { getMongoClient } = await import("../lib/database/mongodb");
    getMongoClient({ MONGODB_URI: "mongodb+srv://fixture.invalid/" });
    expect(mocks.setServers).not.toHaveBeenCalled();
  });
  it("sets configured DNS once before creating a cached client without altering the URI", async () => {
    const { getMongoClient } = await import("../lib/database/mongodb");
    const config = {
      MONGODB_URI: "mongodb+srv://fixture.invalid/",
      MONGODB_DNS_SERVERS: ["1.1.1.1"],
      MONGODB_ADDRESS_FAMILY: 4 as const,
    };
    expect(getMongoClient(config)).toBe(getMongoClient(config));
    expect(mocks.setServers).toHaveBeenCalledExactlyOnceWith(["1.1.1.1"]);
    expect(mocks.client).toHaveBeenCalledExactlyOnceWith(
      config.MONGODB_URI,
      expect.objectContaining({ serverSelectionTimeoutMS: 5000, family: 4 }),
    );
    expect(mocks.setServers.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.client.mock.invocationCallOrder[0],
    );
  });
});
