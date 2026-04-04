import { Link } from "react-router-dom"
import { AuthBar } from "./AuthBar"

const navBoxGreen =
  "shrink-0 border-2 border-[#39FF14] bg-[#050805] px-2 py-1 font-mono text-[7px] font-bold uppercase tracking-wide text-[#39FF14] shadow-[inset_0_0_8px_rgba(57,255,20,0.06)] transition-colors hover:bg-[#0a120a] sm:text-[8px]"

const navBoxRed =
  "shrink-0 border-2 border-red-600 bg-[#0a0808] px-2 py-1 font-mono text-[7px] font-bold uppercase tracking-wide text-red-400 shadow-[inset_0_0_8px_rgba(127,29,29,0.15)] transition-colors hover:bg-[#140808] sm:text-[8px]"

export function SiteHeader() {
  return (
    <header
      data-site-header
      className="fixed left-0 right-0 top-0 z-[10000] flex min-h-[52px] items-center justify-between gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a]/92 px-3 py-2.5 backdrop-blur-sm md:px-6"
    >
      <nav
        className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5"
        aria-label="Site"
      >
        <Link to="/" className={navBoxGreen}>
          FEED
        </Link>
        <Link to="/fame" className={navBoxGreen}>
          WALL OF FAME
        </Link>
        <Link to="/shame" className={navBoxRed}>
          WALL OF SHAME
        </Link>
      </nav>
      <div className="max-w-[min(100vw-8rem,420px)] shrink-0">
        <AuthBar />
      </div>
    </header>
  )
}
