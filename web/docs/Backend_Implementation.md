# Web Backend Implementation - Next.js API and MongoDB

## Delivery status

| Item                                                 | Status                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture, entity/version model, and API boundary | Defined.                                                                                                                                      |
| MongoDB models and browser-facing API                | **Backend complete through Phase 6 (2026-09-08).** Phase 3–6 state/authorization tests, hosted workflow checks, and the dated repair acceptance cover the implemented backend scope. |
| Authenticated AI client and background coordination  | Phase 1 signed client implemented and revalidated against the authenticated FastAPI readiness endpoint on 2026-09-04.                         |
| Phase 1–6 delivery                                   | **Complete for the Web backend only (2026-09-08).** This is not a synchronized product/UI completion claim; the separate global UI, representative-source/SME, and operational gates remain governed by `Development_Plan.md`. |
| Phase 7 delivery                                     | In progress: visual assets, private R2 storage, authorized routes, durable render/description jobs and verified image descriptions implemented. Visual indexing/retrieval and Chat citations remain pending. |

## Goal

Provide the secure product API and authoritative relationship graph for P.A.T.C.H. The Next.js backend owns authorization, MongoDB, Cloudflare R2 originals, active document versions, Equipment/Project links, Project maintenance logs, controlled workflows, and audit records. It mediates typed AI calls but never implements extraction, embeddings, Pinecone retrieval, LangGraph, or prompting.

## Setup-guide maintenance

Before marking any backend phase complete, reconcile and run the applicable instructions in [Setup_Guide.md](../../Setup_Guide.md). Update it for every new Web dependency, environment variable, migration, service contract, startup command, verification step, or recovery procedure introduced by that phase.

## Dependency selection

Follow the mandatory policy in `../../AGENTS.md` and `../../Agent.md`. Prefer Next.js runtime features and existing direct packages before adding an abstraction. Do not introduce another authentication system, ORM/database client, object-storage client, validation stack, logging stack, job broker, or infrastructure service without an explicit documented architecture decision showing why the existing stack cannot meet the phase requirement. Use `npm`; update `package.json` and `package-lock.json` together; document ownership/configuration and operational impact here and in `Environment.md`/`Setup_Guide.md`; and test the failure and authorization boundary.

## Scope and boundaries

- `web` owns browser-facing routes, authentication/session handling, Equipment owner/manage-access and Project Owner/Member authorization, Equipment/Project records, MongoDB persistence, private R2 lifecycle, logical documents and immutable versions, entity links, active-version switching, Project maintenance logs, procedures, citations, and audits.
- `web` is the only caller of FastAPI. Browser code never receives the AI service secret or direct Pinecone/OpenAI access.
- `ai` owns extraction/OCR, source and profile embeddings, Pinecone operations, hierarchical retrieval, reranking, LangGraph flows, evidence grading, citations, answer generation, and AI drafts.
- MongoDB is authoritative. Pinecone contains rebuildable derived vectors: `SOURCE_CHUNK` and `ENTITY_PROFILE` (and optionally approved `MAINTENANCE_LOG` records). A Pinecone ID is never used as a relational join.

## Authentication

- P.A.T.C.H. uses first-party email/password authentication only. Do not add Google, GitHub, Microsoft, or any other social/OAuth provider.
- Sign-up accepts exactly `name`, `email`, `password`, and `confirmPassword`. The confirmation is validated at the API boundary and is never stored.
- Email addresses are normalized to lowercase and unique. Passwords are stored only as versioned, salted scrypt hashes; plaintext passwords, password confirmations, and password hashes never appear in browser responses, audit context, or logs.
- Auth.js uses its credentials provider with JWT sessions. The credentials provider verifies the password against the MongoDB `User` record; it is not a social-login fallback.
- Authentication establishes identity only. Project authorization uses explicit `OWNER` and `MEMBER` membership rules. Equipment authorization uses its creator as owner plus owner-approved Equipment-scoped manage access; it never grants or changes Project membership.

