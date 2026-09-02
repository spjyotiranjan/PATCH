// @vitest-environment node

import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";

import {
  actorFromSession,
  AuthenticationRequiredError,
} from "../lib/auth/session";

describe("authenticated sessions", () => {
  it("derives the authorization actor from the trusted session", () => {
    const session = {
      user: {
        id: "user-1",
        tenantId: "default",
        name: "Technician",
        email: "technician@example.com",
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } satisfies Session;

    expect(actorFromSession(session)).toEqual({
      userId: "user-1",
      tenantId: "default",
    });
  });

  it("rejects an absent session", () => {
    expect(() => actorFromSession(null)).toThrow(AuthenticationRequiredError);
  });
});
