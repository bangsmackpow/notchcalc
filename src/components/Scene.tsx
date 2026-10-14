import { useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { branchDir, branchOrigin, miterDirs, type Branch, type Vec3 } from '../assembly/model.ts'
import { useAssembly } from '../assembly/store.ts'

const UP = new THREE.Vector3(0, 1, 0)

function HeaderTube({ od, length }: { od: number; length: number }) {
  const r = od / 2
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
      <cylinderGeometry args={[r, r, length, 64, 1, true]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} side={THREE.DoubleSide} />
    </mesh>
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
  const len = Math.max(b.odMm * 3, 200)
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

  const r = b.odMm / 2
  const mat = <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />

  if (kind === 'miter') {
    // Two tubes meeting at an elbow corner on the header line.
    const corner = new THREE.Vector3(b.posMm, 0, 0)
    const { dA, dB } = miterDirs(b)
    const halfTube = (d: Vec3) => {
      const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize()
      return {
        position: corner.clone().addScaledVector(dir, len / 2),
        quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir),
      }
    }
    const A = halfTube(dA)
    const B = halfTube(dB)
    return (
      <group {...handlers}>
        <mesh position={A.position} quaternion={A.quaternion}>
          <cylinderGeometry args={[r, r, len, 32, 1, true]} />
          {mat}
        </mesh>
        <mesh position={B.position} quaternion={B.quaternion}>
          <cylinderGeometry args={[r, r, len, 32, 1, true]} />
          {mat}
        </mesh>
        <mesh position={corner}>
          <sphereGeometry args={[r * 1.04, 20, 14]} />
          {mat}
        </mesh>
      </group>
    )
  }

  const u = branchDir(b)
  const origin = branchOrigin(b)
  const dir = new THREE.Vector3(u[0], u[1], u[2]).normalize()
  const position = new THREE.Vector3(origin[0], origin[1], origin[2]).addScaledVector(dir, len / 2)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir)
  const ringQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)

  return (
    <group {...handlers}>
      <mesh position={position} quaternion={quaternion}>
        <cylinderGeometry args={[r, r, len, 32, 1, true]} />
        {mat}
      </mesh>
      {kind === 'hole' && (
        // Marks the oval where the branch pierces the header wall.
        <mesh position={new THREE.Vector3(origin[0], origin[1], origin[2])} quaternion={ringQuat}>
          <torusGeometry args={[r * 1.03, 1.6, 8, 48]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </mesh>
      )}
    </group>
  )
}

function SceneContents() {
  const branches = useAssembly((s) => s.branches)
  const headerOD = useAssembly((s) => s.headerOD)
  const headerLength = useAssembly((s) => s.headerLength)
  const selectedId = useAssembly((s) => s.selectedId)
  const select = useAssembly((s) => s.select)

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[400, 800, 600]} intensity={1.4} />
      <directionalLight position={[-500, -300, -400]} intensity={0.5} />
      <gridHelper args={[headerLength * 1.4, 28, '#334155', '#1e293b']} position={[0, -headerOD, 0]} />
      <group onPointerMissed={() => select(null)}>
        <HeaderTube od={headerOD} length={headerLength} />
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
