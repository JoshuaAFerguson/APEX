import type { Task } from '@apexcli/core'
import type { ExecutionStage, ExecutionStageStatus } from '@/components/tasks/ExecutionTimeline'

/**
 * Transform a Task object into ExecutionStage[] for the ExecutionTimeline component.
 *
 * This function maps the task's workflow stages and current state to a standardized
 * timeline format that the ExecutionTimeline component can display.
 *
 * @param task - The task object containing status, stage, and timing information
 * @returns Array of ExecutionStage objects representing the task's execution timeline
 */
export function transformTaskToExecutionStages(task: Task): ExecutionStage[] {
  // If the task already has execution stages (from API response), use them directly
  const taskAny = task as any; // Task may have extra fields from API
  if (taskAny.executionStages && Array.isArray(taskAny.executionStages)) {
    return (taskAny.executionStages as Array<Record<string, unknown>>).map(stage => ({
      id: stage.id as string,
      name: stage.name as string,
      status: stage.status as ExecutionStageStatus,
      startedAt: stage.startedAt ? new Date(stage.startedAt as string) : undefined,
      completedAt: stage.completedAt ? new Date(stage.completedAt as string) : undefined,
      duration: stage.duration as number | undefined,
      metadata: stage.metadata as Record<string, unknown> | undefined,
    }))
  }

  // Define standard workflow stages based on task workflow type
  const standardStages = getStandardStages(task.workflow)

  // Map task status to execution stages
  return standardStages.map((stageDefinition) => {
    const stage: ExecutionStage = {
      id: stageDefinition.id,
      name: stageDefinition.name,
      status: 'pending',
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
    }

    // Update stage status based on task state
    const stageStatus = getStageStatusFromTask(task, stageDefinition.id)
    stage.status = stageStatus.status

    // Add timing information if available
    if (stageStatus.startedAt) {
      stage.startedAt = stageStatus.startedAt
    }
    if (stageStatus.completedAt) {
      stage.completedAt = stageStatus.completedAt
      stage.duration = stageStatus.completedAt.getTime() - (stageStatus.startedAt?.getTime() || 0)
    } else if (stageStatus.status === 'running' && stageStatus.startedAt) {
      // For running stages, duration is elapsed time
      stage.duration = Date.now() - stageStatus.startedAt.getTime()
    }

    return stage
  })
}

/**
 * Define standard stages for different workflow types.
 * These represent the typical progression of a task through its lifecycle.
 */
function getStandardStages(workflow: string): Array<{ id: string; name: string }> {
  // Map common workflow types to their standard stages
  const workflowStageMap: Record<string, Array<{ id: string; name: string }>> = {
    'developer': [
      { id: 'pending', name: 'Queued' },
      { id: 'planning', name: 'Planning' },
      { id: 'implementing', name: 'Implementing' },
      { id: 'testing', name: 'Testing' },
      { id: 'reviewing', name: 'Reviewing' },
      { id: 'completed', name: 'Completed' },
    ],
    'researcher': [
      { id: 'pending', name: 'Queued' },
      { id: 'investigating', name: 'Investigating' },
      { id: 'analyzing', name: 'Analyzing' },
      { id: 'documenting', name: 'Documenting' },
      { id: 'completed', name: 'Completed' },
    ],
    'reviewer': [
      { id: 'pending', name: 'Queued' },
      { id: 'reviewing', name: 'Reviewing' },
      { id: 'feedback', name: 'Feedback' },
      { id: 'completed', name: 'Completed' },
    ],
    'orchestrator': [
      { id: 'pending', name: 'Queued' },
      { id: 'orchestrating', name: 'Orchestrating' },
      { id: 'coordinating', name: 'Coordinating' },
      { id: 'finalizing', name: 'Finalizing' },
      { id: 'completed', name: 'Completed' },
    ],
  }

  // Return workflow-specific stages or default stages
  return workflowStageMap[workflow] || [
    { id: 'pending', name: 'Pending' },
    { id: 'planning', name: 'Planning' },
    { id: 'executing', name: 'Executing' },
    { id: 'reviewing', name: 'Reviewing' },
    { id: 'completed', name: 'Completed' },
  ]
}

/**
 * Determine the status of a specific stage based on the task's current state.
 */
