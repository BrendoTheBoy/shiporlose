export type GitHubRepo = {
  id: number
  name: string
  full_name: string
  html_url: string
  private: boolean
}

type GitHubCommitApi = {
  sha: string
  commit: {
    message: string
    author: { date: string | null } | null
  }
}

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
})

export async function fetchUserRepos(
  accessToken: string,
): Promise<GitHubRepo[]> {
  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=30",
    { headers: GH_HEADERS(accessToken) },
  )
  if (!res.ok) {
    throw new Error(`GitHub repos failed: ${res.status}`)
  }
  return (await res.json()) as GitHubRepo[]
}

export async function fetchCommits(
  repoFullName: string,
  since: string,
  accessToken: string,
): Promise<
  { sha: string; message: string; committed_at: string }[]
> {
  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) {
    throw new Error(`Invalid repo full name: ${repoFullName}`)
  }

  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
  )
  url.searchParams.set("since", since)
  url.searchParams.set("per_page", "100")

  const res = await fetch(url.toString(), { headers: GH_HEADERS(accessToken) })
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
