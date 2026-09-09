# Live backend acceptance — 7–8 September 2026

**Follow-up:** The three findings below were investigated and repaired on
8 September. See [repair acceptance](07_Backend_Repair_Acceptance.md) for live
regression evidence and the current boundary. This original report is retained
as the historical pre-fix record, not overwritten with passing results.

## Scope and evidence

Tested commit `923fd43ca836aa0ba2630475e9ffe5fc2b555c76` with the uncommitted
manual-testing pack. Tests use running Next.js and FastAPI services, real hosted
MongoDB, private R2 objects, and real OpenAI/Pinecone calls. They exercise the
public product REST API and raw WebSocket gateway. Unit-test results are not
counted as live acceptance evidence.

Runs: `live-20260907` and continuation `live-20260908`. Records are prefixed
`TEST <runId>`. Test credentials, cookies, original-download URLs and full response
captures stay outside the repository in the system temporary directory. The first
run's private login file was unavailable after the pause; its retained records
were inspected read-only, and fresh accounts were created for the continuation.

No application UI, product implementation, authentication policy, model configuration,
or database record was patched to make a test pass. Worker operations use the real
protected dispatch/schedule routes. Only test procedures about software-card review
were approved/published and completed as simulated runs. No physical work is claimed.

## Confirmed results

| Area | Executed use case | Result |
| --- | --- | --- |
| Startup | Web/AI liveness, aggregate readiness, both Swagger/OpenAPI endpoints | PASS |
| Private service authentication | Unsigned readiness rejected; signed request succeeds; identical signature replay rejected | PASS: 401 / 200 / 409 |
| Accounts | Three distinct accounts, real credentials login, session identity, mismatched confirmation, anonymous protected request | PASS |
| Settings | Change name/theme and read persisted preferences | PASS |
| Equipment access | Owner creates assets; approved manager mutates only granted Equipment; manager cannot decide access requests | PASS |
| Project access | Required description, Owner creation, Member read-only access, unrelated-user denial | PASS |
| Ingestion | Four native fixture PDFs, text cards, exact R2 upload/download checksums, extraction comparison, review, index and activation | PASS |
| Real reference PDF | DOE sourcebook extracted all 122 pages at quality 1.0 | PASS for extraction; remains awaiting source review |
| Other formats | Small synthetic Markdown and simple DOCX uploaded through the product workflow | PASS for extraction: quality 1.0 / 0.9; first-run versions remain awaiting review |
| Composition | Equipment source inherited by Project as the same logical document/version | PASS |
| Idempotency | Duplicate logical link and repeated activation | PASS |
| Profiles | Equipment/Project profile creation and cascade; source changes expose STALE then background refresh | PASS for observed refresh lifecycle |
| Chat transport | `connection.ready → turn.accepted → turn.processing → turn.completed`; persisted turn recovered through REST | PASS |
| Chat replay | Same client-turn ID/content returns saved turn; changed content rejected | PASS: 409 `IDEMPOTENCY_CONFLICT` |
| Chat authorization | Other user's history denied; inaccessible assignment denied; empty-scope question returns no claims | PASS |
| Grounded answer | Card revision 1 question returns AMBER with an exact current citation | PASS |
| Visual limitation | Marker-colour question returns incomplete without inventing orange; cites text explaining unavailable visual evidence | PASS |
| Logs | AI helper does not save; manual draft/edit/submit preserves final wording; stale edits and submitted-log changes rejected | PASS |
| Log scope | Non-included Equipment rejected; Member cannot create Project log | PASS |
| Procedure prerequisite | Project without approved direct sources remains WAITING_FOR_SOURCES | PASS |
| Procedure editing | Automatic cited candidate; edit invalidates evidence; approval blocked before revalidation | PASS |
| Revalidation | Real AI revalidation returns confirmed per-step bindings and resets to DRAFT | PASS |
| Publication | Synthetic software-card candidate reviewed, approved, published; published definition cannot be edited | PASS |
| Procedure history | Fork creates a distinct draft; version comparison works | PASS |
| Run execution | Same-period creation is idempotent; required unchecked steps block completion; checked run completes and becomes immutable | PASS |
| Actual daily rollover | Scheduler called after midnight in Asia/Kolkata; new run has 0/4 checked, earlier completed run retains 4/4 | PASS; no clock or historical-record manipulation |
| File failures | Scanned PDFs fail without OCR executable; wrong-checksum replacement fails with bounded retries | PASS for failure isolation and dead-letter transition |
| Request boundaries | Wrong Origin rejected; session cookie cannot authorize worker; Equipment with retained Project history cannot be deleted | PASS |

