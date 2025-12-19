<!-- .github/copilot-instructions.md - Guidance for AI coding agents working on APEX -->

# APEX — Copilot Instructions

Short, actionable guidance to help AI coding agents be productive in this repository.

- **Big picture:** APEX is a Turbo monorepo that orchestrates Claude-based agents to automate development. Core runtime lives in `packages/orchestrator` and shared types/config live in `packages/core`. CLI and API surfaces are in `packages/cli` and `packages/api`.

- **Key commands (root):** `npm install`, `npm run build`, `npm run dev`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run format`.
    - Run a package-specific command: `npm test --workspace=@apex/core` or `npm run build --workspace=@apex/cli`.

- **Start points (files):** see [packages/core/src/types.ts](../packages/core/src/types.ts) for domain types and validation and [packages/core/src/config.ts](../packages/core/src/config.ts) for `.apex/config.yaml` parsing. Orchestrator entry is [packages/orchestrator/src/index.ts](../packages/orchestrator/src/index.ts) and the SQLite-backed task store is [packages/orchestrator/src/store.ts](../packages/orchestrator/src/store.ts). CLI commands live in [packages/cli/src/index.ts](../packages/cli/src/index.ts).

- **Runtime shape & data flow:** CLI/API → ApexOrchestrator → Claude Agent SDK → `.apex/apex.db` (SQLite). Agents are defined as markdown under `.apex/agents/` and workflows as YAML under `.apex/workflows/`.

- **Project-specific conventions:**
    - Monorepo / npm workspaces + Turbo: prefer running root scripts (`npm run build`, `npm run dev`) unless working in a single package.
    - Config is project-local under `.apex/` (not in package JSON). Use existing config patterns in [README.md](../README.md).
    - Agent definitions are plaintext markdown (examples created in `templates/` and tests expect `.apex/agents/*.md`).
    - Follow Conventional Commits for branch/PR naming and commit messages.

- **Tests & tooling:** The repo uses Vitest (see [vitest.config.ts](../vitest.config.ts)). Run `npm run test` at root to execute all packages. Use `npm test --workspace=<pkg>` to limit scope.

- **Integration points & dependencies:**
    - Claude Agent SDK integration is centralized in the orchestrator package (look for `@anthropic-ai/claude-agent-sdk` usage).
    - Runtime stores state in `.apex/apex.db` via `better-sqlite3` — prefer non-destructive reads when possible and respect migrations/seed patterns.
    - WebSocket streaming lives in the API package; use `apex serve` for local API testing.

- **Pattern examples to follow:**
    - Use Zod schemas in `packages/core` when adding or validating domain objects.
    - New CLI commands should be added via Commander in `packages/cli/src/index.ts`.
    - When adding agent behaviors, provide a markdown agent definition under `templates/` or `.apex/agents/` and include tests referencing `templates` or `docs` examples.

- **Avoid guessing hidden state:** `.apex/` is created at runtime and contains environment-specific data (db, configs, agents). When running tests or local flows, create ephemeral `.apex/` under a temp dir or mock the store.

- **Useful files to inspect when reasoning:**
    - [README.md](../README.md) — quick start, architecture, and CLI usage
    - [ROADMAP.md](../ROADMAP.md) — near-term and upcoming milestones/features
    - [packages/core/src/config.ts](../packages/core/src/config.ts) and [packages/core/src/types.ts](../packages/core/src/types.ts)
    - [packages/orchestrator/src/index.ts](../packages/orchestrator/src/index.ts) and [packages/orchestrator/src/store.ts](../packages/orchestrator/src/store.ts)
    - [packages/cli/src/index.ts](../packages/cli/src/index.ts)

- **When making PRs:** keep changes scoped to packages when possible, run `npm run build` and `npm test` before submitting, and use Conventional Commit prefixes.

If any section is unclear or you'd like additional examples (example agent markdown, workflow YAML, or a short end-to-end run script), tell me which area to expand and I will iterate.
