import { useEffect, useMemo, useRef, useState } from "react"
import type { GitHubRepo } from "../lib/github"
import { fetchUserRepos } from "../lib/github"

type Props = {
  accessToken: string | null
  value: GitHubRepo | null
  onChange: (repo: GitHubRepo | null) => void
  disabled?: boolean
}

export function RepoSelect({
  accessToken,
  value,
  onChange,
  disabled,
}: Props) {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!accessToken || !open) return
    let cancelled = false
    const tid = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void fetchUserRepos(accessToken)
        .then((list) => {
          if (!cancelled) setRepos(list)
        })
        .catch((e: unknown) => {
          if (!cancelled)
            setError(e instanceof Error ? e.message : "Failed to load repos")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(tid)
    }
  }, [accessToken, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return repos
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q),
    )
  }, [repos, filter])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled || !accessToken}
        onClick={() => setOpen((o) => !o)}
        className="terminal-input flex w-full cursor-pointer items-center justify-between border-2 border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 text-left font-mono text-sm text-[#39FF14] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">
          {value ? value.name : "[ SELECT REPO ]"}
        </span>
        <span className="shrink-0 pl-2 text-[#39FF14]" aria-hidden>
          ▼
        </span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 border-2 border-[#39FF14] bg-[#050505] shadow-[4px_4px_0_#111]">
          <div className="border-b-2 border-[#1a3d1a] p-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter repos…"
              className="w-full border-2 border-[#1a3d1a] bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-[#39FF14] placeholder:text-[#2a4a2a]"
              autoComplete="off"
            />
          </div>
          <div className="max-h-48 overflow-y-auto font-mono text-xs">
            {loading && (
              <div className="px-3 py-2 text-[#888]">fetching…</div>
            )}
            {error && (
              <div className="px-3 py-2 text-red-500">{error}</div>
            )}
            {!loading &&
              !error &&
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(r)
                    setOpen(false)
                    setFilter("")
                  }}
                  className="block w-full border-b border-[#1a1a1a] px-3 py-2 text-left text-[#39FF14] hover:bg-[#0d120d]"
                >
                  {r.name}
                  <span className="block text-[10px] text-[#666]">
                    {r.full_name}
                  </span>
                </button>
              ))}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-3 py-2 text-[#888]">no matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