## Phase 1 runtime conventions

- Protected browser routes use the shared authenticated route wrapper, which resolves the server session, derives the actor, validates request data, assigns/preserves a correlation ID, emits structured redacted logs, and returns stable error codes.
- The idempotent `0001_phase_one_foundation` database migration creates the unique normalized-email index and audit timeline indexes, then records itself in `schemaMigrations`. It is safe to retry after failure and once per database/process during normal runtime.
- There is deliberately no production user seed. The first and subsequent accounts use the audited email/password sign-up route. Test fixtures remain test-only.
- `GET /api/settings` and `PATCH /api/settings` own the authenticated user's name and `LIGHT | DARK | SYSTEM` theme preference; email remains read-only.
- Public health/readiness bodies expose aggregate Web availability only. Detailed logs contain safe service names and correlation metadata, never environment-variable names or values.

## Core records

| Record                                            | Required purpose                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                                            | Authenticated identity, profile preferences, and light/dark/system theme setting.                                                                                                                                                                                                     |
| `Equipment`                                       | Installed Equipment with creator/owner, name, type/model, location, operational state, optional user description, generated-description status, and profile reference/status.                                                                                                         |
| `EquipmentManageAccess`, `EquipmentAccessRequest` | Owner-approved Equipment-scoped mutation grant and request/decision history. An approved grant permits mutation only; it cannot approve requests or grant Project access.                                                                                                             |
| `Project`                                         | Required description, included Equipment IDs, Owner/Member workflow, generated profile reference/status, and Project workflow state.                                                                                                                                                  |
| `ProjectMembership`, `MembershipRequest`          | Only `OWNER` or `MEMBER`; creation and request/decision history.                                                                                                                                                                                                                      |
| `Document`                                        | Logical document identity, title/type, owner/creator, `activeVersionId`, lifecycle state, and stable identity across revisions.                                                                                                                                                       |
| `DocumentVersion`                                 | Immutable revision with R2 object key, checksum, approval/extraction/index status, metadata, source locations, and supersession history.                                                                                                                                              |
| `EquipmentDocumentLink`, `ProjectDocumentLink`    | References `documentId`; default `versionPolicy: LATEST_APPROVED`, optional controlled `PINNED` version. Stores applicability, not copied content.                                                                                                                                    |
| `EntityRetrievalProfile`                          | Derived Mongo projection containing profile version, generated summary, coverage/hints, provenance hashes, Pinecone profile ID, freshness state, and refresh timestamps.                                                                                                              |
| `MaintenanceLog`                                  | Project-owned final record with `scopeType: PROJECT                                                                                                                                                                                                                                   | EQUIPMENT`, optional validated `equipmentId`, final user wording, attachments, and citation snapshots. |
| `ChatSession`, `ChatTurn`                         | User-owned transcript, `@` assignments, routed entities, evidence state, and immutable citations.                                                                                                                                                                                     |
| `SafetyProcedure`                                 | Stable Project-owned procedure identity, current published/draft version pointers, generation state, recurrence definition, and next-run scheduling state.                                                                                                                            |
| `ProcedureVersion`                                | Immutable published/superseded definition or mutable pre-publication draft containing ordered stable step IDs, editable titles/instructions, required flags, citation bindings, review-need analysis, source/input fingerprint, and reviewer history. Publishing freezes the version. |
| `ProcedureRun`                                    | One execution occurrence for one published procedure version and recurrence period, with status, due window/timezone, assignee, notes, and completion/exception audit.                                                                                                                |
| `ProcedureStepCompletion`                         | Run-scoped step state with stable step ID, checked state, actor/time, note, and exception metadata; never stored on the reusable procedure definition.                                                                                                                                |
| `AuditEvent`                                      | Immutable evidence of uploads, activation, links, profile refreshes, membership, logs, questions, and publishing.                                                                                                                                                                     |

## Document and version invariants

