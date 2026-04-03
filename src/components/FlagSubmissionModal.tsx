import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const REASON_PRESETS = [
  "Proof doesn't match shipped definition",
  "Project appears incomplete or non-functional",
  "Fake or placeholder project",
] as const

type ReasonKey = (typeof REASON_PRESETS)[number] | "other"

type Props = {
  open: boolean
  projectId: string
  projectName: string
  shippedWhen: string
  proofUrl: string
  onClose: () => void
  onSuccess: () => void
}

export function FlagSubmissionModal({
  open,
  projectId,
  projectName,
  shippedWhen,
  proofUrl,
  onClose,
  onSuccess,
}: Props) {
  const [reasonKey, setReasonKey] = useState<ReasonKey>(
    REASON_PRESETS[0],
  )
  const [otherText, setOtherText] = useState("")
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
    if (!open) return
    queueMicrotask(() => {
      setReasonKey(REASON_PRESETS[0])
      setOtherText("")
      setErr(null)
    })
  }, [open])

  if (!open) return null

  const buildReason = (): string | null => {
    if (reasonKey === "other") {
      const t = otherText.trim()
      if (!t) {
        setErr("Describe the issue (required for “Other”).")
        return null
      }
      if (t.length > 300) {
        setErr("Reason must be 300 characters or fewer.")
        return null
      }
      return t
    }
    return reasonKey
  }

  const submit = async () => {
    const reason = buildReason()
    if (!reason) return
    setSaving(true)
    setErr(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id
    if (!uid) {
      setSaving(false)
      setErr("You must be signed in to flag a submission.")
      return
    }
    const { error } = await supabase.from("flags").insert({
      project_id: projectId,
      user_id: uid,
      reason,
    })
    setSaving(false)
    if (error) {
      if (error.code === "23505") {
        setErr("You have already flagged this project.")
      } else {
        setErr(error.message)
      }
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[20001] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flag-submission-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto border-2 border-[#cc8800] bg-[#0a0a0a] p-5 shadow-[6px_6px_0_#331800]">
        <h2
          id="flag-submission-title"
          className="font-display border-b-2 border-[#553300] pb-3 text-[10px] leading-relaxed text-[#FFAA00] sm:text-[11px]"
        >
          FLAG SUSPICIOUS SUBMISSION
        </h2>

        <p className="font-mono mt-4 text-[10px] uppercase tracking-wide text-[#888]">
          Project
        </p>
        <p className="font-display mt-1 text-[11px] text-[#39FF14]">{projectName}</p>

        <div className="mt-4 border-2 border-[#553300] bg-[#080808] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wide text-[#888]">
            &quot;Shipped means&quot; (definition of done)
          </p>
          <p className="font-body mt-2 text-sm leading-relaxed text-[#e0e0e0]">
            {shippedWhen}
          </p>
        </div>

        <p className="font-mono mt-4 text-[10px] uppercase tracking-wide text-[#888]">
          Proof link (open to verify)
        </p>
        <p className="mt-1 break-all font-mono text-[11px]">
          <a
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[#39FF14] underline decoration-[#2a4a2a] underline-offset-2 hover:text-[#FF6B00]"
          >
            {proofUrl}
          </a>
        </p>

        <fieldset className="mt-5 border-2 border-[#2a2a2a] bg-[#080808] p-3">
          <legend className="font-mono px-1 text-[9px] uppercase tracking-wide text-[#666]">
            Reason
          </legend>
          <div className="space-y-2">
            {REASON_PRESETS.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-2 font-mono text-[10px] text-[#c4c4c4]"
              >
                <input
                  type="radio"
                  name="flag-reason"
                  className="mt-0.5 border-2 border-[#553300] bg-[#0a0a0a] accent-[#FFAA00]"
                  checked={reasonKey === r}
                  onChange={() => {
                    setReasonKey(r)
                    setErr(null)
                  }}
                />
                <span>{r}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-start gap-2 font-mono text-[10px] text-[#c4c4c4]">
              <input
                type="radio"
                name="flag-reason"
                className="mt-0.5 border-2 border-[#553300] bg-[#0a0a0a] accent-[#FFAA00]"
                checked={reasonKey === "other"}
                onChange={() => {
                  setReasonKey("other")
                  setErr(null)
                }}
              />
              <span>Other</span>
            </label>
          </div>
        </fieldset>

        {reasonKey === "other" && (
          <label className="mt-4 block">
            <span className="font-mono text-[10px] uppercase tracking-wide text-[#888]">
              Describe (max 300 chars)
            </span>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value.slice(0, 300))}
              rows={3}
              className="mt-2 w-full border-2 border-[#553300] bg-[#050505] px-2 py-2 font-mono text-[11px] text-[#FFAA00] placeholder:text-[#444]"
              placeholder="What looks wrong?"
            />
            <span className="font-mono text-[9px] text-[#555]">
              {otherText.length}/300
            </span>
          </label>
        )}

        {err && (
          <p className="mt-3 font-mono text-[10px] text-red-400">{err}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="border-2 border-[#cc8800] bg-[#0a0a0a] px-3 py-2 font-mono text-[9px] uppercase leading-snug text-[#FFAA00] disabled:opacity-50 sm:text-[10px]"
          >
            {saving ? "…" : "SUBMIT FLAG"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setErr(null)
              onClose()
            }}
            className="border-2 border-[#444] bg-[#0a0a0a] px-3 py-2 font-mono text-[10px] uppercase text-[#888] disabled:opacity-50"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
