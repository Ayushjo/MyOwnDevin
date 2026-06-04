import { Link, useLocation } from 'react-router-dom'
import Logo from './svgs/Logo'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <Logo size={26} />
          <span className="text-slate-100 font-semibold text-base tracking-tight group-hover:text-white transition-colors">
            devin
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary-light border border-primary/20 uppercase tracking-wide">
            agent
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            to="/dashboard"
            className={`btn-ghost ${pathname === '/dashboard' ? 'text-slate-200' : ''}`}
          >
            Dashboard
          </Link>
          <Link
            to="/tasks/new"
            className="btn-primary ml-2"
          >
            New Task
          </Link>
        </div>
      </div>
    </nav>
  )
}
