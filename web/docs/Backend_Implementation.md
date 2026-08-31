# Web Backend Implementation - Next.js API and MongoDB

## Delivery status

| Item | Status |
|---|---|
| Architecture, entity/version model, and API boundary | Defined. |
| MongoDB models and browser-facing API | Not started. |
| Authenticated AI client and background coordination | Not started. |
| Phase 1-6 delivery | Planned; update only with tested implementation evidence. |

## Goal

Provide the secure product API and authoritative relationship graph for P.A.T.C.H. The Next.js backend owns authorization, MongoDB, Cloudflare R2 originals, active document versions, Equipment/Project links, Project maintenance logs, controlled workflows, and audit records. It mediates typed AI calls but never implements extraction, embeddings, Pinecone retrieval, LangGraph, or prompting.

## Scope and boundaries

- `web` owns browser-facing routes, authentication/session handling, Project Owner/Member authorization, Equipment/Project records, MongoDB persistence, private R2 lifecycle, logical documents and immutable versions, entity links, active-version switching, Project maintenance logs, procedures, citations, and audits.
- `web` is the only caller of FastAPI. Browser code never receives the AI service secret or direct Pinecone/OpenAI access.
- `ai` owns extraction/OCR, source and profile embeddings, Pinecone operations, hierarchical retrieval, reranking, LangGraph flows, evidence grading, citations, answer generation, and AI drafts.
- MongoDB is authoritative. Pinecone contains rebuildable derived vectors: `SOURCE_CHUNK` and `ENTITY_PROFILE` (and optionally approved `MAINTENANCE_LOG` records). A Pinecone ID is never used as a relational join.

## Core records

| Record | Required purpose |
|---|---|
| `User` | Authenticated identity, profile preferences, and light/dark/system theme setting. |
| `Equipment` | Installed Equipment with name, type/model, location, operational state, optional user description, generated-description status, and profile reference/status. |
| `Project` | Required description, included Equipment IDs, Owner/Member workflow, generated profile reference/status, and Project workflow state. |
| `ProjectMembership`, `MembershipRequest` | Only `OWNER` or `MEMBER`; creation and request/decision history. |
| `Document` | Logical document identity, title/type, owner/creator, `activeVersionId`, lifecycle state, and stable identity across revisions. |
| `DocumentVersion` | Immutable revision with R2 object key, checksum, approval/extraction/index status, metadata, source locations, and supersession history. |
| `EquipmentDocumentLink`, `ProjectDocumentLink` | References `documentId`; default `versionPolicy: LATEST_APPROVED`, optional controlled `PINNED` version. Stores applicability, not copied content. |
| `EntityRetrievalProfile` | Derived Mongo projection containing profile version, generated summary, coverage/hints, provenance hashes, Pinecone profile ID, freshness state, and refresh timestamps. |
| `MaintenanceLog` | Project-owned final record with `scopeType: PROJECT | EQUIPMENT`, optional validated `equipmentId`, final user wording, attachments, and citation snapshots. |
| `ChatSession`, `ChatTurn` | User-owned transcript, `@` assignments, routed entities, evidence state, and immutable citations. |
| `SafetyProcedure` | Stable Project-owned procedure identity, current published/draft version pointers, generation state, recurrence definition, and next-run scheduling state. |
| `ProcedureVersion` | Immutable published/superseded definition or mutable pre-publication draft containing ordered stable step IDs, editable titles/instructions, required flags, citation bindings, review-need analysis, source/input fingerprint, and reviewer history. Publishing freezes the version. |
| `ProcedureRun` | One execution occurrence for one published procedure version and recurrence period, with status, due window/timezone, assignee, notes, and completion/exception audit. |
| `ProcedureStepCompletion` | Run-scoped step state with stable step ID, checked state, actor/time, note, and exception metadata; never stored on the reusable procedure definition. |
| `AuditEvent` | Immutable evidence of uploads, activation, links, profile refreshes, membership, logs, questions, and publishing. |

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

**Status:** Not started

**Goal:** Establish the trusted Web runtime, common API conventions, and AI connection.

**Prerequisites:** Environment contract, auth provider, MongoDB/R2 environments, service-auth design, contract version, and correlation-ID policy.

**Deliverables:** Environment/schema validation; MongoDB/R2 checks; migrations/seeding approach; auth/session middleware; role/permission helpers; profile/theme preferences; structured logs/audits; health route; authenticated timeout-bounded OpenAPI client.

**Exit criteria:** Signed-in Web connects to MongoDB/R2 and AI readiness without exposing private secrets; browser APIs consistently authenticate, authorize, validate, and audit.

