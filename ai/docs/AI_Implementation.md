# AI Backend Implementation - Python FastAPI

## Delivery status

| Item                                                                         | Status                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service boundary, ingestion lifecycle, entity routing, and RAG safety design | Defined.                                                                                                                                                                       |
| FastAPI/Pydantic contract implementation                                     | Phases 1-2 complete: authenticated service, synchronized OpenAPI, bounded scope/profile schemas, filters, and deterministic stubs; Phase 1 integration revalidated 2026-09-04. |
| Source ingestion, entity profiles, Pinecone, and LangGraph flows             | **Backend complete through Phase 5 (2026-09-08).** Provider-backed workflows, graph/safety tests, hosted workflows, and the dated repair acceptance cover the implemented AI backend scope. |
| Evaluation and production readiness                                          | **Phase 6 backend complete (2026-09-08).** Evaluation tooling, failure handling, metadata telemetry, and repair checks are implemented and verified. Product release/SME gates remain separate. |
| Phase 1–6 delivery                                                           | **Complete for the AI backend only (2026-09-08).** This does not mark the synchronized product/UI phase complete; `Development_Plan.md` continues to govern its separate UI, representative-source/SME, and operational gates. |
| Phase 7 delivery                                                             | In progress: signed visual rendering, bounded PNG derivatives and independently verified image descriptions implemented. Embeddings, visual retrieval, Chat citations and live visual acceptance remain pending. |

## Goal

Deliver the internal AI service that owns extraction, source indexing, Equipment/Project retrieval-profile generation, hierarchical retrieval, cited answers, and draft generation. It may use profiles to decide where to search, but it must produce operational answers only from authorized current source chunks and exact citations.

## Setup-guide maintenance

Before marking any AI phase complete, reconcile and run the applicable instructions in [Setup_Guide.md](../../Setup_Guide.md). Update it for every new AI dependency, environment variable, model/vector prerequisite, migration, service contract, startup command, verification step, or recovery procedure introduced by that phase.

## Dependency selection

Follow the mandatory policy in `../../AGENTS.md` and `../../Agent.md`. Reuse the installed FastAPI, Pydantic, LangChain, LangGraph, extraction, observability, and test stack before adding another package. Use `uv`; update `pyproject.toml` and `uv.lock` together; verify supported Python versions and compatibility across the LangChain package family; and document purpose, provider/runtime ownership, configuration, model/data implications, failure modes, and rollback here plus in `web/docs/Environment.md` and `Setup_Guide.md`. Do not introduce an alternate orchestration framework, vector abstraction, model SDK path, parser/OCR stack, or evaluation framework without a documented gap and migration decision. The AI integration policy below remains binding and stricter for provider capabilities.

## Boundaries

- Receive immutable file references, reviewed metadata, entity/profile inputs, and current authorization manifests from Web.
- Own extraction/OCR, normalization, summaries, chunks, embeddings, Pinecone `SOURCE_CHUNK` and `ENTITY_PROFILE` records, retrieval/reranking, LangGraph orchestration, citations, and drafts. Use LangChain provider adapters (`langchain-openai`, `langchain-pinecone`) as the application integration layer; do not call OpenAI or Pinecone SDKs directly from workflow code.
- Return structured results only. Never read/write MongoDB directly, own browser authentication, activate versions, change links, submit Project logs, publish procedures, control equipment, or grant access.
- Receive only short-lived R2 URLs. AI never has R2 credentials.

## AI integration policy

Use LangChain integrations as the default implementation boundary for every external AI capability, including chat models, embeddings, vector stores, document loaders, retrievers, rerankers, and tool-facing model services. Use LangGraph to compose the stateful ingestion, profile-refresh, answering, and procedure-generation workflows.

