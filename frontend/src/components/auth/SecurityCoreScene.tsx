import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { SecurityCore } from "../3d/SecurityCore";
import { ACCENT_SECONDARY_COLOR } from "../../lib/3d/socGraph";
import { IntelligenceVisualization } from "./IntelligenceVisualization";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * The Login page's 3D hero visual — the same SecurityCore used on the
 * dashboard, standing alone as SOCGenie's brand mark for the entry screen.
 * There is no alert/incident data before authentication, so this is always
 * "calm" intensity: pure identity, exactly like the SVG IntelligenceVisualization
 * it replaces in this slot and falls back to.
 *
 * WebGL-unavailable and prefers-reduced-motion both fall back to that existing
 * SVG diagram rather than a blank panel or a duplicate second implementation.
 */

function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Slow ambient drift plus gentle parallax toward the pointer. Never a spin. */
function Rig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g || reduced) return;
    const t = state.clock.elapsedTime;
    const driftY = Math.sin(t * 0.08) * 0.12;
    g.rotation.y += (state.pointer.x * 0.24 + driftY - g.rotation.y) * 0.025;
    g.rotation.x += (-state.pointer.y * 0.1 - g.rotation.x) * 0.025;
  });
  return <group ref={group}>{children}</group>;
}

export function SecurityCoreScene() {
  const reduced = usePrefersReducedMotion();
  const canRender = webglAvailable();

  if (!canRender) return <IntelligenceVisualization />;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" aria-hidden="true">
      <Suspense fallback={<IntelligenceVisualization />}>
        <Canvas
          camera={{ position: [0, 0.5, 4.3], fov: 44 }}
          dpr={[1, 1.6]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <ambientLight intensity={0.6} />
          <pointLight position={[4, 5, 5]} intensity={1.1} color="#38bdf8" />
          <pointLight position={[-5, -3, -4]} intensity={0.45} color="#22d3ee" />
          <pointLight position={[-2, 3, -6]} intensity={0.35} color={ACCENT_SECONDARY_COLOR} />
          <Rig reduced={reduced}>
            <SecurityCore intensity="calm" particleCount={110} bootEntrance />
          </Rig>
        </Canvas>
      </Suspense>
    </div>
  );
}
