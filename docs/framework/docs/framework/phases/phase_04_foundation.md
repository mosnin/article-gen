# Phase 4 — Foundation

## Trigger
Architecture plan confirmed. No source code exists yet.

## Files to Read
- `docs/framework/internal/09_build_rules_internal.md` — Phase 4 (Foundation) section
- `docs/framework/internal/21_validation_gates.md` — validation gate system and Phase 4 gates
- `docs/framework/internal/26_observability.md` — logger setup, health check endpoint, Sentry config
- `docs/framework/internal/27_performance.md` — font loading, image optimization, bundle budgets
- `docs/framework/internal/28_accessibility.md` — skip-to-content link, base a11y setup

## What to Build

### Project Setup
- Initialize Next.js with app router, TypeScript, Tailwind CSS
- Configure Prisma with PostgreSQL
- Set up project structure per architecture plan

### Database Schema
- Create Prisma schema from entity plan
- Include all canonical entities (User, Organization, Membership, Subscription, etc.)
- Add app-specific entities
- Set up relationships and indexes

### Shared Infrastructure
- Types and interfaces
- Constants and configuration
- Utility functions
- API route helpers
- Error handling utilities
- Structured logger (`lib/logger.ts`) per `26_observability.md`
- Health check endpoint (`/api/health`) per `26_observability.md`
- Sentry setup (if in tech stack) per `26_observability.md`
- Skip-to-content link and base a11y setup per `28_accessibility.md`

### Environment Setup
- Create `.env.example` with all required variables (documented with comments)
- Configure T3 Env for type-safe environment validation
- Required variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`
- Add `.env` and `.env.local` to `.gitignore`
- Add setup instructions to the project README:
  1. `cp .env.example .env`
  2. Fill in environment variables
  3. `npm install`
  4. `npx prisma migrate dev`
  5. `npm run dev`

### Verify
- Project builds without errors
- Database migrates successfully
- Dev server starts cleanly

### Run Validation Gates
Run all Phase 4 gates from `docs/framework/internal/21_validation_gates.md`:
- `gate:foundation-builds` — TypeScript compiles
- `gate:foundation-schema` — Prisma validates
- `gate:foundation-entities` — All architecture entities in schema
- `gate:foundation-env` — Env template exists
- `gate:foundation-structure` — Expected directories exist

All gates must pass before proceeding.

## Exit Condition
Foundation is running. All Phase 4 gates pass. Summarize what was set up and ask user to continue to **Phase 5**.
