import type { CommitRow, ProjectRow, ProjectStatus } from "../types/database"

export function daysLeftUntil(deadlineIso: string): number {
  const deadline = new Date(deadlineIso).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((deadline - now) / 86400000))
}

export function deadlinePassed(deadlineIso: string): boolean {
  return new Date(deadlineIso).getTime() < Date.now()
}

export function progressElapsed(project: ProjectRow): number {
  const created = new Date(project.created_at).getTime()
  const now = Date.now()
  const elapsedDays = (now - created) / 86400000
  return Math.min(1, Math.max(0, elapsedDays / 30))
}

export function isAtRisk(project: ProjectRow, commits: CommitRow[]): boolean {
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

export function cardFrameClass(
  status: ProjectStatus,
  atRisk: boolean,
  passed: boolean,
): string {
  if (status === "abandoned") {
    return "border-[#3a3a3a] opacity-60"
  }
  if (status === "shipped") {
    return "border-[#39FF14] shadow-[0_0_28px_rgba(57,255,20,0.14)]"
  }
  if (status === "flagged") {
    return "border-[#aa3300] shadow-[inset_0_0_32px_rgba(80,0,0,0.2)]"
  }
  if (status === "pending_review") {
    return "border-[#cc8800]"
  }
  if (passed && status === "active") {
    return "border-red-800"
  }
  if (atRisk) {
    return "border-[#FF6B00]"
  }
  return "border-[#2a2a2a]"
}
