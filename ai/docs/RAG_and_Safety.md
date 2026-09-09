# Retrieval, Entity Routing, Citation, and Safety Design

## Mandatory contributor workflow

Before planning or changing retrieval, models, prompts, providers, parsing, embeddings, vector storage, evaluation, or safety behavior, read and strictly follow `../../AGENTS.md`, `../../Agent.md`, `AI_Implementation.md`, `../../Development_Plan.md`, `../../web/docs/API_Contract.md`, and `../../web/docs/Environment.md`. These constraints apply across every phase and to every AI model contributing code. Package/provider documentation is implementation input, not authority to weaken product boundaries, access control, evidence rules, citations, or the LangChain/LangGraph integration policy.

## Integration boundary

Implement model calls, embeddings, Pinecone vector-store access, loaders, retrievers, and related AI-provider capabilities through maintained LangChain integrations; compose multi-step control flow in LangGraph. Do not use OpenAI, Pinecone, or comparable provider SDKs directly in application workflow code. If no suitable LangChain/LangGraph capability exists, isolate a documented, tested exception in `adapters/` with a migration path back to the framework abstraction.

## Why entity profiles help—and where they do not

Equipment/Project profile vectors can reduce the number of source documents searched and add vocabulary that a short user question may omit. They are useful as a first-stage router. They are not a database join, access-control record, active-version pointer, or answer source.

The robust design therefore uses three layers:

1. **MongoDB entity/document graph:** authoritative Equipment/Project relationships, logical documents, active versions, authorization, and profile freshness.
2. **Pinecone entity profiles:** derived `ENTITY_PROFILE` embeddings used to select likely authorized scopes.
3. **Pinecone source chunks:** derived `SOURCE_CHUNK` embeddings used to support answers and citations.

This hierarchy improves focus only when measured. The system always retains a structural fallback to authorized active source versions.

## Source chunk record

Phase 7's initial visual asset foundation preserves explicit PDF pages/regions as
private version-bound PNGs. Rendering does not establish visual understanding,
model evidence, OCR correctness or vector-index readiness. These assets are not
currently supplied to the answering graph and cannot support Chat claims. The
future visual retrieval branch must extend scope/citation validation and receive
independent image-understanding evaluation before use as evidence. Current
`SOURCE_CHUNK` and `ENTITY_PROFILE` filters/citation rules remain in force.

```text
recordType = SOURCE_CHUNK
chunkId
documentId / documentVersionId
documentTitle / documentType / revision
page / section / sourceAnchor
approvalState / approvedAt / activeAt
originalFileId / originalStorageReference
tenantOrOrganizationId / environment
chunkText / extractionQuality / contentFingerprint
```

Use deterministic IDs such as `<documentVersionId>:<page-or-section>:<chunkOrdinal>`.

## Entity profile record

```text
recordType = ENTITY_PROFILE
profileId / profileVersion / profileFingerprint
entityType = EQUIPMENT | PROJECT
entityId
tenantOrOrganizationId / environment
generatedDescription
systems / components / capabilities
failureModes / searchHints / coverageTopics
freshnessState / generatedAt
```

Keep Pinecone metadata compact. MongoDB stores full provenance, active document/entity mappings, and included Equipment relationships. Project profile generation receives bounded included-Equipment projections with profile ID/version/fingerprint, freshness, summary, and coverage topics. The resulting Project profile may retain compact Equipment profile identifiers, but retrieval expands entities through the current request manifest rather than following vector references or chaining Pinecone lookups.

## Profile inputs and refresh triggers

### Equipment profile

- optional user description;
- generated description from current approved active documents;
- Equipment type/model/location and safe non-sensitive metadata;
- summarized document coverage: what each source can answer;
- systems, components, operating concepts, likely failure/query vocabulary;
- active document IDs/versions in provenance (MongoDB), not as large Pinecone arrays.

### Project profile

- mandatory Project description;
- direct Project document summaries;
- included Equipment IDs and current Equipment profile summaries/versions;
- controlled procedure coverage;
- eligible Project maintenance-log coverage;
- Project-level pipeline/work relationship vocabulary.

### Invalidation/refresh

Mark affected profiles stale and enqueue idempotent refresh when:

- user/Project description changes;
- Equipment is added to or removed from a Project;
- a direct entity document link is added/removed;
- a document's active approved version changes;
- a controlled procedure becomes current;
- an eligible finalized Project log changes retrieval coverage.

