"use client";
import Link from "next/link";
import { ChatMarkdown } from "@/components/chat-markdown";
import type { AI } from "@/lib/api/contracts";

export function ChatWorkspaceOverview({
  overview,
}: {
  overview: AI["WorkspaceOverview"];
}) {
  const { catalog } = overview;
  const entities = catalog.entities.filter((e) =>
    overview.scope === "PROJECTS"
      ? e.type === "PROJECT"
      : overview.scope === "EQUIPMENTS"
        ? e.type === "EQUIPMENT"
        : overview.scope === "WORKSPACE",
  );
  const documents = [
    "PROJECTS",
    "EQUIPMENTS",
    "DOCUMENTS",
    "WORKSPACE",
  ].includes(overview.scope)
    ? catalog.documents
    : [];
  const workflows = (catalog.workflowRecords ?? []).filter((r) =>
    overview.scope === "LOGS"
      ? r.type === "LOG"
      : overview.scope === "PROCEDURES"
        ? r.type !== "LOG"
        : overview.scope === "PROJECTS" || overview.scope === "WORKSPACE",
  );
  function reference(key: string) {
    const [kind, index] = key.split(":");
    const i = Number(index);
    if (kind === "entity") {
      const e = catalog.entities[i];
      if (!e) return null;
      const project = catalog.entities.find(
        (p) => p.type === "PROJECT" && p.equipmentIds?.includes(e.id),
      );
      return {
        label: e.name,
        href:
          e.type === "PROJECT"
            ? `/projects/${encodeURIComponent(e.id)}`
            : project
              ? `/projects/${encodeURIComponent(project.id)}`
              : `/equipments/${encodeURIComponent(e.id)}`,
      };
    }
    if (kind === "document") {
      const d = catalog.documents[i];
      return d
        ? {
            label: d.title,
            href:
              d.evidenceAvailable && d.activeVersionId
                ? `/documents/${encodeURIComponent(d.activeVersionId)}`
                : "/documents",
          }
        : null;
    }
    if (kind === "workflow") {
      const r = catalog.workflowRecords?.[i];
      return r
        ? {
            label: r.title,
            href: `/projects/${encodeURIComponent(r.projectId)}/${r.type === "LOG" ? "maintenance-logs" : "procedures"}`,
          }
        : null;
    }
    if (kind === "help") {
      const h = catalog.help?.[i];
      return h ? { label: h.title, href: "/" } : null;
    }
    return key === "catalog:scope"
      ? { label: "Accessible workspace", href: "/" }
      : null;
  }
  const keys = [
    ...new Set((overview.passages ?? []).flatMap((p) => p.recordIds)),
  ];
  return (
    <section
      className="chat-workspace-overview"
      aria-label="PATCH workspace response"
    >
      <p className="chat-evidence-meta">
        {overview.scope === "HELP"
          ? "PATCH workflow guidance"
          : "Using your accessible app records"}
      </p>
      {catalog.partial && (
        <p className="info-banner">
          This context is partial because of display limits. Open the
          directories for the full list.
        </p>
      )}
      {(overview.passages ?? []).map((p, i) => (
        <ChatMarkdown key={i} text={p.text} />
      ))}
      {!!keys.length && (
        <details className="chat-record-references">
          <summary>
            Records and guidance used <span>{keys.length}</span>
          </summary>
          <ul>
            {keys.map((key) => {
              const item = reference(key);
              return item ? (
                <li key={key}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ) : null;
            })}
          </ul>
        </details>
      )}
      {!overview.passages?.length && (
        <div>
          <p>Here is the saved context available for this request.</p>
          <ul>
            {entities.map((e) => (
              <li key={e.id}>
                <strong>{e.name}</strong> — {e.status.toLowerCase()}
                <p>{e.description}</p>
              </li>
            ))}
            {documents.map((d) => (
              <li key={d.id}>
                {d.title} —{" "}
                {d.evidenceAvailable
                  ? "Current source available"
                  : "Not yet available as approved evidence"}
              </li>
            ))}
            {workflows.map((r) => (
              <li key={r.id}>
                {r.title} — {r.status.toLowerCase()}
                <p>{r.text}</p>
              </li>
            ))}
            {overview.scope === "HELP" &&
              catalog.help?.map((h) => (
                <li key={h.id}>
                  <strong>{h.title}</strong>
                  <p>{h.text}</p>
                </li>
              ))}
          </ul>
          {overview.scope === "HELP" && !catalog.help?.length && (
            <p>
              No workflow guidance is available in this context. Open the
              relevant page to use its controls.
            </p>
          )}
          {overview.scope !== "HELP" &&
            !entities.length &&
            !documents.length &&
            !workflows.length && (
              <p>No matching accessible records in this view.</p>
            )}
        </div>
      )}
    </section>
  );
}
