import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Unit } from '../geometry/types.ts'
import { fromMm, toMm } from '../lib/units.ts'

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  )
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = 'solid',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'solid' | 'ghost' | 'danger'
}) {
  const cls =
    variant === 'solid'
      ? 'bg-slate-900 text-white hover:bg-slate-700'
      : variant === 'danger'
        ? 'bg-red-50 text-red-700 hover:bg-red-100'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  )
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function NumField({
  label,
  value,
  onChange,
  unit,
  step = 0.001,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  unit: Unit
  step?: number
}) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <div className="flex items-center rounded-md border border-slate-200">
        <input
          type="number"
          step={step}
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md px-2 py-1 text-sm outline-none"
        />
        <span className="px-2 text-xs text-slate-400">{unit === 'in' ? 'in' : 'mm'}</span>
      </div>
    </label>
  )
}

export function RangeRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full"
        />
        <span className="w-16 text-right text-sm tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
    </label>
  )
}

function trim(v: number): string {
  return v.toFixed(3).replace(/\.?0+$/, '')
}

/**
 * A number input that keeps local text while focused and commits on blur/Enter,
 * resyncing from the parent value (and unit) otherwise.
 */
export function LocalNum({
  label,
  mm,
  unit,
  onChangeMm,
  step = 0.01,
  min = 0,
}: {
  label: string
  mm: number
  unit: Unit
  onChangeMm: (mm: number) => void
  step?: number
  min?: number
}) {
  const [text, setText] = useState(() => trim(fromMm(mm, unit)))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(trim(fromMm(mm, unit)))
  }, [mm, unit])

  const commit = () => {
    const v = parseFloat(text)
    if (Number.isFinite(v)) onChangeMm(toMm(Math.max(min, v), unit))
    else setText(trim(fromMm(mm, unit)))
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <div className="flex items-center rounded-md border border-slate-200">
        <input
          type="number"
          step={step}
          value={text}
          onFocus={() => {
            focused.current = true
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            focused.current = false
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className="w-full rounded-md px-2 py-1 text-sm outline-none"
        />
        <span className="px-2 text-xs text-slate-400">{unit === 'in' ? 'in' : 'mm'}</span>
      </div>
    </label>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  )
}
