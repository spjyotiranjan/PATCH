# P.A.T.C.H. Synchronized Development Plan

## Delivery model

The MVP is delivered through six synchronized phases. `web` is one Next.js codebase containing the technician-facing UI and server-side product API. `ai` is a Python FastAPI microservice reached only from the Next.js backend. `Equipment` / `Equipments` is the canonical terminology in UI copy, routes, schemas, tests, and documentation.

## Setup-guide reconciliation gate

[Setup_Guide.md](Setup_Guide.md) is the canonical local setup, verification, and troubleshooting reference. Every phase must reconcile and test that guide before its implementation status is marked complete. The reconciliation must cover new dependencies, environment variables and ownership, migrations, startup/upgrade commands, API-contract generation, verification, operational limitations, and safe recovery instructions.

## AI and contributor compliance gate

Every contributor and AI coding model must read and follow [AGENTS.md](AGENTS.md), [Agent.md](Agent.md), and the applicable module implementation, contract, environment, design, and safety documents before planning or changing a phase. Phase work must not begin from chat context or one module document alone. If the documents disagree, reconcile them before code changes. Any dependency addition or upgrade must satisfy the dependency-selection policy in `AGENTS.md`, be recorded in the owning implementation document, update its manifest and lockfile together, and pass the affected module and integration gates.

## Delivery status

- **Phase 1 — Complete (2026-09-04):** UI, Web backend, and AI backend foundations are implemented, contract-synchronized, and reconciled with the setup guide. The integrated gate covers first-party credentials, the protected canonical shell, aggregate Web readiness, and authenticated Web-to-AI readiness.
- **Phase 2 — Module work in progress:** Web backend and AI backend Phase 2 are complete; the synchronized product phase remains open until UI Phase 2 and its cross-module gate are complete.
- **Phases 3-6 — Not started.**

| Phase                                | Shared outcome                                                                                       | Web UI                                                                                                                                                                           | Web backend                                                                                                                                                                        | AI backend                                                                                                                                  | Integration gate                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Foundation                        | Secure deployable skeleton and one stable application shell.                                         | Exact shared navigation/title bar, tokens, badges, sign-in, Settings shell, light/dark theme primitives.                                                                         | Environment validation, auth/session, MongoDB/R2, `OWNER`/`MEMBER`, health route, OpenAPI-generated AI client.                                                                     | FastAPI foundation, service auth, OpenAI/Pinecone/LangChain configuration, Pydantic/OpenAPI schemas.                                        | Signed-in user can navigate the shared shell; Web validates R2 and AI readiness through the versioned contract.                                                                                  |
| 2. Equipments and Projects           | Users create and understand Equipments and accessible Projects.                                      | Equipment directory/create/detail; Project discover/request/create/workspace; required Project description; recommended Equipment description; optional Documents creation step. | `Equipment`/`Project` CRUD, Equipment manage-access and Project membership decisions, included-Equipment graph, description validation, entity access checks.                      | Bounded entity-profile/scope schemas, exact pre-query filter builders, citation boundary, and deterministic profile stub; no retrieval yet. | Equipment creator is owner and approves manage access; Project creator is Owner; access requests are enforced; Project description cannot be omitted; document step can be completed or skipped. |
| 3. Documents, versions, and profiles | New/versioned files are ingested once, linked logically, and reflected by every dependent entity.    | Dedicated Equipment and Project document managers; Add new document/Add new version; upload/review/index states; inherited Equipment documents in Project; source viewer.        | Logical `Document`, immutable `DocumentVersion`, R2 upload, `activeVersionId`, latest-approved entity links, ingestion/profile-refresh jobs, composed document queries and audits. | Extraction/OCR, structured summaries, chunks, embeddings, source-vector upsert, Equipment/Project retrieval-profile generation and refresh. | Activating a new Equipment document version updates every linked Project's file/metadata/retrieval manifest and queues affected profiles without copying data.                                   |
| 4. Evidence-backed Chat              | Global session Chat routes questions through likely entities, then retrieves exact current evidence. | Session navigation, `@` assignments, transcript, streaming states, citations, Evidence Used, source opening and safe states.                                                     | Current access/entity graph manifest, active-version resolution, session/turn persistence, citation validation, AI mediation.                                                      | LangGraph two-stage retrieval: entity-profile routing then source-chunk retrieval/reranking; fresh evidence checks and cited response.      | Every claim cites an authorized current source; profile routing can improve recall/latency but structural fallback still finds newly active evidence.                                            |
| 5. Project workflows                 | Project work records and controlled procedures remain in Project context.                            | Project Maintenance logs; generated procedure editor with review-need analysis and reorderable steps; recurring run/checklist/history views.                                     | Project-only logs; idempotent auto-generation trigger; versioned definitions; recurrence scheduler; run/step completion; immutable audits.                                         | Source-bounded procedure generation with per-step citations and calibrated `LOW                                                             | MODERATE                                                                                                                                                                                         | HIGH | SEVERE` review need. | A source-ready Project receives one saved draft; severe evidence gaps cannot publish; recurrence opens a new unchecked run without erasing history. |
| 6. Harden, evaluate, deploy          | Complete product is reliable, accessible, observable, and demonstrable.                              | Settings profile/theme completion, tablet/accessibility pass, edge states, visual regression against canonical shell, E2E coverage.                                              | Rate limits, validation, profile-refresh reliability, backups, observability, deployment and security tests.                                                                       | Routing/retrieval evaluation, prompt-injection defenses, latency/quality metrics, deployment and failure-mode tests.                        | End-to-end demo passes: create entity > optional upload/skip > add/update document > activate > propagate > route > retrieve > cite > Project log > review/publish.                              |

