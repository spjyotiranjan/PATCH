import { NextResponse } from "next/server";

import { ApiError, authenticatedApiRoute } from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  listProjectMembershipRequests,
  requestProjectMembership,
} from "@/lib/domain/projects";

interface ProjectParams extends Record<string, string> {
  projectId: string;
}

export const GET = authenticatedApiRoute<ProjectParams>(
  async (_request, { actor, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    return NextResponse.json({
      items: await listProjectMembershipRequests(
        actor,
        params.projectId,
        getServerConfig(),
      ),
    });
  },
);

export const POST = authenticatedApiRoute<ProjectParams>(
  async (_request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const membershipRequest = await requestProjectMembership(
      actor,
      params.projectId,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ membershipRequest }, { status: 201 });
  },
);
