# 27 Performance and Core Web Vitals

> **TL;DR:** Defines performance targets, optimization rules, and Core Web Vitals budgets for both the internal product and the marketing site.
> **Covers:** Lighthouse budgets, Core Web Vitals targets, image optimization, bundle size, font loading, server component strategy, caching | **Depends on:** 09, 10, 15 | **Used by:** 13, 14 | **Phase:** 4 (setup), 13 (marketing), 14 (polish)

## Purpose

Performance is a product feature. A slow marketing site kills conversion. A sluggish dashboard kills retention. This file defines what "fast" means in concrete, measurable terms and the rules to get there.

---

## Core Web Vitals Targets

### Marketing Site (Public Pages)

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| LCP (Largest Contentful Paint) | <2.5s | How fast the main content loads |
| INP (Interaction to Next Paint) | <200ms | How fast the page responds to user input |
| CLS (Cumulative Layout Shift) | <0.1 | How much the layout shifts during load |

### Internal Product (Authenticated Pages)

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| LCP | <3.0s | Slightly relaxed — authenticated pages have more data to fetch |
| INP | <200ms | Same standard — interactions must feel instant |
| CLS | <0.1 | Same standard — no layout jumping |

### Lighthouse Scores

| Page Type | Performance | Accessibility | Best Practices | SEO |
|-----------|------------|---------------|---------------|-----|
| Marketing home | >90 | >90 | >90 | >90 |
| Marketing interior | >90 | >90 | >90 | >90 |
| Authenticated dashboard | >70 | >90 | >90 | N/A |
| Authenticated feature | >75 | >90 | >90 | N/A |

---

## Bundle Size Budgets

### JavaScript

| Budget | Target | Measurement |
|--------|--------|-------------|
| First-load JS (marketing) | <100KB gzipped | `next build` output |
| First-load JS (authenticated) | <150KB gzipped | `next build` output |
| Per-route JS | <50KB gzipped | Individual route chunk |
| Total JS (all routes) | <500KB gzipped | Full build output |

### How to Monitor

```bash
# Check bundle sizes after build
npx next build
# Look at the "First Load JS" column in the build output
# Flag any route exceeding the per-route budget
```

### Common Bundle Bloat Sources

| Library | Risk | Mitigation |
|---------|------|------------|
| date-fns | Imports entire library if not tree-shaken | Import specific functions: `import { format } from "date-fns/format"` |
| Recharts | Large chart library | Only import on dashboard routes, use dynamic import |
| Motion (framer-motion) | Moderate size | Use `LazyMotion` with `domAnimation` feature bundle |
| Sentry | Moderate size | Tree-shake unused integrations |
| zod | Small but duplicated | Ensure single instance, not bundled per route |

---

## Image Optimization

### Rules

1. **Always use `next/image`** — never use raw `<img>` tags. Next.js Image handles responsive sizing, format conversion (WebP/AVIF), and lazy loading.

2. **Specify dimensions** — always provide `width` and `height` (or use `fill` with a sized container) to prevent CLS.

3. **Prioritize above-the-fold images** — add `priority` prop to the hero image and any image visible without scrolling.

4. **Use appropriate quality** — default to quality 80. Drop to 60 for decorative/background images.

5. **Size images correctly** — don't serve a 2000px image in a 400px container. Use responsive `sizes` prop:
   ```tsx
   <Image
     src="/feature.png"
     alt="Feature description"
     width={800}
     height={450}
     sizes="(max-width: 768px) 100vw, 50vw"
     quality={80}
   />
   ```

6. **Use SVG for icons and logos** — no raster images for simple graphics.

7. **Lazy load below-fold images** — `next/image` does this by default (no `priority` prop = lazy).

### Format Priority

1. AVIF (best compression, growing support)
2. WebP (wide support, good compression)
3. PNG (only for images requiring transparency with no AVIF/WebP support)
4. JPEG (fallback)

Next.js handles format negotiation automatically.

---

## Font Loading

### Rules

1. **Use `next/font`** — loads fonts with zero layout shift and automatic optimization.

   ```typescript
   import { Inter } from "next/font/google"
   const inter = Inter({ subsets: ["latin"], display: "swap" })
   ```

2. **Subset fonts** — only load the character subsets needed (`latin` for English-first v1).

3. **Use `display: swap`** — shows fallback font immediately, swaps when custom font loads. Prevents invisible text.

