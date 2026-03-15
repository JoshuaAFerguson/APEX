'use client'

import React from 'react'

/**
 * TaskDependencyGraph Component
 *
 * A specialized React Flow-based component for visualizing task relationships.
 * This component renders task nodes connected by dependency edges, showing
 * the hierarchical structure of tasks, subtasks, and their dependencies.
 *
 * @example
 * ```tsx
 * import { TaskDependencyGraph } from '@/components/tasks/TaskDependencyGraph'
 *
 * // Basic usage - auto-navigation on click
 * <TaskDependencyGraph tasks={tasks} />
 *
 * // Custom click handler
 * <TaskDependencyGraph
 *   tasks={tasks}
 *   onTaskClick={(taskId) => console.log('Clicked:', taskId)}
 * />
 *
 * // With styling and custom empty state
 * <TaskDependencyGraph
 *   tasks={tasks}
 *   className="my-4"
 *   height={500}
 *   emptyStateMessage="No tasks available"
 * />
 * ```
 */

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DependencyGraph } from '@/components/graphs/DependencyGraph'
import { cn } from '@/lib/utils'
import type { Task } from '@apexcli/core'
import type {
  TaskDependencyGraphProps,
  TaskNodeData,
  TaskEdgeData,
  TaskGraphElements,
  TaskGraphLayoutConfig,
} from '@/types/task-dependency-graph'
import {
  DEFAULT_TASK_GRAPH_LAYOUT,
  truncateDescription,
  mapTaskStatusToNodeStatus,
} from '@/types/task-dependency-graph'
import type { DependencyNode, DependencyEdge } from '@/types/dependency-graph'

/**
 * Empty state component for when no tasks are available
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
      <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800">
        <svg
          className="w-8 h-8 text-slate-500 dark:text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
        No tasks to display
      </h3>
      <p className="text-slate-600 dark:text-slate-400 max-w-sm">
        {message}
      </p>
    </div>
  )
}

/**
 * Calculate simple grid positions for tasks
 * This is a basic layout algorithm - future enhancement could use dagre for automatic layout
 */
function calculateTaskPositions(
  tasks: Task[],
  config: TaskGraphLayoutConfig = DEFAULT_TASK_GRAPH_LAYOUT
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}

  // Group tasks by their relationships
  const parentTasks: Task[] = []
  const subtasks: Task[] = []
  const independentTasks: Task[] = []

  for (const task of tasks) {
    if (task.parentTaskId && typeof task.parentTaskId === 'string') {
      subtasks.push(task)
    } else if (task.subtaskIds && Array.isArray(task.subtaskIds) && task.subtaskIds.length > 0) {
      parentTasks.push(task)
    } else {
      independentTasks.push(task)
    }
  }

  let currentY = config.startY
  let currentX = config.startX

  // Layout parent tasks first
  let nodesInCurrentRow = 0
  for (const task of parentTasks) {
    positions[task.id] = { x: currentX, y: currentY }
    currentX += config.nodeSpacingX
    nodesInCurrentRow++

    if (nodesInCurrentRow >= config.maxNodesPerRow) {
      currentY += config.nodeSpacingY
      currentX = config.startX
      nodesInCurrentRow = 0
    }
  }

  // Move to next row if we have items on current row
  if (nodesInCurrentRow > 0) {
    currentY += config.nodeSpacingY
    currentX = config.startX
    nodesInCurrentRow = 0
  }

  // Layout subtasks below their parents
  for (const task of subtasks) {
    if (task.parentTaskId && typeof task.parentTaskId === 'string' && positions[task.parentTaskId]) {
      const parentPos = positions[task.parentTaskId]
      // Position subtasks below their parent, with some offset
      const siblings = subtasks.filter(t => t.parentTaskId === task.parentTaskId)
      const siblingIndex = siblings.indexOf(task)

      positions[task.id] = {
        x: parentPos.x + (siblingIndex * config.nodeSpacingX / 2),
        y: parentPos.y + config.nodeSpacingY
      }
    } else {
      // Fallback for orphaned subtasks
      positions[task.id] = { x: currentX, y: currentY }
      currentX += config.nodeSpacingX
      nodesInCurrentRow++

      if (nodesInCurrentRow >= config.maxNodesPerRow) {
        currentY += config.nodeSpacingY
        currentX = config.startX
        nodesInCurrentRow = 0
      }
    }
  }

  // Move to next row if we have items on current row
  if (nodesInCurrentRow > 0) {
    currentY += config.nodeSpacingY
    currentX = config.startX
    nodesInCurrentRow = 0
  }

  // Layout independent tasks
  for (const task of independentTasks) {
    positions[task.id] = { x: currentX, y: currentY }
    currentX += config.nodeSpacingX
    nodesInCurrentRow++

    if (nodesInCurrentRow >= config.maxNodesPerRow) {
      currentY += config.nodeSpacingY
      currentX = config.startX
      nodesInCurrentRow = 0
    }
  }

  return positions
}

