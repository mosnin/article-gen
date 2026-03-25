# 09 Build Rules Internal

> **TL;DR:** Defines the authoritative build order (11 build phases, numbered 4–14 to match CLAUDE.md), source-of-truth hierarchy, reuse rules, responsive requirements, state handling rules, coding standards, and quality gates.
> **Covers:** build phases, source hierarchy, reuse rules, responsive rules, state handling, coding standards, quality gates | **Depends on:** 01, 02, 03, 05, 07, 08, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22 | **Used by:** None | **Phase:** 3, 4

## Purpose

Define how the internal framework must be used during implementation. This is the authoritative reference for build order, coding standards, and quality gates.

## Core Rule

Read the framework first. Generate the project docs next. Build only after both layers exist.

## Source Of Truth Hierarchy

1. docs/project/* (app-specific decisions override everything)
2. docs/framework/internal/* (authenticated product rules)
3. docs/framework/website/* (marketing site rules)
4. docs/framework/templates/* (document shape reference)

## Build Phases (4–14)

Build in this exact order. Do not skip ahead. Phase numbers match CLAUDE.md.

### Phase 4: Foundation
- Initialize project (Next.js app router, TypeScript, Tailwind)
- Install and configure the core library stack (see `docs/framework/templates/05_tech_stack_template.md`):
  - Run `npx shadcn@latest init` — select "New York" style, CSS variables, project primary color
  - Install always-included libraries: Motion, react-hook-form, zod, Tanstack Query, nuqs, next-themes, Sonner, superjson, date-fns, T3 Env, next-safe-action
  - Install auth and billing: Auth.js, Stripe SDK, stripe-event-types
  - Install email: Resend, React Email
  - Install testing: Vitest, Playwright, MSW, Faker
  - Install include-when-needed libraries based on `docs/project/02_feature_spec.md`: Recharts (if charts needed), Tanstack Table (if complex tables), uploadthing (if file uploads), Trigger.dev/Inngest (if background jobs), Upstash Ratelimit (if rate limiting needed)
- Configure T3 Env with environment variables (see T3 Env Canonical Schema below)
- Configure database (PostgreSQL + Prisma schema for core entities from `07_data_models.md`)
- Set up shared directories: `lib/validations/` (zod schemas), `lib/animations.ts` (Motion variants), `components/ui/` (shadcn components)
- Create shared utility functions (date formatting, currency, validation helpers)
- Create structured logger utility (`lib/logger.ts`) per `26_observability.md`
- Configure Sentry if included in tech stack per `26_observability.md`
- Create health check endpoint (`/api/health`) per `26_observability.md`
- Configure `next/font` and image optimization per `27_performance.md`
- Add "Skip to content" link and base accessibility setup per `28_accessibility.md`
- Run Phase 4 validation gates from `21_validation_gates.md`

### Phase 5: Auth
- Implement auth routes: /login, /signup, /forgot-password, /reset-password, /verify-email
- Auth page layout per `02_auth_and_onboarding.md` — Section A: Auth (split layout desktop, single column mobile)
- Session management and middleware for protected routes
- Email verification flow (see also `14_email_system.md` for email templates)

### Phase 6: Onboarding
- Multi-step onboarding flow per `02_auth_and_onboarding.md` — Section B: Onboarding
- Progress persistence (user can leave and return)
- Skip logic for optional steps
- First value event delivery (defined in `docs/project/03_user_flows.md`)

### Phase 7: App Shell
- Read the internal visual pack (`10_design_tokens_internal.md`, `11_internal_screen_archetypes.md`, `12_internal_component_specs.md`, `13_internal_data_display_rules.md`) and `08_ui_system_internal.md` before building any authenticated pages
- Configure Tailwind theme with design tokens from `10_design_tokens_internal.md`
- Build the authenticated shell per `01_app_shell.md`: top bar, sidebar, mobile drawer, main content area
- Page header component (title, context, primary action, secondary actions)
- User menu (profile, settings, billing, logout)
- Role-aware sidebar (hide items user cannot access)
- Generate pattern snapshot per `22_pattern_snapshot.md` → `docs/project/pattern_snapshot.md`

### Phase 8: Dashboard
- Read `docs/project/pattern_snapshot.md` before writing code
- Identify the appropriate dashboard archetype from `16_dashboard_archetypes.md` (queue, pipeline, analytics, content workspace, operations, monitoring, admin overview)
- Dashboard page per `03_dashboard_system.md`: summary row, main work area, secondary insights
- Data display rules from `13_internal_data_display_rules.md` for metric formatting and table/card choices
- All four states: loading skeleton, empty state with CTA, success with data, error with retry
- Mobile responsive layout (stacked cards, no horizontal scroll)
- Update pattern snapshot with dashboard conventions

### Phase 9: Core Features
- Read `docs/project/pattern_snapshot.md` (MANDATORY) before writing any code
- Product-specific feature modules from `docs/project/02_feature_spec.md`
- Each feature uses the shared page header and shell layout
- CRUD operations with confirmation dialogs for destructive actions
- List views with search, sort, and pagination
- All four states on every view: loading, empty, success, error
- Error handling per `17_error_state_taxonomy.md`
- Update pattern snapshot with feature module template after first feature

### Phase 10: Settings and Billing
- Settings pages per `05_settings_billing_admin.md`: profile, workspace, billing, security, notifications
- Stripe integration: Checkout for upgrades, Customer Portal for billing management
- Webhook endpoint for subscription lifecycle events
- Permission enforcement (workspace/billing restricted to admin+)

### Phase 11: Admin
- Admin panel per `05_settings_billing_admin.md`: user management, billing overview, usage, logs
- Role-gated access (admin and owner only)
- All admin actions logged to Admin Record entity
- Search and filter on user list

### Phase 12: Email Templates
- Build transactional and product emails per `14_email_system.md`
- Auth emails (verification, password reset, magic link)
- Billing emails (receipt, failure, trial ending)
- Onboarding emails (welcome, activation nudge)
- Plain text fallbacks for all emails

### Phase 13: Marketing Site
- Build public pages per `docs/framework/website/` specs
- Home page with conversion funnel per `saas_home_page_system.md`
- Page layouts per `public_screen_archetypes.md`
- Design tokens from `design_system_tokens.md`, components from `public_component_specs.md`
- Copy and CTA rules from `public_copy_conversion_rules.md`
- Additional pages per `saas_website_page_system.md` as scoped

### Phase 14: Edge Cases and Polish
- Implement edge cases from `docs/project/04_edge_cases.md`
- Handle all error types per `17_error_state_taxonomy.md`
- Run through QA checklist from `docs/project/08_qa_checklist.md`
- Verify acceptance criteria from `docs/project/07_acceptance_criteria.md`
- Run automated tests per `18_testing_strategy.md`
- Performance audit per `27_performance.md` (Lighthouse, bundle sizes, Core Web Vitals)
- Accessibility audit per `28_accessibility.md` (axe-core, keyboard nav, screen reader, manual checklist)
- Dark mode pass, mobile pass, responsive pass per `15_canonical_breakpoints.md`

## Rate Limiting

### Where to Apply

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/auth/login` | 5 attempts | 15 minutes | Prevent brute force (per `02_auth_and_onboarding.md`) |
| `/api/auth/signup` | 3 attempts | 1 hour | Prevent spam account creation |
| `/api/auth/forgot-password` | 3 attempts | 10 minutes | Prevent email spam |
| `/api/auth/verify-email/resend` | 3 attempts | 10 minutes | Per `02_auth_and_onboarding.md` |
| `/api/webhooks/*` | No limit | — | External services must not be rate limited |
| All other API routes | 60 requests | 1 minute | General API protection |
| Admin routes | 120 requests | 1 minute | Higher limit for admin operations |

### Implementation Pattern

Use Upstash Ratelimit (when included in tech stack) or a simple in-memory counter for development:

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const authLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "ratelimit:auth",
})

export const apiLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:api",
})
```

### Rate Limit Response

Return HTTP 429 with a `Retry-After` header. Do not reveal rate limit details to unauthenticated users (prevents timing attacks on auth endpoints).

```typescript
const { success, reset } = await authLimiter.limit(identifier)
if (!success) {
  return new Response("Too many requests", {
    status: 429,
    headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
  })
}
```

### Rate Limit Identifier

| Context | Identifier | Rationale |
|---------|-----------|-----------|
| Auth endpoints (unauthenticated) | IP address | Can't use userId — user isn't authenticated yet |
| API endpoints (authenticated) | `userId` or `organizationId` | Per-user or per-org limits |
| Webhook endpoints | Don't rate limit | External services retry on failure |

---

## Reuse Rules

- Reuse existing shell — never create a second shell layout
- Reuse existing page header component on every authenticated page
- Reuse common settings framing (left nav + right content panel)
- Reuse common admin framing (same layout as settings)
- Reuse components from `08_ui_system_internal.md` before creating new ones
- Follow visual specs from `12_internal_component_specs.md` for all component dimensions, spacing, and states
- Follow screen archetypes from `11_internal_screen_archetypes.md` for page composition
- Follow data display rules from `13_internal_data_display_rules.md` for tables, charts, and metric presentation
- Extract shared patterns only when used in 3+ places

## Responsive Rules

- Follow the canonical breakpoint scale from `15_canonical_breakpoints.md` for all responsive behavior
- Mobile responsiveness is required from the first page built
- Desktop-only assumptions are not allowed
- Dense data views (tables, grids) need explicit mobile behavior defined per `15_canonical_breakpoints.md` table collapse rules
- Minimum touch target: 44x44px
- Test at 375px width (iPhone SE) as the baseline

## State Handling Rules

Every major page or module must account for:

- **Loading**: Skeleton placeholder matching the layout shape
- **Empty**: Helpful message with CTA to create first item (not a blank page)
- **Success**: Data rendered correctly with all interactions available
- **Validation failure**: Inline field errors, form-level summary if needed
- **System failure**: User-friendly error message with retry action
- **Permission denied**: Clear message, no raw 403 codes, link back to accessible area
- **Feature unavailable**: Upgrade prompt when feature requires a higher plan

## Coding Standards

- Use TypeScript strict mode — no `any` types in production code
- Prefer `type` over `interface` — use `interface` only when declaration merging is needed (extending third-party types). Use `type` for everything else (props, API shapes, function signatures, unions, intersections).
- Server Components by default, Client Components only when interactivity requires it
- Colocate related files (component, styles, types, tests in the same directory)
- Type files: singular, kebab-case (`user.ts`, `api-response.ts`) in `src/types/` for shared types, or colocated for component-specific types
- API routes and Server Actions validate input and check permissions independently — use next-safe-action for server actions, zod for input validation
- Database queries always filter by organization_id for multi-tenancy isolation
- Sensitive data (tokens, secrets) stored encrypted, never logged or exposed in responses
- Use Prisma transactions for operations that modify multiple tables
- Forms use react-hook-form + zod — validation schemas live in `lib/validations/` and are shared between client and server
- UI components live in `components/ui/` (shadcn primitives) — customize to match `12_internal_component_specs.md`, never use defaults without verification
- Animations use Motion with shared variants from `lib/animations.ts` — durations follow design tokens (fast: 150ms, normal: 250ms, slow: 350ms)
- URL-persisted state (filters, pagination, tabs) uses nuqs — not React state or localStorage
- Toast notifications use Sonner — success after mutations, error on failures, promise for async operations

## T3 Env Canonical Schema

Configure during Phase 4. This is the canonical environment variable schema — add or remove variables based on the project's tech stack.

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // Auth (Auth.js / NextAuth v5)
    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.string().url().optional(), // auto-detected on Vercel

    // OAuth providers (include only those configured)
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),

    // Billing (include if Stripe is used)
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

    // Email (include if Resend is used)
    RESEND_API_KEY: z.string().startsWith("re_"),
    EMAIL_FROM: z.string().email().default("noreply@example.com"),

    // Observability (include if Sentry is used)
    SENTRY_DSN: z.string().url().optional(),

    // Rate limiting (include if Upstash is used)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // App
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    // Public keys exposed to the browser (NEXT_PUBLIC_ prefix)
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SENTRY_DSN: process.env.SENTRY_DSN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
})
```

### Rules

1. **All env access goes through `env`** — never use `process.env` directly in application code.
2. **Mark optional vars as `.optional()`** — only vars required by every deployment are non-optional.
3. **Use `.startsWith()` for prefixed keys** — catches misconfigs early (wrong Stripe key type, etc.).
4. **Create `.env.example`** — list every variable with placeholder values. Never commit `.env`.
5. **Adapt to the project** — remove OAuth providers, Stripe, Resend, Upstash, or Sentry lines if the project doesn't use them. Add project-specific vars as needed.

---

## Date and Time Conventions

### Storage

- **Always store in UTC** — all `DateTime` fields in Prisma are UTC by default. Never store local times.
- **Use `DateTime` type in Prisma** — not `String` or `Int` timestamps.

### Display

```typescript
// src/lib/format.ts
import { formatDistanceToNow, format, isToday, isYesterday, isThisYear } from "date-fns"

/**
 * Smart date formatting:
 * - Under 1 hour: "5 minutes ago"
 * - Today: "Today at 2:30 PM"
 * - Yesterday: "Yesterday at 2:30 PM"
 * - This year: "Mar 15 at 2:30 PM"
 * - Older: "Mar 15, 2025"
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()

  if (diffMs < 60 * 60 * 1000) {
    return formatDistanceToNow(d, { addSuffix: true })
  }
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`
  if (isYesterday(d)) return `Yesterday at ${format(d, "h:mm a")}`
  if (isThisYear(d)) return format(d, "MMM d 'at' h:mm a")
  return format(d, "MMM d, yyyy")
}

/**
 * Absolute date for tables and exports.
 */
