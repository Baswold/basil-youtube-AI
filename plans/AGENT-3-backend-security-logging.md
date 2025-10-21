# AGENT-3: Backend Security & Structured Logging (Non-conflicting)

## Goal
Harden the Express server with security middleware, rate limiting, input validation, and structured logging without modifying orchestrator logic or frontend code.

## Scope (allowed files/paths)
- `apps/backend/src/index.ts`: add middlewares and logging integration
- `apps/backend/src/logger.ts`: new file exporting a pino logger
- `apps/backend/package.json`: add dependencies only (coordinate with AGENT-1 for script additions)
- No edits to `apps/backend/src/orchestrator*.ts` or `services/**`
- No edits to `apps/frontend/**`

## Tasks
- [ ] Dependencies (coordinate merge with AGENT-1): `helmet`, `express-rate-limit`, `pino`, `pino-http`, `zod`
- [ ] Create `apps/backend/src/logger.ts`
  - Export a configured `pino` instance (JSON logs, level from `NODE_ENV`)
- [ ] Wire `pino-http` in `index.ts` for request logging
  - Redact `authorization`, `cookie`, and any `*_api_key` fields
- [ ] Add `helmet()` in `index.ts`
- [ ] Add body size limits: `express.json({ limit: "1mb" })`
- [ ] Add rate limiting (IP-based): 100 req/15min for REST endpoints
  - Exclude WebSocket upgrade path
- [ ] Input validation for public endpoints using `zod`
  - `/health` and `/ready` are simple; validate query/body if any future endpoints are added
- [ ] Error handler middleware that logs error details with `pino`

## Verification
- [ ] `pnpm --filter basil-backend dev` starts with pino request logs
- [ ] Requests include `reqId` and redact sensitive fields
- [ ] `/health` and `/ready` still function; rate limit headers present
- [ ] No changes to orchestrator behavior; WebSocket connects unaffected

## Out of Scope (to avoid conflicts)
- Do not modify `orchestrator-v2.ts`, `services/**`, or adapters
- Do not change `.env.example` or CI; coordinate separately if needed
- Do not touch Dockerfiles or docs (besides this plan)
