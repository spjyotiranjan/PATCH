# AI Module

This directory will contain the Python FastAPI microservice for ingestion, Equipment/Project routing profiles, Pinecone source retrieval, cited answers, and draft assistance. Read `AI_Implementation.md`, `RAG_and_Safety.md`, and `../../web/docs/Environment.md` before adding service code. Copy `../.env.example` to the local environment file; AI receives short-lived Cloudflare R2 URLs but never R2 credentials.

The implementation sequence follows the same six phases as the root `Development_Plan.md`.
