-- Stripe payment: project columns, stake constraint, RLS (insert only via service role / webhook)

alter table public.projects
  drop constraint if exists projects_stake_amount_check;

update public.projects set stake_amount = 30 where stake_amount is distinct from 30;

alter table public.projects
  add constraint projects_stake_amount_check check (stake_amount = 30);

alter table public.projects
  add column if not exists stake_status text not null default 'held';

alter table public.projects
  add constraint projects_stake_status_check
  check (stake_status in ('held', 'returned', 'forfeited'));

alter table public.projects
  add column if not exists stripe_session_id text;

alter table public.projects
  add column if not exists payment_intent_id text;

create unique index if not exists projects_stripe_session_id_unique
  on public.projects (stripe_session_id)
  where stripe_session_id is not null;

drop policy if exists "projects_insert_owner" on public.projects;

-- Atomic pool update from webhook (avoids race on concurrent checkouts)
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
  v_active int;
begin
  select id into v_id from public.projects where stripe_session_id = p_stripe_session_id limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select count(*)::int into v_active from public.projects
  where user_id = p_user_id and status = 'active';
  if v_active > 0 then
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
