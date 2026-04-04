import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const HEADER = "x-sync-secret"

type GitHubCommitApi = {
  sha: string
  commit: {
    message: string
    author: { date: string | null } | null
  }
}

const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
})

async function fetchCommits(
  repoFullName: string,
  since: string,
  accessToken: string,
): Promise<{ sha: string; message: string; committed_at: string }[]> {
  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) {
    throw new Error(`Invalid repo full name: ${repoFullName}`)
  }

  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
  )
  url.searchParams.set("since", since)
  url.searchParams.set("per_page", "100")

  const res = await fetch(url.toString(), { headers: ghHeaders(accessToken) })
  if (res.status === 401) {
    const err = new Error("GITHUB_UNAUTHORIZED") as Error & { status: number }
    err.status = 401
    throw err
  }
  if (!res.ok) {
    throw new Error(`GitHub commits failed: ${res.status}`)
  }

  const data = (await res.json()) as GitHubCommitApi[]
  return data.map((c) => ({
    sha: c.sha,
    message: (c.commit.message ?? "").split("\n")[0].trim(),
    committed_at:
      c.commit.author?.date ?? new Date().toISOString(),
  }))
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-sync-secret",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  const secret = Deno.env.get("SYNC_SECRET")
  const got = req.headers.get(HEADER) ?? req.headers.get("X-Sync-Secret")
  if (!secret) {
    console.error("SYNC_SECRET not configured")
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (got !== secret) {
    console.error("invalid or missing sync secret header")
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const nowIso = new Date().toISOString()

  const { data: projects, error: qErr } = await supabase
    .from("projects")
    .select("id, user_id, repo_full_name, created_at")
    .in("status", ["active", "pending_review"])

  if (qErr) {
    console.error("projects query", qErr.message)
    return new Response(
      JSON.stringify({ ok: false, error: qErr.message, at: nowIso }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }

  const tokenCache = new Map<string, string | null>()

  async function getTokenForUser(userId: string): Promise<string | null> {
    if (tokenCache.has(userId)) return tokenCache.get(userId) ?? null
    const { data, error } = await supabase
      .from("github_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) {
      console.error("github_tokens", userId, error.message)
      tokenCache.set(userId, null)
      return null
    }
    const token =
      data && typeof data.access_token === "string" && data.access_token.length > 0
        ? data.access_token
        : null
    tokenCache.set(userId, token)
    return token
  }

  type ProjectResult = {
    project_id: string
    repo_full_name: string
    commits_synced: number
  }
  type Skipped = {
    project_id: string
    repo_full_name: string
    reason: string
  }

  const synced: ProjectResult[] = []
  const skipped: Skipped[] = []
  const errors: string[] = []

  for (const row of projects ?? []) {
    const projectId = row.id as string
    const userId = row.user_id as string
    const repoFullName = row.repo_full_name as string
    const createdAt = row.created_at as string

    const accessToken = await getTokenForUser(userId)
    if (!accessToken) {
      skipped.push({
        project_id: projectId,
        repo_full_name: repoFullName,
        reason: "no_github_token",
      })
      continue
    }

    let rows: { sha: string; message: string; committed_at: string }[]
    try {
      rows = await fetchCommits(repoFullName, createdAt, accessToken)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === "GITHUB_UNAUTHORIZED" || (e as Error & { status?: number }).status === 401) {
        console.warn(
          `GitHub 401 for project ${projectId} (user ${userId}); skipping until token refresh`,
        )
        skipped.push({
          project_id: projectId,
          repo_full_name: repoFullName,
          reason: "github_unauthorized",
        })
        continue
      }
      console.error("fetchCommits", projectId, msg)
      errors.push(`${projectId}: ${msg}`)
      continue
    }

    if (rows.length === 0) {
      synced.push({
        project_id: projectId,
        repo_full_name: repoFullName,
        commits_synced: 0,
      })
      continue
    }

    const { error: upErr } = await supabase.from("commits").upsert(
      rows.map((r) => ({
        project_id: projectId,
        sha: r.sha,
        message: r.message,
        committed_at: r.committed_at,
      })),
      { onConflict: "sha" },
    )

    if (upErr) {
      console.error("commits upsert", projectId, upErr.message)
      errors.push(`${projectId}: ${upErr.message}`)
      continue
    }

    synced.push({
      project_id: projectId,
      repo_full_name: repoFullName,
      commits_synced: rows.length,
    })
  }

  const body = {
    ok: errors.length === 0,
    at: nowIso,
    projects_synced: synced,
    skipped: skipped.length ? skipped : undefined,
    errors: errors.length ? errors : undefined,
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
})
