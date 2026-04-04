-- Store GitHub OAuth access tokens for server-side commit sync (Edge Functions use service role).
-- RLS enabled with no policies: anon/authenticated have no direct access; only service_role bypasses RLS.
-- Clients call upsert_github_token() (security definer) to write their own row.

create table public.github_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.github_tokens enable row level security;

revoke all on table public.github_tokens from public;
revoke all on table public.github_tokens from anon, authenticated;
grant select, insert, update, delete on table public.github_tokens to service_role;

create or replace function public.upsert_github_token(p_access_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_access_token is null or length(trim(p_access_token)) = 0 then
    raise exception 'invalid token';
  end if;
  insert into public.github_tokens (user_id, access_token, updated_at)
  values (auth.uid(), p_access_token, now())
  on conflict (user_id) do update
  set access_token = excluded.access_token,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_github_token(text) from public;
grant execute on function public.upsert_github_token(text) to authenticated;
