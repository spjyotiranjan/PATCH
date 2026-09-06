import "server-only";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { entityAccess, fail, oid, type Context, type Entity } from "./context";
import {
  currentProcedureEvidence,
  type ProcedureEvidence,
} from "./procedure-evidence";
import type {
  DocumentRecord,
  LinkRecord,
  ProfileRecord,
  Schema,
  VersionRecord,
} from "./models";

export async function accessibleEntities(
  ctx: Context,
  only?: Entity,
): Promise<Entity[]> {
  if (only) {
    await entityAccess(ctx, only);
    if (only.type !== "PROJECT") return [only];
    const project = await ctx.db
      .collection("projects")
      .findOne(
        { _id: oid(only.id), tenantId: ctx.actor.tenantId },
        { session: ctx.session },
      );
    return [
      only,
      ...project!.includedEquipmentIds.map((id: { toHexString(): string }) => ({
        type: "EQUIPMENT" as const,
        id: id.toHexString(),
      })),
    ];
  }
  const memberships = await ctx.db
    .collection("projectMemberships")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        userId: ctx.actor.userId,
        status: "ACTIVE",
      },
      { session: ctx.session },
    )
    .limit(201)
    .toArray();
  if (memberships.length > 200) fail("SCOPE_LIMIT_EXCEEDED", 400);
  const projects = await ctx.db
    .collection("projects")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        _id: { $in: memberships.map((m) => m.projectId) },
      },
      { session: ctx.session },
    )
    .toArray();
  const grants = await ctx.db
    .collection("equipmentManageAccess")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        userId: ctx.actor.userId,
        status: "ACTIVE",
      },
      { session: ctx.session },
    )
    .toArray();
  const equipments = await ctx.db
    .collection("equipments")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        $or: [
          { ownerId: ctx.actor.userId },
          { _id: { $in: grants.map((g) => g.equipmentId) } },
        ],
      },
      { session: ctx.session },
    )
    .limit(501)
    .toArray();
  const equipmentIds = new Set<string>(
    equipments.map((e) => e._id.toHexString()),
  );
  for (const p of projects)
    for (const id of p.includedEquipmentIds) equipmentIds.add(String(id));
  if (equipmentIds.size + projects.length > 500)
    fail("SCOPE_LIMIT_EXCEEDED", 400);
  return [
    { type: "PERSONAL", id: ctx.actor.userId },
    ...projects.map((p) => ({
      type: "PROJECT" as const,
      id: p._id.toHexString(),
    })),
    ...Array.from(equipmentIds, (id) => ({ type: "EQUIPMENT" as const, id })),
  ];
}

export async function composedDocuments(ctx: Context, only?: Entity) {
  const entities = await accessibleEntities(ctx, only);
  const links = await ctx.db
    .collection<LinkRecord>("documentLinks")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        $or: entities.map((e) => ({
          "entity.type": e.type,
          "entity.id": e.id,
        })),
      },
      { session: ctx.session },
    )
    .limit(5001)
    .toArray();
  if (links.length > 5000) fail("SCOPE_LIMIT_EXCEEDED", 400);
  const ids = [...new Set(links.map((l) => l.documentId))];
  const documents = await ctx.db
    .collection<DocumentRecord>("documents")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        _id: { $in: ids.map(oid) },
        archivedAt: null,
      },
      { session: ctx.session },
    )
    .limit(1001)
    .toArray();
  if (documents.length > 1000) fail("SCOPE_LIMIT_EXCEEDED", 400);
  return { entities, links, documents };
}

export async function resolveManifest(
  ctx: Context,
  only?: Entity,
): Promise<Schema["RetrievalScopeManifest"]> {
  return trace
    .getTracer("patch-web")
    .startActiveSpan("patch_web.scope.resolve", async (span) => {
      span.setAttribute("requestId", ctx.requestId);
      try {
        const manifest = await resolveManifestRecords(ctx, only);
        span.setAttribute(
          "documentVersionCount",
          manifest.allowedDocumentVersions?.length ?? 0,
        );
        span.setAttribute("entityCount", manifest.entities?.length ?? 0);
        span.setAttribute(
          "relationshipCount",
          manifest.relationships?.length ?? 0,
        );
        return manifest;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "SCOPE_RESOLUTION_FAILED",
        });
        throw error;
      } finally {
        span.end();
      }
    });
}

