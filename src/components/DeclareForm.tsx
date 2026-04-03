import { type FormEvent, useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { AsciiDivider } from "./AsciiDivider"
import { RepoSelect } from "./RepoSelect"
import type { GitHubRepo } from "../lib/github"

const MAX = 100
const MAX_NAME = 30

export function DeclareForm() {
  const { user, githubUsername, githubAccessToken, signInWithGitHub } =
    useAuth()
  const [projectName, setProjectName] = useState("")
  const [building, setBuilding] = useState("")
  const [shipped, setShipped] = useState("")
  const [stake, setStake] = useState("30")
  const [repo, setRepo] = useState<GitHubRepo | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (submitted) {
      const t = window.setTimeout(() => setSubmitted(false), 6000)
      return () => window.clearTimeout(t)
    }
  }, [submitted])

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
        .eq("status", "active")

      if (cntErr) throw cntErr
      if ((count ?? 0) > 0) {
        setError(
          "You already have an active project. Finish or abandon it before declaring another.",
        )
        return
      }

      const { error: insErr } = await supabase.from("projects").insert({
        user_id: user.id,
        github_username: githubUsername,
        project_name: name,
        description: desc,
        shipped_when: ship,
        repo_url: repo.html_url,
        repo_full_name: repo.full_name,
        stake_amount: Number(stake) as 20 | 30 | 50,
        status: "active",
      })

      if (insErr) throw insErr

      setSubmitted(true)
      setProjectName("")
      setBuilding("")
      setShipped("")
      setRepo(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not declare project.")
    } finally {
      setSubmitting(false)
    }
  }

  const loggedOut = !user

  return (
    <section
      id="declare"
      className="border-b-2 border-[#1f1f1f] px-4 py-16 md:px-8 md:py-20"
    >
      <AsciiDivider label="DECLARE — TERMINAL SESSION" />
      <div className="mx-auto mt-10 max-w-2xl">
        <h2 className="font-display mb-8 text-center text-[11px] text-[#39FF14] sm:text-xs md:text-sm">
          DECLARE YOUR PROJECT
        </h2>
        {loggedOut ? (
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
                placeholder="e.g. ShipOrLose, ReceiptFax, PanicBoard"
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

            <label className="mt-6 block">
              <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                Stake amount
              </span>
              <div className="relative mt-2">
                <select
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="terminal-input w-full cursor-pointer appearance-none border-2 border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 pr-10 font-mono text-sm text-[#39FF14]"
                >
                  <option value="20">$20</option>
                  <option value="30">$30</option>
                  <option value="50">$50</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[#39FF14]">
                  ▼
                </span>
              </div>
            </label>

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
              {submitting ? "SUBMITTING…" : "PUT MY MONEY WHERE MY MOUTH IS"}
            </button>

            {submitted && (
              <p
                className="font-mono mt-4 border border-[#2a2a2a] bg-[#0d0d0d] p-3 text-center text-xs text-[#39FF14]"
                role="status"
              >
                PROJECT DECLARED. REPO LINKED. 30 DAYS START NOW.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
