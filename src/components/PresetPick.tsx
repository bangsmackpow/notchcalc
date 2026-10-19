import { GROUP_LABEL, PRESETS, RECT_GROUPS, ROUND_GROUPS, type SizeGroup } from '../lib/sizes.ts'
import type { Section } from '../geometry/index.ts'

export function PresetPick({
  onPick,
  groups = [...ROUND_GROUPS, ...RECT_GROUPS],
}: {
  onPick: (s: Section) => void
  groups?: SizeGroup[]
}) {
  const shown = PRESETS.map((p, i) => ({ p, i })).filter(({ p }) => groups.includes(p.group))
  const orderedGroups = groups.filter((g) => shown.some(({ p }) => p.group === g))
  return (
    <label className="block w-28 self-end">
      <span className="mb-1 block text-xs text-transparent">.</span>
      <select
        value=""
        onChange={(e) => {
          const i = parseInt(e.target.value, 10)
          if (Number.isFinite(i)) onPick(PRESETS[i].section)
          e.target.value = ''
        }}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
      >
        <option value="">standard…</option>
        {orderedGroups.map((g) => (
          <optgroup key={g} label={GROUP_LABEL[g]}>
            {shown
              .filter(({ p }) => p.group === g)
              .map(({ p, i }) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
