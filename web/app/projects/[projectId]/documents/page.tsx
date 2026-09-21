"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import {
  AddNewDocumentDrawer,
  AddNewVersionDrawer,
  DocumentStatusBadge,
  InclusionBadge,
  ProfileStatusIndicator,
} from "@/components/documents";
import { getProjectDocuments } from "@/lib/api/documents";
import { getProject } from "@/lib/api/projects";
import type { Document } from "@/lib/types/document";
import type { Project } from "@/lib/types/project";

type BadgeStatus =
  | "Active"
  | "Needs review"
  | "Indexing"
  | "Failed"
  | "Approved"
  | "Superseded"
  | "Rejected"
  | "Extracting"
  | "Uploading";

function toBadgeStatus(status: Document["status"]): BadgeStatus {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "INDEXING":
      return "Indexing";
    case "FAILED":
      return "Failed";
    case "APPROVED":
      return "Approved";
    case "SUPERSEDED":
      return "Superseded";
    case "REJECTED":
      return "Rejected";
    case "EXTRACTING":
      return "Extracting";
    case "UPLOADING":
      return "Uploading";
    default:
      return "Needs review";
  }
}

function coverageOf(doc: Document): number | null {
  const active = doc.versions.find(
    (version) => version.id === doc.activeVersionId,
  );
  return (
    active?.coveragePct ??
    doc.versions[0]?.coveragePct ??
    null
  );
}

function coverageClass(pct: number | null): string {
  if (pct === null) {
    return "coverage-none";
  }
  if (pct >= 90) {
    return "coverage-high";
  }
  if (pct >= 70) {
    return "coverage-mid";
  }
  return "coverage-low";
}

