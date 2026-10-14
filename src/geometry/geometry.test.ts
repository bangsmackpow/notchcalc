import { describe, expect, it } from 'vitest'
import { branchNotch, generate, headerHole, miterCut, miterForJointAngle } from './index.ts'

const TAU = Math.PI * 2
const N = 720

describe('branchNotch — equal diameter, square tee', () => {
  // r = R = 1 (OD 2 both), θ = 90° → cut(φ) = r·|cosφ|
  const t = branchNotch({ branchOD: 2, headerOD: 2, angleDeg: 90, samples: N })

  it('wraps the full circumference', () => {
    expect(t.width).toBeCloseTo(TAU, 10)
  })

  it('equals r·|cosφ| at every sample', () => {
    const n = t.profile.length - 1
    for (let i = 0; i <= n; i++) {
      const phi = (TAU * i) / n
      expect(t.profile[i].cut).toBeCloseTo(Math.abs(Math.cos(phi)), 9)
    }
  })

  it('is symmetric about φ = 0 and about φ = π/2', () => {
    const n = t.profile.length - 1
    for (let k = 1; k < n / 4; k += 37) {
      expect(t.profile[n - k].cut).toBeCloseTo(t.profile[k].cut, 9) // about 0
      expect(t.profile[n / 2 - k].cut).toBeCloseTo(t.profile[n / 2 + k].cut, 9) // about π/2
    }
  })

  it('reports depth = header radius for an equal square tee', () => {
    expect(t.minCut).toBeCloseTo(0, 9)
    expect(t.maxCut).toBeCloseTo(1, 9)
    expect(t.depth).toBeCloseTo(1, 9)
  })
})

describe('branchNotch — unequal diameter', () => {
  // r = 0.5, R = 1, θ = 90° → cut = √(R² − r²sin²φ)
  const t = branchNotch({ branchOD: 1, headerOD: 2, angleDeg: 90, samples: N })
  it('matches the closed form √(R² − r²sin²φ)', () => {
    const n = t.profile.length - 1
    for (let i = 0; i <= n; i += 13) {
      const phi = (TAU * i) / n
      expect(t.profile[i].cut).toBeCloseTo(Math.sqrt(1 - 0.25 * Math.sin(phi) ** 2), 9)
    }
  })
})

describe('branchNotch — angled joint', () => {
  const sq = branchNotch({ branchOD: 2, headerOD: 2, angleDeg: 90, samples: N })
  const swept = branchNotch({ branchOD: 2, headerOD: 2, angleDeg: 45, samples: N })

  it('45° produces a longer cut than 90°', () => {
    expect(swept.depth).toBeGreaterThan(sq.depth)
  })

  it('depth = R·cot(θ/2) for equal diameters', () => {
    expect(swept.depth).toBeCloseTo(1 / Math.tan(Math.PI / 8), 9)
    expect(sq.depth).toBeCloseTo(1 / Math.tan(Math.PI / 4), 9) // = 1
  })

  it('swept equal-diameter profile is asymmetric (long outside, short inside)', () => {
    expect(swept.maxCut).toBeGreaterThan(0.9)
    expect(swept.minCut).toBeLessThan(0.001)
  })
})

describe('branchNotch — offsets', () => {
  it('perpendicular offset breaks the symmetry of the profile', () => {
    const t = branchNotch({ branchOD: 2, headerOD: 3, angleDeg: 90, offsetPerp: 0.25, samples: N })
    const n = t.profile.length - 1
    expect(t.profile[n / 4].cut).not.toBeCloseTo(t.profile[(3 * n) / 4].cut, 3)
  })
})

describe('branchNotch — pass-through', () => {
  const t = branchNotch({ branchOD: 2, headerOD: 2, angleDeg: 90, passThrough: true, samples: N })
  it('reports a far curve with the opposite sign', () => {
    expect(t.far).toBeDefined()
    expect(t.far![0].cut).toBeCloseTo(-t.profile[0].cut, 9)
  })
})

describe('miterCut', () => {
  const t = miterCut({ od: 2, angleDeg: 45, samples: N })
  it('has amplitude r·tan(α)', () => {
    const amp = 1 * Math.tan(Math.PI / 4)
    expect(t.profile[0].cut).toBeCloseTo(amp, 9)
    expect(t.profile[t.profile.length - 1].cut).toBeCloseTo(amp, 9)
    expect(t.profile[(t.profile.length - 1) / 2].cut).toBeCloseTo(-amp, 9)
    expect(t.maxCut).toBeCloseTo(amp, 9)
    expect(t.minCut).toBeCloseTo(-amp, 9)
  })
  it('miterForJointAngle halves the joint angle', () => {
    const a = miterForJointAngle(2, 90, N)
    const b = miterCut({ od: 2, angleDeg: 45, samples: N })
    expect(a.depth).toBeCloseTo(b.depth, 10)
  })
})

describe('headerHole — equal diameter, square tee', () => {
  // r = R = 1 → z = ±|cosψ|
  const t = headerHole({ headerOD: 2, branchOD: 2, angleDeg: 90, samples: N })
  it('wraps the header circumference', () => {
    expect(t.width).toBeCloseTo(TAU, 10)
  })
  it('matches z = ±|cosψ| at every sample', () => {
    const n = t.profile.length - 1
    for (let i = 0; i <= n; i += 11) {
      const psi = (TAU * i) / n
      const expected = Math.abs(Math.cos(psi))
      expect(t.profile[i].cut).toBeCloseTo(expected, 9)
      expect(t.far![i].cut).toBeCloseTo(-expected, 9)
    }
  })
})

describe('generate() dispatch', () => {
  const base = {
    branchOD: 2,
    headerOD: 3,
    angleDeg: 90,
    offsetInPlane: 0,
    offsetPerp: 0,
    passThrough: false,
  } as const

  it('branch → one branch template', () => {
    const out = generate({ ...base, kind: 'branch' })
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('branch')
  })
  it('miter → one miter template', () => {
    const out = generate({ ...base, kind: 'miter' })
    expect(out[0].kind).toBe('miter')
  })
  it('hole → one hole template', () => {
    const out = generate({ ...base, kind: 'hole' })
    expect(out[0].kind).toBe('hole')
  })
})
