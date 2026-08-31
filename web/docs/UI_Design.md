# P.A.T.C.H. UI Design System

## Design direction

P.A.T.C.H. is an operational desktop/tablet interface used during equipment work, often under time pressure. The visual system is restrained and scan-first: deep-navy navigation, quiet pale work surfaces, compact white operational panels, one bright-blue interaction colour, and explicit semantic states. The supplied sidebar and Chat title bar are the binding references.

Assumptions derived from the supplied references:

- The full-height sidebar remains visible on supported desktop widths and becomes a labelled drawer on tablet.
- Page identity belongs in the title bar, not in large decorative hero content.
- User identity/profile controls do not appear in the title bar; Settings owns them.
- Dark mode changes surfaces/foregrounds while preserving blue and semantic meaning.

## Canonical application shell

Build `AppSidebar` and `PageTitleBar` once. Every visual reference and production route uses these components.

### AppSidebar

```text
P.A.T.C.H.

Home
Equipments
Projects
Documents
────────────
Chat                 collapse control
+ New chat
Today
  auto-titled sessions with time
Yesterday
  auto-titled sessions/date
Earlier this week
  auto-titled sessions/day

Settings
Help & support
```

- Exact top-level order is Home, Equipments, Projects, Documents. Maintenance logs are not top-level.
- Rail width is one token across pages; items, icons, indentation, session row height, selected state, dividers, scroll behavior, and bottom actions do not vary by route.
- Current route/session uses the same bright-blue selected treatment. Hover, focus, and selected are visibly distinct.
- Chat history scrolls independently when required; Settings/Help remain anchored.
- Canonical desktop reference artboard is 1440x900 with a 205px sidebar. Sidebar width never changes by route.

### PageTitleBar

- 56px desktop height, white/light surface or corresponding dark surface, bottom divider. Content uses a 24px desktop gutter beneath it.
- Left: page/session title and optional compact status such as `Auto-generated`.
- Right: page actions are optional. Favourite means saving a Chat/entity shortcut; share/export appears only for an accessible source/entity/Chat export; overflow contains secondary actions for an existing record. Creation, processing, directory, Home, and Settings title bars show no placeholder action cluster.
- Never place avatar, user name, email, role, or profile dropdown here.
- Content begins immediately below; every page aligns to the same content origin/grid.

## Design tokens

The definitive swatches are in `../ui-design/foundations/color-palette.webp`.

### Light theme

| Token | Value | Use |
|---|---|---|
| `nav` | `#08233F` | Sidebar |
| `accent` | `#087BEE` | Primary actions/selected route/focus |
| `canvas` | `#F5F9FE` | Main workspace |
| `surface` | `#FFFFFF` | Panels, fields, title bar |
| `text` | `#0B2440` | Primary text |
| `textMuted` | `#52647A` | Secondary metadata |
| `border` | `#DCE7F2` | Dividers and control/panel boundaries |

### Dark theme

| Token | Value | Use |
|---|---|---|
| `nav` | `#061A30` | Sidebar |
| `accent` | `#2994FF` | Selected/focus/primary |
| `canvas` | `#0D1826` | Main workspace |
| `surface` | `#142235` | Panels, fields, title bar |
| `text` | `#F2F7FC` | Primary text |
| `textMuted` | `#A9BACD` | Secondary metadata |
| `border` | `#2A3B50` | Boundaries |

### Semantic states

| State | Light colour | Required text examples |
|---|---|---|
| Success/current | `#15803D` | Healthy, Active, Approved, Indexed |
| Attention | `#D97706` | Warning, Needs review, Profile stale |
| Danger/failure | `#C2410C` | Failed, Rejected, Conflict |
| Information | `#087BEE` | Extracting, Indexing, Auto-generated |
| Neutral | `#52647A` | Draft, Superseded, Not indexed |

Never communicate a state by colour alone. Use one shared `StatusBadge` with icon, label, size, radius, and dark-theme mapping.

## Component system

- **Typography:** one workhorse UI family; 14-16px body; clear title/section/table hierarchy; no decorative display styles or excessive uppercase tracking.
- **Icons:** one outline icon set with consistent stroke/size. Do not mix filled, illustrated, and outline families.
- **Buttons:** primary blue, secondary outlined, tertiary text, danger confirmation. Same heights/radii/loading/disabled/focus behavior everywhere.
- **Fields:** shared label, helper, error, optional/recommended/required markers. Project description shows required; Equipment description shows optional/recommended.
- **Panels:** use border or elevation, not both. 12px radius; nested cards are avoided when a table, split pane, or section divider is clearer.
- **Tabs:** entity workspace tabs share one component and order. Project tabs include Overview, Equipments, Documents, Maintenance logs, Procedures, Members, Activity.
- **Tables/lists:** sticky headers when useful, consistent filters/empty rows, row actions in one overflow pattern.
- **Drawers:** Evidence Used, upload/version review, and Project log editing share widths, close behavior, title structure, focus trap, and tablet sheet adaptation.
- **Version indicator:** one component displays current revision, approval/index state, activation time, and historical versions.
- **Inclusion badge:** Direct Project or From Equipment · `<name>` explains Project document composition.
- **Review-need badge:** `Low`, `Moderate`, `High`, or `Severe review needed`, always with icon/text and an adjacent analysis that names coverage, conflicts, freshness, applicability, and hardware criticality. It is never labelled “safe” or “approved.”
- **Procedure step editor:** ordered step number, drag handle, editable title/instructions, citation chip, required flag, overflow actions, changed-since-generation state, and keyboard Move up/Move down controls.
- **Run completion control:** large labelled check control with actor/time/note. It appears only in an execution run, not in the definition editor.

