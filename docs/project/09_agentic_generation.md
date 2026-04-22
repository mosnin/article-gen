# Agentic Article Generation — Architecture & Contract

Authoritative spec for the agent-based article generation subsystem.
All implementation agents (and humans) reference this file for exact
interfaces, paths, and contracts. Changes here require updating dependent
modules.

Branch: `claude/agentic-article-generation-u1G85`

---

## 1. Goals

- Replace the hand-coded, sequential `/api/generate/*` pipeline with an
  **agent harness** as the primary article-generation path.
- Use **OpenAI Agents SDK (Python)** for the harness / orchestration.
- Use **Modal** to host the agent functions as long-running tasks.
- Reuse every existing building block (SERP analyzer, credits, DALL-E +
  Supabase storage, multi-platform publish) as **tools** — do not
  re-implement.
- Real-time UX: the UI streams each tool call and message like Claude
  Code.
- Autonomous mode: the same pipeline runs unattended on a schedule
  (rewiring the existing autopilot cron).
- Cross-run deduplication: external vector store prevents the agent from
  regenerating the same angle.

## 2. High-level architecture

```
┌──────────────────┐        trigger (HTTPS + HMAC)         ┌─────────────────────────┐
│  Next.js app     │ ───────────────────────────────────►  │  Modal app              │
│  (Vercel)        │                                       │  article-sauce-agents   │
│                  │ ◄──── webhook (HMAC, progress) ─────  │                         │
│  /api/agent/*    │ ◄──── internal tool calls (HMAC) ──── │  OpenAI Agents SDK      │
│  Supabase JS     │                                       │  Orchestrator + subs    │
└──────────────────┘                                       └─────────────────────────┘
        │                                                           │
        │ Supabase Realtime (WS)                                    │ Upstash Vector
        ▼                                                           ▼
┌──────────────────┐                                       ┌─────────────────────────┐
│  Browser client  │                                       │  Upstash Vector         │
│  streams steps   │                                       │  (dedup / semantic      │
│  live            │                                       │   memory)               │
└──────────────────┘                                       └─────────────────────────┘
```

## 3. Repository layout

```
agents/                              # new Python package (Modal app)
  pyproject.toml
  modal_app.py                       # Modal App + web endpoint + entrypoint
  config.py                          # env vars, model ids, limits
  requirements.txt
  harness/
    __init__.py
    orchestrator.py                  # top-level Agent + run_article_agent()
    sessions.py                      # Session wrapper + rot guards
    pool.py                          # SubAgentPool for async fan-out
    progress.py                      # emit events → /api/agent/webhook + DB
    models.py                        # pydantic types for inputs/outputs
    subagents/
      __init__.py
      research.py                    # ResearchAgent (Exa SERP + dedup check)
      outline.py                     # OutlineAgent
      writer.py                      # WriterAgent (section fan-out capable)
      metadata.py                    # MetadataAgent (title/slug/meta/keywords)
      images.py                      # ImageAgent (prompts + DALL-E)
      qa.py                          # QAAgent (keyword density, E-E-A-T)
      publish.py                     # PublishAgent (multi-platform batch)
    tools/
      __init__.py
      db.py                          # agent_runs updates (service-role)
      exa.py                         # SERP research
      openai_tools.py                # chat / structured outputs helpers
      dalle.py                       # DALL-E-3 calls
      storage.py                     # Supabase storage upload
      http.py                        # signed internal /api/internal/* calls
      embeddings.py                  # OpenAI embeddings + Upstash upsert/query
      publish.py                     # wraps /api/internal/publish
      uniqueness.py                  # Upstash vector dedup
  README.md                          # deploy + local dev

src/
  app/api/agent/
    generate/route.ts                # POST trigger agent run
    webhook/route.ts                 # POST progress/completion (HMAC)
    runs/route.ts                    # GET list user's runs
    runs/[id]/route.ts               # GET single run (with events)
    runs/[id]/cancel/route.ts        # POST cancel run
    runs/[id]/stream/route.ts        # GET SSE fallback stream
    autonomous/route.ts              # GET/POST autonomous schedules
    autonomous/schedule/route.ts     # POST trigger autonomous run now

  app/api/internal/                  # Modal-callable, HMAC-guarded
    save-article/route.ts
    update-article/route.ts
    upload-image/route.ts            # base64 → Supabase storage
    check-credits/route.ts
    deduct-credit/route.ts
    check-uniqueness/route.ts        # queries Upstash
    upsert-uniqueness/route.ts       # inserts post-completion
    publish-article/route.ts         # wraps existing batch publish
    serp-analyze/route.ts            # wraps analyzeSERP
    research-niche/route.ts          # wraps researchNicheContent

  app/app/
    generate/page.tsx                # (modified) adds agent mode toggle
    agent-runs/page.tsx              # (new) list of runs
    agent-runs/[id]/page.tsx         # (new) detail view with live stream
    autonomous/page.tsx              # (new) autonomous schedules dashboard

  components/
    agent-stream/
      AgentStream.tsx                # top-level live view (WS via Realtime)
      StepEvent.tsx                  # single step row (tool call / msg / result)
      StreamingCursor.tsx            # blinking cursor for in-flight steps
      SubagentBadge.tsx              # colored pill per subagent
    layout/
      sidebar.tsx                    # (modified) adds Agents / Autonomous nav

  hooks/
    useAgentRun.ts                   # Supabase Realtime subscription + SSE fallback

  lib/
    modal-client.ts                  # fetch-based Modal trigger + HMAC sign
    agent-auth.ts                    # HMAC sign/verify helpers
    upstash-vector.ts                # lightweight Upstash REST client
    agent-runs.ts                    # DB helpers for agent_runs

  inngest/
    agent-article-generate.ts        # (new) wraps Modal trigger with retries
    generate-autopilot-article.ts    # (modified) now dispatches to agents

supabase/migrations/
  20260422000000_agent_runs.sql      # agent_runs + agent_events tables + RLS + realtime

scripts/
  deploy-agents.sh                   # modal deploy
  dev-agents.sh                      # modal serve (live reload)

docs/project/
  09_agentic_generation.md           # this file
```

