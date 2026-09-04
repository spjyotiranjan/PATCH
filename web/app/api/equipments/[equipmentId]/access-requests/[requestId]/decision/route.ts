import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  accessDecisionSchema,
  decideEquipmentAccessRequest,
} from "@/lib/domain/equipments";

interface DecisionParams extends Record<string, string> {
  equipmentId: string;
  requestId: string;
}

export const POST = authenticatedApiRoute<DecisionParams>(
  async (request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const input = await parseJsonBody(request, accessDecisionSchema);
    const accessRequest = await decideEquipmentAccessRequest(
      actor,
      params.equipmentId,
      params.requestId,
      input,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ accessRequest });
  },
);
