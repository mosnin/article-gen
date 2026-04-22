#!/usr/bin/env bash
# Run the article-sauce-agents Modal app in live-reload dev mode.
# Make executable once with: chmod +x scripts/dev-agents.sh
set -euo pipefail

if ! command -v modal >/dev/null 2>&1; then
  echo "error: 'modal' CLI is not installed or not on PATH." >&2
  echo "       install with: pip install 'modal>=0.66,<0.80'" >&2
  echo "       then authenticate: modal token new" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> modal serve agents/modal_app.py (live reload)"
echo "    Edits to any Python file under agents/ will reload automatically."
echo "    Press Ctrl+C to stop."
echo ""
modal serve agents/modal_app.py
