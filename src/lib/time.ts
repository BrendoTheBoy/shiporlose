export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString()
}

/** 48-hour community review window after proof submission */
export const REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000

export function reviewWindowEndsAt(
  reviewStartedAt: string | null | undefined,
): number | null {
  if (!reviewStartedAt) return null
  return new Date(reviewStartedAt).getTime() + REVIEW_WINDOW_MS
}

export function formatReviewCountdownMs(remainingMs: number): string {
  if (remainingMs <= 0) return "0h 0m 0s"
  const s = Math.floor(remainingMs / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h ${m}m ${sec}s`
}

export function truncateText(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}
