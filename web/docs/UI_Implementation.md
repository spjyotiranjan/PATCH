# Web UI Implementation - Next.js

## Delivery status

The route/component implementation and authenticated Web API wiring are delivered.
Completed module labels do **not** certify the hosted end-to-end, representative
source/SME, full accessibility/visual-regression, or synchronized product gates.
See [UI_Integration.md](UI_Integration.md) for the live route map and backend gaps.

| Item                            | Status                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Updated route/design asset plan | Defined.                                                                                            |
| Production Next.js UI           | Phases 1–6 complete: authenticated shell, settings, equipments, projects, documents, evidence-backed chat, maintenance logs & procedures, and responsive design. |
| Shared Web-to-AI contract       | Implemented and synchronized through the completed backend phases in `API_Contract.md`.             |
| Phase 1-6 delivery              | UI Phases 1–6 complete.                                                                            |

## Goal

## Current integration status (2026-09-22)

All application routes now use authenticated, same-origin Web REST and `/ws/chat`
through `lib/api/`. Runtime mock sessions, synthetic records, simulated saves and
fallback answers are removed from the application path. Existing shell, theme
tokens, controls, drawers and route hierarchy remain shared. Workflow fields and
state labels reflect the implemented backend contract rather than mock DTOs.
Documents poll durable processing state; review is explicit; procedures use exact
revisions; runs retain their own completion history. Phase 7 visual observations
and exact images use current-authorized, short-lived source access. Automated
browser tests use isolated responses, not hosted records or paid providers.
Hosted full-flow acceptance and the remaining product gates are still open.

The 2026-10-02 entity-response fix unwraps Equipment and Project detail/create/update
envelopes in browser helpers. Regression fixtures now match the actual route shape.
Lint, type checking, all 156 unit/integration tests, 15 Chrome scenarios and the
production build pass. The production dependency audit reports three high and one
critical advisory; no dependencies or phase status were changed.

Deliver a technician-first desktop/tablet UI for Equipments, Projects, versioned documents, global Chat, and Project workflows. Every authenticated page uses one `AppSidebar`, one `PageTitleBar`, one token set, and the same icon/badge/control components. Maintenance logs exist only within Project space.

## Setup-guide maintenance

### Procedure workspace presentation (2 October 2026)

Review-reason code labels display as readable words and wrap within the panel;
the original reason values remain unchanged for acknowledgement payloads. Review
checkbox text and long blocking findings cannot widen the panel. Browser checks
cover the reported hardware/coverage reason at desktop and mobile widths.

Definition-page evidence now uses compact, initially collapsed source cards.
Title, revision/page and approval state remain visible; expansion shows the full
saved citation and the existing source-access controls. Native summary keyboard
interaction and mobile layouts are covered in both themes. Expansion alone makes
no source request; source authorization/payloads and the shared Chat/run evidence
presentation are unchanged.

Phase 5 UI maintenance adds numbered native-details accordions with visible step
titles/source states, keyboard expansion and Expand all/Collapse all. Stable IDs
preserve edits and expanded state during reordering; new steps open immediately.
Drag handles sit in the summary and reorder collapsed steps without expanding
them. Clicking the handle does not toggle the accordion; read-only/busy handles
are disabled. Browser tests exercise actual header drag/drop in both themes.
The definition editor groups linked sources, review analysis, human review and
publication, evidence and save actions. Procedure lists, version/run history,
schedules and execution screens share clearer visual hierarchy. Run progress is
derived from recorded checks, without changing completion eligibility.

Existing API calls, revision/citation payloads, authorization, source revalidation,
severe blockers and separate approval/publication are unchanged. No dependency,
configuration or phase-status change is introduced. Browser coverage exercises
collapse/edit/reorder/add/remove/save in both themes, checks mobile width, and
retains the existing approval, Member-access and run-completion checks.

Verification: lint, TypeScript, 179 Web tests, 27 Chrome scenarios and the
production build pass. Desktop/mobile screenshots were inspected. The dependency
audit still reports six high and one critical pre-existing advisory; no packages
were changed by this UI work.

### Sidebar scrolling repair (2 October 2026)

