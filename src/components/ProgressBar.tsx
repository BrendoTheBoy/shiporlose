export function ProgressBar({
  value,
  atRisk,
  muted,
  compact,
}: {
  value: number
  atRisk: boolean
  muted?: boolean
  /** Tighter bar for dense layouts (e.g. project page). */
  compact?: boolean
}) {
  const pct = Math.round(value * 100)
  const h = compact ? "h-2" : "h-3"
  return (
    <div
      className={`${h} w-full border-2 ${
        muted
          ? "border-[#444]"
          : atRisk
            ? "border-[#FF6B00]"
            : "border-[#2a4a2a]"
      }`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full transition-all ${
          muted ? "bg-[#555]" : atRisk ? "bg-[#FF6B00]" : "bg-[#39FF14]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
