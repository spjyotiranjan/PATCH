"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FolderKanban, Info, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

/* ── step definitions ─────────────────────────────────────── */
const STEPS = [
  { id: 1, label: "Project details" },
  { id: 2, label: "Select Equipments" },
  { id: 3, label: "Documents" },
  { id: 4, label: "Review" },
];

/* ── hardcoded Equipment options for step 2 ──────────────── */
const AVAILABLE_EQUIPMENTS = [
  { id: "eq-1", name: "Centrifugal Pump P-101", type: "Centrifugal Pump", location: "Utility Room" },
  { id: "eq-2", name: "Boiler B-201",           type: "Boiler",           location: "Boiler House" },
  { id: "eq-3", name: "Filler O2",              type: "Filler",           location: "Packaging Line 1" },
  { id: "eq-4", name: "Conveyor 11",            type: "Conveyor",         location: "Packaging Line 1" },
  { id: "eq-5", name: "Capper 04",              type: "Capper",           location: "Packaging Line 1" },
  { id: "eq-6", name: "Compressor C-301",       type: "Compressor",       location: "Utility Room" },
];

/* ── hardcoded Equipment-derived docs for step 3 ─────────── */
const DERIVED_DOCS = [
  { name: "P-101 Maintenance Manual", from: "P-101", revision: "Revision 2 (Active)", status: "Up to date" },
  { name: "P-101 P&ID",               from: "P-101", revision: "Revision 3 (Active)", status: "Up to date" },
  { name: "P-101 Datasheet",          from: "P-101", revision: "Revision 1 (Active)", status: "Up to date" },
];

const DIRECT_DOCS = [
  { id: "dd1", name: "HAZOP Study Report", desc: "Hazard & operability analysis", type: "Report", addedBy: "You", status: "Indexing" },
];