The shared rail now uses a fixed viewport height with the workspace offset by
the same 205px desktop / 72px compact-rail width. The mobile drawer retains its
existing width and backdrop. Session history has its own bounded scroll region
and contains wheel overscroll; primary navigation, Chat, New chat, Settings and
Help remain anchored. The Chat row includes a labelled expand/collapse button,
with keyboard focus and expanded state, inside its selected background.

This is UI-only Phase 1 shell / Phase 4 navigation maintenance. No API, data,
authorization, AI, dependency or environment changes are introduced. Verification:
179 Web tests, 25 Chrome scenarios, lint, TypeScript and production build pass.
New browser checks cover long transcript/history scrolling, boundary overscroll,
keyboard collapse/expand and mobile drawer geometry in both themes. Light/Dark
screenshots were inspected. Synchronized phase acceptance remains unchanged.

### Presentation polish (2 October 2026)

Shared live workflow styles now use calmer type/spacing, compact controls and
state badges, readable record links and tables. Home rows and document revision
rows no longer reuse the legacy 22px icon column for record names. Chat uses
question bubbles, a bounded reading column, inline superscript citation numbers
at passage ends with tighter paragraph spacing, a sticky composer, source
assignment chips and accessible animated processing feedback. Chrome checks cover
per-passage numbering, inline placement, source tooltips and keyboard evidence access.
Uploads retain the native file control inside a styled picker with filename/size
feedback and the existing retry, validation and approval flow.

Only components/styles and UI tests/documentation change in this presentation
work. API functions, endpoints, payloads, authorization and backend behavior are
unchanged. The existing socket emits accepted/processing events, so the UI shows
request/processing feedback without timed simulated stages or token streaming.
Reduced motion disables animations; both themes and tablet sizes are verified
with isolated Chrome fixtures. Hosted AI/source acceptance remains separate.

Verification: lint, TypeScript, 156 unit/integration tests, 17 Chrome scenarios
and production build pass. The full dependency audit reports six high and one
critical pre-existing advisory. This UI change adds no packages or configuration
and does not change synchronized phase status.

Before marking any UI phase complete, reconcile and run the applicable instructions in [Setup_Guide.md](../../Setup_Guide.md). Update it for every new browser route, authentication step, persisted preference, dependency, startup command, verification flow, supported viewport, or troubleshooting procedure introduced by that phase.

## Dependency selection

Follow the mandatory policy in `../../AGENTS.md` and `../../Agent.md`. Prefer React, Next.js, the shared component system, and already-installed focused libraries. Do not add a second styling system, component kit, icon family, form stack, query/cache layer, auth client, or state manager for a capability already owned by the current stack. Use `npm`, update `package.json` and `package-lock.json` together, record the need and UI/runtime cost here, update setup documentation when behavior changes, and verify accessibility, supported viewports, loading/error states, and production build impact.

## Prerequisites

- Read and strictly follow `../../AGENTS.md`, `../../Agent.md`, `../../PRODUCT.md`, `../../Development_Plan.md`, `../../Setup_Guide.md`, `Backend_Implementation.md`, `API_Contract.md`, `Environment.md`, and `UI_Design.md` before planning or editing.
- Use `Equipment` / `Equipments` everywhere. Routes use `/equipments`; labels, schemas, components, and visual references follow the same terminology.
- Derive tokens/components from `../ui-design/foundations/color-palette.webp` and `../ui-design/components/app-shell/canonical-shell.webp`.
- Build every loading/empty/error/unauthorized/AI-unavailable state and visible keyboard focus.
- Never imply that an entity profile, AI draft, or maintenance log is a controlled instruction.

## Proposed route structure

```text
app/
  sign-in/page.tsx
  sign-up/page.tsx
  page.tsx
  equipments/
    page.tsx
    new/page.tsx
    [equipmentId]/
      page.tsx
      documents/page.tsx
  projects/
    page.tsx
    new/page.tsx
    [projectId]/
      page.tsx
      documents/page.tsx
      maintenance-logs/page.tsx
      procedures/
        page.tsx
        [procedureId]/
          edit/page.tsx
          runs/[runId]/page.tsx
  documents/
    page.tsx
    [documentVersionId]/page.tsx
  chat/
    page.tsx
    [conversationId]/page.tsx
  settings/page.tsx
```

