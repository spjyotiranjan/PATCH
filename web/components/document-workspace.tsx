"use client";
import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { Button, Drawer, Field } from "@/components/ui";
import {
  LoadState,
  RecordState,
  useAction,
  useResource,
  useSourceAccess,
} from "@/components/backend-state";
import { ProcessingStepBar } from "@/components/documents";
import * as docs from "@/lib/api/document-workflow";
import { getEquipmentRecord, getProjectRecord } from "@/lib/api/resources";
import { ApiRequestError } from "@/lib/api/http";
import type { DocumentRecord, Entity, Version } from "@/lib/api/contracts";

async function canManage(entity: Entity, userId: string) {
  if (entity.type === "PERSONAL") return entity.id === userId;
  try {
    return entity.type === "EQUIPMENT"
      ? Boolean(await getEquipmentRecord(entity.id))
      : (await getProjectRecord(entity.id)).role === "OWNER";
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    )
      return false;
    throw error;
  }
}

export function UploadForm({
  entity,
  documents = [],
  versionMode = false,
  onComplete,
}: {
  entity: Entity;
  documents?: DocumentRecord[];
  versionMode?: boolean;
  onComplete: (versionId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<
    (typeof docs.documentTypes)[number]
  >(entity.type === "PROJECT" ? "PROJECT_DOCUMENT" : "MANUAL");
  const [documentId, setDocumentId] = useState("");
  const { data: session } = useSession();
  const selected = documents.find((doc) => doc.id === documentId);
  const selectedOriginType = selected?.origin.type;
  const selectedOriginId = selected?.origin.id;
  const activeId = selected?.activeVersionId;
  const currentVersion = useResource(
    useCallback(
      () => (activeId ? docs.getVersion(activeId) : Promise.resolve(null)),
      [activeId],
    ),
  );
  const permission = useResource(
    useCallback(
      () =>
        selectedOriginType && selectedOriginId
          ? canManage(
              { type: selectedOriginType, id: selectedOriginId },
              session?.user?.id ?? "",
            )
          : Promise.resolve(false),
      [selectedOriginType, selectedOriginId, session?.user?.id],
    ),
  );
  const [file, setFile] = useState<File | null>(null);
  const [interrupted, setInterrupted] = useState<docs.UploadInterrupted | null>(
    null,
  );
  const action = useAction();
  async function submit(event: FormEvent) {
    event.preventDefault();
    await action.run(async () => {
      if (!file) throw new ApiRequestError("FILE_REQUIRED");
      try {
        const result = interrupted
          ? interrupted.bytesUploaded
            ? (await docs.completeUpload(interrupted.session.documentVersionId),
              interrupted.session)
            : await docs.transferUpload(interrupted.session, file)
          : await docs.uploadDocument(file, {
              title,
              documentType,
              entity,
              ...(versionMode ? { documentId } : {}),
            });
        onComplete(result.documentVersionId);
      } catch (error) {
        if (error instanceof docs.UploadInterrupted) setInterrupted(error);
        throw error;
      }
    });
  }
  return (
    <form className="integration-form" onSubmit={submit}>
      <p>
        Original files are immutable. Extraction is queued after upload; review
        and approval happen separately.
      </p>
      <fieldset disabled={action.busy || !!interrupted}>
        {versionMode ? (
          <Field label="Logical document" required>
            <select
              required
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            >
              <option value="">Select a document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Document title" required>
              <input
                required
                maxLength={500}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Document type">
              <select
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value as typeof documentType)
                }
              >
                {docs.documentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field
          label="Original file"
          required
          hint="PDF, TXT, Markdown or DOCX; up to 50 MiB."
        >
          <input
            required
            type="file"
            accept=".pdf,.txt,.md,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </fieldset>
      {versionMode && selected && (
        <>
          <LoadState {...permission} retry={permission.refresh} />
          <LoadState {...currentVersion} retry={currentVersion.refresh} />
          <p>
            {currentVersion.data ? (
              <>
                Current revision{" "}
                {currentVersion.data.reviewedMetadata?.revision ??
                  currentVersion.data.versionNumber}
                .{" "}
                <Link href={`/documents/${currentVersion.data.id}`}>
                  Open active original
                </Link>
                . It remains current until the replacement is indexed and
                activated.
              </>
            ) : (
              "This logical document has no active version yet."
            )}
          </p>
          {!permission.loading && !permission.data && (
            <p>
              You need mutation access to the document origin to add a
              version.
            </p>
          )}
        </>
      )}
      {action.error && <p role="alert">{action.error}</p>}
      {interrupted && (
        <p>
          Upload session retained. Retry resumes this version.{" "}
          <Link href={`/documents/${interrupted.session.documentVersionId}`}>
            Inspect saved state
          </Link>
          .
        </p>
      )}
      <Button
        disabled={
          action.busy ||
          !file ||
          (versionMode &&
            (!documentId || !permission.data || permission.loading))
        }
        type="submit"
      >
        {action.busy
          ? "Uploading…"
          : interrupted
            ? "Resume upload"
            : "Upload original"}
      </Button>
    </form>
  );
}

export function DocumentsWorkspace({
  entity,
  processingOnly = false,
}: {
  entity?: Entity;
  processingOnly?: boolean;
}) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const type = entity?.type,
    key = entity?.id;
  const loader = useCallback(async () => {
    const target = type && key ? ({ type, id: key } as Entity) : undefined;
    const data = target
      ? await docs.getEntityDocuments(target)
      : { items: await docs.getLibrary(), links: [] };
    return { ...data, writable: !target || (await canManage(target, userId)) };
  }, [type, key, userId]);
  const resource = useResource(loader, 15000);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState<"new" | "version" | null>(null);
  const [linkId, setLinkId] = useState("");
  const [showLink, setShowLink] = useState(false);
  const action = useAction();
  const router = useRouter();
  const matches =
    resource.data?.items.filter((doc) =>
      doc.title.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const pageSize = 10;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(matches.length / pageSize) - 1),
  );
  const target = entity ?? { type: "PERSONAL", id: userId };
  const available = useResource(
    useCallback(
      () => (showLink ? docs.getLibrary() : Promise.resolve([])),
      [showLink],
    ),
  );
  return (
    <AppShell
      title={
        processingOnly
          ? "Document processing"
          : entity
            ? "Manage documents"
            : "Documents"
      }
    >
      {entity && (
        <Link
          href={`/${entity.type === "PROJECT" ? "projects" : "equipments"}/${entity.id}`}
        >
          Back to {entity.type.toLowerCase()}
        </Link>
      )}
      <div className="integration-toolbar">
        <Field label="Search documents">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by title"
          />
        </Field>
        {resource.data?.writable && (
          <>
            <Button onClick={() => setDrawer("new")}>Add new document</Button>
            <Button variant="secondary" onClick={() => setDrawer("version")}>
              Add new version
            </Button>
            {entity && (
              <Button
                variant="secondary"
                onClick={() => setShowLink(!showLink)}
              >
                Link existing document
              </Button>
            )}
          </>
        )}
        <Button variant="secondary" onClick={() => void resource.refresh()}>
          Refresh
        </Button>
      </div>
      <p>
        Logical documents are stored once. Active versions propagate through
        their links. An older active version remains available while a new
        version is processing.
      </p>
      {entity?.type === "PROJECT" && (
        <p>
          From Equipment sources are inherited. Manage those links from their
          Equipment.
        </p>
      )}
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      {showLink && (
        <section className="panel integration-panel">
          <LoadState {...available} retry={available.refresh} />
          <Field label="Existing accessible document">
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">Select document</option>
              {available.data?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </Field>
          <Button
            disabled={!linkId || action.busy}
            onClick={() =>
              void action.run(async () => {
                await docs.linkDocument(target, linkId);
                setShowLink(false);
                await resource.refresh();
              })
            }
          >
            Link latest approved version
          </Button>
        </section>
      )}
      {resource.data && (
        <section className="panel integration-panel">
          <h2>
            {processingOnly
              ? "Review and processing queue"
              : "Logical documents"}
          </h2>
          {!resource.data.items.length && <p>No accessible documents yet.</p>}
          {matches
            .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
            .map((doc) => {
              const links = resource.data!.links.filter(
                (link) => link.documentId === doc.id,
              );
              const direct =
                entity &&
                links.some(
                  (link) =>
                    link.entity.type === entity.type &&
                    link.entity.id === entity.id,
                );
              return (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  processingOnly={processingOnly}
                  writable={resource.data!.writable}
                  onChanged={resource.refresh}
                  inclusion={
                    entity
                      ? direct
                        ? "Direct " + entity.type.toLowerCase()
                        : "From Equipment"
                      : doc.origin.type.toLowerCase()
                  }
                  unlink={
                    entity && direct && resource.data!.writable
                      ? () =>
                          action.run(async () => {
                            await docs.unlinkDocument(entity, doc.id);
                            await resource.refresh();
                          })
                      : undefined
                  }
                />
              );
            })}
          {matches.length > pageSize && (
            <nav className="integration-toolbar" aria-label="Document pages">
              <Button
                variant="secondary"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous documents
              </Button>
              <span>
                Page {currentPage + 1} of {Math.ceil(matches.length / pageSize)}
              </span>
              <Button
                variant="secondary"
                disabled={(currentPage + 1) * pageSize >= matches.length}
                onClick={() => setPage(currentPage + 1)}
              >
                Next documents
              </Button>
            </nav>
          )}
        </section>
      )}
      <Drawer
        open={drawer !== null}
        title={drawer === "version" ? "Add new version" : "Add new document"}
        onClose={() => setDrawer(null)}
      >
        {drawer && (
          <UploadForm
            key={drawer}
            entity={target}
            documents={resource.data?.items}
            versionMode={drawer === "version"}
            onComplete={(versionId) => {
              setDrawer(null);
              router.push(`/documents/${versionId}`);
            }}
          />
        )}
      </Drawer>
    </AppShell>
  );
}

function DocumentRow({
  document,
  inclusion,
  unlink,
  processingOnly,
  onChanged,
}: {
  document: DocumentRecord;
  inclusion: string;
  writable: boolean;
  unlink?: () => unknown;
  processingOnly: boolean;
  onChanged: () => unknown;
}) {
  const [expanded, setExpanded] = useState(processingOnly);
  const loader = useCallback(
    () => (expanded ? docs.getVersions(document.id) : Promise.resolve(null)),
    [expanded, document.id],
  );
  const versions = useResource(loader, expanded ? 15000 : 0);
  const { data: session } = useSession();
  const originType = document.origin.type;
  const originId = document.origin.id;
  const permission = useResource(
    useCallback(
      () =>
        expanded
          ? canManage(
              { type: originType, id: originId },
              session?.user?.id ?? "",
            )
          : Promise.resolve(false),
      [expanded, originType, originId, session?.user?.id],
    ),
  );
  const action = useAction();
  return (
    <article className="integration-record">
      <div className="integration-toolbar">
        <Button
          variant="quiet"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {document.title}
        </Button>
        <span>{inclusion}</span>
        <RecordState
          value={
            document.archivedAt
              ? "ARCHIVED"
              : document.activeVersionId
                ? "ACTIVE"
                : "NO_ACTIVE_VERSION"
          }
        />
        {document.activeVersionId && (
          <Link href={`/documents/${document.activeVersionId}`}>
            Open active source
          </Link>
        )}
        {unlink && (
          <Button
            variant="secondary"
            onClick={() => {
              if (
                window.confirm(
                  "Unlink this document? Original versions are retained.",
                )
              )
                void unlink();
            }}
          >
            Unlink
          </Button>
        )}
      </div>
      {expanded && (
        <>
          <LoadState {...versions} retry={versions.refresh} />
          <LoadState {...permission} retry={permission.refresh} />
          {versions.data?.map((version) => (
            <div className="list-row" key={version.id}>
              <Link href={`/documents/${version.id}`}>
                Revision{" "}
                {version.reviewedMetadata?.revision ?? version.versionNumber}
              </Link>
              <RecordState
                value={
                  version.approvalState === "REJECTED"
                    ? "REJECTED"
                    : version.state
                }
              />
              <span>
                {version.id === document.activeVersionId
                  ? "Current active version"
                  : "Retained version"}
              </span>
            </div>
          ))}
          {permission.data && (
            <Button
              variant="secondary"
              disabled={action.busy}
              onClick={() => {
                if (
                  window.confirm(
                    document.archivedAt
                      ? "Restore this logical document?"
                      : "Archive this document? It will leave current retrieval; originals remain retained.",
                  )
                )
                  void action.run(async () => {
                    await docs.archiveDocument(
                      document.id,
                      !document.archivedAt,
                    );
                    await onChanged();
                  });
              }}
            >
              {document.archivedAt ? "Restore document" : "Archive document"}
            </Button>
          )}
          {action.error && <p role="alert">{action.error}</p>}
        </>
      )}
    </article>
  );
}

export function SourceWorkspace({ versionId }: { versionId: string }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const loader = useCallback(async () => {
    const version = await docs.getVersion(versionId);
    const document = await docs.getDocumentRecord(version.documentId);
    const [versions, writable] = await Promise.all([
      docs.getVersions(document.id),
      canManage(document.origin, userId),
    ]);
    return { version, document, versions, writable };
  }, [versionId, userId]);
  const resource = useResource(loader, 12000);
  return (
    <AppShell title={resource.data?.document.title ?? "Document source"}>
      <Link href="/documents">Back to documents</Link>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <SourceDetail
          key={versionId}
          {...resource.data}
          refresh={resource.refresh}
        />
      )}
    </AppShell>
  );
}

