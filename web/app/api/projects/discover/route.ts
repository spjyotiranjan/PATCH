import { NextResponse } from "next/server";

import { ApiError, authenticatedApiRoute } from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import { discoverProjects } from "@/lib/domain/projects";

export const GET = authenticatedApiRoute(async (_request, { actor }) => {
  if (!actor) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED");
  }
  return NextResponse.json({
    items: await discoverProjects(actor, getServerConfig()),
  });
});
