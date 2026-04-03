import { useState } from "react"

function readPaymentMessage(): string | null {
  if (typeof window === "undefined") return null
  const q = new URLSearchParams(window.location.search)
  const payment = q.get("payment")
  if (payment !== "success" && payment !== "cancelled") return null

  const path = window.location.pathname + window.location.hash
  window.history.replaceState({}, "", path)

  if (payment === "success") {
    return "PAYMENT CONFIRMED. PROJECT DECLARED. 30 DAYS START NOW."
  }
  return "PAYMENT CANCELLED. NO MONEY TAKEN. COME BACK WHEN YOU'RE READY."
}

export function PaymentRedirectBanner() {
  const [message] = useState<string | null>(readPaymentMessage)

  if (!message) return null

  return (
    <div
      className="border-b-2 border-[#39FF14] bg-[#050505] px-4 py-4 md:px-8"
      role="status"
    >
      <p className="mx-auto max-w-[1100px] font-mono text-center text-xs leading-relaxed text-[#39FF14] md:text-sm">
        {message}
      </p>
    </div>
  )
}
