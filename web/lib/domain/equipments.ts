import "server-only";

import {
  ObjectId,
  type ClientSession,
  type Collection,
  type Db,
  type Filter,
} from "mongodb";
import { z } from "zod";

import {
  AuthorizationError,
  requireEquipmentManager,
  requireEquipmentOwner,
  type AuthenticatedActor,
  type EquipmentManageGrant,
} from "@/lib/auth/authorization";
import type { ServerConfig } from "@/lib/config";
import { ensureDatabaseBootstrap } from "@/lib/database/bootstrap";
import { getDatabase, withDatabaseTransaction } from "@/lib/database/mongodb";

import { conflict, forbidden, notFound } from "./errors";

const entityName = z.string().trim().min(1).max(160);
const entityLabel = z.string().trim().min(1).max(120);
const optionalDescription = z.string().trim().min(1).max(1_000).nullable();

export const documentsModeSchema = z.enum(["ADD_NOW", "SKIP_FOR_NOW"]);
export const equipmentOperationalStateSchema = z.enum([
  "UNKNOWN",
  "OPERATING",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
]);

export const equipmentCreateSchema = z
  .object({
    name: entityName,
    type: entityLabel,
    model: entityLabel.nullable().optional(),
    location: entityLabel,
    description: optionalDescription.optional(),
    operationalState: equipmentOperationalStateSchema.default("UNKNOWN"),
    documentsMode: documentsModeSchema.default("SKIP_FOR_NOW"),
  })
  .strict();

export const equipmentUpdateSchema = z
  .object({
    name: entityName.optional(),
    type: entityLabel.optional(),
    model: entityLabel.nullable().optional(),
    location: entityLabel.optional(),
    description: optionalDescription.optional(),
    operationalState: equipmentOperationalStateSchema.optional(),
    documentsMode: documentsModeSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one Equipment field is required.",
  });

export const accessDecisionSchema = z
  .object({ decision: z.enum(["APPROVE", "REJECT"]) })
  .strict();

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
export type AccessDecisionInput = z.infer<typeof accessDecisionSchema>;

export interface EquipmentRecord {
  _id: ObjectId;
  tenantId: string;
  ownerId: string;
  name: string;
  type: string;
  model: string | null;
  location: string;
  description: string | null;
  operationalState: z.infer<typeof equipmentOperationalStateSchema>;
  documentsMode: z.infer<typeof documentsModeSchema>;
  createdAt: Date;
  updatedAt: Date;
}

interface EquipmentManageAccessRecord {
  _id: ObjectId;
  tenantId: string;
  equipmentId: ObjectId;
  userId: string;
  status: "ACTIVE" | "REVOKED";
  grantedBy: string;
  grantedAt: Date;
  updatedAt: Date;
}

interface EquipmentAccessRequestRecord {
  _id: ObjectId;
  tenantId: string;
  equipmentId: ObjectId;
  requesterId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
}

export interface EquipmentView {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  model: string | null;
  location: string;
  description: string | null;
  operationalState: EquipmentRecord["operationalState"];
  documentsMode: EquipmentRecord["documentsMode"];
  accessLevel: "OWNER" | "MANAGER";
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentDiscoveryView {
  id: string;
  name: string;
  type: string;
  location: string;
  accessRequestStatus: "NONE" | "PENDING" | "REJECTED";
}

export interface AccessRequestView {
  id: string;
  resourceId: string;
  requesterId: string;
  status: EquipmentAccessRequestRecord["status"];
  createdAt: string;
  updatedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

type DatabaseConfig = Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">;

function equipments(database: Db): Collection<EquipmentRecord> {
  return database.collection<EquipmentRecord>("equipments");
}

function grants(database: Db): Collection<EquipmentManageAccessRecord> {
  return database.collection<EquipmentManageAccessRecord>(
    "equipmentManageAccess",
  );
}

function requests(database: Db): Collection<EquipmentAccessRequestRecord> {
  return database.collection<EquipmentAccessRequestRecord>(
    "equipmentAccessRequests",
  );
}

function equipmentId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    notFound("EQUIPMENT_NOT_FOUND");
  }
  return new ObjectId(value);
}

function requestId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    notFound("ACCESS_REQUEST_NOT_FOUND");
  }
  return new ObjectId(value);
}

