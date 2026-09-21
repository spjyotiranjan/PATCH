"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  MoreHorizontal,
  Play,
  Plus,
  Share2,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import {
  generateProcedure,
  getProcedures,
} from "@/lib/api/procedures";
import { getProject } from "@/lib/api/projects";
import type {
  Procedure,
  ProcedureStatus,
  ReviewNeed,
} from "@/lib/types/procedure";
import type { Project } from "@/lib/types/project";

function statusLabel(status: ProcedureStatus): string {
  switch (status) {
    case "WAITING_FOR_SOURCES":
      return "Waiting for Project sources";
    case "QUEUED":
      return "Queued";
    case "GENERATING":
      return "Generating";
    case "DRAFT":
      return "AI-generated draft";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "APPROVED":
      return "Approved";
    case "PUBLISHED":
      return "Published";
    case "FAILED":
      return "Generation failed";
    default:
      return status;
  }
}

function statusTone(
  status: ProcedureStatus,
): "success" | "attention" | "info" | "neutral" | "danger" {
  if (status === "PUBLISHED" || status === "APPROVED") {
    return "success";
  }
  if (status === "FAILED") {
    return "danger";
  }
  if (
    status === "NEEDS_REVIEW" ||
    status === "WAITING_FOR_SOURCES"
  ) {
    return "attention";
  }
  return "info";
}

function reviewNeedLabel(need: ReviewNeed): string {
  switch (need) {
    case "LOW":
      return "Low review needed";
    case "MODERATE":
      return "Moderate review needed";
    case "HIGH":
      return "High review needed";
    case "SEVERE":
      return "Severe review needed";
    default:
      return need;
  }
}

function reviewNeedTone(
  need: ReviewNeed,
): "success" | "attention" | "info" | "danger" {
  if (need === "LOW") {
    return "success";
  }
  if (need === "SEVERE") {
    return "danger";
  }
  if (need === "HIGH") {
    return "attention";
  }
  return "info";
}

