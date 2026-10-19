import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeRig } from '../rig/dimensions';
import { BLADE_SEGMENTS, buildSkeleton, type FencerFrame, type Skeleton } from '../rig/skeleton';
import { lerp3, type V3 } from '../rig/vec';
import type { PhraseResult, Side } from '../sim/types';
import { useSettings } from '../store/settings';
import type { Player } from './player';

export type CameraPreset = 'referee' | 'top' | 'attacker' | 'defender' | 'pov' | 'orbit';
export interface OverlayFlags {
  targets: boolean;
  quadrants: boolean;
  trail: boolean;
  zones: boolean;
  ruler: boolean;
  ghost: boolean;
}
export const DEFAULT_OVERLAYS: OverlayFlags = { targets: false, quadrants: false, trail: true, zones: false, ruler: false, ghost: false };

const UP = new THREE.Vector3(0, 1, 0);

function useHeights(): Record<Side, number> {
  const l = useSettings((s) => s.heightLeft);
  const r = useSettings((s) => s.heightRight);
  return useMemo(() => ({ left: l, right: r }), [l, r]);
}
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function place(mesh: THREE.Object3D | null, a: V3, b: V3, r: number) {
  if (!mesh) return;
  tmpA.set(a[0], a[1], a[2]);
  tmpB.set(b[0], b[1], b[2]);
  const len = tmpA.distanceTo(tmpB);
  mesh.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
  mesh.scale.set(r, Math.max(1e-4, len), r);
  tmpB.sub(tmpA).normalize();
  mesh.quaternion.setFromUnitVectors(UP, tmpB);
}
function at(mesh: THREE.Object3D | null, p: V3, r?: number) {
  if (!mesh) return;
  mesh.position.set(p[0], p[1], p[2]);
  if (r) mesh.scale.setScalar(r);
}

/** Interpolated skeleton at a fractional tick. */
export type GhostMode = 'ideal' | 'kneeOver' | 'bentArm' | 'highHand' | 'lean';

/** Ghost poses: the ideal (authored, pre-IK) pose, or a demonstration of a common error. */
function ghostFrame(f: FencerFrame, mode: GhostMode): FencerFrame {
  const g: FencerFrame = { ...f, ik: undefined, bend: 0, whip: 0 };
  switch (mode) {
    case 'kneeOver':
      return { ...g, lower: { ...g.lower, pelvisDrop: g.lower.pelvisDrop + 0.09, pelvisX: g.lower.pelvisX + 0.12 } };
    case 'bentArm':
      return { ...g, upper: { ...g.upper, hand: [g.upper.hand[0] * 0.55, g.upper.hand[1], g.upper.hand[2]] } };
    case 'highHand':
      return { ...g, upper: { ...g.upper, hand: [g.upper.hand[0], g.upper.hand[1] + 0.18, g.upper.hand[2] + 0.12] } };
    case 'lean':
      return { ...g, lower: { ...g.lower, lean: g.lower.lean + 22 } };
    default:
      return g;
  }
}

export function skeletonAt(result: PhraseResult, side: Side, tick: number, heights: Record<Side, number>, ghost: false | GhostMode = false): Skeleton {
  const i = Math.max(0, Math.min(result.frames.length - 1, Math.floor(tick)));
  const j = Math.min(result.frames.length - 1, i + 1);
  const u = Math.max(0, Math.min(1, tick - i));
  const rig = makeRig(heights[side]);
  const raised = useSettings.getState().raisedRearArm;
  const arm = (f: FencerFrame): FencerFrame => (raised && f.lower.rearArm >= 0 ? { ...f, lower: { ...f.lower, rearArm: 1 } } : f);
  const f0: FencerFrame = arm(result.frames[i][side]);
  const f1: FencerFrame = arm(result.frames[j][side]);
  const a = buildSkeleton(ghost ? ghostFrame(f0, ghost) : f0, rig);
  if (u === 0 || i === j) return a;
  const b = buildSkeleton(ghost ? ghostFrame(f1, ghost) : f1, rig);
  const joints: Record<string, V3> = {};
  for (const k of Object.keys(a.joints)) joints[k] = lerp3(a.joints[k], b.joints[k], u);
  return { ...a, joints, blade: a.blade.map((p, n) => lerp3(p, b.blade[n], u)), tip: lerp3(a.tip, b.tip, u) };
}