The implemented Phase 1 routes use the flat App Router structure above. Later-phase nested routes are added only when their corresponding UI phase begins.

There is no top-level maintenance-log route. Redirecting a legacy link requires a `projectId`; otherwise show a context-selection explanation.

## Non-negotiable UX rules

1. Sidebar content/order/dimensions and PageTitleBar layout are reusable components, not independently recreated per page.
2. Sidebar top-level items are Home, Equipments, Projects, Documents. Chat follows a divider and contains New chat plus date-grouped sessions. Settings and Help & support stay at the bottom. Maintenance logs appear only as a Project tab/sub-route.
3. PageTitleBar shows title and optional status at left, optional page actions at right, and never profile details. Profile editing and theme controls live in Settings.
4. Project description is required with validation and helper copy. Equipment description is optional and labelled “Recommended for better AI routing.”
5. Equipment and Project creation contain a Documents step with `Add documents now` and `Skip for now`; adding now launches the same ingestion component used by Manage documents.
6. Equipment/Project Manage documents provides two primary actions: `Add new document` and `Add new version`. The new-version action requires selecting the existing logical document and shows the current active revision.
7. Project documents distinguish Direct Project and From Equipment, show the inclusion path, and never render duplicate cards for one active version.
8. Version status is explicit: Uploading, Extracting, Needs review, Approved, Indexing, Active, Failed, Rejected, Superseded. A failed new version states that the previous active version remains in use.
9. Chat is global/session-based. `@` assignments constrain/prioritize retrieval; Evidence Used contains exact current source versions. Entity routing profiles are never shown as answer citations.
10. Project maintenance-log creation requires scope `Overall Project` or one included Equipment and preserves final user ownership.
11. Procedure definition editing and procedure execution are separate surfaces. Definitions support source-aware text editing and accessible reordering; run screens support audited ticks/notes only.
12. `Low | Moderate | High | Severe review needed` is evidence/review metadata, never a safety approval. The UI exposes reasons and blocks publication for unresolved severe findings.

## Phase plan and design-asset map

### Phase 1 - Canonical shell, settings, and access

**Status:** Complete (2026-09-04)

**Goal:** Establish the exact shared shell and token/component system before feature screens.

**Prerequisites:** First-party email/password auth and session behavior, supplied shell references, settings API and theme persistence contract, icon library, accessibility baseline.

**Deliverables:** Public email/password sign-in and four-field sign-up; authenticated-route guard; canonical sidebar; title bar; navigation/session behavior; API-backed Settings profile/theme page and sign-out; light/dark/system tokens; typography; icons; buttons; fields; tables; tabs; drawers; badges; loading/error/unauthorized states.

| View/component                     | Image path                                                 |
| ---------------------------------- | ---------------------------------------------------------- |
| Palette and semantic components    | `web/ui-design/foundations/color-palette.webp`             |
| Canonical sidebar and PageTitleBar | `web/ui-design/components/app-shell/canonical-shell.webp`  |
| Sign-in/session state              | `web/ui-design/app/(public)/sign-in/session-expired.webp`  |
| Operations home                    | `web/ui-design/app/(authenticated)/page/dashboard.webp`    |
| Settings: profile and theme        | `web/ui-design/app/(authenticated)/settings/settings.webp` |

**Exit criteria:** Every route placeholder renders the same sidebar/title-bar components pixel-consistently. Reference screenshot review uses a 1440x900 desktop capture with a 205px sidebar, 56px title bar, and 24px content gutter; sidebar/title-bar geometry has zero route-specific variance. No authenticated top bar exposes profile identity. Credentials flows match the backend contract, protected content is withheld from unauthenticated users, Settings reads/writes the authenticated API, theme choice persists, and core semantic statuses use text as well as colour. These behaviors are covered by Phase 1 component/integration tests and the Web quality gate.

### Phase 2 - Equipment and Project creation/context

**Status:** Complete

**Goal:** Create, discover, and understand Equipments/Projects with correct descriptions and access.

