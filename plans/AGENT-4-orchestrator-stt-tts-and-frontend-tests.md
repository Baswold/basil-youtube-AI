# AGENT-4: Orchestrator Realtime STT/TTS + Frontend Tests + CI (Non-conflicting)

## Goal
Wire end-to-end realtime audio: stream mic to STT, emit interim/final captions, drive orb states, stream TTS back and record. Add frontend unit tests for socket flows and update CI to run them. Avoid overlapping with other agents’ scopes.

## Scope (allowed files/paths)
- `apps/backend/src/orchestrator-v2.ts`: wire handlers only
- `apps/backend/src/adapters/**`: new or updated STT/TTS streaming utilities (AssemblyAI WS, Google TTS streaming)
- `apps/frontend/src/**`: add tests and minimal test setup files only
- `.github/workflows/test.yml`: add separate frontend test job and concurrency cancellation
- No edits to `index.ts` security/middleware (owned by AGENT-3)
- No edits to `packages/shared/**` build or exports (owned by AGENT-2)
- No edits to root configs/scripts (owned by AGENT-1)

## Backend Tasks
- [ ] STT streaming (AssemblyAI recommended)
  - Implement websocket client that accepts PCM chunks and emits partial/final transcripts via callbacks
  - Call into `orchestrator-v2.ts` to update captions and `orb.state`
- [ ] TTS streaming (Google or Piper)
  - Stream TTS audio chunks to `RecorderService.writeAudioChunk(speaker, chunk)`
  - Track current speaker; update `orb.state` transitions (`speaking` -> `idle`)
- [ ] Orchestrator plumbing
  - In `audio.chunk`, forward chunks to STT when enabled
  - On partial transcripts: emit `caption` with `is_final=false` style preview (or update via snapshot)
  - On final transcripts: persist via `EventLogger` and `RecorderService`
  - Ensure graceful cleanup on disconnect/shutdown

## Frontend Tasks
- [ ] Add Vitest + RTL tests
  - Unit test `apps/frontend/src/state/studio-store.ts` for socket events: `state.snapshot`, `orb.state`, `caption`, `mode.thinking`
  - Mock `socket.io-client`
- [ ] Optional Playwright smoke
  - Connects to backend, verifies basic A11y and caption rendering (skippable in CI if backend not up)

## CI Tasks
- [ ] Add `concurrency` to cancel in-progress runs on new pushes to same ref
- [ ] New job `frontend-tests` in `.github/workflows/test.yml`
  - Install deps, run `pnpm --filter frontend exec tsc --noEmit`
  - Run `pnpm --filter frontend test` (Vitest)

## Verification
- [ ] Manual: speak into mic and see interim/final captions + orb transitions
- [ ] Backend logs show STT/TTS activity without errors
- [ ] Frontend tests pass locally and in CI

## Out of Scope (to avoid conflicts)
- No changes to security middleware, logging, or rate limiting (AGENT-3)
- No changes to shared package build or exports (AGENT-2)
- No root scripts, Prettier, or editor settings (AGENT-1)