async function resolveManifestRecords(
  ctx: Context,
  only?: Entity,
): Promise<Schema["RetrievalScopeManifest"]> {
  const { entities, links, documents } = await composedDocuments(ctx, only);
  const versions = await ctx.db
    .collection<VersionRecord>("documentVersions")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        _id: {
          $in: documents.flatMap((d) =>
            d.activeVersionId ? [oid(d.activeVersionId)] : [],
          ),
        },
        approvalState: "APPROVED",
        state: "ACTIVE",
      },
      { session: ctx.session },
    )
    .toArray();
  const active = new Map(
    versions
      .filter((v) => v.index?.status === "indexed")
      .map((v) => [v.documentId, v]),
  );
  const profiles = await ctx.db
    .collection<ProfileRecord>("entityProfiles")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        entityId: { $in: entities.map((e) => e.id) },
      },
      { session: ctx.session },
    )
    .toArray();
  const manifest: Schema["RetrievalScopeManifest"] = {
    allowedDocumentVersions: [],
    entities: [],
    relationships: [],
  };
  for (const doc of documents) {
    const version = active.get(doc._id.toHexString());
    if (!version) continue;
    const paths = links.filter(
      (l) =>
        l.documentId === doc._id.toHexString() &&
        (l.versionPolicy === "LATEST_APPROVED" ||
          l.pinnedDocumentVersionId === doc.activeVersionId),
    );
    if (!paths.length) continue;
    const inclusions = [
      ...new Set(
        paths.map((l) =>
          l.entity.type === "PERSONAL"
            ? ("PERSONAL" as const)
            : l.entity.type === "PROJECT"
              ? ("PROJECT_DIRECT" as const)
              : ("EQUIPMENT_DERIVED" as const),
        ),
      ),
    ];
    manifest.allowedDocumentVersions!.push({
      documentId: doc._id.toHexString(),
      documentVersionId: version._id.toHexString(),
      inclusionPaths: inclusions,
      sourceEntityIds: [
        ...new Set(
          paths
            .filter((l) => l.entity.type !== "PERSONAL")
            .map((l) => l.entity.id),
        ),
      ],
    });
  }
  const procedureEvidence = await currentProcedureEvidence(
    ctx,
    entities.filter((e) => e.type === "PROJECT").map((e) => e.id),
    manifest.allowedDocumentVersions!,
  );
  for (const evidence of procedureEvidence)
    manifest.allowedDocumentVersions!.push({
      documentId: evidence.procedureId,
      documentVersionId: evidence._id.toHexString(),
      inclusionPaths: ["PROJECT_PROCEDURE"],
      sourceEntityIds: [evidence.projectId],
    });
  if (manifest.allowedDocumentVersions!.length > 1000)
    fail("SCOPE_LIMIT_EXCEEDED", 400);
  for (const entity of entities.filter((e) => e.type !== "PERSONAL")) {
    const profile = profiles.find(
      (p) => p.entityId === entity.id && p.entityType === entity.type,
    );
    const direct = manifest
      .allowedDocumentVersions!.filter(
        (v) =>
          (v.inclusionPaths.includes("PROJECT_PROCEDURE") &&
            v.sourceEntityIds?.includes(entity.id)) ||
          links.some(
            (l) =>
              l.documentId === v.documentId &&
              l.entity.id === entity.id &&
              l.entity.type === entity.type &&
              (l.versionPolicy === "LATEST_APPROVED" ||
                l.pinnedDocumentVersionId === v.documentVersionId),
          ),
      )
      .map((v) => v.documentVersionId);
    manifest.entities!.push({
      type: entity.type as "EQUIPMENT" | "PROJECT",
      id: entity.id,
      directDocumentVersionIds: direct,
      profileId: profile?.result?.profileId ?? null,
      profileVersion: profile?.result?.profileVersion ?? null,
      profileState: !profile?.result
        ? "MISSING"
        : profile.state === "FRESH"
          ? "FRESH"
          : "STALE",
    });
    if (entity.type === "PROJECT") {
      const project = await ctx.db
        .collection("projects")
        .findOne(
          { _id: oid(entity.id), tenantId: ctx.actor.tenantId },
          { session: ctx.session },
        );
      manifest.relationships!.push({
        projectId: entity.id,
        equipmentIds: project!.includedEquipmentIds.map(String),
        directDocumentVersionIds: direct,
      });
    }
  }
  return manifest;
}