export function formatDateAbsolute(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy")
}

/**
 * Date + time for audit logs and detailed views.
 */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a")
}
```

### Rules

1. **Relative for recent, absolute for old** — matches `13_internal_data_display_rules.md` metric formatting rules.
2. **No timezone conversion in v1** — display in the browser's local timezone (JavaScript `Date` does this automatically). Add explicit timezone support in a later phase if needed.
3. **Import specific functions** — `import { format } from "date-fns"` not `import * as dateFns`.
4. **Use `<time>` element in HTML** — `<time dateTime={date.toISOString()}>5 minutes ago</time>` for accessibility and SEO.
5. **Server-rendered dates** — use absolute format to avoid hydration mismatch (server and client may be in different timezones). Switch to relative format on the client after hydration if needed.

---

## API Response Format

All API routes and server actions must use a consistent response shape. This is the framework default — the pattern snapshot captures whatever the project actually uses.

### Success Responses

```typescript
// Single entity
return Response.json({ data: project }, { status: 200 })

// List with pagination
return Response.json({
  data: projects,
  pagination: { page, pageSize, total, totalPages },
}, { status: 200 })

// Mutation success
return Response.json({ data: createdProject }, { status: 201 })

// Delete (no body)
return new Response(null, { status: 204 })
```

### Error Responses

```typescript
// Validation error (422)
return Response.json({
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input",
    fields: { email: "Email already in use", name: "Name is required" },
  },
}, { status: 422 })

