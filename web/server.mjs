import http from "node:http";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { attachChatGateway } from "./scripts/chat-gateway.mjs";

const dev = process.argv.includes("--dev");
process.env.NODE_ENV ??= dev ? "development" : "production";
const localEnvironment = fileURLToPath(new URL(".env.local", import.meta.url));
if (existsSync(localEnvironment)) loadEnvFile(localEnvironment);
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.WEB_HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid Web runtime configuration");
const app = next({ dev, hostname, port });
await app.prepare();
const handler = app.getRequestHandler();
const server = http.createServer((req, res) => handler(req, res));
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 32000,
  perMessageDeflate: false,
});
attachChatGateway(server, wss, {
  origin: new URL(process.env.AUTH_URL ?? `http://localhost:${port}`).origin,
  apiBase: `http://${hostname === "0.0.0.0" ? "127.0.0.1" : hostname === "::" ? "[::1]" : hostname.includes(":") ? `[${hostname}]` : hostname}:${port}`,
  upgradeOther: app.getUpgradeHandler(),
});
server.listen(port, hostname, () =>
  console.info(JSON.stringify({ event: "patch_web.listening", port })),
);
const stop = () => {
  for (const client of wss.clients) client.close(1001, "Server restarting");
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