export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [project, setProject] =
    useState<Project | null>(null);
  const [documents, setDocuments] =
    useState<Document[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState<
    string | null
  >(null);
  const [reloadToken, setReloadToken] =
    useState(0);

  const [search, setSearch] = useState("");

  const [docSourceFilter, setDocSourceFilter] = useState<
    "All" | "Direct" | "Inherited"
  >("All");

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileState, setProfileState] = useState<
    "Fresh" | "Refreshing" | "Stale"
  >("Fresh");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [loadedProject, loadedDocs] =
          await Promise.all([
            getProject(projectId),
            getProjectDocuments(projectId),
          ]);

        if (!cancelled) {
          setProject(loadedProject);
          setDocuments(loadedDocs);
          setProfileState(
            loadedProject?.profileStatus === "STALE"
              ? "Stale"
              : loadedProject?.profileStatus === "REFRESHING"
                ? "Refreshing"
                : "Fresh",
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "Project documents could not be loaded. Check your connection and retry.",
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

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      active: false,
      onSelect: () =>
        router.push(`/projects/${projectId}?tab=overview`),
    },
    {
      id: "equipments",
      label: "Equipments",
      active: false,
      onSelect: () =>
        router.push(`/projects/${projectId}?tab=equipments`),
    },
    {
      id: "documents",
      label: "Documents",
      active: true,
      onSelect: () => {},
    },
    {
      id: "maintenance-logs",
      label: "Maintenance logs",
      active: false,
      onSelect: () =>
        router.push(`/projects/${projectId}/maintenance-logs`),
    },
    {
      id: "procedures",
      label: "Procedures",
      active: false,
      onSelect: () =>
        router.push(`/projects/${projectId}/procedures`),
    },
    {
      id: "members",
      label: "Members",
      active: false,
      onSelect: () =>
        router.push(`/projects/${projectId}?tab=members`),
    },
    {
      id: "activity",
      label: "Activity",
      active: false,
      onSelect: () =>
        router.push(`/projects/${projectId}?tab=activity`),
    },
  ];

  const normalizedSearch = search.toLowerCase().trim();

  const directDocs = useMemo(
    () =>
      documents.filter(
        (doc) => doc.source === "DIRECT",
      ),
    [documents],
  );

  const inheritedDocs = useMemo(
    () =>
      documents.filter(
        (doc) => doc.source === "INHERITED",
      ),
    [documents],
  );

  const matchesSearch = (doc: Document) =>
    !normalizedSearch ||
    doc.title
      .toLowerCase()
      .includes(normalizedSearch) ||
    doc.docType
      .toLowerCase()
      .includes(normalizedSearch) ||
    (doc.equipmentName ?? "")
      .toLowerCase()
      .includes(normalizedSearch);

  const filteredDirect = useMemo(() => {
    if (docSourceFilter === "Inherited") {
      return [];
    }
    return directDocs.filter(matchesSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directDocs, normalizedSearch, docSourceFilter]);

  const filteredInherited = useMemo(() => {
    if (docSourceFilter === "Direct") {
      return [];
    }
    return inheritedDocs.filter(matchesSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inheritedDocs, normalizedSearch, docSourceFilter]);

  const reviewCount = useMemo(
    () =>
      documents.filter(
        (doc) =>
          doc.status === "NEEDS_REVIEW",
      ).length,
    [documents],
  );

  function handleRefreshProfile() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    setProfileState("Refreshing");

    window.setTimeout(() => {
      setRefreshing(false);
      setProfileState("Fresh");
      toast.success(
        "Project profile refreshed from current active versions.",
      );
    }, 1200);
  }

  if (loading) {
    return (
      <AppShell title="Project documents">
        <section
          className="empty-state"
          aria-live="polite"
        >
          <h2>Loading project documents…</h2>
          <p>
            Resolving direct and inherited
            active versions.
          </p>
        </section>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Project documents">
        <section
          className="empty-state"
          role="alert"
        >
          <h2>
            Project documents could not be
            loaded
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

  if (!project) {
    return (
      <AppShell title="Project documents">
        <section className="empty-state">
          <h2>Project not found</h2>
          <p>
            No project with ID “{projectId}”
            is available to you.
          </p>
          <Link href="/projects">
            <Button type="button">
              Back to Projects
            </Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={project.name}
      status={
        <StatusBadge tone="info">
          {project.status.replace(/_/g, " ")}
        </StatusBadge>
      }
    >
      <div className="project-documents-page">
        <div className="project-section-header">
          <Link
            href={`/projects/${project.id}`}
            className="project-back-link"
          >
            <ArrowLeft size={14} />
            Back to Project Overview
          </Link>

          <Tabs
            label="Project sections"
            items={tabs}
          />
        </div>

        <div className="project-documents-heading">
          <div>
            <div className="project-documents-eyebrow">
              {project.code}
            </div>

            <h1>Project documents</h1>

            <p>
              Manage project documents and
              documents inherited from
              associated equipment. Inherited
              documents update automatically
              when the owning Equipment
              activates a new version.
            </p>
          </div>

          <div className="project-documents-count">
            <FileText size={18} />

            <span>
              <strong>
                {documents.length}
              </strong>{" "}
              linked documents
            </span>
          </div>
        </div>

        <div className="metrics-grid project-documents-metrics">
          <div className="metric-card">
            <div className="metric-label">
              Direct project docs
            </div>

            <div className="metric-value">
              {directDocs.length}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">
              Inherited equipment docs
            </div>

            <div className="metric-value">
              {inheritedDocs.length}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">
              Total linked docs
            </div>

            <div
              className="metric-value"
              style={{
                color:
                  "var(--patch-success)",
              }}
            >
              {documents.length}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">
              Needs review
            </div>

            <div
              className="metric-value"
              style={{
                color:
                  "var(--patch-attention)",
              }}
            >
              {reviewCount}
            </div>
          </div>
        </div>

        <div className="card project-profile-bar">
          <div className="project-profile-status">
            <ProfileStatusIndicator
              status={profileState}
            />

            <span>
              Project profile last updated:{" "}
              {project.lastProfileUpdate}
            </span>
          </div>

          <div className="project-profile-actions">
            <Link href="/documents/processing-state">
              <Button
                variant="secondary"
                size="sm"
              >
                View processing queue (
                {reviewCount})
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={handleRefreshProfile}
            >
              <RefreshCw size={14} />
              {refreshing
                ? "Refreshing…"
                : "Refresh project profile"}
            </Button>
          </div>
        </div>

        <div className="project-documents-toolbar">
          <div className="project-documents-search-area">
            <div className="projects-search">
              <Search
                size={17}
                className="projects-search-icon"
              />

              <input
                type="text"
                placeholder="Search project documents..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                aria-label="Search project documents"
                className="form-select"
              />
            </div>

            <select
              className="form-select"
              value={docSourceFilter}
              onChange={(event) =>
                setDocSourceFilter(
                  event.target.value as
                    | "All"
                    | "Direct"
                    | "Inherited",
                )
              }
              aria-label="Filter by document source"
            >
              <option value="All">
                All sources
              </option>
              <option value="Direct">
                Direct project
              </option>
              <option value="Inherited">
                From equipment
              </option>
            </select>
          </div>

          <div className="project-documents-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setAddVersionOpen(true)
              }
            >
              <Upload size={14} />
              Add new version
            </Button>

            <Button
              size="sm"
              onClick={() =>
                setAddDocOpen(true)
              }
            >
              <Plus size={14} />
              Add new document
            </Button>
          </div>
        </div>

        {(docSourceFilter === "All" ||
          docSourceFilter === "Direct") && (
          <section className="project-documents-section">
            <div className="project-documents-section-heading">
              <div>
                <h2>
                  <FolderOpen
                    size={18}
                    color="var(--patch-accent)"
                  />
                  Direct Project Documents
                </h2>

                <p>
                  Documents uploaded directly
                  to this project.
                </p>
              </div>

              <span>
                {filteredDirect.length}{" "}
                documents
              </span>
            </div>

            <DirectDocumentsTable
              docs={filteredDirect}
            />
          </section>
        )}

        {(docSourceFilter === "All" ||
          docSourceFilter === "Inherited") && (
          <section className="project-documents-section">
            <div className="project-documents-section-heading">
              <div>
                <h2>
                  <RefreshCw
                    size={18}
                    color="var(--patch-success)"
                  />
                  From Associated Equipment
                </h2>

                <p>
                  Documents inherited through
                  equipment associated with
                  this project. Activating a
                  new version on the owning
                  Equipment updates every
                  linked project automatically
                  without copying files.
                </p>
              </div>

              <span>
                {filteredInherited.length}{" "}
                documents
              </span>
            </div>

            <InheritedDocumentsTable
              docs={filteredInherited}
            />
          </section>
        )}

        <AddNewDocumentDrawer
          open={addDocOpen}
          onClose={() => setAddDocOpen(false)}
        />

        <AddNewVersionDrawer
          open={addVersionOpen}
          onClose={() =>
            setAddVersionOpen(false)
          }
          documents={directDocs.map(
            (doc) => ({
              id: doc.id,
              name: doc.title,
              subtitle:
                doc.versions[0]?.filename ??
                doc.id,
              activeRevision:
                doc.activeVersion ??
                "No active revision",
              activeDate: doc.updatedAt,
            }),
          )}
        />
      </div>
    </AppShell>
  );
}

function DirectDocumentsTable({
  docs,
}: {
  docs: Document[];
}) {
  if (docs.length === 0) {
    return (
      <div className="card project-documents-table-card">
        <p className="project-documents-empty">
          No direct project documents found.
          Add the first document to give
          this project approved sources.
        </p>
      </div>
    );
  }

  return (
    <div className="card project-documents-table-card">
      <table className="doc-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Active revision</th>
            <th>Status</th>
            <th>Coverage</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {docs.map((doc) => {
            const coverage =
              coverageOf(doc);

            return (
              <tr key={doc.id}>
                <td>
                  <div>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="project-document-title"
                    >
                      {doc.title}
                    </Link>

                    <div className="project-document-file">
                      {doc.versions[0]
                        ?.filename ?? doc.id}
                    </div>

                    <div className="project-document-uploader">
                      Uploaded by{" "}
                      {doc.uploadedBy}
                    </div>
                  </div>
                </td>

                <td>
                  <span className="project-document-type">
                    {doc.docType}
                  </span>
                </td>

                <td>
                  <strong>
                    {doc.activeVersion ??
                      "—"}
                  </strong>
                </td>

                <td>
                  <DocumentStatusBadge
                    status={toBadgeStatus(
                      doc.status,
                    )}
                  />
                </td>

                <td>
                  <span
                    className={`coverage-pct ${coverageClass(coverage)}`}
                  >
                    {coverage === null
                      ? "—"
                      : `${coverage}%`}
                  </span>
                </td>

                <td className="project-document-date">
                  {doc.updatedAt}
                </td>

                <td>
                  <div className="project-document-row-actions">
                    <Link
                      href={`/documents/${doc.id}`}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                      >
                        <Eye size={13} />
                        View
                      </Button>
                    </Link>

                    {doc.status ===
                      "NEEDS_REVIEW" && (
                      <Link href="/documents/upload-review">
                        <Button size="sm">
                          Review
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InheritedDocumentsTable({
  docs,
}: {
  docs: Document[];
}) {
  if (docs.length === 0) {
    return (
      <div className="card project-documents-table-card">
        <p className="project-documents-empty">
          No inherited equipment documents.
          Include Equipments in this project
          to link their current documents
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="card project-documents-table-card">
      <table className="doc-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Source equipment</th>
            <th>Active revision</th>
            <th>Status</th>
            <th>Coverage</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {docs.map((doc) => {
            const coverage =
              coverageOf(doc);

            return (
              <tr key={doc.id}>
                <td>
                  <div>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="project-document-title"
                    >
                      {doc.title}
                    </Link>

                    <div className="project-document-file">
                      {doc.versions[0]
                        ?.filename ?? doc.id}
                    </div>

                    <div className="project-document-uploader">
                      Updated via{" "}
                      {doc.equipmentName ??
                        "linked Equipment"}
                    </div>
                  </div>
                </td>

                <td>
                  <InclusionBadge
                    equipmentName={
                      doc.equipmentName ??
                      "Equipment"
                    }
                  />
                </td>

                <td>
                  <strong>
                    {doc.activeVersion ??
                      "—"}
                  </strong>
                </td>

                <td>
                  <DocumentStatusBadge
                    status={toBadgeStatus(
                      doc.status,
                    )}
                  />
                </td>

                <td>
                  <span
                    className={`coverage-pct ${coverageClass(coverage)}`}
                  >
                    {coverage === null
                      ? "—"
                      : `${coverage}%`}
                  </span>
                </td>

                <td className="project-document-date">
                  {doc.updatedAt}
                </td>

                <td>
                  <Link
                    href={`/documents/${doc.id}`}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                    >
                      <Eye size={13} />
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
