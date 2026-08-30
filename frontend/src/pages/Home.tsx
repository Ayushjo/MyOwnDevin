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
  { num: 7+,  kind: 'added',   code: '    try {'                                 },
  { num: 8+,  kind: 'added',   code: '      await db.close()'                   },
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