## Document UX

Equipment and Project workspaces each have a dedicated Manage documents page with:

- `Add new document` and `Add new version` as separate actions;
- logical-document list with current active version and history;
- target entity/inclusion path;
- processing timeline: Upload -> Extract -> Review -> Approve -> Index -> Active;
- failed-index copy confirming the previous active revision remains in use;
- generated document-summary/coverage preview used to build entity profiles;
- Project inherited Equipment documents shown read-only at the Project-link level, with navigation to the owning Equipment document manager;
- `Profile fresh`, `Profile refreshing`, or `Profile stale` status as operational metadata, not a safety badge.

Creation wizards reuse this component in a bounded Documents step and provide `Skip for now`.

## Procedure UX

- Project creation immediately shows procedure generation state. `WAITING_FOR_SOURCES` explains that the required description is saved but at least one approved/indexed direct Project source is still needed; generation resumes automatically after source activation.
- `QUEUED`, `GENERATING`, `READY`, and `FAILED` use the shared processing/status grammar and accessible announcements. Retry uses the same Project input fingerprint; generation never silently overwrites an edited draft.
- The generated draft editor leads with title, AI-generated marker, review-need badge, topic coverage, generation time, and View generation analysis. The analysis is a compact factual panel, not an opaque percentage.
- Steps are directly editable and reorderable. Drag handles have keyboard equivalents; add/remove/duplicate actions preserve stable step IDs. Changing generated wording marks its citation binding `Needs review` until revalidated.
- Owner approval and publication are distinct. Severe blocking findings disable Publish and link directly to the unresolved source/coverage issue. Published definitions are read-only; Edit creates a new draft version.
- Recurrence settings use a validated cadence/preset or advanced rule, IANA timezone, effective date, optional end, assignment, and next-run preview.
- The run screen repeats the published step wording/citations but removes definition editing/reordering. Ticks update only the current occurrence and show who/when; required incomplete steps keep Complete run unavailable unless an explicit audited exception policy applies.
- On recurrence, one new unchecked run opens per period. Current-period dates, next reset, progress, overdue state, and completion history are visible together. Previous ticks are never cleared or rewritten.

## Chat pattern

- Sidebar retains date-grouped sessions and New chat exactly as the supplied reference.
- Centre pane uses the canonical title bar, transcript, follow-up prompts, assignment chips, and fixed multiline composer.
- `@` supports Documents, Equipments, Projects, and supported entities.
- Retrieval progress may say “Finding relevant Equipments and current sources” but must not expose chain-of-thought.
- Inline citation chips focus the Evidence Used drawer. Evidence cards show active document title, revision, page/section, approval state, excerpt, inclusion path, and Open source.
- Entity profiles may appear only in a transparent “Searched in” scope summary; they are never listed as evidence.

## Settings page

Settings is the only profile-management surface:

- profile: display name, work email (read-only if identity-provider owned), avatar/initials, optional job title and support contact;
- appearance: Light, Dark, System with preview tiles and immediate persisted application;
- accessibility: reduced motion and density preferences if included in MVP;
- account/session actions and support links;
- save/success/error states using shared controls/badges.

## Asset structure

```text
ui-design/
  foundations/color-palette.webp
  components/
    app-shell/canonical-shell.webp
    chat/evidence-used-drawer.webp
  app/
    (public)/sign-in/session-expired.webp
    (authenticated)/
      page/dashboard.webp
      equipments/
        directory.webp
        new/
          details.webp
          documents.webp
        [equipmentId]/
          overview.webp
          documents/manage.webp
      projects/
        discover-and-request.webp
        new/
          details.webp
          documents.webp
        [projectId]/
          workspace.webp
          documents/manage.webp
          maintenance-logs/workspace.webp
          procedures/review.webp
          procedures/recurring-run.webp
      documents/
        library.webp
        processing-state.webp
        upload-review.webp
        [documentVersionId]/source-viewer.webp
      chat/[conversationId]/session-chat.webp
      settings/settings.webp
```

See `UI_Implementation.md` for phase mapping and route exit criteria.
