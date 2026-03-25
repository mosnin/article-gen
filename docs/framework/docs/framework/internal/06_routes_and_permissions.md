# 06 Routes And Permissions

> **TL;DR:** Defines route categories, canonical roles, and the three-layer permission enforcement system (middleware, API, UI) for the application.
> **Covers:** public routes, auth routes, protected routes, admin routes, roles, middleware checks, API-level auth, UI visibility | **Depends on:** 04, 07 | **Used by:** 05, 09, 18 | **Phase:** 3

## Purpose

Define the canonical route system, role visibility logic, and permission rules for the application layer.

## Route Categories

- public routes — accessible without authentication
- auth routes — login, signup, password flows (redirect away if already authenticated)
- protected routes — require authentication and a valid organization membership
- admin routes — require admin or owner role
- error or utility routes — 404, 500, maintenance

## Public Or Auth Routes

Typical routes:

- /login
- /signup
- /forgot-password
- /reset-password
- /verify-email
- /invite/[token]

Auth route behavior:
- Authenticated users visiting /login or /signup are redirected to /dashboard
- /invite/[token] works for both authenticated (join org) and unauthenticated (signup + join) users
- /verify-email accepts a token query parameter and auto-verifies on load

## Protected Routes

Typical routes:

- /dashboard
- /analytics
- /[feature] (product-specific feature routes)
- /integrations
- /api
- /webhooks
- /settings/profile
- /settings/workspace (admin/owner only)
- /settings/billing (admin/owner only)
- /settings/security
- /settings/notifications

Protected route behavior:
- Unauthenticated users are redirected to /login with a `returnTo` query parameter preserving the intended destination
- After successful login, redirect to the `returnTo` URL (default: /dashboard)
- Users without a valid organization membership are redirected to /onboarding or an org-selection page

## Admin Routes

Typical routes:

- /admin
- /admin/users
- /admin/users/[id]
- /admin/billing
- /admin/usage
- /admin/system
- /admin/logs
- /admin/flags

Admin route behavior:
- Non-admin users receive a 403 page (not a 404 — do not pretend the route does not exist for authorized roles)
- Admin sidebar section is only rendered for admin/owner roles
- All admin actions are logged to the Admin Record entity

## Canonical Roles

| Role | Stored in DB | Description | Typical Access |
|------|-------------|-------------|----------------|
| guest | No (conceptual) | Unauthenticated visitor | Public and auth routes only |
| member | Yes (Membership.role) | Standard team member | Dashboard, own data, profile settings |
| manager | Yes (Membership.role) | Team lead (optional) | Member access + team data + analytics |
| admin | Yes (Membership.role) | Organization administrator | Full access except ownership transfer and workspace deletion |
| owner | Yes (Membership.role) | Organization owner (one per org) | Full access including billing, workspace deletion, ownership transfer |

Note: `guest` is not a stored role in the Membership entity. It represents unauthenticated visitors for route categorization purposes. The four stored roles (`member`, `manager`, `admin`, `owner`) match the `role` enum in `07_data_models.md`.

## Middleware Pattern

Next.js uses a single `middleware.ts` file at the project root. All route protection logic is composed here.

### Canonical Middleware

```typescript
// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/pricing", "/about", "/contact", "/legal"]
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"]
const API_PUBLIC_ROUTES = ["/api/health", "/api/webhooks"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Public routes — always allow
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next()
  }

  // 2. Public API routes (webhooks, health) — always allow
  if (API_PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // 3. Get session
  const session = await auth()

  // 4. Auth routes — redirect to dashboard if already authenticated
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session?.user) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  // 5. All remaining routes require authentication
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("returnTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 6. Admin routes — check role
  if (pathname.startsWith("/admin")) {
    const role = session.user.role
    if (role !== "admin" && role !== "owner") {
      return NextResponse.rewrite(new URL("/403", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### Middleware Rules

1. **Single file** — Next.js app router supports only one `middleware.ts`. Do not try to create multiple.
2. **No database queries in middleware** — middleware runs on the edge. Use the session token for role checks. Detailed permission checks happen at the API layer (Layer 2).
3. **Redirect vs rewrite** — redirect for auth flows (changes URL), rewrite for error pages (preserves URL).
4. **`returnTo` parameter** — always preserve the intended destination when redirecting to login.
5. **Order matters** — check public routes first (fast path), then auth routes, then protected routes.
6. **Invite routes** — `/invite/[token]` must work for both authenticated and unauthenticated users. Add it to a separate list that skips the auth redirect but still resolves the session.

---

## Permission Enforcement Layers

### Layer 1: Middleware (Route Level)

Check authentication and role before the page renders. This is the first line of defense.

- Verify session/token exists and is valid
- Verify user has an active membership in the current organization
- Verify user role meets the minimum required for the route
- Redirect or return 403 as appropriate

### Layer 2: API (Data Level)

Every API endpoint and Server Action must independently verify permissions. Never trust that the UI prevented unauthorized access.

- Validate session on every request
- Filter data by organization_id (multi-tenancy isolation)
- Check role for write operations (create, update, delete)
- For "own" access level, filter by user_id

### Layer 3: UI (Visibility Level)

Hide navigation items, buttons, and actions the user cannot perform. This is a UX convenience, not a security boundary.

- Sidebar links are filtered by role
- Action buttons (edit, delete, admin actions) are conditionally rendered
- Read-only views hide form controls and show data in display mode
- Never use `disabled` for unauthorized actions — hide them entirely

## Access Rules

1. Public pages redirect authenticated users away when appropriate.
2. Protected pages require authentication and org membership.
3. Admin pages require admin or owner role.
4. Module pages require both feature availability (is the module enabled for this org) and role-based permission.
5. Settings sub-pages have individual permission requirements (profile = all, workspace/billing = admin+).

---

## Multi-Tenancy Data Isolation

Every query in a multi-tenant app must be scoped to the current organization. This is the most common source of data leakage bugs. Never rely on the UI to prevent cross-tenant access.

### Organization-Scoped Query Helper

Create a shared query helper at `src/lib/auth/scope.ts` during Phase 4:

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * Returns the current session's organizationId.
 * Throws if not authenticated or no active membership.
 * Use this in every API route and server action.
 */
export async function requireOrganization() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      status: "active",
    },
    select: {
      organizationId: true,
      role: true,
    },
  })

  if (!membership) {
    throw new Error("No active membership")
  }

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  }
}
```

