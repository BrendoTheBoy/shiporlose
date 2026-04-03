import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import type { ProjectRow } from "../types/database"

function isValidEmail(value: string): boolean {
  const t = value.trim()
  if (t.length < 3 || t.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

export function PayoutEmailSection({
  project,
  onSaved,
}: {
  project: ProjectRow
  onSaved: () => void
}) {
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)

  const hasEmail = project.payout_email != null && project.payout_email.trim() !== ""

  useEffect(() => {
    if (!justSubmitted) return
    const t = window.setTimeout(() => setJustSubmitted(false), 8000)
    return () => window.clearTimeout(t)
  }, [justSubmitted])

  if (justSubmitted) {
    return (
      <div className="mt-4 border-4 border-[#39FF14] border-double bg-[#050805] p-3 shadow-[inset_0_0_0_1px_#1a3d1a]">
        <p className="font-mono text-[10px] font-semibold uppercase leading-relaxed tracking-wide text-[#39FF14] sm:text-[11px]">
          PAYOUT EMAIL SAVED. YOU&apos;LL RECEIVE YOUR WINNINGS WITHIN 48 HOURS.
        </p>
      </div>
    )
  }

  if (hasEmail) {
    if (project.payout_sent) {
      return (
        <div className="mt-4 border-4 border-[#1a3d1a] bg-[#050805] p-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#39FF14] sm:text-[11px]">
            PAYOUT SENT ✓
          </p>
        </div>
      )
    }
    return (
      <div className="mt-4 border-4 border-[#2a5a2a] border-dashed bg-[#050805] p-3">
        <p className="font-mono text-[10px] leading-relaxed text-[#39FF14] sm:text-[11px]">
          PAYOUT PENDING — we&apos;ll send your winnings to{" "}
          <span className="break-all text-[#7fff7f]">{project.payout_email}</span>{" "}
          within 48 hours
        </p>
      </div>
    )
  }

  const submit = async () => {
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setErr("Enter a valid email address")
      return
    }
    setSaving(true)
    setErr(null)
    const { error } = await supabase
      .from("projects")
      .update({ payout_email: trimmed })
      .eq("id", project.id)
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setJustSubmitted(true)
    onSaved()
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="border-4 border-[#39FF14] border-double bg-[#020803] p-3 shadow-[4px_4px_0_#0a1f0a]">
        <p className="font-mono text-[10px] font-bold uppercase leading-relaxed tracking-wide text-[#39FF14] sm:text-[11px]">
          YOU SHIPPED! ENTER YOUR EMAIL TO RECEIVE YOUR PAYOUT
        </p>
      </div>
      <div className="border-4 border-[#1a4a1a] bg-[#050805] p-3">
        <label
          htmlFor={`payout-email-${project.id}`}
          className="font-mono text-[9px] font-semibold uppercase tracking-wide text-[#5ddf5d]"
        >
          PAYOUT EMAIL (for Interac e-transfer)
        </label>
        <input
          id={`payout-email-${project.id}`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="mt-2 w-full border-4 border-[#2a5a2a] bg-[#0a0a0a] px-3 py-2 font-mono text-[11px] text-[#39FF14] placeholder:text-[#2a4a2a] focus:border-[#39FF14] focus:outline-none"
        />
        <button
          type="button"
          disabled={saving || !email.trim()}
          onClick={() => void submit()}
          className="mt-3 w-full border-4 border-[#39FF14] bg-[#0a0a0a] py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#39FF14] shadow-[3px_3px_0_#0a1f0a] hover:bg-[#0f1f0f] disabled:opacity-50"
        >
          {saving ? "…" : "SUBMIT PAYOUT EMAIL"}
        </button>
        {err && (
          <p className="mt-2 font-mono text-[10px] text-red-400">{err}</p>
        )}
      </div>
    </div>
  )
}
