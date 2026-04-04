/** Tight terminal-style box (~800px max), centered; sits flush above section content. */
const INNER = 44

export function AsciiDivider({ label }: { label?: string }) {
  const line = `+${"-".repeat(INNER)}+`
  const innerW = INNER - 2
  const text = label
    ? label.length <= innerW
      ? label.padEnd(innerW, " ")
      : `${label.slice(0, innerW - 1)}…`
    : " ".repeat(innerW)
  const mid = `| ${text} |`

  return (
    <div className="mx-auto mb-3 mt-0 w-full max-w-[800px] px-4">
      <pre
        className="font-mono mx-auto w-max max-w-full text-[9px] leading-tight text-[#555] sm:text-[10px]"
        aria-hidden="true"
      >
        {line}
        {"\n"}
        {mid}
        {"\n"}
        {line}
      </pre>
    </div>
  )
}
