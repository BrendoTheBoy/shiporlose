# Stripe + Supabase Edge Functions (ShipOrLose)

This project charges **$30** per declaration via **Stripe Checkout**. The Stripe **secret key** and **webhook secret** live only in Supabase (Edge Function secrets), never in the Vite app.

## 1. Install and log in to Supabase CLI

Install the CLI (pick one):

- **Homebrew (macOS):** `brew install supabase/tap/supabase`
- **npm:** `npm install -g supabase`

Log in and link your project:

```bash
supabase login
cd /path/to/shiporlose
supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the id in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

## 2. Apply database migrations

Run the SQL in `supabase/migrations/` against your project (CLI or SQL editor):

```bash
supabase db push
```

Or paste `supabase/schema.sql` / migration files into **SQL Editor** if you manage schema manually.

## 3. Set Edge Function secrets (Stripe + already available env)

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions automatically. You must add Stripe secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

Use **test** keys while developing (`sk_test_`, webhook secret from Stripe test mode).

List secrets (names only):

```bash
supabase secrets list
```

## 4. Deploy Edge Functions

From the repo root:

```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

`supabase/config.toml` sets `verify_jwt = false` for `stripe-webhook` so Stripe can POST without a Supabase JWT (the handler verifies the Stripe signature instead).

## 5. Configure the Stripe webhook

1. Open [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL:**  
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`  
   Replace `YOUR_PROJECT_REF` with your Supabase project ref.
3. **Events:** select `checkout.session.completed`.
4. After saving, reveal **Signing secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` (see step 3). Redeploy is not required after rotating the secret if you only update the secret value.

## 6. Frontend environment

In `.env` (or your host’s env):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_STRIPE_PUBLISHABLE_KEY` (reserved for future Stripe.js use; Checkout URL is returned by the Edge Function)

Do **not** put `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in Vite.

## 7. Test the full flow (Stripe test mode)

1. Use test API keys and test webhook secret on Supabase.
2. Open the app, sign in with GitHub, fill the declare form, click **PAY STRIPE CHECKOUT**.
3. Use Stripe’s [test card](https://stripe.com/docs/testing) `4242 4242 4242 4242`, any future expiry, any CVC.
4. After success, Stripe redirects to `https://shiporlose.com?payment=success&...` (or your deployed domain if you change URLs in `create-checkout`).
5. Confirm in Supabase **Table Editor** → `projects` has a new row and `pools.total_amount` increased by **10** for the current month (UTC).

### Local frontend + remote Supabase

Point `VITE_SUPABASE_URL` / anon key at your hosted project. Checkout success/cancel URLs in `create-checkout` are currently fixed to `https://shiporlose.com`; for local testing, either change those URLs in the Edge Function to `http://localhost:5173?payment=...` or use a tunnel and matching site URL in Stripe.

### Webhook testing locally

Use the Supabase CLI to serve functions and forward Stripe:

```bash
supabase functions serve --env-file ./supabase/.env.local
```

Combine with Stripe CLI:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

(Adjust port to match `supabase functions serve` output.)

## 8. Enable Realtime for pool updates (optional)

The hero pool subscribes to `pools` changes. In Supabase: **Database** → **Replication** → enable replication for `pools` if you want live updates without refresh.
