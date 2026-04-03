export function ProgressBar({
  value,
  atRisk,
  muted,
}: {
  value: number
  atRisk: boolean
  muted?: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <div
      className={`h-3 w-full border-2 ${
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
