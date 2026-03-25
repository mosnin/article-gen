# Pattern Snapshot — ArticleGen

<!-- Metadata -->
- **Last updated**: Phase 7 (App Shell)
- **Version**: 1
- **Project**: ArticleGen
- **Framework**: Modaf v1

> Read this file before writing any code in Phase 8+. Follow established conventions exactly.

---

## A. Project Structure

```
src/
├── app/
│   ├── api/                          # Next.js API routes (server-side only)
│   │   ├── admin/                    # Admin-only endpoints (credits, users)
│   │   ├── articles/                 # Article scheduling
│   │   ├── credits/                  # Credit check, deduct, balance
│   │   ├── generate/                 # AI generation pipeline (research, metadata, article, images, cluster, ideas)
│   │   ├── gsc/                      # Google Search Console OAuth + queries
│   │   ├── onboarding/               # Onboarding status + complete
│   │   ├── publish-logs/             # Publishing history
│   │   ├── settings/                 # User settings CRUD
│   │   ├── stripe/                   # Checkout, portal, webhook
│   │   └── [platform]/publish/       # Per-platform publish: wordpress, devto, medium, ghost, shopify
│   ├── app/                          # Authenticated app pages (protected by middleware + layout auth check)
│   │   ├── layout.tsx                # App shell: sidebar + topbar + Toaster
│   │   ├── page.tsx                  # Dashboard (stats, recent articles, clusters)
│   │   ├── generate/page.tsx         # Article generation UI (single, batch, cluster modes)
│   │   ├── onboarding/page.tsx       # 3-step onboarding wizard (bare layout, no shell)
│   │   ├── settings/page.tsx         # Settings (general, WordPress, platforms, presets, GSC)
│   │   ├── billing/page.tsx          # Billing + plan management
│   │   ├── admin/page.tsx            # Admin panel (users, credits) — admin role only
│   │   ├── publish/[id]/page.tsx     # Individual article publish flow
│   │   ├── types.ts                  # Shared TypeScript types for app layer
│   │   └── components/               # Legacy app-specific components (ClusterView, ArticleResultPanel, etc.)
│   ├── auth/callback/route.ts        # Supabase OAuth callback handler
│   ├── layout.tsx                    # Root layout (html, body, globals.css)
│   ├── page.tsx                      # Public landing page (marketing + auth modal)
│   └── globals.css                   # Design tokens + Tailwind base + animations
├── components/
│   ├── layout/                       # Shell components (used in app/layout.tsx only)
│   │   ├── sidebar.tsx               # Desktop persistent sidebar + mobile drawer
│   │   ├── topbar.tsx                # Mobile topbar with hamburger menu
│   │   └── page-header.tsx           # Page-level title + description + actions
│   └── ui/                           # Reusable UI primitives
│       ├── button.tsx                # Button with variants (default, outline, ghost, etc.) + loading state
│       ├── badge.tsx                 # Badge with variants (default, success, warning, error, neutral)
│       ├── card.tsx                  # Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
│       ├── input.tsx                 # Input with error state
│       ├── textarea.tsx              # Textarea with error state
│       ├── label.tsx                 # Form label
│       ├── skeleton.tsx              # Loading skeleton (shimmer animation via .skeleton class)
│       └── separator.tsx             # Horizontal/vertical divider
├── lib/
│   ├── utils.ts                      # cn() helper (tailwind-merge + clsx)
│   ├── supabase-browser.ts           # Supabase client for "use client" components
│   ├── supabase-server.ts            # Supabase client for API routes (server-side)
│   ├── supabase-admin.ts             # Supabase service role client (admin routes only)
│   ├── credits.ts                    # getOrCreateProfile(), deductCredits(), checkCredits()
│   ├── stripe.ts                     # Stripe client + plan definitions
│   ├── publish-platforms.ts          # Platform publish logic
│   ├── publish-log.ts                # logPublish() helper
│   ├── rate-limit.ts                 # Rate limiting utilities
│   ├── gsc-auth.ts                   # Google Search Console OAuth helpers
│   └── wp-crypto.ts                  # WordPress credential encryption
└── middleware.ts                     # Auth guard: redirects unauthenticated users from /app/* to /
```

