import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US")}`
}

function firstOfMonthDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, "0")}-01`
}

export function PoolDisplay() {
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const month = firstOfMonthDate()
      const { data, error } = await supabase
        .from("pools")
        .select("total_amount")
        .eq("month", month)
        .maybeSingle()

      if (cancelled) return
      if (!error && data?.total_amount != null) {
        setAmount(data.total_amount)
      } else {
        setAmount(0)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const str = formatMoney(loading ? 0 : amount)
  return (
    <div
      className="lcd-glow border-2 border-[#39FF14] bg-[#050505] px-4 py-3 shadow-[inset_0_0_20px_rgba(57,255,20,0.12),0_0_30px_rgba(57,255,20,0.15)]"
      aria-live="polite"
    >
      <p className="font-display mb-2 text-[8px] uppercase tracking-widest text-[#FF6B00] sm:text-[9px]">
        Current pool
      </p>
      <div
        className="flex flex-wrap items-baseline justify-center gap-0.5 font-mono text-2xl font-semibold tabular-nums tracking-widest text-[#39FF14] drop-shadow-[0_0_8px_rgba(57,255,20,0.55)] sm:text-3xl md:text-4xl"
        style={{ fontFamily: '"IBM Plex Mono", monospace' }}
      >
        {str.split("").map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            className="inline-block min-w-[0.65em] border border-[#1a3d1a] bg-[#0c120c] px-1 py-0.5 text-center"
          >
            {ch}
          </span>
        ))}
      </div>
      <p className="mt-2 font-body text-[10px] text-[#666]">
        {loading ? "Syncing pool…" : "Month-to-date total · Stripe in Phase 3"}
      </p>
    </div>
  )
}
