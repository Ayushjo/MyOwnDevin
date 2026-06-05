import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTask } from '../api/client'
import { addTask } from '../store/taskStore'

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function parseGitHubUrl(url: string) {
  const numMatch  = url.match(/\/issues\/(\d+)/)
  const repoMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/issues/)
  return {
    issueNumber: numMatch  ? parseInt(numMatch[1]!)  : 0,
    repoName:    repoMatch ? repoMatch[1]!           : 'unknown',
  }
}

/* ─────────────────────────────────────────────────────────────
   Light Navbar  (self-contained for the home page)
───────────────────────────────────────────────────────────── */
function LightNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100/80">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <line x1="14" y1="5"  x2="5"  y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
            <line x1="14" y1="5"  x2="23" y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
            <line x1="5"  y1="21" x2="23" y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
            <circle cx="5"  cy="21" r="2.5" fill="white" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="23" cy="21" r="2.5" fill="white" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="14" cy="5"  r="4"   fill="#1e293b" />
            <circle cx="14" cy="5"  r="2"   fill="white" opacity="0.9" />
          </svg>
          <span className="text-gray-900 font-bold text-base tracking-tight">devin</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-widest">
            agent
          </span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link to="/dashboard"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium px-4 py-2 transition-colors rounded-lg">
            Dashboard
          </Link>
          <Link to="/tasks/new"
            className="text-sm font-semibold px-5 py-2 rounded-full bg-white border border-gray-200 text-gray-700
                       shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200">
            New Task
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────
   Code Diff Card
───────────────────────────────────────────────────────────── */
type LineKind = 'normal' | 'deleted' | 'added' | 'empty'
interface DL { num: string | number; code: string; kind: LineKind }

const L: DL[] = [
  { num: 1,    kind: 'normal',  code: '// 1.4 -1.1.0 nocm function getuser {'  },
  { num: 2,    kind: 'normal',  code: '  const user = axal2 do.Findone(12)'     },
  { num: 3,    kind: 'normal',  code: '  jf (user) throw new lettrandenErrors;' },
  { num: 4,    kind: 'empty',   code: ''                                         },
  { num: 5,    kind: 'empty',   code: ''                                         },
  { num: 6,    kind: 'normal',  code: '  return user_profile(rmail) ?? null {'  },
  { num: 7,    kind: 'normal',  code: '    try {'                                },
  { num: '8-', kind: 'deleted', code: '      await db.close()'                  },
  { num: 9,    kind: 'empty',   code: ''                                         },
  { num: 10,   kind: 'normal',  code: '  }'                                      },
  { num: 11,   kind: 'normal',  code: '}'                                        },
  { num: 12,   kind: 'empty',   code: ''                                         },
]

const R: DL[] = [
  { num: 1,     kind: 'normal',  code: '// 1.4 -1.1.0 nome function getuser {'   },
  { num: 2,     kind: 'normal',  code: '  const user = axal2 do.Findone(12)'      },
  { num: 3,     kind: 'normal',  code: '  jf (user) throw new lottrandenErrors;'  },
  { num: 4,     kind: 'empty',   code: ''                                          },
  { num: 5,     kind: 'empty',   code: ''                                          },
  { num: '6+',  kind: 'added',   code: '  return user_profile(rmail) ?? null {'   },
  { num: '7+',  kind: 'added',   code: '    try {'                                 },
  { num: '8+',  kind: 'added',   code: '      await db.close()'                   },
  { num: 9,     kind: 'added',   code: '    } finally {'                           },
  { num: 10,    kind: 'added',   code: '      await db.close();'                   },
  { num: 11,    kind: 'added',   code: '    }'                                     },
  { num: '12+', kind: 'added',   code: '    await.user();'                         },
  { num: 13,    kind: 'normal',  code: '  }'                                       },
  { num: 14,    kind: 'normal',  code: '}'                                         },
  { num: 15,    kind: 'empty',   code: ''                                          },
]

function DiffPanel({ lines, border }: { lines: DL[]; border?: boolean }) {
  return (
    <div className={`flex-1 font-mono text-[10.5px] leading-[19px] overflow-hidden ${border ? 'border-r border-gray-200' : ''}`}>
      {lines.map((l, i) => (
        <div
          key={i}
          className={`flex items-stretch min-h-[19px] ${
            l.kind === 'deleted' ? 'bg-red-50/80' :
            l.kind === 'added'   ? 'bg-green-50/80' :
            ''
          }`}
        >
          <span className={`w-8 shrink-0 text-right pr-2 select-none border-r ${
            l.kind === 'deleted' ? 'text-red-300 border-red-100 bg-red-50/60' :
            l.kind === 'added'   ? 'text-green-400 border-green-100 bg-green-50/60' :
            'text-gray-300 border-gray-100'
          }`}>
            {l.num}
          </span>
          <span className={`pl-2 pr-3 truncate ${
            l.kind === 'deleted' ? 'text-red-600'   :
            l.kind === 'added'   ? 'text-green-700' :
            'text-gray-600'
          }`}>
            {l.code}
          </span>
        </div>
      ))}
    </div>
  )
}

