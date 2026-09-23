"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button, Field, Tabs } from "@/components/ui";
import {
  LoadState,
  RecordState,
  useAction,
  useResource,
} from "@/components/backend-state";
import { UploadForm } from "@/components/document-workspace";
import * as resources from "@/lib/api/resources";
import type {
  EquipmentRecord,
  ProjectRecord,
  Entity,
} from "@/lib/api/contracts";
import type { EntityKind } from "@/lib/api/resources";

export function EntityDirectory({ kind }: { kind: EntityKind }) {
  const loader = useCallback(async () => {
    const owned =
      kind === "projects"
        ? await resources.getProjectRecords()
        : await resources.getEquipmentRecords();
    const discovered = await resources.discover(kind);
    return { owned, discovered };
  }, [kind]);
  const resource = useResource(loader);
  const action = useAction();
  const [search, setSearch] = useState("");
  const [inbox, setInbox] = useState(false);
  const title = kind === "projects" ? "Projects" : "Equipments";
  const filtered = (name: string) =>
    name.toLowerCase().includes(search.toLowerCase());
  return (
    <AppShell title={title}>
      <div className="integration-toolbar">
        <Field label={`Search ${title.toLowerCase()}`}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Link className="button button-primary" href={`/${kind}/new`}>
          Create {kind === "projects" ? "project" : "equipment"}
        </Link>
        <Button variant="secondary" onClick={() => setInbox(!inbox)}>
          Owner request inbox
        </Button>
        <Button variant="secondary" onClick={() => void resource.refresh()}>
          Refresh
        </Button>
      </div>
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      {resource.data && (
        <>
          <section className="panel integration-panel">
            <h2>Your {title.toLowerCase()}</h2>
            <div className="integration-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>
                      {kind === "projects" ? "Status" : "Type / location"}
                    </th>
                    <th>Your access</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.owned
                    .filter((item) => filtered(item.name))
                    .map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link href={`/${kind}/${item.id}`}>{item.name}</Link>
                          <p>{item.description}</p>
                        </td>
                        <td>
                          {"role" in item ? (
                            <RecordState value={item.status} />
                          ) : (
                            <>
                              {item.type} · {item.location}
                              <br />
                              <RecordState value={item.operationalState} />
                            </>
                          )}
                        </td>
                        <td>{"role" in item ? item.role : item.accessLevel}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!resource.data.owned.length && (
              <p>No accessible {title.toLowerCase()} yet.</p>
            )}
          </section>
          {inbox &&
            resource.data.owned
              .filter(
                (item) =>
                  ("role" in item ? item.role : item.accessLevel) === "OWNER",
              )
              .map((item) => (
                <AccessInbox
                  key={item.id}
                  kind={kind}
                  entityId={item.id}
                  title={item.name}
                />
              ))}
          <section className="panel integration-panel">
            <h2>Discover and request access</h2>
            <p>
              These summaries do not grant access. Requests use your signed-in
              identity.
            </p>
            {!resource.data.discovered.length && (
              <p>No other discoverable {title.toLowerCase()}.</p>
            )}
            {resource.data.discovered
              .filter((item) => filtered(item.name))
              .map((item) => (
                <div
                  className="integration-record integration-toolbar"
                  key={item.id}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.type ?? item.status} {item.location}
                  </span>
                  <RecordState value={item.accessRequestStatus} />
                  <Button
                    disabled={
                      action.busy || item.accessRequestStatus === "PENDING"
                    }
                    onClick={() =>
                      void action.run(async () => {
                        await resources.requestAccess(kind, item.id);
                        await resource.refresh();
                      })
                    }
                  >
                    {item.accessRequestStatus === "PENDING"
                      ? "Request pending"
                      : kind === "projects"
                        ? "Ask to join"
                        : "Request manage access"}
                  </Button>
                </div>
              ))}
          </section>
        </>
      )}
    </AppShell>
  );
}

