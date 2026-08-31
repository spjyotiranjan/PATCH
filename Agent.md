# P.A.T.C.H. Development Guide

## Repository purpose

P.A.T.C.H. (Precision Assistant for Technical Context & Hardware) helps floor technicians find source-referenced maintenance guidance through a global, session-based Chat page. It is a decision-support application, not an equipment-control system and not an autonomous safety authority. User-facing and domain terminology is `Equipment` / `Equipments` in schemas, routes, copy, and visual references.

## Repository structure

```text
P.A.T.C.H._PRD.pdf                  # Product source of truth
P.A.T.C.H._Mock_UX.pdf              # Original UX baseline; current views live in web/ui-design
PRODUCT.md                           # Durable product context and terminology
DESIGN.md                            # Durable application-shell/component rules
Development_Plan.md                 # Cross-module six-phase plan
web/                                 # One Next.js application: UI and API backend
  .env.example                       # Complete Web configuration template
  docs/
    UI_Implementation.md
    UI_Design.md
    Backend_Implementation.md
    API_Contract.md
    README.md
  ui-design/                         # Phase-mapped, high-fidelity WebP UI references
ai/                                  # Python FastAPI retrieval and AI service
  .env.example                       # Complete AI configuration template
  docs/
    AI_Implementation.md
    RAG_and_Safety.md
    README.md
```

## Architecture boundaries

- `web` owns the Next.js user interface, authentication/session handling, project Owner/Member authorization, MongoDB access, personal-document library/original-document workflow, and the public application API. It mediates between UI, MongoDB/original-file storage, and `ai`; it does not perform ingestion, retrieval, Pinecone access, reranking, or LLM prompting.
- `web` calls `ai` only through a server-side, authenticated API client. Browser code must never call the AI service directly. The connection uses versioned schemas generated from FastAPI's OpenAPI/Pydantic contract and consumed as TypeScript types in `web`.
- `ai` owns the full ingestion and RAG lifecycle: extraction/OCR, chunking, embedding, Pinecone indexing, retrieval, LangGraph orchestration, evidence grading, citation assembly, answer generation, and draft generation. It does not write directly to product records; it returns structured results to `web`.
- MongoDB is the system of record for users, project memberships/requests, Equipments, Projects, logical documents, immutable versions, entity-document links, active-version pointers, AI retrieval-profile projections, procedures, project maintenance logs, source references, and audit events. Cloudflare R2 is the private canonical store for original document bytes and revisions. Each document version has one R2 object and one source-chunk vector set. Equipment and Project applicability is represented by MongoDB links to the logical document, not copied files, metadata, chunks, or vectors. Pinecone stores derived source-chunk vectors and separate AI entity-profile vectors; it is never the system of record.

## Shared engineering rules

1. Project roles are only `OWNER` and `MEMBER`. Project creation creates one active `OWNER` membership for the creator; `OWNER` includes all member access and owners approve/reject pending membership requests.
2. A `Document` is a logical record and a `DocumentVersion` is immutable. `EquipmentDocumentLink` and `ProjectDocumentLink` target the logical `documentId` with `versionPolicy: LATEST_APPROVED` by default, so activation of a successfully indexed new version propagates automatically. An explicit pinned-version policy is allowed only for controlled historical use. Never copy an original, metadata record, chunk, or vector for another entity.
3. Every chat turn is restricted to the current user's accessible document set. `web` resolves active logical-document links, active Project memberships, Project-to-Equipment membership, and current `activeVersionId` pointers into a deduplicated retrieval-scope manifest before `ai` queries Pinecone. `@` references explicitly constrain or prioritize that manifest; they never grant access.
4. Every answer claim must carry at least one source reference: document ID, revision/version, page or section, excerpt, and approval state.
5. If approved applicable evidence is absent, incomplete, conflicting, or outdated, return an explicit evidence state. Do not manufacture a procedure.
6. Maintenance logs exist only inside a Project. A log has `scopeType: PROJECT | EQUIPMENT`; an Equipment-scoped log must reference an Equipment included in that Project. Generated text remains a draft until the user submits the final wording.
7. AI-generated safety procedures remain drafts until the Project Owner reviews and publishes a controlled version.
8. Preserve original documents and versions. Do not overwrite a published document or procedure.
9. All membership, publish, approve, upload, mapping, question, answer, and log actions require an audit record with actor, timestamp, context, and relevant IDs.
10. Keep source viewing and normal document search available when the AI service is unavailable.
11. The complete initial configuration contract is `web/.env.example` and `ai/.env.example`. Web alone owns Cloudflare R2 credentials; AI receives a short-lived R2 source URL, never R2 credentials.
12. Chat sessions are user-owned and have auto-generated titles. Conversation history aids interpretation but is never evidence; every new user turn recomputes current access, performs fresh scoped retrieval, and receives response-scoped citations.
13. Project descriptions are mandatory. Equipment descriptions are optional but recommended. AI-generated Equipment/Project retrieval profiles are derived, versioned routing aids and must never replace current MongoDB links, active-version resolution, or source-chunk citations.
14. Equipment/Project creation may upload documents through the standard ingestion flow or skip the step. The same document manager later supports `ADD_NEW_DOCUMENT` and `ADD_NEW_VERSION`.

## Six-phase synchronization rule

`web` UI, `web` backend, and `ai` move through the same numbered phase together. A phase is complete only when its cross-module integration gate in `Development_Plan.md` passes. Do not build later-phase UI against invented contracts; update `web/docs/API_Contract.md` first when a contract changes.

## Definition of done for any feature

- Role and authorization behavior is implemented and tested.
- Equipment/Project context is enforced when the feature uses documents or AI.
- Empty, loading, error, and unavailable-service states are designed.
- Relevant source, document version, and audit behavior are covered.
- Web and AI contract tests pass where the feature crosses the service boundary.
- The implementation is checked against the corresponding Mock UX view.