An Equipment profile refresh also invalidates each Project profile that includes it. The source graph and active-version manifest are immediately current; profile refresh may finish asynchronously.

## Retrieval sequence

The profile router is implemented but opt-in (`ENTITY_ROUTING_ENABLED=false`
by default). Until the representative evaluation gate accepts it, unassigned
questions use the current authorized manifest directly. Explicit assignments
still narrow that manifest. Enabling the optimization never changes authorization.

1. Web authenticates and resolves current allowed active document versions, allowed Equipment/Project profiles, entity relationships, and authorized `@` assignments.
2. AI validates/deduplicates the manifest and builds pre-retrieval Pinecone filters.
3. AI interprets the question using bounded current-session history as context only.
4. AI selects a routing strategy:
   - assigned document -> direct source retrieval;
   - assigned Equipment/Project -> manifest expansion;
   - no assignment -> filtered profile-vector search across authorized entities.
5. AI expands selected entities to active versions using manifest mappings—not Pinecone joins.
6. If no profile is usable, confidence is low, or retrieved source coverage is weak, AI fans out to related authorized entities or the bounded complete active-version manifest.
7. AI queries `SOURCE_CHUNK` records with record type, tenant/environment, approval, and allowed active version filters applied before matching.
8. AI reranks for semantic/keyword relevance, applicability, source authority, active revision, extraction quality, and source diversity.
9. AI assesses sufficiency/conflict/outdated state and generates only from retrieved chunks.
10. AI validates source IDs for every claim/step and returns routing diagnostics plus response-scoped citations.
11. Web validates original text/anchor and a newly resolved authorization manifest
    before persisting the result; source opening separately reauthorizes the exact
    immutable version. Access or governing-version changes during generation
    cannot persist an obsolete answer as current guidance.

## LangGraph state

Recommended typed state fields:

```text
request / question / boundedHistory
scopeManifest / assignments
routeMode / candidateProfiles / selectedEntities / routingConfidence
expandedDocumentVersionIds / usedStructuralFallback
retrievedChunks / rerankedChunks
evidenceCoverage / conflicts / freshness
draftAnswer / verifiedCitations / evidenceState / warnings
```

Recommended nodes:

```text
validate_scope
interpret_question
select_route
search_entity_profiles
expand_entity_graph
retrieve_source_chunks
evaluate_retrieval
structural_fallback_or_continue
rerank_and_grade_evidence
generate_answer
verify_citations
assemble_response
```

Bound fallback iterations and retrieved context. Never loop until a desired answer appears.

## Version propagation and retrieval correctness

- Entity links target logical `documentId` with `LATEST_APPROVED` unless explicitly pinned.
- Web activates a version only after successful indexing, then all dependent manifests resolve the new `activeVersionId`.
- Old source vectors may remain for historical source viewing/evaluation, but they are excluded by active-version filters. They may be deleted/disabled later according to retention policy.
- A stale Project profile may still mention an old coverage summary. This cannot cause an old citation because source retrieval is filtered to current manifest version IDs.
- A new active version is searchable immediately through structural expansion even before profile refresh completes.

## Evidence states

Factual document lookup and operational instruction requests require different
coverage checks. A cited value, label or historical observation does not imply
permission to operate equipment. The answer generator and independent verifier
both receive the question and authoritative active/approved source metadata.
Missing safety prerequisites block operational instructions, not unrelated
document facts. Source text cannot override approval/access metadata. A fixture
disclaimer or old publication date alone does not make an active source outdated;
an explicit applicable expiry/supersession statement can. Never upgrade a model's
negative evidence state merely because retrieval returned a chunk.

Generation and revalidation use the same criticality rubric, assessed from the
Project purpose and actual unchanged instructions. Do not hard-code HIGH for
every edited draft. Generation verification, individual-step revalidation and
whole-draft assessment retain any high-criticality finding; an off-purpose action
does not become low criticality because its Project is document-only.
High-criticality actions retain HIGH and severe evidence gaps
remain blocking regardless of the user's requested label or prior badge.

| Status        | Meaning                                                       | Response behavior                                                  |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `approved`    | Sufficient applicable current evidence.                       | Return concise cited guidance and source access.                   |
| `incomplete`  | Related evidence exists but cannot support a complete answer. | Show only supported facts and state the gap.                       |
| `conflicting` | Applicable current sources disagree.                          | Expose conflict; do not merge into a procedure.                    |
| `outdated`    | Only non-current/non-approved evidence appears relevant.      | No operational steps; request review/escalation.                   |
| `unavailable` | AI/Pinecone/provider cannot safely complete retrieval.        | No answer steps; Web document/source navigation remains available. |