// Auth error (401)
return Response.json({
  error: { code: "UNAUTHORIZED", message: "Session expired" },
}, { status: 401 })

// Permission error (403)
return Response.json({
  error: { code: "FORBIDDEN", message: "Insufficient permissions" },
}, { status: 403 })

// Not found (404)
return Response.json({
  error: { code: "NOT_FOUND", message: "Project not found" },
}, { status: 404 })

// Server error (500)
return Response.json({
  error: { code: "INTERNAL_ERROR", message: "Something went wrong", referenceId },
}, { status: 500 })
```

### Response Type Definitions

```typescript
// src/lib/api/types.ts
type ApiSuccess<T> = { data: T; pagination?: PaginationMeta }
type ApiError = { error: { code: string; message: string; fields?: Record<string, string> } }
type ApiResponse<T> = ApiSuccess<T> | ApiError

type PaginationMeta = { page: number; pageSize: number; total: number; totalPages: number }
```

### Rules

1. **Always wrap data in `{ data: ... }`** — never return a raw array or object at the top level.
2. **Always wrap errors in `{ error: { code, message } }`** — never return `{ message }` without a code.
3. **Use `fields` for validation errors** — maps field names to error messages, consumed by forms.
4. **Use HTTP status codes correctly** — 200 (success), 201 (created), 204 (deleted), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 422 (validation), 429 (rate limit), 500 (server error).
5. **Never expose stack traces, SQL errors, or internal details** in error responses.

---

## API Route Error Handler

Every API route needs the same try/catch boilerplate. Extract it into a shared wrapper:

```typescript
// src/lib/api/handler.ts
import { ZodError } from "zod"
import { AuthorizationError } from "@/lib/auth/authorize"
import { Prisma } from "@prisma/client"
import { logger } from "@/lib/logger"
import { nanoid } from "nanoid"

