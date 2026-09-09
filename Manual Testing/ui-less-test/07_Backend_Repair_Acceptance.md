# Backend repair acceptance - 8 September 2026

## Outcome

The three findings in [the original live report](06_Live_Backend_Acceptance.md)
have targeted fixes and passing real-service regression evidence. No UI code was
changed, and no commit or publication was made during this repair task. This is
acceptance of these fixes, not SME certification or global Phase 3-6/UI sign-off.

## Causes and fixes

| Finding | Observed cause | Implemented correction |
| --- | --- | --- |
| Scanned-document failure | Tesseract executable missing; the old loader only OCRed extracted images on low-text pages | Installed Tesseract 5.5.3 in a dedicated per-user directory after verifying the official release checksum. Added configured discovery/languages and aggregate readiness checks, locked pypdfium2 full-page rendering, bounded OCR, physical page anchors and mixed-page raster-label extraction. |
| Missing factual answers | Real diagnostic retrieval contained 4.2 bar(g), PT-101 and 4-20 mA. Generation interpreted test-only disclaimers as grounds for incomplete/outdated answers; independent verification also lacked the question | Shared question-aware evidence instructions and current/approved provenance distinguish qualified document facts from authorization for physical operations. Both generator and verifier receive the question; negative results are not force-promoted in code. |
| Blanket HIGH revalidation | `critical=True` was unconditional in revalidation | Assess actual instructions using a shared rubric. Generation verification, per-step revalidation and whole-draft assessment all evaluate criticality; any high-criticality finding is retained. Coverage/conflict/safety blockers still determine SEVERE. |

The PDF skill's visual comparison exposed an additional OCR omission: the initial
colour-to-grayscale pass missed the yellow test-only warning. A bounded colour
contrast pass now adds that line without replacing primary measurements. The exact
reviewed card transcription includes `CW-17`, `3.1 bar(g)`, `PT-101`,
`2026-08-14 09:40 IST`, `NONE - observation only`, and the no-physical-maintenance
warning. OCR still requires review; it is not guaranteed complete or error-free.

A live negative review also exposed why whole-draft criticality alone was
insufficient: the software-only Project description could overshadow an added
physical-maintenance instruction. Publication was already blocked, but its
criticality label was wrong. Per-step assessment now retains HIGH even when
the whole-draft assessment focuses on the document-only Project purpose.

## Executed live regressions

Tests reused isolated `TEST live-20260908` records, actual Web REST/WebSockets,
FastAPI, hosted MongoDB, private R2, OpenAI and Pinecone. No database shortcuts or
mock providers were used for these checks. Raw captures/cookies stay in OS temp.

| Check | Result |
| --- | --- |
| Local parser pack | All seven PDFs parsed: four native/mixed fixtures, scanned card, DOE 122 pages, OSHA 45 pages. Native-only fixtures retain quality 1.0; OCR/mixed pages are 0.6. No model calls in this parser-only check. |
| Hosted OCR card | Real upload, extraction, exact original/transcription comparison, approval, index and separate activation passed. Current version `6a9faed19e870a66574885b8`. |
| Hosted OSHA reference | All 45 pages extracted at minimum quality 0.6. Version `6a9faed49e870a66574885be` remains NEEDS_REVIEW; no automatic approval of real safety reference content. |
| Original pressure question | WebSocket returned 4.2 bar(g), PT-101 and 4-20 mA with current citations and explicit synthetic-data qualification. Full ready/accepted/processing/completed sequence. |
| Original signal question | REST returned the documented 4-20 mA signal with exact page-1 source citation and qualification. |
| OCR-grounded Chat | WebSocket returned CW-17, 3.1 bar(g), and no action performed/observation only, citing page 1 of the active OCR card. |
| Unsupported operation request | A request for energized repair/interlock bypass returned a negative evidence state with zero claims/citations; no invented operating instructions. |
| Document-only revalidation | Forked synthetic published definition, invalidated its review, revalidated unchanged steps: LOW, NORMAL criticality, COMPLETE coverage, no blockers, all bindings confirmed. Final draft `6a9ff6fe9e870a66574885fc`; not published. |
| Physical-action negative review | Separate changed draft with an unrelated citation remained unsupported: HIGH criticality, SEVERE review, blocking findings. Actual approval rejected with HTTP 409 `PROCEDURE_EVIDENCE_BLOCKED`. Version `6a9fb1629e870a66574885f7`; never published. |

Safe request identifiers:

- Pressure: `71c687e0-a0d2-408a-beec-1b1b6481a58f`.
- Signal: `aaad3e97-7a72-479a-a0be-0fdca0a91490`.
- OCR question: `72d77700-84ce-4693-8fc5-6e94985c6874`.
- SEVERE approval rejection: `cbb7a057-dd62-4b75-9e3f-ccd8d65eecf1`.

The original two OCR-failed jobs were explicitly selected for audited retry after
runtime verification; both completed successfully without bypassing source review.
The final queue inspection had no pending/running jobs and two retained
wrong-checksum dead letters (172 completed jobs across all runs, not 172 tests).
The deliberately wrong-checksum fixtures are not retry
candidates and remain retained negative-test records. No historical source,
published version, audit record or prior test finding was deleted.

## Automated and integration gates

- AI: 80 tests pass; Ruff lint/format, mypy and Pyright pass.
- Web: 81 tests pass, including loopback cross-service REST/WebSocket contracts;
  lint, typecheck and production build pass; npm audit reports zero vulnerabilities.
- Synthetic baseline/hierarchical evaluation guard gate passes; this is not an
  actual-model groundedness score or authorization to enable profile routing.
- OpenAPI exported and Web types regenerated; public payload shape is unchanged.
- uv dependency compatibility check passes with the locked renderer.

One full-suite invocation encountered a pre-existing Windows pytest temp-directory
permission error. A fresh dedicated OS-temp directory passed the full suite;
ordinary local runs also pass. A negative test initially sent an empty citation
list, which the existing Web schema correctly rejected with 400. It was corrected
to use an existing but unrelated citation; this was a test setup error, not an app
validation failure. Intermediate calibration failures remain documented above.

## Reproduce and operate

Follow [Setup_Guide.md](../../Setup_Guide.md) for Tesseract discovery/configuration,
language data, parser checks and startup. Keep Web, AI and `npm run worker` running
for normal ingestion. The live runner's `repair-upload`, `repair-review`,
`repair-chat`, `repair-revalidation`, and `repair-safety-review` stages are opt-in,
cost-bearing tests, not startup tasks. Inspect the existing queue before dispatch.
The exact-ID `repair-retry-ocr` stage belongs only to this recorded historical run.

No active source extraction was rewritten in place. Parser pipeline 2 is used for
new processing; reprocessing an already-reviewed source requires a new immutable
version and fresh review/approval before activation. Failed never-approved
extractions can use audited retry. Configuration defaults are in the AI template;
existing secrets were not changed or exposed.

Web and AI were left running on their usual local ports. There is no continuous
worker loop started by these tests; run `npm run worker` inside `web` for subsequent
normal use. Private diagnostics and test credentials remain outside the repository.

## Remaining acceptance boundary

These fixes unblock the tested OCR/document-fact/review workflows for UI
integration. Still required for full product acceptance: UI/CORS/rendering tests,
representative SME review, broader source-injection/groundedness evaluation,
sustained/concurrent load and the other operational gates from the original
report. OCR does not infer diagram relationships or colour; there are no image
embeddings, region citations or separately addressable image assets. Original
PDFs remain available through freshly authorized source access.
