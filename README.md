# P.A.T.C.H.

**Precision Assistant for Technical Context & Hardware**

P.A.T.C.H. is a decision-support web application for manufacturing floor technicians. Its session-based Chat page helps users find fast, source-referenced maintenance guidance across the documents they are allowed to access, using approved manuals, Project maintenance logs, and safety procedures.

It is not an equipment-control system and does not act as an autonomous safety authority.

## Contributor and AI-agent requirements

Before planning, coding, installing packages, or changing documentation, read and strictly follow [AGENTS.md](AGENTS.md) and [Agent.md](Agent.md), then every phase/module document they require. These instructions apply to all AI models and human contributors using AI assistance. Do not proceed from chat history alone, and do not silently resolve conflicts between authoritative documents.

## The problem

During an equipment failure, technicians often need to search across disconnected manuals, logs, and safety documents. That delays diagnosis and can lead to work being performed without the most relevant approved context.

P.A.T.C.H. preserves those original records, maps them to the applicable Equipments and Projects, and returns evidence-backed guidance with traceable citations.

## Core capabilities

- Manage Equipments and Projects. Project descriptions are mandatory; Equipment descriptions are optional but recommended.
- Create projects as their Owner, discover existing projects, and request/approve project membership.
- Retain original documents and their revisions before they are processed.
- Manage documents directly from an Equipment or Project, either by adding a new logical document or by adding an immutable version to an existing document.
- Reuse the ingestion flow during Equipment/Project creation, or skip documents and add them later.
- Compose a Project from direct Project documents plus documents linked to its included Equipments. Logical-document links resolve the latest approved active version, so an Equipment document update propagates to linked Projects without duplicating files, metadata, chunks, or vectors.
- Index only approved document content for retrieval.
- Run persistent, auto-titled chat sessions with per-session history and source-backed AI turns.
- Search the user's accessible document set automatically, or use `@` references to assign documents, Equipments, Projects, or other supported entities to a chat turn.
- Show citations with document revision, page/section, excerpt, and approval state.
- Let technicians create Project-scoped maintenance logs for either overall Project work or one included Equipment.
- Automatically generate and save a source-linked procedure draft once a new Project's description and eligible Project documents are ready. The UI exposes evidence-derived review need, editable/reorderable steps, Owner-controlled publication, and recurring execution runs with auditable step completion.

## Architecture

```text
Technician
    |
    v
Next.js Web Application (web)
  - UI, authentication, authorization
  - MongoDB and original-document workflow
  - Public API and AI-service mediation
    |
    | authenticated, versioned OpenAPI contract
    v
Python FastAPI AI Service (ai)
  - OCR/extraction, summaries, chunks, embeddings
  - Pinecone source chunks and Equipment/Project routing profiles
  - LangGraph/LangChain orchestration
  - Entity routing, structural fallback, cited answers, drafts
```

### Ownership boundaries

