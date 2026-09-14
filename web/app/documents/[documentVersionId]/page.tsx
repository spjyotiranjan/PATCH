"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  History,
  Layers,
  Search,
  Share2,
  Sparkles,
  Tag,
  User,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/documents";

const MOCK_DOC_VERSIONS: Record<
  string,
  {
    title: string;
    filename: string;
    fileSize: string;
    version: string;
    status: "Active" | "Needs review" | "Superseded" | "Indexing";
    updatedAt: string;
    uploadedBy: string;
    coveragePct: number;
    entities: { type: string; name: string; href: string }[];
    history: { version: string; date: string; status: string; author: string; id: string }[];
    highlights: { page: number; text: string; label: string }[];
    contentPages: string[];
  }
> = {
  "ver-32": {
    title: "Centrifugal Pump P-101 Operation & Maintenance Manual",
    filename: "P-101-OMM-2025.pdf",
    fileSize: "14.2 MB",
    version: "v3.2",
    status: "Active",
    updatedAt: "May 10, 2025",
    uploadedBy: "Alex Morgan",
    coveragePct: 94,
    entities: [
      { type: "Equipment", name: "Centrifugal Pump P-101", href: "/equipments/eq-1" },
      { type: "Project", name: "Cooling Water System Upgrade 2025", href: "/projects/prj-1" },
    ],
    history: [
      { version: "v3.2", date: "May 10, 2025", status: "Active", author: "Alex Morgan", id: "ver-32" },
      { version: "v3.1", date: "Jan 14, 2024", status: "Superseded", author: "Sarah Chen", id: "ver-31" },
      { version: "v3.0", date: "Mar 15, 2021", status: "Superseded", author: "System", id: "ver-30" },
    ],
    highlights: [
      { page: 4, label: "Operating Pressure", text: "Design Operating Pressure: 12.4 bar (180 PSI) continuous rating." },
      { page: 12, label: "Seal Inspection", text: "Mechanical Seal inspection interval: Every 6 months or 4,000 operational hours." },
      { page: 18, label: "Lubrication Specs", text: "ISO VG 68 synthetic turbine oil. Capacity: 3.5 liters." },
    ],
    contentPages: [
      "SECTION 3: OPERATING PARAMETERS & SPECIFICATIONS\n\n3.1 Design Ratings\nHorizontal end-suction centrifugal pump Model XH-150/400 is specified for continuous liquid circulation.\n- Rated Flow Rate: 450 m³/h\n- Design Operating Pressure: 12.4 bar (180 PSI) continuous rating.\n- Shutoff Head: 62 meters\n- Operating Temperature Range: -10°C to +95°C",
      "SECTION 4: MAINTENANCE & INSPECTION SCHEDULES\n\n4.2 Mechanical Seal Maintenance\nThe mechanical seal (Cartridge Type MS-40) requires routine inspection.\n- Mechanical Seal inspection interval: Every 6 months or 4,000 operational hours.\n- Flush Water Flow Rate: 8 L/min minimum\n- Flush Pressure: 1.5 bar above suction pressure.",
    ],
  },
};

