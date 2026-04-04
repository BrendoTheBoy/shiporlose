import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "./AuthContext"
import { supabase } from "../lib/supabase"

/** Statuses that show “MY PROJECT” in the nav (includes post-ship). */
export const FEED_NAV_STATUSES = [
  "active",
  "pending_review",
  "flagged",
  "shipped",
] as const

/** Statuses that block declaring another project on the landing page. */
export const DECLARE_BLOCK_STATUSES = [
  "active",
  "pending_review",
  "flagged",
] as const

const BLOCK_SET = new Set<string>(DECLARE_BLOCK_STATUSES)

function statusRank(s: string): number {
  if (s === "active") return 0
  if (s === "pending_review") return 1
  if (s === "flagged") return 2
  if (s === "shipped") return 3
  return 99
}

type Row = { id: string; status: string; created_at: string }

export type UserProjectsFeedValue = {
  navProjectId: string | null
  declareBlockedProjectId: string | null
  projectsLoading: boolean
}

const UserProjectsFeedContext = createContext<UserProjectsFeedValue | null>(
  null,
)

function useUserProjectsFeedState(): UserProjectsFeedValue {
  const { user } = useAuth()
  const [navProjectId, setNavProjectId] = useState<string | null>(null)
  const [declareBlockedProjectId, setDeclareBlockedProjectId] = useState<
    string | null
  >(null)
  /** When set to `user.id`, the latest project fetch for that user has finished. */
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      queueMicrotask(() => {
        setNavProjectId(null)
        setDeclareBlockedProjectId(null)
        setFetchedForUserId(null)
      })
      return
    }
    const uid = user.id
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, status, created_at")
        .eq("user_id", uid)
        .in("status", [...FEED_NAV_STATUSES])
        .order("created_at", { ascending: false })
      if (cancelled) return
      if (error) {
        setNavProjectId(null)
        setDeclareBlockedProjectId(null)
        setFetchedForUserId(uid)
        return
      }
      const rows = (data ?? []) as Row[]
      if (rows.length === 0) {
        setNavProjectId(null)
        setDeclareBlockedProjectId(null)
        setFetchedForUserId(uid)
        return
      }
      const sortedNav = [...rows].sort((a, b) => {
        const ra = statusRank(a.status)
        const rb = statusRank(b.status)
        if (ra !== rb) return ra - rb
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      })
      const blocking = rows.filter((r) => BLOCK_SET.has(r.status))
      blocking.sort((a, b) => {
        const ra = statusRank(a.status)
        const rb = statusRank(b.status)
        if (ra !== rb) return ra - rb
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      })
      setNavProjectId(sortedNav[0]?.id ?? null)
      setDeclareBlockedProjectId(blocking[0]?.id ?? null)
      setFetchedForUserId(uid)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const uid = user?.id
  const projectsLoading = Boolean(uid) && fetchedForUserId !== uid

  return { navProjectId, declareBlockedProjectId, projectsLoading }
}

export function UserProjectsFeedProvider({ children }: { children: ReactNode }) {
  const value = useUserProjectsFeedState()
  return (
    <UserProjectsFeedContext.Provider value={value}>
      {children}
    </UserProjectsFeedContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserProjectsFeed(): UserProjectsFeedValue {
  const ctx = useContext(UserProjectsFeedContext)
  if (!ctx) {
    throw new Error(
      "useUserProjectsFeed must be used within UserProjectsFeedProvider",
    )
  }
  return ctx
}
