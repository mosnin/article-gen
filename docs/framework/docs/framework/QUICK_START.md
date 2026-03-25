# Quick Start

> Fast reference for navigating the framework. Use this when you know what you need to do but not which files to read.

## Which Phase Am I In?

Check in this order:

```
docs/project/ doesn't exist?           → Phase 0 (Welcome)
docs/project/ has < 9 files?           → Phase 2 (Generate Project Docs)
docs/project/ complete, no src/?       → Phase 3 (Architecture Plan)
No Prisma schema or only boilerplate?  → Phase 4 (Foundation)
No auth routes?                        → Phase 5 (Auth)
No onboarding flow?                    → Phase 6 (Onboarding)
No app shell (sidebar, topbar)?        → Phase 7 (App Shell)
No dashboard?                          → Phase 8 (Dashboard)
Core features incomplete?              → Phase 9 (Core Features)
No settings/billing?                   → Phase 10 (Settings & Billing)
No admin panel?                        → Phase 11 (Admin)
No email templates?                    → Phase 12 (Email)
No marketing site?                     → Phase 13 (Marketing Site)
Everything exists?                     → Phase 14 (Polish)
```

## I Need To Build... (Task → Files)

### An API endpoint
| Read | Why |
|------|-----|
| `09` — API Response Format section | Standard `{ data }` / `{ error }` shape |
| `09` — API Route Error Handler section | `apiHandler()` wrapper |
| `09` — Pagination Utility section | If the endpoint returns a list |
| `06` — Middleware Pattern | Route-level auth |
| `06` — `requireOrganization()` + `authorize()` | Data-level auth |

### A form / mutation
| Read | Why |
|------|-----|
| `09` — Server Action Pattern section | End-to-end: zod → next-safe-action → react-hook-form → toast |
| `08` — Form component | Layout, validation, submit behavior |
| `12` — Form Field specs | Visual specs for inputs, selects, textareas |
| `17` — Error Display Decision Tree | Inline errors vs toasts vs banners |

### A data table / list page
| Read | Why |
|------|-----|
| `13` — Cards vs Tables | Which display pattern to use |
| `13` — Metric Formatting | Number, currency, date, percentage formatting |
| `13` — Pagination, Filters | Filter bar structure, pagination rules |
| `08` — Table component | Sorting, row actions, mobile card collapse |
| `12` — Table specs | Column padding, header styling, row height |
| `09` — Pagination Utility | `parsePagination()` + `toPrismaArgs()` |
| `09` — Tanstack Query section | Query keys, cache invalidation |

### A dashboard
| Read | Why |
|------|-----|
| `03` — Dashboard System | Anatomy, purpose, required states |
| `16` — Dashboard Archetypes | 7 concrete patterns to choose from |
| `13` — Data Display Rules | Charts vs numbers vs tables |
| `pattern_snapshot.md` | Established conventions (Phase 8+) |

### A detail / edit page
| Read | Why |
|------|-----|
| `11` — Screen Archetypes | Detail view, edit form, split view patterns |
| `08` — UI components | Card, form, modal, tabs behavior |
| `12` — Component specs | Visual specs for all components used |

### Settings or billing
| Read | Why |
|------|-----|
| `05` — Settings, Billing, Admin | Complete spec for all settings pages, Stripe integration, webhook handling |

### An email template
| Read | Why |
|------|-----|
| `14` — Email System | 4 categories, structure rules, CTA specs, dark mode, testing |

### A marketing / public page
| Read | Why |
|------|-----|
| `website/saas_home_page_system.md` | Home page (14-section conversion funnel) |
| `website/saas_website_page_system.md` | Other pages (pricing, features, about, etc.) |
| `website/design_system_tokens.md` | Public site visual tokens |
| `website/public_screen_archetypes.md` | 13 page patterns |
| `website/public_component_specs.md` | Component visual specs |
| `website/public_copy_conversion_rules.md` | Copy, CTA, conversion rules |

### Error handling
| Read | Why |
|------|-----|
| `17` — Error State Taxonomy | 12 error types with exact UI treatment |
| `17` — Error Display Decision Tree | Which component for which error context |
| `09` — API Route Error Handler | Server-side error mapping |

### Auth / permissions
| Read | Why |
|------|-----|
| `02` — Section A | Auth routes, login/signup flows |
| `06` — Routes and Permissions | Roles, 3 enforcement layers, middleware |
| `06` — `requireOrganization()` | Org-scoped session helper |
| `06` — `authorize()` | Role-based permission check |