export default function ProceduresDirectoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "drafts" | "recurring">("all");
  const [project, setProject] =
    useState<Project | null>(null);
  const [procedures, setProcedures] = useState<
    Procedure[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState<
    string | null
  >(null);
  const [reloadToken, setReloadToken] =
    useState(0);
  const [generating, setGenerating] =
    useState(false);

  const tabs = [
    { id: "overview", label: "Overview", onSelect: () => router.push(`/projects/${projectId}?tab=overview`) },
    { id: "equipments", label: "Equipments", onSelect: () => router.push(`/projects/${projectId}?tab=equipments`) },
    { id: "documents", label: "Documents", onSelect: () => router.push(`/projects/${projectId}/documents`) },
    { id: "maintenance-logs", label: "Maintenance logs", onSelect: () => router.push(`/projects/${projectId}/maintenance-logs`) },
    { id: "procedures", label: "Procedures", active: true, onSelect: () => {} },
    { id: "members", label: "Members", onSelect: () => router.push(`/projects/${projectId}?tab=members`) },
    { id: "activity", label: "Activity", onSelect: () => router.push(`/projects/${projectId}?tab=activity`) },
  ];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [loadedProject, loadedProcedures] =
          await Promise.all([
            getProject(projectId),
            getProcedures(projectId),
          ]);

        if (!cancelled) {
          setProject(loadedProject);
          setProcedures(loadedProcedures);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Procedures could not be loaded. Check your connection and retry.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, reloadToken]);

  async function handleGenerate() {
    if (generating) {
      return;
    }

    try {
      setGenerating(true);
      const procedure = await generateProcedure(
        projectId,
        `Generated procedure ${procedures.length + 1}`,
      );
      setProcedures((current) => [
        procedure,
        ...current,
      ]);
      toast.success(
        "Procedure draft generated and saved for review.",
      );
    } catch {
      toast.error(
        "Generation failed. Verify project sources and retry.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const filteredProcedures = procedures.filter((p) => {
    if (filter === "drafts") {
      return (
        p.status === "DRAFT" ||
        p.status === "NEEDS_REVIEW" ||
        p.status === "WAITING_FOR_SOURCES" ||
        p.status === "QUEUED" ||
        p.status === "GENERATING" ||
        p.status === "FAILED"
      );
    }
    if (filter === "recurring") {
      return (
        p.status === "PUBLISHED" ||
        p.status === "APPROVED"
      );
    }
    return true;
  });

  const draftCount = procedures.filter(
    (p) =>
      p.status !== "PUBLISHED" &&
      p.status !== "APPROVED",
  ).length;
  const publishedCount =
    procedures.length - draftCount;

  if (loading) {
    return (
      <AppShell title="Procedures">
        <section
          className="empty-state"
          aria-live="polite"
        >
          <h2>Loading procedures…</h2>
          <p>
            Checking generation states,
            drafts, and published definitions.
          </p>
        </section>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Procedures">
        <section
          className="empty-state"
          role="alert"
        >
          <h2>
            Procedures could not be loaded
          </h2>
          <p>{error}</p>
          <Button
            type="button"
            onClick={() =>
              setReloadToken(
                (token) => token + 1,
              )
            }
          >
            Retry
          </Button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={project?.name ?? "Procedures"}
      status={
        project ? (
          <StatusBadge tone="success">
            {project.status.replace(/_/g, " ")}
          </StatusBadge>
        ) : undefined
      }
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            size="sm"
            icon={<Sparkles size={14} />}
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            {generating
              ? "Generating…"
              : "Generate procedure"}
          </Button>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="icon-button" type="button" aria-label="Favorite">
              <Star size={18} strokeWidth={1.7} />
            </button>
            <button className="icon-button" type="button" aria-label="Share">
              <Share2 size={18} strokeWidth={1.7} />
            </button>
            <button className="icon-button" type="button" aria-label="More actions">
              <MoreHorizontal size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      }
    >
      <Tabs label="Project sections" items={tabs} />

      {/* Top filter toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 0 16px",
          borderBottom: "1px solid var(--patch-boundary)",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="btn btn-secondary"
            aria-pressed={filter === "all"}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: filter === "all" ? 600 : 400,
              background: filter === "all" ? "var(--patch-surface-elevated)" : "transparent",
              borderColor: filter === "all" ? "var(--patch-accent)" : "var(--patch-boundary)",
            }}
          >
            All procedures ({procedures.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("drafts")}
            className="btn btn-secondary"
            aria-pressed={filter === "drafts"}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: filter === "drafts" ? 600 : 400,
              background: filter === "drafts" ? "var(--patch-surface-elevated)" : "transparent",
              borderColor: filter === "drafts" ? "var(--patch-accent)" : "var(--patch-boundary)",
            }}
          >
            Under review / AI drafts ({draftCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("recurring")}
            className="btn btn-secondary"
            aria-pressed={filter === "recurring"}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: filter === "recurring" ? 600 : 400,
              background: filter === "recurring" ? "var(--patch-surface-elevated)" : "transparent",
              borderColor: filter === "recurring" ? "var(--patch-accent)" : "var(--patch-boundary)",
            }}
          >
            Published recurring runs ({publishedCount})
          </button>
        </div>
      </div>

      {filteredProcedures.length === 0 ? (
        <section className="empty-state">
          <FileText size={28} aria-hidden="true" />
          <h2>
            {procedures.length === 0
              ? "No procedures yet"
              : "No procedures match this filter"}
          </h2>
          <p>
            {procedures.length === 0
              ? "Generate the first source-bounded draft. It will appear here for human review before anything can publish."
              : "Try a different filter."}
          </p>
          {procedures.length === 0 && (
            <Button
              disabled={generating}
              onClick={() => void handleGenerate()}
              icon={<Plus size={15} />}
            >
              {generating
                ? "Generating…"
                : "Generate procedure"}
            </Button>
          )}
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredProcedures.map((proc) => (
            <div
              key={proc.id}
              className="card"
              style={{
                padding: 20,
                background: "var(--patch-surface)",
                border: "1px solid var(--patch-boundary)",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <StatusBadge tone={statusTone(proc.status)}>
                    {statusLabel(proc.status)}
                    {proc.status === "PUBLISHED"
                      ? ` · Version ${proc.version}`
                      : ""}
                  </StatusBadge>
                  {proc.reviewNeed && (
                    <StatusBadge
                      tone={reviewNeedTone(proc.reviewNeed)}
                    >
                      {reviewNeedLabel(proc.reviewNeed)}
                    </StatusBadge>
                  )}
                  {proc.recurrence && (
                    <StatusBadge tone="info">
                      Recurring ·{" "}
                      {proc.recurrence.cadence}
                    </StatusBadge>
                  )}
                </div>

                <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600, color: "var(--patch-text)" }}>
                  {proc.title}
                </h3>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--patch-muted)", lineHeight: 1.5 }}>
                  {proc.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    fontSize: 13,
                    color: "var(--patch-muted)",
                    flexWrap: "wrap",
                  }}
                >
                  {proc.equipmentName && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Wrench size={14} /> Equipment:{" "}
                      <strong style={{ color: "var(--patch-text)" }}>
                        {proc.equipmentName}
                      </strong>
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Layers size={14} /> {proc.steps.length} steps
                  </span>
                  {proc.generatedAt && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={14} /> Generated: {proc.generatedAt}
                    </span>
                  )}
                </div>

                {proc.reviewNeed === "SEVERE" && (
                  <p
                    role="note"
                    style={{
                      margin: "12px 0 0",
                      fontSize: 13,
                      color: "var(--patch-danger)",
                    }}
                  >
                    Severe blocking findings must be
                    resolved before this draft can
                    publish.
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 170 }}>
                {proc.recurrence ? (
                  <Link
                    href={`/projects/${projectId}/procedures/recurring-run`}
                  >
                    <Button style={{ width: "100%" }} icon={<Play size={14} />}>
                      Open current run
                    </Button>
                  </Link>
                ) : null}
                <Link
                  href={`/projects/${projectId}/procedures/review?procedureId=${proc.id}`}
                >
                  <Button
                    variant={proc.recurrence ? "secondary" : "primary"}
                    style={{ width: "100%" }}
                    icon={<FileText size={14} />}
                  >
                    {proc.status === "PUBLISHED"
                      ? "View definition"
                      : "Review draft & edit"}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
