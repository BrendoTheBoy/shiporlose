/**
 * Scroll so the declare heading sits just below the fixed header (not the top of
 * #declare, which includes large vertical padding). That keeps the heading near the
 * top of the viewport and leaves room for the full form including the pay button on
 * typical desktop viewports.
 */
export function scrollToDeclareSection() {
  const section = document.getElementById("declare")
  const heading = document.getElementById("declare-heading")
  if (!section) return

  const header = document.querySelector("[data-site-header]")
  const headerH = header?.getBoundingClientRect().height ?? 56
  const padTop = 16

  const headingRect = heading?.getBoundingClientRect() ?? section.getBoundingClientRect()
  const headingTop = window.scrollY + headingRect.top
  const targetScroll = headingTop - headerH - padTop

  window.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: "smooth",
  })
}
