-- ShipOrLose — run in Supabase SQL editor (or migrate via CLI)
-- Enable pgcrypto for gen_random_uuid (usually enabled on Supabase)

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  github_username text not null,
  project_name text not null,
  description text not null,
  shipped_when text not null,
  repo_url text not null,
  repo_full_name text not null,
  stake_amount integer not null,
  status text not null default 'active',
  proof_url text,
  created_at timestamptz not null default now(),
  deadline timestamptz not null,
  constraint projects_project_name_len check (char_length(project_name) <= 30),
  constraint projects_description_len check (char_length(description) <= 100),
  constraint projects_shipped_when_len check (char_length(shipped_when) <= 100),
  constraint projects_stake_amount_check check (stake_amount in (20, 30, 50)),
  constraint projects_status_check check (status in ('active', 'shipped', 'abandoned'))
);

create table public.commits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sha text not null,
  message text not null,
  committed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint commits_sha_unique unique (sha)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint checkins_content_len check (char_length(content) <= 200)
);

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  total_amount integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint pools_status_check check (status in ('active', 'completed'))
);

-- ---------------------------------------------------------------------------
-- Deadline = created_at + 30 days (set on insert)
-- ---------------------------------------------------------------------------

create or replace function public.set_project_deadline()
returns trigger
language plpgsql
as $$
begin
  new.deadline := coalesce(new.deadline, new.created_at + interval '30 days');
  return new;
end;
$$;

create trigger trg_projects_deadline
  before insert on public.projects
  for each row
  execute function public.set_project_deadline();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.commits enable row level security;
alter table public.checkins enable row level security;
alter table public.pools enable row level security;

-- projects: public read; owner insert/update
create policy "projects_select_public"
  on public.projects for select
  using (true);

create policy "projects_insert_owner"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_owner"
  on public.projects for update
  using (auth.uid() = user_id);

-- commits: public read; owner of project can insert
create policy "commits_select_public"
  on public.commits for select
  using (true);

create policy "commits_insert_project_owner"
  on public.commits for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- checkins: public read; project owner can insert own rows
create policy "checkins_select_public"
  on public.checkins for select
  using (true);

create policy "checkins_insert_owner"
  on public.checkins for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- pools: anyone can read; only service role can write (no policies for insert/update/delete for authenticated users)
create policy "pools_select_public"
  on public.pools for select
  using (true);
