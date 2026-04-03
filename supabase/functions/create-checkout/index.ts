import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@14.25.0"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )

    const token = authHeader.replace("Bearer ", "")
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as Record<string, unknown>
    const user_id = String(body.user_id ?? "")
    const github_username = String(body.github_username ?? "").trim()
    const project_name = String(body.project_name ?? "").trim()
    const description = String(body.description ?? "").trim()
    const shipped_when = String(body.shipped_when ?? "").trim()
    const repo_url = String(body.repo_url ?? "").trim()
    const repo_full_name = String(body.repo_full_name ?? "").trim()

    if (user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (
      !github_username ||
      !project_name ||
      !description ||
      !shipped_when ||
      !repo_url ||
      !repo_full_name
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (
      project_name.length > 30 ||
      description.length > 100 ||
      shipped_when.length > 100
    ) {
      return new Response(JSON.stringify({ error: "Field length exceeded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { count, error: cntErr } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("status", "active")

    if (cntErr) throw cntErr
    if ((count ?? 0) > 0) {
      return new Response(
        JSON.stringify({
          error:
            "You already have an active project. Finish or abandon it before declaring another.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const secret = Deno.env.get("STRIPE_SECRET_KEY")
    if (!secret) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }

    const stripe = new Stripe(secret, {
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "ShipOrLose Entry — $20 stake + $10 pool",
            },
            unit_amount: 3000,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id,
        github_username,
        project_name,
        description,
        shipped_when,
        repo_url,
        repo_full_name,
      },
      success_url:
        "https://shiporlose.com?payment=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://shiporlose.com?payment=cancelled",
    })

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL")
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : "Checkout failed"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
