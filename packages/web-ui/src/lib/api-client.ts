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
  MCPMarketplaceEntry,
  MCPServerConfig,
  InjectContextRequest,
  InjectContextResponse,
} from '@apexcli/core'
import type {
  BulkOperationOptions,
  BulkOperationTaskResult,
} from '@/types/bulk-operations'
import { BULK_OPERATION_DEFAULTS } from '@/types/bulk-operations'
import type {
  TaskTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateListResponse,
  CreateTaskFromTemplateRequest,
  TemplateFilters,
} from '@/types/task-template'
import type {
  ChangelogFilters,
  ChangelogResponse,
  taskToChangelogEntry,
} from '@/types/changelog'
import type {
  ExportDialogOptions,
  ExportDialogResult,
} from '@/types/export-dialog'
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
  private _baseUrl: string | null = null
  private _explicitUrl: string | null = null

  constructor(baseUrl?: string) {
    // Store explicit URL if provided, otherwise evaluate lazily
    this._explicitUrl = baseUrl || null
  }

  /**
   * Get the base URL, evaluating lazily for client-side rendering
   */
  private get baseUrl(): string {
    if (this._explicitUrl) {
      return this._explicitUrl
    }
    // Lazy evaluation - only get URL when actually needed (on client)
    if (this._baseUrl === null || typeof window !== 'undefined') {
      this._baseUrl = getApiUrl()
    }
    return this._baseUrl
  }

  /**
   * Update the base URL (useful for runtime configuration)
   */
  setBaseUrl(url: string): void {
    this._explicitUrl = url
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
   * Get task stats (lightweight, for dashboard)
   */
  async getTaskStats(): Promise<{
    byStatus: Record<string, number>
    totalCost: number
    totalTokens: number
  }> {
    const response = await this.fetch('/tasks/stats')
    return response.json()
  }

  /**
   * List tasks (paginated)
   */
  async listTasks(filters?: {
    status?: string
    workflow?: string
    limit?: number
    offset?: number
  }): Promise<{ tasks: Task[]; total: number; count: number; limit: number; offset: number }> {
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
   * Resume a paused task
   */
  async resumeTask(taskId: string): Promise<{ ok: boolean; message: string }> {
    const response = await this.fetch(`/tasks/${taskId}/resume`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return response.json()
  }

  /**
   * List all paused tasks
   */
  async getPausedTasks(): Promise<{ tasks: Task[]; count: number; message: string }> {
    const response = await this.fetch('/tasks/paused')
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

  /**
   * Inject context into a running task
   */
  async injectContext(taskId: string, request: InjectContextRequest): Promise<InjectContextResponse> {
    const response = await this.fetch(`/tasks/${taskId}/context`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return response.json()
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
    const response = await this.fetch(`/agents/${encodeURIComponent(name)}`)
    return response.json()
  }

  /**
   * Create a new agent
   */
  async createAgent(agent: AgentDefinition): Promise<AgentDefinition> {
    const response = await this.fetch('/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    })
    return response.json()
  }

  /**
   * Update an existing agent
   */
  async updateAgent(name: string, agent: AgentDefinition): Promise<AgentDefinition> {
    const response = await this.fetch(`/agents/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(agent),
    })
    return response.json()
  }

  /**
   * Delete an existing agent
   */
  async deleteAgent(name: string): Promise<{ ok: boolean; message: string }> {
    const response = await this.fetch(`/agents/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
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

  // ============================================================================
  // Template API Methods
  // ============================================================================

  /**
   * List task templates with optional filters
   */
  async getTemplates(filters?: TemplateFilters): Promise<TemplateListResponse> {
    const params = new URLSearchParams()
    if (filters?.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category]
      categories.forEach(cat => params.append('category', cat))
    }
    if (filters?.workflow) {
      const workflows = Array.isArray(filters.workflow) ? filters.workflow : [filters.workflow]
      workflows.forEach(wf => params.append('workflow', wf))
    }
    if (filters?.tags?.length) {
      filters.tags.forEach(tag => params.append('tags', tag))
    }
    if (filters?.isQuickAction !== undefined) {
      params.set('isQuickAction', filters.isQuickAction.toString())
    }
    if (filters?.includeArchived !== undefined) {
      params.set('includeArchived', filters.includeArchived.toString())
    }
    if (filters?.search) {
      params.set('search', filters.search)
    }

    const url = `/templates${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)
    const data = await response.json()

    // Transform API response to match TemplateListResponse format
    return {
      templates: data.templates || data,
      total: data.count || data.length || 0,
      page: 1,
      pageSize: data.count || data.length || 0,
    }
  }

  /**
   * Get quick action templates (templates with isQuickAction=true)
   */
  async getQuickActionTemplates(): Promise<TaskTemplate[]> {
    const response = await this.getTemplates({ isQuickAction: true })
    return response.templates
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string): Promise<TaskTemplate> {
    const response = await this.fetch(`/templates/${templateId}`)
    return response.json()
  }

  /**
   * Create a new template
   */
  async createTemplate(request: CreateTemplateRequest): Promise<TaskTemplate> {
    const response = await this.fetch('/templates', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return response.json()
  }

  /**
   * Update an existing template
   */
  async updateTemplate(request: UpdateTemplateRequest): Promise<TaskTemplate> {
    const { id, ...updateData } = request
    const response = await this.fetch(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    return response.json()
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<{ ok: boolean; message: string }> {
    const response = await this.fetch(`/templates/${templateId}`, {
      method: 'DELETE',
    })
    return response.json()
  }

  /**
   * Create a task from a template
   */
  async createTaskFromTemplate(request: CreateTaskFromTemplateRequest): Promise<CreateTaskResponse> {
    // First get the template to interpolate its values
    const template = await this.getTemplate(request.templateId)

    // Import interpolation helper
    const { interpolateTemplateString } = await import('@/types/task-template')

    // Interpolate template values
    const description = interpolateTemplateString(template.descriptionTemplate, request.variables)
    const acceptanceCriteria = template.acceptanceCriteriaTemplate
      ? interpolateTemplateString(template.acceptanceCriteriaTemplate, request.variables)
      : undefined

    // Create task using regular createTask method
    return this.createTask({
      description,
      acceptanceCriteria,
      workflow: template.workflow,
      autonomy: request.autonomy || template.autonomy,
      priority: request.priority || template.priority,
      effort: request.effort || template.effort,
      projectPath: request.projectPath,
    })
  }

  // ============================================================================
  // Template API Alias Methods (for backward compatibility)
  // ============================================================================

  /**
   * Create a new task template
   * @deprecated Use createTemplate instead
   */
  async createTaskTemplate(request: CreateTemplateRequest): Promise<TaskTemplate> {
    return this.createTemplate(request)
  }

  /**
   * List task templates with optional filters
   * @deprecated Use getTemplates instead
   */
  async listTaskTemplates(filters?: TemplateFilters): Promise<TemplateListResponse> {
    return this.getTemplates(filters)
  }

  /**
   * Get a single task template by ID
   * @deprecated Use getTemplate instead
   */
  async getTaskTemplate(templateId: string): Promise<TaskTemplate> {
    return this.getTemplate(templateId)
  }

  /**
   * Update an existing task template
   * @deprecated Use updateTemplate instead
   */
  async updateTaskTemplate(request: UpdateTemplateRequest): Promise<TaskTemplate> {
    return this.updateTemplate(request)
  }

  /**
   * Delete a task template
   * @deprecated Use deleteTemplate instead
   */
  async deleteTaskTemplate(templateId: string): Promise<{ ok: boolean; message: string }> {
    return this.deleteTemplate(templateId)
  }

  // ============================================================================
  // MCP API Methods
  // ============================================================================

  /**
   * Get MCP marketplace entries with filtering
   */
  async getMCPMarketplaceEntries(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    verified?: boolean;
  }): Promise<{ entries: MCPMarketplaceEntry[] }> {
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);
    if (options?.search) params.set('search', options.search);
    if (options?.featured !== undefined) params.set('featured', options.featured.toString());
    if (options?.verified !== undefined) params.set('verified', options.verified.toString());

    const url = `/mcp/marketplace${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetch(url);
    return response.json();
  }

  /**
   * List installed MCP servers
   */
  async listMCPServers(): Promise<MCPServerConfig[]> {
    const response = await this.fetch('/mcp/servers')
    return response.json()
  }

  /**
   * Install an MCP server
   */
  async installMCPServer(serverName: string): Promise<{
    ok: boolean;
    message: string;
    serverConfig: MCPServerConfig
  }> {
    const response = await this.fetch(`/mcp/servers/${serverName}/install`, {
      method: 'POST',
    })
    return response.json()
  }

  /**
   * Uninstall an MCP server
   */
  async uninstallMCPServer(serverName: string): Promise<{ ok: boolean; message: string }> {
    const response = await this.fetch(`/mcp/servers/${serverName}`, {
      method: 'DELETE',
    })
    return response.json()
  }

  /**
   * Get MCP server status
   */
  async getMCPServerStatus(serverName: string): Promise<{
    name: string;
    status: 'running' | 'stopped' | 'error';
    lastError?: string;
  }> {
    const response = await this.fetch(`/mcp/servers/${serverName}/status`)
    return response.json()
  }

  /**
   * Start an MCP server
   */
  async startMCPServer(serverName: string): Promise<{ ok: boolean; message: string }> {
    const response = await this.fetch(`/mcp/servers/${serverName}/start`, {
      method: 'POST',
    })
    return response.json()
  }

  /**
   * Stop an MCP server
   */
  async stopMCPServer(serverName: string): Promise<{ ok: boolean; message: string }> {
    const response = await this.fetch(`/mcp/servers/${serverName}/stop`, {
      method: 'POST',
    })
    return response.json()
  }

  /**
   * Get marketplace categories
   */
  async getMCPMarketplaceCategories(): Promise<{ categories: Array<{ name: string; count: number }> }> {
    const response = await this.fetch('/mcp/marketplace/categories')
    return response.json()
  }

  /**
   * Get featured marketplace entries
   */
  async getFeaturedMCPEntries(): Promise<{ entries: MCPMarketplaceEntry[] }> {
    const response = await this.fetch('/mcp/marketplace/featured')
    return response.json()
  }

  /**
   * Get installation recommendations
   */
  async getMCPRecommendations(): Promise<{
    essential: MCPMarketplaceEntry[];
    recommended: MCPMarketplaceEntry[];
    optional: MCPMarketplaceEntry[];
  }> {
    const response = await this.fetch('/mcp/recommendations')
    return response.json()
  }

  /**
   * Auto-configure standard development tools
   */
  async autoConfigureMCPTools(options?: {
    developmentTools?: boolean;
    productivityTools?: boolean;
    devopsTools?: boolean;
    customServers?: string[];
  }): Promise<{
    ok: boolean;
    message: string;
    configured: MCPServerConfig[];
    skipped: string[];
    errors: Array<{ name: string; error: string }>;
  }> {
    const response = await this.fetch('/mcp/auto-configure', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
    return response.json()
  }

  /**
   * Get changelog entries from completed tasks
   */
  async getChangelog(filters?: ChangelogFilters): Promise<ChangelogResponse> {
    const params = new URLSearchParams()

    // Status filters - default to completed if not specified
    if (filters?.status) {
      params.set('status', filters.status.join(','))
    } else {
      params.set('status', 'completed')
    }

    // Workflow filter
    if (filters?.workflows && filters.workflows.length > 0) {
      params.set('workflow', filters.workflows.join(','))
    }

    // Date range filters
    if (filters?.startDate) {
      params.set('startDate', filters.startDate.toISOString())
    }
    if (filters?.endDate) {
      params.set('endDate', filters.endDate.toISOString())
    }

    // Search filter
    if (filters?.search) {
      params.set('search', filters.search)
    }

    // Pagination
    if (filters?.limit) {
      params.set('limit', filters.limit.toString())
    }
    if (filters?.offset) {
      params.set('offset', filters.offset.toString())
    }

    const url = `/tasks/changelog${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)
    const data = await response.json()

    // Transform task data to changelog entries
    const { taskToChangelogEntry } = await import('@/types/changelog')
    const entries = data.tasks.map(taskToChangelogEntry)

    // Extract unique workflows
    const workflowSet = new Set<string>()
    data.tasks.forEach((task: Task) => {
      if (typeof task.workflow === 'string') {
        workflowSet.add(task.workflow)
      }
    })
    const workflows = Array.from(workflowSet).sort()

    return {
      entries,
      total: data.total,
      hasMore: data.offset + data.count < data.total,
      workflows,
    }
  }

  /**
   * Export tasks based on the provided options
   * @param options - Export configuration including format, filters, and task selection
   * @returns Export result with content and metadata
   */
  async exportTasks(options: ExportDialogOptions): Promise<ExportDialogResult> {
    const params = new URLSearchParams()

    // Set format
    params.set('format', options.format)

    // Date range filters
    if (options.dateRange.startDate) {
      params.set('startDate', options.dateRange.startDate.toISOString())
    }
    if (options.dateRange.endDate) {
      params.set('endDate', options.dateRange.endDate.toISOString())
    }

    // Task selection filters
    if (options.filterByTasks && options.selectedTaskIds.length > 0) {
      params.set('taskIds', options.selectedTaskIds.join(','))
    }

    // Archive/trash status
    if (options.includeArchived) {
      params.set('includeArchived', 'true')
    }
    if (options.includeTrashed) {
      params.set('includeTrashed', 'true')
    }

    const url = `/tasks/export${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)

    if (response.headers.get('content-type')?.includes('application/json')) {
      // If we get JSON back, it's likely an error response
      const errorData = await response.json()
      throw new Error(errorData.message || 'Export failed')
    }

    // Get content as text for all formats
    const content = await response.text()

    // Extract filename from Content-Disposition header if available
    const contentDisposition = response.headers.get('content-disposition')
    let filename = 'apex-tasks-export'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    } else {
      // Generate filename based on format
      const { generateExportFilename } = await import('@/types/export-dialog')
      filename = generateExportFilename(options.format)
    }

    // Get MIME type
    const mimeType = response.headers.get('content-type') || 'application/octet-stream'

    // Extract task count from response headers if available
    const taskCountHeader = response.headers.get('x-task-count')
    const taskCount = taskCountHeader ? parseInt(taskCountHeader, 10) : 0

    return {
      success: true,
      filename,
      content,
      mimeType,
      taskCount,
    }
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

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Execute operations with controlled concurrency
   */
  private async executeWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number,
    delayBetweenOps: number = 0,
    signal?: AbortSignal
  ): Promise<R[]> {
    const results: R[] = new Array(items.length)
    const executing: Promise<void>[] = []

    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) {
        throw new Error('Operation aborted')
      }

      const item = items[i]
      const execute = async (index: number): Promise<void> => {
        try {
          const result = await fn(item)
          results[index] = result
        } catch (error) {
          throw error
        }
      }

      const promise = execute(i)
      executing.push(promise)

      // If we've reached the concurrency limit, wait for one to complete
      if (executing.length >= concurrency) {
        // Wait for at least one to complete
        await Promise.race(executing.map(p => p.catch(() => {})))
        // Filter out completed promises by creating a wrapper that tracks completion
        // Since we can't easily detect which promises are done, use a simpler approach:
        // Just wait for all current ones and start fresh
        await Promise.allSettled(executing)
        executing.length = 0
      }

      // Add delay between operations if specified
      if (delayBetweenOps > 0 && i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenOps))
      }
    }

    // Wait for all remaining operations
    await Promise.allSettled(executing)
    return results
  }

  /**
   * Cancel multiple tasks in parallel
   * @param taskIds - Array of task IDs to cancel
   * @param options - Configuration for parallel execution
   */
  async bulkCancelTasks(
    taskIds: string[],
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationTaskResult[]> {
    if (taskIds.length === 0) return []

    const {
      concurrency = BULK_OPERATION_DEFAULTS.concurrency,
      delayBetweenOps = BULK_OPERATION_DEFAULTS.delayBetweenOps,
      signal,
    } = options

    const results: BulkOperationTaskResult[] = []

    try {
      await this.executeWithConcurrency(
        taskIds,
        async (taskId: string) => {
          try {
            const task = await this.cancelTask(taskId)
            const result: BulkOperationTaskResult = {
              taskId,
              success: true,
              task,
            }
            results.push(result)
            return result
          } catch (error) {
            const result: BulkOperationTaskResult = {
              taskId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }
            results.push(result)
            return result
          }
        },
        concurrency,
        delayBetweenOps,
        signal
      )
    } catch (error) {
      // If operation was aborted or had fatal error, still return partial results
      if (error instanceof Error && !error.message.includes('aborted')) {
        throw error
      }
    }

    return results
  }

  /**
   * Retry multiple tasks in parallel
   * @param taskIds - Array of task IDs to retry
   * @param options - Configuration for parallel execution
   */
  async bulkRetryTasks(
    taskIds: string[],
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationTaskResult[]> {
    if (taskIds.length === 0) return []

    const {
      concurrency = BULK_OPERATION_DEFAULTS.concurrency,
      delayBetweenOps = BULK_OPERATION_DEFAULTS.delayBetweenOps,
      signal,
    } = options

    const results: BulkOperationTaskResult[] = []

    try {
      await this.executeWithConcurrency(
        taskIds,
        async (taskId: string) => {
          try {
            const task = await this.retryTask(taskId)
            const result: BulkOperationTaskResult = {
              taskId,
              success: true,
              task,
            }
            results.push(result)
            return result
          } catch (error) {
            const result: BulkOperationTaskResult = {
              taskId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }
            results.push(result)
            return result
          }
        },
        concurrency,
        delayBetweenOps,
        signal
      )
    } catch (error) {
      // If operation was aborted or had fatal error, still return partial results
      if (error instanceof Error && !error.message.includes('aborted')) {
        throw error
      }
    }

    return results
  }

  /**
   * Delete multiple tasks in parallel
   * @param taskIds - Array of task IDs to delete
   * @param options - Configuration for parallel execution
   */
  async bulkDeleteTasks(
    taskIds: string[],
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationTaskResult[]> {
    if (taskIds.length === 0) return []

    const {
      concurrency = BULK_OPERATION_DEFAULTS.concurrency,
      delayBetweenOps = BULK_OPERATION_DEFAULTS.delayBetweenOps,
      signal,
    } = options

    const results: BulkOperationTaskResult[] = []

    try {
      await this.executeWithConcurrency(
        taskIds,
        async (taskId: string) => {
          try {
            // Note: Assuming there will be a deleteTask method
            // For now, we'll implement a placeholder that uses the fetch method directly
            const response = await this.fetch(`/tasks/${taskId}`, {
              method: 'DELETE',
            })
            const task = await response.json()
            const result: BulkOperationTaskResult = {
              taskId,
              success: true,
              task,
            }
            results.push(result)
            return result
          } catch (error) {
            const result: BulkOperationTaskResult = {
              taskId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }
            results.push(result)
            return result
          }
        },
        concurrency,
        delayBetweenOps,
        signal
      )
    } catch (error) {
      // If operation was aborted or had fatal error, still return partial results
      if (error instanceof Error && !error.message.includes('aborted')) {
        throw error
      }
    }

    return results
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
