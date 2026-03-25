# SaaS Website Page System

> **TL;DR:** Defines the multi-page public website system extending the home page into 13 canonical page types with shared layout rules and navigation consistency.
> **Covers:** product, pricing, solutions, case studies, features, integrations, security, docs, blog, about, contact, legal pages | **Depends on:** saas_home_page_system.md, design_system_tokens.md | **Used by:** public_screen_archetypes.md, sitemap_diagram.md, nextjs_folder_structure.md | **Phase:** 13

## Purpose

Define the multi page public website system that extends the home page into a full SaaS website. Every page must feel like part of the same product, company, and design system.

## Core Principle

The home page establishes the visual language and component rules. All other public facing pages must reuse the same:

- grid
- spacing
- typography
- card logic
- color system
- navigation
- CTA patterns
- footer
- theme behavior

## Canonical Public Site Pages

1. Home
2. Product
3. Pricing
4. Solutions or Use Cases
5. Case Studies
6. Features
7. Integrations
8. Security
9. Documentation or Help Center
10. Blog or Resources
11. About
12. Contact or Demo
13. Legal pages

## Global Public Page Wrapper

Every public page should use:

1. Announcement bar when relevant
2. Header
3. Page hero
4. Core content blocks
5. CTA block
6. Footer

## Product Page

### Purpose

Explain how the product works in depth.

### Recommended Sections

- product hero
- feature overview
- workflow explanation
- integration preview
- security preview
- CTA

### Rules

- explain mechanism clearly
- reuse split section patterns from the home page
- use real product visuals

## Pricing Page

### Purpose

Convert decision ready users.

### Recommended Sections

- pricing hero
- plan cards
- billing toggle
- feature comparison table
- pricing FAQ
- CTA

### Rules

- make tradeoffs visible
- keep plan comparison readable
- support enterprise path if relevant

## Solutions Page

### Purpose

Show how the product helps different roles, industries, or use cases.

### Structure

For each solution:
- problem
- workflow
- product fit
- outcome
- CTA

### Rules

- make the page specific
- avoid generic marketing copy
- keep the same design system as the home page

## Case Studies Page

### Purpose

Build trust through evidence.

### Recommended Structure

- case study hero
- grid of case study summaries
- deeper featured cases
- CTA

## Features Page

### Purpose

Provide an organized catalog of product capabilities.

### Recommended Sections

- hero
- feature grid
- feature deep dives
- CTA

## Integrations Page

### Purpose

Show compatibility and ecosystem fit.

### Recommended Sections

- hero
- integration grid
- categories
- technical notes if needed
- CTA

## Security Page

### Purpose

Reduce risk concerns.

### Recommended Sections

- security hero
- data handling
- infrastructure summary
- access control
- compliance notes
- CTA

## Documentation Or Help Center

### Purpose

Support adoption and reduce friction.

### Rules

- clear navigation
- search if implemented
- predictable structure
- consistent header and footer

## Blog Or Resources

### Purpose

Support authority, SEO, and education.

### Rules

- keep grid and typography consistent
- treat blog cards as first class components
- preserve category logic

## About Page

### Purpose

Establish legitimacy and brand context.

### Recommended Sections

- mission
- company story
- team
- values
- CTA

## Contact Or Demo Page

### Purpose

Capture high intent leads.

### Recommended Elements

- form
- contact info
- calendar booking when relevant
- support routing

## Legal Pages

### Pages

- Privacy Policy
- Terms of Service
- Cookie Policy when relevant
- Security Policy when relevant

### Rules

- use same header and footer
- simplify layout for readability
- support dark and light mode

## Shared Public Site Rules

1. Navigation remains consistent across public pages.
2. Theme behavior remains consistent across public pages.
3. CTA language should remain coherent.
4. Footer remains consistent.
5. Visual rhythm should not change wildly between pages.
6. All pages must be mobile responsive.
7. All pages should load fast.

---

## SEO Requirements

### Per-Page Meta Tags

Every public page must include:

```tsx
export function generateMetadata(): Metadata {
  return {
    title: "Page Title | App Name",
    description: "Concise description under 160 characters",
    openGraph: {
      title: "Page Title | App Name",
      description: "Concise description under 160 characters",
      url: "https://example.com/page",
      siteName: "App Name",
      images: [{ url: "/og/page.png", width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Page Title | App Name",
      description: "Concise description under 160 characters",
      images: ["/og/page.png"],
    },
  }
}
```

### Title Convention

`[Page Name] | [App Name]` for interior pages. Home page: `[App Name] — [Tagline]`.

### Required Meta Per Page

| Page | Title Pattern | Description Focus |
|------|--------------|-------------------|
| Home | `App Name — Tagline` | Primary value prop |
| Pricing | `Pricing | App Name` | Plans and pricing summary |
| Features | `Features | App Name` | Capability overview |
| About | `About | App Name` | Company/team identity |
| Contact | `Contact | App Name` | How to reach the team |
| Blog index | `Blog | App Name` | Content and resources |
| Blog post | `Post Title | App Name` | Post-specific description |
| Legal | `Privacy Policy | App Name` | Legal page type |

### Open Graph Images

- Default OG image: 1200×630px, app name + tagline on branded background
- Per-page OG images when possible (pricing shows plan names, features shows product visual)
- Place in `public/og/` directory
- Use `ImageResponse` from `next/og` for dynamic OG images (blog posts)

### Sitemap

Generate `sitemap.xml` automatically using Next.js metadata API:

```typescript
// src/app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://example.com"
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/features`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    // Blog posts: dynamically fetch from CMS/database
  ]
}
```

### Robots

```typescript
// src/app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/settings/"] },
    ],
    sitemap: "https://example.com/sitemap.xml",
  }
}
```

### Structured Data (JSON-LD)

Add structured data to key pages:

| Page | Schema Type | Data |
|------|------------|------|
| Home | `Organization` + `SoftwareApplication` | Company name, logo, app category |
| Pricing | `Product` with `offers` | Plan names, prices |
| Blog post | `Article` | Title, author, date, description |
| FAQ section | `FAQPage` | Question/answer pairs |

### Technical SEO Checklist

- [ ] All pages have unique `<title>` and `<meta description>`
- [ ] OG images exist for all public pages
- [ ] `sitemap.xml` is generated and submitted
- [ ] `robots.txt` blocks authenticated routes
- [ ] Heading hierarchy is correct (one `<h1>` per page)
- [ ] All images have descriptive `alt` text
- [ ] Canonical URLs are set (Next.js handles this by default)
- [ ] No duplicate content across pages
- [ ] Page load time <3s (per `27_performance.md`)

## Final Principle

A strong SaaS website is not just a home page plus random pages. It is a consistent public product communication system where each page has a clear job in the acquisition, education, and trust building flow.