const LIMBS: [string, string, number, 'kit' | 'lame' | 'shoe' | 'glove'][] = [
  ['hipW', 'kneeW', 0.07, 'kit'],
  ['kneeW', 'ankleW', 0.05, 'kit'],
  ['hipR', 'kneeR', 0.07, 'kit'],
  ['kneeR', 'ankleR', 0.05, 'kit'],
  ['heelW', 'toeW', 0.04, 'shoe'],
  ['heelR', 'toeR', 0.04, 'shoe'],
  ['shoulderW', 'elbowW', 0.045, 'kit'],
  ['elbowW', 'wristW', 0.04, 'kit'],
  ['wristW', 'handW', 0.04, 'glove'],
  ['shoulderR', 'elbowR', 0.045, 'kit'],
  ['elbowR', 'wristR', 0.04, 'kit'],
  ['pelvis', 'lumbar', 0.13, 'kit'],
  ['lumbar', 'chest', 0.135, 'lame'],
  ['shoulderR', 'shoulderW', 0.07, 'lame'],
  ['chest', 'neck', 0.05, 'kit'],
];

function FencerMesh({ player, side, ghost = false, overlays }: { player: Player; side: Side; ghost?: false | GhostMode; overlays: OverlayFlags }) {
  const heights = useHeights();
  const limbRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bladeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const headRef = useRef<THREE.Mesh>(null);
  const bibRef = useRef<THREE.Mesh>(null);
  const guardRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 14, 1), []);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  const accent = side === 'left' ? '#e5484d' : '#30a46c';
  const mats = useMemo(() => {
    const t = ghost ? { transparent: true, opacity: 0.28, depthWrite: false } : {};
    return {
      kit: new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.85, ...t }),
      lame: new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.75, roughness: 0.35, ...t }),
      shoe: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.7, ...t }),
      glove: new THREE.MeshStandardMaterial({ color: '#d9d2c3', roughness: 0.8, ...t }),
      mask: new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.5, metalness: 0.3, ...t }),
      steel: new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.9, roughness: 0.25, ...t }),
      forte: new THREE.MeshStandardMaterial({ color: '#4f8cff', metalness: 0.5, roughness: 0.3, ...t }),
      middle: new THREE.MeshStandardMaterial({ color: '#e6b84f', metalness: 0.5, roughness: 0.3, ...t }),
      faible: new THREE.MeshStandardMaterial({ color: '#c879ff', metalness: 0.5, roughness: 0.3, ...t }),
      valid: new THREE.MeshStandardMaterial({ color: '#d9a400', metalness: 0.6, roughness: 0.35, ...t }),
      off: new THREE.MeshStandardMaterial({ color: '#7b7f87', roughness: 0.9, ...t }),
      accent: new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: ghost ? 0.15 : 0.55 }),
    };
  }, [ghost, accent]);

  useFrame(() => {
    const r = player.result;
    if (!r || !r.frames.length) return;
    const sk = skeletonAt(r, side, player.tick, heights, ghost);
    LIMBS.forEach(([a, b, rad, kind], i) => {
      const m = limbRefs.current[i];
      place(m, sk.joints[a], sk.joints[b], rad);
      if (m) m.material = overlays.targets ? (kind === 'lame' ? mats.valid : mats.off) : mats[kind];
    });
    at(headRef.current, sk.joints.head, 0.12);
    if (headRef.current) headRef.current.material = overlays.targets ? mats.off : mats.mask;
    at(bibRef.current, [sk.joints.neck[0], sk.joints.neck[1] + 0.03, sk.joints.neck[2]], 0.06);
    if (bibRef.current) bibRef.current.material = overlays.targets ? mats.valid : mats.lame;
    for (let i = 0; i < BLADE_SEGMENTS; i++) {
      const m = bladeRefs.current[i];
      place(m, sk.blade[i], sk.blade[i + 1], 0.0045 - i * 0.0002);
      if (m) m.material = overlays.zones ? (i < BLADE_SEGMENTS / 3 ? mats.forte : i < (2 * BLADE_SEGMENTS) / 3 ? mats.middle : mats.faible) : mats.steel;
    }
    if (guardRef.current) {
      place(guardRef.current, sk.guard, lerp3(sk.guard, sk.blade[1], 0.15), 0.05);
    }
    at(tipRef.current, sk.tip, 0.006);
    if (ringRef.current) ringRef.current.position.set(sk.joints.pelvis[0], 0.004, 0);
  });

  return (
    <group>
      {LIMBS.map((_, i) => (
        <mesh key={i} ref={(m) => (limbRefs.current[i] = m)} geometry={cyl} material={mats.kit} castShadow={!ghost} />
      ))}
      <mesh ref={headRef} geometry={sph} material={mats.mask} castShadow={!ghost} />
      <mesh ref={bibRef} geometry={sph} material={mats.lame} />
      {Array.from({ length: BLADE_SEGMENTS }, (_, i) => (
        <mesh key={i} ref={(m) => (bladeRefs.current[i] = m)} geometry={cyl} material={mats.steel} castShadow={!ghost} />
      ))}
      <mesh ref={guardRef} geometry={cyl} material={mats.steel} />
      <mesh ref={tipRef} geometry={sph} material={mats.steel} />
      {!ghost && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} material={mats.accent}>
          <ringGeometry args={[0.32, 0.38, 40]} />
        </mesh>
      )}
    </group>
  );
}

