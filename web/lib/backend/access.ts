import "server-only";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { audit, entityAccess, fail, oid, type Context } from "./context";

export async function revokeAccess(
  ctx: Context,
  type: "PROJECT" | "EQUIPMENT",
  id: string,
  userId: string,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await entityAccess(tx, { type, id }, true);
    if (type === "EQUIPMENT") {
      const owner = await db
        .collection("equipments")
        .findOne(
          {
            _id: oid(id),
            tenantId: ctx.actor.tenantId,
            ownerId: ctx.actor.userId,
          },
          { session },
        );
      if (!owner) fail("EQUIPMENT_OWNER_REQUIRED", 403);
      if (userId === owner.ownerId) fail("OWNER_CANNOT_BE_REVOKED");
      await db
        .collection("equipmentManageAccess")
        .updateOne(
          { tenantId: ctx.actor.tenantId, equipmentId: oid(id), userId },
          { $set: { status: "REVOKED", updatedAt: new Date() } },
          { session },
        );
    } else {
      const membership = await db
        .collection("projectMemberships")
        .findOne(
          { tenantId: ctx.actor.tenantId, projectId: oid(id), userId },
          { session },
        );
      if (membership?.role === "OWNER") fail("OWNER_CANNOT_BE_REVOKED");
      await db
        .collection("projectMemberships")
        .updateOne(
          {
            tenantId: ctx.actor.tenantId,
            projectId: oid(id),
            userId,
            role: "MEMBER",
          },
          { $set: { status: "REVOKED", updatedAt: new Date() } },
          { session },
        );
    }
    await audit(tx, `${type}_ACCESS_REVOKED`, { resourceId: id, userId });
    return { revoked: true };
  });
}
