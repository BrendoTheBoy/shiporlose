const INNER = 78

export function AsciiDivider({ label }: { label?: string }) {
  const line = `+${"-".repeat(INNER)}+`
  const mid = label
    ? `| ${label.padEnd(INNER - 2, " ").slice(0, INNER - 2)} |`
    : `| ${" ".repeat(INNER - 2)} |`

  return (
    <div className="my-4">
      <pre
        className="font-body mx-auto max-w-[min(100%,56rem)] overflow-x-auto px-4 text-[9px] leading-tight opacity-30 sm:text-[10px] md:text-[11px]"
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
