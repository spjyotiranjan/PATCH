"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FileText, Info, ThumbsUp, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

/* ── step definitions ─────────────────────────────────────── */
const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Documents" },
  { id: 3, label: "Review" },
];

/* ── hardcoded document rows for step 2 ──────────────────── */
const UPLOADED_DOCS = [
  { id: "d1", name: "P-101 Maintenance Manual", desc: "Operating & maintenance instructions", type: "Manual",    target: "P-101", status: "Indexing"     },
  { id: "d2", name: "P-101 P&ID",               desc: "Piping & instrumentation diagram",    type: "P&ID",      target: "P-101", status: "Indexing"     },
  { id: "d3", name: "P-101 Datasheet",           desc: "Manufacturer specifications",         type: "Datasheet", target: "P-101", status: "Needs review" },
  { id: "d4", name: "P-101 Inspection Checklist",desc: "Routine inspection procedures",       type: "Checklist", target: "P-101", status: "Indexing"     },
];

const EQUIPMENT_TYPES = ["Centrifugal Pump", "Boiler", "Filler", "Conveyor", "Capper", "Labeler", "Compressor", "Cooling Tower", "Heat Exchanger", "Reactor"];
const LOCATIONS = ["Utility Room", "Boiler House", "Packaging Line 1", "Packaging Line 2", "Roof", "Warehouse A", "Control Room"];

export default function NewEquipmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [docMode, setDocMode] = useState<"add" | "skip">("skip");

  const canNext1 = name.trim() !== "" && type !== "" && location !== "";

  function goNext() {
    if (step < STEPS.length) setStep((s) => s + 1);
    else { router.push("/equipments/eq-1"); }
  }

  return (
    <AppShell
      title="Create equipment"
      status={<StatusBadge tone="info">In progress</StatusBadge>}
    >
      {/* Step progress */}
      <WizardSteps current={step} steps={STEPS} />

      {/* Step content */}
      {step === 1 && (
        <Step1Details
          name={name} onName={setName}
          type={type} onType={setType}
          location={location} onLocation={setLocation}
          description={description} onDescription={setDescription}
        />
      )}
      {step === 2 && (
        <Step2Documents docMode={docMode} onDocMode={setDocMode} />
      )}
      {step === 3 && (
        <Step3Review name={name} type={type} location={location} description={description} docMode={docMode} />
      )}

      {/* Footer */}
      <div className="wizard-footer">
        <Button variant="secondary" onClick={() => router.push("/equipments")}>
          Cancel
        </Button>
        {step > 1 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        <Button onClick={goNext} disabled={step === 1 && !canNext1}>
          {step === STEPS.length ? "Create equipment" : "Next"}
        </Button>
      </div>
    </AppShell>
  );
}