| Component     | Owns                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`         | Next.js UI, sessions, role checks, MongoDB records, original-document upload/storage coordination, audit events, and server-side calls to AI.                                                |
| `ai`          | The full ingestion and RAG lifecycle: extraction/OCR, chunking, embeddings, Pinecone indexing, retrieval, reranking, LangGraph flows, evidence assessment, citations, answers, and drafts.   |
| MongoDB       | System of record for users, Project membership, Equipment/Project/document links, logical documents and versions, procedures, logs, references, entity-profile provenance, and audit events. |
| Cloudflare R2 | Private, immutable retained original document files and revisions. Web owns its credentials and issues AI short-lived source URLs.                                                           |
| Pinecone      | Derived vector index for approved source chunks and AI-only Equipment/Project retrieval profiles; never the system of record.                                                                |

### Retrieval approach

P.A.T.C.H. uses hierarchical retrieval. FastAPI first searches authorized Equipment/Project routing profiles (unless an explicit `@` reference already defines scope), expands the selected entities through the current MongoDB-derived manifest, and then retrieves exact chunks from the current approved document versions. A missing, stale, or weak profile triggers structural fallback across authorized active versions. Routing profiles improve search focus; only source chunks can support citations.

The browser never calls the AI service directly. The FastAPI Pydantic/OpenAPI contract is the canonical shared schema; the Web application consumes generated or validated TypeScript types from it.

## Safety and evidence principles

1. Every chat turn is constrained to approved documents the user is authorized to access. `@` references can explicitly restrict or prioritize the relevant documents/entities; when absent, retrieval searches the full accessible document set.
2. Retrieval is scoped by current user access and recalculated on every turn; chat history improves interpretation but is never source evidence.
3. Every answer claim must be source-referenced.
4. Missing, conflicting, incomplete, outdated, or unavailable evidence results in an explicit safe state—not an invented procedure.
5. Maintenance-log output is always a user-editable draft until submitted inside a Project.
6. AI-generated procedures remain drafts until the owning Project Owner reviews and publishes a controlled version. `LOW | MODERATE | HIGH | SEVERE` review need describes evidence/review effort, not operational safety approval; severe evidence gaps block publication.
7. Procedure definitions and procedure runs are separate. Recurrence opens a new unchecked run for each period and preserves all prior step-completion history.
8. Each document version, original file, and source-chunk vector set exists once. Equipment/Project links reference the logical document and resolve its current approved version. AI entity-profile vectors route retrieval but never replace this authoritative graph.
9. Important actions are auditable, including membership requests/decisions, uploads, mappings, approvals, questions, answers, procedure generation/edits/reordering, run-step checks, logs, and publishing.

## Repository layout

```text
P.A.T.C.H._PRD.pdf              Product requirements document
P.A.T.C.H._Mock_UX.pdf          Original UX baseline
PRODUCT.md                      Durable product context and constraints
DESIGN.md                       Durable application-shell and component system
Development_Plan.md             Six-phase cross-module delivery plan
Agent.md                        Repository engineering guide
web/                            Next.js UI and backend application
  .env.example                  Complete Web configuration template
  docs/                         UI, backend, and API contract guides
ai/                             Python FastAPI AI service
  .env.example                  Complete AI configuration template
  docs/                         AI implementation and RAG/safety guides
```

## Documentation map

| Need                                  | Document                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Product requirements                  | [P.A.T.C.H._PRD.pdf](P.A.T.C.H._PRD.pdf)                                 |
| Original UX baseline                  | [P.A.T.C.H._Mock_UX.pdf](P.A.T.C.H._Mock_UX.pdf)                         |
| Durable product context               | [PRODUCT.md](PRODUCT.md)                                                 |
| Durable visual system                 | [DESIGN.md](DESIGN.md)                                                   |
| Delivery phases and integration gates | [Development_Plan.md](Development_Plan.md)                               |
| Shared repository rules               | [Agent.md](Agent.md)                                                     |
| Web UI implementation                 | [web/docs/UI_Implementation.md](web/docs/UI_Implementation.md)           |
| UI design asset library               | [web/docs/UI_Design.md](web/docs/UI_Design.md)                           |
| Web backend implementation            | [web/docs/Backend_Implementation.md](web/docs/Backend_Implementation.md) |
| Web-to-AI schema and endpoints        | [web/docs/API_Contract.md](web/docs/API_Contract.md)                     |
| Environment configuration             | [web/docs/Environment.md](web/docs/Environment.md)                       |
| AI service implementation             | [ai/docs/AI_Implementation.md](ai/docs/AI_Implementation.md)             |
| Retrieval design and safety controls  | [ai/docs/RAG_and_Safety.md](ai/docs/RAG_and_Safety.md)                   |

## Delivery approach

The MVP progresses through six synchronized phases across Web UI, Web backend, and AI backend:

1. Foundation
2. Context and master data
3. Documents and indexing
4. Evidence-backed assistant
5. Controlled workflows
6. Harden, demonstrate, and deploy

The detailed scope and integration gate for every phase are in [Development_Plan.md](Development_Plan.md).

## Getting started

Implementation scaffolding and local environment instructions will be added in Phase 1. Before adding code, read [Agent.md](Agent.md), then the documentation for the module you are changing. Update [web/docs/API_Contract.md](web/docs/API_Contract.md) before changing any Web-to-AI boundary.
