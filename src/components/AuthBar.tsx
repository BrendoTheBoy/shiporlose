import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const FEED_NAV_STATUSES = [
  "active",
  "pending_review",
  "flagged",
  "shipped",
] as const

function statusRank(s: string): number {
  if (s === "active") return 0
  if (s === "pending_review") return 1
  if (s === "flagged") return 2
  if (s === "shipped") return 3
  return 99
}

export function AuthBar() {
  const {
    user,
    loading,
    githubUsername,
    signInWithGitHub,
    signOut,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [myProjectId, setMyProjectId] = useState<string | null>(null)

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (githubUsername ? `https://github.com/${githubUsername}.png` : null)

  useEffect(() => {
    if (!user?.id) {
      queueMicrotask(() => setMyProjectId(null))
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .in("status", [...FEED_NAV_STATUSES])
        .order("created_at", { ascending: false })
      if (cancelled || error) return
      const rows = (data ?? []) as {
        id: string
        status: string
        created_at: string
      }[]
      if (rows.length === 0) {
        setMyProjectId(null)
        return
      }
      rows.sort((a, b) => {
        const ra = statusRank(a.status)
        const rb = statusRank(b.status)
        if (ra !== rb) return ra - rb
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      })
      setMyProjectId(rows[0]?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (loading) {
    return (
      <div className="pointer-events-none font-mono text-[10px] text-[#555]">
        …
      </div>
    )
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGitHub()}
        className="flex items-center gap-2 border-2 border-[#39FF14] bg-[#050505] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[#39FF14] shadow-[inset_0_0_12px_rgba(57,255,20,0.08)] hover:bg-[#0a120a]"
      >
        <GitHubMark />
        <span className="whitespace-nowrap">&gt; github --auth</span>
      </button>
    )
  }

  const goDeclare = () => {
    if (location.pathname === "/") {
      document.getElementById("declare")?.scrollIntoView({ behavior: "smooth" })
    } else {
      void navigate({ pathname: "/", hash: "declare" })
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 border-2 border-[#39FF14] bg-[#0a0a0a] object-cover"
            width={32}
            height={32}
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#39FF14] bg-[#0a0a0a] font-mono text-[10px] text-[#39FF14]">
            GH
          </span>
        )}
        <span className="font-mono text-[10px] uppercase text-[#39FF14] truncate max-w-[100px] sm:max-w-[160px]">
          {githubUsername ?? user.email ?? "signed in"}
        </span>
      </div>
      {myProjectId ? (
        <Link
          to={`/project/${myProjectId}`}
          className="shrink-0 border-2 border-[#39FF14] bg-[#050805] px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wide text-[#39FF14] shadow-[inset_0_0_8px_rgba(57,255,20,0.06)] hover:bg-[#0a120a] sm:text-[9px]"
        >
          MY PROJECT
        </Link>
      ) : (
        <button
          type="button"
          onClick={goDeclare}
          className="max-w-[120px] shrink-0 border-2 border-[#39FF14] bg-[#050805] px-2 py-1 text-center font-mono text-[7px] font-bold uppercase leading-snug tracking-wide text-[#39FF14] shadow-[inset_0_0_8px_rgba(57,255,20,0.06)] hover:bg-[#0a120a] sm:max-w-none sm:text-[9px]"
        >
          DECLARE PROJECT
        </button>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="shrink-0 border-2 border-[#FF6B00] bg-[#0a0a0a] px-2 py-1 font-mono text-[8px] uppercase tracking-wide text-[#FF6B00] hover:bg-[#120a04] sm:text-[9px]"
      >
        LOGOUT
      </button>
    </div>
  )
}
