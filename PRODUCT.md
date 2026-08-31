# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Manufacturing-floor technicians use P.A.T.C.H. during equipment failures and maintenance work to find immediate, source-referenced guidance. Project Owners also assemble projects, manage members, documents, maintenance logs, and controlled safety procedures.

## Product Purpose

P.A.T.C.H. reduces downtime by preserving original technical records, relating them to Equipments and Projects, and using evidence-bounded AI retrieval to answer questions with traceable citations. It supports decisions; it does not control equipment or act as an autonomous safety authority.

## Positioning

P.A.T.C.H. combines canonical document/version management with an authorization-aware entity graph and AI-only retrieval profiles. This lets the assistant route a question to likely Projects, Equipments, and active source versions before retrieving exact cited passages.

## Operating Context

- Users create Equipments and Projects, optionally attach documents during creation, and manage documents later from the owning entity.
- A document is a logical record with immutable versions. Entity links target the logical document so a newly approved active version propagates to every linked Project without copying files, metadata, chunks, or vectors.
- Project membership has only `OWNER` and `MEMBER`. The creator is the initial Owner; non-members may request access and the Owner approves or rejects it.
- Maintenance logs exist only within a Project and describe either overall Project work or work on one Equipment included in that Project.
- A newly created Project automatically receives a saved procedure draft after its required description and first eligible approved Project source are ready. If documents were skipped or are still processing, generation remains visibly pending and resumes when sources activate.
- Procedures separate the controlled, versioned definition from dated execution runs. Recurring procedures open a fresh run each period; step ticks reset for the new run while prior run history remains immutable.
- Global Chat keeps user-owned sessions, supports `@` assignments, and performs fresh access-scoped retrieval for every turn.

## Capabilities and Constraints

- Project description is mandatory. Equipment description is optional but recommended.
- Documents can be added as a new logical document or as a new version of an existing document from Equipment and Project document managers.
- Equipment and Project creation reuse the same ingestion workflow and permit the document step to be skipped.
- Cloudflare R2 stores immutable original versions; MongoDB is the product system of record; Pinecone stores derived source-chunk vectors and AI routing-profile vectors.
- Next.js is the UI and product backend. Python FastAPI owns ingestion, retrieval, LangGraph/LangChain orchestration, OpenAI calls, evidence assessment, citations, and AI drafts.
- AI procedure output carries source citations and a `LOW | MODERATE | HIGH | SEVERE` review-need classification derived from coverage, conflicts, freshness, applicability, and hardware/safety criticality. Every level still requires human review; severe evidence gaps block publication.
- Equipment mutation authorization outside Project roles remains an implementation policy to confirm before Phase 2; no third Project role may be introduced implicitly.

## Brand Commitments

The product name is **P.A.T.C.H. — Precision Assistant for Technical Context & Hardware**. The application uses the supplied deep-navy left navigation and compact title bar as the binding shell reference. User-facing terminology is `Equipment` / `Equipments`.

## Evidence on Hand

- `P.A.T.C.H._PRD.pdf`
- `P.A.T.C.H._Mock_UX.pdf`
- `web/ui-design/` high-fidelity visual references
- User-supplied navigation, page-title bar, and profile-control screenshots in the project conversation

No real customer, performance, downtime-reduction, or retrieval-quality claims have been supplied; future product surfaces must not fabricate them.

## Product Principles

1. Canonical sources and immutable versions before AI convenience.
2. Current authorization and active-version resolution on every retrieval.
3. Entity profiles route retrieval; exact source passages prove answers.
4. Project work stays in Project context, including maintenance logs.
5. Human review owns controlled records and safety decisions.

## Accessibility & Inclusion

Desktop and tablet interfaces require keyboard access, visible focus, readable contrast, touch-friendly targets, screen-reader state announcements, and text/icon labels in addition to semantic colour.
