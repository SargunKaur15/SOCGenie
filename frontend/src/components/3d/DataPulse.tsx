import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * A small emissive point travelling along an EXISTING connection (from → to),
 * fading in and out rather than popping. Purely decorative motion — it never
 * draws a connection that isn't already rendered as a Line beside it.
 *
 * Renders nothing under prefers-reduced-motion, rather than a static point
 * frozen mid-path.
 */
export function DataPulse({
  from,
  to,
  color,
  period = 2.6,
  size = 0.05,
  delay = 0,
  maxOpacity = 0.85,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  period?: number;
  size?: number;
  delay?: number;
  /** Peak opacity at the midpoint of the travel. Defaults to the original
   *  hardcoded value, so every existing caller is unaffected. */
  maxOpacity?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);

  useFrame((state) => {
    const m = meshRef.current;
    const mat = materialRef.current;
    if (!m || !mat) return;
    const t = ((state.clock.elapsedTime + delay) % period) / period;
    m.position.set(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t
    );
    mat.opacity = Math.sin(t * Math.PI) * maxOpacity;
  });

  if (REDUCED_MOTION) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={0} />
    </mesh>
  );
}
