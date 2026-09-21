import "server-only";

import { getAiReadiness } from "@/lib/ai/client";
import { getUnconfiguredServices, validateServerConfig } from "@/lib/config";
import { checkMongoReadiness } from "@/lib/database/mongodb";
import { logEvent } from "@/lib/observability/logger";
import { checkR2Readiness } from "@/lib/storage/r2";

export interface ReadinessReport {
  service: "patch-web";
  status: "ready" | "unavailable";
}

type DependencyStatus = { status: "ready" | "unavailable" };
const pendingChecks = new Map<string, Promise<DependencyStatus>>();
const READINESS_DEADLINE_MS = 5_000;

async function boundedCheck(
  service: string,
  check: () => Promise<DependencyStatus>,
): Promise<DependencyStatus> {
  let pending = pendingChecks.get(service);
  if (!pending) {
    pending = Promise.resolve()
      .then(check)
      .catch(() => ({ status: "unavailable" }) as const);
    pendingChecks.set(service, pending);
    const current = pending;
    void pending.finally(() => {
      if (pendingChecks.get(service) === current) pendingChecks.delete(service);
    });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<DependencyStatus>((resolve) => {
        timer = setTimeout(
          () => resolve({ status: "unavailable" }),
          READINESS_DEADLINE_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function getReadinessReport(): Promise<ReadinessReport> {
  const validation = validateServerConfig();

  if (!validation.success) {
    logEvent("error", "patch_web.readiness.unavailable", {
      unavailableServices: getUnconfiguredServices(),
    });

    return {
      service: "patch-web",
      status: "unavailable",
    };
  }

  const [mongodb, r2, ai] = await Promise.all([
    boundedCheck("mongodb", () => checkMongoReadiness(validation.config)),
    boundedCheck("r2", () => checkR2Readiness(validation.config)),
    boundedCheck("ai", () =>
      getAiReadiness({
        ...validation.config,
        AI_SERVICE_TIMEOUT_MS: Math.min(
          validation.config.AI_SERVICE_TIMEOUT_MS,
          READINESS_DEADLINE_MS,
        ),
        AI_SERVICE_RETRY_COUNT: 0,
      })
        .then(
          (readiness) =>
            ({
              status: readiness.status === "ready" ? "ready" : "unavailable",
            }) as const,
        )
        .catch(() => ({ status: "unavailable" }) as const),
    ),
  ]);
  const dependencies = {
    mongodb: mongodb.status,
    r2: r2.status,
    ai: ai.status,
  };
  const unavailableServices = Object.entries(dependencies)
    .filter(([, status]) => status !== "ready")
    .map(([service]) => service);

  if (unavailableServices.length > 0) {
    logEvent("error", "patch_web.readiness.unavailable", {
      unavailableServices,
    });
  }

  return {
    service: "patch-web",
    status: Object.values(dependencies).every((status) => status === "ready")
      ? "ready"
      : "unavailable",
  };
}