1. `DocumentVersion` is immutable after upload metadata is finalized. Corrections create another version.
2. A logical `Document` may have many versions but at most one current `activeVersionId`.
3. Entity links normally target `documentId`, not `documentVersionId`. This is what makes version propagation automatic.
4. A new version becomes active only after approval and successful AI indexing. Until activation, readers and retrieval continue using the prior active version.
5. Activation is one MongoDB transaction: confirm version/index state, set `activeVersionId`, mark prior version superseded for current retrieval, write audit/outbox events, and commit.
6. The user-visible composed document set is resolved, never copied:

```text
Project composedDocumentSet
  = active versions of direct ProjectDocumentLinks
  + active versions of EquipmentDocumentLinks for every included Equipment
```

The broader AI retrieval evidence set is a separate projection:

```text
Project retrievalEvidenceSet
  = Project composedDocumentSet
  + controlled Project procedures and eligible Project maintenance logs
```

7. Deduplicate documents by active `documentVersionId`, while retaining all inclusion paths for UI explanation and audit. Procedures/logs remain their own record families, tabs, authority levels, and citations.

## Upload and ingestion orchestration

The same flow is launched from Equipment creation, Project creation, Equipment Manage documents, Project Manage documents, or the global Documents view:

1. Browser selects `ADD_NEW_DOCUMENT` or `ADD_NEW_VERSION`; a creation wizard may instead choose `SKIP_FOR_NOW`.
2. Web validates target access, metadata, file type/size/checksum, and existing logical-document selection when versioning.
3. Web stores the immutable original in R2 and creates the pending `DocumentVersion` record before AI processing.
4. Web supplies FastAPI a short-lived signed R2 URL plus canonical version metadata.
5. AI extracts/OCRs, produces source locations and structured document summary, and returns review data. Web persists the result.
6. The authorized user reviews metadata and approves/rejects according to the agreed Equipment/Project policy.
7. AI indexes approved source chunks. Web persists the result and activates the version transactionally.
8. Web emits profile-refresh events for directly linked Equipments/Projects and every Project that includes an affected Equipment.

The initial implementation may use a MongoDB outbox plus a protected worker route. Do not require Redis or another undeclared infrastructure dependency.

## Retrieval-scope manifest

For every Chat turn, Web resolves current authorization and active versions into a compact typed manifest:

- `allowedDocumentVersions`: approved/indexed active versions the user may access;
- `entities`: authorized Equipment/Project IDs, profile IDs/versions/freshness, and their direct active document-version IDs;
- `relationships`: Project -> included Equipment IDs, direct Project document versions, and eligible Project workflow records;
- `inclusionPaths`: `PERSONAL`, `PROJECT_DIRECT`, `EQUIPMENT_DERIVED`, `PROJECT_PROCEDURE`, or `PROJECT_LOG`;
- authorized `@` assignments, which can only narrow/prioritize this manifest.

This lets FastAPI route with entity profiles and then retrieve chunks without calling MongoDB or making a callback into Web.

## Phase plan

### Phase 1 - Secure runtime foundation

**Status:** Complete (2026-09-03)

**Goal:** Establish the trusted Web runtime, common API conventions, and AI connection.

**Prerequisites:** Environment contract, email/password credential provider, MongoDB/R2 environments, service-auth design, contract version, and correlation-ID policy.

**Deliverables:** Environment/schema validation; MongoDB/R2 checks; idempotent migration/no-production-seed approach; email/password auth and server-session middleware; role/permission helpers; profile/theme preference APIs; structured redacted logs and persisted audits; aggregate health/readiness routes; authenticated timeout/retry-bounded OpenAPI client.

**Exit criteria:** Signed-in Web connects to MongoDB/R2 and AI readiness without exposing private secrets; browser APIs consistently authenticate, authorize, validate, and audit.

### Phase 2 - Equipment, Project, and access APIs

**Status:** Complete (2026-09-04)

**Goal:** Make Equipment/Project identity, description rules, membership, and relationships authoritative.