function Piste() {
  const lines: [number, number, string][] = [
    [0, 0.03, '#d7dbe2'],
    [-2, 0.02, '#d7dbe2'],
    [2, 0.02, '#d7dbe2'],
    [-7, 0.04, '#d7dbe2'],
    [7, 0.04, '#d7dbe2'],
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#20232a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 1.8]} />
        <meshStandardMaterial color="#5d636e" roughness={0.6} metalness={0.2} />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.001, 0]}>
          <planeGeometry args={[2, 1.8]} />
          <meshStandardMaterial color="#8a5a3c" roughness={0.7} transparent opacity={0.55} />
        </mesh>
      ))}
      {lines.map(([x, w, c]) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, 0]}>
          <planeGeometry args={[w, 1.8]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function ScoringBox3D({ player }: { player: Player }) {
  const red = useRef<THREE.MeshStandardMaterial>(null);
  const green = useRef<THREE.MeshStandardMaterial>(null);
  const wl = useRef<THREE.MeshStandardMaterial>(null);
  const wr = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const r = player.result;
    const on = (side: Side, valid: boolean) => !!r && r.registered.some((x) => x.side === side && x.valid === valid && x.tick <= player.tick && (r.lockoutStart === null || x.tick <= r.lockoutStart + 36));
    const set = (m: THREE.MeshStandardMaterial | null, lit: boolean, col: string) => {
      if (!m) return;
      m.emissive.set(lit ? col : '#000000');
      m.emissiveIntensity = lit ? 2.2 : 0;
    };
    set(red.current, on('left', true), '#ff2a2a');
    set(green.current, on('right', true), '#26ff6a');
    set(wl.current, on('left', false), '#ffffff');
    set(wr.current, on('right', false), '#ffffff');
  });
  return (
    <group position={[0, 0.5, -1.6]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.32, 0.22]} />
        <meshStandardMaterial color="#111317" />
      </mesh>
      {[
        [-0.22, red, '#5a1010'],
        [-0.08, wl, '#555'],
        [0.08, wr, '#555'],
        [0.22, green, '#0f4a22'],
      ].map(([x, ref, c], i) => (
        <mesh key={i} position={[x as number, 0.02, 0.115]}>
          <boxGeometry args={[0.11, 0.18, 0.02]} />
          <meshStandardMaterial ref={ref as React.RefObject<THREE.MeshStandardMaterial>} color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

function Trail({ player, side }: { player: Player; side: Side }) {
  const heights = useHeights();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    return g;
  }, []);
  const line = useMemo(() => new THREE.Line(geo, new THREE.LineBasicMaterial({ color: side === 'left' ? '#ff6b6b' : '#4cd98a' })), [geo, side]);
  useFrame(() => {
    const r = player.result;
    if (!r) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 48; i++) {
      const t = Math.max(0, player.tick - (47 - i) * 1.5);
      const sk = skeletonAt(r, side, t, heights);
      pos.setXYZ(i, sk.tip[0], sk.tip[1], sk.tip[2]);
    }
    pos.needsUpdate = true;
  });
  return <primitive object={line} />;
}

function Quadrants({ player, side }: { player: Player; side: Side }) {
  const heights = useHeights();
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const r = player.result;
    if (!r || !g.current) return;
    const sk = skeletonAt(r, side, player.tick, heights);
    const f = r.frames[0][side].facing;
    g.current.position.set(sk.joints.lumbar[0] + f * 0.16, sk.joints.lumbar[1] + 0.05, 0);
    g.current.rotation.y = Math.PI / 2;
  });
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.12, side: THREE.DoubleSide }), []);
  return (
    <group ref={g}>
      {[
        [-0.1, 0.13],
        [0.1, 0.13],
        [-0.1, -0.13],
        [0.1, -0.13],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]} material={mat}>
          <planeGeometry args={[0.19, 0.25]} />
        </mesh>
      ))}
    </group>
  );
}

