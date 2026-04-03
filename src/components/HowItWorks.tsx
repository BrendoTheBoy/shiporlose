import { AsciiDivider } from "./AsciiDivider"

const steps = [
  {
    key: "01",
    title: "DECLARE",
    body: "Write one sentence about what you're building and what \"shipped\" means.",
  },
  {
    key: "02",
    title: "STAKE",
    body: "Put $20-50 on the line. Money goes into the monthly pool.",
  },
  {
    key: "03",
    title: "BUILD",
    body: "Check in daily with one sentence. Your streak is public.",
  },
  {
    key: "04",
    title: "SHIP OR LOSE",
    body: "Ship by day 30 and split the pool. Abandon and lose your stake.",
  },
] as const

export function HowItWorks() {
  return (
    <section className="border-b-2 border-[#1f1f1f] px-4 py-16 md:px-8 md:py-20">
      <AsciiDivider label="HOW IT WORKS — READ CAREFULLY" />
      <div className="mx-auto mt-10 max-w-5xl">
        <h2 className="font-display mb-10 text-center text-[11px] text-[#39FF14] sm:text-xs md:text-sm">
          HOW IT WORKS
        </h2>
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
