import { describe, expect, it } from 'vitest'
import { cornerRadiusOf, makeSection, sectionPerimeter, type Section } from './section.ts'

const TAU = Math.PI * 2
const r = (s: Section) => makeSection(s)

describe('round section', () => {
  const g = r({ shape: 'round', od: 10 })

  it('has circumference perimeter', () => {
    expect(g.perimeter).toBeCloseTo(TAU * 5, 9)
  })

  it('datum is at (r, 0) and wraps', () => {
    expect(g.pointAt(0).x).toBeCloseTo(5, 9)
    expect(g.pointAt(0).y).toBeCloseTo(0, 9)
    expect(g.pointAt(g.perimeter).x).toBeCloseTo(5, 9)
  })

  it('a line through the centre crosses at ±r', () => {
    const ts = g.lineIntersections({ x: 0, y: 0 }, { x: 1, y: 0 })
    expect(ts).toHaveLength(2)
    expect(ts[0]).toBeCloseTo(-5, 9)
    expect(ts[1]).toBeCloseTo(5, 9)
  })

  it('a line outside the circle misses', () => {
    expect(g.lineIntersections({ x: 0, y: 6 }, { x: 1, y: 0 })).toHaveLength(0)
  })

  it('sample returns evenly spaced arcs from 0 to perimeter', () => {
    const s = g.sample(8)
    expect(s).toHaveLength(9)
    expect(s[0].arc).toBeCloseTo(0, 9)
    expect(s[s.length - 1].arc).toBeCloseTo(g.perimeter, 9)
  })
})

describe('rect section — sharp square', () => {
  const g = r({ shape: 'rect', width: 10, height: 10, cornerRadius: 0 })

  it('perimeter is 4 × side', () => {
    expect(g.perimeter).toBeCloseTo(40, 9)
  })

  it('datum is the middle of a flat', () => {
    expect(g.pointAt(0).x).toBeCloseTo(0, 9)
    expect(g.pointAt(0).y).toBeCloseTo(-5, 9)
  })

  it('reaches a corner then the opposite flat', () => {
    // datum is mid-bottom-flat, so the first corner (5,-5) sits at arc = half-side
    const corner = g.pointAt(5)
    expect(corner.x).toBeCloseTo(5, 9)
    expect(corner.y).toBeCloseTo(-5, 9)
    // quarter perimeter is the middle of the right flat
    const mid = g.pointAt(g.perimeter / 4)
    expect(mid.x).toBeCloseTo(5, 9)
    expect(mid.y).toBeCloseTo(0, 9)
  })

  it('a horizontal line through the centre crosses at ±half-side', () => {
    const ts = g.lineIntersections({ x: 0, y: 0 }, { x: 1, y: 0 })
    expect(ts[0]).toBeCloseTo(-5, 9)
    expect(ts[1]).toBeCloseTo(5, 9)
  })

  it('a line above the square misses', () => {
    expect(g.lineIntersections({ x: 0, y: 6 }, { x: 1, y: 0 })).toHaveLength(0)
  })
})

describe('rect section — rounded rectangle', () => {
  const sec = { shape: 'rect', width: 10, height: 20, cornerRadius: 2 } as const
  const g = r(sec)
  const rho = 2

  it('perimeter matches the closed form', () => {
    expect(g.perimeter).toBeCloseTo(2 * (10 - 2 * rho) + 2 * (20 - 2 * rho) + TAU * rho, 9)
  })

  it('clamps the corner radius to half the short side', () => {
    expect(cornerRadiusOf({ width: 10, height: 20, cornerRadius: 999 })).toBeCloseTo(5 - 1e-6, 6)
  })

  it('a line in the corner band crosses the outer arc', () => {
    // y = 9 is above the flat band (|y| > ch = 8); it exits through the outer
    // edges of the top corner arcs: x = ±(3 + √(2² − 1²))
    const ts = g.lineIntersections({ x: 0, y: 9 }, { x: 1, y: 0 })
    expect(ts[0]).toBeCloseTo(-(3 + Math.sqrt(3)), 9)
    expect(ts[1]).toBeCloseTo(3 + Math.sqrt(3), 9)
  })

  it('a line in the flat band crosses the flat', () => {
    const ts = g.lineIntersections({ x: 0, y: 0 }, { x: 1, y: 0 })
    expect(ts[0]).toBeCloseTo(-5, 9)
    expect(ts[1]).toBeCloseTo(5, 9)
  })

  it('samples include corner breakpoints in ascending arc order', () => {
    const s = g.sample(64)
    for (let i = 1; i < s.length; i++) expect(s[i].arc).toBeGreaterThan(s[i - 1].arc)
    // tangent points of the bottom-right corner: (3, -10) at y = -8 boundary
    expect(s.some((p) => Math.abs(p.x - 3) < 1e-6 && Math.abs(p.y + 10) < 1e-6)).toBe(true)
  })
})

describe('circle limit', () => {
  it('a fully rounded square approaches the round perimeter', () => {
    const g = r({ shape: 'rect', width: 10, height: 10, cornerRadius: 5 })
    expect(sectionPerimeter({ shape: 'round', od: 10 })).toBeCloseTo(TAU * 5, 9)
    expect(g.perimeter).toBeCloseTo(TAU * 5, 3)
  })
})