## Phase-level acceptance criteria

### Phase 1 - Foundation

- Implement one reusable `AppSidebar` matching the supplied reference: P.A.T.C.H. logo; Home, Equipments, Projects, Documents; divider; Chat/New chat/session history; Settings and Help & support at the bottom. Maintenance logs never appear as a top-level destination.
- Implement one reusable `PageTitleBar`: left-aligned page/session title and optional status label; page actions at right; no avatar, user name, email, or profile menu.
- Centralize light/dark tokens, typography, spacing, icons, buttons, inputs, tables, drawers, tabs, and semantic badges before feature pages.
- Establish Web/AI contracts, environment validation, health checks, and server-to-server authentication.

### Phase 2 - Equipments and Projects

- Use `Equipment` / `Equipments` everywhere, including `/equipments` routes and `Equipment` records.
- Require a meaningful Project description. Equipment description is optional but the UI labels it “Recommended for better AI routing.”
- During Equipment/Project creation, offer the same Documents step used later by document management. Users can add documents now or explicitly skip and continue.
- A Project consists of included Equipments, direct Project documents, Project-only maintenance logs, controlled procedures, and Owner/Member access. It never copies Equipment documents.
- Project creation also records an idempotent pending procedure-generation request. It remains `WAITING_FOR_SOURCES` until the required description and at least one approved/indexed direct Project document are available, so choosing `Skip for now` never produces an unsupported procedure.
- Equipment creator is the owner. An owner may mutate the Equipment and approve or reject another user's manage-access request; an approved requester may mutate that Equipment. This access is Equipment-scoped and does not grant Project membership or alter the `OWNER`/`MEMBER` Project-role model.

### Phase 3 - Documents, versions, and entity profiles

- Store each logical `Document` once and each `DocumentVersion` as an immutable R2 object plus extraction/index records.
- Both Equipment and Project document managers expose two explicit actions: `Add new document` and `Add new version` (selecting an existing logical document).
- Entity-document links reference `documentId`, not a fixed version. Default `versionPolicy` is `LATEST_APPROVED`; resolve `activeVersionId` at read and retrieval time. Optional pinned versions require an explicit controlled-use reason.
- A new version follows: upload original -> extract/OCR -> review metadata -> approve -> index source chunks -> atomically activate -> invalidate/refresh Equipment profile -> invalidate/refresh linked Project profiles.
- Activation occurs only after successful indexing. Until then, the prior active version remains available. Old versions remain auditable and source-viewable but are excluded from current retrieval manifests.
- Equipment retrieval profiles contain a generated description, user description when present, systems/components, document capabilities, failure-mode/search hints, and stable document/entity references. Project profile generation receives bounded included-Equipment profile projections (ID/version/fingerprint, freshness, generated description, and coverage topics) plus the required Project description, direct-document coverage, and Project maintenance/procedure coverage. It never performs an implicit Pinecone join.
- Store profile source/provenance and `profileVersion` in MongoDB as a derived projection; store the profile embedding in a distinct Pinecone record type/namespace. A vector ID is a lookup key, not a relational join.
- Profile refresh is eventually consistent, but retrieval correctness is immediate: Web always builds current entity-to-active-document mappings, and AI falls back to structural scope expansion when profiles are missing, stale, or low-confidence.

