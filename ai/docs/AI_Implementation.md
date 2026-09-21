# AI Backend Implementation - Python FastAPI

## Delivery status

| Item                                                                         | Status                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service boundary, ingestion lifecycle, entity routing, and RAG safety design | Defined.                                                                                                                                                                       |
| FastAPI/Pydantic contract implementation                                     | Phases 1-2 complete: authenticated service, synchronized OpenAPI, bounded scope/profile schemas, filters, and deterministic stubs; Phase 1 integration revalidated 2026-09-04. |
| Source ingestion, entity profiles, Pinecone, and LangGraph flows             | **Backend complete through Phase 5 (2026-09-08).** Provider-backed workflows, graph/safety tests, hosted workflows, and the dated repair acceptance cover the implemented AI backend scope. |
| Evaluation and production readiness                                          | **Phase 6 backend complete (2026-09-08).** Evaluation tooling, failure handling, metadata telemetry, and repair checks are implemented and verified. Product release/SME gates remain separate. |
| Phase 1–6 delivery                                                           | **Complete for the AI backend only (2026-09-08).** This does not mark the synchronized product/UI phase complete; `Development_Plan.md` continues to govern its separate UI, representative-source/SME, and operational gates. |
| Phase 7 delivery                                                             | Backend implementation delivered; representative live visual-quality/cost acceptance pending. Automatic processing/retrieval are opt-in; no UI completion claim. |

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

**Status (14 September 2026):** Backend implementation delivered; representative
live visual-quality/cost acceptance remains open. This does not complete any UI
phase or grant safety/SME approval. Automatic rollout remains opt-in.

**Implemented pipeline and ownership:**

1. Signed `/v1/visual-assets/triage` downloads the Web-approved immutable PDF,
   validates its checksum, rejects encrypted/unsupported or >500-page sources,
   and uses pypdf caption, drawing and image/Form XObject signals locally.
   Mixed text/image pages remain eligible. No model call for rejected pages.
   Decoded page-content parsing is capped at 2 MB; scanning stops at the deadline
   or candidate cap and returns explicit `partial` coverage.
2. Signed `/v1/visual-assets/discover` takes the same original and one shortlisted
   page. AI, not Web, renders a 72-DPI preview inside a bounded LangGraph workflow.
   The configured routing model/low effort proposes up to four normalized regions,
   class, confidence and uncertainty. Zero regions is valid. Web owns validation,
   overlap deduplication, allocation quotas and durable job dispatch.
3. `/render` preserves exact PDFium pixels rather than generating/redrawing an
   image. Existing pypdf/PDFium/Pillow adapters enforce rotation-aware top-left
   bounds, four-million full-page pixels before crop, 4096 output pixels per side,
   and 2 MB PNG. Web stores private immutable R2 derivatives; AI has no R2 credentials.
4. `/describe` uses the configured answer model and independent complex verifier
   on checksum-, byte-count-, dimension- and format-validated PNGs. Ambiguous
   labels/connections stay uncertain. Descriptors are untrusted retrieval hints,
   not OCR, approved facts, operational steps or substitutes for pixel inspection.
5. `/index` hashes a canonical bounded descriptor, checks the supplied fingerprint,
   and uses LangChain OpenAI embeddings/Pinecone to upsert an `IMAGE_REGION`
   projection. IDs are deterministic by tenant/asset/description fingerprint.
   Metadata binds parent/version/page/bounds, original and derivative SHA, class,
   confidence, uncertainty count, pipeline/renderer and embedding model.
   `PINECONE_NAMESPACE` remains the explicit text/profile setting;
   `PINECONE_VISUAL_NAMESPACE` is distinct and explicit. Local values are
   `development` and `visual-development`; neither is synthesized from `APP_ENV`.
   The same configured embedding model/index dimensions serve both namespaces.
   A dimension mismatch fails the upsert, never returns indexed success.
