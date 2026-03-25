# Phase 9 — Core Features

## Trigger
Dashboard (Phase 8) is complete.

## Files to Read
- `docs/framework/internal/08_ui_system_internal.md` — component behaviors
- `docs/framework/internal/09_build_rules_internal.md` — API patterns, server actions, pagination, Tanstack Query (see Implementation Recipe below)
- `docs/framework/internal/11_internal_screen_archetypes.md` — page patterns
- `docs/framework/internal/12_internal_component_specs.md` — component visual specs
- `docs/framework/internal/17_error_state_taxonomy.md` — error handling and display decision tree

## Required Reading (Before Building)
- `docs/project/pattern_snapshot.md` — canonical code conventions (all agents must read this)
- `docs/framework/QUICK_START.md` — task-to-file recipes for common build tasks

## What to Build

Build the product-specific feature modules defined in `docs/project/02_feature_spec.md`.

### Implementation Recipe

For each feature module, follow this build order using the file 09 patterns:

**1. Schema** — Add Prisma model with `organizationId` foreign key (file 07 extension pattern)

**2. Validation schemas** — Create zod schemas in `lib/validations/` (file 09 — Server Action Pattern, Step 1)

**3. API routes or server actions** — Choose one per feature:
- API routes: use `apiHandler()` wrapper + `requireOrganization()` + `authorize()` (file 09 — API Route Error Handler)
- Server actions: use `next-safe-action` + zod schema (file 09 — Server Action Pattern, Step 2)

**4. List/index page** — Table or card grid:
- Parse filters and pagination from URL with `parsePagination()` (file 09 — Pagination Utility)
- Fetch with Tanstack Query using query key factory (file 09 — Tanstack Query Conventions)
- Display with Table component (file 08) following Table Index archetype (file 11)
- Use `loading.tsx` or `<Suspense>` (file 09 — Next.js App Router File Conventions)

**5. Create/edit forms** — react-hook-form + zod + toast:
- Follow full pattern from file 09 — Server Action Pattern, Step 3
- Map server errors to fields, toast on success (file 17 — Error Display Decision Tree)

**6. Detail page** — Entity view with related data:
- Follow Detail archetype (file 11) with tabs or sections (file 08)

**7. Delete** — Confirmation modal (file 08, component composition rule 5) + `apiHandler()` DELETE route

**8. Four states** — Every view handles loading, empty, success, error (file 09 — State Handling Rules)

### Screen Archetypes to Follow
- **Table Index**: filterable, sortable, paginated lists
- **Detail**: entity detail with tabs or sections
- **Form Setup**: multi-field forms with inline validation
- Reference `11_internal_screen_archetypes.md` for layout rules

### Error Handling
- Apply error taxonomy from `17_error_state_taxonomy.md`
- Use the Error Display Decision Tree to pick inline vs toast vs banner vs error block
- Client validation, server validation, network errors, empty states

### Four States on Every View
- Loading (skeletons)
- Empty (guidance + CTA)
- Success (data populated)
- Error (message + retry)

### Verify
- All CRUD operations work end-to-end
- Permissions enforced (users can't access others' data)
- Forms validate correctly
- All four states render properly
- Responsive at all breakpoints

### Run Validation Gates
Run all Phase 9 gates from `docs/framework/internal/21_validation_gates.md`:
- `gate:features-exist` — All feature modules from spec have routes
- `gate:features-four-states` — Every feature handles loading, empty, success, error
- `gate:features-permissions` — Permission checks in API routes
- `gate:features-org-isolation` — Queries filter by organization
- `gate:features-validation` — Forms have client-side validation

Plus regression: re-run all Phase 4–8 gates.

### Update Pattern Snapshot
After the first feature module is built, update `docs/project/pattern_snapshot.md` to add Section H (Feature Module Template). All subsequent feature agents must read this before building.

## Exit Condition
Core features are functional. All gates pass. Pattern snapshot updated with feature template. Summarize what was built and ask user to continue to **Phase 10**.
