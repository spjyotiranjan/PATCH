import "server-only";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { finalizeUpload, sourceUrl, uploadUrl } from "@/lib/storage/r2";
import {
  audit,
  entityAccess,
  entitySchema,
  fail,
  idSchema,
  invalidateEntity,
  oid,
  queue,
  view,
  type Context,
  type Entity,
} from "./context";
import type { DocumentRecord, LinkRecord, VersionRecord } from "./models";

export const uploadSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    documentType: z.enum([
      "MANUAL",
      "TECHNICAL_PROCEDURE",
      "SAFETY_PROCEDURE",
      "PROJECT_DOCUMENT",
    ]),
    entity: entitySchema,
    contentType: z.enum([
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
    bytes: z.number().int().positive().max(52_428_800),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const versionUploadSchema = uploadSchema.omit({
  title: true,
  documentType: true,
  entity: true,
});
export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    title: z.string().trim().min(1).max(500),
    revision: z.string().trim().min(1).max(100),
    confirmSourceReviewed: z.literal(true),
  })
  .strict();
export const linkSchema = z
  .object({
    documentId: idSchema,
    versionPolicy: z
      .enum(["LATEST_APPROVED", "PINNED"])
      .default("LATEST_APPROVED"),
    pinnedDocumentVersionId: idSchema.nullable().default(null),
    reason: z.string().trim().min(10).max(1000).nullable().default(null),
  })
  .strict()
  .refine((v) =>
    v.versionPolicy === "PINNED"
      ? !!v.pinnedDocumentVersionId && !!v.reason
      : v.pinnedDocumentVersionId === null && v.reason === null,
  );

export async function loadDocument(
  ctx: Context,
  id: string,
  mutate = false,
): Promise<DocumentRecord> {
  const doc = await ctx.db
    .collection<DocumentRecord>("documents")
    .findOne(
      { _id: oid(id), tenantId: ctx.actor.tenantId },
      { session: ctx.session },
    );
  if (!doc) fail("DOCUMENT_NOT_FOUND", 404);
  if (mutate) {
    await entityAccess(ctx, doc.origin, true);
    return doc;
  }
  try {
    await entityAccess(ctx, doc.origin);
    return doc;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("status" in error) ||
      error.status !== 403
    )
      throw error;
  }
  const links = await ctx.db
    .collection<LinkRecord>("documentLinks")
    .find(
      { tenantId: ctx.actor.tenantId, documentId: id },
      { session: ctx.session },
    )
    .toArray();
  for (const link of links) {
    try {
      await entityAccess(ctx, link.entity);
      return doc;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("status" in error) ||
        error.status !== 403
      )
        throw error;
    }
  }
  fail("DOCUMENT_ACCESS_REQUIRED", 403);
}

export async function loadVersion(ctx: Context, id: string, mutate = false) {
  const version = await ctx.db
    .collection<VersionRecord>("documentVersions")
    .findOne(
      { _id: oid(id), tenantId: ctx.actor.tenantId },
      { session: ctx.session },
    );
  if (!version) fail("DOCUMENT_VERSION_NOT_FOUND", 404);
  const document = await loadDocument(ctx, version.documentId, mutate);
  return { version, document };
}

export async function updateDocument(
  ctx: Context,
  id: string,
  updates: { title?: string; archived?: boolean },
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await loadDocument(tx, id, true);
    const changed = await db
      .collection<DocumentRecord>("documents")
      .findOneAndUpdate(
        { _id: oid(id), tenantId: ctx.actor.tenantId },
        {
          $set: {
            ...(updates.title ? { title: updates.title } : {}),
            ...(updates.archived !== undefined
              ? { archivedAt: updates.archived ? new Date() : null }
              : {}),
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after", session },
      );
    const links = await db
      .collection<LinkRecord>("documentLinks")
      .find({ tenantId: ctx.actor.tenantId, documentId: id }, { session })
      .toArray();
    for (const link of links) await invalidateEntity(tx, link.entity);
    await audit(tx, "DOCUMENT_METADATA_UPDATED", {
      documentId: id,
      archived: updates.archived ?? false,
    });
    return view(changed!);
  });
}