**Prerequisites:** Phase 1 runtime; Equipment owner/manage-access policy; accepted Project role and discovery rules.

**Deliverables:** `/equipments` CRUD with optional description; creator ownership; request-safe Equipment discovery; Equipment manage-access request/owner decision APIs; `/projects` CRUD with mandatory description; Project Equipment selection; atomic creator `OWNER`; Project discovery and request/decision APIs; selected-entity validation; optional/skip document-step state; an idempotently indexed initial `WAITING_FOR_SOURCES` procedure-generation request; audits.

**Exit criteria:** Project description is enforced server-side; Equipment description may be absent; Equipment creator is owner and only the owner or an owner-approved manager can mutate it; creator is the initial Project Owner; non-members cannot read Project content; Project membership of each Equipment is queryable without copied document data.

### Phase 3 - Document lifecycle, activation, and profile coordination

**Status:** Complete for the Web backend (2026-09-08). Automated and hosted lifecycle/propagation acceptance, including the subsequent repair acceptance, passed. Product/UI and representative-source gates remain separately tracked.

**Goal:** Support dedicated entity document management and automatic safe propagation of active versions.

**Prerequisites:** Phase 2 access checks; R2 adapter; MongoDB version/link/outbox models; FastAPI ingestion and profile contracts.

**Deliverables:** New-document/new-version upload sessions; document/version/link CRUD; composed Equipment/Project document reads; review/approval/index state; transactional activation; source viewer; signed original access; ingestion and profile-refresh dispatch; stale/failed profile state; idempotent outbox/worker behavior; audit events.

**Exit criteria:** Updating a linked Equipment document activates one canonical version and immediately changes every linked Project's resolved file/metadata/retrieval manifest. Profile refresh is queued for all dependents, retries safely, and never blocks correctness or duplicates content.

### Phase 4 - Chat gateway and evidence integrity

**Status:** Complete for the Web backend (2026-09-08). Automated and live scoped WebSocket/REST mediation, citation validation, history, replay, and repair acceptance passed. UI and product-wide representative acceptance remain separately tracked.

**Goal:** Supply FastAPI the current authorized entity graph and validate every cited answer.

**Prerequisites:** Current active versions/profile references; Chat and hierarchical-retrieval contract; safe error mapping.

**Deliverables:** Chat session/turn routes; auto-title persistence; `@document|equipment|project|entity` resolution; current `RetrievalScopeManifest`; bounded recent history; typed mediation; routed-entity persistence for observability; citation validation; exact source access; unavailable state.

**Exit criteria:** No session or `@` reference broadens access. Every citation resolves to an allowed active source version and exact location. Missing/stale entity profiles do not remove authorized source versions from the fallback manifest.

### Phase 5 - Project logs and controlled procedures

**Status:** Complete for the Web backend (2026-09-08). Automated and hosted ownership, history, draft, publication, recurrence, and repair acceptance checks cover the backend scope. UI and SME product acceptance remain separately tracked.

**Goal:** Keep maintenance outcomes and controlled content within Project ownership.

**Prerequisites:** Project membership/Equipment relationships; active direct Project documents; citation snapshots; AI generation/review-analysis schemas; scheduler/outbox; procedure workflow.

**Deliverables:** `/projects/:projectId/maintenance-logs` list/create/update/submit; `PROJECT|EQUIPMENT` scope validation; draft mediation; attachments/evidence snapshots; idempotent `ProcedureGenerationRequested` outbox triggered at Project creation and eligible source activation; `WAITING_FOR_SOURCES|QUEUED|GENERATING|READY|FAILED` generation states; source/input fingerprint deduplication; saved AI draft plus review analysis; ordered step CRUD/reorder and citation-revalidation flags; draft/review/change/approve/publish/history; timezone-aware recurrence; idempotent run creation; run-scoped step check/uncheck/note/exception; optional eligible-log ingestion events; audits.

