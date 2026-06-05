import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createTask } from '../api/client'
import { addTask } from '../store/taskStore'

/* ─────────────────────────────────────────────────────────────────
   Light Navbar  (shared design language)
───────────────────────────────────────────────────────────────── */
function LightNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100/80">
      <div className="max-w-[1220px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <line x1="14" y1="5"  x2="5"  y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
            <line x1="14" y1="5"  x2="23" y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
            <line x1="5"  y1="21" x2="23" y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/>
            <circle cx="5"  cy="21" r="2.5" fill="white" stroke="#1e293b" strokeWidth="1.5"/>
            <circle cx="23" cy="21" r="2.5" fill="white" stroke="#1e293b" strokeWidth="1.5"/>
            <circle cx="14" cy="5"  r="4"   fill="#1e293b"/>
            <circle cx="14" cy="5"  r="2"   fill="white" opacity="0.9"/>
          </svg>
          <span className="text-gray-900 font-bold text-base tracking-tight">devin</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500
                           border border-gray-200 uppercase tracking-widest">
            agent
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/dashboard"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium px-4 py-2 transition-colors rounded-lg">
            Dashboard
          </Link>
          <Link to="/tasks/new"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full
                       bg-gray-900 text-white shadow-sm hover:bg-gray-700 transition-all duration-200">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            New Task
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
function parseGitHubUrl(url: string) {
  const numMatch  = url.match(/\/issues\/(\d+)/)
  const repoMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/issues/)
  return {
    issueNumber: numMatch  ? parseInt(numMatch[1]!) : 0,
    repoName:    repoMatch ? repoMatch[1]!          : 'unknown',
  }
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

const FLOW_STEPS = [
  { label: 'Plan steps',          icon: 'M3 6h18M3 12h18M3 18h18' },
  { label: 'Execute in sandbox',  icon: 'M5 3l14 9-14 9V3z' },
  { label: 'Open pull request',   icon: 'M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0v6a6 6 0 0 1-6 6H9' },
]

/* ─────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────── */
export default function NewTask() {
  const [url,     setUrl]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const navigate = useNavigate()

  const isValidUrl = /github\.com\/.+\/.+\/issues\/\d+/.test(url)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidUrl) {
      setError('Please enter a valid GitHub issue URL — e.g. https://github.com/owner/repo/issues/42')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { taskId } = await createTask(url)
      const { issueNumber, repoName } = parseGitHubUrl(url)
      addTask({
        id:          taskId,
        issueUrl:    url,
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
      setError('Failed to create task. Is the backend running on port 3500?')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{
        background: '#F7F8FC',
        backgroundImage:
          'linear-gradient(rgba(203,213,225,0.3) 1px,transparent 1px),' +
          'linear-gradient(90deg,rgba(203,213,225,0.3) 1px,transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <LightNavbar />

      <main className="min-h-screen flex items-center justify-center px-6 pt-14">
        <div className="w-full max-w-[480px]">

          {/* Back link */}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800
                       text-sm mb-7 transition-colors group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              className="transition-transform group-hover:-translate-x-0.5">
              <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </Link>

          {/* Card */}
          <div
            className="bg-white rounded-2xl p-8"
            style={{
              boxShadow:
                '0 4px 6px -1px rgba(0,0,0,0.04),' +
                '0 10px 40px -8px rgba(15,23,42,0.10),' +
                '0 1px 3px rgba(0,0,0,0.03)',
              border: '1px solid rgba(226,232,240,0.9)',
            }}
          >
            {/* Header */}
            <div className="mb-7">
              {/* Icon badge */}
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-600">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577
                    0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755
                    -1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305
                    3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38
                    1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399
                    3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873
                    .12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81
                    2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24
                    12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </div>
              <h1 className="text-gray-900 font-bold text-2xl mb-1.5">Submit a GitHub issue</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Paste the issue URL and Devin takes it from here — no setup required.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  GitHub Issue URL
                </label>

                {/* Input wrapper */}
                <div
                  className="relative flex items-center bg-white rounded-xl border transition-all duration-200"
                  style={{
                    borderColor: error
                      ? '#FCA5A5'
                      : focused
                        ? '#6366F1'
                        : '#E2E8F0',
                    boxShadow: error
                      ? '0 0 0 3px rgba(239,68,68,0.08)'
                      : focused
                        ? '0 0 0 3px rgba(99,102,241,0.10)'
                        : 'none',
                  }}
                >
                  {/* GitHub mark */}
                  <span className="absolute left-3.5 pointer-events-none">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"
                      className={`transition-colors ${focused ? 'text-indigo-500' : 'text-gray-400'}`}>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577
                        0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755
                        -1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305
                        3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38
                        1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399
                        3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873
                        .12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81
                        2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24
                        12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </span>

                  <input
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError('') }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="https://github.com/owner/repo/issues/42"
                    className="w-full pl-10 pr-4 py-3 bg-transparent text-gray-800 text-sm
                               placeholder-gray-400 outline-none rounded-xl"
                    autoFocus
                    disabled={loading}
                  />

                  {/* Valid URL checkmark */}
                  {isValidUrl && !error && (
                    <span className="absolute right-3.5">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-500">
                        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
                        <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
                      <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="currentColor"
                        strokeWidth="1.2" strokeLinecap="round"/>
                      <circle cx="6" cy="8.5" r="0.6" fill="currentColor"/>
                    </svg>
                    {error}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!url || loading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
                  flex items-center justify-center gap-2
                  ${url && !loading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {loading ? (
                  <><SpinnerIcon /><span>Starting agent…</span></>
                ) : (
                  <>
                    Start Agent
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-gray-400 text-xs">what happens next</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Flow preview */}
            <div className="flex items-center justify-between gap-1">
              {['Plan steps', 'Execute in sandbox', 'Open pull request'].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100
                                     flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-indigo-500">{i + 1}</span>
                    </span>
                    <span className="text-gray-500 text-xs truncate">{step}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className="text-gray-300 shrink-0 mx-0.5">
                      <path d="M4 3L8 6L4 9" stroke="currentColor" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-gray-400 text-xs mt-5">
            Devin runs in an isolated Docker sandbox — your machine is never touched.
          </p>

        </div>
      </main>
    </div>
  )
}