## Procedure generation and review need

Procedure generation is a separate LangGraph flow from Chat. Web supplies the mandatory Project description, a current authorization-checked source manifest, and an idempotent fingerprint. The flow:

1. rejects/waits when no approved, indexed direct Project source is available;
2. extracts intended procedure scope, equipment/pipeline context, required topics, prerequisites, hazards, limits, and completion conditions;
3. retrieves/reranks current source chunks inside the supplied manifest;
4. generates only steps that have applicable cited support, with stable step IDs and ordered positions;
5. evaluates per-step and overall coverage, conflicts, freshness, applicability, and hardware/safety criticality;
6. returns a structured candidate, citations, gaps, blocking findings, and review need; Web persists the draft.

`reviewNeed` is a review-work classification, not a probability of safety:

| Level      | Typical evidence state                                                                                                 | Product behavior                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `LOW`      | Strong current applicable coverage, no material conflict; hardware criticality accounted for.                          | Human review still required; normal edit/approval workflow.                                                               |
| `MODERATE` | Minor coverage/applicability uncertainty or non-blocking freshness concern.                                            | Highlight affected topics/steps and require confirmation.                                                                 |
| `HIGH`     | Material coverage gap, low applicability confidence, or high-criticality steps needing stronger verification.          | Prominent warning; Owner must resolve/acknowledge every reason before approval.                                           |
| `SEVERE`   | Missing mandatory safety evidence, current-source conflict, outdated governing source, or unsupported critical action. | Return no unsupported action; publication is blocked until findings are resolved and evidence is regenerated/revalidated. |

Never average a severe blocking condition into a lower score. Store structured factor states and reasons rather than relying on one opaque numeric confidence. Manual edits do not become source-grounded automatically: changed steps return to `citationReviewState: NEEDS_REVIEW` until citations are confirmed/replaced or the bounded revalidation flow succeeds.

AI never manages recurrence or execution. Scheduling, new-period run creation, ticks, notes, exceptions, and completion are deterministic Web/MongoDB workflows. A prior run is immutable audit history and must never be fed back as proof that the next run's steps were completed.

Implementation details: candidate generation uses the answering configuration;
independent answer/procedure/step/log verification and whole-draft assessment use
the configured complex model with high reasoning effort. This is a review aid,
not independent human certification. Every Web draft edit resets approval and
requires whole-draft revalidation, even when reorder preserves step IDs. A
`supportedStepIds` list without exact `stepCitations` cannot confirm evidence.

Only explicitly selected current included-Equipment sources supplement direct
Project documents for procedure generation/revalidation. Published procedure
exports are immutable, separately indexed `SOURCE_CHUNK` records with
`CONTROLLED_PROCEDURE` authority and `PROJECT_PROCEDURE` inclusion. They enter
current retrieval only when the published pointer, governing citations and full
Project/source fingerprint are current. They are not copied logical Documents.
Log evidence remains disabled; submitted logs are historical product records,
not implied proof for operational instructions.

## Authority and ranking policy

Default authority order for safety-critical guidance:

1. current approved controlled safety procedure;
2. current approved OEM/manual/technical procedure;
3. current approved Project-specific procedure/document;
4. finalized Project maintenance logs as historical observations;
5. entity profiles for routing only, never evidence.

Authority does not replace relevance; conflicts between applicable high-authority sources produce `conflicting`.

## Safety and injection boundaries

- Treat questions, source chunks, user descriptions, extracted metadata, entity profiles, and history as untrusted.
- Source/profile text cannot change scope, filters, tool permissions, citation rules, or response schemas.
- Never query all profiles or all chunks when the allowed filter is empty.
- Never cite profile-generated descriptions or prior assistant turns as evidence.
- Prohibit publication, direct control, or unsupported certainty claims.
- Prohibit AI-created step completions, recurrence resets, run completion, and any inference that a physical action occurred from chat/history alone.
- Require escalation language for incomplete/conflicting/outdated/unavailable cases.

## Evaluation plan

Compare hierarchical retrieval against a direct authorized-manifest baseline. Measure:

- entity routing recall@k and precision@k;
- source document/chunk recall@k;
- MRR/nDCG after reranking;
- citation validity and claim-to-citation coverage;
- answer groundedness and evidence-state accuracy;
- p50/p95 routing + retrieval latency;
- structural-fallback rate;
- stale/missing-profile recovery rate;
- token/context reduction without recall degradation.

Accept entity routing as an optimization only if source recall and safety metrics do not regress. A faster route that misses the governing manual is a failure.

The committed `../evaluations/` runner compares synthetic baseline and hierarchical
guards, with explicit `--live` for reviewed private requests. Synthetic injection
tests model invalid output to verify rejection; they do not estimate a model's
susceptibility. Semantic groundedness and SME acceptance are never inferred from
valid citation IDs. See its README and the root manual testing guide for metric
definitions, evidence records and the still-open representative acceptance gate.

Raw source, history, question, model and signed URL content is excluded from
telemetry. Metadata-only spans describe query/filter counts, graph stage,
fallback, timings and validation outcome. Raw LangSmith callbacks are disabled.

## Required test cases

- A question for Equipment A cannot cite a document linked only to inaccessible Equipment B.
- A Project may retrieve direct Project sources and sources from its included Equipments, not another Project.
- One logical document linked through two Equipments resolves one current version and one source-vector set.
- Activating Equipment document version 3 makes every linked Project retrieve version 3 without copied files/vectors.
- Version 3 indexing failure leaves version 2 active and retrievable.
- Stale/missing Project profile still finds a newly active Equipment source through fallback.
- `@equipment`/`@project` narrows scope; it never grants access.
- A profile-only semantic match returns no answer unless source chunks support it.
- Project Equipment-scoped maintenance log is rejected if the Equipment is not included.
- Returned missing/unauthorized citations are rejected by Web.
- Project creation with documents skipped remains `WAITING_FOR_SOURCES`; no procedure steps are generated until an eligible source activates.
- The same input fingerprint is idempotent and cannot create duplicate saved drafts.
- A conflicting lockout instruction produces `SEVERE`, omits the unsupported operational step, and blocks publication.
- Reordering a draft preserves stable step IDs/citations; changing step meaning sets citation review to `NEEDS_REVIEW`.
- A recurring procedure's September run checks do not appear in the October run; September history remains unchanged.
- AI cannot tick a procedure step or mark a run complete under any request payload.
# Phase 7 description safety boundary

Verified visual descriptions are untrusted retrieval aids, not new approved facts.
The describe workflow checks actual derivative pixels twice using separate model
calls, rejects unsupported descriptions, and retains uncertainty about illegible
labels and ambiguous connections. This cannot guarantee perfect image perception.
No generated description enters ordinary source chunks, procedures or Chat evidence
in the current milestone. Future visual answers must inspect retrieved pixels and
validate exact asset/version/checksum authorization; a description alone cannot
justify a pixel-only claim. Source text embedded in images cannot grant authority.

## Phase 7 planned visual relevance and evidence controls

- Text and visual-description vector scores are not comparable across namespaces.
  Future retrieval filters each namespace independently and uses bounded rank-based
  fusion rather than raw-score arithmetic, with deterministic ties for auditability.
  Text/profile vectors use configured `PINECONE_NAMESPACE`; future visual-description
  vectors use configured `PINECONE_VISUAL_NAMESPACE`. Deployment maps them to
  `{environment}` and `visual-{environment}`. Namespace names never come from
  request or model content.
- A visual-description match is only a candidate. The relevance gate may label a
  fused authorized candidate `REQUIRED`, `HELPFUL`, or `NOT_RELEVANT`; it cannot
  introduce an asset, widen scope, or create an answer claim. Generic/duplicate,
  low-confidence, and high-uncertainty visuals are penalized before this gate.
- `REQUIRED`/`HELPFUL` are not permission to cite an image. The workflow must
  re-download the exact checksum-bound derivative and inspect pixels in the same
  turn. A visual claim maps to the asset inspected. If that fails, evidence is
  `UNAVAILABLE`; an image-dependent answer is incomplete.
- A visual may clarify a text-grounded answer automatically even if a user does not
  ask for an image. It is not attached merely because it was retrieved: positive
  relevance and verified material support are required.
- For physical action, operating values, safety isolation, or procedure claims, a
  diagram does not replace applicable approved source chunks or the existing safety
  rubric. Distinguish visible labels/connections from inferred operation.
- Visual failures never expose a raw error, signed URL or pixels, widen filters, or
  discard a separately grounded text answer solely because optional visual work failed.
