import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { createPortal } from "react-dom"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import type { SignalType } from "../types/database"

const MAX_LEN = 500

const typeOptions: { value: SignalType; label: string }[] = [
  { value: "bug", label: "BUG" },
  { value: "suggestion", label: "SUGGESTION" },
  { value: "other", label: "OTHER" },
]

const terminalField =
  "terminal-input terminal-caret-line w-full border-2 border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#39FF14] placeholder:text-[#2a4a2a]"

type SignalModalProps = {
  open: boolean
  onClose: () => void
}

export function SignalModal({ open, onClose }: SignalModalProps) {
  const titleId = useId()
  const { user, githubUsername, loading: authLoading } = useAuth()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [type, setType] = useState<SignalType>("suggestion")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSuccess(false)
    setSubmitting(false)
    setType("suggestion")
    setMessage("")
    setEmail("")
  }, [open])

  useEffect(() => {
    if (!open || success) return
    const t = window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, success])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting && !success) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, submitting, success])

  useEffect(() => {
    if (!success) return
    const t = window.setTimeout(() => {
      setSuccess(false)
      onClose()
    }, 2000)
    return () => window.clearTimeout(t)
  }, [success, onClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = message.trim()
    if (!trimmed) {
      setError("Message required.")
      return
    }
    if (trimmed.length > MAX_LEN) {
      setError(`Message must be ${MAX_LEN} characters or fewer.`)
      return
    }

    setSubmitting(true)
    try {
      const row = user
        ? {
            user_id: user.id,
            github_username: githubUsername ?? null,
            type,
            message: trimmed,
            email: null as string | null,
          }
        : {
            user_id: null as string | null,
            github_username: null as string | null,
            type,
            message: trimmed,
            email: email.trim() || null,
          }

      const { error: insErr } = await supabase.from("signals").insert(row)
      if (insErr) throw insErr
      setSuccess(true)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Transmission failed. Try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const modal = (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => {
        if (!submitting && !success) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto border-2 border-[#39FF14] bg-[#050505] shadow-[inset_0_0_48px_rgba(57,255,20,0.08),0_0_0_1px_rgba(57,255,20,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#1a3d1a] bg-[#080808] px-4 py-3 sm:px-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#39FF14]/80">
            ● RADIO ROOM / OUTBOUND
          </p>
        </div>

        <div className="p-4 sm:p-6">
          {success ? (
            <div className="border border-[#39FF14]/60 bg-[#0a120a] px-4 py-8 text-center">
              <p className="font-mono text-sm leading-relaxed text-[#39FF14] [text-shadow:0_0_12px_rgba(57,255,20,0.25)]">
                SIGNAL RECEIVED. WE&apos;LL LOOK INTO IT.
              </p>
            </div>
          ) : (
            <>
              <h2
                id={titleId}
                className="font-display text-[10px] uppercase leading-relaxed text-[#39FF14] sm:text-[11px]"
              >
                SEND A SIGNAL
              </h2>
              <p className="font-mono mt-2 text-xs leading-relaxed text-[#8a9a8a]">
                Bug report, feature request, or just want to yell at us.
              </p>

              {authLoading ? (
                <p className="font-mono mt-4 text-xs text-[#555]">…</p>
              ) : user ? (
                <p className="font-mono mt-4 border border-[#1a3d1a] bg-[#0a0a0a] px-3 py-2 text-xs text-[#39FF14]">
                  <span className="text-[#888]">FROM:</span>{" "}
                  {githubUsername ? `@${githubUsername}` : "—"}
                </p>
              ) : (
                <label className="mt-4 block">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                    Email (optional)
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${terminalField} mt-2`}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={submitting}
                  />
                </label>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-6">
                <fieldset className="min-w-0 border-0 p-0">
                  <legend className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                    Type
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {typeOptions.map((opt) => {
                      const selected = type === opt.value
                      return (
                        <label
                          key={opt.value}
                          className={`cursor-pointer border-2 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors sm:text-[10px] ${
                            selected
                              ? "border-[#39FF14] bg-[#0a120a] text-[#39FF14] shadow-[inset_0_0_12px_rgba(57,255,20,0.12)]"
                              : "border-[#2a3d2a] bg-[#080808] text-[#666] hover:border-[#39FF14]/50 hover:text-[#9fdf9d]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="signal-type"
                            value={opt.value}
                            checked={selected}
                            onChange={() => setType(opt.value)}
                            className="sr-only"
                            disabled={submitting}
                          />
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <label className="mt-6 block">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-[#888]">
                    Message
                  </span>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                    maxLength={MAX_LEN}
                    rows={5}
                    disabled={submitting}
                    className={`${terminalField} mt-2 min-h-[7rem] resize-y`}
                    placeholder="Describe the issue or idea…"
                  />
                  <span className="mt-1 block text-right font-mono text-[10px] text-[#555]">
                    {message.length}/{MAX_LEN}
                  </span>
                </label>

                {error && (
                  <p
                    className="font-mono mt-3 border border-red-800 bg-[#140808] p-2 text-xs text-red-400"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={
                      submitting || !message.trim() || message.trim().length > MAX_LEN
                    }
                    className="glitch-btn font-display flex-1 min-w-[8rem] border-2 border-[#39FF14] bg-[#0a0a0a] px-4 py-3 text-[9px] uppercase tracking-wide text-[#39FF14] shadow-[inset_0_0_12px_rgba(57,255,20,0.06)] hover:bg-[#0a120a] disabled:cursor-not-allowed disabled:opacity-40 sm:text-[10px]"
                  >
                    {submitting ? "TRANSMITTING…" : "TRANSMIT"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={onClose}
                    className="font-display border-2 border-[#444] bg-[#0a0a0a] px-4 py-3 text-[9px] uppercase tracking-wide text-[#888] hover:border-[#666] hover:text-[#aaa] disabled:opacity-50 sm:text-[10px]"
                  >
                    ABORT
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