function SourceDetail({
  version,
  document,
  versions,
  writable,
  refresh,
}: {
  version: Version;
  document: DocumentRecord;
  versions: Version[];
  writable: boolean;
  refresh: () => Promise<void>;
}) {
  const access = useSourceAccess();
  const source = access.url;
  const [title, setTitle] = useState(
    version.reviewedMetadata?.title ??
      version.extraction?.extractedMetadata?.title ??
      document.title,
  );
  const [revision, setRevision] = useState(
    version.reviewedMetadata?.revision ?? String(version.versionNumber),
  );
  const [reviewed, setReviewed] = useState(false);
  const action = useAction();
  const step = {
    UPLOADING: 1,
    FINALIZING: 1,
    EXTRACTING: 2,
    NEEDS_REVIEW: 3,
    INDEXING: 5,
    INDEXED: 5,
    ACTIVE: 6,
    SUPERSEDED: 6,
    FAILED: 2,
  }[version.state];
  return (
    <>
      <ProcessingStepBar currentStep={step} />
      <div className="integration-toolbar">
        <RecordState value={version.state} />
        <RecordState value={version.approvalState} />
        <span>
          Revision {version.reviewedMetadata?.revision ?? version.versionNumber}
        </span>
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () =>
              access.open(() => docs.getSource(version.id)),
            )
          }
        >
          Open / refresh original
        </Button>
      </div>
      {document.activeVersionId !== version.id && (
        <p role="status">
          This is not the current active revision.{" "}
          {document.activeVersionId ? (
            <Link href={`/documents/${document.activeVersionId}`}>
              Open current revision
            </Link>
          ) : (
            "No revision is active yet."
          )}
        </p>
      )}
      {action.error && <p role="alert">{action.error}</p>}
      <div className="integration-columns">
        <section className="panel integration-panel">
          <h2>Original source</h2>
          <p>
            {version.contentType} · {version.bytes.toLocaleString()} bytes
          </p>
          {source && (
            <>
              <a href={source} target="_blank" rel="noreferrer">
                Open original in a new tab
              </a>
              {version.contentType === "application/pdf" && (
                <iframe
                  className="source-frame"
                  src={source}
                  title="Exact original PDF"
                  referrerPolicy="no-referrer"
                />
              )}
            </>
          )}
          {!source && (
            <p>
              Open the immutable original to compare it with extraction. Source
              access is checked on every opening.
            </p>
          )}
          <details>
            <summary>Checksum and version history</summary>
            <p className="integration-wrap">SHA-256: {version.sha256}</p>
            {versions.map((item) => (
              <p key={item.id}>
                <Link href={`/documents/${item.id}`}>
                  Revision{" "}
                  {item.reviewedMetadata?.revision ?? item.versionNumber}
                </Link>{" "}
                · {item.state}
              </p>
            ))}
          </details>
        </section>
        <section className="panel integration-panel">
          <h2>Extraction and review</h2>
          <p>
            {version.extraction?.documentSummary?.summary ??
              "Extraction has not completed. The worker must be running."}
          </p>
          {version.extraction?.errors?.map((error, i) => (
            <p key={i}>
              {typeof error === "string"
                ? error
                : "Extraction reported an error."}
            </p>
          ))}
          {version.extraction?.pages?.map((page) => (
            <details key={page.page}>
              <summary>
                Page {page.page} · {page.section}
              </summary>
              <pre className="extracted-source">{page.text}</pre>
            </details>
          ))}
          {writable &&
            version.state === "NEEDS_REVIEW" &&
            version.approvalState === "PENDING" && (
              <div className="integration-form">
                <Field label="Reviewed title">
                  <input
                    value={title}
                    maxLength={500}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
                <Field label="Reviewed revision">
                  <input
                    value={revision}
                    maxLength={100}
                    onChange={(e) => setRevision(e.target.value)}
                  />
                </Field>
                <label>
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />{" "}
                  I compared the original with the extracted text, metadata and
                  warnings.
                </label>
                <div className="integration-toolbar">
                  {(["APPROVE", "REJECT"] as const).map((decision) => (
                    <Button
                      key={decision}
                      variant={decision === "REJECT" ? "secondary" : "primary"}
                      disabled={
                        action.busy ||
                        !reviewed ||
                        !title.trim() ||
                        !revision.trim()
                      }
                      onClick={() =>
                        void action.run(async () => {
                          await docs.reviewDocument(version.id, {
                            decision,
                            title,
                            revision,
                            confirmSourceReviewed: true,
                          });
                          setReviewed(false);
                          await refresh();
                        })
                      }
                    >
                      {decision === "APPROVE"
                        ? "Approve for indexing"
                        : "Reject extraction"}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          {writable && version.state === "INDEXED" && (
            <Button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await docs.activateDocument(version.id);
                  await refresh();
                })
              }
            >
              Activate indexed version
            </Button>
          )}
          {version.state === "FAILED" && (
            <p>
              Processing failed. The previous active revision is unchanged.
              Operator retry requires a recorded reason; it is not available
              from this page.
            </p>
          )}
        </section>
      </div>
      {version.state === "ACTIVE" &&
        version.contentType === "application/pdf" && (
          <VisualAssets versionId={version.id} writable={writable} />
        )}
    </>
  );
}

