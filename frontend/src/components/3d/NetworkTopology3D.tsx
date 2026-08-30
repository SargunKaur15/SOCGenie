import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Html, Grid } from "@react-three/drei";
import { PerspectiveCamera, type Group, type Mesh } from "three";
import { AlertOctagon, Database, Laptop, Radio, Server, User } from "lucide-react";
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";
import { colorFor, ACCENT_SECONDARY_COLOR } from "../../lib/3d/socGraph";
import { buildNetworkTopology, type TopoNode, type TopoNodeKind } from "../../lib/3d/networkTopology";
import { DataPulse } from "./DataPulse";

/**
 * Login page centrepiece — the live network topology built entirely from the
 * real alert/incident queue (mocks/alertStore, mocks/incidentStore; the same
 * store the authenticated Command Center reads from). See
 * lib/3d/networkTopology.ts for the honesty contract: the compromised host is
 * the real host of the highest-risk open incident, peer hosts are real hosts
 * from the current alert queue, and an edge is only ever drawn to a host that
 * genuinely shares the incident or appears in the queue — never an invented
 * relationship.
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

const ICON: Record<TopoNodeKind, typeof Laptop> = {
  compromised: AlertOctagon,
  endpoint: Laptop,
  server: Server,
  gateway: Radio,
  storage: Database,
  user: User,
};

function PeerNode({ node }: { node: TopoNode }) {
  const ref = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = colorFor(node.severity);
  const threat = node.severity === "critical" || node.severity === "high";
  const Icon = ICON[node.kind];

  useFrame((state) => {
    const m = ref.current;
    if (!m || REDUCED_MOTION) return;
    const t = state.clock.elapsedTime;
    m.position.y = node.position[1] + Math.sin(t * 0.5 + node.position[0]) * 0.08;
    m.rotation.y = t * 0.15;
    const pulse = threat ? 1 + Math.sin(t * 2.2 + node.position[2]) * 0.08 : 1;
    m.scale.setScalar(hovered ? pulse * 1.25 : pulse);
  });

  return (
    <group position={node.position}>
      <mesh
        ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <icosahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.95 : threat ? 0.55 : 0.32}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {/* HUD ring — cyan for calm nodes, the node's own severity colour once
          it is a genuine threat, so the ring itself never overclaims. */}
      <mesh rotation-x={Math.PI / 2}>
        <ringGeometry args={[0.42, 0.46, 32]} />
        <meshBasicMaterial color={threat ? color : ACCENT_SECONDARY_COLOR} transparent opacity={threat ? 0.55 : 0.3} />
      </mesh>
      <Html distanceFactor={9} position={[0, -0.62, 0]} center zIndexRange={[10, 0]}>
        <div className="pointer-events-none flex flex-col items-center whitespace-nowrap">
          <div className="flex items-center gap-1 rounded border border-border/70 bg-bg-elevated/85 px-1.5 py-0.5 backdrop-blur-sm">
            <Icon size={9} className="text-text-secondary" aria-hidden="true" />
            <span className="mono text-[9px] font-semibold text-text-primary">{node.label}</span>
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: threat ? color : "#22c55e" }}
              aria-hidden="true"
            />
          </div>
          {hovered && <div className="mt-0.5 text-[8px] text-text-muted">{node.detail}</div>}
        </div>
      </Html>
    </group>
  );
}

/** Two to three concentric rings that expand outward from the compromised
 *  host and fade, like a detection sweep. Phase is derived from the clock
 *  modulo the period — deterministic, never Math.random(). */
function DetectionRings({ color }: { color: string }) {
  const refs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)];
  const period = 2.4;

  useFrame((state) => {
    if (REDUCED_MOTION) return;
    refs.forEach((r, i) => {
      const m = r.current;
      if (!m) return;
      const t = ((state.clock.elapsedTime + (i * period) / refs.length) % period) / period;
      const radius = 0.75 + t * 1.5;
      m.scale.setScalar(radius);
      const mat = m.material as import("three").MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.5;
    });
  });

  return (
    <>
      {refs.map((r, i) => (
        <mesh key={i} ref={r} rotation-x={Math.PI / 2}>
          <ringGeometry args={[0.96, 1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0} />
        </mesh>
      ))}
    </>
  );
}

