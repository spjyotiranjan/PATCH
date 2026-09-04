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
  tenantId: string;
  role: ProjectRole;
  status: "ACTIVE" | "PENDING" | "REJECTED";
}

export interface EquipmentAuthorizationRecord {
  equipmentId: string;
  ownerId: string;
  tenantId: string;
}

export interface EquipmentManageGrant {
  equipmentId: string;
  userId: string;
  tenantId: string;
  status: "ACTIVE" | "REVOKED";
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
    membership.tenantId !== actor.tenantId ||
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

export function requireEquipmentManager(
  actor: AuthenticatedActor,
  equipment: EquipmentAuthorizationRecord | null,
  grant: EquipmentManageGrant | null,
): EquipmentAuthorizationRecord {
  if (!equipment || equipment.tenantId !== actor.tenantId) {
    throw new AuthorizationError("The Equipment is not accessible");
  }

  if (equipment.ownerId === actor.userId) {
    return equipment;
  }

  if (
    !grant ||
    grant.equipmentId !== equipment.equipmentId ||
    grant.userId !== actor.userId ||
    grant.tenantId !== actor.tenantId ||
    grant.status !== "ACTIVE"
  ) {
    throw new AuthorizationError("Equipment manage access is required");
  }

  return equipment;
}

export function requireEquipmentOwner(
  actor: AuthenticatedActor,
  equipment: EquipmentAuthorizationRecord | null,
): EquipmentAuthorizationRecord {
  if (
    !equipment ||
    equipment.tenantId !== actor.tenantId ||
    equipment.ownerId !== actor.userId
  ) {
    throw new AuthorizationError("Equipment owner access is required");
  }

  return equipment;
}