**Prerequisites:** Phase 1 shell; typed Equipment/Project/membership APIs; Equipment mutation policy.

**Deliverables:** Equipment directory/detail/create; Project discovery/request/Owner inbox/create/workspace; required/optional description rules; included-Equipment selection; optional creation-time Documents step; context tabs and status states.

| View/component                                         | Image path                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Equipment directory                                    | `web/ui-design/app/(authenticated)/equipments/directory.webp`              |
| Equipment overview                                     | `web/ui-design/app/(authenticated)/equipments/[equipmentId]/overview.webp` |
| Equipment creation details and recommended description | `web/ui-design/app/(authenticated)/equipments/new/details.webp`            |
| Equipment creation Documents: add now or skip          | `web/ui-design/app/(authenticated)/equipments/new/documents.webp`          |
| Project discovery and membership request               | `web/ui-design/app/(authenticated)/projects/discover-and-request.webp`     |
| Project creation details and mandatory description     | `web/ui-design/app/(authenticated)/projects/new/details.webp`              |
| Project creation Documents: inherited/direct/add/skip  | `web/ui-design/app/(authenticated)/projects/new/documents.webp`            |
| Project workspace                                      | `web/ui-design/app/(authenticated)/projects/[projectId]/workspace.webp`    |

**Exit criteria:** UI/server both enforce Project description; Equipment description may be skipped with recommendation copy; users can add documents now or skip; Owner/Member visibility and request states match server authorization.

### Phase 3 - Dedicated document management, versions, and ingestion

**Status:** Complete

**Goal:** Make entity document ownership, active versions, propagation, and AI processing comprehensible.

**Prerequisites:** Logical document/version/link APIs, R2 upload, ingestion states, profile freshness/status contract.

**Deliverables:** Equipment and Project Manage documents; global accessible Documents library; new-document/new-version dialogs; upload/extract/review/approve/index/activate progress; direct vs inherited Project documents; source/version viewer; profile refresh states and propagation copy.

| View/component                                              | Image path                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Equipment Manage documents                                  | `web/ui-design/app/(authenticated)/equipments/[equipmentId]/documents/manage.webp`   |
| Project Manage documents and inherited Equipment sources    | `web/ui-design/app/(authenticated)/projects/[projectId]/documents/manage.webp`       |
| Deduplicated global Documents library                       | `web/ui-design/app/(authenticated)/documents/library.webp`                           |
| Upload/review/activation workflow                           | `web/ui-design/app/(authenticated)/documents/upload-review.webp`                     |
| Indexing failure, prior active version, and profile refresh | `web/ui-design/app/(authenticated)/documents/processing-state.webp`                  |
| Current and historical source viewer                        | `web/ui-design/app/(authenticated)/documents/[documentVersionId]/source-viewer.webp` |

**Exit criteria:** A user can distinguish logical document from version, add either kind correctly, and see which revision is active. Project views update when an Equipment document activates and explain `Updated via <Equipment>` without showing copied sources. Failed indexing retains and identifies the prior active version.

### Phase 4 - Entity-routed evidence-backed Chat

**Status:** Complete

**Goal:** Deliver persistent familiar Chat with transparent current-source evidence.

**Prerequisites:** Current retrieval manifest, profile states, assignment contract, session/turn/citation APIs, all evidence states.

**Deliverables:** New chat; auto-titled session list; transcript; multiline composer; `@document|equipment|project|entity` search/chips; routing/loading copy; inline citations; Evidence Used; exact source opening; response actions; insufficient/conflicting/outdated/unavailable states.

| View/component        | Image path                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| Global Chat workspace | `web/ui-design/app/(authenticated)/chat/[conversationId]/session-chat.webp` |
| Evidence Used drawer  | `web/ui-design/components/chat/evidence-used-drawer.webp`                   |

**Exit criteria:** Every step cites a current accessible source. UI may say which Equipments/Projects were searched, but never treats generated entity profiles as evidence. `@` and fallback behavior are understandable without exposing internal chain-of-thought.

### Phase 5 - Project maintenance logs and procedures

**Status:** Complete

**Goal:** Capture Project work and turn source-bounded AI procedure candidates into controlled, editable definitions and auditable recurring execution runs.

