/**
 * Workflow Editor Context Provider
 *
 * Provides workflow editor state and operations to child components
 * via React Context. Manages the global state of the editor including
 * workflow definition, validation, and history.
 */

'use client'

import React, { createContext, useContext, useMemo } from 'react'
import type { WorkflowDefinition, WorkflowStage, WorkflowGate } from '@apexcli/core'
import type {
  WorkflowEditorContextValue,
  EditorAction,
  StageTemplate,
  ValidationError,
  WorkflowEditorState,
} from '@/types/workflow-editor'
import { useWorkflowEditor } from '@/hooks/useWorkflowEditor'
import { useWorkflowValidation } from '@/hooks/useWorkflowValidation'
import { useWorkflowYaml } from '@/hooks/useWorkflowYaml'

interface WorkflowEditorProviderProps {
  children: React.ReactNode
  initialWorkflow?: WorkflowDefinition
  onChange?: (workflow: WorkflowDefinition) => void
  onSave?: (workflow: WorkflowDefinition) => void
}

const WorkflowEditorContext = createContext<WorkflowEditorContextValue | null>(null)

/**
 * Workflow Editor Provider Component
 *
 * Wraps the workflow editor with context to provide shared state
 * and operations to all child components.
 */
export function WorkflowEditorProvider({
  children,
  initialWorkflow,
  onChange,
  onSave,
}: WorkflowEditorProviderProps) {
  // Main editor hook
  const editor = useWorkflowEditor({
    initialWorkflow,
    onChange,
  })

  // Validation hook
  const validation = useWorkflowValidation(editor.workflow)

  // YAML operations hook
  const yaml = useWorkflowYaml({
    workflow: editor.workflow,
    onImport: (workflow) => {
      editor.setWorkflow(workflow)
    },
  })

  // Create the context value
  const contextValue = useMemo((): WorkflowEditorContextValue => {
    // Current editor state
    const state: WorkflowEditorState = {
      workflow: editor.workflow,
      nodes: editor.nodes,
      edges: editor.edges,
      selectedStageId: editor.selectedStageId,
      selectedGateId: null, // TODO: Add gate selection support
      isDirty: editor.isDirty,
      validationErrors: [...validation.errors, ...validation.warnings],
      yamlPreview: yaml.yamlPreview,
    }

    // Dispatch function for actions (not fully implemented yet)
    const dispatch = (action: EditorAction) => {
      switch (action.type) {
        case 'ADD_STAGE':
          editor.addStage({
            id: action.stage.name || 'untitled-stage',
            name: action.stage.name || 'Untitled Stage',
            agent: action.stage.agent || 'default',
            description: action.stage.description || '',
            icon: 'circle',
            category: 'development',
          }, action.position)
          break
        case 'REMOVE_STAGE':
          editor.removeStage(action.stageId)
          break
        case 'UPDATE_STAGE':
          editor.updateStage(action.stageId, action.updates)
          break
        case 'ADD_DEPENDENCY':
          // Use internal method from editor
          break
        case 'REMOVE_DEPENDENCY':
          // Use internal method from editor
          break
        case 'IMPORT_YAML':
          yaml.importYaml(action.yaml)
          break
        default:
          console.warn('Unknown action type:', action)
      }
    }

    return {
      state,
      dispatch,

      // Stage operations
      addStage: editor.addStage,
      removeStage: editor.removeStage,
      updateStage: editor.updateStage,
      selectStage: (stageId: string | null) => {
        // TODO: Implement stage selection
      },

      // Dependency operations
      addDependency: (sourceStageId: string, targetStageId: string) => {
        // TODO: Implement from editor
      },
      removeDependency: (sourceStageId: string, targetStageId: string) => {
        // TODO: Implement from editor
      },

      // Gate operations (TODO: Implement)
      addGate: (gate: WorkflowGate) => {
        console.log('Add gate:', gate)
      },
      removeGate: (gateId: string) => {
        console.log('Remove gate:', gateId)
      },
      updateGate: (gateId: string, updates: Partial<WorkflowGate>) => {
        console.log('Update gate:', gateId, updates)
      },

      // Workflow operations
      updateWorkflowMetadata: (updates: Partial<WorkflowDefinition>) => {
        const currentWorkflow = editor.getWorkflow()
        editor.setWorkflow({ ...currentWorkflow, ...updates })
      },

      // Import/Export
      importYaml: yaml.importYaml,
      exportYaml: yaml.exportYaml,

      // History
      undo: editor.history.undo,
      redo: editor.history.redo,
      canUndo: editor.history.canUndo,
      canRedo: editor.history.canRedo,

      // Validation
      validate: validation.validate,
      isValid: validation.isValid,
    }
  }, [editor, validation, yaml])

  return (
    <WorkflowEditorContext.Provider value={contextValue}>
      {children}
    </WorkflowEditorContext.Provider>
  )
}

/**
 * Hook to use the workflow editor context
 *
 * @returns The workflow editor context value
 * @throws Error if used outside of WorkflowEditorProvider
 */
export function useWorkflowEditorContext(): WorkflowEditorContextValue {
  const context = useContext(WorkflowEditorContext)

  if (!context) {
    throw new Error(
      'useWorkflowEditorContext must be used within a WorkflowEditorProvider'
    )
  }

  return context
}