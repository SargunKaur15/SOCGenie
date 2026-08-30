/* ---------------------------------------------------------------------------
   SOC graph derivation — shared by every 3D view.

   DATA INTEGRITY: every node comes from a real record. Nothing is synthesised.
   "Network entities" from the brief are deliberately ABSENT — SOCGenie has no
   such record type, and inventing one would be fabricated security data.

   Pure module: no React, no Three.js. Kept separate so node derivation,
   severity mapping and layout are written once and reused by SocCore3D,
   AttackPath3D and MitreMap3D rather than duplicated.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";
import type { Severity } from "../types";

export type NodeKind = "core" | "host" | "user" | "alert" | "incident" | "technique";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  severity: Severity | null;
  /** Where clicking should take the analyst. Reuses existing routes. */
  target: { page: string; ref?: string } | null;
  detail: string[];
  position: [number, number, number];
}

export interface GraphEdge {
  from: string;
  to: string;
  severity: Severity | null;
}

export interface SocGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Real counts, for the accessible text summary beside the canvas. */
  counts: Record<NodeKind, number>;
}

/** Severity → colour. One definition; the brief's palette. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#38bdf8",
  low: "#38bdf8",
};
export const NEUTRAL_COLOR = "#64748b";
export const CORE_COLOR = "#22d3ee";
/** The design system's documented ambient-depth accent (tokens.css
 *  --accent-secondary, dark value). Reserved for the outer core ring and a
 *  minority of decorative elements — never for severity or status. */
export const ACCENT_SECONDARY_COLOR = "#818cf8";
/** tokens.css --accent-warm (dark value). A controlled gold/amber brand
 *  accent, distinct from --status-medium/--status-high — reserved for the
 *  SecurityCore's real-critical-driven glow and the Login CTA. Never used
 *  to represent severity itself. */
export const ACCENT_WARM_COLOR = "#fbbf24";

export function colorFor(severity: Severity | null): string {
  return severity === null ? NEUTRAL_COLOR : SEVERITY_COLOR[severity];
}

/** Highest severity wins when several alerts share an entity. */
const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
function worst(a: Severity | null, b: Severity | null): Severity | null {
  if (a === null) return b;
  if (b === null) return a;
  return RANK[a] >= RANK[b] ? a : b;
}

/** Deterministic ring layout — same input gives the same scene every render. */
function ring(index: number, total: number, radius: number, y: number): [number, number, number] {
  const angle = total === 0 ? 0 : (index / total) * Math.PI * 2;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

/**
 * Builds the SOC graph from live application data.
 *
 * `maxPerKind` caps each ring so a large queue cannot spawn hundreds of meshes.
 * The cap is a PERFORMANCE limit, not a data claim — the accessible summary
 * always reports the true totals.
 */
export function buildSocGraph(
  alerts: SocAlert[],
  incidents: SocIncident[],
  maxPerKind = 8
): SocGraph {
  const hosts = new Map<string, Severity | null>();
  const users = new Map<string, Severity | null>();
  const techniques = new Map<string, Severity | null>();

  for (const a of alerts) {
    if (a.host) hosts.set(a.host, worst(hosts.get(a.host) ?? null, a.severity));
    if (a.user) users.set(a.user, worst(users.get(a.user) ?? null, a.severity));
    if (a.techniqueId) techniques.set(a.techniqueId, worst(techniques.get(a.techniqueId) ?? null, a.severity));
  }

  const openIncidents = incidents.filter((i) => i.status !== "resolved");

  const nodes: GraphNode[] = [
    {
      id: "core", kind: "core", label: "SOCGenie", severity: null, target: null,
      detail: [`${alerts.length} alerts`, `${openIncidents.length} open incidents`],
      position: [0, 0, 0],
    },
  ];
  const edges: GraphEdge[] = [];

  const push = (
    entries: [string, Severity | null][], kind: NodeKind, radius: number, y: number,
    target: (key: string) => GraphNode["target"], detail: (key: string) => string[]
  ) => {
    const capped = entries.slice(0, maxPerKind);
    capped.forEach(([key, sev], i) => {
      const id = `${kind}:${key}`;
      nodes.push({
        id, kind, label: key, severity: sev, target: target(key), detail: detail(key),
        position: ring(i, capped.length, radius, y),
      });
      edges.push({ from: "core", to: id, severity: sev });
    });
  };

  push([...hosts.entries()], "host", 4.2, 0.6,
    () => ({ page: "alerts" }),
    (h) => [`Host`, `${alerts.filter((a) => a.host === h).length} related alert(s)`]);

  push([...users.entries()], "user", 3.0, -1.4,
    () => ({ page: "alerts" }),
    (u) => [`Account`, `${alerts.filter((a) => a.user === u).length} related alert(s)`]);

  push([...techniques.entries()], "technique", 5.4, -0.4,
    (t) => ({ page: "mitre", ref: t }),
    (t) => [`MITRE technique`, `${alerts.filter((a) => a.techniqueId === t).length} evidenced alert(s)`]);

  push(
    alerts.slice(0, maxPerKind).map((a) => [a.ref, a.severity] as [string, Severity | null]),
    "alert", 6.4, 1.6,
    (ref) => ({ page: "alerts", ref }),
    (ref) => {
      const a = alerts.find((x) => x.ref === ref);
      return a ? [a.title, `${a.severity} · risk ${a.riskScore}/100`] : [];
    }
  );

  push(
    openIncidents.slice(0, maxPerKind).map((i) => [i.ref, i.severity] as [string, Severity | null]),
    "incident", 2.0, 2.2,
    (ref) => ({ page: "incidents", ref }),
    (ref) => {
      const i = openIncidents.find((x) => x.ref === ref);
      return i ? [i.title, `${i.status} · ${i.alertRefs.length} linked alert(s)`] : [];
    }
  );

  return {
    nodes, edges,
    counts: {
      core: 1, host: hosts.size, user: users.size,
      technique: techniques.size, alert: alerts.length, incident: openIncidents.length,
    },
  };
}
