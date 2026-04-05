import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AuthBar } from "./AuthBar"
import { SignalModal } from "./SignalModal"

const navBoxGreen =
  "shrink-0 border-2 border-[#39FF14] bg-[#050805] px-2 py-1 font-mono text-[7px] font-bold uppercase tracking-wide text-[#39FF14] shadow-[inset_0_0_8px_rgba(57,255,20,0.06)] transition-colors hover:bg-[#0a120a] sm:text-[8px]"

const wallsDropdownLinkBase =
  "block w-full px-3 py-2 text-left font-mono text-[8px] font-bold uppercase tracking-wide transition-colors sm:text-[9px]"

export function SiteHeader() {
  const [wallsOpen, setWallsOpen] = useState(false)
  const [signalOpen, setSignalOpen] = useState(false)
  const wallsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wallsOpen) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const node = wallsRef.current
      const target = e.target
      if (!node || !(target instanceof Node) || node.contains(target)) return
      setWallsOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
    }
  }, [wallsOpen])

  return (
    <header
      data-site-header
      className="fixed left-0 right-0 top-0 z-[10000] flex min-h-[52px] items-center justify-between gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a]/92 px-3 py-2.5 backdrop-blur-sm md:px-6"
    >
      <nav
        className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5"
        aria-label="Site"
      >
        <div ref={wallsRef} className="relative shrink-0">
          <button
            type="button"
            className={navBoxGreen}
            aria-expanded={wallsOpen}
            aria-haspopup="menu"
            aria-controls="walls-menu"
            id="walls-trigger"
            onClick={() => setWallsOpen((o) => !o)}
          >
            THE WALLS
          </button>
          {wallsOpen ? (
            <div
              id="walls-menu"
              role="menu"
              aria-labelledby="walls-trigger"
              className="absolute left-0 top-[calc(100%+0.25rem)] z-[10001] min-w-[11rem] border border-[#39FF14] bg-[#0a0a0a] py-1 shadow-[inset_0_0_12px_rgba(57,255,20,0.06),0_4px_16px_rgba(0,0,0,0.45)]"
            >
              <Link
                role="menuitem"
                to="/fame"
                className={`${wallsDropdownLinkBase} text-[#39FF14] hover:bg-[#0a120a]`}
                onClick={() => setWallsOpen(false)}
              >
                WALL OF FAME
              </Link>
              <Link
                role="menuitem"
                to="/shame"
                className={`${wallsDropdownLinkBase} text-red-400 hover:bg-[#140808]`}
                onClick={() => setWallsOpen(false)}
              >
                WALL OF SHAME
              </Link>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={navBoxGreen}
          onClick={() => setSignalOpen(true)}
        >
          SIGNAL
        </button>
      </nav>
      <SignalModal open={signalOpen} onClose={() => setSignalOpen(false)} />
      <div className="max-w-[min(100vw-8rem,420px)] shrink-0">
        <AuthBar />
      </div>
    </header>
  )
}
