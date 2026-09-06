const base =
  process.env.WORKER_BASE_URL ??
  process.env.AUTH_URL ??
  "http://localhost:3000";
const secret = process.env.BACKEND_WORKER_SECRET;
if (!secret || secret.length < 32 || secret.startsWith("replace-with-"))
  throw new Error("Worker authentication is unavailable.");
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
let tick = 0;
while (!stopped) {
  try {
    const mode =
      tick % 60 === 0 ? "repair" : tick % 6 === 0 ? "schedule" : "dispatch";
    const response = await fetch(new URL("/api/internal/jobs/run", base), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, limit: 1 }),
      signal: AbortSignal.timeout(330000),
      redirect: "error",
    });
    console.info(
      JSON.stringify({
        event: "patch_worker.tick",
        mode,
        status: response.ok ? "available" : "unavailable",
      }),
    );
  } catch {
    console.error(JSON.stringify({ event: "patch_worker.unavailable" }));
  }
  tick++;
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
