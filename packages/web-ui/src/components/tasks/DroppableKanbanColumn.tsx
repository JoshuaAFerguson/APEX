'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableKanbanColumnProps {
  columnId: string
  children: React.ReactNode
  isOver?: boolean
  className?: string
  canAcceptDrop?: boolean
}

/**
 * Wrapper component that makes a KanbanColumn a drop target
 */
export function DroppableKanbanColumn({
  columnId,
  children,
  className,
  canAcceptDrop = true,
}: DroppableKanbanColumnProps) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
    disabled: !canAcceptDrop,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        // Visual feedback when hovering during drag
        isOver && canAcceptDrop && "ring-2 ring-apex-500 bg-apex-500/5 transition-all duration-200",
        // Disabled state
        !canAcceptDrop && "opacity-50"
      )}
    >
      {children}

      {/* Drop indicator overlay */}
      {isOver && canAcceptDrop && (
        <div className="absolute inset-0 border-2 border-dashed border-apex-500 rounded-lg bg-apex-500/10 pointer-events-none z-10 flex items-center justify-center">
          <div className="bg-apex-500 text-white text-xs px-2 py-1 rounded shadow-md font-medium">
            Drop here to update status
          </div>
        </div>
      )}
    </div>
  )
}