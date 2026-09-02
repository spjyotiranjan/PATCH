# Web Module

This directory will contain the Next.js application. It includes both the technician-facing UI and server-side API routes. Read `UI_Implementation.md`, `UI_Design.md`, `Backend_Implementation.md`, `API_Contract.md`, and `Environment.md` before adding application code. Copy `../.env.example` to the local environment file; Web owns private Cloudflare R2 credentials. The corresponding high-fidelity WebP assets are stored in `../ui-design/`. Use `Equipment` / `Equipments` consistently and implement the canonical sidebar/title bar before feature routes.

The implementation sequence follows the same six phases as the root `Development_Plan.md`. Start with the root [Setup_Guide.md](../../Setup_Guide.md); it is the canonical setup, verification, and troubleshooting reference and must be reconciled at the end of every phase.

## Local start

1. Follow [Setup_Guide.md](../../Setup_Guide.md) to install dependencies, configure MongoDB/R2, and create `../.env.local`.
2. From `web/`, run `npm run dev`.
3. Open `http://localhost:3000`; health is at `/api/health`.