function Ruler({ player }: { player: Player }) {
  const heights = useHeights();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const r = player.result;
    if (!r || !ref.current) return;
    const a = skeletonAt(r, 'left', player.tick, heights);
    const d = skeletonAt(r, 'right', player.tick, heights);
    const x0 = a.joints.shoulderW[0];
    const x1 = d.targets[0].a[0] - d.targets[0].r;
    ref.current.position.set((x0 + x1) / 2, 0.01, 0.95);
    ref.current.scale.set(Math.max(0.01, x1 - x0), 1, 1);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 0.08]} />
      <meshBasicMaterial color="#ffd166" />
    </mesh>
  );
}

function CameraRig({ player, preset, reduced }: { player: Player; preset: CameraPreset; reduced: boolean }) {
  const { camera } = useThree();
  const heights = useHeights();
  const target = useRef(new THREE.Vector3(0, 1, 0));
  useFrame((_, dt) => {
    const r = player.result;
    if (preset === 'orbit' || !r) return;
    const a = skeletonAt(r, 'left', player.tick, heights);
    const d = skeletonAt(r, 'right', player.tick, heights);
    const mid = (a.joints.pelvis[0] + d.joints.pelvis[0]) / 2;
    const span = Math.abs(a.joints.pelvis[0] - d.joints.pelvis[0]);
    const want = new THREE.Vector3();
    const look = new THREE.Vector3(mid, 1.0, 0);
    switch (preset) {
      case 'referee':
        want.set(mid, 1.35, 2.4 + span * 0.75);
        break;
      case 'top':
        want.set(mid, 3 + span * 1.1, 0.01);
        look.set(mid, 0, 0);
        break;
      case 'attacker':
        want.set(a.joints.pelvis[0] - 2.2, 1.7, 0.9);
        look.set(d.joints.chest[0], 1.1, 0);
        break;
      case 'defender':
        want.set(d.joints.pelvis[0] + 2.2, 1.7, -0.9);
        look.set(a.joints.chest[0], 1.1, 0);
        break;
      case 'pov':
        want.set(a.joints.shoulderW[0] - 0.45, a.joints.head[1] + 0.12, a.joints.shoulderW[2] + 0.35);
        look.set(d.joints.chest[0], d.joints.chest[1] - 0.1, 0);
        break;
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
    camera.position.lerp(want, k);
    target.current.lerp(look, k);
    camera.lookAt(target.current);
  });
  return null;
}

function Clock({ player }: { player: Player }) {
  useFrame((_, dt) => player.advance(Math.min(dt, 0.05)));
  return null;
}

export interface StageProps {
  player: Player;
  camera?: CameraPreset;
  overlays?: OverlayFlags;
  label: string;
  className?: string;
  ghostMode?: GhostMode;
}

/** The 3D training room: piste, two fencers, scoring box, overlays and camera presets. */
export function Stage({ player, camera = 'referee', overlays = DEFAULT_OVERLAYS, label, className, ghostMode = 'ideal' }: StageProps) {
  const reduced = useSettings((s) => s.reducedMotion);
  return (
    <div className={className} role="img" aria-label={label}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 1.4, 5], fov: 40, near: 0.05, far: 80 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#15171c']} />
        <hemisphereLight args={['#c9d6ff', '#22252b', 0.75]} />
        <directionalLight
          position={[3, 7, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={4}
          shadow-camera-bottom={-2}
        />
        <Clock player={player} />
        <Piste />
        <ScoringBox3D player={player} />
        <FencerMesh player={player} side="left" overlays={overlays} />
        <FencerMesh player={player} side="right" overlays={overlays} />
        {overlays.ghost && <FencerMesh player={player} side="left" ghost={ghostMode} overlays={overlays} />}
        {overlays.trail && <Trail player={player} side="left" />}
        {overlays.trail && <Trail player={player} side="right" />}
        {overlays.quadrants && <Quadrants player={player} side="right" />}
        {overlays.ruler && <Ruler player={player} />}
        <CameraRig player={player} preset={camera} reduced={reduced} />
        {camera === 'orbit' && <OrbitControls target={[0, 1, 0]} enablePan={false} minDistance={1.5} maxDistance={12} />}
      </Canvas>
    </div>
  );
}
