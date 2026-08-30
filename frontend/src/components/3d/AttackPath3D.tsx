import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import type { Group, Mesh } from "three";
import type { SocAlert } from "../../mocks/alertStore";
import { colorFor, CORE_COLOR, NEUTRAL_COLOR } from "../../lib/3d/socGraph";
import { DataPulse } from "./DataPulse";

/**
 * Attack path — the investigation's 3D relationship chain.
 *
 * Every stage is built from evidence the alert ACTUALLY carries. A stage with
 * no supporting field is omitted, not filled with a placeholder: an invented
 * link between an account and a process would be fabricated security data.
 *
 * The chain is a sequence, not a graph, because SocAlert records a single
 * detection rather than a traversal. Presenting it as a branching graph would
 * imply relationships the data does not establish.
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

interface Stage {
  id: string;
  kind: string;
  label: string;
  /** The evidence field this stage was derived from. Shown on click. */
  source: string;
  position: [number, number, number];
}

/** Reads a value from the alert's evidence array by label prefix. */
function evidence(alert: SocAlert, prefix: string): string | null {
  const hit = alert.evidence.find((e) => e.label.toLowerCase().startsWith(prefix.toLowerCase()));
  return hit && hit.value.trim() !== "" ? hit.value : null;
}

/**
 * Builds the chain from real fields only.
 *
 * Order follows the attack narrative: who → where → what ran → what was
 * gained → how it maps → where it went.
 */
function buildChain(alert: SocAlert | null): Stage[] {
  if (!alert) return [];

  const candidates: { kind: string; label: string | null; source: string }[] = [
    { kind: "Account", label: alert.user, source: "alert.user" },
    { kind: "Source", label: alert.sourceIp || null, source: "alert.sourceIp" },
    { kind: "Host", label: alert.host || null, source: "alert.host" },
    { kind: "Process", label: evidence(alert, "process"), source: "evidence: Process" },
    { kind: "Privilege", label: evidence(alert, "privilege"), source: "evidence: Privilege" },
    { kind: "Technique", label: alert.techniqueId, source: "alert.techniqueId" },
    { kind: "Destination", label: alert.destinationIp, source: "alert.destinationIp" },
  ];

  const present = candidates.filter(
    (c): c is { kind: string; label: string; source: string } => c.label !== null
  );

  // Vertical chain, evenly spaced and centred regardless of length.
  const span = 1.9;
  const offset = ((present.length - 1) * span) / 2;
  return present.map((c, i) => ({
    id: `${c.kind}:${c.label}`,
    kind: c.kind,
    label: c.label,
    source: c.source,
    position: [0, offset - i * span, 0] as [number, number, number],
  }));
}

function StageNode({
  stage, color, selected, onSelect,
}: {
  stage: Stage;
  color: string;
  selected: boolean;
  onSelect: (s: Stage) => void;
}) {
  const ref = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const m = ref.current;
    if (!m || REDUCED_MOTION) return;
    m.rotation.y = state.clock.elapsedTime * 0.25;
    m.scale.setScalar(hovered || selected ? 1.25 : 1);
  });

  return (
    <mesh
      ref={ref}
      position={stage.position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(stage); }}
    >
      <boxGeometry args={[0.62, 0.62, 0.62]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={selected ? 0.95 : hovered ? 0.7 : 0.28}
        roughness={0.4}
        metalness={0.15}
      />
      <Html distanceFactor={10} position={[1.15, 0, 0]}>
        <div className="pointer-events-none whitespace-nowrap">
          <div className="text-[10px] font-semibold text-text-primary">{stage.label}</div>
          <div className="text-[9px] text-text-muted">{stage.kind}</div>
        </div>
      </Html>
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g || REDUCED_MOTION) return;
    g.rotation.y += (state.pointer.x * 0.3 - g.rotation.y) * 0.04;
  });
  return <group ref={group}>{children}</group>;
}

export function AttackPath3D({ alert }: { alert: SocAlert | null }) {
  const chain = useMemo(() => buildChain(alert), [alert]);
  const [selected, setSelected] = useState<Stage | null>(null);
  const canRender = useMemo(webglAvailable, []);
  const color = alert ? colorFor(alert.severity) : NEUTRAL_COLOR;

  // Always rendered, so the chain is never available only in 3D.
  const textChain = (
    <ol className="space-y-1">
      {chain.map((s, i) => (
        <li key={s.id} className="text-2xs leading-relaxed text-text-secondary">
          <span className="mono mr-1.5 text-text-muted">{i + 1}.</span>
          <span className="font-medium text-text-primary">{s.kind}</span> {s.label}
          <span className="ml-1.5 text-text-muted">({s.source})</span>
        </li>
      ))}
    </ol>
  );

  if (!alert) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-4">
        <p className="text-2xs text-text-secondary">
          Select an investigation to see its attack path.
        </p>
      </div>
    );
  }

  if (chain.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-4">
        <p className="text-2xs leading-relaxed text-text-secondary">
          No network relationships available for {alert.ref}. This alert carries{" "}
          {chain.length === 0 ? "no" : "only one"} linkable entity, so no path can be drawn.
        </p>
        {chain.length === 1 && <div className="mt-2">{textChain}</div>}
      </div>
    );
  }

  if (!canRender) {
    return (
      <div className="rounded-lg border border-border bg-bg-elevated px-4 py-4">
        <p className="mb-2 text-2xs text-text-secondary">
          3D visualisation is unavailable in this browser. The attack path is shown below.
        </p>
        {textChain}
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative h-[320px] overflow-hidden rounded-lg border border-border bg-[#080b14]"
        role="img"
        aria-label={`Attack path for ${alert.ref}: ${chain.map((s) => `${s.kind} ${s.label}`).join(", then ")}.`}
      >
        <Suspense fallback={null}>
          <Canvas camera={{ position: [4.5, 0, 9], fov: 44 }} dpr={[1, 1.6]} gl={{ antialias: true }}>
            <ambientLight intensity={0.6} />
            <pointLight position={[5, 6, 5]} intensity={1} color={CORE_COLOR} />
            <Rig>
              {chain.slice(0, -1).map((s, i) => (
                <group key={`${s.id}->`}>
                  <Line
                    points={[s.position, chain[i + 1].position]}
                    color={color}
                    lineWidth={1.1}
                    transparent
                    opacity={0.4}
                  />
                  {/* Staggered delay so the pulse reads as one signal
                      cascading down the attack narrative, not independent
                      blinking on every segment. */}
                  <DataPulse
                    from={s.position}
                    to={chain[i + 1].position}
                    color={color}
                    period={2.4}
                    delay={i * 0.4}
                  />
                </group>
              ))}
              {chain.map((s) => (
                <StageNode
                  key={s.id}
                  stage={s}
                  color={color}
                  selected={selected?.id === s.id}
                  onSelect={setSelected}
                />
              ))}
            </Rig>
          </Canvas>
        </Suspense>
      </div>

      {selected && (
        <p className="mt-2 text-2xs text-text-secondary">
          <span className="font-medium text-text-primary">{selected.kind}</span> {selected.label} —
          read from <span className="mono">{selected.source}</span>
        </p>
      )}

      <div className="mt-3">{textChain}</div>
      <p className="mt-2 text-2xs text-text-muted">
        Stages are built only from fields this alert carries. Missing stages are omitted rather
        than inferred.
      </p>
    </div>
  );
}
