/**
 * useWorkflowEditor Hook
 *
 * Main hook for managing workflow editor state and operations.
 * Integrates with React Flow for node/edge management and provides
 * high-level operations for stage manipulation.
 */

import { useCallback, useMemo, useState, useEffect } from 'react'
import type {
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeMouseHandler,
  EdgeMouseHandler,
} from '@xyflow/react'
import type { WorkflowDefinition, WorkflowStage } from '@apexcli/core'
import type {
  UseWorkflowEditorOptions,
  UseWorkflowEditorReturn,
  WorkflowEditorNode,
  WorkflowEditorEdge,
  StageTemplate,
  StageNodeData,
  DependencyEdgeData,
  Position,
} from '@/types/workflow-editor'
import { useWorkflowHistory } from './useWorkflowHistory'
import { calculateStageLayout, calculateNewStagePosition } from '@/lib/workflow-editor'
import { DEFAULT_WORKFLOW } from '@/lib/workflow-editor/constants'

/**
 * Main workflow editor hook
 *
 * @param options - Configuration options
 * @returns Editor state and operations
 */
export function useWorkflowEditor({
  initialWorkflow,
  onChange,
  onValidationChange,
}: UseWorkflowEditorOptions = {}): UseWorkflowEditorReturn {
  // Initialize workflow with default if not provided
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Use history for undo/redo
  const {
    state: workflow,
    setState: setWorkflow,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflowHistory({
    initialState: initialWorkflow || DEFAULT_WORKFLOW,
  })

  // Generate nodes from workflow stages
  const nodes = useMemo((): WorkflowEditorNode[] => {
    const stages = workflow.stages || []
    const positions = calculateStageLayout(stages)

    return stages.map((stage): WorkflowEditorNode => {
      const position = positions.get(stage.name) || { x: 0, y: 0 }

      const nodeData: StageNodeData = {
        stage,
        isSelected: selectedStageId === stage.name,
        hasError: false, // This would be populated by validation
        errorMessage: undefined,
      }

      return {
        id: stage.name,
        type: 'stageNode',
        position,
        data: nodeData,
        selected: selectedStageId === stage.name,
      }
    })
  }, [workflow.stages, selectedStageId])

  // Generate edges from stage dependencies
  const edges = useMemo((): WorkflowEditorEdge[] => {
    const edges: WorkflowEditorEdge[] = []

    for (const stage of workflow.stages) {
      if (stage.dependsOn) {
        for (const dependency of stage.dependsOn) {
          const edgeData: DependencyEdgeData = {
            sourceStage: dependency,
            targetStage: stage.name,
            isConditional: Boolean(stage.condition),
          }

          edges.push({
            id: `${dependency}-${stage.name}`,
            source: dependency,
            target: stage.name,
            type: 'dependencyEdge',
            data: edgeData,
          })
        }
      }
    }

    return edges
  }, [workflow.stages])

  // Mark as dirty when workflow changes
  useEffect(() => {
    if (workflow !== initialWorkflow) {
      setIsDirty(true)
    }
  }, [workflow, initialWorkflow])

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(workflow)
    }
  }, [workflow, onChange])

  /**
   * Handle React Flow node changes
   */
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    // Handle position changes by updating stage positions
    // For now, we'll let React Flow handle the visual updates
    // and sync positions when needed
  }, [])

  /**
   * Handle React Flow edge changes
   */
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    // Handle edge removal by updating stage dependencies
    for (const change of changes) {
      if (change.type === 'remove') {
        const edge = edges.find(e => e.id === change.id)
        if (edge) {
          removeDependency(edge.source, edge.target)
        }
      }
    }
  }, [edges])

  /**
   * Handle new connections between nodes
   */
  const onConnect: OnConnect = useCallback((connection) => {
    if (connection.source && connection.target) {
      addDependency(connection.source, connection.target)
    }
  }, [])

  /**
   * Handle node clicks
   */
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedStageId(node.id)
  }, [])

  /**
   * Handle edge clicks
   */
  const onEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    // For now, just deselect stages when clicking edges
    setSelectedStageId(null)
  }, [])

  /**
   * Add a new stage from template
   */
  const addStage = useCallback(
    (template: StageTemplate, position?: Position) => {
      const existingPositions = new Map(
        workflow.stages.map(s => [s.name, { x: 0, y: 0 }]) // We'd need actual positions
      )

      const stagePosition = position || calculateNewStagePosition(existingPositions)

      // Generate unique stage name if conflicts exist
      let stageName = template.name.toLowerCase().replace(/\s+/g, '-')
      let counter = 1
      const existingNames = new Set(workflow.stages.map(s => s.name))

      while (existingNames.has(stageName)) {
        stageName = `${template.name.toLowerCase().replace(/\s+/g, '-')}-${counter}`
        counter++
      }

      const newStage: WorkflowStage = {
        name: stageName,
        agent: template.agent,
        description: template.description,
      }

      setWorkflow(prev => ({
        ...prev,
        stages: [...prev.stages, newStage],
      }))

      setSelectedStageId(stageName)
    },
    [workflow.stages, setWorkflow]
  )

  /**
   * Remove a stage and its dependencies
   */
  const removeStage = useCallback(
    (stageId: string) => {
      setWorkflow(prev => ({
        ...prev,
        stages: prev.stages
          .filter(stage => stage.name !== stageId)
          .map(stage => ({
            ...stage,
            dependsOn: stage.dependsOn?.filter(dep => dep !== stageId),
          })),
      }))

      if (selectedStageId === stageId) {
        setSelectedStageId(null)
      }
    },
    [setWorkflow, selectedStageId]
  )

  /**
   * Update a stage
   */
  const updateStage = useCallback(
    (stageId: string, updates: Partial<WorkflowStage>) => {
      setWorkflow(prev => ({
        ...prev,
        stages: prev.stages.map(stage =>
          stage.name === stageId ? { ...stage, ...updates } : stage
        ),
      }))
    },
    [setWorkflow]
  )

  /**
   * Add dependency between stages
   */
  const addDependency = useCallback(
    (sourceStageId: string, targetStageId: string) => {
      if (sourceStageId === targetStageId) return // Prevent self-dependency

      setWorkflow(prev => ({
        ...prev,
        stages: prev.stages.map(stage => {
          if (stage.name === targetStageId) {
            const existingDeps = stage.dependsOn || []
            if (!existingDeps.includes(sourceStageId)) {
              return {
                ...stage,
                dependsOn: [...existingDeps, sourceStageId],
              }
            }
          }
          return stage
        }),
      }))
    },
    [setWorkflow]
  )

  /**
   * Remove dependency between stages
   */
  const removeDependency = useCallback(
    (sourceStageId: string, targetStageId: string) => {
      setWorkflow(prev => ({
        ...prev,
        stages: prev.stages.map(stage => {
          if (stage.name === targetStageId && stage.dependsOn) {
            return {
              ...stage,
              dependsOn: stage.dependsOn.filter(dep => dep !== sourceStageId),
            }
          }
          return stage
        }),
      }))
    },
    [setWorkflow]
  )

  /**
   * Get current workflow
   */
  const getWorkflow = useCallback(() => workflow, [workflow])

  return {
    // State
    workflow,
    nodes,
    edges,
    selectedStageId,
    isDirty,

    // React Flow handlers
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,

    // Stage operations
    addStage,
    removeStage,
    updateStage,

    // Workflow operations
    getWorkflow,
    setWorkflow,

    // History
    history: {
      undo,
      redo,
      canUndo,
      canRedo,
    },
  }
}