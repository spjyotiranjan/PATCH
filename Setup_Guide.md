# P.A.T.C.H. Setup Guide

This guide is the canonical local-development setup procedure for P.A.T.C.H. It covers the Next.js Web application, the FastAPI AI service, their local dependencies, and the checks that prove the services are connected safely.

Keep real credentials only in local environment files or the deployment secret manager. Never commit them.

## 1. Prerequisites

Install the following before starting:

| Tool    | Required version / purpose             | Check              |
| ------- | -------------------------------------- | ------------------ |
| Git     | Source control                         | `git --version`    |
| Node.js | 22 or newer, for `web`                 | `node --version`   |
| npm     | Installed with Node.js                 | `npm --version`    |
| Python  | 3.12 through 3.14, for `ai`            | `python --version` |
| uv      | Python environment and package manager | `uv --version`     |

Hosted MongoDB, private Cloudflare R2, OpenAI and Pinecone are needed for the full
backend workflow. Phases 3–6 call real providers for ingestion, profiles, answers
and drafts; there is no silent mock mode in the running app. Automated tests
inject isolated synthetic providers and never use real maintenance instructions.
For no-UI acceptance, follow [Backend_Manual_Testing.md](Backend_Manual_Testing.md).

## 2. Clone and install dependencies

From a PowerShell terminal:

```powershell
git clone <repository-url> PATCH
cd PATCH
```

Install Web dependencies:

```powershell
cd web
npm install
cd ..
```

Install AI dependencies and build the editable package:

```powershell
cd ai
uv sync --all-groups
cd ..
```

If `uv` reports that `README.md` is missing while building `patch-ai`, update your branch first. The package metadata must reference `ai/docs/README.md`.

### Adding or upgrading dependencies

Do not install a package ad hoc. First follow the selection and documentation rules in [AGENTS.md](AGENTS.md) and [Agent.md](Agent.md), including checking official maintenance, license, security, runtime compatibility, overlap with the existing stack, and module ownership.

- Web: run the appropriate `npm install`/`npm uninstall` command from `web/` and include both `package.json` and `package-lock.json`.
- AI: run the appropriate `uv add`/`uv remove` command from `ai/` and include both `pyproject.toml` and `uv.lock`.
- Record why the dependency is needed in the owning implementation document. Reconcile new environment values, operating prerequisites, migrations, deployment/rollback effects, and verification commands in this guide and `web/docs/Environment.md`.
- Run the complete affected module gate and any Web-to-AI integration tests. A locally importable package is not sufficient evidence of compatibility.

Never edit only a manifest, depend on an undeclared transitive package, or commit an unlocked dependency graph.

## 3. Configure hosted MongoDB

P.A.T.C.H. uses a hosted MongoDB deployment only. Do not run a local MongoDB instance or Docker container for this project.

Create a development database in the approved hosted MongoDB provider, create a least-privilege application user, and allow access from your development IP address. Keep its connection string ready; after creating `web/.env.local` in the next section, set:

```text
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/
MONGODB_DB_NAME=patch
```

Keep the URI private. It contains credentials and must never be committed, logged, exposed through `NEXT_PUBLIC_` variables, or sent to the AI service.

The Web configuration accepts hosted SRV connection strings (`mongodb+srv://`) only. Use a hosted deployment that supports multi-document transactions; the Equipment/Project records, access decisions, initial Project ownership, audit events, and initial procedure-generation request rely on transactions to commit atomically. MongoDB Atlas replica-set-backed clusters satisfy this requirement.

## 4. Configure environment files