function getStageStatusFromTask(
  task: Task,
  stageId: string
): {
  status: ExecutionStageStatus
  startedAt?: Date
  completedAt?: Date
} {
  const currentStage = task.currentStage || 'pending'
  const taskStatus = task.status
  const createdAt = task.createdAt ? new Date(task.createdAt) : new Date()
  const completedAt = task.completedAt ? new Date(task.completedAt) : undefined

  // Handle completed/failed/cancelled tasks
  if (taskStatus === 'completed') {
    if (stageId === 'completed') {
      return {
        status: 'completed',
        startedAt: completedAt || createdAt,
        completedAt: completedAt || createdAt,
      }
    }
    // All stages before completion are completed
    const stages = getStandardStages(task.workflow)
    const completedStageIndex = stages.findIndex(s => s.id === 'completed')
    const stageIndex = stages.findIndex(s => s.id === stageId)

    if (stageIndex < completedStageIndex) {
      return {
        status: 'completed',
        startedAt: createdAt,
        completedAt: createdAt,
      }
    }
  }

  if (taskStatus === 'failed') {
    if (stageId === currentStage) {
      return {
        status: 'failed',
        startedAt: createdAt,
      }
    }
    // Previous stages are completed
    const stages = getStandardStages(task.workflow)
    const currentStageIndex = stages.findIndex(s => s.id === currentStage)
    const stageIndex = stages.findIndex(s => s.id === stageId)

    if (stageIndex < currentStageIndex) {
      return {
        status: 'completed',
        startedAt: createdAt,
        completedAt: createdAt,
      }
    }
    if (stageIndex > currentStageIndex) {
      return { status: 'pending' }
    }
  }

  if (taskStatus === 'cancelled') {
    if (stageId === currentStage) {
      return {
        status: 'skipped',
        startedAt: createdAt,
      }
    }
    // Mark later stages as skipped
    const stages = getStandardStages(task.workflow)
    const currentStageIndex = stages.findIndex(s => s.id === currentStage)
    const stageIndex = stages.findIndex(s => s.id === stageId)

    if (stageIndex < currentStageIndex) {
      return {
        status: 'completed',
        startedAt: createdAt,
        completedAt: createdAt,
      }
    }
    if (stageIndex >= currentStageIndex) {
      return { status: 'skipped' }
    }
  }

  // Handle running/paused tasks
  if (stageId === currentStage) {
    if (taskStatus === 'paused') {
      return {
        status: 'paused',
        startedAt: createdAt,
      }
    }
    if (taskStatus === 'in-progress' || taskStatus === 'planning' || taskStatus === 'waiting-approval') {
      return {
        status: 'running',
        startedAt: createdAt,
      }
    }
  }

  // For pending/queued tasks
  if (taskStatus === 'pending' || taskStatus === 'queued') {
    if (stageId === 'pending') {
      return {
        status: 'running',
        startedAt: createdAt,
      }
    }
    return { status: 'pending' }
  }

  // Determine if this stage has been completed
  const stages = getStandardStages(task.workflow)
  const currentStageIndex = stages.findIndex(s => s.id === currentStage)
  const stageIndex = stages.findIndex(s => s.id === stageId)

  if (stageIndex < currentStageIndex) {
    // Previous stages are completed
    return {
      status: 'completed',
      startedAt: createdAt,
      completedAt: createdAt,
    }
  } else if (stageIndex === currentStageIndex) {
    // Current stage is running
    return {
      status: 'running',
      startedAt: createdAt,
    }
  } else {
    // Future stages are pending
    return { status: 'pending' }
  }
}

/**
 * Get the current stage ID from a task for highlighting in the timeline.
 */
export function getCurrentStageId(task: Task): string | undefined {
  // Use explicit currentStage if available
  if (task.currentStage) {
    return task.currentStage
  }

  // Infer current stage from status
  const statusToStageMap: Record<string, string> = {
    'pending': 'pending',
    'queued': 'pending',
    'planning': 'planning',
    'in-progress': 'executing',
    'waiting-approval': 'reviewing',
    'paused': task.currentStage || 'executing',
    'completed': 'completed',
    'failed': task.currentStage || 'executing',
    'cancelled': task.currentStage || 'pending',
  }

  return statusToStageMap[task.status] || 'pending'
}

/**
 * Check if a task should display an execution timeline.
 * Returns true if the task has meaningful stages to show.
 */
export function shouldShowExecutionTimeline(task: Task): boolean {
  // Always show for tasks with explicit execution stages
  const taskAny = task as any; // Task may have extra fields from API
  if (taskAny.executionStages && Array.isArray(taskAny.executionStages) && (taskAny.executionStages as unknown[]).length > 0) {
    return true
  }

  // Show for tasks that have progressed beyond just being created
  const advancedStatuses = ['planning', 'in-progress', 'waiting-approval', 'completed', 'failed', 'paused']
  return advancedStatuses.includes(task.status)
}