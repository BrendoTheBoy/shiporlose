import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@14.25.0"

function firstOfMonthUtcDate(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return `${y}-${String(m).padStart(2, "0")}-01`
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature")
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  const secret = Deno.env.get("STRIPE_SECRET_KEY")

  if (!sig || !webhookSecret || !secret) {
    return new Response("Webhook not configured", { status: 400 })
  }

  const rawBody = await req.text()

  const stripe = new Stripe(secret, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (e) {
    console.error(e)
    return new Response("Webhook signature verification failed", { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const md = session.metadata ?? {}

    const user_id = md.user_id
    if (!user_id) {
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
      console.error(rpcErr)
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
