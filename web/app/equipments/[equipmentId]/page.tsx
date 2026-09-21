"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  CircleX,
  Clock3,
  Edit2,
  FileText,
  RefreshCw,
  Search,
  Share2,
  Star,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge, Tabs } from "@/components/ui";
import {
  getEquipment,
  getEquipmentActivity,
} from "@/lib/api/equipments";
import { getEquipmentDocuments } from "@/lib/api/documents";
import {
  getEquipmentProjectIds,
  getProject,
} from "@/lib/api/projects";
import type { EquipmentActivityEvent } from "@/lib/mockapi/equipments";
import type { Document } from "@/lib/types/document";
import type {
  Equipment,
  EquipmentStatus,
} from "@/lib/types/equipment";
import type { Project } from "@/lib/types/project";

type TabId = "overview" | "documents" | "projects" | "activity";

function statusLabel(status: EquipmentStatus): string {
  if (status === "WARNING") return "Warning";
  if (status === "MAINTENANCE") return "Maintenance";
  if (status === "INACTIVE") return "Inactive";
  return "Healthy";
}

function statusTone(
  status: EquipmentStatus,
): "success" | "attention" | "info" | "neutral" | "danger" {
  if (status === "WARNING") return "attention";
  if (status === "MAINTENANCE") return "info";
  if (status === "INACTIVE") return "neutral";
  return "success";
}

export default function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ equipmentId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { equipmentId } = use(params);
  const initialTab = use(
    searchParams ?? Promise.resolve<{ tab?: string }>({}),
  ).tab;
  const [activeTab, setActiveTab] = useState<TabId>(
    initialTab === "documents" ||
    initialTab === "projects" ||
    initialTab === "activity"
      ? initialTab
      : "overview",
  );
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result =
          await getEquipment(equipmentId);

        if (!cancelled) {
          setEquipment(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Equipment details could not be loaded. Check your connection and retry.",
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
  }, [equipmentId, retryCount]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "projects", label: "Projects" },
    { id: "activity", label: "Activity" },
  ].map((t) => ({
    ...t,
    active: t.id === activeTab,
    onSelect: () => setActiveTab(t.id as TabId),
  }));

  if (loading) {
    return (
      <AppShell title="Equipment">
        <section className="empty-state" aria-live="polite">
          <h2>Loading equipment…</h2>
          <p>Retrieving equipment details, documents, and activity.</p>
        </section>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Equipment">
        <section className="empty-state" role="alert">
          <h2>Equipment could not be loaded</h2>
          <p>{error}</p>
          <Button
            type="button"
            onClick={() =>
              setRetryCount((count) => count + 1)
            }
          >
            Retry
          </Button>
        </section>
      </AppShell>
    );
  }

  if (!equipment) {
    return (
      <AppShell title="Equipment">
        <section className="empty-state">
          <Search size={28} aria-hidden="true" />
          <h2>Equipment not found</h2>
          <p>
            No equipment with ID “{equipmentId}” is available to you. It may
            have been removed or you may not have access.
          </p>
          <Link href="/equipments">
            <Button type="button">Back to Equipments</Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={equipment.name}
      status={
        <StatusBadge tone={statusTone(equipment.status)}>
          {statusLabel(equipment.status)}
        </StatusBadge>
      }
      actions={
        <div style={{ display: "flex", gap: 4 }}>
          <button className="icon-button" type="button" aria-label="Favourite">
            <Star size={18} strokeWidth={1.7} />
          </button>
          <button className="icon-button" type="button" aria-label="Share">
            <Share2 size={18} strokeWidth={1.7} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="More actions"
          >
            ···
          </button>
        </div>
      }
    >
      <Tabs label="Equipment sections" items={tabs} />

      {activeTab === "overview" && <OverviewTab equipment={equipment} />}
      {activeTab === "documents" && <DocumentsTab equipment={equipment} />}
      {activeTab === "projects" && <ProjectsTab equipment={equipment} />}
      {activeTab === "activity" && <ActivityTab equipment={equipment} />}
    </AppShell>
  );
}