If the hosted cluster's SRV/TXT lookup fails with `querySrv ECONNREFUSED` before
authentication, the system DNS resolver may be refusing that query. Web supports
optional `MONGODB_DNS_SERVERS` in `.env.local`: supply comma-separated approved
DNS server IPs and restart Web. Leave it blank where system DNS works. The
configured resolver applies only inside the Web Node process, not to machine-wide
DNS; it also affects any other `dns.resolve*` calls in that process. Do not use
public DNS for private/split-horizon clusters. Never work around a DNS problem by
disabling TLS, switching to local MongoDB or exposing database credentials.
See [Node DNS behavior](https://nodejs.org/api/dns.html#dnssetserversservers)
and [MongoDB connection guidance](https://www.mongodb.com/docs/drivers/node/current/connection-troubleshooting/).

`MONGODB_ADDRESS_FAMILY=4` selects IPv4 sockets when needed (`0` is automatic;
`6` selects IPv6). IPv4 alone does not repair a refused SRV DNS query. The
verified combination of configured DNS plus IPv4 keeps the hosted `mongodb+srv`
URI, automatic topology discovery and TLS intact. Restart Web after either change.

Create files from the committed templates. These local files are intentionally ignored by Git.

```powershell
Copy-Item web\.env.example web\.env.local
Copy-Item ai\.env.example ai\.env.local
```

Generate one high-entropy shared secret and use the exact same value in both files:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set it as:

```text
# web/.env.local
AI_SERVICE_SHARED_SECRET=<generated-value>

# ai/.env.local
AI_SERVICE_SHARED_SECRET=<the-same-generated-value>
```

### Web environment: `web/.env.local`

Configure these values before starting Web:

| Setting                    | Local value / action                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`              | Generate a separate high-entropy value using the command above.                                                                           |
| `AUTH_URL`                 | `http://localhost:3000`                                                                                                                   |
| `MONGODB_URI`              | Hosted MongoDB connection URI from the approved development cluster.                                                                      |
| `MONGODB_DB_NAME`          | `patch` or the approved development database name.                                                                                        |
| `AI_SERVICE_BASE_URL`      | `http://localhost:8000`                                                                                                                   |
| `AI_SERVICE_SHARED_SECRET` | The shared value described above.                                                                                                         |
| `BACKEND_WORKER_SECRET`    | Generate a third, independent high-entropy secret. Worker/operator use only; never a browser value.                                       |
| `WORKER_BASE_URL`          | `http://localhost:3000`; must point to this Web instance.                                                                                 |
| `WEB_HOST` / `PORT`        | `127.0.0.1` and `3000`. Keep AUTH_URL and the client Origin on the same hostname.                                                         |
| `R2_*`                     | Valid development Cloudflare R2 account, bucket, endpoint, and access credentials. Do not expose any of these with a `NEXT_PUBLIC_` name. |

### AI environment: `ai/.env.local`

AI loads `.env` for backward compatibility, then `.env.local` from the `ai/`
directory regardless of the launch directory. `.env.local` wins over `.env`;
process environment values win over both. Web loads `.env.local` before choosing
its listening host/port and Next.js loads the application configuration. Restart
the relevant process after changing configuration. Do not overwrite existing
environment files when copying templates during an upgrade.

Configure these values before expecting AI readiness to be `ready`:

| Setting                                                              | Local value / action                                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                            | `development`                                                                                                         |
| `HOST` / `PORT`                                                      | `0.0.0.0` and `8000` (defaults are suitable).                                                                         |
| `AI_SERVICE_SHARED_SECRET`                                           | The exact same Web value.                                                                                             |
| `SOURCE_URL_ALLOWED_HOSTS`                                           | Your R2 endpoint host only, for example `<account-id>.r2.cloudflarestorage.com`. Do not include `https://` or a path. |
| `OPENAI_*`                                                           | Development OpenAI configuration and credentials.                                                                     |
| `PINECONE_*`                                                         | Development Pinecone API key, index name, and namespace.                                                              |
| `ENTITY_ROUTING_ENABLED`                                             | Leave `false` until representative evaluation accepts profile routing. Current-manifest retrieval still works.        |
| `OPENAI_ROUTING_REASONING_EFFORT`                                    | `low`, used with the configured routing model.                                                                        |
| `OPENAI_ANSWER_REASONING_EFFORT`                                     | `medium`, used with the configured answering model.                                                                   |
| `OPENAI_COMPLEX_REASONING_MODEL` / `OPENAI_COMPLEX_REASONING_EFFORT` | `gpt-5.6-terra` / `high`, used for answer, procedure, whole-draft, step and log verification.                         |

AI never receives R2 account credentials, access keys, bucket credentials, MongoDB credentials, browser authentication secrets, or any `NEXT_PUBLIC_` value. It receives only Web-issued, short-lived source URLs when an ingestion workflow runs.

Web uses path-style R2 requests so signed upload/download URLs retain the exact
configured endpoint hostname; the bucket name is part of the path. AI's source
allowlist must match that hostname exactly. A mismatched host rejects extraction
even when bucket readiness passes. Do not use wildcard allowlists or disable
private-address checks to resolve a mismatch.

For the complete variable ownership and security rules, read [web/docs/Environment.md](web/docs/Environment.md).

### Provision originals and vector storage

1. Create a private R2 bucket matching Web configuration and credentials with
   object read/write plus the bucket access needed by readiness. Do not enable
   public access. Web signs uploads into a staging key, validates the uploaded
   size/type, copies it conditionally to its immutable canonical key, and sends
   only short-lived source URLs to AI. AI verifies SHA-256 before extraction and
   again before indexing. Never reuse a canonical version ID for different bytes.
2. Browser direct upload additionally needs an R2 CORS rule for the exact Web
   origin, allowed method `PUT`, allowed header `Content-Type`, and exposed
   header `ETag`. Postman is not subject to browser CORS. Follow the official
   [R2 CORS instructions](https://developers.cloudflare.com/r2/buckets/cors/).
3. Create a Pinecone **dense bring-your-own-vector** index with cosine similarity,
   not an integrated-embedding index. The default `text-embedding-3-large`
   produces 3,072-dimensional vectors; provision that dimension. Both source
   chunks and profiles use this model and a namespace specific to the environment.
   See [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)
   and [Pinecone index creation](https://docs.pinecone.io/guides/index-data/create-an-index).
4. Set an OpenAI API key with access to the configured answer/routing models and
   embeddings. An unavailable model returns a safe workflow failure; readiness
   validates configuration, not model entitlements, vector dimensions, OCR
   installation or retrieval quality. Verify these by completing ingestion.
5. Keep `MAINTENANCE_LOG_INDEXING_ENABLED=false`. The optional log-evidence
   pipeline is not enabled; setting it true is rejected to avoid implying support.
   Submitted logs are still fully persisted and auditable.

Changing the embedding model/dimension or chunking pipeline requires a new
index/namespace and reindexing retained approved originals before switching both
services. Preserve the old index/namespace for rollback. Never mix incompatible
embeddings or delete originals as part of reindexing.

### Supported document parsing and OCR

Supported MIME types are PDF, UTF-8 plain text, Markdown and DOCX. Keep both
templates' MIME lists and byte limits aligned (default 50 MiB). Markdown is
treated as text; no HTML is executed. Text/DOCX citations identify numbered text
blocks, not printed pages. PDF citations identify one-based source pages.

- Text-native PDFs use pypdf. Image-only pages use embedded-image OCR and require
  the **Tesseract executable** plus appropriate language data on PATH. Check
  `tesseract --version` in the terminal starting AI. The Python wrapper does not
  install that executable. OCR calls are bounded and are always marked lower quality.
- Complex scans without extractable embedded images fail for review; there is
  no licensed full-page PDF renderer configured. Do not accept missing text or
  infer instructions from an unreadable page. Compare all OCR against originals.
- DOCX paragraphs and flat tables preserve body order. Images, embedded objects,
  external relationships, tracked changes, fields, text boxes, nested tables and
  unsupported footnote/math content fail explicitly. Export a reviewed PDF or
  UTF-8 text when those features carry evidence; never silently omit them.
- Parsers bound page count, text size, image pixels and DOCX archive expansion.
  Read [the loader decision](ai/adapters/README.md) before changing extraction.

Warm tiktoken's encoding cache once with network access after installation:

```powershell
cd ai
uv run python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"
```

This downloads tokenizer data only, without an OpenAI call. Restricted networks
must prepopulate the tokenizer cache; a missing cache is not a model failure.

## 5. Run the services

Open three PowerShell terminals from the repository root.

### Terminal 1: AI service

```powershell
cd ai
uv run patch-ai
```

The API is available at:

- Swagger/OpenAPI UI: <http://127.0.0.1:8000/docs>
- Public liveness: <http://127.0.0.1:8000/health>

`patch-ai` starts Uvicorn with the configured host/port and development reload.
It avoids the Unicode status output of `fastapi dev`, which can fail in a Windows
terminal using legacy `cp1252`. For explicit control, use
`uv run uvicorn patch_ai.main:app --reload --port 8000`.

### Terminal 2: Web service

```powershell
cd web
npm run dev
```

Open <http://localhost:3000>. The Web health endpoint is <http://localhost:3000/api/health> and aggregate readiness is <http://localhost:3000/api/readiness>.

### Terminal 3: durable backend worker

```powershell
cd web
npm run worker
```

The worker reads `.env.local`, authenticates to the internal Web worker API,
dispatches one leased job at a time, schedules current recurrence runs, and runs
bounded consistency repair. Leave it running for uploads, profile refresh,
automatic procedure generation and published-procedure indexing. Without it,
queued records remain queued; they are not lost. Do not send its secret to UI.

Use the npm scripts: Web's custom Next.js server mounts `/ws/chat` and preserves
Next hot reload. Running `next dev`/`next start` directly omits that socket gateway.
`npm run build` then `npm start` uses the same gateway without development reload.
On PowerShell systems blocking `npm.ps1`, use `npm.cmd` for these commands.

Stop each process with `Ctrl+C`. Restarting Web/worker safely resumes durable jobs.
Inspect progress at Web Swagger <http://localhost:3000/api/docs>; OpenAPI is
<http://localhost:3000/api/openapi>. FastAPI `/docs` describes private service
operations, not browser account APIs. The manual testing guide covers both.

## 6. Verify the setup

First check that both processes are alive:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://localhost:3000/api/health
```

Expected responses contain only service identity and aggregate status, for example:

```json
{ "service": "patch-ai", "status": "available" }
```

Then open <http://localhost:3000/api/readiness>. A `200` response with `status: ready`
confirms MongoDB/R2 checks and authenticated AI readiness. AI readiness checks
required provider configuration; it is **not** proof of a successful paid model
call, indexing, OCR, or a safety evaluation. A `503` means dependencies are not
ready. Details appear only in server logs as safe service names, never environment
variable names, credentials, signed URLs or connection strings.

Do not call AI `/readiness` directly from a browser. It is intentionally private and requires the server-to-server HMAC headers that the Web API client creates. `/health` is the public AI liveness check.

### Verify Phase 1 account and UI readiness

1. Open <http://localhost:3000/sign-up>. Create a development account using exactly Name, Email, Password, and Confirm password. There are no social-login, SSO, or passwordless-link options.
2. Sign out from Settings, then sign in at <http://localhost:3000/sign-in> with the same email and password. Opening `/`, `/equipments`, `/projects`, `/documents`, `/chat`, or `/settings` without a session must redirect to sign-in without exposing protected content.
3. Confirm each authenticated route uses the same P.A.T.C.H. sidebar and title bar. The sidebar contains Home, Equipments, Projects, Documents, Chat, Settings, and Help & support; it never contains a top-level Maintenance logs item.
4. In Settings, edit the display name and select Light, Dark, and System. Refresh the page and confirm the saved profile and theme are restored through `/api/settings`. The account email is read-only.
5. Open <http://localhost:3000/api/readiness>. Only aggregate service availability is returned. Missing dependency names are written to the Web server console without environment-variable names or values.

The Operations home and later feature placeholders provide the Phase 1 shell and visual foundation. Equipment, Project, document, and Chat data flows become production UI only in their matching later UI phases; do not treat illustrative shell content as persisted records.

### Verify Phase 2 data and API readiness

No manual migration command is required. Before database-backed access, Web
idempotently applies `0001_phase_one_foundation`, `0002_equipment_project_access`
and `0003_backend_workflows`. Phase 2 indexes ownership, access, membership and
generation inputs. Phase 3–6 adds unique document versions/links, entity profiles,
outbox keys, chat client-turn IDs, procedure definitions/versions/period runs,
list indexes and rate-limit TTLs. No user is seeded. Restart retries bootstrap;
if existing data violates uniqueness, inspect and resolve that data deliberately,
never delete it or its migration marker as a shortcut.

After signing in through the application, use the browser's developer console on `http://localhost:3000` to verify the authenticated Phase 2 list endpoints without copying the session cookie into another tool:

```javascript
await fetch("/api/equipments").then((response) => response.json());
await fetch("/api/equipments/discover").then((response) => response.json());
await fetch("/api/projects").then((response) => response.json());
await fetch("/api/projects/discover").then((response) => response.json());
```

Each successful list returns `{ "items": [...] }`. Equipment creation requires `name`, `type`, and `location`; its description is optional. Project creation requires a description of at least 10 characters and atomically creates the caller's `OWNER` membership plus a `WAITING_FOR_SOURCES` procedure-generation request. Both creation payloads accept `documentsMode: "ADD_NOW" | "SKIP_FOR_NOW"`; Phase 2 records this choice, while actual upload/indexing starts in Phase 3.

Owners approve or reject access through the nested request-decision routes documented in [web/docs/API_Contract.md](web/docs/API_Contract.md). An approved Equipment manager can mutate only that Equipment and cannot decide Equipment requests or gain Project membership. Project `MEMBER` users can read Project content; only `OWNER` users can mutate the Project or decide membership requests.

## 7. Testing and quality commands

Run these before handing off a phase implementation:

```powershell
# AI
cd ai
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pyright --pythonpath .\.venv\Scripts\python.exe src tests
uv run pytest -q -p no:cacheprovider
uv run python evaluations/runner.py
```

```powershell
# Web
cd web
npm run generate:ai-types
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

When FastAPI routes or Pydantic contracts change, regenerate the shared contract in this order:

```powershell
cd ai
uv run python scripts/export_openapi.py
cd ..\web
npm run generate:ai-types
```

Commit the resulting `ai/openapi.json` and `web/lib/ai/generated.ts` with the matching API implementation and tests. Do not hand-edit generated types.

## 8. Troubleshooting

| Symptom                                                  | Likely cause and resolution                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Readme file does not exist: README.md` during `uv sync` | Your local `ai/pyproject.toml` is outdated. It must use `readme = "docs/README.md"`; update the branch and rerun `uv sync --all-groups`.                                                                                                                        |
| FastAPI CLI raises `UnicodeEncodeError` / `cp1252`       | Start with `uv run uvicorn patch_ai.main:app --reload`.                                                                                                                                                                                                         |
| AI `/readiness` returns `401`                            | This is expected without the private Web HMAC headers. Use `/health` directly, or verify through Web `/api/readiness`.                                                                                                                                          |
| Web readiness is unavailable                             | Verify the hosted MongoDB URI, database-user network access, and R2 settings; start AI; and make both `AI_SERVICE_SHARED_SECRET` values identical. Review server logs for safe dependency names.                                                                |
| AI readiness is unavailable                              | Replace remaining template values for the shared secret, allowed R2 host, OpenAI, and Pinecone configuration. Keep those values private.                                                                                                                        |
| Web cannot connect to AI                                 | Ensure AI listens on port 8000 and `AI_SERVICE_BASE_URL=http://localhost:8000`.                                                                                                                                                                                 |
| Generated Web types are stale                            | Export AI OpenAPI, then run `npm run generate:ai-types` from `web/`.                                                                                                                                                                                            |
| Upload remains queued / profile remains stale            | Start the worker; inspect job states through the protected worker API. Correct the dependency before retrying a dead-letter job. Never manually activate an unindexed version.                                                                                  |
| Socket returns 401/403 or closes before a turn           | Use the Web session cookie, exact AUTH_URL Origin and an owned sessionId. AI sockets use HMAC instead, reject Origin, and require a fresh request UUID per connection.                                                                                          |
| Index fails / OCR unavailable                            | Confirm index dimensions, model access, SHA-256, allowed R2 host, Tesseract and parser support. Existing active versions remain readable.                                                                                                                       |
| Procedure approval blocked                               | Inspect reviewAnalysis, expectedRevision, current source fingerprint and per-step bindings. Edit/revalidate/review again; do not suppress a severe blocker.                                                                                                     |
| Phase 2 migration/index creation fails                   | Confirm the hosted database user can create indexes, the deployment supports transactions, and pre-existing access/membership records do not violate the new unique indexes. Correct conflicting test data, then restart Web to retry the idempotent bootstrap. |

### Phase 2 rollback and recovery

The Phase 2 migration is additive. If application code must be rolled back, stop Web, deploy the prior version, and leave the Phase 2 collections, indexes, and `schemaMigrations` record in place; the prior phase ignores them. Do not manually remove the migration marker as a retry mechanism. If bootstrap failed before recording completion, fix the reported database permission or duplicate-data issue and restart Web—the named index operations and migration upsert are idempotent.

The AI Phase 2 change is a contract change, not a data migration. Keep `ai/openapi.json`, `web/lib/ai/generated.ts`, and both service deployments on the same commit. If either artifact drifts, regenerate in the documented order and redeploy Web and AI together.

### Phase 3–6 operations, recovery and retention

Follow the worker-operation examples in [Backend_Manual_Testing.md](Backend_Manual_Testing.md).
Jobs have 300-second leases, fencing tokens, five attempts, bounded backoff and
dead-letter status. A stale worker cannot overwrite a newer result. An explicit
operator retry requires a reason and is audited. Repair uses persisted scan
cursors so batches eventually cover all records; it repairs missing extraction,
index/profile/export jobs and expired pending chat turns. It never grants access,
approves a source, publishes, or infers that maintenance occurred.

The scheduler creates the current due run only; it does not fabricate missed
historical executions. New periods start unchecked, even if a previous run was
complete. DST rules, inactive runs and optimistic-concurrency examples are in
the manual guide.

Metadata-only console logs include request/job IDs, workflow stage, timings and
safe status/error codes. Optional OTLP uses HTTP/protobuf on Web (full traces URL,
usually ending `/v1/traces`) and gRPC on AI. Blank endpoints disable export. Do
not capture bodies, cookies, prompts, source excerpts, model content or signed
URLs. Raw LangSmith tracing is disabled by the workflow executor; LangSmith and
OpenAI URL/organization/project settings are not part of the environment contract.
Sentry template fields are reserved; a DSN alone does not
activate a reviewed error-reporting integration. Dead-letter/scheduler errors are
observable in console and worker inspection; external alert delivery needs an
explicitly configured and tested collector/alerting system.

Before an upgrade, stop dispatch, wait for leases to settle, and take a hosted
MongoDB snapshot plus a private R2 backup/inventory. Include immutable originals,
published exports, document pointers/links, citations, memberships, audits,
procedure versions/runs and migration records. Do not expire canonical originals,
published exports or audit history with bucket lifecycle rules. Abandoned upload
staging objects are retained by this implementation; cleanup needs a verified
inventory proving they are no longer pending/referenced. No automatic destructive
retention job is installed.

Test restoration into a separate hosted database and private bucket. Restore
Mongo and original objects consistently, verify hashes and source access, then
rebuild the derived Pinecone namespace from approved retained sources and current
profiles. Keep both service versions and OpenAPI artifacts aligned. An additive
schema rollback leaves new collections/indexes intact; stop the new worker before
running older code. Do not roll back after writing incompatible records without
a compatible restore plan. Snapshot scheduling, retention duration and a measured
restore drill remain operator acceptance items, not claims made by unit tests.

## 9. Required setup-guide reconciliation after every phase

At the end of every implementation phase, before changing its status to complete:

1. Reconcile this guide with the actual implementation, environment templates, startup commands, API contract, migrations, and operational dependencies introduced by that phase.
2. Add or revise exact setup, upgrade, migration, verification, and rollback instructions where needed.
3. Confirm secret ownership and public/private endpoint behavior remain accurate.
4. Run the relevant commands in this guide and update them if they no longer work.
5. Update links in `Development_Plan.md`, `web/docs`, and `ai/docs` when the phase introduces a new setup requirement.

This reconciliation is part of the phase definition of done. A phase may not be marked complete while its setup instructions are stale or unverified.

### Reconciliation record

- **Phase 1 (2026-09-04):** Reconciled UI, Web backend, AI backend, environment ownership, startup commands, credentials-only authentication, aggregate readiness, and the signed Web-to-AI contract. Verified Web contract generation, lint, TypeScript, 39 automated tests, and the production build; verified AI lint/format/type gates and 26 tests; ran the live signed readiness/profile-contract integration; and visually reviewed the public credentials screens with no browser errors. Hosted MongoDB and R2 connectivity remains a per-environment check through `/api/readiness` because credentials are intentionally not stored in the repository.
- **Backend Phases 3–6 (2026-09-06):** Startup/worker, additive migration,
  Swagger/WebSocket contracts, provider/parser prerequisites, recovery and
  synthetic evaluation instructions reconciled. Automated evidence and remaining
  live acceptance gates are recorded in both module implementation documents.
  The small hosted smoke passed Mongo/R2 persistence, source indexing/activation,
  profile refresh, cited cross-service Chat, a Project log and an unpublished
  procedure candidate. IPv4/DNS and exact-host R2 configuration were verified.
  See the dated manual-test record for deliberately unrun ground-test scenarios.
  Global phase status remains open for UI integration and representative/SME
  acceptance; synthetic fixtures do not certify real maintenance guidance.
