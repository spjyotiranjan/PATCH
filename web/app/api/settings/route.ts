import { NextResponse } from "next/server";

import {
  ApiError,
  authenticatedApiRoute,
  parseJsonBody,
} from "@/lib/api/route";
import { persistAuditEvent } from "@/lib/audit/events";
import {
  getUserSettings,
  settingsUpdateSchema,
  updateUserSettings,
} from "@/lib/auth/users";
import { getServerConfig } from "@/lib/config";

export const GET = authenticatedApiRoute(async (_request, { actor }) => {
  if (!actor) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED");
  }

  const settings = await getUserSettings(actor.userId, getServerConfig());
  if (!settings) {
    throw new ApiError(404, "USER_NOT_FOUND");
  }
  return NextResponse.json(settings);
});

export const PATCH = authenticatedApiRoute(
  async (request, { actor, requestId }) => {
    if (!actor) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED");
    }

    const input = await parseJsonBody(request, settingsUpdateSchema);
    const config = getServerConfig();
    const settings = await updateUserSettings(actor.userId, input, config);
    if (!settings) {
      throw new ApiError(404, "USER_NOT_FOUND");
    }

    await persistAuditEvent(
      {
        action: "USER_SETTINGS_UPDATED",
        actor,
        requestId,
        context: {
          profileNameChanged: input.name !== undefined,
          themeChanged: input.theme !== undefined,
        },
      },
      config,
    );
    return NextResponse.json(settings);
  },
);
