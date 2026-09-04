import "server-only";

import { createHash } from "node:crypto";

import {
  ObjectId,
  type ClientSession,
  type Collection,
  type Db,
} from "mongodb";
import { z } from "zod";

import {
  AuthorizationError,
  requireProjectOwner,
  requireProjectRole,
  type AuthenticatedActor,
  type ProjectMembership,
  type ProjectRole,
} from "@/lib/auth/authorization";
import type { ServerConfig } from "@/lib/config";
import { ensureDatabaseBootstrap } from "@/lib/database/bootstrap";
import { getDatabase, withDatabaseTransaction } from "@/lib/database/mongodb";

import { actorCanManageEquipment, documentsModeSchema } from "./equipments";
import { conflict, forbidden, notFound } from "./errors";

const projectName = z.string().trim().min(1).max(160);
const projectDescription = z.string().trim().min(10).max(1_000);

export const projectStatusSchema = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
]);

export const projectCreateSchema = z
  .object({
    name: projectName,
    description: projectDescription,
    status: projectStatusSchema.default("PLANNING"),
    includedEquipmentIds: z
      .array(z.string().refine(ObjectId.isValid, "Invalid Equipment ID."))
      .max(200)
      .default([]),
    documentsMode: documentsModeSchema.default("SKIP_FOR_NOW"),
  })
  .strict()
  .superRefine(({ includedEquipmentIds }, context) => {
    if (new Set(includedEquipmentIds).size !== includedEquipmentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["includedEquipmentIds"],
        message: "Equipment IDs must be unique.",
      });
    }
  });

export const projectUpdateSchema = z
  .object({
    name: projectName.optional(),
    description: projectDescription.optional(),
    status: projectStatusSchema.optional(),
    includedEquipmentIds: z
      .array(z.string().refine(ObjectId.isValid, "Invalid Equipment ID."))
      .max(200)
      .optional(),
    documentsMode: documentsModeSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one Project field is required.",
  })
  .superRefine(({ includedEquipmentIds }, context) => {
    if (
      includedEquipmentIds &&
      new Set(includedEquipmentIds).size !== includedEquipmentIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["includedEquipmentIds"],
        message: "Equipment IDs must be unique.",
      });
    }
  });

export const projectAccessDecisionSchema = z
  .object({ decision: z.enum(["APPROVE", "REJECT"]) })
  .strict();

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type ProjectAccessDecisionInput = z.infer<
  typeof projectAccessDecisionSchema
>;

interface ProjectRecord {
  _id: ObjectId;
  tenantId: string;
  createdBy: string;
  name: string;
  description: string;
  status: z.infer<typeof projectStatusSchema>;
  includedEquipmentIds: ObjectId[];
  documentsMode: z.infer<typeof documentsModeSchema>;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectMembershipRecord {
  _id: ObjectId;
  tenantId: string;
  projectId: ObjectId;
  userId: string;
  role: ProjectRole;
  status: "ACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectAccessRequestRecord {
  _id: ObjectId;
  tenantId: string;
  projectId: ObjectId;
  requesterId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
}

interface ProcedureGenerationRequestRecord {
  _id: ObjectId;
  tenantId: string;
  projectId: ObjectId;
  generationRequestId: string;
  inputFingerprint: string;
  status: "WAITING_FOR_SOURCES";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectView {
  id: string;
  name: string;
  description: string;
  status: ProjectRecord["status"];
  includedEquipmentIds: string[];
  documentsMode: ProjectRecord["documentsMode"];
  role: ProjectRole;
  procedureGenerationStatus: "WAITING_FOR_SOURCES";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDiscoveryView {
  id: string;
  name: string;
  status: ProjectRecord["status"];
  accessRequestStatus: "NONE" | "PENDING" | "REJECTED";
}

export interface ProjectAccessRequestView {
  id: string;
  resourceId: string;
  requesterId: string;
  status: ProjectAccessRequestRecord["status"];
  createdAt: string;
  updatedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

type DatabaseConfig = Pick<ServerConfig, "MONGODB_URI" | "MONGODB_DB_NAME">;

function projects(database: Db): Collection<ProjectRecord> {
  return database.collection<ProjectRecord>("projects");
}

function memberships(database: Db): Collection<ProjectMembershipRecord> {
  return database.collection<ProjectMembershipRecord>("projectMemberships");
}

function requests(database: Db): Collection<ProjectAccessRequestRecord> {
  return database.collection<ProjectAccessRequestRecord>(
    "projectMembershipRequests",
  );
}

function generationRequests(
  database: Db,
): Collection<ProcedureGenerationRequestRecord> {
  return database.collection<ProcedureGenerationRequestRecord>(
    "procedureGenerationRequests",
  );
}

function projectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    notFound("PROJECT_NOT_FOUND");
  }
  return new ObjectId(value);
}

function accessRequestId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    notFound("ACCESS_REQUEST_NOT_FOUND");
  }
  return new ObjectId(value);
}

