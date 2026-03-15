/**
 * Type definitions for TaskDependencyGraph component
 *
 * This module defines the interfaces for visualizing task dependencies
 * using React Flow in the APEX web dashboard.
 */

import type { Task, TaskStatus } from '@apexcli/core'
import type { DependencyNode, DependencyEdge, DependencyNodeData, DependencyNodeStatus } from './dependency-graph'

/**
 * Extended node data for task dependency visualization
 * Contains task-specific information for rendering and navigation
 */
export interface TaskNodeData extends DependencyNodeData {
  /** The task ID for navigation */
  taskId: string
  /** Original task status for reference */
  taskStatus: TaskStatus
  /** Parent task ID if this is a subtask */
  parentTaskId?: string
  /** Subtask IDs if this is a parent task */
  subtaskIds?: string[]
  /** Task IDs this task depends on */
  dependsOn?: string[]
  /** Truncated description for display */
  truncatedDescription: string
  /** Full description for tooltip */
  fullDescription: string
}

/**
 * Props for the TaskDependencyGraph component
 */
export interface TaskDependencyGraphProps {
  /** Array of tasks to visualize in the graph */
  tasks: Task[]

  /**
   * Optional callback when a task node is clicked.
   * If not provided, the component will navigate to the task detail page.
   */
  onTaskClick?: (taskId: string) => void

  /** Optional CSS class for the container */
  className?: string

  /** Whether the graph is interactive (draggable/zoomable). Default: true */
  interactive?: boolean

  /** Custom message for empty state. Default: "No tasks to display" */
  emptyStateMessage?: string

  /** Height of the graph container. Default: 400 */
  height?: string | number

  /** Whether to show the mini map. Default: true */
  showMiniMap?: boolean

  /** Whether to show controls. Default: true */
  showControls?: boolean

  /** Whether to fit the view to show all nodes. Default: true */
  fitView?: boolean
}

/**
 * Internal type for edge data in task dependency graphs
 */
export interface TaskEdgeData {
  /** Type of relationship: 'dependency' for dependsOn, 'subtask' for parent-child */
  relationshipType: 'dependency' | 'subtask'
  /** Source task ID */
  sourceTaskId: string
  /** Target task ID */
  targetTaskId: string
}

/**
 * Result of transforming tasks to graph elements
 */
export interface TaskGraphElements {
  /** Nodes representing tasks */
  nodes: DependencyNode[]
  /** Edges representing dependencies and relationships */
  edges: DependencyEdge[]
}

/**
 * Mapping from TaskStatus to DependencyNodeStatus for styling
 *
 * TaskStatus values:
 * - pending: Task created but not yet queued
 * - queued: Task ready for execution
 * - planning: Agent is planning implementation approach
 * - in-progress: Task actively being executed
 * - waiting-approval: Task requires user approval (deprecated)
 * - awaiting-approval: Task requires user approval
 * - paused: Task execution paused
 * - completed: Task successfully finished
 * - failed: Task execution failed
 * - cancelled: Task was cancelled
 */
export const TASK_STATUS_TO_NODE_STATUS: Record<TaskStatus, DependencyNodeStatus> = {
  'pending': 'pending',
  'queued': 'pending',
  'planning': 'active',
  'in-progress': 'active',
  'waiting-approval': 'warning',
  'awaiting-approval': 'warning',
  'paused': 'warning',
  'completed': 'completed',
  'failed': 'error',
  'cancelled': 'default',
}

/**
 * Layout configuration for task dependency graphs
 */
export interface TaskGraphLayoutConfig {
  /** Horizontal spacing between nodes */
  nodeSpacingX: number
  /** Vertical spacing between nodes (rank spacing) */
  nodeSpacingY: number
  /** Starting X position */
  startX: number
  /** Starting Y position */
  startY: number
  /** Maximum nodes per row before wrapping */
  maxNodesPerRow: number
}

/**
 * Default layout configuration
 */
export const DEFAULT_TASK_GRAPH_LAYOUT: TaskGraphLayoutConfig = {
  nodeSpacingX: 250,
  nodeSpacingY: 120,
  startX: 50,
  startY: 50,
  maxNodesPerRow: 4,
}

/**
 * Helper function to truncate text for node labels
 */
export function truncateDescription(description: string | undefined | null, maxLength: number = 40): string {
  // Handle undefined, null, or empty description
  if (!description || typeof description !== 'string') {
    return 'Untitled Task'
  }

  if (description.length <= maxLength) {
    return description
  }
  return `${description.substring(0, maxLength - 3)}...`
}

/**
 * Helper function to map task status to node status
 */
export function mapTaskStatusToNodeStatus(status: TaskStatus): DependencyNodeStatus {
  return TASK_STATUS_TO_NODE_STATUS[status] ?? 'default'
}