### Scoping Rules

| Query Type | Required Filter | Example |
|-----------|----------------|---------|
| List (index) | `WHERE organizationId = ?` | `prisma.project.findMany({ where: { organizationId } })` |
| Detail (show) | `WHERE id = ? AND organizationId = ?` | `prisma.project.findFirst({ where: { id, organizationId } })` |
| Create | Set `organizationId` on insert | `prisma.project.create({ data: { ...input, organizationId } })` |
| Update | `WHERE id = ? AND organizationId = ?` | `prisma.project.update({ where: { id, organizationId }, data })` |
| Delete | `WHERE id = ? AND organizationId = ?` | `prisma.project.delete({ where: { id, organizationId } })` |

**Critical rule:** Never query by entity `id` alone without also filtering by `organizationId`. A user could guess or enumerate IDs to access another organization's data.

### "Own Data" Scoping

For member-level users who should only see their own data (not all org data), add a secondary filter:

```typescript
const where = {
  organizationId,
  ...(role === "member" ? { createdBy: userId } : {}),
}
```

Managers, admins, and owners see all org data. Members see only their own. This pattern must match the permissions matrix in `docs/project/06_permissions_matrix.md`.

### API Route Pattern

Every API route handler should follow this structure:

```typescript
export async function GET(req: Request) {
  // 1. Authenticate and get org scope
  const { userId, organizationId, role } = await requireOrganization()

  // 2. Authorize (check role has permission for this action)
  authorize(role, "projects", "read")

  // 3. Query with org scope (NEVER without organizationId)
  const projects = await prisma.project.findMany({
    where: { organizationId },
  })

  return Response.json(projects)
}
```

---

## Permission Enforcement Patterns

### `authorize()` Helper

Create a shared authorization helper at `src/lib/auth/authorize.ts` during Phase 5:

```typescript
import type { Role } from "@prisma/client"

/**
 * Permission matrix: resource → action → minimum role required.
 * Populated from docs/project/06_permissions_matrix.md during Phase 5.
 */
const PERMISSIONS: Record<string, Record<string, Role[]>> = {
  // Example — replaced with real permissions from project docs:
  dashboard:    { read: ["member", "manager", "admin", "owner"] },
  analytics:    { read: ["manager", "admin", "owner"] },
  projects:     { read: ["member", "manager", "admin", "owner"],
                  create: ["member", "manager", "admin", "owner"],
                  update: ["manager", "admin", "owner"],
                  delete: ["admin", "owner"] },
  settings:     { read: ["admin", "owner"],
                  update: ["admin", "owner"] },
  billing:      { read: ["admin", "owner"],
                  update: ["owner"] },
  admin:        { read: ["admin", "owner"] },
}

/**
 * Throws 403 if the role doesn't have permission.
 * Call after requireOrganization() in every API route.
 */
export function authorize(
  role: Role,
  resource: string,
  action: string
): void {
  const resourcePerms = PERMISSIONS[resource]
  if (!resourcePerms) {
    throw new AuthorizationError(`Unknown resource: ${resource}`)
  }

  const allowedRoles = resourcePerms[action]
  if (!allowedRoles || !allowedRoles.includes(role)) {
    throw new AuthorizationError(
      `Role '${role}' cannot '${action}' on '${resource}'`
    )
  }
}

export class AuthorizationError extends Error {
  public readonly status = 403
  constructor(message: string) {
    super(message)
    this.name = "AuthorizationError"
  }
}
```

### UI Permission Hook

Create a client-side hook for conditional rendering:

```typescript
// src/hooks/use-permissions.ts
"use client"
import { useSession } from "@/lib/auth/client"

export function usePermission(resource: string, action: string): boolean {
  const { role } = useSession()
  // Mirror the same PERMISSIONS map (import from shared location)
  return checkPermission(role, resource, action)
}

// Usage in components:
// const canDelete = usePermission("projects", "delete")
// {canDelete && <DeleteButton />}
```

### Permission Rules

1. **Always enforce at API layer** — the UI hook is for UX convenience, not security.
2. **Deny by default** — if a resource/action pair isn't in the PERMISSIONS map, deny access.
3. **Populate from project docs** — the PERMISSIONS map must match `docs/project/06_permissions_matrix.md` exactly. If they diverge, the code is wrong.
4. **Log authorization failures** — use the logger from `26_observability.md` to track 403s for security monitoring.
5. **Test permission boundaries** — every API route test should include a "wrong role gets 403" case.

## Final Principle

Permissions must be enforced in both routing and UI visibility. Hiding a button is not real access control. Every layer assumes the other layers might fail. Every query assumes the caller might be in the wrong organization.
