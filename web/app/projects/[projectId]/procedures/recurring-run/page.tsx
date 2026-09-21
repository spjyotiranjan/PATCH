"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileCode,
  FileText,
  Globe,
  Info,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  User,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import { toast } from "sonner";

interface RunStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  citation: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  note?: string;
}

const INITIAL_RUN_STEPS: RunStep[] = [
  {
    id: "run-step-1",
    stepNumber: 1,
    title: "Safety and isolation",
    description: "Follow Lockout/Tagout procedure. Verify pump is isolated and cannot start.",
    citation: "P-101 · p. 63 · § 8.2",
    completed: true,
    completedBy: "RK",
    completedAt: "Sep 1, 2026 · 9:07 AM",
  },
  {
    id: "run-step-2",
    stepNumber: 2,
    title: "Visual inspection",
    description: "Check pump, couplings, and base for loose hardware or visible damage.",
    citation: "P-101 · p. 64 · § 8.3",
    completed: true,
    completedBy: "RK",
    completedAt: "Sep 1, 2026 · 9:12 AM",
  },
  {
    id: "run-step-3",
    stepNumber: 3,
    title: "Vibration measurement",
    description:
      "Measure overall vibration at DE and NDE bearings in vertical, horizontal, and axial directions.",
    citation: "P-101 · p. 65 · § 8.4",
    completed: true,
    completedBy: "RK",
    completedAt: "Sep 1, 2026 · 9:22 AM",
  },
  {
    id: "run-step-4",
    stepNumber: 4,
    title: "Acceptable limits",
    description: "Overall vibration should be ≤ 4.5 mm/s RMS. Investigate if above limit.",
    citation: "P-101 · p. 66 · § 8.5",
    completed: true,
    completedBy: "RK",
    completedAt: "Sep 1, 2026 · 9:28 AM",
  },
  {
    id: "run-step-5",
    stepNumber: 5,
    title: "Corrective actions",
    description: "Tighten loose hardware, realign coupling, or balance impeller as required.",
    citation: "P-101 · p. 67 · § 8.6",
    completed: false,
  },
];

