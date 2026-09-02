import "server-only";

import { ObjectId, type Collection } from "mongodb";
import { z } from "zod";

import type { ServerConfig } from "@/lib/config";
import { ensureDatabaseBootstrap } from "@/lib/database/bootstrap";
import { getDatabase } from "@/lib/database/mongodb";

import { hashPassword, verifyPassword } from "./passwords";

const passwordSchema = z.string().min(8).max(128);
export const themeSchema = z.enum(["LIGHT", "DARK", "SYSTEM"]);

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const signInSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
});

export const settingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    theme: themeSchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.theme !== undefined, {
    message: "At least one setting must be provided.",
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export interface UserRecord {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  tenantId: "default";
  preferences: { theme: "LIGHT" | "DARK" | "SYSTEM" };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  tenantId: "default";
}

export interface UserSettings {
  profile: {
    name: string;
    email: string;
  };
  preferences: {
    theme: z.infer<typeof themeSchema>;
  };
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account already exists for this email address.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

function getUsersCollection(
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Collection<UserRecord> {
  return getDatabase(config).collection<UserRecord>("users");
}

function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    tenantId: user.tenantId,
  };
}

export async function registerUser(
  input: SignUpInput,
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Promise<AuthenticatedUser> {
  const parsedInput = signUpSchema.parse(input);
  await ensureDatabaseBootstrap(config);
  const collection = getUsersCollection(config);
  const now = new Date();
  const user: UserRecord = {
    _id: new ObjectId(),
    name: parsedInput.name,
    email: parsedInput.email,
    passwordHash: await hashPassword(parsedInput.password),
    tenantId: "default",
    preferences: { theme: "SYSTEM" },
    createdAt: now,
    updatedAt: now,
  };

  try {
    await collection.insertOne(user);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11_000
    ) {
      throw new EmailAlreadyRegisteredError();
    }
    throw error;
  }

  return toAuthenticatedUser(user);
}

export async function authenticateUser(
  email: string,
  password: string,
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Promise<AuthenticatedUser | null> {
  const parsedInput = signInSchema.safeParse({ email, password });
  if (!parsedInput.success) {
    return null;
  }
  await ensureDatabaseBootstrap(config);
  const user = await getUsersCollection(config).findOne({
    email: parsedInput.data.email,
  });
  if (
    !user ||
    !(await verifyPassword(parsedInput.data.password, user.passwordHash))
  ) {
    return null;
  }
  return toAuthenticatedUser(user);
}

function toUserSettings(user: UserRecord): UserSettings {
  return {
    profile: { name: user.name, email: user.email },
    preferences: { theme: user.preferences.theme },
  };
}

export async function getUserSettings(
  userId: string,
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Promise<UserSettings | null> {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  await ensureDatabaseBootstrap(config);
  const user = await getUsersCollection(config).findOne({
    _id: new ObjectId(userId),
  });
  return user ? toUserSettings(user) : null;
}

export async function updateUserSettings(
  userId: string,
  input: z.infer<typeof settingsUpdateSchema>,
  config: Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">,
): Promise<UserSettings | null> {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  const parsedInput = settingsUpdateSchema.parse(input);
  const updates: Record<string, string | Date> = { updatedAt: new Date() };
  if (parsedInput.name !== undefined) {
    updates.name = parsedInput.name;
  }
  if (parsedInput.theme !== undefined) {
    updates["preferences.theme"] = parsedInput.theme;
  }

  await ensureDatabaseBootstrap(config);
  const user = await getUsersCollection(config).findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: updates },
    { returnDocument: "after" },
  );
  return user ? toUserSettings(user) : null;
}
