# Web Backend Implementation - Next.js API and MongoDB

## Delivery status

| Item                                                 | Status                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture, entity/version model, and API boundary | Defined.                                                                                                                                      |
| MongoDB models and browser-facing API                | **Backend complete through Phase 6 (2026-09-08).** Phase 3–6 state/authorization tests, hosted workflow checks, and the dated repair acceptance cover the implemented backend scope. |
| Authenticated AI client and background coordination  | Phase 1 signed client implemented and revalidated against the authenticated FastAPI readiness endpoint on 2026-09-04.                         |
| Phase 1–6 delivery                                   | **Complete for the Web backend only (2026-09-08).** This is not a synchronized product/UI completion claim; the separate global UI, representative-source/SME, and operational gates remain governed by `Development_Plan.md`. |
| Phase 7 delivery                                     | Backend implementation delivered; representative live visual-quality/cost acceptance pending. Automatic processing/retrieval are opt-in; no UI completion claim. |

## Goal

**UI wiring (2026-09-22):** Existing product APIs are consumed by all application
routes; there are no new public backend endpoints or AI contracts in this change.
Invalid configuration and failed signup persistence no longer fall back to demo
success. See [UI_Integration.md](UI_Integration.md) for supported workflows and the
remaining UI requests without backend support. Browser contract verification is
not new hosted/SME acceptance and does not change backend phase status.
Mongo readiness failures additionally emit fixed, safe diagnostic categories to
the server console; public readiness still exposes only aggregate availability.
The reported Mongo connection failure is not marked resolved without a successful
real ping and aggregate readiness response.

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

**Status (14 September 2026):** Backend implementation delivered; representative
live visual-quality/cost acceptance remains open. UI files and synchronized phase
statuses are unchanged. Automatic processing and visual Chat are opt-in.

**Implemented modules:**

- `visual-assets.ts`: authorized explicit page/crop requests, immutable private
  R2 PNGs, safe metadata listing, verified descriptions and fresh source opening.
  Original/derivative hashes, page/bounds, renderer/DPI and dimensions are retained.
  A source URL expires after at most 300 seconds; already-issued URLs cannot be
  instantly revoked. List/Chat/history never store or expose URLs, keys or bytes.
- `visual-pipeline.ts`: idempotent discovery initiation/status and descriptor
  indexing. AI owns local PDF triage and preview detection. Web validates
  correlated tenant-bound parent/SHA/page results, finite positive normalized bounds,
  class/confidence/uncertainty, max four regions, and current document eligibility.
  It rejects confidence below 0.5 and deduplicates overlap at intersection/min-area
  >=0.8, including contained crops, in deterministic confidence/position order.
  Per-version transactional allocation enforces 48 automatic/100 total assets.
  Reused manual pages/crops finish enrichment when explicit discovery requests it;
  an undescribed manual derivative cannot silently suppress searchable evidence.
  Discovery records distinguish detection status from end-to-end status and expose
  candidate/completed pages, total/scanned counts, partial coverage and asset counts.
  COMPLETE is not reported while automatic rendering/description/indexing is pending.
- `jobs.ts`: fenced outbox stages `VISUAL_TRIAGE → VISUAL_DISCOVER →
  VISUAL_RENDER → VISUAL_DESCRIBE → VISUAL_INDEX`; independent `VISUAL_DELETE`.
  Each job has bounded retries/five attempts/dead-letter recovery. Automatic
  regions chain all stages; manual renders remain rendering-only until description
  is requested. Verified descriptions enqueue indexing. Correlation, source state,
  SHA, selection fingerprint, description fingerprint and index generation are
  rechecked before commit. Lost leases and stale generations cannot publish success.
- `documents.ts`: activating a linked approved/indexed PDF optionally queues
  discovery when `VISUAL_PROCESSING_ENABLED=true`. Existing versions are not
  bulk-enriched; owners/managers may explicitly request discovery. Visual failure
  never changes successful text indexing or the active original version.
