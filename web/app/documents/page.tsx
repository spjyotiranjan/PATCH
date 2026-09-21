"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Eye,
  FileText,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";
import {
  AddNewDocumentDrawer,
  AddNewVersionDrawer,
  DocumentStatusBadge,
  InclusionBadge,
} from "@/components/documents";
import {
  getDocuments,
  getProcessingQueue,
} from "@/lib/api/documents";
import type { Document } from "@/lib/types/document";

type LibraryDoc = {
  id: string;
  title: string;
  subtitle: string;
  docType: string;
  activeVersion: string;
  status: "Active" | "Needs review" | "Indexing" | "Failed";
  fileSize: string;
  updatedAt: string;
  entityType: string;
  entityName: string;
  entityId: string;
  coveragePct: number | null;
};

function toLibraryDoc(doc: Document): LibraryDoc {
  const active = doc.versions.find(
    (version) => version.id === doc.activeVersionId,
  );

  return {
    id: doc.id,
    title: doc.title,
    subtitle:
      doc.versions[0]?.filename ?? doc.id,
    docType: doc.docType,
    activeVersion: doc.activeVersion ?? "—",
    status:
      doc.status === "ACTIVE"
        ? "Active"
        : doc.status === "NEEDS_REVIEW"
          ? "Needs review"
          : doc.status === "FAILED"
            ? "Failed"
            : "Indexing",
    fileSize:
      doc.versions[0]?.fileSize ?? "—",
    updatedAt: doc.updatedAt,
    entityType: doc.equipmentId
      ? "Equipment"
      : doc.projectId
        ? "Project"
        : "Global",
    entityName:
      doc.equipmentName ??
      "Facility Global Standard",
    entityId:
      doc.equipmentId ??
      doc.projectId ??
      "global-1",
    coveragePct:
      active?.coveragePct ??
      doc.versions[0]?.coveragePct ??
      null,
  };
}
export default function GlobalDocumentsPage() {
  const [libraryDocs, setLibraryDocs] = useState<LibraryDoc[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedEntity, setSelectedEntity] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [docs, queue] = await Promise.all([
          getDocuments(),
          getProcessingQueue(),
        ]);

        if (!cancelled) {
          setLibraryDocs(docs.map(toLibraryDoc));
          setQueueCount(queue.length);
        }
      } catch {
        if (!cancelled) {
          setError(
            "The document library could not be loaded. Check your connection and retry.",
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
  }, [reloadToken]);

  const filteredDocs = useMemo(() => {
    return libraryDocs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      doc.entityName.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === "All" || doc.docType === selectedType;
    const matchesEntity = selectedEntity === "All" || doc.entityType === selectedEntity;
    const matchesStatus = selectedStatus === "All" || doc.status === selectedStatus;

    return matchesSearch && matchesType && matchesEntity && matchesStatus;
    });
  }, [
    libraryDocs,
    search,
    selectedType,
    selectedEntity,
    selectedStatus,
  ]);

  const activeCount = libraryDocs.filter(
    (doc) => doc.status === "Active",
  ).length;
  const reviewCount = libraryDocs.filter(
    (doc) => doc.status !== "Active" && doc.status !== "Failed",
  ).length;
  const failedCount = libraryDocs.filter(
    (doc) => doc.status === "Failed",
  ).length;

  if (loading) {
    return (
      <AppShell title="Documents Library">
        <section
          className="empty-state"
          aria-live="polite"
        >
          <h2>Loading document library…</h2>
          <p>
            Deduplicating logical documents
            across equipments and projects.
          </p>
        </section>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Documents Library">
        <section
          className="empty-state"
          role="alert"
        >
          <h2>The library could not be loaded</h2>
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
      </AppShell>
    );
  }

  return (
    <AppShell title="Documents Library">
      {/* Metric strip */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Total library documents</div>
          <div className="metric-value">{libraryDocs.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active revisions</div>
          <div className="metric-value" style={{ color: "var(--patch-success)" }}>{activeCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">In review / Processing</div>
          <div className="metric-value" style={{ color: "var(--patch-attention)" }}>{reviewCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Failed extractions</div>
          <div className="metric-value" style={{ color: "var(--patch-danger)" }}>{failedCount}</div>
        </div>
      </div>

      {/* Top Controls Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 300 }}>
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
              placeholder="Search across all documents, tags, or entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            style={{ width: 130 }}
          >
            <option value="All">All Types</option>
            <option value="Manual">Manual</option>
            <option value="P&amp;ID">P&amp;ID</option>
            <option value="Datasheet">Datasheet</option>
            <option value="Specification">Specification</option>
            <option value="Safety">Safety</option>
          </select>
          <select
            className="form-select"
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="All">All Targets</option>
            <option value="Equipment">Equipment</option>
            <option value="Project">Project</option>
            <option value="Global">Global</option>
          </select>
          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Needs review">Needs review</option>
            <option value="Indexing">Indexing</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/documents/processing-state">
            <Button variant="secondary" size="sm">
              <Clock size={14} style={{ marginRight: 6 }} /> Processing Queue ({queueCount})
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setAddVersionOpen(true)}>
            <Upload size={14} style={{ marginRight: 6 }} /> Add version
          </Button>
          <Button size="sm" onClick={() => setAddDocOpen(true)}>
            <Plus size={14} style={{ marginRight: 6 }} /> Add document
          </Button>
        </div>
      </div>

      {/* Global Document Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Document title &amp; filename</th>
              <th>Type</th>
              <th>Target entity</th>
              <th>Active rev</th>
              <th>Status</th>
              <th>Coverage</th>
              <th>Updated</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  {libraryDocs.length === 0
                    ? "No documents in the library yet. Add the first document to start the ingestion lifecycle."
                    : "No documents match your search or filters."}
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
              <tr key={doc.id}>
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
                      {doc.subtitle} · {doc.fileSize}
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
                  {doc.entityType === "Equipment" ? (
                    <InclusionBadge equipmentName={doc.entityName} />
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--patch-muted)", fontWeight: 500 }}>
                      {doc.entityName}
                    </span>
                  )}
                </td>
                <td>
                  <strong>{doc.activeVersion}</strong>
                </td>
                <td>
                  <DocumentStatusBadge status={doc.status} />
                </td>
                <td>
                  {doc.coveragePct !== null ? (
                    <span className="coverage-pct coverage-high">{doc.coveragePct}%</span>
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
                    {doc.status === "Needs review" && (
                      <Link href="/documents/upload-review">
                        <Button size="sm">Review</Button>
                      </Link>
                    )}
                    {doc.status === "Failed" && (
                      <Link href="/documents/processing-state">
                        <Button variant="secondary" size="sm" style={{ color: "var(--patch-danger)" }}>
                          Retry
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawers */}
      <AddNewDocumentDrawer open={addDocOpen} onClose={() => setAddDocOpen(false)} />
      <AddNewVersionDrawer
        open={addVersionOpen}
        onClose={() => setAddVersionOpen(false)}
        documents={filteredDocs.map((d) => ({
          id: d.id,
          name: d.title,
          subtitle: d.subtitle,
          activeRevision: d.activeVersion,
          activeDate: d.updatedAt,
        }))}
      />
    </AppShell>
  );
}