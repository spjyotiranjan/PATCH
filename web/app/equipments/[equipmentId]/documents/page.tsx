"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileText,
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
  ProfileStatusIndicator,
} from "@/components/documents";
import { getEquipment } from "@/lib/api/equipments";
import { getEquipmentDocuments } from "@/lib/api/documents";
import type { Document } from "@/lib/types/document";
import type { Equipment } from "@/lib/types/equipment";

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

export default function EquipmentDocumentsPage({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = use(params);
  const router = useRouter();
  const [equipment, setEquipment] =
    useState<Equipment | null>(null);
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
  const [selectedType, setSelectedType] = useState("All");
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
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
        const [loadedEquipment, loadedDocs] =
          await Promise.all([
            getEquipment(equipmentId),
            getEquipmentDocuments(equipmentId),
          ]);

        if (!cancelled) {
          setEquipment(loadedEquipment);
          setDocuments(loadedDocs);
          setProfileState("Fresh");
        }
      } catch {
        if (!cancelled) {
          setError(
            "Equipment documents could not be loaded. Check your connection and retry.",
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
  }, [equipmentId, reloadToken]);

  const tabs = [
    { id: "overview", label: "Overview", active: false, onSelect: () => router.push(`/equipments/${equipmentId}?tab=overview`) },
    { id: "documents", label: "Documents", active: true, onSelect: () => {} },
    { id: "projects", label: "Projects", active: false, onSelect: () => router.push(`/equipments/${equipmentId}?tab=projects`) },
    { id: "activity", label: "Activity", active: false, onSelect: () => router.push(`/equipments/${equipmentId}?tab=activity`) },
  ];

  const types = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(documents.map((doc) => doc.docType)),
      ),
    ],
    [documents],
  );

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      (doc.versions[0]?.filename ?? "")
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesType =
      selectedType === "All" || doc.docType === selectedType;
    return matchesSearch && matchesType;
  });

  const activeCount = documents.filter(
    (doc) => doc.status === "ACTIVE",
  ).length;
  const reviewCount = documents.filter(
    (doc) =>
      doc.status === "NEEDS_REVIEW" ||
      doc.status === "INDEXING" ||
      doc.status === "EXTRACTING" ||
      doc.status === "UPLOADING",
  ).length;
  const coverages = documents
    .map(coverageOf)
    .filter((pct): pct is number => pct !== null);
  const avgCoverage =
    coverages.length > 0
      ? Math.round(
          coverages.reduce((sum, pct) => sum + pct, 0) /
            coverages.length,
        )
      : null;

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
        "Equipment profile refreshed from current active versions.",
      );
    }, 1200);
  }

  if (loading) {
    return (
      <AppShell title="Equipment documents">
        <section
          className="empty-state"
          aria-live="polite"
        >
          <h2>Loading equipment documents…</h2>
          <p>
            Resolving logical documents and
            their active versions.
          </p>
        </section>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Equipment documents">
        <section
          className="empty-state"
          role="alert"
        >
          <h2>
            Equipment documents could not be
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

  if (!equipment) {
    return (
      <AppShell title="Equipment documents">
        <section className="empty-state">
          <h2>Equipment not found</h2>
          <p>
            No equipment with ID “
            {equipmentId}” is available to
            you.
          </p>
          <Link href="/equipments">
            <Button type="button">
              Back to Equipments
            </Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  const expandedDocument = documents.find(
    (doc) => doc.id === expandedDoc,
  );

  return (
    <AppShell
      title={equipment.name}
      status={
        <StatusBadge tone="success">
          {equipment.status.replace(/_/g, " ")}
        </StatusBadge>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/equipments/${equipmentId}`}
          style={{
            fontSize: 13,
            color: "var(--patch-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} /> Back to Equipment Overview
        </Link>
        <Tabs label="Equipment sections" items={tabs} />
      </div>

      {/* Metric strip */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label">Total documents</div>
          <div className="metric-value">{documents.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active versions</div>
          <div className="metric-value" style={{ color: "var(--patch-success)" }}>{activeCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">In review / Indexing</div>
          <div className="metric-value" style={{ color: "var(--patch-attention)" }}>{reviewCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Knowledge coverage</div>
          <div className="metric-value">
            {avgCoverage === null ? "—" : `${avgCoverage}%`}
          </div>
        </div>
      </div>

      {/* Profile Freshness bar */}
      <div
        className="card"
        style={{
          padding: "14px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--patch-surface-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ProfileStatusIndicator status={profileState} />
          <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>
            Profile last updated: {equipment.updatedAt}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/documents/processing-state">
            <Button variant="secondary" size="sm">
              <Clock size={14} style={{ marginRight: 6 }} /> View processing queue ({reviewCount})
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={handleRefreshProfile}
          >
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            {refreshing ? "Refreshing…" : "Refresh profile"}
          </Button>
        </div>
      </div>

      {/* Document table toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 280, maxWidth: 480 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--patch-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search equipment documents"
              className="form-select"
              style={{
                paddingLeft: 36,
                backgroundImage: "none",
                appearance: "auto",
                width: "100%",
              }}
            />
          </div>
          <select
            className="form-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter by document type"
            style={{ width: 140 }}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type === "All" ? "All Types" : type}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={() => setAddVersionOpen(true)}>
            <Upload size={14} style={{ marginRight: 6 }} /> Add version
          </Button>
          <Button size="sm" onClick={() => setAddDocOpen(true)}>
            <Plus size={14} style={{ marginRight: 6 }} /> Add new document
          </Button>
        </div>
      </div>

      {/* Documents Table */}
      {filteredDocs.length === 0 ? (
        <section className="empty-state card">
          <FileText size={28} aria-hidden="true" />
          <h2>
            {documents.length === 0
              ? "No documents linked yet"
              : "No documents match your filters"}
          </h2>
          <p>
            {documents.length === 0
              ? "Add the first logical document for this equipment to start the upload → extract → review → approve → index → active lifecycle."
              : "Try a different search term or document type."}
          </p>
          {documents.length === 0 && (
            <Button size="sm" onClick={() => setAddDocOpen(true)}>
              <Plus size={14} style={{ marginRight: 6 }} /> Add new document
            </Button>
          )}
        </section>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}><span className="visually-hidden">Expand</span></th>
                <th>Document name &amp; file</th>
                <th>Type</th>
                <th>Active rev</th>
                <th>Status</th>
                <th>Coverage</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => {
                const isExpanded = expandedDoc === doc.id;
                const coverage = coverageOf(doc);
                return (
                  <tr key={doc.id} style={{ cursor: "pointer" }}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} version history for ${doc.title}`}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--patch-muted)",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td>
                      <div>
                        <Link
                          href={`/documents/${doc.id}`}
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            color: "var(--patch-text)",
                            textDecoration: "none",
                          }}
                        >
                          {doc.title}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                          {doc.versions[0]?.filename ?? doc.id}
                          {" · "}
                          {doc.versions[0]?.fileSize ?? ""}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "var(--patch-surface-elevated)",
                          border: "1px solid var(--patch-boundary)",
                        }}
                      >
                        {doc.docType}
                      </span>
                    </td>
                    <td>
                      <strong>{doc.activeVersion ?? "—"}</strong>
                    </td>
                    <td>
                      <DocumentStatusBadge status={toBadgeStatus(doc.status)} />
                    </td>
                    <td>
                      {coverage !== null ? (
                        <span className="coverage-pct coverage-high">{coverage}%</span>
                      ) : (
                        <span className="coverage-pct coverage-none">—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--patch-muted)" }}>{doc.updatedAt}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <Link href={`/documents/${doc.id}`}>
                          <Button variant="secondary" size="sm">
                            <Eye size={13} style={{ marginRight: 4 }} /> View
                          </Button>
                        </Link>
                        {doc.status === "NEEDS_REVIEW" && (
                          <Link href="/documents/upload-review">
                            <Button size="sm">Review</Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Version expanded details card */}
          {expandedDocument && (
            <div
              style={{
                padding: "16px 24px",
                background: "var(--patch-surface-elevated)",
                borderTop: "1px solid var(--patch-boundary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h4 style={{ fontSize: 14, fontWeight: 650, margin: 0 }}>Version History</h4>
                <Button variant="secondary" size="sm" onClick={() => setAddVersionOpen(true)}>
                  + Add new version
                </Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expandedDocument.versions.map((ver) => (
                  <div
                    key={ver.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 6,
                      background: "var(--patch-surface)",
                      border: "1px solid var(--patch-boundary)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <FileText size={16} color="var(--patch-muted)" />
                      <div>
                        <strong style={{ marginRight: 8 }}>{ver.version}</strong>
                        <span style={{ color: "var(--patch-muted)" }}>
                          {ver.uploadedAt} · {ver.fileSize}
                          {ver.changeSummary ? ` · ${ver.changeSummary}` : ""}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <StatusBadge
                        tone={
                          ver.status === "ACTIVE"
                            ? "success"
                            : ver.status === "NEEDS_REVIEW"
                              ? "attention"
                              : "neutral"
                        }
                      >
                        {ver.status.replace(/_/g, " ")}
                      </StatusBadge>
                      <Link href={`/documents/${expandedDocument.id}`}>
                        <Button variant="secondary" size="sm">
                          Source viewer
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {expandedDocument.status === "FAILED" && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 13,
                    color: "var(--patch-muted)",
                  }}
                >
                  <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                  Indexing failed for the latest upload. The previous
                  active revision remains in use until a new version is
                  successfully indexed and activated.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Drawers */}
      <AddNewDocumentDrawer open={addDocOpen} onClose={() => setAddDocOpen(false)} />
      <AddNewVersionDrawer
        open={addVersionOpen}
        onClose={() => setAddVersionOpen(false)}
        documents={documents.map((d) => ({
          id: d.id,
          name: d.title,
          subtitle: d.versions[0]?.filename ?? d.id,
          activeRevision: d.activeVersion ?? "No active revision",
          activeDate: d.updatedAt,
        }))}
      />
    </AppShell>
  );
}
