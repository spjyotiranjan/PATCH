# UI and backend integration

## Status and boundaries — 22 September 2026

All application routes use authenticated Web REST or the Web Chat gateway. The
browser never calls FastAPI, MongoDB, Pinecone or model providers directly. The
existing API contracts, backend authorization and human-review rules are unchanged.
Historical `lib/mockapi/` fixtures are not imported by running application routes.
No new dependency, environment setting, database migration or AI schema is required.

The implementation is not a declaration that all product acceptance gates passed.
Automated browser tests intercept API/socket responses. The full hosted flow,
representative source/SME checks, complete accessibility and visual-regression
acceptance still need a separately recorded run.

## Connected workflows

| UI area | Implemented connection and behavior |
| --- | --- |
| Sign-up / sign-in | Four-field email/password registration, actual NextAuth session, protected navigation and sign-out. No seeded credentials, fake user IDs or successful registration after persistence failure. |
| Home / sidebar | Accessible Equipment, Project and document records; persisted, date-grouped chat sessions. Counts come from returned lists, not a global analytics endpoint. |
| Equipment | Directory, discovery/manage-access request, create, details, update, owner delete, owner request decisions/revocation, real operational state and retrieval-profile state. |
| Projects | Directory/discovery, membership request/decision/revocation, required description, create/update/delete and included Equipment selection. Owners mutate; Members read. |
| Entity document managers | Composed logical-document links, direct versus inherited sources, link/unlink without file duplication, add original/add immutable revision, existing source navigation. |
| Documents / source viewer | Client SHA-256, signed private R2 PUT, explicit finalization, retained upload-session retry, processing polling, immutable history, exact original PDF/text extraction comparison, explicit human approve/reject, indexed activation, archive. The old active revision remains authoritative until the backend activates a replacement. |
| Phase 7 source visuals | Current active PDF discovery, rendering, description/index status and exact image access. Discovery/description requests are explicit paid actions. Failed processing requires the documented operator recovery path. |
| Chat | Real session creation/history, authorized `@` assignments, cookie-authenticated same-origin `/ws/chat`, progress messages followed by completed validated results, evidence drawer, exact citation source access, verified visual observations and on-demand exact images. There is no invented token stream or fallback answer. |
| Chat recovery | Read persisted history after disconnect; retry the identical payload with the same `clientTurnId`. Do not automatically turn a network error into a new request. Pending saved turns are polled; worker recovery remains required for abandoned server work. |
| Maintenance logs | Project/included-Equipment scope, source-version attachments, explicit draft save, optional AI wording suggestion, user acceptance of wording, separate immutable submission and revision-conflict handling. |
| Procedure definitions | Generated candidate/version history, saved revisions, step edits/add/remove, pointer drag and keyboard Move up/down, citation selection, whole-draft revalidation, review reasons/blockers, request changes, human approval, separate publication and published-version fork. |
| Recurrence / execution | Immutable daily/weekly/monthly schedule with interval and IANA timezone, current due run, required-step checks, persisted notes/actor/time, revision checks, read-only completed/past runs and history. Definition edits never mutate a recorded run. |
| Settings | Existing persisted profile/name and theme preference APIs. |

The shared shell, theme tokens, controls and drawers are reused. Mock-era payload
models were replaced with actual backend fields/states. Shared workflow components
sit behind the existing route hierarchy; compatibility `review` and `recurring-run`
routes go to the Project procedure list until a real definition/run is selected.
`documents/upload-review` requires a real `versionId` or returns to Documents.

Signed URLs live only in transient component state. Opening or refreshing checks
current server access; a rejected refresh clears the old URL. Expiry clears the
preview. Images are fetched directly from the authorized private source URL, never
through the Next image cache/proxy. Routing profiles are labeled context, not evidence.

## UI requests not supported by the current backend

These are gaps in the earlier mock UI, **not** implemented APIs hidden behind a flag.
Do not restore simulated controls or silently drop unsupported submitted fields.

| Earlier UI feature | Current limitation / available alternative |
| --- | --- |
| Equipment manufacturer and serial number; Project code | No persisted fields in current create/update schemas. Use supported name/type/model/location/description and Project name/description/status. |
| Request organization/message and requester profile cards | Access-request contract stores the authenticated requester ID and decision, not extra form fields or enriched profile cards. |
| Full Project member / Equipment manager directory | No public list endpoint. Owner request inbox and exact-ID revocation are implemented; access is still enforced server-side. |
| Activity timeline / audit feed | Audit writes exist; a user-facing read/projection endpoint does not. |
| Maintenance priority, assignee, comments, deletion or standalone photo attachments | Not present. Existing records are DRAFT/SUBMITTED, with immutable submitted wording and authorized source-version attachments. They are not OPEN/COMPLETED maintenance tasks. |
| User-triggered profile refresh or failed-job retry | Worker/operator procedures exist, but no public end-user retry action. A refresh button reads state only. |
| Favorite/shared chat and export actions | No favorites/sharing/export API. Opening an exact published procedure source is supported; this is not a generic export capability. |
| Schedule assignee, end date, editing or next-run preview | Current contract creates an immutable recurrence preset and opens the current due period; no dedicated next-run preview or schedule-update endpoint is exposed. |
| Overview percentages, enriched aggregate health/coverage/activity metrics | Do not synthesize numbers. Current UI shows actual record states and returned-list counts. |