export function assignedVersionIds(
  manifest: Schema["RetrievalScopeManifest"],
  refs: Schema["AssignedReference"][],
): Set<string> {
  const versions = manifest.allowedDocumentVersions ?? [];
  if (!refs.length) return new Set(versions.map((v) => v.documentVersionId));
  if (new Set(refs.map((r) => `${r.type}:${r.id}`)).size !== refs.length)
    fail("DUPLICATE_REFERENCE", 400);
  const allowed = new Set<string>();
  for (const ref of refs) {
    if (ref.type === "DOCUMENT") {
      const match = versions.find(
        (v) => v.documentId === ref.id || v.documentVersionId === ref.id,
      );
      if (!match) fail("REFERENCE_NOT_ACCESSIBLE", 403);
      allowed.add(match.documentVersionId);
    } else {
      const entity = manifest.entities?.find(
        (e) =>
          e.id === ref.id && (ref.type === "ENTITY" || e.type === ref.type),
      );
      if (!entity) fail("REFERENCE_NOT_ACCESSIBLE", 403);
      for (const id of entity.directDocumentVersionIds ?? []) allowed.add(id);
      const rel = manifest.relationships?.find((r) => r.projectId === ref.id);
      for (const equipmentId of rel?.equipmentIds ?? [])
        for (const id of manifest.entities?.find((e) => e.id === equipmentId)
          ?.directDocumentVersionIds ?? [])
          allowed.add(id);
    }
  }
  return allowed;
}

export async function validateCitations(
  ctx: Context,
  citations: Schema["Citation"][],
  manifest: Schema["RetrievalScopeManifest"],
  allowed = assignedVersionIds(manifest, []),
) {
  if (
    new Set(citations.map((c) => c.id)).size !== citations.length ||
    citations.length > 100
  )
    fail("AI_CITATIONS_INVALID", 502);
  for (const citation of citations) {
    const entry = manifest.allowedDocumentVersions?.find(
      (v) => v.documentVersionId === citation.documentVersionId,
    );
    if (
      !entry ||
      !allowed.has(citation.documentVersionId) ||
      citation.documentId !== entry.documentId ||
      citation.approvalState !== "APPROVED" ||
      !citation.excerpt?.trim() ||
      !citation.chunkId?.startsWith(`${citation.documentVersionId}:`)
    )
      fail("AI_CITATIONS_INVALID", 502);
    if (entry.inclusionPaths.includes("PROJECT_PROCEDURE")) {
      const evidence = await ctx.db
        .collection<ProcedureEvidence>("procedureEvidence")
        .findOne(
          {
            _id: oid(citation.documentVersionId),
            tenantId: ctx.actor.tenantId,
          },
          { session: ctx.session },
        );
      if (
        !evidence ||
        citation.documentTitle !== evidence.title ||
        citation.revision !== evidence.revision ||
        !evidence.extraction.pages?.some(
          (p) =>
            p.page === citation.page &&
            p.section === citation.section &&
            p.text.includes(citation.excerpt),
        )
      )
        fail("AI_CITATIONS_INVALID", 502);
      continue;
    }
    const version = await ctx.db
      .collection<VersionRecord>("documentVersions")
      .findOne(
        {
          _id: oid(citation.documentVersionId),
          tenantId: ctx.actor.tenantId,
          state: "ACTIVE",
          approvalState: "APPROVED",
        },
        { session: ctx.session },
      );
    if (
      !version ||
      citation.revision !== version.reviewedMetadata?.revision ||
      citation.documentTitle !== version.reviewedMetadata?.title ||
      !version.extraction?.pages?.some(
        (p) =>
          p.page === citation.page &&
          p.section === citation.section &&
          p.text.includes(citation.excerpt),
      )
    )
      fail("AI_CITATIONS_INVALID", 502);
  }
}

export async function validateAnswer(
  ctx: Context,
  answer: Schema["QuestionResult"],
  request: Schema["QuestionRequest"],
) {
  if (
    answer.requestId !== request.requestId ||
    answer.chatSession.id !== request.chatSession.id ||
    answer.answer.summary ||
    ![
      "approved",
      "incomplete",
      "conflicting",
      "outdated",
      "unavailable",
    ].includes(answer.status)
  )
    fail("AI_RESPONSE_INVALID", 502);
  const allowed = assignedVersionIds(
    request.retrievalScopeManifest,
    request.assignedReferences ?? [],
  );
  await validateCitations(
    ctx,
    answer.citations ?? [],
    request.retrievalScopeManifest,
    allowed,
  );
  const ids = new Set(answer.citations?.map((c) => c.id));
  for (const step of answer.answer.steps ?? [])
    if (!step.citationIds.length || step.citationIds.some((id) => !ids.has(id)))
      fail("AI_CITATIONS_INVALID", 502);
  if (
    ["outdated", "conflicting", "unavailable"].includes(answer.status) &&
    (answer.answer.steps?.length || answer.citations?.length)
  )
    fail("AI_RESPONSE_INVALID", 502);
  if (answer.status === "approved" && !answer.answer.steps?.length)
    fail("AI_RESPONSE_INVALID", 502);
  for (const entity of answer.routing.selectedEntities ?? [])
    if (
      !request.retrievalScopeManifest.entities?.some(
        (e) => e.id === entity.id && e.type === entity.type,
      )
    )
      fail("AI_ROUTING_INVALID", 502);
}
