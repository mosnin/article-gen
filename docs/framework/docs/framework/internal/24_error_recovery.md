# 24 Error Recovery

> **TL;DR:** Phase re-run protocol for when errors from a completed phase are discovered later. Covers detection triggers, diagnosis, three recovery tiers (patch/partial/full re-run), cascade analysis, and git safety.
> **Covers:** error detection, diagnosis protocol, recovery tiers, cascade analysis, pattern snapshot recovery, git safety, user communication | **Depends on:** 09, 21, 22 | **Used by:** all phase files, CLAUDE.md | **Phase:** any

## Purpose

The framework is forward-moving by design — each phase builds on the previous. But errors happen. A botched Phase 6 might not surface until Phase 9 when something downstream breaks. This file defines the protocol for going back without going off the rails.

---

## Error Detection Triggers

Errors from completed phases surface in four ways:

1. **Validation gate regression** — a prior phase's gate fails during the current phase's regression check
2. **User report** — the user tests a feature and finds a bug introduced in an earlier phase
3. **Claude discovers inconsistency** — while reading existing code for a new phase, Claude notices something wrong in already-built code
4. **Pattern snapshot drift** — code diverges from the snapshot in ways that weren't intentional

When any of these occur, do not silently fix and continue. Follow the protocol below.

---

## Diagnosis Protocol

Before fixing anything, diagnose the scope:

### Step 1: Identify the Source Phase

- Check git log or file timestamps to find when the error was introduced
- Determine which phase's instructions were being followed when the error was written
- If unclear, check which framework file governs the broken code

### Step 2: Classify the Scope

| Scope | Definition | Example |
|-------|-----------|---------|
| **Isolated** | Affects 1-2 files, single route or component | Wrong validation rule on one form |
| **Systemic** | Affects a pattern used across multiple files | Auth middleware checks the wrong session field everywhere |

### Step 3: Classify the Severity

| Severity | Definition | Example |
|----------|-----------|---------|
| **Cosmetic** | Wrong spacing, missing dark mode variant, minor visual issues | Card padding uses space-4 instead of space-6 |
| **Functional** | Feature doesn't work correctly but architecture is sound | Onboarding saves but doesn't set the completion flag |
| **Structural** | Wrong architecture choice that requires rethinking | Missing entity, wrong relationship, wrong auth model |

---

## Recovery Tiers

### Tier 1: Patch in Place

**When:** Isolated scope, functional or cosmetic severity.

**Protocol:**
1. Fix the specific files directly — no phase re-announcement needed
2. Re-run the affected phase's validation gates
3. Re-run full regression gates (all prior phases)
4. If the fix changes an established convention, update the pattern snapshot
5. Briefly inform the user what was fixed

**Example:** "Found that the onboarding completion flag wasn't being set. Fixed in `src/app/api/onboarding/complete/route.ts`. All gates passing."

### Tier 2: Partial Phase Re-run

**When:** Systemic scope, functional severity. The pattern was applied in multiple places but the architecture is correct.

**Protocol:**
1. **Announce:** "Re-running Phase [N] partially to fix [description]. Affected files: [list]."
2. Re-read the phase's framework files to confirm the correct pattern
3. Fix all instances of the error across the codebase
4. Check for cascade — did later phases copy the wrong pattern? If yes, fix those too.
5. Re-run the affected phase's gates plus full regression
6. Update the pattern snapshot if the fix changes a convention
7. Summarize all changes to the user

**Example:** "The auth middleware was checking `session.user` instead of `session.user.id` for org membership. This was copied into 4 feature API routes in Phase 9. Fixing the middleware and all 4 routes. Re-running Phase 5 and Phase 9 gates."

### Tier 3: Full Phase Re-run

**When:** Structural severity. The architecture decision was wrong and needs to be rebuilt.

**Protocol:**
1. **Announce:** "Phase [N] needs to be rebuilt. Reason: [description]. This will affect Phases [N] through [current]."
2. **Wait for user confirmation** before proceeding
3. Create a git branch before making changes: `git checkout -b fix/phase-N-recovery`
4. Re-read the phase's framework files
5. Rebuild the affected phase
6. Run cascade analysis (see below) to identify all downstream impact
7. Fix all cascading issues in later phases
8. Re-run gates for all affected phases
9. Update the pattern snapshot
10. Present a full summary to the user
11. Merge the fix branch back to the working branch