export async function createUpload(
  ctx: Context,
  input: z.infer<typeof uploadSchema>,
  documentId?: string,
) {
  if (
    input.bytes > ctx.config.MAX_DOCUMENT_UPLOAD_BYTES ||
    !ctx.config.ALLOWED_DOCUMENT_MIME_TYPES.includes(input.contentType)
  )
    fail("UPLOAD_REJECTED", 400);
  const result = await withDatabaseTransaction(
    ctx.config,
    async (db, session) => {
      const tx = { ...ctx, db, session };
      await entityAccess(tx, input.entity, true);
      const now = new Date();
      let doc: DocumentRecord;
      if (documentId) {
        doc = await loadDocument(tx, documentId, true);
        const updated = await db
          .collection<DocumentRecord>("documents")
          .findOneAndUpdate(
            { _id: doc._id, tenantId: ctx.actor.tenantId },
            { $inc: { nextVersion: 1 }, $set: { updatedAt: now } },
            { returnDocument: "after", session },
          );
        doc = updated!;
      } else {
        doc = {
          _id: new ObjectId(),
          tenantId: ctx.actor.tenantId,
          ownerId: ctx.actor.userId,
          origin: input.entity,
          title: input.title,
          documentType: input.documentType,
          activeVersionId: null,
          nextVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        await db
          .collection<DocumentRecord>("documents")
          .insertOne(doc, { session });
        await db.collection<LinkRecord>("documentLinks").insertOne(
          {
            _id: new ObjectId(),
            tenantId: ctx.actor.tenantId,
            documentId: doc._id.toHexString(),
            entity: input.entity,
            versionPolicy: "LATEST_APPROVED",
            pinnedDocumentVersionId: null,
            reason: null,
            createdAt: now,
          },
          { session },
        );
      }
      const id = new ObjectId();
      const version: VersionRecord = {
        _id: id,
        tenantId: ctx.actor.tenantId,
        documentId: doc._id.toHexString(),
        versionNumber: doc.nextVersion,
        objectKey: `${ctx.config.R2_DOCUMENT_KEY_PREFIX}/${ctx.actor.tenantId}/${doc._id}/${id}`,
        contentType: input.contentType,
        bytes: input.bytes,
        sha256: input.sha256,
        state: "UPLOADING",
        approvalState: "PENDING",
        uploadExpiresAt: new Date(
          Date.now() + ctx.config.R2_PRESIGNED_URL_TTL_SECONDS * 1000,
        ),
        previousActiveVersionId: doc.activeVersionId,
        createdAt: now,
        updatedAt: now,
      };
      await db
        .collection<VersionRecord>("documentVersions")
        .insertOne(version, { session });
      await audit(tx, "DOCUMENT_UPLOAD_CREATED", {
        documentId: version.documentId,
        versionId: id.toHexString(),
      });
      return version;
    },
  );
  return {
    documentId: result.documentId,
    documentVersionId: result._id.toHexString(),
    versionNumber: result.versionNumber,
    uploadUrl: await uploadUrl(
      ctx.config,
      `${result.objectKey}.upload`,
      result.contentType,
      result.bytes,
    ),
    expiresAt: result.uploadExpiresAt,
    headers: { "Content-Type": result.contentType },
  };
}

export async function completeUpload(ctx: Context, id: string) {
  const { version } = await loadVersion(ctx, id, true);
  if (version.uploadCompletedAt)
    return { documentVersionId: id, state: version.state };
  if (version.state !== "UPLOADING" || version.uploadExpiresAt < new Date())
    fail("UPLOAD_NOT_COMPLETABLE");
  const locked = await ctx.db
    .collection<VersionRecord>("documentVersions")
    .updateOne(
      { _id: oid(id), tenantId: ctx.actor.tenantId, state: "UPLOADING" },
      { $set: { state: "FINALIZING", updatedAt: new Date() } },
    );
  if (!locked.modifiedCount) fail("UPLOAD_BUSY");
  try {
    await finalizeUpload(
      ctx.config,
      `${version.objectKey}.upload`,
      version.objectKey,
      version.bytes,
      version.contentType,
    );
  } catch {
    await ctx.db
      .collection<VersionRecord>("documentVersions")
      .updateOne(
        { _id: oid(id), state: "FINALIZING" },
        { $set: { state: "FAILED", updatedAt: new Date() } },
      );
    fail("UPLOAD_VERIFICATION_FAILED", 400);
  }
  await withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await loadVersion(tx, id, true);
    await db.collection<VersionRecord>("documentVersions").updateOne(
      { _id: oid(id), state: "FINALIZING" },
      {
        $set: {
          state: "EXTRACTING",
          uploadCompletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session },
    );
    await queue(tx, "EXTRACT", `extract:${id}`, { versionId: id });
    await audit(tx, "DOCUMENT_UPLOAD_COMPLETED", { versionId: id });
    return true;
  });
  return { documentVersionId: id, state: "EXTRACTING" };
}

export async function reviewVersion(
  ctx: Context,
  id: string,
  input: z.infer<typeof reviewSchema>,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const { version, document } = await loadVersion(tx, id, true);
    if (version.state !== "NEEDS_REVIEW" || !version.extraction?.pages?.length)
      fail("VERSION_NOT_REVIEWABLE");
    const approved = input.decision === "APPROVE";
    await db.collection<VersionRecord>("documentVersions").updateOne(
      { _id: oid(id), state: "NEEDS_REVIEW" },
      {
        $set: {
          approvalState: approved ? "APPROVED" : "REJECTED",
          state: approved ? "INDEXING" : "FAILED",
          reviewedMetadata: {
            title: input.title,
            revision: input.revision,
            documentType: document.documentType,
          },
          approvedBy: ctx.actor.userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session },
    );
    if (approved) await queue(tx, "INDEX", `index:${id}`, { versionId: id });
    await audit(tx, approved ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED", {
      versionId: id,
    });
    return { documentVersionId: id, state: approved ? "INDEXING" : "FAILED" };
  });
}

