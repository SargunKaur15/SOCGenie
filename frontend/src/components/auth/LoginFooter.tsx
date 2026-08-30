/**
 * Product metadata. Deliberately factual: this is an academic prototype with no
 * authentication, no encryption and no monitoring, so no security-posture
 * claims are made here.
 */
export function LoginFooter() {
  const items = ["Academic research prototype", "Security operations workflow", "MITRE ATT&CK aligned"];

  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border px-5 py-4 text-2xs text-text-muted sm:px-8">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden="true" className="text-border">•</span>}
          {item}
        </span>
      ))}
    </footer>
  );
}
