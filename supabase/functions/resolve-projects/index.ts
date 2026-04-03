import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const HEADER = "x-resolve-secret"

function monthBoundsUtc(poolMonth: string): { start: string; end: string } {
  const s = poolMonth.slice(0, 10)
  const [yStr, mStr] = s.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  return { start: start.toISOString(), end: end.toISOString() }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-resolve-secret",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  const secret = Deno.env.get("RESOLVE_SECRET")
  const got = req.headers.get(HEADER) ?? req.headers.get("X-Resolve-Secret")
  if (!secret) {
    console.error("RESOLVE_SECRET not configured")
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (got !== secret) {
    console.error("invalid or missing resolve secret header")
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const autoApproved: string[] = []
  const autoFlagged: string[] = []
  const autoAbandoned: string[] = []
  const errors: string[] = []

  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const { data: pendingReview, error: prErr } = await supabase
    .from("projects")
    .select("id, review_started_at")
    .eq("status", "pending_review")
    .not("review_started_at", "is", null)

  if (prErr) {
    console.error("fetch pending_review", prErr.message)
    errors.push(`pending_review query: ${prErr.message}`)
  } else {
    for (const row of pendingReview ?? []) {
      const started = row.review_started_at
      if (!started) continue
      const reviewEnd =
        new Date(started).getTime() + 48 * 60 * 60 * 1000
      if (reviewEnd >= now) continue

      const { count: flagCount, error: fcErr } = await supabase
        .from("flags")
        .select("*", { count: "exact", head: true })
        .eq("project_id", row.id)

      if (fcErr) {
        console.error("flag count", fcErr.message)
        errors.push(`flags count ${row.id}: ${fcErr.message}`)
        continue
      }

      const n = flagCount ?? 0
      if (n >= 3) {
        const { error: upErr } = await supabase
          .from("projects")
          .update({ status: "flagged" })
          .eq("id", row.id)
        if (upErr) {
          console.error("flag project", row.id, upErr.message)
          errors.push(`flag ${row.id}: ${upErr.message}`)
        } else {
          console.log(`Auto-flagged project ${row.id} (${n} flags)`)
          autoFlagged.push(row.id)
        }
      } else {
        const { error: upErr } = await supabase
          .from("projects")
          .update({
            status: "shipped",
            shipped_at: nowIso,
            stake_status: "returned",
          })
          .eq("id", row.id)
        if (upErr) {
          console.error("approve project", row.id, upErr.message)
          errors.push(`approve ${row.id}: ${upErr.message}`)
        } else {
          console.log(`Auto-approved project ${row.id}`)
          autoApproved.push(row.id)
        }
      }
    }
  }

  const { data: overdue, error: odErr } = await supabase
    .from("projects")
    .select("id")
    .eq("status", "active")
    .lt("deadline", nowIso)

  if (odErr) {
    console.error("fetch active overdue", odErr.message)
    errors.push(`active overdue query: ${odErr.message}`)
  } else {
    for (const row of overdue ?? []) {
      const { error: upErr } = await supabase
        .from("projects")
        .update({
          status: "abandoned",
          abandoned_at: nowIso,
          stake_status: "forfeited",
        })
        .eq("id", row.id)
      if (upErr) {
        console.error("abandon project", row.id, upErr.message)
        errors.push(`abandon ${row.id}: ${upErr.message}`)
      } else {
        console.log(`Auto-abandoned project ${row.id}`)
        autoAbandoned.push(row.id)
      }
    }
  }

  const poolSummaries: Array<{
    pool_id: string
    month: string
    total_amount: number
    status: string
    winner_count: number
    loser_count: number
    winner_pool: number
    platform_cut: number
    per_winner_payout: number
  }> = []

  const { data: pools, error: poolErr } = await supabase
    .from("pools")
    .select("id, month, total_amount, status")
    .eq("status", "active")

  if (poolErr) {
    console.error("pools", poolErr.message)
    errors.push(`pools query: ${poolErr.message}`)
  } else {
    for (const pool of pools ?? []) {
      const monthVal =
        typeof pool.month === "string"
          ? pool.month
          : String(pool.month)
      const { start, end } = monthBoundsUtc(monthVal)

      const { count: winCount, error: wErr } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "shipped")
        .gte("deadline", start)
        .lt("deadline", end)

      const { count: loseCount, error: lErr } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "abandoned")
        .gte("deadline", start)
        .lt("deadline", end)

      if (wErr) {
        errors.push(`winners ${pool.id}: ${wErr.message}`)
        continue
      }
      if (lErr) {
        errors.push(`losers ${pool.id}: ${lErr.message}`)
        continue
      }

      const total = pool.total_amount ?? 0
      const winnerPool = total * 0.8
      const platformCut = total * 0.2
      const wc = winCount ?? 0
      const lc = loseCount ?? 0
      const perWinner = wc > 0 ? winnerPool / wc : 0

      poolSummaries.push({
        pool_id: pool.id,
        month: monthVal,
        total_amount: total,
        status: pool.status,
        winner_count: wc,
        loser_count: lc,
        winner_pool: winnerPool,
        platform_cut: platformCut,
        per_winner_payout: perWinner,
      })
    }
  }

  const body = {
    ok: errors.length === 0,
    at: nowIso,
    auto_approved_project_ids: autoApproved,
    auto_flagged_project_ids: autoFlagged,
    auto_abandoned_project_ids: autoAbandoned,
    pool_calculations: poolSummaries,
    errors: errors.length ? errors : undefined,
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
})