## 4. Database schema

```sql
-- agent_runs: one row per user-initiated or autonomous generation
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'article'
    check (kind in ('article','autopilot','cluster','research_only')),
  status text not null default 'pending'
    check (status in ('pending','running','succeeded','failed','cancelled')),
  modal_call_id text,
  topic text not null,
  focus_keyword text,
  tone text,
  target_audience text,
  quality text not null default 'standard'
    check (quality in ('standard','premium')),
  input jsonb not null default '{}'::jsonb,     -- full trigger payload
  output jsonb,                                  -- final {articleId, ...}
  options jsonb not null default '{}'::jsonb,    -- {wpBlogId, autoPublish, imageCount, platforms[]}
  current_step text,
  current_agent text,
  progress_pct int not null default 0,
  error text,
  article_id uuid references public.articles(id) on delete set null,
  autopilot_slot_id text,
  credits_charged int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_agent_runs_user_id on public.agent_runs(user_id);
create index idx_agent_runs_status on public.agent_runs(status);
create index idx_agent_runs_created_at on public.agent_runs(created_at desc);

-- agent_events: append-only timeline per run (for live streaming)
create table public.agent_events (
  id bigserial primary key,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  seq int not null,                              -- monotonic per run
  kind text not null
    check (kind in ('run_started','run_completed','run_failed','agent_started','agent_ended',
                    'tool_started','tool_ended','message','handoff','progress','warning')),
  agent_name text,
  tool_name text,
  message text,
  payload jsonb,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index idx_agent_events_run_seq on public.agent_events(run_id, seq);

-- RLS
alter table public.agent_runs enable row level security;
alter table public.agent_events enable row level security;

create policy "users select own runs" on public.agent_runs
  for select using (auth.uid() = user_id);
create policy "users insert own runs" on public.agent_runs
  for insert with check (auth.uid() = user_id);
-- updates only via service role (Modal webhook), no user policy

create policy "users select own events" on public.agent_events
  for select using (
    exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = auth.uid())
  );

-- Realtime publication
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.agent_events;
```

## 5. Agent topology

**Orchestrator** (GPT-4.1): owns the article plan, delegates to subagents,
keeps context lean. Has one tool: `invoke_subagent(name, brief)` plus
`list_subagents`, `set_status`, and `check_past_work`.

**Subagents** (each a `from agents import Agent`, fresh context):

