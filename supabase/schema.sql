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
  wp_blog_id text,
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
  wp_url text default '',
  wp_username text default '',
  wp_app_password text default '',
  wp_blogs jsonb default '[]',
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

-- User profiles: role and credit tracking
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  credits integer not null default 10,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_plan text not null default 'free' check (subscription_plan in ('free', 'starter', 'growth', 'pro')),
  subscription_status text default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Credit usage log
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  amount integer not null,
  type text not null check (type in ('usage', 'purchase', 'subscription_reset', 'admin_grant', 'refund')),
  description text,
  article_id uuid references articles(id) on delete set null,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;
alter table credit_transactions enable row level security;

-- SECURITY DEFINER function to check admin role without triggering RLS recursion
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_profiles where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Users can read their own profile
create policy "Users can view own profile" on user_profiles
  for select using (auth.uid() = user_id);

-- Users can insert their own profile (on first login)
create policy "Users can insert own profile" on user_profiles
  for insert with check (auth.uid() = user_id);

-- Users can update their own profile (limited fields handled by app logic)
create policy "Users can update own profile" on user_profiles
  for update using (auth.uid() = user_id);

-- Admins can view all profiles (uses SECURITY DEFINER function to avoid RLS recursion)
create policy "Admins can view all profiles" on user_profiles
  for select using (is_admin());

-- Admins can update all profiles (for granting credits, etc.)
create policy "Admins can update all profiles" on user_profiles
  for update using (is_admin());

-- Credit transaction policies
create policy "Users can view own transactions" on credit_transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on credit_transactions
  for insert with check (auth.uid() = user_id);

-- Admins can view all transactions
create policy "Admins can view all transactions" on credit_transactions
  for select using (is_admin());

-- Admins can insert transactions for any user
create policy "Admins can insert any transaction" on credit_transactions
  for insert with check (is_admin());

-- Admin policies for articles (view all)
create policy "Admins can view all articles" on articles
  for select using (is_admin());

-- Admin policies for clusters (view all)
create policy "Admins can view all clusters" on clusters
  for select using (is_admin());

-- Index for faster queries
create index if not exists idx_articles_user_id on articles(user_id);
create index if not exists idx_articles_cluster_id on articles(cluster_id);
create index if not exists idx_clusters_user_id on clusters(user_id);
create index if not exists idx_user_settings_user_id on user_settings(user_id);
create index if not exists idx_user_profiles_user_id on user_profiles(user_id);
create index if not exists idx_user_profiles_stripe_customer on user_profiles(stripe_customer_id);
create index if not exists idx_credit_transactions_user_id on credit_transactions(user_id);
