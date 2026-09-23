"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Field } from "@/components/ui";
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
      <Link href={`/projects/${projectId}`}>Back to Project</Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <>
          <section className="panel integration-panel">
            <h2>Source-bounded generation</h2>
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
                and keep the worker running.
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
    <section className="panel integration-panel">
      <h2>{procedure.title}</h2>
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      <h3>Definitions and history</h3>
      {resource.data?.versions.map((version) => (
        <p key={version.id}>
          <Link
            href={`/projects/${procedure.projectId}/procedures/${procedure.id}/edit?version=${version.id}`}
          >
            Version {version.versionNumber}: {version.title}
          </Link>{" "}
          · <RecordState value={version.state} />
        </p>
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
      <h3>Runs</h3>
      {resource.data?.runs.map((run) => (
        <p key={run.id}>
          <Link
            href={`/projects/${procedure.projectId}/procedures/${procedure.id}/runs/${run.id}`}
          >
            {new Date(run.periodStart).toLocaleString()} –{" "}
            {new Date(run.periodEnd).toLocaleString()}
          </Link>{" "}
          · {run.state}
        </p>
      ))}
      {!resource.data?.runs.length && <p>No runs yet.</p>}
      {procedure.schedule ? (
        <>
          <p>
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
      className="integration-form"
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
      <h3>Set recurrence</h3>
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
      <Link href={`/projects/${projectId}/procedures`}>
        Back to procedures and history
      </Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
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
      <section className="panel integration-panel">
        <div className="integration-toolbar">
          <h2>{version.title}</h2>
          <RecordState value={version.state} />
          <RecordState
            value={`${version.reviewAnalysis.reviewNeed}_REVIEW_NEEDED`}
          />
        </div>
        <p>
          Version {version.versionNumber} · revision {version.revision}. Human
          review is required at every review-need level.
        </p>
        <div className="integration-columns">
          <div className="integration-form">
            <Field label="Procedure title">
              <input
                maxLength={300}
                value={version.title}
                disabled={readonly || action.busy}
                onChange={(e) => edit({ ...version, title: e.target.value })}
              />
            </Field>
            {version.steps.map((step, index) => (
              <article
                className="integration-record integration-form"
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
                <h3>Step {index + 1}</h3>
                {!readonly && (
                  <Button
                    variant="quiet"
                    draggable={!action.busy}
                    disabled={action.busy}
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/plain", step.stepId)
                    }
                    aria-label={`Drag step ${index + 1}; alternatively use Move up or Move down`}
                  >
                    Drag to reorder
                  </Button>
                )}
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
                <label>
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
                <p>
                  Evidence:{" "}
                  {dirty
                    ? "Edits require revalidation"
                    : step.citationReviewState}
                </p>
                <fieldset disabled={readonly || action.busy}>
                  <legend>Source bindings (revalidated after saving)</legend>
                  {version.citations.map((citation) => (
                    <label key={citation.id} className="integration-check">
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
                      {citation.documentTitle} · p. {citation.page} ·{" "}
                      {citation.id}
                    </label>
                  ))}
                </fieldset>
                {!readonly && (
                  <div className="integration-toolbar">
                    <Button
                      variant="quiet"
                      disabled={action.busy || !index}
                      onClick={() => move(index, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={
                        action.busy || index === version.steps.length - 1
                      }
                      onClick={() => move(index, 1)}
                    >
                      Move down
                    </Button>
                    <Button
                      variant="quiet"
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
              </article>
            ))}
            {!readonly && (
              <Button
                variant="secondary"
                disabled={action.busy || version.steps.length >= 100}
                onClick={() =>
                  edit({
                    ...version,
                    steps: [
                      ...version.steps,
                      {
                        stepId: crypto.randomUUID(),
                        position: version.steps.length + 1,
                        title: "",
                        instructions: "",
                        required: true,
                        citationIds: [],
                        evidenceState: "UNSUPPORTED",
                        citationReviewState: "NEEDS_REVIEW",
                      },
                    ],
                  })
                }
              >
                Add step
              </Button>
            )}
          </div>
          <aside>
            <h3>Review analysis</h3>
            <dl>
              {Object.entries(version.reviewAnalysis)
                .filter(
                  ([key]) => !["reasons", "blockingFindings"].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
            <h3>Blocking findings</h3>
            {version.reviewAnalysis.blockingFindings?.map((finding, index) => (
              <p role="status" key={index}>
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
                {reason}
              </label>
            ))}
          </aside>
        </div>
        {action.error && (
          <p role="alert">
            {action.error} Refresh only after preserving any unsaved wording.
          </p>
        )}
        {dirty && (
          <p role="status">
            Unsaved changes. Saving resets review and requires whole-draft
            revalidation.
          </p>
        )}
        {!readonly && (
          <>
            <div className="integration-toolbar">
              <Button
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
            <label className="integration-check">
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
      <section className="panel integration-panel">
        <h2>Source evidence</h2>
        {version.citations.map((citation) => (
          <CitationCard key={citation.id} citation={citation} />
        ))}
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
      <Link href={`/projects/${projectId}/procedures`}>Back to procedures</Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <RunEditor
          key={`${resource.data.run.id}:${resource.data.run.revision}`}
          {...resource.data}
          owner={resource.data.project.role === "OWNER"}
          refresh={resource.refresh}
        />
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
      <section className="panel integration-panel">
        <h2>{definition.title}</h2>
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
        {run.steps.map((step) => {
          const wording = definition.steps.find(
            (item) => item.stepId === step.stepId,
          );
          return (
            <article key={step.stepId} className="integration-record">
              <h3>{wording?.title ?? step.stepId}</h3>
              <p>{wording?.instructions}</p>
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
      <section className="panel integration-panel">
        <h2>Retained run history</h2>
        {history.map((item) => (
          <p key={item.id}>
            <Link
              href={`/projects/${item.projectId}/procedures/${item.procedureId}/runs/${item.id}`}
            >
              {new Date(item.periodStart).toLocaleString()}
            </Link>{" "}
            · {item.state}
          </p>
        ))}
      </section>
    </>
  );
}
