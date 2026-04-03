import { Route, Routes } from "react-router-dom"
import { AuthBar } from "./components/AuthBar"
import { PaymentRedirectBanner } from "./components/PaymentRedirectBanner"
import { LandingPage } from "./pages/LandingPage"
import { ProjectPage } from "./pages/ProjectPage"

function App() {
  return (
    <div className="crt-wrap min-h-dvh">
      <PaymentRedirectBanner />
      <div className="fixed right-3 top-3 z-[10000] max-w-[min(100vw-1.5rem,420px)] md:right-6 md:top-6">
        <AuthBar />
      </div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/project/:id" element={<ProjectPage />} />
      </Routes>
    </div>
  )
}

export default App
