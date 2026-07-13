# Repository Understanding (2026-03-27)

## 1) What this project is

This repository is a **Next.js 15 App Router SaaS** for AI-assisted SEO content generation and publishing, branded in code/docs as **ArticleGen / Article Sauce**.

At a high level, the app provides:
- Landing/marketing site (`/`).
- Authenticated app workspace (`/app/*`).
- AI generation pipeline (research → metadata/outline/article/images).
- Credit- and plan-based usage controls.
- Multi-platform publishing (WordPress + Medium/Ghost/Dev.to/Shopify/Webflow/Notion routes).
- Supabase-backed data model with RLS and SQL migrations.
- Stripe billing + webhooks.

## 2) Tech and runtime model

- **Frontend/App shell**: Next.js 15 + React 18 + Tailwind.
- **Backend/API**: Next.js route handlers under `src/app/api/*`.
- **Data/Auth**: Supabase (Auth + Postgres + RLS + Storage).
- **AI**: OpenAI chat completions (model currently hardcoded in generation routes as `gpt-4.1-mini`).
- **Payments**: Stripe checkout, portal, webhook synchronization.
- **Scheduling**: Cron publish route + Vercel workflow.

The structure is a classic BFF (backend-for-frontend): UI pages call internal API routes; API routes validate/authenticate, then call OpenAI/external platforms and persist state in Supabase.

## 3) Main app surfaces

### Public (marketing)
- `src/app/page.tsx` is a conversion-focused landing page composed from marketing components (hero, social proof, FAQ, CTA, etc.).

### Authenticated app
- `/app` dashboard: pulls article stats, clusters, and credit info.
- `/app/generate`: generation workflows (standard + cluster).
- `/app/settings`, `/app/integrations`, `/app/billing`, `/app/admin`, `/app/onboarding`, etc.

`src/app/app/layout.tsx` wraps app pages with sidebar, topbar, credit banner, and user/session bootstrap logic.

## 4) Auth and authorization model

- `src/middleware.ts` protects:
  - `/app/*` (redirect to `/` + login param when unauthenticated)
  - `/api/admin/*` (authenticated + admin role required)
  - `/app/admin` (admin role required)

- Admin role source of truth is `user_profiles.role` in Supabase.
- SQL migration `20260326_security_fixes.sql` tightens profile update policy to reduce privilege escalation risk.

## 5) Generation pipeline (core product loop)

The generation APIs are split into stages under `src/app/api/generate/*`:
- `research`: contextual planning + source-oriented research text.
- `metadata`, `outline`, `article`, `images`, `cluster`, `ideas`: specialized generation steps.

Common safeguards in routes:
- Supabase user auth check.
- Per-user concurrency limit via `acquire_generation_slot`/`release_generation_slot` RPC wrappers.
- Input length/type checks for prompt fields.
- Credit checks/deductions (varies by endpoint).

Notable implementation details:
- `research` deducts credit early (except admins) before OpenAI call.
- `article` calls three OpenAI tasks in parallel (article markdown, image prompt JSON, schema JSON), then deducts one credit on success.

## 6) Credits, plans, and rate limiting

- `src/lib/credits.ts`:
  - Ensures a user profile exists.
  - Admin users effectively have unlimited credits.
  - Uses atomic SQL RPC `deduct_credit_atomic` for race-safe decrements.

- `src/lib/rate-limit.ts`:
  - Uses SQL RPCs to cap concurrent generations to 5 per user (admins bypass).
  - Release is defensive and floor-clamped in SQL.

- Related migrations:
  - `20260319_atomic_credit_deduction.sql`
  - `20260319_generation_rate_limit.sql`

## 7) Publishing architecture

Publishing routes exist per platform and a batch/scheduled layer:
- WordPress: `src/app/api/wordpress/publish/route.ts`
- Medium/Ghost/Dev.to/Shopify/Webflow/Notion routes
- Batch publish and cron publish endpoints

Patterns used:
- Credentials stored in `user_settings` JSON columns and decrypted at runtime.
- WordPress app passwords encrypted/decrypted via `src/lib/wp-crypto.ts`.
- WordPress route uploads generated images from Supabase Storage to WP media, injects inline images into HTML, and posts via `/wp-json/wp/v2/posts`.
- SSRF hardening helper (`validatePublicUrl`) is used before outbound publish requests.
- Successful publish events are logged via `publish_logs` table helper.

## 8) Data model status

Base schema (`supabase/schema.sql`) includes:
- `articles`, `clusters`, `user_settings`, `user_profiles`, `credit_transactions`.

Migrations expand capabilities with:
- Image storage metadata
- Multi-blog WordPress support
- Platform credential arrays
- Presets + GSC token fields
- Publish logs
- Scheduled publishing fields
- Security fixes + Stripe webhook dedupe table
- Team invite metadata

RLS is broadly enabled with user-owned access patterns and admin read/update overlays.

## 9) Product/docs alignment notes

Project docs under `docs/project/*` describe v1 scope and features. The codebase appears to implement most of the described surfaces plus some extras.

Potentially notable differences:
- Feature docs list some items as out-of-scope or P1, but code already includes early/stub surfaces (e.g., team, autopilot, free-tools pages/routes).
- Naming is partially mixed between "ArticleGen" in docs and "ArticleSauce" in code strings/user-agent/metadata.

## 10) Operational/developer workflow clues

- `.env.example` documents required provider keys (Supabase, OpenAI, Stripe, WP encryption key, GSC OAuth, cron secret).
- `scripts/` contains credential encryption utilities for platform secrets.
- `.github/workflows/cron-publish.yml` implies scheduled publishing automation in CI/runtime.

## 11) Bottom-line understanding

This is a **feature-rich, production-oriented SaaS codebase** centered on AI article generation + distribution, with:
- Strong Supabase-centric backend design,
- Real monetization/usage controls,
- Multi-platform publishing workflows,
- Ongoing hardening via incremental SQL migrations.

The architecture is coherent and mostly modular for a single Next.js repo, with business logic concentrated in route handlers and `src/lib/*` utilities, and state ownership centered in Supabase.
