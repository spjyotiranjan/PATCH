"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/documents";
import {
  getDocument,
  getDocuments,
} from "@/lib/api/documents";
import type { Document } from "@/lib/types/document";

/* Sample extracted excerpts for the seeded pump manual. Other
   documents show a preview placeholder until backend preview
   bytes are available. */
const SAMPLE_EXCERPTS: Record<
  string,
  {
    highlights: { page: number; text: string; label: string }[];
    contentPages: string[];
  }
> = {
  "doc-1": {
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

function placeholderPreview(doc: Document): string[] {
  const active =
    doc.versions.find(
      (version) => version.id === doc.activeVersionId,
    ) ?? doc.versions[0];

  return [
    `PREVIEW PLACEHOLDER — original preview bytes are unavailable in the frontend mock.\n\n${doc.title}\nActive revision: ${doc.activeVersion ?? "none"} · Status: ${doc.status.replace(/_/g, " ")}\nFile: ${active?.filename ?? "—"} (${active?.fileSize ?? "—"})\nUploaded by ${doc.uploadedBy} on ${doc.updatedAt}`,
    `VERSION SUMMARY\n\n${active?.changeSummary ?? "No change summary recorded for this version."}\n\nOpen the version history to compare revisions. Approval and indexing states are shown per version.`,
  ];
}

export default function SourceViewerPage() {
  const params = useParams();
  const routeId =
    (params?.documentVersionId as string) || "doc-1";

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedHighlight, setSelectedHighlight] = useState<number | null>(0);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setCurrentPage(1);
        setSelectedHighlight(0);

        // Accept a logical document ID or a version ID, since both
        // link here from tables and history rows.
        const direct = await getDocument(routeId);
        let resolved = direct;

        if (!resolved) {
          const all = await getDocuments();
          resolved =
            all.find((candidate) =>
              candidate.versions.some(
                (version) => version.id === routeId,
              ),
            ) ?? null;
        }

        if (!cancelled) {
          setDoc(resolved);
        }
      } catch {
        if (!cancelled) {
          setError(
            "The source could not be loaded. Check your connection and retry.",
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
  }, [routeId, reloadToken]);

  function handleShare() {
    const url = window.location.href;

    if (navigator.clipboard) {
      void navigator.clipboard
        .writeText(url)
        .then(
          () =>
            toast.success(
              "Source link copied to clipboard.",
            ),
          () =>
            toast.error(
              "The link could not be copied.",
            ),
        );
    } else {
      toast.error(
        "Clipboard is unavailable in this browser.",
      );
    }
  }

  function handleDownload() {
    toast.success(
      "Export queued. The original file will download once backend file service is connected.",
    );
  }

  if (loading) {
    return (
      <AppShell title="Source viewer">
        <section
          className="empty-state"
          aria-live="polite"
        >
          <h2>Loading source…</h2>
          <p>
            Resolving the logical document,
            active revision, and history.
          </p>
        </section>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Source viewer">
        <section
          className="empty-state"
          role="alert"
        >
          <h2>The source could not be loaded</h2>
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

  if (!doc) {
    return (
      <AppShell title="Source viewer">
        <section className="empty-state">
          <FileText size={28} aria-hidden="true" />
          <h2>Source unavailable</h2>
          <p>
            No document or version with ID “
            {routeId}” is accessible. It may
            have been archived or you may not
            have access.
          </p>
          <Link href="/documents">
            <Button type="button">
              Back to library
            </Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  const excerpts =
    SAMPLE_EXCERPTS[doc.id] ?? null;
  const contentPages = excerpts
    ? excerpts.contentPages
    : placeholderPreview(doc);
  const highlights = excerpts
    ? excerpts.highlights
    : [];
  const activeVersion =
    doc.versions.find(
      (version) =>
        version.id === doc.activeVersionId,
    ) ?? doc.versions[0];
  const coverage =
    activeVersion?.coveragePct ?? null;

  const entities: {
    type: string;
    name: string;
    href: string;
  }[] = [];
  if (doc.equipmentId) {
    entities.push({
      type: "Equipment",
      name:
        doc.equipmentName ?? doc.equipmentId,
      href: `/equipments/${doc.equipmentId}`,
    });
  }
  if (doc.projectId) {
    entities.push({
      type: "Project",
      name: doc.projectId,
      href: `/projects/${doc.projectId}`,
    });
  }

  const backHref = doc.equipmentId
    ? `/equipments/${doc.equipmentId}/documents`
    : doc.projectId
      ? `/projects/${doc.projectId}/documents`
      : "/documents";

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
            href={backHref}
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
          <strong style={{ fontSize: 14 }}>{activeVersion?.filename ?? doc.id}</strong>
          <DocumentStatusBadge
            status={
              doc.status === "ACTIVE"
                ? "Active"
                : doc.status === "NEEDS_REVIEW"
                  ? "Needs review"
                  : doc.status === "FAILED"
                    ? "Failed"
                    : doc.status === "SUPERSEDED"
                      ? "Superseded"
                      : "Indexing"
            }
          />
          <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>
            Revision {doc.activeVersion ?? "—"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={handleShare}>
            <Share2 size={14} style={{ marginRight: 6 }} /> Share Link
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download size={14} style={{ marginRight: 6 }} /> Download
            {activeVersion?.fileSize ? ` (${activeVersion.fileSize})` : ""}
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
                Page <strong>{currentPage}</strong> of {contentPages.length}
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCurrentPage((p) => Math.min(contentPages.length, p + 1))}
                disabled={currentPage >= contentPages.length}
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
            {highlights.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                No extracted highlights for this version yet.
              </span>
            ) : (
              highlights.map((hl, idx) => (
                <button
                  key={hl.label}
                  type="button"
                  className={`doc-mode-pill ${selectedHighlight === idx ? "active" : ""}`}
                  onClick={() => {
                    setSelectedHighlight(idx);
                    setCurrentPage(hl.page <= contentPages.length ? hl.page : 1);
                  }}
                >
                  P.{hl.page} · {hl.label}
                </button>
              ))
            )}
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
            {contentPages[currentPage - 1] || contentPages[0]}

            {selectedHighlight !== null && highlights[selectedHighlight] && (
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
                  Highlighted Reference [{highlights[selectedHighlight].label}]
                </strong>
                &quot;{highlights[selectedHighlight].text}&quot;
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
              {doc.versions.map((ver) => {
                const isCurrent = ver.id === doc.activeVersionId;
                return (
                  <div
                    key={ver.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      background: isCurrent ? "var(--patch-surface-elevated)" : "var(--patch-surface)",
                      border: isCurrent ? "1px solid var(--patch-accent)" : "1px solid var(--patch-boundary)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <strong style={{ fontSize: 13 }}>Revision {ver.version}</strong>
                      <StatusBadge tone={ver.status === "ACTIVE" ? "success" : "neutral"}>
                        {ver.status.replace(/_/g, " ")}
                      </StatusBadge>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                      Uploaded {ver.uploadedAt} by {ver.uploadedBy}
                      {ver.changeSummary ? ` · ${ver.changeSummary}` : ""}
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
              {entities.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--patch-muted)", margin: 0 }}>
                  This document is not linked to any equipment or
                  project yet.
                </p>
              ) : (
                entities.map((entity) => (
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
                ))
              )}
            </div>
          </div>

          {/* Extracted Vector Details */}
          <div className="card">
            <h4 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Indexing &amp; Coverage</h4>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Knowledge Coverage:</span>
                <span className="coverage-pct coverage-high">
                  {coverage === null ? "—" : `${coverage}%`}
                </span>
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
