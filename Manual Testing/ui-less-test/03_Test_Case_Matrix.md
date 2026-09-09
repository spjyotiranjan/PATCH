# Scenario test-case matrix

Copy the result table for each run. Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`.
Synthetic success is not representative/SME acceptance.

## Run metadata

| Field | Value |
| --- | --- |
| Commit/diff | |
| Date/timezone | |
| Tester | |
| Dataset revision | `ui-less-test-v1` |
| Web/AI contract | `v1` |
| Mongo/R2/Pinecone environment | Redacted development identifiers only |
| Entity routing | Enabled / disabled |
| Tesseract version | |

## Cases

| ID | Area | Scenario | Expected result | Result | Safe evidence/request ID |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Auth | Sign up Owner with four permitted fields | 201; no password/hash returned | | |
| AUTH-02 | Auth | Sign in then inspect session | Intended actor is authenticated | | |
| AUTH-03 | Auth | Mismatched confirmation | 400 stable error | | |
| ACL-01 | Equipment | Owner creates P-101/VFD-101/PT-101 | Creator owns each record | | |
| ACL-02 | Equipment | Technician request approved for P-101 only | Can mutate P-101, not VFD-101/PT-101 | | |
| ACL-03 | Project | Technician membership approved | Can read, cannot mutate Project | | |
| ACL-04 | Negative | Unrelated actor reads Project/document | Safe 403/404; no content leak | | |
| DOC-01 | Upload | Project basis signed upload/finalize | Exact bytes/type/hash accepted | | |
| DOC-02 | Extract | Project basis extraction | Native text; all pages reviewable | | |
| DOC-03 | Index | Approved basis indexed/activated | Active only after successful index | | |
| DOC-04 | Composition | P-101 source inherited by Project | Same document/version; no copy | | |
| DOC-05 | Idempotency | Repeated activation/link | No duplicate state/event | | |
| DOC-06 | Failure | Wrong hash or byte length | Typed failure; no activation | | |
| DOC-07 | Failure | New version indexing fails | Previous active version remains current | | |
| OCR-01 | OCR | Image-only shift card extraction | Tesseract path; quality 0.6 | | |
| OCR-02 | Review | Compare OCR tokens with original | CW-17, 3.1 bar(g), PT-101, date exact | | |
| OCR-03 | Safety | Misread token remains unapproved | No vector/citation from bad OCR | | |
| MM-01 | Mixed PDF | Retrieve written 4-20 mA caption | Cited text-grounded answer | | |
| MM-02 | Visual limit | Ask anomaly-marker colour | No grounded colour claim | | |
| CHAT-01 | REST | Ask target pressure/instrument | Current authorized citations only | | |
| CHAT-02 | Socket | Project question event sequence | ready/accepted/processing/completed | | |
| CHAT-03 | Replay | Exact clientTurnId/body replay | Saved turn; no duplicate generation | | |
| CHAT-04 | Conflict | Same ID, changed content | 409/idempotency error | | |
| CHAT-05 | Scope | Inaccessible assignment | Rejected; scope never broadened | | |
| CHAT-06 | Fallback | Stale/missing profile | Structural scope still retrieves active source | | |
| CHAT-07 | Revision race | Activate replacement during answer | Old version not persisted as current | | |
| CHAT-08 | Revocation race | Revoke access during answer | Newly unauthorized result discarded | | |
| LOG-01 | Log | Create Equipment-scoped Project draft | Included Equipment accepted | | |
| LOG-02 | Log | Non-included Equipment scope | Rejected | | |
| LOG-03 | Log | Submit reviewed wording | Immutable submitted record/audit | | |
| PROC-01 | Procedure | No direct Project source | WAITING_FOR_SOURCES; no fabricated steps | | |
| PROC-02 | Procedure | Basis active | One saved candidate per fingerprint | | |
| PROC-03 | Evidence | Inspect every procedure step | Exact current citation or explicit gap | | |
| PROC-04 | Safety | Missing machine-specific isolation | Severe/gap can block publication | | |
| PROC-05 | Edit | Change step meaning | Citation state NEEDS_REVIEW | | |
| PROC-06 | Revalidate | Whole draft after edit/reorder | Exact per-step bindings required | | |
| RUN-01 | Recurrence | Create current due run twice | One run per procedure/period | | |
| RUN-02 | Completion | Complete with required step unchecked | Rejected | | |
| RUN-03 | History | New period | New unchecked run; old history unchanged | | |
| OPS-01 | Worker | Stop/restart worker | Queue retained and resumes | | |
| OPS-02 | AI outage | Ask question with AI stopped | Unavailable; source browsing still works | | |
| OPS-03 | Dead letter | Exhaust bounded failing job | Dead-letter; prior active source unchanged | | |
| OPS-04 | Retry | Fix cause and reasoned retry | Audited recovery; no duplicate commit | | |
| SEC-01 | Input | Oversized/invalid JSON/socket frame | 413/400/bounded socket error | | |
| SEC-02 | Injection | Source asks to ignore scope/publish | Treated as data; no boundary change | | |
| OBS-01 | Telemetry | Correlate Web/AI/worker request IDs | Metadata only; no source/secrets | | |

## Sign-off notes

- Representative PDF/DOCX/OCR and subject-matter review: 
- Hosted version-race/recovery evidence: 
- Owner publication and recurrence evidence: 
- Backup/restore and telemetry collector receipt: 
- UI integration: separate gate, not inferred here.
