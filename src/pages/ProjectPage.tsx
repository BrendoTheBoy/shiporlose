import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useParams } from "react-router-dom"
import { ClaimShippedModal } from "../components/ClaimShippedModal"
import { FlagSubmissionModal } from "../components/FlagSubmissionModal"
import { LogWorkInput } from "../components/LogWorkInput"
import { PayoutEmailSection } from "../components/PayoutEmailSection"
import { ProgressBar } from "../components/ProgressBar"
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
  formatReviewCountdownMs,
  reviewWindowEndsAt,
  truncateText,
} from "../lib/time"
import type { CheckinRow, CommitRow, ProjectRow } from "../types/database"

const PROJECT_COLUMNS_PUBLIC =
  "id, user_id, github_username, project_name, description, shipped_when, repo_url, repo_full_name, stake_amount, stake_status, status, proof_url, stripe_session_id, payment_intent_id, created_at, deadline, review_started_at, shipped_at, abandoned_at"

function activityTime(iso: string): number {
  return new Date(iso).getTime()
}

/** Survives remounts so back-navigation can show data immediately while refetching. */
type ProjectPageCacheEntry = {
  project: ProjectRow
  commits: CommitRow[]
  checkins: CheckinRow[]
  flagCount: number
  iFlagged: boolean
}

const projectPageCache = new Map<string, ProjectPageCacheEntry>()

function bootFromCache(routeId: string | undefined) {
  if (!routeId) {
    return {
      project: null as ProjectRow | null,
      commits: [] as CommitRow[],
      checkins: [] as CheckinRow[],
      flagCount: 0,
      iFlagged: false,
      loading: true,
    }
  }
  const e = projectPageCache.get(routeId)
  if (!e) {
    return {
      project: null as ProjectRow | null,
      commits: [] as CommitRow[],
      checkins: [] as CheckinRow[],
      flagCount: 0,
      iFlagged: false,
      loading: true,
    }
  }
  return {
    project: e.project,
    commits: e.commits,
    checkins: e.checkins,
    flagCount: e.flagCount,
    iFlagged: e.iFlagged,
    loading: false,
  }
}

