import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ServerConfig } from "@/lib/config";
import { ensureDatabaseBootstrap } from "@/lib/database/bootstrap";
import { getDatabase } from "@/lib/database/mongodb";
import { fail } from "./context";

export function checkOrigin(request: Request, expected: string) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(expected).origin)
    fail("ORIGIN_REJECTED", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    fail("ORIGIN_REJECTED", 403);
}
export async function rateLimit(
  config: ServerConfig,
  identity: string,
  limit: number,
  seconds = 60,
) {
  await ensureDatabaseBootstrap(config);
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const key = createHash("sha256")
    .update(`${identity}:${bucket}`)
    .digest("hex");
  const result = await getDatabase(config)
    .collection("rateLimits")
    .findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((bucket + 2) * seconds * 1000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  if ((result?.count ?? limit + 1) > limit) fail("RATE_LIMITED", 429);
}
export function workerAuthorized(request: Request, secret: string) {
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    secret.length < 32 ||
    secret.startsWith("replace-with-") ||
    supplied.length !== secret.length ||
    !timingSafeEqual(
      createHash("sha256").update(secret).digest(),
      createHash("sha256").update(supplied).digest(),
    )
  )
    fail("WORKER_AUTH_REQUIRED", 401);
}
