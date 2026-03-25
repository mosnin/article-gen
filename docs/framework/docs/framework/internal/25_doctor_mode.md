# 25 Doctor Mode

> **TL;DR:** A safe, read-first diagnostic and repair system for broken framework and project docs. Diagnoses structural issues, reports findings, and makes minimal scoped repairs — never rewrites content, never deletes files.
> **Covers:** diagnostic checks, repair rules, safety constraints, report format, repair protocol | **Depends on:** MANIFEST.md, 09, 21 | **Used by:** CLAUDE.md | **Phase:** any

## Purpose

Framework and project docs can break over time — files get accidentally deleted, cross-references go stale, manifest entries drift from reality, markdown tables lose formatting, required sections go missing. Doctor mode is a structural linter and repair tool for the documentation itself. It finds what's broken and fixes the minimum needed to restore integrity.

## How to Activate

The user says any of:

- "run doctor mode"
- "run Modaf doctor"
- "check the framework health"
- "diagnose the docs"
- "heal the framework"
- "fix broken docs"

Or Claude can suggest it when structural issues are noticed during normal operation.

---

## Safety Constraints — The Hard Rules

These rules are absolute. They cannot be overridden by user instruction, diagnostic findings, or repair logic.

### 1. Never Delete Framework Files

Doctor mode **cannot** delete any file under `docs/framework/`. It can flag a file as potentially orphaned, but removal requires explicit user action outside of doctor mode.

### 2. Never Rewrite Content

Doctor mode fixes **structure**, not **substance**. It can:
- Add a missing markdown header
- Fix a broken table row
- Add a missing cross-reference
- Restore a required section skeleton

It **cannot**:
- Rewrite prose descriptions
- Change specifications or rules
- "Improve" wording
- Add new guidance or opinions
- Modify design token values, component specs, or build rules

### 3. Never Create New Framework Files

Doctor mode cannot create files in `docs/framework/`. If a file listed in MANIFEST.md is missing, it reports the gap — it does not generate a replacement. Framework files are authored, not auto-generated.

### 4. Diagnose Before Repairing

Doctor mode always runs the full diagnostic first and presents findings to the user. It does not begin repairs until the user approves. The only exception is if the user explicitly says "run doctor mode and fix everything" — in which case, repairs still follow the scoped rules above.

### 5. One Repair Per Finding

Each repair addresses exactly one diagnostic finding. No "while I'm in here, let me also..." changes. If fixing a broken manifest entry, fix that entry — don't reorganize the manifest table.

### 6. Never Modify Project Docs Without Asking

Files in `docs/project/` are app-specific and may contain intentional deviations. Doctor mode can diagnose issues in project docs but must ask the user before making any repair.

### 7. Log Every Change

After repairs, doctor mode outputs a precise list of what was changed, in what file, at what line, and why. The user should be able to `git diff` and see exactly what happened.

---

## Diagnostic Checks

Doctor mode runs these checks in order. Each check produces a PASS, WARN, or FAIL result.

### Check 1: File Inventory

**What:** Every file listed in MANIFEST.md exists on disk. Every `.md` file in `docs/framework/` appears in MANIFEST.md.

