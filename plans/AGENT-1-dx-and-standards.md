# AGENT-1: Developer Experience and Standards (Non-conflicting)

## Goal
Improve monorepo ergonomics and code standards without touching runtime logic. Avoid conflicts by limiting edits to root configs, backend lint config, and documentation-only cleanups.

## Scope (allowed files/paths)
- `package.json` (root): add aggregator scripts only
- `.prettierrc`, `.prettierignore`, `.editorconfig` (root): new files
- `apps/backend/eslint.config.mjs`: new file only (no edits to backend package.json)
- `src/components/` (repo root): move-to-frontend or remove if unused
- No changes to `apps/backend/src/**` or `apps/frontend/src/**`

## Tasks
- [ ] Root aggregator scripts in `package.json`
  - `build`: `pnpm -r --parallel build`
  - `lint`: `pnpm -r --parallel lint`
  - `typecheck`: `pnpm -r --parallel exec tsc --noEmit`
  - `test`: `pnpm -r --parallel test`
  - `format`: `prettier --write .`
- [ ] Add Prettier
  - Create `.prettierrc` (e.g., `{ "singleQuote": true, "semi": true }`)
  - Create `.prettierignore` (e.g., `node_modules`, `dist`, `.next`, `coverage`)
  - Add root scripts: `format`, `format:check`
- [ ] Add `.editorconfig` (2-space or 2/4 per team choice) to unify editors
- [ ] Backend ESLint
  - Create `apps/backend/eslint.config.mjs` using flat config with TypeScript + Node rules
  - Do not modify `apps/backend/package.json`; run via `pnpm --filter basil-backend exec eslint .`
- [ ] Repo cleanup
  - Inspect `src/components/` at repo root; if used in frontend, move to `apps/frontend/src/components/`
  - If unused, remove directory
  - Consolidate Docker docs references by linking to a single canonical doc (no content rewrite)

## Verification
- [ ] `pnpm format:check` returns no diffs after a run
- [ ] `pnpm lint` runs on frontend and backend (frontend already configured)
- [ ] `pnpm typecheck` succeeds for both apps
- [ ] No changes under `apps/**/src/**` and no merge conflicts with other agents

## Out of Scope (to avoid conflicts)
- Do not touch `tsconfig.base.json` or any `tsconfig.json`
- Do not touch CI or Dockerfiles
- Do not change code under `apps/backend/src/**` or `apps/frontend/src/**`
