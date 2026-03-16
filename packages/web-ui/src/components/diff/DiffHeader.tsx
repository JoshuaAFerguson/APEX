/**
 * Diff Header Component
 *
 * Displays file paths and change status (new, deleted, renamed).
 */

'use client'

import React from 'react'
import { FileText, FilePlus, FileX, FileEdit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { DiffHeaderProps } from './types'

export function DiffHeader({
  oldPath,
  newPath,
  isNew,
  isDeleted,
  isRenamed,
  className,
}: DiffHeaderProps) {
  const getIcon = () => {
    if (isNew) return FilePlus
    if (isDeleted) return FileX
    if (isRenamed) return FileEdit
    return FileText
  }

  const getStatus = () => {
    if (isNew) return { text: 'New file', variant: 'success' as const }
    if (isDeleted) return { text: 'Deleted', variant: 'error' as const }
    if (isRenamed) return { text: 'Renamed', variant: 'warning' as const }
    return { text: 'Modified', variant: 'info' as const }
  }

  const Icon = getIcon()
  const status = getStatus()
  const displayPath = newPath !== '/dev/null' ? newPath : oldPath

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-foreground truncate">
            {displayPath}
          </span>
          <Badge variant={status.variant} className="text-xs">
            {status.text}
          </Badge>
        </div>

        {isRenamed && oldPath !== newPath && (
          <div className="text-xs text-muted-foreground mt-1">
            <span>Renamed from </span>
            <span className="font-mono">{oldPath}</span>
          </div>
        )}
      </div>
    </div>
  )
}