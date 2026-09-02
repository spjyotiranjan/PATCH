// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
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
        role: "MEMBER",
        status: "ACTIVE",
      }),
    ).toThrow(AuthorizationError);
  });
});
