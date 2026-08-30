import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import {
  AdditiveBlending, DoubleSide,
  type BufferAttribute, type Group, type Mesh, type MeshBasicMaterial, type Points,
} from "three";
import { ACCENT_SECONDARY_COLOR, ACCENT_WARM_COLOR, CORE_COLOR } from "../../lib/3d/socGraph";

/**
 * The SOC Core — SOCGenie's central 3D identity: a luminous inner core, a
 * rotating network-grid globe, a geometric wireframe shell, four tilted
 * orbital rings, an atmospheric glow and two sparse orbiting-mote fields.
 * Shared by SocCore3D (dashboard) and the Login scene so the same core
 * identity appears wherever it renders.
 *
 * Purely decorative — it represents the platform, not a data value, so it
 * never draws a number or claim. `intensity` only changes pulse rate/depth
 * and glow strength; "elevated" is driven by a REAL critical-alert count
 * where that data exists (Command Center). The Login page has no such data
 * pre-auth and always uses "calm" — this is branding, exactly like the
 * existing SVG IntelligenceVisualization it sits alongside there.
 *
 * `bootEntrance` (opt-in, Login only) plays a one-shot "system boot" reveal:
 * layers scale in with a stagger, then settle into the same ambient motion
 * Command Center has always had. Command Center never passes this prop, so
 * `instant` below is always true there and every ramp resolves to its final
 * value on the very first frame — byte-for-byte the same as before this was
 * added.
 *
 * Motion is entirely useFrame + refs — no per-frame React state, so nothing
 * here re-renders the component tree.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Eased 0→1 progress for a ramp starting `delay` seconds after mount and
 *  taking `duration` seconds — clamped, so callers can use it forever
 *  without an unmount step. */
function ramp(elapsedSeconds: number, delay: number, duration: number): number {
  if (duration <= 0) return elapsedSeconds >= delay ? 1 : 0;
  const t = Math.min(Math.max((elapsedSeconds - delay) / duration, 0), 1);
  return easeOutCubic(t);
}

function coreParticlePositions(count: number, rMin: number, rMax: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return positions;
}

/** A small marker riding an orbital ring, inheriting the ring's own rotation
 *  since it's mounted as that mesh's child. Brightens on its own slow cycle
 *  so it reads as an occasional pulse travelling the ring, not a static dot. */
function RingMarker({ radius, color, period }: { radius: number; color: string; period: number }) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  useFrame((state) => {
    if (REDUCED_MOTION || !materialRef.current) return;
    const t = (state.clock.elapsedTime % period) / period;
    materialRef.current.opacity = 0.2 + Math.pow(Math.sin(t * Math.PI), 3) * 0.7;
  });
  return (
    <mesh position={[radius, 0, 0]}>
      <sphereGeometry args={[0.022, 8, 8]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={0.3} />
    </mesh>
  );
}

interface Orbit {
  radius: number;
  speed: number;
  incl: number;
  node: number;
  phase: number;
}

/** Sparse motes drifting in their own tilted circular orbits around the core.
 *  Positions are written directly into a shared Float32Array each frame
 *  (no per-mote objects, no React state) — a cheap way to get "small moving
 *  signal elements" without hundreds of meshes or particle-system libraries. */
