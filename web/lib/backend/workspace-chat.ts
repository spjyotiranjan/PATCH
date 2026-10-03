import "server-only";
import { composedDocuments } from "./scope";
import { oid, type Context } from "./context";
import type { Schema } from "./models";
import type { Procedure, ProcedureVersion, ProcedureRun } from "./procedures";

// Reviewed application instructions, not prompts or operating/safety evidence.
export const workspaceHelp: Schema["WorkspaceHelp"][] = [
  {
    id: "patch-help-v1:chat",
    title: "Chat and sources",
    text: "Ask about accessible Projects, Equipments, documents, maintenance logs, procedures or PATCH workflows. Attachments are optional: Chat finds current accessible context automatically. @project:, @equipment: and @documents: explicitly focus context. Technical answers require current approved indexed sources, with citations. Evidence used opens exact authorized sources. Missing evidence is a limitation, not an unrelated request. Chat does not create, edit, submit, approve, publish or complete records; use the matching application controls.",
  },
  {
    id: "patch-help-v1:projects",
    title: "Projects and Equipments",
    text: "Projects: open Projects, choose New Project, enter name and required description, select included Equipments you can manage, then add documents or skip. Project creator is Owner; Owners approve membership and mutate Projects, Members read. Equipments: open Equipments, choose Add Equipment, enter name, type and location; model/description are optional. Equipment owner approves manage access. Equipment manage access never grants Project membership. Settings supports display name and Light/Dark/System theme; email is read-only.",
  },
  {
    id: "patch-help-v1:documents",
    title: "Documents and revisions",
    text: "Use Documents or an entity's Documents tab. Add new document creates a logical record; Add new version selects an existing logical document. Choose the original PDF, TXT, Markdown or supported DOCX up to 50 MiB and upload. Processing follows Upload, Extract, Review, Approve, Index, Active. Compare extraction with the original before approving. A new revision becomes active only after approval/indexing; failed indexing retains the previous active revision. Project documents combine direct links and included Equipment links, without copying files. Browser upload transfer failures can mean R2 CORS or network failure; retry the retained session or restart if its signed upload URL expired. Chat cannot inspect private provider configuration.",
  },
  {
    id: "patch-help-v1:logs",
    title: "Maintenance logs",
    text: "Maintenance logs are inside a Project. Open its Maintenance logs tab, choose overall Project or an included Equipment, enter observed work and optional authorized attachments/evidence, save the draft, then submit final wording. Logs are DRAFT or SUBMITTED; they record user observations and are not approved technical operating guidance. Chat never infers that physical work happened from a question.",
  },
  {
    id: "patch-help-v1:procedures",
    title: "Procedures and runs",
    text: "Open a Project's Procedures tab. Generation waits for its description and at least one approved indexed direct Project source. Review the draft, citations and review analysis; edit/reorder with stable steps, save, revalidate and request review. Owner review/approval and publication are separate; severe unresolved blockers prevent publication. Published definitions are immutable. Schedules create distinct dated runs; new periods start unchecked, retaining history. Required incomplete steps prevent normal completion. Chat cannot approve, publish, tick or complete a run. Use the application's explicit reviewed controls.",
  },
];

