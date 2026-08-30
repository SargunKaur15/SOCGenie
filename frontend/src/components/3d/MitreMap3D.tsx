import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import { DoubleSide, PerspectiveCamera, type Group, type Mesh, type MeshBasicMaterial } from "three";
import type { MitreTechnique } from "../../lib/types";
import { ACCENT_SECONDARY_COLOR, CORE_COLOR, NEUTRAL_COLOR } from "../../lib/3d/socGraph";
import { DataPulse } from "./DataPulse";

/** Stable hash of a real, already-unique id (technique_id / tactic name)
 *  into [0,1) — deterministic stagger, never Math.random() (which would
 *  reshuffle timing on every re-render/navigation). */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * MITRE technique map — a supplementary 3D layer: a spatial "tactical
 * matrix". Each tactic is a holographic zone arranged along a shallow arc
 * (the real kill-chain order the page already uses); techniques cluster
 * inside their zone rather than stacking in a single column of tiny dots.
 *
 * The existing technique list stays exactly as it is; this sits alongside
 * it. Observed techniques (observed_count > 0) are highlighted with a pulse
 * from their zone's hub; unobserved ones are dimmed rather than hidden —
 * absence of evidence is information, and removing them would misrepresent
 * coverage. No technique-to-technique relationship is drawn — the data
 * model doesn't establish one; only the real "belongs to this tactic" and
 * "this tactic precedes that one" facts are visualised.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const OBSERVED_COLOR = "#f59e0b";

interface Zone {
  tactic: string;
  center: [number, number, number];
  panelColor: string;
}

interface Placed {
  technique: MitreTechnique;
  observed: boolean;
  position: [number, number, number];
  zoneIndex: number;
}

/** Tactics arranged along a shallow arc that bows away from the camera at
 *  the edges — reads as a spatial "attack surface" rather than a flat row.
 *  Techniques cluster in a compact local grid inside their zone instead of
 *  a single column, so a tactic with several techniques doesn't read as a
 *  thin line of dots. Deterministic — no layout jitter. */
function layout(techniques: MitreTechnique[], tacticOrder: readonly string[]): {
  placed: Placed[];
  zones: Zone[];
} {
  const present = tacticOrder.filter((t) => techniques.some((m) => m.tactic === t));
  const n = present.length;
  const spreadDeg = Math.min(160, Math.max(40, n * 18));
  // Radius grows with tactic count so zone labels get enough physical
  // separation to stay readable instead of overlapping (the exact problem
  // the flat single-row layout had before this redesign). Scaled up ~1.4x
  // from the original values so the whole matrix reads as the page's main
  // visualization rather than a small cluster in a large empty panel.
  const radius = 7.8 + n * 0.59;

  const zones: Zone[] = present.map((tactic, i) => {
    const angleDeg = n <= 1 ? 0 : -spreadDeg / 2 + (i / (n - 1)) * spreadDeg;
    const angle = (angleDeg * Math.PI) / 180;
    const x = Math.sin(angle) * radius;
    const z = -(1 - Math.cos(angle)) * radius;
    return {
      tactic,
      center: [x, 0, z],
      panelColor: i % 3 === 1 ? ACCENT_SECONDARY_COLOR : CORE_COLOR,
    };
  });

  const placed: Placed[] = [];
  zones.forEach((zone, zi) => {
    const inTactic = techniques.filter((m) => m.tactic === zone.tactic);
    const cols = inTactic.length > 3 ? 2 : 1;
    const rowSpan = 1.05;
    const colSpan = 0.95;
    const rows = Math.ceil(inTactic.length / cols);
    const rowOffset = ((rows - 1) * rowSpan) / 2;
    inTactic.forEach((technique, ri) => {
      const col = ri % cols;
      const row = Math.floor(ri / cols);
      const localX = (col - (cols - 1) / 2) * colSpan;
      const localY = rowOffset - row * rowSpan;
      placed.push({
        technique,
        observed: (technique.observed_count ?? 0) > 0,
        position: [zone.center[0] + localX, localY, zone.center[2]],
        zoneIndex: zi,
      });
    });
  });

  return { placed, zones };
}

