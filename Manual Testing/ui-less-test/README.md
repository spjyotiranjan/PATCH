# P.A.T.C.H. UI-less backend acceptance pack

This folder is the scenario-specific companion to
[`Backend_Manual_Testing.md`](Backend_Manual_Testing.md). It provides a
realistic cooling-water booster project, safe synthetic equipment records,
multimodal PDF fixtures, expected evidence, and REST/WebSocket test cases for the
Web and AI backends when the feature UI is unavailable.

The scenario is **test-only**. Do not use its values to operate, isolate,
commission, or maintain physical equipment. The official reference PDFs are for
retrieval evaluation; they do not turn the synthetic project packet into a
site-approved procedure. Every AI-generated procedure still requires the normal
P.A.T.C.H. review, revalidation, approval, and publication workflow.

## Folder map

```text
ui-less-test/
  00_Scenario_and_Data.md
  01_REST_Swagger_Runbook.md
  02_WebSocket_Postman_Runbook.md
  03_Test_Case_Matrix.md
  04_OCR_and_Multimodal_Behavior.md
  05_Source_Provenance.md
  06_Live_Backend_Acceptance.md
  07_Backend_Repair_Acceptance.md
  pdfs/
    fixtures/
      01_Project_Basis_and_Acceptance.pdf
      02_Equipment_Register_and_Data_Sheets.pdf
      03_Pump_Inspection_Field_Guide.pdf
      04_Multimodal_Control_Loop_Diagnostic.pdf
      05_OCR_Shift_Inspection_Card.pdf
    official/
      DOE_Improving_Pumping_System_Performance.pdf
      OSHA_Control_of_Hazardous_Energy.pdf
  postman/
    PATCH_UI_Less_Local.postman_environment.json
  tools/
    generate_fixture_pdfs.py
    validate_with_ai_loader.py
    verify_pdf_pack.py
    live_backend_acceptance.mjs
    prepare_live_review.py
    diagnose_live_answers.py
```

## Recommended order

1. Complete the local setup and start AI, Web, and the worker.
2. Read `00_Scenario_and_Data.md`; create the listed Equipment and Project.
3. Follow `01_REST_Swagger_Runbook.md` to upload, review, index, and activate
   the PDFs in the specified order.
4. Use `02_WebSocket_Postman_Runbook.md` for persisted product Chat.
5. Record every result in `03_Test_Case_Matrix.md`.
6. Use `04_OCR_and_Multimodal_Behavior.md` to interpret OCR and image-related
   results correctly.

The official source files were retrieved from the publisher URLs recorded in
`05_Source_Provenance.md`. Re-download them only from those HTTPS publisher
locations and verify the recorded SHA-256 values before replacing a fixture.

To exercise the real application loader after AI dependencies are installed:

```powershell
cd ai
$env:PYTHONPATH = 'src'
uv run python '..\Manual Testing\ui-less-test\tools\validate_with_ai_loader.py'
```

The script uses the application's OCR discovery/configuration and fails if the
runtime is unavailable; it does not silently skip necessary OCR checks.

## Test identities

Create unique local-development accounts; none are seeded:

- `Booster Project Owner`: owns the Equipment and Project.
- `Reliability Technician`: requests Equipment manage access and Project
  membership.
- `Unrelated Technician`: validates authorization failures.

Keep generated passwords, cookies, signed URLs, and private response captures outside
the repository, for example in a private file under `$env:TEMP`. Never add them
to this folder, Postman exports, screenshots, issues, or pull requests.
Non-secret test-record/request IDs may be recorded in acceptance reports for correlation.

## Recorded live acceptance

See [the 7–8 September report](06_Live_Backend_Acceptance.md) for executed cases,
failures, remaining checks and the UI-integration verdict.
See [repair acceptance](07_Backend_Repair_Acceptance.md) for the subsequent OCR,
factual-answer and review-criticality fixes and real-service regression results.

`tools/live_backend_acceptance.mjs` is an opt-in real-service test client, never
part of the unit suite. It can incur provider charges and create retained test
records. Run only against an otherwise idle development environment. It dispatches
global worker jobs: inspect existing work before using it. Stages must run
sequentially because they share one private state file under the system temp directory.

From `web`, start a unique run with:

```powershell
node --env-file=.env.local '../Manual Testing/ui-less-test/tools/live_backend_acceptance.mjs' <unique-run-id> setup
```

Then use `upload`, `dispatch`, and `status`. `dispatch` handles at most 20 ready
jobs per invocation; repeat after inspecting the previous outcomes. Before
`approve`, run `prepare_live_review.py <unique-run-id>` with the AI Python environment
from the repository root and review the synthetic source text yourself. It prepares
local text expectations; it never approves the real DOE/OSHA PDFs or OCR source.
`approve` verifies matching extraction and original hashes for those synthetic sources.
Dispatch indexing **and the separately queued activation jobs** before Chat checks.

Available focused stages include `chat`, `checks`, `logs`, `socket-security`,
`lifecycle`, `versions`, `version-check`, `socket-final`, `chat-diagnostic`, `procedure-edit`,
`procedure-publish`, `procedure-export`, `revocation-race`, and `revocation`.
Publication is restricted to the separate synthetic software-card review Project.
Read the stage before running it: lifecycle/revocation stages intentionally alter
the test entities, and repeated publication/run-completion stages are not setup steps.
`OBSERVED` records require inspection; they are not semantic PASS assertions.

Repair regression stages: `repair-upload`, `dispatch`, `repair-review`, `dispatch`,
`repair-chat`, `repair-revalidation`, and `repair-safety-review`. Use the established synthetic run whose
setup/publication stages created the required records. The review stage compares
the complete scanned-card transcription (including warning and timestamp) to an
independently inspected original before approving only that synthetic source.
The OSHA reference stays awaiting human review. Revalidation forks an existing
published software-only definition, invalidates its review, and verifies LOW after
real revalidation without publishing the fork.
The safety-review stage creates a separate unsupported physical-action draft and
requires HIGH criticality/SEVERE plus a real rejected approval. `repair-retry-ocr`
contains exact historical test-job IDs; do not run it for another dataset.

`diagnose_live_answers.py <run-id> <label>` runs from `ai` with `uv run python`.
It reads the current Web-authorized manifest and real source/model responses without
product mutations, and writes private diagnostic captures only to the run's system
temp directory. It prints safe stage flags, not source content. These opt-in calls
incur provider cost and are never part of unit tests or application telemetry.

The `outage`, `index-failure`, `index-retry`, and `version-race` stages require
deliberately coordinated service stop/restore and queue ordering. They never stop
servers themselves or change database state behind the API. Do not use outage
stages while another person relies on those services. Preserve the external private
state for a paused run; without its credentials, create new test accounts instead
of bypassing authentication. Do not export that state into the repository.

## Acceptance boundary

This pack can establish that file handling, extraction/OCR, review, indexing,
activation, propagation, authorization, retrieval, citations, Chat persistence,
and safe failures work for this dataset. It cannot establish suitability for a
real plant, subject-matter approval, model-wide groundedness, production SLOs,
or visual understanding that the current ingestion pipeline does not implement.
