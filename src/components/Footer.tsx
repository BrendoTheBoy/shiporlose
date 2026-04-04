import { Link } from "react-router-dom"

export function Footer() {
  return (
    <footer className="px-4 py-12 text-center md:px-8">
      <p className="font-mono mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[9px] uppercase tracking-wide">
        <Link
          to="/fame"
          className="text-[#39FF14] underline decoration-[#39FF14]/35 underline-offset-4 hover:text-[#5cff4a]"
        >
          WALL OF FAME
        </Link>
        <span className="text-[#333]" aria-hidden="true">
          |
        </span>
        <Link
          to="/shame"
          className="text-red-500 underline decoration-red-500/35 underline-offset-4 hover:text-red-400"
        >
          WALL OF SHAME
        </Link>
      </p>
      <p className="font-body mx-auto mb-4 max-w-xl text-xs leading-relaxed text-[#FF6B00]">
        ShipOrLose is the first project shipped using ShipOrLose.
      </p>
      <p className="font-body mx-auto max-w-xl text-xs leading-relaxed text-[#666]">
        Built in one weekend by Brendan McGrath. Yes, I used ShipOrLose to ship
        ShipOrLose.
      </p>
      <p className="mt-4">
        <a
          href="#declare"
          className="font-body text-xs text-[#555] underline decoration-[#333] underline-offset-4 transition-colors hover:text-[#888] hover:decoration-[#555]"
        >
          Join the next cohort →
        </a>
      </p>
    </footer>
  )
}