**Exit criteria:** No standalone log endpoint exposes cross-Project records. Equipment scope is rejected unless the Equipment belongs to the Project. A source-ready Project produces exactly one saved draft per input fingerprint; skipped/pending documents stay visibly waiting. Regeneration never overwrites user edits. Published versions are immutable. `SEVERE` review need or unresolved blocking evidence prevents publication. Each recurrence period has at most one run; a new run starts unchecked and prior completions remain auditable. AI cannot edit records, tick steps, complete runs, or publish procedures.

### Phase 6 - Security, reliability, and release

**Status:** Complete for the Web backend (2026-09-08). Backend security, recovery, operator, evaluation, and repair checks are implemented and verified. This does not mark the synchronized product phase or its UI/release gates complete.

**Goal:** Make propagation, authorization, and AI mediation observable and recoverable.

**Prerequisites:** Phase 1-5 APIs, workers, fixtures, and operational targets.

**Deliverables:** Input/file controls; rate limits; idempotency; retry/dead-letter handling for ingestion/profile events; consistency-repair job; backups/retention; metrics/tracing/alerts; API/security/authorization/contract tests; deployment documentation.

**Exit criteria:** Tests cover failed upload/index/activation, duplicate events, stale profiles, version races, link changes, access revocation, Project Equipment removal, and AI/Pinecone outages. Traces connect user request, Mongo resolution, AI graph, Pinecone query, and returned citations.

### Phase 7 - Multimodal visual-source retrieval and asset mediation (backend-only)

**Status:** In progress — visual asset foundation implemented. This is a Web/AI backend phase only. It deliberately creates no
browser UI, renderer, or global synchronized-phase completion claim.

**Current milestone:** `/api/document-versions/{versionId}/visual-assets` supports
POST of an explicit page/crop and GET of authorized current assets;
`/api/visual-assets/{assetId}/source` resolves a ready asset after fresh manifest
authorization. `VISUAL_RENDER` uses the existing fenced outbox/worker and signed AI
client; Web validates provenance, size, PNG dimensions and checksum before storing
private content-addressed R2 derivatives. Migration `0004_visual_assets` adds a
tenant/version/selection unique index; per-version transactional allocation limits
explicit assets to 100. Operator retry resets a failed visual asset to queued.
This milestone uses existing packages and adds only Web `VISUAL_RENDER_DPI`.
No asset enters the Chat evidence manifest yet. Automatic region identification,
visual indexing/retrieval, verified visual Chat results and their evaluation are
still required before Phase 7 completion. See the
[Phase 7 manual test](../../Manual%20Testing/ui-less-test/08_Phase_7_Visual_Assets.md).

**Description milestone:** `POST /api/visual-assets/{assetId}/describe` queues
`VISUAL_DESCRIBE` only after current-source mutation authorization. The worker
validates correlation and exact derivative checksum, then lease-fences persistence
of the bounded verified description. Description state is separate from rendering;
failure/dead-letter/retry never removes the original or derivative. No new package,
environment setting or migration is needed; fields are additive and old assets
report `NOT_REQUESTED`. This endpoint is explicit because each attempt can make
two paid vision calls. Descriptions do not enter Chat or ordinary source chunks.

**Remaining implementation plan — automatic discovery, retrieval, and Chat
mediation:** The following is planned Phase 7 work, not a claim that automatic
detection, visual vectors, or visual Chat citations already exist.

