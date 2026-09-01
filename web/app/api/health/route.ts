import { NextResponse } from "next/server";

const requiredConfiguration = ["MONGODB_URI", "MONGODB_DB_NAME", "AI_SERVICE_BASE_URL", "AI_SERVICE_SHARED_SECRET"];

export function GET() {
  const missing = requiredConfiguration.filter((name) => !process.env[name]);

  return NextResponse.json({
    service: "patch-web",
    status: missing.length === 0 ? "ready" : "configuration_required",
    missingConfiguration: missing,
  });
}