### Phase 2 - Equipment, Project, and access APIs

**Status:** Not started

**Goal:** Make Equipment/Project identity, description rules, membership, and relationships authoritative.

**Prerequisites:** Phase 1 runtime; accepted Equipment mutation policy; accepted Project role and discovery rules.

**Deliverables:** `/equipments` CRUD with optional description; `/projects` CRUD with mandatory description; Project Equipment selection; atomic creator `OWNER`; project discovery and request/decision APIs; selected-entity validation; optional/skip document-step state; audits.

**Exit criteria:** Project description is enforced server-side; Equipment description may be absent; creator is the initial Owner; non-members cannot read Project content; Project membership of each Equipment is queryable without copied document data.

### Phase 3 - Document lifecycle, activation, and profile coordination

**Status:** Not started

**Goal:** Support dedicated entity document management and automatic safe propagation of active versions.

**Prerequisites:** Phase 2 access checks; R2 adapter; MongoDB version/link/outbox models; FastAPI ingestion and profile contracts.

**Deliverables:** New-document/new-version upload sessions; document/version/link CRUD; composed Equipment/Project document reads; review/approval/index state; transactional activation; source viewer; signed original access; ingestion and profile-refresh dispatch; stale/failed profile state; idempotent outbox/worker behavior; audit events.

**Exit criteria:** Updating a linked Equipment document activates one canonical version and immediately changes every linked Project's resolved file/metadata/retrieval manifest. Profile refresh is queued for all dependents, retries safely, and never blocks correctness or duplicates content.

### Phase 4 - Chat gateway and evidence integrity

**Status:** Not started

**Goal:** Supply FastAPI the current authorized entity graph and validate every cited answer.

**Prerequisites:** Current active versions/profile references; Chat and hierarchical-retrieval contract; safe error mapping.

**Deliverables:** Chat session/turn routes; auto-title persistence; `@document|equipment|project|entity` resolution; current `RetrievalScopeManifest`; bounded recent history; typed mediation; routed-entity persistence for observability; citation validation; exact source access; unavailable state.

**Exit criteria:** No session or `@` reference broadens access. Every citation resolves to an allowed active source version and exact location. Missing/stale entity profiles do not remove authorized source versions from the fallback manifest.

### Phase 5 - Project logs and controlled procedures

**Status:** Not started

**Goal:** Keep maintenance outcomes and controlled content within Project ownership.

**Prerequisites:** Project membership/Equipment relationships; active direct Project documents; citation snapshots; AI generation/review-analysis schemas; scheduler/outbox; procedure workflow.

**Deliverables:** `/projects/:projectId/maintenance-logs` list/create/update/submit; `PROJECT|EQUIPMENT` scope validation; draft mediation; attachments/evidence snapshots; idempotent `ProcedureGenerationRequested` outbox triggered at Project creation and eligible source activation; `WAITING_FOR_SOURCES|QUEUED|GENERATING|READY|FAILED` generation states; source/input fingerprint deduplication; saved AI draft plus review analysis; ordered step CRUD/reorder and citation-revalidation flags; draft/review/change/approve/publish/history; timezone-aware recurrence; idempotent run creation; run-scoped step check/uncheck/note/exception; optional eligible-log ingestion events; audits.

**Exit criteria:** No standalone log endpoint exposes cross-Project records. Equipment scope is rejected unless the Equipment belongs to the Project. A source-ready Project produces exactly one saved draft per input fingerprint; skipped/pending documents stay visibly waiting. Regeneration never overwrites user edits. Published versions are immutable. `SEVERE` review need or unresolved blocking evidence prevents publication. Each recurrence period has at most one run; a new run starts unchecked and prior completions remain auditable. AI cannot edit records, tick steps, complete runs, or publish procedures.

### Phase 6 - Security, reliability, and release

**Status:** Not started

**Goal:** Make propagation, authorization, and AI mediation observable and recoverable.

**Prerequisites:** Phase 1-5 APIs, workers, fixtures, and operational targets.

**Deliverables:** Input/file controls; rate limits; idempotency; retry/dead-letter handling for ingestion/profile events; consistency-repair job; backups/retention; metrics/tracing/alerts; API/security/authorization/contract tests; deployment documentation.

**Exit criteria:** Tests cover failed upload/index/activation, duplicate events, stale profiles, version races, link changes, access revocation, Project Equipment removal, and AI/Pinecone outages. Traces connect user request, Mongo resolution, AI graph, Pinecone query, and returned citations.

## Completion tracking

Change phase status only in a pull request containing code, migrations, tests, contract evidence, and the matching `../../Development_Plan.md` integration-gate result.
