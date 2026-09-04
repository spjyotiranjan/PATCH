import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  deleteProject,
  getProject,
  projectUpdateSchema,
  updateProject,
} from "@/lib/domain/projects";

interface ProjectParams extends Record<string, string> {
  projectId: string;
}

export const runtime = "nodejs";

export const GET = authenticatedApiRoute<ProjectParams>(
  async (_request, { actor, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    return NextResponse.json({
      project: await getProject(actor, params.projectId, getServerConfig()),
    });
  },
);

export const PATCH = authenticatedApiRoute<ProjectParams>(
  async (request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const input = await parseJsonBody(request, projectUpdateSchema);
    const project = await updateProject(
      actor,
      params.projectId,
      input,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ project });
  },
);

export const DELETE = authenticatedApiRoute<ProjectParams>(
  async (_request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    await deleteProject(actor, params.projectId, requestId, getServerConfig());
    return new Response(null, { status: 204 });
  },
);