**Prerequisites:** Project membership/Equipment relationship, eligible active Project sources, evidence snapshots, idempotent generation contract, versioned procedure/run APIs, recurrence scheduler.

**Deliverables:** Project Maintenance logs tab; list/filter; create/edit/submit drawer; Overall Project/Equipment scope selector; evidence/attachments; generation states (`WAITING_FOR_SOURCES|QUEUED|GENERATING|READY|FAILED`); auto-saved draft; review-analysis panel and four review-need badges; editable/addable/removable/reorderable source-linked steps with drag and Move up/Move down; citation-revalidation state after edits; request-change/approve/publish/history; recurrence settings/next-run preview; current run checklist, progress, notes, required-step gate, overdue/exception states, and retained run history.

| View/component                                 | Image path                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Project maintenance-log workspace              | `web/ui-design/app/(authenticated)/projects/[projectId]/maintenance-logs/workspace.webp` |
| Generated procedure review/editor              | `web/ui-design/app/(authenticated)/projects/[projectId]/procedures/review.webp`          |
| Recurring procedure run and completion history | `web/ui-design/app/(authenticated)/projects/[projectId]/procedures/recurring-run.webp`   |

**Exit criteria:** No standalone maintenance-log navigation exists. Equipment choices are limited to the Project. A source-ready Project shows one saved draft per input fingerprint; skipped/pending documents show Waiting for Project sources. Every generated step exposes citations and review reasons. Users can edit and keyboard-reorder steps without losing stable IDs; edited citations are revalidated. Severe blocking findings cannot publish. Published versions are immutable. A recurring period creates one unchecked run; ticks record actor/time, prior runs remain unchanged, and normal completion is unavailable while a required step is incomplete. Publication remains Owner-only; AI cannot tick or complete work.

### Phase 6 - Responsive, accessibility, and release validation

**Status:** Complete

**Goal:** Verify all views and component states at desktop/tablet sizes and both themes.

**Prerequisites:** Phases 1-5 implemented with representative entities, versions, profile freshness, evidence, logs, and roles.

**Deliverables:** Visual regression against the asset library; keyboard/screen-reader/contrast tests; responsive sidebar/drawer behavior; edge-state E2E tests; performance and release checklist.

**Exit criteria:** Every mapped route uses the canonical shell/components, passes supported breakpoints and accessibility checks, and completes the flow: create/skip -> manage document/version -> activate/propagate -> chat/cite -> Project log/procedure.

## Completion tracking

Record implementation/test evidence before changing phase status. A phase completes only when its exit criteria and matching `../../Development_Plan.md` gate pass.

## Authenticated browser-service boundary

`lib/api/http.ts` enforces same-origin authenticated transport and stable errors.
`resources.ts`, `document-workflow.ts`, `chat-workflow.ts`, and `workflows.ts` own
payload mapping; the named domain modules re-export these implementations. There
is no API fallback to `lib/mockapi/`. Unreferenced historical mock/design helpers
are not an application data source and must never be reintroduced to live routes.
React lifecycle hooks hold transient request state, discard stale responses and
poll durable server state; they do not introduce a new query/cache dependency.
No dependency, model, AI schema or environment setting was added by UI wiring.

Run the full Web suite, including `ai-integration.test.ts`: it starts an isolated
loopback FastAPI fixture using the installed AI environment without paid providers.
Run `npm run test:e2e` for browser integration checks and the hosted procedure in
`UI_Integration.md` separately. Browser contract tests do not certify live AI quality.
Never mark the synchronized phase complete solely because mock-response tests pass.


## Typed Chat context ? 2 October 2026

The Question composer offers Project, Equipment and Document when `@` is typed.
Selecting a category inserts `@project:`, `@equipment:` or `@documents:`. Text
after the colon filters the authorized reference list; selecting a result consumes
the search token and displays a compact removable text preview. `@document:`
is also accepted. Arrow keys browse, Enter/Tab select and Escape dismisses.
The Attach context button starts the same flow. Loading, retry, no matches and
the existing 50-reference limit have explicit feedback. Attachments remain selected
across turns and can be removed before the next question.