1. **Discover candidates cheaply before model use.** After a version is active,
approved, indexed, PDF-backed, and still reachable through its current logical
document link, a fenced `VISUAL_DISCOVER` outbox job performs deterministic local
page triage. It may use only bounded parser/render facts—page count, native-text
density, image/XObject presence when available, drawing density, and nearby
caption signals such as `Figure`, `Diagram`, `Schematic`, `Flow`, or `Wiring`.
These signals only select pages; they are never visual evidence or user-visible
claims. Pages without a qualifying signal do not incur a model call. Reaching a
candidate cap must produce an explicit partial state, never a false claim of full
document coverage.
2. **Detect regions only on shortlisted previews.** AI receives a checksum-bound,
low-resolution page preview through the existing signed boundary. The configured
low-effort routing model returns structured candidate regions: normalized bounds,
visual class (`SCHEMATIC`, `DIAGRAM`, `CHART`, `TABLE`, `PHOTO`, `SCREENSHOT`, or
`OTHER`), confidence, and uncertainty. Its output is a proposal, never evidence.
Web validates positive finite bounds/provenance/caps, deterministically deduplicates
overlaps, and queues immutable high-resolution renders using the existing asset
fingerprint. It rejects model-proposed instructions, malformed coordinates, stale
parents, private URLs and raw bytes.
3. **Bound cost and lifecycle.** Before code is written, configuration and the
contract must declare safe caps for candidate pages/version, regions/page,
automatic assets/version, preview DPI/pixels, detector calls, and queue attempts.
Detection is idempotent by parent checksum plus discovery-pipeline version.
Activation, archive, revocation, supersession, unlinking and retention fence both
enqueue and commit. Manual visual assets remain available independently.
4. **Index descriptions, never image bytes.** A ready verified description is
queued through `VISUAL_INDEX`. Web records its fingerprint/state and sends only
immutable metadata plus verified description text. `IMAGE_REGION` is a rebuildable
vector projection in `PINECONE_VISUAL_NAMESPACE`—mapped by deployment to
`visual-{environment}`—not an approved source claim,
Mongo authority, copied document, or public URL. Its metadata includes tenant/
environment, parent document/version, page/bounds, SHA, asset/pipeline/model and
embedding versions. Lifecycle changes trigger scoped delete/rebuild while originals
and derivatives follow retention policy.
5. **Build visual scope from current authorization.** Turn preparation resolves
ready/indexed visual assets only from the same active approved versions already in
the text manifest. Web sends stable metadata and expiring AI-only source URLs only
for a bounded shortlist. Browser responses, persisted turns, audits and logs never
retain URLs or pixels. `@` references may narrow/prioritize scope but cannot add
assets outside the user's document set.
6. **Validate visual citations at both edges.** Before persistence Web re-resolves
scope and verifies asset ID, tenant, parent document/version, page/bounds, SHA,
`READY` state, index state, approval and current access. A stale, altered,
out-of-scope, unauthorized or uninspected returned asset fails safely. Chat stores
a stable citation only; a source route freshly authorizes any later browser URL.

**Planned visual Chat contract:** `QuestionRequest` gains a bounded visual-scope
manifest and private response-scoped source descriptors. `QuestionResult` gains
separate `visualCitations` and `visualEvidenceState: TEXT_ONLY | AVAILABLE |
UNAVAILABLE`. A citation contains stable asset ID, parent document/version, page,
normalized bounds, derivative SHA, class and relevance role (`REQUIRED` or
`HELPFUL`); never a R2 key, URL, bytes or raw model output. An approved answer may
be text-only; it may claim visual evidence only after inspecting that exact asset.

**Goal:** Preserve diagrams, photographs, screenshots, schematics, and page visual
context as immutable source assets; retrieve the exact authorized visual when it
materially supports a question; and return a validated visual citation that a later
Chat UI can render without giving the browser direct R2 or AI access.

**Prerequisites:** A contract-first `VisualSourceAsset`/visual-citation schema in
the FastAPI OpenAPI artifact; a reviewed AI visual-extraction and embedding
strategy; bounded R2 derivative policy; document-version authorization; and the
Phase 6 audit, retry, deletion, and safety controls. Model/vector selection must
follow the repository dependency policy before a package, provider, or index change.

**Deliverables:**

- Persist version-bound visual-asset records for a full rendered page and detected
  meaningful regions. Each record carries immutable `documentId`,
  `documentVersionId`, page, normalized bounding box, derivative R2 key/checksum,
  extraction/index state, source anchor, and provenance; it is never a copied
  logical document or a public object URL.
