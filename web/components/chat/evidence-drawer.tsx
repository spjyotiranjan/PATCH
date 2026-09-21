"use client";

import React from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  ChevronRight,
  Info,
  FileText,
  AlertTriangle,
  Layers,
  Wrench,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  type Citation,
  type EvidenceSourceCard,
  type SearchedScopeItem,
} from "./chat-types";

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "side" | "modal"; // side drawer / panel or full screen modal
  citations?: Citation[];
  sources?: EvidenceSourceCard[];
  searchedScope?: SearchedScopeItem[];
  highlightedCitationId?: string | null;
}

export function EvidenceDrawer({
  isOpen,
  onClose,
  mode = "side",
  citations = [],
  sources = [],
  searchedScope = [],
  highlightedCitationId,
}: EvidenceDrawerProps) {
  if (!isOpen) return null;

  // Combine sources from props or default mock sources
  const includedSources = sources.filter(
    (s) => s.status === "Active" || s.status === "Approved" || s.status === "Indexed"
  );
  const incompleteSources = sources.filter((s) => s.status === "Needs review");
  const conflictingSources = sources.filter(
    (s) => s.status === "Conflicting" || s.status === "Outdated"
  );

  // If no explicit sources passed but citations present, derive source cards
  const activeCitations = citations.length > 0 ? citations : [];

  if (mode === "modal") {
    return (
      <div
        className="evidence-modal-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-evidence-title"
      >
        <div
          className="evidence-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="evidence-modal-header">
            <h2 id="modal-evidence-title">Evidence used in this response</h2>
            <button
              className="btn-icon"
              onClick={onClose}
              aria-label="Close evidence drawer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="evidence-modal-body">
            {/* Included sources */}
            <section className="evidence-section">
              <h3 className="section-title">Included sources</h3>
              <div className="sources-grid">
                {includedSources.length > 0 ? (
                  includedSources.map((src) => (
                    <SourceCard key={src.id} source={src} />
                  ))
                ) : activeCitations.length > 0 ? (
                  activeCitations.map((cit) => (
                    <CitationSourceCard key={cit.id} citation={cit} />
                  ))
                ) : (
                  <div className="empty-source-card">No included active sources</div>
                )}
              </div>
            </section>

            {/* Incomplete / Conflicting grid if present */}
            {(incompleteSources.length > 0 || conflictingSources.length > 0) && (
              <div className="evidence-split-grid">
                {incompleteSources.length > 0 && (
                  <section className="evidence-section">
                    <h3 className="section-title">Incomplete sources</h3>
                    <div className="sources-stack">
                      {incompleteSources.map((src) => (
                        <SourceCard key={src.id} source={src} />
                      ))}
                    </div>
                  </section>
                )}

                {conflictingSources.length > 0 && (
                  <section className="evidence-section">
                    <h3 className="section-title">Conflicting sources</h3>
                    <div className="sources-stack">
                      {conflictingSources.map((src) => (
                        <SourceCard key={src.id} source={src} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            <div className="evidence-footer-note">
              <Info size={15} />
              <span>
                Conflicting or outdated sources are shown for awareness only and
                were not used in this response.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard Side Panel View
  return (
    <aside
      className="evidence-side-drawer"
      aria-label="Evidence Used"
      id="evidence-used-panel"
    >
      <div className="evidence-drawer-header">
        <div>
          <h2>Evidence Used</h2>
          <p className="evidence-subtitle">Exact sources used in this response</p>
        </div>
        <button
          className="btn-icon"
          onClick={onClose}
          aria-label="Close evidence panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="evidence-drawer-content">
        {/* Exact Sources */}
        {includedSources.map((src) => (
          <SourceCard
            key={src.id}
            source={src}
            isHighlighted={highlightedCitationId === src.id}
          />
        ))}

        {includedSources.length === 0 && activeCitations.map((cit) => (
          <CitationSourceCard
            key={cit.id}
            citation={cit}
            isHighlighted={highlightedCitationId === cit.id}
          />
        ))}

        {/* Searched in (not evidence) Section */}
        <div className="searched-in-section">
          <h3>Searched in <span className="text-muted">(not evidence)</span></h3>
          <div className="searched-scope-list">
            {searchedScope.length > 0 ? (
              searchedScope.map((item, idx) => (
                <div className="searched-scope-item" key={idx}>
                  {item.type === "Equipment" ? (
                    <span className="scope-tag equipment">
                      Equipment: <strong>{item.name}</strong>
                    </span>
                  ) : (
                    <span className="scope-tag project">
                      Project: <strong>{item.name}</strong>
                    </span>
                  )}
                </div>
              ))
            ) : (
              <>
                <div className="searched-scope-item">
                  <span className="scope-tag equipment">
                    Equipment: <strong>Filler 02</strong>
                  </span>
                </div>
                <div className="searched-scope-item">
                  <span className="scope-tag project">
                    Project: <strong>Plant Expansion Project</strong>
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="scope-footnote">
            <Info size={14} className="info-icon" />
            <span>
              These sources were searched but were not used as evidence in this response.
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: EvidenceSourceCard["status"] }) {
  let badgeClass = "badge-success";
  if (status === "Needs review") badgeClass = "badge-attention";
  if (status === "Conflicting" || status === "Outdated") badgeClass = "badge-danger";

  return <span className={`status-pill ${badgeClass}`}>{status}</span>;
}

function SourceCard({
  source,
  isHighlighted,
}: {
  source: EvidenceSourceCard;
  isHighlighted?: boolean;
}) {
  return (
    <div className={`source-card ${isHighlighted ? "source-card-highlighted" : ""}`}>
      <div className="source-card-header">
        <h4 className="source-title">{source.documentTitle}</h4>
        <StatusBadge status={source.status} />
      </div>

      <div className="source-meta-row">
        <span>{source.revision}</span>
        {source.date && <span>{source.date}</span>}
      </div>

      {(source.page || source.section) && (
        <div className="source-location-row">
          {source.page && (
            <div>
              <span className="meta-label">Page</span>
              <span className="meta-val">{source.page}</span>
            </div>
          )}
          {source.section && (
            <div>
              <span className="meta-label">Section</span>
              <span className="meta-val">{source.section}</span>
            </div>
          )}
        </div>
      )}

      {source.excerpt && (
        <div className="source-excerpt-box">
          <p>{source.excerpt}</p>
        </div>
      )}

      <div className="source-action">
        <Link
          href={`/documents/${encodeURIComponent(source.id)}`}
          className="btn-open-source"
        >
          <span>Open source</span>
          <ExternalLink size={14} />
        </Link>
      </div>

      {source.includedIn && (
        <div className="source-included-in">
          <span className="included-label">Included in</span>
          {source.includedIn.equipmentName && (
            <Link
              href="/equipments"
              className="included-link equipment-link"
            >
              <Wrench size={13} />
              <span>Equipment: <strong>{source.includedIn.equipmentName}</strong></span>
              <ChevronRight size={13} className="arrow" />
            </Link>
          )}
          {source.includedIn.projectName && (
            <Link
              href="/projects"
              className="included-link project-link"
            >
              <FolderKanban size={13} />
              <span>Project: <strong>{source.includedIn.projectName}</strong></span>
              <ChevronRight size={13} className="arrow" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function CitationSourceCard({
  citation,
  isHighlighted,
}: {
  citation: Citation;
  isHighlighted?: boolean;
}) {
  return (
    <div className={`source-card ${isHighlighted ? "source-card-highlighted" : ""}`}>
      <div className="source-card-header">
        <h4 className="source-title">{citation.documentTitle}</h4>
        <span className="status-pill badge-success">{citation.approvalState}</span>
      </div>

      <div className="source-meta-row">
        <span>{citation.revision}</span>
      </div>

      {(citation.page || citation.section) && (
        <div className="source-location-row">
          {citation.page && (
            <div>
              <span className="meta-label">Page</span>
              <span className="meta-val">{citation.page}</span>
            </div>
          )}
          {citation.section && (
            <div>
              <span className="meta-label">Section</span>
              <span className="meta-val">{citation.section}</span>
            </div>
          )}
        </div>
      )}

      {citation.excerpt && (
        <div className="source-excerpt-box">
          <p>{citation.excerpt}</p>
        </div>
      )}

      <div className="source-action">
        <Link
          href={`/documents/${encodeURIComponent(citation.documentVersionId)}`}
          className="btn-open-source"
        >
          <span>Open source</span>
          <ExternalLink size={14} />
        </Link>
      </div>

      {citation.includedIn && (
        <div className="source-included-in">
          <span className="included-label">Included in</span>
          {citation.includedIn.equipmentName && (
            <Link
              href="/equipments"
              className="included-link equipment-link"
            >
              <Wrench size={13} />
              <span>Equipment: <strong>{citation.includedIn.equipmentName}</strong></span>
              <ChevronRight size={13} className="arrow" />
            </Link>
          )}
          {citation.includedIn.projectName && (
            <Link
              href="/projects"
              className="included-link project-link"
            >
              <FolderKanban size={13} />
              <span>Project: <strong>{citation.includedIn.projectName}</strong></span>
              <ChevronRight size={13} className="arrow" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
