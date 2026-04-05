-- Feedback / signals: insert from anon or authenticated; reads only via service role

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  github_username text,
  type text not null
    constraint signals_type_check
    check (type in ('bug', 'suggestion', 'other')),
  message text not null
    constraint signals_message_len_check
    check (char_length(message) <= 500 and length(trim(message)) >= 1),
  email text,
  created_at timestamptz not null default now()
);

create index if not exists signals_created_at_idx on public.signals (created_at desc);

alter table public.signals enable row level security;

-- Authenticated users: must attach their own user id
create policy "signals_insert_authenticated"
  on public.signals
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Anonymous visitors: no user id
create policy "signals_insert_anon"
  on public.signals
  for insert
  to anon
  with check (user_id is null);

grant insert on table public.signals to anon, authenticated;