- Prefer the maintained LangChain integration for a providerâ€”for example, `langchain-openai` for OpenAI models/embeddings and `langchain-pinecone` for Pinecone vector operations.
- Do not import or call OpenAI, Pinecone, or comparable provider SDKs directly in application, graph, service, or API-route code. Their SDKs may be installed only as transitive dependencies of the LangChain adapter.
- A direct provider SDK is permitted only when LangChain/LangGraph has no suitable supported capability and the use is isolated in `adapters/`, protected by tests, and justified in a short architecture decision record that explains the gap, fallback, and migration path.
- Keep provider-specific configuration and return types behind adapter interfaces so models or vector providers can be exchanged without changing graph/business logic.

## Suggested service layout

```text
app/
  api/                    # FastAPI routes and service authentication
  schemas/                # Canonical Pydantic/OpenAPI contracts
  graph/
    ingestion.py          # extract -> summarize -> validate -> index result
    profile_refresh.py    # assemble -> describe -> embed -> upsert
    answering.py          # interpret -> route -> expand -> retrieve -> grade -> answer -> verify
  services/
    extraction.py
    document_summary.py
    profile_builder.py
    scope_router.py
    retrieval.py
    reranking.py
    evidence.py
    citations.py
    drafting.py
    safety.py
  adapters/               # parser/OCR, Pinecone, LangChain/OpenAI
  evaluations/
  tests/
```

## Pinecone record families

Use one index with explicit `recordType` metadata or separate namespaces if Pinecone configuration/evaluation shows it is cleaner. Never mix the two families in one unfiltered query.

### `SOURCE_CHUNK`

Authoritative answer candidates derived from one approved immutable document version. Required metadata includes document/version IDs, source location, approval/revision, original-file reference, tenant/environment, record type, and content fingerprint.

### `ENTITY_PROFILE`

AI-only routing candidates for one Equipment or Project profile version. A profile contains generated description, user description when present, systems/components, document coverage, likely query terms/failure modes, and stable entity/profile identifiers. Project profiles also summarize required Project description, direct sources, bounded included-Equipment profile projections, and Project workflow coverage.

Entity profiles are not source evidence and are never returned as answer citations.

### Optional `MAINTENANCE_LOG`

Only finalized eligible Project logs may be indexed. They retain Project/Equipment scope and are ranked below approved manuals and controlled procedures for safety-critical action guidance.

## Entity-profile generation

Profile input is a Web-built structured projection, not a collection of unrestricted documents. The LangGraph profile flow:

1. Validate entity ID/type, `profileVersion`, tenant, input fingerprint, and active-document references.
2. Combine the user's description with structured document summaries and coverage metadata.
3. Generate bounded fields: `generatedDescription`, `systems`, `components`, `capabilities`, `failureModes`, `searchHints`, and topic-to-document-version coverage.
4. For Projects, incorporate the required Project description, direct Project documents, and bounded included-Equipment objects carrying profile ID/version/fingerprint, freshness, generated description, and coverage topics, plus controlled procedures and eligible log coverage. Reject unbounded nested profile payloads and never fetch Equipment profiles by chaining Pinecone lookups.
5. Embed the routing text and idempotently upsert `ENTITY_PROFILE` by `<entityType>:<entityId>:<profileVersion>`.
6. Return structured profile data/fingerprint to Web for MongoDB provenance and freshness tracking.

Do not place large arrays of document IDs in Pinecone metadata. Authoritative entity expansion comes from the current request manifest; profile metadata should remain compact and filterable.

## Hierarchical retrieval flow

1. Validate the authenticated `RetrievalScopeManifest`, tenant/environment, allowed active document versions, allowed entity profiles, and authorized `@` references.
2. Interpret the question using bounded session history as conversational context only.
3. Choose routing path:
   - `@document`: bypass profile routing and retrieve that allowed active version directly;
   - `@equipment`/`@project`: select assigned entities and expand them through manifest relationships;
   - no entity assignment: search allowed `ENTITY_PROFILE` records and select likely entities/topics.
