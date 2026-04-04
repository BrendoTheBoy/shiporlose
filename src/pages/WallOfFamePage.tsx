import { useCallback, useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import type { ProjectRow } from "../types/database"

const PROJECT_COLUMNS_PUBLIC =
  "id, user_id, github_username, project_name, description, shipped_when, repo_url, repo_full_name, stake_amount, stake_status, status, proof_url, stripe_session_id, payment_intent_id, created_at, deadline, review_started_at, shipped_at, abandoned_at"

function daysToShip(createdAt: string, shippedAt: string): number {
  const ms = new Date(shippedAt).getTime() - new Date(createdAt).getTime()
  const days = Math.round(ms / (24 * 60 * 60 * 1000))
  return Math.max(1, days)
}

export function WallOfFamePage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const canonicalUrl =
    typeof window !== "undefined" ? window.location.href : ""

  const load = useCallback(async () => {
    setFetchErr(null)
    setLoading(true)
    const { data, error } = await supabase
      .from("projects")
      .select(PROJECT_COLUMNS_PUBLIC)
      .eq("status", "shipped")
      .order("shipped_at", { ascending: false })

    if (error) {
      setFetchErr(error.message)
      setRows([])
      setLoading(false)
      return
    }

    const list: ProjectRow[] = (data ?? []).map((p) => {
      const base = p as Omit<
        ProjectRow,
        "payout_email" | "payout_sent" | "payout_amount"
      >
      return {
        ...base,
        payout_email: null,
        payout_sent: false,
        payout_amount: null,
      }
    })
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  return (
    <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-6 md:px-8 md:pt-8">
      <Helmet>
        <title>Wall of Fame — ShipOrLose</title>
        <meta name="description" content="Builders who put money on the line and shipped." />
        <meta property="og:title" content="Wall of Fame — ShipOrLose" />
        <meta
          property="og:description"
          content="Builders who put money on the line and shipped."
        />
        {canonicalUrl ? (
          <meta property="og:url" content={canonicalUrl} />
        ) : null}
      </Helmet>

      <Link
        to="/"
        className="font-mono text-[10px] uppercase tracking-wide text-[#39FF14] hover:text-[#FF6B00]"
      >
        ← BACK TO FEED
      </Link>

      <header className="mt-10 text-center">
        <h1 className="font-display text-[clamp(0.65rem,2.2vw,1rem)] leading-relaxed text-[#39FF14] [text-shadow:0_0_24px_rgba(57,255,20,0.35)]">
          WALL OF FAME
        </h1>
        <p className="font-body mx-auto mt-4 max-w-xl text-sm text-[#b8b8b8]">
          These builders put their money on the line and shipped. Legends.
        </p>
        <p className="font-mono mt-6 text-[10px] uppercase tracking-widest text-[#39FF14]/90">
          {loading ? "…" : `${rows.length} PROJECTS SHIPPED`}
        </p>
      </header>

      {fetchErr && (
        <p className="font-mono mt-10 text-center text-xs text-red-400">
          {fetchErr}
        </p>
      )}

      {loading && (
        <p className="font-mono mt-12 text-center text-xs text-[#888]">
          LOADING…
        </p>
      )}

      {!loading && !fetchErr && rows.length === 0 && (
        <p className="font-mono mt-14 text-center text-sm text-[#888]">
          No one has shipped yet. Be the first.
        </p>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {!loading &&
          rows.map((p) => {
            const avatarUrl = `https://github.com/${p.github_username}.png`
            const profileUrl = `https://github.com/${p.github_username}`
            const shippedAt = p.shipped_at ?? p.created_at
            const days =
              p.shipped_at && p.created_at
                ? daysToShip(p.created_at, p.shipped_at)
                : 1

            return (
              <article
                key={p.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/project/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    navigate(`/project/${p.id}`)
                  }
                }}
                className="card-lift flex cursor-pointer flex-col border-2 border-[#2a6a2a] bg-[#080c08] p-5 shadow-[0_0_20px_rgba(57,255,20,0.12),4px_4px_0_#0a1a0a] outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14]"
              >
                <div className="mb-3 flex items-start gap-3">
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-10 w-10 border-2 border-[#39FF14] bg-[#0a0a0a] object-cover"
                      width={40}
                      height={40}
                    />
                  </a>
                  <div className="min-w-0">
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="font-mono text-[10px] text-[#888] underline decoration-[#333] underline-offset-2 hover:text-[#39FF14]"
                    >
                      @{p.github_username}
                    </a>
                    <h2 className="font-display mt-1 text-[10px] leading-snug text-[#39FF14] sm:text-[11px]">
                      {p.project_name}
                    </h2>
                  </div>
                </div>

                <p className="font-body flex-1 text-sm text-[#c4c4c4]">
                  {p.description}
                </p>

                <p className="font-mono mt-4 text-[10px] uppercase tracking-wide text-[#5cff4a]">
                  SHIPPED IN {days} {days === 1 ? "DAY" : "DAYS"}
                </p>

                <p className="font-mono mt-2 text-[10px] text-[#888]">
                  <span className="text-[#666]">PROOF:</span>{" "}
                  {p.proof_url ? (
                    <a
                      href={p.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="break-all text-[#39FF14] underline decoration-[#2a4a2a] underline-offset-2 hover:text-[#FF6B00]"
                    >
                      {p.proof_url}
                    </a>
                  ) : (
                    <span className="text-[#666]">—</span>
                  )}
                </p>

                <p className="font-mono mt-4 text-[9px] text-[#666]">
                  Shipped{" "}
                  {new Date(shippedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>

                <Link
                  to={`/project/${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono mt-3 text-[10px] font-bold uppercase tracking-wide text-[#39FF14] underline decoration-[#2a4a2a] underline-offset-4 hover:text-[#FF6B00]"
                >
                  Open project page →
                </Link>
              </article>
            )
          })}
      </div>
    </div>
  )
}