/** The faint holographic backdrop and border for one tactic's zone —
 *  gives each cluster a visible "frame" instead of floating in empty space.
 *  Breathes extremely subtly (scale ~0.995-1.005) on its own period so
 *  zones don't all pulse in lockstep. */
function ZonePanel({ zone, highlighted }: { zone: Zone; highlighted: boolean }) {
  const groupRef = useRef<Group>(null);
  const ringMatRef = useRef<MeshBasicMaterial>(null);
  const period = useMemo(() => 6 + hash01(zone.tactic) * 4, [zone.tactic]);
  const phase = useMemo(() => hash01(zone.tactic) * Math.PI * 2, [zone.tactic]);

  useFrame((state) => {
    if (REDUCED_MOTION) return;
    const t = state.clock.elapsedTime;
    const wave = Math.sin((t / period) * Math.PI * 2 + phase);
    if (groupRef.current) groupRef.current.scale.setScalar(1 + wave * 0.005);
    // A technique being hovered gives its own zone a subtle, immediate lift
    // on top of the ambient breathing — not a separate animated ramp.
    if (ringMatRef.current) ringMatRef.current.opacity = (highlighted ? 0.5 : 0.32) + wave * 0.05;
  });

  return (
    <group ref={groupRef} position={zone.center}>
      <mesh renderOrder={-1}>
        <circleGeometry args={[1.9, 32]} />
        <meshBasicMaterial color={zone.panelColor} transparent opacity={0.04} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[1.87, 1.9, 48]} />
        <meshBasicMaterial ref={ringMatRef} color={zone.panelColor} transparent opacity={0.32} side={DoubleSide} />
      </mesh>
      {/* Hub — the zone's own anchor point; spokes and pulses originate here. */}
      <mesh>
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshBasicMaterial color={zone.panelColor} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

const DETECT_CYCLE = 4.5;
const DETECT_ACTIVE = 1.6;
const CLICK_RING_DURATION = 0.6;

function TechniqueNode({
  item, selected, hovered, onSelect, onHoverChange,
}: {
  item: Placed;
  selected: boolean;
  /** Hover now lives in the parent, not local state — the connection line
   *  and the zone panel both need to react to it too. */
  hovered: boolean;
  onSelect: (p: Placed) => void;
  onHoverChange: (id: string | null) => void;
}) {
  const ref = useRef<Mesh>(null);
  const detectRingRef = useRef<Mesh>(null);
  const detectMatRef = useRef<MeshBasicMaterial>(null);
  const clickRingRef = useRef<Mesh>(null);
  const clickMatRef = useRef<MeshBasicMaterial>(null);
  const clickStartRef = useRef(-100);
  const elapsedRef = useRef(0);
  const color = item.observed ? OBSERVED_COLOR : NEUTRAL_COLOR;
  const phaseOffset = useMemo(() => hash01(item.technique.technique_id) * DETECT_CYCLE, [item.technique.technique_id]);

  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    elapsedRef.current = t;

    if (REDUCED_MOTION) {
      m.scale.setScalar(hovered || selected ? 1.35 : 1);
    } else {
      // Ambient float/breathe — present on every node (subtler when
      // unobserved), plus the existing severity-of-evidence pulse.
      const floatY = Math.sin(t * 0.5 + item.position[0]) * (item.observed ? 0.02 : 0.035);
      m.position.y = item.position[1] + floatY;
      const pulse = item.observed ? 1 + Math.sin(t * 1.8 + item.position[0]) * 0.08 : 1 + Math.sin(t * 0.4 + item.position[0]) * 0.02;
      m.scale.setScalar(hovered || selected ? pulse * 1.35 : pulse);

      // Detection ring — observed techniques only, slow autonomous repeat:
      // small glow -> expanding ring -> fade, then calm until the next cycle.
      if (item.observed && detectRingRef.current && detectMatRef.current) {
        const local = (t + phaseOffset) % DETECT_CYCLE;
        if (local < DETECT_ACTIVE) {
          const p = local / DETECT_ACTIVE;
          detectRingRef.current.scale.setScalar(1 + p * 0.08);
          detectMatRef.current.opacity = 0.7 * (1 - p);
        } else {
          detectMatRef.current.opacity = 0;
        }
      }

      // Click ring — one-shot expanding pulse from the moment of selection,
      // for whichever technique is currently selected (observed or not).
      if (selected && clickRingRef.current && clickMatRef.current) {
        const since = t - clickStartRef.current;
        if (since >= 0 && since < CLICK_RING_DURATION) {
          const p = since / CLICK_RING_DURATION;
          clickRingRef.current.scale.setScalar(1 + p * 0.35);
          clickMatRef.current.opacity = 0.6 * (1 - p);
        } else if (clickMatRef.current.opacity !== 0) {
          clickMatRef.current.opacity = 0;
        }
      }
    }
  });

  return (
    <mesh
      ref={ref}
      position={item.position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHoverChange(item.technique.technique_id); }}
      onPointerOut={() => onHoverChange(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        clickStartRef.current = elapsedRef.current;
        onSelect(item);
      }}
    >
      <octahedronGeometry args={[0.78, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={selected ? 1.0 : item.observed ? 0.55 : 0.16}
        roughness={0.4}
        transparent
        opacity={item.observed ? 1 : 0.5}
      />

      {/* Detection ring — observed techniques only, autonomous slow repeat. */}
      {item.observed && !REDUCED_MOTION && (
        <mesh ref={detectRingRef}>
          <sphereGeometry args={[0.93, 12, 12]} />
          <meshBasicMaterial ref={detectMatRef} color={color} wireframe transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Click ring — one-shot on selection, any technique. */}
      {!REDUCED_MOTION && (
        <mesh ref={clickRingRef}>
          <sphereGeometry args={[0.99, 14, 14]} />
          <meshBasicMaterial ref={clickMatRef} color={color} wireframe transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {(hovered || selected) && (
        <Html distanceFactor={7.2} position={[0, 0.85, 0]} center>
          <div
            className={`pointer-events-none whitespace-nowrap rounded-md border bg-bg-elevated/95 px-2.5 py-1.5 text-[11px] shadow-lg transition-colors ${
              hovered ? "border-accent/50" : "border-border"
            }`}
          >
            <div className="mono font-semibold text-accent">{item.technique.technique_id}</div>
            <div className="text-text-primary">{item.technique.name}</div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g || REDUCED_MOTION) return;
    g.rotation.y += (state.pointer.x * 0.14 - g.rotation.y) * 0.04;
    g.rotation.x += (-state.pointer.y * 0.06 - g.rotation.x) * 0.04;
  });
  return <group ref={group}>{children}</group>;
}

/** The actual fix for "huge empty canvas, tiny map in the middle": a fixed
 *  camera distance only accounts for vertical FOV, so on a WIDE panel
 *  (this one is roughly 2:1) there's large unused horizontal margin no
 *  matter how big the scene geometry is — the horizontal FOV at any given
 *  distance is `verticalFOV` stretched by the aspect ratio, so a wide
 *  canvas sees much more world-space width than height at the same
 *  distance. This recomputes camera distance every frame from the REAL
 *  canvas width/height so the map's actual horizontal extent fills a
 *  consistent fraction of the frame at any viewport — 1920x1080, a laptop,
 *  a narrower panel, all correctly, instead of one static guess.
 *
 *  A flat "treat every point as if it were at z=0" version of this still
 *  under-fills: the zone arc is a literal circle (x = sin(a)*r, z =
 *  -(1-cos(a))*r), so the outer tactic zones don't just sit wider in x —
 *  they also recede in z, further from the camera, which shrinks their
 *  projected size again on top of the horizontal spread. Ignoring that
 *  recession makes the fit formula overestimate how big the edges will
 *  render, so it leaves margin the spec doesn't want. Each anchor below
 *  carries its own real (x, y, z), and the distance is solved per-anchor
 *  so every one of them — first/last tactic included — lands at or inside
 *  the target fill fraction, whichever anchor is most demanding. */
function FitCamera({
  anchors,
  fillX = 0.8,
  fillY = 0.62,
}: {
  anchors: readonly [number, number, number][];
  fillX?: number;
  fillY?: number;
}) {
  useFrame(({ camera, size }) => {
    if (!(camera instanceof PerspectiveCamera) || size.height === 0 || anchors.length === 0) return;
    const aspect = size.width / size.height;
    const vFov = (camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * aspect;
    let dist = 6;
    for (const [x, y, z] of anchors) {
      // Solve x/(dist - z) = fillX*tanH for dist (and the y analogue) —
      // the camera distance at which this specific anchor, at its own
      // depth, projects to exactly the target fraction of the frame.
      dist = Math.max(dist, Math.abs(x) / (fillX * tanH) + z, Math.abs(y) / (fillY * tanV) + z);
    }
    camera.position.set(0, dist * 0.16, dist);
    camera.lookAt(0, 0.1, 0);
    camera.updateProjectionMatrix();
  });
  return null;
}

export function MitreMap3D({
  techniques, tacticOrder,
}: {
  techniques: MitreTechnique[];
  /** Passed in so the 3D zone order matches the list exactly. */
  tacticOrder: readonly string[];
}) {
  const { placed, zones } = useMemo(
    () => layout(techniques, tacticOrder),
    [techniques, tacticOrder]
  );
  const [selected, setSelected] = useState<Placed | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const canRender = useMemo(webglAvailable, []);

  const observedCount = placed.filter((p) => p.observed).length;
  // The real points the camera fit has to guarantee fit in frame: each
  // zone's left/right panel edge (real x, at that zone's own real z) and
  // its top/bottom real extent (tactic label / floor path, same z) — not a
  // tactic-count guess, so first/last tactic zones are inside frame by
  // construction, at their true depth, at any viewport.
  const anchors = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    const edge = 2.4; // zone panel radius (1.9) + node-cluster/margin
    zones.forEach(({ center: [x, , z] }) => {
      pts.push([x - edge, 0, z], [x + edge, 0, z], [x, 2.5, z], [x, -1.7, z]);
    });
    return pts;
  }, [zones]);

  if (techniques.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-4">
        <p className="text-2xs text-text-secondary">
          No techniques loaded, so no technique map can be drawn.
        </p>
      </div>
    );
  }

  if (!canRender) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-4">
        <p className="text-2xs leading-relaxed text-text-secondary">
          3D visualisation is unavailable in this browser. The full technique list below is
          unaffected — {observedCount} of {techniques.length} techniques have observed evidence.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative h-[62vh] min-h-[480px] max-h-[680px] overflow-hidden rounded-lg border border-border bg-[#080b14]"
        role="img"
        aria-label={`MITRE technique map: ${techniques.length} techniques across ${zones.length} tactics, ${observedCount} with observed evidence.`}
      >
        <Suspense fallback={null}>
          <Canvas camera={{ position: [0, 4, 22], fov: 44 }} dpr={[1, 1.6]} gl={{ antialias: true }}>
            {/* Recomputes camera distance every frame from the canvas's REAL
                current aspect ratio, so the map fills the frame correctly at
                any viewport instead of leaving huge margins on wide panels. */}
            <FitCamera anchors={anchors} />
            <fog attach="fog" args={["#080b14", 22, 72]} />
            <ambientLight intensity={0.6} />
            <pointLight position={[0, 6, 9]} intensity={0.9} color={CORE_COLOR} />
            <pointLight position={[-6, 3, -4]} intensity={0.4} color={ACCENT_SECONDARY_COLOR} />
            <Rig>
              {/* Kill-chain progression — the REAL, documented tactic order the
                  page already uses, drawn as a floor path beneath the zones
                  rather than a line cutting through the technique nodes. */}
              {zones.slice(0, -1).map((z, i) => {
                const a: [number, number, number] = [z.center[0], -1.7, z.center[2]];
                const b: [number, number, number] = [zones[i + 1].center[0], -1.7, zones[i + 1].center[2]];
                return (
                  <group key={z.tactic}>
                    <Line points={[a, b]} color={CORE_COLOR} lineWidth={1.0} transparent opacity={0.26} />
                    <DataPulse
                      from={a}
                      to={b}
                      color={CORE_COLOR}
                      period={2.6 + hash01(z.tactic) * 0.6}
                      size={0.035}
                      delay={hash01(z.tactic) * 3}
                    />
                  </group>
                );
              })}

              {zones.map((zone) => {
                const inZone = placed.filter((p) => p.zoneIndex === zones.indexOf(zone));
                const zoneHighlighted = inZone.some((p) => p.technique.technique_id === hoveredId);
                return (
                  <group key={zone.tactic}>
                    <ZonePanel zone={zone} highlighted={zoneHighlighted} />
                    {/* Spokes — a technique's real membership in this tactic,
                        not a fabricated technique-to-technique relationship.
                        Every spoke carries a travelling pulse — staggered by
                        a stable hash of the technique's own ID, never
                        Math.random() — brighter/larger for observed evidence,
                        faint for unobserved so the map still feels alive
                        without implying activity that isn't there. Hovering
                        the technique brightens its own line immediately. */}
                    {inZone.map((p) => {
                      const seed = hash01(p.technique.technique_id);
                      const isHovered = hoveredId === p.technique.technique_id;
                      const baseOpacity = p.observed ? 0.45 : 0.18;
                      return (
                        <group key={p.technique.technique_id}>
                          <Line
                            points={[zone.center, p.position]}
                            color={p.observed ? OBSERVED_COLOR : NEUTRAL_COLOR}
                            lineWidth={isHovered ? (p.observed ? 1.9 : 1.5) : (p.observed ? 1.1 : 0.75)}
                            transparent
                            opacity={isHovered ? Math.min(1, baseOpacity + 0.45) : baseOpacity}
                          />
                          <DataPulse
                            from={zone.center}
                            to={p.position}
                            color={p.observed ? OBSERVED_COLOR : NEUTRAL_COLOR}
                            period={2.2 + seed * 0.8}
                            size={p.observed ? 0.032 : 0.02}
                            delay={seed * 3}
                            maxOpacity={p.observed ? 0.85 : 0.35}
                          />
                        </group>
                      );
                    })}
                    <Html position={[zone.center[0], 2.5, zone.center[2]]} center distanceFactor={7.2}>
                      <div className="pointer-events-none w-[104px] rounded-lg border border-border bg-bg-elevated/90 px-2.5 py-1.5 text-center text-[10.5px] font-semibold uppercase leading-tight tracking-wide text-text-secondary shadow-lg backdrop-blur-sm">
                        {zone.tactic}
                      </div>
                    </Html>
                  </group>
                );
              })}

              {placed.map((p) => (
                <TechniqueNode
                  key={p.technique.technique_id}
                  item={p}
                  selected={selected?.technique.technique_id === p.technique.technique_id}
                  hovered={hoveredId === p.technique.technique_id}
                  onSelect={setSelected}
                  onHoverChange={setHoveredId}
                />
              ))}
            </Rig>
          </Canvas>
        </Suspense>
      </div>

      {selected && (
        <div className="mt-2 rounded-md border border-border bg-bg-elevated px-3 py-2.5">
          <p className="text-[13px]">
            <span className="mono font-semibold text-accent">{selected.technique.technique_id}</span>{" "}
            <span className="text-text-primary">{selected.technique.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {selected.technique.tactic} ·{" "}
            {selected.observed
              ? `${selected.technique.observed_count} observed in the current data`
              : "no evidence observed"}
          </p>
        </div>
      )}

      <p className="mt-2 text-2xs leading-relaxed text-text-muted">
        Amber marks techniques with observed evidence ({observedCount} of {techniques.length}).
        Dimmed techniques are mapped but unobserved — shown rather than hidden, because absent
        evidence is itself information. Zones follow the real ATT&CK tactic order; the floor path
        below them reflects that same order, not a fabricated attack sequence. Full detail remains
        in the list below.
      </p>
    </div>
  );
}
