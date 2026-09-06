import "server-only";
import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { z } from "zod";
import type { AuthenticatedActor } from "@/lib/auth/authorization";
import type { ServerConfig } from "@/lib/config";
import { actorCanManageEquipment } from "@/lib/domain/equipments";
import { DomainError } from "@/lib/domain/errors";

export const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
export const entitySchema = z
  .object({ type: z.enum(["PERSONAL", "EQUIPMENT", "PROJECT"]), id: idSchema })
  .strict();
export type Entity = z.infer<typeof entitySchema>;
export interface Context {
  db: Db;
  actor: AuthenticatedActor;
  config: ServerConfig;
  requestId: string;
  session?: ClientSession;
  system?: true;
}
export function fail(code: string, status = 409): never {
  throw new DomainError(status, code);
}
export function oid(value: string): ObjectId {
  if (!idSchema.safeParse(value).success) fail("NOT_FOUND", 404);
  return new ObjectId(value);
}
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function view<T extends { _id: ObjectId }>(record: T) {
  const { _id, ...rest } = record;
  return { id: _id.toHexString(), ...rest };
}
type MutationContext = Pick<Context, "db" | "actor" | "requestId" | "session">;
export async function audit(
  ctx: MutationContext,
  action: string,
  context: Record<string, string | number | boolean | null>,
) {
  await ctx.db.collection("auditEvents").insertOne(
    {
      actor: ctx.actor,
      requestId: ctx.requestId,
      action,
      context,
      occurredAt: new Date(),
    },
    { session: ctx.session },
  );
}
export async function entityAccess(
  ctx: Context,
  entity: Entity,
  mutate = false,
) {
  const { db, actor, session } = ctx;
  if (ctx.system && entity.type !== "PERSONAL") {
    const record = await db
      .collection(entity.type === "PROJECT" ? "projects" : "equipments")
      .findOne({ _id: oid(entity.id), tenantId: actor.tenantId }, { session });
    if (!record) fail("ENTITY_NOT_FOUND", 404);
    return;
  }
  if (entity.type === "PERSONAL") {
    if (!ctx.system && entity.id !== actor.userId) fail("ACCESS_DENIED", 403);
    return;
  }
  if (entity.type === "PROJECT") {
    const project = await db
      .collection("projects")
      .findOne({ _id: oid(entity.id), tenantId: actor.tenantId }, { session });
    const membership = await db.collection("projectMemberships").findOne(
      {
        projectId: oid(entity.id),
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: "ACTIVE",
        ...(mutate ? { role: "OWNER" } : {}),
      },
      { session },
    );
    if (!project || !membership) fail("PROJECT_ACCESS_REQUIRED", 403);
    return;
  }
  if (await actorCanManageEquipment(db, actor, oid(entity.id), session)) return;
  if (!mutate) {
    const memberships = await db
      .collection("projectMemberships")
      .find(
        { tenantId: actor.tenantId, userId: actor.userId, status: "ACTIVE" },
        { session },
      )
      .toArray();
    const included = await db.collection("projects").findOne(
      {
        tenantId: actor.tenantId,
        _id: { $in: memberships.map((m) => m.projectId) },
        includedEquipmentIds: oid(entity.id),
      },
      { session },
    );
    if (included) return;
  }
  fail("EQUIPMENT_ACCESS_REQUIRED", 403);
}

export async function queue(
  ctx: MutationContext,
  kind: string,
  key: string,
  payload: Record<string, unknown>,
) {
  await ctx.db.collection("outboxEvents").updateOne(
    { tenantId: ctx.actor.tenantId, key },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: ctx.actor.tenantId,
        kind,
        key,
        payload,
        actor: ctx.actor,
        requestId: ctx.requestId,
        status: "PENDING",
        attempts: 0,
        availableAt: new Date(),
        createdAt: new Date(),
      },
    },
    { upsert: true, session: ctx.session },
  );
}

export async function invalidateEntity(ctx: MutationContext, entity: Entity) {
  if (entity.type === "PERSONAL") return;
  const result = await ctx.db.collection("entityProfiles").findOneAndUpdate(
    {
      tenantId: ctx.actor.tenantId,
      entityType: entity.type,
      entityId: entity.id,
    },
    {
      $set: { state: "STALE", updatedAt: new Date() },
      $inc: { revision: 1 },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true, returnDocument: "after", session: ctx.session },
  );
  await queue(
    ctx,
    "PROFILE",
    `profile:${entity.type}:${entity.id}:${result!.revision}`,
    { entity, revision: result!.revision },
  );
  if (entity.type === "EQUIPMENT") {
    const projects = await ctx.db
      .collection("projects")
      .find(
        { tenantId: ctx.actor.tenantId, includedEquipmentIds: oid(entity.id) },
        { session: ctx.session },
      )
      .toArray();
    for (const project of projects)
      await invalidateEntity(ctx, {
        type: "PROJECT",
        id: project._id.toHexString(),
      });
  } else {
    await queue(
      ctx,
      "PROCEDURE",
      `procedure-check:${entity.id}:${result!.revision}`,
      { projectId: entity.id },
    );
  }
}