export default function ProcedureRecurringRunPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [steps, setSteps] = useState<RunStep[]>(INITIAL_RUN_STEPS);
  const [activeNoteStepId, setActiveNoteStepId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<"In progress" | "Completed">("In progress");

  const completedCount = steps.filter((s) => s.completed).length;
  const isAllComplete = completedCount === steps.length;

  const tabs = [
    { id: "overview", label: "Overview", onSelect: () => router.push(`/projects/${projectId}?tab=overview`) },
    { id: "equipments", label: "Equipments", onSelect: () => router.push(`/projects/${projectId}?tab=equipments`) },
    { id: "documents", label: "Documents", onSelect: () => router.push(`/projects/${projectId}/documents`) },
    { id: "maintenance-logs", label: "Maintenance logs", onSelect: () => router.push(`/projects/${projectId}/maintenance-logs`) },
    { id: "procedures", label: "Procedures", active: true, onSelect: () => router.push(`/projects/${projectId}/procedures`) },
    { id: "members", label: "Members", onSelect: () => router.push(`/projects/${projectId}?tab=members`) },
    { id: "activity", label: "Activity", onSelect: () => router.push(`/projects/${projectId}?tab=activity`) },
  ];

  const toggleStep = (stepId: string) => {
    setSteps(
      steps.map((s) => {
        if (s.id !== stepId) return s;
        const nowCompleted = !s.completed;
        return {
          ...s,
          completed: nowCompleted,
          completedBy: nowCompleted ? "AC" : undefined,
          completedAt: nowCompleted ? `Sep 1, 2026 · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : undefined,
        };
      })
    );
    showToast("Checklist tick recorded");
  };

  const handleSaveNote = (stepId: string) => {
    setSteps(
      steps.map((s) => (s.id === stepId ? { ...s, note: noteText } : s))
    );
    setActiveNoteStepId(null);
    setNoteText("");
    showToast("Run note attached");
  };

  const handleCompleteRun = () => {
    if (!isAllComplete) {
      toast.error(
        "All required steps must be completed before finishing the run.",
      );
      return;
    }
    setRunStatus("Completed");
    showToast("Procedure run completed and archived to history!");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <AppShell
      title="Boiler Upgrade Project"
      status={<StatusBadge tone="success">In progress</StatusBadge>}
      actions={
        <div style={{ display: "flex", gap: 4 }}>
          <button className="icon-button" type="button" aria-label="Favorite">
            <Star size={18} strokeWidth={1.7} />
          </button>
          <button className="icon-button" type="button" aria-label="Share">
            <Share2 size={18} strokeWidth={1.7} />
          </button>
          <button className="icon-button" type="button" aria-label="More actions">
            <MoreHorizontal size={18} strokeWidth={1.7} />
          </button>
        </div>
      }
    >
      <Tabs label="Project sections" items={tabs} />

      {toastMessage && (
        <div
          style={{
            margin: "16px 0",
            padding: "10px 16px",
            background: "var(--patch-surface-elevated)",
            border: "1px solid var(--patch-success)",
            color: "var(--patch-success)",
            borderRadius: 6,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {toastMessage}
        </div>
      )}

      {/* Header Card */}
      <div
        className="card"
        style={{
          marginTop: 20,
          marginBottom: 16,
          padding: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: "rgba(37, 99, 235, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--patch-accent)",
            }}
          >
            <FileCheck size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                Boiler feed pump vibration check
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(22, 163, 74, 0.12)",
                  color: "var(--patch-success)",
                }}
              >
                Published · Version 2
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(37, 99, 235, 0.12)",
                  color: "var(--patch-accent)",
                }}
              >
                Recurring · Monthly
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(234, 88, 12, 0.12)",
                  color: "#ea580c",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Clock size={11} /> Due today
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--patch-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={13} /> Current run · September 2026
              </span>
              <span>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: isAllComplete ? "var(--patch-success)" : "inherit" }}>
                <CheckCircle2 size={13} /> {completedCount} of {steps.length} steps completed
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/projects/${projectId}/procedures/review`}>
            <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
              Open definition
            </Button>
          </Link>
          <Button
            size="sm"
            disabled={!isAllComplete || runStatus === "Completed"}
            onClick={handleCompleteRun}
          >
            {runStatus === "Completed" ? "Run completed" : "Complete run"}
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div
        style={{
          marginBottom: 20,
          padding: "10px 16px",
          background: "rgba(37, 99, 235, 0.08)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--patch-text)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Info size={16} style={{ color: "var(--patch-accent)", flexShrink: 0 }} />
        <span>
          Step checks apply only to this run. A new unchecked run opens automatically for the next recurrence.
        </span>
      </div>

      {/* Main 2-Column Content */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left Column: Procedure Run Checklist */}
        <div>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
            Procedure steps
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map((step) => (
              <div
                key={step.id}
                className="card"
                style={{
                  padding: 16,
                  border: "1px solid var(--patch-boundary)",
                  background: step.completed
                    ? "var(--patch-surface)"
                    : "var(--patch-surface-elevated)",
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  {/* Step Number Badge */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      border: "1px solid var(--patch-boundary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "var(--patch-surface-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {step.stepNumber}
                  </div>

                  {/* Title & Description */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                        {step.title}
                      </h4>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          background: "var(--patch-surface-muted)",
                          borderRadius: 4,
                          border: "1px solid var(--patch-boundary)",
                          color: "var(--patch-muted)",
                        }}
                      >
                        {step.citation}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--patch-muted)", lineHeight: 1.5 }}>
                      {step.description}
                    </p>

                    {/* Completion Status row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNoteStepId(activeNoteStepId === step.id ? null : step.id);
                          setNoteText(step.note || "");
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          background: "none",
                          border: "none",
                          color: "var(--patch-accent)",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <MessageSquare size={13} />
                        {step.note ? "Edit note" : "Add run note"}
                      </button>

                      {/* Status indicator button */}
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          padding: "4px 12px",
                          borderRadius: 999,
                          border: "1px solid",
                          borderColor: step.completed ? "var(--patch-success)" : "var(--patch-boundary)",
                          background: step.completed ? "rgba(22, 163, 74, 0.08)" : "transparent",
                          color: step.completed ? "var(--patch-success)" : "var(--patch-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {step.completed ? (
                          <>
                            <CheckCircle2 size={14} /> Completed
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                border: "1.5px solid var(--patch-muted)",
                              }}
                            />
                            Not completed
                          </>
                        )}
                      </button>
                    </div>

                    {step.completed && step.completedBy && (
                      <div style={{ fontSize: 11, color: "var(--patch-muted)", marginTop: 4, textAlign: "right" }}>
                        {step.completedBy} · {step.completedAt}
                      </div>
                    )}

                    {/* Run note box */}
                    {step.note && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "6px 10px",
                          background: "var(--patch-surface-muted)",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "var(--patch-text)",
                        }}
                      >
                        <strong>Note:</strong> {step.note}
                      </div>
                    )}

                    {/* Note editor form */}
                    {activeNoteStepId === step.id && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Enter observation or note..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="form-select"
                          style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
                        />
                        <Button size="sm" onClick={() => handleSaveNote(step.id)}>
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Period, Run details, History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Current Period */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
              Current period
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={15} style={{ color: "var(--patch-muted)" }} />
                <span>Sep 1–30, 2026</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} style={{ color: "var(--patch-muted)" }} />
                <span>Resets Oct 1, 2026</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={15} style={{ color: "var(--patch-muted)" }} />
                <span>Timezone Asia/Kolkata</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={15} style={{ color: "var(--patch-muted)" }} />
                <span>One active run per period</span>
              </div>
            </div>
          </div>

          {/* Run Details */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
              Run details
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={14} /> Assigned to
                </span>
                <span style={{ fontWeight: 500 }}>Maintenance team</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={14} /> Started
                </span>
                <span>Sep 1, 2026 · 9:05 AM</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--patch-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={14} /> Status
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: runStatus === "Completed" ? "rgba(22, 163, 74, 0.12)" : "rgba(37, 99, 235, 0.12)",
                    color: runStatus === "Completed" ? "var(--patch-success)" : "var(--patch-accent)",
                  }}
                >
                  {runStatus}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={14} /> Run notes
                </span>
                <span style={{ color: "var(--patch-muted)" }}>No notes added</span>
              </div>
            </div>
          </div>

          {/* Completion History */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
              Completion history
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>August 2026</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--patch-success)", fontWeight: 500 }}>
                  <CheckCircle2 size={14} /> Completed
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>July 2026</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--patch-success)", fontWeight: 500 }}>
                  <CheckCircle2 size={14} /> Completed
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>June 2026</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#ea580c", fontWeight: 500 }}>
                  <Clock size={14} /> Completed late
                </span>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--patch-boundary)" }}>
              <Link
                href={`/projects/${projectId}/procedures`}
                style={{
                  color: "var(--patch-accent)",
                  fontSize: 13,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                View all runs <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div
        style={{
          marginTop: 32,
          padding: "16px 0",
          borderTop: "1px solid var(--patch-boundary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>
          Completion history is retained; previous ticks are never overwritten.
        </span>

        <div style={{ display: "flex", gap: 12 }}>
          <Button variant="secondary" onClick={() => showToast("Progress saved")}>
            Save progress
          </Button>
          <Button
            disabled={!isAllComplete || runStatus === "Completed"}
            onClick={handleCompleteRun}
          >
            {runStatus === "Completed" ? "Completed" : "Complete run"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
