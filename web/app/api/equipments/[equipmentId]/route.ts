import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  deleteEquipment,
  equipmentUpdateSchema,
  getEquipment,
  updateEquipment,
} from "@/lib/domain/equipments";

interface EquipmentParams extends Record<string, string> {
  equipmentId: string;
}

export const runtime = "nodejs";

export const GET = authenticatedApiRoute<EquipmentParams>(
  async (_request, { actor, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    return NextResponse.json({
      equipment: await getEquipment(
        actor,
        params.equipmentId,
        getServerConfig(),
      ),
    });
  },
);

export const PATCH = authenticatedApiRoute<EquipmentParams>(
  async (request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const input = await parseJsonBody(request, equipmentUpdateSchema);
    const equipment = await updateEquipment(
      actor,
      params.equipmentId,
      input,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ equipment });
  },
);

export const DELETE = authenticatedApiRoute<EquipmentParams>(
  async (_request, { actor, requestId, params }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    await deleteEquipment(
      actor,
      params.equipmentId,
      requestId,
      getServerConfig(),
    );
    return new Response(null, { status: 204 });
  },
);