/** Current product metadata; never document content, routing profiles or secrets. */
export async function resolveWorkspaceCatalog(
  ctx: Context,
  manifest: Schema["RetrievalScopeManifest"],
  refs: Schema["AssignedReference"][] = [],
): Promise<Schema["WorkspaceCatalog"]> {
  const composed = await composedDocuments(ctx);
  let entities = composed.entities
    .filter((e) => e.type !== "PERSONAL")
    .sort((a, b) => a.id.localeCompare(b.id));
  let documents = composed.documents.sort((a, b) =>
    a._id.toHexString().localeCompare(b._id.toHexString()),
  );
  if (refs.length) {
    const selected = new Set(
      refs.filter((r) => r.type !== "DOCUMENT").map((r) => r.id),
    );
    for (const relationship of manifest.relationships ?? [])
      if (selected.has(relationship.projectId))
        relationship.equipmentIds?.forEach((id) => selected.add(id));
    const documentIds = new Set(
      refs.filter((r) => r.type === "DOCUMENT").map((r) => r.id),
    );
    const explicitDocuments = documents.filter(
      (d) =>
        documentIds.has(d._id.toHexString()) ||
        (d.activeVersionId && documentIds.has(d.activeVersionId)),
    );
    documents = documents.filter(
      (d) =>
        explicitDocuments.includes(d) ||
        composed.links.some(
          (l) =>
            l.documentId === d._id.toHexString() && selected.has(l.entity.id),
        ),
    );
    // A document assignment does not silently widen to its parent Project/Equipment.
    entities = entities.filter((e) => selected.has(e.id));
  }
  const catalog: Schema["WorkspaceCatalog"] = {
    entities: [],
    documents: [],
    partial: entities.length > 100 || documents.length > 200,
    workflowRecords: [],
    help: workspaceHelp,
  };
  for (const entity of entities.slice(0, 100)) {
    const row = await ctx.db
      .collection(entity.type === "PROJECT" ? "projects" : "equipments")
      .findOne(
        { _id: oid(entity.id), tenantId: ctx.actor.tenantId },
        { session: ctx.session },
      );
    if (!row) continue;
    catalog.entities.push({
      id: entity.id,
      type: entity.type as "PROJECT" | "EQUIPMENT",
      name: String(row.name ?? "Unnamed record").slice(0, 200),
      description: String(row.description ?? "").slice(0, 1000),
      status: String(row.status ?? row.operationalState ?? "UNKNOWN"),
      equipmentIds:
        entity.type === "PROJECT"
          ? (row.includedEquipmentIds as { toHexString(): string }[]).map(
              (id) => id.toHexString(),
            )
          : [],
      attributes:
        entity.type === "EQUIPMENT"
          ? {
              type: String(row.type ?? ""),
              model: String(row.model ?? ""),
              location: String(row.location ?? ""),
            }
          : {},
    });
    if (String(row.description ?? "").length > 1000) catalog.partial = true;
  }
  const versions = await ctx.db
    .collection("documentVersions")
    .find(
      {
        tenantId: ctx.actor.tenantId,
        documentId: {
          $in: documents.slice(0, 200).map((d) => d._id.toHexString()),
        },
      },
      { session: ctx.session },
    )
    .sort({ versionNumber: -1 })
    .limit(1001)
    .toArray();
  if (versions.length > 1000) catalog.partial = true;
  for (const doc of documents.slice(0, 200)) {
    const links = composed.links.filter(
      (l) => l.documentId === doc._id.toHexString(),
    );
    catalog.documents.push({
      id: doc._id.toHexString(),
      title: String(doc.title ?? "Untitled document").slice(0, 200),
      entityIds: [...new Set(links.map((l) => l.entity.id))],
      activeVersionId: doc.activeVersionId ?? null,
      evidenceAvailable: (manifest.allowedDocumentVersions ?? []).some(
        (v) => v.documentId === doc._id.toHexString(),
      ),
      documentType: doc.documentType ?? "",
      processingState: String(
        versions.find((v) => v.documentId === doc._id.toHexString())?.state ??
          "",
      ),
    });
  }
  const projectIds = catalog.entities
    .filter((e) => e.type === "PROJECT")
    .map((e) => e.id);
  const filter = {
    tenantId: ctx.actor.tenantId,
    projectId: { $in: projectIds },
  };
  const logs = await ctx.db
    .collection("maintenanceLogs")
    .find(filter, { session: ctx.session })
    .sort({ updatedAt: -1, _id: 1 })
    .limit(41)
    .toArray();
  const procedures = await ctx.db
    .collection<Procedure>("safetyProcedures")
    .find(filter, { session: ctx.session })
    .sort({ _id: 1 })
    .limit(31)
    .toArray();
  const runs = await ctx.db
    .collection<ProcedureRun>("procedureRuns")
    .find(filter, { session: ctx.session })
    .sort({ periodStart: -1, _id: 1 })
    .limit(31)
    .toArray();
  if (logs.length > 40 || procedures.length > 30 || runs.length > 30)
    catalog.partial = true;
  for (const log of logs.slice(0, 40)) {
    if (String(log.text ?? "").length > 2000) catalog.partial = true;
    catalog.workflowRecords!.push({
      id: log._id.toHexString(),
      type: "LOG",
      projectId: log.projectId,
      title: `${log.scopeType === "EQUIPMENT" ? "Equipment" : "Project"} maintenance log`,
      text: String(log.text ?? "").slice(0, 2000),
      status: log.state,
    });
  }
  for (const procedure of procedures.slice(0, 30)) {
    const version = await ctx.db
      .collection<ProcedureVersion>("procedureVersions")
      .find(
        {
          tenantId: ctx.actor.tenantId,
          projectId: procedure.projectId,
          procedureId: procedure._id.toHexString(),
        },
        { session: ctx.session },
      )
      .sort({ versionNumber: -1 })
      .limit(1)
      .toArray();
    catalog.workflowRecords!.push({
      id: procedure._id.toHexString(),
      type: "PROCEDURE",
      projectId: procedure.projectId,
      title: procedure.title,
      text: `Current published version: ${procedure.currentPublishedVersionId ?? "None"}. Latest version state: ${version[0]?.state ?? "None"}. Review need: ${version[0]?.reviewAnalysis?.reviewNeed ?? "Not available"}.`,
      status: version[0]?.state ?? "WAITING_FOR_SOURCES",
    });
  }
  for (const run of runs.slice(0, 30))
    catalog.workflowRecords!.push({
      id: run._id.toHexString(),
      type: "RUN",
      projectId: run.projectId,
      title: "Procedure run",
      status: run.state,
      text: `Period: ${run.periodStart.toISOString()} to ${run.periodEnd.toISOString()}. ${run.steps.filter((s) => s.checked).length} of ${run.steps.length} steps checked. Recorded progress is not safety approval.`,
    });
  const cleanRelationships = () => {
    const ids = new Set(catalog.entities.map((e) => e.id));
    const equipment = new Set(
      catalog.entities.filter((e) => e.type === "EQUIPMENT").map((e) => e.id),
    );
    catalog.entities.forEach((e) => {
      e.equipmentIds = e.equipmentIds?.filter((id) => equipment.has(id)) ?? [];
    });
    catalog.documents.forEach((d) => {
      d.entityIds = d.entityIds.filter((id) => ids.has(id));
    });
    catalog.workflowRecords = catalog.workflowRecords?.filter((r) =>
      ids.has(r.projectId),
    );
  };
  cleanRelationships();
  while (Buffer.byteLength(JSON.stringify(catalog), "utf8") > 180000) {
    catalog.partial = true;
    if (catalog.workflowRecords?.length) catalog.workflowRecords.pop();
    else if (catalog.documents.length) catalog.documents.pop();
    else catalog.entities.pop();
  }
  cleanRelationships();
  return catalog;
}
