import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  createProject,
  listProjects,
  projectCreateSchema,
} from "@/lib/domain/projects";

export const runtime = "nodejs";

export const GET = authenticatedApiRoute(async (_request, { actor }) => {
  if (!actor) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED");
  }
  return NextResponse.json({
    items: await listProjects(actor, getServerConfig()),
  });
});

export const POST = authenticatedApiRoute(
  async (request, { actor, requestId }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const input = await parseJsonBody(request, projectCreateSchema);
    const project = await createProject(
      actor,
      input,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ project }, { status: 201 });
  },
);