type ApiHandler = (req: Request, context?: { params: Record<string, string> }) => Promise<Response>

/**
 * Wraps an API route handler with standard error handling.
 * Maps known error types to the correct HTTP status and response shape.
 */
export function apiHandler(handler: ApiHandler): ApiHandler {
  return async (req, context) => {
    try {
      return await handler(req, context)
    } catch (error) {
      // Validation errors (zod)
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {}
        error.errors.forEach((e) => {
          const path = e.path.join(".")
          if (path) fields[path] = e.message
        })
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid input", fields } },
          { status: 422 }
        )
      }

      // Authorization errors
      if (error instanceof AuthorizationError) {
        return Response.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 }
        )
      }

      // Auth errors (requireOrganization throws plain Error)
      if (error instanceof Error && error.message === "Unauthorized") {
        return Response.json(
          { error: { code: "UNAUTHORIZED", message: "Session expired" } },
          { status: 401 }
        )
      }

      if (error instanceof Error && error.message === "No active membership") {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "No active organization membership" } },
          { status: 403 }
        )
      }

      // Prisma known errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return Response.json(
            { error: { code: "CONFLICT", message: "A record with this value already exists" } },
            { status: 409 }
          )
        }
        if (error.code === "P2025") {
          return Response.json(
            { error: { code: "NOT_FOUND", message: "Record not found" } },
            { status: 404 }
          )
        }
      }

      // Unknown errors — log and return 500 with reference ID
      const referenceId = nanoid(10)
      logger.error("api.unhandled_error", {
        referenceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        method: req.method,
        url: req.url,
      })

      return Response.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong", referenceId } },
        { status: 500 }
      )
    }
  }
}
```

### Usage in API Routes

```typescript
// src/app/api/projects/route.ts
import { apiHandler } from "@/lib/api/handler"
import { requireOrganization } from "@/lib/auth/scope"
import { authorize } from "@/lib/auth/authorize"
import { prisma } from "@/lib/db"

