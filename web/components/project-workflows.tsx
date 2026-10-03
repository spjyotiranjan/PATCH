"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  GripVertical,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Field, StatusBadge } from "@/components/ui";
import {
  LoadState,
  RecordState,
  useAction,
  useResource,
} from "@/components/backend-state";
import { CitationCard } from "@/components/live-chat";
import { getProjectRecord } from "@/lib/api/resources";
import { getEntityDocuments } from "@/lib/api/document-workflow";
import * as workflows from "@/lib/api/workflows";
import { ApiRequestError } from "@/lib/api/http";
import type {
  Log,
  ProcedureRecord,
  ProcedureVersion,
  Run,
  Schedule,
} from "@/lib/api/contracts";

export function MaintenanceWorkspace({ projectId }: { projectId: string }) {
  const loader = useCallback(
    async () => ({
      project: await getProjectRecord(projectId),
      logs: await workflows.listLogs(projectId),
      documents: await getEntityDocuments({ type: "PROJECT", id: projectId }),
    }),
    [projectId],
  );
  const resource = useResource(loader);
  const [editor, setEditor] = useState<Log | "new" | null>(null);
  const [filter, setFilter] = useState("ALL");
  const owner = resource.data?.project.role === "OWNER";
  return (
    <AppShell title="Project maintenance logs">
      <Link href={`/projects/${projectId}`}>Back to Project</Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <>
          <div className="integration-toolbar">
            <Field label="Filter logs">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">All logs</option>
                <option>DRAFT</option>
                <option>SUBMITTED</option>
              </select>
            </Field>
            {owner && <Button onClick={() => setEditor("new")}>New log</Button>}
            <Button variant="secondary" onClick={() => void resource.refresh()}>
              Refresh
            </Button>
          </div>
          {!owner && (
            <p>
              Project Members can read logs. Creating, editing and submitting
              requires Owner access.
            </p>
          )}
          <div className="integration-columns">
            <section className="panel integration-panel">
              <h2>Saved records</h2>
              {resource.data.logs
                .filter((log) => filter === "ALL" || log.state === filter)
                .map((log) => (
                  <article className="integration-record" key={log.id}>
                    <Button variant="quiet" onClick={() => setEditor(log)}>
                      {log.text.slice(0, 100)}
                    </Button>
                    <p>
                      {log.scopeType === "PROJECT"
                        ? "Overall Project"
                        : `Equipment ${log.equipmentId}`}
                    </p>
                    <RecordState value={log.state} />
                    <p>
                      {new Date(log.createdAt).toLocaleString()} · author{" "}
                      {log.createdBy}
                    </p>
                  </article>
                ))}
              {!resource.data.logs.length && <p>No maintenance logs yet.</p>}
            </section>
            {editor && (
              <LogEditor
                key={editor === "new" ? "new" : editor.id}
                log={editor === "new" ? null : editor}
                projectId={projectId}
                equipmentIds={resource.data.project.includedEquipmentIds}
                documents={resource.data.documents.items
                  .filter((doc) => doc.activeVersionId)
                  .map((doc) => ({
                    id: doc.activeVersionId!,
                    title: doc.title,
                  }))}
                owner={owner}
                onSaved={async (log) => {
                  setEditor(log);
                  await resource.refresh();
                }}
              />
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
function LogEditor({
  log,
  projectId,
  equipmentIds,
  documents,
  owner,
  onSaved,
}: {
  log: Log | null;
  projectId: string;
  equipmentIds: string[];
  documents: { id: string; title: string }[];
  owner: boolean;
  onSaved: (log: Log) => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState(log);
  const [text, setText] = useState(log?.text ?? "");
  const [equipmentId, setEquipmentId] = useState(log?.equipmentId ?? "");
  const [attachments, setAttachments] = useState(
    log?.attachmentVersionIds ?? [],
  );
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const action = useAction();
  const editable = owner && snapshot?.state !== "SUBMITTED";
  const input = () => ({
    scopeType: equipmentId ? ("EQUIPMENT" as const) : ("PROJECT" as const),
    equipmentId: equipmentId || null,
    text,
    attachmentVersionIds: attachments,
    citations: snapshot?.citations ?? [],
  });
  async function save(event: FormEvent) {
    event.preventDefault();
    await action.run(async () => {
      const saved = snapshot
        ? await workflows.saveLog(snapshot, text)
        : await workflows.createLog(projectId, input());
      setSnapshot(saved);
      await onSaved(saved);
    });
  }
  return (
    <section className="panel integration-panel">
      <h2>{snapshot ? "Log record" : "New log draft"}</h2>
      <form className="integration-form" onSubmit={save}>
        <fieldset disabled={!editable || action.busy}>
          <Field label="Scope">
            <select
              disabled={!!snapshot}
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">Overall Project</option>
              {equipmentIds.map((id) => (
                <option key={id} value={id}>
                  Equipment {id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Final user wording" required>
            <textarea
              required
              maxLength={20000}
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          {!snapshot && (
            <fieldset>
              <legend>Attach current Project source versions</legend>
              {documents.map((doc) => (
                <label className="integration-check" key={doc.id}>
                  <input
                    type="checkbox"
                    checked={attachments.includes(doc.id)}
                    onChange={(e) =>
                      setAttachments((current) =>
                        e.target.checked
                          ? [...current, doc.id].slice(0, 20)
                          : current.filter((id) => id !== doc.id),
                      )
                    }
                  />
                  {doc.title}
                </label>
              ))}
            </fieldset>
          )}
          <p>
            Logs record observations. Priorities, assignees, comments and
            separate photo uploads are not supported by the current backend.
          </p>
        </fieldset>
        {action.error && <p role="alert">{action.error}</p>}
        {editable && (
          <div className="integration-toolbar">
            <Button type="submit" disabled={action.busy || !text.trim()}>
              Save draft
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={action.busy || !text.trim()}
              onClick={() =>
                void action.run(async () => {
                  const result = await workflows.draftLog(projectId, input());
                  if (result.status !== "drafted" || !result.draftText)
                    throw new ApiRequestError("DRAFT_UNAVAILABLE");
                  setSuggestion(result.draftText);
                })
              }
            >
              Suggest wording
            </Button>
            {snapshot && (
              <Button
                type="button"
                disabled={action.busy || text !== snapshot.text}
                onClick={() => {
                  if (
                    window.confirm(
                      "Submit this exact saved wording? Submitted logs are immutable.",
                    )
                  )
                    void action.run(async () => {
                      const saved = await workflows.submitLog(snapshot);
                      setSnapshot(saved);
                      await onSaved(saved);
                    });
                }}
              >
                Submit saved log
              </Button>
            )}
          </div>
        )}
        {snapshot && (
          <>
            <RecordState value={snapshot.state} />
            <p>Revision {snapshot.revision}</p>
            {text !== snapshot.text && <p>Save edits before submission.</p>}
            {snapshot.attachmentVersionIds.map((id) => (
              <p key={id}>
                <Link href={`/documents/${id}`}>
                  Attached source version {id}
                </Link>
              </p>
            ))}
            {snapshot.citations.map((citation) => (
              <CitationCard citation={citation} key={citation.id} />
            ))}
          </>
        )}
      </form>
      {suggestion && (
        <section className="info-banner">
          <h3>Suggested draft — review before using</h3>
          <p className="integration-prewrap">{suggestion}</p>
          <Button
            variant="secondary"
            disabled={!editable || action.busy}
            onClick={() => {
              setText(suggestion);
              setSuggestion(null);
            }}
          >
            Use in editor
          </Button>
        </section>
      )}
    </section>
  );
}

export function ProceduresWorkspace({ projectId }: { projectId: string }) {
  const loader = useCallback(
    async () => ({
      project: await getProjectRecord(projectId),
      ...(await workflows.listProcedures(projectId)),
    }),
    [projectId],
  );
  const resource = useResource(loader, 15000);
  return (
    <AppShell title="Project procedures">
      <Link className="procedure-back" href={`/projects/${projectId}`}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to Project
      </Link>
      <div className="procedure-page">
        <LoadState {...resource} retry={resource.refresh} />
        {resource.data && (
          <>
            <section className="panel integration-panel procedure-generation">
              <div className="procedure-section-heading">
                <span className="procedure-icon">
                  <Sparkles size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>Procedure drafts</h2>
                  <p>
                    From Project sources to a reviewed, controlled definition.
                  </p>
                </div>
              </div>
              <p>
                Generation starts automatically once an approved, indexed direct
                Project source is ready. AI output stays a draft until Owner
                review and publication.
              </p>
              {resource.data.generationRequests.map((request) => (
                <p key={request.id}>
                  <RecordState value={request.status} />
                </p>
              ))}
              {!resource.data.items.length && (
                <p>
                  No saved procedure candidate yet.{" "}
                  <Link href={`/projects/${projectId}/documents`}>
                    Review Project sources
                  </Link>{" "}
                  to prepare a source-backed draft.
                </p>
              )}
            </section>
            {resource.data.items.map((procedure) => (
              <ProcedureSummary
                key={procedure.id}
                procedure={procedure}
                owner={resource.data!.project.role === "OWNER"}
                onChanged={resource.refresh}
              />
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
function ProcedureSummary({
  procedure,
  owner,
  onChanged,
}: {
  procedure: ProcedureRecord;
  owner: boolean;
  onChanged: () => Promise<void>;
}) {
  const loader = useCallback(
    async () => ({
      versions: await workflows.listProcedureVersions(
        procedure.projectId,
        procedure.id,
      ),
      runs: await workflows.listRuns(procedure.projectId, procedure.id),
    }),
    [procedure.projectId, procedure.id],
  );
  const resource = useResource(loader, 15000);
  const action = useAction();
  const router = useRouter();
  return (
    <section className="panel integration-panel procedure-summary">
      <div className="procedure-section-heading">
        <span className="procedure-icon">
          <ClipboardList size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="procedure-eyebrow">Controlled procedure</p>
          <h2>{procedure.title}</h2>
        </div>
      </div>
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      <h3 className="procedure-section-title">Definitions and history</h3>
      {resource.data?.versions.map((version) => (
        <div className="procedure-history-row" key={version.id}>
          <Link
            href={`/projects/${procedure.projectId}/procedures/${procedure.id}/edit?version=${version.id}`}
          >
            <span className="procedure-version-tag">
              v{version.versionNumber}
            </span>{" "}
            {version.title}
          </Link>{" "}
          <RecordState value={version.state} />
        </div>
      ))}
      {owner && (
        <Button
          disabled={action.busy}
          variant="secondary"
          onClick={() =>
            void action.run(async () => {
              await workflows.regenerateProcedure(
                procedure.projectId,
                procedure.id,
              );
              await resource.refresh();
            })
          }
        >
          Request source-based candidate
        </Button>
      )}
      <h3 className="procedure-section-title">Execution runs</h3>
      {resource.data?.runs.map((run) => (
        <div className="procedure-history-row" key={run.id}>
          <Link
            href={`/projects/${procedure.projectId}/procedures/${procedure.id}/runs/${run.id}`}
          >
            {new Date(run.periodStart).toLocaleString()} –{" "}
            {new Date(run.periodEnd).toLocaleString()}
          </Link>{" "}
          <RecordState value={run.state} />
        </div>
      ))}
      {!resource.data?.runs.length && <p>No runs yet.</p>}
      {procedure.schedule ? (
        <>
          <p className="procedure-schedule-meta">
            <CalendarDays size={16} aria-hidden="true" />{" "}
            {procedure.schedule.frequency} · every {procedure.schedule.interval}{" "}
            period(s) · {procedure.schedule.timezone}
          </p>
          {owner && (
            <Button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const run = await workflows.createRun(
                    procedure.projectId,
                    procedure.id,
                  );
                  router.push(
                    `/projects/${procedure.projectId}/procedures/${procedure.id}/runs/${run.id}`,
                  );
                })
              }
            >
              Open current due run
            </Button>
          )}
        </>
      ) : owner && procedure.currentPublishedVersionId ? (
        <ScheduleForm procedure={procedure} onSaved={onChanged} />
      ) : (
        <p>Publication is required before scheduling an execution run.</p>
      )}
    </section>
  );
}
function ScheduleForm({
  procedure,
  onSaved,
}: {
  procedure: ProcedureRecord;
  onSaved: () => Promise<void>;
}) {
  const [frequency, setFrequency] = useState<Schedule["frequency"]>("DAILY");
  const [interval, setInterval] = useState(1);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [localStart, setLocalStart] = useState("");
  const [saved, setSaved] = useState(false);
  const action = useAction();
  return saved ? (
    <p>Schedule saved. Refresh this page to open the current due run.</p>
  ) : (
    <form
      className="integration-form procedure-schedule-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (window.confirm("Create this immutable recurrence schedule?"))
          void action.run(async () => {
            await workflows.scheduleProcedure(
              procedure.projectId,
              procedure.id,
              {
                frequency,
                interval,
                timezone,
                localStart:
                  localStart.length === 16 ? `${localStart}:00` : localStart,
              },
            );
            setSaved(true);
            await onSaved();
          });
      }}
    >
      <h3>Schedule recurring runs</h3>
      <p className="procedure-muted">
        Choose when a fresh execution checklist opens.
      </p>
      <Field label="Frequency">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as typeof frequency)}
        >
          {["DAILY", "WEEKLY", "MONTHLY"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </Field>
      <Field label="Every">
        <input
          type="number"
          min={1}
          max={12}
          required
          value={interval}
          onChange={(e) => setInterval(Number(e.target.value))}
        />
      </Field>
      <Field label="IANA timezone">
        <input
          required
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
      </Field>
      <Field label="Effective local start">
        <input
          type="datetime-local"
          step={60}
          required
          value={localStart}
          onChange={(e) => setLocalStart(e.target.value)}
        />
      </Field>
      <p>
        A new period starts unchecked. Past runs retain their recorded
        definition and completions.
      </p>
      {action.error && <p role="alert">{action.error}</p>}
      <Button disabled={action.busy} type="submit">
        Create schedule
      </Button>
    </form>
  );
}

export function ProcedureEditorWorkspace({
  projectId,
  procedureId,
  versionId,
}: {
  projectId: string;
  procedureId: string;
  versionId?: string;
}) {
  const loader = useCallback(async () => {
    const project = await getProjectRecord(projectId);
    const versions = await workflows.listProcedureVersions(
      projectId,
      procedureId,
    );
    const version = versionId
      ? versions.find((item) => item.id === versionId)
      : versions[0];
    if (!version) throw new ApiRequestError("PROCEDURE_VERSION_NOT_FOUND", 404);
    return { project, version };
  }, [projectId, procedureId, versionId]);
  const resource = useResource(loader);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <AppShell title="Procedure definition">
      <Link
        className="procedure-back"
        href={`/projects/${projectId}/procedures`}
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to procedures and
        history
      </Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <div className="procedure-page">
          <ProcedureEditor
            key={
              resource.data.version.id +
              ":" +
              resource.data.version.revision +
              ":" +
              reloadKey
            }
            initial={resource.data.version}
            owner={resource.data.project.role === "OWNER"}
            refresh={async () => {
              await resource.refresh();
              setReloadKey((value) => value + 1);
            }}
          />
        </div>
      )}
    </AppShell>
  );
}
function ProcedureEditor({
  initial,
  owner,
  refresh,
}: {
  initial: ProcedureVersion;
  owner: boolean;
  refresh: () => Promise<void>;
}) {
  const [version, setVersion] = useState(initial);
  const [openSteps, setOpenSteps] = useState<string[]>(
    initial.steps[0] ? [initial.steps[0].stepId] : [],
  );
  const [dirty, setDirty] = useState(false);
  const [human, setHuman] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const action = useAction();
  const router = useRouter();
  const readonly = !owner || version.state === "PUBLISHED";
  const blocked =
    version.reviewAnalysis.reviewNeed === "SEVERE" ||
    !!version.reviewAnalysis.blockingFindings?.length ||
    version.steps.some(
      (step) =>
        step.citationReviewState !== "CONFIRMED" ||
        step.evidenceState !== "SUPPORTED" ||
        !step.citationIds.length,
    );
  function edit(next: ProcedureVersion) {
    setVersion(next);
    setDirty(true);
    setHuman(false);
    setReasons([]);
  }
  function move(index: number, delta: number) {
    const steps = [...version.steps];
    [steps[index], steps[index + delta]] = [steps[index + delta], steps[index]];
    edit({
      ...version,
      steps: steps.map((step, i) => ({ ...step, position: i + 1 })),
    });
  }
  function transition(
    actionName: Parameters<typeof workflows.transitionProcedure>[1],
  ) {
    void action.run(async () => {
      const updated = await workflows.transitionProcedure(
        version,
        actionName,
        reasons,
      );
      setVersion(updated);
      setHuman(false);
      setReasons([]);
    });
  }
  return (
    <>
      <section className="panel integration-panel procedure-editor">
        <div className="procedure-header">
          <div>
            <p className="procedure-eyebrow">Procedure definition</p>
            <h2>{version.title || "Untitled procedure"}</h2>
          </div>
          <div className="procedure-badges">
            <RecordState value={version.state} />
            <RecordState
              value={`${version.reviewAnalysis.reviewNeed}_REVIEW_NEEDED`}
            />
          </div>
        </div>
        <p className="procedure-muted">
          Version {version.versionNumber} · revision {version.revision}. Human
          review is required at every review-need level.
        </p>
        <div className="procedure-editor-columns">
          <div className="integration-form procedure-editor-main">
            <Field label="Procedure title">
              <input
                maxLength={300}
                value={version.title}
                disabled={readonly || action.busy}
                onChange={(e) => edit({ ...version, title: e.target.value })}
              />
            </Field>
            <div className="procedure-steps-heading">
              <div>
                <h3>Procedure steps</h3>
                <p>
                  {version.steps.length} steps · Open a step to review or edit
                  its details.
                </p>
              </div>
              <div className="procedure-step-view-controls">
                <Button
                  variant="quiet"
                  onClick={() =>
                    setOpenSteps(version.steps.map((step) => step.stepId))
                  }
                >
                  Expand all
                </Button>
                <Button variant="quiet" onClick={() => setOpenSteps([])}>
                  Collapse all
                </Button>
              </div>
            </div>
            {version.steps.map((step, index) => (
              <details
                className="procedure-step"
                open={openSteps.includes(step.stepId)}
                onToggle={(event) => {
                  const expanded = event.currentTarget.open;
                  setOpenSteps((current) =>
                    expanded
                      ? current.includes(step.stepId)
                        ? current
                        : [...current, step.stepId]
                      : current.includes(step.stepId)
                        ? current.filter((id) => id !== step.stepId)
                        : current,
                  );
                }}
                key={step.stepId}
                onDragOver={(event) => {
                  if (!readonly && !action.busy) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (readonly || action.busy) return;
                  event.preventDefault();
                  const source = version.steps.findIndex(
                    (item) =>
                      item.stepId === event.dataTransfer.getData("text/plain"),
                  );
                  if (source < 0 || source === index) return;
                  const reordered = [...version.steps];
                  const [moved] = reordered.splice(source, 1);
                  reordered.splice(index, 0, moved);
                  edit({
                    ...version,
                    steps: reordered.map((item, position) => ({
                      ...item,
                      position: position + 1,
                    })),
                  });
                }}
              >
                <summary className="procedure-step-summary">
                  <button
                    type="button"
                    className="procedure-drag"
                    draggable={!readonly && !action.busy}
                    disabled={readonly || action.busy}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", step.stepId);
                    }}
                    aria-label={`Drag step ${index + 1}; alternatively use Move up or Move down`}
                    title="Drag to reorder"
                  >
                    <GripVertical size={16} aria-hidden="true" />
                  </button>
                  <span className="procedure-step-number">{index + 1}</span>
                  <span className="procedure-step-caption">
                    <strong>{step.title.trim() || "Untitled step"}</strong>
                    <small>
                      {step.required ? "Required" : "Optional"} ·{" "}
                      {step.citationIds.length} linked{" "}
                      {step.citationIds.length === 1 ? "source" : "sources"}
                    </small>
                  </span>
                  <StatusBadge
                    tone={
                      dirty ||
                      step.citationReviewState !== "CONFIRMED" ||
                      step.evidenceState !== "SUPPORTED" ||
                      !step.citationIds.length
                        ? "attention"
                        : "neutral"
                    }
                  >
                    {dirty
                      ? "Revalidation needed"
                      : step.citationReviewState === "CONFIRMED" &&
                          step.evidenceState === "SUPPORTED" &&
                          step.citationIds.length
                        ? "Sources verified"
                        : "Source check needed"}
                  </StatusBadge>
                  <ChevronDown
                    className="procedure-step-chevron"
                    size={18}
                    aria-hidden="true"
                  />
                </summary>
                <div className="procedure-step-body integration-form">
                  <Field label="Step title">
                    <input
                      maxLength={300}
                      value={step.title}
                      disabled={readonly || action.busy}
                      onChange={(e) =>
                        edit({
                          ...version,
                          steps: version.steps.map((item) =>
                            item.stepId === step.stepId
                              ? { ...item, title: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Instructions">
                    <textarea
                      maxLength={4000}
                      value={step.instructions}
                      disabled={readonly || action.busy}
                      onChange={(e) =>
                        edit({
                          ...version,
                          steps: version.steps.map((item) =>
                            item.stepId === step.stepId
                              ? { ...item, instructions: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </Field>
                  <label className="integration-check procedure-required">
                    <input
                      type="checkbox"
                      checked={step.required}
                      disabled={readonly || action.busy}
                      onChange={(e) =>
                        edit({
                          ...version,
                          steps: version.steps.map((item) =>
                            item.stepId === step.stepId
                              ? { ...item, required: e.target.checked }
                              : item,
                          ),
                        })
                      }
                    />
                    Required during execution
                  </label>
                  <p className="procedure-muted">
                    Evidence:{" "}
                    {dirty
                      ? "Edits require revalidation"
                      : step.citationReviewState}
                  </p>
                  <fieldset
                    className="procedure-source-bindings"
                    disabled={readonly || action.busy}
                  >
                    <legend>Linked sources</legend>
                    <p className="procedure-muted">
                      Source bindings are revalidated after saving.
                    </p>
                    {version.citations.map((citation) => (
                      <label
                        key={citation.id}
                        className="integration-check procedure-source-choice"
                      >
                        <input
                          type="checkbox"
                          checked={step.citationIds.includes(citation.id)}
                          onChange={(e) =>
                            edit({
                              ...version,
                              steps: version.steps.map((item) =>
                                item.stepId === step.stepId
                                  ? {
                                      ...item,
                                      citationIds: e.target.checked
                                        ? [...item.citationIds, citation.id]
                                        : item.citationIds.filter(
                                            (id) => id !== citation.id,
                                          ),
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                        <span>
                          <strong>{citation.documentTitle}</strong>
                          <small>
                            Revision {citation.revision} · p. {citation.page}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {!readonly && (
                    <div className="integration-toolbar">
                      <Button
                        variant="quiet"
                        disabled={action.busy || !index}
                        icon={<ArrowUp size={15} aria-hidden="true" />}
                        onClick={() => move(index, -1)}
                      >
                        Move up
                      </Button>
                      <Button
                        variant="quiet"
                        disabled={
                          action.busy || index === version.steps.length - 1
                        }
                        icon={<ArrowDown size={15} aria-hidden="true" />}
                        onClick={() => move(index, 1)}
                      >
                        Move down
                      </Button>
                      <Button
                        variant="quiet"
                        icon={<Trash2 size={15} aria-hidden="true" />}
                        className="procedure-remove"
                        disabled={action.busy || version.steps.length <= 1}
                        onClick={() =>
                          edit({
                            ...version,
                            steps: version.steps.filter(
                              (item) => item.stepId !== step.stepId,
                            ),
                          })
                        }
                      >
                        Remove step
                      </Button>
                    </div>
                  )}
                </div>
              </details>
            ))}
            {!readonly && (
              <Button
                variant="secondary"
                disabled={action.busy || version.steps.length >= 100}
                icon={<Plus size={16} aria-hidden="true" />}
                className="procedure-add-step"
                onClick={() => {
                  const id = crypto.randomUUID();
                  setOpenSteps((current) => [...current, id]);
                  edit({
                    ...version,
                    steps: [
                      ...version.steps,
                      {
                        stepId: id,
                        position: version.steps.length + 1,
                        title: "",
                        instructions: "",
                        required: true,
                        citationIds: [],
                        evidenceState: "UNSUPPORTED",
                        citationReviewState: "NEEDS_REVIEW",
                      },
                    ],
                  });
                }}
              >
                Add step
              </Button>
            )}
          </div>
          <aside className="procedure-review-panel">
            <div className="procedure-section-heading">
              <ShieldCheck size={18} aria-hidden="true" />
              <h3>Review analysis</h3>
            </div>
            <p className="procedure-muted">
              Source checks inform review; every level still requires a human
              decision.
            </p>
            <dl>
              {Object.entries(version.reviewAnalysis)
                .filter(
                  ([key]) => !["reasons", "blockingFindings"].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {key
                        .replace(/([A-Z])/g, " $1")
                        .toLowerCase()
                        .replace(/^./, (c) => c.toUpperCase())}
                    </dt>
                    <dd>
                      {Array.isArray(value)
                        ? value.length
                          ? value.join(", ")
                          : "None listed"
                        : String(value).replaceAll("_", " ").toLowerCase()}
                    </dd>
                  </div>
                ))}
            </dl>
            <h3>Blocking findings</h3>
            {!version.reviewAnalysis.blockingFindings?.length && (
              <p className="procedure-muted">No blocking findings listed.</p>
            )}
            {version.reviewAnalysis.blockingFindings?.map((finding, index) => (
              <p className="procedure-blocker" role="status" key={index}>
                {finding}
              </p>
            ))}
            <h3>Reasons to review</h3>
            {(version.reviewAnalysis.reasons ?? []).map((reason) => (
              <label key={reason} className="integration-check">
                <input
                  type="checkbox"
                  disabled={readonly || dirty || action.busy}
                  checked={reasons.includes(reason)}
                  onChange={(e) =>
                    setReasons((current) =>
                      e.target.checked
                        ? [...current, reason]
                        : current.filter((item) => item !== reason),
                    )
                  }
                />
                <span>
                  {/^[A-Z0-9_]+$/.test(reason)
                    ? reason
                        .replaceAll("_", " ")
                        .toLowerCase()
                        .replace(/^./, (character) => character.toUpperCase())
                    : reason}
                </span>
              </label>
            ))}
          </aside>
        </div>
        {action.error && (
          <p
            className="procedure-feedback procedure-feedback-error"
            role="alert"
          >
            {action.error} Refresh only after preserving any unsaved wording.
          </p>
        )}
        {dirty && (
          <p className="procedure-feedback" role="status">
            Unsaved changes. Saving resets review and requires whole-draft
            revalidation.
          </p>
        )}
        {!readonly && (
          <>
            <div className="integration-toolbar procedure-save-bar">
              <Button
                icon={<Save size={16} aria-hidden="true" />}
                disabled={
                  action.busy ||
                  !dirty ||
                  !version.title.trim() ||
                  version.steps.some(
                    (step) =>
                      !step.title.trim() ||
                      !step.instructions.trim() ||
                      !step.citationIds.length,
                  )
                }
                onClick={() =>
                  void action.run(async () => {
                    setVersion(await workflows.saveProcedure(version));
                    setDirty(false);
                  })
                }
              >
                Save draft
              </Button>
              <Button
                variant="secondary"
                disabled={action.busy || dirty}
                onClick={() => transition("revalidate")}
              >
                Revalidate sources
              </Button>
              {version.state === "DRAFT" && (
                <Button
                  variant="secondary"
                  disabled={action.busy || dirty || blocked}
                  onClick={() => transition("review")}
                >
                  Submit for review
                </Button>
              )}
              {["IN_REVIEW", "APPROVED"].includes(version.state) && (
                <Button
                  variant="secondary"
                  disabled={action.busy || dirty}
                  onClick={() => transition("request-changes")}
                >
                  Request changes
                </Button>
              )}
            </div>
            <h3 className="procedure-section-title">
              Owner review and publication
            </h3>
            <label className="integration-check procedure-acknowledgement">
              <input
                type="checkbox"
                checked={human}
                disabled={dirty || action.busy || blocked}
                onChange={(e) => setHuman(e.target.checked)}
              />
              I reviewed this saved definition, its sources, blockers and all
              listed reasons.
            </label>
            <div className="integration-toolbar">
              {version.state === "IN_REVIEW" && (
                <Button
                  disabled={
                    action.busy ||
                    dirty ||
                    blocked ||
                    !human ||
                    (version.reviewAnalysis.reasons ?? []).some(
                      (reason) => !reasons.includes(reason),
                    )
                  }
                  onClick={() => transition("approve")}
                >
                  Owner approve
                </Button>
              )}
              {version.state === "APPROVED" && (
                <Button
                  disabled={action.busy || dirty || blocked}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Publish this approved version as an immutable controlled definition?",
                      )
                    )
                      transition("publish");
                  }}
                >
                  Publish approved version
                </Button>
              )}
            </div>
          </>
        )}
        {owner && version.state === "PUBLISHED" && (
          <Button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const draft = await workflows.forkProcedure(version);
                router.push(
                  `/projects/${draft.projectId}/procedures/${draft.procedureId}/edit?version=${draft.id}`,
                );
              })
            }
          >
            Create editable draft version
          </Button>
        )}
        <Button
          variant="quiet"
          disabled={action.busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved changes and reload?"))
              void refresh();
          }}
        >
          Reload saved definition
        </Button>
      </section>
      <section className="panel integration-panel procedure-evidence">
        <div className="procedure-section-heading">
          <BookOpen size={20} aria-hidden="true" />
          <div>
            <h2>Source evidence</h2>
            <p>Expand a source to read its evidence and open the original.</p>
          </div>
        </div>
        <div className="procedure-evidence-grid">
          {version.citations.map((citation) => (
            <details className="procedure-evidence-card" key={citation.id}>
              <summary>
                <BookOpen size={18} aria-hidden="true" />
                <span className="procedure-evidence-caption">
                  <strong>{citation.documentTitle}</strong>
                  <small>
                    Revision {citation.revision}
                    {citation.page != null ? ` · Page ${citation.page}` : ""}
                  </small>
                </span>
                <RecordState value={citation.approvalState ?? "UNKNOWN"} />
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className="procedure-evidence-content">
                <CitationCard citation={citation} />
              </div>
            </details>
          ))}
        </div>
        {!version.citations.length && (
          <p className="procedure-muted">No source evidence is linked yet.</p>
        )}
      </section>
    </>
  );
}

export function RunWorkspace({
  projectId,
  procedureId,
  runId,
}: {
  projectId: string;
  procedureId: string;
  runId: string;
}) {
  const loader = useCallback(async () => {
    const run = await workflows.getRun(runId);
    if (run.projectId !== projectId || run.procedureId !== procedureId)
      throw new ApiRequestError("RUN_NOT_FOUND", 404);
    return {
      run,
      project: await getProjectRecord(projectId),
      definition: await workflows.getProcedureVersion(
        projectId,
        procedureId,
        run.procedureVersionId,
      ),
      history: await workflows.listRuns(projectId, procedureId),
    };
  }, [projectId, procedureId, runId]);
  const resource = useResource(loader);
  return (
    <AppShell title="Procedure execution run">
      <Link
        className="procedure-back"
        href={`/projects/${projectId}/procedures`}
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to procedures
      </Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <div className="procedure-page">
          <RunEditor
            key={`${resource.data.run.id}:${resource.data.run.revision}`}
            {...resource.data}
            owner={resource.data.project.role === "OWNER"}
            refresh={resource.refresh}
          />
        </div>
      )}
    </AppShell>
  );
}
function RunEditor({
  run: initial,
  definition,
  history,
  owner,
  refresh,
}: {
  run: Run;
  definition: ProcedureVersion;
  history: Run[];
  owner: boolean;
  refresh: () => Promise<void>;
}) {
  const [run, setRun] = useState(initial);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const action = useAction();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const mutable =
    owner &&
    run.state === "OPEN" &&
    now >= Date.parse(run.periodStart) &&
    now < Date.parse(run.periodEnd);
  const complete = run.steps.every((step) => !step.required || step.checked);
  return (
    <>
      <section className="panel integration-panel procedure-run">
        <div className="procedure-section-heading">
          <span className="procedure-icon">
            <ClipboardList size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="procedure-eyebrow">Execution run</p>
            <h2>{definition.title}</h2>
          </div>
        </div>
        <RecordState value={run.state} />
        {run.state === "OPEN" && now >= Date.parse(run.periodEnd) && (
          <RecordState value="OVERDUE" />
        )}
        <p>
          Published definition v{definition.versionNumber} · run revision{" "}
          {run.revision}
        </p>
        <p>
          {new Date(run.periodStart).toLocaleString()} –{" "}
          {new Date(run.periodEnd).toLocaleString()} · {run.timezone}
        </p>
        <p>
          Checks record work performed in this run only. A new period starts
          unchecked.
        </p>
        <Link
          href={`/projects/${run.projectId}/procedures/${run.procedureId}/edit?version=${run.procedureVersionId}`}
        >
          Open recorded definition
        </Link>
        <div className="procedure-run-progress">
          <div>
            <strong>
              {run.steps.filter((step) => step.checked).length} of{" "}
              {run.steps.length} checks recorded
            </strong>
            <span>
              {
                run.steps.filter((step) => step.required && !step.checked)
                  .length
              }{" "}
              required checks remaining
            </span>
          </div>
          <progress
            aria-label="Recorded step completion"
            max={run.steps.length || 1}
            value={run.steps.filter((step) => step.checked).length}
          />
        </div>
        {run.steps.map((step, index) => {
          const wording = definition.steps.find(
            (item) => item.stepId === step.stepId,
          );
          return (
            <article
              key={step.stepId}
              className={`integration-record procedure-run-step ${step.checked ? "procedure-run-step-complete" : ""}`}
            >
              <div className="procedure-run-step-heading">
                <span className="procedure-step-number">{index + 1}</span>
                <h3>{wording?.title ?? step.stepId}</h3>
              </div>
              <p className="integration-prewrap procedure-run-instructions">
                {wording?.instructions}
              </p>
              <label className="integration-check">
                <input
                  type="checkbox"
                  checked={step.checked}
                  disabled={!mutable || action.busy}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    void action.run(async () =>
                      setRun(
                        await workflows.changeStep(
                          run,
                          step.stepId,
                          checked,
                          notes[step.stepId] ?? step.note,
                        ),
                      ),
                    );
                  }}
                />
                Completed{step.required ? " (required)" : ""}
              </label>
              <p>
                {step.actorId
                  ? `Recorded by ${step.actorId}, ${step.updatedAt ? new Date(step.updatedAt).toLocaleString() : ""}`
                  : "Not yet recorded"}
              </p>
              {step.exception && (
                <p role="status">Recorded exception: {step.exception}</p>
              )}
              <Field label="Run step note">
                <textarea
                  maxLength={2000}
                  disabled={!mutable || action.busy}
                  value={notes[step.stepId] ?? step.note}
                  onChange={(e) =>
                    setNotes((current) => ({
                      ...current,
                      [step.stepId]: e.target.value,
                    }))
                  }
                />
              </Field>
              <Button
                variant="secondary"
                disabled={
                  !mutable ||
                  action.busy ||
                  notes[step.stepId] === undefined ||
                  notes[step.stepId] === step.note
                }
                onClick={() =>
                  void action.run(async () => {
                    setRun(
                      await workflows.changeStep(
                        run,
                        step.stepId,
                        step.checked,
                        notes[step.stepId],
                      ),
                    );
                    setNotes((current) => {
                      const next = { ...current };
                      delete next[step.stepId];
                      return next;
                    });
                  })
                }
              >
                Save note
              </Button>
              {wording?.citationIds.map((id) => {
                const citation = definition.citations.find(
                  (item) => item.id === id,
                );
                return citation ? (
                  <CitationCard key={id} citation={citation} />
                ) : null;
              })}
            </article>
          );
        })}
        {action.error && <p role="alert">{action.error}</p>}
        {!mutable && (
          <p>
            This run is read-only because of your access, its completion state
            or its period.
          </p>
        )}
        <Button
          disabled={
            !mutable ||
            action.busy ||
            !complete ||
            Object.entries(notes).some(
              ([id, note]) =>
                run.steps.find((step) => step.stepId === id)?.note !== note,
            )
          }
          onClick={() => {
            if (
              window.confirm(
                "Complete this run? All required work must actually have been performed. Completed runs are immutable.",
              )
            )
              void action.run(async () =>
                setRun(await workflows.completeRun(run)),
              );
          }}
        >
          Complete run
        </Button>
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={() => {
            if (
              !Object.entries(notes).some(
                ([id, note]) =>
                  run.steps.find((step) => step.stepId === id)?.note !== note,
              ) ||
              window.confirm("Discard unsaved notes and refresh?")
            )
              void refresh();
          }}
        >
          Refresh saved run
        </Button>
      </section>
      <section className="panel integration-panel procedure-run-history">
        <div className="procedure-section-heading">
          <CalendarDays size={20} aria-hidden="true" />
          <h2>Retained run history</h2>
        </div>
        {history.map((item) => (
          <div className="procedure-history-row" key={item.id}>
            <Link
              href={`/projects/${item.projectId}/procedures/${item.procedureId}/runs/${item.id}`}
            >
              {new Date(item.periodStart).toLocaleString()}
            </Link>{" "}
            <RecordState value={item.state} />
          </div>
        ))}
      </section>
    </>
  );
}