---

## B. Import Path Map

```typescript
// Auth / Database
import { createClient } from "@/lib/supabase-browser";      // Client components
import { createClient } from "@/lib/supabase-server";        // API routes
import { createAdminClient } from "@/lib/supabase-admin";    // Admin API routes only
import { getOrCreateProfile } from "@/lib/credits";

// UI Components — primitives
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Shell components
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";

// Utilities
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// Types
import type { ArticleSession, GenerationResult, TopicCluster } from "@/app/app/types";

// Next.js
import { NextResponse } from "next/server";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
```

---

## C. API Route Pattern

Source file: `src/app/api/credits/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";      // always server client in routes

export async function GET(request: Request) {
  try {
    // 1. AUTHENTICATE — always first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. PARSE / VALIDATE input (for POST routes)
    // const body = await request.json();
    // if (!body.required_field) {
    //   return NextResponse.json({ error: "required_field is required" }, { status: 400 });
    // }

    // 3. CHECK PERMISSIONS (admin routes)
    // const profile = await getOrCreateProfile(supabase, user.id);
    // if (profile.role !== "admin") {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    // 4. DATABASE QUERY — always scoped by user_id via RLS
    const { data, error } = await supabase
      .from("table_name")
      .select("*")
      .eq("user_id", user.id);         // RLS also enforces this, but explicit is clearer

    if (error) throw error;

    // 5. STRUCTURED RESPONSE
    return NextResponse.json({ data, success: true });

  } catch (error: unknown) {
    // 6. ERROR HANDLING — always catch-all at bottom
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Conventions:**
- All routes use `try/catch` with the same error shape: `{ error: string }`
- Success responses include the data directly or as `{ data, success: true }`
- Always `await createClient()` (server client, not browser)
- Always check `user` before anything else → 401 if missing
- Admin routes use `createAdminClient()` or check `profile.role === "admin"`
- `export const dynamic = "force-dynamic"` on routes that read auth session

---

## D. Component Usage Patterns

### Dashboard page (data-fetching client component)
Source file: `src/app/app/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";

export default function PageName() {
  const router = useRouter();
  const supabase = createClient();

  // Loading states — one per data section, not a single global loader
  const [statsLoading, setStatsLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [data, setData] = useState<DataType | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      // Auth check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      // Load data
      try {
        const { data, error } = await supabase.from("table").select("*").eq("user_id", user.id);
        if (error) throw error;
        setData(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setStatsLoading(false);
      }
    };
    init();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Page Title" description="Optional description" />

      {/* LOADING state — skeleton matches target layout */}
      {statsLoading && <Skeleton className="h-32 w-full rounded-xl" />}

      {/* ERROR state */}
      {error && (
        <div className="rounded-lg border border-[var(--border-error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* EMPTY state */}
      {!statsLoading && !error && !data?.length && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">No items yet</p>
          <Button onClick={() => router.push("/app/generate")}>Create first item</Button>
        </div>
      )}

      {/* SUCCESS state */}
      {!statsLoading && !error && data && (
        <div>{/* render data */}</div>
      )}
    </div>
  );
}
```

### Form section pattern (within a settings or setup page)
```tsx
const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState("");
const [saved, setSaved] = useState(false);

const handleSave = async () => {
  setSaving(true);
  setSaveError("");
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    toast.success("Saved");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  } catch (e) {
    setSaveError(e instanceof Error ? e.message : "Save failed");
    toast.error("Failed to save");
  } finally {
    setSaving(false);
  }
};
```

---

## E. Database Query Patterns

**Database**: Supabase (PostgreSQL) with Row Level Security. No Prisma.

```typescript
// Standard read — RLS auto-scopes to user, but always explicit .eq("user_id")
const { data, error } = await supabase
  .from("articles")
  .select("id, title, topic, posted, created_at")  // select only needed columns
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(10);

