import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

export type AuthContextValue = {
  user: User | null
  session: Session | null
  githubAccessToken: string | null
  githubUsername: string | null
  loading: boolean
  signInWithGitHub: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Persists GitHub OAuth token for server-side commit sync (only when Supabase includes provider_token on the session). */
function persistGithubTokenForSync(session: Session | null): void {
  const token = session?.provider_token
  if (!token || !session?.user?.id) return
  void supabase.rpc("upsert_github_token", { p_access_token: token }).then(
    ({ error }) => {
      if (error) console.error("upsert_github_token", error)
    },
  )
}

function githubUsernameFromUser(user: User | null): string | null {
  if (!user) return null
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    (typeof meta?.user_name === "string" && meta.user_name) ||
    (typeof meta?.preferred_username === "string" && meta.preferred_username) ||
    (typeof meta?.login === "string" && meta.login) ||
    null
  if (fromMeta) return fromMeta
  const id = user.identities?.find((i) => i.provider === "github")
  const idData = id?.identity_data as Record<string, unknown> | undefined
  if (typeof idData?.user_name === "string") return idData.user_name
  if (typeof idData?.login === "string") return idData.login
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      persistGithubTokenForSync(s)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      persistGithubTokenForSync(s)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGitHub = useCallback(async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        scopes: "repo read:user user:email",
      },
    })
    if (error) console.error(error)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const githubAccessToken = session?.provider_token ?? null
    return {
      user,
      session,
      githubAccessToken,
      githubUsername: githubUsernameFromUser(user),
      loading,
      signInWithGitHub,
      signOut,
    }
  }, [user, session, loading, signInWithGitHub, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook is intentionally exported next to provider for this app.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
