# Development Instructions

This repository follows the Evandro Development Standard, aligned with current OpenAI Skills/Plugins engineering guidance.

## Core workflow
1. Inspect the existing project before modifying it.
2. Preserve working behavior and make the smallest useful change.
3. Run type, lint, build and relevant automated checks after changes.
4. Validate user-facing flows functionally and visually when UI changes are made.
5. Review logs and errors before considering work complete.
6. Document meaningful architecture, behavior, security and operational changes.
7. Keep Git history truthful, incremental and descriptive. Never fabricate retroactive development history.

## React / frontend
- Avoid unnecessary request waterfalls and excessive client bundles.
- Prefer clear component boundaries and predictable data flow.
- Reuse existing components and project conventions before introducing alternatives.
- Check responsive behavior and accessibility for UI changes.

## Supabase
- Treat RLS and authorization as security-critical.
- Review schema, indexes, query patterns and access paths when data behavior changes.
- Never expose privileged service-role credentials to client code.
- Keep environment-specific credentials out of the repository.

## QA
A change is not complete merely because it compiles. When applicable, validate the rendered behavior, important user flows, error states and console/runtime logs.

## Secrets
Never print, commit, paste into documentation, or expose API keys, tokens, passwords or environment secrets. Use environment variables and safe secret-management mechanisms.

## Repository-specific note
This project is being migrated away from Blink-managed dependencies/infrastructure. Do not introduce new Blink coupling. Existing Blink dependencies should be treated as migration targets and removed only after their usage and replacement have been verified.
