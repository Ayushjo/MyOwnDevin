import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import TaskCard from '../components/TaskCard'
import { getTasks, type StoredTask } from '../store/taskStore'
import type { TaskStatus } from '../types/task'

type Filter = 'all' | TaskStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'done',    label: 'Completed' },
  { key: 'failed',  label: 'Failed' },
]

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Empty terminal SVG */}
      <svg width="72" height="56" viewBox="0 0 72 56" fill="none" className="mb-5 opacity-30">
        <rect x="1" y="1" width="70" height="54" rx="8" stroke="#1E2D42" strokeWidth="2" />
        <rect x="1" y="1" width="70" height="12" rx="8" fill="#0D1320" />
        <circle cx="12" cy="7" r="2" fill="#EF4444" opacity="0.5" />
        <circle cx="20" cy="7" r="2" fill="#F59E0B" opacity="0.5" />
        <circle cx="28" cy="7" r="2" fill="#10B981" opacity="0.5" />
        <line x1="12" y1="28" x2="28" y2="28" stroke="#1E2D42" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="36" x2="40" y2="36" stroke="#1E2D42" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="44" x2="22" y2="44" stroke="#1E2D42" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="text-slate-400 font-medium mb-1">No tasks yet</p>
      <p className="text-slate-600 text-sm mb-6">Submit a GitHub issue to get started.</p>
      <Link to="/tasks/new" className="btn-primary">Submit first issue →</Link>
    </div>
  )
}

export default function Dashboard() {
  const [filter,   setFilter]   = useState<Filter>('all')
  const [allTasks, setAllTasks] = useState<StoredTask[]>([])

  // Load from localStorage on mount; re-read when the user navigates back here.
  useEffect(() => {
    setAllTasks(getTasks())
  }, [])

  const filtered = filter === 'all'
    ? allTasks
    : allTasks.filter(t => t.status === filter)

  const stats = [
    { label: 'Total',     value: allTasks.length,                                     color: 'text-slate-200' },
    { label: 'Running',   value: allTasks.filter(t => t.status === 'running').length,  color: 'text-warning'   },
    { label: 'Completed', value: allTasks.filter(t => t.status === 'done').length,     color: 'text-success'   },
    { label: 'Failed',    value: allTasks.filter(t => t.status === 'failed').length,   color: 'text-danger'    },
  ]

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Tasks</h1>
            <p className="text-slate-500 text-sm mt-0.5">All agent runs and their status</p>
          </div>
          <Link to="/tasks/new" className="btn-primary">+ New Task</Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-surface border border-subtle rounded-xl p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 bg-surface border border-subtle rounded-lg p-1 w-fit">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150
                ${filter === f.key
                  ? 'bg-elevated text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {allTasks.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm py-12 text-center">
            No {filter} tasks.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}

      </main>
    </div>
  )
}
