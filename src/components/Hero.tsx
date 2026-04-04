import { scrollToDeclareSection } from "../lib/scrollToDeclare"
import { HeroShipLogo } from "./HeroShipLogo"
import { PoolDisplay } from "./PoolDisplay"

export function Hero() {
  const scrollToDeclare = () => {
    scrollToDeclareSection()
  }

  return (
    <header className="relative border-b-2 border-[#1f1f1f] px-4 pb-10 pt-4 md:px-8 md:pb-12 md:pt-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-x-10 lg:gap-y-8 xl:gap-x-12">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start md:mb-4 md:gap-2">
            <HeroShipLogo />
            <p className="font-display text-[clamp(0.55rem,1.15vw,0.85rem)] leading-relaxed text-[#FF6B00]">
              SHIP OR LOSE
            </p>
          </div>
          <h1 className="font-display text-[clamp(1.35rem,calc(0.5rem+4.5vw),3rem)] leading-[1.2] text-[#39FF14] [text-shadow:0_0_24px_rgba(57,255,20,0.35)]">
            <span className="md:block">STAKE MONEY. SHIP YOUR PROJECT.</span>
            <span className="md:block">
              OR LOSE IT ALL.
              <span className="hero-cursor" aria-hidden="true" />
            </span>
          </h1>
          <p className="font-body mt-4 text-[1rem] leading-snug text-[#888] md:mt-5 md:text-[1.125rem] lg:text-[1.2rem]">
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
        <div className="w-full max-w-sm shrink-0 lg:w-auto lg:max-w-[min(100%,22rem)]">
          <PoolDisplay />
        </div>
      </div>
    </header>
  )
}