| Name | Model | Purpose | Key tools |
|---|---|---|---|
| ResearchAgent | gpt-4.1-mini | SERP, competitor gaps, dedup check | `serp_analyze`, `research_niche`, `find_similar_past_articles` |
| OutlineAgent | gpt-4.1-mini | Structured outline from research | `generate_outline_json` |
| WriterAgent | gpt-4.1 | Write article body, section-by-section | `write_section`, `interlink_suggest` |
| MetadataAgent | gpt-4.1-mini | Title, slug, meta description, keywords, schema.org | `generate_metadata_json`, `generate_schema_json` |
| ImageAgent | gpt-4.1-mini | Image prompts + DALL-E + upload | `generate_image_prompts`, `generate_image` |
| QAAgent | gpt-4.1-mini | Keyword density, E-E-A-T, no em-dash rule | `score_article` |
| PublishAgent | gpt-4.1-mini | Optional multi-platform publish | `publish_article` |

All subagents have `emit_progress(...)` available for free-form status.
The orchestrator uses `SubAgentPool` to fan-out when it wants parallelism
(e.g. metadata + images simultaneously).

## 6. Tool catalog (Python signatures)

All tools are `@function_tool`-decorated. Names match exactly.

```python
# research
serp_analyze(keyword: str, num_results: int = 10) -> SerpAnalysis
research_niche(niche: str, num_results: int = 20) -> NicheResearch
find_similar_past_articles(user_id: str, topic: str, keyword: str, k: int = 5) -> list[SimilarArticle]

# writing
write_section(heading: str, notes: str, context: SectionContext) -> str  # markdown
generate_outline_json(topic: str, keyword: str, research: dict, tone: str, audience: str) -> Outline
generate_metadata_json(topic: str, keyword: str, article_md: str, tone: str) -> Metadata
generate_schema_json(article: FinalArticle) -> str  # JSON-LD string
interlink_suggest(user_id: str, article_md: str) -> list[InterlinkSuggestion]

# images
generate_image_prompts(title: str, keyword: str, article_md: str, count: int = 4) -> list[ImagePrompt]
generate_image(user_id: str, article_id: str, prompt: str, alt_text: str) -> GeneratedImage

# persistence & flow
save_article(payload: ArticleSavePayload) -> SavedArticleRef
update_article(article_id: str, patch: dict) -> None
check_credits(user_id: str, amount: int = 1) -> CreditsStatus
deduct_credit(user_id: str, article_id: str | None, description: str) -> int  # new balance
upsert_uniqueness_vector(user_id: str, article_id: str, title: str, keyword: str, topic: str, outline: list[str]) -> None

# publish
publish_article(user_id: str, article_id: str, platforms: list[PlatformTarget]) -> PublishResult

# quality
score_article(article_md: str, focus_keyword: str) -> QualityScore

# progress
emit_progress(run_id: str, kind: str, message: str, payload: dict | None = None, agent_name: str | None = None, tool_name: str | None = None) -> None
```

## 7. API contracts

### 7.1 Trigger — `POST /api/agent/generate`

Auth: user session (Supabase cookie).

Request:
```ts
{
  kind: 'article' | 'autopilot' | 'cluster' | 'research_only',
  topic: string,
  focusKeyword?: string,
  tone?: string,
  targetAudience?: string,
  quality?: 'standard' | 'premium',
  options?: {
    imageCount?: number,             // default 4
    autoPublish?: boolean,
    platforms?: Array<{ kind: 'wordpress'|'ghost'|'medium'|'shopify'|'devto', id: string }>,
    maxSimilar?: number,             // override dedup threshold sample size
    dedupThreshold?: number          // 0..1, default 0.88
  }
}
```

Response: `{ runId: string, status: 'pending' }`

Actions:
1. `checkCredits(userId, quality === 'premium' ? 3 : 1)`; 402 if insufficient.
2. `acquireGenerationSlot(userId)`; 429 if no slot.
3. Insert `agent_runs` row.
4. Call `modal-client.ts` → POST to `MODAL_AGENT_TRIGGER_URL` with HMAC.
5. Store returned `modalCallId` on the row.
6. Return `{ runId }`.

### 7.2 Webhook — `POST /api/agent/webhook`

Auth: `X-Signature: sha256=<hex>` HMAC over raw body with
`AGENT_WEBHOOK_SECRET`. `X-Agent-Run-Id` header required.

Request: a single event
```ts
{
  runId: string,
  seq: number,                       // monotonic per run, orderable
  kind: 'run_started'|'run_completed'|'run_failed'|'agent_started'|'agent_ended'
      | 'tool_started'|'tool_ended'|'message'|'handoff'|'progress'|'warning',
  agentName?: string,
  toolName?: string,
  message?: string,
  payload?: any,
  durationMs?: number,
  statusUpdate?: {                   // set if kind in run_* or progress
    status?: 'running'|'succeeded'|'failed'|'cancelled',
    progressPct?: number,
    currentStep?: string,
    currentAgent?: string,
    error?: string,
    articleId?: string,
    output?: any
  },
  at: string                         // ISO 8601
}
```

