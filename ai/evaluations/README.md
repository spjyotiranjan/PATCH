# Backend evaluation gate

Run `uv run python evaluations/runner.py` from `ai/`. This exercises the real
scope/retrieval/answer graphs with deterministic test providers, not OpenAI or
Pinecone. Fifteen fixtures cover direct documents, Equipment, Project composition,
profile freshness, version changes, empty scope, no evidence, conflicts,
ineligible logs, wrong tenant and injected invalid model/source output. No fixture
contains instructions for operating real hardware. No credentials or source text
are printed. Synthetic guard success is **not** an SME or model-quality sign-off.

The report compares direct-manifest baseline and hierarchical mode. It reports
document recall@k, MRR/nDCG, citation validity, claim-citation coverage, evidence-state
accuracy, p50/p95 latency, context size and fallback rate. Entity recall/precision
require `relevantEntities`; semantic groundedness remains null until independently
reviewed. Deterministic injection fixtures test enforcement of invalid output,
not the probability that a live model follows a malicious instruction.

For representative evaluation, prepare a private JSON dataset with `id`, canonical
`request` (QuestionRequest), `expectedStatus`, `relevantVersions`, `relevantEntities`,
and `reviewedBy`. Record independent human groundedness judgments separately;
the runner deliberately leaves groundedness null instead of copying an input score
onto unreviewed output. Obtain the current
manifest through Web as the test actor, never by inventing tenant/access IDs.
Use `uv run python evaluations/runner.py --live --cases <private-file.json>` only
with an authorized test namespace. It performs two answer passes and separate
reranked-retrieval measurement passes; these incur provider usage. It never upserts
or deletes vectors. Keep raw source/test datasets out of public commits.

Acceptance requires zero unauthorized/stale/profile citations, 100% valid bindings
and safety-state correctness, no recall or groundedness regression, and a measured
precision or latency improvement over the same baseline. An SME must review actual
outputs, all severe cases, and acceptable operational latency before signing off.
The runner does not grant that sign-off automatically. Keep
`ENTITY_ROUTING_ENABLED=false` until that review approves enabling the optimization.

Maintain cases for OCR/poor-quality instructions, incompatible revisions, source
injection, question/history injection, contradictory governing procedures, missing
isolation/prerequisites, no applicable equipment, and provider outages. Extend the
synthetic harness and reviewed dataset together when a new failure is discovered.

## Phase 7 visual evidence metrics

The implemented visual pipeline needs a separate representative acceptance record;
text-only success is not visual accuracy. Follow the
[Phase 7 manual runbook](../../Manual%20Testing/ui-less-test/08_Phase_7_Visual_Assets.md).
`visual_metrics.py` scores **recorded** results without calling providers or
printing documents, URLs, prompts or asset IDs. It does not execute the application
or create its own ground truth. Record actual runs and human inspections first.

From `ai/`, run:

```powershell
uv run python evaluations/visual_metrics.py <private-recorded-metadata.json>
```

The input is a non-empty JSON array; use snake_case keys matching `VisualCase`.
An illustrative metadata-only entry (replace all observations with actual results):

```json
[
  {
    "modality": "diagram",
    "reviewed": false,
    "relevant_pages": [1],
    "candidate_pages": [1],
    "expected_regions": [{ "page": 1, "bounds": { "left": 0.1, "top": 0.1, "right": 0.9, "bottom": 0.9 } }],
    "detected_regions": [{ "page": 1, "bounds": { "left": 0.1, "top": 0.1, "right": 0.9, "bottom": 0.9 } }],
    "relevant_assets": ["asset-A"],
    "descriptor_matches": ["asset-A"],
    "selected_assets": ["asset-A"],
    "cited_assets": ["asset-A"],
    "authorized_assets": ["asset-A"],
    "inspected_assets": ["asset-A"],
    "current_assets": ["asset-A"],
    "valid_bindings": 1,
    "claims": 1,
    "grounded_claims": null,
    "baseline_text_recall": 1,
    "multimodal_text_recall": 1,
    "baseline_ms": 100,
    "multimodal_ms": 200,
    "provider_calls": 3,
    "image_bytes": 1000,
    "estimated_cost_usd": null,
    "evidence_state_correct": true,
    "partial_coverage_disclosed": true
  }
]
```

This example is not measured acceptance. Include `diagram`, `chart`, `photo`,
`screenshot`, `scan`, `mixed` and `decoration` cases, plus failures/revocations.
Expected regions are human-labeled; IoU >=0.5 uses one-to-one matching so duplicate
detections reduce precision. Empty expected/retrieved sets score 1 only when both
are empty. Groundedness remains null without a human review and claim judgment.
Set `reviewed` only after comparing the output to the exact original/derivative.
Binding validity must compare every citation's parent/version/page/bounds/SHA and
description fingerprint, not merely count IDs. `inspected_assets` records actual
same-turn pixel inspection, not descriptor-only retrieval.

Record per-stage calls/bytes/latency from safe telemetry and estimated cost from
provider-reported usage at current model prices. Unknown costs are null. Reject
unauthorized/stale/uninspected or invalid citations and text recall regressions.
The tool never sets `smeAccepted` or `automaticRolloutApproved` true: reviewer-set
quality/cost thresholds and real fixture inspection are independent of schema guards.