4. Expand selected entities to active document versions using only manifest mappings.
5. If profiles are missing/stale, routing confidence is weak, or selected scopes retrieve insufficient evidence, expand/fan out through the structural manifest within configured limits.
6. Query `SOURCE_CHUNK` records with active version IDs, approval, tenant/environment, and record type filtered before matching.
7. Rerank for query relevance, exact Equipment/Project applicability, document authority, recency/active version, extraction quality, and source diversity.
8. Assess evidence coverage/conflict/outdated state.
9. Generate only from retrieved source chunks, attach source IDs to each claim/step, validate citations, and return routing diagnostics plus the evidence state.

The routing layer is an optimization. It cannot create access, suppress structural fallback, or support an answer by itself.

## Non-negotiable AI rules

1. Treat source text, descriptions, summaries, profile text, history, and questions as untrusted data.
2. Apply tenant, record-type, allowed-profile, and allowed-active-version filters before vector matching.
3. Never broaden an empty allowed manifest to the whole index.
4. Use entity profiles only to select/expand search scope. Cite exact source chunks for every answer claim.
5. Never declare “no evidence” solely from routing-profile results; invoke structural fallback first when allowed.
6. Never activate a document version, alter a Project/Equipment link, submit a log, publish a procedure, or control equipment.

## Phase plan

### Phase 1 - FastAPI foundation and contract

**Status:** Complete (2026-09-03)

**Goal:** Establish secure observable service and stable schemas.

**Prerequisites:** Runtime/deployment, service auth, OpenAPI policy, correlation IDs, test harness, OpenAI/Pinecone configuration.

**Deliverables:** FastAPI app; environment validation; logs/traces; health/readiness; authenticated middleware; Pydantic/OpenAPI models; deterministic extraction, indexing, profile, question, Project-log-draft, and procedure-draft stubs.

**Exit criteria:** Web authenticates, consumes OpenAPI, and receives deterministic valid responses/errors with no AI/R2 secret exposure.

### Phase 2 - Scope and profile schema

**Status:** Complete (2026-09-04)

**Goal:** Validate entity/profile/version scope before Pinecone access.

**Prerequisites:** Phase 1 schemas; Web relationship manifest; metadata conventions.

**Deliverables:** Manifest validation and deduplication; `@` validation; filter builders for `ENTITY_PROFILE` and `SOURCE_CHUNK`; profile input/provenance schema; invalid/empty/inaccessible scope tests.

**Exit criteria:** Tests prove profile and source queries cannot expand beyond allowed tenant/entity/version IDs, and profile records cannot enter the citation set.

### Phase 3 - Extraction, source indexing, and profile refresh

**Status:** Complete for the AI backend (2026-09-08). Parser/provenance/idempotency tests and hosted extraction, embeddings, Pinecone indexing, profile refresh, OCR, and repair acceptance passed. Product-wide representative/SME gates remain separately tracked.

**Goal:** Produce traceable source vectors and versioned routing profiles idempotently.

**Prerequisites:** Signed R2 URLs; parser/OCR matrix; embedding choice; Pinecone strategy; reviewed metadata and profile contracts.

**Deliverables:** Extraction/OCR; quality checks; source anchors; document summaries; stable chunks/IDs; approved source embeddings/upserts; delete/disable/supersession behavior; Equipment/Project profile graph; profile embeddings/upserts; structured results and errors.

**Exit criteria:** Reprocessing the same version/profile produces the same IDs without duplicates. Every source chunk resolves to one immutable original. Profile refresh can fail/retry independently without making current source versions unavailable.

### Phase 4 - Entity-routed grounded answers

**Status:** Complete for the AI backend (2026-09-08). Scoped routing, citation/fallback tests, live source-cited socket answers, and repair acceptance passed. Profile optimization remains disabled by default until its separately governed representative baseline comparison passes.

**Goal:** Improve search focus/latency while preserving recall and citations.

**Prerequisites:** Indexed source/profile fixtures; routing thresholds; question/citation contracts; safe UI states.

**Deliverables:** Assignment-aware router; profile search; manifest expansion; structural fallback; source retrieval; optional Pinecone hybrid retrieval only after evaluation; reranking; LangGraph evidence grading, generation, citation verification, auto-title, and response assembly; routing diagnostics.

