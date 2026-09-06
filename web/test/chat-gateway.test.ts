// @vitest-environment node
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { attachChatGateway } from "../scripts/chat-gateway.mjs";

let server: Server, wss: WebSocketServer, base: string, authorized: boolean;
let bodies: unknown[];
const sessionId = "a".repeat(24);
const clients: WebSocket[] = [];
function connection(headers?: Record<string, string>) {
  const ws = new WebSocket(
    `${base.replace("http:", "ws:")}/ws/chat?sessionId=${sessionId}`,
    {
      headers: headers ?? {
        origin: base,
        cookie: "next-auth.session-token=test-fixture",
      },
    },
  );
  clients.push(ws);
  const events: Record<string, unknown>[] = [];
  ws.on("message", (raw) => events.push(JSON.parse(raw.toString())));
  return { ws, events };
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Socket event deadline exceeded");
}
describe("browser/Postman gateway over real local sockets", () => {
  beforeEach(async () => {
    authorized = true;
    bodies = [];
    server = createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (!authorized) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: { code: "PROJECT_ACCESS_REQUIRED" } }));
        return;
      }
      if (req.method === "GET") {
        res.end(JSON.stringify({ id: sessionId }));
        return;
      }
      let body = "";
      for await (const chunk of req) body += chunk.toString();
      const input = JSON.parse(body);
      bodies.push(input);
      res.end(
        JSON.stringify({
          id: "turn",
          clientTurnId: input.clientTurnId,
          state: "COMPLETED",
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    base = `http://127.0.0.1:${address.port}`;
    wss = new WebSocketServer({
      noServer: true,
      maxPayload: 32000,
      perMessageDeflate: false,
    });
    attachChatGateway(server, wss, {
      origin: base,
      apiBase: base,
      upgradeOther: (_r, s) => {
        s.destroy();
      },
    });
  });
  afterEach(async () => {
    for (const client of clients.splice(0)) client.terminate();
    for (const client of wss.clients) client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it("sends accepted/processing/completed and forwards only to the authenticated REST path", async () => {
    const { ws, events } = connection();
    await until(() => events.length === 1);
    expect(events[0].type).toBe("connection.ready");
    const input = {
      type: "turn.submit",
      clientTurnId: randomUUID(),
      question: "Test?",
      assignedReferences: [],
    };
    ws.send(JSON.stringify(input));
    await until(() => events.length === 4);
    expect(events.map((e) => e.type)).toEqual([
      "connection.ready",
      "turn.accepted",
      "turn.processing",
      "turn.completed",
    ]);
    expect(bodies).toEqual([
      {
        clientTurnId: input.clientTurnId,
        question: "Test?",
        assignedReferences: [],
      },
    ]);
  });
  it("rejects missing cookie or hostile origin before upgrading", async () => {
    for (const headers of [
      { origin: base },
      { origin: "https://evil.test", cookie: "test" },
    ] as Record<string, string>[]) {
      const { ws } = connection(headers);
      const status = await new Promise<number>((resolve) => {
        ws.on("unexpected-response", (_request, response) => {
          resolve(response.statusCode!);
          response.resume();
          ws.terminate();
        });
        ws.on("error", () => {});
      });
      expect(status).toBe(403);
    }
  });
  it("rechecks access on every turn after an accepted connection", async () => {
    const { ws, events } = connection();
    await until(() => events.length === 1);
    authorized = false;
    ws.send(
      JSON.stringify({
        type: "turn.submit",
        clientTurnId: randomUUID(),
        question: "Test?",
      }),
    );
    await until(() => events.some((e) => e.type === "turn.error"));
    expect(events.at(-1)).toMatchObject({
      type: "turn.error",
      code: "PROJECT_ACCESS_REQUIRED",
    });
    expect(bodies).toHaveLength(0);
  });
  it("closes binary frames without forwarding a turn", async () => {
    const { ws, events } = connection();
    await until(() => events.length === 1);
    const closed = new Promise<number>((resolve) =>
      ws.on("close", (code) => resolve(code)),
    );
    ws.send(Buffer.from("binary"));
    expect(await closed).toBe(1003);
    expect(bodies).toHaveLength(0);
  });
});