export const GET = apiHandler(async (req) => {
  const { organizationId, role } = await requireOrganization()
  authorize(role, "projects", "read")

  const projects = await prisma.project.findMany({
    where: { organizationId },
  })

  return Response.json({ data: projects })
})

export const POST = apiHandler(async (req) => {
  const { userId, organizationId, role } = await requireOrganization()
  authorize(role, "projects", "create")

  const body = createProjectSchema.parse(await req.json())
  const project = await prisma.project.create({
    data: { ...body, organizationId, createdBy: userId },
  })

  return Response.json({ data: project }, { status: 201 })
})
```

### Rules

1. **Wrap every API route** — `export const GET = apiHandler(...)`, never raw async functions.
2. **Don't catch errors inside the handler** — let them propagate to the wrapper.
3. **Add new error types to the wrapper** as the project grows (e.g., `StripeError`, `RateLimitError`).
4. **The wrapper handles logging** — individual routes don't need to log errors.

---

## Pagination Utility

Shared helpers for parsing pagination params and generating response metadata.

```typescript
// src/lib/api/pagination.ts
import { z } from "zod"

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export type PaginationParams = z.infer<typeof paginationSchema>
export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Parse page + pageSize from URL search params.
 * Returns validated values with defaults (page=1, pageSize=25).
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  return paginationSchema.parse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  })
}

/**
 * Convert pagination params to Prisma skip/take.
 */
export function toPrismaArgs(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  }
}