**Exit criteria:** Every action step cites exact current source locations. Stale/missing/misrouted profiles trigger fallback. Evaluation compares hierarchical retrieval with direct-manifest baseline and accepts it only if source recall/groundedness are not degraded while latency or precision improves.

### Phase 5 - Project draft helpers and safety controls

**Status:** Complete for the AI backend (2026-09-08). Drafting/revalidation/review-rubric tests and hosted source-cited candidate/repair acceptance cover the backend scope. Representative-source and SME product acceptance remain separately tracked.

**Goal:** Draft useful Project logs and automatically generate source-bounded procedure candidates with transparent review need, without owning product mutations or execution state.

**Prerequisites:** Cited response model; Project/Equipment scope schemas; current approved Project-source manifest; idempotent input fingerprint; review-need rubric; human-review requirements; prompt-injection corpus.

**Deliverables:** Project log draft helper with `PROJECT|EQUIPMENT` scope; procedure-generation LangGraph invoked when Web supplies required description plus eligible sources; topic/requirement extraction; source retrieval/reranking; per-step citation binding; coverage/conflict/freshness/applicability/hardware-criticality analysis; deterministic `LOW|MODERATE|HIGH|SEVERE` review-need classification with reasons/blocking findings; stable ordered step IDs; `requiresHumanReview`; regeneration/diff and edited-step citation-revalidation contracts; injection/safety guardrails; output validation; optional finalized-log embedding pipeline when policy enables it.

**Exit criteria:** Identical Project input fingerprints return idempotent compatible candidates. Every operational step has current source citations; unsupported steps are omitted and reported as gaps. Severe findings are explicit and machine-readable. The service never fabricates a procedure while sources are missing, never overwrites an edited Web draft, and never marks output submitted/approved/published, reorders persisted records, ticks steps, creates runs, or completes work.

### Phase 6 - Evaluation, observability, and production readiness

**Status:** Complete for the AI backend (2026-09-08). Evaluation harness, synthetic corpus, metadata tracing, failure handling, and repair verification are implemented and verified. Representative groundedness, SLO, telemetry, and release acceptance remain product-wide gates.

**Goal:** Prove routing/retrieval reliability for safety-conscious release.

**Prerequisites:** Phase 1-5 flows; representative sources/entities; subject-matter-reviewed cases; SLOs.

**Deliverables:** Dataset for direct docs, Equipment routing, Project composition, stale/missing profiles, changed versions, no evidence, conflicts, logs, and prompt injection; profile routing recall, document recall@k, MRR/nDCG, citation validity, groundedness, safety-state accuracy, latency and fallback-rate metrics; traces and failure tests.

**Exit criteria:** Accepted thresholds pass against the direct-manifest baseline; traces identify profile selection, fallback, source filters, reranking, model calls, and citations; Pinecone/OpenAI failures return safe typed states.

### Phase 7 - Multimodal visual understanding and retrieval (backend-only)

**Description milestone:** `/v1/visual-assets/describe` runs a bounded LangGraph
load/describe/verify workflow. `adapters/visual_source.py` validates SHA, byte count,
dimensions, single-frame PNG structure and existing download host restrictions.
The existing LangChain provider sends actual pixels (base64, high detail) to the
configured answer model and independently to the configured complex verifier.
Existing model/effort settings apply; no hardcoded model, new provider or package.
Unsupported descriptions, injection detected by verification, malformed sources
and provider failures return no partial description. Search descriptors are not
OCR transcripts or approved evidence, and model verification is not a guarantee
of complete visual understanding. Query-time pixel grounding remains pending.