6. Signed `/search` intersects the visual manifest with current assignments before
   querying. Text and visual searches run concurrently with tenant, environment,
   record type, approval, allowed parent/asset and embedding-model filters.
   Returned metadata is checked again against the manifest. Fusion uses reciprocal
   ranks (constant 60), parent-page agreement, deterministic asset-ID ties,
   confidence/generic-class/uncertainty penalties and checksum deduplication.
   Raw cross-namespace similarity scores are never compared.
7. A low-effort gate sees the question, shortlisted descriptors and up to four
   current scoped text excerpts (2,000 characters each), labels
   candidates `REQUIRED | HELPFUL | NOT_RELEVANT`, and may not invent IDs.
   No candidates means no gate/pixel call. Visuals can help without an explicit
   image request. Explicit image-dependent wording is conservatively detected even
   when the gate cannot run. More required assets than the final cap fails closed.
   Bounded recent history may resolve follow-ups, but is never evidence; every turn
   still performs fresh scoped retrieval and exact pixel verification.
   The excerpts are untrusted relevance context, not a new answer/evidence path.
   Text-sufficient factual lookups must not require a redundant image; HELPFUL
   requires added explanatory value. Prior image requests do not carry forward
   unless needed to resolve the current question. This reuses the existing text
   retrieval, adds no provider call, and leaves pixel verification mandatory for
   any selected visual.
8. Web supplies private PNG sources only for selected IDs on the usual question
   REST/socket request. The answer graph retains its source-chunk-grounded text
   baseline, then loads exact pixels, generates bounded factual visual observations,
   and independently verifies each observation against the cited image/question.
   `visualObservations` maps to `visualCitations`; no generated description is
   promoted directly into evidence. Physical actions, operating values and safety
   instructions remain in the existing source-chunk-cited answer, never inferred
   from images. Unsupported/injected/conflicting visual claims are removed.
9. Optional visual failure preserves separately grounded text. Required failure
   makes an otherwise approved answer incomplete with a warning.
   `visualEvidenceState` is `TEXT_ONLY | AVAILABLE | UNAVAILABLE`.
   The pixel branch uses a 45-second sub-budget and reserves two seconds of the
   enclosing deadline for a safe fallback. Partial manifest coverage is disclosed.
10. Signed `/delete-vectors` removes only tenant/version `IMAGE_REGION` records
    in the visual namespace. Web owns eligibility, retention, disable/rebuild and
    generation fencing. Text/profile records and retained originals are untouched.

**Configuration and cost controls:** Defaults are 12 candidate pages, four
regions/page, 72 preview DPI, 20 visual vector candidates, six gate candidates,
three final pixels and 15-second search budget. Hard public/private contract caps
cannot be bypassed through configuration. Automatic assets are capped at 48/version,
100 total including manual assets. One detection call per shortlisted page;
normally two description calls and one embedding operation per accepted region;
normally one relevance plus two pixel calls per visual Chat turn, in addition to
the text baseline. Retries can repeat paid calls; they are not exactly-once billing.
Model telemetry records only schema/role, counts, image bytes, input characters,
numeric provider usage, latency and bounded verification outcomes. Visual diagnostics
include role counts, verdict booleans and fixed unsupported-reason/error enums;
never rejected claim text or raw provider exceptions. Raw messages/URLs/reasoning are transient and
never exported. Price estimates use recorded usage and current configured-model
rates, not hardcoded prices. See the environment/setup tables and manual guide.

**Dependencies:** No new packages or provider SDK exceptions. Reuse maintained
LangChain integrations, LangGraph, pypdf, PDFium and Pillow already owned by AI.
The configured text embedding model embeds descriptions, not native pixel data.
Pinecone metadata is a projection; R2 preserves the retrievable image and MongoDB
owns authorization/currentness. Model configuration remains environment-driven.

