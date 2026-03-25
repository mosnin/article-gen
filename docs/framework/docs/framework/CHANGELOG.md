# Changelog

All notable changes to this framework are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

Each entry specifies: which files were added/changed/removed, what the change means for downstream projects, and whether it is **breaking** or **non-breaking**.

## [1.11.0] - 2026-03-22

### Fixed
- `CLAUDE.md` Phase 9: Added `09_build_rules_internal.md` to "Read now" with specific sections (Server Action Pattern, API Route Error Handler, Pagination Utility, Tanstack Query Conventions) — Claude had the patterns but Phase 9 didn't point to them, forcing discovery by luck.
- `phase_09_core_features.md`: Added file 09 and QUICK_START.md to "Files to Read". Added 8-step Implementation Recipe that maps each build step (schema → validation → API routes → list page → forms → detail → delete → four states) to the exact file and section containing the pattern. Phase 9 was the most complex phase but had the least guidance on HOW to build.

### Changed (non-breaking)

## [1.10.0] - 2026-03-22

### Fixed
- `CLAUDE.md` Phase 5: Added `06_routes_and_permissions.md` (Middleware Pattern + Multi-Tenancy) to "Read now" — Claude was building auth without the middleware pattern, `requireOrganization()`, or `authorize()` helpers. The `gate:auth-middleware` validation gate would catch this but only after wasted work.
- `phase_05_auth.md`: Added files 06 and 28 to "Files to Read" — phase file was missing both middleware and accessibility.
- `phase_03_architecture.md`: Added files 21 and 23 to "Files to Read" — they were referenced in "What to Do" steps 5-6 but not listed at the top where agents look first.
- `phase_06_onboarding.md`: Added file 28 to "Files to Read" — multi-step flows need focus management and keyboard navigation guidance.
- `CLAUDE.md` Phase 14: Added `27_performance.md` and `28_accessibility.md` to "Read now" — polish phase was missing the actual audit checklists for performance and accessibility.

### Changed (non-breaking)

## [1.9.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/QUICK_START.md` — New file. Task-to-file decision tree ("I need to build an API endpoint → read files 09, 06"), files grouped by category (Auth, UI, Code Patterns, Data, Quality, Infrastructure), phase dependency chain showing snapshot flow and parallel agent rules, and shared utilities index (every helper created in Phase 4 with file location and purpose).
- `docs/framework/GLOSSARY.md` — Added 11 missing terms: apiHandler, authorize(), custom gate, doctor mode, error display decision tree, escape hatch, pagination utility, requireOrganization(), server action pattern, single-writer rule. Total: 44 terms.
- `CLAUDE.md` — Added QUICK_START.md to Quick Reference section and Repository Structure tree.

### Changed (non-breaking)
- `docs/framework/MANIFEST.md` — Updated file 09 description to reflect all utility patterns added in v1.5–v1.7. Updated file 06 description to include middleware and permission helpers. Updated file 17 to mention error display decision tree. Added QUICK_START.md to root file list.

## [1.8.0] - 2026-03-22

### Fixed
- `CLAUDE.md` Phase 4: Changed "(Phase 1 section)" to "(Phase 4: Foundation section)" — file 09 has no Phase 1, causing Claude to search for a non-existent section
- `CLAUDE.md` Phase 4: Added missing "Read now" files — `26_observability.md`, `27_performance.md`, `28_accessibility.md` were required by phase_04_foundation.md but not listed in CLAUDE.md
- `CLAUDE.md` Phase 5-6: Added `28_accessibility.md` to "Read now" — auth and onboarding pages were being built without accessibility guidance
- `CLAUDE.md` Phase 3: Added `23_escape_hatches.md` to "Read now" — users with non-default tech stacks had no swap guidance during architecture planning
- `docs/framework/internal/19_i18n_posture.md`: Fixed "Used by: None" → "Used by: 09, 14" — file IS consumed by Phase 14 and referenced by build rules

### Added (non-breaking)
- `CLAUDE.md` Global Build Rules: Added custom gates requirement — "Run validation gates AND custom gates (`docs/project/custom_gates.md`)" — custom gates from Phase 3 were never referenced in Phase 4-14
- `CLAUDE.md` Global Build Rules: Added pattern snapshot single-writer rule — prevents parallel Phase 9 agents from conflicting on snapshot updates

### Changed (non-breaking)

