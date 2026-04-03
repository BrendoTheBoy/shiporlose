import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { syncCommitsForProject } from "../lib/syncCommits"
import {
  cardFrameClass,
  daysLeftUntil,
  deadlinePassed,
  isAtRisk,
  progressElapsed,
} from "../lib/projectDisplay"
import {
  formatRelativeTime,
  formatReviewCountdownMs,
  reviewWindowEndsAt,
  truncateText,
} from "../lib/time"
import type { CommitRow, ProjectRow, ProjectStatus } from "../types/database"
import { AsciiDivider } from "./AsciiDivider"
import { ProgressBar } from "./ProgressBar"

type ProjectWithCommits = ProjectRow & {
  commits: CommitRow[]
}

/** Public feed columns — excludes payout fields so other users never receive them in the response. */
const PROJECT_COLUMNS_PUBLIC =
  "id, user_id, github_username, project_name, description, shipped_when, repo_url, repo_full_name, stake_amount, stake_status, status, proof_url, stripe_session_id, payment_intent_id, created_at, deadline, review_started_at, shipped_at, abandoned_at"

const FEED_STATUSES: ProjectStatus[] = [
  "active",
  "pending_review",
  "flagged",
  "shipped",
  "abandoned",
]

const MOCK: {
  name: string
  description: string
  shippedMeans: string
  daysLeft: number
  stake: number
  progress: number
  atRisk: boolean
}[] = [
  {
    name: "ReceiptFax",
    description: "CLI that turns photos of receipts into structured CSV.",
    shippedMeans: "npm publish + 10 real users on the waitlist.",
    daysLeft: 18,
    stake: 50,
    progress: 0.4,
    atRisk: false,
  },
  {
    name: "PanicBoard",
    description: "Kanban for solo devs with brutal deadline mode.",
    shippedMeans: "Live URL + Stripe test mode checkout working.",
    daysLeft: 9,
    stake: 30,
    progress: 0.7,
    atRisk: false,
  },
  {
    name: "ASCIIWeather",
    description: "Retro terminal weather API wrapper with pixel icons.",
    shippedMeans: "Public API key + docs page shipped.",
    daysLeft: 24,
    stake: 20,
    progress: 0.2,
    atRisk: true,
  },
]