- `visual-chat.ts`: when `VISUAL_RETRIEVAL_ENABLED=true`, resolves at most
  100 READY/described/indexed assets from the assigned authorized active versions;
  discloses a truncated scope. Signed AI search selects max three IDs/roles.
  Only selected assets receive AI-only expiring source URLs. The usual private
  question socket returns text plus bounded verified visual observations/citations.
  Before persistence, revalidate current access, parent/version/SHA/bounds, index
  state/fingerprint/model, class, selected role and observation-to-citation IDs.
  An uninspected, altered, revoked or superseded asset cannot become a saved citation.
- `visual-repair.ts`: bounded fair recovery scans restart requested missing work,
  disable ineligible vectors immediately in product state, enqueue tenant/version
  visual-only deletion and rebuild a restored source with a new index generation.
  Periodic cleanup catches stale external upserts whose workers lost their lease.
  Reads always reauthorize, even before asynchronous cleanup. Revoking one user's
  access never deletes vectors still needed by other authorized users.
  Originals/derivatives remain retained; there is no automatic destructive R2 purge.
- Migration `0005_visual_retrieval` adds eligibility/discovery indexes alongside
  `0004_visual_assets`. Additive fields preserve older assets. Never remove
  migration markers to retry a job.

**Public API and Chat contract:**

| Operation | Endpoint |
| --- | --- |
| Start discovery / inspect coverage | POST / GET `/api/document-versions/{versionId}/visual-discovery` |
| Explicit render / list assets | POST / GET `/api/document-versions/{versionId}/visual-assets` |
| Describe a rendered asset | POST `/api/visual-assets/{assetId}/describe`, body `{}` |
| Index a verified description | POST `/api/visual-assets/{assetId}/index`, body `{}` |
| Open the exact retained PNG | GET `/api/visual-assets/{assetId}/source` |

Mutation requires document owner/approved manager access; reads require a current
authorized inclusion path. Chat returns `visualEvidenceState`,
`visualCitations` and `visualObservations` through both existing REST and product
WebSocket transports. Citation fields identify asset/document/version/page/bounds,
SHA, description fingerprint, class and REQUIRED/HELPFUL role. The later UI can
resolve each asset through the source endpoint; no direct browser-to-AI connection
or model-generated replacement image is introduced.

**Safety/cost:** Descriptors are not approved facts; AI must inspect exact pixels
in the current turn. Visual observations cannot supply operating/safety actions in
place of applicable text citations. Optional visual failure retains valid text;
required visual failure is incomplete. Separate namespaces, relevance gating,
bounded candidates and opt-in automatic processing limit additional paid work.
Retrying external inference/upserts can repeat cost; durable jobs are not a billing
exactly-once guarantee. No new dependencies, R2 credentials in AI, or Web retrieval SDK.

**Verification:** Tests cover the full durable stage chain, quotas/overlap
deduplication, coverage states, stale-index fencing, exact citation checks,
selected-only URL issuance, invented selections, revocation, orphan disable and
restoration/rebuild. Existing rendering/description tests cover corrupt PNGs,
supersession, tenant isolation, leased retries and retained-source availability.
Generated OpenAPI/TypeScript and real signed REST/socket integration are tested.
Recorded gate (14 September 2026): 111 Web and 135 AI tests pass, along with Web
lint/typecheck/build, AI Ruff/format/mypy/Pyright and paired synthetic evaluation.
The npm production-dependency audit reports zero vulnerabilities.
See the Phase 7 verification steps in the repository-root [Setup_Guide.md](../../Setup_Guide.md)
for representative source inspection, outage, authorization and recovery acceptance.

**Exit criterion:** A valid current diagram can be selected, pixel-verified,
persisted as an exact citation and freshly opened without copying the logical
document across entities. Live representative quality/cost and future UI rendering
are separate gates; no blanket completion of those gates is claimed here.

## Completion tracking

### Pack 2 acceptance follow-up (15 September 2026, testing in progress)

