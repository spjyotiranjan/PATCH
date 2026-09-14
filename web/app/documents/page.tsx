"use client";

import { useState } from "react";
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

const ALL_LIBRARY_DOCUMENTS = [
  {
    id: "doc-1",
    title: "Centrifugal Pump P-101 Operation & Maintenance Manual",
    subtitle: "P-101-OMM-2025.pdf",
    docType: "Manual",
    activeVersion: "v3.2",
    status: "Active" as const,
    fileSize: "14.2 MB",
    updatedAt: "May 10, 2025",
    entityType: "Equipment",
    entityName: "Centrifugal Pump P-101",
    entityId: "eq-1",
    coveragePct: 94,
  },
  {
    id: "doc-2",
    title: "P&ID Diagram P-101-002 (Utility Cooling Water)",
    subtitle: "PID-P101-002-REV2.pdf",
    docType: "P&ID",
    activeVersion: "v2.0",
    status: "Needs review" as const,
    fileSize: "8.5 MB",
    updatedAt: "May 12, 2025",
    entityType: "Equipment",
    entityName: "Centrifugal Pump P-101",
    entityId: "eq-1",
    coveragePct: 82,
  },
  {
    id: "pdoc-1",
    title: "Project Execution Plan & Scope of Work - Cooling Water Upgrade",
    subtitle: "PRJ-2025-PEP-V2.pdf",
    docType: "Specification",
    activeVersion: "v2.0",
    status: "Active" as const,
    fileSize: "6.8 MB",
    updatedAt: "May 01, 2025",
    entityType: "Project",
    entityName: "Cooling Water System Upgrade 2025",
    entityId: "prj-1",
    coveragePct: 96,
  },
  {
    id: "doc-3",
    title: "Mechanical Seal Installation & Maintenance Guide",
    subtitle: "MSIG-P101-V11.pdf",
    docType: "Manual",
    activeVersion: "v1.1",
    status: "Indexing" as const,
    fileSize: "3.4 MB",
    updatedAt: "May 14, 2025",
    entityType: "Equipment",
    entityName: "Centrifugal Pump P-101",
    entityId: "eq-1",
    coveragePct: null,
  },
  {
    id: "doc-4",
    title: "Heat Exchanger HX-202 Datasheet & Thermal Specification",
    subtitle: "HX-202-TDS.pdf",
    docType: "Datasheet",
    activeVersion: "v1.2",
    status: "Active" as const,
    fileSize: "5.4 MB",
    updatedAt: "Feb 18, 2025",
    entityType: "Equipment",
    entityName: "Heat Exchanger HX-202",
    entityId: "eq-2",
    coveragePct: 91,
  },
  {
    id: "doc-5",
    title: "Plant Safety Standards & Pressure Vessel Compliance 2024",
    subtitle: "PLANT-SAFETY-STD-2024.pdf",
    docType: "Safety",
    activeVersion: "v4.0",
    status: "Active" as const,
    fileSize: "18.6 MB",
    updatedAt: "Jan 10, 2025",
    entityType: "Global",
    entityName: "Facility Global Standard",
    entityId: "global-1",
    coveragePct: 99,
  },
  {
    id: "doc-6",
    title: "Vibration Sensor Callout & Telemetry Setup Guide",
    subtitle: "VS-TELEMETRY-SETUP.pdf",
    docType: "Manual",
    activeVersion: "v1.0",
    status: "Failed" as const,
    fileSize: "1.8 MB",
    updatedAt: "May 14, 2025",
    entityType: "Equipment",
    entityName: "Centrifugal Pump P-101",
    entityId: "eq-1",
    coveragePct: null,
  },
];

export default function GlobalDocumentsPage() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedEntity, setSelectedEntity] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);

  const filteredDocs = ALL_LIBRARY_DOCUMENTS.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      doc.entityName.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === "All" || doc.docType === selectedType;
    const matchesEntity = selectedEntity === "All" || doc.entityType === selectedEntity;
    const matchesStatus = selectedStatus === "All" || doc.status === selectedStatus;

    return matchesSearch && matchesType && matchesEntity && matchesStatus;
  });

  return (
    <AppShell title="Documents Library">
      {/* Metric strip */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Total library documents</div>
          <div className="metric-value">38</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active revisions</div>
          <div className="metric-value" style={{ color: "var(--patch-success)" }}>34</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">In review / Processing</div>
          <div className="metric-value" style={{ color: "var(--patch-attention)" }}>3</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Failed extractions</div>
          <div className="metric-value" style={{ color: "var(--patch-danger)" }}>1</div>
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
              <Clock size={14} style={{ marginRight: 6 }} /> Processing Queue (3)
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
            {filteredDocs.map((doc) => (
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawers */}
      <AddNewDocumentDrawer open={addDocOpen} onClose={() => setAddDocOpen(false)} />
      <AddNewVersionDrawer
        open={addVersionOpen}
        onClose={() => setAddVersionOpen(false)}
        documents={ALL_LIBRARY_DOCUMENTS.map((d) => ({
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