import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, History, Plus, LogOut } from 'lucide-react'
import Logo from './svgs/Logo'
import Button from './ui/Button'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history', label: 'History', icon: History },
]

function UserMenu() {
  const { user, login, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) {
    return (
      <Button variant="dark" size="sm" onClick={() => login()} className="rounded-lg gap-2">
        <GithubMark className="w-4 h-4" />
        Sign in
      </Button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 rounded-lg border border-line bg-paper pl-1 pr-2.5 py-1 hover:bg-canvas transition-colors"
      >
        <img src={user.avatarUrl} alt={user.login} className="w-6 h-6 rounded-md" />
        <span className="text-sm font-medium text-ink max-w-[88px] truncate hidden sm:inline">{user.login}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1.5 w-48 bg-paper border border-line rounded-lg shadow-lift p-1 z-50"
          >
            <div className="px-2.5 py-2 border-b border-line mb-0.5">
              <p className="text-sm font-medium text-ink truncate">{user.name ?? user.login}</p>
              <p className="text-xs text-mute truncate">@{user.login}</p>
            </div>
            <button
              onClick={() => void logout()}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-mute hover:text-danger hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function TopNav() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 glass border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        <Logo height={32} />

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
                  active
                    ? 'text-ink bg-canvas'
                    : 'text-mute hover:text-ink hover:bg-canvas/60',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/tasks/new" className="hidden sm:block">
            <Button size="sm" className="rounded-lg gap-1.5">
              <Plus className="w-4 h-4" />
              New Task
            </Button>
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

export default function AppShell({
  children,
  maxWidth = 'max-w-6xl',
}: {
  children: ReactNode
  maxWidth?: string
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <TopNav />
      <main className={cn('mx-auto px-4 sm:px-6 pt-8 pb-16', maxWidth)}>{children}</main>
    </div>
  )
}
