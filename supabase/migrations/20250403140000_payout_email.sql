-- Payout email collection for shipped winners (manual Interac e-transfer).

alter table public.projects
  add column if not exists payout_email text,
  add column if not exists payout_sent boolean not null default false,
  add column if not exists payout_amount numeric;