function membershipForAuthorization(
  membership: ProjectMembershipRecord | null,
): ProjectMembership | null {
  return membership
    ? {
        projectId: membership.projectId.toHexString(),
        userId: membership.userId,
        tenantId: membership.tenantId,
        role: membership.role,
        status: membership.status,
      }
    : null;
}

async function loadProject(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<ProjectRecord> {
  const record = await projects(database).findOne(
    { _id: id, tenantId: actor.tenantId },
    { session },
  );
  if (!record) {
    notFound("PROJECT_NOT_FOUND");
  }
  return record;
}

async function loadMembership(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<ProjectMembershipRecord | null> {
  return memberships(database).findOne(
    {
      tenantId: actor.tenantId,
      projectId: id,
      userId: actor.userId,
      status: "ACTIVE",
    },
    { session },
  );
}

async function requireMemberAccess(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<{ project: ProjectRecord; membership: ProjectMembershipRecord }> {
  const project = await loadProject(database, actor, id, session);
  const membership = await loadMembership(database, actor, id, session);
  try {
    requireProjectRole(actor, membershipForAuthorization(membership), [
      "OWNER",
      "MEMBER",
    ]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      forbidden("PROJECT_MEMBERSHIP_REQUIRED");
    }
    throw error;
  }
  if (!membership) {
    forbidden("PROJECT_MEMBERSHIP_REQUIRED");
  }
  return { project, membership };
}

async function requireOwnerAccess(
  database: Db,
  actor: AuthenticatedActor,
  id: ObjectId,
  session?: ClientSession,
): Promise<{ project: ProjectRecord; membership: ProjectMembershipRecord }> {
  const project = await loadProject(database, actor, id, session);
  const membership = await loadMembership(database, actor, id, session);
  try {
    requireProjectOwner(actor, membershipForAuthorization(membership));
  } catch (error) {
    if (error instanceof AuthorizationError) {
      forbidden("PROJECT_OWNER_REQUIRED");
    }
    throw error;
  }
  if (!membership) {
    forbidden("PROJECT_OWNER_REQUIRED");
  }
  return { project, membership };
}

function inputFingerprint(
  name: string,
  description: string,
  equipmentIds: ObjectId[],
  documentsMode: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        name,
        description,
        equipmentIds: equipmentIds.map((id) => id.toHexString()).sort(),
        documentsMode,
      }),
    )
    .digest("hex");
}

async function validateIncludedEquipments(
  database: Db,
  actor: AuthenticatedActor,
  ids: ObjectId[],
  session: ClientSession,
): Promise<void> {
  // The MongoDB driver does not support parallel operations within one
  // transaction, so validate each relationship sequentially.
  for (const id of ids) {
    if (!(await actorCanManageEquipment(database, actor, id, session))) {
      forbidden("INCLUDED_EQUIPMENT_ACCESS_REQUIRED");
    }
  }
}

