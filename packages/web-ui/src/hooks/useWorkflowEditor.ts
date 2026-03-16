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
  WorkflowEdgeData,
  StagePosition,
} from '@/types/workflow-editor'
import { useWorkflowHistory } from './useWorkflowHistory'
import { calculateStageLayout, calculateNewStagePosition } from '@/lib/workflow-editor'
import { DEFAULT_WORKFLOW } from '@/lib/workflow-editor/constants'

/**
 * Helper to safely get stages array from workflow
 */
function getStages(wf: WorkflowDefinition): WorkflowStage[] {
  return wf.stages || []
}

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
    const stages = getStages(workflow)
    const positions = calculateStageLayout(stages)

    return stages.map((stage): WorkflowEditorNode => {
      const stageName = stage.name || ''
      const position = positions.get(stageName) || { x: 0, y: 0 }

      const nodeData: StageNodeData = {
        stage,
        isSelected: selectedStageId === stageName,
        hasError: false, // This would be populated by validation
        errorMessage: undefined,
      }

      return {
        id: stageName,
        type: 'stageNode',
        position,
        data: nodeData,
        selected: selectedStageId === stageName,
      }
    })
  }, [workflow, selectedStageId])

  // Generate edges from stage dependencies
  const edges = useMemo((): WorkflowEditorEdge[] => {
    const stages = getStages(workflow)
    const result: WorkflowEditorEdge[] = []

    for (const stage of stages) {
      const stageName = stage.name
      if (stage.dependsOn && stageName) {
        for (const dependency of stage.dependsOn) {
          const edgeData: WorkflowEdgeData = {
            sourceStage: dependency,
            targetStage: stageName,
            isConditional: Boolean(stage.condition),
          }

          result.push({
            id: `${dependency}-${stageName}`,
            source: dependency,
            target: stageName,
            type: 'dependencyEdge',
            data: edgeData,
          })
        }
      }
    }

    return result
  }, [workflow])

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
   * Add dependency between stages
   */
  const addDependency = useCallback(
    (sourceStageId: string, targetStageId: string) => {
      if (sourceStageId === targetStageId) return // Prevent self-dependency

      setWorkflow(prev => ({
        ...prev,
        stages: getStages(prev).map(stage => {
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
        stages: getStages(prev).map(stage => {
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
   * Handle React Flow node changes
   */
  const onNodesChange: OnNodesChange = useCallback(() => {
    // Handle position changes by updating stage positions
    // For now, we'll let React Flow handle the visual updates
    // and sync positions when needed
  }, [])

  /**
   * Handle React Flow edge changes
   */
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      // Handle edge removal by updating stage dependencies
      for (const change of changes) {
        if (change.type === 'remove') {
          const edge = edges.find(e => e.id === change.id)
          if (edge) {
            removeDependency(edge.source, edge.target)
          }
        }
      }
    },
    [edges, removeDependency]
  )

  /**
   * Handle new connections between nodes
   */
  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        addDependency(connection.source, connection.target)
      }
    },
    [addDependency]
  )

  /**
   * Handle node clicks
   */
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedStageId(node.id)
  }, [])

  /**
   * Handle edge clicks
   */
  const onEdgeClick: EdgeMouseHandler = useCallback(() => {
    // For now, just deselect stages when clicking edges
    setSelectedStageId(null)
  }, [])

  /**
   * Add a new stage from template
   */
  const addStage = useCallback(
    (template: StageTemplate, position?: StagePosition) => {
      const stages = getStages(workflow)
      const existingPositions = new Map<string, StagePosition>(
        stages
          .filter((s): s is WorkflowStage & { name: string } => typeof s.name === 'string')
          .map(s => [s.name, { x: 0, y: 0 }]) // We'd need actual positions
      )

      const stagePosition = position || calculateNewStagePosition(existingPositions)

      // Generate unique stage name if conflicts exist
      let stageName = template.name.toLowerCase().replace(/\s+/g, '-')
      let counter = 1
      const existingNames = new Set(stages.map(s => s.name).filter((n): n is string => typeof n === 'string'))

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
        stages: [...getStages(prev), newStage],
      }))

      setSelectedStageId(stageName)
    },
    [workflow, setWorkflow]
  )

  /**
   * Remove a stage and its dependencies
   */
  const removeStage = useCallback(
    (stageId: string) => {
      setWorkflow(prev => ({
        ...prev,
        stages: getStages(prev)
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
        stages: getStages(prev).map(stage =>
          stage.name === stageId ? { ...stage, ...updates } : stage
        ),
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
