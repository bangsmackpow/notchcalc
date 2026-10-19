import { describe, expect, it } from 'vitest'
import { branchNotch, generate, headerHole, type Section } from '../geometry/index.ts'
import { buildTemplateDrawing } from './drawing.ts'

const R = (od: number): Section => ({ shape: 'round', od })

describe('generate + stacked drawing for through-branches', () => {
  const templates = generate({
    kind: 'hole',
    branchSection: R(50),
    headerSection: R(70),
    angleDeg: 90,
    offsetInPlane: 0,
    offsetPerp: 0,
    sectionRollDeg: 0,
    headerRollDeg: 0,
    passThrough: false,
  })

  it('produces notch + hole templates', () => {
    expect(templates.map((t) => t.kind)).toEqual(['branch', 'hole'])
  })

  it('stacks both templates: notch profile + both hole edges', () => {
    const d = buildTemplateDrawing(templates, { unit: 'mm' })
    expect(d.cutPaths).toHaveLength(3)
    // notch band + hole band separated
    expect(d.height).toBeGreaterThan(buildTemplateDrawing(templates[0], { unit: 'mm' }).height)
    expect(d.meta.title).toContain('THROUGH-BRANCH SET')
  })
})

describe('buildTemplateDrawing — band stacking', () => {
  const near = branchNotch({ branchSection: R(50), headerSection: R(70), angleDeg: 90 })
  const thru = branchNotch({ branchSection: R(50), headerSection: R(70), angleDeg: 90, passThrough: true })

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
  const t = branchNotch({ branchSection: R(50), headerSection: R(70), angleDeg: 90 })

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
