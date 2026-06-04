// Isolated container — dashed border box with circuit nodes inside
export default function SandboxIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Outer dashed border (the isolation boundary) */}
      <rect x="3" y="3" width="34" height="34" rx="6"
        stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.7" />
      {/* Inner circuit nodes */}
      <circle cx="13" cy="14" r="2.5" fill="#6366F1" opacity="0.8" />
      <circle cx="27" cy="14" r="2.5" fill="#6366F1" opacity="0.8" />
      <circle cx="20" cy="26" r="2.5" fill="#6366F1" opacity="0.8" />
      {/* Connecting lines */}
      <line x1="13" y1="14" x2="27" y2="14" stroke="#6366F1" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="13" y1="14" x2="20" y2="26" stroke="#6366F1" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="27" y1="14" x2="20" y2="26" stroke="#6366F1" strokeWidth="1" strokeOpacity="0.4" />
    </svg>
  )
}