These limitations do not justify inventing another role, relaxing authorization or
changing a physical/safety workflow. Product decisions and contract changes must
precede any backend expansion.

## Verification

From `web/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm test` includes browser transport/lifecycle tests and the real loopback
Web-to-FastAPI REST/WebSocket contract suite with isolated providers. Install the
AI environment first as described in `Setup_Guide.md`.

The Playwright suite uses installed Google Chrome and the custom Web server at
`http://localhost:3000`. It intercepts all product API calls and test WebSockets:
it does not create hosted accounts, authorize real sources, publish real procedures
or consume model credits. Test traces/screenshots stay under the OS temporary
directory `patch-ui-playwright`, not in this repository. Fixtures belong to
`web/e2e/` and `web/test/`, not the removed manual-testing folder.

Covered browser scenarios include auth redirect, Equipment edit, Project creation,
original upload/review, socket Chat/citations, log draft/submission, separate human
procedure approval/publication, severe blockers, Member restrictions, audited run
completion, access-denied errors, stale edits, exact-image revocation, unsafe-answer
suppression and tablet layout. These tests check UI behavior against controlled
responses; backend authorization/state-machine suites test the server separately.

## Hosted browser acceptance still to run

### Recorded verification (22 September 2026)

- Web TypeScript and production build pass; 154 tests pass, including loopback
  FastAPI transport, auth failure, source access and safe Mongo diagnostics.
- All 15 deterministic Chrome browser scenarios pass. No hosted records or paid
  model calls were made by those scenarios.
- AI OpenAPI was regenerated to remove a duplicate `securitySchemes` block; Web
  generation succeeds without a schema change. The artifact comparison now rejects
  duplicate JSON keys. All six focused AI system/contract tests pass; Ruff,
  formatting, mypy and pyright pass.
- The full AI suite is **not green in this environment**: 139 pass, two tests still
  reference PDFs from the deleted manual-testing folder, and 14 fail because the
  tokenizer's public data is absent from cache and network access is denied. The
  evaluation runner is blocked by that same tokenizer prerequisite. These are not
  reported as successful AI acceptance or silently skipped.
- `npm audit` could not reach its advisory endpoint; no fresh security-clean claim
  is made. No dependency versions were changed.
- Aggregate runtime readiness still returns HTTP 503. AI liveness responds; direct
  Mongo diagnosis sees SRV/TXT DNS timeouts even with IPv4 configured. Diagnostics
  ran under restricted execution, so a normal-terminal check is needed to establish
  the user's actual connection failure. Safe server-console categories were added;
  no credentials, TLS rules, resolver settings or URI seeds were changed.

### Acceptance procedure

1. Follow `Setup_Guide.md`; start Web, AI and the worker. Use the exact configured
   application origin. Check aggregate readiness; never expose credentials.
2. Register/sign in as an Owner. Use a second real account for Equipment requests,
   Project membership, approvals and revocations. Confirm unauthorized access fails
   both from navigation and copied URLs.
3. Create Equipment and a Project, including that Equipment. Exercise both skip
   documents and add-now. Reload the pages and confirm the records persisted.
4. Upload an authorized, reviewed PDF. Check upload/finalization, extraction and
   original comparison. A human must decide whether extraction matches before
   approval. Confirm indexing/activation and shared-source propagation.
5. Add a revision to the same logical document. Confirm the old source remains
   active until success, current links propagate, and old history remains readable.
   Exercise a denied/failed upload and a processing outage without false success.
6. With Phase 7 enabled/configured as documented, discover meaningful figures,
   inspect exact pixels and processing states. Ask both text-only and image-relevant
   questions. Verify every rendered image and citation against the approved source.
   Test access revocation, outdated versions and unavailable visual evidence.
7. Ask Chat with and without assignments. Disconnect/reconnect once, inspect saved
   history and retry the same turn only if needed. Confirm no duplicate persisted
   question or unverified answer. Open response-scoped source citations.
8. Save a Project log, review any suggested wording and submit deliberately. Test a
   stale revision in two tabs; preserve unsaved wording before reloading.
9. Inspect a generated procedure against its approved sources. Edit/reorder, save,
   revalidate and review. A responsible human must approve publication separately;
   a severe blocker must prevent publication. Test a new version without altering
   the published definition or old run.
10. Create a recurrence and open its due run. Ticks must represent work actually
    performed (or clearly isolated synthetic test work). Verify required-step
    gating, notes, immutable completion and retained period history.
11. Check desktop/tablet/mobile layout, keyboard-only actions, drawer focus return,
    theme persistence, empty states and AI outages. Record redacted outcomes outside
    the repository; no cookies, signed URLs, credentials or private sources.

Record this hosted evidence before closing synchronized phase gates. Browser
contract tests and historical backend checks must not be reported as a new hosted
UI/provider acceptance run.
