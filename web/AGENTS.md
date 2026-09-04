# Web Module AI Instructions

The repository-root `AGENTS.md` and `Agent.md` are binding. Before changing anything under `web/`, read them completely.

- UI changes require `../DESIGN.md`, `docs/UI_Implementation.md`, `docs/UI_Design.md`, `docs/API_Contract.md`, `docs/Environment.md`, and the matching `ui-design/` assets.
- Backend changes require `docs/Backend_Implementation.md`, `docs/API_Contract.md`, and `docs/Environment.md`.
- Cross-service changes also require `../ai/docs/AI_Implementation.md` and `../ai/docs/RAG_and_Safety.md`.
- Use existing Next.js/React and installed packages first. Any dependency change must follow the root dependency policy, use `npm`, update `package.json` and `package-lock.json`, and be reconciled with the applicable docs and `../Setup_Guide.md`.
- Never let generated framework agent files replace these repository-owned instructions.
