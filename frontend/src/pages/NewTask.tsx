import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { createTask } from '../api/client'
import { addTask } from '../store/taskStore'

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-slate-500">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577
        0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755
        -1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305
        3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38
        1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399
        3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873
        .12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81
        2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24
        12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const STEPS_PREVIEW = ['Plan steps', 'Execute in sandbox', 'Open pull request']

/** Extract issue number + owner/repo from a GitHub issue URL. */
function parseGitHubUrl(url: string) {
  const numMatch  = url.match(/\/issues\/(\d+)/)
  const repoMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/issues/)
  return {
    issueNumber: numMatch  ? parseInt(numMatch[1]!)  : 0,
    repoName:    repoMatch ? repoMatch[1]!           : 'unknown',
  }
}

export default function NewTask() {
  const [url,     setUrl]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const isValidUrl = /github\.com\/.+\/.+\/issues\/\d+/.test(url)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!isValidUrl) {
      setError('Please enter a valid GitHub issue URL, e.g. https://github.com/owner/repo/issues/42')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { taskId } = await createTask(url)
      const { issueNumber, repoName } = parseGitHubUrl(url)

      // Persist to localStorage so Dashboard can list it without a backend list endpoint.
      addTask({
        id:          taskId,
        issueUrl:    url,
        issueTitle:  `Issue #${issueNumber}`,   // placeholder — updated by useTaskStream once checkpoint exists
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
    <div className="min-h-screen dot-grid flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 pt-14">
        <div className="w-full max-w-lg">

          {/* Back link */}
          <Link to="/dashboard"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-8 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </Link>

          {/* Card */}
          <div className="bg-surface border border-subtle rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-white mb-1.5">Submit an issue</h1>
            <p className="text-slate-500 text-sm mb-7">
              Paste a GitHub issue URL and Devin takes it from here.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  GitHub Issue URL
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <GitHubIcon />
                  </span>
                  <input
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError('') }}
                    placeholder="https://github.com/owner/repo/issues/42"
                    className="input-field pl-10 pr-4 py-3 text-sm"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={!url || loading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
                  flex items-center justify-center gap-2
                  ${url && !loading
                    ? 'bg-primary text-white hover:bg-primary-light hover:shadow-[0_0_24px_rgba(99,102,241,0.4)] hover:-translate-y-0.5'
                    : 'bg-elevated text-slate-600 cursor-not-allowed'}`}
              >
                {loading ? <><SpinnerIcon /> Starting agent...</> : 'Start Agent →'}
              </button>
            </form>

            {/* Mini flow preview */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {STEPS_PREVIEW.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-slate-600 text-xs">{s}</span>
                  {i < STEPS_PREVIEW.length - 1 && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-700">
                      <path d="M4 3L8 6L4 9" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