const STATUSES = ["Planning", "Active", "On hold", "Completed"];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [descTouched, setDescTouched] = useState(false);
  const [status, setStatus] = useState("Planning");

  // Step 2 fields
  const [selectedEquips, setSelectedEquips] = useState<string[]>([]);

  // Step 3 fields
  const [docMode, setDocMode] = useState<"add" | "skip">("skip");

  const descError = descTouched && description.trim() === "";
  const canNext1 = name.trim() !== "" && description.trim() !== "";

  function toggleEquip(id: string) {
    setSelectedEquips((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function goNext() {
    if (step === 1 && !canNext1) { setDescTouched(true); return; }
    if (step < STEPS.length) setStep((s) => s + 1);
    else router.push("/projects/proj-1");
  }

  const selectedEquipObjs = AVAILABLE_EQUIPMENTS.filter((e) => selectedEquips.includes(e.id));

  return (
    <AppShell
      title="Create project"
      status={<StatusBadge tone="info">In progress</StatusBadge>}
    >
      {/* Step progress */}
      <WizardSteps current={step} steps={STEPS} />

      {step === 1 && (
        <Step1Details
          name={name} onName={setName}
          description={description} onDescription={(v) => { setDescription(v); setDescTouched(true); }}
          descError={descError}
          status={status} onStatus={setStatus}
        />
      )}
      {step === 2 && (
        <Step2Equipments
          available={AVAILABLE_EQUIPMENTS}
          selected={selectedEquips}
          onToggle={toggleEquip}
        />
      )}
      {step === 3 && (
        <Step3Documents
          selectedEquips={selectedEquipObjs}
          derivedDocs={DERIVED_DOCS}
          directDocs={DIRECT_DOCS}
          docMode={docMode}
          onDocMode={setDocMode}
          descComplete={description.trim() !== ""}
        />
      )}
      {step === 4 && (
        <Step4Review
          name={name} description={description} status={status}
          selectedEquips={selectedEquipObjs} docMode={docMode}
        />
      )}

      {/* Footer */}
      <div className="wizard-footer">
        <Button variant="secondary" onClick={() => router.push("/projects")}>Cancel</Button>
        {step > 1 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>}
        <Button onClick={goNext}>
          {step === STEPS.length ? "Create project" : "Next"}
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
          <div key={s.id} className={`wizard-step ${active ? "wizard-step-active" : ""} ${done ? "wizard-step-done" : ""}`}>
            <div className="wizard-step-num" aria-hidden="true">
              {done ? <Check size={14} /> : s.id}
            </div>
            {s.label}
            {i < steps.length - 1 && <ChevronRight size={14} style={{ opacity: 0.3, marginLeft: "auto" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: Project details ──────────────────────────────── */
function Step1Details({ name, onName, description, onDescription, descError, status, onStatus }: {
  name: string; onName: (v: string) => void;
  description: string; onDescription: (v: string) => void;
  descError: boolean;
  status: string; onStatus: (v: string) => void;
}) {
  return (
    <div className="wizard-body">
      <div className="wizard-form">
        <label className="field">
          <span className="field-label">Project name <span aria-hidden="true">*</span></span>
          <input type="text" placeholder="Enter project name" value={name} onChange={(e) => onName(e.target.value)} required autoFocus />
        </label>

        <div className="field">
          <span className="field-label">Description <span aria-hidden="true">*</span></span>
          <textarea
            className={descError ? "field-error" : ""}
            placeholder="Describe the project, its purpose, goals, scope, and expected outcomes."
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            maxLength={1000}
            rows={5}
            aria-describedby={descError ? "desc-error" : undefined}
            required
          />
          {descError && <span id="desc-error" className="field-error-msg" role="alert">Description is required.</span>}
          <div className="char-count">{description.length} / 1000</div>
        </div>

        <label className="field">
          <span className="field-label">Project status</span>
          <select value={status} onChange={(e) => onStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* Sidebar */}
      <aside className="wizard-sidebar">
        <h3>What happens next?</h3>
        <ol className="what-next-list">
          {[
            { title: "Project details",     desc: "Add the basic information about your project." },
            { title: "Select Equipments",   desc: "Choose Equipments to include in this project. We'll link their current documents." },
            { title: "Documents",           desc: "Add project documents or skip for now. You can add more later." },
            { title: "Review",              desc: "Review all details and create your project." },
          ].map((item, i) => (
            <li key={item.title} className="what-next-item">
              <div className="what-next-num" aria-hidden="true">{i + 1}</div>
              <div>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

/* ── Step 2: Select Equipments ────────────────────────────── */
function Step2Equipments({ available, selected, onToggle }: {
  available: typeof AVAILABLE_EQUIPMENTS;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = available.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase())
  );
  const selectedObjs = available.filter((e) => selected.includes(e.id));

  return (
    <div className="wizard-form" style={{ gridTemplateColumns: "1fr" }}>
      <div>
        <p className="section-heading">Select Equipments to include</p>
        <p className="section-sub">Choose Equipments you own or have manage access to. Their current documents will be linked automatically.</p>
      </div>

      {selectedObjs.length > 0 && (
        <div>
          <div className="selected-equipments-label">Selected ({selectedObjs.length})</div>
          <div className="chips-row">
            {selectedObjs.map((e) => (
              <span key={e.id} className="selected-equip-chip">
                <FolderKanban size={13} />
                {e.name}
                <button className="chip-remove" type="button" aria-label={`Remove ${e.name}`} onClick={() => onToggle(e.id)}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 40, border: "1px solid var(--patch-boundary)", borderRadius: 5, background: "var(--patch-surface)" }}>
        <span className="visually-hidden">Search equipments</span>
        <input
          type="search"
          placeholder="Search equipments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 14, color: "var(--patch-text)" }}
        />
      </label>

      <div className="equip-selector" role="group" aria-label="Available equipments">
        {filtered.map((eq) => {
          const sel = selected.includes(eq.id);
          return (
            <button
              key={eq.id}
              type="button"
              className={`equip-option ${sel ? "selected" : ""}`}
              onClick={() => onToggle(eq.id)}
              aria-pressed={sel}
            >
              <div className="equip-icon-cell" aria-hidden="true">
                <FolderKanban size={15} />
              </div>
              <div>
                <div className="equip-option-name">{eq.name}</div>
                <div className="equip-option-meta">{eq.type} · {eq.location}</div>
              </div>
              {sel && <span className="equip-option-check" aria-hidden="true"><Check size={16} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 3: Documents ────────────────────────────────────── */
function Step3Documents({ selectedEquips, derivedDocs, directDocs, docMode, onDocMode, descComplete }: {
  selectedEquips: typeof AVAILABLE_EQUIPMENTS;
  derivedDocs: typeof DERIVED_DOCS;
  directDocs: typeof DIRECT_DOCS;
  docMode: "add" | "skip";
  onDocMode: (v: "add" | "skip") => void;
  descComplete: boolean;
}) {
  const showDerived = selectedEquips.length > 0;
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 960 }}>
      {/* Info banner */}
      <div className="info-banner">
        <Info size={18} />
        <p>
          <strong>Equipment document updates propagate automatically.</strong>
          When a document on an Equipment is updated, the latest active version is reflected here.
        </p>
      </div>

      {/* Equipment-derived docs (read-only) */}
      {showDerived && (
        <div>
          <p className="section-heading">Automatically included from Equipments (read-only, no copies)</p>
          <p className="section-sub">These are references to documents from selected Equipments. They stay up to date automatically.</p>
          <div className="directory-panel">
            <div className="table-scroll">
              <table className="data-table" aria-label="Equipment-derived documents">
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">From Equipment</th>
                    <th scope="col">Current revision</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {derivedDocs.map((doc) => (
                    <tr key={doc.name}>
                      <td style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</td>
                      <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.from}</td>
                      <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.revision}</td>
                      <td><StatusBadge tone="success">{doc.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Direct Project documents */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <p className="section-heading">Direct Project documents (optional)</p>
            <p className="section-sub" style={{ marginBottom: 0 }}>Add project-specific documents that are not tied to a single Equipment.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <Button onClick={() => onDocMode("add")}>Add documents now</Button>
            <Button variant="secondary" onClick={() => onDocMode("skip")}>Skip for now</Button>
          </div>
        </div>

        {docMode === "add" && directDocs.length > 0 && (
          <div className="directory-panel" style={{ marginTop: 12 }}>
            <div className="table-scroll">
              <table className="data-table" aria-label="Direct project documents">
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Document type</th>
                    <th scope="col">Added by</th>
                    <th scope="col">Processing status</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {directDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                        <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>{doc.desc}</div>
                      </td>
                      <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.type}</td>
                      <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.addedBy}</td>
                      <td><StatusBadge tone="info">{doc.status}</StatusBadge></td>
                      <td><button className="icon-button" type="button" aria-label={`View ${doc.name}`}><span aria-hidden="true">⎘</span></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Completeness footer */}
      <div className="completeness-bar">
        <div className={`completeness-ring ${descComplete ? "complete" : ""}`} aria-hidden="true">
          {descComplete ? <Check size={20} /> : "–"}
        </div>
        <div className="completeness-text">
          <strong>Project description completeness</strong>
          <span>
            {descComplete
              ? "Required. A clear description improves relevance and response quality."
              : "Required. Add a project description in Step 1 to enable AI procedure generation."}
          </span>
        </div>
        {descComplete && (
          <StatusBadge tone="success">Complete</StatusBadge>
        )}
      </div>
    </div>
  );
}

/* ── Step 4: Review ───────────────────────────────────────── */
function Step4Review({ name, description, status, selectedEquips, docMode }: {
  name: string; description: string; status: string;
  selectedEquips: typeof AVAILABLE_EQUIPMENTS;
  docMode: "add" | "skip";
}) {
  return (
    <div className="wizard-form" style={{ gridTemplateColumns: "1fr", maxWidth: 720 }}>
      <div className="review-section">
        <h3>Project details</h3>
        <div className="review-row"><span className="review-key">Name</span><span>{name || <em style={{ color: "var(--patch-muted)" }}>Not provided</em>}</span></div>
        <div className="review-row"><span className="review-key">Description</span><span>{description || <em style={{ color: "var(--patch-muted)" }}>Required – not provided</em>}</span></div>
        <div className="review-row"><span className="review-key">Status</span><span>{status}</span></div>
      </div>
      <div className="review-section">
        <h3>Included Equipments</h3>
        {selectedEquips.length === 0 ? (
          <div style={{ color: "var(--patch-muted)", fontSize: 14 }}>No Equipments selected — you can add them later.</div>
        ) : (
          selectedEquips.map((e) => (
            <div key={e.id} className="review-row">
              <span className="review-key">{e.name}</span>
              <span style={{ color: "var(--patch-muted)", fontSize: 13 }}>{e.type} · {e.location}</span>
            </div>
          ))
        )}
      </div>
      <div className="review-section">
        <h3>Documents</h3>
        <div className="review-row">
          <span className="review-key">Document step</span>
          <span>{docMode === "add" ? "Documents uploaded" : "Skipped – add documents later"}</span>
        </div>
      </div>
      <div className="info-banner">
        <Info size={18} />
        <p>A procedure generation request will be queued automatically. It will start once a required description and at least one approved Project document are available.</p>
      </div>
    </div>
  );
}
