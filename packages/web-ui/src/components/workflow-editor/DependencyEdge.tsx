/**
 * Dependency Edge Component
 *
 * Custom React Flow edge component for displaying dependency
 * connections between workflow stages. Shows directional flow
 * and provides delete functionality.
 */

'use client'

import React from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowEdgeData } from '@/types/workflow-editor'

/**
 * Dependency Edge Component
 *
 * Renders a connection between two workflow stages with
 * visual indicators for dependency type and removal capability.
 */
export function DependencyEdge(
  props: Omit<EdgeProps, 'data'> & {
    data: WorkflowEdgeData | undefined
  }
) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props
  // Generate the SVG path for the edge
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Determine edge styling based on dependency type
  const isConditional = data?.isConditional || false

  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(
          "transition-all duration-200",
          selected ? "stroke-apex-500" : "stroke-gray-400",
          isConditional ? "stroke-dashed" : "",
        )}
        style={{
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: isConditional ? '5,5' : 'none',
        }}
      />

      {/* Arrow marker */}
      <defs>
        <marker
          id={`arrowhead-${id}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          className={selected ? "fill-apex-500" : "fill-gray-400"}
        >
          <polygon points="0 0, 10 3.5, 0 7" />
        </marker>
      </defs>

      {/* Edge label with delete button */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {selected && (
            <div className="flex items-center gap-1">
              {/* Conditional indicator */}
              {isConditional && (
                <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  Conditional
                </div>
              )}

              {/* Delete button */}
              <button
                className={cn(
                  "w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full",
                  "flex items-center justify-center transition-colors",
                  "shadow-sm hover:shadow-md"
                )}
                onClick={() => {
                  // This would be handled by the parent component
                  console.log('Delete edge:', id)
                }}
                title="Remove dependency"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}