Response: `{ ok: true }`

Actions:
1. Verify HMAC + X-Agent-Run-Id matches body.
2. Insert into `agent_events`.
3. If `statusUpdate` present, UPDATE `agent_runs` (Realtime broadcasts).

### 7.3 Runs — `GET /api/agent/runs/[id]`

Auth: user session; RLS protects.
Response: `{ run: AgentRun, events: AgentEvent[] }` (most recent 200
events). For older events the UI paginates via `?beforeSeq=<n>`.

### 7.4 SSE fallback — `GET /api/agent/runs/[id]/stream`

Server-Sent Events. Emits `event: step` data frames as `agent_events`
rows arrive. For clients that can't use Supabase Realtime WebSocket
(e.g. behind a proxy).

### 7.5 Internal API (Modal → Next.js)

All accept a shared-secret header:
```
Authorization: Bearer ${AGENT_INTERNAL_SECRET}
X-Agent-Run-Id: <runId>
X-Signature: sha256=<hex HMAC over raw body with AGENT_INTERNAL_SECRET>
```

| Endpoint | Purpose |
|---|---|
| `POST /api/internal/save-article` | Insert row in `articles` (uses service role) |
| `POST /api/internal/update-article` | Patch by id |
| `POST /api/internal/upload-image` | `{userId, articleId, filename, base64Png}` → `{storagePath, publicUrl}` |
| `POST /api/internal/check-credits` | `{userId, amount}` → `{ok, credits}` |
| `POST /api/internal/deduct-credit` | `{userId, articleId?, description}` → `{credits}` |
| `POST /api/internal/check-uniqueness` | `{userId, topic, keyword, k?}` → `{similar: [...]}` (queries Upstash) |
| `POST /api/internal/upsert-uniqueness` | `{userId, articleId, title, keyword, topic, outline[]}` → `{ok}` |
| `POST /api/internal/publish-article` | `{userId, articleId, platforms}` → existing batch publish response |
| `POST /api/internal/serp-analyze` | `{keyword, numResults?}` → SERP analysis |
| `POST /api/internal/research-niche` | `{niche, options?}` → Exa research |

### 7.6 Modal trigger — `POST ${MODAL_AGENT_TRIGGER_URL}`

Auth: `X-Signature: sha256=<hex HMAC over raw body with MODAL_AGENT_TOKEN>`.

Request: full `agent_runs.input` payload plus `runId`, `userId`, plus
`webhookUrl` (so Modal knows where to call back — usually
`${NEXT_PUBLIC_APP_URL}/api/agent/webhook`) and `internalApiBase`
(`${NEXT_PUBLIC_APP_URL}/api/internal`).

Response: `{ modalCallId: string }` (returned immediately via
`spawn()`).

## 8. Real-time streaming to the browser

Primary path: **Supabase Realtime** (native WebSocket).

```ts
// src/hooks/useAgentRun.ts
const channel = supabase
  .channel(`agent-run-${runId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'agent_runs', filter: `id=eq.${runId}` },
    (p) => setRun(p.new))
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'agent_events', filter: `run_id=eq.${runId}` },
    (p) => setEvents((e) => [...e, p.new]))
  .subscribe();
```

Fallback path: **SSE** (`/api/agent/runs/[id]/stream`) — used if the
hook detects the Realtime channel is not connecting within 3 seconds.

The UI renders each event like Claude Code's tool indicators:
- `agent_started` → subagent pill lights up
- `tool_started` → tool row with spinner; shows truncated `payload` preview
- `tool_ended` → spinner → check, `durationMs` appended
- `message` → markdown bubble under the agent
- `handoff` → arrow line between subagents
- `run_completed` → full summary + link to `/app/articles/[id]`

## 9. Dedup / semantic memory (Upstash Vector)

**Why Upstash Vector, not Supabase pgvector:**
- HTTP REST, no connection pooling needed (fits Vercel + Modal).
- Serverless pricing — only pay for requests.
- Keeps Supabase row sizes small; Supabase is already carrying
  the primary `article_embeddings` table for cluster/cannibalization
  checks. The agent dedup use case is a separate concern with a
  different record shape and retention policy — putting it in its own
  store prevents schema coupling.

**Upstash index layout:** one index, namespace per user.

```
index:    ARTICLE_GEN_AGENT_MEMORY
namespace: user:{userId}

