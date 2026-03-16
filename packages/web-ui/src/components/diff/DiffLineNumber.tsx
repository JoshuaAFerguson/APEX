/**
 * Diff Line Number Component
 *
 * Displays line numbers for diff lines with proper styling and accessibility.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { DiffLineNumberProps } from './types'

export function DiffLineNumber({
  number,
  type = 'normal',
  className,
}: DiffLineNumberProps) {
  return (
    <div
      className={cn(
        'w-12 flex-shrink-0 px-2 text-right text-xs leading-6',
        'border-r border-border/50 bg-background/50',
        'text-muted-foreground select-none',
        type === 'empty' && 'text-transparent',
        className
      )}
      aria-label={type === 'empty' ? undefined : `Line ${number}`}
    >
      {type === 'empty' ? '' : (number || '')}
    </div>
  )
}