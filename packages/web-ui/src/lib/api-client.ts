import type {
  Task,
  CreateTaskRequest,
  CreateTaskResponse,
  TaskStatusResponse,
  UpdateTaskStatusRequest,
  ApproveGateRequest,
  AgentDefinition,
  ApexConfig,
  SubtaskStrategy,
  SubtaskDefinition,
} from '@apex/core'
import { getApiUrl } from './config'

/**
 * Response for decompose task endpoint
 */
interface DecomposeTaskResponse {
  ok: boolean
  parentTaskId: string
  subtasks: Array<{
    id: string
    description: string
    status: string
  }>
  strategy: SubtaskStrategy
}

/**
 * Response for get subtasks endpoint
 */
interface GetSubtasksResponse {
  parentTaskId: string
  subtasks: Task[]
  count: number
}

/**
 * Response for subtask status endpoint
 */
interface SubtaskStatusResponse {
  parentTaskId: string
  total: number
  completed: number
  failed: number
  pending: number
  inProgress: number
}

/**
 * Response for is-subtask endpoint
 */
interface IsSubtaskResponse {
  taskId: string
  isSubtask: boolean
  parentTaskId: string | null
}

export class ApexApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiUrl()
  }

  /**
   * Update the base URL (useful for runtime configuration)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Check API health status
   */
  async health(): Promise<{ status: string; version: string }> {
    const response = await this.fetch('/health')
    return response.json()
  }

  /**
   * Create a new task
   */
  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    const response = await this.fetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return response.json()
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<TaskStatusResponse> {
    const response = await this.fetch(`/tasks/${taskId}`)
    return response.json()
  }

  /**
   * List all tasks
   */
  async listTasks(filters?: {
    status?: string
    workflow?: string
    limit?: number
    offset?: number
  }): Promise<{ tasks: Task[]; total: number }> {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.workflow) params.set('workflow', filters.workflow)
    if (filters?.limit) params.set('limit', filters.limit.toString())
    if (filters?.offset) params.set('offset', filters.offset.toString())

    const url = `/tasks${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)
    return response.json()
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, request: UpdateTaskStatusRequest): Promise<Task> {
    const response = await this.fetch(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
    return response.json()
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<Task> {
    const response = await this.fetch(`/tasks/${taskId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return response.json()
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<Task> {
    const response = await this.fetch(`/tasks/${taskId}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return response.json()
  }

  /**
   * Approve a gate
   */
  async approveGate(taskId: string, gateName: string, request: ApproveGateRequest): Promise<void> {
    await this.fetch(`/tasks/${taskId}/gates/${gateName}/approve`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Reject a gate
   */
  async rejectGate(taskId: string, gateName: string, request: ApproveGateRequest): Promise<void> {
    await this.fetch(`/tasks/${taskId}/gates/${gateName}/reject`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // ============================================================================
  // Subtask API Methods
  // ============================================================================

  /**
   * Decompose a task into subtasks
   */
  async decomposeTask(
    taskId: string,
    subtasks: SubtaskDefinition[],
    strategy: SubtaskStrategy = 'sequential'
  ): Promise<DecomposeTaskResponse> {
    const response = await this.fetch(`/tasks/${taskId}/decompose`, {
      method: 'POST',
      body: JSON.stringify({ subtasks, strategy }),
    })
    return response.json()
  }

  /**
   * Get subtasks for a parent task
   */
  async getSubtasks(taskId: string): Promise<GetSubtasksResponse> {
    const response = await this.fetch(`/tasks/${taskId}/subtasks`)
    return response.json()
  }

  /**
   * Get subtask status summary for a parent task
   */
  async getSubtaskStatus(taskId: string): Promise<SubtaskStatusResponse> {
    const response = await this.fetch(`/tasks/${taskId}/subtasks/status`)
    return response.json()
  }

  /**
   * Execute subtasks for a parent task
   */
  async executeSubtasks(taskId: string): Promise<{ ok: boolean; message: string; parentTaskId: string }> {
    const response = await this.fetch(`/tasks/${taskId}/subtasks/execute`, {
      method: 'POST',
    })
    return response.json()
  }

  /**
   * Get parent task for a subtask
   */
  async getParentTask(taskId: string): Promise<Task> {
    const response = await this.fetch(`/tasks/${taskId}/parent`)
    return response.json()
  }

  /**
   * Check if a task is a subtask
   */
  async isSubtask(taskId: string): Promise<IsSubtaskResponse> {
    const response = await this.fetch(`/tasks/${taskId}/is-subtask`)
    return response.json()
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<AgentDefinition[]> {
    const response = await this.fetch('/agents')
    return response.json()
  }

  /**
   * Get agent by name
   */
  async getAgent(name: string): Promise<AgentDefinition> {
    const response = await this.fetch(`/agents/${name}`)
    return response.json()
  }

  /**
   * Get project configuration
   */
  async getConfig(): Promise<ApexConfig> {
    const response = await this.fetch('/config')
    return response.json()
  }

  /**
   * Update project configuration
   */
  async updateConfig(config: Partial<ApexConfig>): Promise<ApexConfig> {
    const response = await this.fetch('/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    })
    return response.json()
  }

  /**
   * Internal fetch wrapper with error handling
   */
  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`

        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          // If response is not JSON, use the default error message
        }

        throw new ApiError(errorMessage, response.status)
      }

      return response
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }

      // Network or other errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        0
      )
    }
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApexApiClient()
