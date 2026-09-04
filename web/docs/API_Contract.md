# Web-to-AI API Contract

## Mandatory contributor workflow

Before modifying this contract or either implementation, read and strictly follow `../../AGENTS.md`, `../../Agent.md`, `../../Development_Plan.md`, both module implementation documents, `Environment.md`, and `../../ai/docs/RAG_and_Safety.md`. Contract changes are contract-first: update Pydantic schemas and this document, export the committed OpenAPI artifact, regenerate Web types, update both consumers, and pass the cross-module tests in one coordinated change. Dependency or provider examples never override repository ownership, safety, or package-selection rules.

## Boundary and schema ownership

The browser calls only Next.js routes. Next.js authenticates/authorizes, owns MongoDB/R2 and product workflows, resolves current active versions, and calls FastAPI over a private authenticated boundary. FastAPI Pydantic models and exported OpenAPI are the canonical shared schemas; Web consumes generated/validated TypeScript types.

Every service request includes `requestId`, `contractVersion`, service authentication, and sufficient immutable identifiers for idempotency. Contract-breaking changes require a versioned route or compatible optional-field evolution.

After changing this contract, reconcile [Setup_Guide.md](../../Setup_Guide.md), export the FastAPI OpenAPI document, regenerate the Web types, and verify the updated services before marking the current phase complete.

## Service authentication and correlation

Web signs every FastAPI request on the server. The browser never receives the shared secret and must never call FastAPI directly.

| Header                     | Value                                                    |
| -------------------------- | -------------------------------------------------------- |
| `x-patch-contract-version` | `v1`                                                     |
| `x-patch-request-id`       | One UUID per service request.                            |
| `x-patch-timestamp`        | Unix timestamp in seconds.                               |
| `x-patch-signature`        | `v1=<hex-hmac-sha256>` using `AI_SERVICE_SHARED_SECRET`. |

For `v1`, Web signs the UTF-8 canonical string below. `bodySha256` is the lowercase SHA-256 hex digest of the exact request body, or of the empty string when no body is sent.

```text
v1.<timestamp>.<requestId>.<UPPERCASE_METHOD>.<url-pathname>.<bodySha256>
```

FastAPI rejects missing/invalid signatures, unsupported contract versions, duplicate/replayed request IDs, and timestamps outside `AI_SERVICE_REQUEST_MAX_SKEW_SECONDS`. For JSON contract requests, the signed `x-patch-request-id` must equal the body `requestId`; the Web signer derives the header from that body field. FastAPI must propagate `requestId` in structured logs and responses where the endpoint schema permits it. Web applies `AI_SERVICE_TIMEOUT_MS` to every service request and exposes only typed unavailable states to browser callers.

## Web-owned browser resources

