-- Article Sauce Database Schema
-- Run this in your Supabase SQL Editor

-- Articles table: stores individual generated articles
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null,
  focus_keyword text,
  quality text not null default 'premium',
  title text,
  meta_description text,
  slug text,
  keywords text[] default '{}',
  article_markdown text,
  image_prompts jsonb default '[]',
  schema_json text,
  posted boolean default false,
  cluster_id uuid,
  is_pillar boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Topic clusters table
create table if not exists clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  pillar_topic text not null,
  pillar_keyword text,
  quality text not null default 'premium',
  pillar_article_id uuid references articles(id) on delete set null,
  existing_pillar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add foreign key for cluster_id on articles
alter table articles
  add constraint fk_articles_cluster
  foreign key (cluster_id) references clusters(id) on delete cascade;

-- Advanced settings per user
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  domain text default '',
  site_name text default '',
  site_about text default '',
  author_name text default '',
  author_about text default '',
  updated_at timestamptz default now()
);

-- Row Level Security
alter table articles enable row level security;
alter table clusters enable row level security;
alter table user_settings enable row level security;

-- Policies: users can only access their own data
create policy "Users can view own articles" on articles
  for select using (auth.uid() = user_id);

create policy "Users can insert own articles" on articles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own articles" on articles
  for update using (auth.uid() = user_id);

create policy "Users can delete own articles" on articles
  for delete using (auth.uid() = user_id);

create policy "Users can view own clusters" on clusters
  for select using (auth.uid() = user_id);

create policy "Users can insert own clusters" on clusters
  for insert with check (auth.uid() = user_id);

create policy "Users can update own clusters" on clusters
  for update using (auth.uid() = user_id);

create policy "Users can delete own clusters" on clusters
  for delete using (auth.uid() = user_id);

create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);

-- Index for faster queries
create index if not exists idx_articles_user_id on articles(user_id);
create index if not exists idx_articles_cluster_id on articles(cluster_id);
create index if not exists idx_clusters_user_id on clusters(user_id);
create index if not exists idx_user_settings_user_id on user_settings(user_id);
