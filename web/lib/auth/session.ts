import "server-only";

import { getServerSession, type Session } from "next-auth";

import type { AuthenticatedActor } from "./authorization";
import { authOptions } from "./options";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export function actorFromSession(session: Session | null): AuthenticatedActor {
  if (!session?.user?.id || !session.user.tenantId) {
    throw new AuthenticationRequiredError();
  }

  return { userId: session.user.id, tenantId: session.user.tenantId };
}

export async function requireAuthenticatedActor(): Promise<AuthenticatedActor> {
  return actorFromSession(await getServerSession(authOptions));
}