function OverviewTab({ equipment }: { equipment: Equipment }) {
  const keyFacts: Array<[string, string]> = [
    ["Type", equipment.type],
    ["Model", equipment.model],
    ["Manufacturer", equipment.manufacturer],
    ["Serial number", equipment.serialNumber],
    ["Location", equipment.location],
    ["Owner", equipment.owner],
  ];

  return (
    <div className="overview-page" style={{ paddingTop: 20 }}>
      {/* Top row */}
      <div className="overview-top-grid">
        {/* Description */}
        <div className="overview-panel">
          <div className="overview-panel-header">
            <h2>Description</h2>
            <Button variant="secondary" icon={<Edit2 size={14} />}>
              Edit
            </Button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--patch-text)",
            }}
          >
            {equipment.description}
          </p>
          <div
            style={{
              marginTop: 20,
              borderTop: "1px solid var(--patch-boundary)",
              paddingTop: 16,
            }}
          >
            <div className="overview-panel-header" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 15 }}>
                Generated description{" "}
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--patch-muted)",
                    fontWeight: 400,
                  }}
                >
                  ⓘ
                </span>
              </h2>
              <Button variant="secondary" icon={<RefreshCw size={14} />}>
                Regenerate
              </Button>
            </div>
            <p className="generated-meta" style={{ whiteSpace: "pre-line" }}>
              AI-generated from available documents and data.{"\n"}Last
              updated: {equipment.updatedAt}
            </p>
            <button className="looks-good-btn" type="button">
              <ThumbsUp size={15} /> Looks good
            </button>
          </div>
        </div>

        {/* Key facts */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 16px", fontSize: 17 }}>Key facts</h2>
          <div className="detail-grid">
            {keyFacts.map(([k, v]) => (
              <Fragment key={k}>
                <span className="detail-key">{k}</span>
                <span className="detail-val">{v}</span>
              </Fragment>
            ))}
          </div>
        </div>

        {/* Current status */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Current status</h2>
          <div style={{ marginBottom: 12 }}>
            <StatusBadge tone={statusTone(equipment.status)}>
              {statusLabel(equipment.status)}
            </StatusBadge>
          </div>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 14,
              color: "var(--patch-muted)",
              lineHeight: 1.5,
            }}
          >
            {equipment.status === "ACTIVE"
              ? "Operating within normal parameters."
              : equipment.status === "WARNING"
                ? "Attention advised. Review linked documents and recent activity."
                : equipment.status === "MAINTENANCE"
                  ? "Currently under maintenance."
                  : "Currently inactive."}
          </p>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 12,
              color: "var(--patch-muted)",
            }}
          >
            Last updated
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 14 }}>
            {equipment.updatedAt}
          </p>
          <Button variant="secondary" style={{ width: "100%" }}>
            View latest activity
          </Button>
        </div>
      </div>

      {/* Bottom row */}
      <div className="overview-bottom-grid">
        {/* Documents summary */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Documents</h2>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Total documents</span>
            <span style={{ fontWeight: 600 }}>
              {equipment.documentsCount}
            </span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Linked projects</span>
            <span style={{ fontWeight: 600 }}>
              {equipment.projectsCount}
            </span>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href={`/equipments/${equipment.id}/documents`}>
              <Button variant="secondary">View documents</Button>
            </Link>
          </div>
        </div>

        {/* Profile summary */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Profile</h2>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Profile status</span>
            <span
              style={{ color: "var(--patch-success)", fontWeight: 600 }}
            >
              Up to date
            </span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Last updated</span>
            <span>{equipment.updatedAt}</span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Generated from</span>
            <span>{equipment.documentsCount} documents</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button variant="secondary">View profile</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ equipment }: { equipment: Equipment }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getEquipmentDocuments(equipment.id);

        if (!cancelled) {
          setDocuments(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Documents could not be loaded. Retry to try again.",
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
  }, [equipment.id, reloadToken]);

  const filtered = documents.filter((doc) =>
    `${doc.title} ${doc.docType} ${doc.activeVersion ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div style={{ paddingTop: 20 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search
            size={17}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 14,
              top: 13,
              color: "var(--patch-muted)",
            }}
          />
          <input
            aria-label="Search equipment documents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="form-input-with-icon"
            style={{
              width: "100%",
              minHeight: 40,
              paddingLeft: 40,
              border: "1px solid var(--patch-boundary)",
              borderRadius: 5,
              background: "var(--patch-surface)",
              color: "var(--patch-text)",
            }}
          />
        </div>
        <Link href={`/equipments/${equipment.id}/documents`}>
          <Button variant="secondary">Manage documents</Button>
        </Link>
      </div>

      {loading ? (
        <section className="empty-state" aria-live="polite">
          <h2>Loading documents…</h2>
          <p>Resolving the current active versions for this equipment.</p>
        </section>
      ) : error ? (
        <section className="empty-state" role="alert">
          <h2>Documents could not be loaded</h2>
          <p>{error}</p>
          <Button
            type="button"
            onClick={() =>
              setReloadToken((token) => token + 1)
            }
          >
            Retry
          </Button>
        </section>
      ) : filtered.length === 0 ? (
        <section className="empty-state">
          <FileText size={28} aria-hidden="true" />
          <h2>
            {documents.length === 0
              ? "No documents linked yet"
              : "No documents match your search"}
          </h2>
          <p>
            {documents.length === 0
              ? "Link the first document from the equipment document manager so technicians have approved sources."
              : "Try a different search term."}
          </p>
          {documents.length === 0 && (
            <Link href={`/equipments/${equipment.id}/documents`}>
              <Button type="button">Add document</Button>
            </Link>
          )}
        </section>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">
              Documents linked to {equipment.name}
            </caption>
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col">Active revision</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <strong>{doc.title}</strong>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--patch-muted)",
                      }}
                    >
                      {doc.versions[0]?.filename ?? doc.id}
                    </div>
                  </td>
                  <td>{doc.docType}</td>
                  <td>{doc.activeVersion ?? "—"}</td>
                  <td>
                    <StatusBadge
                      tone={
                        doc.status === "ACTIVE"
                          ? "success"
                          : doc.status === "FAILED" ||
                              doc.status === "REJECTED"
                            ? "danger"
                            : doc.status === "NEEDS_REVIEW"
                              ? "attention"
                              : "info"
                      }
                    >
                      {doc.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </td>
                  <td>{doc.updatedAt}</td>
                  <td>
                    <Link href={`/documents/${doc.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectsTab({ equipment }: { equipment: Equipment }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const ids = await getEquipmentProjectIds(equipment.id);
        const resolved = await Promise.all(
          ids.map((id) => getProject(id)),
        );

        if (!cancelled) {
          setProjects(
            resolved.filter(
              (p): p is Project => p !== null,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "Linked projects could not be loaded. Retry to try again.",
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
  }, [equipment.id, reloadToken]);

  if (loading) {
    return (
      <section className="empty-state" aria-live="polite">
        <h2>Loading projects…</h2>
        <p>Finding projects that include this equipment.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state" role="alert">
        <h2>Projects could not be loaded</h2>
        <p>{error}</p>
        <Button
          type="button"
          onClick={() =>
            setReloadToken((token) => token + 1)
          }
        >
          Retry
        </Button>
      </section>
    );
  }

  if (projects.length === 0) {
    return (
      <section className="empty-state">
        <h2>No linked projects</h2>
        <p>
          This equipment is not included in any project yet. Include it from a
          project workspace to relate documents, logs, and procedures.
        </p>
        <Link href="/projects">
          <Button type="button">Browse projects</Button>
        </Link>
      </section>
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="visually-hidden">
            Projects including {equipment.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Status</th>
              <th scope="col">Owner</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <strong>{project.name}</strong>
                  <div
                    style={{ fontSize: 12, color: "var(--patch-muted)" }}
                  >
                    {project.code}
                  </div>
                </td>
                <td>
                  <StatusBadge
                    tone={
                      project.status === "ACTIVE"
                        ? "success"
                        : project.status === "COMPLETED"
                          ? "info"
                          : "neutral"
                    }
                  >
                    {project.status.replace(/_/g, " ")}
                  </StatusBadge>
                </td>
                <td>{project.owner}</td>
                <td>
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="secondary">Open</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityTab({ equipment }: { equipment: Equipment }) {
  const [events, setEvents] = useState<EquipmentActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getEquipmentActivity(equipment.id);

        if (!cancelled) {
          setEvents(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Activity could not be loaded. Retry to try again.",
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
  }, [equipment.id, reloadToken]);

  if (loading) {
    return (
      <section className="empty-state" aria-live="polite">
        <h2>Loading activity…</h2>
        <p>Retrieving recent events for this equipment.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state" role="alert">
        <h2>Activity could not be loaded</h2>
        <p>{error}</p>
        <Button
          type="button"
          onClick={() =>
            setReloadToken((token) => token + 1)
          }
        >
          Retry
        </Button>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="empty-state">
        <Clock3 size={28} aria-hidden="true" />
        <h2>No activity yet</h2>
        <p>
          Document uploads, reviews, and maintenance events for this equipment
          will appear here.
        </p>
      </section>
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="visually-hidden">
            Activity for {equipment.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Actor</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  {event.action}{" "}
                  <strong>{event.target}</strong>
                </td>
                <td>{event.actor}</td>
                <td>{event.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EquipmentStatusIcon({ status }: { status: EquipmentStatus }) {
  if (status === "WARNING") {
    return <TriangleAlert size={14} aria-hidden="true" />;
  }
  if (status === "MAINTENANCE") {
    return <Clock3 size={14} aria-hidden="true" />;
  }
  if (status === "INACTIVE") {
    return <CircleX size={14} aria-hidden="true" />;
  }
  return <CircleCheck size={14} aria-hidden="true" />;
}