**How:**
```bash
# Files in MANIFEST but missing from disk
grep -oP '`[^`]+\.md`' docs/framework/MANIFEST.md | tr -d '`' | while read f; do
  ls "docs/framework/internal/$f" "docs/framework/website/$f" "docs/framework/templates/$f" "docs/framework/prompts/$f" "docs/framework/$f" 2>/dev/null | head -1 || echo "MISSING: $f"
done

# Files on disk but missing from MANIFEST
find docs/framework -name "*.md" -not -name "MANIFEST.md" -not -name "CHANGELOG.md" -not -name "VERSION.md" | while read f; do
  basename="$(basename $f)"
  grep -q "$basename" docs/framework/MANIFEST.md || echo "UNLISTED: $f"
done
```

**PASS:** All manifest entries have matching files. All files appear in manifest.
**WARN:** Files exist but aren't in manifest (potentially new, not yet registered).
**FAIL:** Manifest lists files that don't exist on disk.

### Check 2: Cross-Reference Integrity

**What:** Every `Depends on` and `Used by` reference in file headers points to a file that exists.

**How:**
```bash
# Extract "Depends on:" lines from all internal docs
grep -h "Depends on:" docs/framework/internal/*.md | while read line; do
  # Parse referenced file numbers and verify they exist
  echo "$line"
done
```

**PASS:** All cross-references resolve to existing files.
**FAIL:** A file references a dependency that doesn't exist or was renumbered.

### Check 3: Internal Link Integrity

**What:** Every markdown link to a framework file (`docs/framework/...`) points to a file that exists.

**How:**
```bash
grep -rn "docs/framework/[^ ]*\.md" docs/framework/ CLAUDE.md | while read match; do
  # Extract the path and check if it exists
  echo "$match"
done
```

**PASS:** All internal links resolve.
**WARN:** Links with variable paths (e.g., `docs/project/[feature]`) — expected, skip.
**FAIL:** Hardcoded links point to non-existent files.

### Check 4: Manifest Accuracy

**What:** The one-line descriptions in MANIFEST.md roughly match the TL;DR or first heading of each file.

**How:** For each manifest entry, read the file's TL;DR line and compare. Flag entries where the manifest description contradicts the file's stated purpose.

**PASS:** Descriptions are consistent.
**WARN:** Description is vague but not wrong.
**FAIL:** Description contradicts the file's actual content.

### Check 5: Phase Coverage

**What:** Every phase (0–14) has a corresponding file in `docs/framework/phases/`.

**How:**
```bash
for i in $(seq -w 0 14); do
  ls "docs/framework/phases/phase_${i}_"*.md 2>/dev/null || echo "MISSING: phase_${i}"
done
```

**PASS:** All 15 phase files exist.
**FAIL:** A phase file is missing.

### Check 6: Required Section Structure

**What:** Key framework files contain their required sections (headers that must exist).

**Required sections per file type:**

| File Pattern | Required Sections |
|-------------|-------------------|
| Internal docs (01–25) | `## Purpose`, TL;DR line in blockquote |
| Phase files | `## Trigger`, `## Files to Read`, `## What to Do`, `## Exit Condition` |
| Template files | `## Instructions` |

**How:** For each file, check that the required headers exist.

**PASS:** All required sections present.
**WARN:** Section exists but is empty (no content below the header).
**FAIL:** Required section header is missing entirely.

### Check 7: Markdown Table Integrity

**What:** Markdown tables in framework files have consistent column counts (header row matches separator row matches data rows).

**How:** Parse each table, count `|` characters per row, flag mismatches.

**PASS:** All tables have consistent columns.
**FAIL:** Table has rows with mismatched column counts (broken rendering).

### Check 8: Project Doc Completeness (if `docs/project/` exists)

**What:** All 9 required project doc files exist and are non-empty.

**How:**
```bash
for f in 00_app_idea 01_project_brief 02_feature_spec 03_user_flows 04_edge_cases 05_tech_stack 06_permissions_matrix 07_acceptance_criteria 08_qa_checklist; do
  file="docs/project/${f}.md"
  if [ ! -f "$file" ]; then
    echo "MISSING: $file"
  elif [ ! -s "$file" ]; then
    echo "EMPTY: $file"
  fi
done
```

**PASS:** All 9 files exist and have content.
**WARN:** Files exist but some are very short (< 10 lines, possibly stubs).
**FAIL:** Required files are missing or empty.

### Check 9: CLAUDE.md Consistency

**What:** CLAUDE.md's repository structure section matches the actual file list. Phase descriptions reference files that exist.

**How:** Compare the repo structure block in CLAUDE.md against actual files on disk. Flag any files listed in CLAUDE.md that don't exist, or files that exist but aren't listed.

**PASS:** Structure section matches reality.
**FAIL:** CLAUDE.md lists files that don't exist or is missing files that do exist.

---

## Report Format

After running all checks, present the findings:

```
## Modaf Doctor Report

### Summary
- Checks run: 9
- Passed: [N]
- Warnings: [N]
- Failed: [N]

### Findings

#### FAIL: [Check Name]
- **Issue:** [what's wrong]
- **File:** [path]
- **Repair:** [what doctor mode would do to fix it]

#### WARN: [Check Name]
- **Issue:** [what's off]
- **File:** [path]
- **Suggestion:** [what might help, but requires user decision]

#### PASS: [Check Name] (collapsed or omitted for brevity)

### Recommended Repairs
[Numbered list of repairs doctor mode can make, ordered by priority]

Approve repairs? (all / select by number / none)
```

---

## Repair Protocol

After the user approves repairs:

1. Make repairs one at a time, in the order presented
2. Each repair touches the minimum number of lines possible
3. After each repair, verify the fix by re-running the specific check
4. Log every change with file path, line number, and what was changed
5. Do not batch unrelated repairs into a single edit
6. After all repairs, re-run the full diagnostic to confirm clean state

### Repair Types (what doctor mode CAN do)

| Repair Type | Example | Scope |
|------------|---------|-------|
| **Add manifest entry** | File exists but isn't listed in MANIFEST.md | Add one table row |
| **Fix manifest description** | Description contradicts file content | Edit one cell |
| **Add missing section header** | Internal doc missing `## Purpose` | Add header + empty line |
| **Fix table formatting** | Row has wrong number of columns | Fix the specific row |
| **Fix broken internal link** | Link points to old filename | Update the path |
| **Update repo structure block** | CLAUDE.md structure section is stale | Regenerate the tree block only |
| **Add cross-reference** | File mentions a dependency but "Depends on" line is missing it | Add to the existing list |
| **Fix TL;DR metadata** | Phase number is wrong in a file's metadata line | Fix the specific value |

### What Doctor Mode CANNOT Repair

| Issue | Why Not | What to Do Instead |
|-------|---------|-------------------|
| Missing framework file | Framework files are authored, not generated | Report to user, they must create it |
| Wrong specification content | Doctor doesn't know what's "right" | Report to user for manual review |
| Conflicting guidance between files | Requires design judgment | Report conflict, user decides |
| Project doc content issues | App-specific, context-dependent | Report to user, ask before touching |
| Outdated guidance | Framework evolution is a human decision | Flag as potentially stale |

---

## Running Doctor Mode on Project Docs

When `docs/project/` exists, doctor mode runs additional project-specific checks:

1. **Template compliance** — do project docs follow the structure from their templates?
2. **Pattern snapshot freshness** — if `docs/project/pattern_snapshot.md` exists, does its metadata version match expectations for the current phase?
3. **Custom gates format** — if `docs/project/custom_gates.md` exists, do entries follow the gate template format?

**Important:** Project doc repairs always require user approval, even if the user said "fix everything." Project docs are the highest authority in the source-of-truth hierarchy — doctor mode must not assume it knows better than what was written.

---

## Integration with Other Systems

### With Validation Gates (21)
Doctor mode checks framework health. Validation gates check built code health. They don't overlap. If doctor mode finds a gate definition is malformed (broken bash command), it reports it but does not fix the gate logic — only the markdown structure.

### With Error Recovery (24)
Error recovery handles phase-level code errors. Doctor mode handles doc-level structural errors. If a phase error corrupted a project doc (e.g., pattern snapshot was overwritten with bad content), error recovery owns the fix. Doctor mode would only catch if the file became structurally malformed (missing headers, broken tables).

### With Escape Hatches (23)
If a technology swap was made but the corresponding gate adaptations weren't written to `docs/project/custom_gates.md`, doctor mode can flag the gap but cannot generate the replacement gates (that requires understanding the swap context).

---

## Final Principle

Doctor mode is a scalpel, not a sledgehammer. It reads everything, touches almost nothing, and always asks before cutting. The framework's value is in its authored specifications — doctor mode preserves that value by maintaining structural integrity without ever overstepping into content authorship.
