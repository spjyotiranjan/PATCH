# Web UI Implementation - Next.js

## Delivery status

| Item | Status |
|---|---|
| Updated route/design asset plan | Defined. |
| Production Next.js UI | Not started. |
| Shared Web-to-AI contract | Defined in `API_Contract.md`. |
| Phase 1-6 delivery | Planned; update only with implementation and test evidence. |

## Goal

Deliver a technician-first desktop/tablet UI for Equipments, Projects, versioned documents, global Chat, and Project workflows. Every authenticated page uses one `AppSidebar`, one `PageTitleBar`, one token set, and the same icon/badge/control components. Maintenance logs exist only within Project space.

## Prerequisites

- Read `../../PRODUCT.md`, `../../Agent.md`, `../../Development_Plan.md`, `Backend_Implementation.md`, `API_Contract.md`, and `UI_Design.md`.
- Use `Equipment` / `Equipments` everywhere. Routes use `/equipments`; labels, schemas, components, and visual references follow the same terminology.
- Derive tokens/components from `../ui-design/foundations/color-palette.webp` and `../ui-design/components/app-shell/canonical-shell.webp`.
- Build every loading/empty/error/unauthorized/AI-unavailable state and visible keyboard focus.
- Never imply that an entity profile, AI draft, or maintenance log is a controlled instruction.

## Proposed route structure

