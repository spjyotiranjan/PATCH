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

Cloudflare R2, OpenAI, and Pinecone credentials are needed for a fully ready local environment. Phase 1 does not call OpenAI or Pinecone workflows yet, but the AI readiness endpoint deliberately reports unavailable until their required configuration has been supplied.

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

## 3. Configure hosted MongoDB

P.A.T.C.H. uses a hosted MongoDB deployment only. Do not run a local MongoDB instance or Docker container for this project.

Create a development database in the approved hosted MongoDB provider, create a least-privilege application user, and allow access from your development IP address. Copy its connection string into `web/.env.local`:

```text
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/
MONGODB_DB_NAME=patch
```

Keep the URI private. It contains credentials and must never be committed, logged, exposed through `NEXT_PUBLIC_` variables, or sent to the AI service.

## 4. Configure environment files

Create files from the committed templates. These local files are intentionally ignored by Git.

```powershell
Copy-Item web\.env.example web\.env.local
Copy-Item ai\.env.example ai\.env
```

Generate one high-entropy shared secret and use the exact same value in both files:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set it as:

```text
# web/.env.local
AI_SERVICE_SHARED_SECRET=<generated-value>

# ai/.env
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
| `R2_*`                     | Valid development Cloudflare R2 account, bucket, endpoint, and access credentials. Do not expose any of these with a `NEXT_PUBLIC_` name. |

### AI environment: `ai/.env`

Configure these values before expecting AI readiness to be `ready`:

| Setting                    | Local value / action                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                  | `development`                                                                                                         |
| `HOST` / `PORT`            | `0.0.0.0` and `8000` (defaults are suitable).                                                                         |
| `AI_SERVICE_SHARED_SECRET` | The exact same Web value.                                                                                             |
| `SOURCE_URL_ALLOWED_HOSTS` | Your R2 endpoint host only, for example `<account-id>.r2.cloudflarestorage.com`. Do not include `https://` or a path. |
| `OPENAI_*`                 | Development OpenAI configuration and credentials.                                                                     |
| `PINECONE_*`               | Development Pinecone API key, index name, and namespace.                                                              |

AI never receives R2 account credentials, access keys, bucket credentials, MongoDB credentials, browser authentication secrets, or any `NEXT_PUBLIC_` value. It receives only Web-issued, short-lived source URLs when an ingestion workflow runs.

For the complete variable ownership and security rules, read [web/docs/Environment.md](web/docs/Environment.md).

## 5. Run the services

Open two PowerShell terminals from the repository root.

### Terminal 1: AI service

```powershell
cd ai
uv run uvicorn patch_ai.main:app --reload
```

The API is available at:

- Swagger/OpenAPI UI: <http://127.0.0.1:8000/docs>
- Public liveness: <http://127.0.0.1:8000/health>

Use Uvicorn directly on Windows. `uv run fastapi dev ...` can fail in terminals configured with a legacy `cp1252` output encoding because the FastAPI CLI renders Unicode status output; that does not indicate an application failure.

### Terminal 2: Web service

```powershell
cd web
npm run dev
```

Open <http://localhost:3000>. The Web health endpoint is <http://localhost:3000/api/health> and aggregate readiness is <http://localhost:3000/api/readiness>.

Stop either development server with `Ctrl+C` in its terminal.

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

Then open <http://localhost:3000/api/readiness>. A `200` response with `status: ready` confirms that Web can reach MongoDB, R2, and the authenticated AI readiness endpoint. A `503` response with `status: unavailable` means one or more dependencies are not ready. Details are deliberately available only in server logs as safe service names, never as environment variable names or secret values.

Do not call AI `/readiness` directly from a browser. It is intentionally private and requires the server-to-server HMAC headers that the Web API client creates. `/health` is the public AI liveness check.

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
```

```powershell
# Web
cd web
npm run generate:ai-types
npm run lint
npm run typecheck
npm test
npm run build
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

| Symptom                                                  | Likely cause and resolution                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Readme file does not exist: README.md` during `uv sync` | Your local `ai/pyproject.toml` is outdated. It must use `readme = "docs/README.md"`; update the branch and rerun `uv sync --all-groups`.                                                         |
| FastAPI CLI raises `UnicodeEncodeError` / `cp1252`       | Start with `uv run uvicorn patch_ai.main:app --reload`.                                                                                                                                          |
| AI `/readiness` returns `401`                            | This is expected without the private Web HMAC headers. Use `/health` directly, or verify through Web `/api/readiness`.                                                                           |
| Web readiness is unavailable                             | Verify the hosted MongoDB URI, database-user network access, and R2 settings; start AI; and make both `AI_SERVICE_SHARED_SECRET` values identical. Review server logs for safe dependency names. |
| AI readiness is unavailable                              | Replace remaining template values for the shared secret, allowed R2 host, OpenAI, and Pinecone configuration. Keep those values private.                                                         |
| Web cannot connect to AI                                 | Ensure AI listens on port 8000 and `AI_SERVICE_BASE_URL=http://localhost:8000`.                                                                                                                  |
| Generated Web types are stale                            | Export AI OpenAPI, then run `npm run generate:ai-types` from `web/`.                                                                                                                             |

## 9. Required setup-guide reconciliation after every phase

At the end of every implementation phase, before changing its status to complete:

1. Reconcile this guide with the actual implementation, environment templates, startup commands, API contract, migrations, and operational dependencies introduced by that phase.
2. Add or revise exact setup, upgrade, migration, verification, and rollback instructions where needed.
3. Confirm secret ownership and public/private endpoint behavior remain accurate.
4. Run the relevant commands in this guide and update them if they no longer work.
5. Update links in `Development_Plan.md`, `web/docs`, and `ai/docs` when the phase introduces a new setup requirement.

This reconciliation is part of the phase definition of done. A phase may not be marked complete while its setup instructions are stale or unverified.
