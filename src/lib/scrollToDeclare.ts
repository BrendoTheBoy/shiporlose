/** Scroll so #declare sits just below the fixed site header (avoids clipping the CTA at the bottom). */
export function scrollToDeclareSection() {
  const el = document.getElementById("declare")
  if (!el) return

  const header = document.querySelector("[data-site-header]")
  const headerH = header?.getBoundingClientRect().height ?? 56
  const pad = 16

  const rect = el.getBoundingClientRect()
  const elTop = window.scrollY + rect.top
  const targetScroll = elTop - headerH - pad

  window.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: "smooth",
  })
}
