import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  decideProjectMembershipRequest,
  projectAccessDecisionSchema,
} from "@/lib/domain/projects";

interface DecisionParams extends Record<string, string> {
  projectId: string;
  requestId: string;
}

export const POST = authenticatedApiRoute<DecisionParams>(
  async (request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const input = await parseJsonBody(request, projectAccessDecisionSchema);
    const membershipRequest = await decideProjectMembershipRequest(
      actor,
      params.projectId,
      params.requestId,
      input,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ membershipRequest });
  },
);
