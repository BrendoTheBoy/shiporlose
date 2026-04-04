import { useEffect, useRef, useState } from "react"

const SAILING_SRC = [
  "/ship-sailing.png",
  "/ship-frame2.png",
  "/ship-frame3.png",
] as const

/** 1 → 2 → 3 → 2 → 1 → 2 → 3 → 2 (indices into SAILING_SRC) */
const SAILING_SEQUENCE = [0, 1, 2, 1, 0, 1, 2, 1] as const

const SINKING_SRC = "/ship-sinking.png"
const SPRITE_MS = 500
const INTERRUPT_DELAY_MS = 10_000
const FADE_MS = 300
const SINKING_HOLD_MS = 2000

export function HeroShipLogo() {
  const [seqStep, setSeqStep] = useState(0)
  const [sinkingShown, setSinkingShown] = useState(false)
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
      setSinkingShown(true)
      const t2 = window.setTimeout(() => {
        const t3 = window.setTimeout(() => {
          setSinkingShown(false)
          setSeqStep(0)
          const t4 = window.setTimeout(() => {
            interruptActiveRef.current = false
            scheduleInterruptCycle()
          }, FADE_MS)
          timersRef.current.push(t4)
        }, SINKING_HOLD_MS)
        timersRef.current.push(t3)
      }, FADE_MS)
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

  const sailingIndex = SAILING_SEQUENCE[seqStep % SAILING_SEQUENCE.length]

  return (
    <div
      className="relative h-16 w-[4.5rem] shrink-0 md:h-20 md:w-[5.5rem]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 transition-opacity duration-300 ease-in-out"
        style={{ opacity: sinkingShown ? 0 : 1 }}
      >
        {SAILING_SRC.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={88}
            height={80}
            className={`ship-pixel-art absolute inset-0 m-auto h-full max-h-full w-full max-w-full object-contain object-center ${
              sailingIndex === i ? "opacity-100" : "opacity-0"
            }`}
            style={{ transition: "none" }}
            decoding="async"
          />
        ))}
      </div>
      <img
        src={SINKING_SRC}
        alt=""
        width={88}
        height={80}
        className="ship-pixel-art absolute inset-0 m-auto h-full max-h-full w-full max-w-full object-contain object-center transition-opacity duration-300 ease-in-out"
        style={{ opacity: sinkingShown ? 1 : 0 }}
        decoding="async"
      />
    </div>
  )
}