### Phase 4 - Hierarchical retrieval and Chat

- Web sends an authorization-checked `RetrievalScopeManifest` containing allowed active document versions, allowed entity profile IDs, and Project-to-Equipment/document relationships.
- With explicit `@document`, AI retrieves that document directly. With `@equipment` or `@project`, AI expands the assigned entity through the manifest. Without assignments, AI searches authorized Equipment/Project profiles first and selects likely scopes.
- AI then queries source chunks only inside the selected/expanded active-version set, reranks results, checks revision/approval/conflicts, and generates from retrieved passages only.
- Entity profiles are routing evidence, never answer evidence. They may explain why a scope was selected but never satisfy a citation requirement.
- If routing confidence is weak, fan out to additional profiles or use the complete authorized active-version manifest within configured bounds. Never return “no evidence” solely because a profile is stale.
- Measure profile-routing precision/recall, document recall@k, citation validity, answer groundedness, latency, and fallback rate before claiming an optimization benefit.

### Phase 5 - Project maintenance logs and controlled procedures

- Maintenance logs are reachable only from `/projects/[projectId]/maintenance-logs` or the Project workspace tab.
- Log scope is `PROJECT` or `EQUIPMENT`. `equipmentId` is required only for Equipment scope and must belong to the Project.
- Preserve final user wording, attachments, cited evidence snapshots, author, timestamps, and scope. AI may draft but never submit.
- If finalized logs become retrievable evidence, index them as a distinct `recordType: MAINTENANCE_LOG` with Project/Equipment scope and rank them below approved manuals and controlled procedures for safety-critical instructions.
- Web automatically invokes the procedure-generation graph once per unique Project input fingerprint and saves the returned draft. Generation inputs are the mandatory Project description, current approved/indexed direct Project documents, and explicitly applicable included-Equipment sources; missing sources produce `WAITING_FOR_SOURCES`, never fabricated steps.
- AI returns cited steps, topic coverage, conflicts/freshness/applicability findings, and a review-need level: `LOW`, `MODERATE`, `HIGH`, or `SEVERE`. Every badge means human review is required; `SEVERE` blocks publication until blocking findings are resolved and the draft is regenerated or explicitly re-evidenced.
- Store a logical `SafetyProcedure` with immutable `ProcedureVersion` records. Draft steps can be edited, added/removed, and reordered by drag or accessible Move up/Move down controls. A manual step edit marks its evidence binding for revalidation; editing a published definition creates a new draft version.
- Store recurrence on the procedure definition and create one `ProcedureRun` per timezone-aware period. `ProcedureStepCompletion` belongs to a run, records actor/time/note/exception, and never mutates prior runs. A new period starts with all required steps unchecked.
- Normal run completion requires all required steps checked. Any permitted exception requires a reason, actor, timestamp, and audit; no AI service may tick a step or complete a run.
- Project Owner publication creates a controlled version and audit event. Regeneration never overwrites a user-edited draft; it creates a new candidate or a diff for review.

### Phase 6 - Hardening, evaluation, deployment

- Test active-version propagation, idempotent ingestion, profile invalidation/recovery, access changes, stale profiles, duplicate links, failed indexing, and Project removal of an Equipment.
- Validate one sidebar/title-bar implementation across every desktop/tablet view in light and dark themes. Test keyboard order, focus, contrast, screen-reader announcements, and non-colour status labels.
- Produce documented deployment, backups/retention, tracing from Web through LangGraph/Pinecone/OpenAI, and an end-to-end demonstration.

## Cross-module work rhythm

1. Re-read `AGENTS.md`, `Agent.md`, this plan, `Setup_Guide.md`, and every applicable module document from the current working tree; resolve documentation conflicts before implementation.
2. Revise `web/docs/API_Contract.md` and Pydantic schemas before implementing a boundary; generate/validate TypeScript types in `web`.
3. Select dependencies only through the documented dependency gate, and commit manifest/lockfile/documentation changes together with the code that uses them.
4. Implement shared fixtures for logical documents, active versions, entity relationships, profiles, and Project log scopes.
5. Build each route against the phase-mapped visual reference in `web/ui-design/` and the shell contract in `web/docs/UI_Design.md`.
6. Run the module quality gates and phase integration gate, reconcile `Setup_Guide.md`, and attach test/evaluation evidence before updating completion status.
