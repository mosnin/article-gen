# 23 Escape Hatches

> **TL;DR:** Technology swap guide — how to replace the framework's default assumptions (multi-tenant, Stripe, Auth.js, PostgreSQL, Resend, Vercel) when a project needs different choices. Includes per-category swap instructions, affected files, and gate adaptation protocol.
> **Covers:** tenancy model swap, auth provider swap, billing provider swap, database swap, email swap, hosting swap, gate adaptation | **Depends on:** 05, 07, 09, 21 | **Used by:** all phase files, CLAUDE.md | **Phase:** 2, 3

## Purpose

The framework's defaults are opinionated by design — they eliminate decision fatigue for the 80% case. But not every project fits the defaults. This file maps every major assumption to a concrete replacement protocol so that swapping a technology is a documented operation, not an improvisation.

## When to Read This File

- **Phase 1 (Discovery):** If the user mentions tech constraints (e.g., "must use Supabase", "no billing", "single-user app"), note them.
- **Phase 2 (Project Docs):** When generating `docs/project/05_tech_stack.md`, override the relevant default sections.
- **Phase 3 (Architecture):** Read the relevant swap sections below. Adapt the entity plan, route plan, and validation gates accordingly. Write replacement gates to `docs/project/custom_gates.md`.

## General Swap Protocol

For any technology swap:

1. **Document the swap** in `docs/project/05_tech_stack.md` with the alternative and justification
2. **Read the relevant section** of this file for what changes
3. **Adapt the entity plan** if the swap affects data models (e.g., single-tenant removes Organization)
4. **Adapt validation gates** — replace affected default gates with equivalent checks in `docs/project/custom_gates.md`, or document the skip with a reason
5. **Update the pattern snapshot** after the swap is built (Phase 7+) to reflect the actual conventions

---

## A. Tenancy Model: Multi-Tenant → Single-Tenant

### What Changes

The default framework assumes multi-tenant (User → Organization → Membership). Single-tenant apps remove the organization layer entirely.

### Entity Changes
- **Remove:** Organization, Membership, Settings (org-level)
- **Simplify:** Subscription attaches to User, not Organization
- **Remove:** `organizationId` from all product entities — replace with `userId`
- **Remove:** Organization slug, org-level preferences, workspace settings

### Route Changes
- Remove workspace/org selection and switching
- Settings page simplifies (no team management, no member invites)
- Remove org-scoped middleware checks

### Permission Changes
- Collapse role system. No org roles (member/manager/admin/owner). Use a simple `isAdmin` boolean on User for platform-level admin access.
- Permission checks change from "does this user have this role in this org?" to "does this user own this resource?"

### Files Affected
| File | What to Change |
|------|---------------|
| `07_data_models.md` | Skip Organization, Membership. Subscription → User. |
| `06_routes_and_permissions.md` | Simplify role system, remove org-scoped routes |
| `05_settings_billing_admin.md` | Remove workspace settings, team management |
| `09_build_rules_internal.md` | Remove org-isolation coding standard |
| `02_auth_and_onboarding.md` | Remove workspace creation from onboarding |

### Gate Adaptations
| Default Gate | Action |
|-------------|--------|
| `gate:foundation-entities` | Change minimum to: User, Subscription. Remove Organization, Membership requirement. |
| `gate:features-org-isolation` | **Skip** — not applicable. Document: "Single-tenant app, no org isolation needed." |
| `gate:onboarding-flow` | Adapt — onboarding may not include workspace creation step |

### Prisma Schema Adjustment

Replace org-scoped queries:
```prisma
// Multi-tenant (default)
where: { organizationId: user.organizationId }

// Single-tenant replacement
where: { userId: user.id }
```

---

## B. Auth Provider: Auth.js → Alternatives

### B1. Supabase Auth

