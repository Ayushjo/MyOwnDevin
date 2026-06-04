// Git branch merging into a PR
export default function PRIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Feature branch node */}
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="#C084FC" strokeWidth="1.5" />
      {/* Main branch node */}
      <circle cx="28" cy="8" r="3.5" fill="none" stroke="#C084FC" strokeWidth="1.5" />
      {/* Merge target node */}
      <circle cx="20" cy="32" r="4" fill="#C084FC" />
      {/* Branch lines converging */}
      <path d="M12 11.5 Q12 24 20 28" stroke="#C084FC" strokeWidth="1.5"
        strokeLinecap="round" fill="none" strokeOpacity="0.6" />
      <path d="M28 11.5 Q28 24 20 28" stroke="#C084FC" strokeWidth="1.5"
        strokeLinecap="round" fill="none" strokeOpacity="0.6" />
      {/* Arrow tip on merge node */}
      <path d="M17 29 L20 33 L23 29" stroke="white" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
