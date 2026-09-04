import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import {
  createEquipment,
  equipmentCreateSchema,
  listEquipments,
} from "@/lib/domain/equipments";

export const runtime = "nodejs";

export const GET = authenticatedApiRoute(async (_request, { actor }) => {
  if (!actor) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED");
  }
  return NextResponse.json({
    items: await listEquipments(actor, getServerConfig()),
  });
});

export const POST = authenticatedApiRoute(
  async (request, { actor, requestId }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }
    const input = await parseJsonBody(request, equipmentCreateSchema);
    const equipment = await createEquipment(
      actor,
      input,
      requestId,
      getServerConfig(),
    );
    return NextResponse.json({ equipment }, { status: 201 });
  },
);