function CompromisedNode({ node }: { node: TopoNode }) {
  const ref = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = colorFor(node.severity);

  useFrame((state) => {
    const m = ref.current;
    if (!m || REDUCED_MOTION) return;
    m.rotation.y = state.clock.elapsedTime * 0.2;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.06;
    m.scale.setScalar(hovered ? pulse * 1.1 : pulse);
  });

  return (
    <group position={node.position}>
      <DetectionRings color={color} />
      <mesh
        ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} roughness={0.3} metalness={0.2} />
      </mesh>
      <Html distanceFactor={9} position={[0, -1.05, 0]} center zIndexRange={[10, 0]}>
        <div className="pointer-events-none flex flex-col items-center whitespace-nowrap">
          <div
            className="rounded border px-2 py-1 text-center backdrop-blur-sm"
            style={{ borderColor: `${color}55`, background: "rgba(8,11,20,0.85)" }}
          >
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
              Compromised
              <br />
              Host
            </div>
            <div className="mono mt-0.5 text-[9px] text-text-secondary">{node.label}</div>
          </div>
          {hovered && <div className="mt-0.5 max-w-[160px] text-center text-[8px] text-text-muted">{node.detail}</div>}
        </div>
      </Html>
    </group>
  );
}

/** Static radar rings on the floor — decorative depth, not a data claim. */
function RadarFloor() {
  return (
    <group position={[0, -1.4, 0]}>
      {[2.4, 3.6, 4.8].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[r - 0.01, r, 64]} />
          <meshBasicMaterial color={ACCENT_SECONDARY_COLOR} transparent opacity={0.08} />
        </mesh>
      ))}
      <Grid
        args={[16, 16]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1b2740"
        sectionSize={4}
        sectionThickness={0.7}
        sectionColor="#22d3ee"
        fadeDistance={14}
        fadeStrength={1.5}
        infiniteGrid
      />
    </group>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g || REDUCED_MOTION) return;
    const { x, y } = state.pointer;
    g.rotation.y += (x * 0.18 - g.rotation.y) * 0.03;
    g.rotation.x += (-y * 0.08 - g.rotation.x) * 0.03;
  });
  return <group ref={group}>{children}</group>;
}

/** Aspect-aware camera fit, same technique as MitreMap3D's FitCamera: a
 *  static camera distance only accounts for vertical FOV, so a container
 *  narrower (or wider) than the distance was tuned for either clips the
 *  outer nodes or leaves them tiny in a sea of margin. This panel's width is
 *  driven by the surrounding page grid — a 1280px viewport gives it a much
 *  narrower box than a 1920px one — so the fit is recomputed every frame
 *  from the canvas's REAL current size, solving camera distance per real
 *  anchor point (each peer's position plus a node-radius margin, at that
 *  node's own depth) so every node stays inside frame at any panel width. */