**Session access pattern:**
```typescript
import { createClient } from "@/lib/supabase/server"

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

**What changes:**
- No `src/app/api/auth/` routes — Supabase handles login/signup UI and API
- Middleware uses Supabase session refresh instead of Auth.js callbacks
- Password hashing handled by Supabase (not in your code)
- Email verification handled by Supabase

**Gate adaptations:**
| Default Gate | Action |
|-------------|--------|
| `gate:auth-routes` | **Replace** — check for Supabase client config instead: `grep -r "createClient\|createServerClient" src/lib/ 2>/dev/null` |
| `gate:auth-middleware` | **Replace** — grep for `supabase.auth.getUser\|updateSession` in middleware |
| `gate:auth-password-hashing` | **Skip** — Supabase handles this. Document: "Auth provider manages password hashing." |

### B2. Clerk

**Session access pattern:**
```typescript
import { currentUser, auth } from "@clerk/nextjs/server"

const user = await currentUser()
const { userId } = await auth()
```

**What changes:**
- No auth pages in your codebase — Clerk provides hosted or embedded UI
- Middleware uses `clerkMiddleware()` from `@clerk/nextjs/server`
- No password reset or email verification routes needed

**Gate adaptations:**
| Default Gate | Action |
|-------------|--------|
| `gate:auth-routes` | **Skip** — Clerk handles auth routes. Document: "Auth provider manages all auth routes." |
| `gate:auth-pages` | **Replace** — check for Clerk provider in layout: `grep -r "ClerkProvider" src/app/layout.tsx` |
| `gate:auth-middleware` | **Replace** — check for `clerkMiddleware` in middleware file |
| `gate:auth-password-hashing` | **Skip** — Clerk handles this externally |

### B3. Lucia Auth

**Session access pattern:**
```typescript
import { validateRequest } from "@/lib/auth"