| Resource/route                                          | Required behavior                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /equipments`                                      | Creates Equipment with optional description and `documentsMode: ADD_NOW                                                                                                                                                                                       | SKIP_FOR_NOW`. |
| Equipment manage-access routes                          | An authenticated user requests Equipment manage access. Only that Equipment's creator/owner can approve or reject the request. An approved grant allows mutation of that Equipment only; it grants no Project membership and cannot approve further requests. |
| `POST /projects`                                        | Requires description; creates included Equipment links and one active creator `OWNER` transactionally; supports optional document step.                                                                                                                       |
| Project membership routes                               | Discover/request/Owner approve-or-reject; only `OWNER` and `MEMBER`.                                                                                                                                                                                          |
| Equipment/Project document routes                       | List composed documents, add new logical document, add immutable version, link/unlink, review, approve, and inspect indexing/profile state.                                                                                                                   |
| `POST /documents/:documentId/versions`                  | Creates a new immutable version; never overwrites the active version.                                                                                                                                                                                         |
| `POST /document-versions/:versionId/activate`           | Internal/authorized transition after successful approval and indexing; atomically updates logical `activeVersionId`.                                                                                                                                          |
| `/projects/:projectId/maintenance-logs`                 | Project-only log workflow; scope is `PROJECT` or an included `EQUIPMENT`.                                                                                                                                                                                     |
| `/projects/:projectId/procedures`                       | Lists generation state, saved drafts, published definitions, review need, schedules, and runs. Project creation queues generation; missing eligible sources return `WAITING_FOR_SOURCES`.                                                                     |
| `/projects/:projectId/procedures/:procedureId/versions` | Create/read draft versions, edit/add/remove/reorder steps, request regeneration/diff, review, approve, publish, and inspect immutable history.                                                                                                                |
| `/projects/:projectId/procedures/:procedureId/runs`     | List/create idempotent recurrence runs and read completion history. The scheduler creates at most one run per procedure/version/period/timezone.                                                                                                              |
| `/procedure-runs/:runId/steps/:stepId/completion`       | Check/uncheck or annotate one step in the current run with actor/time audit; never mutates the procedure definition or prior run.                                                                                                                             |
| Chat/session routes                                     | Persist sessions/turns, resolve current scope, mediate AI, validate citations, and provide source access.                                                                                                                                                     |
| Settings routes                                         | Read/update profile fields and `theme: LIGHT                                                                                                                                                                                                                  | DARK           | SYSTEM`. |
| `POST /api/auth/signup`                                 | Creates a first-party email/password account from `name`, `email`, `password`, and `confirmPassword`. It never accepts or exposes social-provider data.                                                                                                       |

## First-party account sign-up

P.A.T.C.H. does not support social sign-in. The sign-up request is intentionally small:

```json
{
  "name": "Technician name",
  "email": "technician@example.com",
  "password": "user-selected-password",
  "confirmPassword": "user-selected-password"
}
```

Web validates the confirmation, normalizes the email, stores only a salted password hash, and returns the non-sensitive user identity. Password, confirmation, and password hash are never returned or added to audit/log context.

## Phase 2 Equipment, Project, and access contract

All routes below are authenticated, tenant-scoped, return the standard correlation header/error envelope, and persist an audit event for every mutation or access decision. Identifiers are MongoDB ObjectId strings. List responses use `{ "items": [...] }`; discovery never returns private Project content.

### Equipment resources

- `GET /api/equipments` lists Equipment owned by the actor or covered by an active manage-access grant.
- `POST /api/equipments` creates an Equipment and makes the actor its owner.
- `GET /api/equipments/discover` lists request-safe summaries for same-tenant Equipment the actor cannot already manage.
- `GET /api/equipments/:equipmentId` requires owner or active manage access.
- `PATCH /api/equipments/:equipmentId` requires owner or active manage access.
- `DELETE /api/equipments/:equipmentId` is owner-only and is rejected while the Equipment is included in a Project.
- `GET|POST /api/equipments/:equipmentId/access-requests` lists requests for the owner or creates one request for the current actor.
- `POST /api/equipments/:equipmentId/access-requests/:requestId/decision` is owner-only and accepts `{ "decision": "APPROVE" }` or `{ "decision": "REJECT" }`.

Equipment create/update fields are `name`, `type`, `location`, optional `description`, and `documentsMode`. Name, type, and location are required at creation. Description is optional and limited to 1,000 characters. `documentsMode` is `ADD_NOW` or `SKIP_FOR_NOW`; it records the creation workflow choice and does not upload a document in Phase 2.

Equipment discovery returns only `id`, `name`, `type`, `location`, and the caller's latest request state. It never exposes descriptions or owner details.

An approved Equipment request creates one active, idempotent manage-access grant. A manager may read and mutate that Equipment but cannot delete it, approve/reject requests, transfer ownership, or gain access to any Project through the grant.

### Project resources

- `GET /api/projects` lists Projects where the actor has active `OWNER` or `MEMBER` membership.
- `POST /api/projects` creates the Project, included-Equipment references, creator `OWNER` membership, and initial `WAITING_FOR_SOURCES` procedure-generation request atomically.
- `GET /api/projects/discover` lists only discoverable identity/status summaries for Projects where the actor is not an active member.
- `GET /api/projects/:projectId` requires active Project membership.
- `PATCH|DELETE /api/projects/:projectId` is Project-Owner-only.
- `GET|POST /api/projects/:projectId/membership-requests` lists requests for an Owner or creates one request for the current actor.
- `POST /api/projects/:projectId/membership-requests/:requestId/decision` is Owner-only and accepts `{ "decision": "APPROVE" }` or `{ "decision": "REJECT" }`.

Project create/update fields are `name`, mandatory `description`, `status`, `includedEquipmentIds`, and `documentsMode`. The actor must have owner or active manage access to every selected Equipment. Project inclusion stores Equipment IDs only; it never copies Equipment records, documents, chunks, or vectors. Project status is `PLANNING`, `ACTIVE`, `ON_HOLD`, or `COMPLETED`.

Access-request states are `PENDING`, `APPROVED`, or `REJECTED`. Only a pending request can be decided. One actor can have at most one pending request for the same resource. Approval is idempotent and does not create duplicate memberships/grants.

## Browser API conventions

- Protected browser APIs resolve the Auth.js server session and derive `{ userId, tenantId }`; client-supplied identity or role headers are never trusted.
- A valid incoming `x-request-id` UUID is preserved; otherwise Web generates one. The response includes the same ID and structured server logs use it for correlation.
- Errors use `{ "error": { "code": "STABLE_CODE" }, "requestId": "uuid" }`. Unexpected exception messages and configuration details are never returned.
- JSON request bodies are schema-validated before business logic. Mutations persist an `AuditEvent` with the actor, request ID, action, timestamp, and non-sensitive context.
- `GET /api/settings` returns the authenticated user's editable profile/preferences. `PATCH /api/settings` accepts `name` and/or `theme: LIGHT | DARK | SYSTEM`; email is read-only through this endpoint.
- Health and readiness are operational exceptions: their bodies contain only Web service identity and aggregate availability and do not disclose individual dependencies.

## Logical document composition

`EquipmentDocumentLink` and `ProjectDocumentLink` reference a logical `documentId`:

```text
resolved version
  = Document.activeVersionId when versionPolicy = LATEST_APPROVED
  = pinnedDocumentVersionId when versionPolicy = PINNED

