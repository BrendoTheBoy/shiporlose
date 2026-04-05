-- Tighten projects UPDATE RLS: owners may only change proof_url and payout_email directly.
-- State transitions use security-definer RPCs claim_shipped / submit_payout_email.

-- ---------------------------------------------------------------------------
-- Security definer RPCs (bypass RLS; enforce rules in SQL)
-- ---------------------------------------------------------------------------

create or replace function public.claim_shipped(p_project_id uuid, p_proof_url text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  v_deadline timestamptz;
  v_trimmed text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_trimmed := trim(p_proof_url);
  if v_trimmed is null or length(v_trimmed) = 0 then
    raise exception 'invalid proof_url';
  end if;
  if not (v_trimmed like 'http://%' or v_trimmed like 'https://%') then
    raise exception 'invalid proof_url';
  end if;

  select user_id, status, deadline into v_owner, v_status, v_deadline
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'project not found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not_owner';
  end if;

  if v_status <> 'active' then
    raise exception 'invalid status';
  end if;

  if now() >= v_deadline then
    raise exception 'deadline passed';
  end if;

  update public.projects
  set
    status = 'pending_review',
    proof_url = v_trimmed,
    review_started_at = now()
  where id = p_project_id;

  return p_project_id;
end;
$$;

revoke all on function public.claim_shipped(uuid, text) from public;
grant execute on function public.claim_shipped(uuid, text) to authenticated;

create or replace function public.submit_payout_email(p_project_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  v_trimmed text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_trimmed := trim(p_email);
  if v_trimmed is null or position('@' in v_trimmed) = 0 then
    raise exception 'invalid email';
  end if;

  select user_id, status into v_owner, v_status
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'project not found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not_owner';
  end if;

  if v_status <> 'shipped' then
    raise exception 'invalid status';
  end if;

  update public.projects
  set payout_email = v_trimmed
  where id = p_project_id;
end;
$$;

revoke all on function public.submit_payout_email(uuid, text) from public;
grant execute on function public.submit_payout_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: replace broad owner UPDATE with safe-column-only policy
-- ---------------------------------------------------------------------------

drop policy if exists "projects_update_owner" on public.projects;

create policy "projects_update_owner_safe_fields"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and id is not distinct from (select p.id from public.projects p where p.id = id)
    and user_id is not distinct from (select p.user_id from public.projects p where p.id = id)
    and github_username is not distinct from (select p.github_username from public.projects p where p.id = id)
    and project_name is not distinct from (select p.project_name from public.projects p where p.id = id)
    and description is not distinct from (select p.description from public.projects p where p.id = id)
    and shipped_when is not distinct from (select p.shipped_when from public.projects p where p.id = id)
    and repo_url is not distinct from (select p.repo_url from public.projects p where p.id = id)
    and repo_full_name is not distinct from (select p.repo_full_name from public.projects p where p.id = id)
    and stake_amount is not distinct from (select p.stake_amount from public.projects p where p.id = id)
    and stake_status is not distinct from (select p.stake_status from public.projects p where p.id = id)
    and status is not distinct from (select p.status from public.projects p where p.id = id)
    and proof_url is not distinct from (select p.proof_url from public.projects p where p.id = id)
    and stripe_session_id is not distinct from (select p.stripe_session_id from public.projects p where p.id = id)
    and payment_intent_id is not distinct from (select p.payment_intent_id from public.projects p where p.id = id)
    and created_at is not distinct from (select p.created_at from public.projects p where p.id = id)
    and deadline is not distinct from (select p.deadline from public.projects p where p.id = id)
    and review_started_at is not distinct from (select p.review_started_at from public.projects p where p.id = id)
    and shipped_at is not distinct from (select p.shipped_at from public.projects p where p.id = id)
    and abandoned_at is not distinct from (select p.abandoned_at from public.projects p where p.id = id)
    and payout_sent is not distinct from (select p.payout_sent from public.projects p where p.id = id)
    and payout_amount is not distinct from (select p.payout_amount from public.projects p where p.id = id)
    and (
      payout_email is not distinct from (select p.payout_email from public.projects p where p.id = id)
      or (select p.status from public.projects p where p.id = id) = 'shipped'
    )
  );
