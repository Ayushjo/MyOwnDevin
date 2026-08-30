import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import TaskCard from '../components/TaskCard'
import { searchTasks, type StoredTask } from '../api/client'
import type { TaskStatus } from '../types/task'

type Filter = 'all' | TaskStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'done',    label: 'Completed' },
  { key: 'failed',  label: 'Failed' },
]

export default function History() {
  const [filter, setFilter] = useState<Filter>('all')
  const [allTasks, setAllTasks] = useState<StoredTask[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetchTasks = async () => {
      const response = await searchTasks(searchQuery, 10)
      setAllTasks(response.tasks)
      setTotal(response.total)
    }
    fetchTasks()
  }, [searchQuery])

  const filtered = filter === 'all'
    ? allTasks
    : allTasks.filter(t => t.status === filter)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">History</h1>
            <p className="text-slate-500 text-sm mt-0.5">All completed tasks</p>
          </div>
          <Link to="/tasks/new" className="btn-primary">+ New Task</Link>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search tasks..."
          className="mb-4 p-2 border rounded"
        />

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

        <div className="grid grid-cols-1 gap-4">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {/* Pagination controls */}
        <div className="flex justify-between mt-4">
          <button onClick={() => setOffset(Math.max(0, offset - 10))} disabled={offset === 0}>Previous</button>
          <button onClick={() => setOffset(offset + 10)} disabled={offset + 10 >= total}>Next</button>
        </div>
      </main>
    </div>
  )
}