- Extend the staged document outbox with idempotent visual extraction/index work,
  bounded retries and dead-letter/recovery states. A visual-processing failure is
  explicit and auditable; it must not silently claim that a document's figures are
  searchable or corrupt the already-valid text-source lifecycle.
- Reauthorize the exact parent version and current inclusion path before issuing a
  short-lived derivative URL. Revocation, archival, supersession, approval changes,
  and retention deletion cascade to visual assets and prevent stale visual citations
  from being persisted or opened.
- Add Web-to-AI manifest entries for only the currently authorized visual assets and
  validate every returned visual citation against that manifest, parent version,
  page/region anchor, and derived-object checksum before it reaches chat history.
  A visual reference can narrow evidence; it can never broaden retrieval scope.
- Mediate visual result metadata through the existing authenticated REST/WebSocket
  Chat path. The later UI receives a stable citation/asset descriptor, not an R2
  credential, signed source URL, raw model output, or browser-to-AI endpoint.
- Add authorization, lifecycle, idempotency, version-propagation, expired-URL,
  citation-tampering, and Web/AI contract tests. Manual acceptance must prove that
  an authorized answer can cite and open the exact diagram while an unauthorized or
  superseded asset cannot be retrieved.
- Add discovery, rank-fusion, relevance-gate and pixel-grounding tests: no-figure
  documents, decorative images, duplicate diagrams, image-only scans, mixed pages,
  ambiguous labels, embedded injections, text-relevant/image-irrelevant questions,
  image-required questions, expired sources, partial discovery, deletion/rebuild
  and visual-provider outage without ordinary Chat regression.

**Exit criteria:** An answer may include a visual citation only when Web can resolve
the exact current approved parent version, page/region and authorized derivative.
The same logical document linked to multiple entities retains one visual asset set;
new version activation changes the resolved visual set without copying assets. Text
Chat remains safe and usable when visual extraction, indexing, or a visual provider
is unavailable.

## Completion tracking

### Live API acceptance, 7–8 September 2026

[Acceptance report](../../Manual%20Testing/ui-less-test/06_Live_Backend_Acceptance.md)
records real hosted account/access, PDF/text lifecycle, version propagation,
WebSocket/replay, scoped logs, synthetic publication/runs, actual daily rollover,
outage and audited retry checks. Core product APIs can be integrated with UI;
the subsequent [repair acceptance](../../Manual%20Testing/ui-less-test/07_Backend_Repair_Acceptance.md)
verifies OCR setup/ingestion/Chat, the failed factual-answer cases and review
criticality through the existing Web contracts. Complete acceptance remains open
for the explicitly unverified UI/SME/operational cases. This testing change does not
mark any synchronized phase complete or substitute for UI acceptance.

### Backend implementation inventory, 2026-09-06

- `lib/backend/documents.ts`, `scope.ts`, `jobs.ts`, `context.ts`: immutable
  staged-upload finalization, exact MIME/size/hash checks, human review, leased
  extraction/indexing, transactional compare-and-swap activation, logical links,
  historical pins, archive, composed reads and audited expiring source URLs.
  Profile refresh cascades Equipment changes to included Projects. Failed indexing
  leaves the previous version active; stale profiles never decide authorization.
- `chat.ts`, `lib/ai/socket.ts`, `scripts/chat-gateway.mjs`, `server.mjs`:
  user-owned sessions, UUID/content deduplication, one in-flight turn, cookie/Origin
  gateway, HMAC private socket, reconnect/history and cancellation semantics,
  current manifests before request and commit, exact original-text citations and
  safe unavailable answers. No unverified raw token stream reaches clients.
- `logs.ts`, `procedures.ts`, `procedure-evidence.ts`, `recurrence.ts`: Project
  Owner mutation policy, scoped editable/submitted logs, automatic fingerprinted
  generation, explicitly selected supplemental Equipment sources, stable draft
  steps, full revalidation after edits, reviewer acknowledgement, blocked severe
  publication, immutable published versions, current controlled-procedure export
  indexing as a separate record family, deterministic timezone-aware runs and
  run-scoped ticks. Required steps cannot be waived with an exception note.
