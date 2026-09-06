import { publicApiRoute, parseJsonBody } from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import { ensureDatabaseBootstrap } from "@/lib/database/bootstrap";
import { getDatabase } from "@/lib/database/mongodb";
import { runJobs, runScheduler } from "@/lib/backend/jobs";
import { workerAuthorized } from "@/lib/backend/security";
import { repairBackend } from "@/lib/backend/repair";
import { inspectJobs, retryJob } from "@/lib/backend/operations";
import { z } from "zod";
export const runtime = "nodejs";
export const POST = publicApiRoute(async (request, { requestId }) => {
  const config = getServerConfig();
  workerAuthorized(request, config.BACKEND_WORKER_SECRET);
  const input = await parseJsonBody(
    request,
    z
      .object({
        mode: z
          .enum(["dispatch", "schedule", "repair", "inspect", "retry"])
          .default("dispatch"),
        limit: z.number().int().min(1).max(25).default(10),
        jobId: z
          .string()
          .regex(/^[a-f0-9]{24}$/)
          .optional(),
        reason: z.string().trim().min(10).max(500).optional(),
      })
      .strict()
      .refine((v) => v.mode !== "retry" || Boolean(v.jobId && v.reason)),
  );
  await ensureDatabaseBootstrap(config);
  const ctx = {
    config,
    db: getDatabase(config),
    requestId,
    actor: { tenantId: "system", userId: "system:worker" },
    system: true as const,
  };
  return Response.json(
    input.mode === "inspect"
      ? await inspectJobs(ctx)
      : input.mode === "retry"
        ? await retryJob(ctx, input.jobId!, input.reason!)
        : input.mode === "schedule"
          ? await runScheduler(ctx)
          : input.mode === "repair"
            ? await repairBackend(ctx)
            : await runJobs(ctx, input.limit),
  );
});
