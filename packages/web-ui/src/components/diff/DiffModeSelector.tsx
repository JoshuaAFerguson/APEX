/**
 * Diff Mode Selector Component
 *
 * Provides UI for switching between unified, split, and inline diff view modes.
 */

'use client'

import React from 'react'
import { AlignLeft, Columns2, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffViewMode, DiffModeSelectorProps } from './types'

const modes: Array<{
  value: DiffViewMode
  icon: typeof AlignLeft
  label: string
  description: string
}> = [
  {
    value: 'unified',
    icon: AlignLeft,
    label: 'Unified',
    description: 'Single column with +/- indicators',
  },
  {
    value: 'split',
    icon: Columns2,
    label: 'Split',
    description: 'Side-by-side old and new files',
  },
  {
    value: 'inline',
    icon: Rows3,
    label: 'Inline',
    description: 'Mixed changes within context',
  },
]

export function DiffModeSelector({
  value,
  onChange,
  className,
}: DiffModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Diff view mode"
      className={cn(
        'inline-flex rounded-md border border-border overflow-hidden bg-background',
        className
      )}
    >
      {modes.map(({ value: mode, icon: Icon, label, description }) => {
        const isSelected = value === mode

        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-describedby={`mode-${mode}-description`}
            onClick={() => onChange(mode)}
            className={cn(
              'px-3 py-2 text-xs flex items-center gap-1.5 transition-colors',
              'border-r border-border last:border-r-0',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
            title={description}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline font-medium">{label}</span>

            {/* Screen reader description */}
            <span id={`mode-${mode}-description`} className="sr-only">
              {description}
            </span>
          </button>
        )
      })}
    </div>
  )
}