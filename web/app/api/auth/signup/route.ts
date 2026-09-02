import { NextResponse } from "next/server";

import { ApiError, parseJsonBody, publicApiRoute } from "@/lib/api/route";
import { persistAuditEvent } from "@/lib/audit/events";
import {
  EmailAlreadyRegisteredError,
  registerUser,
  signUpSchema,
} from "@/lib/auth/users";
import { getServerConfig } from "@/lib/config";

export const runtime = "nodejs";

export const POST = publicApiRoute(async (request, { requestId }) => {
  try {
    const config = getServerConfig();
    const input = await parseJsonBody(request, signUpSchema);
    const user = await registerUser(input, config);
    await persistAuditEvent(
      {
        action: "USER_REGISTERED",
        actor: { userId: user.id, tenantId: user.tenantId },
        requestId,
        context: { authenticationMethod: "EMAIL_PASSWORD" },
      },
      config,
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED");
    }
    throw error;
  }
});
