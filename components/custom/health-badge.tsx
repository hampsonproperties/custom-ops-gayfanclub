'use client'

import type { HealthLevel } from '@/lib/utils/health-scoring'

const styles: Record<HealthLevel, { dot: string; text: string; label: string }> = {
  healthy: {
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    label: 'Healthy',
  },
  'at-risk': {
    dot: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'At Risk',
  },
  dormant: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    label: 'Dormant',
  },
}

interface HealthBadgeProps {
  level: HealthLevel
  reason?: string
  showLabel?: boolean
}

export function HealthBadge({ level, reason, showLabel = false }: HealthBadgeProps) {
  const style = styles[level]

  return (
    <span className="inline-flex items-center gap-1.5" title={reason || style.label}>
      <span className={`h-2 w-2 rounded-full ${style.dot} flex-shrink-0`} />
      {showLabel && (
        <span className={`text-xs font-medium ${style.text}`}>
          {style.label}
        </span>
      )}
    </span>
  )
}

/** Compact dot-only version for table cells */
export function HealthDot({ level, reason }: { level: HealthLevel; reason?: string }) {
  const style = styles[level]
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.dot}`} title={reason || style.label} />
  )
}
