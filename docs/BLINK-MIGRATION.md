# Blink Decoupling — Completed

The application has completed its migration away from Blink-managed runtime dependencies.

## Current verified state

- Core application data and authentication flows use Supabase directly.
- No `@blinkdotnew/*` package is declared in `package.json`.
- No Blink SDK, widget, visual editor, UI provider or build plugin is loaded.
- Local utility files and exported components no longer use Blink compatibility names.
- The customer ordering flow, admin workflow, CI pipeline and Vercel deployment were validated after the migration.
- The production migration was completed through PR #3 on 2026-09-07.
- The final local naming cleanup is tracked in the follow-up PR created on 2026-09-08.

## Post-migration maintenance rules

1. Do not introduce new `@blinkdotnew/*` dependencies or service calls.
2. Preserve customer and admin behavior when refactoring local UI components.
3. Run typecheck, JavaScript lint, CSS lint, service-worker syntax checks and build before merging changes.
4. Validate customer ordering, admin status changes, notifications and printing when their related code changes.
5. Keep Supabase schema, migrations and security policies versioned with the application.
6. Keep environment secrets out of the repository.

## Remaining hardening work

The Blink migration itself is complete. Remaining work belongs to general project governance and quality:

- protect `main` with required pull requests and CI checks;
- add automated behavioral tests for checkout and administrative flows;
- review anonymous authentication abuse controls and CAPTCHA;
- enable leaked-password protection when available for the project;
- continue strengthening TypeScript strictness incrementally.