function OrbitingMotes({ count, radius, color, size, speed }: {
  count: number;
  radius: [number, number];
  color: string;
  size: number;
  speed: [number, number];
}) {
  const pointsRef = useRef<Points>(null);
  const orbits = useMemo<Orbit[]>(
    () =>
      Array.from({ length: count }, () => ({
        radius: radius[0] + Math.random() * (radius[1] - radius[0]),
        speed: speed[0] + Math.random() * (speed[1] - speed[0]),
        incl: Math.random() * Math.PI,
        node: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      })),
    [count, radius, speed]
  );
  const positions = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame((state) => {
    if (REDUCED_MOTION) return;
    const attr = pointsRef.current?.geometry.attributes.position as BufferAttribute | undefined;
    if (!attr) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const o = orbits[i];
      const angle = o.phase + t * o.speed;
      const x0 = Math.cos(angle) * o.radius;
      const y0 = Math.sin(angle) * o.radius;
      const y1 = y0 * Math.cos(o.incl);
      const z1 = y0 * Math.sin(o.incl);
      const x2 = x0 * Math.cos(o.node) - z1 * Math.sin(o.node);
      const z2 = x0 * Math.sin(o.node) + z1 * Math.cos(o.node);
      attr.array[i * 3] = x2;
      attr.array[i * 3 + 1] = y1;
      attr.array[i * 3 + 2] = z2;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** A grounding platform under the core — concentric ring outlines, faint
 *  radial spokes and a slow rotating "sweep" wedge, so the core reads as
 *  physically anchored rather than floating in empty space. Purely
 *  decorative — the same honesty rule as the rest of this file.
 *
 *  `scaleRef` lets the parent drive its entrance scale (0→1) without this
 *  component needing to know anything about boot sequencing itself. */
function HolographicPlatform({ scaleRef }: { scaleRef?: React.RefObject<Group> }) {
  const sweepRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (REDUCED_MOTION || !sweepRef.current) return;
    sweepRef.current.rotation.z = state.clock.elapsedTime * 0.25;
  });

  const spokes = useMemo(
    () => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2),
    []
  );

  return (
    <group ref={scaleRef} position={[0, -2.0, 0]}>
      {/* Soft wide glow beneath the rings — "light spilling onto a floor",
          not a hard-edged disc. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-2}>
        <circleGeometry args={[2.6, 40]} />
        <meshBasicMaterial
          color={CORE_COLOR}
          transparent
          opacity={0.035}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {[1.4, 1.75, 2.1].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r, r + 0.008, 64]} />
          <meshBasicMaterial
            color={i === 1 ? ACCENT_SECONDARY_COLOR : CORE_COLOR}
            transparent
            opacity={0.3 - i * 0.06}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {spokes.map((angle) => (
        <Line
          key={angle}
          points={[
            [Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35],
            [Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1],
          ]}
          color={CORE_COLOR}
          lineWidth={0.5}
          transparent
          opacity={0.08}
        />
      ))}
      <mesh ref={sweepRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 2.1, 48, 1, 0, Math.PI / 8]} />
        <meshBasicMaterial
          color={CORE_COLOR}
          transparent
          opacity={0.09}
          side={DoubleSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** The core's centre is deliberately hollow — no solid filled mesh anywhere
 *  in it. A flat opaque sphere reads as "a blue disk"; a wireframe shell
 *  around a faint additive glow reads as depth. */
const CORE_CENTER_COLOR = "#38d9ff";

export function SecurityCore({
  intensity = "calm",
  particleCount = 80,
  bootEntrance = false,
}: {
  intensity?: "calm" | "elevated";
  particleCount?: number;
  /** Opt-in one-shot "system boot" reveal — Login only. Command Center never
   *  passes this, so its appearance is completely unchanged. */
  bootEntrance?: boolean;
}) {
  const coreRef = useRef<Group>(null);
  const glowRef = useRef<MeshBasicMaterial>(null);
  const globeRef = useRef<Mesh>(null);
  const shellRef = useRef<Mesh>(null);
  const ringInnerRef = useRef<Mesh>(null);
  const ringARef = useRef<Mesh>(null);
  const ringBRef = useRef<Mesh>(null);
  const ringOuterRef = useRef<Mesh>(null);
  const particlesRef = useRef<Points>(null);
  const signalSweepRef = useRef<Mesh>(null);

  // Entrance-only groups. Each wraps existing layers without touching their
  // own geometry/position/color — purely an outer scale handle.
  const atmosphereGroupRef = useRef<Group>(null);
  const innerRingGroupRef = useRef<Group>(null);
  const wireGroupRef = useRef<Group>(null);
  const midRingGroupRef = useRef<Group>(null);
  const outerRingGroupRef = useRef<Group>(null);
  const particleFieldGroupRef = useRef<Group>(null);
  const platformGroupRef = useRef<Group>(null);
  const pulse1Ref = useRef<Mesh>(null);
  const pulse1MatRef = useRef<MeshBasicMaterial>(null);
  const pulse2Ref = useRef<Mesh>(null);
  const pulse2MatRef = useRef<MeshBasicMaterial>(null);
  const beamMatRef = useRef<MeshBasicMaterial>(null);

  const particles = useMemo(
    () => coreParticlePositions(particleCount, 1.35, 2.05),
    [particleCount]
  );
  const elevated = intensity === "elevated";
  const initialScale = bootEntrance ? 0 : 1;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const instant = !bootEntrance || REDUCED_MOTION;
    const elapsed = instant ? 9999 : t;

    // ---- One-shot entrance ramps. Always computed; when `instant`, every
    // ramp is already at 1 on the very first frame, so nothing here changes
    // Command Center's appearance or Login-under-reduced-motion. ----
    const atmosphereP = ramp(elapsed, 0.02, 0.5);
    const coreP = ramp(elapsed, 0.15, 0.4);
    const innerRingP = ramp(elapsed, 0.3, 0.35);
    const wireP = ramp(elapsed, 0.38, 0.35);
    const midRingP = ramp(elapsed, 0.46, 0.35);
    const outerRingP = ramp(elapsed, 0.54, 0.35);
    const particleP = ramp(elapsed, 0.58, 0.35);
    const platformP = ramp(elapsed, 0.62, 0.4);

    if (atmosphereGroupRef.current) atmosphereGroupRef.current.scale.setScalar(atmosphereP);
    if (innerRingGroupRef.current) innerRingGroupRef.current.scale.setScalar(innerRingP);
    if (wireGroupRef.current) wireGroupRef.current.scale.setScalar(wireP);
    if (midRingGroupRef.current) midRingGroupRef.current.scale.setScalar(midRingP);
    if (outerRingGroupRef.current) outerRingGroupRef.current.scale.setScalar(outerRingP);
    if (particleFieldGroupRef.current) particleFieldGroupRef.current.scale.setScalar(particleP);
    if (platformGroupRef.current) platformGroupRef.current.scale.setScalar(platformP);
    // Persistent beam connecting core to platform — reveals alongside the
    // platform itself rather than as a separate ramp.
    if (beamMatRef.current) beamMatRef.current.opacity = 0.14 * platformP;

    // One-shot energy pulses — core outward to the ring boundary, and core
    // down to the platform. Opacity follows a bell curve that mathematically
    // returns to (and stays at) 0 once the ramp completes, so no unmount
    // bookkeeping is needed; they simply go quiet and never restart.
    if (bootEntrance && !REDUCED_MOTION) {
      const pulse1P = ramp(t, 0.55, 0.45);
      const pulse2P = ramp(t, 0.68, 0.45);
      if (pulse1Ref.current && pulse1MatRef.current) {
        pulse1Ref.current.position.set(0, 0, 1.93 * pulse1P);
        pulse1MatRef.current.opacity = Math.sin(pulse1P * Math.PI) * 0.7;
      }
      if (pulse2Ref.current && pulse2MatRef.current) {
        pulse2Ref.current.position.set(0, -2 * pulse2P, 0);
        pulse2MatRef.current.opacity = Math.sin(pulse2P * Math.PI) * 0.4;
      }
    }

    const coreEntranceScale = instant ? 1 : 0.82 + 0.18 * coreP;
    if (coreRef.current) coreRef.current.scale.setScalar(coreEntranceScale);
    if (glowRef.current) glowRef.current.opacity = 0.05 * coreP;

    if (REDUCED_MOTION) return;

    // ---- Ambient motion (unchanged from before boot-entrance existed). ----
    if (globeRef.current) {
      globeRef.current.rotation.y = t * 0.045;
      globeRef.current.rotation.x = Math.sin(t * 0.02) * 0.08;
    }
    if (shellRef.current) shellRef.current.rotation.y = t * 0.07;
    if (ringInnerRef.current) ringInnerRef.current.rotation.y = t * -0.11;
    if (ringARef.current) ringARef.current.rotation.z = t * 0.09;
    if (ringBRef.current) ringBRef.current.rotation.x = t * -0.06;
    if (ringOuterRef.current) ringOuterRef.current.rotation.y = t * 0.045;
    if (particlesRef.current) particlesRef.current.rotation.y = t * 0.025;
    // Intelligence signal — a thin scanning arc travelling continuously
    // around the outer geometry, well clear of the core itself.
    if (signalSweepRef.current) signalSweepRef.current.rotation.z = t * 0.12;
    if (coreRef.current) {
      const speed = elevated ? 1.7 : 0.75;
      const depth = elevated ? 0.07 : 0.03;
      coreRef.current.scale.setScalar(coreEntranceScale * (1 + Math.sin(t * speed) * depth));
    }
    // Atmospheric wash breathes gently with the core, slightly stronger when elevated.
    if (glowRef.current) {
      const base = elevated ? 0.065 : 0.045;
      glowRef.current.opacity = coreP * (base + Math.sin(t * (elevated ? 1.7 : 0.75)) * 0.012);
    }
  });

  return (
    <group>
      {/* Outer atmosphere — two large, very low-opacity additive spheres for
          soft colour depth around the whole core, without post-processing. */}
      <group ref={atmosphereGroupRef} scale={initialScale}>
        <mesh renderOrder={-2}>
          <sphereGeometry args={[2.15, 20, 20]} />
          <meshBasicMaterial
            color={CORE_COLOR}
            transparent
            opacity={0.018}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={-1}>
          <sphereGeometry args={[1.75, 20, 20]} />
          <meshBasicMaterial
            color={ACCENT_SECONDARY_COLOR}
            transparent
            opacity={0.02}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Warm accent — appears ONLY while genuinely elevated by a real
          critical-alert count. Never shown on Login (always "calm" there),
          never used to represent severity itself — see tokens.css SECOND
          AMENDMENT. A controlled, data-honest use of the brand's gold accent. */}
      {elevated && (
        <mesh renderOrder={0}>
          <sphereGeometry args={[1.45, 20, 20]} />
          <meshBasicMaterial
            color={ACCENT_WARM_COLOR}
            transparent
            opacity={0.035}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      <HolographicPlatform scaleRef={platformGroupRef} />

      {/* Persistent light beam connecting the core to the platform beneath
          it — a thin additive column, not a solid pillar, so the two pieces
          read as one system rather than a floating core over a separate
          disc. Reveals with the platform (see useFrame above); always
          present on Command Center. */}
      <mesh position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 1.85, 10, 1, true]} />
        <meshBasicMaterial
          ref={beamMatRef}
          color={CORE_COLOR}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* Two one-shot entrance pulses — cyan core-to-ring, subtler violet
          core-to-platform. Login boot only; opacity stays 0 elsewhere. */}
      {bootEntrance && (
        <>
          <mesh ref={pulse1Ref}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial ref={pulse1MatRef} color={CORE_CENTER_COLOR} transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh ref={pulse2Ref}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial ref={pulse2MatRef} color={ACCENT_SECONDARY_COLOR} transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      )}

      {/* Inner core — hollow by construction. No solid filled mesh anywhere
          in this group: a wireframe icosahedron shell, a second smaller
          wireframe shell tilted differently, two thin internal energy-line
          loops, and a faint additive glow standing in for "energy field"
          rather than "disk". */}
      <group ref={coreRef} scale={bootEntrance ? 0.82 : 1}>
        <mesh renderOrder={-1}>
          <sphereGeometry args={[0.3, 20, 20]} />
          <meshBasicMaterial
            color={CORE_CENTER_COLOR}
            transparent
            opacity={elevated ? 0.09 : 0.06}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.5, 2]} />
          <meshBasicMaterial
            color={CORE_CENTER_COLOR}
            wireframe
            transparent
            opacity={elevated ? 0.6 : 0.5}
          />
        </mesh>
        <mesh rotation={[0.3, 0.5, 0]}>
          <icosahedronGeometry args={[0.34, 1]} />
          <meshBasicMaterial color={CORE_COLOR} wireframe transparent opacity={0.35} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0.4, 0]}>
          <torusGeometry args={[0.4, 0.003, 6, 64]} />
          <meshBasicMaterial color={ACCENT_SECONDARY_COLOR} transparent opacity={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 3.1, -0.6, 0.8]}>
          <torusGeometry args={[0.46, 0.003, 6, 64]} />
          <meshBasicMaterial color={CORE_CENTER_COLOR} transparent opacity={0.22} />
        </mesh>
      </group>

      {/* Inner-ring layer — the thin luminous ring hugging the core, plus
          the innermost orbital ring. */}
      <group ref={innerRingGroupRef} scale={initialScale}>
        <mesh rotation={[Math.PI / 2.15, 0.1, 0]}>
          <torusGeometry args={[0.68, 0.006, 8, 96]} />
          <meshBasicMaterial color={CORE_CENTER_COLOR} transparent opacity={0.45} />
        </mesh>
        <mesh ref={ringInnerRef} rotation={[Math.PI / 2.1, -0.15, 0]}>
          <torusGeometry args={[1.15, 0.004, 8, 80]} />
          <meshBasicMaterial color={ACCENT_SECONDARY_COLOR} transparent opacity={0.14} />
        </mesh>
      </group>

      {/* Soft inner glow wash — additive so it reads as ambient glow, not a
          translucent disk. Breathes with the core in useFrame above. */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[0.82, 24, 24]} />
        <meshBasicMaterial
          ref={glowRef}
          color={CORE_COLOR}
          transparent
          opacity={0.05}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Geometric wireframe layer — the network/grid globe and the outer
          icosahedron shell, appearing together as "the structure". */}
      <group ref={wireGroupRef} scale={initialScale}>
        <mesh ref={globeRef}>
          <sphereGeometry args={[0.95, 28, 18]} />
          <meshBasicMaterial color={CORE_COLOR} wireframe transparent opacity={0.12} />
        </mesh>
        <mesh ref={shellRef}>
          <icosahedronGeometry args={[1.14, 1]} />
          <meshBasicMaterial color={CORE_COLOR} wireframe transparent opacity={0.2} />
        </mesh>
      </group>

      {/* Mid orbital rings. */}
      <group ref={midRingGroupRef} scale={initialScale}>
        <mesh ref={ringARef} rotation={[Math.PI / 2.3, 0.2, 0]}>
          <torusGeometry args={[1.42, 0.007, 8, 96]} />
          <meshBasicMaterial color={CORE_COLOR} transparent opacity={0.32} />
          <RingMarker radius={1.42} color={CORE_COLOR} period={6.5} />
        </mesh>
        <mesh ref={ringBRef} rotation={[Math.PI / 3.4, Math.PI / 5, 0]}>
          <torusGeometry args={[1.68, 0.005, 8, 96]} />
          <meshBasicMaterial color={ACCENT_SECONDARY_COLOR} transparent opacity={0.26} />
          <RingMarker radius={1.68} color={ACCENT_SECONDARY_COLOR} period={8} />
        </mesh>
      </group>

      {/* Outer ring — the documented ambient-depth accent (tokens.css
          --accent-secondary), one of its three approved uses. Last of the
          orbital layers to arrive during boot. */}
      <group ref={outerRingGroupRef} scale={initialScale}>
        <mesh ref={ringOuterRef} rotation={[Math.PI / 2.6, -Math.PI / 4, 0]}>
          <torusGeometry args={[1.93, 0.004, 8, 96]} />
          <meshBasicMaterial color={CORE_COLOR} transparent opacity={0.15} />
          <RingMarker radius={1.93} color={CORE_COLOR} period={10.5} />
        </mesh>
      </group>

      {/* Intelligence signal — a thin, low-opacity scanning arc travelling
          slowly around the outermost geometry. A telemetry sweep, not a
          bright beam; never obscures the core. */}
      <mesh ref={signalSweepRef} rotation={[-Math.PI / 2.3, 0.15, 0]}>
        <ringGeometry args={[2.0, 2.055, 64, 1, 0, Math.PI / 3.2]} />
        <meshBasicMaterial
          color={CORE_COLOR}
          transparent
          opacity={0.1}
          side={DoubleSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ambient particle shell + orbiting signal motes — the last layer
          in before the platform. */}
      <group ref={particleFieldGroupRef} scale={initialScale}>
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={particles.length / 3}
              array={particles}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial color={CORE_COLOR} size={0.028} transparent opacity={0.55} sizeAttenuation />
        </points>
        <OrbitingMotes count={14} radius={[0.95, 1.35]} color={CORE_COLOR} size={0.032} speed={[0.15, 0.4]} />
        <OrbitingMotes count={9} radius={[1.5, 1.9]} color={ACCENT_SECONDARY_COLOR} size={0.034} speed={[0.08, 0.22]} />
      </group>
    </group>
  );
}
