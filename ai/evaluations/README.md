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
