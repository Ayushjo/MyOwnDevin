// Signal arcs — broadcasting live data
export default function StreamIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Center dot */}
      <circle cx="20" cy="26" r="3" fill="#10B981" />
      {/* Arc 1 (innermost) */}
      <path d="M13 20 Q20 13 27 20" stroke="#10B981" strokeWidth="1.5"
        strokeLinecap="round" fill="none" strokeOpacity="0.8" />
      {/* Arc 2 */}
      <path d="M8 15 Q20 5 32 15" stroke="#10B981" strokeWidth="1.5"
        strokeLinecap="round" fill="none" strokeOpacity="0.5" />
      {/* Arc 3 (outermost) */}
      <path d="M4 11 Q20 -1 36 11" stroke="#10B981" strokeWidth="1.5"
        strokeLinecap="round" fill="none" strokeOpacity="0.25" />
      {/* Stem */}
      <line x1="20" y1="23" x2="20" y2="36" stroke="#10B981" strokeWidth="1.5"
        strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  )
}
