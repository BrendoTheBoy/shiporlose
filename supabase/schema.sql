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
  stake_status text not null default 'held',
  status text not null default 'active',
  proof_url text,
  stripe_session_id text,
  payment_intent_id text,
  created_at timestamptz not null default now(),
  deadline timestamptz not null,
  review_started_at timestamptz,
  shipped_at timestamptz,
  abandoned_at timestamptz,
  constraint projects_project_name_len check (char_length(project_name) <= 30),
  constraint projects_description_len check (char_length(description) <= 100),
  constraint projects_shipped_when_len check (char_length(shipped_when) <= 100),
  constraint projects_stake_amount_check check (stake_amount = 30),
  constraint projects_stake_status_check check (stake_status in ('held', 'returned', 'forfeited')),
  constraint projects_status_check check (
    status in ('active', 'pending_review', 'flagged', 'shipped', 'abandoned')
  )
);

create unique index projects_stripe_session_id_unique
  on public.projects (stripe_session_id)
  where stripe_session_id is not null;

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

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint flags_reason_len check (char_length(reason) <= 300),
  constraint flags_project_user_unique unique (project_id, user_id)
);

create index flags_project_id_idx on public.flags (project_id);

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

create or replace function public.increment_pool_entry_fee(p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pools (month, total_amount)
  values (p_month, 10)
  on conflict (month) do update
  set total_amount = public.pools.total_amount + 10;
end;
$$;

revoke all on function public.increment_pool_entry_fee(date) from public;
grant execute on function public.increment_pool_entry_fee(date) to service_role;

create or replace function public.create_project_from_stripe_webhook(
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_user_id uuid,
  p_github_username text,
  p_project_name text,
  p_description text,
  p_shipped_when text,
  p_repo_url text,
  p_repo_full_name text,
  p_pool_month date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_in_flight int;
begin
  select id into v_id from public.projects where stripe_session_id = p_stripe_session_id limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select count(*)::int into v_in_flight from public.projects
  where user_id = p_user_id
    and status in ('active', 'pending_review', 'flagged');
  if v_in_flight > 0 then
    raise exception 'user_already_has_active_project';
  end if;

  insert into public.projects (
    user_id, github_username, project_name, description, shipped_when,
    repo_url, repo_full_name, stake_amount, stake_status, stripe_session_id,
    payment_intent_id, status
  ) values (
    p_user_id, p_github_username, p_project_name, p_description, p_shipped_when,
    p_repo_url, p_repo_full_name, 30, 'held', p_stripe_session_id,
    p_payment_intent_id, 'active'
  ) returning id into v_id;

  perform public.increment_pool_entry_fee(p_pool_month);

  return v_id;
exception
  when unique_violation then
    select id into v_id from public.projects where stripe_session_id = p_stripe_session_id limit 1;
    if v_id is not null then
      return v_id;
    end if;
    raise;
end;
$$;

revoke all on function public.create_project_from_stripe_webhook from public;
grant execute on function public.create_project_from_stripe_webhook to service_role;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.commits enable row level security;
alter table public.checkins enable row level security;
alter table public.pools enable row level security;
alter table public.flags enable row level security;

-- projects: public read; owner update; inserts via Stripe webhook only
create policy "projects_select_public"
  on public.projects for select
  using (true);

-- Inserts only via Stripe webhook (service role); users cannot bypass payment

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

create policy "flags_select_public"
  on public.flags for select
  using (true);

create policy "flags_insert_authenticated_not_owner"
  on public.flags for insert
  with check (
    auth.uid() is not null
    and auth.uid() = user_id
    and not exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
