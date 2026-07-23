import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { TaskMetricsSnapshot } from '../types/task'
import { fadeUp, stagger } from '../lib/motion'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function useCountUp(target: number, enabled: boolean, duration = 500) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    setValue(0)
    const start = performance.now()
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, enabled, duration])

  return value
}

function StatChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <motion.div variants={fadeUp} className="min-w-0">
      <p className="text-[10px] text-mute uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-sm font-bold font-mono tabular-nums ${warn ? 'text-red-600' : 'text-ink'}`}>{value}</p>
    </motion.div>
  )
}

function PhaseBar({ phases }: { phases: Record<string, { durationMs: number }> }) {
  const entries = Object.entries(phases)
  const total = entries.reduce((s, [, p]) => s + p.durationMs, 0)
  if (total === 0 || entries.length === 0) return null

  const COLORS = ['#2DA54A', '#3FB950', '#1A7F37', '#BF8700', '#CF222E', '#636C76']

  return (
    <div className="mt-3">
      <p className="text-[10px] text-mute uppercase tracking-wider font-medium mb-1.5">Phase Timeline</p>
      <div className="flex rounded-full overflow-hidden h-2 gap-px">
        {entries.map(([phase, pm], i) => {
          const pct = (pm.durationMs / total) * 100
          return (
            <motion.div
              key={phase}
              title={`${phase}: ${formatDuration(pm.durationMs)}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
              style={{ background: COLORS[i % COLORS.length] }}
              className="h-full first:rounded-l-full last:rounded-r-full"
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {entries.map(([phase, pm], i) => (
          <div key={phase} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-[10px] text-faint capitalize">{phase} {formatDuration(pm.durationMs)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BudgetBar({ used, limit }: { used: number; limit: number }) {
  if (!limit || limit <= 0) return null
  const pct = Math.min(100, (used / limit) * 100)
  const warn = pct >= 80
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-mute uppercase tracking-wider font-medium mb-1">
        <span>Task Budget</span>
        <span className={warn ? 'text-red-600' : ''}>${used.toFixed(4)} / ${limit.toFixed(2)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-line overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${warn ? 'bg-red-500' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  )
}

export default function MetricsPanel({ metrics, isRunning }: {
  metrics: TaskMetricsSnapshot | null
  isRunning: boolean
}) {
  if (!metrics && !isRunning) return null

  const llmCalls  = useCountUp(metrics?.llmCalls  ?? 0, !!metrics)
  const toolCalls = useCountUp(metrics?.toolCalls ?? 0, !!metrics)
  const retries   = useCountUp(metrics?.retries   ?? 0, !!metrics)
  const failovers = metrics?.providerFailovers ?? 0
  const budgetUsed = metrics?.budgetUsedUsd ?? metrics?.costUsd ?? 0
  const budgetLimit = metrics?.budgetLimitUsd ?? 0.25
  const budgetWarn = budgetLimit > 0 && budgetUsed / budgetLimit >= 0.8

  return (
    <div className="bg-canvas border border-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-mute uppercase tracking-wider font-semibold">Metrics</p>
        {isRunning && !metrics && (
          <div className="flex items-center gap-1.5 text-faint text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Collecting…
          </div>
        )}
      </div>

      {metrics ? (
        <>
          <motion.div
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className="grid grid-cols-4 sm:grid-cols-10 gap-3"
          >
            <StatChip label="Duration"    value={formatDuration(metrics.durationMs)} />
            <StatChip label="LLM Calls"   value={String(llmCalls)} />
            <StatChip label="Tool Calls"  value={String(toolCalls)} />
            <StatChip label="Retries"     value={String(retries)} />
            <StatChip label="Failovers"   value={String(failovers)} />
            <StatChip label="In Tokens"   value={formatTokens(metrics.inputTokens)} />
            <StatChip label="Out Tokens"  value={formatTokens(metrics.outputTokens)} />
            <StatChip label="Cost"        value={`$${metrics.costUsd.toFixed(4)}`} warn={budgetWarn} />
            <StatChip label="Shadow"      value={`$${metrics.shadowCostUsd.toFixed(4)}`} />
            {metrics.orgBudgetRemainingUsd !== undefined && (
              <StatChip label="Org Left" value={`$${metrics.orgBudgetRemainingUsd.toFixed(2)}`} />
            )}
          </motion.div>
          <BudgetBar used={budgetUsed} limit={budgetLimit} />
          {Object.keys(metrics.phases).length > 0 && (
            <PhaseBar phases={metrics.phases} />
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 text-faint text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Waiting for first metrics…
        </div>
      )}
    </div>
  )
}
