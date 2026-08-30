/**
 * SOCGenie mark: a shield (containment) with a signal waveform (detection)
 * cut through it. Deliberately not a genie, lamp, or character.
 * Legible from 16px favicon to login scale.
 */
export function Logo({
  size = 28,
  showWordmark = true,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 2 L28 6.5 V15 C28 22.5 22.8 27.8 16 30 C9.2 27.8 4 22.5 4 15 V6.5 Z"
          className="fill-bg-elevated stroke-accent"
          strokeWidth="1.4"
        />
        <path
          d="M10 16.5 L13.2 16.5 L15 12 L17.4 20.5 L19 16.5 L22 16.5"
          fill="none"
          className="stroke-accent"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className="text-[17px] font-semibold tracking-tight text-text-primary">SOCGenie</span>
      )}
    </div>
  );
}
