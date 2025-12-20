/**
 * Task Detail Page Types
 *
 * Types for the /tasks/[id] route and its child components.
 */

import type { Task, TaskLog, Gate, ApexEvent, TaskUsage } from '@apexcli/core'

/**
 * Task detail page state
 */
export interface TaskDetailState {
  task: Task | null
  pendingGates: Gate[]
  isLoading: boolean
  error: string | null
  isConnected: boolean
}

/**
 * Real-time update state managed by WebSocket subscription
 */
export interface TaskStreamState {
  events: ApexEvent[]
  logs: TaskLog[]
  usage: TaskUsage | null
  lastUpdated: Date | null
}

/**
 * Page params from Next.js dynamic route
 */
export interface TaskDetailPageParams {
  params: { id: string }
}

/**
 * Props for the task header component
 */
export interface TaskHeaderProps {
  task: Task
  onCancel: () => Promise<void>
  onRetry: () => Promise<void>
  isLoading: boolean
}

/**
 * Props for the task metadata display component
 */
export interface TaskMetadataProps {
  task: Task
}

/**
 * Props for the task progress indicator component
 */
export interface TaskProgressProps {
  task: Task
  stages: string[]
  currentStage: string | undefined
}

/**
 * Reducer action types for task detail state management
 */
export type TaskDetailAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { task: Task; pendingGates: Gate[] } }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> }
  | { type: 'UPDATE_GATES'; payload: Gate[] }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'ADD_LOG'; payload: TaskLog }
  | { type: 'UPDATE_USAGE'; payload: TaskUsage }