- `security.ts`, `access.ts`, `operations.ts`, `repair.ts`, `scan.ts`:
  exact-origin checks, bounded JSON/files/socket frames, Mongo rate buckets,
  Owner-only revocation, expiring/fenced outbox leases, five attempts then
  dead-letter, reasoned retry, fair cursor-based repair, scheduled current runs,
  metadata-only inspection/logs and optional OTLP. Product deletion refuses to
  orphan retained document/log/procedure history. No destructive retention job.
- `router.ts`/`openapi.ts` and `/api/docs`: local Swagger assets and a generated
  Web REST operation catalog, including credentials authentication and protected
  worker operations. FastAPI OpenAPI regenerates the committed Web AI types.

### Dependencies and operational decisions

MongoDB supports an opt-in, validated DNS-resolver list from configuration for
environments whose system resolver refuses hosted SRV/TXT records. It uses the
Node platform, introduces no package, preserves TLS/SRV topology discovery and
requires a restart when changed. Roll back by clearing the override and restarting
after system DNS is restored; no database migration or machine DNS change occurs.

`ws` (MIT) and its development types supply the Node WebSocket server/client;
Next route handlers do not own HTTP upgrade sockets. The custom Next server
retains hot reload and backs both `npm run dev` and `npm start`. No second HTTP
framework or broker was added. `swagger-ui-dist` (Apache-2.0) serves local API
tooling assets; it is not application UI and does not load a remote CDN. Both
manifest and npm lockfile were updated. Existing MongoDB transactions/outbox,
AWS R2 adapter, Zod, rrule and OpenTelemetry packages are reused.

Official references checked: [ws](https://github.com/websockets/ws),
[Next custom server](https://nextjs.org/docs/app/guides/custom-server), and
[Swagger UI](https://github.com/swagger-api/swagger-ui). Do not replace these
with Socket.IO, a separate backend stack or an undeclared queue service.

Migration `0003_backend_workflows` is additive and creates workflow uniqueness,
dispatch/list and rate-expiry indexes before database access. Published versions,
run completions and canonical original bytes are retained. See the setup guide
for coordinated upgrade, backup, restore and rollback; never remove migration
markers or wipe records to repair an index conflict.

### Verification and honest completion boundary

The suite currently has **81 passing tests**, including a real loopback FastAPI
HTTP/HMAC/WebSocket process with external providers prohibited, a real Web socket
gateway with fixture REST, and isolated transactional Mongo state tests. Cases
cover version races, revocation, Equipment removal, exact citations, duplicate
turns, dead letters, immutable logs, required run ticks and timezone/DST changes.
These tests do not establish actual hosted transaction durability or live AI quality.

A separate bounded hosted smoke used two tagged synthetic accounts, one Equipment,
one Project and one immutable test-card source. It verified real persistence/access
denials, R2 bytes, extraction/review/index/activation, shared current-version links,
profile refresh, a cited Web-to-AI socket turn, replay/history, log submission and
one unpublished procedure candidate. This is not publication/recurrence or SME
acceptance. The exact-host R2 path-style fix has a regression test; it requires no
stored-object migration because canonical object keys are unchanged.

Use
[Backend_Manual_Testing.md](../../Manual%20Testing/ui-less-test/Backend_Manual_Testing.md)
to record hosted
ingestion → activation → propagation → socket answer → log → review/publish →
recurrence acceptance. Complete representative/SME evaluation, backup/restore and
configured telemetry checks before signing off their gates. UI phases were not
implemented or marked complete by this backend change.

Mark a **Web-backend module** phase complete only with its code, migrations,
tests, contract evidence, and setup-guide reconciliation. A **synchronized product
phase** additionally requires the matching `../../Development_Plan.md` integration
gate; module completion never substitutes for that gate.
