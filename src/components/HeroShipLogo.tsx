import { useEffect, useState } from "react"

const INTERVAL_MS = 3000

/** Alternates sailing / sinking art every 3s with a short crossfade. */
export function HeroShipLogo() {
  const [sailing, setSailing] = useState(true)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSailing((s) => !s)
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="relative h-16 w-[4.5rem] shrink-0 md:h-20 md:w-[5.5rem]"
      aria-hidden="true"
    >
      <img
        src="/ship-sailing.png"
        alt=""
        width={88}
        height={80}
        className={`absolute inset-0 m-auto h-full max-h-full w-full max-w-full object-contain object-center transition-opacity duration-300 ease-in-out ${
          sailing ? "opacity-100" : "opacity-0"
        }`}
        decoding="async"
      />
      <img
        src="/ship-sinking.png"
        alt=""
        width={88}
        height={80}
        className={`absolute inset-0 m-auto h-full max-h-full w-full max-w-full object-contain object-center transition-opacity duration-300 ease-in-out ${
          sailing ? "opacity-0" : "opacity-100"
        }`}
        decoding="async"
      />
    </div>
  )
}