## [1.7.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/internal/09_build_rules_internal.md` — Added 3 reusable utilities and 1 convention:
  - **API route error handler**: `apiHandler()` wrapper that catches ZodError → 422, AuthorizationError → 403, Prisma P2002 → 409, P2025 → 404, unknown → 500 with referenceId and structured logging. Eliminates per-route try/catch boilerplate.
  - **Pagination utility**: `parsePagination()`, `toPrismaArgs()`, `buildPaginationMeta()` — parses URL params with zod validation, converts to Prisma skip/take, builds response meta. Default 25 rows, max 100.
  - **Next.js App Router file conventions**: Decision table for `loading.tsx` vs `<Suspense>` boundaries, `error.tsx` convention with shell preservation, concrete code examples for both patterns.
  - **TypeScript style rules**: Prefer `type` over `interface` (use interface only for declaration merging), type files in singular kebab-case, shared types in `src/types/`

### Changed (non-breaking)

## [1.6.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/internal/06_routes_and_permissions.md` — Added canonical Next.js middleware pattern: single `middleware.ts` with route classification (public → auth → protected → admin), session check, `returnTo` parameter, role-based admin gating, and matcher config. Includes 6 middleware rules (no DB in middleware, redirect vs rewrite, invite route handling).
- `docs/framework/internal/09_build_rules_internal.md` — Added 2 practical patterns:
  - **T3 Env canonical schema**: Complete `src/env.ts` template with typed server vars (DATABASE_URL, AUTH_SECRET, STRIPE_SECRET_KEY, RESEND_API_KEY, etc.) and client vars (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY), zod validation with `.startsWith()` prefix checks, `.env.example` requirement, and adaptation rules for projects that don't use all services
  - **Date and time conventions**: UTC storage rule, smart `formatDate()` utility (relative for recent, absolute for old), `formatDateAbsolute()` and `formatDateTime()` helpers, hydration mismatch prevention for server-rendered dates, `<time>` element requirement for accessibility

### Changed (non-breaking)

## [1.5.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/internal/09_build_rules_internal.md` — Added 4 canonical coding patterns:
  - **API response format**: Standard `{ data }` / `{ error: { code, message, fields? } }` shapes with TypeScript types, HTTP status code rules, and response examples for every status
  - **Server action pattern**: End-to-end example showing zod schema → next-safe-action server action (with auth, permissions, logging) → react-hook-form client component (with field error mapping, toast feedback, submit state)
  - **Tanstack Query conventions**: Query key factory pattern (`[entity, scope, filters]`), fetcher utility, query/mutation hooks with cache invalidation, optimistic update pattern, decision table for when NOT to use Tanstack Query (server components, forms, URL state)
- `docs/framework/internal/17_error_state_taxonomy.md` — Added error display decision tree: 14-row mapping of error context → display component (inline, toast, banner, error block, full-page, redirect) with 6 decision rules and 4 "never do this" anti-patterns

### Changed (non-breaking)

## [1.4.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/GLOSSARY.md` — 30+ framework-specific term definitions (activation, archetype, canonical, core entity, first value event, four states, gate, module, organization, pattern snapshot, phase, v1 scope, workspace, etc.) to prevent terminology drift across agents and phases

### Changed (non-breaking)
- `docs/framework/internal/06_routes_and_permissions.md` — Added multi-tenancy data isolation section with `requireOrganization()` query helper, org-scoped query rules (list, detail, create, update, delete), "own data" scoping for member role, API route pattern. Added permission enforcement section with `authorize()` helper, UI permission hook, deny-by-default rules, and permission testing requirements
- `docs/framework/internal/02_auth_and_onboarding.md` — Expanded onboarding branching logic with branch decision point table (role, OAuth, plan, team size), step registry pattern with conditional rendering, dynamic progress indicator, auto-skip and manual skip logic, OAuth pre-fill rules, and 5 branching rules
- `docs/framework/internal/05_settings_billing_admin.md` — Added webhook reliability section: idempotency pattern with WebhookEvent model, event ordering rules (use embedded state, timestamp conflict resolution, handle missing entities), retry handling (400 for bad signature, 500 for processing failure), type-safe event routing switch, webhook monitoring rules
- `docs/framework/internal/07_data_models.md` — Added schema migration strategy: initial migration workflow, post-Phase 4 migration naming conventions, rename vs drop guidance, required column on existing data rules, production migration command, when NOT to migrate
- `docs/framework/internal/09_build_rules_internal.md` — Added rate limiting section: endpoint-specific limits table (auth, signup, API, admin), Upstash Ratelimit implementation pattern, rate limit response format (429 + Retry-After), identifier strategy per context (IP for unauth, userId for auth)
- `docs/framework/website/saas_website_page_system.md` — Added SEO requirements section: per-page meta tag template, title conventions, Open Graph image spec (1200×630), sitemap.xml generation with Next.js metadata API, robots.txt configuration, JSON-LD structured data per page type, technical SEO checklist
- `docs/framework/internal/20_subagent_dispatch.md` — Updated Phase 9 and Phase 13 agent prompts to include accessibility file (28), multi-tenancy enforcement (requireOrganization), permission enforcement (authorize), SEO requirements, and reduced-motion fallbacks
- `docs/framework/phases/phase_04_foundation.md` — Added environment setup section (.env.example, T3 Env, setup instructions for README)
- `CLAUDE.md` — Added GLOSSARY.md to repo structure
- `docs/framework/MANIFEST.md` — Added GLOSSARY.md entry to framework root files

