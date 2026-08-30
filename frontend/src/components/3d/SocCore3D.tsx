import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, Html, Grid } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { AlertTriangle, Crosshair, Server, ShieldAlert, Users } from "lucide-react";
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";
import {
  ACCENT_SECONDARY_COLOR, buildSocGraph, colorFor, CORE_COLOR, type GraphNode,
} from "../../lib/3d/socGraph";
import { SecurityCore } from "./SecurityCore";
import { DataPulse } from "./DataPulse";

/**
 * SOC Core — the dashboard's 3D network view.
 *
 * Every node is derived from a real alert, incident, host, account or MITRE
 * technique. Nothing is synthesised; an empty queue renders an empty state
 * rather than decorative geometry.
 *
 * 3D is SUPPLEMENTARY. The same information is rendered as text beside the
 * canvas, so nothing is reachable only by hovering a mesh.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** WebGL probe. Failure must fall back to the 2D summary, not a blank panel. */
function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const SIZE: Record<GraphNode["kind"], number> = {
  core: 0.85, host: 0.3, user: 0.24, alert: 0.26, incident: 0.34, technique: 0.22,
};

function Node({
  node, onHover, onSelect,
}: {
  node: GraphNode;
  onHover: (n: GraphNode | null) => void;
  onSelect: (n: GraphNode) => void;
}) {
  const ref = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = node.kind === "core" ? CORE_COLOR : colorFor(node.severity);
  // Only critical and high pulse. Pulsing everything would make severity
  // meaningless, which is the opposite of the point.
  const pulses = node.severity === "critical" || node.severity === "high";

  useFrame((state) => {
    const m = ref.current;
    if (!m || REDUCED_MOTION) return;
    const t = state.clock.elapsedTime;
    // Slight float for depth, deterministic per node so it never jitters.
    m.position.y = node.position[1] + Math.sin(t * 0.6 + node.position[0]) * 0.08;
    const scale = pulses ? 1 + Math.sin(t * 2.4) * 0.09 : 1;
    m.scale.setScalar(hovered ? scale * 1.35 : scale);
  });

  return (
    <mesh
      ref={ref}
      position={node.position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); onHover(node); }}
      onPointerOut={() => { setHovered(false); onHover(null); }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(node); }}
    >
      <sphereGeometry args={[SIZE[node.kind], 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.9 : node.kind === "core" ? 0.55 : 0.3}
        roughness={0.35}
        metalness={0.1}
      />
      {hovered && (
        <Html distanceFactor={9} position={[0, SIZE[node.kind] + 0.35, 0]} center>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-border bg-bg-elevated/95 px-2 py-1 text-[10px] text-text-primary shadow-lg">
            <div className="font-semibold">{node.label}</div>
            {node.detail.map((d) => (
              <div key={d} className="text-text-muted">{d}</div>
            ))}
          </div>
        </Html>
      )}
    </mesh>
  );
}

/** Subtle parallax. Never a continuous spin — that reads as decoration. */
function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g || REDUCED_MOTION) return;
    const { x, y } = state.pointer;
    g.rotation.y += (x * 0.22 - g.rotation.y) * 0.03;
    g.rotation.x += (-y * 0.12 - g.rotation.x) * 0.03;
  });
  return <group ref={group}>{children}</group>;
}

interface CategoryBadgeSpec {
  key: string;
  label: string;
  count: number;
  icon: typeof AlertTriangle;
  color: string;
  position: [number, number, number];
  page: string;
}

/** A labelled category badge floating beside the globe — real aggregate
 *  counts from buildSocGraph (graph.counts), never per-item fabrication.
 *  Rendered as an HTML overlay anchored to a 3D point, connected to the
 *  globe by a gently curved line with its own travelling pulse. */
