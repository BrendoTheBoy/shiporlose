import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function isValidProofUrl(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

type Props = {
  open: boolean
  projectId: string
  shippedWhen: string
  onClose: () => void
  onSuccess: () => void
}

export function ClaimShippedModal({
  open,
  projectId,
  shippedWhen,
  onClose,
  onSuccess,
}: Props) {
  const [proofUrl, setProofUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, saving])

  useEffect(() => {
    if (open) {
      setProofUrl("")
      setErr(null)
    }
  }, [open])

  if (!open) return null

  const submit = async () => {
    const url = proofUrl.trim()
    if (!isValidProofUrl(url)) {
      setErr("Enter a valid URL starting with http:// or https://")
      return
    }
    setSaving(true)
    setErr(null)
    const { error } = await supabase
      .from("projects")
      .update({
        status: "pending_review",
        proof_url: url,
        review_started_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setProofUrl("")
    onSuccess()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-shipped-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto border-2 border-[#39FF14] bg-[#0a0a0a] p-5 shadow-[6px_6px_0_#1a3d1a]">
        <h2
          id="claim-shipped-title"
          className="font-display border-b-2 border-[#2a4a2a] pb-3 text-[10px] leading-relaxed text-[#39FF14] sm:text-[11px]"
        >
          SUBMIT PROOF OF SHIPPING
        </h2>

        <div className="mt-4 border-2 border-[#FF6B00] bg-[#080808] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wide text-[#888]">
            Your &quot;shipped means&quot; (definition of done)
          </p>
          <p className="font-body mt-2 text-sm leading-relaxed text-[#e0e0e0]">
            {shippedWhen}
          </p>
        </div>

        <label className="mt-5 block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#39FF14]">
            PROOF URL — link where anyone can verify your project is live (app
            store, live site, GitHub release, product page)
          </span>
          <input
            type="url"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            className="mt-2 w-full border-2 border-[#1a3d1a] bg-[#050505] px-2 py-2 font-mono text-[12px] text-[#39FF14] placeholder:text-[#444]"
            placeholder="https://myapp.com or link to product page"
            autoComplete="off"
          />
        </label>

        {err && (
          <p className="mt-3 font-mono text-[10px] text-red-400">{err}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="border-2 border-[#39FF14] bg-[#0a0a0a] px-3 py-2 font-mono text-[9px] uppercase leading-snug text-[#39FF14] disabled:opacity-50 sm:text-[10px]"
          >
            {saving ? "…" : "SUBMIT FOR REVIEW — 48HR WINDOW STARTS NOW"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setErr(null)
              setProofUrl("")
              onClose()
            }}
            className="border-2 border-[#444] bg-[#0a0a0a] px-3 py-2 font-mono text-[10px] uppercase text-[#888] disabled:opacity-50"
          >
            NOT YET
          </button>
        </div>
      </div>
    </div>
  )
}
