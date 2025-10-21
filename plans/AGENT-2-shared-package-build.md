# AGENT-2: Shared Package Build & Type-Safe Consumption (Non-conflicting)

## Goal
Ship `@basil/shared` as a compiled package with `.js` + `.d.ts` in `dist/` to improve reliability in builds, tests, and Docker. Avoid touching app source code to prevent conflicts.

## Scope (allowed files/paths)
- `packages/shared/**` only
- No edits to `tsconfig.base.json`
- No edits to `apps/**` code

## Tasks
- [ ] Add build pipeline for `@basil/shared`
  - Prefer `tsup` (ESM) or `tsc` only. Output: `dist/**/*.js` and `dist/**/*.d.ts`
  - Scripts in `packages/shared/package.json`:
    - `build`: `tsup src/index.ts --format esm --dts --out-dir dist` (or `tsc -p .`)
    - `clean`: `rimraf dist`
    - `prepublishOnly`: `pnpm run clean && pnpm run build`
- [ ] Update package exports to compiled outputs
  - `"exports"` entries should map `import` to `./dist/*.js` and `types` to `./dist/*.d.ts`
  - Keep the public API surface identical to current `src/` types
- [ ] Keep TS project references intact
  - `packages/shared/tsconfig.json` already has `composite: true` and declarations. Ensure it aligns with the build tool
- [ ] Do NOT change consumers yet
  - Do not modify `apps/backend` or `apps/frontend` imports to avoid conflicts. Consumers can continue to import `@basil/shared` normally; once dist exists, bundlers will resolve to compiled code

## Verification
- [ ] `pnpm --filter @basil/shared build` emits `dist/`
- [ ] `pnpm --filter basil-backend build` succeeds with `@basil/shared` compiled
- [ ] `pnpm --filter frontend build` succeeds with `@basil/shared` compiled
- [ ] Docker images build without referencing `.ts` from other packages

## Out of Scope (to avoid conflicts)
- No changes to root `tsconfig.base.json` path aliases
- No changes to `apps/backend/**` or `apps/frontend/**`
- No CI or Dockerfile edits
