import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import type { CheckinRow } from "../types/database"

const MAX = 200

export function LogWorkInput({
  projectId,
  onDone,
  variant = "default",
}: {
  projectId: string
  onDone: (checkin: CheckinRow) => void
  /** Inside activity terminal: single-line prompt, no card frame. */
  variant?: "default" | "terminal"
}) {
  const { user } = useAuth()
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!user) return null

  const submit = async () => {
    const t = content.trim()
    if (!t) return
    setSaving(true)
    setErr(null)
    const { data, error } = await supabase
      .from("checkins")
      .insert({
        project_id: projectId,
        user_id: user.id,
        content: t,
      })
      .select()
      .single()
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    if (!data) {
      setErr("No row returned")
      return
    }
    setContent("")
    onDone(data as CheckinRow)
  }

  if (variant === "terminal") {
    return (
      <div className="mb-0 border-b border-[#1a1a1a] pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 select-none font-mono text-[10px] text-[#39FF14]">
            &gt;
          </span>
          <input
            type="text"
            value={content}
            maxLength={MAX}
            onChange={(e) => setContent(e.target.value.slice(0, MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder="log entry (max 200 chars)"
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[10px] text-[#39FF14] placeholder:text-[#2a4a2a] focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            disabled={saving || !content.trim()}
            onClick={() => void submit()}
            className="shrink-0 border border-[#39FF14] bg-[#0a0a0a] px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-[#39FF14] hover:bg-[#0f1f0f] disabled:opacity-50"
          >
            {saving ? "…" : "SUBMIT"}
          </button>
        </div>
        <div className="mt-1 flex min-h-[14px] items-start justify-end gap-2">
          {err && (
            <p className="mr-auto font-mono text-[9px] text-red-400">{err}</p>
          )}
          <p className="font-mono text-[8px] text-[#3a3a3a] tabular-nums">
            {content.length}/{MAX}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8 border-4 border-[#1a3d1a] bg-[#050805] p-4">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-wide text-[#5ddf5d]">
        LOG WORK (non-code progress)
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-1 font-mono text-[11px] text-[#39FF14]">
          <span className="shrink-0 select-none">&gt;</span>
          <input
            type="text"
            value={content}
            maxLength={MAX}
            onChange={(e) => setContent(e.target.value.slice(0, MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder="Ship log entry (max 200 chars)"
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[10px] text-[#39FF14] placeholder:text-[#2a4a2a] focus:outline-none focus:ring-0 sm:text-[11px]"
          />
        </label>
        <button
          type="button"
          disabled={saving || !content.trim()}
          onClick={() => void submit()}
          className="shrink-0 border-2 border-[#39FF14] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[#39FF14] hover:bg-[#0f1f0f] disabled:opacity-50 sm:px-4 sm:py-2 sm:text-[10px]"
        >
          {saving ? "…" : "SUBMIT"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {err && (
          <p className="font-mono text-[10px] text-red-400">{err}</p>
        )}
        <p className="ml-auto font-mono text-[10px] text-[#555]">
          {content.length}/{MAX}
        </p>
      </div>
    </div>
  )
}
