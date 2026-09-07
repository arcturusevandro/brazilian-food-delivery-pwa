# Blink Decoupling Plan

This document tracks the verified, incremental migration away from Blink-managed dependencies. Changes must preserve working behavior and be validated before the next phase.

## Verified state

- Application data/auth flows use Supabase directly in core customer/admin areas.
- `@blinkdotnew/sdk` is isolated in `src/blink/client.ts`; no verified application import of that client was found during the 2026-09-07 audit.
- `@blinkdotnew/ui` is still broadly used by the rendered application and must not be removed in one step.
- Blink-specific visual-editor/build tooling remains in the repository.

## Migration phases

### Phase 1 — Security baseline — completed
- Stop tracking `.env`.
- Ignore local environment files.
- Keep `.env.example` without real values.

### Phase 2 — Isolated Blink SDK — candidate
Before deletion, run repository-wide reference checks and a clean install/build. If still unused:
- remove `src/blink/client.ts`;
- remove `@blinkdotnew/sdk` from dependencies;
- regenerate the lockfile with the project package manager;
- run build and functional smoke tests.

### Phase 3 — Blink editor / hosting tooling
After confirming the current deployment no longer depends on Blink hosting/editor behavior:
- remove the Blink visual-editor Vite plugin and its source file;
- replace/remove Blink-specific static-build finalization;
- verify production routing, assets and PWA behavior on the actual deployment target.

### Phase 4 — Blink UI
Migrate incrementally, not as a bulk replacement:
1. establish local/shared UI primitives;
2. replace low-risk primitives first (Button, Input, Label, Badge, Skeleton);
3. replace cards, tabs, dialogs/toasts and switches;
4. replace shell/sidebar/provider dependencies;
5. remove Blink UI stylesheet and Tailwind scan path;
6. remove `@blinkdotnew/ui` only after repository-wide reference checks return none.

Each UI batch requires responsive and visual QA plus customer/admin flow checks.

### Phase 5 — Final verification
- no `@blinkdotnew/*` imports or dependencies;
- no Blink project IDs/keys/fallbacks;
- clean install, lint/typecheck/build where configured;
- customer ordering smoke test;
- admin authentication and management smoke test;
- password reset test;
- PWA/service-worker sanity check;
- production deployment verification.

## Safety rule
Do not delete a dependency merely because it appears legacy. Verify references, replace behavior, test the rendered application, then remove it.
