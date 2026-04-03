import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno"

function firstOfMonthUtcDate(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return `${y}-${String(m).padStart(2, "0")}-01`
}

Deno.serve(async (req) => {
  console.log("webhook received", { method: req.method })

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")

  console.log("env check", {
    hasWebhookSecret: Boolean(webhookSecret),
    hasStripeSecretKey: Boolean(stripeSecretKey),
  })

  const sig =
    req.headers.get("stripe-signature") ??
    req.headers.get("Stripe-Signature")

  if (!sig) {
    console.error("missing stripe-signature header")
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature header" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  if (!webhookSecret || !stripeSecretKey) {
    console.error("missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY")
    return new Response(
      JSON.stringify({ error: "Webhook not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  // Must be the raw body string — never JSON.parse before verification.
  const rawBody = await req.text()
  console.log("raw body length", rawBody.length)

  // Webhook verification only uses constructEvent (no Stripe HTTP calls here).
  const stripe = new Stripe(stripeSecretKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    console.log("stripe signature ok, event type:", event.type)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error("constructEvent failed:", msg, stack ?? "")
    return new Response(
      JSON.stringify({ error: "Webhook signature verification failed", detail: msg }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const md = session.metadata ?? {}

    const user_id = md.user_id
    if (!user_id) {
      console.log("checkout.session.completed: no user_id in metadata, acking")
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    let paymentIntentId: string | null = null
    if (typeof session.payment_intent === "string") {
      paymentIntentId = session.payment_intent
    } else if (
      session.payment_intent &&
      typeof session.payment_intent === "object" &&
      "id" in session.payment_intent
    ) {
      paymentIntentId = (session.payment_intent as { id: string }).id
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { error: rpcErr } = await supabase.rpc("create_project_from_stripe_webhook", {
      p_stripe_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_user_id: user_id,
      p_github_username: md.github_username ?? "",
      p_project_name: md.project_name ?? "",
      p_description: md.description ?? "",
      p_shipped_when: md.shipped_when ?? "",
      p_repo_url: md.repo_url ?? "",
      p_repo_full_name: md.repo_full_name ?? "",
      p_pool_month: firstOfMonthUtcDate(),
    })

    if (rpcErr) {
      if (rpcErr.code === "23505") {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (rpcErr.message?.includes("user_already_has_active_project")) {
        console.warn("checkout webhook: user already has active project", user_id)
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      console.error("rpc error:", rpcErr.message, rpcErr)
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
