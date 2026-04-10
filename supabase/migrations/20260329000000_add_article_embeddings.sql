-- Enable pgvector extension (idempotent)
create extension if not exists vector with schema extensions;

-- Article embeddings table for semantic similarity / dedup checks
create table if not exists public.article_embeddings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  article_id        uuid references public.articles(id) on delete cascade,
  autopilot_slot_id text,                          -- autopilot plan slot UUID (string)
  title             text not null,
  keyword           text,
  embedding_text    text not null,                 -- the text that was embedded (for debugging)
  embedding         vector(1536),                  -- text-embedding-3-small output
  created_at        timestamptz default now()
);

-- Indexes
create index if not exists article_embeddings_user_id_idx
  on public.article_embeddings (user_id);

create index if not exists article_embeddings_article_id_idx
  on public.article_embeddings (article_id)
  where article_id is not null;

-- IVFFlat index for approximate nearest-neighbor search
-- (requires at least ~100 rows to be effective; safe to create early)
create index if not exists article_embeddings_embedding_idx
  on public.article_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Unique constraints (prevent double-storing same article or slot)
create unique index if not exists article_embeddings_article_id_unique
  on public.article_embeddings (article_id)
  where article_id is not null;

create unique index if not exists article_embeddings_slot_id_unique
  on public.article_embeddings (autopilot_slot_id)
  where autopilot_slot_id is not null;

-- RLS
alter table public.article_embeddings enable row level security;

create policy "Users can read own embeddings"
  on public.article_embeddings for select
  using (auth.uid() = user_id);

create policy "Service role bypass"
  on public.article_embeddings for all
  using (true)
  with check (true);

-- match_article_embeddings: find semantically similar articles for a user
create or replace function public.match_article_embeddings(
  query_embedding   vector(1536),
  match_user_id     uuid,
  match_threshold   float default 0.85,
  match_count       int   default 5
)
returns table (
  id              uuid,
  title           text,
  keyword         text,
  similarity      float
)
language sql stable
as $$
  select
    ae.id,
    ae.title,
    ae.keyword,
    1 - (ae.embedding <=> query_embedding) as similarity
  from public.article_embeddings ae
  where ae.user_id = match_user_id
    and 1 - (ae.embedding <=> query_embedding) > match_threshold
  order by ae.embedding <=> query_embedding
  limit match_count;
$$;
