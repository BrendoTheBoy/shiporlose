import { AsciiDivider } from "./AsciiDivider"

const steps = [
  {
    key: "01",
    title: "DECLARE",
    body: `Sign in with GitHub, pick your repo, and define what "shipped" means. This becomes your public contract — no moving the goalposts.`,
  },
  {
    key: "02",
    title: "STAKE",
    body: "Pay $30 to lock in. $20 commitment stake + $10 pool entry fee. The pool grows with every builder who joins.",
  },
  {
    key: "03",
    title: "BUILD",
    body: "You have 30 days. Push commits, log non-code progress. Your activity is tracked and public. Everyone can see if you're actually working.",
  },
  {
    key: "04",
    title: "SHIP OR LOSE",
    body: "Submit proof you shipped. The community has 48 hours to verify. Ship and get your $20 back + a share of the pool. Abandon and your stake is forfeited. Wall of Fame or Wall of Shame — your call.",
  },
] as const

export function HowItWorks() {
  return (
    <section className="border-b-2 border-[#1f1f1f] px-4 py-16 md:px-8 md:py-20">
      <h2 className="sr-only">How it works</h2>
      <AsciiDivider label="HOW IT WORKS" />
      <div className="mx-auto mt-10 max-w-5xl">
        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((s) => (
            <article
              key={s.key}
              className="card-lift border-2 border-[#2a2a2a] bg-[#0d0d0d] p-5 shadow-[4px_4px_0_#111]"
            >
              <div className="mb-3 flex items-center gap-3 border-b border-[#2a2a2a] pb-2">
                <span className="font-mono text-xs text-[#FF6B00]">{s.key}</span>
                <span className="font-display text-[10px] text-[#39FF14] sm:text-[11px]">
                  {`> ${s.title}`}
                </span>
              </div>
              <p className="font-body text-sm text-[#c4c4c4]">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
