import { NextResponse } from "next/server";

import { getReadinessReport } from "@/lib/readiness";

export async function GET() {
  const report = await getReadinessReport();
  const statusCode = report.status === "ready" ? 200 : 503;

  return NextResponse.json(report, { status: statusCode });
}
