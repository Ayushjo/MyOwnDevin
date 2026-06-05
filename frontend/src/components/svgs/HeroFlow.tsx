import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// ── Dimensions ─────────────────────────────────────────
const LINE_H   = 27
const TOPBAR_H = 33
const lineY    = (i: number) => TOPBAR_H + i * LINE_H
const textY    = (i: number) => lineY(i) + 18   // text baseline inside each row
const EDITOR_H = TOPBAR_H + 7 * LINE_H + 6      // 228
const SVG_H    = EDITOR_H + 48                   // 276

export default function HeroFlow() {
  const svgRef      = useRef<SVGSVGElement>(null)
  const revealRef   = useRef<SVGRectElement>(null)   // clip rect that "types" green text
  const greenRef    = useRef<SVGGElement>(null)       // green added-line group
  const redRef      = useRef<SVGGElement>(null)       // red deleted-line group
  const prBadgeRef  = useRef<SVGGElement>(null)       // PR badge below editor

  useGSAP(() => {
    // ── initial state ──
    gsap.set(greenRef.current,   { opacity: 0 })
    gsap.set(prBadgeRef.current, { opacity: 0, y: 8 })
    gsap.set(revealRef.current,  { attr: { width: 0 } })

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 })

    // Phase 1 – pause: show the broken code
    tl.to({}, { duration: 1.2 })

    // Phase 2 – red line pulses: AI analyzing the bug
    tl.to(redRef.current, { opacity: 0.3, duration: 0.18, yoyo: true, repeat: 5, ease: 'none' })

    // Phase 3 – green fix types in left-to-right
    tl.set(greenRef.current,  { opacity: 1 })
    tl.to(revealRef.current,  { attr: { width: 330 }, duration: 1.5, ease: 'none' })

    // Phase 4 – red line fades away (fix replaces it)
    tl.to(redRef.current, { opacity: 0, duration: 0.38 }, '-=0.55')

    // Phase 5 – PR badge pops up
    tl.to(prBadgeRef.current, { opacity: 1, y: 0, duration: 0.44, ease: 'back.out(1.4)' }, '+=0.22')

    // Hold for reading
    tl.to({}, { duration: 2.3 })

    // Reset for next loop
    tl.set(redRef.current,    { opacity: 1 })
    tl.set(greenRef.current,  { opacity: 0 })
    tl.set(revealRef.current, { attr: { width: 0 } })
    tl.set(prBadgeRef.current, { opacity: 0, y: 8 })
  }, { scope: svgRef })

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 540 ${SVG_H}`}
      fill="none"
      className="w-full max-w-xl drop-shadow-2xl"
      aria-hidden="true"
    >
      <defs>
        {/* Clip rect that reveals the green fix text left-to-right */}
        <clipPath id="hfGreenReveal">
          <rect ref={revealRef} x="74" y={lineY(4)} width="0" height={LINE_H} />
        </clipPath>
      </defs>

      {/* ── Editor shell ──────────────────────────────────── */}
      <rect x="0" y="0" width="540" height={EDITOR_H} rx="10" fill="#07111e" />
      <rect x="0" y="0" width="540" height={EDITOR_H} rx="10"
        stroke="#1a2845" strokeWidth="1" />

      {/* Title bar */}
      <rect x="0" y="0" width="540" height={TOPBAR_H} rx="10" fill="#0d1729" />
      {/* Square off the bottom corners of the title bar */}
      <rect x="0" y={TOPBAR_H - 5} width="540" height="5" fill="#0d1729" />
      <line x1="0" y1={TOPBAR_H} x2="540" y2={TOPBAR_H} stroke="#1a2845" strokeWidth="1" />

      {/* macOS traffic lights */}
      <circle cx="15" cy="17" r="4.5" fill="#ff5f57" />
      <circle cx="29" cy="17" r="4.5" fill="#febc2e" />
      <circle cx="43" cy="17" r="4.5" fill="#28c840" />

      {/* Separator + TypeScript badge + file path */}
      <line x1="57" y1="9" x2="57" y2="25" stroke="#1a2845" strokeWidth="1" />
      <rect x="65" y="10" width="20" height="13" rx="3" fill="#3178c6" />
      <text x="75" y="20.5" fill="white" fontSize="8" fontFamily="monospace"
        fontWeight="bold" textAnchor="middle">ts</text>
      <text x="91" y="21" fill="#3d506b" fontSize="11" fontFamily="monospace">
        src/utils/getUser.ts
      </text>

      {/* ── Line-number gutter ──────────────────────────── */}
      <rect x="0" y={TOPBAR_H} width="62" height={EDITOR_H - TOPBAR_H} fill="#060e1a" />
      {/* Old | new column divider */}
      <line x1="30" y1={TOPBAR_H} x2="30" y2={EDITOR_H} stroke="#0d1a2e" strokeWidth="1" />
      {/* Gutter | code divider */}
      <line x1="62" y1={TOPBAR_H} x2="62" y2={EDITOR_H} stroke="#1a2845" strokeWidth="1" />

      {/* ── Hunk header ─────────────────────────────────── */}
      <rect x="0" y={lineY(0)} width="540" height={LINE_H} fill="rgba(99,102,241,0.07)" />
      <text x="74" y={textY(0)} fill="#6366f1" fontSize="10.5"
        fontFamily="monospace" opacity="0.55">
        @@ -3,6 +3,6 @@ async function getUser
      </text>

      {/* ── Context line 1 ──────────────────────────────── */}
      <text x="15" y={textY(1)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">3</text>
      <text x="47" y={textY(1)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">3</text>
      <text x="74" y={textY(1)} fill="#3d5268" fontSize="11" fontFamily="monospace">
        {'  const user = await db.findOne(id)'}
      </text>

      {/* ── Context line 2 ──────────────────────────────── */}
      <text x="15" y={textY(2)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">4</text>
      <text x="47" y={textY(2)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">4</text>
      <text x="74" y={textY(2)} fill="#3d5268" fontSize="11" fontFamily="monospace">
        {'  if (!user) throw new NotFoundError()'}
      </text>

      {/* ── RED deleted line (the bug) ───────────────────── */}
      <g ref={redRef}>
        <rect x="0"  y={lineY(3)} width="540" height={LINE_H} fill="rgba(239,68,68,0.11)" />
        <rect x="0"  y={lineY(3)} width="62"  height={LINE_H} fill="rgba(239,68,68,0.20)" />
        {/* Old line number */}
        <text x="15" y={textY(3)} fill="#ef4444" fontSize="10.5"
          fontFamily="monospace" textAnchor="middle" opacity="0.6">5</text>
        {/* Minus prefix */}
        <text x="65" y={textY(3)} fill="#ef4444" fontSize="12"
          fontFamily="monospace" textAnchor="end">−</text>
        {/* Broken code */}
        <text x="74" y={textY(3)} fill="#fca5a5" fontSize="11" fontFamily="monospace">
          {'  return user.profile.email'}
        </text>
      </g>

      {/* ── GREEN added line (the fix) ───────────────────── */}
      <g ref={greenRef}>
        <rect x="0"  y={lineY(4)} width="540" height={LINE_H} fill="rgba(16,185,129,0.09)" />
        <rect x="0"  y={lineY(4)} width="62"  height={LINE_H} fill="rgba(16,185,129,0.17)" />
        {/* New line number */}
        <text x="47" y={textY(4)} fill="#10b981" fontSize="10.5"
          fontFamily="monospace" textAnchor="middle" opacity="0.65">5</text>
        {/* Plus prefix */}
        <text x="65" y={textY(4)} fill="#10b981" fontSize="12"
          fontFamily="monospace" textAnchor="end">+</text>
        {/* Fixed code — revealed by clip rect animation */}
        <g clipPath="url(#hfGreenReveal)">
          <text x="74" y={textY(4)} fill="#6ee7b7" fontSize="11" fontFamily="monospace">
            {'  return user.profile?.email ?? null'}
          </text>
        </g>
      </g>

      {/* ── Context line 3 ──────────────────────────────── */}
      <text x="15" y={textY(5)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">6</text>
      <text x="47" y={textY(5)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">6</text>
      <text x="74" y={textY(5)} fill="#3d5268" fontSize="11" fontFamily="monospace">
        {'  await db.close()'}
      </text>

      {/* ── Context line 4 (closing brace) ──────────────── */}
      <text x="15" y={textY(6)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">7</text>
      <text x="47" y={textY(6)} fill="#1e3050" fontSize="10.5"
        fontFamily="monospace" textAnchor="middle">7</text>
      <text x="74" y={textY(6)} fill="#3d5268" fontSize="11" fontFamily="monospace">
        {'}'}
      </text>

      {/* ── PR Badge (slides up when fix is done) ────────── */}
      <g ref={prBadgeRef}>
        <rect x="283" y={EDITOR_H + 13} width="250" height="26"
          rx="13" fill="#0b2318" stroke="#10b981" strokeWidth="1" />
        <circle cx="305" cy={EDITOR_H + 26} r="5" fill="#10b981" />
        <text x="316" y={EDITOR_H + 30} fill="#6ee7b7" fontSize="10.5"
          fontFamily="Inter, sans-serif" fontWeight="600">
          ✓  PR Opened — fix/null-profile-check
        </text>
      </g>
    </svg>
  )
}