// Read single row
const { data: settings, error } = await supabase
  .from("user_settings")
  .select("*")
  .eq("user_id", user.id)
  .single();                // returns null if not found (no error for missing row)

// Insert
const { data: newRow, error } = await supabase
  .from("articles")
  .insert({ user_id: user.id, topic, title, article_markdown })
  .select()
  .single();

// Upsert (settings pattern)
const { error } = await supabase
  .from("user_settings")
  .upsert({ user_id: user.id, domain, site_name }, { onConflict: "user_id" });

// Update
const { error } = await supabase
  .from("articles")
  .update({ posted: true })
  .eq("id", articleId)
  .eq("user_id", user.id);   // always scope updates to user_id too

// Error handling
if (error) {
  console.error("DB error:", error.message);
  return NextResponse.json({ error: error.message }, { status: 500 });
}

// Admin client (bypasses RLS — server-side only)
const adminSupabase = createAdminClient();
const { data: allUsers } = await adminSupabase.from("user_profiles").select("*");
```

---

## F. Form Patterns

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Inline validation pattern
function SettingsForm() {
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const [saving, setSaving] = useState(false);

  const validate = () => {
    if (!domain) { setDomainError("Domain is required"); return false; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      setDomainError("Enter a valid domain (e.g. example.com)");
      return false;
    }
    setDomainError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="domain">Domain</Label>
        <Input
          id="domain"
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setDomainError(""); }}
          placeholder="example.com"
          error={!!domainError}
        />
        {domainError && (
          <p className="text-xs text-[var(--error)]">{domainError}</p>
        )}
      </div>
      <Button type="submit" loading={saving}>Save changes</Button>
    </form>
  );
}
```

---

## G. File Naming Conventions

| Convention | Pattern | Example |
|-----------|---------|---------|
| Page files | `page.tsx` (Next.js convention) | `src/app/app/settings/page.tsx` |
| Layout files | `layout.tsx` | `src/app/app/layout.tsx` |
| API route files | `route.ts` | `src/app/api/credits/route.ts` |
| UI components | `PascalCase.tsx` in `kebab-case/` dir | `src/components/ui/button.tsx` exports `Button` |
| Shell components | `kebab-case.tsx` | `src/components/layout/sidebar.tsx` |
| App components | `PascalCase.tsx` | `src/app/app/components/ClusterView.tsx` |
| Lib utilities | `kebab-case.ts` | `src/lib/supabase-browser.ts` |
| Types file | `types.ts` at feature root | `src/app/app/types.ts` |
| Default exports | Pages and layouts use default export | `export default function Page()` |
| Named exports | UI components use named exports | `export { Button }` |
| No barrel exports | Direct imports only | `import { Button } from "@/components/ui/button"` |

---

## H. CSS / Styling Conventions

```tsx
// Use CSS variables for semantic colors — never raw Tailwind color classes for theme colors
className="text-[var(--text-primary)]"          // ✅ correct
className="text-gray-900"                        // ❌ won't work in dark mode

// Use Tailwind for layout and spacing
className="flex items-center gap-3 px-4 py-2"   // ✅ layout via Tailwind
className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]"

// Component composition — use Card + PageHeader for all inner pages
<PageHeader title="..." description="..." actions={<Button>...</Button>} />
<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>

// Four states every data view must have:
// 1. Loading → <Skeleton className="h-N w-N" />
// 2. Error → red bordered box with error message
// 3. Empty → centered icon + message + CTA button
// 4. Success → actual data rendered

// Motion — framer-motion for drawers, modals, overlays only
import { motion, AnimatePresence } from "framer-motion";
// Use simple CSS animation classes for list items and cards:
className="fade-in-up"   // defined in globals.css
```
