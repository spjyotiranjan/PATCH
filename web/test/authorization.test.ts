// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  requireEquipmentManager,
  requireEquipmentOwner,
  requireProjectOwner,
  requireProjectRole,
} from "../lib/auth/authorization";

const actor = { userId: "user-1", tenantId: "tenant-1" };

describe("Project authorization", () => {
  it("allows an active member to use member-level access", () => {
    expect(
      requireProjectRole(
        actor,
        {
          projectId: "project-1",
          userId: actor.userId,
          tenantId: actor.tenantId,
          role: "MEMBER",
          status: "ACTIVE",
        },
        ["OWNER", "MEMBER"],
      ),
    ).toMatchObject({ role: "MEMBER" });
  });

  it("requires OWNER for owner-only actions", () => {
    expect(() =>
      requireProjectOwner(actor, {
        projectId: "project-1",
        userId: actor.userId,
        tenantId: actor.tenantId,
        role: "MEMBER",
        status: "ACTIVE",
      }),
    ).toThrow(AuthorizationError);
  });
});

describe("Equipment authorization", () => {
  const equipment = {
    equipmentId: "equipment-1",
    ownerId: "owner-1",
    tenantId: actor.tenantId,
  };

  it("allows the creator/owner without a separate grant", () => {
    const owner = { ...actor, userId: "owner-1" };
    expect(requireEquipmentManager(owner, equipment, null)).toBe(equipment);
    expect(requireEquipmentOwner(owner, equipment)).toBe(equipment);
  });

  it("allows an active Equipment-scoped manager but not owner actions", () => {
    const grant = {
      equipmentId: equipment.equipmentId,
      userId: actor.userId,
      tenantId: actor.tenantId,
      status: "ACTIVE" as const,
    };
    expect(requireEquipmentManager(actor, equipment, grant)).toBe(equipment);
    expect(() => requireEquipmentOwner(actor, equipment)).toThrow(
      AuthorizationError,
    );
  });

  it("rejects grants from another Equipment or tenant", () => {
    expect(() =>
      requireEquipmentManager(actor, equipment, {
        equipmentId: "equipment-2",
        userId: actor.userId,
        tenantId: actor.tenantId,
        status: "ACTIVE",
      }),
    ).toThrow(AuthorizationError);

    expect(() =>
      requireEquipmentManager(
        actor,
        { ...equipment, tenantId: "another-tenant" },
        null,
      ),
    ).toThrow(AuthorizationError);
  });
});