async function generationStatus(
  database: Db,
  project: ProjectRecord,
  session?: ClientSession,
): Promise<"WAITING_FOR_SOURCES"> {
  const request = await generationRequests(database).findOne(
    { tenantId: project.tenantId, projectId: project._id },
    { session, sort: { createdAt: -1 } },
  );
  return request?.status ?? "WAITING_FOR_SOURCES";
}

async function projectView(
  database: Db,
  project: ProjectRecord,
  membership: ProjectMembershipRecord,
  session?: ClientSession,
): Promise<ProjectView> {
  return {
    id: project._id.toHexString(),
    name: project.name,
    description: project.description,
    status: project.status,
    includedEquipmentIds: project.includedEquipmentIds.map((id) =>
      id.toHexString(),
    ),
    documentsMode: project.documentsMode,
    role: membership.role,
    procedureGenerationStatus: await generationStatus(
      database,
      project,
      session,
    ),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function accessRequestView(
  request: ProjectAccessRequestRecord,
): ProjectAccessRequestView {
  return {
    id: request._id.toHexString(),
    resourceId: request.projectId.toHexString(),
    requesterId: request.requesterId,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    ...(request.decidedBy ? { decidedBy: request.decidedBy } : {}),
    ...(request.decidedAt
      ? { decidedAt: request.decidedAt.toISOString() }
      : {}),
  };
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11_000
  );
}

export async function listProjects(
  actor: AuthenticatedActor,
  config: DatabaseConfig,
): Promise<ProjectView[]> {
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  const actorMemberships = await memberships(database)
    .find({
      tenantId: actor.tenantId,
      userId: actor.userId,
      status: "ACTIVE",
    })
    .toArray();
  const membershipByProject = new Map(
    actorMemberships.map((membership) => [
      membership.projectId.toHexString(),
      membership,
    ]),
  );
  const records = await projects(database)
    .find({
      tenantId: actor.tenantId,
      _id: { $in: actorMemberships.map((membership) => membership.projectId) },
    })
    .sort({ updatedAt: -1, _id: 1 })
    .toArray();
  return Promise.all(
    records.map((record) =>
      projectView(
        database,
        record,
        membershipByProject.get(record._id.toHexString())!,
      ),
    ),
  );
}

export async function createProject(
  actor: AuthenticatedActor,
  input: ProjectCreateInput,
  correlationId: string,
  config: DatabaseConfig,
): Promise<ProjectView> {
  const parsed = projectCreateSchema.parse(input);
  const equipmentIds = parsed.includedEquipmentIds.map(
    (id) => new ObjectId(id),
  );
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    await validateIncludedEquipments(database, actor, equipmentIds, session);
    const now = new Date();
    const project: ProjectRecord = {
      _id: new ObjectId(),
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      name: parsed.name,
      description: parsed.description,
      status: parsed.status,
      includedEquipmentIds: equipmentIds,
      documentsMode: parsed.documentsMode,
      createdAt: now,
      updatedAt: now,
    };
    const membership: ProjectMembershipRecord = {
      _id: new ObjectId(),
      tenantId: actor.tenantId,
      projectId: project._id,
      userId: actor.userId,
      role: "OWNER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    const fingerprint = inputFingerprint(
      project.name,
      project.description,
      project.includedEquipmentIds,
      project.documentsMode,
    );
    const generationRequest: ProcedureGenerationRequestRecord = {
      _id: new ObjectId(),
      tenantId: actor.tenantId,
      projectId: project._id,
      generationRequestId: `${project._id.toHexString()}:${fingerprint}`,
      inputFingerprint: fingerprint,
      status: "WAITING_FOR_SOURCES",
      createdAt: now,
      updatedAt: now,
    };
    await projects(database).insertOne(project, { session });
    await memberships(database).insertOne(membership, { session });
    await generationRequests(database).insertOne(generationRequest, {
      session,
    });
    await database.collection("auditEvents").insertOne(
      {
        action: "PROJECT_CREATED",
        actor,
        requestId: correlationId,
        context: {
          projectId: project._id.toHexString(),
          includedEquipmentCount: equipmentIds.length,
          documentsMode: project.documentsMode,
        },
        occurredAt: now,
      },
      { session },
    );
    return projectView(database, project, membership, session);
  });
}

