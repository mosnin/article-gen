# Framework Version

**Current version: 1.11.0**

## Versioning Policy

This framework uses [Semantic Versioning](https://semver.org/):

- **MAJOR** — Breaking changes to the project-layer contract. Examples: renamed template files, changed required project doc filenames, changed phase numbering, removed or restructured framework files that existing projects reference.
- **MINOR** — New framework files, new sections in existing files, new validation gates. Non-breaking — existing projects continue to work without changes.
- **PATCH** — Typo fixes, wording clarifications, no behavioral change.

## Checking for Updates

Compare the version in this file against the upstream repository:

1. Check your local version: `cat docs/framework/VERSION.md | head -3`
2. Check upstream: visit the framework repo or `git ls-remote`
3. If **major** version differs → read the upgrade guide in `CHANGELOG.md` before merging
4. If **minor** version differs → review `CHANGELOG.md` for new features, safe to merge
5. If **patch** version differs → safe to merge directly

## Merge Strategy

Since the framework is cloned into `docs/framework/` of consumer projects, use `git subtree` for updates:

### Initial Setup (once per project)

```bash
# Add the framework repo as a remote
git remote add framework <framework-repo-url>
```

### Pulling Updates

```bash
# Pull latest framework changes into docs/framework/
git subtree pull --prefix=docs/framework framework main --squash
```

### If You Prefer Manual Updates

```bash
# Clone the framework separately and diff
git clone <framework-repo-url> /tmp/framework-latest
diff -rq docs/framework/ /tmp/framework-latest/ --exclude=.git
```

Then manually apply changes from the diff.

## Upgrade Guides

Upgrade guides for major version bumps are documented in `CHANGELOG.md` under each major release. They list:

- Which project-layer files need attention
- Which validation gates changed
- Which phase behaviors changed
- Step-by-step migration instructions