4. **Self-host if possible** — `next/font` auto-self-hosts Google Fonts. No external requests.

5. **Limit font weights** — load only the weights the design tokens specify. For the internal product (system font), this is automatic. For the marketing site (Inter), load: 400, 500, 600, 700, 800.

---

## Server Component Strategy

### Default: Server Components

Every component is a Server Component unless it needs interactivity. This is the #1 performance lever in Next.js.

### When to Use Client Components

| Need | Use Client Component? |
|------|----------------------|
| Click handlers, form submission | Yes — `"use client"` |
| useState, useEffect, useRef | Yes |
| Browser APIs (localStorage, window) | Yes |
| Third-party hooks (useForm, useQueryState) | Yes |
| Static display, data fetching | No — keep as Server Component |
| Layout, page wrapper | No |
| Data-driven lists (server-fetched) | No |

### Rules

- Push `"use client"` as deep in the tree as possible. Don't make a page client-side when only a button needs interactivity.
- Extract interactive pieces into small client components, keep the page as a server component.
- Never put `"use client"` on a layout file unless absolutely necessary.

---

## Data Fetching Performance

### Rules

1. **Fetch in Server Components** — data is fetched on the server, HTML is sent to the client. No client-side waterfalls.

2. **Parallel fetches** — use `Promise.all` when multiple independent queries are needed:
   ```typescript
   const [projects, stats] = await Promise.all([
     getProjects(organizationId),
     getDashboardStats(organizationId),
   ])
   ```

3. **Use `loading.tsx`** — every route with data fetching needs a loading state. This enables streaming and Suspense.

4. **Avoid N+1 queries** — use Prisma `include` to eager-load relations instead of fetching in loops.

5. **Cache expensive queries** — use React `cache()` for request-level deduplication:
   ```typescript
   import { cache } from "react"
   export const getCurrentUser = cache(async () => {
     // This runs once per request, even if called multiple times
   })
   ```

6. **Use `unstable_cache` or ISR for public pages** — marketing pages don't need real-time data.

---

## Caching Strategy

| Resource | Cache Method | TTL |
|----------|-------------|-----|
| Marketing pages | ISR or static generation | 60s–3600s |
| Authenticated pages | No cache (real-time data) | None |
| API responses (public) | Cache-Control headers | 60s |
| API responses (authenticated) | No cache | None |
| Static assets (images, fonts, JS) | Immutable | 1 year (hashed filenames) |
| Prisma queries (expensive) | `unstable_cache` or Redis | 60s–300s |

---

## Third-Party Script Rules

1. **No third-party scripts on marketing pages** unless essential (analytics, chat widget).
2. **Load analytics async** — use `next/script` with `strategy="afterInteractive"`.
3. **Never load scripts in `<head>`** — blocks rendering.
4. **Measure impact** — before adding any third-party script, check its size and loading behavior.

---

## Performance Testing

### During Development

```bash
# Run Lighthouse on a local build
npx next build && npx next start
# Open Chrome DevTools > Lighthouse tab
# Test both mobile and desktop
```

### Before Each Deployment

Check the `next build` output for:
- Routes exceeding the per-route JS budget (50KB gzipped)
- First-load JS exceeding the page-type budget
- Any red warnings about large bundles

### Phase 14 Performance Audit

During Phase 14 (Polish), run a full audit:

1. Lighthouse scores on all public pages (mobile + desktop)
2. Core Web Vitals on home page, pricing page, and dashboard
3. Bundle analysis: `npx @next/bundle-analyzer` to find bloat
4. Image audit: check all images use `next/image` with correct sizing
5. Font audit: verify no external font requests, correct weights loaded
6. Third-party script audit: identify and justify every external script

---

## Performance Validation Gate

Add this to `docs/project/custom_gates.md` during Phase 3:

```markdown
### gate:performance-build
**What:** Build completes with acceptable bundle sizes.
```bash
npx next build 2>&1 | grep "First Load JS" | awk '{print $NF}' | while read size; do
  echo "Bundle: $size"
done
```
**Pass:** No route exceeds 150KB first-load JS gzipped.
**Common failure:** Large library imported at route level instead of dynamically.
```

## Final Principle

Performance budgets are not aspirational — they are constraints. If a feature pushes a page over budget, optimize or split before shipping. Users notice slowness before they notice features.