id: article:{articleId}   (or run:{runId} for research-only runs)
vector: OpenAI text-embedding-3-small, 1536-d
metadata: {
  userId, articleId, runId, title, keyword, topic,
  outlineHeadings: [string],
  createdAt: ISO,
  clusterId?: string
}
```

**Embedding input** (per row):
```
`${title}\n${keyword}\n${topic}\n${outlineHeadings.join(" | ")}`
```

**Flow:**
1. On run start, orchestrator calls `find_similar_past_articles(user_id, topic, keyword, k=5)`.
2. Tool embeds `${topic}\n${keyword}`, queries Upstash namespace
   `user:{userId}`, returns top-K with scores.
3. Orchestrator injects the list into subsequent prompts:
   - If top score ≥ `dedupThreshold` (default 0.88), it must either:
     - pick a distinct angle (re-run research with an "avoid these
       angles" hint) **or**
     - emit `warning` event and abort with `kind='run_failed'`,
       `error='too_similar'`.
3. On successful completion, orchestrator (or save-article webhook)
   calls `upsert_uniqueness_vector(...)` to store the new vector.

All upsert / query calls go through `/api/internal/{check,upsert}-uniqueness`
on the Next.js side so the Upstash token never ships to Modal.

## 10. Autonomous mode

- New page `/app/autonomous` lists user's autonomous schedules.
- Each schedule: `{ id, userId, name, cadence, niche, tone, targetAudience,
  platforms, status, nextRunAt }`. Stored in `user_settings.autonomous_schedules`
  JSONB (keeps migration small).
- `autopilot-cron.ts` is extended: for any schedule whose `nextRunAt <=
  now`, it sends `agent/article.generate` Inngest event.
- The existing `generate-autopilot-article.ts` Inngest function is
  **rewritten** to dispatch to the agent pipeline instead of calling
  OpenAI directly — single source of truth.
- Runs show up in the same `/app/agent-runs` feed with `kind='autopilot'`.

## 11. Environment variables

Append to `.env.example`:

```bash
# Modal (agent harness host)
MODAL_AGENT_TRIGGER_URL=https://<org>--article-sauce-agents-trigger.modal.run
MODAL_AGENT_TOKEN=<random-64-hex>        # HMAC shared with Modal

# Webhook callback secret (Modal → Next.js /api/agent/webhook)
AGENT_WEBHOOK_SECRET=<random-64-hex>

# Internal API secret (Modal → Next.js /api/internal/*)
AGENT_INTERNAL_SECRET=<random-64-hex>

# Upstash Vector (agent semantic memory / dedup)
UPSTASH_VECTOR_REST_URL=https://<name>.upstash.io
UPSTASH_VECTOR_REST_TOKEN=<token>

# Exa — already used via exa-js on server; Modal side also needs it
EXA_API_KEY=<exa-key>

# Public app URL — used by Modal to call back
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

Modal secret bundle (`modal secret create article-sauce-agents`):

| Key | Source |
|---|---|
| OPENAI_API_KEY | same as Next.js |
| SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL |
| SUPABASE_SERVICE_ROLE_KEY | same |
| EXA_API_KEY | same |
| UPSTASH_VECTOR_REST_URL | same |
| UPSTASH_VECTOR_REST_TOKEN | same |
| AGENT_WEBHOOK_SECRET | same |
| AGENT_INTERNAL_SECRET | same |
| MODAL_AGENT_TOKEN | same |
| APP_URL | NEXT_PUBLIC_APP_URL |

## 12. HMAC sign / verify reference

Both sides use the same algorithm.

```
signature = "sha256=" + hex(HMAC_SHA256(secret, raw_utf8_body))
```

- Body is the **raw** request bytes. No whitespace normalization.
- Verify with constant-time compare (`crypto.timingSafeEqual` on the
  TS side, `hmac.compare_digest` in Python).

## 13. Deploy & run

```bash
# one-time
cd agents && pip install -r requirements.txt
modal secret create article-sauce-agents <...>

# local dev (hot reload)
./scripts/dev-agents.sh        # modal serve agents/modal_app.py

# production
./scripts/deploy-agents.sh     # modal deploy agents/modal_app.py
```

## 14. Non-goals (this pass)

- Streaming token-level output from the writer (future: route OpenAI
  deltas through the same webhook as `message` events).
- Cost telemetry dashboard.
- Human-in-the-loop approval gates.
