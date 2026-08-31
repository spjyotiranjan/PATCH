# Design System

## Direction contract

**THESIS:** One operational shell makes urgent technical work predictable; page content changes, navigation and control grammar do not. The system rejects route-specific sidebars, profile-heavy top bars, and decorative dashboards.

**OWN-WORLD:** Deep navy rail, pale blue-gray workspace, white operational surfaces, one bright-blue action/selection colour, outline icons, compact evidence/status labels, and restrained boundaries.

**STORY:** A technician identifies an Equipment or Project, manages current sources, asks a question, inspects evidence, and records Project work without losing context.

**FIRST VIEWPORT:** Fixed sidebar at left, 56px title bar above, task content aligned to one grid, primary action near the page title/content start, and drawers reserved for evidence/editing.

**FORM:** Operate-mode desktop/tablet application based on the user-supplied sidebar and Chat title-bar references.

## Product terminology

- User-facing plural is `Equipments`.
- Primary entity labels are Equipment and Project.
- Maintenance logs exist only inside a Project.
- Document and document version are distinct concepts in copy and controls.

## Application shell

### Sidebar

- Fixed 205px rail on the canonical 1440x900 desktop capture; labelled drawer on tablet.
- Order: Home, Equipments, Projects, Documents; divider; Chat/New chat/date-grouped sessions; Settings and Help & support at the bottom.
- No top-level Maintenance logs item.
- One width, spacing scale, icon size/stroke, row height, selected state, scroll region, and focus style across every route.

### Title bar

- 56px high with a bottom boundary and a 24px desktop content gutter.
- Page/session title and optional compact status at left.
- Contextual actions only at right. Favourite saves an existing Chat/entity shortcut; share/export requires an exportable accessible record; overflow is for existing-record secondary actions. Creation, processing, directory, Home, and Settings screens show none.
- No avatar, user identity, role, email, or profile dropdown.

## Colour tokens

| Role | Light | Dark |
|---|---|---|
| Navigation | `#08233F` | `#061A30` |
| Accent/selected/focus | `#087BEE` | `#2994FF` |
| Canvas | `#F5F9FE` | `#0D1826` |
| Surface | `#FFFFFF` | `#142235` |
| Primary text | `#0B2440` | `#F2F7FC` |
| Muted text | `#52647A` | `#A9BACD` |
| Boundary | `#DCE7F2` | `#2A3B50` |
| Success/current | `#15803D` | theme-adjusted accessible equivalent |
| Warning/review | `#D97706` | theme-adjusted accessible equivalent |
| Danger/conflict | `#C2410C` | theme-adjusted accessible equivalent |

`web/ui-design/foundations/color-palette.webp` is the rendered token reference.

## Typography and layout

- Use one production UI family and a clear size/weight hierarchy; do not mix display styles.
- Body copy is 14-16px at desktop/tablet; table metadata may be smaller only when contrast and density remain readable.
- Main content begins at the same x/y grid beneath the title bar.
- Panels use 12px radius and either a boundary or elevation, never both.
- Prefer sections, split panes, tables, and dividers to stacks of nested cards.

## Shared components

- `AppSidebar`, `PageTitleBar`, `StatusBadge`, `Button`, `Field`, `Tabs`, `DataTable`, `Drawer`, `VersionIndicator`, `InclusionBadge`, `CitationChip`, `SourceCard`, and `ProcessingTimeline` are single shared implementations.
- Icons come from one outline family and retain one stroke/optical size system.
- Badges always combine icon, text, and semantic colour.
- Buttons share heights, radii, loading, disabled, destructive, hover, and focus behavior.
- Drawers share widths, title/close pattern, focus trap, and tablet sheet adaptation.

## Entity and document patterns

- Project tabs: Overview, Equipments, Documents, Maintenance logs, Procedures, Members, Activity.
- Equipment tabs: Overview, Documents, Projects, Activity.
- Project description is required; Equipment description is optional and marked recommended for routing.
- Creation Documents steps show Add documents now and Skip for now.
- Manage documents always separates Add new document from Add new version.
- Project documents visibly distinguish Direct Project from From Equipment and explain live propagation.
- Processing uses Upload, Extract, Review, Approve, Index, Active. Failure copy confirms the prior active revision remains available.

## Procedures

- The Procedures tab distinguishes a versioned **procedure definition** from a dated **procedure run**. Editing/reordering changes a draft definition; ticking steps changes only the current run.
- After Project creation, show `Waiting for Project sources`, `Generating`, `Generated draft`, or a typed failure with retry. Generation requires the Project description plus at least one approved/indexed direct Project source.
- Generated drafts display `Low`, `Moderate`, `High`, or `Severe review needed` with icon and text. The adjacent analysis explains coverage, conflicts, freshness, applicability, and hardware criticality; it never presents confidence as safety approval.
- Definition steps provide a drag handle plus keyboard-accessible Move up/Move down, editable title/instructions, Add/remove step, per-step citations, and a changed-since-generation marker. Published versions are immutable; edits create a new draft version.
- Run steps use large labelled completion controls. Each tick records actor/time and optional note. Required incomplete steps prevent normal completion unless an audited exception policy permits it.
- A recurring schedule creates one run per timezone-aware period. The new run starts unchecked; prior ticks, notes, exceptions, and completion timestamps remain in history.

## Chat and evidence

- Chat retains the canonical sidebar session history, transcript, assignment chips, evidence drawer, and fixed composer.
- “Searched in” entity information is routing transparency, not evidence.
- Source cards show active revision, page/section, approval/index state, inclusion path, excerpt, and Open source.
- Confidence scores never replace source state or citations.

## Settings and themes

- Settings owns profile editing, theme selection, accessibility preferences, account actions, and support.
- Light, Dark, and System are explicit choices with preview tiles and immediate persisted application.
- Dark mode preserves structure and semantic roles rather than simply inverting colours.

## Accessibility and responsive behavior

- Meet WCAG AA contrast for body, labels, controls, focus, and statuses.
- Provide complete keyboard navigation, visible focus, semantic headings/tables/forms, and live status announcements.
- Do not use colour alone for state.
- On tablet, sidebar becomes a labelled drawer and secondary evidence/edit panels become accessible side/bottom sheets without hiding critical context.

## Visual references

- Canonical shell: `web/ui-design/components/app-shell/canonical-shell.webp`
- Palette: `web/ui-design/foundations/color-palette.webp`
- Complete route references: `web/ui-design/app/`
- Phase mapping and exit criteria: `web/docs/UI_Implementation.md`