const { user, session } = await validateRequest()
```

**What changes:**
- Auth routes stay in your codebase (like Auth.js), but use Lucia's session API
- Password hashing uses `@node-rs/argon2` or similar (you manage it)
- Middleware pattern similar to Auth.js but with Lucia's `validateRequest()`

**Gate adaptations:**
- Most default gates work as-is — Lucia follows a similar pattern to Auth.js
- `gate:auth-middleware`: grep for `validateRequest\|lucia` instead of Auth.js patterns

---

## C. Billing Provider: Stripe → Alternatives

### C1. Lemon Squeezy

**What changes:**
- Different webhook event names (`subscription_created` vs `customer.subscription.created`)
- Checkout via Lemon Squeezy hosted page, not Stripe Checkout
- No Customer Portal equivalent — build plan management UI yourself
- SDK: `@lemonsqueezy/lemonsqueezy.js`

**Gate adaptations:**
| Default Gate | Action |
|-------------|--------|
| `gate:billing-stripe` | **Replace** — `grep -r "lemon\|lemonsqueezy\|LEMON_SQUEEZY" src/ 2>/dev/null` |
| `gate:billing-webhook` | **Keep** — still need a webhook endpoint, just with different event handling |

### C2. Paddle

**What changes:**
- Paddle handles tax calculation and acts as merchant of record
- Checkout via Paddle.js overlay, not redirect
- Webhook events differ from Stripe

**Gate adaptations:**
- Same approach as Lemon Squeezy: replace `gate:billing-stripe` grep with Paddle references

### C3. No Billing (Free Product)

**What changes:**
- Skip Phase 10 billing sections entirely
- Remove Subscription entity or simplify to a single `plan` field on User/Organization
- Remove Stripe SDK, webhook endpoint, billing settings page

**Gate adaptations:**
| Default Gate | Action |
|-------------|--------|
| `gate:billing-stripe` | **Skip** — Document: "No billing in v1." |
| `gate:billing-webhook` | **Skip** — Document: "No billing in v1." |
| `gate:settings-pages` | **Adapt** — billing settings page not required |

---

## D. Database: PostgreSQL/Prisma → Alternatives

### D1. Supabase (PostgreSQL + Supabase Client)

**What changes:**
- Queries use Supabase client instead of Prisma
- Schema managed via Supabase migrations (SQL), not Prisma schema file
- Row Level Security (RLS) can replace application-level org isolation

**Gate adaptations:**
| Default Gate | Action |
|-------------|--------|
| `gate:foundation-schema` | **Replace** — check for Supabase migration files: `ls supabase/migrations/*.sql 2>/dev/null` |
| `gate:features-org-isolation` | **Replace** — check for RLS policies: `grep -r "CREATE POLICY\|RLS" supabase/migrations/ 2>/dev/null` |

### D2. Drizzle ORM (with PostgreSQL or SQLite/Turso)

**What changes:**
- Schema defined in TypeScript (`drizzle/schema.ts`), not Prisma schema
- Query syntax differs: `db.select().from(users).where(eq(users.id, id))`
- Migrations via `drizzle-kit`

**Gate adaptations:**
| Default Gate | Action |
|-------------|--------|
| `gate:foundation-schema` | **Replace** — `ls src/db/schema.ts drizzle/ 2>/dev/null` |
| `gate:foundation-entities` | **Replace** — `grep -c "export const" src/db/schema.ts` |

### D3. MongoDB/Mongoose

**What changes:**
- No relational schema — document model instead
- No migrations in the traditional sense
- Multi-tenancy via `organizationId` field (same pattern, different implementation)

**Gate adaptations:**
- Replace all Prisma-specific gates with Mongoose equivalents
- `gate:foundation-schema`: check for Mongoose model files

### Pattern Snapshot Impact

Section E (Prisma Query Patterns) of the pattern snapshot must be rewritten for whatever ORM/client is used. The structure stays the same — scoped queries, transactions, error handling — but the syntax changes.

---

## E. Email: Resend → Alternatives

### E1. SendGrid

```typescript
import sgMail from "@sendgrid/mail"
sgMail.setApiKey(process.env.SENDGRID_API_KEY!)
```

### E2. AWS SES

```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
```

### E3. Postmark

```typescript
import { ServerClient } from "postmark"
const client = new ServerClient(process.env.POSTMARK_API_KEY!)
```

### E4. No Email

Skip Phase 12 entirely. Remove email verification from auth flow (use immediate account activation). Document the skip.

**Gate adaptations for all email swaps:**
| Default Gate | Action |
|-------------|--------|
| `gate:email-send-function` | **Adapt** — change grep to match the alternative SDK |
| `gate:email-templates` | **Keep** — React Email templates work with any provider |

---

## F. Hosting: Vercel → Alternatives

### F1. Netlify
- Middleware runs as Netlify Edge Functions (different API surface)
- Environment variables configured via Netlify UI or `netlify.toml`
- No native ISR — use On-Demand Builders or full SSR

### F2. Railway / Fly.io / Self-Hosted
- Standard Node.js server (`next start`)
- Need to manage `PORT`, health checks, and process management
- Middleware runs in Node.js (not Edge runtime)
- Database can be co-located (lower latency)

### F3. Cloudflare Pages
- Edge runtime only — some Node.js APIs unavailable
- Prisma requires Prisma Accelerate or D1 adapter
- Middleware runs as Cloudflare Workers

**Gate adaptations:** Hosting swaps do not affect validation gates. Gates check code structure, not deployment target.

---

## Gate Adaptation Protocol

When any default is swapped:

1. **Identify affected gates** — scan `docs/framework/internal/21_validation_gates.md` for references to the swapped technology
2. **For each affected gate, choose one action:**
   - **Replace** — write an equivalent gate for the new technology in `docs/project/custom_gates.md`
   - **Skip** — document the reason (e.g., "Auth provider handles this externally")
   - **Keep** — if the gate is generic enough to work with the new technology
3. **Replacement gates must follow the same format** as `21_validation_gates.md`:
   ```markdown
   ### gate:[name]
   **What:** [description]
   ```bash
   [command]
   ```
   **Pass:** [criteria]
   **Common failure:** [what goes wrong]
   ```
4. **Run replacement gates** at the same phase checkpoints as the originals

---

## Multiple Swaps

Swaps compose. If a project uses Supabase Auth + Supabase Database + Lemon Squeezy + no email:

1. Read sections B1, D1, C1, E4
2. Combine all gate adaptations into a single `docs/project/custom_gates.md`
3. Document all skips with reasons
4. The pattern snapshot (Phase 7) will capture whatever conventions emerge from the combined swaps

## Final Principle

The framework's opinions are defaults, not walls. Every default can be swapped if the swap is documented, the gates are adapted, and the pattern snapshot reflects the actual conventions. What cannot be swapped is the phased process itself — discovery, docs, architecture, then build. That holds regardless of technology choices.
