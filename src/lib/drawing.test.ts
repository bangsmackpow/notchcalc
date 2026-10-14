import { describe, expect, it } from 'vitest'
import { branchNotch, headerHole } from '../geometry/index.ts'
import { buildTemplateDrawing } from './drawing.ts'

describe('buildTemplateDrawing — band stacking', () => {
  const near = branchNotch({ branchOD: 50, headerOD: 70, angleDeg: 90 })
  const thru = branchNotch({ branchOD: 50, headerOD: 70, angleDeg: 90, passThrough: true })

  it('single notch has one cut path', () => {
    const d = buildTemplateDrawing(near, { unit: 'mm' })
    expect(d.cutPaths).toHaveLength(1)
  })

  it('pass-through renders BOTH near and far walls as cut paths', () => {
    const d = buildTemplateDrawing(thru, { unit: 'mm' })
    expect(d.cutPaths).toHaveLength(2)
    // two separate bands → taller sheet than the single-notch case
    expect(d.height).toBeGreaterThan(buildTemplateDrawing(near, { unit: 'mm' }).height)
  })

  it('header hole draws both oval edges', () => {
    const d = buildTemplateDrawing(headerHole({ headerOD: 70, branchOD: 50, angleDeg: 90 }), { unit: 'mm' })
    expect(d.cutPaths).toHaveLength(2)
  })

  it('depthMm equals the first band profile extent', () => {
    const d = buildTemplateDrawing(near, { unit: 'mm' })
    const cuts = near.profile.map((p) => p.cut)
    expect(d.depthMm).toBeCloseTo(Math.max(...cuts) - Math.min(...cuts), 8)
  })
})

describe('length ruler units', () => {
  const t = branchNotch({ branchOD: 50, headerOD: 70, angleDeg: 90 })

  it('inch mode labels ticks in inches (with a " suffix)', () => {
    const d = buildTemplateDrawing(t, { unit: 'in' })
    const inchLabels = d.prims.filter((p) => p.t === 'text' && /^\d+"$/.test(p.s))
    expect(inchLabels.length).toBeGreaterThan(1)
  })

  it('mm mode labels ticks in plain mm numbers', () => {
    const d = buildTemplateDrawing(t, { unit: 'mm' })
    const mmLabels = d.prims.filter((p) => p.t === 'text' && /^\d+$/.test(p.s))
    expect(mmLabels.length).toBeGreaterThan(1)
  })
})