/**
 * Transform Task array into graph elements (nodes and edges)
 */
function transformTasksToGraphElements(tasks: Task[]): TaskGraphElements {
  if (!tasks || tasks.length === 0) {
    return { nodes: [], edges: [] }
  }

  const positions = calculateTaskPositions(tasks)
  const nodes: DependencyNode[] = []
  const edges: DependencyEdge[] = []

  // Create nodes for each task
  for (const task of tasks) {
    const position = positions[task.id] || { x: 0, y: 0 }
    // Safe access to task properties with fallbacks for malformed data
    const safeDescription = task.description || 'Untitled Task'
    const taskNodeData: TaskNodeData = {
      label: truncateDescription(task.description),
      type: 'task',
      status: mapTaskStatusToNodeStatus(task.status),
      taskId: task.id,
      taskStatus: task.status,
      parentTaskId: task.parentTaskId || undefined,
      subtaskIds: task.subtaskIds || undefined,
      dependsOn: task.dependsOn || undefined,
      truncatedDescription: truncateDescription(task.description),
      fullDescription: safeDescription,
    }

    nodes.push({
      id: task.id,
      position,
      data: taskNodeData,
      type: 'default',
    })
  }

  // Create edges for dependencies
  for (const task of tasks) {
    // Create edges for dependsOn relationships
    if (task.dependsOn && Array.isArray(task.dependsOn)) {
      for (const dependencyId of task.dependsOn) {
        // Validate dependency ID and check if dependency task exists
        if (dependencyId && typeof dependencyId === 'string' && tasks.find(t => t.id === dependencyId)) {
          const edgeData: TaskEdgeData = {
            relationshipType: 'dependency',
            sourceTaskId: dependencyId,
            targetTaskId: task.id,
          }

          edges.push({
            id: `dep-${dependencyId}-${task.id}`,
            source: dependencyId,
            target: task.id,
            type: 'default',
            data: {
              type: 'task',
              label: 'depends on',
              ...edgeData,
            },
            animated: task.status === 'in-progress' || task.status === 'planning',
            style: {
              stroke: '#8b5cf6', // violet for task dependencies
              strokeWidth: 2,
            },
          })
        }
      }
    }

    // Create edges for parent-child relationships
    if (task.parentTaskId && typeof task.parentTaskId === 'string') {
      // Only create edge if the parent task exists in our current task set
      if (tasks.find(t => t.id === task.parentTaskId)) {
        const edgeData: TaskEdgeData = {
          relationshipType: 'subtask',
          sourceTaskId: task.parentTaskId,
          targetTaskId: task.id,
        }

        edges.push({
          id: `subtask-${task.parentTaskId}-${task.id}`,
          source: task.parentTaskId,
          target: task.id,
          type: 'default',
          data: {
            type: 'task',
            label: 'subtask',
            ...edgeData,
          },
          style: {
            stroke: '#8b5cf6', // violet for task relationships
            strokeWidth: 1.5,
            strokeDasharray: '5,5', // dashed line for parent-child
          },
        })
      }
    }
  }

  return { nodes, edges }
}

/**
 * TaskDependencyGraph Component
 *
 * Renders task relationships using React Flow with proper styling and navigation.
 */
export function TaskDependencyGraph({
  tasks,
  onTaskClick,
  className,
  interactive = true,
  emptyStateMessage = 'No tasks to display',
  height = 400,
  showMiniMap = true,
  showControls = true,
  fitView = true,
}: TaskDependencyGraphProps) {
  const router = useRouter()

  // Transform tasks to graph elements (always call this hook)
  const graphElements = useMemo(() => transformTasksToGraphElements(tasks), [tasks])

  // Handle node click for navigation (always call this hook)
  const handleNodeClick = useCallback(
    (node: DependencyNode) => {
      const taskId = (node.data as TaskNodeData).taskId

      if (onTaskClick) {
        onTaskClick(taskId)
      } else {
        router.push(`/tasks/${taskId}`)
      }
    },
    [onTaskClick, router]
  )

  // Handle empty state
  if (!tasks || tasks.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-background overflow-hidden',
          className
        )}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
        }}
      >
        <EmptyState message={emptyStateMessage} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background overflow-hidden',
        className
      )}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <DependencyGraph
        nodes={graphElements.nodes}
        edges={graphElements.edges}
        onNodeClick={handleNodeClick}
        interactive={interactive}
        fitView={fitView}
        className="w-full h-full"
      />
    </div>
  )
}

/**
 * Export type for external use
 */
export type { TaskDependencyGraphProps }