function CodeDiffCard() {
  return (
    <div className="relative w-full">
      {/* Card */}
      <div
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 20px 60px -10px rgba(15,23,42,0.12), 0 8px 24px -6px rgba(15,23,42,0.06)' }}
      >
        {/* Header */}
        <div className="bg-gray-50/90 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-[11px] text-gray-500 tracking-wide">
            DEVIN INSIGHT&nbsp;&nbsp;|&nbsp;&nbsp;#13450&nbsp;&nbsp;|&nbsp;&nbsp;src/users.js
          </span>
        </div>

        {/* Diff body */}
        <div className="flex">
          <DiffPanel lines={L} border />
          <DiffPanel lines={R} />
        </div>
      </div>

      {/* Tooltip: Race Condition */}
      <div
        className="absolute pointer-events-none z-10"
        style={{ left: '8%', bottom: '23%' }}
      >
        <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium
                        px-3 py-2 rounded-xl shadow-lg max-w-[178px] leading-snug">
          <div className="font-semibold mb-0.5">Race Condition Detected:</div>
          <div className="text-red-600">db close before use.</div>
        </div>
        {/* small connector dot */}
        <div className="absolute -top-1 right-4 w-2 h-2 bg-red-300 rounded-full" />
      </div>

      {/* Tooltip: Resolved */}
      <div
        className="absolute pointer-events-none z-10"
        style={{ right: '-2%', bottom: '14%' }}
      >
        <div className="bg-green-50 border border-green-200 text-green-700 text-[11px] font-medium
                        px-3 py-2 rounded-xl shadow-lg max-w-[155px] leading-snug">
          <div className="font-semibold mb-0.5">Resolved:</div>
          <div className="text-green-600">Integrity ensured.</div>
        </div>
        <div className="absolute -top-1 left-4 w-2 h-2 bg-green-400 rounded-full" />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Status Tracker
───────────────────────────────────────────────────────────── */
const STEPS = ['Issue Received', 'Planning', 'Execution', 'Pull Request']

function StatusTracker() {
  return (
    <div className="flex items-center justify-center gap-0 pt-2 pb-16 px-4">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          {i > 0 && (
            <div className="h-px w-12 sm:w-20 lg:w-28 bg-gray-200 mx-0.5" />
          )}
          {/* Step pill */}
          <div className="relative flex items-center justify-center">
            {i === 0 && (
              <>
                {/* outer glow ring */}
                <span
                  className="absolute inset-0 rounded-full bg-indigo-300/30 animate-ping"
                  style={{ animationDuration: '2.4s' }}
                />
                <span className="absolute inset-[-4px] rounded-full bg-indigo-100/60 border border-indigo-200/50" />
              </>
            )}
            <div className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              i === 0
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm'
                : 'bg-white/70 text-gray-400 border border-gray-200'
            }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                i === 0 ? 'bg-indigo-500' : 'bg-gray-300'
              }`} />
              {step}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Social Proof — Monochrome Logo Marks
───────────────────────────────────────────────────────────── */
function GHMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53
        .63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
        0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09
        2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65
        3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  )
}

function GLMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 380 380" fill="currentColor">
      <path d="M190 349L265 118H115Z" opacity="0.9"/>
      <path d="M190 349L115 118H27Z" opacity="0.55"/>
      <path d="M27 118L5 186a15 15 0 005 17L190 349Z" opacity="0.7"/>
      <path d="M27 118h88L77 4C75-1 67-1 65 4Z" opacity="0.85"/>
      <path d="M190 349L265 118h88Z" opacity="0.55"/>
      <path d="M353 118l22 68a15 15 0 01-5 17L190 349Z" opacity="0.7"/>
      <path d="M353 118h-88l39-114c2-5 9-5 11 0Z" opacity="0.85"/>
    </svg>
  )
}

function JiraMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 256 256" fill="none">
      <defs>
        <linearGradient id="jira-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
        </linearGradient>
      </defs>
      <path d="M128 16L16 128l112 112 112-112Z" fill="url(#jira-g)"/>
      <path d="M128 16L64 80l64 64 64-64Z" fill="currentColor" opacity="0.75"/>
    </svg>
  )
}

function TCMark() {
  // Simplified TechCrunch TV icon
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor">
      <rect x="0" y="0" width="14" height="11" rx="2"/>
      <path d="M14 3.5l4 3.5-4 3.5V3.5Z"/>
    </svg>
  )
}

function CNNMark() {
  return (
    <svg width="28" height="14" viewBox="0 0 56 20" fill="currentColor">
      <text y="15" fontSize="16" fontWeight="800" letterSpacing="-1" fontFamily="serif">CNN</text>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────────── */
export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const { taskId } = await createTask(trimmed)
      const { issueNumber, repoName } = parseGitHubUrl(trimmed)
      addTask({
        id:          taskId,
        issueUrl:    trimmed,
        issueTitle:  `Issue #${issueNumber}`,
        issueNumber,
        repoName,
        branchName:  `devin/task-${taskId}`,
        status:      'running',
        steps:       [],
        createdAt:   new Date().toISOString(),
      })
      navigate(`/tasks/${taskId}`)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen font-sans text-gray-900 antialiased"
      style={{
        background:
          'radial-gradient(ellipse 90% 70% at 75% -5%, rgba(99,102,241,0.09) 0%, transparent 55%),' +
          'radial-gradient(ellipse 60% 50% at 25% 105%, rgba(168,85,247,0.06) 0%, transparent 55%),' +
          '#F7F8FC',
      }}
    >
      <LightNavbar />

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-28 pb-6 grid lg:grid-cols-2 gap-16 items-center min-h-[88vh]">

        {/* Left column */}
        <div className="flex flex-col items-start">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 mb-6 rounded-full
                           bg-white border border-gray-200 shadow-sm text-gray-600 text-xs font-medium
                           select-none">
            ✦ AI Coding Agent
          </span>

          {/* Headline */}
          <h1 className="text-[3.2rem] lg:text-[3.6rem] font-bold leading-[1.09] tracking-tight mb-5 text-gray-900">
            Your codebase.<br />
            <span className="text-indigo-700">Fixed.</span><br />
            <span className="text-indigo-500">Autonomously.</span>
          </h1>

          {/* Sub */}
          <p className="text-gray-500 text-[1.05rem] leading-relaxed mb-9 max-w-[26rem]">
            Submit a GitHub issue, Devin plans, executes, and opens a pull request. You just review.
          </p>

          {/* Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-[26rem]">
            <div
              className="flex items-center gap-1 bg-white rounded-full p-1.5 pl-5 border border-gray-200"
              style={{ boxShadow: '0 4px 18px -4px rgba(15,23,42,0.1), 0 1px 4px rgba(15,23,42,0.06)' }}
            >
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Submit an Issue"
                className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none min-w-0"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                           text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all
                           duration-200 shrink-0 shadow-sm hover:shadow-indigo-200 hover:shadow-md"
              >
                {loading ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>

        {/* Right column — Code Diff Card */}
        <div className="hidden lg:flex flex-col items-center gap-3">
          <CodeDiffCard />
          <p className="text-gray-400 text-[11px] mt-1">Fix for #13450 profile check</p>
        </div>
      </section>

      {/* ── STATUS TRACKER ── */}
      <StatusTracker />

      {/* ── SOCIAL PROOF ── */}
      <section className="border-t border-gray-100/80" style={{ background: 'rgba(255,255,255,0.6)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row gap-12">
          {/* Integration Partners */}
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-[0.12em] mb-5">
              Integration Partners
            </p>
            <div className="flex items-center gap-7 text-gray-400 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-semibold hover:text-gray-600 transition-colors cursor-default">
                <GHMark /> GitHub
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold hover:text-gray-600 transition-colors cursor-default">
                <GLMark /> GitLab
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold hover:text-gray-600 transition-colors cursor-default">
                <JiraMark /> Jira
              </div>
            </div>
          </div>

          {/* Featured In */}
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-[0.12em] mb-5">
              Featured In
            </p>
            <div className="flex items-center gap-7 text-gray-400 flex-wrap">
              <span className="text-sm font-black tracking-tight hover:text-gray-600 transition-colors cursor-default">
                Forbes
              </span>
              <div className="flex items-center gap-1.5 text-sm font-bold hover:text-gray-600 transition-colors cursor-default">
                <TCMark />
                <span>TechCrunch</span>
              </div>
              <span className="flex items-center gap-1 hover:text-gray-600 transition-colors cursor-default">
                <CNNMark />
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
