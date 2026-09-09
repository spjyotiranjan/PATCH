# Environment Configuration Contract

Before changing configuration, read and strictly follow `../../AGENTS.md`, `../../Agent.md`, the applicable implementation documents, and `../../Setup_Guide.md`. A dependency, package, or phase change may not introduce an undocumented environment value, secret owner, service, or operational prerequisite.

The complete environment-variable contract for the initial P.A.T.C.H. implementation is defined in `../.env.example` and `../../ai/.env.example`. Add a new variable only through an approved architecture/configuration change; do not introduce undeclared phase-specific settings.

Follow [Setup_Guide.md](../../Setup_Guide.md) for the complete local setup procedure. Every phase that changes this environment contract must reconcile the guide before it is marked complete.

## Runtime loading and Phase 3–6 additions

- `MONGODB_ADDRESS_FAMILY` accepts `0` (automatic/default), `4` (IPv4) or `6`
  (IPv6) for Mongo socket address selection. It does not bypass SRV/TXT DNS
  lookup. Keep the hosted SRV URI when configured DNS plus IPv4 works; a change
  of URI format is not necessary for that failure mode.

- `MONGODB_DNS_SERVERS` is an optional comma-separated list of DNS server IPs.
  Blank preserves system DNS. When an SRV/TXT lookup is refused by the system
  resolver, set explicitly approved reachable resolvers and restart Web. It
  configures Node's process-wide `dns.resolve*` resolver before the Mongo client
  starts; it does not change Windows DNS or `dns.lookup`. This affects other
  explicit DNS resolution in the same process, so do not use public resolvers
  for a private/split-horizon cluster. No resolver is hard-coded or silently used
  as a fallback. Mongo's SRV discovery, TLS and certificate verification remain intact.

- Web uses `web/.env.local`; the custom server loads it before choosing host/port.
  `WEB_HOST`/`PORT` default to `127.0.0.1`/`3000`. Keep `AUTH_URL`, the browser's
  exact Origin and worker URL aligned. No wildcard CORS setting is supported.
- AI reads `ai/.env` then `ai/.env.local` using module-root paths. Local overrides
  legacy values, and process environment overrides both. Restart services after
  configuration changes. Never log a settings object or validation values.
- `BACKEND_WORKER_SECRET` is Web/operator-only and must differ from authentication
  and service HMAC secrets. `WORKER_BASE_URL` points the worker to Web. Run
  `npm run worker` alongside both servers; it does not connect to AI directly.
- Web defaults to a 120-second AI timeout; AI defaults to a 90-second workflow
  timeout with four concurrent workflows and bounded 30-second provider calls.
  POST workflows are retried by durable outbox with fresh signatures/UUIDs, not
  by replaying a signed HTTP body. GET retry count remains configurable.
- Model and effort settings are AI-only and are read from the environment:
  `OPENAI_ROUTING_MODEL` plus
  `OPENAI_ROUTING_REASONING_EFFORT` (low), `OPENAI_ANSWER_MODEL` plus
  `OPENAI_ANSWER_REASONING_EFFORT` (medium), and `OPENAI_COMPLEX_REASONING_MODEL`
  plus `OPENAI_COMPLEX_REASONING_EFFORT` (high). Answer/procedure/whole-draft/step/log verification use this
  configuration. Model values must use lowercase OpenAI model-ID nomenclature:
  letters, digits, dots, underscores, colons and hyphens, with no whitespace or
  path separators. Field names map to their uppercase environment names through
  the settings framework; explicit validation aliases are unnecessary. OpenAI base URL/organization/project and LangSmith variables
  were removed at the user's request; do not restore unused configuration.
- Embeddings use the environment-provided `OPENAI_EMBEDDING_MODEL`;
  Pinecone must have matching dimensions for the configured embedding model, cosine metric
  and a separate namespace per environment. `PINECONE_NAMESPACE` explicitly maps
  the existing source-chunk/entity-profile vector store (`development` locally).
  It is independent of `APP_ENV`; keep both aligned by deployment convention.
  Never hard-code an index/key or namespace in a graph.
- `ENTITY_ROUTING_ENABLED=false` keeps direct authorized-manifest retrieval as
  baseline until representative evaluation accepts profile routing. Other
  `ENTITY_*`, `STRUCTURAL_*`, candidate/rerank and citation limits remain AI-owned.