function FitCamera({ anchors, fill = 0.82 }: { anchors: readonly [number, number, number][]; fill?: number }) {
  useFrame(({ camera, size }) => {
    if (!(camera instanceof PerspectiveCamera) || size.height === 0 || anchors.length === 0) return;
    const aspect = size.width / size.height;
    const vFov = (camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * aspect;
    let dist = 7;
    for (const [x, y, z] of anchors) {
      dist = Math.max(dist, Math.abs(x) / (fill * tanH) + z, Math.abs(y) / (fill * tanV) + z);
    }
    camera.position.set(0, dist * 0.3, dist);
    camera.lookAt(0, -0.2, 0);
    camera.updateProjectionMatrix();
  });
  return null;
}

export function NetworkTopology3D({ alerts, incidents }: { alerts: SocAlert[]; incidents: SocIncident[] }) {
  const topology = useMemo(() => buildNetworkTopology(alerts, incidents), [alerts, incidents]);
  const canRender = useMemo(webglAvailable, []);

  // Real anchor points the camera fit must guarantee stay in frame: each
  // peer's position plus its own node/ring/label footprint, and the
  // compromised host's larger detection-ring footprint at the origin.
  const anchors = useMemo<[number, number, number][]>(() => {
    const margin = 0.75;
    const pts: [number, number, number][] = topology.peers.flatMap((p) => [
      [p.position[0] - margin, p.position[1], p.position[2]],
      [p.position[0] + margin, p.position[1], p.position[2]],
      [p.position[0], p.position[1] - margin, p.position[2]],
      [p.position[0], p.position[1] + margin, p.position[2]],
    ]);
    pts.push([1.9, 0, 0], [-1.9, 0, 0], [0, 1.9, 0], [0, -1.9, 0]);
    return pts;
  }, [topology.peers]);

  if (!topology.compromised) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-border bg-[#080b14] px-4 py-6">
        <p className="text-2xs text-text-secondary">No active telemetry to visualise yet.</p>
      </div>
    );
  }

  if (!canRender) {
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 rounded-lg border border-border bg-[#080b14] px-4 py-6">
        <p className="mb-1 text-2xs text-text-secondary">
          3D visualisation is unavailable in this browser. Highest-risk host:{" "}
          <span className="mono text-text-primary">{topology.compromised.label}</span>.
        </p>
        {topology.peers.map((p) => (
          <p key={p.id} className="mono text-2xs text-text-muted">
            {p.label} · {p.severity ?? "monitored"}
          </p>
        ))}
      </div>
    );
  }

  const nodeMap = new Map<string, TopoNode>([
    [topology.compromised.id, topology.compromised],
    ...topology.peers.map((p) => [p.id, p] as const),
  ]);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-[#050810]"
      role="img"
      aria-label={`Live network topology: ${topology.compromised.label} is the highest-risk host, with ${topology.peers.length} related hosts and accounts from the current alert queue.`}
    >
      <Suspense fallback={null}>
        <Canvas
          camera={{ position: [0, 3.4, 11.5], fov: 45 }}
          dpr={[1, 1.6]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <FitCamera anchors={anchors} />
          <fog attach="fog" args={["#050810", 8, 26]} />
          <ambientLight intensity={0.55} />
          <pointLight position={[6, 7, 6]} intensity={1.1} color="#38bdf8" />
          <pointLight position={[-7, -3, -5]} intensity={0.5} color="#22d3ee" />
          <pointLight position={[0, 4, -6]} intensity={0.45} color={ACCENT_SECONDARY_COLOR} />
          <RadarFloor />
          <Rig>
            {topology.edges.map((e) => {
              const to = nodeMap.get(e.to);
              if (!to) return null;
              const color = colorFor(e.severity);
              const emphasised = e.severity === "critical" || e.severity === "high";
              return (
                <group key={e.to}>
                  <Line
                    points={[[0, 0, 0], to.position]}
                    color={color}
                    lineWidth={e.confirmed ? 1.1 : 0.7}
                    transparent
                    opacity={e.confirmed ? 0.45 : 0.22}
                  />
                  {emphasised && (
                    <DataPulse
                      from={[0, 0, 0]}
                      to={to.position}
                      color={color}
                      period={e.severity === "critical" ? 2 : 3}
                      size={0.045}
                      delay={to.position[0] + 2}
                      maxOpacity={e.confirmed ? 0.9 : 0.55}
                    />
                  )}
                </group>
              );
            })}
            <CompromisedNode node={topology.compromised} />
            {topology.peers.map((p) => (
              <PeerNode key={p.id} node={p} />
            ))}
          </Rig>
        </Canvas>
      </Suspense>
    </div>
  );
}
