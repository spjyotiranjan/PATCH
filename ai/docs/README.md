# AI Module

This directory will contain the Python FastAPI microservice for ingestion, Equipment/Project routing profiles, Pinecone source retrieval, cited answers, and draft assistance. Read `AI_Implementation.md`, `RAG_and_Safety.md`, and `../../web/docs/Environment.md` before adding service code. Copy `../.env.example` to the local environment file; AI receives short-lived Cloudflare R2 URLs but never R2 credentials.

The implementation sequence follows the same six phases as the root `Development_Plan.md`.

## Local start

1. Copy `../.env.example` to `../.env` and fill development values.
2. From `ai/`, run `uv sync --all-groups` and then `uv run fastapi dev src/patch_ai/main.py`.
3. Open `http://localhost:8000/docs`; health is at `/health`.

Use LangChain integrations first for models, embeddings, vector stores, and related AI-provider capabilities, and use LangGraph for workflow orchestration. Do not use a provider SDK directly in workflow code unless no suitable framework capability exists; isolate and document any such exception in `adapters/` with tests and a migration path.
