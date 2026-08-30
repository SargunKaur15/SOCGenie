/* ---------------------------------------------------------------------------
   Network topology derivation for the Login page's "Live Security Telemetry"
   visualization.

   DATA INTEGRITY: every node is a real host, account or gateway that appears
   on a real alert or incident in the current queue (mocks/alertStore,
   mocks/incidentStore — the same store the Command Center and Alerts
   workspace read from). Nothing here is synthesised, and no host-to-host
   relationship is drawn unless it is directly evidenced:
     - "compromised" is the host of the highest-severity OPEN incident, never
       a decorative label on an arbitrary node.
     - an edge from the compromised host to another asset is drawn only when
       that asset appears on the SAME incident (a real correlation), or, for
       the remaining slots, as a "also on the monitored network" membership
       edge to another host with its own real alert — never presented as an
       attack path between them.

   Pure module: no React, no Three.js. Mirrors lib/3d/socGraph.ts's
   conventions (deterministic layout, worst-severity aggregation) so every 3D
   view in the app derives real-data scenes the same way.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";
import type { Severity } from "../types";

export type TopoNodeKind = "compromised" | "endpoint" | "server" | "gateway" | "storage" | "user";

export interface TopoNode {
  id: string;
  label: string;
  kind: TopoNodeKind;
  severity: Severity | null;
  alertCount: number;
  /** Real detail shown on hover/label — never fabricated. */
  detail: string;
  position: [number, number, number];
}

export interface TopoEdge {
  to: string;
  /** Whether this edge is a same-incident correlation (stronger, real) or a
   *  looser "also on the monitored network" membership edge. */
  confirmed: boolean;
  severity: Severity | null;
}

export interface NetworkTopology {
  compromised: TopoNode | null;
  peers: TopoNode[];
  edges: TopoEdge[];
}

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const worst = (a: Severity | null, b: Severity): Severity => (a === null || RANK[b] > RANK[a] ? b : a);

/** Icon/geometry family from the real naming convention already present in
 *  the seed data (WS- workstation, SRV- server, AUTH-GW/VPN-EDGE/GW-
 *  gateway, BACKUP- storage). Never invented — a host that matches nothing
 *  falls back to a generic endpoint reading, not a wrong specific claim. */
function kindFor(host: string): TopoNodeKind {
  if (/^(AUTH-GW|VPN-EDGE|GW-)/i.test(host)) return "gateway";
  if (/^BACKUP/i.test(host)) return "storage";
  if (/^SRV-/i.test(host)) return "server";
  return "endpoint";
}

/** Even ring layout with a small deterministic height stagger (no
 *  Math.random()) so peers read as an organic cluster rather than a flat
 *  disc, matching the pointer-parallax scenes used elsewhere in the app. */
function ring(index: number, total: number, radius: number): [number, number, number] {
  const angle = total === 0 ? 0 : (index / total) * Math.PI * 2 - Math.PI / 2;
  const y = Math.sin(index * 1.9) * 0.55;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

export function buildNetworkTopology(alerts: SocAlert[], incidents: SocIncident[]): NetworkTopology {
  if (alerts.length === 0) return { compromised: null, peers: [], edges: [] };

  // Per-host aggregate from the real alert queue.
  const hostAgg = new Map<string, { severity: Severity; count: number }>();
  for (const a of alerts) {
    const prev = hostAgg.get(a.host);
    hostAgg.set(a.host, { severity: worst(prev?.severity ?? null, a.severity), count: (prev?.count ?? 0) + 1 });
  }

  // The compromised host: the host of the highest-risk ACTIVELY open
  // incident — "new" or "investigating", i.e. genuinely still unresolved,
  // not one that has already been contained. Falls back to any non-resolved
  // incident, then any incident, so the label is never applied to nothing
  // real — but a currently-contained host never outranks a truly live one
  // just because its historical risk score was higher.
  const activelyOpen = incidents.filter((i) => i.status === "new" || i.status === "investigating");
  const notResolved = incidents.filter((i) => i.status !== "resolved");
  const pool = activelyOpen.length > 0 ? activelyOpen : notResolved.length > 0 ? notResolved : incidents;
  const topIncident = [...pool].sort((a, b) => b.riskScore - a.riskScore)[0] ?? null;

  const compromisedHost = topIncident?.host ?? [...hostAgg.entries()].sort((a, b) => b[1].count - a[1].count)[0]?.[0];
  if (!compromisedHost) return { compromised: null, peers: [], edges: [] };

  const compromisedAgg = hostAgg.get(compromisedHost);
  const compromised: TopoNode = {
    id: compromisedHost,
    label: compromisedHost,
    kind: "compromised",
    severity: compromisedAgg?.severity ?? topIncident?.severity ?? "critical",
    alertCount: compromisedAgg?.count ?? 0,
    detail: topIncident
      ? `${topIncident.ref} · ${topIncident.title}`
      : `${compromisedAgg?.count ?? 0} correlated alert(s)`,
    position: [0, 0, 0],
  };

  const peerIds = new Set<string>([compromisedHost]);
  const confirmed = new Set<string>();
  const peers: TopoNode[] = [];

  // Same-incident assets first — a real correlation, not a guess.
  if (topIncident) {
    for (const asset of topIncident.assets) {
      if (peerIds.has(asset.host)) continue;
      peerIds.add(asset.host);
      confirmed.add(asset.host);
      peers.push({
        id: asset.host,
        label: asset.host,
        kind: kindFor(asset.host),
        severity: asset.risk,
        alertCount: hostAgg.get(asset.host)?.count ?? 0,
        detail: `${topIncident.ref} asset · ${asset.status}`,
        position: [0, 0, 0],
      });
    }
    // The incident's real account — a genuine shared-user relationship.
    if (topIncident.user && !peerIds.has(topIncident.user)) {
      peerIds.add(topIncident.user);
      confirmed.add(topIncident.user);
      peers.push({
        id: topIncident.user,
        label: topIncident.user,
        kind: "user",
        severity: compromised.severity,
        alertCount: alerts.filter((a) => a.user === topIncident.user).length,
        detail: `Account on ${topIncident.ref}`,
        position: [0, 0, 0],
      });
    }
  }

  // Fill remaining slots with other real, active hosts from the alert queue —
  // shown as monitored network members, not as parties to the incident.
  const ranked = [...hostAgg.entries()]
    .filter(([host]) => !peerIds.has(host))
    .sort((a, b) => RANK[b[1].severity] - RANK[a[1].severity] || b[1].count - a[1].count);

  for (const [host, agg] of ranked) {
    if (peers.length >= 6) break;
    peerIds.add(host);
    peers.push({
      id: host,
      label: host,
      kind: kindFor(host),
      severity: agg.severity,
      alertCount: agg.count,
      detail: `${agg.count} alert(s) in the current queue`,
      position: [0, 0, 0],
    });
  }

  const radius = 3.6 + Math.min(peers.length, 8) * 0.12;
  peers.forEach((p, i) => {
    p.position = ring(i, peers.length, radius);
  });

  const edges: TopoEdge[] = peers.map((p) => ({
    to: p.id,
    confirmed: confirmed.has(p.id),
    severity: p.severity,
  }));

  return { compromised, peers, edges };
}
