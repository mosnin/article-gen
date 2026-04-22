#!/usr/bin/env bash
# Deploy the article-sauce-agents Modal app to production.
# Make executable once with: chmod +x scripts/deploy-agents.sh
set -euo pipefail

if ! command -v modal >/dev/null 2>&1; then
  echo "error: 'modal' CLI is not installed or not on PATH." >&2
  echo "       install with: pip install 'modal>=0.66,<0.80'" >&2
  echo "       then authenticate: modal token new" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Deploying modal_app/modal_app.py to Modal..."
modal deploy modal_app/modal_app.py

echo ""
echo "==> Deploy complete."
echo ""
echo "Copy the public trigger URL printed above (the *-trigger.modal.run line)"
echo "and paste it into your Vercel environment as:"
echo ""
echo "    MODAL_AGENT_TRIGGER_URL=https://<org>--article-sauce-agents-trigger.modal.run"
echo ""
echo "Then redeploy the Next.js app so the trigger URL is picked up."
