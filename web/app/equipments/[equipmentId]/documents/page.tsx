"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import {
  AddNewDocumentDrawer,
  AddNewVersionDrawer,
  DocumentStatusBadge,
  ProfileStatusIndicator,
} from "@/components/documents";

const EQUIPMENT = {
  id: "eq-1",
  name: "Centrifugal Pump P-101",
  tag: "P-101",
  status: "Healthy" as const,
  profileStatus: "Fresh" as "Fresh" | "Refreshing" | "Stale",
  lastProfileUpdate: "May 14, 2025 9:58 AM",
};

const EQUIPMENT_DOCUMENTS = [
  {
    id: "doc-1",
    title: "Operation & Maintenance Manual",
    docType: "Manual",
    subtitle: "P-101-OMM-2025.pdf",
    activeVersion: "v3.2",
    status: "Active" as const,
    fileType: "PDF",
    fileSize: "14.2 MB",
    updatedAt: "May 10, 2025",
    uploadedBy: "Alex Morgan",
    coveragePct: 94,
    versions: [
      { id: "ver-32", version: "v3.2", date: "May 10, 2025", status: "Active", size: "14.2 MB" },
      { id: "ver-31", version: "v3.1", date: "Jan 14, 2024", status: "Superseded", size: "13.8 MB" },
      { id: "ver-30", version: "v3.0", date: "Mar 15, 2021", status: "Superseded", size: "12.5 MB" },
    ],
  },
  {
    id: "doc-2",
    title: "P&ID Diagram P-101-002",
    docType: "P&ID",
    subtitle: "PID-P101-002-REV2.pdf",
    activeVersion: "v2.0",
    status: "Needs review" as const,
    fileType: "PDF",
    fileSize: "8.5 MB",
    updatedAt: "May 12, 2025",
    uploadedBy: "Sarah Chen",
    coveragePct: 82,
    versions: [
      { id: "ver-20", version: "v2.0", date: "May 12, 2025", status: "Needs review", size: "8.5 MB" },
      { id: "ver-10", version: "v1.0", date: "Mar 15, 2021", status: "Active", size: "8.1 MB" },
    ],
  },
  {
    id: "doc-3",
    title: "Mechanical Seal Installation Guide",
    docType: "Manual",
    subtitle: "MSIG-P101-V11.pdf",
    activeVersion: "v1.1",
    status: "Indexing" as const,
    fileType: "PDF",
    fileSize: "3.4 MB",
    updatedAt: "May 14, 2025",
    uploadedBy: "David Kim",
    coveragePct: null,
    versions: [
      { id: "ver-11", version: "v1.1", date: "May 14, 2025", status: "Indexing", size: "3.4 MB" },
      { id: "ver-10", version: "v1.0", date: "Aug 10, 2022", status: "Active", size: "3.1 MB" },
    ],
  },
  {
    id: "doc-4",
    title: "Technical Data Sheet",
    docType: "Datasheet",
    subtitle: "TDS-XH150-400.pdf",
    activeVersion: "v1.0",
    status: "Active" as const,
    fileType: "PDF",
    fileSize: "2.1 MB",
    updatedAt: "Mar 15, 2021",
    uploadedBy: "System",
    coveragePct: 98,
    versions: [
      { id: "ver-10", version: "v1.0", date: "Mar 15, 2021", status: "Active", size: "2.1 MB" },
    ],
  },
];

export default function EquipmentDocumentsPage() {
  const [activeTab, setActiveTab] = useState("documents");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>("doc-1");

  const tabs = [
    { id: "overview", label: "Overview", active: false, onSelect: () => {} },
    { id: "documents", label: "Documents", active: true, onSelect: () => {} },
    { id: "projects", label: "Projects", active: false, onSelect: () => {} },
    { id: "activity", label: "Activity", active: false, onSelect: () => {} },
  ];

  const filteredDocs = EQUIPMENT_DOCUMENTS.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.subtitle.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === "All" || doc.docType === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <AppShell
      title={EQUIPMENT.name}
      status={<StatusBadge tone="success">{EQUIPMENT.status}</StatusBadge>}
    >
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/equipments/eq-1"
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
          <div className="metric-value">4</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active versions</div>
          <div className="metric-value" style={{ color: "var(--patch-success)" }}>2</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">In review / Indexing</div>
          <div className="metric-value" style={{ color: "var(--patch-attention)" }}>2</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Knowledge coverage</div>
          <div className="metric-value">91%</div>
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
          <ProfileStatusIndicator status={EQUIPMENT.profileStatus} />
          <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>
            Profile last updated: {EQUIPMENT.lastProfileUpdate}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/documents/processing-state">
            <Button variant="secondary" size="sm">
              <Clock size={14} style={{ marginRight: 6 }} /> View processing queue (2)
            </Button>
          </Link>
          <Button variant="secondary" size="sm">
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh profile
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
            style={{ width: 140 }}
          >
            <option value="All">All Types</option>
            <option value="Manual">Manual</option>
            <option value="P&amp;ID">P&amp;ID</option>
            <option value="Datasheet">Datasheet</option>
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
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
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
              return (
                <tr key={doc.id} style={{ cursor: "pointer" }}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
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
                        href={`/documents/${doc.versions[0].id}`}
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
                      <Link href={`/documents/${doc.versions[0].id}`}>
                        <Button variant="secondary" size="sm">
                          <Eye size={13} style={{ marginRight: 4 }} /> View
                        </Button>
                      </Link>
                      {doc.status === "Needs review" && (
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
        {expandedDoc && (
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
              {EQUIPMENT_DOCUMENTS.find((d) => d.id === expandedDoc)?.versions.map((ver) => (
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
                      <span style={{ color: "var(--patch-muted)" }}>{ver.date} · {ver.size}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StatusBadge
                      tone={
                        ver.status === "Active"
                          ? "success"
                          : ver.status === "Needs review"
                          ? "attention"
                          : "neutral"
                      }
                    >
                      {ver.status}
                    </StatusBadge>
                    <Link href={`/documents/${ver.id}`}>
                      <Button variant="secondary" size="sm">
                        Source viewer
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drawers */}
      <AddNewDocumentDrawer open={addDocOpen} onClose={() => setAddDocOpen(false)} />
      <AddNewVersionDrawer
        open={addVersionOpen}
        onClose={() => setAddVersionOpen(false)}
        documents={EQUIPMENT_DOCUMENTS.map((d) => ({
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
