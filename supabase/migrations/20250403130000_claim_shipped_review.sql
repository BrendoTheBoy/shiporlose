-- Claim Shipped: review window, flags table, project timestamps

-- ---------------------------------------------------------------------------
-- projects: status values + timestamps
-- ---------------------------------------------------------------------------

alter table public.projects drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (
    status in ('active', 'pending_review', 'flagged', 'shipped', 'abandoned')
  );

alter table public.projects add column if not exists review_started_at timestamptz;
alter table public.projects add column if not exists shipped_at timestamptz;
alter table public.projects add column if not exists abandoned_at timestamptz;

-- ---------------------------------------------------------------------------
-- flags
-- ---------------------------------------------------------------------------

create table if not exists public.flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint flags_reason_len check (char_length(reason) <= 300),
  constraint flags_project_user_unique unique (project_id, user_id)
);

create index if not exists flags_project_id_idx on public.flags (project_id);

alter table public.flags enable row level security;

drop policy if exists "flags_select_public" on public.flags;
create policy "flags_select_public"
  on public.flags for select
  using (true);

drop policy if exists "flags_insert_authenticated_not_owner" on public.flags;
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

-- ---------------------------------------------------------------------------
-- Stripe webhook: one in-flight project per user (active, review, or flagged)
-- ---------------------------------------------------------------------------

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
