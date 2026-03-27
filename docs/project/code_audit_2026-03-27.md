# Code Audit Report (2026-03-27)

## Scope and method

I performed a static and build-time audit of the current `work` branch:

1. Read key runtime surfaces in `src/app/api/*`, auth middleware, and publishing flows.
2. Ran project health checks (`npm run build`, `npx tsc --noEmit`).
3. Searched for known risk patterns and TODOs in security-sensitive paths.

This audit focuses on correctness, security, and operational reliability.

---

## Executive summary

The repository has a strong foundation (clear Supabase + Next.js architecture, RLS usage, and route-level auth checks), but currently has several **high-priority release blockers**:

- **Build and typecheck are failing** in the current environment/branch.
- **Scheduled publish integrity issues** in cron logic can incorrectly mark unsupported platform jobs as published.
- **Retry behavior for failed scheduled jobs is incomplete** due clearing scheduling fields before successful publish.
- **Inconsistent hardening between direct-publish and cron-publish WordPress paths** (SSRF validation present in one path, missing in another).

---

## Findings

## 1) Build is failing (release blocker)

**Severity:** High

`npm run build` fails with module resolution errors (e.g., `sonner`, `date-fns`).

Impact:
- Production build cannot complete in current state.
- CI/deployment will fail unless dependency/runtime mismatch is corrected.

Recommendation:
- Ensure dependencies are installed from lockfile in CI and local (`npm ci` / clean install).
- Verify `node_modules` integrity and package manager consistency.
- Add a pre-merge CI gate for `npm run build`.

## 2) Typecheck is failing across many modules

**Severity:** High

`npx tsc --noEmit` reports broad failures, including:
- Missing module type declarations (multiple packages)
- UI prop typing mismatches (`Button`/`Badge` variant/size usage)
- Implicit `any` errors in API/auth helpers

Impact:
- Reduced confidence in refactors and runtime behavior.
- Potential latent runtime bugs hidden by TypeScript drift.

Recommendation:
- Stabilize dependency install first.
- Then triage TypeScript failures by category: dependency resolution, component prop contracts, strictness cleanup.
- Add typed DTOs for route handler request/response payloads.

## 3) Cron scheduler marks unsupported platforms as success

**Severity:** High

In `/api/cron/publish`, unsupported platforms currently fall through to:
- `result = { success: true }`
- then article is marked `posted: true`

Impact:
- False-positive publish state in DB.
- Content may appear published when it was never delivered.

Recommendation:
- Return `success: false` for unimplemented platforms.
- Persist explicit error reason (`platform_not_implemented`) and keep job pending or move to dead-letter state.

## 4) Failed scheduled publish does not restore/reschedule safely

**Severity:** High

Cron logic clears `publish_at` before attempting publish. On failure, comment indicates retry intent, but no restore/retry scheduling is currently implemented.

Impact:
- Failed scheduled jobs can become stranded (no automatic retry).
- Manual recovery burden for users/support.

Recommendation:
- Introduce explicit job state machine (`scheduled`, `in_progress`, `failed`, `published`).
- Use transactional update or optimistic lock to avoid duplicate workers.
- On failure, set `next_retry_at` with bounded retry policy + error field.

## 5) WordPress cron publish path lacks SSRF validation parity

**Severity:** Medium

The interactive WP publish route validates target URL (`validatePublicUrl`), but cron WP publish path does not perform equivalent URL validation.

Impact:
- Reduced consistency in outbound request safeguards.
- Increased SSRF risk if malformed or malicious URL enters stored blog config.

Recommendation:
- Reuse shared URL validation helper in cron path before outbound fetch.
- Add reject logging + clear operator-facing error in job results.

## 6) Lint workflow/config mismatch

**Severity:** Medium

`npm run lint` is currently broken due ESLint v9 flat-config expectation while repo still uses `.eslintrc` style.

Impact:
- Linting not enforceable in pipeline.
- Style/safety regressions become easier to merge.

Recommendation:
- Either migrate to `eslint.config.*` or pin ESLint to compatible major.
- Add CI lint gate after migration/pinning.

## 7) Observability is mostly console-based in critical paths

**Severity:** Medium

Several critical error paths still rely on `console.error` instead of a structured telemetry backend.

Impact:
- Harder incident triage and trend analysis.
- Limited alerting on recurring failure classes.

Recommendation:
- Standardize on `src/lib/logger.ts` across route handlers/libs.
- Add correlation IDs for request and job execution paths.

## 8) Large route handlers would benefit from service extraction

**Severity:** Low

Some API handlers (especially publish/generate flows) are long and mixed-concern (validation + orchestration + provider API + persistence).

Impact:
- Harder unit testing and future maintenance.

Recommendation:
- Extract per-platform service modules and shared validation helpers.
- Add focused unit tests around serialization/credential/publish orchestration.

---

## Priority remediation plan

### P0 (immediate)
1. Fix dependency/install and restore green `build` + `typecheck` in CI.
2. Fix cron unsupported-platform false success behavior.
3. Implement robust failure/retry state handling for scheduled publishing.

### P1 (next)
1. Add SSRF validation parity in cron publish path.
2. Repair lint config (ESLint 9 migration or version pin).
3. Strengthen structured logging + correlation IDs.

### P2 (hardening)
1. Refactor oversized handlers into testable services.
2. Expand integration tests for publish pipeline and cron retries.

---

## Commands run

- `npm run build` → failed (module resolution errors)
- `npx tsc --noEmit` → failed (type/dependency issues)
- `npm run lint` → failed previously in this branch due ESLint config mismatch
- `rg` pattern scans for risk hotspots/TODOs in API and UI paths

