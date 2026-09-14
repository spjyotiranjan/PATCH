"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import {
  AddNewDocumentDrawer,
  AddNewVersionDrawer,
  DocumentStatusBadge,
  InclusionBadge,
  ProfileStatusIndicator,
} from "@/components/documents";

const PROJECT = {
  id: "prj-1",
  name: "Cooling Water System Upgrade 2025",
  code: "PRJ-2025-089",
  status: "In Progress" as const,
  profileStatus: "Fresh" as "Fresh" | "Refreshing" | "Stale",
  lastProfileUpdate: "May 14, 2025 10:15 AM",
};

const DIRECT_PROJECT_DOCS = [
  {
    id: "pdoc-1",
    title: "Project Execution Plan & Scope of Work",
    docType: "Project Plan",
    subtitle: "PRJ-2025-PEP-V2.pdf",
    activeVersion: "v2.0",
    status: "Active" as const,
    fileSize: "6.8 MB",
    updatedAt: "May 01, 2025",
    uploadedBy: "Mark Stevens",
    coveragePct: 96,
    versions: [{ id: "pver-20", version: "v2.0", date: "May 01, 2025", status: "Active", size: "6.8 MB" }],
  },
  {
    id: "pdoc-2",
    title: "Piping & Instrumentation Refit Specification",
    docType: "Specification",
    subtitle: "PIR-SPEC-REV1.pdf",
    activeVersion: "v1.0",
    status: "Active" as const,
    fileSize: "4.5 MB",
    updatedAt: "Apr 20, 2025",
    uploadedBy: "Elena Rostova",
    coveragePct: 90,
    versions: [{ id: "pver-10", version: "v1.0", date: "Apr 20, 2025", status: "Active", size: "4.5 MB" }],
  },
  {
    id: "pdoc-3",
    title: "Commissioning & Safety Risk Assessment",
    docType: "Safety",
    subtitle: "CS-RA-2025-DRAFT.pdf",
    activeVersion: "v0.9",
    status: "Needs review" as const,
    fileSize: "3.1 MB",
    updatedAt: "May 13, 2025",
    uploadedBy: "David Kim",
    coveragePct: 75,
    versions: [{ id: "pver-09", version: "v0.9", date: "May 13, 2025", status: "Needs review", size: "3.1 MB" }],
  },
];

const INHERITED_EQUIPMENT_DOCS = [
  {
    id: "doc-1",
    title: "Operation & Maintenance Manual",
    docType: "Manual",
    subtitle: "P-101-OMM-2025.pdf",
    activeVersion: "v3.2",
    status: "Active" as const,
    fileSize: "14.2 MB",
    updatedAt: "May 10, 2025",
    equipmentName: "Centrifugal Pump P-101",
    equipmentId: "eq-1",
    coveragePct: 94,
  },
  {
    id: "doc-2",
    title: "P&ID Diagram P-101-002",
    docType: "P&ID",
    subtitle: "PID-P101-002-REV2.pdf",
    activeVersion: "v2.0",
    status: "Needs review" as const,
    fileSize: "8.5 MB",
    updatedAt: "May 12, 2025",
    equipmentName: "Centrifugal Pump P-101",
    equipmentId: "eq-1",
    coveragePct: 82,
  },
  {
    id: "doc-4",
    title: "Heat Exchanger Data Sheet & Thermal Curve",
    docType: "Datasheet",
    subtitle: "HX-202-TDS.pdf",
    activeVersion: "v1.2",
    status: "Active" as const,
    fileSize: "5.4 MB",
    updatedAt: "Feb 18, 2025",
    equipmentName: "Heat Exchanger HX-202",
    equipmentId: "eq-2",
    coveragePct: 91,
  },
];

