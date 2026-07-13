# Repository Status Audit — 2026-07-13

## 1. Branch consolidation

This branch (`claude/repo-branch-audit-merge-lxc8c3`) is the consolidated state of the
repository. It was built by taking the most advanced line of development —
`claude/agentic-article-generation-u1G85` (253 commits, last commit 2026-04-25) — which
already contained the default branch's lineage, the March UI rebuild
(`claude/ui-rebuild-latest`, `claude/rebuild-ui-framework-2wPE1`), and the winning codex
blog-scope branch, then absorbing the only content that was still unique elsewhere.

### Disposition of every branch

| Branch | Status | Notes |
|---|---|---|
| `claude/agentic-article-generation-u1G85` | **base of this branch** | Most advanced line; agent platform Tiers 1–4 |
| `claude/article-generator-webapp-fnItr` (default) | **merged here** | Its one unique commit (Feb 6 metadata-key fix) was superseded by the rewritten generate routes; merge recorded, rewritten versions kept |
| `claude/fix-metadata-fields-XZYMx` | already contained | |
| `claude/review-repo-setup-oVvAj` | already contained | |
| `claude/ui-rebuild-latest` | already contained | |
| `claude/rebuild-ui-framework-2wPE1` | already contained | |
| `codex/review-repository-contents-8rit65` | already contained | The winning variant of the blog-scope task |
| `claude/review-repo-improvements-h9Zvc` | superseded | Its commit is patch-equivalent to one already in this line (`git cherry` empty) |
| `codex/review-repository-for-understanding` | **docs merged here** | Both code fixes (cron publish false-success, header auth CTAs) were independently fixed in this line; its two docs (`code_audit_2026-03-27.md`, `repository_understanding.md`) were brought over |
| `claude/redesign-ui-tailwind-j0qDi` | superseded | Mar 22 UI pass, replaced by the Apr 10 full UI rebuild |
| `codex/integrate-herosection-component-with-styles` | superseded | Landing hero/feature section, replaced by the rebuilt `src/components/marketing/*` landing |
| `claude/explore-codebase-oqVL2` | superseded | Feb WIP blog-centric architecture + early scheduling; replaced by multi-blog support, autopilot, schedules v2, calendar |
| `codex/fix-billing-and-settings-pages-layout` (+5 suffixed variants) | abandoned alternatives | Six parallel attempts at the same Feb task on pre-rebuild code; billing/settings pages have since been rebuilt |
| `codex/review-repository-contents` (+3 suffixed variants besides 8rit65) | abandoned alternatives | Parallel attempts; 8rit65 was the one kept |

**All branches other than this one can be safely deleted.** No unique, still-relevant work
remains on any of them.

Recommended follow-ups (repo settings, not code):
- Make this consolidated line the default branch (or merge it into the current default),
  then delete the 22 stale branches.
- The default branch is currently `claude/article-generator-webapp-fnItr`, a February
  snapshot ~250 commits behind this branch.

## 2. Build health (verified on this branch)

- `npx tsc --noEmit` — **clean** (was failing: 15 errors).
- `npm run build` — **succeeds**, 186 pages generated (was aborting).
- `next start` smoke test — marketing pages serve 200; `/app` 500s only when Supabase
  env vars are absent (expected outside a configured deploy).

Fixes applied on this branch to get there:
1. Seven Inngest functions (added on the agent branch) still used the removed 3-argument
   `createFunction(opts, trigger, handler)` API and did not compile under `inngest ^4.2`;
   converted to v4 `triggers: [...]` syntax.
2. `/app/generate` used `useSearchParams()` without a Suspense boundary, aborting static
   prerender of the production build; wrapped.
3. `/app/articles/[id]` forwarded invalid props to `PublishPage` (takes none); fixed.
4. Added the four `STRIPE_*_PRICE_ID` vars to `.env.example` (used by checkout/trial code
   but previously undocumented).

## 3. What the product is

An AI SEO-article SaaS: Next.js 15 + Supabase (auth/Postgres/storage/RLS) + Stripe
subscriptions + Inngest scheduling, with a separately deployed Modal-hosted Python agent
harness (OpenAI Agents SDK, ~30 subagents/tools) doing agentic article generation and
content operations.

