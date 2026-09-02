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
    checkMongoReadiness(validation.config),
    checkR2Readiness(validation.config),
    getAiReadiness(validation.config)
      .then(
        (readiness) =>
          ({
            status: readiness.status === "ready" ? "ready" : "unavailable",
          }) as const,
      )
      .catch(() => ({ status: "unavailable" }) as const),
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