function equipmentView(
  record: EquipmentRecord,
  actor: AuthenticatedActor,
): EquipmentView {
  return {
    id: record._id.toHexString(),
    ownerId: record.ownerId,
    name: record.name,
    type: record.type,
    model: record.model,
    location: record.location,
    description: record.description,
    operationalState: record.operationalState,
    documentsMode: record.documentsMode,
    accessLevel: record.ownerId === actor.userId ? "OWNER" : "MANAGER",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function accessRequestView(
  record: EquipmentAccessRequestRecord,
): AccessRequestView {
  return {
    id: record._id.toHexString(),
    resourceId: record.equipmentId.toHexString(),
    requesterId: record.requesterId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ...(record.decidedBy ? { decidedBy: record.decidedBy } : {}),
    ...(record.decidedAt ? { decidedAt: record.decidedAt.toISOString() } : {}),
  };
}

async function loadEquipment(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<EquipmentRecord> {
  const record = await equipments(database).findOne(
    { _id: id, tenantId: actor.tenantId },
    { session },
  );
  if (!record) {
    notFound("EQUIPMENT_NOT_FOUND");
  }
  return record;
}

async function loadGrant(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<EquipmentManageGrant | null> {
  const grant = await grants(database).findOne(
    {
      tenantId: actor.tenantId,
      equipmentId: id,
      userId: actor.userId,
      status: "ACTIVE",
    },
    { session },
  );
  return grant
    ? {
        equipmentId: grant.equipmentId.toHexString(),
        userId: grant.userId,
        tenantId: grant.tenantId,
        status: grant.status,
      }
    : null;
}

async function requireManageAccess(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<EquipmentRecord> {
  const record = await loadEquipment(database, actor, id, session);
  const grant =
    record.ownerId === actor.userId
      ? null
      : await loadGrant(database, actor, id, session);
  try {
    requireEquipmentManager(
      actor,
      {
        equipmentId: record._id.toHexString(),
        ownerId: record.ownerId,
        tenantId: record.tenantId,
      },
      grant,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      forbidden("EQUIPMENT_ACCESS_REQUIRED");
    }
    throw error;
  }
  return record;
}

async function requireOwnerAccess(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<EquipmentRecord> {
  const record = await loadEquipment(database, actor, id, session);
  try {
    requireEquipmentOwner(actor, {
      equipmentId: record._id.toHexString(),
      ownerId: record.ownerId,
      tenantId: record.tenantId,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      forbidden("EQUIPMENT_OWNER_REQUIRED");
    }
    throw error;
  }
  return record;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11_000
  );
}

export async function listEquipments(
  actor: AuthenticatedActor,
  config: DatabaseConfig,
): Promise<EquipmentView[]> {
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  const managed = await grants(database)
    .find({
      tenantId: actor.tenantId,
      userId: actor.userId,
      status: "ACTIVE",
    })
    .project<{ equipmentId: ObjectId }>({ equipmentId: 1 })
    .toArray();
  const managedIds = managed.map((grant) => grant.equipmentId);
  const filter: Filter<EquipmentRecord> = {
    tenantId: actor.tenantId,
    $or: [{ ownerId: actor.userId }, { _id: { $in: managedIds } }],
  };
  const records = await equipments(database)
    .find(filter)
    .sort({ updatedAt: -1, _id: 1 })
    .toArray();
  return records.map((record) => equipmentView(record, actor));
}

export async function discoverEquipments(
  actor: AuthenticatedActor,
  config: DatabaseConfig,
): Promise<EquipmentDiscoveryView[]> {
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  const [actorGrants, actorRequests] = await Promise.all([
    grants(database)
      .find({
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: "ACTIVE",
      })
      .toArray(),
    requests(database)
      .find({ tenantId: actor.tenantId, requesterId: actor.userId })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);
  const inaccessibleIds = actorGrants.map((grant) => grant.equipmentId);
  const latestRequest = new Map<string, EquipmentAccessRequestRecord>();
  for (const request of actorRequests) {
    const key = request.equipmentId.toHexString();
    if (!latestRequest.has(key)) {
      latestRequest.set(key, request);
    }
  }
  const records = await equipments(database)
    .find({
      tenantId: actor.tenantId,
      ownerId: { $ne: actor.userId },
      _id: { $nin: inaccessibleIds },
    })
    .project<Pick<EquipmentRecord, "_id" | "name" | "type" | "location">>({
      name: 1,
      type: 1,
      location: 1,
    })
    .sort({ name: 1, _id: 1 })
    .toArray();
  return records.map((record) => {
    const request = latestRequest.get(record._id.toHexString());
    return {
      id: record._id.toHexString(),
      name: record.name,
      type: record.type,
      location: record.location,
      accessRequestStatus:
        request?.status === "PENDING"
          ? "PENDING"
          : request?.status === "REJECTED"
            ? "REJECTED"
            : "NONE",
    };
  });
}

export async function createEquipment(
  actor: AuthenticatedActor,
  input: EquipmentCreateInput,
  requestIdValue: string,
  config: DatabaseConfig,
): Promise<EquipmentView> {
  const parsed = equipmentCreateSchema.parse(input);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    const now = new Date();
    const record: EquipmentRecord = {
      _id: new ObjectId(),
      tenantId: actor.tenantId,
      ownerId: actor.userId,
      name: parsed.name,
      type: parsed.type,
      model: parsed.model ?? null,
      location: parsed.location,
      description: parsed.description ?? null,
      operationalState: parsed.operationalState,
      documentsMode: parsed.documentsMode,
      createdAt: now,
      updatedAt: now,
    };
    await equipments(database).insertOne(record, { session });
    await database.collection("auditEvents").insertOne(
      {
        action: "EQUIPMENT_CREATED",
        actor,
        requestId: requestIdValue,
        context: {
          equipmentId: record._id.toHexString(),
          documentsMode: record.documentsMode,
        },
        occurredAt: now,
      },
      { session },
    );
    return equipmentView(record, actor);
  });
}

export async function getEquipment(
  actor: AuthenticatedActor,
  idValue: string,
  config: DatabaseConfig,
): Promise<EquipmentView> {
  await ensureDatabaseBootstrap(config);
  const id = equipmentId(idValue);
  const record = await requireManageAccess(getDatabase(config), actor, id);
  return equipmentView(record, actor);
}

export async function updateEquipment(
  actor: AuthenticatedActor,
  idValue: string,
  input: EquipmentUpdateInput,
  requestIdValue: string,
  config: DatabaseConfig,
): Promise<EquipmentView> {
  const parsed = equipmentUpdateSchema.parse(input);
  const id = equipmentId(idValue);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    await requireManageAccess(database, actor, id, session);
    const updates: Partial<
      Pick<
        EquipmentRecord,
        | "name"
        | "type"
        | "model"
        | "location"
        | "description"
        | "operationalState"
        | "documentsMode"
      >
    > & { updatedAt: Date } = { updatedAt: new Date() };
    for (const key of [
      "name",
      "type",
      "model",
      "location",
      "description",
      "operationalState",
      "documentsMode",
    ] as const) {
      const value = parsed[key];
      if (value !== undefined) {
        (updates as Record<string, unknown>)[key] = value;
      }
    }
    const updated = await equipments(database).findOneAndUpdate(
      { _id: id, tenantId: actor.tenantId },
      { $set: updates },
      { returnDocument: "after", session },
    );
    if (!updated) {
      notFound("EQUIPMENT_NOT_FOUND");
    }
    await database.collection("auditEvents").insertOne(
      {
        action: "EQUIPMENT_UPDATED",
        actor,
        requestId: requestIdValue,
        context: {
          equipmentId: id.toHexString(),
          changedFields: Object.keys(parsed).sort().join(","),
        },
        occurredAt: new Date(),
      },
      { session },
    );
    return equipmentView(updated, actor);
  });
}

export async function deleteEquipment(
  actor: AuthenticatedActor,
  idValue: string,
  requestIdValue: string,
  config: DatabaseConfig,
): Promise<void> {
  const id = equipmentId(idValue);
  await ensureDatabaseBootstrap(config);
  await withDatabaseTransaction(config, async (database, session) => {
    await requireOwnerAccess(database, actor, id, session);
    const linkedProjects = await database
      .collection("projects")
      .countDocuments(
        { tenantId: actor.tenantId, includedEquipmentIds: id },
        { session },
      );
    if (linkedProjects > 0) {
      conflict("EQUIPMENT_IN_USE");
    }
    await equipments(database).deleteOne(
      { _id: id, tenantId: actor.tenantId },
      { session },
    );
    await grants(database).deleteMany(
      { tenantId: actor.tenantId, equipmentId: id },
      { session },
    );
    await requests(database).deleteMany(
      { tenantId: actor.tenantId, equipmentId: id },
      { session },
    );
    await database.collection("auditEvents").insertOne(
      {
        action: "EQUIPMENT_DELETED",
        actor,
        requestId: requestIdValue,
        context: { equipmentId: id.toHexString() },
        occurredAt: new Date(),
      },
      { session },
    );
    return true;
  });
}

export async function requestEquipmentManageAccess(
  actor: AuthenticatedActor,
  idValue: string,
  requestIdValue: string,
  config: DatabaseConfig,
): Promise<AccessRequestView> {
  const id = equipmentId(idValue);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    const record = await loadEquipment(database, actor, id, session);
    if (record.ownerId === actor.userId) {
      conflict("EQUIPMENT_OWNER_ALREADY_HAS_ACCESS");
    }
    const existingGrant = await grants(database).findOne(
      {
        tenantId: actor.tenantId,
        equipmentId: id,
        userId: actor.userId,
        status: "ACTIVE",
      },
      { session },
    );
    if (existingGrant) {
      conflict("EQUIPMENT_ACCESS_ALREADY_GRANTED");
    }
    const now = new Date();
    const request: EquipmentAccessRequestRecord = {
      _id: new ObjectId(),
      tenantId: actor.tenantId,
      equipmentId: id,
      requesterId: actor.userId,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await requests(database).insertOne(request, { session });
    } catch (error) {
      if (isDuplicateKey(error)) {
        conflict("EQUIPMENT_ACCESS_REQUEST_PENDING");
      }
      throw error;
    }
    await database.collection("auditEvents").insertOne(
      {
        action: "EQUIPMENT_ACCESS_REQUESTED",
        actor,
        requestId: requestIdValue,
        context: { equipmentId: id.toHexString() },
        occurredAt: now,
      },
      { session },
    );
    return accessRequestView(request);
  });
}

export async function listEquipmentAccessRequests(
  actor: AuthenticatedActor,
  idValue: string,
  config: DatabaseConfig,
): Promise<AccessRequestView[]> {
  const id = equipmentId(idValue);
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  await requireOwnerAccess(database, actor, id);
  const records = await requests(database)
    .find({ tenantId: actor.tenantId, equipmentId: id })
    .sort({ createdAt: -1, _id: 1 })
    .toArray();
  return records.map(accessRequestView);
}

export async function decideEquipmentAccessRequest(
  actor: AuthenticatedActor,
  equipmentIdValue: string,
  accessRequestIdValue: string,
  input: AccessDecisionInput,
  correlationId: string,
  config: DatabaseConfig,
): Promise<AccessRequestView> {
  const parsed = accessDecisionSchema.parse(input);
  const id = equipmentId(equipmentIdValue);
  const accessRequestId = requestId(accessRequestIdValue);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    await requireOwnerAccess(database, actor, id, session);
    const pending = await requests(database).findOne(
      {
        _id: accessRequestId,
        tenantId: actor.tenantId,
        equipmentId: id,
      },
      { session },
    );
    if (!pending) {
      notFound("ACCESS_REQUEST_NOT_FOUND");
    }
    if (pending.status !== "PENDING") {
      conflict("ACCESS_REQUEST_ALREADY_DECIDED");
    }
    const now = new Date();
    const status = parsed.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await requests(database).updateOne(
      { _id: accessRequestId, status: "PENDING" },
      {
        $set: {
          status,
          decidedBy: actor.userId,
          decidedAt: now,
          updatedAt: now,
        },
      },
      { session },
    );
    if (status === "APPROVED") {
      await grants(database).updateOne(
        {
          tenantId: actor.tenantId,
          equipmentId: id,
          userId: pending.requesterId,
        },
        {
          $set: {
            status: "ACTIVE",
            grantedBy: actor.userId,
            grantedAt: now,
            updatedAt: now,
          },
          $setOnInsert: { _id: new ObjectId() },
        },
        { upsert: true, session },
      );
    }
    const decided: EquipmentAccessRequestRecord = {
      ...pending,
      status,
      decidedBy: actor.userId,
      decidedAt: now,
      updatedAt: now,
    };
    await database.collection("auditEvents").insertOne(
      {
        action:
          status === "APPROVED"
            ? "EQUIPMENT_ACCESS_APPROVED"
            : "EQUIPMENT_ACCESS_REJECTED",
        actor,
        requestId: correlationId,
        context: {
          equipmentId: id.toHexString(),
          accessRequestId: accessRequestId.toHexString(),
          requesterId: pending.requesterId,
        },
        occurredAt: now,
      },
      { session },
    );
    return accessRequestView(decided);
  });
}

export async function actorCanManageEquipment(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<boolean> {
  try {
    await requireManageAccess(database, actor, id, session);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error.status === 403 || error.status === 404)
    ) {
      return false;
    }
    throw error;
  }
}
