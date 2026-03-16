/**
 * Type definitions for the Visual Workflow Editor
 *
 * This file contains all TypeScript interfaces and types used
 * by the workflow editor components, hooks, and utilities.
 */

import type { Node, Edge } from '@xyflow/react'
import type { WorkflowDefinition, WorkflowStage, WorkflowGate } from '@apexcli/core'

/**
 * Stage node data for React Flow
 */
export interface StageNodeData extends Record<string, unknown> {
  stage: WorkflowStage
  isSelected: boolean
  hasError: boolean
  errorMessage?: string
}

/**
 * Node types for the workflow editor
 */
export type WorkflowEditorNode = Node<StageNodeData>

/**
 * Edge data for dependency connections
 */
export interface DependencyEdgeData {
  sourceStage: string
  targetStage: string
  isConditional?: boolean
}

/**
 * Edge types for the workflow editor
 */
export type WorkflowEditorEdge = Edge<DependencyEdgeData>

/**
 * Editor state interface
 */
export interface WorkflowEditorState {
  workflow: WorkflowDefinition
  nodes: WorkflowEditorNode[]
  edges: WorkflowEditorEdge[]
  selectedStageId: string | null
  selectedGateId: string | null
  isDirty: boolean
  validationErrors: ValidationError[]
  yamlPreview: string
}

/**
 * Validation error structure
 */
export interface ValidationError {
  path: string
  message: string
  type: 'error' | 'warning'
  stageId?: string
  gateId?: string
}

/**
 * Stage template for palette
 */
export interface StageTemplate {
  id: string
  name: string
  agent: string
  description: string
  icon: string
  category: 'planning' | 'development' | 'testing' | 'review' | 'deployment'
}

/**
 * Editor action types for undo/redo
 */
export type EditorAction =
  | { type: 'ADD_STAGE'; stage: WorkflowStage; position: { x: number; y: number } }
  | { type: 'REMOVE_STAGE'; stageId: string }
  | { type: 'UPDATE_STAGE'; stageId: string; updates: Partial<WorkflowStage> }
  | { type: 'REORDER_STAGES'; stageIds: string[] }
  | { type: 'ADD_DEPENDENCY'; source: string; target: string }
  | { type: 'REMOVE_DEPENDENCY'; source: string; target: string }
  | { type: 'ADD_GATE'; gate: WorkflowGate }
  | { type: 'REMOVE_GATE'; gateId: string }
  | { type: 'UPDATE_GATE'; gateId: string; updates: Partial<WorkflowGate> }
  | { type: 'UPDATE_WORKFLOW_METADATA'; updates: Partial<WorkflowDefinition> }
  | { type: 'IMPORT_YAML'; yaml: string }

/**
 * Editor context interface
 */
export interface WorkflowEditorContextValue {
  state: WorkflowEditorState
  dispatch: (action: EditorAction) => void

  // Stage operations
  addStage: (template: StageTemplate, position: { x: number; y: number }) => void
  removeStage: (stageId: string) => void
  updateStage: (stageId: string, updates: Partial<WorkflowStage>) => void
  selectStage: (stageId: string | null) => void

  // Dependency operations
  addDependency: (sourceStageId: string, targetStageId: string) => void
  removeDependency: (sourceStageId: string, targetStageId: string) => void

  // Gate operations
  addGate: (gate: WorkflowGate) => void
  removeGate: (gateId: string) => void
  updateGate: (gateId: string, updates: Partial<WorkflowGate>) => void

  // Workflow operations
  updateWorkflowMetadata: (updates: Partial<WorkflowDefinition>) => void

  // Import/Export
  importYaml: (yaml: string) => ValidationError[]
  exportYaml: () => string

  // History
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Validation
  validate: () => ValidationError[]
  isValid: boolean
}

/**
 * Hook interfaces
 */

// useWorkflowEditor hook options
export interface UseWorkflowEditorOptions {
  initialWorkflow?: WorkflowDefinition
  onChange?: (workflow: WorkflowDefinition) => void
  onValidationChange?: (errors: ValidationError[]) => void
}

// useWorkflowEditor hook return type
export interface UseWorkflowEditorReturn {
  // State
  workflow: WorkflowDefinition
  nodes: WorkflowEditorNode[]
  edges: WorkflowEditorEdge[]
  selectedStageId: string | null
  isDirty: boolean

  // Node handlers for React Flow
  onNodesChange: (changes: any[]) => void
  onEdgesChange: (changes: any[]) => void
  onConnect: (connection: any) => void
  onNodeClick: (event: React.MouseEvent, node: WorkflowEditorNode) => void
  onEdgeClick: (event: React.MouseEvent, edge: WorkflowEditorEdge) => void

  // Stage operations
  addStage: (template: StageTemplate, position: { x: number; y: number }) => void
  removeStage: (stageId: string) => void
  updateStage: (stageId: string, updates: Partial<WorkflowStage>) => void

  // Workflow operations
  getWorkflow: () => WorkflowDefinition
  setWorkflow: (workflow: WorkflowDefinition) => void

  // History
  history: {
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
  }
}

// useWorkflowYaml hook options
export interface UseWorkflowYamlOptions {
  workflow: WorkflowDefinition
  onImport?: (workflow: WorkflowDefinition) => void
}

// useWorkflowYaml hook return type
export interface UseWorkflowYamlReturn {
  // YAML operations
  yamlPreview: string
  exportYaml: () => string
  importYaml: (yaml: string) => { success: boolean; errors: ValidationError[] }
  downloadYaml: (filename?: string) => void

  // File operations
  importFromFile: (file: File) => Promise<{ success: boolean; errors: ValidationError[] }>

  // Validation
  validateYaml: (yaml: string) => ValidationError[]
}

// useWorkflowValidation hook return type
export interface UseWorkflowValidationReturn {
  errors: ValidationError[]
  warnings: ValidationError[]
  isValid: boolean
  validate: () => ValidationError[]
  getStageErrors: (stageId: string) => ValidationError[]
  getGateErrors: (gateId: string) => ValidationError[]
}

// useWorkflowHistory hook options
export interface UseWorkflowHistoryOptions<T> {
  initialState: T
  maxHistorySize?: number
}

// useWorkflowHistory hook return type
export interface UseWorkflowHistoryReturn<T> {
  state: T
  setState: (state: T | ((prev: T) => T)) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

/**
 * Component prop interfaces
 */

// StageNode component props
export interface StageNodeProps {
  data: StageNodeData
  selected: boolean
}

// StagePalette component props
export interface StagePaletteProps {
  templates?: StageTemplate[]
  className?: string
}

// PropertiesPanel component props
export interface PropertiesPanelProps {
  selectedStageId: string | null
  selectedGateId: string | null
  onStageUpdate: (stageId: string, updates: Partial<WorkflowStage>) => void
  onGateUpdate: (gateId: string, updates: Partial<WorkflowGate>) => void
  onWorkflowUpdate: (updates: Partial<WorkflowDefinition>) => void
  className?: string
}

// WorkflowEditor main component props
export interface WorkflowEditorProps {
  initialWorkflow?: WorkflowDefinition
  onSave?: (workflow: WorkflowDefinition) => void
  onExport?: (yaml: string) => void
  readOnly?: boolean
  className?: string
}

/**
 * Layout and positioning interfaces
 */
export interface LayoutConfig {
  nodeWidth: number
  nodeHeight: number
  horizontalSpacing: number
  verticalSpacing: number
  startX: number
  startY: number
}

export interface Position {
  x: number
  y: number
}

/**
 * Notification interface for user feedback
 */
export interface EditorNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
}