/**
 * Stage Palette Component
 *
 * Draggable palette of stage templates that users can drag
 * onto the canvas to create new workflow stages.
 */

'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StagePaletteProps, StageTemplate } from '@/types/workflow-editor'
import { STAGE_TEMPLATES, STAGE_CATEGORY_COLORS } from '@/lib/workflow-editor/constants'

/**
 * Icon mapping for stage templates
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
 * Draggable Stage Template Item
 */
function DraggablePaletteItem({ template }: { template: StageTemplate }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `palette-${template.id}`,
    data: {
      type: 'palette-template',
      template,
    },
  })

  const colors = STAGE_CATEGORY_COLORS[template.category]
  const IconComponent = STAGE_ICONS[template.icon as keyof typeof STAGE_ICONS] || Circle

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-3 bg-white rounded-lg border-2 cursor-grab active:cursor-grabbing",
        "transition-all duration-200 hover:shadow-md select-none",
        colors.border,
        isDragging ? "opacity-50 rotate-2 scale-105 shadow-lg z-50" : "hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          colors.bg
        )}>
          <IconComponent className={cn("w-4 h-4", colors.icon)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={cn("font-medium text-sm", colors.text)}>
              {template.name}
            </h3>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {template.agent}
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {template.description}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Stage Palette Component
 *
 * Container for draggable stage templates organized by category.
 */
export function StagePalette({
  templates = STAGE_TEMPLATES,
  className,
}: StagePaletteProps) {
  // Group templates by category
  const templatesByCategory = React.useMemo(() => {
    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    }, {} as Record<string, StageTemplate[]>)

    // Define category order and labels
    const categoryOrder = [
      'planning',
      'development',
      'testing',
      'review',
      'deployment',
    ] as const

    const categoryLabels = {
      planning: 'Planning',
      development: 'Development',
      testing: 'Testing',
      review: 'Review',
      deployment: 'Deployment',
    } as const

    return categoryOrder.map(category => ({
      category,
      label: categoryLabels[category],
      templates: grouped[category] || [],
    })).filter(group => group.templates.length > 0)
  }, [templates])

  return (
    <div className={cn(
      "w-80 bg-white border-r border-gray-200 overflow-y-auto",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Stage Templates</h2>
        <p className="text-sm text-gray-600 mt-1">
          Drag stages to the canvas to build your workflow
        </p>
      </div>

      {/* Template categories */}
      <div className="p-4 space-y-6">
        {templatesByCategory.map(({ category, label, templates }) => (
          <div key={category} className="space-y-3">
            {/* Category header */}
            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">
              {label}
            </h3>

            {/* Template items */}
            <div className="space-y-2">
              {templates.map((template) => (
                <DraggablePaletteItem
                  key={template.id}
                  template={template}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <div className="text-xs text-gray-600 space-y-1">
          <p>💡 <strong>Tip:</strong> Drag any template to the canvas</p>
          <p>🔗 Connect stages by dragging from the right handle to the left handle</p>
          <p>✏️ Click on a stage to edit its properties</p>
        </div>
      </div>
    </div>
  )
}