import { AuthBar } from "./components/AuthBar"
import { DeclareForm } from "./components/DeclareForm"
import { Footer } from "./components/Footer"
import { Hero } from "./components/Hero"
import { HowItWorks } from "./components/HowItWorks"
import { LiveProjects } from "./components/LiveProjects"
import { PixelDecor } from "./components/PixelDecor"

function App() {
  return (
    <div className="crt-wrap min-h-dvh">
      <div className="fixed right-3 top-3 z-[10000] max-w-[min(100vw-1.5rem,420px)] md:right-6 md:top-6">
        <AuthBar />
      </div>
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
    </div>
  )
}

export default App
