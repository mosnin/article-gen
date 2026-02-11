-- Scheduled articles table: stores queued articles for background generation + publishing
create table if not exists scheduled_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null,
  focus_keyword text default '',
  quality text not null default 'premium' check (quality in ('standard', 'premium')),
  generate_images boolean default false,
  auto_publish boolean default false,
  publish_status text default 'draft' check (publish_status in ('draft', 'publish')),
  wp_blog_id text,
  category_ids integer[] default '{}',

  -- Scheduling
  scheduled_for timestamptz not null,
  recurrence text default 'one_time' check (recurrence in ('one_time', 'daily', 'weekly')),
  recurrence_day integer, -- 0=Sun..6=Sat for weekly recurrence

  -- Processing state
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  article_id uuid references articles(id) on delete set null,
  error_message text,
  attempts integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table scheduled_articles enable row level security;

create policy "Users can view own schedules" on scheduled_articles
  for select using (auth.uid() = user_id);

create policy "Users can insert own schedules" on scheduled_articles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own schedules" on scheduled_articles
  for update using (auth.uid() = user_id);

create policy "Users can delete own schedules" on scheduled_articles
  for delete using (auth.uid() = user_id);

-- Service role needs full access for the edge function (bypasses RLS automatically)
-- Admins can view all
create policy "Admins can view all schedules" on scheduled_articles
  for select using (is_admin());

-- Indexes
create index if not exists idx_scheduled_articles_user_id on scheduled_articles(user_id);
create index if not exists idx_scheduled_articles_status on scheduled_articles(status);
create index if not exists idx_scheduled_articles_scheduled_for on scheduled_articles(scheduled_for);
create index if not exists idx_scheduled_articles_status_scheduled on scheduled_articles(status, scheduled_for);