- Both services default to 50 MiB and PDF/text/Markdown/DOCX. The AI parser matrix
  and Tesseract prerequisite are in the setup guide; adding a MIME value alone
  does not implement its parser. AI still owns no R2 credentials.
- AI-only OCR settings: `OCR_TESSERACT_CMD` (blank: PATH/standard Windows discovery),
  `OCR_LANGUAGES` (`eng`, or installed language codes joined by `+`),
  `OCR_RENDER_DPI` (200), `OCR_MAX_IMAGE_PIXELS` (30 million), and
  `OCR_TIMEOUT_SECONDS` (15). Explicit invalid executable selection fails closed.
  No Web OCR settings or secrets are added. Aggregate readiness checks executable
  and language data; it does not certify OCR accuracy. Renderer/pytesseract work
  stays inside the AI adapter with pixel/time bounds and concurrency locks.
- API limits use configured requests/window, capped further for writes and Chat.
  JSON/socket/frame and worker batch/lease limits are deliberate code-level
  security bounds, not secrets or provider configuration overrides.
- Optional OTLP uses Web HTTP/protobuf (full traces URL) and AI gRPC. Traces/logs
  contain metadata only. Raw LangSmith tracing is suppressed; Sentry fields remain
  reserved rather than enabling an unreviewed exporter. Empty OTLP disables it.

## Ownership

Phase 7 asset foundation adds Web-only `VISUAL_RENDER_DPI` (default 144; integer
72–200), persisted into each queued asset request and sent through the signed render
contract. AI uses it for the existing PDFium renderer with hard caps of four million
page pixels, 4096 pixels per PNG side and 2 MB output. No AI model or vector settings
are added in this milestone. Existing R2 credentials remain Web-only and also own
private derivative objects. AI returns bounded PNG bytes over the private response;
Web verifies/stores them and never includes base64 in browser responses or MongoDB.
Restart Web after changing DPI; existing queued/ready selections retain their DPI.

| Setting group                                            | Web                            | AI                                 |
| -------------------------------------------------------- | ------------------------------ | ---------------------------------- |
| Authentication, sessions, hosted MongoDB, project access | Owns                           | Does not receive                   |
| Cloudflare R2 credentials and original-file keys         | Owns                           | Does not receive                   |
| R2 pre-signed source URL                                 | Creates per ingestion request  | Reads for that request only        |
| Web-to-AI shared secret                                  | Sends authenticated request    | Validates request                  |
| OpenAI, Pinecone, LangChain/LangGraph                    | Does not receive               | Owns                               |
| Entity-profile routing/fallback limits                   | Does not receive               | Owns through committed AI template |
| Sentry/OTLP configuration                                | Owns service-specific settings | Owns service-specific settings     |

## Authentication policy

- Web uses first-party email/password authentication. There are no social/OAuth providers or provider-specific client secrets in the environment contract.
- `AUTH_SECRET` signs Auth.js JWT sessions. The user credential record itself is stored in MongoDB; passwords are salted and hashed by Web before storage.
- The sign-up payload is limited to name, email, password, and confirm password. Do not add password values, confirmations, or hashes to logs, audit context, telemetry, or API responses.

## Cloudflare R2 rules

- Cloudflare R2 is the canonical private store for original document files and revisions.
- MongoDB stores the R2 object key/reference, document/version metadata, active-version pointer, approval state, Equipment/Project links, and entity-profile provenance; it does not store file bytes.
- The Web service alone holds R2 credentials and creates short-lived pre-signed URLs for an approved document-version ingestion request.
- The AI service has no R2 account, access-key, bucket, or secret environment variable. It can read only the supplied short-lived URL and returns structured results to Web.
- A document version has one original R2 object and one Pinecone `SOURCE_CHUNK` set. Phase 7 adds private visual derivative objects with version-bound MongoDB provenance. Separate `ENTITY_PROFILE` vectors are rebuildable AI routing aids. Equipment/Project links and active-version resolution remain authoritative MongoDB references.

## Environment promotion rules

