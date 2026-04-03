import { fetchCommits } from "./github"
import { supabase } from "./supabase"

export async function syncCommitsForProject(
  projectId: string,
  repoFullName: string,
  sinceIso: string,
  accessToken: string,
): Promise<void> {
  const rows = await fetchCommits(repoFullName, sinceIso, accessToken)
  if (rows.length === 0) return

  const { error } = await supabase.from("commits").upsert(
    rows.map((r) => ({
      project_id: projectId,
      sha: r.sha,
      message: r.message,
      committed_at: r.committed_at,
    })),
    { onConflict: "sha" },
  )
  if (error) throw error
}
