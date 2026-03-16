/**
 * Workflow Editor Component
 *
 * Main container component for the Visual Workflow Editor.
 * Orchestrates all sub-components and provides the complete
 * workflow editing experience.
 */

'use client'

import React, { useState } from 'react'
import { DndContext, DragOverlay, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { WorkflowEditorProps, StageTemplate } from '@/types/workflow-editor'
import { cn } from '@/lib/utils'
import { WorkflowEditorProvider, useWorkflowEditorContext } from './WorkflowEditorProvider'
import { EditorToolbar } from './EditorToolbar'
import { StagePalette } from './StagePalette'
import { EditorCanvas } from './EditorCanvas'
import { PropertiesPanel } from './PropertiesPanel'
import { YamlPreviewPanel } from './YamlPreviewPanel'

/**
 * Internal Editor Content Component
 *
 * Contains the main editor layout and drag-and-drop logic.
 * Separated from WorkflowEditor to access the context.
 */
function WorkflowEditorContent({
  onSave,
  onExport,
  readOnly = false,
  className,
}: Omit<WorkflowEditorProps, 'initialWorkflow'>) {
  const {
    state,
    addStage,
    updateStage,
    updateWorkflowMetadata,
    exportYaml,
  } = useWorkflowEditorContext()

  // UI state
  const [showYamlPreview, setShowYamlPreview] = useState(true)
  const [draggedTemplate, setDraggedTemplate] = useState<StageTemplate | null>(null)

  // Handle drag start from palette
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event

    if (active.data.current?.type === 'palette-template') {
      setDraggedTemplate(active.data.current.template as StageTemplate)
    }
  }

  // Handle drag end (drop on canvas)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Reset dragged template
    setDraggedTemplate(null)

    // Check if dropped on canvas
    if (over?.id === 'workflow-canvas' && active.data.current?.type === 'palette-template') {
      const template = active.data.current.template as StageTemplate

      // Calculate drop position (would get from mouse position in real implementation)
      const position = { x: 100, y: 100 }

      addStage(template, position)
    }
  }

  // Handle save action
  const handleSave = () => {
    if (onSave) {
      onSave(state.workflow)
    }
  }

  // Handle export action
  const handleExport = () => {
    const yaml = exportYaml()
    if (onExport) {
      onExport(yaml)
    }
  }

  return (
    <div className={cn(
      "h-screen flex flex-col bg-gray-50",
      className
    )}>
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Toolbar */}
        <EditorToolbar
          onSave={handleSave}
          showYamlPreview={showYamlPreview}
          onToggleYamlPreview={() => setShowYamlPreview(!showYamlPreview)}
        />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Stage palette */}
          {!readOnly && <StagePalette />}

          {/* Canvas area */}
          <div className="flex-1 flex flex-col">
            {/* Canvas */}
            <div className="flex-1 p-4">
              <EditorCanvas />
            </div>

            {/* YAML preview (bottom panel) */}
            {showYamlPreview && (
              <div className="border-t border-gray-200 p-4">
                <YamlPreviewPanel />
              </div>
            )}
          </div>

          {/* Properties panel */}
          <PropertiesPanel
            selectedStageId={state.selectedStageId}
            selectedGateId={state.selectedGateId}
            onStageUpdate={updateStage}
            onGateUpdate={(gateId, updates) => {
              // TODO: Implement gate updates
              console.log('Update gate:', gateId, updates)
            }}
            onWorkflowUpdate={updateWorkflowMetadata}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedTemplate ? (
            <div className="p-3 bg-white rounded-lg border-2 border-apex-300 shadow-lg opacity-90">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-apex-100 rounded flex items-center justify-center">
                  <span className="text-apex-600 text-xs">🧩</span>
                </div>
                <span className="font-medium text-sm">{draggedTemplate.name}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Keyboard shortcuts overlay */}
      <div className="fixed bottom-4 right-4 bg-black/75 text-white text-xs rounded-lg p-3 space-y-1 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div><kbd>Ctrl+S</kbd> Save</div>
        <div><kbd>Ctrl+Z</kbd> Undo</div>
        <div><kbd>Ctrl+Y</kbd> Redo</div>
        <div><kbd>Ctrl+E</kbd> Export</div>
        <div><kbd>Del</kbd> Delete selected</div>
      </div>
    </div>
  )
}

/**
 * Main Workflow Editor Component
 *
 * Complete visual workflow editor with drag-and-drop,
 * properties editing, and YAML import/export.
 */
export function WorkflowEditor({
  initialWorkflow,
  onSave,
  onExport,
  readOnly = false,
  className,
}: WorkflowEditorProps) {
  return (
    <WorkflowEditorProvider
      initialWorkflow={initialWorkflow}
      onSave={onSave}
    >
      <WorkflowEditorContent
        onSave={onSave}
        onExport={onExport}
        readOnly={readOnly}
        className={className}
      />
    </WorkflowEditorProvider>
  )
}