---

## Files by Category

### Auth & Access Control
| File | What It Covers |
|------|---------------|
| `02` | Auth routes, login/signup, invite, onboarding |
| `06` | Route categories, roles, middleware, permission helpers |

### UI & Visual System
| File | What It Covers |
|------|---------------|
| `01` | App shell structure (sidebar, topbar, drawer) |
| `08` | 20 component behaviors (cards, tables, forms, modals, etc.) |
| `10` | Design tokens (colors, spacing, typography, shadows) |
| `11` | 11 screen archetypes (page-level patterns) |
| `12` | 27 component visual specs (padding, colors, states) |
| `13` | Data display rules (tables vs cards, metric formatting) |
| `15` | 6 responsive breakpoints |
| `16` | 7 dashboard archetypes |

### Code Patterns & Build Rules
| File | What It Covers |
|------|---------------|
| `09` | Build phases, coding standards, API patterns, server actions, Tanstack Query, pagination, T3 Env, date/time, App Router conventions |
| `22` | Pattern snapshot system (prevents drift across phases) |

### Data & Entities
| File | What It Covers |
|------|---------------|
| `07` | 9 core entities, Prisma schema conventions, extension pattern |

### Features & Modules
| File | What It Covers |
|------|---------------|
| `04` | 8 optional modules (analytics, integrations, API, etc.) |
| `05` | Settings, Stripe billing, admin panel |
| `14` | Email template system |

### Quality & Validation
| File | What It Covers |
|------|---------------|
| `17` | Error taxonomy + display decision tree |
| `18` | Testing strategy (unit, integration, E2E) |
| `21` | 46 validation gates (per-phase structural checks) |
| `28` | WCAG 2.1 AA accessibility requirements |

### Infrastructure
| File | What It Covers |
|------|---------------|
| `23` | Technology swap guide (escape hatches) |
| `24` | Error recovery protocol |
| `25` | Doctor mode (framework diagnostics) |
| `26` | Observability (logging, error tracking, health checks) |
| `27` | Performance (Core Web Vitals, bundle budgets) |

### Cross-Cutting
| File | What It Covers |
|------|---------------|
| `19` | i18n posture (English-first for v1) |
| `20` | Sub-agent dispatch recipes (parallel builds) |

---

## Phase Dependency Chain

```
Phase 0–2: Planning (no code)
    ↓
Phase 3: Architecture (no code, produces route plan + entity plan + custom gates)
    ↓
Phase 4: Foundation (schema, utilities, env config)
    ↓
Phase 5: Auth (login, signup, middleware) → depends on Phase 4 schema
    ↓
Phase 6: Onboarding (multi-step flow) → depends on Phase 5 auth
    ↓
Phase 7: App Shell (sidebar, topbar, layout) → produces pattern snapshot
    ↓
Phase 8: Dashboard → reads pattern snapshot (MANDATORY)
    ↓
Phase 9: Core Features → reads pattern snapshot, updates after first feature
    ↓                      (parallel agents OK, single-writer rule)
Phase 10: Settings & Billing → reads pattern snapshot
    ↓
Phase 11: Admin → reads pattern snapshot
    ↓
Phase 12: Email Templates
    ↓
Phase 13: Marketing Site (parallel agents OK)
    ↓
Phase 14: Polish (edge cases, testing, accessibility audit)
```

## Shared Utilities Created in Phase 4

These are referenced throughout later phases:

| Utility | Location | Used For |
|---------|----------|----------|
| `requireOrganization()` | `src/lib/auth/scope.ts` | Session + org + role in every API route |
| `authorize()` | `src/lib/auth/authorize.ts` | Role-based permission checks |
| `apiHandler()` | `src/lib/api/handler.ts` | Error mapping wrapper for API routes |
| `parsePagination()` | `src/lib/api/pagination.ts` | URL param parsing for lists |
| `toPrismaArgs()` | `src/lib/api/pagination.ts` | Prisma skip/take from pagination |
| `buildPaginationMeta()` | `src/lib/api/pagination.ts` | Response pagination metadata |
| `formatDate()` | `src/lib/format.ts` | Smart relative/absolute date display |
| `env` | `src/env.ts` | Type-safe environment variables (T3 Env) |
| `logger` | `src/lib/logger.ts` | Structured JSON logging |
| Zod schemas | `src/lib/validations/*.ts` | Shared between client forms and server actions |
| Motion variants | `src/lib/animations.ts` | Shared animation definitions |
