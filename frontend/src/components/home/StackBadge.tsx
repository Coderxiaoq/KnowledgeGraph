type StackBadgeProps = {
  label: string
}

export function StackBadge({ label }: StackBadgeProps) {
  return (
    <span className="rounded-full border border-ink-900/10 bg-white/70 px-4 py-2 text-sm font-semibold text-ink-700 shadow-[0_10px_30px_rgba(19,26,34,0.05)] backdrop-blur">
      {label}
    </span>
  )
}