**Verification and remaining gate:** Deterministic tests cover triage/detection
bounds, duplicate/tampered vectors, relevance roles, unauthorized manifests,
same-turn pixel verification, injection/operational rejection, timeout fallback,
namespace isolation and signed endpoints. The real loopback Web/AI suite covers
descriptor indexing/search and exact visual citations over authenticated sockets.
Recorded gate (14 September 2026): 135 AI and 111 Web tests pass; AI Ruff/format,
mypy/Pyright, Web lint/typecheck/build, and 15 paired synthetic evaluation cases pass.
The npm production-dependency audit reports zero vulnerabilities.
`evaluations/visual_metrics.py` scores recorded page/region recall/precision,
descriptor retrieval, relevance selection, citation provenance, text regression,
human-reviewed groundedness, latency and cost. It does not fabricate human reviews
or approve automatic rollout. Before enabling automatic processing broadly, run
the representative manual matrix: diagrams, charts, photos, screenshots, scans,
mixed pages, decoration, cropped labels, duplicate figures and embedded injection.
Require zero unauthorized/stale/uninspected citations, no text recall regression
and reviewed usefulness/legibility. Record actual provider costs and SME thresholds.

**Exit criterion:** Backend answers can return an exact authorized current diagram
citation only after same-turn pixel verification and Web persistence revalidation.
Live semantic accuracy and future Chat rendering remain separately accepted gates.

## Completion tracking

### Pack 2 acceptance follow-up (15 September 2026, testing in progress)

**17-18 September visual follow-up:** All three repaired manual regions were
automatically detected, rendered, described and indexed; exact PNG hashes and
full crops were checked. Live tests exposed unsupported pixel observations,
wrong-image follow-up selection and false text conflict classification. Pixel
generation now excludes the generated text answer; verification compares it only
for actual contradictions, not missing OCR detail. The relevance model returns
bounded local candidate indices, mapped to authorized asset IDs in code, with
complete/unique coverage required. No public payload, dependency or index migration
changes. Fixed-enum diagnostics expose rejection categories without source content.

Targeted retests returned verified current diagram arrows, orange-diamond
observations, the marker follow-up and chart B=5/A=2/C=3. Earlier failures remain
recorded, including one provider timeout; no repeated-until-pass automatic loop
was added. Text-only register/screenshot-label lookups remained text-only in the
earlier pass. Successful visual observations do not upgrade incomplete text status.
AI 155 tests and the documented lint/format/type gates pass; Web 117 tests include
the updated real REST/socket transport fixture. Representative quality, source
replacement/lifecycle and remaining negative cases are still open.

**16 September OCR follow-up:** Pipeline 4 supersedes the pipeline-3 mixed-image
strategy described below. Word boxes retain approximate horizontal layout;
at most eight low-confidence labels receive two padded crop readings, requiring
agreement and confidence >=80 before replacement. Per-pass word/data bounds and
the existing shared OCR timeout/pixel limit apply. Native text and full-page scans
are unchanged. The chart's C/Cc error and lost column alignment are repaired on
both local fixture revisions; chart meaning still requires Phase 7 pixels. No
hardcoded labels, vision-generated source text, new dependency or public schema.
Review a new immutable source version; never rewrite retained citations. See the
parser ADR and setup guide. Hosted acceptance is recorded separately from local tests.

Mixed-page OCR missed boxed labels and chart numbers in the new live fixture.
Parser/index pipeline 3 adds a bounded supplemental block-layout pass for embedded
images, retaining native/primary text, distinct alternative readings and OCR quality
0.6. It does not infer chart label/value associations or visual facts. Whole-page
scan extraction is unchanged. New immutable versions and renewed source review are
required; no historical extraction/vector rewriting. See `../adapters/README.md`.
No dependency or public schema changes. Live Phase 7 semantic acceptance remains open.

The 16 September continuation verified real scan rendering, private source hashes,
description/indexing, same-turn pixel observations and REST/socket persistence.
The relevance gate now reuses bounded current text excerpts: the repeated factual
scan lookup stayed TEXT_ONLY, while the shape question still used exact pixels.
Successful pixels retain the separate text baseline status, including incomplete.
Negative controls were not selected as figures; injected OCR/question content
produced no publication or invented answer. This did not exercise injected pixels
inside the final visual verifier, because no negative-control asset was selected.
At that checkpoint manual diagram/chart OCR ambiguity and human procedure review
were open. The subsequent pipeline-4 source comparison and user-approved publication
resolved those specific blockers; full revision/lifecycle acceptance remains open.
Synthetic tests are not representative/SME sign-off.

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