/**
 * Build pagination meta from total count and params.
 */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize),
  }
}
```

### Usage in API Routes

```typescript
export const GET = apiHandler(async (req) => {
  const { organizationId, role } = await requireOrganization()
  authorize(role, "projects", "read")

  const url = new URL(req.url)
  const pagination = parsePagination(url.searchParams)

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where: { organizationId },
      ...toPrismaArgs(pagination),
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.count({ where: { organizationId } }),
  ])

  return Response.json({
    data: projects,
    pagination: buildPaginationMeta(total, pagination),
  })
})
```

### Rules

1. **Default page size is 25** — matches `13_internal_data_display_rules.md`.
2. **Max page size is 100** — prevents abuse.
3. **Use `$transaction` for count + findMany** — ensures consistent total.
4. **Always return pagination meta** — the client needs it for the pagination UI.

---

## Next.js App Router File Conventions

### When to Use `loading.tsx`

Use `loading.tsx` for **full-page loading states** — when the entire page content depends on async data.

```typescript
// src/app/(authenticated)/projects/loading.tsx
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectsLoading() {
  return (
    <>
      <PageHeader title="Projects" />
      <div className="p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </>
  )
}
```

### When to Use `<Suspense>` Boundaries

Use inline `<Suspense>` when **parts of the page load independently**:

```typescript
// Page renders immediately with header; table streams in
export default function ProjectsPage() {
  return (
    <>
      <PageHeader title="Projects" action={<CreateButton />} />
      <Suspense fallback={<ProjectTableSkeleton />}>
        <ProjectTable />
      </Suspense>
      <Suspense fallback={<ActivityFeedSkeleton />}>
        <RecentActivity />
      </Suspense>
    </>
  )
}
```

### Decision Rule

| Scenario | Use |
|----------|-----|
| Entire page depends on one data fetch | `loading.tsx` |
| Page has multiple independent async sections | `<Suspense>` per section |
| Dashboard with stats + table + feed | `<Suspense>` per section (they load independently) |
| Detail page loading a single entity | `loading.tsx` |

### `error.tsx` Convention

Every route segment that fetches data should have an `error.tsx`:

```typescript
// src/app/(authenticated)/projects/error.tsx
"use client"
import { ErrorBlock } from "@/components/ui/error-block"

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorBlock
      title="Failed to load projects"
      message="Something went wrong. Try refreshing."
      onRetry={reset}
    />
  )
}
```

### Rules

1. **`loading.tsx` must match the page layout** — include the PageHeader, skeleton rows matching real content shape.
2. **`error.tsx` is always `"use client"`** — Next.js requirement.
3. **`error.tsx` preserves the shell** — only the content area shows the error, sidebar/topbar remain functional.
4. **Don't use `loading.tsx` + `<Suspense>` on the same page** — if you need granular loading, use Suspense only.

---

## Server Action Pattern

The canonical end-to-end pattern for form submissions using next-safe-action + react-hook-form + zod + Sonner.

### Step 1: Shared Validation Schema

```typescript
// src/lib/validations/project.ts
import { z } from "zod"

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
```

### Step 2: Server Action

```typescript
// src/app/(authenticated)/projects/actions.ts
"use server"
import { createSafeActionClient } from "next-safe-action"
import { createProjectSchema } from "@/lib/validations/project"
import { requireOrganization } from "@/lib/auth/scope"
import { authorize } from "@/lib/auth/authorize"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"

const action = createSafeActionClient()

export const createProject = action
  .schema(createProjectSchema)
  .action(async ({ parsedInput }) => {
    const { userId, organizationId, role } = await requireOrganization()
    authorize(role, "projects", "create")

    const project = await prisma.project.create({
      data: {
        ...parsedInput,
        organizationId,
        createdBy: userId,
      },
    })

    logger.info("feature.project.created", { userId, organizationId, projectId: project.id })
    return { data: project }
  })
```

### Step 3: Client Form Component

```typescript
// src/app/(authenticated)/projects/components/create-project-form.tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { createProjectSchema, type CreateProjectInput } from "@/lib/validations/project"
import { createProject } from "../actions"

