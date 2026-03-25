# Glossary

Framework-specific terms used across Modaf documentation. When a doc uses one of these terms, it means exactly what's defined here — not the general industry meaning.

| Term | Definition | Where Used |
|------|-----------|-----------|
| **Activation** | The moment a user transitions from signed-up to engaged. Measured by the first value event. Not the same as email verification. | 02, 03, project docs |
| **Admin Record** | An immutable audit log entry created whenever an admin performs a privileged action (suspend user, change plan, toggle flag). Stored in the AdminRecord entity. | 05, 07 |
| **apiHandler** | A shared wrapper function (`src/lib/api/handler.ts`) that wraps every API route handler with standard error mapping: ZodError → 422, AuthorizationError → 403, Prisma P2002 → 409, P2025 → 404, unknown → 500 with referenceId. Usage: `export const GET = apiHandler(async (req) => { ... })`. | 09 |
| **authorize()** | A shared helper (`src/lib/auth/authorize.ts`) that checks whether a role has permission to perform an action on a resource. Throws `AuthorizationError` (403) if denied. Called after `requireOrganization()` in every API route and server action. | 06, 09 |
| **Archetype** | A canonical page pattern (e.g., queue dashboard, detail view, settings form). Archetypes define layout structure and component composition, not visual style. | 11, 16 |
| **Canonical** | The framework's default/recommended approach. "Canonical roles" = the 5 roles the framework defines. "Canonical entities" = the 9 core database models. Can be overridden by project docs. | Throughout |
| **Core entity** | One of the 9 database models defined in `07_data_models.md` (User, Organization, Membership, Subscription, Settings, Integration, UsageEvent, AnalyticsSummary, AdminRecord). These are stable across all projects. | 07 |
| **Custom gate** | A project-specific validation assertion written to `docs/project/custom_gates.md` during Phase 3. Run alongside standard gates after every build phase. Examples: "Invoice entity has `status` field", "Dashboard shows MRR metric". | 21, project docs |
| **Design tokens** | Named values (colors, spacing, typography, shadows, motion) that replace hardcoded CSS values. Internal and website use separate token files. | 10, website/design_system_tokens |
| **Doctor mode** | A safe diagnostic and repair system activated by saying "run doctor mode." Finds broken cross-references, missing files, stale manifest entries, and malformed tables. Never rewrites content, deletes files, or modifies specifications. | 25 |
| **Feature module** | A self-contained product feature (e.g., Projects, Invoices, Tickets) with its own CRUD views, API routes, and permissions. Built during Phase 9. | 04, 09 |
| **First value event** | The specific moment a new user gets tangible benefit from the product. Defined per-project in `03_user_flows.md`. Examples: seeing a dashboard with real data, sending a first invoice, completing a first workflow. | 02, project/03 |
| **Four states** | Loading, empty, success, error — the four UI states every data-driven view must handle. "Empty" includes a CTA to create the first item. | 08, 09, 17 |
| **Gate** | A machine-checkable structural assertion that must pass before proceeding to the next phase. Gates verify file existence, schema validity, TypeScript compilation, etc. | 21, project/custom_gates |
| **Internal** | The authenticated product experience (dashboard, features, settings, admin). Uses internal design tokens. Distinct from the public marketing site. | internal/* |
| **Membership** | The join entity between User and Organization. Carries role and status. A user can have memberships in multiple organizations. | 07 |
| **Modaf** | The name of this framework. Refers to the entire system: phased build process, documentation structure, validation gates, pattern snapshot, and everything in `docs/framework/`. | CLAUDE.md |
| **Escape hatch** | A technology swap guide for replacing a framework default (auth, billing, database, tenancy, email, hosting) with an alternative. Each swap documents what changes, what stays the same, and which validation gates need adjustment. | 23 |
| **Error display decision tree** | A lookup table in `17_error_state_taxonomy.md` that maps error context (form validation, mutation failure, page load, 401, 403, etc.) to the correct UI treatment (inline text, toast, banner, error block, redirect). | 17 |
| **Module** | An optional feature system (analytics, integrations, API keys, webhooks, notifications, usage, activity logs, MCP) that can be toggled per project. Defined in `04_feature_modules.md`. | 04 |
| **Organization** | The multi-tenant boundary. All product data belongs to an organization, not directly to a user. In single-user apps, the organization is auto-created with one member. | 07 |
| **Pattern snapshot** | A generated reference file (`docs/project/pattern_snapshot.md`) that captures exact code conventions from built phases. Ensures consistency across features and sub-agents. Created end of Phase 7, updated end of Phase 9. | 22 |
| **Phase** | One of the 15 discrete build steps (0–14). Each phase has defined inputs, outputs, and exit conditions. Phases are sequential — you cannot skip one. | CLAUDE.md, phases/* |
| **Pagination utility** | Shared helpers (`src/lib/api/pagination.ts`) for parsing page/pageSize from URL params, converting to Prisma skip/take, and building response metadata. Default 25 rows, max 100. | 09 |
| **Product entity** | An app-specific database model (e.g., Project, Invoice, Ticket) that extends the core entities by referencing Organization (for multi-tenancy) and optionally User (for ownership). | 07 |
| **Project docs** | The 9 files in `docs/project/` that define the specific app being built. Generated during Phase 2. Highest priority in the source-of-truth hierarchy. | CLAUDE.md |
| **Public / Website** | The unauthenticated marketing site (home, pricing, features, about, etc.). Uses website design tokens. Built during Phase 13. | website/* |
| **requireOrganization()** | A shared helper (`src/lib/auth/scope.ts`) that returns `{ userId, organizationId, role }` from the current session. Throws if not authenticated or no active membership. Called at the top of every API route and server action to enforce multi-tenancy. | 06, 09 |
| **Screen archetype** | Same as archetype but specifically for full pages (as opposed to component-level patterns). Internal and website have separate archetype files. | 11, website/public_screen_archetypes |
| **Server action pattern** | The canonical end-to-end form submission flow: shared zod schema (`lib/validations/`) → next-safe-action handler (auth + permissions + logging) → react-hook-form client component (field error mapping + toast feedback). | 09 |
| **Shell** | The authenticated app frame: top bar, sidebar, mobile drawer, main content area. Built once in Phase 7, reused by all authenticated pages. | 01 |
| **Single-writer rule** | Only one agent updates the pattern snapshot at a time. During parallelized Phase 9, the first feature built updates the snapshot; subsequent agents read the updated version before building. Prevents convention drift. | 22, CLAUDE.md |
| **Slug** | A URL-safe identifier for an organization. Lowercase alphanumeric + hyphens, 3–60 chars. Used in URLs and as a human-readable org reference. | 07 |
| **Source of truth hierarchy** | When docs conflict: project docs > internal docs > website docs > templates. Built code (pattern snapshot) overrides planned conventions (framework docs). | CLAUDE.md |
| **Sub-agent** | A Claude Code agent spawned to handle a parallel work unit. Only used in Phases 2, 9, 13, and 14. Must read the pattern snapshot before writing code. | 20 |
| **Validation gate** | See "Gate" above. |  |
| **v1 scope** | The features and capabilities included in the first shipped version. Defined during discovery (Phase 1) and documented in project docs. Everything outside v1 scope is explicitly deferred. | project/01, project/02 |
| **Workspace** | Synonym for Organization in user-facing UI. The framework uses "Organization" in code/schema and "Workspace" in UI copy. | 05, 07 |