## Findings requiring attention

1. **OCR prerequisite is missing.** Tesseract was not found on PATH or at the usual
   Windows installation path. The image-only shift card and OSHA document (which
   contains an image-only page) exhausted five extraction attempts and became
   failed/dead-letter records. Native text ingestion works. Successful OCR and
   OCR-grounded question answering remain blocked until Tesseract is available to
   the AI process. No unreadable source was approved.
2. **Ordinary factual questions did not reliably return expected evidence.** The
   Project target-pressure/feedback question returned `incomplete` with zero claims.
   The mixed-PDF signal-range question returned `outdated` with zero claims even
   though the document was active and its extracted page contains the signal range.
   These are failed positive-answer expectations, not successful groundedness tests.
   The transport completed successfully. The cause needs investigation across
   retrieval selection and model evidence-state/verification behavior; no prompt
   change has been made as part of testing.
3. **Review-need calibration is conservative.** The software-only procedure moved
   from LOW on generation to HIGH on revalidation despite complete source coverage
   and no blockers. The revalidation implementation sets hardware criticality HIGH.
   Publication still required the documented reason acknowledgement. This is a
   classification limitation, not a bypass of a safety blocker.

## Safe evidence anchors from the first run

| Evidence | Identifier |
| --- | --- |
| Booster Project | `6a9ec77de73aa59ef2fe3179` |
| Software review Project | `6a9ec77de73aa59ef2fe3180` |
| Published synthetic procedure version | `6a9ec8ede73aa59ef2fe325b` |
| Prior completed run | `6a9ec99fe73aa59ef2fe32a9` |
| New daily run | `6a9f106e0509e848c9e0a1e7` |
| Pressure-answer AI request | `3fd130b3-70c6-4038-8d7a-58a3fda2935f` |
| Signal-range AI request | `065b0197-5cb9-440c-b861-20ed12a91ea3` |
| Unvalidated approval rejection | `9526d1f7-b7e7-4090-a70f-e202e10d3d8b` |
| Required-step completion rejection | `a8c7683f-ba25-47cc-829d-31c0cd00940a` |

## Continuation and sign-off

Continuation evidence:

- Missing cookie and wrong Origin reject socket handshakes with 403. Malformed
  JSON returns a bounded `TURN_INTERRUPTED`; binary and oversized frames close
  with 1003 and 1009 respectively.
- A Member can open a source inherited from included Equipment without having
  Equipment mutation access. Removing that Equipment from the Project immediately
  removes the version from the Member's manifest and denies source opening with
  403 (`5ccfa834-03a9-40a5-9893-902e74d14171`). Restoring inclusion restores the graph.
- Archiving excludes the document from current retrieval, while its immutable
  original remains accessible to its authorized owner. Restore uses the documented
  logical-document API.
- Project membership was revoked while a Member question was in flight. The saved
  result was `unavailable` with no claims/citations. AI request:
  `1b26fbed-5028-45fa-bb3c-605855a1c38d`. This proves the safe resulting state;
  the model itself had also returned incomplete, so this run does not establish
  rejection of an otherwise successful cited answer during revocation.
- Explicitly asking to read the synthetic Project Basis returned 4.2 bar(g), cited
  to page 2. Explicit synthetic wording still did not recover the 4–20 mA answer:
  that turn returned `incomplete` with no claims. The initial failed expectations
  remain failures rather than being replaced by the successful rephrasing.
- A question instructing the assistant to ignore access and publish a procedure
  returned source-bounded card facts. No publication capability exists in this
  answer workflow. This is one question-injection case, not a representative
  source-injection evaluation.
