# AI Backend Implementation - Python FastAPI

## Delivery status

| Item                                                                         | Status                                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Service boundary, ingestion lifecycle, entity routing, and RAG safety design | Defined.                                                                                                                           |
| FastAPI/Pydantic contract implementation                                     | Phases 1-2 complete: authenticated service, synchronized OpenAPI, bounded scope/profile schemas, filters, and deterministic stubs. |
| Source ingestion, entity profiles, Pinecone, and LangGraph flows             | Phase 2 validation/profile contracts complete; provider-backed Phase 3 workflows not started.                                      |
| Evaluation and production readiness                                          | Not started.                                                                                                                       |

## Goal

Deliver the internal AI service that owns extraction, source indexing, Equipment/Project retrieval-profile generation, hierarchical retrieval, cited answers, and draft generation. It may use profiles to decide where to search, but it must produce operational answers only from authorized current source chunks and exact citations.

## Setup-guide maintenance

Before marking any AI phase complete, reconcile and run the applicable instructions in [Setup_Guide.md](../../Setup_Guide.md). Update it for every new AI dependency, environment variable, model/vector prerequisite, migration, service contract, startup command, verification step, or recovery procedure introduced by that phase.

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

**Status:** Not started

**Goal:** Produce traceable source vectors and versioned routing profiles idempotently.

**Prerequisites:** Signed R2 URLs; parser/OCR matrix; embedding choice; Pinecone strategy; reviewed metadata and profile contracts.

**Deliverables:** Extraction/OCR; quality checks; source anchors; document summaries; stable chunks/IDs; approved source embeddings/upserts; delete/disable/supersession behavior; Equipment/Project profile graph; profile embeddings/upserts; structured results and errors.

**Exit criteria:** Reprocessing the same version/profile produces the same IDs without duplicates. Every source chunk resolves to one immutable original. Profile refresh can fail/retry independently without making current source versions unavailable.

### Phase 4 - Entity-routed grounded answers

**Status:** Not started

**Goal:** Improve search focus/latency while preserving recall and citations.

**Prerequisites:** Indexed source/profile fixtures; routing thresholds; question/citation contracts; safe UI states.

**Deliverables:** Assignment-aware router; profile search; manifest expansion; structural fallback; source retrieval; optional Pinecone hybrid retrieval only after evaluation; reranking; LangGraph evidence grading, generation, citation verification, auto-title, and response assembly; routing diagnostics.

**Exit criteria:** Every action step cites exact current source locations. Stale/missing/misrouted profiles trigger fallback. Evaluation compares hierarchical retrieval with direct-manifest baseline and accepts it only if source recall/groundedness are not degraded while latency or precision improves.

### Phase 5 - Project draft helpers and safety controls

**Status:** Not started

**Goal:** Draft useful Project logs and automatically generate source-bounded procedure candidates with transparent review need, without owning product mutations or execution state.

**Prerequisites:** Cited response model; Project/Equipment scope schemas; current approved Project-source manifest; idempotent input fingerprint; review-need rubric; human-review requirements; prompt-injection corpus.

**Deliverables:** Project log draft helper with `PROJECT|EQUIPMENT` scope; procedure-generation LangGraph invoked when Web supplies required description plus eligible sources; topic/requirement extraction; source retrieval/reranking; per-step citation binding; coverage/conflict/freshness/applicability/hardware-criticality analysis; deterministic `LOW|MODERATE|HIGH|SEVERE` review-need classification with reasons/blocking findings; stable ordered step IDs; `requiresHumanReview`; regeneration/diff and edited-step citation-revalidation contracts; injection/safety guardrails; output validation; optional finalized-log embedding pipeline when policy enables it.

**Exit criteria:** Identical Project input fingerprints return idempotent compatible candidates. Every operational step has current source citations; unsupported steps are omitted and reported as gaps. Severe findings are explicit and machine-readable. The service never fabricates a procedure while sources are missing, never overwrites an edited Web draft, and never marks output submitted/approved/published, reorders persisted records, ticks steps, creates runs, or completes work.

### Phase 6 - Evaluation, observability, and production readiness

**Status:** Not started

**Goal:** Prove routing/retrieval reliability for safety-conscious release.

**Prerequisites:** Phase 1-5 flows; representative sources/entities; subject-matter-reviewed cases; SLOs.

**Deliverables:** Dataset for direct docs, Equipment routing, Project composition, stale/missing profiles, changed versions, no evidence, conflicts, logs, and prompt injection; profile routing recall, document recall@k, MRR/nDCG, citation validity, groundedness, safety-state accuracy, latency and fallback-rate metrics; traces and failure tests.

**Exit criteria:** Accepted thresholds pass against the direct-manifest baseline; traces identify profile selection, fallback, source filters, reranking, model calls, and citations; Pinecone/OpenAI failures return safe typed states.

## Completion tracking

Change phase status only with code, contract tests, evaluation evidence, and the matching `../../Development_Plan.md` integration gate.
