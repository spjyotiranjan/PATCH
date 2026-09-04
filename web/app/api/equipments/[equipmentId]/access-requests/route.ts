import { NextResponse } from "next/server";

import { ApiError, authenticatedApiRoute } from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  listEquipmentAccessRequests,
  requestEquipmentManageAccess,
} from "@/lib/domain/equipments";

interface EquipmentParams extends Record<string, string> {
  equipmentId: string;
}

export const GET = authenticatedApiRoute<EquipmentParams>(
  async (_request, { actor, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    return NextResponse.json({
      items: await listEquipmentAccessRequests(
        actor,
        params.equipmentId,
        getServerConfig(),
      ),
    });
  },
);

export const POST = authenticatedApiRoute<EquipmentParams>(
  async (_request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const accessRequest = await requestEquipmentManageAccess(
      actor,
      params.equipmentId,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ accessRequest }, { status: 201 });
  },
);
