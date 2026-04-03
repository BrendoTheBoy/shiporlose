import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useParams } from "react-router-dom"
import { ClaimShippedModal } from "../components/ClaimShippedModal"
import { FlagSubmissionModal } from "../components/FlagSubmissionModal"
import { LogWorkInput } from "../components/LogWorkInput"
import { PayoutEmailSection } from "../components/PayoutEmailSection"
import { ProgressBar } from "../components/ProgressBar"
import { AsciiDivider } from "../components/AsciiDivider"
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
import type { CheckinRow, CommitRow, ProjectRow } from "../types/database"

const PROJECT_COLUMNS_PUBLIC =
  "id, user_id, github_username, project_name, description, shipped_when, repo_url, repo_full_name, stake_amount, stake_status, status, proof_url, stripe_session_id, payment_intent_id, created_at, deadline, review_started_at, shipped_at, abandoned_at"

function activityTime(iso: string): number {
  return new Date(iso).getTime()
}

export function ProjectPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const { user, githubAccessToken } = useAuth()
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [commits, setCommits] = useState<CommitRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [flagCount, setFlagCount] = useState(0)
  const [iFlagged, setIFlagged] = useState(false)
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    if (!routeId) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setFetchErr(null)
    setLoading(true)
    setNotFound(false)

    const { data: proj, error: pErr } = await supabase
      .from("projects")
      .select(PROJECT_COLUMNS_PUBLIC)
      .eq("id", routeId)
      .maybeSingle()

    if (pErr) {
      setFetchErr(pErr.message)
      setProject(null)
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
      setFetchErr(cErr.message)
      setLoading(false)
      return
    }

    const { data: checkinRows, error: chErr } = await supabase
      .from("checkins")
      .select("*")
      .eq("project_id", routeId)
      .order("created_at", { ascending: false })

    if (chErr) {
      setFetchErr(chErr.message)
      setLoading(false)
      return
    }

    const { count: fc, error: fErr } = await supabase
      .from("flags")
      .select("id", { count: "exact", head: true })
      .eq("project_id", routeId)

    if (fErr) {
      setFetchErr(fErr.message)
      setLoading(false)
      return
    }

    setFlagCount(fc ?? 0)

    if (user?.id) {
      const { data: mine, error: mErr } = await supabase
        .from("flags")
        .select("id")
        .eq("project_id", routeId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!mErr) {
        setIFlagged(!!mine)
      }
    } else {
      setIFlagged(false)
    }

    setProject(merged)
    setCommits((commitRows ?? []) as CommitRow[])
    setCheckins((checkinRows ?? []) as CheckinRow[])
    setLoading(false)
  }, [routeId, user])

  useEffect(() => {
    syncedRef.current = false
  }, [routeId])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

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
      if (!cancelled) await load()
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

  if (loading) {
    return (
      <div className="relative mx-auto max-w-[900px] px-4 py-16 md:px-8">
        <p className="font-mono text-center text-xs text-[#888]">
          LOADING PROJECT…
        </p>
      </div>
    )
  }

  if (notFound || fetchErr || !project) {
    return (
      <div className="relative mx-auto max-w-[900px] px-4 py-20 md:px-8">
        <Helmet>
          <title>Project not found — ShipOrLose</title>
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

  return (
    <div className="relative mx-auto max-w-[900px] px-4 pb-24 pt-8 md:px-8 md:pt-12">
      <Helmet>
        <title>{`${project.project_name} — ShipOrLose`}</title>
        <meta property="og:title" content={`${project.project_name} — ShipOrLose`} />
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
          onSuccess={() => void load()}
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
            onSuccess={() => void load()}
          />
        )}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-wide text-[#39FF14] hover:text-[#FF6B00]"
        >
          ← BACK TO FEED
        </Link>
        <button
          type="button"
          onClick={copyShare}
          className="border-2 border-[#39FF14] bg-[#0a0a0a] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wide text-[#39FF14] hover:bg-[#0f1f0f]"
        >
          {shareCopied ? "LINK COPIED!" : "SHARE"}
        </button>
      </div>

      <article
        className={`border-4 bg-[#0d0d0d] p-6 shadow-[6px_6px_0_#111] md:p-8 ${frame}`}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          <img
            src={avatarUrl}
            alt=""
            className="h-20 w-20 shrink-0 border-4 border-[#39FF14] bg-[#0a0a0a] object-cover"
            width={80}
            height={80}
          />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-wide text-[#888]">
              @{project.github_username}
            </p>
            <h1 className="font-display mt-2 text-sm leading-snug text-[#39FF14] sm:text-base">
              {project.project_name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {project.status === "pending_review" && (
                <span className="font-mono text-[10px] uppercase tracking-wide border border-[#cc8800] bg-[#1a1200] px-2 py-0.5 text-[#FFAA00]">
                  UNDER REVIEW
                </span>
              )}
              {project.status === "shipped" && (
                <span className="font-mono text-[10px] uppercase tracking-wide border border-[#2a6a2a] bg-[#081008] px-2 py-0.5 text-[#39FF14]">
                  SHIPPED ✓
                </span>
              )}
              {project.status === "abandoned" && (
                <span className="font-mono text-[10px] uppercase tracking-wide border border-red-900 bg-[#180808] px-2 py-0.5 text-red-400">
                  ABANDONED
                </span>
              )}
              {project.status === "flagged" && (
                <span className="font-mono text-[10px] uppercase tracking-wide border border-[#992200] bg-[#1a0800] px-2 py-0.5 text-[#ff5555]">
                  UNDER INVESTIGATION
                </span>
              )}
              {project.status === "active" && (
                <span className="font-mono text-[10px] uppercase tracking-wide border border-[#2a4a2a] bg-[#080808] px-2 py-0.5 text-[#39FF14]">
                  ACTIVE
                </span>
              )}
            </div>

            {showThreeDayPulse && (
              <p className="font-mono mt-3 animate-pulse text-[10px] uppercase tracking-wide text-[#FF6B00]">
                ⚠ 3 DAYS LEFT — SHIP OR LOSE
              </p>
            )}

            <div className="mt-4 font-mono text-[11px] leading-relaxed text-[#39FF14]">
              {project.status === "abandoned" && (
                <p className="uppercase tracking-wide text-red-400">
                  DEADLINE PASSED
                </p>
              )}
              {project.status === "shipped" && project.shipped_at && (
                <p>
                  SHIPPED ON{" "}
                  {new Date(project.shipped_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
              {project.status === "active" && !passed && (
                <p className="tabular-nums">{dl} DAYS LEFT</p>
              )}
              {project.status === "active" && passed && (
                <p className="uppercase text-red-400">DEADLINE PASSED</p>
              )}
              {(project.status === "pending_review" || project.status === "flagged") && (
                <p className="text-[#FFAA00]">
                  REVIEW:{" "}
                  {reviewEnd != null
                    ? formatReviewCountdownMs(reviewLeftMs)
                    : "—"}{" "}
                  · FLAGS: {flagCount}
                </p>
              )}
            </div>

            <p className="mt-4 font-mono text-[11px]">
              <span className="text-[#888]">STAKE: </span>
              {project.status === "shipped" ? (
                <span className="text-[#39FF14]">RETURNED</span>
              ) : project.status === "abandoned" ? (
                <span className="text-red-400">FORFEITED</span>
              ) : (
                <span className="text-[#FF6B00]">${project.stake_amount}</span>
              )}
            </p>

            <p className="mt-3 font-mono text-[11px]">
              <span className="text-[#666]">REPO: </span>
              <a
                href={project.repo_url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[#39FF14] underline decoration-[#2a4a2a] underline-offset-2 hover:text-[#FF6B00]"
              >
                {project.repo_full_name}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-8 border-4 border-[#FF6B00] bg-[#080400] p-4 shadow-[inset_0_0_0_1px_rgba(255,107,0,0.3)]">
          <p className="font-mono text-[9px] font-bold uppercase tracking-wide text-[#FF6B00]">
            SHIPPED MEANS (PUBLIC CONTRACT)
          </p>
          <p className="font-body mt-3 text-sm leading-relaxed text-[#e8e8e8]">
            {project.shipped_when}
          </p>
        </div>

        {project.proof_url && (
          <p className="font-mono mt-6 text-[11px]">
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

        <p className="font-body mt-6 text-sm leading-relaxed text-[#c4c4c4]">
          {project.description}
        </p>

        {own && (
          <div className="mt-8 border-t-2 border-[#2a2a2a] pt-8">
            {canClaimShip && (
              <button
                type="button"
                onClick={() => setClaimOpen(true)}
                className="w-full border-4 border-[#39FF14] bg-[#0a0a0a] py-3 font-mono text-[10px] font-bold uppercase tracking-wide text-[#39FF14] shadow-[3px_3px_0_#0a1f0a] hover:bg-[#0f1f0f] sm:w-auto sm:px-8"
              >
                CLAIM SHIPPED
              </button>
            )}
            {project.status === "pending_review" && (
              <p className="font-mono text-[10px] leading-relaxed text-[#888]">
                YOUR SUBMISSION IS IN THE 48-HOUR COMMUNITY REVIEW WINDOW.
              </p>
            )}
            {project.status === "shipped" && (
              <PayoutEmailSection project={project} onSaved={() => void load()} />
            )}
          </div>
        )}

        {!own &&
          project.status === "pending_review" &&
          project.proof_url &&
          user && (
            <div className="mt-8 border-t-2 border-[#2a2a2a] pt-8">
              {iFlagged ? (
                <button
                  type="button"
                  disabled
                  className="w-full border-2 border-[#2a4a2a] bg-[#0a0a0a] py-2 font-mono text-[9px] uppercase tracking-wide text-[#39FF14] opacity-80 sm:w-auto sm:px-6"
                >
                  FLAGGED ✓
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setFlagOpen(true)}
                  className="w-full border-2 border-[#cc8800] bg-[#0a0a0a] py-2 font-mono text-[9px] uppercase tracking-wide text-[#FFAA00] hover:bg-[#1a1200] sm:w-auto sm:px-6"
                >
                  FLAG THIS SUBMISSION
                </button>
              )}
            </div>
          )}

        <div className="mt-8">
          <p className="font-mono mb-2 text-[10px] uppercase text-[#666]">
            {Math.round(prog * 100)}% of window elapsed
          </p>
          <ProgressBar
            value={prog}
            atRisk={
              atRisk &&
              project.status !== "shipped" &&
              project.status !== "abandoned"
            }
            muted={project.status === "abandoned"}
          />
        </div>
      </article>

      <div className="mt-16">
        <AsciiDivider label="ACTIVITY" />
      </div>

      <section className="mt-10">
        {showLogWork && (
          <LogWorkInput projectId={project.id} onDone={() => void load()} />
        )}

        {activity.length === 0 ? (
          <p className="font-mono text-center text-[11px] text-[#666]">
            No activity yet. Start building and your commits will appear here.
          </p>
        ) : (
          <ul className="space-y-4">
            {activity.map((item) =>
              item.kind === "commit" && item.commit ? (
                <li
                  key={`c-${item.id}`}
                  className="border-l-4 border-[#39FF14] bg-[#0a0a0a] pl-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-[#39FF14]">
                      COMMIT
                    </span>
                    <span className="font-mono text-[10px] text-[#666]">
                      {new Date(item.commit.committed_at).toLocaleString()}
                    </span>
                    <span className="font-mono text-[10px] text-[#555]">
                      {item.commit.sha.slice(0, 7)}
                    </span>
                  </div>
                  <p className="font-mono mt-2 text-[11px] leading-relaxed text-[#c4c4c4]">
                    {truncateText(item.commit.message, 500)}
                  </p>
                  <p className="font-mono mt-1 text-[10px] text-[#666]">
                    {formatRelativeTime(item.commit.committed_at)}
                  </p>
                </li>
              ) : item.kind === "checkin" && item.checkin ? (
                <li
                  key={`k-${item.id}`}
                  className="border-l-4 border-[#FF6B00] bg-[#0a0a0a] pl-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-[#FF6B00]">
                      LOG
                    </span>
                    <span className="font-mono text-[10px] text-[#666]">
                      {new Date(item.checkin.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-mono mt-2 text-[11px] leading-relaxed text-[#c4c4c4]">
                    {item.checkin.content}
                  </p>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
