# Blink Decoupling — Completed

The application has completed its migration away from Blink-managed runtime dependencies.

## Current verified state

- Core application data and authentication flows use Supabase directly.
- No `@blinkdotnew/*` package is declared in `package.json`.
- No Blink UI stylesheet or Tailwind scan path is required.
- Vite and TypeScript aliases no longer redirect `@blinkdotnew/ui` imports.
- The customer ordering flow, admin workflow, CI pipeline and Vercel deployment were validated after the migration.
- The production merge was completed through PR #3 on 2026-09-07.

## Local compatibility names

Some local files may still contain historical names such as `blink-compat` or `BlinkClientBoundary`. These files are local React utilities and do not connect to Blink services. They should be treated as naming cleanup targets only, not external dependencies.

## Post-migration maintenance rules

1. Do not introduce new `@blinkdotnew/*` dependencies or service calls.
2. Keep customer/admin behavior unchanged when renaming local compatibility components.
3. Run typecheck, JavaScript lint, CSS lint, service-worker syntax checks and build before merging changes.
4. Validate customer ordering, admin status changes, notifications and printing when their related code changes.
5. Keep Supabase schema, migrations and security policies versioned with the application.
6. Keep environment secrets out of the repository.

## Outstanding technical-hardening work

The Blink migration itself is complete. Remaining work belongs to general project hardening, especially:

- make the Supabase schema reproducible from versioned migrations;
- review checkout price validation and RLS against the live database;
- keep PWA/offline caching and Firebase messaging on a single service worker;
- make dependency installation deterministic with a committed lockfile;
- protect `main` with required CI checks;
- gradually strengthen TypeScript strictness and add automated behavioral tests.
