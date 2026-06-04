import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin()

// Box data: label, sublabel, icon path
const STAGES = [
  {
    label: 'GitHub Issue',
    sub: 'Problem statement',
    icon: (
      // Issue icon: circle with dot and line
      <g>
        <circle cx="75" cy="62" r="10" stroke="#94A3B8" strokeWidth="1.5" fill="none" />
        <circle cx="75" cy="58" r="1.5" fill="#94A3B8" />
        <line x1="75" y1="62" x2="75" y2="68" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },
  {
    label: 'AI Plan',
    sub: 'Ordered steps',
    icon: (
      // Tree/plan icon: top node branching to two
      <g>
        <circle cx="265" cy="52" r="4" fill="#6366F1" />
        <line x1="265" y1="56" x2="257" y2="66" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="265" y1="56" x2="273" y2="66" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <circle cx="257" cy="68" r="3" fill="none" stroke="#6366F1" strokeWidth="1.5" />
        <circle cx="273" cy="68" r="3" fill="none" stroke="#6366F1" strokeWidth="1.5" />
      </g>
    ),
  },
  {
    label: 'Execute',
    sub: 'Sandbox + tools',
    icon: (
      // Terminal prompt: >_
      <g>
        <text x="449" y="68" fill="#10B981" fontSize="14" fontFamily="monospace" fontWeight="500">&gt;_</text>
      </g>
    ),
  },
  {
    label: 'Pull Request',
    sub: 'Automated PR',
    icon: (
      // Git branch: two lines merging
      <g>
        <circle cx="638" cy="52" r="3.5" fill="none" stroke="#C084FC" strokeWidth="1.5" />
        <circle cx="648" cy="52" r="3.5" fill="none" stroke="#C084FC" strokeWidth="1.5" />
        <circle cx="643" cy="70" r="3.5" fill="#C084FC" />
        <line x1="638" y1="55.5" x2="641" y2="66.5" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="648" y1="55.5" x2="645" y2="66.5" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      </g>
    ),
  },
]

// Box positions: x offsets for each stage
const BOX_W = 140
const BOX_H = 80
const BOXES = [
  { x: 5,   y: 30 },
  { x: 195, y: 30 },
  { x: 385, y: 30 },
  { x: 575, y: 30 },
]
const CONNECTORS = [
  { x1: 145, x2: 195, y: 70 },
  { x1: 335, x2: 385, y: 70 },
  { x1: 525, x2: 575, y: 70 },
]

export default function HeroFlow() {
  const dot1 = useRef<SVGCircleElement>(null)
  const dot2 = useRef<SVGCircleElement>(null)
  const dot3 = useRef<SVGCircleElement>(null)
  const box1 = useRef<SVGRectElement>(null)
  const box2 = useRef<SVGRectElement>(null)
  const box3 = useRef<SVGRectElement>(null)
  const box4 = useRef<SVGRectElement>(null)
  const containerRef = useRef<SVGSVGElement>(null)

  useGSAP(() => {
    const dots = [
      { ref: dot1, x1: 145, x2: 193 },
      { ref: dot2, x1: 335, x2: 383 },
      { ref: dot3, x1: 525, x2: 573 },
    ]

    // Animate each dot along its connector, staggered
    dots.forEach(({ ref, x1, x2 }, i) => {
      gsap.fromTo(
        ref.current,
        { attr: { cx: x1 }, opacity: 0 },
        {
          attr: { cx: x2 },
          opacity: 1,
          duration: 0.7,
          repeat: -1,
          ease: 'power1.inOut',
          repeatDelay: 2.1,
          delay: i * 0.75,
          yoyo: false,
          onRepeat() {
            gsap.set(ref.current, { attr: { cx: x1 }, opacity: 0 })
          },
        }
      )
    })

    // Sequential box highlight wave
    const boxes = [box1, box2, box3, box4]
    const tl = gsap.timeline({ repeat: -1, delay: 0.3 })
    boxes.forEach(b => {
      tl.to(b.current, { attr: { strokeOpacity: 1, strokeWidth: 1.5 }, duration: 0.35, ease: 'power1.out' })
        .to(b.current, { attr: { strokeOpacity: 0.35, strokeWidth: 1 }, duration: 0.5, ease: 'power1.in' }, '+=0.4')
    })
  }, { scope: containerRef })

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 720 140"
      fill="none"
      className="w-full max-w-2xl"
      aria-hidden="true"
    >
      <defs>
        <filter id="glow-primary">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-dot">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Stage boxes */}
      {BOXES.map((b, i) => (
        <g key={i}>
          <rect
            ref={i === 0 ? box1 : i === 1 ? box2 : i === 2 ? box3 : box4}
            x={b.x} y={b.y}
            width={BOX_W} height={BOX_H}
            rx="10"
            fill="#0D1320"
            stroke="#6366F1"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          {/* Icon */}
          {STAGES[i]?.icon}
          {/* Label */}
          <text
            x={b.x + BOX_W / 2} y={b.y + BOX_H + 18}
            textAnchor="middle"
            fill="#E2E8F0"
            fontSize="12"
            fontFamily="Inter, sans-serif"
            fontWeight="500"
          >
            {STAGES[i]?.label}
          </text>
          <text
            x={b.x + BOX_W / 2} y={b.y + BOX_H + 32}
            textAnchor="middle"
            fill="#64748B"
            fontSize="10"
            fontFamily="Inter, sans-serif"
          >
            {STAGES[i]?.sub}
          </text>
        </g>
      ))}

      {/* Connector lines */}
      {CONNECTORS.map((c, i) => (
        <line
          key={i}
          className="flow-line"
          x1={c.x1} y1={c.y}
          x2={c.x2} y2={c.y}
          stroke="#6366F1"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
      ))}

      {/* Arrow heads */}
      {CONNECTORS.map((c, i) => (
        <polygon
          key={i}
          points={`${c.x2},${c.y - 4} ${c.x2 + 7},${c.y} ${c.x2},${c.y + 4}`}
          fill="#6366F1"
          opacity="0.5"
        />
      ))}

      {/* Moving dots */}
      <circle ref={dot1} cx="145" cy="70" r="4" fill="#818CF8" filter="url(#glow-dot)" opacity="0" />
      <circle ref={dot2} cx="335" cy="70" r="4" fill="#818CF8" filter="url(#glow-dot)" opacity="0" />
      <circle ref={dot3} cx="525" cy="70" r="4" fill="#818CF8" filter="url(#glow-dot)" opacity="0" />
    </svg>
  )
}
