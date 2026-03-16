/**
 * Stage Node Component
 *
 * Custom React Flow node component for displaying workflow stages.
 * Shows stage information, status, and provides interaction points
 * for connections and editing.
 */

'use client'

import React, { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  ClipboardList,
  Building2,
  Code,
  FlaskConical,
  SearchCode,
  Rocket,
  BookOpen,
  Search,
  Circle,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StageNodeProps } from '@/types/workflow-editor'
import { STAGE_CATEGORY_COLORS } from '@/lib/workflow-editor/constants'

/**
 * Icon mapping for different stage types
 */
const STAGE_ICONS = {
  'clipboard-list': ClipboardList,
  'building-2': Building2,
  'code': Code,
  'flask-conical': FlaskConical,
  'search-code': SearchCode,
  'rocket': Rocket,
  'book-open': BookOpen,
  'search': Search,
  'circle': Circle,
} as const

/**
 * Stage Node Component
 *
 * Visual representation of a workflow stage with connections,
 * status indicators, and interaction capabilities.
 */
export const StageNode = memo(({ data, selected }: StageNodeProps) => {
  const { stage, isSelected, hasError, errorMessage } = data

  // Determine stage category for styling
  const category = stage.agent === 'planner' ? 'planning' :
                  stage.agent === 'architect' ? 'planning' :
                  stage.agent === 'developer' ? 'development' :
                  stage.agent === 'tester' ? 'testing' :
                  stage.agent === 'reviewer' ? 'review' :
                  stage.agent === 'devops' ? 'deployment' :
                  'development'

  const colors = STAGE_CATEGORY_COLORS[category]

  // Get appropriate icon (default to circle if not found)
  const IconComponent = STAGE_ICONS['circle'] // Default icon for now

  return (
    <div className={cn(
      "relative bg-white rounded-lg border-2 shadow-sm min-w-[280px]",
      "transition-all duration-200 hover:shadow-md",
      colors.border,
      selected || isSelected ? "ring-2 ring-apex-500 shadow-lg" : "",
      hasError ? "border-red-300 bg-red-50" : ""
    )}>
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-gray-300 bg-white hover:border-apex-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-300 bg-white hover:border-apex-500"
      />

      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-3 rounded-t-lg",
        colors.bg
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            colors.bg
          )}>
            <IconComponent className={cn("w-4 h-4", colors.icon)} />
          </div>
          <h3 className={cn("font-medium text-sm", colors.text)}>
            {stage.name}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {hasError && (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          )}
          <button className={cn(
            "p-1 rounded hover:bg-black/5 transition-colors",
            colors.text
          )}>
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Agent badge */}
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            🤖 {stage.agent}
          </div>
        </div>

        {/* Description */}
        {stage.description && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {stage.description}
          </p>
        )}

        {/* Additional info */}
        <div className="space-y-1">
          {stage.outputs && stage.outputs.length > 0 && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Outputs:</span>{' '}
              {stage.outputs.join(', ')}
            </div>
          )}

          {stage.gate && (
            <div className="text-xs text-orange-600">
              <span className="font-medium">Gate:</span> {stage.gate}
            </div>
          )}

          {stage.condition && (
            <div className="text-xs text-blue-600">
              <span className="font-medium">Condition:</span> {stage.condition}
            </div>
          )}

          {stage.parallel && (
            <div className="text-xs text-purple-600 font-medium">
              Parallel execution
            </div>
          )}
        </div>

        {/* Error message */}
        {hasError && errorMessage && (
          <div className="text-xs text-red-600 bg-red-50 rounded p-2 border border-red-200">
            {errorMessage}
          </div>
        )}

        {/* Dependencies indicator */}
        {stage.dependsOn && stage.dependsOn.length > 0 && (
          <div className="text-xs text-gray-400 border-t pt-2">
            Depends on: {stage.dependsOn.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
})

StageNode.displayName = 'StageNode'