export async function getProject(
  actor: AuthenticatedActor,
  idValue: string,
  config: DatabaseConfig,
): Promise<ProjectView> {
  const id = projectId(idValue);
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  const { project, membership } = await requireMemberAccess(
    database,
    actor,
    id,
  );
  return projectView(database, project, membership);
}

export async function updateProject(
  actor: AuthenticatedActor,
  idValue: string,
  input: ProjectUpdateInput,
  correlationId: string,
  config: DatabaseConfig,
): Promise<ProjectView> {
  const parsed = projectUpdateSchema.parse(input);
  const id = projectId(idValue);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    const { membership } = await requireOwnerAccess(
      database,
      actor,
      id,
      session,
    );
    const equipmentIds = parsed.includedEquipmentIds?.map(
      (equipmentId) => new ObjectId(equipmentId),
    );
    if (equipmentIds) {
      await validateIncludedEquipments(database, actor, equipmentIds, session);
    }
    const updates: Partial<
      Pick<
        ProjectRecord,
        | "name"
        | "description"
        | "status"
        | "includedEquipmentIds"
        | "documentsMode"
      >
    > & { updatedAt: Date } = { updatedAt: new Date() };
    for (const key of [
      "name",
      "description",
      "status",
      "documentsMode",
    ] as const) {
      const value = parsed[key];
      if (value !== undefined) {
        (updates as Record<string, unknown>)[key] = value;
      }
    }
    if (equipmentIds) {
      updates.includedEquipmentIds = equipmentIds;
    }
    const updated = await projects(database).findOneAndUpdate(
      { _id: id, tenantId: actor.tenantId },
      { $set: updates },
      { returnDocument: "after", session },
    );
    if (!updated) {
      notFound("PROJECT_NOT_FOUND");
    }
    await database.collection("auditEvents").insertOne(
      {
        action: "PROJECT_UPDATED",
        actor,
        requestId: correlationId,
        context: {
          projectId: id.toHexString(),
          changedFields: Object.keys(parsed).sort().join(","),
        },
        occurredAt: new Date(),
      },
      { session },
    );
    return projectView(database, updated, membership, session);
  });
}

export async function deleteProject(
  actor: AuthenticatedActor,
  idValue: string,
  correlationId: string,
  config: DatabaseConfig,
): Promise<void> {
  const id = projectId(idValue);
  await ensureDatabaseBootstrap(config);
  await withDatabaseTransaction(config, async (database, session) => {
    await requireOwnerAccess(database, actor, id, session);
    await projects(database).deleteOne(
      { _id: id, tenantId: actor.tenantId },
      { session },
    );
    await memberships(database).deleteMany(
      { tenantId: actor.tenantId, projectId: id },
      { session },
    );
    await requests(database).deleteMany(
      { tenantId: actor.tenantId, projectId: id },
      { session },
    );
    await generationRequests(database).deleteMany(
      { tenantId: actor.tenantId, projectId: id },
      { session },
    );
    await database.collection("auditEvents").insertOne(
      {
        action: "PROJECT_DELETED",
        actor,
        requestId: correlationId,
        context: { projectId: id.toHexString() },
        occurredAt: new Date(),
      },
      { session },
    );
    return true;
  });
}

