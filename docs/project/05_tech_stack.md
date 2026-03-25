# Tech Stack — ArticleGen

## Framework
- **Next.js 15** (App Router, TypeScript)
- **React 18**

## UI
- **Tailwind CSS 3** — utility-first styling
- **shadcn/ui** — Radix-based component library (copy-paste ownership)
- **tailwind-merge** — conflict-free class merging
- **class-variance-authority (CVA)** — component variant system
- **Huge Icons (@hugeicons/react)** — icon library (stroke for default, solid for active)
- **framer-motion** — page transitions, drawers, toasts animations
- **Sonner** — toast notifications (shadcn default)
- **next-themes** — dark mode toggle and system preference

## State
- **Tanstack Query** — server state management, caching, revalidation
- **nuqs** — URL search param state (tab selection, filters)
- **React Context** — auth session, theme

## Auth
- **Supabase Auth** — email/password, session management
- **@supabase/ssr** — server-side session handling

## Database
- **Supabase (PostgreSQL)** — hosted DB with Row Level Security
- **supabase-js** — client for browser + server

## AI
- **OpenAI API** — GPT-4.1-mini (article generation), DALL-E 3 (image generation)

## Billing
- **Stripe** — Checkout (new subscriptions), Customer Portal (plan management)
- **Stripe Webhooks** — credit top-ups on successful payment

## Email
- **Supabase Auth emails** — verification, password reset (built-in)

## Utilities
- **date-fns** — date formatting and relative time
- **marked** — markdown to HTML rendering

## Hosting
- **Vercel** — deployment, edge functions, cron jobs

## Escape Hatches from Modaf Defaults
| Default | Used Instead | Reason |
|---------|-------------|--------|
| Prisma | Supabase (supabase-js) | Already integrated; RLS enforced at DB level |
| Auth.js (NextAuth) | Supabase Auth | Already integrated and battle-tested |
| T3 Env | Manual .env.example | Simpler for this project scope |
| React Email + Resend | Supabase Auth emails | Auth emails already handled; no custom email needed in v1 |
