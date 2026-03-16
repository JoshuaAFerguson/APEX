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
