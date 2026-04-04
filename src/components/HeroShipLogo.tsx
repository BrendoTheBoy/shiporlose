import { useEffect, useRef, useState } from "react"

/** All frames: 1–3 sailing, 4 tilting, 5 sinking */
const FRAMES = [
  "/ship-sailing.png",
  "/ship-frame2.png",
  "/ship-frame3.png",
  "/ship-frame4.png",
  "/ship-sinking.png",
] as const

/** Sailing loop: 1 → 2 → 3 → 2 → … (indices into first three frames) */
const SAILING_SEQUENCE = [0, 1, 2, 1] as const

const SPRITE_MS = 500
const INTERRUPT_DELAY_MS = 10_000
const FRAME4_MS = 1000
const FRAME5_MS = 1500

type Phase = "sailing" | "frame4" | "frame5"

export function HeroShipLogo() {
  const [seqStep, setSeqStep] = useState(0)
  const [phase, setPhase] = useState<Phase>("sailing")
  const interruptActiveRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const clearInterruptTimers = () => {
    for (const id of timersRef.current) {
      window.clearTimeout(id)
    }
    timersRef.current = []
  }

  const scheduleInterruptCycle = () => {
    clearInterruptTimers()
    const t1 = window.setTimeout(() => {
      interruptActiveRef.current = true
      setPhase("frame4")
      const t2 = window.setTimeout(() => {
        setPhase("frame5")
        const t3 = window.setTimeout(() => {
          setPhase("sailing")
          setSeqStep(0)
          interruptActiveRef.current = false
          scheduleInterruptCycle()
        }, FRAME5_MS)
        timersRef.current.push(t3)
      }, FRAME4_MS)
      timersRef.current.push(t2)
    }, INTERRUPT_DELAY_MS)
    timersRef.current.push(t1)
  }

  useEffect(() => {
    scheduleInterruptCycle()
    return () => {
      clearInterruptTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only interrupt scheduler
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeqStep((s) => {
        if (interruptActiveRef.current) return s
        return (s + 1) % SAILING_SEQUENCE.length
      })
    }, SPRITE_MS)
    return () => window.clearInterval(id)
  }, [])

  const displayIndex =
    phase === "frame4"
      ? 3
      : phase === "frame5"
        ? 4
        : SAILING_SEQUENCE[seqStep % SAILING_SEQUENCE.length]

  return (
    <div
      className="relative h-16 w-[4.5rem] shrink-0 md:h-20 md:w-[5.5rem]"
      aria-hidden="true"
    >
      {FRAMES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          width={88}
          height={80}
          className={`ship-pixel-art absolute inset-0 m-auto h-full max-h-full w-full max-w-full object-contain object-center ${
            displayIndex === i ? "opacity-100" : "opacity-0"
          }`}
          style={{ transition: "none" }}
          decoding="async"
        />
      ))}
    </div>
  )
}