function CategoryBadge({ spec, onOpen }: { spec: CategoryBadgeSpec; onOpen: (page: string) => void }) {
  const Icon = spec.icon;
  const mid: [number, number, number] = [
    spec.position[0] * 0.5,
    spec.position[1] * 0.5 + 0.5,
    spec.position[2] * 0.5,
  ];
  return (
    <group>
      <Line points={[[0, 0, 0], mid, spec.position]} color={spec.color} lineWidth={0.8} transparent opacity={0.3} />
      <DataPulse from={[0, 0, 0]} to={spec.position} color={spec.color} period={4.2} size={0.03} delay={0} />
      <Html position={spec.position} center distanceFactor={9} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={() => onOpen(spec.page)}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border bg-bg-elevated/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm transition-transform duration-150 hover:scale-105"
          style={{ borderColor: `${spec.color}40` }}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${spec.color}22`, color: spec.color }}
          >
            <Icon size={12} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="text-left leading-none">
            <span className="mono block text-[11px] font-semibold text-text-primary">{spec.count}</span>
            <span className="block text-[8px] font-medium uppercase tracking-wider text-text-muted">
              {spec.label}
            </span>
          </span>
        </button>
      </Html>
    </group>
  );
}

export function SocCore3D({
  alerts, incidents, onNavigate,
}: {
  alerts: SocAlert[];
  incidents: SocIncident[];
  /** Reuses existing routing. No duplicate pages are created. */
  onNavigate: (page: string, ref?: string) => void;
}) {
  const graph = useMemo(() => buildSocGraph(alerts, incidents), [alerts, incidents]);
  const [hover, setHover] = useState<GraphNode | null>(null);
  const canRender = useMemo(webglAvailable, []);
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === "critical").length,
    [alerts]
  );

  const select = useCallback(
    (n: GraphNode) => { if (n.target) onNavigate(n.target.page, n.target.ref); },
    [onNavigate]
  );

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes]
  );

  // Five real-aggregate category badges around the globe — "Security
  // Operations Universe" composition. Counts come straight from
  // buildSocGraph; nothing here is fabricated, and a zero count still
  // renders (an honest "0", not a hidden or invented entity).
  const badges = useMemo<CategoryBadgeSpec[]>(() => {
    const at = (deg: number, radius: number, y: number): [number, number, number] => {
      const rad = (deg * Math.PI) / 180;
      return [Math.cos(rad) * radius, y, Math.sin(rad) * radius];
    };
    return [
      { key: "alert", label: "Alerts", count: graph.counts.alert, icon: AlertTriangle, color: CORE_COLOR, position: at(-55, 3.5, 1.35), page: "alerts" },
      { key: "incident", label: "Incidents", count: graph.counts.incident, icon: ShieldAlert, color: ACCENT_SECONDARY_COLOR, position: at(35, 3.7, 1.5), page: "incidents" },
      { key: "host", label: "Hosts", count: graph.counts.host, icon: Server, color: CORE_COLOR, position: at(215, 3.4, -1.2), page: "alerts" },
      { key: "user", label: "Accounts", count: graph.counts.user, icon: Users, color: ACCENT_SECONDARY_COLOR, position: at(150, 3.6, -1.4), page: "alerts" },
      { key: "technique", label: "Techniques", count: graph.counts.technique, icon: Crosshair, color: CORE_COLOR, position: at(285, 3.8, -0.6), page: "mitre" },
    ];
  }, [graph.counts]);

  const openCategory = useCallback((page: string) => onNavigate(page), [onNavigate]);

  // Text summary — rendered ALWAYS, so the 3D view is never the only path to
  // this information (accessibility, and the WebGL-unavailable case).
  const summary = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
      {([
        ["Alerts", graph.counts.alert], ["Open incidents", graph.counts.incident],
        ["Hosts", graph.counts.host], ["Accounts", graph.counts.user],
        ["Techniques", graph.counts.technique],
      ] as [string, number][]).map(([label, n]) => (
        <div key={label}>
          <dt className="text-2xs text-text-muted">{label}</dt>
          <dd className="mono text-sm font-semibold tabular text-text-primary">{n}</dd>
        </div>
      ))}
    </dl>
  );

  if (alerts.length === 0 && incidents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-6">
        <p className="text-2xs leading-relaxed text-text-secondary">
          No network relationships available. Upload a log file in Log Explorer to populate the
          SOC view.
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
        className="relative h-[340px] overflow-hidden rounded-lg border border-border bg-[#080b14]"
        role="img"
        aria-label={`Security Operations Universe: ${graph.counts.alert} alerts, ${graph.counts.incident} open incidents, ${graph.counts.host} hosts, ${graph.counts.user} accounts, ${graph.counts.technique} techniques.`}
      >
        <Suspense fallback={null}>
          <Canvas
            camera={{ position: [0, 3.2, 12], fov: 46 }}
            // Capped so a high-DPI display does not quadruple the pixel cost.
            dpr={[1, 1.6]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <fog attach="fog" args={["#080b14", 9, 21]} />
            <ambientLight intensity={0.55} />
            <pointLight position={[6, 8, 6]} intensity={1.1} color="#38bdf8" />
            <pointLight position={[-8, -4, -6]} intensity={0.5} color="#22d3ee" />
            {/* Violet rim light — pairs with the ring/atmosphere accent so the
                lighting itself carries the cyan+violet identity, not just geometry. */}
            <pointLight position={[-3, 5, -9]} intensity={0.4} color={ACCENT_SECONDARY_COLOR} />
            <Grid
              position={[0, -3.1, 0]}
              args={[10, 10]}
              cellSize={1}
              cellThickness={0.4}
              cellColor="#1b2740"
              sectionSize={4}
              sectionThickness={0.7}
              sectionColor="#22d3ee"
              fadeDistance={18}
              fadeStrength={1.4}
              infiniteGrid
            />
            <Rig>
              {graph.edges.map((e, i) => {
                const from = nodeMap.get(e.from);
                const to = nodeMap.get(e.to);
                if (!from || !to) return null;
                // Only critical/high edges carry a travelling pulse — the same
                // "stronger emphasis for real severity, calm otherwise" rule
                // the nodes already follow, kept from becoming visual noise.
                const emphasised = e.severity === "critical" || e.severity === "high";
                return (
                  <group key={`${e.from}->${e.to}`}>
                    <Line
                      points={[from.position, to.position]}
                      color={colorFor(e.severity)}
                      lineWidth={0.7}
                      transparent
                      opacity={0.28}
                    />
                    {emphasised && (
                      <DataPulse
                        from={from.position}
                        to={to.position}
                        color={colorFor(e.severity)}
                        period={e.severity === "critical" ? 2.1 : 3.2}
                        delay={(i % 5) * 0.5}
                      />
                    )}
                  </group>
                );
              })}
              <SecurityCore intensity={criticalCount > 0 ? "elevated" : "calm"} particleCount={120} />
              {graph.nodes.filter((n) => n.kind !== "core").map((n) => (
                <Node key={n.id} node={n} onHover={setHover} onSelect={select} />
              ))}
              {badges.map((b) => (
                <CategoryBadge key={b.key} spec={b} onOpen={openCategory} />
              ))}
            </Rig>
          </Canvas>
        </Suspense>

        {hover && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-border bg-bg-elevated/95 px-2.5 py-1.5">
            <p className="text-2xs font-semibold text-text-primary">{hover.label}</p>
            <p className="text-2xs text-text-muted">
              {hover.kind}
              {hover.severity ? ` · ${hover.severity}` : ""}
              {hover.target ? " · click to open" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3">{summary}</div>
      <p className="mt-2 text-2xs leading-relaxed text-text-muted">
        Derived from the current alert and incident queue. Rings are capped at eight nodes each for
        performance; the counts above are the true totals.
      </p>
    </div>
  );
}