export default function SourceViewerPage() {
  const params = useParams();
  const versionId = (params?.documentVersionId as string) || "ver-32";
  const doc = MOCK_DOC_VERSIONS[versionId] || MOCK_DOC_VERSIONS["ver-32"];

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedHighlight, setSelectedHighlight] = useState<number | null>(0);
  const [zoom, setZoom] = useState(100);

  return (
    <AppShell title={doc.title}>
      {/* Top Header & Breadcrumbs */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/equipments/eq-1/documents"
            style={{
              fontSize: 13,
              color: "var(--patch-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} /> Back to Documents
          </Link>
          <span style={{ color: "var(--patch-boundary)" }}>|</span>
          <strong style={{ fontSize: 14 }}>{doc.filename}</strong>
          <DocumentStatusBadge status={doc.status} />
          <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>Revision {doc.version}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm">
            <Share2 size={14} style={{ marginRight: 6 }} /> Share Link
          </Button>
          <Button size="sm">
            <Download size={14} style={{ marginRight: 6 }} /> Download PDF ({doc.fileSize})
          </Button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        {/* Left Column: PDF Source Document Viewer */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* PDF Toolbar */}
          <div
            style={{
              padding: "10px 16px",
              background: "var(--patch-surface-elevated)",
              borderBottom: "1px solid var(--patch-boundary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page <strong>{currentPage}</strong> of {doc.contentPages.length}
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCurrentPage((p) => Math.min(doc.contentPages.length, p + 1))}
                disabled={currentPage >= doc.contentPages.length}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" className="icon-button" onClick={() => setZoom((z) => Math.max(75, z - 15))}>
                <ZoomOut size={16} />
              </button>
              <span>{zoom}%</span>
              <button type="button" className="icon-button" onClick={() => setZoom((z) => Math.min(150, z + 15))}>
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          {/* Highlights Toolbar / Pills */}
          <div
            style={{
              padding: "10px 16px",
              background: "var(--patch-surface)",
              borderBottom: "1px solid var(--patch-boundary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflowX: "auto",
            }}
          >
            <Sparkles size={14} color="var(--patch-accent)" />
            <span style={{ fontSize: 12, fontWeight: 650, color: "var(--patch-muted)" }}>Cited Highlights:</span>
            {doc.highlights.map((hl, idx) => (
              <button
                key={hl.label}
                type="button"
                className={`doc-mode-pill ${selectedHighlight === idx ? "active" : ""}`}
                onClick={() => {
                  setSelectedHighlight(idx);
                  setCurrentPage(hl.page <= doc.contentPages.length ? hl.page : 1);
                }}
              >
                P.{hl.page} · {hl.label}
              </button>
            ))}
          </div>

          {/* PDF Page View Content */}
          <div
            style={{
              padding: 32,
              minHeight: 520,
              background: "#0f172a",
              color: "#e2e8f0",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
              overflowY: "auto",
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
            }}
          >
            {doc.contentPages[currentPage - 1] || doc.contentPages[0]}

            {selectedHighlight !== null && doc.highlights[selectedHighlight] && (
              <div
                style={{
                  marginTop: 24,
                  padding: "12px 16px",
                  background: "rgba(59, 130, 246, 0.15)",
                  borderLeft: "4px solid #3b82f6",
                  borderRadius: 4,
                  color: "#93c5fd",
                }}
              >
                <strong style={{ display: "block", marginBottom: 4, color: "#ffffff" }}>
                  Highlighted Reference [{doc.highlights[selectedHighlight].label}]
                </strong>
                &quot;{doc.highlights[selectedHighlight].text}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Version Timeline & Linked Entities */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Version History Inspector */}
          <div className="card">
            <h4 style={{ fontSize: 14, fontWeight: 650, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <History size={16} color="var(--patch-accent)" />
              Version History Timeline
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {doc.history.map((ver) => {
                const isCurrent = ver.version === doc.version;
                return (
                  <div
                    key={ver.version}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      background: isCurrent ? "var(--patch-surface-elevated)" : "var(--patch-surface)",
                      border: isCurrent ? "1px solid var(--patch-accent)" : "1px solid var(--patch-boundary)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <strong style={{ fontSize: 13 }}>Revision {ver.version}</strong>
                      <StatusBadge tone={ver.status === "Active" ? "success" : "neutral"}>
                        {ver.status}
                      </StatusBadge>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                      Uploaded {ver.date} by {ver.author}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linked Target Entities */}
          <div className="card">
            <h4 style={{ fontSize: 14, fontWeight: 650, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={16} color="var(--patch-accent)" />
              Linked Target Entities
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {doc.entities.map((entity) => (
                <div
                  key={entity.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: "var(--patch-surface)",
                    border: "1px solid var(--patch-boundary)",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, color: "var(--patch-muted)", display: "block" }}>
                      {entity.type}
                    </span>
                    <strong style={{ fontSize: 13 }}>{entity.name}</strong>
                  </div>
                  <Link href={entity.href}>
                    <Button variant="secondary" size="sm">
                      <ExternalLink size={13} />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Extracted Vector Details */}
          <div className="card">
            <h4 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Indexing &amp; Coverage</h4>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Knowledge Coverage:</span>
                <span className="coverage-pct coverage-high">{doc.coveragePct}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Vector Chunks:</span>
                <strong>48 Chunks Indexed</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Embedding Model:</span>
                <strong>text-embedding-3-large</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
