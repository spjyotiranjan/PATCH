import { NextResponse } from "next/server";

import { validateServerConfig } from "@/lib/config";

export function GET() {
  const validation = validateServerConfig();

  return NextResponse.json({
    service: "patch-web",
    status: validation.success ? "ready" : "unavailable",
  });
}