export function ProjectPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const { user, githubAccessToken } = useAuth()
  const [project, setProject] = useState<ProjectRow | null>(
    () => bootFromCache(routeId).project,
  )
  const [commits, setCommits] = useState<CommitRow[]>(
    () => bootFromCache(routeId).commits,
  )
  const [checkins, setCheckins] = useState<CheckinRow[]>(
    () => bootFromCache(routeId).checkins,
  )
  const [flagCount, setFlagCount] = useState(
    () => bootFromCache(routeId).flagCount,
  )
  const [iFlagged, setIFlagged] = useState(
    () => bootFromCache(routeId).iFlagged,
  )
  const [loading, setLoading] = useState(() => bootFromCache(routeId).loading)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const syncedRef = useRef(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false
      if (!routeId) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setFetchErr(null)
      if (!silent) {
        setLoading(true)
      }
      setNotFound(false)

      const { data: proj, error: pErr } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS_PUBLIC)
        .eq("id", routeId)
        .maybeSingle()

      if (pErr) {
        if (!silent) {
          setFetchErr(pErr.message)
          setProject(null)
        } else {
          console.error(pErr)
        }
        setLoading(false)
        return
      }
      if (!proj) {
        setNotFound(true)
        setProject(null)
        setLoading(false)
        return
      }

      const base = proj as Omit<
        ProjectRow,
        "payout_email" | "payout_sent" | "payout_amount"
      >
      let merged: ProjectRow = {
        ...base,
        payout_email: null,
        payout_sent: false,
        payout_amount: null,
      }

      if (user?.id === base.user_id) {
        const { data: payRow, error: payErr } = await supabase
          .from("projects")
          .select("payout_email, payout_sent, payout_amount")
          .eq("id", routeId)
          .maybeSingle()
        if (!payErr && payRow) {
          const p = payRow as {
            payout_email: string | null
            payout_sent: boolean
            payout_amount: number | null
          }
          merged = {
            ...merged,
            payout_email: p.payout_email,
            payout_sent: p.payout_sent,
            payout_amount: p.payout_amount,
          }
        }
      }

      const { data: commitRows, error: cErr } = await supabase
        .from("commits")
        .select("*")
        .eq("project_id", routeId)
        .order("committed_at", { ascending: false })

      if (cErr) {
        if (!silent) {
          setFetchErr(cErr.message)
        } else {
          console.error(cErr)
        }
        setLoading(false)
        return
      }

      const { data: checkinRows, error: chErr } = await supabase
        .from("checkins")
        .select("*")
        .eq("project_id", routeId)
        .order("created_at", { ascending: false })

      if (chErr) {
        if (!silent) {
          setFetchErr(chErr.message)
        } else {
          console.error(chErr)
        }
        setLoading(false)
        return
      }

      const { count: fc, error: fErr } = await supabase
        .from("flags")
        .select("id", { count: "exact", head: true })
        .eq("project_id", routeId)

      if (fErr) {
        if (!silent) {
          setFetchErr(fErr.message)
        } else {
          console.error(fErr)
        }
        setLoading(false)
        return
      }

      const fcVal = fc ?? 0
      let nextIFlagged = false
      if (user?.id) {
        const { data: mine, error: mErr } = await supabase
          .from("flags")
          .select("id")
          .eq("project_id", routeId)
          .eq("user_id", user.id)
          .maybeSingle()
        if (!mErr) {
          nextIFlagged = !!mine
        }
      }

      const commitList = (commitRows ?? []) as CommitRow[]
      const checkinList = (checkinRows ?? []) as CheckinRow[]

      setFlagCount(fcVal)
      setIFlagged(nextIFlagged)
      setProject(merged)
      setCommits(commitList)
      setCheckins(checkinList)
      setLoading(false)

      projectPageCache.set(routeId, {
        project: merged,
        commits: commitList,
        checkins: checkinList,
        flagCount: fcVal,
        iFlagged: nextIFlagged,
      })
    },
    [routeId, user],
  )

  useEffect(() => {
    syncedRef.current = false
  }, [routeId])

  useEffect(() => {
    const silent = routeId != null && projectPageCache.has(routeId)
    queueMicrotask(() => void load({ silent }))
  }, [load, routeId])

  useEffect(() => {
    if (
      !user ||
      !githubAccessToken ||
      !project ||
      project.user_id !== user.id
    ) {
      return
    }
    if (
      project.status !== "active" &&
      project.status !== "pending_review" &&
      project.status !== "flagged"
    ) {
      return
    }
    if (syncedRef.current) return
    syncedRef.current = true

    let cancelled = false
    void (async () => {
      try {
        await syncCommitsForProject(
          project.id,
          project.repo_full_name,
          project.created_at,
          githubAccessToken,
        )
      } catch (e) {
        console.error(e)
        syncedRef.current = false
      }
      if (!cancelled) await load({ silent: true })
    })()

    return () => {
      cancelled = true
    }
  }, [user, githubAccessToken, project, load])

  const own = !!(user && project && user.id === project.user_id)
  const atRisk = project ? isAtRisk(project, commits) : false
  const passed = project ? deadlinePassed(project.deadline) : false
  const dl = project ? daysLeftUntil(project.deadline) : 0
  const prog =
    project &&
    (project.status === "shipped" || project.status === "abandoned")
      ? 1
      : project
        ? progressElapsed(project)
        : 0

  const reviewEnd = project?.review_started_at
    ? reviewWindowEndsAt(project.review_started_at)
    : null
  const reviewLeftMs = reviewEnd != null ? reviewEnd - now : 0

  const activity = useMemo(() => {
    const items: {
      kind: "commit" | "checkin"
      id: string
      at: number
      commit?: CommitRow
      checkin?: CheckinRow
    }[] = []
    for (const c of commits) {
      items.push({
        kind: "commit",
        id: c.id,
        at: activityTime(c.committed_at),
        commit: c,
      })
    }
    for (const ch of checkins) {
      items.push({
        kind: "checkin",
        id: ch.id,
        at: activityTime(ch.created_at),
        checkin: ch,
      })
    }
    items.sort((a, b) => b.at - a.at)
    return items
  }, [commits, checkins])

  const canonicalUrl =
    typeof window !== "undefined" ? window.location.href : ""

  const copyShare = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    })
  }

  if (loading && !project) {
    return (
      <div className="relative mx-auto max-w-[800px] px-3 py-10 md:px-5">
        <p className="font-mono text-center text-xs text-[#888]">
          LOADING PROJECT…
        </p>
      </div>
    )
  }

  if (notFound || fetchErr || !project) {
    return (
      <div className="relative mx-auto max-w-[800px] px-3 py-12 md:px-5">
        <Helmet>
          <title>Project not found — Ship Or Lose</title>
        </Helmet>
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-wide text-[#39FF14] hover:text-[#FF6B00]"
        >
          ← BACK TO FEED
        </Link>
        <div className="mt-12 border-4 border-red-900 bg-[#0a0808] p-8 text-center">
          <p className="font-display text-[10px] text-red-400 sm:text-xs">
            {fetchErr ? fetchErr : "PROJECT NOT FOUND"}
          </p>
        </div>
      </div>
    )
  }

  const avatarUrl = `https://github.com/${project.github_username}.png`
  const frame = cardFrameClass(project.status, atRisk, passed)
  const showThreeDayPulse =
    project.status === "active" && !passed && dl > 0 && dl <= 3
  const canClaimShip =
    own && project.status === "active" && !passed
  const showLogWork = own && project.status === "active" && !passed

  const ogDesc = `${project.description} | Shipped means: ${project.shipped_when}`

  const statusContext = (() => {
    if (project.status === "abandoned") {
      return <span className="uppercase text-red-400">DEADLINE PASSED</span>
    }
    if (project.status === "shipped" && project.shipped_at) {
      return (
        <span>
          SHIPPED ON{" "}
          {new Date(project.shipped_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      )
    }
    if (project.status === "active" && !passed) {
      return <span className="tabular-nums text-[#39FF14]">{dl} DAYS LEFT</span>
    }
    if (project.status === "active" && passed) {
      return <span className="uppercase text-red-400">DEADLINE PASSED</span>
    }
    if (
      project.status === "pending_review" ||
      project.status === "flagged"
    ) {
      return (
        <span className="text-[#FFAA00]">
          REVIEW:{" "}
          {reviewEnd != null
            ? formatReviewCountdownMs(reviewLeftMs)
            : "—"}{" "}
          · FLAGS: {flagCount}
        </span>
      )
    }
    return <span className="text-[#888]">—</span>
  })()

  const dateShort = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <div className="relative mx-auto max-w-[800px] px-3 pb-16 pt-6 md:px-5 md:pt-8">
      <Helmet>
        <title>{`${project.project_name} — Ship Or Lose`}</title>
        <meta property="og:title" content={`${project.project_name} — Ship Or Lose`} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="description" content={ogDesc} />
      </Helmet>

      {canClaimShip && (
        <ClaimShippedModal
          open={claimOpen}
          projectId={project.id}
          shippedWhen={project.shipped_when}
          onClose={() => setClaimOpen(false)}
          onSuccess={() => void load({ silent: true })}
        />
      )}
      {project.status === "pending_review" &&
        project.proof_url &&
        !own &&
        user && (
          <FlagSubmissionModal
            open={flagOpen}
            projectId={project.id}
            projectName={project.project_name}
            shippedWhen={project.shipped_when}
            proofUrl={project.proof_url}
            onClose={() => setFlagOpen(false)}
            onSuccess={() => void load({ silent: true })}
          />
        )}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-wide text-[#39FF14] hover:text-[#FF6B00]"
        >
          ← BACK TO FEED
        </Link>
        <button
          type="button"
          onClick={copyShare}
          className="border-2 border-[#39FF14] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[#39FF14] hover:bg-[#0f1f0f]"
        >
          {shareCopied ? "LINK COPIED!" : "SHARE"}
        </button>
      </div>

      <article
        className={`border-4 bg-[#0d0d0d] p-4 shadow-[6px_6px_0_#111] md:p-5 ${frame}`}
      >
        {/* Header: avatar | username+title | status + claim */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1a1a1a] pb-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img
              src={avatarUrl}
              alt=""
              className="h-12 w-12 shrink-0 border-2 border-[#39FF14] bg-[#0a0a0a] object-cover sm:h-14 sm:w-14"
              width={56}
              height={56}
            />
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#666]">
                @{project.github_username}
              </p>
              <h1 className="font-display mt-0.5 text-[11px] leading-tight text-[#39FF14] sm:text-xs">
                {project.project_name}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {project.status === "pending_review" && (
              <span className="font-mono text-[9px] uppercase tracking-wide border border-[#cc8800] bg-[#1a1200] px-1.5 py-0.5 text-[#FFAA00]">
                UNDER REVIEW
              </span>
            )}
            {project.status === "shipped" && (
              <span className="font-mono text-[9px] uppercase tracking-wide border border-[#2a6a2a] bg-[#081008] px-1.5 py-0.5 text-[#39FF14]">
                SHIPPED ✓
              </span>
            )}
            {project.status === "abandoned" && (
              <span className="font-mono text-[9px] uppercase tracking-wide border border-red-900 bg-[#180808] px-1.5 py-0.5 text-red-400">
                ABANDONED
              </span>
            )}
            {project.status === "flagged" && (
              <span className="font-mono text-[9px] uppercase tracking-wide border border-[#992200] bg-[#1a0800] px-1.5 py-0.5 text-[#ff5555]">
                UNDER INVESTIGATION
              </span>
            )}
            {project.status === "active" && (
              <span className="font-mono text-[9px] uppercase tracking-wide border border-[#2a4a2a] bg-[#080808] px-1.5 py-0.5 text-[#39FF14]">
                ACTIVE
              </span>
            )}
            {canClaimShip && (
              <button
                type="button"
                onClick={() => setClaimOpen(true)}
                className="border border-[#39FF14] bg-[#0a0a0a] px-2 py-1 font-mono text-[8px] font-bold uppercase leading-none tracking-wide text-[#39FF14] hover:bg-[#0f1f0f]"
              >
                CLAIM SHIPPED
              </button>
            )}
          </div>
        </div>

        {showThreeDayPulse && (
          <p className="font-mono mt-2 animate-pulse text-[9px] uppercase tracking-wide text-[#FF6B00]">
            ⚠ 3 DAYS LEFT — SHIP OR LOSE
          </p>
        )}

        {/* Status bar */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] leading-snug text-[#888]">
          <span className="min-w-0">{statusContext}</span>
          <span className="text-[#333] select-none" aria-hidden="true">
            |
          </span>
          <span>
            STAKE:{" "}
            {project.status === "shipped" ? (
              <span className="text-[#39FF14]">RETURNED</span>
            ) : project.status === "abandoned" ? (
              <span className="text-red-400">FORFEITED</span>
            ) : (
              <span className="text-[#FF6B00]">${project.stake_amount}</span>
            )}
          </span>
          <span className="text-[#333] select-none" aria-hidden="true">
            |
          </span>
          <a
            href={project.repo_url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-[#39FF14] underline decoration-[#2a4a2a] underline-offset-2 hover:text-[#FF6B00]"
          >
            {project.repo_full_name}
          </a>
        </div>

        <div className="mt-3">
          <p className="font-mono text-[8px] font-semibold uppercase tracking-widest text-[#555]">
            DESCRIPTION:
          </p>
          <p className="font-body mt-1 text-[13px] leading-relaxed text-[#888]">
            {project.description}
          </p>
        </div>

        <div className="mt-3 border-t border-[#2a2a2a] pt-2">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[#555]">
            {Math.round(prog * 100)}% OF WINDOW ELAPSED
          </p>
          <div className="mt-1">
            <ProgressBar
              value={prog}
              compact
              atRisk={
                atRisk &&
                project.status !== "shipped" &&
                project.status !== "abandoned"
              }
              muted={project.status === "abandoned"}
            />
          </div>
        </div>

        <div className="mt-4 border-2 border-[#FF6B00] bg-[#080400] p-3 shadow-[inset_0_0_0_1px_rgba(255,107,0,0.3)]">
          <p className="font-mono text-[9px] font-bold uppercase tracking-wide text-[#FF6B00]">
            SHIPPED MEANS (PUBLIC CONTRACT)
          </p>
          <p className="font-body mt-2 text-[13px] leading-relaxed text-[#e8e8e8]">
            {project.shipped_when}
          </p>
        </div>

        {project.proof_url && (
          <p className="font-mono mt-3 text-[10px]">
            <span className="text-[#666]">PROOF: </span>
            <a
              href={project.proof_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-[#39FF14] underline decoration-[#2a4a2a] underline-offset-2 hover:text-[#FF6B00]"
            >
              {project.proof_url}
            </a>
          </p>
        )}

        {own && (
          <div className="mt-3 space-y-3">
            {project.status === "pending_review" && (
              <p className="font-mono text-[9px] leading-relaxed text-[#888]">
                YOUR SUBMISSION IS IN THE 48-HOUR COMMUNITY REVIEW WINDOW.
              </p>
            )}
            {project.status === "shipped" && (
              <PayoutEmailSection
                project={project}
                onSaved={() => void load({ silent: true })}
              />
            )}
          </div>
        )}

        {!own &&
          project.status === "pending_review" &&
          project.proof_url &&
          user && (
            <div className="mt-3">
              {iFlagged ? (
                <button
                  type="button"
                  disabled
                  className="w-full border-2 border-[#2a4a2a] bg-[#0a0a0a] py-1.5 font-mono text-[9px] uppercase tracking-wide text-[#39FF14] opacity-80 sm:w-auto sm:px-6"
                >
                  FLAGGED ✓
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setFlagOpen(true)}
                  className="w-full border-2 border-[#cc8800] bg-[#0a0a0a] py-1.5 font-mono text-[9px] uppercase tracking-wide text-[#FFAA00] hover:bg-[#1a1200] sm:w-auto sm:px-6"
                >
                  FLAG THIS SUBMISSION
                </button>
              )}
            </div>
          )}
      </article>

      <div className="relative mt-5 border border-[#39FF14] bg-[#050805]">
        <span className="absolute -top-2 left-3 z-10 bg-[#0a0a0a] px-1 font-mono text-[8px] uppercase tracking-wide text-[#39FF14]">
          ACTIVITY LOG
        </span>
        <div className="px-2 pb-2 pt-3">
          {showLogWork && (
            <LogWorkInput
              variant="terminal"
              projectId={project.id}
              onDone={(checkin) => {
                setCheckins((prev) => {
                  if (prev.some((c) => c.id === checkin.id)) return prev
                  return [checkin, ...prev]
                })
                const e = projectPageCache.get(project.id)
                if (e) {
                  projectPageCache.set(project.id, {
                    ...e,
                    checkins: [
                      checkin,
                      ...e.checkins.filter((c) => c.id !== checkin.id),
                    ],
                  })
                }
                void load({ silent: true })
              }}
            />
          )}

          {activity.length === 0 ? (
            <p className="font-mono px-1 py-3 text-center text-[9px] text-[#555]">
              No activity yet. Start building and your commits will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-[#1f1f1f] border-t border-[#1a1a1a]">
              {activity.map((item) =>
                item.kind === "commit" && item.commit ? (
                  <li
                    key={`c-${item.id}`}
                    className="border-l-4 border-[#39FF14] bg-[#0a0a0a] pl-2"
                  >
                    <div className="flex items-start gap-2 py-1.5 pr-1 font-mono text-[9px] leading-snug sm:text-[10px]">
                      <div className="min-w-0 flex-1 text-[#aaa]">
                        <span className="text-[#39FF14]">[COMMIT]</span>{" "}
                        <span className="text-[#39FF14]">
                          {item.commit.sha.slice(0, 7)}
                        </span>{" "}
                        <span className="text-[#444]">—</span>{" "}
                        <span className="break-words">
                          {truncateText(item.commit.message, 400)}
                        </span>
                      </div>
                      <span
                        className="shrink-0 text-right text-[#555] tabular-nums"
                        title={new Date(item.commit.committed_at).toLocaleString()}
                      >
                        {dateShort(item.commit.committed_at)}
                      </span>
                    </div>
                  </li>
                ) : item.kind === "checkin" && item.checkin ? (
                  <li
                    key={`k-${item.id}`}
                    className="border-l-4 border-[#FF6B00] bg-[#0a0a0a] pl-2"
                  >
                    <div className="flex items-start gap-2 py-1.5 pr-1 font-mono text-[9px] leading-snug sm:text-[10px]">
                      <div className="min-w-0 flex-1 text-[#aaa]">
                        <span className="text-[#FF6B00]">[LOG]</span>{" "}
                        <span className="break-words">
                          {item.checkin.content}
                        </span>
                      </div>
                      <span
                        className="shrink-0 text-right text-[#555] tabular-nums"
                        title={new Date(
                          item.checkin.created_at,
                        ).toLocaleString()}
                      >
                        {dateShort(item.checkin.created_at)}
                      </span>
                    </div>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
