/**
 * SOC analyst avatar — friendly 2D cartoon illustration.
 *
 * Rendered as inline SVG rather than a raster asset: vector stays crisp at any
 * size, needs no image file or network request, and works offline.
 *
 * ── USING A REAL IMAGE INSTEAD ─────────────────────────────────────────────
 * If you have an illustrated PNG you prefer, drop it in `frontend/public/`
 * and pass its path — no other code changes:
 *
 *     <AnalystAvatar src="/ai-socgenie-avatar.png" />
 *
 * The SVG is used whenever `src` is omitted, so the component never depends
 * on an asset existing.
 *
 * ── ILLUSTRATION PALETTE ───────────────────────────────────────────────────
 * Character colours are literal values by necessity — an illustration cannot
 * be expressed in semantic UI tokens. They are confined to this file, and the
 * ring colours are exported so the button reuses them rather than redefining
 * them.
 */
const SKIN = "#F2C7A0";
const SKIN_SHADE = "#E0A87F";
const BLUSH = "#F0A28C";
const HAIR = "#4A3728";
const HAIR_LIGHT = "#634A3A";
const HEADSET = "#3A4150";
const HOODIE_A = "#8B5CF6";
const HOODIE_B = "#3B82F6";
const LAPTOP = "#2B3240";
const LAPTOP_SCREEN = "#7DD3FC";

/** Exported so the floating button's glow ring matches the illustration. */
export const AVATAR_RING_FROM = "#A78BFA";
export const AVATAR_RING_TO = "#38BDF8";

export function AnalystAvatar({
  size = 88,
  className = "",
  src,
}: {
  size?: number;
  className?: string;
  /** Optional raster override placed in `public/`. */
  src?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="socgenie-avatar-clip">
          <circle cx="60" cy="60" r="60" />
        </clipPath>
        <radialGradient id="socgenie-avatar-bg" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#1E2540" />
          <stop offset="100%" stopColor="#111726" />
        </radialGradient>
        <linearGradient id="socgenie-hoodie" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={HOODIE_A} />
          <stop offset="100%" stopColor={HOODIE_B} />
        </linearGradient>
        <linearGradient id="socgenie-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LAPTOP_SCREEN} stopOpacity="0.9" />
          <stop offset="100%" stopColor={LAPTOP_SCREEN} stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <g clipPath="url(#socgenie-avatar-clip)">
        <rect width="120" height="120" fill="url(#socgenie-avatar-bg)" />

        {/* Sparkles */}
        <g fill="#C4B5FD" opacity="0.85">
          <path d="M22 30l1.6 4.4L28 36l-4.4 1.6L22 42l-1.6-4.4L16 36l4.4-1.6z" />
          <path d="M99 46l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2z" opacity="0.7" />
          <path d="M96 22l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z" opacity="0.55" />
        </g>

        {/* Hair — back mass */}
        <path d="M31 62c-3-24 10-38 29-38s32 14 29 38c-1 9-3 16-5 19-1-8 0-20-3-27-6 5-15 8-25 7-7-1-12-3-15-6-4 6-4 18-4 26-2-3-4-10-6-19z" fill={HAIR} />

        {/* Shoulders / hoodie */}
        <path d="M18 120c0-19 18-31 42-31s42 12 42 31z" fill="url(#socgenie-hoodie)" />
        {/* Hood opening */}
        <path d="M44 92c4 6 28 6 32 0l5 8c-6 7-36 7-42 0z" fill="#ffffff" opacity="0.14" />

        {/* Neck */}
        <path d="M51 78h18v14c0 4.5-18 4.5-18 0z" fill={SKIN_SHADE} />

        {/* Laptop */}
        <g>
          <rect x="34" y="102" width="52" height="6" rx="2.5" fill={LAPTOP} />
          <rect x="39" y="86" width="42" height="18" rx="2.5" fill={LAPTOP} />
          <rect x="42" y="88.5" width="36" height="13" rx="1.5" fill="url(#socgenie-screen)" />
          <g stroke="#0B1220" strokeOpacity="0.5" strokeWidth="1">
            <path d="M45 92h18M45 95h24M45 98h14" />
          </g>
        </g>

        {/* Head */}
        <ellipse cx="60" cy="56" rx="23" ry="25" fill={SKIN} />
        <ellipse cx="60" cy="66" rx="16" ry="10" fill={SKIN_SHADE} opacity="0.15" />

        {/* Hair — fringe and side locks */}
        <path d="M37 52c0-16 10-26 23-26s23 10 23 26c-3-9-8-13-13-14-4 4-13 6-20 5-6-1-10-3-13 9z" fill={HAIR} />
        <path d="M40 34c5-8 12-12 20-12s15 4 20 12c-7-6-13-8-20-8s-13 2-20 8z" fill={HAIR_LIGHT} opacity="0.65" />

        {/* Headset */}
        <path d="M36 55a24 24 0 0 1 48 0" fill="none" stroke={HEADSET} strokeWidth="4.5" strokeLinecap="round" />
        <rect x="31" y="51" width="9" height="16" rx="4.5" fill={HEADSET} />
        <rect x="80" y="51" width="9" height="16" rx="4.5" fill={HEADSET} />
        <path d="M40 66c0 9 6 13 11 14" fill="none" stroke={HEADSET} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="52" cy="80.5" r="2.6" fill={LAPTOP_SCREEN} />

        {/* Face — large friendly eyes with highlights */}
        <ellipse cx="51" cy="56" rx="3.4" ry="4.2" fill="#2B2338" />
        <ellipse cx="69" cy="56" rx="3.4" ry="4.2" fill="#2B2338" />
        <circle cx="52.2" cy="54.4" r="1.3" fill="#ffffff" />
        <circle cx="70.2" cy="54.4" r="1.3" fill="#ffffff" />
        <path d="M46.5 48.5c2.6-2 6-2 8.6 0" fill="none" stroke={HAIR} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M64.9 48.5c2.6-2 6-2 8.6 0" fill="none" stroke={HAIR} strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="44" cy="62" rx="3.6" ry="2.4" fill={BLUSH} opacity="0.5" />
        <ellipse cx="76" cy="62" rx="3.6" ry="2.4" fill={BLUSH} opacity="0.5" />
        {/* Smile */}
        <path d="M54 65.5c3.4 3.4 8.6 3.4 12 0" fill="none" stroke="#2B2338" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
