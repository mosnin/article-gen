# Project Brief — ArticleGen

## Product Name
ArticleGen

## Version
v1 (current rebuild)

## Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **UI**: shadcn/ui (Radix primitives), Huge Icons, framer-motion, Sonner toasts
- **State**: Tanstack Query (server state), nuqs (URL state), React Context (auth/theme)
- **Auth**: Supabase Auth (email/password)
- **Database**: Supabase (PostgreSQL), RLS-enforced
- **AI**: OpenAI API (GPT-4.1-mini for generation, DALL-E for images)
- **Billing**: Stripe (Checkout + Customer Portal)
- **Email**: Supabase email (auth flows)
- **Hosting**: Vercel

## Roles

| Role | Capabilities |
|------|-------------|
| User | Generate articles, publish, manage settings, view billing |
| Admin | All user capabilities + manage all users' credits, view system stats |

## Core Entities

| Entity | Description |
|--------|-------------|
| Article | Generated content with title, markdown, metadata, images, schema |
| Cluster | Topic cluster: pillar + cluster articles |
| UserProfile | Credits, plan, Stripe customer ID, role |
| UserSettings | Domain, site name, author bio, platform credentials |
| WpBlog | WordPress site connections (multiple per user) |
| PublishingPlatform | Non-WP platform credentials (Medium, Ghost, Shopify, Dev.to) |
| PublishLog | History of publish attempts |
| GenerationSlot | Rate limiting tracker |
| OnboardingProgress | Step completion state |

## Monetization

| Plan | Credits | Price |
|------|---------|-------|
| Free | 10 | $0 |
| Starter | 50 | $19/mo |
| Growth | 150 | $49/mo |
| Pro | 300 | $99/mo |

## v1 Scope

### In Scope
- Full article generation pipeline (research → outline → article → images)
- Batch and cluster generation modes
- Publishing to: WordPress, Medium, Dev.to, Ghost, Shopify
- Credit-based usage system
- Stripe billing with plan management
- Multi-step onboarding
- Dashboard with article stats and activity
- Settings: site config, platform connections, generation presets
- Google Search Console keyword import
- Admin panel: user management, credit adjustment

### Out of Scope
- Team workspaces / multi-user organizations
- Custom AI model selection
- White-label mode
- Content calendar / editorial planning
- Social media publishing (Twitter, LinkedIn)
- Analytics beyond GSC integration
