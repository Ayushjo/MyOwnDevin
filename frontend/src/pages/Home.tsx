import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import HeroFlow from '../components/svgs/HeroFlow'
import SandboxIcon from '../components/svgs/SandboxIcon'
import PlannerIcon from '../components/svgs/PlannerIcon'
import StreamIcon from '../components/svgs/StreamIcon'
import PRIcon from '../components/svgs/PRIcon'

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Drop the issue',
    body: 'Paste any GitHub issue URL. Devin reads the title, description, and context to understand the problem.',
  },
  {
    num: '02',
    title: 'Watch it think',
    body: 'Claude breaks the issue into ordered steps. Each step is executed inside an isolated Docker sandbox with full tool access.',
  },
  {
    num: '03',
    title: 'Review the PR',
    body: 'Once all steps pass verification, Devin pushes the branch and opens a pull request. You just review and merge.',
  },
]

const FEATURES = [
  {
    icon: <SandboxIcon size={36} />,
    title: 'Sandboxed execution',
    body: 'Code runs in an isolated Docker container — no internet access, memory-capped, resource-limited. Nothing touches your machine.',
  },
  {
    icon: <PlannerIcon size={36} />,
    title: 'AI-driven planning',
    body: 'Claude breaks each issue into an ordered sequence of verifiable steps before writing a single line of code.',
  },
  {
    icon: <StreamIcon size={36} />,
    title: 'Live streaming',
    body: 'Every tool call, shell command, and verification step streams to your browser in real time via SSE.',
  },
  {
    icon: <PRIcon size={36} />,
    title: 'Automated PRs',
    body: 'When all steps pass, Devin pushes the fix to a dedicated branch and opens a pull request on your repo automatically.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden dot-grid">
        <div className="hero-glow absolute inset-0 pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-32 w-full grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10
              border border-primary/25 text-primary-light text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              AI Coding Agent
            </span>
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-5">
              Your codebase.<br />
              <span className="text-primary-light">Fixed.</span> Autonomously.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-md">
              Submit a GitHub issue. Devin plans, executes, and opens a pull request.
              You just review.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/tasks/new" className="btn-primary text-base px-6 py-3">
                Submit an issue →
              </Link>
              <Link to="/dashboard" className="btn-ghost text-base">
                View tasks
              </Link>
            </div>
          </div>

          {/* Right — animated flow */}
          <div className="flex flex-col items-center gap-4">
            <HeroFlow />
            <p className="text-slate-600 text-xs text-center max-w-xs">
              Issue → Plan → Sandbox execution → Pull request
            </p>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-base to-transparent pointer-events-none" />
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">How it works</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Three steps from bug report to merged fix.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(item => (
            <div key={item.num} className="relative bg-surface border border-subtle rounded-2xl p-6 card-hover">
              <span className="text-5xl font-bold text-primary/10 absolute top-4 right-5 select-none">
                {item.num}
              </span>
              <h3 className="text-white font-semibold mb-2 text-base">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-12 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Built for reliability</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Every layer is designed to be auditable, recoverable, and safe.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-surface border border-subtle rounded-2xl p-6 card-hover flex gap-4">
              <div className="flex-shrink-0 mt-0.5">{f.icon}</div>
              <div>
                <h3 className="text-white font-semibold mb-1.5 text-sm">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-subtle">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-slate-600 text-xs">Devin Agent — local AI dev</span>
          <span className="text-slate-700 text-xs">Powered by Claude</span>
        </div>
      </footer>
    </div>
  )
}
