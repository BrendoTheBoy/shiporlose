import { useCallback, useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import type { ProjectRow } from "../types/database"

const PROJECT_COLUMNS_PUBLIC =
  "id, user_id, github_username, project_name, description, shipped_when, repo_url, repo_full_name, stake_amount, stake_status, status, proof_url, stripe_session_id, payment_intent_id, created_at, deadline, review_started_at, shipped_at, abandoned_at"

function abandonedLabel(p: ProjectRow): string {
  if (p.abandoned_at) {
    const d = new Date(p.abandoned_at).toLocaleString(undefined, {
      dateStyle: "medium",
    })
    return `ABANDONED ON ${d}`
  }
  return "DEADLINE PASSED"
}

export function WallOfShamePage() {
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
      .eq("status", "abandoned")
      .order("abandoned_at", { ascending: false })

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
        <title>Wall of Shame — ShipOrLose</title>
        <meta
          name="description"
          content="Projects that never shipped. Don't end up here."
        />
        <meta property="og:title" content="Wall of Shame — ShipOrLose" />
        <meta
          property="og:description"
          content="Projects that never shipped. Don't end up here."
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
        <h1 className="font-display text-[clamp(0.65rem,2.2vw,1rem)] leading-relaxed text-red-500 [text-shadow:0_0_20px_rgba(220,38,38,0.35)]">
          WALL OF SHAME
        </h1>
        <p className="font-body mx-auto mt-4 max-w-xl text-sm text-[#888]">
          Here lie the projects that never shipped.
        </p>
        <pre
          className="font-mono mx-auto mt-8 max-w-md select-none text-[8px] leading-tight text-[#4a2a2a] sm:text-[9px]"
          aria-hidden="true"
        >
          {`    +----+
   | RIP |
   |     |
  /|=====|\\
 //|     |\\\\
    |     |
    |_____|`}
        </pre>
      </header>

      <section className="mt-14">
        <h2 className="font-display text-center text-[9px] text-red-500/90 sm:text-[10px]">
          THE GRAVEYARD
        </h2>

        {fetchErr && (
          <p className="font-mono mt-8 text-center text-xs text-red-400">
            {fetchErr}
          </p>
        )}

        {loading && (
          <p className="font-mono mt-10 text-center text-xs text-[#888]">
            LOADING…
          </p>
        )}

        {!loading && !fetchErr && rows.length === 0 && (
          <p className="font-mono mt-8 text-center text-sm text-[#666]">
            The graveyard is empty... for now.
          </p>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {!loading &&
            rows.map((p) => {
              const avatarUrl = `https://github.com/${p.github_username}.png`
              const profileUrl = `https://github.com/${p.github_username}`

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
                  className="card-lift flex cursor-pointer flex-col border-2 border-[#3d1515] bg-[#0a0606]/90 p-5 opacity-90 shadow-[inset_0_0_24px_rgba(60,20,20,0.25),4px_4px_0_#140808] outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="shrink-0 opacity-60 grayscale"
                    >
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-10 w-10 border-2 border-[#4a2020] bg-[#0a0a0a] object-cover"
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
                        className="font-mono text-[10px] text-[#666] underline decoration-[#333] underline-offset-2 hover:text-[#888]"
                      >
                        @{p.github_username}
                      </a>
                      <h2 className="font-display mt-1 text-[10px] leading-snug text-red-900/90 line-through decoration-red-700/80 sm:text-[11px]">
                        {p.project_name}
                      </h2>
                    </div>
                  </div>

                  <p className="font-body flex-1 text-sm text-[#8a8a8a]">
                    {p.description}
                  </p>

                  <p className="font-mono mt-4 text-[10px] uppercase tracking-wide text-[#777]">
                    {abandonedLabel(p)}
                  </p>

                  <p className="font-mono mt-2 text-[10px] uppercase tracking-wide text-red-500">
                    STAKE FORFEITED: ${p.stake_amount}
                  </p>

                  <Link
                    to={`/project/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono mt-4 text-[10px] font-bold uppercase tracking-wide text-[#888] underline decoration-[#333] underline-offset-4 hover:text-red-400"
                  >
                    Open project page →
                  </Link>
                </article>
              )
            })}
        </div>
      </section>

      <section className="mt-20 border-t border-[#2a1515] pt-16">
        <h2 className="font-display text-center text-[8px] leading-relaxed text-red-600 sm:text-[9px]">
          BANNED — CAUGHT GAMING THE SYSTEM
        </h2>
        <p className="font-body mx-auto mt-4 max-w-xl text-center text-sm text-[#777]">
          These accounts were permanently banned for submitting fraudulent
          proof.
        </p>
        <p className="font-mono mt-10 text-center text-sm text-[#555]">
          No one has been banned yet. Keep it that way.
        </p>
      </section>
    </div>
  )
}
