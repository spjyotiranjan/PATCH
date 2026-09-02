import "server-only";

export const projectRoles = ["OWNER", "MEMBER"] as const;
export type ProjectRole = (typeof projectRoles)[number];

export interface AuthenticatedActor {
  userId: string;
  tenantId: string;
}

export interface ProjectMembership {
  projectId: string;
  userId: string;
  role: ProjectRole;
  status: "ACTIVE" | "PENDING" | "REJECTED";
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requireProjectRole(
  actor: AuthenticatedActor,
  membership: ProjectMembership | null,
  allowedRoles: readonly ProjectRole[],
): ProjectMembership {
  if (
    !membership ||
    membership.userId !== actor.userId ||
    membership.status !== "ACTIVE"
  ) {
    throw new AuthorizationError("An active Project membership is required");
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new AuthorizationError(
      "The Project role is not authorized for this action",
    );
  }

  return membership;
}

export function requireProjectOwner(
  actor: AuthenticatedActor,
  membership: ProjectMembership | null,
): ProjectMembership {
  return requireProjectRole(actor, membership, ["OWNER"]);
}
