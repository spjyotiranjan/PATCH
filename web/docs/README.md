# Web Module

This directory contains the Next.js UI and server-side API. Before planning or changing it, read and strictly follow `../../AGENTS.md`, `../../Agent.md`, `UI_Implementation.md`, `UI_Design.md`, `Backend_Implementation.md`, `API_Contract.md`, and `Environment.md`; cross-service changes also require the AI implementation and safety documents. Copy `../.env.example` to the local environment file; Web owns private Cloudflare R2 credentials. The corresponding high-fidelity WebP assets are stored in `../ui-design/`. Use `Equipment` / `Equipments` consistently and implement the canonical sidebar/title bar before feature routes.

Dependency changes must follow the repository policy: prefer the existing stack, verify official compatibility/maintenance, update `package.json` and `package-lock.json` together through `npm`, document the decision and setup impact, and run the full affected gates.

The implementation sequence follows the same six phases as the root `Development_Plan.md`. Start with the root [Setup_Guide.md](../../Setup_Guide.md); it is the canonical setup, verification, and troubleshooting reference and must be reconciled at the end of every phase.

## Local start

1. Follow [Setup_Guide.md](../../Setup_Guide.md) to install dependencies, configure MongoDB/R2, and create `../.env.local`.
2. From `web/`, run `npm run dev`.
3. Open `http://localhost:3000`; health is at `/api/health`.
4. Run `npm run worker` in another terminal for ingestion, profile/procedure jobs
   and recurrence scheduling. Use the custom server scripts, not `next dev` directly.
5. Open `/api/docs` for Swagger; `/api/openapi` is the REST catalog. Follow
   [Backend_Manual_Testing.md](../../Backend_Manual_Testing.md) for account login,
   full REST workflows and Postman raw WebSocket testing without application UI.
