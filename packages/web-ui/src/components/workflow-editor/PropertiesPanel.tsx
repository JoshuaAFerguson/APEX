/**
 * Properties Panel Component
 *
 * Panel for editing properties of selected workflow stages,
 * gates, and workflow metadata. Switches between different
 * forms based on the current selection.
 */

'use client'

import React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PropertiesPanelProps } from '@/types/workflow-editor'
import { useWorkflowEditorContext } from './WorkflowEditorProvider'
import { StagePropertiesForm } from './StagePropertiesForm'
import { WorkflowPropertiesForm } from './WorkflowPropertiesForm'

/**
 * Properties Panel Component
 *
 * Dynamic panel that shows different forms based on the current selection.
 */
export function PropertiesPanel({
  selectedStageId,
  selectedGateId,
  onStageUpdate,
  onGateUpdate,
  onWorkflowUpdate,
  className,
}: PropertiesPanelProps) {
  const { state, selectStage } = useWorkflowEditorContext()

  // Find selected stage if any
  const selectedStage = selectedStageId
    ? state.workflow.stages.find(s => s.name === selectedStageId)
    : null

  // Find selected gate if any
  const selectedGate = selectedGateId
    ? state.workflow.gates?.find(g => g.id === selectedGateId)
    : null

  // Handle closing the panel
  const handleClose = () => {
    selectStage(null)
  }

  // Determine what to show
  const showStageForm = selectedStage && selectedStageId
  const showGateForm = selectedGate && selectedGateId
  const showWorkflowForm = !showStageForm && !showGateForm

  return (
    <div className={cn(
      "w-96 bg-white border-l border-gray-200 flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">
          {showStageForm && 'Stage Properties'}
          {showGateForm && 'Gate Properties'}
          {showWorkflowForm && 'Workflow Properties'}
        </h2>

        {(showStageForm || showGateForm) && (
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showStageForm && selectedStage && (
          <StagePropertiesForm
            stage={selectedStage}
            onUpdate={(updates) => onStageUpdate(selectedStageId!, updates)}
            allStageNames={state.workflow.stages.map(s => s.name)}
          />
        )}

        {showGateForm && selectedGate && (
          <div className="p-4">
            <div className="text-sm text-gray-600">
              Gate properties form would go here
            </div>
          </div>
        )}

        {showWorkflowForm && (
          <WorkflowPropertiesForm
            workflow={state.workflow}
            onUpdate={onWorkflowUpdate}
          />
        )}
      </div>

      {/* Footer with validation errors */}
      {state.validationErrors.length > 0 && (
        <div className="border-t border-gray-200 bg-red-50">
          <div className="p-4">
            <h3 className="font-medium text-red-800 text-sm mb-2">
              Validation Issues
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {state.validationErrors.map((error, index) => (
                <div key={index} className="text-xs text-red-700">
                  <span className="font-medium">
                    {error.type === 'error' ? '❌' : '⚠️'}
                  </span>{' '}
                  {error.message}
                  {error.stageId && (
                    <span className="text-red-600 ml-1">
                      (in {error.stageId})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}