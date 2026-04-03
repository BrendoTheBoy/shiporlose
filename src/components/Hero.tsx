import { PoolDisplay } from "./PoolDisplay"

export function Hero() {
  const scrollToDeclare = () => {
    document.getElementById("declare")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <header className="relative border-b-2 border-[#1f1f1f] px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div className="max-w-3xl">
          <p className="font-display mb-4 text-[9px] uppercase leading-relaxed text-[#FF6B00] sm:text-[10px] md:text-[11px]">
            ShipOrLose v0.2 · public beta · Supabase + GitHub
          </p>
          <h1 className="font-display text-[clamp(0.7rem,2.8vw,1.35rem)] leading-[1.45] text-[#39FF14] [text-shadow:0_0_20px_rgba(57,255,20,0.3)] md:text-[clamp(0.62rem,1.85vw,1.08rem)] md:leading-[1.22]">
            <span className="md:block">STAKE MONEY. SHIP YOUR PROJECT.</span>
            <span className="md:block">
              OR LOSE IT ALL.
              <span className="hero-cursor" aria-hidden="true" />
            </span>
          </h1>
          <p className="font-body mt-6 max-w-xl text-sm text-[#b8b8b8] md:text-base">
            Put $20-50 on the line. Build in public for 30 days. Ship and split
            the pool with winners. Abandon and forfeit your stake.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={scrollToDeclare}
              className="cta-pulse glitch-btn font-display border-2 border-[#39FF14] bg-[#0a0a0a] px-5 py-3 text-[9px] uppercase tracking-wide text-[#39FF14] sm:text-[10px]"
            >
              DECLARE YOUR PROJECT →
            </button>
          </div>
        </div>
        <div className="w-full max-w-sm shrink-0 self-stretch lg:mt-2">
          <PoolDisplay />
        </div>
      </div>
    </header>
  )
}
