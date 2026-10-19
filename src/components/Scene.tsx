import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { cornerRadiusOf, sectionDims, type Section } from '../geometry/index.ts'
import { branchDir, branchOrigin, miterDirs, type Branch, type Vec3 } from '../assembly/model.ts'
import { useAssembly } from '../assembly/store.ts'

const UP = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const a = w / 2
  const b = h / 2
  const rr = Math.max(0, Math.min(r, Math.min(a, b)))
  const s = new THREE.Shape()
  if (rr < 1e-3) {
    s.moveTo(-a, -b)
    s.lineTo(a, -b)
    s.lineTo(a, b)
    s.lineTo(-a, b)
    s.closePath()
    return s
  }
  s.moveTo(-a + rr, -b)
  s.lineTo(a - rr, -b)
  s.absarc(a - rr, -b + rr, rr, -Math.PI / 2, 0, false)
  s.lineTo(a, b - rr)
  s.absarc(a - rr, b - rr, rr, 0, Math.PI / 2, false)
  s.lineTo(-a + rr, b)
  s.absarc(-a + rr, b - rr, rr, Math.PI / 2, Math.PI, false)
  s.lineTo(-a, -b + rr)
  s.absarc(-a + rr, -b + rr, rr, Math.PI, 1.5 * Math.PI, false)
  return s
}

/** Geometry for a tube: an open cylinder, or a rounded box extruded along +Z. */
function TubeGeom({ section, length }: { section: Section; length: number }) {
  const rectGeo = useMemo(() => {
    if (section.shape === 'round') return null
    const shape = roundedRectShape(section.width, section.height, cornerRadiusOf(section))
    const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 16 })
    g.translate(0, 0, -length / 2)
    return g
  }, [section, length])

  if (section.shape === 'round') {
    const r = section.od / 2
    return <cylinderGeometry args={[r, r, length, 48, 1, true]} />
  }
  return <primitive object={rectGeo as THREE.BufferGeometry} attach="geometry" />
}

function SectionTube({
  section,
  length,
  dir,
  position,
  material,
}: {
  section: Section
  length: number
  dir: THREE.Vector3
  position: THREE.Vector3
  material: ReactNode
}) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    section.shape === 'round' ? UP : Z_AXIS,
    dir.clone().normalize(),
  )
  return (
    <mesh position={position} quaternion={quaternion}>
      <TubeGeom section={section} length={length} />
      {material}
    </mesh>
  )
}

function HeaderTube({ section, length }: { section: Section; length: number }) {
  return (
    <SectionTube
      section={section}
      length={length}
      dir={new THREE.Vector3(1, 0, 0)}
      position={new THREE.Vector3(0, 0, 0)}
      material={<meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} side={THREE.DoubleSide} />}
    />
  )
}

function BranchTube({ b, selected }: { b: Branch; selected: boolean }) {
  const { camera, raycaster } = useThree()
  const update = useAssembly((s) => s.updateBranch)
  const select = useAssembly((s) => s.select)
  const headerLength = useAssembly((s) => s.headerLength)
  const dragging = useRef(false)
  const [hovered, setHovered] = useState(false)

  const kind = b.kind ?? 'branch'
  const dims = sectionDims(b.section)
  const len = Math.max(Math.max(dims.w, dims.h) * 3, 200)
  const color = selected ? '#f97316' : hovered ? '#60a5fa' : '#3b82f6'

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    select(b.id)
    ;(e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
    dragging.current = true
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId)
    dragging.current = false
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    e.stopPropagation()
    const ndc = new THREE.Vector2(e.pointer.x, e.pointer.y)
    raycaster.setFromCamera(ndc, camera)
    const axis = new THREE.Vector3(1, 0, 0)
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const normal = new THREE.Vector3().crossVectors(axis, camDir).normalize()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0, 0))
    const hit = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(plane, hit)) {
      const half = headerLength / 2
      const pos = Math.max(-half + 20, Math.min(half - 20, hit.x))
      update(b.id, { posMm: Math.round(pos * 10) / 10 })
    }
  }

  const handlers = {
    onPointerDown: onDown,
    onPointerUp: onUp,
    onPointerMove: onMove,
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHovered(true)
    },
    onPointerOut: () => setHovered(false),
  }

  const mat = <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />

  if (kind === 'miter') {
    // Two tubes meeting at an elbow corner on the header line.
    const corner = new THREE.Vector3(b.posMm, 0, 0)
    const { dA, dB } = miterDirs(b)
    const halfTube = (d: Vec3) => {
      const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize()
      return { position: corner.clone().addScaledVector(dir, len / 2), dir }
    }
    const A = halfTube(dA)
    const B = halfTube(dB)
    return (
      <group {...handlers}>
        <SectionTube section={b.section} length={len} dir={A.dir} position={A.position} material={mat} />
        <SectionTube section={b.section} length={len} dir={B.dir} position={B.position} material={mat} />
        <mesh position={corner}>
          <sphereGeometry args={[Math.max(dims.w, dims.h) * 0.52, 20, 14]} />
          {mat}
        </mesh>
      </group>
    )
  }

  const u = branchDir(b)
  const origin = branchOrigin(b)
  const dir = new THREE.Vector3(u[0], u[1], u[2]).normalize()
  const position = new THREE.Vector3(origin[0], origin[1], origin[2]).addScaledVector(dir, len / 2)
  const ringQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)

  return (
    <group {...handlers}>
      <mesh position={position} quaternion={new THREE.Quaternion().setFromUnitVectors(b.section.shape === 'round' ? UP : Z_AXIS, dir)}>
        <TubeGeom section={b.section} length={len} />
        {mat}
      </mesh>
      {kind === 'hole' && b.section.shape === 'round' && (
        // Marks the oval where the branch pierces the header wall.
        <mesh position={new THREE.Vector3(origin[0], origin[1], origin[2])} quaternion={ringQuat}>
          <torusGeometry args={[(b.section.od / 2) * 1.03, 1.6, 8, 48]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </mesh>
      )}
    </group>
  )
}

function SceneContents() {
  const branches = useAssembly((s) => s.branches)
  const headerSection = useAssembly((s) => s.headerSection)
  const headerLength = useAssembly((s) => s.headerLength)
  const selectedId = useAssembly((s) => s.selectedId)
  const select = useAssembly((s) => s.select)
  const hd = sectionDims(headerSection)

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[400, 800, 600]} intensity={1.4} />
      <directionalLight position={[-500, -300, -400]} intensity={0.5} />
      <gridHelper args={[headerLength * 1.4, 28, '#334155', '#1e293b']} position={[0, -Math.max(hd.w, hd.h), 0]} />
      <group onPointerMissed={() => select(null)}>
        <HeaderTube section={headerSection} length={headerLength} />
        {branches.map((b) => (
          <BranchTube key={b.id} b={b} selected={b.id === selectedId} />
        ))}
      </group>
      <OrbitControls
        makeDefault
        enableDamping
        target={[0, 0, 0]}
        minDistance={120}
        maxDistance={headerLength * 4}
      />
    </>
  )
}

export function Scene() {
  const headerLength = useAssembly((s) => s.headerLength)
  const d = headerLength * 0.9
  return (
    <Canvas
      camera={{ position: [d * 0.5, d * 0.55, d * 0.85], fov: 45, near: 5, far: headerLength * 20 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContents />
    </Canvas>
  )
}
