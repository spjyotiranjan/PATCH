// @vitest-environment node

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../lib/auth/passwords";
import { settingsUpdateSchema, signUpSchema } from "../lib/auth/users";

describe("email/password authentication", () => {
  it("stores a verifiable salted hash instead of the plaintext password", async () => {
    const password = "a-safe-test-password";
    const storedHash = await hashPassword(password);
    expect(storedHash).not.toContain(password);
    await expect(verifyPassword(password, storedHash)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", storedHash)).resolves.toBe(
      false,
    );
  });

  it("requires the password confirmation to match", () => {
    const result = signUpSchema.safeParse({
      name: "Floor Technician",
      email: "TECHNICIAN@EXAMPLE.COM",
      password: "a-safe-test-password",
      confirmPassword: "a-different-password",
    });
    expect(result.success).toBe(false);
  });

  it("accepts only supported profile and theme settings", () => {
    expect(settingsUpdateSchema.safeParse({ theme: "DARK" }).success).toBe(
      true,
    );
    expect(settingsUpdateSchema.safeParse({ theme: "UNKNOWN" }).success).toBe(
      false,
    );
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false);
  });
});
