// Three-node agent graph — represents the AI agent network
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Connecting edges */}
      <line x1="14" y1="5" x2="5"  y2="21" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="14" y1="5" x2="23" y2="21" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="5"  y1="21" x2="23" y2="21" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Outer nodes */}
      <circle cx="5"  cy="21" r="2.5" fill="#162032" stroke="#6366F1" strokeWidth="1.5" />
      <circle cx="23" cy="21" r="2.5" fill="#162032" stroke="#6366F1" strokeWidth="1.5" />
      {/* Center / primary node */}
      <circle cx="14" cy="5" r="4" fill="#6366F1" />
      <circle cx="14" cy="5" r="2" fill="white" opacity="0.9" />
    </svg>
  )
}
