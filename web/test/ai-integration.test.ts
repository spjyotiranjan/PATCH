// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAiServiceClient, getAiReadiness } from "../lib/ai/client";
import { askAiSocket } from "../lib/ai/socket";
import type { ServerConfig } from "../lib/config";
import type { Schema } from "../lib/backend/models";

const config = {
  AI_SERVICE_SHARED_SECRET: "loopback-contract-fixture-secret-not-for-real-use",
  AI_SERVICE_BASE_URL: "",
  AI_SERVICE_TIMEOUT_MS: 5000,
  AI_SERVICE_RETRY_COUNT: 0,
} as ServerConfig;
let child: ChildProcess;
function question(): Schema["QuestionRequest"] {
  return {
    requestId: randomUUID(),
    contractVersion: "v1",
    actor: { id: "test", tenantId: "fixture" },
    chatSession: { id: "chat-test", recentTurns: [] },
    question: "What evidence exists?",
    assignedReferences: [],
    retrievalScopeManifest: {
      allowedDocumentVersions: [],
      entities: [],
      relationships: [],
    },
    retrievalPolicy: {
      approvedOnly: true,
      requireSourceLocation: true,
      allowStructuralFallback: true,
    },
  };
}

describe("real loopback Web-to-FastAPI REST and WebSocket transport (no providers)", () => {
  beforeAll(async () => {
    const root = resolve("../ai");
    const python =
      process.platform === "win32"
        ? resolve(root, ".venv/Scripts/python.exe")
        : resolve(root, ".venv/bin/python");
    child = spawn(python, ["tests/transport_server.py"], {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, PYTHONPATH: resolve(root, "src") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const port = await new Promise<number>((resolvePort, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error("AI fixture did not start. Run uv sync --dev in ai."),
          ),
        20000,
      );
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("AI fixture exited before startup"));
      });
      child.stdout!.on("data", (chunk: Buffer) => {
        const match = chunk.toString().match(/PATCH_TEST_PORT=(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolvePort(Number(match[1]));
        }
      });
    });
    config.AI_SERVICE_BASE_URL = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${config.AI_SERVICE_BASE_URL}/health`)).ok) return;
      } catch {
        /* Starting. */
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error("AI fixture health did not become available");
  }, 30000);
  afterAll(() => {
    child?.kill();
  });

  it("authenticates readiness without revealing dependencies", async () => {
    expect(await getAiReadiness(config)).toEqual({
      service: "patch-ai",
      status: "unavailable",
    });
    expect(
      (await fetch(`${config.AI_SERVICE_BASE_URL}/readiness`)).status,
    ).toBe(401);
  });
  it("uses generated REST contract and rejects replay", async () => {
    const body = question();
    const client = createAiServiceClient(config);
    const first = await client.POST("/v1/questions", { body });
    expect(first.data).toMatchObject({
      requestId: body.requestId,
      status: "incomplete",
      citations: [],
    });
    expect((await client.POST("/v1/questions", { body })).response.status).toBe(
      409,
    );
  });
  it("completes a signed Web-to-AI WebSocket turn", async () => {
    const body = question();
    const result = await askAiSocket(config, body);
    expect(result).toMatchObject({
      requestId: body.requestId,
      status: "incomplete",
      answer: { steps: [] },
      citations: [],
    });
    await expect(askAiSocket(config, body)).rejects.toThrow("AI_UNAVAILABLE");
  });
  it("rejects wrong-secret and pre-aborted socket calls safely", async () => {
    await expect(
      askAiSocket(
        { ...config, AI_SERVICE_SHARED_SECRET: "invalid" },
        question(),
      ),
    ).rejects.toThrow("AI_UNAVAILABLE");
    await expect(
      askAiSocket(config, question(), AbortSignal.abort()),
    ).rejects.toThrow("AI_UNAVAILABLE");
  });
});