```text
app/
  (public)/sign-in/
  (authenticated)/
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

**Status:** Not started

**Goal:** Establish the exact shared shell and token/component system before feature screens.

**Prerequisites:** Auth/session behavior, supplied shell references, theme persistence contract, icon library, accessibility baseline.

**Deliverables:** Public sign-in; canonical sidebar; title bar; navigation/session behavior; Settings profile/theme page; light/dark tokens; typography; icons; buttons; fields; tables; tabs; drawers; badges; loading/error/unauthorized states.

| View/component | Image path |
|---|---|
| Palette and semantic components | `web/ui-design/foundations/color-palette.webp` |
| Canonical sidebar and PageTitleBar | `web/ui-design/components/app-shell/canonical-shell.webp` |
| Sign-in/session state | `web/ui-design/app/(public)/sign-in/session-expired.webp` |
| Operations home | `web/ui-design/app/(authenticated)/page/dashboard.webp` |
| Settings: profile and theme | `web/ui-design/app/(authenticated)/settings/settings.webp` |

**Exit criteria:** Every route placeholder renders the same sidebar/title-bar components pixel-consistently. Reference screenshot diffs use a 1440x900 desktop capture with a 205px sidebar, 56px title bar, and 24px content gutter; sidebar/title-bar geometry has zero route-specific variance. No authenticated top bar exposes profile identity. Theme choice persists and all core semantic statuses pass contrast/non-colour checks.

### Phase 2 - Equipment and Project creation/context

**Status:** Not started

**Goal:** Create, discover, and understand Equipments/Projects with correct descriptions and access.

**Prerequisites:** Phase 1 shell; typed Equipment/Project/membership APIs; Equipment mutation policy.

**Deliverables:** Equipment directory/detail/create; Project discovery/request/Owner inbox/create/workspace; required/optional description rules; included-Equipment selection; optional creation-time Documents step; context tabs and status states.

| View/component | Image path |
|---|---|
| Equipment directory | `web/ui-design/app/(authenticated)/equipments/directory.webp` |
| Equipment overview | `web/ui-design/app/(authenticated)/equipments/[equipmentId]/overview.webp` |
| Equipment creation details and recommended description | `web/ui-design/app/(authenticated)/equipments/new/details.webp` |
| Equipment creation Documents: add now or skip | `web/ui-design/app/(authenticated)/equipments/new/documents.webp` |
| Project discovery and membership request | `web/ui-design/app/(authenticated)/projects/discover-and-request.webp` |
| Project creation details and mandatory description | `web/ui-design/app/(authenticated)/projects/new/details.webp` |
| Project creation Documents: inherited/direct/add/skip | `web/ui-design/app/(authenticated)/projects/new/documents.webp` |
| Project workspace | `web/ui-design/app/(authenticated)/projects/[projectId]/workspace.webp` |

**Exit criteria:** UI/server both enforce Project description; Equipment description may be skipped with recommendation copy; users can add documents now or skip; Owner/Member visibility and request states match server authorization.

### Phase 3 - Dedicated document management, versions, and ingestion

**Status:** Not started

**Goal:** Make entity document ownership, active versions, propagation, and AI processing comprehensible.

**Prerequisites:** Logical document/version/link APIs, R2 upload, ingestion states, profile freshness/status contract.

**Deliverables:** Equipment and Project Manage documents; global accessible Documents library; new-document/new-version dialogs; upload/extract/review/approve/index/activate progress; direct vs inherited Project documents; source/version viewer; profile refresh states and propagation copy.

| View/component | Image path |
|---|---|
| Equipment Manage documents | `web/ui-design/app/(authenticated)/equipments/[equipmentId]/documents/manage.webp` |
| Project Manage documents and inherited Equipment sources | `web/ui-design/app/(authenticated)/projects/[projectId]/documents/manage.webp` |
| Deduplicated global Documents library | `web/ui-design/app/(authenticated)/documents/library.webp` |
| Upload/review/activation workflow | `web/ui-design/app/(authenticated)/documents/upload-review.webp` |
| Indexing failure, prior active version, and profile refresh | `web/ui-design/app/(authenticated)/documents/processing-state.webp` |
| Current and historical source viewer | `web/ui-design/app/(authenticated)/documents/[documentVersionId]/source-viewer.webp` |

**Exit criteria:** A user can distinguish logical document from version, add either kind correctly, and see which revision is active. Project views update when an Equipment document activates and explain `Updated via <Equipment>` without showing copied sources. Failed indexing retains and identifies the prior active version.

### Phase 4 - Entity-routed evidence-backed Chat

**Status:** Not started

**Goal:** Deliver persistent familiar Chat with transparent current-source evidence.

**Prerequisites:** Current retrieval manifest, profile states, assignment contract, session/turn/citation APIs, all evidence states.

**Deliverables:** New chat; auto-titled session list; transcript; multiline composer; `@document|equipment|project|entity` search/chips; routing/loading copy; inline citations; Evidence Used; exact source opening; response actions; insufficient/conflicting/outdated/unavailable states.

| View/component | Image path |
|---|---|
| Global Chat workspace | `web/ui-design/app/(authenticated)/chat/[conversationId]/session-chat.webp` |
| Evidence Used drawer | `web/ui-design/components/chat/evidence-used-drawer.webp` |

**Exit criteria:** Every step cites a current accessible source. UI may say which Equipments/Projects were searched, but never treats generated entity profiles as evidence. `@` and fallback behavior are understandable without exposing internal chain-of-thought.

### Phase 5 - Project maintenance logs and procedures

**Status:** Not started

**Goal:** Capture Project work and turn source-bounded AI procedure candidates into controlled, editable definitions and auditable recurring execution runs.

**Prerequisites:** Project membership/Equipment relationship, eligible active Project sources, evidence snapshots, idempotent generation contract, versioned procedure/run APIs, recurrence scheduler.

**Deliverables:** Project Maintenance logs tab; list/filter; create/edit/submit drawer; Overall Project/Equipment scope selector; evidence/attachments; generation states (`WAITING_FOR_SOURCES|QUEUED|GENERATING|READY|FAILED`); auto-saved draft; review-analysis panel and four review-need badges; editable/addable/removable/reorderable source-linked steps with drag and Move up/Move down; citation-revalidation state after edits; request-change/approve/publish/history; recurrence settings/next-run preview; current run checklist, progress, notes, required-step gate, overdue/exception states, and retained run history.

| View/component | Image path |
|---|---|
| Project maintenance-log workspace | `web/ui-design/app/(authenticated)/projects/[projectId]/maintenance-logs/workspace.webp` |
| Generated procedure review/editor | `web/ui-design/app/(authenticated)/projects/[projectId]/procedures/review.webp` |
| Recurring procedure run and completion history | `web/ui-design/app/(authenticated)/projects/[projectId]/procedures/recurring-run.webp` |

**Exit criteria:** No standalone maintenance-log navigation exists. Equipment choices are limited to the Project. A source-ready Project shows one saved draft per input fingerprint; skipped/pending documents show Waiting for Project sources. Every generated step exposes citations and review reasons. Users can edit and keyboard-reorder steps without losing stable IDs; edited citations are revalidated. Severe blocking findings cannot publish. Published versions are immutable. A recurring period creates one unchecked run; ticks record actor/time, prior runs remain unchanged, and normal completion is unavailable while a required step is incomplete. Publication remains Owner-only; AI cannot tick or complete work.

### Phase 6 - Responsive, accessibility, and release validation

**Status:** Not started

**Goal:** Verify all views and component states at desktop/tablet sizes and both themes.

**Prerequisites:** Phases 1-5 implemented with representative entities, versions, profile freshness, evidence, logs, and roles.

**Deliverables:** Visual regression against the asset library; keyboard/screen-reader/contrast tests; responsive sidebar/drawer behavior; edge-state E2E tests; performance and release checklist.

**Exit criteria:** Every mapped route uses the canonical shell/components, passes supported breakpoints and accessibility checks, and completes the flow: create/skip -> manage document/version -> activate/propagate -> chat/cite -> Project log/procedure.

## Completion tracking

Record implementation/test evidence before changing phase status. A phase completes only when its exit criteria and matching `../../Development_Plan.md` gate pass.
