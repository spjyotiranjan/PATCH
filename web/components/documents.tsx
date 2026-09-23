"use client";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { StatusBadge } from "@/components/ui";

/* ── Processing step bar ─────────────────────────────────── */

const PROCESSING_STEPS = [
  "Upload",
  "Extract",
  "Review",
  "Approve",
  "Index",
  "Active",
] as const;

export function ProcessingStepBar({ currentStep }: { currentStep: number }) {
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

const DOC_STATUS_TONE: Record<
  DocStatus,
  "success" | "attention" | "info" | "neutral" | "danger"
> = {
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
  if (pct === null)
    return <span className="coverage-pct coverage-none">—</span>;
  const cls =
    pct >= 90 ? "coverage-high" : pct >= 70 ? "coverage-mid" : "coverage-low";
  return <span className={`coverage-pct ${cls}`}>{pct}%</span>;
}

/* ── Inclusion badge ─────────────────────────────────────── */

export function InclusionBadge({ equipmentName }: { equipmentName: string }) {
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
