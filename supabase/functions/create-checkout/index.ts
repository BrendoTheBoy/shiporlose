import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@14.25.0"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

/** Bearer token from Authorization only (ignore apikey header). */
function bearerJwtFromRequest(req: Request): string | null {
  const raw = req.headers.get("Authorization") ?? req.headers.get("authorization")
  if (!raw) return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1]?.trim()
  if (!token) return null
  return token
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
    const jwt = bearerJwtFromRequest(req)
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt)
    if (userErr || !userData.user) {
      console.error("getUser failed:", userErr?.message ?? "no user")
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

    const verifiedUserId = userData.user.id

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

    const { count, error: cntErr } = await supabaseAdmin
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", verifiedUserId)
      .in("status", ["active", "pending_review", "flagged"])

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
              name: "Ship Or Lose Entry — $20 stake + $10 pool",
            },
            unit_amount: 3000,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: verifiedUserId,
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