function AccessInbox({
  kind,
  entityId,
  title,
}: {
  kind: EntityKind;
  entityId: string;
  title: string;
}) {
  const loader = useCallback(
    () => resources.getAccessRequests(kind, entityId),
    [kind, entityId],
  );
  const resource = useResource(loader);
  const action = useAction();
  return (
    <section className="panel integration-panel">
      <h2>{title}: access requests</h2>
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      {resource.data && !resource.data.length && <p>No requests.</p>}
      {resource.data?.map((request) => (
        <div key={request.id} className="integration-record">
          <p>
            Requester {request.requesterId} ·{" "}
            {new Date(request.createdAt).toLocaleString()}
          </p>
          <RecordState value={request.status} />
          {request.status === "PENDING" && (
            <div className="integration-toolbar">
              {(["APPROVE", "REJECT"] as const).map((decision) => (
                <Button
                  key={decision}
                  variant="secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await resources.decideAccess(
                        kind,
                        entityId,
                        request.id,
                        decision,
                      );
                      await resource.refresh();
                    })
                  }
                >
                  {decision === "APPROVE"
                    ? "Approve request"
                    : "Reject request"}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function EntityCreate({ kind }: { kind: EntityKind }) {
  const [created, setCreated] = useState<string | null>(null);
  const [mode, setMode] = useState<"ADD_NOW" | "SKIP_FOR_NOW">("SKIP_FOR_NOW");
  const [uploaded, setUploaded] = useState<string[]>([]);
  return (
    <AppShell title={`Create ${kind === "projects" ? "project" : "equipment"}`}>
      {!created ? (
        <EntityDetailsForm
          kind={kind}
          mode={mode}
          setMode={setMode}
          onCreated={setCreated}
        />
      ) : (
        <section className="panel integration-panel">
          <h2>{kind === "projects" ? "Project" : "Equipment"} created</h2>
          {kind === "projects" && (
            <p>
              Procedure generation waits for an approved, indexed direct Project
              source.
            </p>
          )}
          {mode === "ADD_NOW" && (
            <UploadForm
              key={uploaded.length}
              entity={{
                type: kind === "projects" ? "PROJECT" : "EQUIPMENT",
                id: created,
              }}
              onComplete={(id) => setUploaded((current) => [...current, id])}
            />
          )}
          {uploaded.map((id) => (
            <p key={id}>
              <Link href={`/documents/${id}`}>Review uploaded source</Link>
            </p>
          ))}
          <Link className="button button-primary" href={`/${kind}/${created}`}>
            {mode === "ADD_NOW" && !uploaded.length
              ? "Skip for now and open workspace"
              : "Open workspace"}
          </Link>
        </section>
      )}
    </AppShell>
  );
}

function EntityDetailsForm({
  kind,
  record,
  mode = "SKIP_FOR_NOW",
  setMode,
  onCreated,
  onSaved,
}: {
  kind: EntityKind;
  record?: EquipmentRecord | ProjectRecord;
  mode?: "ADD_NOW" | "SKIP_FOR_NOW";
  setMode?: (mode: "ADD_NOW" | "SKIP_FOR_NOW") => void;
  onCreated?: (id: string) => void;
  onSaved?: () => Promise<void>;
}) {
  const [name, setName] = useState(record?.name ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const equipment = record && "accessLevel" in record ? record : undefined;
  const project = record && "role" in record ? record : undefined;
  const [type, setType] = useState(equipment?.type ?? "");
  const [location, setLocation] = useState(equipment?.location ?? "");
  const [model, setModel] = useState(equipment?.model ?? "");
  const [operationalState, setOperationalState] = useState<
    EquipmentRecord["operationalState"]
  >(equipment?.operationalState ?? "UNKNOWN");
  const [status, setStatus] = useState<ProjectRecord["status"]>(
    project?.status ?? "PLANNING",
  );
  const [included, setIncluded] = useState<string[]>(
    project?.includedEquipmentIds ?? [],
  );
  const selectable = useResource(
    useCallback(
      () =>
        kind === "projects"
          ? resources.getEquipmentRecords()
          : Promise.resolve([]),
      [kind],
    ),
  );
  const action = useAction();
  async function submit(event: FormEvent) {
    event.preventDefault();
    await action.run(async () => {
      const payload =
        kind === "projects"
          ? {
              name,
              description,
              status,
              ...(JSON.stringify(included) !==
              JSON.stringify(project?.includedEquipmentIds)
                ? { includedEquipmentIds: included }
                : {}),
            }
          : {
              name,
              type,
              location,
              model: model || null,
              description: description || null,
              operationalState,
            };
      if (record) {
        await resources.updateEntity(kind, record.id, payload);
        await onSaved?.();
      } else if (kind === "projects")
        onCreated?.(
          (
            await resources.createProjectRecord({
              name,
              description,
              status,
              includedEquipmentIds: included,
              documentsMode: mode,
            })
          ).id,
        );
      else
        onCreated?.(
          (
            await resources.createEquipmentRecord({
              name,
              type,
              location,
              model: model || null,
              description: description || null,
              documentsMode: mode,
            })
          ).id,
        );
    });
  }
  return (
    <form
      className="panel integration-panel integration-form"
      onSubmit={submit}
    >
      <h2>{record ? "Edit details" : "Details"}</h2>
      <fieldset disabled={action.busy}>
        <Field label="Name" required>
          <input
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Description"
          required={kind === "projects"}
          hint={
            kind === "projects"
              ? "Describe purpose and scope in 10–1,000 characters."
              : "Optional. Recommended for better AI routing."
          }
        >
          <textarea
            required={kind === "projects"}
            minLength={kind === "projects" ? 10 : undefined}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {kind === "equipments" ? (
          <>
            <div className="form-grid">
              <Field label="Type" required>
                <input
                  required
                  maxLength={120}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                />
              </Field>
              <Field label="Location" required>
                <input
                  required
                  maxLength={120}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </Field>
              <Field label="Model (optional)">
                <input
                  maxLength={120}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </Field>
              {record && (
                <Field label="Operational state">
                  <select
                    value={operationalState}
                    onChange={(e) =>
                      setOperationalState(
                        e.target.value as typeof operationalState,
                      )
                    }
                  >
                    {[
                      "UNKNOWN",
                      "OPERATING",
                      "MAINTENANCE",
                      "OUT_OF_SERVICE",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <p>Serial number and manufacturer fields are not supported yet.</p>
          </>
        ) : (
          <>
            <Field label="Project status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <h3>Included Equipments</h3>
            <LoadState {...selectable} retry={selectable.refresh} />
            {selectable.data?.map((item) => (
              <label key={item.id} className="integration-check">
                <input
                  type="checkbox"
                  checked={included.includes(item.id)}
                  onChange={(e) =>
                    setIncluded((ids) =>
                      e.target.checked
                        ? [...ids, item.id]
                        : ids.filter((id) => id !== item.id),
                    )
                  }
                />
                {item.name} · {item.location}
              </label>
            ))}
            {included
              .filter((id) => !selectable.data?.some((item) => item.id === id))
              .map((id) => (
                <p key={id}>
                  Included Equipment {id} (manage access unavailable).{" "}
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() =>
                      setIncluded((ids) => ids.filter((item) => item !== id))
                    }
                  >
                    Remove inclusion
                  </Button>
                </p>
              ))}
            <p>
              Sources remain on their Equipments and are inherited by reference.
            </p>
          </>
        )}
        {setMode && (
          <fieldset>
            <legend>Documents</legend>
            <label>
              <input
                type="radio"
                name="documentsMode"
                checked={mode === "ADD_NOW"}
                onChange={() => setMode("ADD_NOW")}
              />
              Add documents now
            </label>
            <label>
              <input
                type="radio"
                name="documentsMode"
                checked={mode === "SKIP_FOR_NOW"}
                onChange={() => setMode("SKIP_FOR_NOW")}
              />
              Skip for now
            </label>
          </fieldset>
        )}
      </fieldset>
      {action.error && <p role="alert">{action.error}</p>}
      <Button
        type="submit"
        disabled={
          action.busy ||
          (kind === "projects" && (selectable.loading || !!selectable.error))
        }
      >
        {action.busy
          ? "Saving…"
          : record
            ? "Save details"
            : "Create and continue"}
      </Button>
    </form>
  );
}

export function EntityWorkspace({
  kind,
  entityId,
}: {
  kind: EntityKind;
  entityId: string;
}) {
  const loader = useCallback(
    () =>
      kind === "projects"
        ? resources.getProjectRecord(entityId)
        : resources.getEquipmentRecord(entityId),
    [kind, entityId],
  );
  const resource = useResource<EquipmentRecord | ProjectRecord>(loader);
  const [tab, setTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const action = useAction();
  const record = resource.data;
  const entity: Entity = {
    type: kind === "projects" ? "PROJECT" : "EQUIPMENT",
    id: entityId,
  };
  const profile = useResource(
    useCallback(
      () =>
        resources.getProfile({
          type: kind === "projects" ? "PROJECT" : "EQUIPMENT",
          id: entityId,
        }),
      [kind, entityId],
    ),
    15000,
  );
  const related = useResource(
    useCallback(
      () =>
        kind === "equipments"
          ? resources.getProjectRecords()
          : Promise.resolve([]),
      [kind],
    ),
  );
  const owner =
    record && ("role" in record ? record.role : record.accessLevel) === "OWNER";
  const writable = record && (kind === "equipments" || owner);
  const tabs =
    kind === "projects"
      ? [
          "Overview",
          "Equipments",
          "Documents",
          "Maintenance logs",
          "Procedures",
          "Members",
          "Activity",
        ]
      : ["Overview", "Documents", "Projects", "Access", "Activity"];
  return (
    <AppShell
      title={record?.name ?? (kind === "projects" ? "Project" : "Equipment")}
    >
      <Tabs
        label="Workspace sections"
        items={tabs.map((label) => ({
          id: label,
          label,
          active: tab === label,
          onSelect: () => {
            const path =
              label === "Documents"
                ? "documents"
                : label === "Maintenance logs"
                  ? "maintenance-logs"
                  : label === "Procedures"
                    ? "procedures"
                    : null;
            if (path) router.push(`/${kind}/${entityId}/${path}`);
            else setTab(label);
          },
        }))}
      />
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      {record && (
        <>
          {tab === "Overview" && (
            <>
              <div className="integration-columns">
                <section className="panel integration-panel">
                  <h2>Description</h2>
                  <p>{record.description || "No description provided."}</p>
                  {writable && (
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(!editing)}
                    >
                      {editing ? "Cancel editing" : "Edit details"}
                    </Button>
                  )}
                </section>
                <section className="panel integration-panel">
                  <h2>Details</h2>
                  {"role" in record ? (
                    <>
                      <RecordState value={record.status} />
                      <p>Your role: {record.role}</p>
                      <p>
                        {record.includedEquipmentIds.length} included Equipments
                      </p>
                      <p>
                        Procedure generation: {record.procedureGenerationStatus}
                      </p>
                    </>
                  ) : (
                    <>
                      <RecordState value={record.operationalState} />
                      <p>
                        {record.type} · {record.location}
                      </p>
                      <p>Model: {record.model || "Not set"}</p>
                      <p>Your access: {record.accessLevel}</p>
                    </>
                  )}
                  <p>Updated {new Date(record.updatedAt).toLocaleString()}</p>
                </section>
              </div>
              {editing && (
                <EntityDetailsForm
                  key={record.updatedAt}
                  kind={kind}
                  record={record}
                  onSaved={async () => {
                    setEditing(false);
                    await resource.refresh();
                  }}
                />
              )}
              <section className="panel integration-panel">
                <h2>Retrieval profile</h2>
                <LoadState {...profile} retry={profile.refresh} />
                {profile.data && (
                  <>
                    <RecordState value={profile.data.state} />
                    <p>
                      {profile.data.result?.generatedDescription ??
                        "No generated profile yet."}
                    </p>
                  </>
                )}
                <p>
                  Routing context only; it is not source evidence. Changes
                  refresh this profile through the worker.
                </p>
                <Link href={`/${kind}/${entity.id}/documents`}>
                  Manage documents
                </Link>
              </section>
              {owner && (
                <Button
                  variant="danger"
                  disabled={action.busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this entity? The server will refuse deletion if retained links or workflow history require it.",
                      )
                    )
                      void action.run(async () => {
                        await resources.deleteEntity(kind, entityId);
                        router.push(`/${kind}`);
                      });
                  }}
                >
                  Delete {kind === "projects" ? "project" : "equipment"}
                </Button>
              )}
            </>
          )}
          {tab === "Equipments" && "role" in record && (
            <section className="panel integration-panel">
              <h2>Included Equipments</h2>
              {record.includedEquipmentIds.map((id) => (
                <p key={id}>
                  Equipment {id} ·{" "}
                  <Link href={`/equipments/${id}/documents`}>
                    Included sources
                  </Link>
                </p>
              ))}
              {!record.includedEquipmentIds.length && (
                <p>No Equipments included.</p>
              )}
              {owner && (
                <Button
                  onClick={() => {
                    setTab("Overview");
                    setEditing(true);
                  }}
                >
                  Edit Equipment inclusion
                </Button>
              )}
              <p>
                Opening an Equipment management workspace requires its separate
                owner/manage access.
              </p>
            </section>
          )}
          {tab === "Projects" && (
            <section className="panel integration-panel">
              <h2>Accessible Projects including this Equipment</h2>
              <LoadState {...related} retry={related.refresh} />
              {related.data
                ?.filter((project) =>
                  project.includedEquipmentIds.includes(entityId),
                )
                .map((project) => (
                  <p key={project.id}>
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  </p>
                ))}
            </section>
          )}
          {(tab === "Members" || tab === "Access") && (
            <>
              {owner && (
                <AccessInbox
                  kind={kind}
                  entityId={entityId}
                  title={record.name}
                />
              )}
              <section className="panel integration-panel">
                <h2>{tab}</h2>
                <p>
                  A complete member/manager directory is not exposed by the
                  current backend. Access requests and owner decisions above are
                  live.
                </p>
                {owner && <RevokeForm kind={kind} entityId={entityId} />}
              </section>
            </>
          )}
          {tab === "Activity" && (
            <section className="panel integration-panel">
              <h2>Activity</h2>
              <p>
                Actions are audited on the server. A user-facing audit timeline
                endpoint has not been implemented yet.
              </p>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
function RevokeForm({
  kind,
  entityId,
}: {
  kind: EntityKind;
  entityId: string;
}) {
  const [userId, setUserId] = useState("");
  const action = useAction();
  return (
    <form
      className="integration-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (window.confirm("Revoke this user's access?"))
          void action.run(async () => {
            await resources.revokeAccess(kind, entityId, userId);
            setUserId("");
          });
      }}
    >
      <Field
        label="User ID to revoke"
        hint="Use the exact requester ID from an approved access request."
      >
        <input
          required
          pattern="[a-f0-9]{24}"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={action.busy || !userId} variant="danger">
        Revoke access
      </Button>
      {action.error && <p role="alert">{action.error}</p>}
    </form>
  );
}
