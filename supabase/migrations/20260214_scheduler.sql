-- Scheduler feature tables

create table if not exists blog_schedulers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  wp_blog_id text not null,
  interval_minutes integer not null default 60 check (interval_minutes >= 15),
  active boolean not null default false,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, wp_blog_id)
);

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  wp_blog_id text not null,
  topic text not null,
  focus_keyword text default '',
  quality text not null default 'premium' check (quality in ('standard', 'premium')),
  with_images boolean not null default false,
  schedule_type text not null default 'interval' check (schedule_type in ('interval', 'calendar')),
  scheduled_for timestamptz,
  queue_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table blog_schedulers enable row level security;
alter table scheduled_posts enable row level security;

create policy "Users can view own blog schedulers" on blog_schedulers
  for select using (auth.uid() = user_id);
create policy "Users can insert own blog schedulers" on blog_schedulers
  for insert with check (auth.uid() = user_id);
create policy "Users can update own blog schedulers" on blog_schedulers
  for update using (auth.uid() = user_id);
create policy "Users can delete own blog schedulers" on blog_schedulers
  for delete using (auth.uid() = user_id);

create policy "Users can view own scheduled posts" on scheduled_posts
  for select using (auth.uid() = user_id);
create policy "Users can insert own scheduled posts" on scheduled_posts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own scheduled posts" on scheduled_posts
  for update using (auth.uid() = user_id);
create policy "Users can delete own scheduled posts" on scheduled_posts
  for delete using (auth.uid() = user_id);

create index if not exists idx_blog_schedulers_user_blog on blog_schedulers(user_id, wp_blog_id);
create index if not exists idx_scheduled_posts_user_blog on scheduled_posts(user_id, wp_blog_id);
create index if not exists idx_scheduled_posts_status on scheduled_posts(status, scheduled_for);