export async function discoverProjects(
  actor: AuthenticatedActor,
  config: DatabaseConfig,
): Promise<ProjectDiscoveryView[]> {
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  const [actorMemberships, actorRequests] = await Promise.all([
    memberships(database)
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
  const membershipIds = actorMemberships.map(
    (membership) => membership.projectId,
  );
  const latestRequest = new Map<string, ProjectAccessRequestRecord>();
  for (const request of actorRequests) {
    const key = request.projectId.toHexString();
    if (!latestRequest.has(key)) {
      latestRequest.set(key, request);
    }
  }
  const records = await projects(database)
    .find({
      tenantId: actor.tenantId,
      _id: { $nin: membershipIds },
    })
    .project<Pick<ProjectRecord, "_id" | "name" | "status">>({
      name: 1,
      status: 1,
    })
    .sort({ name: 1, _id: 1 })
    .toArray();
  return records.map((project) => {
    const request = latestRequest.get(project._id.toHexString());
    return {
      id: project._id.toHexString(),
      name: project.name,
      status: project.status,
      accessRequestStatus:
        request?.status === "PENDING"
          ? "PENDING"
          : request?.status === "REJECTED"
            ? "REJECTED"
            : "NONE",
    };
  });
}

export async function requestProjectMembership(
  actor: AuthenticatedActor,
  idValue: string,
  correlationId: string,
  config: DatabaseConfig,
): Promise<ProjectAccessRequestView> {
  const id = projectId(idValue);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    await loadProject(database, actor, id, session);
    const membership = await loadMembership(database, actor, id, session);
    if (membership) {
      conflict("PROJECT_MEMBERSHIP_ALREADY_ACTIVE");
    }
    const now = new Date();
    const request: ProjectAccessRequestRecord = {
      _id: new ObjectId(),
      tenantId: actor.tenantId,
      projectId: id,
      requesterId: actor.userId,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await requests(database).insertOne(request, { session });
    } catch (error) {
      if (isDuplicateKey(error)) {
        conflict("PROJECT_ACCESS_REQUEST_PENDING");
      }
      throw error;
    }
    await database.collection("auditEvents").insertOne(
      {
        action: "PROJECT_ACCESS_REQUESTED",
        actor,
        requestId: correlationId,
        context: { projectId: id.toHexString() },
        occurredAt: now,
      },
      { session },
    );
    return accessRequestView(request);
  });
}

export async function listProjectMembershipRequests(
  actor: AuthenticatedActor,
  idValue: string,
  config: DatabaseConfig,
): Promise<ProjectAccessRequestView[]> {
  const id = projectId(idValue);
  await ensureDatabaseBootstrap(config);
  const database = getDatabase(config);
  await requireOwnerAccess(database, actor, id);
  const records = await requests(database)
    .find({ tenantId: actor.tenantId, projectId: id })
    .sort({ createdAt: -1, _id: 1 })
    .toArray();
  return records.map(accessRequestView);
}

export async function decideProjectMembershipRequest(
  actor: AuthenticatedActor,
  projectIdValue: string,
  requestIdValue: string,
  input: ProjectAccessDecisionInput,
  correlationId: string,
  config: DatabaseConfig,
): Promise<ProjectAccessRequestView> {
  const parsed = projectAccessDecisionSchema.parse(input);
  const id = projectId(projectIdValue);
  const membershipRequestId = accessRequestId(requestIdValue);
  await ensureDatabaseBootstrap(config);
  return withDatabaseTransaction(config, async (database, session) => {
    await requireOwnerAccess(database, actor, id, session);
    const pending = await requests(database).findOne(
      {
        _id: membershipRequestId,
        tenantId: actor.tenantId,
        projectId: id,
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
      { _id: membershipRequestId, status: "PENDING" },
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
      await memberships(database).updateOne(
        {
          tenantId: actor.tenantId,
          projectId: id,
          userId: pending.requesterId,
        },
        {
          $set: { role: "MEMBER", status: "ACTIVE", updatedAt: now },
          $setOnInsert: { _id: new ObjectId(), createdAt: now },
        },
        { upsert: true, session },
      );
    }
    const decided: ProjectAccessRequestRecord = {
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
            ? "PROJECT_ACCESS_APPROVED"
            : "PROJECT_ACCESS_REJECTED",
        actor,
        requestId: correlationId,
        context: {
          projectId: id.toHexString(),
          membershipRequestId: membershipRequestId.toHexString(),
          requesterId: pending.requesterId,
        },
        occurredAt: now,
      },
      { session },
    );
    return accessRequestView(decided);
  });
}
