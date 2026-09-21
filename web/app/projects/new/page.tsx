"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FolderKanban, Info, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { getEquipments } from "@/lib/api/equipments";
import { getEquipmentDocuments } from "@/lib/api/documents";
import { createProject } from "@/lib/api/projects";
import type { Document } from "@/lib/types/document";
import type { Equipment } from "@/lib/types/equipment";

/* ── step definitions ─────────────────────────────────────── */
const STEPS = [
  { id: 1, label: "Project details" },
  { id: 2, label: "Select Equipments" },
  { id: 3, label: "Documents" },
  { id: 4, label: "Review" },
];

type DerivedDoc = {
  id: string;
  name: string;
  from: string;
  revision: string;
  status: string;
};

type StagedDoc = {
  id: string;
  name: string;
  size: string;
};

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
  const [availableEquips, setAvailableEquips] = useState<Equipment[]>([]);
  const [equipsLoading, setEquipsLoading] = useState(true);
  const [equipsError, setEquipsError] = useState<string | null>(null);
  const [equipsReloadToken, setEquipsReloadToken] = useState(0);

  // Step 3 fields
  const [docMode, setDocMode] = useState<"add" | "skip">("skip");
  const [derivedDocs, setDerivedDocs] = useState<DerivedDoc[]>([]);
  const [derivedLoading, setDerivedLoading] = useState(false);
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const descError = descTouched && description.trim() === "";
  const canNext1 = name.trim() !== "" && description.trim() !== "";

  useEffect(() => {
    let cancelled = false;

    async function loadEquipments() {
      try {
        setEquipsLoading(true);
        setEquipsError(null);
        const result = await getEquipments();

        if (!cancelled) {
          setAvailableEquips(result);
        }
      } catch {
        if (!cancelled) {
          setEquipsError(
            "Equipments could not be loaded. Retry to try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setEquipsLoading(false);
        }
      }
    }

    void loadEquipments();

    return () => {
      cancelled = true;
    };
  }, [equipsReloadToken]);

  useEffect(() => {
    if (step !== 3 || selectedEquips.length === 0) {
      function clearDerivedDocs() {
        setDerivedDocs([]);
      }

      clearDerivedDocs();
      return;
    }

    let cancelled = false;

    async function loadDerivedDocs() {
      setDerivedLoading(true);

      try {
        const lists = await Promise.all(
          selectedEquips.map((id) => getEquipmentDocuments(id)),
        );
        const byId = new Map(availableEquips.map((e) => [e.id, e.name]));
        const seen = new Set<string>();
        const docs: DerivedDoc[] = [];

        for (const list of lists) {
          for (const doc of list as Document[]) {
            if (seen.has(doc.id)) {
              continue;
            }
            seen.add(doc.id);
            docs.push({
              id: doc.id,
              name: doc.title,
              from: doc.equipmentName ?? byId.get(doc.equipmentId ?? "") ?? "Equipment",
              revision: doc.activeVersion
                ? `Revision ${doc.activeVersion} (Active)`
                : "No active revision",
              status: doc.status === "ACTIVE" ? "Up to date" : doc.status.replace(/_/g, " "),
            });
          }
        }

        if (!cancelled) {
          setDerivedDocs(docs);
        }
      } catch {
        if (!cancelled) {
          setDerivedDocs([]);
        }
      } finally {
        if (!cancelled) {
          setDerivedLoading(false);
        }
      }
    }

    void loadDerivedDocs();

    return () => {
      cancelled = true;
    };
  }, [step, selectedEquips, availableEquips]);

  function toggleEquip(id: string) {
    setSelectedEquips((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function stageFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const staged: StagedDoc[] = Array.from(files).map((file, index) => ({
      id: `staged-${Date.now()}-${index}`,
      name: file.name,
      size:
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(file.size / 1024))} KB`,
    }));

    setStagedDocs((current) => [...current, ...staged]);
    setDocMode("add");
  }

  function removeStagedDoc(id: string) {
    setStagedDocs((current) =>
      current.filter((doc) => doc.id !== id),
    );
  }

  async function goNext() {
    if (step === 1 && !canNext1) { setDescTouched(true); return; }
    if (step < STEPS.length) {
      setStep((s) => s + 1);
      return;
    }

    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const project = await createProject({
        name: name.trim(),
        code: `PRJ-${new Date().getFullYear()}-DRAFT`,
        description: description.trim(),
        equipmentIds: selectedEquips,
        stagedDocumentsCount: stagedDocs.length,
      });

      router.push(`/projects/${project.id}`);
    } catch {
      setSubmitError(
        "The project could not be created. Check your connection and retry.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedEquipObjs = availableEquips.filter((e) => selectedEquips.includes(e.id));

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
          available={availableEquips}
          loading={equipsLoading}
          error={equipsError}
          onRetry={() =>
            setEquipsReloadToken((token) => token + 1)
          }
          selected={selectedEquips}
          onToggle={toggleEquip}
        />
      )}
      {step === 3 && (
        <Step3Documents
          selectedEquips={selectedEquipObjs}
          derivedDocs={derivedDocs}
          derivedLoading={derivedLoading}
          stagedDocs={stagedDocs}
          onStageFiles={stageFiles}
          onRemoveStagedDoc={removeStagedDoc}
          docMode={docMode}
          onDocMode={setDocMode}
          descComplete={description.trim() !== ""}
        />
      )}
      {step === 4 && (
        <Step4Review
          name={name} description={description} status={status}
          selectedEquips={selectedEquipObjs} docMode={docMode}
          stagedCount={stagedDocs.length}
        />
      )}

      {/* Footer */}
      <div className="wizard-footer">
        {submitError ? (
          <p
            className="form-message form-message-error"
            role="alert"
            style={{ marginRight: "auto" }}
          >
            {submitError}
          </p>
        ) : null}
        <Button variant="secondary" onClick={() => router.push("/projects")}>Cancel</Button>
        {step > 1 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>}
        <Button onClick={() => void goNext()} disabled={submitting}>
          {step === STEPS.length
            ? submitting
              ? "Creating…"
              : "Create project"
            : "Next"}
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
function Step2Equipments({ available, loading, error, onRetry, selected, onToggle }: {
  available: Equipment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = available.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase())
  );
  const selectedObjs = available.filter((e) => selected.includes(e.id));

  if (loading) {
    return (
      <div className="wizard-form" style={{ gridTemplateColumns: "1fr" }}>
        <p className="section-heading">Select Equipments to include</p>
        <p className="section-sub" role="status">Loading equipments…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wizard-form" style={{ gridTemplateColumns: "1fr" }}>
        <p className="section-heading">Select Equipments to include</p>
        <p className="form-message form-message-error" role="alert">{error}</p>
        <div>
          <Button variant="secondary" onClick={onRetry}>Retry</Button>
        </div>
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className="wizard-form" style={{ gridTemplateColumns: "1fr" }}>
        <p className="section-heading">Select Equipments to include</p>
        <p className="section-sub">No equipments are available yet. Create an Equipment first, or continue without linked Equipments.</p>
      </div>
    );
  }

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
        {filtered.length === 0 ? (
          <p className="section-sub" role="status">
            No equipments match “{search}”. Try a different search term.
          </p>
        ) : (
          filtered.map((eq) => {
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
          })
        )}
      </div>
    </div>
  );
}

/* ── Step 3: Documents ────────────────────────────────────── */
function Step3Documents({ selectedEquips, derivedDocs, derivedLoading, stagedDocs, onStageFiles, onRemoveStagedDoc, docMode, onDocMode, descComplete }: {
  selectedEquips: Equipment[];
  derivedDocs: DerivedDoc[];
  derivedLoading: boolean;
  stagedDocs: StagedDoc[];
  onStageFiles: (files: FileList | null) => void;
  onRemoveStagedDoc: (id: string) => void;
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
                  {derivedLoading ? (
                    <tr>
                      <td colSpan={4} role="status">
                        Loading inherited documents…
                      </td>
                    </tr>
                  ) : derivedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        No active documents on the selected Equipments yet.
                      </td>
                    </tr>
                  ) : (
                    derivedDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</td>
                        <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.from}</td>
                        <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.revision}</td>
                        <td>
                          <StatusBadge
                            tone={
                              doc.status === "Up to date"
                                ? "success"
                                : "attention"
                            }
                          >
                            {doc.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))
                  )}
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

        {docMode === "add" && (
          <div className="directory-panel" style={{ marginTop: 12 }}>
            <div className="table-scroll">
              <table className="data-table" aria-label="Direct project documents">
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Size</th>
                    <th scope="col">Processing status</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {stagedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        No files staged yet. Choose files to upload them with
                        this project.
                      </td>
                    </tr>
                  ) : (
                    stagedDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                        </td>
                        <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{doc.size}</td>
                        <td><StatusBadge tone="info">Staged</StatusBadge></td>
                        <td>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Remove ${doc.name}`}
                            onClick={() => onRemoveStagedDoc(doc.id)}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16 }}>
              <label className="button button-secondary" style={{ cursor: "pointer" }}>
                Choose files
                <input
                  type="file"
                  multiple
                  hidden
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={(event) => {
                    onStageFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
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
function Step4Review({ name, description, status, selectedEquips, docMode, stagedCount }: {
  name: string; description: string; status: string;
  selectedEquips: Equipment[];
  docMode: "add" | "skip";
  stagedCount: number;
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
          <span>
            {docMode === "add"
              ? `${stagedCount} staged document${stagedCount === 1 ? "" : "s"}`
              : "Skipped – add documents later"}
          </span>
        </div>
      </div>
      <div className="info-banner">
        <Info size={18} />
        <p>A procedure generation request will be queued automatically. It will start once a required description and at least one approved Project document are available.</p>
      </div>
    </div>
  );
}
