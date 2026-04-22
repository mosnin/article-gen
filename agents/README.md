# article-sauce-agents

Modal-hosted, OpenAI Agents SDK-driven article-generation harness. This
README covers local setup and day-2 operations only. The authoritative
spec (architecture, contracts, database schema, event shapes, tool
catalog, dedup semantics) lives in
[`docs/project/09_agentic_generation.md`](../docs/project/09_agentic_generation.md)
— read that first; anything here that conflicts with it is wrong.

## Prerequisites

- Python **3.11+**
- The `modal` CLI (`pip install 'modal>=0.66,<0.80'`)
- A [Modal](https://modal.com) account with `modal token new` configured
- An OpenAI account + API key (GPT-4.1 family access)
- An [Exa](https://exa.ai) account + API key (SERP / niche research)
- An [Upstash Vector](https://upstash.com/vector) index for the dedup
  memory store (see spec §9 for the index layout)
- The main Next.js app's Supabase project already provisioned (the
  agents reuse the service-role key)

## First-time setup

1. Install Python deps into a venv:

   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r agents/requirements.txt
   ```

2. Authenticate the Modal CLI (opens a browser):

   ```bash
   modal token new
   ```

3. Create the Modal secret bundle. This is the exact set of keys the
   Modal app reads at runtime (see spec §11 for the source-of-truth
   table):

   ```bash
   modal secret create article-sauce-agents \
     OPENAI_API_KEY=sk-... \
     SUPABASE_URL=https://<project>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     EXA_API_KEY=<exa-key> \
     UPSTASH_VECTOR_REST_URL=https://<index>.upstash.io \
     UPSTASH_VECTOR_REST_TOKEN=<upstash-vector-token> \
     AGENT_WEBHOOK_SECRET=<64-char-hex> \
     AGENT_INTERNAL_SECRET=<64-char-hex> \
     MODAL_AGENT_TOKEN=<64-char-hex> \
     APP_URL=https://your-app.vercel.app
   ```

   The three `*_SECRET` / `*_TOKEN` values must be identical to the
   values in the Vercel environment (`AGENT_WEBHOOK_SECRET`,
   `AGENT_INTERNAL_SECRET`, `MODAL_AGENT_TOKEN`) — HMAC verification
   depends on them matching byte-for-byte.

4. Copy `.env.example` to `.env` at the repo root and fill in the
   non-Modal keys (these are the ones the **Next.js** side needs). The
   Modal app itself never reads this file; it reads the secret bundle
   created above.

## Local development

```bash
./scripts/dev-agents.sh
```

This runs `modal serve agents/modal_app.py` in live-reload mode: edits
to any Python file under `agents/` hot-reload the running app without
redeploying. The command prints a temporary `*.modal.run` trigger URL
that you can point a local Next.js dev server at via
`MODAL_AGENT_TRIGGER_URL` in your local `.env.local`.

## Deploy

```bash
./scripts/deploy-agents.sh
```

The script runs `modal deploy agents/modal_app.py` and reminds you to
capture the printed public trigger URL. Paste that URL into Vercel's
environment settings as:

```
MODAL_AGENT_TRIGGER_URL=https://<org>--article-sauce-agents-trigger.modal.run
```

Then trigger a Vercel redeploy so the server routes pick it up.

## Tail logs

```bash
modal app logs article-sauce-agents
```

Add `--follow` to stream. Logs include every tool call, webhook retry,
and stack trace.

## Replay a failed run

When a run ends in `status='failed'`, grab its `id` from the
`/app/agent-runs` UI (or from the `agent_runs` table) and replay it
locally:

```bash
python -m agents.harness.replay <runId>
```

(The replay harness will be implemented later; the intent is: pull the
original `agent_runs.input` payload + seed via service role, rebuild
the same orchestrator with a fresh run id suffixed `-replay`, and step
through with verbose logging. Until it ships, re-trigger through the
regular `/api/agent/generate` endpoint.)

## Troubleshooting

- **`modal: command not found` / auth errors.** Ensure the venv is
  activated and `modal token new` has been run at least once on this
  machine. Tokens live under `~/.modal/`.
- **Webhook returns 401 `hmac_mismatch`.** `AGENT_WEBHOOK_SECRET` in
  the Modal secret bundle does not match the Vercel env var of the
  same name. Rotate both to the same value and redeploy both sides.
  Double-check you're signing the **raw** UTF-8 body — any JSON
  re-serialization changes the bytes and invalidates the signature
  (see spec §12).
- **Internal API returns 401.** Same root cause, but for
  `AGENT_INTERNAL_SECRET`. Also confirm the `X-Agent-Run-Id` header
  matches the `runId` in the body.
- **Modal trigger returns 401.** `MODAL_AGENT_TOKEN` mismatch between
  Vercel and the Modal secret bundle.
- **Upstash queries return "namespace not found" on a brand-new
  install.** The `ARTICLE_GEN_AGENT_MEMORY` index must be created in
  the Upstash console first (1536-dim, cosine). The per-user namespace
  `user:{userId}` is auto-created on first upsert — until a user has
  published one article the dedup tool should return an empty list,
  not error. If you see the error, confirm `UPSTASH_VECTOR_REST_URL`
  points at the correct index and the token has write scope.
- **Runs hang in `status='pending'`.** Modal didn't accept the
  `spawn()` call. Check `modal app logs article-sauce-agents`; the
  most common cause is a missing key in the secret bundle (the app
  raises `KeyError` before registering handlers).
