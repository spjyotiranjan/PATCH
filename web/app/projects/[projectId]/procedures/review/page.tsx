"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileCheck,
  FileCode,
  FileText,
  GripVertical,
  Info,
  Layers,
  MoreHorizontal,
  MoreVertical,
  PieChart,
  Plus,
  Save,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import {
  getProcedure,
  publishProcedure,
} from "@/lib/api/procedures";
import type { Procedure } from "@/lib/types/procedure";

interface Step {
  id: string;
  title: string;
  description: string;
  citation: string;
}

const INITIAL_STEPS: Step[] = [
  {
    id: "step-1",
    title: "Safety and isolation",
    description: "Follow Lockout/Tagout procedure. Verify pump is isolated and cannot start.",
    citation: "P-101 - p. 63 - § 8.2",
  },
  {
    id: "step-2",
    title: "Visual inspection",
    description: "Check pump, couplings, and base for loose hardware or visible damage.",
    citation: "P-101 - p. 64 - § 8.3",
  },
  {
    id: "step-3",
    title: "Vibration measurement",
    description:
      "Measure overall vibration at DE and NDE bearings in vertical, horizontal, and axial directions.",
    citation: "P-101 - p. 65 - § 8.4",
  },
  {
    id: "step-4",
    title: "Acceptable limits",
    description: "Overall vibration should be ≤ 4.5 mm/s RMS. Investigate if above limit.",
    citation: "P-101 - p. 66 - § 8.5",
  },
  {
    id: "step-5",
    title: "Corrective actions",
    description: "Tighten loose hardware, realign coupling, or balance impeller as required.",
    citation: "P-101 - p. 67 - § 8.6",
  },
];