Project current document set
  = resolved direct Project links
  + resolved Equipment links for each included Equipment
```

Web de-duplicates by resolved `documentVersionId` but preserves all inclusion paths. Changing `Document.activeVersionId` therefore changes the file reference, metadata, and retrieval manifest for every dependent Project without copying data.

## Required AI service endpoints

| Endpoint                          | Purpose                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                     | Public process liveness only; returns `service` and `status: available`.                                                                                           |
| `GET /readiness`                  | Authenticated aggregate runtime readiness; returns `service` and a `ready` or `unavailable` status without dependency or configuration details.                    |
| `POST /v1/ingestions/extract`     | Fetch an immutable original, extract/OCR, locate sections/pages, and produce review metadata/summary.                                                              |
| `POST /v1/ingestions/index`       | Chunk/embed/upsert one approved `DocumentVersion` as `SOURCE_CHUNK` records.                                                                                       |
| `POST /v1/entity-profiles/upsert` | Generate and embed one versioned Equipment/Project routing profile.                                                                                                |
| `POST /v1/questions`              | Perform entity routing, source retrieval, evidence assessment, and cited answer generation.                                                                        |
| `POST /v1/log-drafts`             | Create an editable Project maintenance-log draft only.                                                                                                             |
| `POST /v1/procedure-drafts`       | Generate a source-bounded Project procedure candidate with per-step citations, coverage analysis, and review-need classification. Returns data only; Web saves it. |

Extraction and indexing may be one internal LangGraph workflow, but the contract keeps review/approval before retrievable source upsert. If implemented as an asynchronous job, the result payloads below become job result schemas without changing their content.

During Phase 1, workflow endpoints are deterministic contract stubs. They return explicit `failed` or `unavailable` states and never fabricate extraction data, chunks, profiles, answers, citations, logs, or procedure steps. Authentication, validation, replay, and internal errors use the OpenAPI-described safe error envelope and never echo request values, configuration names, or secrets.

## Ingestion contracts

### Extract request

```json
{
  "requestId": "uuid",
  "contractVersion": "v1",
  "documentId": "document-id",
  "documentVersionId": "document-version-id",
  "versionNumber": "3",
  "sourceFile": {
    "url": "short-lived-r2-url",
    "contentType": "application/pdf",
    "sha256": "checksum"
  },
  "declaredMetadata": {
    "title": "Pump service manual",
    "documentType": "MANUAL"
  }
}
```

### Extract result

```json
{
  "requestId": "uuid",
  "status": "needs_review | failed",
  "documentVersionId": "document-version-id",
  "extractedMetadata": {
    "title": "Pump service manual",
    "language": "en",
    "pageCount": 142,
    "sections": ["Installation", "Fault isolation"]
  },
  "documentSummary": {
    "summary": "Covers installation, operation, inspection and fault isolation.",
    "capabilities": ["startup checks", "seal inspection"],
    "systems": ["hydraulic circuit"],
    "searchHints": ["pressure instability", "seal leakage"]
  },
  "extractionQuality": 0.96,
  "errors": []
}
```

### Index request/result

```json
{
  "requestId": "uuid",
  "contractVersion": "v1",
  "documentId": "document-id",
  "documentVersionId": "document-version-id",
  "approvalState": "APPROVED",
  "reviewedMetadata": { "title": "Pump service manual", "revision": "3" },
  "sourceFile": { "url": "short-lived-r2-url", "sha256": "checksum" }
}
```

```json
{
  "requestId": "uuid",
  "status": "indexed | failed",
  "documentVersionId": "document-version-id",
  "chunkCount": 42,
  "indexReference": "source-chunk-record-set",
  "sourceLocations": [{ "page": 84, "section": "6.2" }],
  "contentFingerprint": "fingerprint",
  "errors": []
}
```

Web activates the version only after a valid `indexed` result. Indexing is idempotent by deterministic chunk IDs.

### Activation and propagation result

After activation, Web records/emits the derived cascade explicitly so retries and repair jobs are auditable:

```json
{
  "documentId": "document-id",
  "activeVersionId": "document-version-3",
  "supersededVersionId": "document-version-2",
  "affectedEquipmentIds": ["equipment-id"],
  "affectedProjectIds": ["project-id"],
  "profileRefreshEventIds": [
    "refresh-equipment-event",
    "refresh-project-event"
  ],
  "outboxEventId": "outbox-event-id"
}
```

This is a Web/MongoDB product event, not a FastAPI mutation response. AI receives each resulting profile-refresh request idempotently.

## Entity retrieval-profile contract

Entity profiles help route questions; they are not answer evidence.

```json
{
  "requestId": "uuid",
  "contractVersion": "v1",
  "tenantId": "tenant-id",
  "inputFingerprint": "64-character-sha256",
  "entity": {
    "type": "EQUIPMENT | PROJECT",
    "id": "entity-id",
    "profileVersion": 7,
    "userDescription": "optional for Equipment; required Project description",
    "includedEquipmentProfiles": [
      {
        "equipmentId": "equipment-id",
        "profileId": "entity-profile:equipment-id:4",
        "profileVersion": 4,
        "profileFingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "freshnessState": "FRESH | STALE",
        "generatedDescription": "Bounded current Equipment routing summary.",
        "coverageTopics": ["startup checks", "seal inspection"]
      }
    ],
    "activeDocuments": [
      {
        "documentId": "document-id",
        "documentVersionId": "active-version-id",
        "title": "Pump service manual",
        "documentSummary": "summary returned by extraction",
        "inclusion": "EQUIPMENT_DIRECT | PROJECT_DIRECT | EQUIPMENT_DERIVED"
      }
    ]
  }
}
```

```json
{
  "requestId": "uuid",
  "status": "upserted | failed",
  "entityId": "entity-id",
  "profileVersion": 7,
  "profileId": "entity-profile:entity-id:7",
  "generatedDescription": "What the entity is, its systems, coverage, and likely query vocabulary.",
  "systems": ["hydraulic circuit"],
  "components": ["seal assembly"],
  "capabilities": ["startup checks"],
  "failureModes": ["seal leakage"],
  "searchHints": ["pressure instability"],
  "coverage": [
    { "topic": "seal replacement", "documentVersionIds": ["active-version-id"] }
  ],
  "profileFingerprint": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "provenance": {
    "tenantId": "tenant-id",
    "inputFingerprint": "64-character-sha256",
    "documentVersionIds": ["active-version-id"],
    "includedEquipmentProfileFingerprints": [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    ]
  },
  "errors": []
}
```

MongoDB stores the structured result/provenance/freshness. Pinecone stores the derived embedding and compact filter metadata. Included Equipment profile objects give the Project profile builder bounded summaries and provenance without an implicit Pinecone join; authoritative entity/document expansion still comes from the current Web manifest.

## Question request

```json
{
  "requestId": "uuid",
  "contractVersion": "v1",
  "actor": { "id": "user-id", "tenantId": "tenant-id" },
  "chatSession": {
    "id": "conversation-id",
    "recentTurns": [{ "role": "user | assistant", "content": "string" }]
  },
  "assignedReferences": [
    {
      "type": "DOCUMENT | EQUIPMENT | PROJECT | ENTITY",
      "id": "reference-id"
    }
  ],
  "question": "Pressure will not stabilize after startup",
  "retrievalScopeManifest": {
    "allowedDocumentVersions": [
      {
        "documentId": "document-id",
        "documentVersionId": "active-version-id",
        "inclusionPaths": ["EQUIPMENT_DERIVED"],
        "sourceEntityIds": ["equipment-id", "project-id"]
      }
    ],
    "entities": [
      {
        "type": "EQUIPMENT | PROJECT",
        "id": "entity-id",
        "profileId": "entity-profile:entity-id:7",
        "profileVersion": 7,
        "profileState": "FRESH | STALE | MISSING",
        "directDocumentVersionIds": ["active-version-id"]
      }
    ],
    "relationships": [
      {
        "projectId": "project-id",
        "equipmentIds": ["equipment-id"],
        "directDocumentVersionIds": ["project-doc-version-id"]
      }
    ]
  },
  "retrievalPolicy": {
    "approvedOnly": true,
    "requireSourceLocation": true,
    "allowStructuralFallback": true
  }
}
```

## Question response

```json
{
  "requestId": "uuid",
  "chatSession": {
    "id": "conversation-id",
    "suggestedTitle": "Pump pressure instability"
  },
  "turnId": "chat-turn-id",
  "status": "approved | incomplete | conflicting | outdated | unavailable",
  "routing": {
    "selectedEntities": [
      { "type": "EQUIPMENT", "id": "equipment-id", "reason": "profile match" }
    ],
    "usedStructuralFallback": false,
    "profileVersions": [7]
  },
  "answer": {
    "summary": "string or null",
    "steps": [
      { "id": "step-1", "text": "string", "citationIds": ["citation-1"] }
    ]
  },
  "citations": [
    {
      "id": "citation-1",
      "documentVersionId": "active-version-id",
      "documentTitle": "Pump service manual",
      "revision": "3",
      "page": 84,
      "section": "6.2",
      "excerpt": "string",
      "approvalState": "APPROVED"
    }
  ],
  "warnings": [],
  "followUpAllowed": true
}
```

## Project maintenance-log draft contract

The request must include `projectId` and one of:

- `scopeType: PROJECT`, `equipmentId: null`; or
- `scopeType: EQUIPMENT`, `equipmentId` referencing an Equipment included in the Project.

FastAPI returns editable text, suggested structured fields, and citation IDs only. It never creates or submits the MongoDB log.

## Project procedure generation contract

Web calls FastAPI only after the required Project description and at least one approved/indexed direct Project source are available. The request is idempotent by `generationRequestId` plus `inputFingerprint`. Explicitly applicable included-Equipment sources may supplement direct Project sources but cannot silently replace them.

```json
{
  "requestId": "uuid",
  "contractVersion": "v1",
  "generationRequestId": "project-id:input-fingerprint",
  "projectId": "project-id",
  "projectDescription": "Required description of the Project and pipeline.",
  "inputFingerprint": "sha256-of-description-and-active-source-set",
  "timezone": "Asia/Kolkata",
  "activeSources": [
    {
      "documentVersionId": "active-project-version-id",
      "documentTitle": "Boiler upgrade execution plan",
      "revision": "2",
      "inclusionPath": "PROJECT_DIRECT"
    }
  ],
  "supplementalEquipmentSources": [
    {
      "equipmentId": "equipment-id",
      "documentVersionId": "active-equipment-version-id",
      "applicability": "Explicitly selected for this Project procedure"
    }
  ]
}
```

```json
{
  "requestId": "uuid",
  "generationRequestId": "project-id:input-fingerprint",
  "inputFingerprint": "sha256-of-description-and-active-source-set",
  "title": "Boiler feed pump vibration check",
  "reviewAnalysis": {
    "reviewNeed": "HIGH",
    "sourceCoverage": "PARTIAL",
    "conflicts": "NONE_DETECTED",
    "freshness": "CURRENT",
    "hardwareCriticality": "HIGH",
    "blockingFindings": [],
    "reasons": ["Two of three required topics have cited support"]
  },
  "steps": [
    {
      "stepId": "stable-step-id",
      "position": 1,
      "title": "Safety and isolation",
      "instructions": "Follow the cited isolation procedure before inspection.",
      "required": true,
      "citationIds": ["citation-1"],
      "evidenceState": "SUPPORTED"
    }
  ],
  "citations": [
    {
      "id": "citation-1",
      "documentVersionId": "active-project-version-id",
      "page": 12,
      "section": "3.1",
      "excerpt": "string"
    }
  ],
  "requiresHumanReview": true
}
```

Review need is one of `LOW | MODERATE | HIGH | SEVERE` and is derived from coverage, conflicts, freshness, applicability, and hardware/safety criticality. It is not a safety approval. `SEVERE` includes at least one blocking finding and Web rejects publication until resolved.

## Procedure definition and run rules

- Web owns persistence. AI never creates/updates a `SafetyProcedure`, `ProcedureVersion`, `ProcedureRun`, or step completion.
- Step reorder is an ordered stable-step-ID mutation with optimistic concurrency/version checks. Drag-and-drop and Move up/Move down call the same endpoint.
- Manual instruction/title changes set `citationReviewState: NEEDS_REVIEW` until the user confirms/replaces citations or a source-bounded revalidation succeeds.
- Publishing freezes that `ProcedureVersion`; later edits fork a new draft version.
- Recurrence uses an RFC 5545-compatible rule or validated preset plus IANA timezone. A unique key on `procedureId + procedureVersionId + periodStart + periodEnd` prevents duplicate runs.
- Run completion updates only the current `ProcedureRun`. A fresh period creates a new unchecked run and retains prior ticks/notes/timestamps.
- Normal completion requires every required step checked. Any allowed exception carries reason, actor, timestamp, and audit event.

## Contract rules

- Web resolves current active versions for every turn; never reuse a previously stored Chat manifest.
- `assignedReferences` are authorization-checked and only narrow/prioritize scope.
- FastAPI filters entity-profile search to allowed profile IDs/tenant, then filters source retrieval to allowed active version IDs before similarity matching.
- A stale/missing/low-confidence profile triggers fan-out or structural fallback; it never proves absence of evidence.
- Only `SOURCE_CHUNK` citations can support answer claims. `ENTITY_PROFILE` content cannot be cited as source evidence.
- Web validates every citation and returned routed entity against the request manifest before exposing it.
- Maintenance-log and procedure AI output is draft-only; product mutations remain Web-owned.
- Duplicate manifest entities, document versions, relationships, inclusion paths, and assigned references are invalid. Entity direct-document and relationship document IDs must be subsets of `allowedDocumentVersions`; relationship entity IDs must exist with the corresponding type.
- Empty allowed profile/version sets produce a no-query result, never an unfiltered Pinecone query. Phase 2 filter builders always include tenant/environment, exact `recordType`, and an explicit allowed-ID constraint before any future similarity operation.
- A Project profile requires a non-empty user description. Included Equipment profiles are bounded, unique by Equipment ID/profile ID, and carry explicit version/fingerprint/freshness provenance. Equipment profiles cannot contain included-Equipment profiles.