## [1.3.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/internal/26_observability.md` — Structured logging conventions (JSON format, dot-notation events, required fields), Sentry integration rules (context attachment, error filtering), health check endpoint pattern, key metrics (API response time, error rate, conversion rates), alerting thresholds, production debugging checklist
- `docs/framework/internal/27_performance.md` — Core Web Vitals targets (LCP <2.5s marketing, <3s product), Lighthouse score budgets (>90 marketing, >70 product), JavaScript bundle size limits (100KB marketing, 150KB product first-load), image optimization rules (next/image, sizing, formats), font loading strategy (next/font, subsetting), server component strategy, caching rules, third-party script policy
- `docs/framework/internal/28_accessibility.md` — WCAG 2.1 AA compliance target, keyboard navigation patterns per component, focus management rules (modal traps, return focus), screen reader support (semantic HTML, ARIA attributes, heading hierarchy, alt text), color contrast verification, form accessibility patterns, touch target minimums (44x44px), motion sensitivity (prefers-reduced-motion), automated testing with axe-core, manual testing checklist

### Changed (non-breaking)
- `docs/framework/internal/22_pattern_snapshot.md` — Added completeness checklist with per-section verification criteria, enforcement rules for "real code" extraction, placeholder protocol for incomplete sections
- `CLAUDE.md` — Added accessibility to global build rules, added files 26-28 to repo structure
- `docs/framework/MANIFEST.md` — Added entries for files 26, 27, 28
- `docs/framework/VERSION.md` — Bumped to 1.3.0

## [1.2.0] - 2026-03-22

### Added (non-breaking)
- **Modaf naming** — framework now has an official name. Added to CLAUDE.md, README.md, and MANIFEST.md so Claude recognizes "Modaf" as a reference to this framework.
- `docs/framework/internal/25_doctor_mode.md` — Safe diagnostic and repair system for framework and project docs. Runs 9 structural checks (file inventory, cross-references, internal links, manifest accuracy, phase coverage, required sections, table integrity, project doc completeness, CLAUDE.md consistency). Hard safety constraints: never deletes files, never rewrites content, never creates framework files, always diagnoses before repairing, logs every change.

### Changed (non-breaking)
- `CLAUDE.md` — Added Modaf name, doctor mode activation section, file 25 to repo structure
- `README.md` — Renamed from "SaaS Framework Repository" to "Modaf"
- `docs/framework/MANIFEST.md` — Added Modaf name, entry for file 25
- `docs/framework/VERSION.md` — Bumped to 1.2.0

## [1.1.0] - 2026-03-22

### Added (non-breaking)
- `docs/framework/internal/23_escape_hatches.md` — Technology swap guide for replacing default auth, billing, database, tenancy, email, and hosting choices
- `docs/framework/internal/24_error_recovery.md` — Phase re-run protocol with detection triggers, diagnosis, three recovery tiers, cascade analysis, and git safety
- `docs/framework/VERSION.md` — Semver versioning policy and merge strategy for downstream consumers
- `docs/framework/CHANGELOG.md` — This file

### Changed (non-breaking)
- `CLAUDE.md` — Added tech constraints to Phase 1 discovery interview, framework version reference, error recovery to global build rules, escape hatches reference in default tech stack
- `docs/framework/MANIFEST.md` — Added entries for files 23, 24, VERSION.md, and CHANGELOG.md
- `docs/framework/internal/09_build_rules_internal.md` — Added recovery protocol reference after quality gates section
- `docs/framework/internal/21_validation_gates.md` — Added escape hatch cross-reference for inapplicable gates, error recovery cross-reference in gate escalation
- `docs/framework/templates/05_tech_stack_template.md` — Added swap notes pointing to escape hatches per technology category
- `docs/framework/phases/phase_01_discovery.md` — Added tech constraints to interview coverage
- `docs/framework/phases/phase_03_architecture.md` — Added escape hatch reading step when defaults are overridden
- `docs/framework/prompts/00_kickoff_system.md` — Added error recovery to global build rules

## [1.0.0] - 2026-03-01

### Added
- Initial framework release
- 22 internal product docs (`docs/framework/internal/01–22`)
- 9 website docs (`docs/framework/website/`)
- 9 project doc templates (`docs/framework/templates/`)
- 15 phase index files (`docs/framework/phases/`)
- 2 prompt files (`docs/framework/prompts/`)
- MANIFEST.md file index
- CLAUDE.md master instruction file