export default function ProcedureReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ procedureId?: string }>;
}) {
  const { projectId } = use(params);
  const requestedProcedureId =
    use(
      searchParams ??
        Promise.resolve<{ procedureId?: string }>({}),
    ).procedureId ?? "proc-2";
  const router = useRouter();

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [selectedStepId, setSelectedStepId] = useState<string>("step-3");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const newStepCounter = useRef(INITIAL_STEPS.length + 1);

  const [procedure, setProcedure] =
    useState<Procedure | null>(null);
  const [procLoading, setProcLoading] =
    useState(true);
  const [publishing, setPublishing] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProcedure() {
      try {
        const loaded = await getProcedure(
          requestedProcedureId,
        );

        if (!cancelled) {
          setProcedure(loaded);
        }
      } catch {
        if (!cancelled) {
          setProcedure(null);
        }
      } finally {
        if (!cancelled) {
          setProcLoading(false);
        }
      }
    }

    void loadProcedure();

    return () => {
      cancelled = true;
    };
  }, [requestedProcedureId]);

  async function handlePublish() {
    if (!procedure || publishing) {
      return;
    }

    try {
      setPublishing(true);
      const published = await publishProcedure(
        procedure.id,
      );

      if (published) {
        setProcedure(published);
        showToast(
          `Procedure published as Version ${published.version}`,
        );
      }
    } catch {
      showToast(
        "Publication blocked: resolve the severe review findings first.",
      );
    } finally {
      setPublishing(false);
    }
  }

  const reviewNeed = procedure?.reviewNeed ?? "HIGH";
  const publishBlocked = reviewNeed === "SEVERE";

  const tabs = [
    { id: "overview", label: "Overview", onSelect: () => router.push(`/projects/${projectId}?tab=overview`) },
    { id: "equipments", label: "Equipments", onSelect: () => router.push(`/projects/${projectId}?tab=equipments`) },
    { id: "documents", label: "Documents", onSelect: () => router.push(`/projects/${projectId}/documents`) },
    { id: "maintenance-logs", label: "Maintenance logs", onSelect: () => router.push(`/projects/${projectId}/maintenance-logs`) },
    { id: "procedures", label: "Procedures", active: true, onSelect: () => router.push(`/projects/${projectId}/procedures`) },
    { id: "members", label: "Members", onSelect: () => router.push(`/projects/${projectId}?tab=members`) },
    { id: "activity", label: "Activity", onSelect: () => router.push(`/projects/${projectId}?tab=activity`) },
  ];

  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === steps.length - 1) return;

    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setSteps(newSteps);
    showToast(`Step moved ${direction}`);
  };

  const handleUpdateStep = (id: string, field: "title" | "description", val: string) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const handleAddStep = () => {
    const newStep: Step = {
      id: `step-new-${newStepCounter.current++}`,
      title: "New procedure step",
      description: "Enter detailed step instructions here.",
      citation: "P-101 - p. 68 - § 8.7",
    };
    setSteps([...steps, newStep]);
    setSelectedStepId(newStep.id);
    showToast("Added new procedure step");
  };

  const handleDeleteStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((s) => s.id !== id));
    showToast("Step removed");
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
            border: "1px solid var(--patch-accent)",
            color: "var(--patch-text)",
            borderRadius: 6,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} style={{ color: "var(--patch-accent)" }} /> {toastMessage}
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
              background: "rgba(147, 51, 234, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9333ea",
            }}
          >
            <FileCode size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {procedure?.title ?? "Procedure draft"}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(147, 51, 234, 0.12)",
                  color: "#9333ea",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles size={11} /> AI-generated draft
              </span>
              {procLoading ? null : (
                <span
                  role="status"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background:
                      reviewNeed === "SEVERE"
                        ? "rgba(194, 65, 12, 0.12)"
                        : reviewNeed === "HIGH"
                          ? "rgba(234, 88, 12, 0.12)"
                          : "rgba(8, 123, 238, 0.12)",
                    color:
                      reviewNeed === "SEVERE"
                        ? "var(--patch-danger)"
                        : reviewNeed === "HIGH"
                          ? "#ea580c"
                          : "var(--patch-accent)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <AlertTriangle size={11} />{" "}
                  {reviewNeed === "LOW"
                    ? "Low review needed"
                    : reviewNeed === "MODERATE"
                      ? "Moderate review needed"
                      : reviewNeed === "SEVERE"
                        ? "Severe review needed"
                        : "High review needed"}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--patch-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <PieChart size={13} /> Source coverage: 2 of 3 required topics supported
              </span>
              <span>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={13} /> Last generated: May 14, 2025 10:21 AM
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm">
            View generation analysis
          </Button>
          <Button size="sm" icon={<Save size={14} />} onClick={() => showToast("Draft saved successfully")}>
            Save draft
          </Button>
        </div>
      </div>

      {/* Review Need Warning Banner */}
      <div
        style={{
          marginBottom: 20,
          padding: "12px 16px",
          background: "rgba(234, 88, 12, 0.08)",
          border: "1px solid rgba(234, 88, 12, 0.25)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--patch-text)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <AlertTriangle size={18} style={{ color: "#ea580c", flexShrink: 0 }} />
        <span>
          Review need is based on source coverage, conflicts, freshness, and hardware safety criticality. Human review is required.
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
        {/* Left Column: Editable / Reorderable Steps */}
        <div>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
            Procedure steps
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map((step, idx) => {
              const isSelected = step.id === selectedStepId;
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className="card"
                  style={{
                    padding: 16,
                    border: isSelected
                      ? "2px solid var(--patch-accent, #2563eb)"
                      : "1px solid var(--patch-boundary)",
                    background: "var(--patch-surface)",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Grip handle and Step Number */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 4 }}>
                      <GripVertical size={16} style={{ color: "var(--patch-muted)", cursor: "grab" }} />
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          border: "1px solid var(--patch-boundary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 600,
                          background: "var(--patch-surface-muted)",
                        }}
                      >
                        {idx + 1}
                      </div>
                    </div>

                    {/* Step Title Input */}
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => handleUpdateStep(step.id, "title", e.target.value)}
                      className="form-select"
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        fontSize: 14,
                        padding: "6px 10px",
                      }}
                    />

                    {/* Citation Badge */}
                    <span
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: "var(--patch-surface-muted)",
                        borderRadius: 4,
                        border: "1px solid var(--patch-boundary)",
                        color: "var(--patch-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.citation}
                    </span>

                    {/* Step Action Menu */}
                    <button
                      className="icon-button"
                      style={{ padding: 4 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStep(step.id);
                      }}
                      title="Delete step"
                    >
                      <Trash2 size={14} style={{ color: "var(--patch-danger)" }} />
                    </button>
                  </div>

                  {/* Step Description Textarea */}
                  <div style={{ paddingLeft: 42 }}>
                    <textarea
                      rows={2}
                      value={step.description}
                      onChange={(e) => handleUpdateStep(step.id, "description", e.target.value)}
                      className="form-select"
                      style={{
                        width: "100%",
                        fontSize: 13,
                        lineHeight: 1.5,
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />

                    {/* Move Up / Move Down buttons for active step */}
                    {isSelected && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(idx, "up");
                          }}
                          disabled={idx === 0}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            fontSize: 12,
                            background: "transparent",
                            border: "none",
                            color: idx === 0 ? "var(--patch-muted)" : "var(--patch-accent)",
                            cursor: idx === 0 ? "not-allowed" : "pointer",
                            fontWeight: 500,
                          }}
                        >
                          <ArrowUp size={14} /> Move up
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(idx, "down");
                          }}
                          disabled={idx === steps.length - 1}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            fontSize: 12,
                            background: "transparent",
                            border: "none",
                            color: idx === steps.length - 1 ? "var(--patch-muted)" : "var(--patch-accent)",
                            cursor: idx === steps.length - 1 ? "not-allowed" : "pointer",
                            fontWeight: 500,
                          }}
                        >
                          <ArrowDown size={14} /> Move down
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16 }}>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={handleAddStep}>
              Add step
            </Button>
          </div>
        </div>

        {/* Right Column: Review Analysis & Current Sources */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Review Analysis */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
              Review analysis
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--patch-muted)" }}>
                  <PieChart size={14} style={{ color: "#ea580c" }} /> Source coverage:
                </span>
                <span style={{ fontWeight: 600, color: "#ea580c" }}>Partial</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--patch-muted)" }}>
                  <CheckCircle2 size={14} style={{ color: "var(--patch-success)" }} /> Conflicts:
                </span>
                <span style={{ fontWeight: 600, color: "var(--patch-success)" }}>None detected</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--patch-muted)" }}>
                  <Clock size={14} style={{ color: "var(--patch-success)" }} /> Freshness:
                </span>
                <span style={{ fontWeight: 600, color: "var(--patch-success)" }}>Current</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--patch-muted)" }}>
                  <AlertTriangle size={14} style={{ color: "#ea580c" }} /> Hardware criticality:
                </span>
                <span style={{ fontWeight: 600, color: "#ea580c" }}>High</span>
              </div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--patch-boundary)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--patch-muted)", fontWeight: 500 }}>
                Review need legend:
              </p>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--patch-muted)" }}>
                <span>✓ Low</span>
                <span>! Moderate</span>
                <span style={{ color: "#ea580c", fontWeight: 600 }}>! High</span>
                <span style={{ color: "var(--patch-danger)" }}>▲ Severe</span>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: "8px 12px",
                background: "var(--patch-surface-muted)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--patch-muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Info size={14} style={{ flexShrink: 0 }} />
              Confidence never replaces source review.
            </div>
          </div>

          {/* Current Sources */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
              Current sources
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: 12,
                  border: "1px solid var(--patch-boundary)",
                  borderRadius: 6,
                  background: "var(--patch-surface-muted)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <FileText size={15} style={{ color: "var(--patch-accent)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    P-101 Maintenance Manual · Rev. 2
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                    color: "var(--patch-muted)",
                  }}
                >
                  <span>Pages 63–67 · Sections 8.2–8.6</span>
                  <Link
                    href="/documents/doc-1"
                    style={{
                      color: "var(--patch-accent)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Open source <ExternalLink size={11} />
                  </Link>
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  border: "1px solid var(--patch-boundary)",
                  borderRadius: 6,
                  background: "var(--patch-surface-muted)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <FileText size={15} style={{ color: "var(--patch-accent)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    Pump Alignment Procedure · Rev. 1
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                    color: "var(--patch-muted)",
                  }}
                >
                  <span>Pages 12–13 · Section 3.1</span>
                  <Link
                    href="/documents/doc-2"
                    style={{
                      color: "var(--patch-accent)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Open source <ExternalLink size={11} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer Bar */}
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
        <Button variant="secondary" onClick={() => showToast("Change request registered")}>
          Request changes
        </Button>

        <div style={{ display: "flex", gap: 12 }}>
          <Button variant="secondary" onClick={() => showToast("Owner approval recorded")}>
            Owner approve
          </Button>
          {publishBlocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button disabled>
                Publish
              </Button>
              <span
                role="note"
                style={{ fontSize: 12, color: "var(--patch-danger)" }}
              >
                Blocked: resolve the severe
                review findings before
                publishing.
              </span>
            </div>
          ) : (
            <Button
              disabled={publishing || procLoading || !procedure}
              onClick={() => void handlePublish()}
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
