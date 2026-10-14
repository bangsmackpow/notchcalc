import { GROUP_LABEL, PRESETS, type SizeGroup } from '../lib/sizes.ts'

export function PresetPick({
  onPick,
  groups = ['tube', 'pipe', 'metric'],
}: {
  onPick: (odMm: number) => void
  groups?: SizeGroup[]
}) {
  return (
    <label className="block w-28 self-end">
      <span className="mb-1 block text-xs text-transparent">.</span>
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value
          if (v) onPick(parseFloat(v))
          e.target.value = ''
        }}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
      >
        <option value="">standard…</option>
        {groups.map((g) => (
          <optgroup key={g} label={GROUP_LABEL[g]}>
            {PRESETS.filter((p) => p.group === g).map((p) => (
              <option key={p.label} value={p.odMm}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
