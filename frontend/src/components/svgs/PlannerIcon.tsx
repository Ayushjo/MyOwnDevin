// Decision tree — top node branching into 3 steps
export default function PlannerIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Root node */}
      <circle cx="20" cy="8" r="4" fill="#6366F1" />
      {/* Branch lines */}
      <line x1="20" y1="12" x2="9"  y2="26" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
      <line x1="20" y1="12" x2="20" y2="26" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
      <line x1="20" y1="12" x2="31" y2="26" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
      {/* Leaf nodes */}
      <rect x="5"  y="26" width="8" height="8" rx="2" fill="#162032" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.8" />
      <rect x="16" y="26" width="8" height="8" rx="2" fill="#162032" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.8" />
      <rect x="27" y="26" width="8" height="8" rx="2" fill="#162032" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.8" />
    </svg>
  )
}