function VisualAssets({
  versionId,
  writable,
}: {
  versionId: string;
  writable: boolean;
}) {
  const loader = useCallback(
    async () => ({
      assets: await docs.getVisuals(versionId),
      discovery: await docs.discoveryStatus(versionId),
    }),
    [versionId],
  );
  const resource = useResource(loader, 15000);
  const action = useAction();
  const [page, setPage] = useState(1);
  return (
    <section className="panel integration-panel">
      <h2>Exact visual assets</h2>
      <p>
        Verified descriptions support search. Visual observations in Chat
        require a separate inspection of the image pixels.
      </p>
      <LoadState {...resource} retry={resource.refresh} />
      {action.error && <p role="alert">{action.error}</p>}
      {writable && (
        <div className="integration-toolbar">
          <Button
            disabled={action.busy}
            onClick={() => {
              if (
                window.confirm(
                  "Discover and describe figures in this PDF? This queues paid AI processing.",
                )
              )
                void action.run(async () => {
                  await docs.discoverVisuals(versionId);
                  await resource.refresh();
                });
            }}
          >
            Discover figures
          </Button>
          <Field label="Page to render">
            <input
              type="number"
              min={1}
              max={500}
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await docs.renderVisual(versionId, page);
                await resource.refresh();
              })
            }
          >
            Render exact page
          </Button>
        </div>
      )}
      {resource.data && (
        <>
          <p>
            Discovery: {resource.data.discovery.status ?? "Not requested"}
            {resource.data.discovery.partial ? " · Partial coverage" : ""}
          </p>
          {!resource.data.assets.length && <p>No preserved figures yet.</p>}
          {resource.data.assets.map((asset) => (
            <article key={asset.id} className="integration-record">
              <p>
                Page {asset.metadata?.page ?? asset.page} · render {asset.state}{" "}
                · description {asset.descriptionState} · index{" "}
                {asset.indexState}
              </p>
              {asset.state === "READY" && (
                <VisualImage
                  assetId={asset.id}
                  label={`Exact source, page ${asset.metadata?.page ?? asset.page}`}
                />
              )}
              {writable &&
                asset.state === "READY" &&
                asset.descriptionState === "NOT_REQUESTED" && (
                  <Button
                    disabled={action.busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Describe and index this image using paid AI calls?",
                        )
                      )
                        void action.run(async () => {
                          await docs.describeVisual(asset.id);
                          await resource.refresh();
                        });
                    }}
                  >
                    Describe and index
                  </Button>
                )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}

export function VisualImage({
  assetId,
  label,
}: {
  assetId: string;
  label: string;
}) {
  const access = useSourceAccess();
  const source = access.url;
  const action = useAction();
  return (
    <figure>
      <Button
        variant="secondary"
        disabled={action.busy}
        onClick={() =>
          void action.run(async () =>
            access.open(() => docs.getVisualSource(assetId)),
          )
        }
      >
        {source ? "Refresh image access" : "Show exact image"}
      </Button>
      {action.error && <p role="alert">{action.error}</p>}
      {source && (
        <a href={source} target="_blank" rel="noreferrer">
          {/* Signed, expiring URLs must not pass through the Next image proxy. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="source-image"
            src={source}
            alt={label}
            referrerPolicy="no-referrer"
            onError={access.clear}
          />
        </a>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