The browser sends the same `{type,id}` entries in `assignedReferences`; typed
labels alone never attach a record or grant access. Reference loading, WebSocket
submission, server authorization, retries, evidence and AI behavior are unchanged.
Suggestions and editing are disabled while a turn is pending or follow-up is blocked.


### Chat Markdown rendering (2 October 2026)

Web owns a shared Chat Markdown renderer using `react-markdown` 10.1.0 and
`remark-gfm` 4.0.1 (MIT). The existing React/UI stack has no Markdown parser;
these maintained ESM packages support the project's Node 22+ and React 19 runtime
and avoid hand-written parsing or HTML injection. Publisher compatibility and
license were checked in the official repositories:
https://github.com/remarkjs/react-markdown and https://github.com/remarkjs/remark-gfm.
Both npm manifest and lockfile are updated. No second styling, icon, provider or
query stack is introduced. Normal `npm install` installs the parser; there is no
configuration or external service.

Supported verified passages render semantic headings, paragraphs, emphasis, lists,
GFM tables, blockquotes and code. Tables/code scroll inside the reading column;
read-only task lists do not record work. Citation buttons are inserted into the
parsed tree from actual response bindings at the passage end. HTML is skipped,
remote images omitted and model links display text, preserving the existing
source-access route. Warnings stay plain text. Plain-text history remains valid.
Rollback restores the plain-text renderer and removes these two packages with
npm; retained Markdown strings remain readable and require no data migration.


Markdown verification (2 October 2026): Web lint, TypeScript, production build,
171 unit/integration tests and 21 Chrome scenarios pass. Light/Dark screenshots
were visually checked; mobile layout stays within the viewport. Tests cover
semantic Markdown, HTML/image/link suppression, genuine citation insertion,
plain-text history, read-only checklists, passage endings and evidence access.
AI Ruff/format/mypy/Pyright and synthetic evaluation pass; all five new Markdown
checks pass including signed REST/socket and unsupported/conflict/safety rejection.
The full AI suite has 174 passes and two existing failures for deleted legacy
OCR PDF fixtures. Regenerated OpenAPI/types have no schema diff. Full npm audit
still reports six high and one critical existing findings. These fixture checks
do not establish live model/SME acceptance and change no synchronized phase status.


## PATCH-aware conversational Chat (2 October 2026)

This broadens Chat beyond technical passages. A LangGraph intent/response path
automatically uses authorized Project/Equipment details, logical document and
processing metadata, bounded Project logs, procedure/version/run states and
reviewed application help. No attachment is required. Natural-language names
can select authorized document/entity indices before source retrieval; weak
evidence still uses bounded current-manifest fallback. Explicit attachments
remain scope constraints. Help is application guidance, never physical guidance.

Record/help replies are conversational verified Markdown, with distinct record
references; they never count profiles, unreviewed logs or saved descriptions as
operating evidence. The configured routing model drafts intent/record prose and
the complex model independently verifies record/help claims and scope. Technical
requests use the existing answer/source verifier. Known in-scope intent cannot
be downgraded to outside scope by that generator. Only wholly unrelated requests
are outside scope. Empty records, missing evidence and service failures retain
specific, distinct states. Chat explains supported mutation workflows; it does
not claim to create/edit/approve/publish/complete records.

Web alone resolves current context and rechecks the exact projection before
persistence. Limits disclose partial context (100 entities, 200 documents, 40
logs, 30 procedures, 30 runs, 20 help entries and 180,000 bytes). Model responses
are not streamed before verification. Context/help keys are mapped in code;
Web rejects invented records/bindings and revoked/stale context. No new provider
SDK, package, setting, credential, index or migration is introduced.

Deploy Web and AI together after OpenAPI/type generation; restart both and ask
a new question. Existing saved turns retain their original result. Rollback
restores the evidence-only path on both services; retained records/history and
indexes are unchanged. One routing call is added to technical questions; record
and help questions normally use routing plus independent verification instead
of source retrieval. Existing deadlines/cost telemetry apply. This supersedes
the evidence-only empty-scope no-model rule when workspace context is present;
empty source scope still never queries Pinecone.