- **Marketing site**: landing, pricing, about, blog, 4 feature pages, integrations.
- **Generation**: classic client-orchestrated pipeline (research → metadata → article →
  images; single/batch/cluster) and agent mode (default) dispatching to Modal with live
  SSE run streaming, cancel/retry, cost telemetry.
- **Automation**: autopilot 30-day plans, recurring autonomous schedules with approval
  gate, 7 Inngest crons (autopilot, social publish, stuck-run alerts, competitor monitor,
  event retention, newsletter, weekly report*).
- **Research/analytics suites**: keywords, SERP, competitors, topics, briefs, internal
  links, cannibalization, image audit; GSC-backed performance/rankings/content-gaps,
  SEO audit, sponsorship fit, cost optimizer, user segments.
- **Publishing**: WordPress, Ghost, Medium, Shopify, Dev.to wired end-to-end (single,
  batch, and agent auto-publish). Notion, Webflow, and generic webhook publishing exist
  as standalone routes but are not in the batch/agent dispatcher.
- **Billing**: Stripe checkout + webhook with plans free(10cr)/starter($29,50cr)/
  growth($50,120cr)/pro($99,300cr); 3-day trial flow; team invites; onboarding wizard.

## 4. Functional readiness — verdict

**The codebase is feature-complete for a launchable v1 and now builds cleanly, but it is
not deploy-ready today.** Two categories stand between here and "ready":

### A. Launch blockers (code)

1. **Trial users likely never receive a plan or credits.** Trial checkout sets metadata
   `{supabase_user_id, trial}` but not `plan`; the `checkout.session.completed` webhook
   only grants credits when `metadata.plan` is present, so it no-ops for trials. And if
   `STRIPE_TRIAL_PRICE_ID` differs from the starter price, `getPlanByPriceId()` returns
   null on `subscription.updated` too. Fix: include `plan` in trial-session metadata
   and/or map the trial price id in `PLANS`.
2. **"$1 to start" is advertised but not charged** — the trial route's comment mentions a
   $1 setup invoice item, but none is created. Either add the invoice item or change the
   marketing copy.
3. **Marketing pricing page disagrees with real plans**: page shows Starter $29 /
   Growth $79 / Agency $199; code implements starter $29 / growth $50 / pro $99. One of
   the two must change.
4. **`/app/integrations` connection state is placeholder** — `connected` is a hardcoded
   empty set with no loader, so "Connected/Manage" can never display.
5. **`article-events.ts` functions are dead**: `onArticlePublished` and
   `weeklyContentReport` are not registered in `src/app/api/inngest/route.ts`, and nothing
   emits `article/published`. Either register + emit, or delete (the `content_reports`
   table has no UI consumer). `src/inngest/client.ts` is likewise an unused duplicate
   Inngest client.

### B. Deployment prerequisites (ops)

1. **Supabase**: apply `supabase/schema.sql` first (base tables live there, not in the
   migration stream), then the 29 ordered migrations. Migrations are consistent and
   idempotent where duplicated.
2. **Vercel env**: ~25 vars per `.env.example` (Supabase, OpenAI, Stripe incl. 4 price
   ids, Google OAuth, `WP_ENCRYPTION_KEY`, `CRON_SECRET`, Modal URLs/secrets, Upstash
   Vector, Exa, app URL).
3. **Modal deploy**: the agent harness deploys separately
   (`scripts/deploy-agents.sh` → `modal deploy modal_app/modal_app.py`) with the
   `article-sauce-agents` secret bundle; the printed trigger/cancel URLs must then go
   into Vercel env.
4. **Inngest**: app must be registered with Inngest (all scheduling runs through it —
   `vercel.json` defines no crons). Note `/api/cron/publish` (legacy scheduled publishing,
   `CRON_SECRET`-guarded) is not triggered by anything; either add a Vercel cron for it
   or confirm the Inngest paths fully replace it.
5. **Stripe**: create the four prices and the webhook endpoint.

### C. Known accepted gaps (not blockers)

- Social publishing is webhook-only; native OAuth posting to social platforms is not
  implemented (`fetch-snippets` route notes this).
- Wix, WordPress.com, Framer, Feather integrations are "coming soon" cards only, though
  onboarding lets users pick some of them as `preferred_integration`.
- No test suite and no CI. Given the March audit's findings recurred (build breakage
  landed again between March and April), a minimal CI gate of `tsc --noEmit` +
  `next build` would prevent regression.
