import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { syncCommitsForProject } from "../lib/syncCommits"
import { formatRelativeTime, truncateText } from "../lib/time"
import type { CommitRow, ProjectRow } from "../types/database"
import { AsciiDivider } from "./AsciiDivider"

type ProjectWithCommits = ProjectRow & {
  commits: CommitRow[]
}

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

function ProgressBar({
  value,
  atRisk,
}: {
  value: number
  atRisk: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <div
      className={`h-3 w-full border-2 ${atRisk ? "border-[#FF6B00]" : "border-[#2a4a2a]"}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full transition-all ${atRisk ? "bg-[#FF6B00]" : "bg-[#39FF14]"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function daysLeftUntil(deadlineIso: string): number {
  const deadline = new Date(deadlineIso).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((deadline - now) / 86400000))
}

function progressElapsed(project: ProjectRow): number {
  const created = new Date(project.created_at).getTime()
  const now = Date.now()
  const elapsedDays = (now - created) / 86400000
  return Math.min(1, Math.max(0, elapsedDays / 30))
}

function isAtRisk(project: ProjectRow, commits: CommitRow[]): boolean {
  const now = Date.now()
  const seven = 7 * 86400000
  const sorted = [...commits].sort(
    (a, b) =>
      new Date(b.committed_at).getTime() -
      new Date(a.committed_at).getTime(),
  )
  const last = sorted[0]
  if (last) {
    return now - new Date(last.committed_at).getTime() >= seven
  }
  return now - new Date(project.created_at).getTime() >= seven
}

function CheckinControl({
  projectId,
  onDone,
}: {
  projectId: string
  onDone: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!user) return null

  const submit = async () => {
    const t = content.trim()
    if (!t) return
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from("checkins").insert({
      project_id: projectId,
      user_id: user.id,
      content: t,
    })
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setContent("")
    setOpen(false)
    onDone()
  }

  return (
    <div className="mt-3 border-t border-[#2a2a2a] pt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[10px] uppercase tracking-wide text-[#888] hover:text-[#39FF14]"
        >
          + LOG NON-CODE WORK
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 200))}
            rows={3}
            className="w-full border-2 border-[#1a3d1a] bg-[#0a0a0a] px-2 py-1 font-mono text-[11px] text-[#39FF14]"
            placeholder="Ship log entry (max 200 chars)"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !content.trim()}
              onClick={() => void submit()}
              className="border border-[#39FF14] bg-[#0a0a0a] px-2 py-1 font-mono text-[10px] uppercase text-[#39FF14] disabled:opacity-50"
            >
              {saving ? "…" : "LOG IT"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setContent("")
                setErr(null)
              }}
              className="font-mono text-[10px] uppercase text-[#666]"
            >
              cancel
            </button>
          </div>
          {err && (
            <p className="font-mono text-[10px] text-red-400">{err}</p>
          )}
          <p className="font-mono text-[10px] text-[#555]">
            {content.length}/200
          </p>
        </div>
      )}
    </div>
  )
}

export function LiveProjects() {
  const { user, githubAccessToken } = useAuth()
  const [rows, setRows] = useState<ProjectWithCommits[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const syncedRef = useRef<Set<string>>(new Set())

  const load = useCallback(async () => {
    setFetchErr(null)
    setLoading(true)
    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20)

    if (pErr) {
      setFetchErr(pErr.message)
      setRows([])
      setLoading(false)
      return
    }

    const plist = projects ?? []
    const ids = plist.map((p) => p.id)
    if (ids.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const { data: commits, error: cErr } = await supabase
      .from("commits")
      .select("*")
      .in("project_id", ids)

    if (cErr) {
      setFetchErr(cErr.message)
      setRows([])
      setLoading(false)
      return
    }

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

    const mine = rows.filter((p) => p.user_id === user.id)
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
    // rows omitted on purpose: projectIdsKey tracks id set; avoids re-sync on commit refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, githubAccessToken, projectIdsKey, load])

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
            rows.map((p) => {
              const atRisk = isAtRisk(p, p.commits)
              const topCommits = p.commits.slice(0, 3)
              const totalCommits = p.commits.length
              const dl = daysLeftUntil(p.deadline)
              const prog = progressElapsed(p)
              const own = user?.id === p.user_id
              const avatarUrl = `https://github.com/${p.github_username}.png`

              return (
                <article
                  key={p.id}
                  className={`card-lift flex flex-col border-2 bg-[#0d0d0d] p-5 shadow-[4px_4px_0_#111] ${
                    atRisk ? "border-[#FF6B00]" : "border-[#2a2a2a]"
                  }`}
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
                      <h3 className="font-display min-w-0 text-[10px] text-[#39FF14] sm:text-[11px]">
                        {p.project_name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tabular-nums text-[#39FF14] border border-[#2a4a2a] bg-[#080808] px-2 py-0.5">
                        commits: {totalCommits}
                      </span>
                      {atRisk && (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-[#FF6B00]">
                          ⚠ AT RISK
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-body text-sm text-[#c4c4c4]">
                    {p.description}
                  </p>
                  <p className="font-body mt-2 border-l-2 border-[#FF6B00] pl-2 text-xs text-[#888]">
                    <span className="text-[#666]">Shipped means:</span>{" "}
                    {p.shipped_when}
                  </p>

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
                    <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                      <dt className="text-[#666]">Days left</dt>
                      <dd
                        className={`text-lg font-semibold tabular-nums ${atRisk ? "text-[#FF6B00]" : "text-[#39FF14]"}`}
                      >
                        {dl}
                      </dd>
                    </div>
                    <div className="border border-[#2a2a2a] bg-[#080808] p-2">
                      <dt className="text-[#666]">Stake</dt>
                      <dd className="text-lg font-semibold tabular-nums text-[#FF6B00]">
                        ${p.stake_amount}
                      </dd>
                    </div>
                    <div className="col-span-2 border border-[#2a2a2a] bg-[#080808] p-2 md:col-span-1">
                      <dt className="text-[#666]">Repo</dt>
                      <dd className="truncate text-[10px] text-[#39FF14]">
                        <a
                          href={p.repo_url}
                          target="_blank"
                          rel="noreferrer"
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
                    <ProgressBar value={prog} atRisk={atRisk} />
                  </div>
                  {own && (
                    <CheckinControl projectId={p.id} onDone={() => void load()} />
                  )}
                </article>
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
