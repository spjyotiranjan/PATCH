export function attachChatGateway(
  server,
  wss,
  { origin, apiBase, upgradeOther },
) {
  const ipCounts = new Map();
  let reserved = 0;
  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url ?? "/", origin);
    if (url.pathname !== "/ws/chat") {
      return upgradeOther(request, socket, head);
    }
    const id = url.searchParams.get("sessionId");
    const cookie = request.headers.cookie;
    const ip = request.socket.remoteAddress ?? "unknown";
    if (
      request.headers.origin !== origin ||
      !cookie ||
      !/^[a-f0-9]{24}$/.test(id ?? "") ||
      reserved >= 200 ||
      (ipCounts.get(ip) ?? 0) >= 5
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    // Reserve before the asynchronous session lookup to bound upgrade floods.
    reserved++;
    ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      reserved--;
      const count = (ipCounts.get(ip) ?? 1) - 1;
      if (count > 0) ipCounts.set(ip, count);
      else ipCounts.delete(ip);
    };
    socket.once("close", release);
    try {
      const response = await fetch(`${apiBase}/api/chat/sessions/${id}`, {
        headers: { cookie },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("AUTH_REQUIRED");
      if (socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, (ws) => {
        let pending = false;
        let controller;
        let alive = true;
        const send = (value) => {
          if (ws.readyState === 1 && ws.bufferedAmount < 512000)
            ws.send(JSON.stringify(value));
          else ws.close(1013);
        };
        const heartbeat = setInterval(() => {
          if (!alive) {
            ws.terminate();
            return;
          }
          alive = false;
          ws.ping();
        }, 30000);
        const expiry = setTimeout(
          () => ws.close(1008, "Reconnect to refresh authentication"),
          15 * 60000,
        );
        ws.on("pong", () => {
          alive = true;
        });
        ws.on("close", () => {
          clearInterval(heartbeat);
          clearTimeout(expiry);
          controller?.abort();
          release();
        });
        ws.on("error", () => ws.close());
        ws.on("message", async (raw, binary) => {
          let clientTurnId = null;
          let ownsPending = false;
          try {
            if (binary) {
              ws.close(1003);
              return;
            }
            const input = JSON.parse(raw.toString());
            clientTurnId = input.clientTurnId;
            if (input.type === "turn.cancel") {
              controller?.abort();
              return;
            }
            if (
              input.type !== "turn.submit" ||
              typeof clientTurnId !== "string"
            ) {
              send({ type: "turn.error", code: "INVALID_REQUEST" });
              return;
            }
            if (pending) {
              send({
                type: "turn.error",
                clientTurnId,
                code: "CHAT_SESSION_BUSY",
              });
              return;
            }
            pending = true;
            ownsPending = true;
            controller = new AbortController();
            send({ type: "turn.accepted", clientTurnId });
            send({ type: "turn.processing", clientTurnId });
            const { type: _type, ...body } = input;
            void _type;
            const response = await fetch(
              `${apiBase}/api/chat/sessions/${id}/turns`,
              {
                method: "POST",
                headers: { cookie, origin, "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(150000),
                ]),
                redirect: "error",
              },
            );
            const result = await response.json();
            send(
              response.ok
                ? { type: "turn.completed", clientTurnId, turn: result }
                : {
                    type: "turn.error",
                    clientTurnId,
                    code: result.error?.code ?? "REQUEST_FAILED",
                    requestId: result.requestId,
                  },
            );
          } catch {
            send({
              type: "turn.error",
              clientTurnId,
              code: "TURN_INTERRUPTED",
            });
          } finally {
            if (ownsPending) pending = false;
          }
        });
        send({ type: "connection.ready", sessionId: id });
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
    }
  });
}