export async function activateVersion(ctx: Context, id: string) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    const { version, document } = await loadVersion(tx, id, true);
    if (document.activeVersionId === id)
      return { documentId: version.documentId, activeVersionId: id };
    if (
      version.state !== "INDEXED" ||
      version.approvalState !== "APPROVED" ||
      version.index?.status !== "indexed" ||
      version.index.contentFingerprint !== version.sha256 ||
      version.index.chunkCount < 1
    )
      fail("VERSION_NOT_ACTIVATABLE");
    if (document.activeVersionId !== version.previousActiveVersionId)
      fail("ACTIVE_VERSION_CHANGED");
    const changed = await db.collection<DocumentRecord>("documents").updateOne(
      {
        _id: document._id,
        tenantId: ctx.actor.tenantId,
        activeVersionId: version.previousActiveVersionId,
      },
      {
        $set: {
          activeVersionId: id,
          title: version.reviewedMetadata!.title,
          updatedAt: new Date(),
        },
      },
      { session },
    );
    if (!changed.modifiedCount) fail("ACTIVE_VERSION_CHANGED");
    if (document.activeVersionId)
      await db
        .collection<VersionRecord>("documentVersions")
        .updateOne(
          { _id: oid(document.activeVersionId), tenantId: ctx.actor.tenantId },
          { $set: { state: "SUPERSEDED" } },
          { session },
        );
    await db
      .collection<VersionRecord>("documentVersions")
      .updateOne(
        { _id: oid(id) },
        { $set: { state: "ACTIVE", updatedAt: new Date() } },
        { session },
      );
    const links = await db
      .collection<LinkRecord>("documentLinks")
      .find(
        {
          tenantId: ctx.actor.tenantId,
          documentId: version.documentId,
          versionPolicy: "LATEST_APPROVED",
        },
        { session },
      )
      .toArray();
    for (const link of links) await invalidateEntity(tx, link.entity);
    await audit(tx, "DOCUMENT_VERSION_ACTIVATED", {
      documentId: version.documentId,
      versionId: id,
      supersededVersionId: document.activeVersionId,
    });
    return {
      documentId: version.documentId,
      activeVersionId: id,
      supersededVersionId: document.activeVersionId,
      affectedEntities: links.map((l) => l.entity),
    };
  });
}

export async function linkDocument(
  ctx: Context,
  entity: Entity,
  input: z.infer<typeof linkSchema>,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await entityAccess(tx, entity, true);
    await loadDocument(tx, input.documentId);
    if (input.versionPolicy === "PINNED") {
      const { version } = await loadVersion(tx, input.pinnedDocumentVersionId!);
      if (
        version.documentId !== input.documentId ||
        version.approvalState !== "APPROVED" ||
        !version.index
      )
        fail("PINNED_VERSION_INVALID", 400);
    }
    await db.collection<LinkRecord>("documentLinks").updateOne(
      {
        tenantId: ctx.actor.tenantId,
        "entity.type": entity.type,
        "entity.id": entity.id,
        documentId: input.documentId,
      },
      {
        $set: { entity, ...input },
        $setOnInsert: {
          _id: new ObjectId(),
          tenantId: ctx.actor.tenantId,
          createdAt: new Date(),
        },
      },
      { upsert: true, session },
    );
    await invalidateEntity(tx, entity);
    await audit(tx, "DOCUMENT_LINKED", {
      documentId: input.documentId,
      entityId: entity.id,
      versionPolicy: input.versionPolicy,
    });
    return { linked: true };
  });
}

export async function unlinkDocument(
  ctx: Context,
  entity: Entity,
  documentId: string,
) {
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await entityAccess(tx, entity, true);
    await db.collection("documentLinks").deleteOne(
      {
        tenantId: ctx.actor.tenantId,
        "entity.type": entity.type,
        "entity.id": entity.id,
        documentId,
      },
      { session },
    );
    await invalidateEntity(tx, entity);
    await audit(tx, "DOCUMENT_UNLINKED", { documentId, entityId: entity.id });
    return { unlinked: true };
  });
}

export async function sourceAccess(ctx: Context, id: string) {
  const { version } = await loadVersion(ctx, id);
  if (!version.uploadCompletedAt) fail("SOURCE_UNAVAILABLE", 404);
  await audit(ctx, "DOCUMENT_SOURCE_OPENED", { versionId: id });
  return {
    documentVersionId: id,
    url: await sourceUrl(
      ctx.config,
      version.objectKey,
      version.contentType !== "application/pdf",
    ),
    expiresIn: Math.min(ctx.config.R2_PRESIGNED_URL_TTL_SECONDS, 300),
  };
}

export function versionView(version: VersionRecord) {
  const { objectKey: _key, ...safe } = view(version);
  void _key;
  return safe;
}