---

## Cascade Analysis

Not all phases cascade equally. Use this map to determine downstream impact:

| Source Phase | Cascades To | Reason |
|-------------|-------------|--------|
| **4 Foundation** | Everything (5–14) | Schema changes ripple through every query, every type, every API route |
| **5 Auth** | 6+ | Middleware pattern, session access, and protected route wrappers are used everywhere |
| **6 Onboarding** | Usually isolated | Only cascades if the completion flag logic or redirect pattern is wrong |
| **7 Shell** | 8+ | Layout, page header, sidebar, and pattern snapshot are consumed by all later phases |
| **8 Dashboard** | Usually isolated | Dashboard is self-contained unless it set a wrong data display pattern |
| **9 Features** | Later features only | If the first feature set a wrong pattern that was copied to subsequent features |
| **10 Settings** | 11 only | If settings layout pattern was reused in admin |
| **11 Admin** | Usually isolated | Admin is self-contained |
| **12 Email** | Usually isolated | Email templates are standalone |
| **13 Marketing** | Usually isolated | Marketing site is independent of the app |
| **14 Polish** | None | Final phase, nothing depends on it |

### Cascade Checklist

When a phase error is found:

1. Identify the phase from the table above
2. Check the "Cascades To" column
3. For each downstream phase, search for code that references or copies patterns from the broken phase
4. List all affected files
5. Include them in the fix scope

---

## Pattern Snapshot Recovery

If the pattern snapshot itself was wrong (captured a bad convention):

1. Fix the source code first
2. Re-extract the corrected pattern from the fixed code
3. Diff old snapshot vs new snapshot
4. Identify all files built using the old snapshot's convention
5. Apply corrections to those files
6. Update the snapshot version counter

**Key rule:** Fix the code, then update the snapshot. Never update the snapshot to match broken code. The snapshot reflects what the code *should* be.

---

## Git Safety

### Recommended: Tag Phase Completions

After each phase passes its validation gates:

```bash
git tag phase-N-complete -m "Phase N: [brief description]"
```

This creates restore points. If Phase 9 goes wrong, you can inspect what the codebase looked like at `phase-7-complete`.

### For Tier 3 Recovery: Branch First

```bash
git checkout -b fix/phase-N-recovery
# ... make fixes ...
git checkout main  # or working branch
git merge fix/phase-N-recovery
```

### Rules

- Never force-push or `git reset --hard` during recovery
- Create new commits for all fixes (don't amend completed phase commits)
- Keep the fix branch until the user confirms the recovery is correct
- If recovery touches many files, commit in logical chunks (one commit per affected phase)

---

## User Communication Template

When an error from a prior phase is discovered, present this to the user before acting:

```
## Error Recovery — Phase [N]

**What went wrong:** [description of the error]
**When it was introduced:** Phase [N]
**When it was caught:** Phase [M]
**Severity:** [cosmetic / functional / structural]
**Recovery tier:** [1 / 2 / 3]
**Affected files:** [list of files to fix]
**Cascade to later phases:** [yes/no — if yes, list phases and files]
**Recovery plan:** [what will be fixed and how]

Proceed with recovery?
```

For Tier 1 (isolated, minor), the announcement can be brief — one sentence is fine. For Tier 2 and 3, use the full template and wait for user confirmation.

---

## When NOT to Use This Protocol

- **Current phase errors** — if you find an error in the phase you're currently building, just fix it. This protocol is for errors discovered in *completed* phases.
- **User-requested changes** — if the user asks to change something from an earlier phase, that's a feature change, not error recovery. Discuss scope and approach with the user directly.
- **Framework file issues** — if you find an error in `docs/framework/`, do not modify it. Note the discrepancy and work around it in the project layer. The framework is meant to be static.

## Final Principle

The goal is controlled rollback, not panic. Diagnose before fixing. Scope before acting. Communicate before changing. Most errors are Tier 1 — a quick fix with a gate check. Reserve Tier 3 for genuine architectural mistakes, which should be rare if the Phase 3 architecture plan was reviewed properly.
