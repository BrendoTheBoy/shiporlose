import { type FormEvent, useState } from "react"
import { Link } from "react-router-dom"
import { FunctionsHttpError } from "@supabase/supabase-js"
import { useAuth } from "../context/AuthContext"
import { useUserProjectsFeed } from "../context/UserProjectsFeedContext"
import { supabase } from "../lib/supabase"
import { RepoSelect } from "./RepoSelect"
import type { GitHubRepo } from "../lib/github"

const MAX = 100
const MAX_NAME = 30

type CheckoutResponse = { url?: string; error?: string }

async function checkoutErrorMessage(
  fnErr: unknown,
  data: CheckoutResponse | null,
): Promise<string> {
  if (data?.error) return data.error
  if (fnErr instanceof FunctionsHttpError) {
    try {
      const body = (await fnErr.context.json()) as { error?: string }
      if (body.error) return body.error
    } catch {
      /* ignore */
    }
  }
  return fnErr instanceof Error ? fnErr.message : "Could not start checkout."
}

export function DeclareForm() {
  const {
    user,
    loading: authLoading,
    githubUsername,
    githubAccessToken,
    signInWithGitHub,
  } = useAuth()
  const { declareBlockedProjectId, projectsLoading } = useUserProjectsFeed()
  const [projectName, setProjectName] = useState("")
  const [building, setBuilding] = useState("")
  const [shipped, setShipped] = useState("")
  const [repo, setRepo] = useState<GitHubRepo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!user || !githubUsername) {
      setError("Authentication required.")
      return
    }
    if (!repo) {
      setError("Select a GitHub repository.")
      return
    }
    const name = projectName.trim()
    const desc = building.trim()
    const ship = shipped.trim()
    if (!name || !desc || !ship) {
      setError("Fill all required fields.")
      return
    }

    setSubmitting(true)
    try {
      const { count, error: cntErr } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["active", "pending_review", "flagged"])

      if (cntErr) throw cntErr
      if ((count ?? 0) > 0) {
        setError(
          "You already have an active project. Finish or abandon it before declaring another.",
        )
        return
      }

      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession()
      if (sessionErr) throw sessionErr
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setError("Session expired. Sign in again.")
        return
      }

      const { data, error: fnErr } =
        await supabase.functions.invoke<CheckoutResponse>("create-checkout", {
          body: {
            project_name: name,
            description: desc,
            shipped_when: ship,
            repo_url: repo.html_url,
            repo_full_name: repo.full_name,
            user_id: user.id,
            github_username: githubUsername,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

      if (fnErr) {
        throw new Error(await checkoutErrorMessage(fnErr, data))
      }
      if (data?.error) {
        throw new Error(data.error)
      }
      if (!data?.url) {
        throw new Error("Checkout did not return a URL.")
      }

      window.location.assign(data.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start checkout.")
    } finally {
      setSubmitting(false)
    }
  }

  const loggedOut = !user
  const showProjectFetchWait = Boolean(user) && projectsLoading

  return (
    <section
      id="declare"
      className="scroll-mt-[5.75rem] border-b-2 border-[#1f1f1f] px-4 py-16 md:px-8 md:py-20"
    >
      <h2
        id="declare-heading"
        className="font-display mb-8 text-center text-[11px] text-[#39FF14] sm:text-xs md:text-sm"
      >
        DECLARE YOUR PROJECT
      </h2>
      <div className="mx-auto max-w-2xl">
        {authLoading ? (
          <div className="border-2 border-[#39FF14] bg-[#050505] p-6 shadow-[inset_0_0_40px_rgba(57,255,20,0.06)] md:p-8">
            <p className="font-mono text-xs text-[#555]">…</p>
          </div>
        ) : loggedOut ? (
          <div className="border-2 border-[#39FF14] bg-[#050505] p-6 shadow-[inset_0_0_40px_rgba(57,255,20,0.06)] md:p-8">
            <p className="font-mono text-xs leading-relaxed text-[#39FF14]">
              <span className="text-[#FF6B00]">guest@shiporlose:~$</span> ERROR:
              authentication required.{" "}
              <button
                type="button"
                onClick={() => void signInWithGitHub()}
                className="inline border-2 border-[#39FF14] bg-[#0a0a0a] px-2 py-0.5 font-mono uppercase text-[#39FF14] hover:bg-[#0d120d]"
              >
                SIGN IN WITH GITHUB
              </button>{" "}
              to declare.
            </p>
          </div>
        ) : showProjectFetchWait ? (
          <div className="border-2 border-[#39FF14] bg-[#050505] p-6 shadow-[inset_0_0_40px_rgba(57,255,20,0.06)] md:p-8">
            <p className="font-mono text-xs text-[#555]">…</p>
          </div>
        ) : declareBlockedProjectId ? (
          <div className="border-2 border-[#39FF14] bg-[#050505] p-6 shadow-[inset_0_0_40px_rgba(57,255,20,0.06)] md:p-8">
            <p className="font-mono text-xs leading-relaxed text-[#39FF14] uppercase tracking-wide">
              YOU HAVE AN ACTIVE PROJECT. SHIP IT OR LOSE IT.
            </p>
            <Link
              to={`/project/${declareBlockedProjectId}`}
              className="glitch-btn font-display mt-6 inline-block border-2 border-[#FF6B00] bg-[#0a0a0a] px-4 py-3 text-[9px] uppercase tracking-wide text-[#FF6B00] hover:bg-[#120a04] sm:text-[10px]"
            >
              GO TO MY PROJECT →
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="border-2 border-[#39FF14] bg-[#050505] p-6 shadow-[inset_0_0_40px_rgba(57,255,20,0.06)] md:p-8"
          >
            <p className="font-mono mb-6 text-xs text-[#39FF14]">
              <span className="text-[#FF6B00]">
                {githubUsername ?? "user"}@shiporlose:~$
              </span>{" "}
              ./declare --phase=2
            </p>

            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                Project name
              </span>
              <input
                type="text"
                maxLength={MAX_NAME}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="terminal-input terminal-caret-line mt-2 w-full border-2 border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#39FF14] placeholder:text-[#2a4a2a]"
                placeholder="e.g. Ship Or Lose, ReceiptFax, PanicBoard"
                autoComplete="off"
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-[#555]">
                {projectName.length}/{MAX_NAME}
              </span>
            </label>

            <label className="mt-6 block">
              <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                What are you building?
              </span>
              <input
                type="text"
                maxLength={MAX}
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="terminal-input terminal-caret-line mt-2 w-full border-2 border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#39FF14] placeholder:text-[#2a4a2a]"
                placeholder="One sentence. No essays."
                autoComplete="off"
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-[#555]">
                {building.length}/{MAX}
              </span>
            </label>

            <label className="mt-6 block">
              <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                GitHub repo
              </span>
              <div className="mt-2">
                <RepoSelect
                  accessToken={githubAccessToken}
                  value={repo}
                  onChange={setRepo}
                  disabled={submitting}
                />
              </div>
            </label>

            <label className="mt-6 block">
              <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                I&apos;ll consider this shipped when...
              </span>
              <input
                type="text"
                maxLength={MAX}
                value={shipped}
                onChange={(e) => setShipped(e.target.value)}
                className="terminal-input terminal-caret-line mt-2 w-full border-2 border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#39FF14] placeholder:text-[#2a4a2a]"
                placeholder="Concrete. Verifiable. One sentence."
                autoComplete="off"
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-[#555]">
                {shipped.length}/{MAX}
              </span>
            </label>

            <div className="mt-8 max-w-[400px] border border-[#39FF14]/80 bg-[#050505] px-2.5 py-1.5 text-left shadow-[inset_0_0_10px_rgba(57,255,20,0.04)]">
              <div
                className="space-y-1 font-mono text-[10px] leading-tight text-[#39FF14] sm:text-[11px]"
                style={{ fontFamily: '"IBM Plex Mono", monospace' }}
              >
                <div>
                  <div className="flex min-w-0 items-baseline gap-x-1">
                    <span className="w-[11.5rem] shrink-0 text-[#888] sm:w-[12.5rem]">
                      COMMITMENT STAKE
                    </span>
                    <span
                      className="mb-0.5 min-h-[1px] min-w-[0.5rem] flex-1 border-b border-dotted border-[#2a4a2a]"
                      aria-hidden
                    />
                    <span className="w-[2.25rem] shrink-0 text-right tabular-nums sm:w-[2.5rem]">
                      $20
                    </span>
                  </div>
                  <span className="mt-0.5 block text-[9px] text-[#555]">
                    (returned if you ship)
                  </span>
                </div>
                <div>
                  <div className="flex min-w-0 items-baseline gap-x-1">
                    <span className="w-[11.5rem] shrink-0 text-[#888] sm:w-[12.5rem]">
                      POOL ENTRY FEE
                    </span>
                    <span
                      className="mb-0.5 min-h-[1px] min-w-[0.5rem] flex-1 border-b border-dotted border-[#2a4a2a]"
                      aria-hidden
                    />
                    <span className="w-[2.25rem] shrink-0 text-right tabular-nums sm:w-[2.5rem]">
                      $10
                    </span>
                  </div>
                  <span className="mt-0.5 block text-[9px] text-[#555]">
                    (split among winners)
                  </span>
                </div>
                <div className="border-t border-[#1a3d1a] pt-1">
                  <div className="flex min-w-0 items-baseline gap-x-1">
                    <span className="w-[11.5rem] shrink-0 font-semibold text-[#888] sm:w-[12.5rem]">
                      TOTAL
                    </span>
                    <span
                      className="mb-0.5 min-h-[1px] min-w-[0.5rem] flex-1 border-b border-dotted border-[#2a4a2a]"
                      aria-hidden
                    />
                    <span className="w-[2.25rem] shrink-0 text-right tabular-nums font-semibold sm:w-[2.5rem]">
                      $30
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p
                className="font-mono mt-4 border border-red-800 bg-[#140808] p-2 text-xs text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="glitch-btn font-display mt-8 w-full border-2 border-[#FF6B00] bg-[#0a0a0a] py-4 text-[9px] uppercase leading-relaxed text-[#FF6B00] disabled:opacity-50 sm:text-[10px]"
            >
              {submitting
                ? "OPENING CHECKOUT…"
                : "PAY $30 & LOCK IN MY COMMITMENT"}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
