# ShipOrLose — manual admin SQL (Supabase SQL Editor)

Run these in the Supabase SQL Editor when you need to review flagged projects or inspect payouts. Replace placeholders in angle brackets.

---

## 1. View all flagged projects with their flags

```sql
SELECT
  p.id,
  p.project_name,
  p.github_username,
  p.shipped_when,
  p.proof_url,
  count(f.id) AS flag_count,
  array_agg(f.reason) AS flag_reasons
FROM projects p
JOIN flags f ON f.project_id = p.id
WHERE p.status = 'flagged'
GROUP BY p.id;
```

---

## 2. Approve a flagged project (override flags, mark as shipped)

```sql
UPDATE projects
SET status = 'shipped',
    shipped_at = now(),
    stake_status = 'returned'
WHERE id = '<PROJECT_ID>';
```

---

## 3. Reject a flagged project (mark as abandoned, forfeit stake)

```sql
UPDATE projects
SET status = 'abandoned',
    abandoned_at = now(),
    stake_status = 'forfeited'
WHERE id = '<PROJECT_ID>';
```

---

## 4. View pool payout calculation for a month

```sql
WITH winners AS (
  SELECT count(*) AS cnt
  FROM projects
  WHERE status = 'shipped'
    AND date_trunc('month', deadline) = '<YYYY-MM-01>'::date
)
SELECT
  pool.total_amount,
  pool.total_amount * 0.8 AS winner_pool,
  pool.total_amount * 0.2 AS platform_cut,
  winners.cnt AS winner_count,
  CASE
    WHEN winners.cnt > 0 THEN (pool.total_amount * 0.8) / winners.cnt
    ELSE 0
  END AS per_winner_payout
FROM pools pool,
  winners
WHERE pool.month = '<YYYY-MM-01>'::date;
```

---

## Edge function: `resolve-projects`

Configure once:

```bash
supabase secrets set RESOLVE_SECRET="$(openssl rand -hex 32)"
```

Add `[functions.resolve-projects]` with `verify_jwt = false` in `supabase/config.toml` (already in repo).

Deploy the function, then trigger manually:

```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/resolve-projects" \
  -H "X-Resolve-Secret: <your-secret>" \
  -H "Content-Type: application/json"
```

`<SUPABASE_URL>` is your project URL (e.g. `https://xxxxx.supabase.co`). The same host works for the Functions gateway.

Later you can schedule this (Supabase cron, GitHub Actions, or another scheduler) to run every hour.

---

## 5. View all winners awaiting payout

```sql
SELECT p.id, p.project_name, p.github_username, p.payout_email, p.shipped_at,
       pool.total_amount AS pool_total,
       (pool.total_amount * 0.8) / (SELECT count(*) FROM projects WHERE status = 'shipped' AND date_trunc('month', deadline) = pool.month) AS payout_amount
FROM projects p
JOIN pools pool ON pool.month = date_trunc('month', p.deadline)::date
WHERE p.status = 'shipped' AND p.payout_sent = false AND p.payout_email IS NOT NULL;
```

---

## 6. Mark payout as sent for a project

```sql
UPDATE projects SET payout_sent = true, payout_amount = <AMOUNT> WHERE id = '<PROJECT_ID>';
```

---

## 7. Mark all payouts as sent for a month

```sql
UPDATE projects SET payout_sent = true WHERE status = 'shipped' AND payout_sent = false AND payout_email IS NOT NULL AND date_trunc('month', deadline) = '<YYYY-MM-01>';
```
