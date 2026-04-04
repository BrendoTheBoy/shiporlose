import { Route, Routes, useParams } from "react-router-dom"
import { PaymentRedirectBanner } from "./components/PaymentRedirectBanner"
import { SiteHeader } from "./components/SiteHeader"
import { LandingPage } from "./pages/LandingPage"
import { ProjectPage } from "./pages/ProjectPage"
import { WallOfFamePage } from "./pages/WallOfFamePage"
import { WallOfShamePage } from "./pages/WallOfShamePage"

/** Remount when `:id` changes so project state never shows the wrong id. */
function ProjectPageRoute() {
  const { id } = useParams()
  return <ProjectPage key={id} />
}

function App() {
  return (
    <div className="crt-wrap min-h-dvh">
      <PaymentRedirectBanner />
      <SiteHeader />
      <main className="pt-16 sm:pt-[4.5rem] md:pt-20">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/fame" element={<WallOfFamePage />} />
          <Route path="/shame" element={<WallOfShamePage />} />
          <Route path="/project/:id" element={<ProjectPageRoute />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
