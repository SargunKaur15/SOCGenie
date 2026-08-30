import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import { DoubleSide, type Mesh, type MeshBasicMaterial } from "three";
import type { SocAlert } from "../../mocks/alertStore";
import type { Severity } from "../../lib/types";
import { colorFor, CORE_COLOR } from "../../lib/3d/socGraph";

/**
 * Threat Radar — a circular holographic sweep over real alert severity data.
 *
 * Every marker is a real alert; nothing here is synthesised. Position around
 * the ring is a STABLE hash of the alert's own ref (matching the same
 * "deterministic, not-semantically-directional" layout convention
 * buildSocGraph already uses) — it is explicitly labelled as such below the
 * canvas, never presented as a real bearing. Distance from centre is real:
 * more recently detected alerts sit closer in, older ones drift outward.
 *
 * The rotating sweep is continuous ambient motion (off under reduced
 * motion). Markers brighten only as the sweep passes their real angle —
 * "detected -> pulse -> calm" — driven purely by the shared clock, no
 * fabricated "detection events".
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

/** Stable hash of a real, already-unique field (the alert ref) into an
 *  angle. Not a real bearing/location — a deterministic layout only, same
 *  honesty convention as buildSocGraph's ring() helper. */
function angleFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

interface RadarPoint {
  alert: SocAlert;
  angle: number;
  radius: number;
}

const MAX_POINTS = 18;
// Scaled ~1.6x from the original radii, with the camera pulled proportionally
// closer below, so the radar actually fills most of its canvas instead of
// sitting as a small circle in a large empty rectangle.
const MAX_RADIUS = 3.45;
const MIN_RADIUS = 0.75;
const SWEEP_SPEED = 0.45;

function layoutPoints(alerts: SocAlert[]): RadarPoint[] {
  const recent = [...alerts].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, MAX_POINTS);
  const spanMinutes = recent.length ? Math.max(...recent.map((a) => a.minutesAgo), 1) : 1;
  return recent.map((a) => ({
    alert: a,
    angle: angleFromId(a.ref),
    // Real recency drives radius: newer detections sit nearer the centre.
    radius: MIN_RADIUS + (a.minutesAgo / spanMinutes) * (MAX_RADIUS - MIN_RADIUS),
  }));
}

function currentSweepAngle(t: number): number {
  const raw = (-t * SWEEP_SPEED) % (Math.PI * 2);
  return raw < 0 ? raw + Math.PI * 2 : raw;
}

function Sweep() {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (REDUCED_MOTION || !ref.current) return;
    ref.current.rotation.z = state.clock.elapsedTime * SWEEP_SPEED;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <ringGeometry args={[0.18, MAX_RADIUS, 48, 1, 0, Math.PI / 5]} />
      <meshBasicMaterial color={CORE_COLOR} transparent opacity={0.19} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function RadarMarker({
  point, onSelect,
}: {
  point: RadarPoint;
  onSelect: (a: SocAlert) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const color = colorFor(point.alert.severity);
  const emphasised = point.alert.severity === "critical" || point.alert.severity === "high";

  useFrame((state) => {
    const m = meshRef.current;
    const mat = matRef.current;
    if (!m || !mat) return;
    if (REDUCED_MOTION) {
      m.scale.setScalar(hovered ? 1.4 : 1);
      mat.opacity = 0.6;
      return;
    }
    const t = state.clock.elapsedTime;
    let diff = Math.abs(currentSweepAngle(t) - point.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    const sweepPass = diff < 0.22 ? 1 - diff / 0.22 : 0;
    const ambient = emphasised ? 1 + Math.sin(t * 2.1) * 0.05 : 1;
    m.scale.setScalar((hovered ? 1.4 : ambient) + sweepPass * 0.45);
    mat.opacity = 0.55 + sweepPass * 0.4;
  });

  return (
    <mesh
      ref={meshRef}
      position={[Math.cos(point.angle) * point.radius, 0.03, Math.sin(point.angle) * point.radius]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(point.alert); }}
    >
      <sphereGeometry args={[0.075, 10, 10]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.55} />
      {/* Subtle glow behind critical/high markers only — severity stays the
          one thing that earns extra visual weight here. */}
      {emphasised && (
        <mesh renderOrder={-1}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
        </mesh>
      )}
      {hovered && (
        <Html distanceFactor={6.5} position={[0, 0.3, 0]} center>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-border bg-bg-elevated/95 px-2.5 py-1.5 text-[11px] text-text-primary shadow-lg">
            <div className="font-semibold">{point.alert.title}</div>
            <div className="text-text-muted">
              {point.alert.severity} · {point.alert.minutesAgo}m ago · click to open
            </div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export function ThreatRadar({
  alerts, onOpenAlert,
}: {
  alerts: SocAlert[];
  onOpenAlert: (alert: SocAlert) => void;
}) {
  const points = useMemo(() => layoutPoints(alerts), [alerts]);
  const canRender = useMemo(webglAvailable, []);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of alerts) c[a.severity] += 1;
    return c;
  }, [alerts]);

  const summary = (
    <dl className="grid grid-cols-4 gap-2 text-center">
      {SEVERITY_ORDER.map((sev) => (
        <div key={sev}>
          <dt className="text-2xs capitalize text-text-muted">{sev}</dt>
          <dd className="mono text-sm font-semibold tabular text-text-primary">{counts[sev]}</dd>
        </div>
      ))}
    </dl>
  );

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-6">
        <p className="text-2xs leading-relaxed text-text-secondary">
          No alerts to scan. The radar populates once alerts exist in the queue.
        </p>
      </div>
    );
  }

  if (!canRender) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-4">
        <p className="mb-3 text-2xs text-text-secondary">
          3D visualisation is unavailable in this browser. The same information is shown below.
        </p>
        {summary}
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative h-[280px] overflow-hidden rounded-lg border border-border bg-[#080b14]"
        role="img"
        aria-label={`Threat radar: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low severity alerts.`}
      >
        <Suspense fallback={null}>
          <Canvas camera={{ position: [0, 5.9, 4.0], fov: 42 }} dpr={[1, 1.6]} gl={{ antialias: true }}>
            <ambientLight intensity={0.6} />
            <pointLight position={[0, 5, 0]} intensity={0.8} color={CORE_COLOR} />
            {[1.05, 1.95, 2.75, MAX_RADIUS].map((r) => (
              <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[r, r + 0.008, 64]} />
                <meshBasicMaterial color={CORE_COLOR} transparent opacity={0.22} side={DoubleSide} />
              </mesh>
            ))}
            {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a) => (
              <Line
                key={a}
                points={[[0, 0, 0], [Math.cos(a) * MAX_RADIUS, 0, Math.sin(a) * MAX_RADIUS]]}
                color={CORE_COLOR}
                lineWidth={0.55}
                transparent
                opacity={0.13}
              />
            ))}
            <Sweep />
            {points.map((p) => (
              <RadarMarker key={p.alert.ref} point={p} onSelect={onOpenAlert} />
            ))}
          </Canvas>
        </Suspense>
      </div>

      <div className="mt-3">{summary}</div>
      <p className="mt-2 text-2xs leading-relaxed text-text-muted">
        Nearest to centre = most recently detected, among the {points.length} most recent of{" "}
        {alerts.length} total alerts. Position around the ring is a stable layout derived from
        each alert's own ID — not a real bearing or location.
      </p>
    </div>
  );
}