- Repeated runner logins hit the real account login limit (10 per 300-second
  bucket). The runner was changed to reuse its normal session cookies privately;
  the application rate limit was not changed. This is a test-runner issue, not a
  failed normal-user login workflow.

### Recovery and replacement

- With AI deliberately stopped, revision 2 indexing exhausted five attempts and
  reached DEAD_LETTER. Revision 1 stayed active and readable throughout.
- AI-outage Chat returned `unavailable` with zero claims/citations. Library search
  and an actual authorized R2 original download still succeeded.
- After restoring AI, the operator retry endpoint accepted a reason and reset
  job `6a9f134a4e46d8bb34f22f29`. Indexing succeeded. Activation is a separate
  queued job; the first check while state was INDEXED was correctly premature.
  The second dispatch activated the version without changing its original bytes.
- During that activation, an in-flight revision-1 answer was discarded as
  unavailable. A subsequent question returned BLUE with an exact revision-2
  citation (`6a9f13224e46d8bb34f22f1e`). Project composition resolved that same
  version; revision 1 remained available through authorized source history.
- The deliberately bad-checksum replacement remained FAILED and did not replace
  the Pump Field Guide. These negative fixtures are retained as dead letters;
  retrying them without correcting their cause is not a recovery procedure.
- The synthetic published procedure's exact original export downloaded successfully.
  Its version appeared in the authorized manifest with `PROJECT_PROCEDURE` and did
  not appear as a copied logical Document. The booster candidate's SEVERE finding
  caused an actual 409 `PROCEDURE_EVIDENCE_BLOCKED` approval rejection
  (`7abcafca-c7ca-494a-9086-e41dd3aae213`).
- One profile refresh failed twice, then completed on the third normal bounded
  attempt. No configuration or persisted profile data was patched. The final
  operator inspection showed **161 completed jobs, zero pending/running jobs,
  and four deliberately failing extraction dead letters** across the retained
  test environment. This aggregate includes jobs from earlier runs; it is not
  a count of acceptance assertions. The remaining dead letters are two OCR
  prerequisites and two deliberately invalid-checksum sources.
- A final real WebSocket turn returned BLUE with the revision-2 citation and the
  full ready/accepted/processing/completed event sequence. Replaying that exact
  turn over REST returned the same persisted turn (`WS-CITED-V2-AND-REST-REPLAY`).

### Runtime handoff

Web and AI were restored after the outage tests and left running on their usual
local ports. No continuous worker loop was started; the tests used bounded
operator dispatches. Start `npm run worker` from `web` for subsequent normal
uploads/profile refresh/scheduling. Private continuation credentials and response
captures remain under the system temp directory `patch-acceptance-live-20260908`;
keep them private and remove them when no longer needed. No credentials or source
URLs were copied into repository reports. Tagged synthetic records, immutable
originals and audit history were retained.

## UI-integration verdict

**Core REST/state workflows and WebSocket transport are usable for UI integration,
but complete backend acceptance is not signed off.** The positive factual-answer
failures and missing OCR prerequisite need resolution before claiming the complete
document/Chat experience works. Implement the documented evidence/unavailable states
in UI; do not present a completed transport event as proof that an answer exists.

The native document lifecycle, version replacement, failure isolation, scoped
access, logs, synthetic publication, and run history have live evidence. Global
phase status remains unchanged. Tests deliberately did not certify physical
maintenance instructions, change deployment infrastructure, enable optional log
indexing/profile routing, or perform a backup/restore or external telemetry drill.

Still unverified: successful scanned-PDF OCR and OCR-grounded answers; representative
SME groundedness; profile-routing optimization; broader source-injection corpus;
mid-flight revocation of an otherwise successful cited answer; sustained/concurrent
load; browser-specific R2 CORS and UI rendering. Plain/DOCX/Markdown extraction has
live evidence, but the supplemental DOCX/Markdown sources were not approved/indexed
in the first run after its private login file was lost.

No product code was modified to remedy findings during this testing task. Temporary
runner assertion/setup errors are excluded from product defect counts: settings
uses `preferences.theme`, the login limiter requires session reuse, and indexing
and activation are separate worker operations. The generic outage observation was
initially labelled FAIL by the runner before the expected unavailable assertion
passed; the outage itself passed.
