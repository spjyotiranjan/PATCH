"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Button, Drawer, StatusBadge } from "@/components/ui";

/* ── Processing step bar ─────────────────────────────────── */

const PROCESSING_STEPS = [
  "Upload",
  "Extract",
  "Review",
  "Approve",
  "Index",
  "Active",
] as const;

export function ProcessingStepBar({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <div className="step-bar" role="group" aria-label="Processing steps">
      {PROCESSING_STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isComplete = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const stateClass = isComplete
          ? "step-bar-step-complete"
          : isActive
            ? "step-bar-step-active"
            : "";

        return (
          <div key={label} style={{ display: "contents" }}>
            <div className={`step-bar-step ${stateClass}`}>
              <span className="step-bar-number">
                {isComplete ? <Check size={14} /> : stepNum}
              </span>
              {label}
            </div>
            {i < PROCESSING_STEPS.length - 1 && (
              <div
                className={`step-bar-connector ${isComplete ? "step-bar-step-complete" : ""}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Document status badge ───────────────────────────────── */

type DocStatus =
  | "Active"
  | "Needs review"
  | "Indexing"
  | "Failed"
  | "Approved"
  | "Superseded"
  | "Rejected"
  | "Extracting"
  | "Uploading";

const DOC_STATUS_TONE: Record<DocStatus, "success" | "attention" | "info" | "neutral" | "danger"> = {
  Active: "success",
  "Needs review": "attention",
  Indexing: "info",
  Failed: "danger",
  Approved: "success",
  Superseded: "neutral",
  Rejected: "danger",
  Extracting: "info",
  Uploading: "info",
};

export function DocumentStatusBadge({ status }: { status: DocStatus }) {
  return <StatusBadge tone={DOC_STATUS_TONE[status]}>{status}</StatusBadge>;
}

/* ── Coverage percentage ─────────────────────────────────── */

export function CoverageDisplay({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="coverage-pct coverage-none">—</span>;
  const cls =
    pct >= 90
      ? "coverage-high"
      : pct >= 70
        ? "coverage-mid"
        : "coverage-low";
  return <span className={`coverage-pct ${cls}`}>{pct}%</span>;
}

/* ── Inclusion badge ─────────────────────────────────────── */

export function InclusionBadge({
  equipmentName,
}: {
  equipmentName: string;
}) {
  return (
    <span className="inclusion-badge">
      <RefreshCw size={12} />
      From Equipment · {equipmentName}
      <button
        className="inclusion-badge-nav"
        type="button"
        aria-label={`Navigate to ${equipmentName}`}
      >
        <ChevronRight size={14} />
      </button>
    </span>
  );
}

/* ── Profile status indicator ────────────────────────────── */

export function ProfileStatusIndicator({
  status,
}: {
  status: "Fresh" | "Refreshing" | "Stale";
}) {
  const cls =
    status === "Fresh"
      ? "profile-fresh"
      : status === "Refreshing"
        ? "profile-refreshing"
        : "profile-stale";
  const Icon =
    status === "Fresh"
      ? CheckCircle2
      : status === "Refreshing"
        ? Loader2
        : Info;
  return (
    <span className={`profile-status ${cls}`}>
      <Icon size={13} /> {status}
    </span>
  );
}

/* ── Add new document drawer ─────────────────────────────── */

export function AddNewDocumentDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} title="Add new document" onClose={onClose}>
      <p style={{ color: "var(--patch-muted)", fontSize: 14, margin: "0 0 20px" }}>
        Upload a new logical document. This creates a new document record and its first version.
      </p>

      <div className="drawer-field">
        <label>
          Document title <span>*</span>
        </label>
        <input
          className="form-select"
          style={{ appearance: "auto", backgroundImage: "none" }}
          type="text"
          placeholder="Enter document title"
        />
      </div>

      <div className="drawer-field">
        <label>Document type</label>
        <select className="form-select">
          <option>Manual</option>
          <option>P&amp;ID</option>
          <option>Datasheet</option>
          <option>Inspection checklist</option>
          <option>3D model</option>
          <option>Other</option>
        </select>
      </div>

      <div className="drawer-field">
        <label>Description</label>
        <input
          className="form-select"
          style={{ appearance: "auto", backgroundImage: "none" }}
          type="text"
          placeholder="Brief description of the document"
        />
      </div>

      <div className="drawer-field">
        <label>
          File <span>*</span>
        </label>
        <div
          style={{
            border: "2px dashed var(--patch-boundary)",
            borderRadius: 8,
            padding: "28px 16px",
            textAlign: "center",
            color: "var(--patch-muted)",
            fontSize: 13,
          }}
        >
          <FileText size={24} style={{ margin: "0 auto 8px", display: "block" }} />
          Drag and drop or click to upload
          <br />
          <span style={{ fontSize: 12 }}>PDF, DOCX, TXT up to 50 MB</span>
        </div>
      </div>

      <div className="drawer-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button>Upload document</Button>
      </div>
    </Drawer>
  );
}

/* ── Add new version drawer ──────────────────────────────── */

export function AddNewVersionDrawer({
  open,
  onClose,
  documents,
}: {
  open: boolean;
  onClose: () => void;
  documents: { id: string; name: string; subtitle: string; activeRevision: string; activeDate: string }[];
}) {
  const [selectedDoc, setSelectedDoc] = useState(documents[0]?.id ?? "");
  const selected = documents.find((d) => d.id === selectedDoc);

  return (
    <Drawer open={open} title="Add new version" onClose={onClose}>
      <p style={{ color: "var(--patch-muted)", fontSize: 14, margin: "0 0 20px" }}>
        Select an existing logical document to add a new version.
      </p>

      <div className="drawer-field">
        <label>
          Logical document <span>*</span>
        </label>
        <select
          className="form-select"
          value={selectedDoc}
          onChange={(e) => setSelectedDoc(e.target.value)}
        >
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>
        {selected && (
          <span style={{ fontSize: 12, color: "var(--patch-muted)", marginTop: 4, display: "block" }}>
            {selected.subtitle}
          </span>
        )}
      </div>

      <div className="info-banner" style={{ marginTop: 16 }}>
        <Info size={18} />
        <div>
          <div className="info-banner-title">
            The current active revision remains in use until the new version is successfully indexed
            and activated.
          </div>
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 650, color: "var(--patch-muted)", marginBottom: 8 }}>
            Selected document
          </p>
          <p style={{ fontSize: 13, fontWeight: 650, color: "var(--patch-text)", marginBottom: 4 }}>
            Current active revision
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              border: "1px solid var(--patch-boundary)",
              borderRadius: 8,
              background: "var(--patch-surface)",
            }}
          >
            <FileText size={18} color="var(--patch-muted)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.activeRevision}</div>
              <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>{selected.activeDate}</div>
            </div>
            <StatusBadge tone="success">Active</StatusBadge>
          </div>

          <p
            style={{
              fontSize: 13,
              fontWeight: 650,
              color: "var(--patch-text)",
              margin: "16px 0 8px",
            }}
          >
            New version you are adding
          </p>
          <div
            style={{
              fontSize: 13,
              color: "var(--patch-muted)",
              fontStyle: "italic",
            }}
          >
            (To be uploaded)
          </div>
        </div>
      )}

      <div className="drawer-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button>Continue</Button>
      </div>
    </Drawer>
  );
}
