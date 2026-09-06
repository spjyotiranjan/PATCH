# AI Module

This directory contains the Python FastAPI microservice for ingestion, Equipment/Project routing profiles, Pinecone source retrieval, cited answers, and draft assistance. Before planning or changing it, read and strictly follow `../../AGENTS.md`, `../../Agent.md`, `AI_Implementation.md`, `RAG_and_Safety.md`, `../../web/docs/API_Contract.md`, and `../../web/docs/Environment.md`. Copy `../.env.example` to the local environment file; AI receives short-lived Cloudflare R2 URLs but never R2 credentials.

The implementation sequence follows the same six phases as the root `Development_Plan.md`. Start with the root [Setup_Guide.md](../../Setup_Guide.md); it is the canonical setup, verification, and troubleshooting reference and must be reconciled at the end of every phase.

## Local start

1. Follow [Setup_Guide.md](../../Setup_Guide.md) to install dependencies and create `../.env.local` (legacy `.env` is also read, with lower priority).
2. From `ai/`, run `uv sync --all-groups` and then `uv run patch-ai`.
3. Open `http://localhost:8000/docs`; public liveness is at `/health`. Aggregate `/readiness` requires the Web-to-AI HMAC headers.

See [Backend_Manual_Testing.md](../../Backend_Manual_Testing.md) for signed Swagger
and Postman WebSocket testing, and [evaluations/README.md](../evaluations/README.md)
for the synthetic and representative evaluation gates.

After changing Pydantic routes or schemas, run `uv run python scripts/export_openapi.py` from `ai/`, then `npm run generate:ai-types` from `web/`. The AI test suite verifies that the committed OpenAPI artifact matches the application.

Use LangChain integrations first for models, embeddings, vector stores, and related AI-provider capabilities, and use LangGraph for workflow orchestration. Do not use a provider SDK directly in workflow code unless no suitable framework capability exists; isolate and document any such exception in `adapters/` with tests and a migration path.

Dependency changes must use `uv`, update `pyproject.toml` and `uv.lock` together, satisfy the repository selection policy, document the decision and setup impact, and pass the complete AI and affected cross-module gates.
