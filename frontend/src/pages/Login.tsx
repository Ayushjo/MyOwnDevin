import { useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Link2, Box, GitPullRequest } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Separator, useToast } from '../components/ui'
import Logo, { LogoIcon } from '../components/svgs/Logo'
import { fadeUp, stagger } from '../lib/motion'

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

/** What Pullwright actually does — factual, no fake UI */
const CAPABILITIES = [
  {
    icon: Link2,
    title: 'Paste an issue URL',
    desc: 'Any public or private repo you have access to.',
  },
  {
    icon: Box,
    title: 'Agent runs in Docker',
    desc: 'Code changes happen in isolation — not on your machine.',
  },
  {
    icon: GitPullRequest,
    title: 'You get a real PR',
    desc: 'Review the diff, request changes, merge when ready.',
  },
]

function BrandAside() {
  return (
    <aside className="hidden lg:flex lg:flex-1 bg-ink text-white relative overflow-hidden">
      {/* Soft brand watermark — decorative only */}
      <div className="absolute -bottom-16 -right-16 opacity-[0.04] pointer-events-none select-none">
        <LogoIcon size={280} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-2xl mx-auto px-12 xl:px-16 py-12">
        <Link to="/" className="shrink-0 w-fit">
          <Logo height={32} variant="inverse" linked={false} />
        </Link>

        <div className="flex-1 flex flex-col justify-center py-16">
          <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="max-w-md">
            <motion.h1
              variants={fadeUp}
              className="text-[2.35rem] xl:text-[2.65rem] font-bold leading-[1.12] tracking-tight text-white"
            >
              GitHub issues → pull requests.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-white/45 text-base leading-relaxed mt-5">
              Pullwright reads an issue, plans the work, executes in a sandbox, and opens a pull request on your repo.
            </motion.p>

            <motion.ul variants={fadeUp} className="mt-10 space-y-6">
              {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-4">
                  <div className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-white/50" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/85">{title}</p>
                    <p className="text-sm text-white/35 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </motion.ul>

            <motion.p
              variants={fadeUp}
              className="mt-10 font-mono text-xs text-white/20 tracking-wide"
            >
              github.com/owner/repo/issues/42
            </motion.p>
          </motion.div>
        </div>

        <p className="text-white/20 text-xs shrink-0">Open source · MIT</p>
      </div>
    </aside>
  )
}

export default function Login() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { push: pushToast } = useToast()

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (!loading && user) {
      navigate(from === '/login' ? '/dashboard' : from, { replace: true })
    }
  }, [user, loading, from, navigate])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const err = params.get('error')
    if (err) {
      pushToast(
        err === 'access_denied'
          ? 'GitHub access was denied. Please try again.'
          : `Sign-in error: ${err}`,
        'error',
      )
    }
  }, [location.search, pushToast])

  return (
    <div className="min-h-screen bg-canvas flex">
      <BrandAside />

      <main className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col justify-center px-6 sm:px-10 py-12 bg-paper border-l border-line">
        {/* Mobile: show product context without fake UI */}
        <div className="lg:hidden mb-10 max-w-sm mx-auto w-full">
          <Link to="/" className="inline-block mb-6">
            <Logo height={30} />
          </Link>
          <h1 className="text-2xl font-bold text-ink tracking-tight leading-snug">
            GitHub issues → pull requests.
          </h1>
          <p className="text-sm text-mute mt-2 leading-relaxed">
            Sign in to run the agent on your repos.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm mx-auto"
        >
          <div className="hidden lg:block mb-8">
            <h2 className="text-xl font-semibold text-ink">Sign in</h2>
            <p className="text-sm text-mute mt-1.5">
              Connect your GitHub account to continue.
            </p>
          </div>

          <Button
            variant="dark"
            size="lg"
            className="w-full rounded-lg justify-center gap-2.5"
            onClick={() => login(from === '/login' ? '/dashboard' : from)}
            disabled={loading}
            loading={loading}
          >
            <GithubMark className="w-5 h-5" />
            Continue with GitHub
          </Button>

          <div className="flex items-center gap-3 my-6">
            <Separator className="flex-1" />
            <span className="text-[10px] text-faint uppercase tracking-wider">OAuth 2.0</span>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-2 text-xs text-mute leading-relaxed">
            <p>Read/write access to repos you choose.</p>
            <p>Token encrypted at rest — never logged.</p>
            <p>Sign out anytime from the nav menu.</p>
          </div>

          <p className="text-center text-faint text-xs mt-8">
            <Link to="/" className="text-accent hover:underline inline-flex items-center gap-1">
              Back to homepage <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  )
}
