# Article Sauce

Article Sauce is a full-stack AI content generation platform built with **Next.js App Router**, **Supabase**, **OpenAI**, and **Stripe**.

It helps users generate long-form SEO content, organize topic clusters, create AI images, and publish to one or more WordPress sites.

---

## What this app does

- Authenticated dashboard for generating and managing SEO articles.
- Multi-step article generation pipeline (research → metadata → article → optional images).
- Topic cluster generation (pillar + cluster pages with internal linking intent).
- Multi-blog WordPress connection management and publish flow.
- Credit-based usage model with subscription plans (Free, Starter, Growth, Pro).
- Admin APIs/pages for user and credit operations.

---

## Tech stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript + React
- **Styling:** Tailwind CSS + CSS variables
- **Auth/Data/Storage:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **AI:** OpenAI API
- **Billing:** Stripe
- **Deployment target:** Vercel-friendly Next.js app

---

## Project structure (high level)

```text
src/
  app/
    page.tsx                     # Marketing landing + auth modal
    app/
      page.tsx                   # Main dashboard (generator experience)
      billing/page.tsx           # Billing + plan management
      connected-blogs/page.tsx   # Multi-blog WP connection manager
      settings/page.tsx          # Account settings (email/password flows)
      publish/[id]/page.tsx      # Publish page for a generated article
      admin/page.tsx             # Admin-only page
    api/
      generate/*                 # AI generation endpoints
      wordpress/*                # WP categories + publish
      stripe/*                   # Checkout, portal, webhook
      credits/*                  # Credits check/deduct/get
      admin/*                    # Admin user/credit endpoints
  lib/
    supabase-*.ts                # Supabase browser/server/admin clients
    stripe.ts                    # Stripe client + plan mapping
    credits.ts                   # Credit/account helpers
  components/
    app-shell.tsx                # Shared shell for in-app pages

supabase/
  schema.sql                     # Main schema + RLS + indexes
  migrations/*                   # Additional migrations
```

---

## Core product flows

### 1) Authentication

- Users authenticate via Supabase auth.
- `middleware.ts` protects `/app/*` routes.
- Admin route access (`/app/admin`) is role-gated via `user_profiles.role`.

### 2) Article generation

The main app (`src/app/app/page.tsx`) orchestrates generation:

1. Research/context collection
2. Metadata generation (title/meta/slug/keywords)
3. Full article + schema + image prompt generation
4. Optional image generation and storage
5. Save outputs to Supabase (`articles` table)

Credits are deducted for qualifying generation actions.

### 3) Topic clusters

- Cluster workflows create a pillar + related articles.
- Cluster metadata and article relations are persisted in `clusters` and `articles`.
- UI supports scoped views by selected WordPress blog or general mode.

### 4) WordPress publishing

- Users connect one or more blogs in **Connected Blogs**.
- Publish endpoint resolves credentials from selected blog or article-associated blog.
- Optional image upload is performed through Supabase Storage → WordPress Media.
- Markdown is converted for WP post body and published as draft/published status.

### 5) Billing and credits

- Stripe checkout starts from `/api/stripe/checkout`.
- Billing portal via `/api/stripe/portal`.
- Webhooks (`/api/stripe/webhook`) sync subscription + credits.
- Credits and transactions are stored in `user_profiles` and `credit_transactions`.

---

## Database model (Supabase)

Main tables:

- `articles`: generated article records, publish state, blog association (`wp_blog_id`), cluster links.
- `clusters`: topic cluster metadata.
- `user_settings`: domain/site/author settings + connected WordPress blogs (`wp_blogs`).
- `user_profiles`: role, credits, Stripe customer/subscription fields.
- `credit_transactions`: usage/purchase/admin grant audit trail.

RLS policies in `supabase/schema.sql` ensure users only access their own data; admins are enabled via a `SECURITY DEFINER` helper (`is_admin()`).

---

## Environment variables

Create a `.env.local` file with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_GROWTH_PRICE_ID=
STRIPE_PRO_PRICE_ID=
```

> `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for both middleware and client auth flows.

---

## Local development

### 1) Install dependencies

```bash
npm install
```

### 2) Run the app

```bash
npm run dev
```

Open: `http://localhost:3000`

### 3) Build for production

```bash
npm run build
npm run start
```

---

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Apply migrations in `supabase/migrations/` if needed.
4. Configure authentication providers (email/oauth) in Supabase dashboard.
5. Add project keys and service role key to environment variables.

---

## Stripe setup

1. Create products/prices for Starter, Growth, Pro.
2. Put Stripe price IDs in env variables.
3. Configure webhook endpoint to `/api/stripe/webhook`.
4. Add webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

---

## Operational notes / best practices

- Keep service role key server-only; never expose it client-side.
- Review generated content before publishing.
- Validate WordPress application passwords and permissions per connected blog.
- Keep RLS policies aligned with any schema changes.
- Add observability (logging/alerts) around webhook failures and generation timeouts.

---

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run built app
npm run lint     # eslint
```

---

## Future improvements (recommended)

- Add automated tests (API integration + key UI flows).
- Add retry/queue strategy for long-running generation tasks.
- Add structured telemetry for generation latency and publish success rates.
- Add a docs folder for API endpoint contracts and architecture diagrams.
