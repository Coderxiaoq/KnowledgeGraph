import type { GraphLayoutMode } from '../../types/graph'

const layoutOptions: Array<{ label: string; value: GraphLayoutMode }> = [
  { label: 'fCoSE', value: 'fcose' },
  { label: 'COSE-Bilkent', value: 'cose-bilkent' },
  { label: 'Concentric', value: 'concentric' },
  { label: 'Breadthfirst', value: 'breadthfirst' },
]

type LayoutSelectorProps = {
  value: GraphLayoutMode
  onChange: (value: GraphLayoutMode) => void
}

export function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-500">
        Layout
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as GraphLayoutMode)}
        className="h-9 rounded-full border border-ink-900/10 bg-white/88 px-3 text-xs font-semibold text-ink-900 outline-none transition focus:border-mint-500"
      >
        {layoutOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