export function CreateProjectForm({ onSuccess }: { onSuccess?: () => void }) {
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  })

  const { execute, isExecuting } = useAction(createProject, {
    onSuccess: () => {
      toast.success("Project created")
      form.reset()
      onSuccess?.()
    },
    onError: ({ error }) => {
      if (error.validationErrors) {
        // Map server field errors to form
        Object.entries(error.validationErrors).forEach(([field, message]) => {
          form.setError(field as keyof CreateProjectInput, { message: String(message) })
        })
      } else {
        toast.error(error.serverError ?? "Failed to create project")
      }
    },
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))}>
      {/* Form fields with react-hook-form register + inline errors */}
      <button type="submit" disabled={isExecuting}>
        {isExecuting ? "Creating..." : "Create Project"}
      </button>
    </form>
  )
}
```

### Pattern Rules

1. **Zod schema is the single source of truth** — shared between client (react-hook-form resolver) and server (next-safe-action schema).
2. **Server action handles auth + permissions** — never trust the client.
3. **Client maps server errors back to form fields** — validation errors are inline, other errors are toasts.
4. **Disable submit while executing** — prevent double submission.
5. **Toast on success** — always confirm mutations to the user.
6. **Log on success** — use the structured logger for audit trail.

---

## Tanstack Query Conventions

Tanstack Query manages server state for client components. Server Components should fetch data directly (no Tanstack Query needed). Use Tanstack Query when:
- A client component needs to fetch/refetch data
- Optimistic updates are needed
- Polling or real-time refresh is needed
- Cache sharing between components matters

### Query Key Convention

Query keys are arrays, structured from general to specific:

```typescript
// Convention: [entity, scope, filters]
const queryKeys = {
  projects: {
    all:    (orgId: string) => ["projects", orgId] as const,
    list:   (orgId: string, filters: ProjectFilters) => ["projects", orgId, "list", filters] as const,
    detail: (orgId: string, id: string) => ["projects", orgId, id] as const,
  },
  members: {
    all:    (orgId: string) => ["members", orgId] as const,
    list:   (orgId: string) => ["members", orgId, "list"] as const,
  },
  dashboard: {
    stats:  (orgId: string) => ["dashboard", orgId, "stats"] as const,
  },
}
```

Store query key factories in `src/lib/query-keys.ts`. Never use inline string keys.

### Fetcher Pattern

```typescript
// src/lib/api/client.ts
async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error?.message ?? "Request failed")
  }
  const json = await res.json()
  return json.data
}
```

### Query Usage

```typescript
function useProjects(orgId: string, filters: ProjectFilters) {
  return useQuery({
    queryKey: queryKeys.projects.list(orgId, filters),
    queryFn: () => fetchApi<Project[]>(`/api/projects?${toSearchParams(filters)}`),
  })
}
```

### Mutation with Cache Invalidation

```typescript
function useCreateProject(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProjectInput) =>
      fetchApi<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      // Invalidate the list (refetches in background)
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(orgId) })
      toast.success("Project created")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}
```

### Optimistic Updates (When Needed)

Use for high-frequency actions where instant feedback matters (toggling status, reordering):

```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, (old) => /* apply optimistic update */)
  return { previous }
},
onError: (_err, _vars, context) => {
  queryClient.setQueryData(queryKey, context?.previous) // rollback
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey }) // refetch truth
},
```

### When NOT to Use Tanstack Query

| Scenario | Use Instead |
|----------|------------|
| Server Component data fetch | `async` function in the component |
| Form submission | next-safe-action (see Server Action Pattern above) |
| URL state (filters, pagination) | nuqs |
| Auth session | Auth.js `useSession` |
| Theme state | next-themes `useTheme` |

---

## Quality Gates

Before marking any build phase complete:

1. All pages in the phase handle loading, empty, success, and error states
2. All pages are mobile responsive at 375px
3. Permissions are enforced at middleware, API, and UI layers
4. No TypeScript errors, no console warnings in production build
5. Navigation between pages works correctly (no dead ends, no broken links)

## Recovery

If a quality gate fails during regression testing, or an error from a completed phase is discovered during a later phase, consult `24_error_recovery.md` for the recovery protocol. Do not proceed to the next phase until all regressions are resolved. Do not silently fix and move on — announce the issue, diagnose the scope, and follow the appropriate recovery tier.

## Final Principle

The framework exists to reduce ambiguity, reduce drift, and reduce bugs. Build inside it first. Extend it only when the product actually requires extension.
