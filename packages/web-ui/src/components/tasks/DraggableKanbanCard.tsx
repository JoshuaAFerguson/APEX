'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { Task } from '@apexcli/core'

interface DraggableKanbanCardProps {
  task: Task
  children: React.ReactNode
  isDragOverlay?: boolean
  className?: string
}

/**
 * Wrapper component that makes a KanbanCard draggable
 */
export function DraggableKanbanCard({
  task,
  children,
  isDragOverlay = false,
  className
}: DraggableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isDragOverlay, // Disable dragging for overlay
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined

  // Check if task can be dragged
  const isDraggable = !task.error && task.status !== 'completed'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        className,
        // Add visual feedback during dragging
        isDragging && "opacity-50 rotate-3 scale-105 z-50",
        // Add cursor and hover states for draggable cards
        isDraggable && "cursor-grab active:cursor-grabbing",
        // Disable dragging for non-draggable cards
        !isDraggable && "cursor-default",
        // Overlay specific styles
        isDragOverlay && "shadow-lg scale-105 rotate-3"
      )}
      {...(isDraggable ? attributes : {})}
      {...(isDraggable ? listeners : {})}
    >
      {children}
    </div>
  )
}