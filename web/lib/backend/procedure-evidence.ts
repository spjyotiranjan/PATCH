import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { createAiServiceClient } from "@/lib/ai/client";
import { sourceUrl, storeProcedureExport } from "@/lib/storage/r2";
import { audit, fail, fingerprint, oid, type Context } from "./context";
import type { Schema } from "./models";
import type { Procedure, ProcedureVersion } from "./procedures";

export interface ProcedureEvidence {
  _id: ObjectId;
  tenantId: string;
  projectId: string;
  procedureId: string;
  objectKey: string;
  sha256: string;
  title: string;
  revision: string;
  extraction: Schema["ExtractResult"];
  index: Schema["IndexResult"];
}

export function procedureText(version: ProcedureVersion) {
  return [
    version.title,
    `Controlled procedure revision ${version.versionNumber}`,
    ...version.steps.flatMap((s) => [
      `\nStep ${s.position}: ${s.title}`,
      s.instructions,
    ]),
  ].join("\n");
}

export async function buildProcedureEvidence(
  ctx: Context,
  versionId: string,
): Promise<ProcedureEvidence> {
  const version = await ctx.db
    .collection<ProcedureVersion>("procedureVersions")
    .findOne({
      _id: oid(versionId),
      tenantId: ctx.actor.tenantId,
      state: "PUBLISHED",
    });
  if (!version) fail("PUBLISHED_PROCEDURE_REQUIRED");
  const existing = await ctx.db
    .collection<ProcedureEvidence>("procedureEvidence")
    .findOne({
      _id: version._id,
      tenantId: ctx.actor.tenantId,
    });
  if (existing) return existing;
  const content = procedureText(version);
  const sha256 = createHash("sha256").update(content).digest("hex");
  const objectKey = `procedures/${ctx.actor.tenantId}/${versionId}/${sha256}.txt`;
  await storeProcedureExport(ctx.config, objectKey, content);
  const sourceFile = {
    url: await sourceUrl(ctx.config, objectKey),
    contentType: "text/plain",
    sha256,
  };
  const client = createAiServiceClient(ctx.config);
  const requestId = randomUUID();
  const extraction = (
    await client.POST("/v1/ingestions/extract", {
      body: {
        requestId,
        contractVersion: "v1",
        documentId: version.procedureId,
        documentVersionId: versionId,
        versionNumber: String(version.versionNumber),
        sourceFile,
        declaredMetadata: {
          title: version.title,
          documentType: "CONTROLLED_PROCEDURE",
        },
      },
    })
  ).data;
  if (
    extraction?.requestId !== requestId ||
    extraction.status !== "needs_review" ||
    extraction.documentVersionId !== versionId ||
    !extraction.pages?.length
  )
    fail("EXTRACTION_FAILED", 503);
  const indexRequestId = randomUUID();
  const index = (
    await client.POST("/v1/ingestions/index", {
      body: {
        requestId: indexRequestId,
        contractVersion: "v1",
        tenantId: ctx.actor.tenantId,
        documentId: version.procedureId,
        documentVersionId: versionId,
        originalFileId: versionId,
        approvalState: "APPROVED",
        sourceFile,
        reviewedMetadata: {
          title: version.title,
          revision: String(version.versionNumber),
          documentType: "CONTROLLED_PROCEDURE",
        },
      },
    })
  ).data;
  if (
    index?.requestId !== indexRequestId ||
    index.status !== "indexed" ||
    index.documentVersionId !== versionId ||
    index.contentFingerprint !== sha256 ||
    !index.chunkCount
  )
    fail("INDEXING_FAILED", 503);
  return {
    _id: version._id,
    tenantId: ctx.actor.tenantId,
    projectId: version.projectId,
    procedureId: version.procedureId,
    objectKey,
    sha256,
    title: version.title,
    revision: String(version.versionNumber),
    extraction,
    index,
  };
}

export async function currentProcedureEvidence(
  ctx: Context,
  projectIds: string[],
  currentDocuments: Schema["AllowedDocumentVersion"][],
) {
  if (!projectIds.length) return [];
  const procedures = await ctx.db
    .collection<Procedure>("safetyProcedures")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        projectId: { $in: projectIds },
        currentPublishedVersionId: { $ne: null },
      },
      { session: ctx.session },
    )
    .limit(501)
    .toArray();
  if (procedures.length > 500) fail("SCOPE_LIMIT_EXCEEDED", 400);
  const versions = await ctx.db
    .collection<ProcedureVersion>("procedureVersions")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        _id: { $in: procedures.map((p) => oid(p.currentPublishedVersionId!)) },
        state: "PUBLISHED",
      },
      { session: ctx.session },
    )
    .toArray();
  const projects = await ctx.db
    .collection("projects")
    .find(
      { tenantId: ctx.actor.tenantId, _id: { $in: projectIds.map(oid) } },
      { session: ctx.session },
    )
    .toArray();
  const eligible = versions.filter((version) => {
    const project = projects.find(
      (p) => p._id.toHexString() === version.projectId,
    );
    const procedure = procedures.find(
      (p) => p._id.toHexString() === version.procedureId,
    );
    if (!project || !procedure) return false;
    const direct = currentDocuments.filter(
      (v) =>
        v.inclusionPaths.includes("PROJECT_DIRECT") &&
        v.sourceEntityIds?.includes(version.projectId),
    );
    const supplemental = currentDocuments.filter(
      (v) =>
        procedure.supplementalEquipmentDocumentIds?.includes(v.documentId) &&
        v.inclusionPaths.includes("EQUIPMENT_DERIVED") &&
        v.sourceEntityIds?.some((id) =>
          project.includedEquipmentIds.map(String).includes(id),
        ),
    );
    const governing = new Set(
      [...direct, ...supplemental].map((v) => v.documentVersionId),
    );
    return (
      version.citations.length > 0 &&
      version.citations.every((c) => governing.has(c.documentVersionId)) &&
      version.inputFingerprint ===
        fingerprint({
          description: project.description,
          versions: direct.map((v) => v.documentVersionId).sort(),
          equipmentIds: project.includedEquipmentIds.map(String).sort(),
          supplementalVersionIds: supplemental
            .map((v) => v.documentVersionId)
            .sort(),
          pipelineVersion: 1,
        })
    );
  });
  return ctx.db
    .collection<ProcedureEvidence>("procedureEvidence")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        _id: { $in: eligible.map((v) => v._id) },
        "index.status": "indexed",
      },
      { session: ctx.session },
    )
    .toArray();
}

export async function procedureSource(ctx: Context, versionId: string) {
  const evidence = await ctx.db
    .collection<ProcedureEvidence>("procedureEvidence")
    .findOne({
      tenantId: ctx.actor.tenantId,
      _id: oid(versionId),
    });
  if (!evidence) fail("PROCEDURE_SOURCE_NOT_READY", 409);
  await audit(ctx, "PROCEDURE_SOURCE_ACCESSED", { versionId });
  return {
    url: await sourceUrl(ctx.config, evidence.objectKey),
    expiresInSeconds: 300,
    documentVersionId: versionId,
    title: evidence.title,
    revision: evidence.revision,
  };
}
