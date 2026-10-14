import type { Unit } from '../geometry/types.ts'

export const MM_PER_INCH = 25.4

export function toMm(value: number, unit: Unit): number {
  return unit === 'in' ? value * MM_PER_INCH : value
}

export function fromMm(mm: number, unit: Unit): number {
  return unit === 'in' ? mm / MM_PER_INCH : mm
}

/** Plain decimal string in the requested unit. */
export function fmtLength(mm: number, unit: Unit, digits = 3): string {
  const v = fromMm(mm, unit)
  return unit === 'in' ? `${v.toFixed(digits)}"` : `${v.toFixed(digits)} mm`
}

/** Nearest 1/den fraction of an inch, reduced, e.g. 1.25 -> "1 1/4"". */
export function inchFraction(inches: number, den = 16): string {
  const sign = inches < 0 ? '-' : ''
  const abs = Math.abs(inches)
  const whole = Math.floor(abs)
  let num = Math.round((abs - whole) * den)
  let dd = den
  if (num === dd) {
    return `${sign}${whole + 1}"`
  }
  while (num > 0 && num % 2 === 0 && dd % 2 === 0) {
    num /= 2
    dd /= 2
  }
  if (num === 0) return `${sign}${whole}"`
  if (whole === 0) return `${sign}${num}/${dd}"`
  return `${sign}${whole} ${num}/${dd}"`
}

/** Human label in the user's unit — fractional for inches, decimal for mm. */
export function fmtDimsLabel(mm: number, unit: Unit): string {
  if (unit === 'in') return inchFraction(fromMm(mm, unit))
  return `${mm.toFixed(1)} mm`
}

const UNIT_LABEL: Record<Unit, string> = { in: 'in', mm: 'mm' }
export function unitLabel(unit: Unit): string {
  return UNIT_LABEL[unit]
}