**16 September follow-up:** The user-reviewed four-step synthetic procedure was
published unchanged through the normal Owner workflow. Live checks passed published
immutability, current-period run deduplication, required-step blocking, performed
digital-only review/log submission, stale run revision rejection and completed-run
immutability. No physical work occurred. The 17 September continuation verified
actual next-day rollover (fresh unchecked steps, unchanged completed history) and
the published export's download; its export/index job completed. AI parser pipeline 4 requires
a new immutable manual version and renewed review; Web payloads are unchanged.

**17-18 September follow-up:** The new pipeline-4 manual was source-compared,
approved, indexed and activated without approving its faulty historical versions.
Three automatically discovered exact visual assets reached READY. Current diagram,
marker/follow-up and chart observations passed targeted real-service retests; the
stored chart result replayed identically over REST and WebSocket after restart.
Linking the manual to the second Equipment twice left one logical source/current
version across both Equipments and both Projects, with the same three asset IDs.
The link-triggered jobs completed, drive/main-Project profiles became FRESH, and
the published procedure remained unchanged; old unrelated dead letters were retained.
No UI or public schema changes; Web's 117 tests, including paired AI transport,
pass. This does not certify replacement/archive races or representative accuracy.

The configured Mongo DNS resolver timed out while system DNS/ping succeeded.
The first test server used a process-only empty resolver list, without rewriting
local credentials/settings. On resumption, configured DNS succeeded and system
DNS failed; the test server returned to the unchanged configured resolver.
Readiness now bounds each parallel probe to five seconds;
unsettled probes are shared across requests until they settle, preventing duplicate
probe accumulation. AI readiness has a five-second maximum and no retry. Native
DNS/storage work may outlive the HTTP response; timeout does not claim cancellation
or switch DNS automatically. Public output remains aggregate; only safe service
names appear in logs. No dependency/schema change or phase sign-off.

Live visual discovery exposed a transaction-helper defect: a committed callback
returning `void` was incorrectly reported as HTTP 500. Completion is now tracked
independently of the callback value, with regression tests for void mutations,
retry results, failure propagation, and session cleanup. Retesting discovery
returned HTTP 200 and reused the existing queued job; no migration or API payload
change is required. Visual end-to-end acceptance remains in progress.

The 16 September continuation passed scan PNG checksum/source authorization,
REST visual observations, WebSocket replay/conflict/authentication, scoped log
draft/edit conflicts, Project assignment exclusion, and whole-AI outage source
availability. The relevance optimization is AI-owned and changes no public schema.
Web clients must distinguish the text status from visual availability; verified
observations do not promote incomplete text to approved. Manual revision/crop
acceptance and human publication/run checks remain open for this new fixture pack.

Full npm audit subsequently reported two high-severity development-tooling findings
in the `@redocly/openapi-core` / `js-yaml` chain; production-only audit stayed clear.
The [publisher advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh) lists
4.3.2 as a patched js-yaml version. An npm remediation dry-run failed with
`EALLOWREMOTE` under the local package-fetch restriction. No package-policy override
or dependency change was made; full dependency remediation remains an open gate.

### Live API acceptance, 7–8 September 2026

The former dated acceptance report was removed with the fixture directory. Its
recorded scope included hosted account/access, PDF/text lifecycle, version propagation,
WebSocket/replay, scoped logs, synthetic publication/runs, actual daily rollover,
outage and audited retry checks. Core product APIs can be integrated with UI. The
subsequent repair record was also removed; it covered OCR setup/ingestion/Chat,
the failed factual-answer cases and review
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
[Backend_Manual_Testing.md](../../Backend_Manual_Testing.md)
to record hosted
ingestion → activation → propagation → socket answer → log → review/publish →
recurrence acceptance. Complete representative/SME evaluation, backup/restore and
configured telemetry checks before signing off their gates. UI phases were not
implemented or marked complete by this backend change.

Mark a **Web-backend module** phase complete only with its code, migrations,
tests, contract evidence, and setup-guide reconciliation. A **synchronized product
phase** additionally requires the matching `../../Development_Plan.md` integration
gate; module completion never substitutes for that gate.
