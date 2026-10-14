import { describe, expect, it } from 'vitest'
import { branchBasis, branchDir, branchOrigin, jointSpecFor, makeBranch } from './model.ts'

const approx = (a: number[], b: number[]) => {
  expect(a[0]).toBeCloseTo(b[0], 6)
  expect(a[1]).toBeCloseTo(b[1], 6)
  expect(a[2]).toBeCloseTo(b[2], 6)
}

describe('branchDir', () => {
  it('is along the header at 0°', () => {
    approx(branchDir(makeBranch(50, 0, 0)), [1, 0, 0])
  })
  it('is perpendicular at 90° / roll 0', () => {
    approx(branchDir(makeBranch(50, 0, 90)), [0, 1, 0])
  })
  it('rolls about the header axis', () => {
    const b = { ...makeBranch(50, 0, 90), rollDeg: 90 }
    approx(branchDir(b), [0, 0, 1])
  })
})

describe('branchBasis / branchOrigin', () => {
  it('e1 is +Y at roll 0', () => {
    const { e1, e2 } = branchBasis(makeBranch(50, 0, 90))
    approx(e1, [0, 1, 0])
    approx(e2, [0, 0, 1])
  })
  it('applies in-plane offset along e1', () => {
    const b = { ...makeBranch(50, 100, 90), offsetInPlane: 10 }
    approx(branchOrigin(b), [100, 10, 0])
  })
  it('applies perpendicular offset along e2', () => {
    const b = { ...makeBranch(50, 100, 90), offsetPerp: 5 }
    approx(branchOrigin(b), [100, 0, 5])
  })
})

describe('jointSpecFor', () => {
  it('maps branch fields onto a branch cut spec', () => {
    const b = { ...makeBranch(60, 0, 45), offsetInPlane: 2, offsetPerp: 3 }
    const spec = jointSpecFor(b, 88.9)
    expect(spec).toMatchObject({
      kind: 'branch',
      branchOD: 60,
      headerOD: 88.9,
      angleDeg: 45,
      offsetInPlane: 2,
      offsetPerp: 3,
      passThrough: false,
    })
  })
})
