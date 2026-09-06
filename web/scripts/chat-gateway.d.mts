import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { WebSocketServer } from "ws";
export function attachChatGateway(
  server: Server,
  wss: WebSocketServer,
  options: {
    origin: string;
    apiBase: string;
    upgradeOther: (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
    ) => void;
  },
): void;
