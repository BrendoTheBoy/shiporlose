import { Link } from "react-router-dom"
import { AuthBar } from "./AuthBar"

export function SiteHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-[10000] flex min-h-[52px] items-center justify-between gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a]/92 px-3 py-2.5 backdrop-blur-sm md:px-6">
      <nav
        className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[8px] uppercase tracking-wide sm:text-[9px]"
        aria-label="Site"
      >
        <Link
          to="/fame"
          className="text-[#39FF14] underline decoration-[#39FF14]/40 underline-offset-4 transition-colors hover:text-[#5cff4a] hover:decoration-[#39FF14]"
        >
          WALL OF FAME
        </Link>
        <Link
          to="/shame"
          className="text-red-500 underline decoration-red-500/40 underline-offset-4 transition-colors hover:text-red-400 hover:decoration-red-400"
        >
          WALL OF SHAME
        </Link>
      </nav>
      <div className="max-w-[min(100vw-8rem,420px)] shrink-0">
        <AuthBar />
      </div>
    </header>
  )
}