export function LiveProjects() {
  const { user, githubAccessToken } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ProjectWithCommits[]>([])
  const [flagCounts, setFlagCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const syncedRef = useRef<Set<string>>(new Set())
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    setFetchErr(null)
    setLoading(true)
    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select(PROJECT_COLUMNS_PUBLIC)
      .in("status", FEED_STATUSES)
      .order("created_at", { ascending: false })
      .limit(20)

    if (pErr) {
      setFetchErr(pErr.message)
      setRows([])
      setFlagCounts({})
      setLoading(false)
      return
    }

    const ids = (projects ?? []).map((p) => p.id as string)
    if (ids.length === 0) {
      setRows([])
      setFlagCounts({})
      setLoading(false)
      return
    }

    const plist: ProjectRow[] = (projects ?? []).map((p) => {
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

    const { data: commits, error: cErr } = await supabase
      .from("commits")
      .select("*")
      .in("project_id", ids)

    if (cErr) {
      setFetchErr(cErr.message)
      setRows([])
      setFlagCounts({})
      setLoading(false)
      return
    }

    const { data: flagRows, error: fErr } = await supabase
      .from("flags")
      .select("project_id")
      .in("project_id", ids)

    if (fErr) {
      setFetchErr(fErr.message)
      setRows([])
      setFlagCounts({})
      setLoading(false)
      return
    }

    const counts: Record<string, number> = {}
    for (const f of flagRows ?? []) {
      const pid = (f as { project_id: string }).project_id
      counts[pid] = (counts[pid] ?? 0) + 1
    }
    setFlagCounts(counts)

    const byProject = new Map<string, CommitRow[]>()
    for (const id of ids) byProject.set(id, [])
    for (const c of commits ?? []) {
      const list = byProject.get(c.project_id) ?? []
      list.push(c)
      byProject.set(c.project_id, list)
    }

    const merged: ProjectWithCommits[] = plist.map((p) => ({
      ...p,
      commits: (byProject.get(p.id) ?? []).sort(
        (a, b) =>
          new Date(b.committed_at).getTime() -
          new Date(a.committed_at).getTime(),
      ),
    }))

    setRows(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  useEffect(() => {
    if (!user) syncedRef.current.clear()
  }, [user])

  const projectIdsKey = useMemo(
    () =>
      rows
        .map((r) => r.id)
        .sort()
        .join(","),
    [rows],
  )

  useEffect(() => {
    if (!user || !githubAccessToken || rows.length === 0) return

    const mine = rows.filter(
      (p) =>
        p.user_id === user.id &&
        (p.status === "active" ||
          p.status === "pending_review" ||
          p.status === "flagged"),
    )
    const pending = mine.filter((p) => !syncedRef.current.has(p.id))
    if (pending.length === 0) return

    let cancelled = false
    void (async () => {
      for (const p of pending) {
        syncedRef.current.add(p.id)
        try {
          await syncCommitsForProject(
            p.id,
            p.repo_full_name,
            p.created_at,
            githubAccessToken,
          )
        } catch (e) {
          console.error(e)
          syncedRef.current.delete(p.id)
        }
        if (cancelled) return
      }
      if (!cancelled) await load()
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, githubAccessToken, projectIdsKey, load])

  const displayRows = useMemo(() => {
    if (!user?.id) return rows
    const mine = rows.filter((r) => r.user_id === user.id)
    const others = rows.filter((r) => r.user_id !== user.id)
    return [...mine, ...others]
  }, [rows, user?.id])

  const showMock = !loading && rows.length === 0 && !fetchErr

  return (
    <section className="border-b-2 border-[#1f1f1f] px-4 py-16 md:px-8 md:py-20">
      <AsciiDivider label="LIVE PROJECTS — PUBLIC FEED" />
      <div className="mx-auto mt-10 max-w-5xl">
        <h2 className="font-display mb-10 text-center text-[11px] text-[#39FF14] sm:text-xs md:text-sm">
          LIVE PROJECTS
        </h2>

        {loading && (
          <p className="font-mono text-center text-xs text-[#888]">
            LOADING FEED…
          </p>
        )}
        {fetchErr && (
          <p className="font-mono mb-6 text-center text-xs text-red-400">
            {fetchErr}
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {!loading &&
            displayRows.map((p) => {
              const atRisk = isAtRisk(p, p.commits)
              const topCommits = p.commits.slice(0, 3)
              const totalCommits = p.commits.length
              const dl = daysLeftUntil(p.deadline)
              const passed = deadlinePassed(p.deadline)
              const own = user?.id === p.user_id
              const avatarUrl = `https://github.com/${p.github_username}.png`
              const prog =
                p.status === "shipped" || p.status === "abandoned"
                  ? 1
                  : progressElapsed(p)
              const frame = cardFrameClass(p.status, atRisk, passed)
              const flags = flagCounts[p.id] ?? 0
              const reviewEnd = reviewWindowEndsAt(p.review_started_at)
              const reviewLeftMs =
                reviewEnd != null ? reviewEnd - Date.now() : 0
              const showThreeDayPulse =
                p.status === "active" && !passed && dl > 0 && dl <= 3
              const showDeadlinePassed = own && p.status === "active" && passed

              return (
                <div key={p.id} className="relative">
                  {own && (
                    <p className="font-mono mb-1 text-[8px] font-bold uppercase tracking-widest text-[#39FF14]">
                      YOUR PROJECT
                    </p>
                  )}
                  <article
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/project/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        navigate(`/project/${p.id}`)
                      }
                    }}
                    className={`group card-lift relative flex cursor-pointer flex-col border-2 bg-[#0d0d0d] p-5 pb-12 shadow-[4px_4px_0_#111] outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] ${frame}`}
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 border-2 border-[#39FF14] bg-[#0a0a0a] object-cover"
                          width={32}
                          height={32}
                        />
                        <div className="min-w-0">
                          <h3 className="font-display min-w-0 text-[10px] text-[#39FF14] sm:text-[11px]">
                            {p.project_name}
                          </h3>
                          <p className="font-mono truncate text-[9px] text-[#666]">
                            @{p.github_username}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {p.status === "pending_review" && (
                          <span className="font-mono text-[10px] uppercase tracking-wide border border-[#cc8800] bg-[#1a1200] px-2 py-0.5 text-[#FFAA00]">
                            UNDER REVIEW
                          </span>
                        )}
                        {p.status === "shipped" && (
                          <span className="font-mono text-[10px] uppercase tracking-wide border border-[#2a6a2a] bg-[#081008] px-2 py-0.5 text-[#39FF14]">
                            SHIPPED ✓
                          </span>
                        )}
                        {p.status === "abandoned" && (
                          <span className="font-mono text-[10px] uppercase tracking-wide border border-red-900 bg-[#180808] px-2 py-0.5 text-red-400">
                            ABANDONED
                          </span>
                        )}
                        {p.status === "flagged" && (
                          <span className="font-mono text-[10px] uppercase tracking-wide border border-[#992200] bg-[#1a0800] px-2 py-0.5 text-[#ff5555]">
                            UNDER INVESTIGATION
                          </span>
                        )}
                        {p.status === "active" && (
                          <span className="font-mono text-[10px] uppercase tracking-wide border border-[#2a4a2a] bg-[#080808] px-2 py-0.5 text-[#39FF14]">
                            ACTIVE
                          </span>
                        )}
                        <span className="font-mono text-[10px] uppercase tabular-nums text-[#39FF14] border border-[#2a4a2a] bg-[#080808] px-2 py-0.5">
                          commits: {totalCommits}
                        </span>
                        {atRisk &&
                          (p.status === "active" ||
                            p.status === "pending_review" ||
                            p.status === "flagged") && (
                            <span className="font-mono text-[10px] uppercase tracking-wide text-[#FF6B00]">
                              ⚠ AT RISK
                            </span>
                          )}
                      </div>
                    </div>

                    {showThreeDayPulse && (
                      <p className="font-mono mb-2 animate-pulse text-[10px] uppercase tracking-wide text-[#FF6B00]">
                        ⚠ 3 DAYS LEFT — SHIP OR LOSE
                      </p>
                    )}

                    {showDeadlinePassed && (
                      <p className="font-mono mb-2 text-[10px] uppercase tracking-wide text-red-500">
                        DEADLINE PASSED
                      </p>
                    )}

                    <p className="font-body text-sm text-[#c4c4c4]">
                      {p.description}
                    </p>
                    <p className="font-body mt-2 border-l-2 border-[#FF6B00] pl-2 text-xs text-[#888]">
                      <span className="text-[#666]">Shipped means:</span>{" "}
                      {p.shipped_when}
                    </p>

                    {(p.status === "pending_review" || p.status === "flagged") && (
                      <p className="font-mono mt-2 text-[10px] text-[#888]">
                        FLAGS: {flags}
                      </p>
                    )}

                    <div className="mt-3 font-mono text-[10px] leading-relaxed text-[#39FF14]">
                      {topCommits.length === 0 ? (
                        <p className="text-[#666]">&gt; (no commits synced yet)</p>
                      ) : (
                        topCommits.map((c) => (
                          <p key={c.id} className="truncate">
                            &gt; {c.sha.slice(0, 7)}{" "}
                            <span className="text-[#c4c4c4]">
                              &quot;{truncateText(c.message, 60)}&quot;
                            </span>{" "}
                            <span className="text-[#666]">
                              — {formatRelativeTime(c.committed_at)}
                            </span>
                          </p>
                        ))
                      )}
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] md:grid-cols-3 md:text-xs">
                      {p.status === "pending_review" ? (
                        <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                          <dt className="text-[#666]">Review</dt>
                          <dd className="text-lg font-semibold tabular-nums text-[#FFAA00]">
                            {reviewEnd != null
                              ? formatReviewCountdownMs(reviewLeftMs)
                              : "—"}
                          </dd>
                        </div>
                      ) : p.status === "flagged" ? (
                        <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                          <dt className="text-[#666]">Review</dt>
                          <dd className="text-lg font-semibold tabular-nums text-[#888]">
                            —
                          </dd>
                        </div>
                      ) : (
                        <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                          <dt className="text-[#666]">Days left</dt>
                          <dd
                            className={`text-lg font-semibold tabular-nums ${atRisk ? "text-[#FF6B00]" : "text-[#39FF14]"}`}
                          >
                            {p.status === "shipped" || p.status === "abandoned"
                              ? "—"
                              : dl}
                          </dd>
                        </div>
                      )}
                      <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                        <dt className="text-[#666]">Stake</dt>
                        <dd
                          className={`text-lg font-semibold tabular-nums ${
                            p.status === "shipped"
                              ? "text-[#39FF14]"
                              : p.status === "abandoned"
                                ? "text-red-400"
                                : "text-[#FF6B00]"
                          }`}
                        >
                          {p.status === "shipped"
                            ? "RETURNED"
                            : p.status === "abandoned"
                              ? "FORFEITED"
                              : `$${p.stake_amount}`}
                        </dd>
                      </div>
                      <div className="col-span-2 border border-[#2a2a2a] bg-[#080808] p-2 md:col-span-1">
                        <dt className="text-[#666]">Repo</dt>
                        <dd className="truncate text-[10px] text-[#39FF14]">
                          <a
                            href={p.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="underline decoration-[#2a4a2a] underline-offset-2 hover:text-[#FF6B00]"
                          >
                            {p.repo_full_name}
                          </a>
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto pt-4">
                      <p className="font-mono mb-1 text-[10px] uppercase text-[#666]">
                        {Math.round(prog * 100)}% of window elapsed
                      </p>
                      <ProgressBar
                        value={prog}
                        atRisk={
                          atRisk &&
                          p.status !== "shipped" &&
                          p.status !== "abandoned"
                        }
                        muted={p.status === "abandoned"}
                      />
                    </div>

                    <div className="pointer-events-none absolute bottom-3 right-4 font-mono text-[9px] font-bold uppercase tracking-wide text-[#39FF14] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      VIEW PROJECT →
                    </div>
                  </article>
                </div>
              )
            })}

          {showMock &&
            MOCK.map((p) => (
              <article
                key={p.name}
                className={`card-lift flex flex-col border-2 border-dashed border-[#333] bg-[#0d0d0d] p-5 opacity-90 shadow-[4px_4px_0_#111] ${
                  p.atRisk ? "border-[#FF6B00]" : "border-[#333]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase text-[#666]">
                    demo
                  </span>
                  {p.atRisk && (
                    <span className="font-mono text-[10px] uppercase text-[#FF6B00]">
                      ⚠ AT RISK
                    </span>
                  )}
                </div>
                <div className="mb-2 flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#39FF14] bg-[#0a0a0a] font-mono text-[10px] font-semibold uppercase leading-none text-[#39FF14]"
                    aria-hidden="true"
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <h3 className="font-display min-w-0 text-[10px] text-[#39FF14] sm:text-[11px]">
                    {p.name}
                  </h3>
                </div>
                <p className="font-body text-sm text-[#c4c4c4]">
                  {p.description}
                </p>
                <p className="font-body mt-2 border-l-2 border-[#FF6B00] pl-2 text-xs text-[#888]">
                  <span className="text-[#666]">Shipped means:</span>{" "}
                  {p.shippedMeans}
                </p>
                <div className="mt-3 font-mono text-[10px] text-[#555]">
                  <p>&gt; abc1237 &quot;example commit&quot; — 2h ago</p>
                  <p>&gt; def4561 &quot;another line&quot; — 1d ago</p>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px] md:text-xs">
                  <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                    <dt className="text-[#666]">Days left</dt>
                    <dd className="text-lg font-semibold tabular-nums text-[#39FF14]">
                      {p.daysLeft}
                    </dd>
                  </div>
                  <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                    <dt className="text-[#666]">Stake</dt>
                    <dd className="text-lg font-semibold tabular-nums text-[#FF6B00]">
                      ${p.stake}
                    </dd>
                  </div>
                  <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                    <dt className="text-[#666]">Commits</dt>
                    <dd className="text-lg font-semibold tabular-nums text-[#39FF14]">
                      —
                    </dd>
                  </div>
                </dl>
                <div className="mt-auto pt-4">
                  <p className="font-mono mb-1 text-[10px] uppercase text-[#666]">
                    {Math.round(p.progress * 100)}% of window elapsed
                  </p>
                  <ProgressBar value={p.progress} atRisk={p.atRisk} />
                </div>
              </article>
            ))}
        </div>
      </div>
    </section>
  )
}