/* ── Wizard steps bar ─────────────────────────────────────── */
function WizardSteps({ current, steps }: { current: number; steps: typeof STEPS }) {
  return (
    <div className="wizard-steps" aria-label="Creation progress">
      {steps.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div
            key={s.id}
            className={`wizard-step ${active ? "wizard-step-active" : ""} ${done ? "wizard-step-done" : ""}`}
          >
            <div className="wizard-step-num" aria-hidden="true">
              {done ? <Check size={15} /> : s.id}
            </div>
            {s.label}
            {i < steps.length - 1 && <ChevronRight size={14} style={{ opacity: 0.3, marginLeft: "auto" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: Details ──────────────────────────────────────── */
function Step1Details({ name, onName, type, onType, location, onLocation, description, onDescription }: {
  name: string; onName: (v: string) => void;
  type: string; onType: (v: string) => void;
  location: string; onLocation: (v: string) => void;
  description: string; onDescription: (v: string) => void;
}) {
  return (
    <div className="wizard-body">
      <div className="wizard-form">
        <label className="field">
          <span className="field-label">Name <span aria-hidden="true">*</span></span>
          <input
            type="text"
            placeholder="Enter equipment name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Type <span aria-hidden="true">*</span></span>
          <select value={type} onChange={(e) => onType(e.target.value)} required>
            <option value="">Select type</option>
            {EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Location <span aria-hidden="true">*</span></span>
          <select value={location} onChange={(e) => onLocation(e.target.value)} required>
            <option value="">Select location</option>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>

        <div className="field">
          <span className="field-label">
            Description{" "}
            <span style={{ fontWeight: 400, color: "var(--patch-muted)", fontSize: 12 }}>
              (Optional – Recommended for better AI routing)
            </span>
          </span>
          <textarea
            placeholder="Describe the equipment, its purpose, key components, and operating context..."
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            maxLength={1000}
            rows={5}
          />
          <div className="char-count">{description.length} / 1000</div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="wizard-sidebar">
        <h3>Why add a description?</h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
          {[
            "Adds context for retrieval routing",
            "Helps identify relevant current sources",
            "Can be added or changed later",
          ].map((text) => (
            <li key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--patch-muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--patch-accent)", flexShrink: 0, marginTop: 6 }} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/* ── Step 2: Documents ────────────────────────────────────── */
function Step2Documents({ docMode, onDocMode }: { docMode: "add" | "skip"; onDocMode: (v: "add" | "skip") => void }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Add now / Skip */}
      <div>
        <p className="section-heading" style={{ marginBottom: 4 }}>Add documents for this Equipment (optional)</p>
        <p className="section-sub">Add documents now or skip. You can add or link more later.</p>
        <div className="doc-mode-grid">
          <DocModeCard
            selected={docMode === "add"}
            onClick={() => onDocMode("add")}
            title="Add documents now"
            desc="Upload or link relevant documents to help set up your Equipment with the right information from the start."
          />
          <DocModeCard
            selected={docMode === "skip"}
            onClick={() => onDocMode("skip")}
            title="Skip for now"
            desc="You can add documents later from the Equipment record or the Documents library."
          />
        </div>
      </div>

      {/* Uploaded docs table (visible when add mode) */}
      {docMode === "add" && (
        <div className="directory-panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--patch-boundary)" }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Uploaded documents</h3>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary">Add new document</Button>
              <Button>Add new version</Button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table" aria-label="Uploaded documents">
              <thead>
                <tr>
                  <th scope="col">Logical document</th>
                  <th scope="col">Document type</th>
                  <th scope="col">Equipment target</th>
                  <th scope="col">Processing status</th>
                  <th scope="col"><span className="visually-hidden">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {UPLOADED_DOCS.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                      <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>{doc.desc}</div>
                    </td>
                    <td style={{ fontSize: 14, color: "var(--patch-muted)" }}>{doc.type}</td>
                    <td style={{ fontSize: 14, color: "var(--patch-muted)" }}>{doc.target}</td>
                    <td>
                      <StatusBadge tone={doc.status === "Needs review" ? "attention" : "info"}>
                        {doc.status}
                      </StatusBadge>
                    </td>
                    <td>
                      <button className="icon-button" type="button" aria-label={`Remove ${doc.name}`}>
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completeness footer */}
      <div className="completeness-bar">
        <div className={`completeness-ring ${docMode === "add" ? "complete" : ""}`} aria-hidden="true">
          {docMode === "add" ? <Check size={20} /> : "0/4"}
        </div>
        <div className="completeness-text">
          <strong>{docMode === "add" ? "Optional" : "Optional"}</strong>
          <span>
            {docMode === "add"
              ? "Documents added. AI routing will improve after indexing."
              : "Add at least one document"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Review ───────────────────────────────────────── */
function Step3Review({ name, type, location, description, docMode }: {
  name: string; type: string; location: string; description: string; docMode: "add" | "skip";
}) {
  return (
    <div className="wizard-form" style={{ gridTemplateColumns: "1fr", maxWidth: 720 }}>
      <div className="review-section">
        <h3>Equipment details</h3>
        <div className="review-row"><span className="review-key">Name</span><span>{name || <em style={{ color: "var(--patch-muted)" }}>Not provided</em>}</span></div>
        <div className="review-row"><span className="review-key">Type</span><span>{type || <em style={{ color: "var(--patch-muted)" }}>Not provided</em>}</span></div>
        <div className="review-row"><span className="review-key">Location</span><span>{location || <em style={{ color: "var(--patch-muted)" }}>Not provided</em>}</span></div>
        <div className="review-row">
          <span className="review-key">Description</span>
          <span>{description || <em style={{ color: "var(--patch-muted)" }}>Not provided (optional)</em>}</span>
        </div>
      </div>
      <div className="review-section">
        <h3>Documents</h3>
        <div className="review-row">
          <span className="review-key">Document step</span>
          <span>{docMode === "add" ? `${UPLOADED_DOCS.length} document(s) uploaded` : "Skipped – add documents later"}</span>
        </div>
      </div>
      <div className="info-banner">
        <Info size={18} />
        <p>After creation you can edit all details, manage documents, and view the AI-generated profile from the Equipment overview.</p>
      </div>
    </div>
  );
}

/* ── Doc mode card ────────────────────────────────────────── */
function DocModeCard({ selected, onClick, title, desc }: {
  selected: boolean; onClick: () => void; title: string; desc: string;
}) {
  return (
    <button
      type="button"
      className={`doc-mode-choice ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="doc-mode-header">
        <div className="doc-mode-radio" aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <p>{desc}</p>
      <div className="doc-mode-illustration" aria-hidden="true">
        <FileText size={52} strokeWidth={1.2} />
      </div>
    </button>
  );
}
