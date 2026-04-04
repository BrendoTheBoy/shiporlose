import { scrollToDeclareSection } from "../lib/scrollToDeclare"
import { PoolDisplay } from "./PoolDisplay"

export function Hero() {
  const scrollToDeclare = () => {
    scrollToDeclareSection()
  }

  return (
    <header className="relative border-b-2 border-[#1f1f1f] px-4 pb-10 pt-4 md:px-8 md:pb-12 md:pt-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div
              className="pixel-ship mx-auto shrink-0 scale-[1.14] sm:mx-0 sm:mt-1 origin-top"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="font-display text-[clamp(0.65rem,2.5vw,1.2rem)] leading-[1.4] text-[#39FF14] [text-shadow:0_0_20px_rgba(57,255,20,0.3)] md:text-[clamp(0.58rem,1.75vw,1.05rem)] md:leading-[1.25]">
                <span className="md:block">STAKE MONEY. SHIP YOUR PROJECT.</span>
                <span className="md:block">
                  OR LOSE IT ALL.
                  <span className="hero-cursor" aria-hidden="true" />
                </span>
              </h1>
              <p className="font-body mt-3 text-xs text-[#666] md:text-sm">
                $30. 30 days. Ship or lose your stake.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-4 sm:justify-start">
                <button
                  type="button"
                  onClick={scrollToDeclare}
                  className="cta-pulse glitch-btn font-display border-2 border-[#39FF14] bg-[#0a0a0a] px-5 py-3 text-[9px] uppercase tracking-wide text-[#39FF14] sm:text-[10px]"
                >
                  DECLARE YOUR PROJECT →
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full max-w-sm shrink-0 lg:w-auto lg:max-w-[min(100%,20rem)]">
          <PoolDisplay />
        </div>
      </div>
    </header>
  )
}