export default function ProjectDocumentsPage() {
  const [search, setSearch] = useState("");
  const [docSourceFilter, setDocSourceFilter] = useState<"All" | "Direct" | "Inherited">("All");
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);

  const tabs = [
    { id: "overview", label: "Overview", active: false, onSelect: () => {} },
    { id: "documents", label: "Documents", active: true, onSelect: () => {} },
    { id: "equipment", label: "Associated Equipment", active: false, onSelect: () => {} },
    { id: "activity", label: "Activity", active: false, onSelect: () => {} },
  ];

  const filteredDirect = DIRECT_PROJECT_DOCS.filter(
    (d) =>
      (docSourceFilter === "All" || docSourceFilter === "Direct") &&
      (d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.subtitle.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredInherited = INHERITED_EQUIPMENT_DOCS.filter(
    (d) =>
      (docSourceFilter === "All" || docSourceFilter === "Inherited") &&
      (d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.subtitle.toLowerCase().includes(search.toLowerCase()) ||
        d.equipmentName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppShell
      title={PROJECT.name}
      status={<StatusBadge tone="info">{PROJECT.status}</StatusBadge>}
    >
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/projects/prj-1"
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
          <ArrowLeft size={14} /> Back to Project Overview
        </Link>
        <Tabs label="Project sections" items={tabs} />
      </div>

      {/* Metric strip */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label">Direct project docs</div>
          <div className="metric-value">3</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Inherited equipment docs</div>
          <div className="metric-value">3</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total linked docs</div>
          <div className="metric-value" style={{ color: "var(--patch-success)" }}>6</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ingestion / Review</div>
          <div className="metric-value" style={{ color: "var(--patch-attention)" }}>2</div>
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
          <ProfileStatusIndicator status={PROJECT.profileStatus} />
          <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>
            Project profile last updated: {PROJECT.lastProfileUpdate}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/documents/processing-state">
            <Button variant="secondary" size="sm">View processing queue (2)</Button>
          </Link>
          <Button variant="secondary" size="sm">
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh project profile
          </Button>
        </div>
      </div>

      {/* Document toolbar */}
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
              placeholder="Search project documents..."
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
            value={docSourceFilter}
            onChange={(e) => setDocSourceFilter(e.target.value as any)}
            style={{ width: 150 }}
          >
            <option value="All">All Sources</option>
            <option value="Direct">Direct Only</option>
            <option value="Inherited">Inherited Only</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={() => setAddVersionOpen(true)}>
            <Upload size={14} style={{ marginRight: 6 }} /> Add version
          </Button>
          <Button size="sm" onClick={() => setAddDocOpen(true)}>
            <Plus size={14} style={{ marginRight: 6 }} /> Add direct document
          </Button>
        </div>
      </div>

      {/* Direct Project Documents Table */}
      {(docSourceFilter === "All" || docSourceFilter === "Direct") && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={18} color="var(--patch-accent)" />
            Direct Project Documents
            <span style={{ fontSize: 12, color: "var(--patch-muted)", fontWeight: 400 }}>
              ({filteredDirect.length} documents uploaded directly to project)
            </span>
          </h3>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Document title &amp; file</th>
                  <th>Type</th>
                  <th>Active rev</th>
                  <th>Status</th>
                  <th>Coverage</th>
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirect.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div>
                        <Link
                          href={`/documents/${doc.versions[0].id}`}
                          style={{ fontWeight: 600, fontSize: 14, color: "var(--patch-text)", textDecoration: "none" }}
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
                    <td><strong>{doc.activeVersion}</strong></td>
                    <td><DocumentStatusBadge status={doc.status} /></td>
                    <td><span className="coverage-pct coverage-high">{doc.coveragePct}%</span></td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inherited Equipment Documents Table */}
      {(docSourceFilter === "All" || docSourceFilter === "Inherited") && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={18} color="var(--patch-success)" />
            Inherited Equipment Documents
            <span style={{ fontSize: 12, color: "var(--patch-muted)", fontWeight: 400 }}>
              ({filteredInherited.length} documents linked via associated equipment)
            </span>
          </h3>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Document title &amp; file</th>
                  <th>Source equipment</th>
                  <th>Active rev</th>
                  <th>Status</th>
                  <th>Coverage</th>
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInherited.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div>
                        <Link
                          href={`/documents/${doc.id}`}
                          style={{ fontWeight: 600, fontSize: 14, color: "var(--patch-text)", textDecoration: "none" }}
                        >
                          {doc.title}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                          {doc.subtitle} · {doc.fileSize}
                        </div>
                      </div>
                    </td>
                    <td>
                      <InclusionBadge equipmentName={doc.equipmentName} />
                    </td>
                    <td><strong>{doc.activeVersion}</strong></td>
                    <td><DocumentStatusBadge status={doc.status} /></td>
                    <td><span className="coverage-pct coverage-high">{doc.coveragePct}%</span></td>
                    <td style={{ fontSize: 13, color: "var(--patch-muted)" }}>{doc.updatedAt}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/documents/${doc.id}`}>
                        <Button variant="secondary" size="sm">
                          <Eye size={13} style={{ marginRight: 4 }} /> View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawers */}
      <AddNewDocumentDrawer open={addDocOpen} onClose={() => setAddDocOpen(false)} />
      <AddNewVersionDrawer
        open={addVersionOpen}
        onClose={() => setAddVersionOpen(false)}
        documents={DIRECT_PROJECT_DOCS.map((d) => ({
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