Implementation follows the official [image input documentation](https://developers.openai.com/api/docs/guides/images-vision).
The configured [text embedding model](https://developers.openai.com/api/docs/models/text-embedding-3-large)
does not directly embed images. No image vector is written by this milestone;
the later retrieval implementation must distinguish descriptor embeddings from
pixel evidence and preserve original asset retrieval.

**Status:** In progress — visual asset foundation implemented. This is an AI/Web backend phase only. It does not implement a
Chat UI or mark a synchronized product phase complete.

**Current milestone:** `POST /v1/visual-assets/render` accepts one approved immutable
PDF source and an explicit page/normalized crop. It reuses the verified source
downloader, pypdf inspection, mutex-protected PDFium renderer and Pillow PNG encoder;
no new dependency/model/embedding provider is selected. Output is bounded to four
million rendered pixels, 4096 per output side and 2 MB PNG; unsupported/encrypted/
oversized PDFs or invalid pages fail without partial bytes or private error text.
The private result includes source/derivative hashes, dimensions and render
provenance; Web alone persists the image in R2. This is a deterministic derivative
operation inside the existing workflow executor and does not call an LLM or OCR.
Automatic figure detection, descriptor embeddings, question-time vision,
LangGraph visual retrieval, exact Chat image citations and representative evaluation
remain pending. The OpenAPI contract and generated Web types are synchronized.

**Remaining implementation plan — staged, cost-aware multimodal retrieval:**

1. **Candidate-page triage is local and deterministic.** AI must not run vision
over every PDF page. Web provides only current, approved, authorized shortlisted
pages selected from bounded local signals. A future `VisualDiscoverRequest` carries
parent/version/checksum, page, pipeline version, checksum-bound preview source and
limits; it never accepts a browser URL, arbitrary asset ID or model-controlled
scope. Discovery can return no regions, and a failure never breaks text indexing.
2. **Low-cost detection proposes; it does not prove.** A LangGraph discovery
workflow uses the configured routing model at low reasoning effort on a small page
preview. Its strictly structured output has bounded proposed regions, class,
confidence and uncertainty. Pixels and labels are untrusted content: embedded
instructions cannot alter limits, filters, tools or schema. It creates no factual
or operational evidence; Web owns coordinate/dedup/quota/lifecycle validation.
3. **High-quality understanding remains separate.** Existing describe/verify
inspects a selected immutable PNG with configured answer/complex models and creates
an uncertain semantic descriptor, not an OCR replacement. A planned
`VisualIndexRequest` embeds only canonical bounded descriptor text after fresh
parent/asset revalidation. Raw pixels, base64, URLs, OCR blobs and traces never
enter Pinecone.
4. **Use descriptor embeddings, not falsely named image embeddings.**
`text-embedding-3-large` receives description text only, so its result is a
*visual-description embedding*, useful for semantic search but not native pixel
similarity. Store it as `recordType: IMAGE_REGION` in the configured
`PINECONE_VISUAL_NAMESPACE`, never mixed with `SOURCE_CHUNK`/profiles. Existing
text/profile vectors use `PINECONE_NAMESPACE`. Deployment maps the two values to
`{environment}` and `visual-{environment}` respectively. Filter every query by tenant,
environment, allowed asset IDs and parent versions, current approval, and record
type. Metadata includes asset ID, page/bounds, SHA, class and pipeline/description/
embedding versions. Check vector dimensions before enablement.
5. **Retrieve text and visuals in parallel, but fuse ranks safely.** Answering
first resolves existing authorized text scope. It queries visuals only for a
non-empty authorized visual manifest. It never compares raw scores across Pinecone
namespaces; it applies bounded rank-based fusion (for example RRF), deterministic
tie breaking, parent-page/caption agreement boost, and generic/duplicate/
low-confidence/high-uncertainty penalties. Keep only a small configured visual
shortlist; no candidate means no image-model call and normal text answering.
6. **Gate relevance before pixel cost.** A low-effort structured gate sees the
question, authorized metadata and verified descriptor—not pixels—and labels each
shortlisted candidate `REQUIRED`, `HELPFUL`, or `NOT_RELEVANT`. It cannot introduce
new candidates or widen scope. Only `REQUIRED`/`HELPFUL` assets are checksum
re-downloaded and inspected as pixels. For operational/safety claims, visuals
supplement rather than replace approved source-chunk evidence. Unloadable or
unverified pixels are `UNAVAILABLE`, never claimed as inspected.
7. **Generate and independently verify multimodal claims.** Final answers cite
text chunks and visual assets separately. A complex visual verifier checks visual
claims against exact supplied pixels and maps citations to the asset inspected in
that turn. It removes unsupported claims, detects conflicts/injection, preserves
ordinary evidence states, and cannot convert a diagram into physical-action or
safety authority. Only metadata counts/timings reach telemetry.
8. **Fail closed without degrading text.** Empty visual scope yields `TEXT_ONLY`;
visual provider/index/source failure yields `UNAVAILABLE` while separately grounded
text remains usable. An image-dependent question with unavailable visual evidence is
`incomplete`. All stages are deadline/byte/pixel/asset bounded and use deterministic
IDs and idempotent index/delete behavior.

**Cost policy:** no AI call for locally rejected pages; one low-effort call only for
shortlisted previews; render/describe only accepted deduplicated regions; embed once
per immutable description fingerprint; inspect pixels only for final small
`REQUIRED`/`HELPFUL` candidates. Record per-stage candidate/call/byte/token-cost
estimate/latency metadata without source content. Preserve a feature-disabled
text-only baseline and do not bulk-enrich historic documents before reviewed
quality and cost acceptance.

**Goal:** Give the service both grounded understanding of meaningful document
visuals and a safe way to return the exact supporting diagram/image as a cited,
authorized asset. OCR remains text extraction; it is not visual understanding and
does not make the original image retrievable as evidence by itself.

**Prerequisites:** Contract-first visual-asset and visual-citation schemas;
version-bound R2 derivative metadata supplied by Web; a reviewed maintained
LangChain-compatible visual embedding/vision capability (or an isolated, tested
adapter exception with ADR and migration path); separate vector compatibility
evaluation; and explicit image-safety/evaluation cases. No provider, model,
embedding dimension, or namespace may be chosen from workflow code literals.
`PINECONE_NAMESPACE` owns text/profile vectors; the future
`PINECONE_VISUAL_NAMESPACE` owns `IMAGE_REGION` vectors. Deployment values follow
`{environment}` and `visual-{environment}`.

**Deliverables:**

- Extend ingestion to render bounded document pages, identify useful visual regions
  and retain their page/normalized-bounds/provenance links. Preserve native text,
  OCR text, and visual regions as complementary evidence rather than replacing one
  with another. Image bytes remain private in R2 and are never put in Pinecone.
- Create a distinct `IMAGE_REGION` vector record family (or documented equivalent
  isolated namespace) with its own model/version/dimension compatibility checks,
  deterministic region IDs, parent document/version/page/anchor metadata and
  lifecycle state. It must never enter an unfiltered `SOURCE_CHUNK` query or become
  a relational authority.
- Add a bounded visual-retrieval branch to the answering LangGraph after scope
  validation. Query only visual records named in the current authorized manifest;
  combine visual candidates with applicable source chunks; and use a bounded vision
  verification step only for shortlisted assets. A model description is supporting
  evidence, not permission to invent facts or operational instructions.
- Return an exact visual citation only after validating the parent active/approved
  version, page/region anchor, extraction provenance and source-manifest membership.
  Responses must distinguish `visualEvidenceAvailable`, `visualEvidenceUnavailable`,
  and ordinary text-only evidence; never pretend a diagram was inspected when the
  visual branch failed or was not authorized.
- Treat all pixels, embedded labels, OCR output, captions, and diagrams as untrusted
  content. Visual prompt injection cannot modify filters, tools, evidence status,
  citation rules, or procedure controls. Do not infer unsafe operation from an image
  without applicable approved source support and the existing safety rubric.
- Evaluate text-only baseline versus multimodal retrieval for exact-region recall,
  parent-version/citation validity, diagram-answer groundedness, unauthorized asset
  rejection, visual-provider failure behavior, latency/cost, and regression of
  existing text recall. Add synthetic and reviewed real-source cases for diagrams,
  photos, screenshots, scans, mixed text/image pages, inaccessible assets, changed
  versions, misleading embedded instructions, and missing visual derivatives.
- Add candidate-page recall/false-positive, region precision/recall and overlap
  deduplication, descriptor-search recall, fused-rank versus text-only quality,
  relevance-gate precision, visual-citation validity, pixel-grounded claim accuracy,
  per-document/query cost, and ordinary text-retrieval regression metrics.

**Exit criteria:** Given an authorized current document, the service can return a
grounded answer with a page/region-specific visual citation when a diagram is
materially relevant, while text-only retrieval remains available if visual work is
unavailable. It cannot retrieve, describe, cite, or expose an unauthorized,
superseded, unapproved, tampered, or out-of-manifest visual asset.

## Completion tracking

### Live provider acceptance, 7–8 September 2026

[Acceptance report](../../Manual%20Testing/ui-less-test/06_Live_Backend_Acceptance.md)
records native PDF/text indexing, 122-page DOE extraction, Markdown/DOCX extraction,
real cited answers/drafts/revalidation and unavailable-state recovery. Tesseract
is missing in the tested environment. Two expected factual answers failed; one
pressure fact succeeded after explicit synthetic-document wording, while the
signal-range question remained incomplete. Review-need calibration also warrants
follow-up. These historical findings were subsequently investigated and fixed:
see [8 September repair acceptance](../../Manual%20Testing/ui-less-test/07_Backend_Repair_Acceptance.md).
The original test did not alter code to claim a pass. The repair has separate
live evidence; representative/SME and global phase gates remain open.

### Implemented layout and provider ownership

Production code lives in `src/patch_ai/`, not the illustrative `app/` tree above.
`services/ingestion.py` owns LangGraph extraction/summary, chunk/index and profile
workflows. `services/answering.py` owns assignment/profile routing, bounded
authorized fallback, source retrieval/reranking, evidence grading and independent
verification. `services/drafting.py` owns procedure candidate/review graphs,
unchanged-step plus whole-draft revalidation and observation-only log formatting.
`api/execution.py` bounds concurrent work and preserves occupied capacity after
request timeout until underlying work finishes. REST and the private question
socket use the same typed services, replay guard and correlation contract.

`adapters/providers.py` is the only model/vector integration boundary. It uses
maintained `langchain-openai` and `langchain-pinecone`, with zero SDK retries,
bounded provider timeouts, 8,192 maximum completion tokens and structured output.
Models, embeddings, reasoning effort, namespaces, retrieval/routing limits and
download controls are read from validated settings, not literal workflow choices.
The current text/profile store uses `PINECONE_NAMESPACE`; `APP_ENV` remains service
environment identity rather than an implicit vector-store setting.
The configured routing model uses low effort, answering uses medium, and answer,
procedure, whole-draft, individual-step and log verification use the complex model
with high effort. Model values are configured in `ai/.env.local`; process environment
wins over `.env.local`, which wins over legacy `.env`. Removed OpenAI URL/org/project
and LangSmith settings are not silently reintroduced. No provider SDK is called
directly from workflow code.

`langchain-core` is now an explicit direct dependency because application code
uses `Document`, `BaseLoader`, `RunnableLambda` and typed runnable interfaces;
relying on a transitive install would violate repository policy. `tzdata` supplies
IANA zones on Windows. Both use the committed uv manifest/lockfile. Existing
LangChain/LangGraph, pypdf, python-docx, Pillow, pytesseract, tiktoken and OTel
dependencies are reused. The [loader ADR](../adapters/README.md) documents why
archived `langchain-community` was not added and isolates parsing behind the
maintained BaseLoader interface. No direct OpenAI/Pinecone SDK exception was needed.

Source parsing supports native PDF, bounded full-page and mixed-image OCR, UTF-8 text/Markdown
and simple DOCX paragraphs/tables. Unsupported visual/linked/complex DOCX content,
encrypted PDFs, unreadable pages, private/redirected download targets, checksum
mismatch and oversized text/archive/image data fail explicitly. Each source chunk
records immutable original, version, tenant/environment, approval and exact anchor.
Deterministic IDs make retries idempotent. Supersession is enforced by Web's current
manifest; deleting derived vectors is an authenticated, scoped operator action,
never deletion of originals. Entity profiles are never citable.

### Acceptance repairs, 2026-09-08

The parser ADR adds locked `pypdfium2` 5.x for the missing full-page rendering
capability. Existing pypdf/Pillow/pytesseract and LangChain BaseLoader remain the
parsing boundary; no model/vector SDK or orchestration change. Tesseract is an
external executable installed separately. The OCR adapter discovers/configures
the runtime, checks language data for aggregate readiness, bounds pixels/time,
serializes PDFium calls and OCR executable selection, and closes native buffers.
Native text survives mixed-page OCR; low-text pages use whole-page rendering.
A bounded colour-contrast pass preserves additional warning text for review.
Parser pipeline 2 requires new reviewed versions for previously active sources;
the setup guide covers migration and rollback without rewriting old citations.

Live diagnostic retrieval found the pressure and signal passages: failures came
from treating test-only source disclaimers as lack of approval for factual lookup.
Generation and verification now share question-aware evidence rules and receive
current/approved provenance. Qualified document facts do not imply operating
authority. Negative evidence states are never force-upgraded by code. Unknown
citations, unsupported claims, conflicts and safety gaps still fail closed.
Procedure revalidation now assesses actual high criticality with the same rubric
as generation instead of assigning HIGH to all edits. Independent generation,
per-step and whole-draft findings retain any HIGH criticality, so a document-only
Project description cannot downgrade an unsupported physical-action step. See the dated repair
acceptance report for executed tests and remaining product-wide acceptance limits.

Repair verification: 80 AI tests, lint/format, mypy/Pyright, unchanged OpenAPI,
synthetic evaluation and dependency compatibility pass. Web's 81-test suite and
real REST/WebSocket repair regressions pass. Parser-only checks cover all seven
PDFs, including the 122-page DOE and 45-page OSHA references. Real OCR-grounded
Chat and both LOW and blocked SEVERE procedure revalidation have live evidence.

### Evaluation and operational limits

**69 AI tests pass**, covering contracts, auth/replay, unsafe sources, DOCX archive
and XML controls, source filtering, invalid citations, severe conflicts, stable
revalidation bindings, logs, reasoning configuration, env precedence and executor
capacity. The Web suite additionally runs real loopback FastAPI REST/WebSocket
transport. Unit fixtures disable live provider calls and local environment loading.

`uv run python evaluations/runner.py` compares 15 deterministic cases in baseline
and hierarchical mode. It measures ranking/citation/state/fallback/context/latency
guards; these synthetic results do not measure actual model groundedness, costs
or SLOs. [Evaluation instructions](../evaluations/README.md) require explicit
`--live` and reviewed requests for real provider evaluation. Groundedness remains
null until separately reviewed; the script never declares SME acceptance.
`ENTITY_ROUTING_ENABLED=false` is the safe default until optimization is accepted.
Optional hybrid retrieval and finalized-log evidence are not enabled.

Metadata-only logs/spans cover graph stages, model/query/upsert timings, fallback
and citation outcomes. Raw LangSmith export is suppressed. Optional OTLP must be
configured and its receipt tested; existing Sentry placeholders do not activate
an exporter. Use [Setup_Guide.md](../../Setup_Guide.md) and
[Backend_Manual_Testing.md](../../Manual%20Testing/ui-less-test/Backend_Manual_Testing.md)
for startup, signed
Swagger, private sockets, provider prerequisites and remaining acceptance records.

Mark an **AI-backend module** phase complete only with code, contract tests,
evaluation evidence, and setup-guide reconciliation. A **synchronized product
phase** additionally requires the matching `../../Development_Plan.md` integration
gate; module completion never substitutes for that gate.
