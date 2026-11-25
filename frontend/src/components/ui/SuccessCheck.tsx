/** A check mark that draws itself, for "saved" moments. Motion is off under reduced-motion. */
export function SuccessCheck({ size = 44, color = 'var(--success)' }: { size?: number; color?: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full animate-pop animate-ring"
      style={{ width: size, height: size, backgroundColor: 'var(--low-bg)' }} aria-hidden="true">
      <svg className="check-draw" width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
