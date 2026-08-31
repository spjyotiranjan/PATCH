# Environment Configuration Contract

The complete environment-variable contract for the initial P.A.T.C.H. implementation is defined in `../.env.example` and `../../ai/.env.example`. Add a new variable only through an approved architecture/configuration change; do not introduce undeclared phase-specific settings.

## Ownership

| Setting group | Web | AI |
|---|---|---|
| Authentication, sessions, MongoDB, project access | Owns | Does not receive |
| Cloudflare R2 credentials and original-file keys | Owns | Does not receive |
| R2 pre-signed source URL | Creates per ingestion request | Reads for that request only |
| Web-to-AI shared secret | Sends authenticated request | Validates request |
| OpenAI, Pinecone, LangChain/LangGraph | Does not receive | Owns |
| Entity-profile routing/fallback limits | Does not receive | Owns through committed AI template |
| Sentry/OTLP configuration | Owns service-specific settings | Owns service-specific settings |

## Cloudflare R2 rules

- Cloudflare R2 is the canonical private store for original document files and revisions.
- MongoDB stores the R2 object key/reference, document/version metadata, active-version pointer, approval state, Equipment/Project links, and entity-profile provenance; it does not store file bytes.
- The Web service alone holds R2 credentials and creates short-lived pre-signed URLs for an approved document-version ingestion request.
- The AI service has no R2 account, access-key, bucket, or secret environment variable. It can read only the supplied short-lived URL and returns structured results to Web.
- A document version has one R2 object and one Pinecone `SOURCE_CHUNK` set. Separate `ENTITY_PROFILE` vectors are rebuildable AI routing aids. Equipment/Project links and active-version resolution remain authoritative MongoDB references.

## Environment promotion rules

- Use distinct MongoDB databases, R2 buckets, Pinecone namespaces, secrets, and observability environments for development, staging, and production.
- Keep R2 buckets private. No `NEXT_PUBLIC_` variable may contain R2 credentials, object keys, signed URLs, AI secrets, OpenAI keys, Pinecone keys, or MongoDB connection strings.
- Rotate `AI_SERVICE_SHARED_SECRET`, R2 keys, OpenAI keys, and Pinecone keys through the deployment secret manager; never place real values in either example file.
- `.gitignore` permits the committed templates and excludes real Web/AI environment files.
- Startup validation must fail with a clear error when a required non-optional setting is missing or malformed.
- Hierarchical routing uses the committed `ENTITY_PROFILE_*` and `STRUCTURAL_FALLBACK_*` limits in `ai/.env.example`; do not add phase-local hidden tuning variables. `MAINTENANCE_LOG_INDEXING_ENABLED` remains false until the Project-log evidence policy and evaluation gate approve it.
