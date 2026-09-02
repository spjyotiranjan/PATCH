# AI Module

This directory contains the Python FastAPI microservice for ingestion, Equipment/Project routing profiles, Pinecone source retrieval, cited answers, and draft assistance. Read `AI_Implementation.md`, `RAG_and_Safety.md`, and `../../web/docs/Environment.md` before adding service code. Copy `../.env.example` to the local environment file; AI receives short-lived Cloudflare R2 URLs but never R2 credentials.

The implementation sequence follows the same six phases as the root `Development_Plan.md`. Start with the root [Setup_Guide.md](../../Setup_Guide.md); it is the canonical setup, verification, and troubleshooting reference and must be reconciled at the end of every phase.

## Local start

1. Follow [Setup_Guide.md](../../Setup_Guide.md) to install dependencies and create `../.env`.
2. From `ai/`, run `uv sync --all-groups` and then `uv run uvicorn patch_ai.main:app --reload`.
3. Open `http://localhost:8000/docs`; public liveness is at `/health`. Aggregate `/readiness` requires the Web-to-AI HMAC headers.

After changing Pydantic routes or schemas, run `uv run python scripts/export_openapi.py` from `ai/`, then `npm run generate:ai-types` from `web/`. The AI test suite verifies that the committed OpenAPI artifact matches the application.

Use LangChain integrations first for models, embeddings, vector stores, and related AI-provider capabilities, and use LangGraph for workflow orchestration. Do not use a provider SDK directly in workflow code unless no suitable framework capability exists; isolate and document any such exception in `adapters/` with tests and a migration path.
