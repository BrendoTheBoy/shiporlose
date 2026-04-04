import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { DeclareForm } from "../components/DeclareForm"
import { scrollToDeclareSection } from "../lib/scrollToDeclare"
import { Footer } from "../components/Footer"
import { Hero } from "../components/Hero"
import { HowItWorks } from "../components/HowItWorks"
import { LiveProjects } from "../components/LiveProjects"
import { PixelDecor } from "../components/PixelDecor"

export function LandingPage() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash !== "#declare") return
    const t = window.setTimeout(() => {
      scrollToDeclareSection()
    }, 0)
    return () => window.clearTimeout(t)
  }, [location.hash, location.pathname])

  return (
    <>
      <a
        href="#declare"
        className="skip-link border-2 border-[#39FF14] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#39FF14]"
      >
        Skip to declaration
      </a>
      <div className="relative mx-auto max-w-[1100px]">
        <PixelDecor />
        <Hero />
        <HowItWorks />
        <LiveProjects />
        <DeclareForm />
        <Footer />
      </div>
    </>
  )
}
