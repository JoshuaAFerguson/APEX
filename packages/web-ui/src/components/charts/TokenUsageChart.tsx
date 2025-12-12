'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  estimatedCost?: number
}

interface TokenUsageChartProps {
  usage?: TokenUsage
  className?: string
  showLabels?: boolean
}

export function TokenUsageChart({
  usage,
  className,
  showLabels = true,
}: TokenUsageChartProps) {
  const { inputTokens = 0, outputTokens = 0, totalTokens = 0 } = usage || {}

  // Calculate percentages for the bar chart
  const { inputPercent, outputPercent } = useMemo(() => {
    if (totalTokens === 0) {
      return { inputPercent: 50, outputPercent: 50 }
    }
    return {
      inputPercent: Math.round((inputTokens / totalTokens) * 100),
      outputPercent: Math.round((outputTokens / totalTokens) * 100),
    }
  }, [inputTokens, outputTokens, totalTokens])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  if (!usage || totalTokens === 0) {
    return (
      <div className={cn('text-center py-4 text-foreground-secondary', className)}>
        <p className="text-sm">No usage data yet</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Token Bar Chart */}
      <div className="space-y-2">
        <div className="flex h-8 rounded-md overflow-hidden bg-background-tertiary">
          <div
            className="bg-apex-500 transition-all duration-500"
            style={{ width: `${inputPercent}%` }}
            title={`Input: ${inputTokens.toLocaleString()} tokens`}
          />
          <div
            className="bg-apex-700 transition-all duration-500"
            style={{ width: `${outputPercent}%` }}
            title={`Output: ${outputTokens.toLocaleString()} tokens`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-apex-500" />
              <span className="text-foreground-secondary">Input</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-apex-700" />
              <span className="text-foreground-secondary">Output</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {showLabels && (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-apex-500">
              {formatNumber(inputTokens)}
            </p>
            <p className="text-xs text-foreground-secondary">Input</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-apex-700">
              {formatNumber(outputTokens)}
            </p>
            <p className="text-xs text-foreground-secondary">Output</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(totalTokens)}
            </p>
            <p className="text-xs text-foreground-secondary">Total</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Mini version of token usage chart for cards and lists
 */
export function TokenUsageMini({ usage, className }: { usage?: TokenUsage; className?: string }) {
  const { inputTokens = 0, outputTokens = 0, totalTokens = 0 } = usage || {}

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const inputPercent = totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 50

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-background-tertiary">
        <div
          className="h-full bg-gradient-to-r from-apex-500 to-apex-700"
          style={{ width: `${inputPercent}%` }}
        />
      </div>
      <span className="text-xs text-foreground-secondary shrink-0">
        {formatNumber(totalTokens)}
      </span>
    </div>
  )
}