- Use distinct MongoDB databases, R2 buckets, Pinecone namespaces, secrets, and observability environments for development, staging, and production.
- Keep R2 buckets private. No `NEXT_PUBLIC_` variable may contain R2 credentials, object keys, signed URLs, AI secrets, OpenAI keys, Pinecone keys, or MongoDB connection strings.
- Rotate `AI_SERVICE_SHARED_SECRET`, R2 keys, OpenAI keys, and Pinecone keys through the deployment secret manager; never place real values in either example file.
- `.gitignore` permits the committed templates and excludes real Web/AI environment files.
- Startup validation must fail with a clear error when a required non-optional setting is missing or malformed.
- Public Web health/readiness and AI liveness responses expose only `service` and `status`. AI readiness is service-authenticated. None reveal environment-variable names, secret values, dependency names, or connection diagnostics. Server console output may identify unavailable services by safe service name only.

## R2 source-address synchronization

R2 signed requests use path-style addressing: the configured endpoint hostname
must be present exactly in AI's source-download allowlist (no scheme or path).
Bucket names stay in URL paths. This keeps source authorization synchronized
without wildcard hosts; a public bucket or custom public domain is not required.

## Database initialization

- `MONGODB_URI` must be a private hosted `mongodb+srv://` connection string. Local MongoDB URIs are rejected, and the hosted deployment must support multi-document transactions.
- Web applies the Phase 1 foundation, Phase 2 Equipment/Project/access and additive
  `0003_backend_workflows` migrations before database-backed access. Applied IDs
  remain in `schemaMigrations`; never remove a marker to force a retry.
- Production and staging have no seeded user credentials. Accounts are created only through the audited sign-up API. Automated-test fixtures must never be promoted into another environment.
- Hierarchical routing uses the committed `ENTITY_PROFILE_*` and `STRUCTURAL_FALLBACK_*` limits in `ai/.env.example`; do not add phase-local hidden tuning variables. `MAINTENANCE_LOG_INDEXING_ENABLED` remains false until the Project-log evidence policy and evaluation gate approve it.
## Phase 7 visual description configuration

Explicit visual-description jobs reuse AI `OPENAI_ANSWER_MODEL`,
`OPENAI_ANSWER_REASONING_EFFORT`, `OPENAI_COMPLEX_REASONING_MODEL`, and
`OPENAI_COMPLEX_REASONING_EFFORT`. Both selected models must support image inputs
and structured output. No additional environment variable is required. Existing
source-host restrictions, service authentication and workflow deadlines apply.
Rendering does not automatically request descriptions; each explicit description
attempt can incur two vision calls. No image embedding/index is written yet.

## Phase 7 planned discovery and retrieval configuration

Automatic discovery, visual indexing and visual Chat retrieval are not enabled yet.
Before implementation, add explicit AI-owned validated settings for a feature flag,
candidate-page and region/asset quotas, preview
DPI/pixel limits, fused-search shortlist, relevance-gate limit and visual-query
timeout. Use documented safe defaults and explicit enablement; do not derive a
namespace from request/model content or accept an arbitrary namespace override.
Deployment configuration must set the exact documented namespace values.
Web owns renderer/output and durable-job limits only; it never receives
OpenAI/Pinecone credentials.

When visual indexing is implemented, add `PINECONE_VISUAL_NAMESPACE` as a separate
AI-owned setting. Map it to `visual-{APP_ENV}` by deployment convention—for example,
`visual-development` locally and `visual-staging` in staging. The runtime must use
the exact configured value; it must not synthesize or accept a namespace from a
request/model. It stays distinct from `PINECONE_NAMESPACE`, uses dimensions
compatible with the configured text embedding model, and is segregated per
environment. Its vectors represent verified description text, not raw-image
embeddings. Existing derivatives remain accessible with visual retrieval disabled.

| Deployment `APP_ENV` | Current text/profile setting | Planned visual setting |
| --- | --- | --- |
| `development` | `PINECONE_NAMESPACE=development` | `PINECONE_VISUAL_NAMESPACE=visual-development` |
| `staging` | `PINECONE_NAMESPACE=staging` | `PINECONE_VISUAL_NAMESPACE=visual-staging` |
| `production` | `PINECONE_NAMESPACE=production` | `PINECONE_VISUAL_NAMESPACE=visual-production` |

These are deployment mappings, not runtime concatenation. `APP_ENV` identifies the
service environment; each Pinecone namespace comes from its own explicit setting.
