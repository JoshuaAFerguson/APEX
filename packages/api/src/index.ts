import Fastify, { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import {
  Task,
  TaskStatus,
  TaskUsage,
  CreateTaskRequest,
  CreateTaskResponse,
  UpdateTaskStatusRequest,
  ApproveGateRequest,
  ApprovalDecisionRequest,
  ApprovalDecisionResponse,
  InjectContextRequest,
  InjectContextResponse,
  ContextInjectedEventData,
  ApexEvent,
  SubtaskStrategy,
  SubtaskDefinition,
  TaskTemplate,
  HealthMetrics,
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  AutoFixEvent,
  MCPInstallation,
  safeSerialize,
  truncatePayload,
  serializeMCPError,
  AgentDefinition,
} from '@apexcli/core';
import {
  ApexOrchestrator,
  DaemonManager,
  HealthMonitor,
  ToolCallStartEvent,
  ToolCallProgressEvent,
  ToolCallCompleteEvent,
  MCPErrorEventData,
  MCPConnectionEventData,
  MCPDisconnectionEventData,
  MCPReconnectingEventData,
  MCPHealthCheckEventData,
  MCPStateChangeEventData,
} from '@apexcli/orchestrator';

import { registerScreenshotRoutes } from './routes/screenshot.js';
import { SlackService } from './services/slack-service.js';
import { SlackAppService } from './services/slack-app-service.js';
import { TeamsService } from './services/teams-service.js';
import { DiscordService } from './services/discord-service.js';
import authPlugin from './middleware/auth.js';

/**
 * Request payload for decomposing a task into subtasks.
 *
 * @interface DecomposeTaskRequest
 */
interface DecomposeTaskRequest {
  /** Array of subtask definitions to create */
  subtasks: SubtaskDefinition[];
  /** Strategy for executing the subtasks (optional) */
  strategy?: SubtaskStrategy;
}

/**
 * Request payload for creating a new task template.
 *
 * @interface CreateTemplateRequest
 */
interface CreateTemplateRequest {
  /** Name of the template */
  name: string;
  /** Description of what this template does */
  description: string;
  /** Workflow to use for tasks created from this template */
  workflow: string;
  /** Optional priority level */
  priority?: string;
  /** Optional estimated effort */
  effort?: string;
  /** Optional acceptance criteria */
  acceptanceCriteria?: string;
  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Request payload for updating an existing task template.
 *
 * @interface UpdateTemplateRequest
 */
interface UpdateTemplateRequest {
  /** Updated name of the template */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated workflow to use */
  workflow?: string;
  /** Updated priority level */
  priority?: string;
  /** Updated estimated effort */
  effort?: string;
  /** Updated acceptance criteria */
  acceptanceCriteria?: string;
  /** Updated tags for categorization */
  tags?: string[];
}

/**
 * WebSocket client tracking with event filtering capabilities.
 *
 * @interface WebSocketClient
 */
interface WebSocketClient {
  /** The WebSocket connection instance */
  socket: WebSocket;
  /** Set of event types to filter for (if empty, receives all events) */
  eventFilters?: Set<string>;
}

const clients = new Map<string, Set<WebSocketClient>>();

/**
 * Configuration options for starting the APEX API server.
 *
 * @interface ServerOptions
 * @example
 * ```typescript
 * const options: ServerOptions = {
 *   port: 3000,
 *   host: '0.0.0.0',
 *   projectPath: '/path/to/project',
 *   silent: false
 * };
 * const server = await createServer(options);
 * ```
 */
export interface ServerOptions {
  /** Port number to listen on (default: 3000) */
  port?: number;
  /** Host address to bind to (default: '0.0.0.0') */
  host?: string;
  /** Path to the APEX project directory */
  projectPath: string;
  /** Whether to suppress server logging (default: false) */
  silent?: boolean;
}

/**
 * Creates and configures a Fastify server instance for the APEX API.
 *
 * Sets up REST endpoints for task management, WebSocket connections for real-time events,
 * and integrates with the ApexOrchestrator for task execution and monitoring.
 *
 * @param options - Server configuration options
 * @returns Promise that resolves to the configured Fastify server instance
 *
 * @example
 * ```typescript
 * const server = await createServer({
 *   port: 3000,
 *   projectPath: '/path/to/project'
 * });
 * await server.listen({ port: 3000, host: '0.0.0.0' });
 * ```
 */
export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const { port = 3000, host = '0.0.0.0', projectPath, silent = false } = options;

  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;
  const app = Fastify({
    logger: (isTest || silent) ? false : {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Initialize orchestrator to get config for auth middleware
  const orchestrator = new ApexOrchestrator({ projectPath, apiUrl: `http://${host}:${port}` });
  await orchestrator.initialize();

  const config = await orchestrator.getConfig();

  // Register auth middleware with configuration
  await app.register(authPlugin, {
    enabled: config.api?.auth?.enabled ?? false,
    apiKeys: config.api?.auth?.apiKeys ?? [],
    publicRoutes: ['/health', '/status', '/metrics', '/ws']
  });

  // Global error handler for production security
  app.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Log the full error for debugging (only visible in logs, not in response)
    app.log.error(error, `Error in ${request.method} ${request.url}`);

    // Determine appropriate status code
    let statusCode = 500;
    if (error.statusCode) {
      statusCode = error.statusCode;
    } else if (error.code === 'FST_ERR_VALIDATION') {
      statusCode = 400;
    }

    // Create secure error response
    const errorResponse: {
      error: string;
      statusCode: number;
      message?: string;
    } = {
      error: 'Internal Server Error',
      statusCode
    };

    // In production, only return generic error messages
    if (isProduction) {
      if (statusCode >= 400 && statusCode < 500) {
        errorResponse.error = 'Bad Request';
        errorResponse.message = 'The request could not be processed';
      } else {
        errorResponse.error = 'Internal Server Error';
        errorResponse.message = 'An internal server error occurred';
      }
    } else {
      // In development/test, provide more detailed errors (but still no stack traces)
      errorResponse.message = error.message || 'An error occurred';
    }

    // Never include stack traces in any environment
    // This ensures security even if someone accidentally sets NODE_ENV incorrectly
    delete error.stack;

    return reply.status(statusCode).send(errorResponse);
  });

  // Register screenshot routes
  await registerScreenshotRoutes(app);

  // Initialize Slack App Service with OAuth support
  const slackAppService = new SlackAppService({
    orchestrator,
    config: config.slack,
    getDatabase: () => orchestrator.getStore().getDatabase(),
    logger: app.log,
  });

  try {
    await slackAppService.start();

    // Mount OAuth routes if enabled
    if (slackAppService.isOAuthEnabled()) {
      const slackRouter = slackAppService.getRouter();
      if (slackRouter) {
        app.register(async (fastify) => {
          fastify.all('/slack/*', async (request, reply) => {
            // Forward to Express receiver
            slackRouter(request.raw, reply.raw);
          });
        });

        app.log.info('Slack OAuth routes registered: /slack/install, /slack/oauth_redirect');
      }
    }
  } catch (error) {
    app.log.error(`Slack App integration failed to start: ${error instanceof Error ? error.message : error}`);
  }

  // Legacy Socket Mode service (for backward compatibility)
  const slackService = new SlackService({ orchestrator, config: config.slack, logger: app.log });
  try {
    if (!slackAppService.isOAuthEnabled() && slackService.isEnabled()) {
      await slackService.start();
    }
  } catch (error) {
    app.log.error(`Slack Socket Mode failed to start: ${error instanceof Error ? error.message : error}`);
  }

  const teamsService = new TeamsService({ orchestrator, config: config.teams, logger: app.log });
  try {
    await teamsService.start();
  } catch (error) {
    app.log.error(`Teams integration failed to start: ${error instanceof Error ? error.message : error}`);
  }

  const discordService = new DiscordService({ orchestrator, config: config.discord, logger: app.log });
  try {
    await discordService.start();
  } catch (error) {
    app.log.error(`Discord integration failed to start: ${error instanceof Error ? error.message : error}`);
  }

  // Initialize daemon manager and health monitor for health endpoint
  const daemonManager = new DaemonManager({ projectPath });
  const healthMonitor = new HealthMonitor();

  // Store previous health metrics for comparison
  let lastHealthMetrics: HealthMetrics | null = null;

  // Optional: Set up periodic health monitoring (every 30 seconds)
  // This will broadcast health:updated events when significant changes are detected
  let healthMonitoringInterval: NodeJS.Timeout | null = null;
  if (!process.env.DISABLE_HEALTH_MONITORING) {
    healthMonitoringInterval = setInterval(async () => {
      try {
        const daemonStatus = await daemonManager.getStatus();
        // Note: DaemonStatus uses 'running' not 'isRunning', and health metrics are stored in state file
        if (daemonStatus.running && daemonStatus.uptime) {
          const currentMetrics: HealthMetrics = {
            uptime: daemonStatus.uptime,
            memoryUsage: process.memoryUsage(),
            taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 }, // Would need to get from orchestrator
            lastHealthCheck: new Date(),
            healthChecksPassed: 0,
            healthChecksFailed: 0,
            restartHistory: [],
          };

          const metricsChanged = checkHealthMetricsChanged(currentMetrics, lastHealthMetrics);
          if (metricsChanged && lastHealthMetrics) {
            broadcast('health', {
              type: 'health:updated' as any, // Type cast needed - health:updated is not in ApexEventType
              taskId: 'health',
              timestamp: new Date(),
              data: {
                metrics: currentMetrics,
                previous: lastHealthMetrics,
                changeDetected: true,
                source: 'periodic-monitoring'
              },
            });
          }
          lastHealthMetrics = currentMetrics;
        }
      } catch (error) {
        // Silent fail for periodic monitoring to avoid spam
        app.log.debug(`Periodic health monitoring error: ${error instanceof Error ? error.message : error}`);
      }
    }, 30000); // 30 seconds
  }

  // Set up orchestrator event handlers for broadcasting
  setupEventBroadcasting(orchestrator);

  // ============================================================================
  // Health check
  // ============================================================================

  app.get('/health', async () => {
    return { status: 'ok', version: '0.7.0' };
  });

  // Comprehensive daemon health endpoint
  app.get('/daemon/health', async (request, reply) => {
    try {
      // Get daemon status
      const daemonStatus = await daemonManager.getStatus();

      if (!daemonStatus.running) {
        return reply.status(503).send({
          error: 'Daemon not running',
          status: 'unavailable',
          metrics: null,
          message: 'APEX daemon is not currently running. Start the daemon to get health metrics.'
        });
      }

      // Get health metrics from health monitor (DaemonStatus doesn't have health property)
      const healthMetrics: HealthMetrics = healthMonitor.getHealthReport();

      // Check if metrics have changed significantly
      const metricsChanged = checkHealthMetricsChanged(healthMetrics, lastHealthMetrics);

      // If metrics changed significantly, broadcast WebSocket event
      if (metricsChanged && lastHealthMetrics) {
        broadcast('health', {
          type: 'health:updated' as any, // Type cast needed - health:updated is not in ApexEventType
          taskId: 'health',
          timestamp: new Date(),
          data: {
            metrics: healthMetrics,
            previous: lastHealthMetrics,
            changeDetected: true
          },
        });
      }

      // Store current metrics for next comparison
      lastHealthMetrics = healthMetrics;

      // Perform health check
      const isHealthy = assessDaemonHealth(healthMetrics);
      healthMonitor.performHealthCheck(isHealthy);

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        metrics: healthMetrics,
        daemon: {
          isRunning: daemonStatus.running,
          pid: daemonStatus.pid,
          startedAt: daemonStatus.startedAt,
          uptime: daemonStatus.uptime,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      app.log.error(`Health check failed: ${error instanceof Error ? error.message : error}`);

      return reply.status(500).send({
        error: 'Health check failed',
        status: 'error',
        metrics: null,
        message: error instanceof Error ? error.message : 'Unknown error occurred during health check',
        timestamp: new Date(),
      });
    }
  });

  // ============================================================================
  // Tasks API
  // ============================================================================

  // Create a new task
  app.post<{ Body: CreateTaskRequest }>('/tasks', async (request, reply) => {
    const { description, acceptanceCriteria, workflow, autonomy } = request.body;

    if (!description) {
      return reply.status(400).send({ error: 'Description is required' });
    }

    const task = await orchestrator.createTask({
      description,
      acceptanceCriteria,
      workflow,
      autonomy,
    });

    // Start execution in background
    orchestrator.executeTask(task.id).catch((error: Error) => {
      app.log.error(`Task ${task.id} failed: ${error.message}`);
    });

    const response: CreateTaskResponse = {
      taskId: task.id,
      status: task.status,
      message: 'Task created and execution started',
    };

    return reply.status(201).send(response);
  });

  // Get task by ID
  app.get<{ Params: { id: string }; Querystring: { logLimit?: string; logOffset?: string } }>(
    '/tasks/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { logLimit, logOffset } = request.query;
      const task = await orchestrator.getTask(id);

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Apply log pagination if requested (default: limit to 50 most recent logs)
      const limit = logLimit ? parseInt(logLimit, 10) : 50;
      const offset = logOffset ? parseInt(logOffset, 10) : 0;

      if (task.logs && task.logs.length > 0) {
        const totalLogs = task.logs.length;
        // Logs are typically in reverse chronological order, so slice from the end
        const paginatedLogs = task.logs.slice(offset, offset + limit);

        return {
          ...task,
          logs: paginatedLogs,
          logPagination: {
            total: totalLogs,
            limit,
            offset,
            hasMore: offset + limit < totalLogs,
          },
        };
      }

      return task;
    }
  );

  // Task stats (lightweight, for dashboard)
  app.get(
    '/tasks/stats',
    async (request, reply) => {
      const stats = await orchestrator.getTaskStats();
      return stats;
    }
  );

  // List tasks (paginated, lightweight by default)
  app.get<{ Querystring: { status?: TaskStatus; limit?: string; offset?: string; full?: string } }>(
    '/tasks',
    async (request, reply) => {
      const { status, limit, offset, full } = request.query;
      const parsedLimit = limit ? Math.min(parseInt(limit, 10), 200) : 50;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;
      const lightweight = full !== 'true';

      const tasks = await orchestrator.listTasks({
        status,
        limit: parsedLimit,
        offset: parsedOffset,
        lightweight,
      });

      const counts = await orchestrator.countTasks({ status });

      return { tasks, count: tasks.length, total: counts.total, limit: parsedLimit, offset: parsedOffset };
    }
  );

  // Update task status (called by agents via curl)
  app.post<{ Params: { id: string }; Body: UpdateTaskStatusRequest }>(
    '/tasks/:id/status',
    async (request, reply) => {
      const { id } = request.params;
      const { status, stage, message } = request.body;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      await orchestrator.updateTaskStatus(id, status as TaskStatus);

      // Broadcast update
      broadcast(id, {
        type: 'task:stage-changed',
        taskId: id,
        timestamp: new Date(),
        data: { status, stage, message },
      });

      return { ok: true };
    }
  );

  // Add log entry
  app.post<{ Params: { id: string }; Body: { level?: string; message: string; agent?: string } }>(
    '/tasks/:id/log',
    async (request, reply) => {
      const { id } = request.params;
      const { level = 'info', message, agent } = request.body;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Log entry is handled by the store
      // Broadcast the log
      broadcast(id, {
        type: 'log:entry',
        taskId: id,
        timestamp: new Date(),
        data: { level, message, agent },
      });

      return { ok: true };
    }
  );

  // Cancel a task
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/cancel',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const cancelled = await orchestrator.cancelTask(id);
      if (!cancelled) {
        return reply.status(400).send({ error: 'Task cannot be cancelled (already completed or failed)' });
      }

      return { ok: true, message: 'Task cancelled' };
    }
  );

  // Retry a failed/cancelled/stuck task
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/retry',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Allow retry for failed, cancelled, or stuck in-progress tasks
      const retryableStatuses = ['failed', 'cancelled', 'in-progress', 'planning'];
      if (!retryableStatuses.includes(task.status)) {
        return reply.status(400).send({ error: 'Only failed, cancelled, or stuck tasks can be retried' });
      }

      // Reset task and start execution
      await orchestrator.updateTaskStatus(id, 'pending');
      orchestrator.executeTask(id).catch((error: Error) => {
        app.log.error(`Task ${id} retry failed: ${error.message}`);
      });

      return { ok: true, message: 'Task retry started' };
    }
  );

  // Resume a paused task
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/resume',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Handle paused tasks — await to report actual outcome
      if (task.status === 'paused') {
        try {
          const resumed = await orchestrator.resumePausedTask(id);
          if (resumed) {
            return { ok: true, message: 'Task resume initiated', taskId: id };
          }
          return reply.status(409).send({ ok: false, error: 'Task could not be resumed', taskId: id });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          app.log.error(`Task ${id} resume failed: ${message}`);
          return reply.status(500).send({ ok: false, error: `Resume failed: ${message}`, taskId: id });
        }
      }

      // Handle pending tasks (subtasks that were never started)
      if (task.status === 'pending' || task.status === 'queued') {
        // Start execution in background
        orchestrator.executeTask(id).catch((error: Error) => {
          app.log.error(`Task ${id} failed: ${error.message}`);
        });
        return { ok: true, message: 'Task execution started', taskId: id };
      }

      // Handle completed/failed/cancelled tasks that have pending subtasks
      // This allows resuming a parent task to continue its unfinished subtasks
      if (task.subtaskIds && task.subtaskIds.length > 0) {
        const hasPending = await orchestrator.hasPendingSubtasks(id);
        if (hasPending) {
          // Continue executing pending subtasks in background
          orchestrator.continuePendingSubtasks(id).catch((error: Error) => {
            app.log.error(`Task ${id} failed while continuing subtasks: ${error.message}`);
          });
          return { ok: true, message: 'Continuing execution of pending subtasks', taskId: id };
        }
      }

      // For other statuses with no pending subtasks, suggest retry
      return reply.status(400).send({
        error: `Task cannot be resumed (current status: ${task.status}, no pending subtasks). Use /retry for failed/cancelled tasks.`
      });
    }
  );

  // Inject context into a running task
  app.post<{ Params: { id: string }; Body: InjectContextRequest }>(
    '/tasks/:id/context',
    async (request, reply) => {
      const { id } = request.params;
      const { context, source, priority } = request.body;

      // Input validation
      if (!context || typeof context !== 'string' || context.trim().length === 0) {
        return reply.status(400).send({ error: 'Context string is required' });
      }

      if (context.length > 100000) {
        return reply.status(400).send({ error: 'Context exceeds maximum length (100,000 characters)' });
      }

      if (source && source.length > 50) {
        return reply.status(400).send({ error: 'Source identifier exceeds maximum length (50 characters)' });
      }

      if (priority && !['low', 'normal', 'high'].includes(priority)) {
        return reply.status(400).send({ error: 'Invalid priority value. Must be low, normal, or high' });
      }

      // Check if task exists
      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if task is in a valid state for context injection
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        return reply.status(400).send({
          error: 'Cannot inject context into completed/cancelled task'
        });
      }

      try {
        // Broadcast WebSocket event for context injection
        const eventData: ContextInjectedEventData = {
          context: context.trim(),
          source,
          priority: priority || 'normal',
          timestamp: new Date()
        };

        const event: ApexEvent = {
          type: 'context:injected',
          taskId: id,
          timestamp: new Date(),
          data: eventData as unknown as Record<string, unknown>
        };

        broadcast(id, event);

        const response: InjectContextResponse = {
          ok: true,
          taskId: id,
          contextInjected: true,
          timestamp: new Date()
        };

        return response;
      } catch (error) {
        app.log.error(`Failed to inject context for task ${id}: ${error}`);
        return reply.status(500).send({
          error: 'Failed to inject context due to internal error'
        });
      }
    }
  );

  // List all paused tasks
  app.get('/tasks/paused', async (request, reply) => {
    const tasks = await orchestrator.listTasks({ status: 'paused' });
    return {
      tasks,
      count: tasks.length,
      message: tasks.length > 0
        ? `${tasks.length} paused task(s) found. Use POST /tasks/:id/resume to resume.`
        : 'No paused tasks found.'
    };
  });

  // ============================================================================
  // Trash Management API
  // ============================================================================

  // Move task to trash
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/trash',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      if (task.trashedAt) {
        return reply.status(400).send({ error: 'Task is already in trash' });
      }

      try {
        await orchestrator.trashTask(id);
        return { ok: true, message: 'Task moved to trash' };
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Failed to trash task'
        });
      }
    }
  );

  // Restore task from trash
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/restore',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      if (!task.trashedAt) {
        return reply.status(400).send({ error: 'Task is not in trash' });
      }

      try {
        await orchestrator.restoreTask(id);
        return { ok: true, message: 'Task restored from trash' };
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Failed to restore task'
        });
      }
    }
  );

  // List trashed tasks
  app.get('/tasks/trashed', async (request, reply) => {
    try {
      const trashedTasks = await orchestrator.listTrashedTasks();
      return {
        tasks: trashedTasks,
        count: trashedTasks.length,
        message: trashedTasks.length > 0
          ? `${trashedTasks.length} trashed task(s) found`
          : 'No trashed tasks found'
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to list trashed tasks'
      });
    }
  });

  // Permanently delete all trashed tasks
  app.delete('/tasks/trash', async (request, reply) => {
    try {
      const deletedCount = await orchestrator.emptyTrash();
      return {
        ok: true,
        deletedCount,
        message: deletedCount > 0
          ? `${deletedCount} task(s) permanently deleted from trash`
          : 'No tasks were deleted (trash was already empty)'
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to empty trash'
      });
    }
  });

  // ============================================================================
  // Archive Management API
  // ============================================================================

  // Archive a task
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/archive',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      if (task.archivedAt) {
        return reply.status(400).send({ error: 'Task is already archived' });
      }

      try {
        await orchestrator.archiveTask(id);
        return { ok: true, message: 'Task archived' };
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Failed to archive task'
        });
      }
    }
  );

  // List archived tasks
  app.get('/tasks/archived', async (request, reply) => {
    try {
      const archivedTasks = await orchestrator.listArchivedTasks();
      return {
        tasks: archivedTasks,
        count: archivedTasks.length,
        message: archivedTasks.length > 0
          ? `${archivedTasks.length} archived task(s) found`
          : 'No archived tasks found'
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to list archived tasks'
      });
    }
  });

  // ============================================================================
  // Subtasks API
  // ============================================================================

  // Decompose a task into subtasks
  app.post<{ Params: { id: string }; Body: DecomposeTaskRequest }>(
    '/tasks/:id/decompose',
    async (request, reply) => {
      const { id } = request.params;
      const { subtasks: subtaskDefinitions, strategy = 'sequential' } = request.body;

      if (!subtaskDefinitions || subtaskDefinitions.length === 0) {
        return reply.status(400).send({ error: 'At least one subtask definition is required' });
      }

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const subtasks = await orchestrator.decomposeTask(
        id,
        subtaskDefinitions,
        strategy
      ) as Task[];

      return {
        ok: true,
        parentTaskId: id,
        subtasks: subtasks.map((subtask: Task) => ({
          id: subtask.id,
          description: subtask.description,
          status: subtask.status,
        })),
        strategy,
      };
    }
  );

  // Get subtasks for a task
  app.get<{ Params: { id: string } }>(
    '/tasks/:id/subtasks',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const subtasks = await orchestrator.getSubtasks(id);

      return {
        parentTaskId: id,
        subtasks,
        count: subtasks.length,
      };
    }
  );

  // Get subtask status summary
  app.get<{ Params: { id: string } }>(
    '/tasks/:id/subtasks/status',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const status = await orchestrator.getSubtaskStatus(id);

      return {
        parentTaskId: id,
        ...status,
      };
    }
  );

  // Execute subtasks for a parent task
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/subtasks/execute',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const hasSubtasks = await orchestrator.hasSubtasks(id);
      if (!hasSubtasks) {
        return reply.status(400).send({ error: 'Task has no subtasks to execute' });
      }

      // Start subtask execution in background
      orchestrator.executeSubtasks(id).catch((error: Error) => {
        app.log.error(`Subtask execution for ${id} failed: ${error.message}`);
      });

      return {
        ok: true,
        message: 'Subtask execution started',
        parentTaskId: id,
      };
    }
  );

  // Get parent task for a subtask
  app.get<{ Params: { id: string } }>(
    '/tasks/:id/parent',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const parent = await orchestrator.getParentTask(id);
      if (!parent) {
        return reply.status(404).send({ error: 'This task has no parent (not a subtask)' });
      }

      return parent;
    }
  );

  // Check if task is a subtask
  app.get<{ Params: { id: string } }>(
    '/tasks/:id/is-subtask',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const isSubtask = await orchestrator.isSubtask(id);

      return {
        taskId: id,
        isSubtask,
        parentTaskId: task.parentTaskId || null,
      };
    }
  );

  // ============================================================================
  // Gates API
  // ============================================================================

  // Get gate status
  app.get<{ Params: { id: string; gateName: string } }>(
    '/tasks/:id/gates/:gateName',
    async (request, reply) => {
      const { id, gateName } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Gate checking would be handled by the store
      return { status: 'not-required' };
    }
  );

  // Approve a gate
  app.post<{ Params: { id: string; gateName: string }; Body: ApproveGateRequest }>(
    '/tasks/:id/gates/:gateName/approve',
    async (request, reply) => {
      const { id, gateName } = request.params;
      const { approver, comment } = request.body;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Store the approval
      await orchestrator.approveGate(id, gateName, approver || 'anonymous', comment);

      // Broadcast approval
      broadcast(id, {
        type: 'gate:approved',
        taskId: id,
        timestamp: new Date(),
        data: { gateName, approver, comment },
      });

      return { ok: true };
    }
  );

  // Reject a gate
  app.post<{ Params: { id: string; gateName: string }; Body: ApproveGateRequest }>(
    '/tasks/:id/gates/:gateName/reject',
    async (request, reply) => {
      const { id, gateName } = request.params;
      const { approver, comment } = request.body;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Store the rejection
      await orchestrator.rejectGate(id, gateName, approver || 'anonymous', comment);

      // Broadcast rejection
      broadcast(id, {
        type: 'gate:rejected',
        taskId: id,
        timestamp: new Date(),
        data: { gateName, rejector: approver, comment },
      });

      return { ok: true };
    }
  );

  // Get all gates for a task
  app.get<{ Params: { id: string } }>(
    '/tasks/:id/gates',
    async (request, reply) => {
      const { id } = request.params;

      const task = await orchestrator.getTask(id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const gates = await orchestrator.getAllGates(id);

      return { gates };
    }
  );

  // ============================================================================
  // Approvals API (v0.5.0)
  // ============================================================================

  // List pending approvals
  app.get('/api/approvals', async (request, reply) => {
    try {
      const pendingApprovals = await orchestrator.getPendingApprovals();

      return {
        approvals: pendingApprovals,
        count: pendingApprovals.length,
        message: pendingApprovals.length > 0
          ? `${pendingApprovals.length} pending approval(s) found`
          : 'No pending approvals found'
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to list pending approvals'
      });
    }
  });

  // Approve an approval request
  app.post<{ Params: { id: string }; Body: ApprovalDecisionRequest }>(
    '/api/approvals/:id/approve',
    async (request, reply) => {
      const { id: approvalId } = request.params;
      const { approver, comments } = request.body;

      if (!approver) {
        return reply.status(400).send({ error: 'Approver is required' });
      }

      try {
        // Grant the approval using the orchestrator
        await orchestrator.grantApproval(approvalId, approver, comments);

        // Get updated approval state
        const updatedState = await orchestrator.getApprovalStateById(approvalId);

        if (updatedState) {
          const response: ApprovalDecisionResponse = {
            success: true,
            approvalState: updatedState,
            willProceed: true
          };

          return response;
        } else {
          return {
            success: true,
            willProceed: true
          };
        }
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Failed to grant approval'
        });
      }
    }
  );

  // Deny an approval request
  app.post<{ Params: { id: string }; Body: ApprovalDecisionRequest }>(
    '/api/approvals/:id/deny',
    async (request, reply) => {
      const { id: approvalId } = request.params;
      const { approver, comments } = request.body;

      if (!approver) {
        return reply.status(400).send({ error: 'Approver is required' });
      }

      if (!comments) {
        return reply.status(400).send({ error: 'Reason/comment is required when denying approval' });
      }

      try {
        // Deny the approval using the orchestrator
        await orchestrator.denyApproval(approvalId, approver, comments);

        // Get updated approval state
        const updatedState = await orchestrator.getApprovalStateById(approvalId);

        if (updatedState) {
          const response: ApprovalDecisionResponse = {
            success: true,
            approvalState: updatedState,
            willProceed: false
          };

          return response;
        } else {
          return {
            success: true,
            willProceed: false
          };
        }
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Failed to deny approval'
        });
      }
    }
  );

  // ============================================================================
  // Confirmations API (v0.5.0)
  // ============================================================================

  // Respond to a confirmation request (POST and PUT for different response types)
  app.post<{ Params: { id: string }; Body: { response: 'accept' | 'reject'; approver?: string; comments?: string } }>(
    '/confirmations/:id/respond',
    async (request, reply) => {
      const { id: confirmationId } = request.params;
      const { response, approver, comments } = request.body;

      if (!confirmationId || !confirmationId.trim()) {
        return reply.status(400).send({ error: 'Confirmation ID is required' });
      }

      if (!response || !['accept', 'reject'].includes(response)) {
        return reply.status(400).send({
          error: 'Response is required and must be either "accept" or "reject"'
        });
      }

      try {
        let result;
        if (response === 'accept') {
          // Forward acceptance to orchestrator
          result = await orchestrator.grantApproval(confirmationId, approver || 'anonymous', comments);
        } else {
          // Forward rejection to orchestrator
          if (!comments) {
            return reply.status(400).send({
              error: 'Comments are required when rejecting a confirmation'
            });
          }
          result = await orchestrator.denyApproval(confirmationId, approver || 'anonymous', comments);
        }

        // Get updated confirmation state
        const updatedState = await orchestrator.getApprovalStateById(confirmationId);

        return {
          success: true,
          confirmationId,
          response,
          approver: approver || 'anonymous',
          comments,
          forwarded: true,
          confirmationState: updatedState,
          timestamp: new Date()
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process confirmation response';
        return reply.status(400).send({
          error: message,
          confirmationId,
          response
        });
      }
    }
  );

  // PUT endpoint for accepting confirmations
  app.put<{ Params: { id: string }; Body: { approver?: string; comments?: string } }>(
    '/confirmations/:id/respond',
    async (request, reply) => {
      const { id: confirmationId } = request.params;
      const { approver, comments } = request.body;

      if (!confirmationId || !confirmationId.trim()) {
        return reply.status(400).send({ error: 'Confirmation ID is required' });
      }

      try {
        // Forward acceptance to orchestrator
        await orchestrator.grantApproval(confirmationId, approver || 'anonymous', comments);

        // Get updated confirmation state
        const updatedState = await orchestrator.getApprovalStateById(confirmationId);

        return {
          success: true,
          confirmationId,
          response: 'accept',
          approver: approver || 'anonymous',
          comments,
          forwarded: true,
          confirmationState: updatedState,
          timestamp: new Date()
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to accept confirmation';
        return reply.status(400).send({
          error: message,
          confirmationId,
          response: 'accept'
        });
      }
    }
  );

  // ============================================================================
  // Agents API
  // ============================================================================

  // List available agents
  app.get('/agents', async () => {
    const agents = await orchestrator.getAgents();
    return { agents };
  });

  // Create new agent
  app.post<{ Body: AgentDefinition }>('/agents', async (request, reply) => {
    const agent = request.body;

    // Validate required fields
    if (!agent?.name?.trim()) {
      return reply.status(400).send({ error: 'Agent name is required' });
    }
    if (!agent?.description?.trim()) {
      return reply.status(400).send({ error: 'Agent description is required' });
    }
    if (!agent?.prompt?.trim()) {
      return reply.status(400).send({ error: 'Agent prompt is required' });
    }

    // Validate agent name format
    const nameRegex = /^[a-z][a-z0-9-_]*$/;
    if (!nameRegex.test(agent.name)) {
      return reply.status(400).send({ error: 'Agent name must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores' });
    }

    // Check for path traversal attempts
    if (agent.name.includes('..') || agent.name.includes('/') || agent.name.includes('\\')) {
      return reply.status(400).send({ error: 'Agent name cannot contain path traversal characters' });
    }

    // Check for URL encoded path traversal
    if (agent.name.includes('%2F') || agent.name.includes('%2f') || agent.name.includes('%5C') || agent.name.includes('%5c')) {
      return reply.status(400).send({ error: 'Agent name cannot contain URL encoded path traversal characters' });
    }

    // Check for duplicate
    const existing = await orchestrator.getAgent(agent.name);
    if (existing) {
      return reply.status(409).send({ error: `Agent already exists: ${agent.name}` });
    }

    try {
      const created = await orchestrator.createAgent(agent);
      return reply.status(201).send(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create agent';
      return reply.status(400).send({ error: message });
    }
  });

  // Get single agent by name
  app.get<{ Params: { name: string } }>('/agents/:name', async (request, reply) => {
    const { name } = request.params;

    // Validate agent name
    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Agent name is required' });
    }

    const agent = await orchestrator.getAgent(name);

    if (!agent) {
      return reply.status(404).send({ error: `Agent not found: ${name}` });
    }

    return agent;
  });

  // Update agent by name
  app.put<{ Params: { name: string }; Body: Partial<AgentDefinition> }>(
    '/agents/:name',
    async (request, reply) => {
      const { name } = request.params;
      const updates = request.body;

      // Validate agent name
      if (!name || !name.trim()) {
        return reply.status(400).send({ error: 'Agent name is required' });
      }

      // Validate update fields if provided
      if (updates.description !== undefined && (!updates.description || !updates.description.trim())) {
        return reply.status(400).send({ error: 'Agent description cannot be empty' });
      }
      if (updates.prompt !== undefined && (!updates.prompt || !updates.prompt.trim())) {
        return reply.status(400).send({ error: 'Agent prompt cannot be empty' });
      }

      // Check if agent exists
      const existing = await orchestrator.getAgent(name);
      if (!existing) {
        return reply.status(404).send({ error: `Agent not found: ${name}` });
      }

      try {
        const updated = await orchestrator.updateAgent(name, updates);
        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update agent';
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Delete agent by name
  app.delete<{ Params: { name: string } }>('/agents/:name', async (request, reply) => {
    const { name } = request.params;

    // Validate agent name
    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Agent name is required' });
    }

    // Validate agent name format
    const nameRegex = /^[a-z][a-z0-9-_]*$/;
    if (!nameRegex.test(name)) {
      return reply.status(400).send({ error: 'Agent name must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores' });
    }

    // Check for path traversal attempts
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      return reply.status(400).send({ error: 'Agent name cannot contain path traversal characters' });
    }

    // Check for URL encoded path traversal
    if (name.includes('%2F') || name.includes('%2f') || name.includes('%5C') || name.includes('%5c')) {
      return reply.status(400).send({ error: 'Agent name cannot contain URL encoded path traversal characters' });
    }

    try {
      await orchestrator.deleteAgent(name);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: `Agent not found: ${name}` });
      }
      return reply.status(500).send({
        error: 'Failed to delete agent'
      });
    }
  });

  // ============================================================================
  // Config API
  // ============================================================================

  // Get configuration
  app.get('/config', async () => {
    const config = await orchestrator.getConfig();
    return config;
  });

  // ============================================================================
  // MCP (Model Context Protocol) API
  // ============================================================================

  // Get MCP marketplace entries with filtering
  app.get<{ Querystring: { category?: string; search?: string; featured?: string; verified?: string } }>(
    '/mcp/marketplace',
    async (request, reply) => {
      try {
        const { category, search, featured, verified } = request.query;
        const options = {
          category,
          search,
          featured: featured === 'true',
          verified: verified === 'true' ? true : verified === 'false' ? false : undefined
        };

        const entries = await orchestrator.getMcpMarketplaceEntries(options);
        return { entries };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch marketplace entries';
        return reply.status(500).send({ error: message });
      }
    }
  );

  // List installed MCP servers
  app.get('/mcp/servers', async (request, reply) => {
    try {
      const servers = await orchestrator.listMcpServers();
      return servers;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list MCP servers';
      return reply.status(500).send({ error: message });
    }
  });

  // List installed MCP servers as MCPInstallation objects
  app.get('/mcp/installed', async (request, reply) => {
    try {
      const installations = await orchestrator.listMcpInstallations();
      return { installations };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list installed MCP servers';
      return reply.status(500).send({ error: message });
    }
  });

  // Get detailed MCP server information by ID
  app.get<{ Params: { id: string } }>(
    '/mcp/servers/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!id || !id.trim()) {
        return reply.status(400).send({ error: 'Server ID is required' });
      }

      try {
        const serverDetails = await orchestrator.getMcpServerDetails(id);
        return serverDetails;
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: `MCP server '${id}' not found` });
        }
        const message = error instanceof Error ? error.message : `Failed to get MCP server details for '${id}'`;
        return reply.status(500).send({ error: message });
      }
    }
  );

  // Install an MCP server
  app.post<{ Params: { serverName: string } }>(
    '/mcp/servers/:serverName/install',
    async (request, reply) => {
      const { serverName } = request.params;

      if (!serverName || !serverName.trim()) {
        return reply.status(400).send({ error: 'Server name is required' });
      }

      try {
        const serverConfig = await orchestrator.installMcpServer(serverName);
        return {
          ok: true,
          message: `MCP server '${serverName}' installed successfully`,
          serverConfig
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to install MCP server '${serverName}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // Uninstall an MCP server
  app.delete<{ Params: { serverName: string } }>(
    '/mcp/servers/:serverName',
    async (request, reply) => {
      const { serverName } = request.params;

      if (!serverName || !serverName.trim()) {
        return reply.status(400).send({ error: 'Server name is required' });
      }

      try {
        await orchestrator.uninstallMcpServer(serverName);
        return {
          ok: true,
          message: `MCP server '${serverName}' uninstalled successfully`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${serverName}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // Get MCP server status
  app.get<{ Params: { serverName: string } }>(
    '/mcp/servers/:serverName/status',
    async (request, reply) => {
      const { serverName } = request.params;

      if (!serverName || !serverName.trim()) {
        return reply.status(400).send({ error: 'Server name is required' });
      }

      try {
        const status = await orchestrator.getMcpServerStatus(serverName);
        return status;
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to get status for MCP server '${serverName}'`;
        return reply.status(500).send({ error: message });
      }
    }
  );

  // Start an MCP server
  app.post<{ Params: { serverName: string } }>(
    '/mcp/servers/:serverName/start',
    async (request, reply) => {
      const { serverName } = request.params;

      if (!serverName || !serverName.trim()) {
        return reply.status(400).send({ error: 'Server name is required' });
      }

      try {
        await orchestrator.startMcpServer(serverName);
        return {
          ok: true,
          message: `MCP server '${serverName}' started successfully`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to start MCP server '${serverName}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // Stop an MCP server
  app.post<{ Params: { serverName: string } }>(
    '/mcp/servers/:serverName/stop',
    async (request, reply) => {
      const { serverName } = request.params;

      if (!serverName || !serverName.trim()) {
        return reply.status(400).send({ error: 'Server name is required' });
      }

      try {
        await orchestrator.stopMcpServer(serverName);
        return {
          ok: true,
          message: `MCP server '${serverName}' stopped successfully`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to stop MCP server '${serverName}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // Get marketplace categories
  app.get('/mcp/marketplace/categories', async (request, reply) => {
    try {
      const categories = await orchestrator.getMcpMarketplaceCategories();
      return { categories };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch marketplace categories';
      return reply.status(500).send({ error: message });
    }
  });

  // Get featured marketplace entries
  app.get('/mcp/marketplace/featured', async (request, reply) => {
    try {
      const entries = await orchestrator.getFeaturedMcpEntries();
      return { entries };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch featured entries';
      return reply.status(500).send({ error: message });
    }
  });

  // Get installation recommendations
  app.get('/mcp/recommendations', async (request, reply) => {
    try {
      const recommendations = await orchestrator.getMcpInstallationRecommendations();
      return recommendations;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get recommendations';
      return reply.status(500).send({ error: message });
    }
  });

  // Install an MCP server (acceptance criteria format)
  app.post<{ Params: { id: string } }>(
    '/mcp/install/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!id || !id.trim()) {
        return reply.status(400).send({ error: 'Server ID is required' });
      }

      try {
        // Broadcast installation start event
        broadcast('mcp-installation', {
          type: 'mcp:install-start' as any,
          taskId: 'mcp-installation',
          timestamp: new Date(),
          data: {
            serverId: id,
            stage: 'starting',
            progress: 0,
            message: `Starting installation of MCP server '${id}'`
          },
        });

        const serverConfig = await orchestrator.installMcpServer(id);

        // Broadcast installation complete event
        broadcast('mcp-installation', {
          type: 'mcp:install-complete' as any,
          taskId: 'mcp-installation',
          timestamp: new Date(),
          data: {
            serverId: id,
            stage: 'complete',
            progress: 100,
            message: `MCP server '${id}' installed successfully`,
            config: serverConfig
          },
        });

        return {
          ok: true,
          message: `MCP server '${id}' installed successfully`,
          serverConfig
        };
      } catch (error) {
        // Broadcast installation error event
        broadcast('mcp-installation', {
          type: 'mcp:install-error' as any,
          taskId: 'mcp-installation',
          timestamp: new Date(),
          data: {
            serverId: id,
            stage: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : `Failed to install MCP server '${id}'`,
            error: error instanceof Error ? error.message : String(error)
          },
        });

        const message = error instanceof Error ? error.message : `Failed to install MCP server '${id}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // Uninstall an MCP server (acceptance criteria format)
  app.delete<{ Params: { id: string } }>(
    '/mcp/uninstall/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!id || !id.trim()) {
        return reply.status(400).send({ error: 'Server ID is required' });
      }

      try {
        // Broadcast uninstallation start event
        broadcast('mcp-installation', {
          type: 'mcp:uninstall-start' as any,
          taskId: 'mcp-installation',
          timestamp: new Date(),
          data: {
            serverId: id,
            stage: 'uninstalling',
            progress: 0,
            message: `Starting uninstallation of MCP server '${id}'`
          },
        });

        await orchestrator.uninstallMcpServer(id);

        // Broadcast uninstallation complete event
        broadcast('mcp-installation', {
          type: 'mcp:uninstall-complete' as any,
          taskId: 'mcp-installation',
          timestamp: new Date(),
          data: {
            serverId: id,
            stage: 'complete',
            progress: 100,
            message: `MCP server '${id}' uninstalled successfully`
          },
        });

        return {
          ok: true,
          message: `MCP server '${id}' uninstalled successfully`
        };
      } catch (error) {
        // Broadcast uninstallation error event
        broadcast('mcp-installation', {
          type: 'mcp:uninstall-error' as any,
          taskId: 'mcp-installation',
          timestamp: new Date(),
          data: {
            serverId: id,
            stage: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`,
            error: error instanceof Error ? error.message : String(error)
          },
        });

        const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`;
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // Auto-configure standard tools
  app.post<{ Body: { developmentTools?: boolean; productivityTools?: boolean; devopsTools?: boolean; customServers?: string[] } }>(
    '/mcp/auto-configure',
    async (request, reply) => {
      try {
        const options = request.body;
        const result = await orchestrator.autoConfigureMcpTools(options);
        return {
          ok: true,
          message: `Auto-configuration completed: ${result.configured.length} servers configured, ${result.skipped.length} skipped, ${result.errors.length} errors`,
          ...result
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to auto-configure tools';
        return reply.status(500).send({
          ok: false,
          error: message
        });
      }
    }
  );

  // ============================================================================
  // Templates API
  // ============================================================================

  // Create a new template
  app.post<{ Body: CreateTemplateRequest }>('/templates', async (request, reply) => {
    const { name, description, workflow, priority, effort, acceptanceCriteria, tags } = request.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Template name is required' });
    }
    if (!description || !description.trim()) {
      return reply.status(400).send({ error: 'Template description is required' });
    }
    if (!workflow || !workflow.trim()) {
      return reply.status(400).send({ error: 'Workflow is required' });
    }

    // Validate name length
    if (name.length > 100) {
      return reply.status(400).send({ error: 'Template name must be 100 characters or less' });
    }

    // Validate priority if provided
    if (priority && !['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return reply.status(400).send({ error: 'Priority must be one of: low, normal, high, urgent' });
    }

    // Validate effort if provided
    if (effort && !['xs', 'small', 'medium', 'large', 'xl'].includes(effort)) {
      return reply.status(400).send({ error: 'Effort must be one of: xs, small, medium, large, xl' });
    }

    try {
      const template = await orchestrator.createTemplate({
        name: name.trim(),
        description: description.trim(),
        workflow: workflow.trim(),
        priority: priority as any || 'normal',
        effort: effort as any || 'medium',
        acceptanceCriteria: acceptanceCriteria?.trim(),
        tags: tags || [],
      });

      return reply.status(201).send(template);
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to create template'
      });
    }
  });

  // List all templates
  app.get('/templates', async (request, reply) => {
    try {
      const templates = await orchestrator.listTemplates();
      return { templates, count: templates.length };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to list templates'
      });
    }
  });

  // Get template by ID
  app.get<{ Params: { id: string } }>('/templates/:id', async (request, reply) => {
    const { id } = request.params;

    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Template ID is required' });
    }

    try {
      const template = await orchestrator.getTemplate(id);

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      return template;
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to get template'
      });
    }
  });

  // Update template by ID
  app.put<{ Params: { id: string }; Body: UpdateTemplateRequest }>('/templates/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, workflow, priority, effort, acceptanceCriteria, tags } = request.body;

    // Validate template ID
    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Template ID is required' });
    }

    // Validate that at least one field is provided for update
    const hasUpdates = name !== undefined || description !== undefined || workflow !== undefined ||
                      priority !== undefined || effort !== undefined || acceptanceCriteria !== undefined ||
                      tags !== undefined;

    if (!hasUpdates) {
      return reply.status(400).send({ error: 'At least one field must be provided for update' });
    }

    // Validate individual fields if provided
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return reply.status(400).send({ error: 'Template name cannot be empty' });
      }
      if (name.length > 100) {
        return reply.status(400).send({ error: 'Template name must be 100 characters or less' });
      }
    }

    if (description !== undefined && (!description || !description.trim())) {
      return reply.status(400).send({ error: 'Template description cannot be empty' });
    }

    if (workflow !== undefined && (!workflow || !workflow.trim())) {
      return reply.status(400).send({ error: 'Workflow cannot be empty' });
    }

    // Validate priority if provided
    if (priority !== undefined && !['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return reply.status(400).send({ error: 'Priority must be one of: low, normal, high, urgent' });
    }

    // Validate effort if provided
    if (effort !== undefined && !['xs', 'small', 'medium', 'large', 'xl'].includes(effort)) {
      return reply.status(400).send({ error: 'Effort must be one of: xs, small, medium, large, xl' });
    }

    // Prepare updates object (only include defined fields)
    const updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>> = {};

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (workflow !== undefined) updates.workflow = workflow.trim();
    if (priority !== undefined) updates.priority = priority as any;
    if (effort !== undefined) updates.effort = effort as any;
    if (acceptanceCriteria !== undefined) updates.acceptanceCriteria = acceptanceCriteria?.trim();
    if (tags !== undefined) updates.tags = tags || [];

    try {
      const updatedTemplate = await orchestrator.updateTemplate(id, updates);
      return updatedTemplate;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Template not found')) {
        return reply.status(404).send({ error: 'Template not found' });
      }
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to update template'
      });
    }
  });

  // Delete template by ID
  app.delete<{ Params: { id: string } }>('/templates/:id', async (request, reply) => {
    const { id } = request.params;

    // Validate template ID
    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Template ID is required' });
    }

    try {
      await orchestrator.deleteTemplate(id);
      return { ok: true, message: 'Template deleted' };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Template not found')) {
        return reply.status(404).send({ error: 'Template not found' });
      }
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to delete template'
      });
    }
  });

  // ============================================================================
  // WebSocket for real-time streaming
  // ============================================================================

  // Global WebSocket endpoint with health check support
  app.get(
    '/ws',
    { websocket: true },
    (socket, request) => {
      app.log.info('Global WebSocket client connected')

      // Send current tasks state immediately
      orchestrator.listTasks({}).then((tasks: Task[]) => {
        socket.send(
          JSON.stringify({
            type: 'task:state',
            tasks,
            timestamp: new Date(),
          })
        );
      }).catch((error) => {
        app.log.error('Failed to send initial tasks state:', error);
      });

      // Handle incoming messages (primarily ping/pong)
      socket.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'ping') {
            // Respond with pong immediately
            socket.send(JSON.stringify({
              type: 'pong',
              id: data.id,
              timestamp: data.timestamp,
              serverTimestamp: Date.now()
            }));
            return;
          }

          // Handle other message types if needed
          app.log.debug('Received WebSocket message:', data);
        } catch (error) {
          app.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error parsing WebSocket message');
        }
      });

      // Handle disconnect
      socket.on('close', () => {
        app.log.info('Global WebSocket client disconnected');
      });

      // Handle errors
      socket.on('error', (error) => {
        app.log.error({ err: new Error(error.message) }, 'Global WebSocket error');
      });
    }
  );

  app.get<{
    Params: { taskId: string };
    Querystring: { events?: string; }; // Comma-separated list of event types to subscribe to
  }>(
    '/stream/:taskId',
    { websocket: true },
    (socket, request) => {
      const { taskId } = request.params;
      const { events } = request.query;

      // Parse event filters from query parameter
      let eventFilters: Set<string> | undefined;
      if (events) {
        eventFilters = new Set(events.split(',').map(e => e.trim()).filter(e => e.length > 0));
      }

      // Register client with filtering capability
      const client: WebSocketClient = {
        socket,
        eventFilters
      };

      if (!clients.has(taskId)) {
        clients.set(taskId, new Set());
      }
      clients.get(taskId)!.add(client);

      app.log.info(`WebSocket client connected for task ${taskId}${eventFilters ? ` with filters: ${Array.from(eventFilters).join(',')}` : ''}`);

      // Send current task state
      orchestrator.getTask(taskId).then((task: Task | null) => {
        if (task) {
          socket.send(
            JSON.stringify({
              type: 'task:state',
              taskId,
              timestamp: new Date(),
              data: task,
            })
          );
        }
      });

      // Handle disconnect
      socket.on('close', () => {
        clients.get(taskId)?.delete(client);
        if (clients.get(taskId)?.size === 0) {
          clients.delete(taskId);
        }
        app.log.info(`WebSocket client disconnected for task ${taskId}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        app.log.error(`WebSocket error for task ${taskId}: ${error.message}`);
      });
    }
  );

  // ============================================================================
  // Server startup
  // ============================================================================

  // Add cleanup hook for health monitoring interval
  app.addHook('onClose', async () => {
    if (healthMonitoringInterval) {
      clearInterval(healthMonitoringInterval);
      healthMonitoringInterval = null;
    }
    await slackService.stop();
    await teamsService.stop();
    await discordService.stop();
  });

  return app;
}

/**
 * Check if health metrics have changed significantly
 */
function checkHealthMetricsChanged(current: HealthMetrics, previous: HealthMetrics | null): boolean {
  if (!previous) return false;

  // Define thresholds for significant changes
  const MEMORY_THRESHOLD = 0.1; // 10% change in memory usage
  const TASK_THRESHOLD = 5; // 5 task difference
  const UPTIME_THRESHOLD = 60000; // 1 minute difference (restarts)

  // Check memory usage changes
  const memoryChangePct = Math.abs(current.memoryUsage.heapUsed - previous.memoryUsage.heapUsed) / previous.memoryUsage.heapUsed;
  if (memoryChangePct > MEMORY_THRESHOLD) return true;

  // Check task count changes
  if (Math.abs(current.taskCounts.processed - previous.taskCounts.processed) >= TASK_THRESHOLD) return true;
  if (Math.abs(current.taskCounts.failed - previous.taskCounts.failed) >= TASK_THRESHOLD) return true;
  if (Math.abs(current.taskCounts.active - previous.taskCounts.active) >= TASK_THRESHOLD) return true;

  // Check for restart (uptime significantly decreased)
  if (current.uptime < previous.uptime - UPTIME_THRESHOLD) return true;

  // Check for health check failures
  if (current.healthChecksFailed > previous.healthChecksFailed) return true;

  // Check restart history changes
  if (current.restartHistory.length > previous.restartHistory.length) return true;

  return false;
}

/**
 * Assess overall daemon health based on metrics
 */
function assessDaemonHealth(metrics: HealthMetrics): boolean {
  // Consider daemon unhealthy if:
  // - Recent health check failures (more than 10% failure rate)
  // - High memory usage (over 1GB heap)
  // - Recent restarts (within last 10 minutes)
  // - Too many active tasks (over 50)

  const totalHealthChecks = metrics.healthChecksPassed + metrics.healthChecksFailed;
  if (totalHealthChecks > 0) {
    const failureRate = metrics.healthChecksFailed / totalHealthChecks;
    if (failureRate > 0.1) return false; // More than 10% failure rate
  }

  // Check memory usage (1GB threshold)
  if (metrics.memoryUsage.heapUsed > 1024 * 1024 * 1024) return false;

  // Check for recent restarts (last 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const recentRestarts = metrics.restartHistory.filter(restart =>
    new Date(restart.timestamp).getTime() > tenMinutesAgo
  );
  if (recentRestarts.length > 0) return false;

  // Check active task count
  if (metrics.taskCounts.active > 50) return false;

  return true;
}

/**
 * Broadcast an event to all connected clients for a task with event filtering
 */
function broadcast(taskId: string, event: ApexEvent): void {
  const taskClients = clients.get(taskId);
  if (!taskClients) return;

  const message = safeSerialize(event);
  for (const client of taskClients) {
    // Check if client has event filters and if this event should be sent
    if (client.eventFilters && !client.eventFilters.has(event.type)) {
      continue; // Skip this client - event type not in their filter list
    }

    // Send message if socket is open
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(message);
    }
  }
}

/**
 * Set up event broadcasting from orchestrator
 */
function setupEventBroadcasting(orchestrator: ApexOrchestrator): void {
  orchestrator.on('task:created', (task: Task) => {
    broadcast(task.id, {
      type: 'task:created',
      taskId: task.id,
      timestamp: new Date(),
      data: { ...task } as Record<string, unknown>,
    });
  });

  orchestrator.on('task:started', (task: Task) => {
    broadcast(task.id, {
      type: 'task:started',
      taskId: task.id,
      timestamp: new Date(),
      data: { ...task } as Record<string, unknown>,
    });
  });

  orchestrator.on('task:completed', (task: Task) => {
    broadcast(task.id, {
      type: 'task:completed',
      taskId: task.id,
      timestamp: new Date(),
      data: { ...task } as Record<string, unknown>,
    });
  });

  orchestrator.on('task:failed', (task: Task, error: Error) => {
    broadcast(task.id, {
      type: 'task:failed',
      taskId: task.id,
      timestamp: new Date(),
      data: { task: { ...task }, error: error.message },
    });
  });

  orchestrator.on('task:paused', (task: Task, reason: string) => {
    broadcast(task.id, {
      type: 'task:paused',
      taskId: task.id,
      timestamp: new Date(),
      data: {
        task: { ...task },
        reason,
        pausedAt: task.pausedAt,
        resumeAfter: task.resumeAfter,
      },
    });
  });

  orchestrator.on('agent:message', (taskId: string, message: unknown) => {
    broadcast(taskId, {
      type: 'agent:message',
      taskId,
      timestamp: new Date(),
      data: { message },
    });
  });

  orchestrator.on('agent:thinking', (taskId: string, agent: string, thinking: string) => {
    broadcast(taskId, {
      type: 'agent:thinking',
      taskId,
      timestamp: new Date(),
      data: { agent, thinking },
    });
  });

  orchestrator.on('agent:tool-use', (taskId: string, tool: string, input: unknown) => {
    const truncatedData = truncatePayload({
      tool,
      input,
    }, {
      maxArrayItems: 1000,
      maxStringLength: 50 * 1024,
    });

    broadcast(taskId, {
      type: 'agent:tool-use',
      taskId,
      timestamp: new Date(),
      data: truncatedData.data,
      _truncation: truncatedData._truncation,
    });
  });

  orchestrator.on('usage:updated', (taskId: string, usage: TaskUsage) => {
    broadcast(taskId, {
      type: 'usage:updated',
      taskId,
      timestamp: new Date(),
      data: { ...usage },
    });
  });

  // Tool call events (v0.5.0)
  orchestrator.on('tool:start', (event: ToolCallStartEvent) => {
    broadcast(event.taskId, {
      type: 'tool:start',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        toolName: event.toolName,
        input: event.input,
        callId: event.callId,
        startTime: event.startTime.toISOString(), // Include startTime in data
      },
    });
  });

  orchestrator.on('tool:progress', (event: ToolCallProgressEvent) => {
    broadcast(event.taskId, {
      type: 'tool:progress',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        toolName: event.toolName,
        callId: event.callId,
        progress: event.progress,
      },
    });
  });

  orchestrator.on('tool:complete', (event: ToolCallCompleteEvent) => {
    const truncatedData = truncatePayload({
      toolName: event.toolName,
      callId: event.callId,
      result: event.result,
      timing: {
        startTime: event.timing.startTime.toISOString(), // Serialize startTime
        endTime: event.timing.endTime.toISOString(),     // Serialize endTime
        duration: event.timing.duration,
      },
    }, {
      maxArrayItems: 1000,
      maxStringLength: 50 * 1024,
    });

    broadcast(event.taskId, {
      type: 'tool:complete',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: truncatedData.data,
      _truncation: truncatedData._truncation,
    });
  });

  // Subtask events
  orchestrator.on('task:decomposed', (task: Task, subtaskIds: string[]) => {
    broadcast(task.id, {
      type: 'task:decomposed',
      taskId: task.id,
      timestamp: new Date(),
      data: { subtaskIds, strategy: task.subtaskStrategy },
    });
  });

  orchestrator.on('subtask:created', (subtask: Task, parentTaskId: string) => {
    broadcast(parentTaskId, {
      type: 'subtask:created',
      taskId: parentTaskId,
      timestamp: new Date(),
      data: { subtask: { ...subtask } as Record<string, unknown> },
    });
  });

  orchestrator.on('subtask:completed', (subtask: Task, parentTaskId: string) => {
    broadcast(parentTaskId, {
      type: 'subtask:completed',
      taskId: parentTaskId,
      timestamp: new Date(),
      data: { subtask: { ...subtask } as Record<string, unknown> },
    });
  });

  orchestrator.on('subtask:failed', (subtask: Task, parentTaskId: string, error: Error) => {
    broadcast(parentTaskId, {
      type: 'subtask:failed',
      taskId: parentTaskId,
      timestamp: new Date(),
      data: { subtask: { ...subtask } as Record<string, unknown>, error: error.message },
    });
  });

  // Task lifecycle events
  orchestrator.on('task:trashed', (task: Task) => {
    broadcast(task.id, {
      type: 'task:trashed',
      taskId: task.id,
      timestamp: new Date(),
      data: {
        task: { ...task } as Record<string, unknown>,
        trashedAt: task.trashedAt
      },
    });
  });

  orchestrator.on('task:restored', (task: Task) => {
    broadcast(task.id, {
      type: 'task:restored',
      taskId: task.id,
      timestamp: new Date(),
      data: {
        task: { ...task } as Record<string, unknown>,
        status: task.status
      },
    });
  });

  orchestrator.on('task:archived', (task: Task) => {
    broadcast(task.id, {
      type: 'task:archived',
      taskId: task.id,
      timestamp: new Date(),
      data: {
        task: { ...task } as Record<string, unknown>,
        archivedAt: task.archivedAt
      },
    });
  });

  orchestrator.on('task:unarchived', (task: Task) => {
    broadcast(task.id, {
      type: 'task:unarchived',
      taskId: task.id,
      timestamp: new Date(),
      data: {
        task: { ...task } as Record<string, unknown>,
        status: task.status
      },
    });
  });

  orchestrator.on('trash:emptied', (deletedCount: number, taskIds: string[]) => {
    // Broadcast to all connected clients for each deleted task
    taskIds.forEach(taskId => {
      broadcast(taskId, {
        type: 'trash:emptied',
        taskId: taskId,
        timestamp: new Date(),
        data: {
          deletedCount,
          deletedTaskIds: taskIds
        },
      });
    });

    // Also broadcast a global trash emptied event to task '0' for general listeners
    broadcast('0', {
      type: 'trash:emptied',
      taskId: '0',
      timestamp: new Date(),
      data: {
        deletedCount,
        deletedTaskIds: taskIds
      },
    });
  });

  // Approval events (v0.5.0)
  orchestrator.on('approval:required', (eventData: ApprovalRequiredEventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval-required',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: {
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        gateType: eventData.gateType,
        description: eventData.description,
        approvers: eventData.approvers,
        minApprovals: eventData.minApprovals,
        timeoutMinutes: eventData.timeoutMinutes,
        expiresAt: eventData.expiresAt,
        stage: eventData.stage,
        agent: eventData.agent,
        context: eventData.context,
        changesSummary: eventData.changesSummary,
        affectedFiles: eventData.affectedFiles,
        blocking: eventData.blocking,
        approvalUrl: eventData.approvalUrl,
      },
    });
  });

  orchestrator.on('approval:approved', (eventData: ApprovalGrantedEventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval:granted',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: {
        approvalId: eventData.approvalId,
        approver: eventData.approver,
        comment: eventData.comment,
      },
    });
  });

  orchestrator.on('approval:denied', (eventData: ApprovalDeniedEventData) => {
    broadcast(eventData.taskId!, {
      type: 'approval:denied',
      taskId: eventData.taskId!,
      timestamp: new Date(),
      data: {
        approvalId: eventData.approvalId,
        approver: eventData.approver,
        reason: eventData.reason,
      },
    });
  });

  // Auto-fix events (v0.5.0) - Real-time auto-fix progress streaming
  orchestrator.on('autofix:requested', (event) => {
    broadcast(event.taskId, {
      type: 'autofix:requested',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixTypes: event.fixTypes,
        triggeredBy: event.triggeredBy,
      },
    });
  });

  // Auto-fix events (v0.5.0)
  orchestrator.on('autofix:started', (event) => {
    broadcast(event.taskId, {
      type: 'autofix:started',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        issuesDetected: event.issuesDetected,
      },
    });
  });

  orchestrator.on('autofix:progress', (event) => {
    broadcast(event.taskId, {
      type: 'autofix:progress',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        issuesFixed: event.issuesFixed,
        issuesRemaining: event.issuesRemaining,
        currentFix: event.currentFix,
      },
    });
  });

  orchestrator.on('autofix:completed', (event) => {
    broadcast(event.taskId, {
      type: 'autofix:completed',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        issuesDetected: event.issuesDetected,
        issuesFixed: event.issuesFixed,
        duration: event.duration,
      },
    });
  });

  orchestrator.on('autofix:failed', (event) => {
    broadcast(event.taskId, {
      type: 'autofix:failed',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        error: event.error,
        issuesDetected: event.issuesDetected,
        issuesFixed: event.issuesFixed,
      },
    });
  });

  orchestrator.on('autofix:skipped', (event) => {
    broadcast(event.taskId, {
      type: 'autofix:skipped',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        reason: event.reason,
      },
    });
  });

  // Browser events (v0.5.0) - Real-time browser automation event streaming
  orchestrator.on('browser:console', (event) => {
    broadcast(event.taskId, {
      type: 'browser:console',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        message: event.message,
      },
    });
  });

  orchestrator.on('browser:error', (event) => {
    broadcast(event.taskId, {
      type: 'browser:error',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        error: event.error,
      },
    });
  });

  orchestrator.on('browser:network-error', (event) => {
    broadcast(event.taskId, {
      type: 'browser:network-error',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        error: event.error,
      },
    });
  });

  orchestrator.on('browser:performance-warning', (event) => {
    broadcast(event.taskId, {
      type: 'browser:performance-warning',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        warning: event.warning,
      },
    });
  });

  orchestrator.on('browser:security-violation', (event) => {
    broadcast(event.taskId, {
      type: 'browser:security-violation',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        violation: event.violation,
      },
    });
  });

  orchestrator.on('browser:session-started', (event) => {
    broadcast(event.taskId, {
      type: 'browser:session-started',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        session: event.session,
      },
    });
  });

  orchestrator.on('browser:session-ended', (event) => {
    broadcast(event.taskId, {
      type: 'browser:session-ended',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        agentName: event.agentName,
        session: event.session,
      },
    });
  });

  // Permission events - Real-time permission notification broadcasting
  orchestrator.on('permission:request', (eventData: any) => {
    broadcast(eventData.taskId || 'permission-global', {
      type: 'permission:request',
      taskId: eventData.taskId || 'permission-global',
      timestamp: new Date(),
      data: {
        requestId: eventData.requestId,
        toolName: eventData.toolName,
        agentName: eventData.agentName,
        operation: eventData.operation,
        description: eventData.description,
        reason: eventData.reason,
        scope: eventData.scope,
        riskLevel: eventData.riskLevel,
        metadata: eventData.metadata,
        timestamp: eventData.timestamp,
      },
    });
  });

  orchestrator.on('permission:granted', (eventData: any) => {
    broadcast(eventData.taskId || 'permission-global', {
      type: 'permission:granted',
      taskId: eventData.taskId || 'permission-global',
      timestamp: new Date(),
      data: {
        requestId: eventData.requestId,
        toolName: eventData.toolName,
        agentName: eventData.agentName,
        level: eventData.level,
        grantedBy: eventData.grantedBy,
        grantReason: eventData.grantReason,
        comment: eventData.comment,
        timestamp: eventData.timestamp,
      },
    });
  });

  orchestrator.on('permission:denied', (eventData: any) => {
    broadcast(eventData.taskId || 'permission-global', {
      type: 'permission:denied',
      taskId: eventData.taskId || 'permission-global',
      timestamp: new Date(),
      data: {
        requestId: eventData.requestId,
        toolName: eventData.toolName,
        agentName: eventData.agentName,
        deniedBy: eventData.deniedBy,
        denialReason: eventData.denialReason,
        reason: eventData.reason,
        comment: eventData.comment,
        timestamp: eventData.timestamp,
      },
    });
  });

  // Dangerous operation events - Real-time dangerous operation notification broadcasting
  orchestrator.on('dangerous:detected', (eventData: any) => {
    broadcast(eventData.taskId || 'dangerous-global', {
      type: 'dangerous:detected',
      taskId: eventData.taskId || 'dangerous-global',
      timestamp: new Date(),
      data: {
        operationId: eventData.operationId,
        toolName: eventData.toolName,
        agentName: eventData.agentName,
        operationType: eventData.operationType,
        operation: eventData.operation,
        riskLevel: eventData.riskLevel,
        riskDescription: eventData.riskDescription,
        description: eventData.description,
        metadata: eventData.metadata,
        timestamp: eventData.timestamp,
      },
    });
  });

  orchestrator.on('dangerous:confirmed', (eventData: any) => {
    broadcast(eventData.taskId || 'dangerous-global', {
      type: 'dangerous:confirmed',
      taskId: eventData.taskId || 'dangerous-global',
      timestamp: new Date(),
      data: {
        operationId: eventData.operationId,
        toolName: eventData.toolName,
        agentName: eventData.agentName,
        operationType: eventData.operationType,
        confirmedBy: eventData.confirmedBy,
        confirmation: eventData.confirmation,
        comment: eventData.comment,
        timestamp: eventData.timestamp,
      },
    });
  });

  orchestrator.on('dangerous:blocked', (eventData: any) => {
    broadcast(eventData.taskId || 'dangerous-global', {
      type: 'dangerous:blocked',
      taskId: eventData.taskId || 'dangerous-global',
      timestamp: new Date(),
      data: {
        operationId: eventData.operationId,
        toolName: eventData.toolName,
        agentName: eventData.agentName,
        operationType: eventData.operationType,
        blockedBy: eventData.blockedBy,
        blockReason: eventData.blockReason,
        reason: eventData.reason,
        comment: eventData.comment,
        timestamp: eventData.timestamp,
      },
    });
  });

  // MCP Connection Lifecycle Events (v0.6.0) - Real-time MCP server monitoring
  // These events use a special 'mcp-events' taskId channel for global MCP server status

  orchestrator.on('mcp:connected', (eventData: MCPConnectionEventData) => {
    broadcast('mcp-events', {
      type: 'mcp:connected',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        config: eventData.config,
        connectedAt: eventData.timestamp,
      },
    });
  });

  orchestrator.on('mcp:disconnected', (eventData: MCPDisconnectionEventData) => {
    broadcast('mcp-events', {
      type: 'mcp:disconnected',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        reason: eventData.reason,
        disconnectedAt: eventData.timestamp,
      },
    });
  });

  orchestrator.on('mcp:error', (eventData: MCPErrorEventData) => {
    // Use enhanced MCP error serialization for safe transmission
    const serializedError = serializeMCPError({
      message: eventData.error,
      name: eventData.code || 'MCPError',
      code: eventData.code,
      category: eventData.category,
      recoverable: eventData.recoverable,
      stack: eventData.stack,
      metadata: eventData.metadata,
    });

    broadcast('mcp-events', {
      type: 'mcp:error',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        error: serializedError,
        recovery: eventData.recovery,
        errorOccurredAt: eventData.timestamp,
      },
    });
  });

  orchestrator.on('mcp:reconnecting', (eventData: MCPReconnectingEventData) => {
    broadcast('mcp-events', {
      type: 'mcp:reconnecting',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        attempt: eventData.attempt,
        maxAttempts: eventData.maxAttempts,
        reconnectingAt: eventData.timestamp,
      },
    });
  });

  orchestrator.on('mcp:health-check', (eventData: MCPHealthCheckEventData) => {
    broadcast('mcp-events', {
      type: 'mcp:health-check',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        success: eventData.success,
        latencyMs: eventData.latencyMs,
        error: eventData.error,
        consecutiveFailures: eventData.consecutiveFailures,
        isHealthy: eventData.isHealthy,
        checkedAt: eventData.timestamp,
      },
    });
  });

  orchestrator.on('mcp:state-change', (eventData: MCPStateChangeEventData) => {
    broadcast('mcp-events', {
      type: 'mcp:state-change',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        previousState: eventData.previousState,
        newState: eventData.newState,
        stateChangedAt: eventData.timestamp,
      },
    });
  });

  // MCP Installation Events (v0.6.0) - Real-time MCP server installation monitoring
  // These events use 'mcp-installation' taskId channel for MCP server installation status
  // NOTE: These event types will be properly defined in OrchestratorEvents interface when orchestrator is updated

  (orchestrator as any).on('mcp:install-start', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:install-start' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
      },
    });
  });

  (orchestrator as any).on('mcp:install-progress', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:install-progress' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
      },
    });
  });

  (orchestrator as any).on('mcp:install-complete', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:install-complete' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        config: event.config,
      },
    });
  });

  (orchestrator as any).on('mcp:install-error', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:install-error' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        error: event.error,
      },
    });
  });

  // MCP Uninstallation Events (v0.6.0)

  (orchestrator as any).on('mcp:uninstall-start', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:uninstall-start' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
      },
    });
  });

  (orchestrator as any).on('mcp:uninstall-complete', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:uninstall-complete' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
      },
    });
  });

  (orchestrator as any).on('mcp:uninstall-error', (event: any) => {
    broadcast('mcp-installation', {
      type: 'mcp:uninstall-error' as any,
      taskId: 'mcp-installation',
      timestamp: event.timestamp || new Date(),
      data: {
        serverId: event.serverId,
        serverName: event.serverName,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        error: event.error,
      },
    });
  });
}

/**
 * Starts the APEX API server and listens for incoming connections.
 *
 * Creates a new Fastify server instance using createServer(), then starts listening
 * on the specified host and port. Provides comprehensive logging of all available
 * endpoints when not in silent mode.
 *
 * @param options - Server configuration options including port, host, and project path
 * @throws Will exit the process with code 1 if server startup fails
 *
 * @example
 * ```typescript
 * await startServer({
 *   port: 3000,
 *   host: '0.0.0.0',
 *   projectPath: '/path/to/apex/project',
 *   silent: false
 * });
 * ```
 */
export async function startServer(options: ServerOptions): Promise<void> {
  const { port = 3000, host = '0.0.0.0', silent = false } = options;

  const server = await createServer(options);

  try {
    await server.listen({ port, host });

    if (!silent) {
      console.log(`\n🚀 APEX API Server running at http://${host}:${port}\n`);
      console.log('Task Endpoints:');
      console.log(`  POST   /tasks                    - Create a new task`);
      console.log(`  GET    /tasks                    - List tasks`);
      console.log(`  GET    /tasks/:id                - Get task details`);
      console.log(`  POST   /tasks/:id/status         - Update task status`);
      console.log(`  POST   /tasks/:id/log            - Add log entry`);
      console.log(`  POST   /tasks/:id/cancel         - Cancel a task`);
      console.log(`  POST   /tasks/:id/retry          - Retry a failed task`);
      console.log(`  POST   /tasks/:id/resume         - Resume a paused task`);
      console.log(`  POST   /tasks/:id/context        - Inject context into task`);
      console.log(`  GET    /tasks/paused             - List paused tasks`);
      console.log(`  POST   /tasks/:id/trash          - Move task to trash`);
      console.log(`  POST   /tasks/:id/restore        - Restore task from trash`);
      console.log(`  GET    /tasks/trashed            - List trashed tasks`);
      console.log(`  DELETE /tasks/trash              - Permanently delete all trashed tasks`);
      console.log(`  POST   /tasks/:id/archive        - Archive a completed task`);
      console.log(`  GET    /tasks/archived           - List archived tasks`);
      console.log('');
      console.log('Subtask Endpoints:');
      console.log(`  POST   /tasks/:id/decompose      - Decompose task into subtasks`);
      console.log(`  GET    /tasks/:id/subtasks       - Get subtasks for a task`);
      console.log(`  GET    /tasks/:id/subtasks/status- Get subtask status summary`);
      console.log(`  POST   /tasks/:id/subtasks/execute - Execute subtasks`);
      console.log(`  GET    /tasks/:id/parent         - Get parent task (for subtasks)`);
      console.log(`  GET    /tasks/:id/is-subtask     - Check if task is a subtask`);
      console.log('');
      console.log('Gate Endpoints:');
      console.log(`  GET    /tasks/:id/gates          - List all gates`);
      console.log(`  GET    /tasks/:id/gates/:n       - Check gate status`);
      console.log(`  POST   /tasks/:id/gates/:n/approve - Approve gate`);
      console.log(`  POST   /tasks/:id/gates/:n/reject  - Reject gate`);
      console.log('');
      console.log('Template Endpoints:');
      console.log(`  POST   /templates                - Create a new template`);
      console.log(`  GET    /templates                - List all templates`);
      console.log(`  GET    /templates/:id            - Get template by ID`);
      console.log(`  PUT    /templates/:id            - Update template by ID`);
      console.log(`  DELETE /templates/:id            - Delete template by ID`);
      console.log('');
      console.log('Approval Endpoints:');
      console.log(`  GET    /api/approvals            - List pending approvals`);
      console.log(`  POST   /api/approvals/:id/approve - Approve an approval request`);
      console.log(`  POST   /api/approvals/:id/deny  - Deny an approval request`);
      console.log('');
      console.log('Confirmation Endpoints:');
      console.log(`  POST   /confirmations/:id/respond - Respond to a confirmation (accept/reject)`);
      console.log(`  PUT    /confirmations/:id/respond - Accept a confirmation`);
      console.log('');
      console.log('Screenshot Endpoints:');
      console.log(`  POST   /screenshot/viewport      - Capture viewport screenshot`);
      console.log(`  POST   /screenshot/fullpage      - Capture full page screenshot`);
      console.log(`  POST   /screenshot/element       - Capture element screenshot`);
      console.log(`  GET    /screenshot/health        - Screenshot service health check`);
      console.log('');
      console.log('MCP Marketplace Endpoints:');
      console.log(`  GET    /mcp/servers              - List installed MCP servers`);
      console.log(`  GET    /mcp/servers/:id          - Get MCP server details`);
      console.log(`  POST   /mcp/install/:id          - Install MCP server (with WebSocket progress)`);
      console.log(`  DELETE /mcp/uninstall/:id        - Uninstall MCP server (with WebSocket progress)`);
      console.log(`  GET    /mcp/installed            - List installed servers as MCPInstallation objects`);
      console.log(`  GET    /mcp/marketplace          - Browse MCP marketplace`);
      console.log('');
      console.log('Other Endpoints:');
      console.log(`  GET    /health                   - Basic health check`);
      console.log(`  GET    /daemon/health            - Comprehensive daemon health metrics`);
      console.log(`  GET    /agents                   - List agents`);
      console.log(`  DELETE /agents/:name             - Delete agent`);
      console.log(`  GET    /config                   - Get configuration`);
      console.log('');
      console.log('WebSocket Streaming:');
      console.log(`  WS     /stream/:taskId           - Real-time task updates`);
      console.log(`  WS     /stream/:taskId?events=... - Real-time task updates with event filtering`);
      console.log(`  WS     /stream/health            - Real-time health updates`);
      console.log('');
      console.log('Event Filtering Examples:');
      console.log(`  /stream/task123?events=tool:start,tool:complete - Only tool call events`);
      console.log(`  /stream/task123?events=agent:thinking - Only thinking events`);
      console.log(`  /stream/task123 - All events (no filtering)`);
      console.log('');
      console.log('WebSocket Events (broadcasted via /stream/:taskId):');
      console.log(`    • task:trashed              - Task moved to trash`);
      console.log(`    • task:restored             - Task restored from trash`);
      console.log(`    • task:archived             - Task archived`);
      console.log(`    • task:unarchived           - Task unarchived`);
      console.log(`    • trash:emptied             - Trash permanently emptied`);
      console.log(`    • task:created/started/completed/failed - Standard lifecycle`);
      console.log(`    • agent:message/thinking/tool-use - Agent activity`);
      console.log(`    • tool:start/progress/complete - Tool call lifecycle events (v0.5.0)`);
      console.log(`    • subtask:created/completed/failed - Subtask events`);
      console.log(`    • approval:required         - Approval gate reached (v0.5.0)`);
      console.log(`    • approval:granted          - Approval request granted (v0.5.0)`);
      console.log(`    • approval:denied           - Approval request denied (v0.5.0)`);
      console.log(`    • autofix:requested         - Auto-fix requested for file (v0.5.0)`);
      console.log(`    • autofix:started           - Auto-fix operation started (v0.5.0)`);
      console.log(`    • autofix:progress          - Auto-fix progress update (v0.5.0)`);
      console.log(`    • autofix:completed         - Auto-fix operation completed (v0.5.0)`);
      console.log(`    • autofix:failed            - Auto-fix operation failed (v0.5.0)`);
      console.log(`    • autofix:skipped           - Auto-fix operation skipped (v0.5.0)`);
      console.log(`    • auto-fix-start            - Standardized auto-fix start (v0.5.0)`);
      console.log(`    • auto-fix-progress         - Standardized auto-fix progress (v0.5.0)`);
      console.log(`    • auto-fix-complete         - Standardized auto-fix complete (v0.5.0)`);
      console.log(`    • auto-fix-error            - Standardized auto-fix error (v0.5.0)`);
      console.log(`    • mcp:install-start         - MCP server installation started (v0.5.0)`);
      console.log(`    • mcp:install-complete      - MCP server installation completed (v0.5.0)`);
      console.log(`    • mcp:install-error         - MCP server installation failed (v0.5.0)`);
      console.log(`    • mcp:uninstall-start       - MCP server uninstallation started (v0.5.0)`);
      console.log(`    • mcp:uninstall-complete    - MCP server uninstallation completed (v0.5.0)`);
      console.log(`    • mcp:uninstall-error       - MCP server uninstallation failed (v0.5.0)`);
      console.log(`    • health:updated            - Health metrics changed significantly\n`);
    }
  } catch (error) {
    if (!silent) {
      server.log.error(error);
    }
    process.exit(1);
  }
}

// CLI entry point
if (require.main === module) {
  const projectPath = process.env.APEX_PROJECT || process.cwd();
  const port = parseInt(process.env.PORT || '3000', 10);
  const silent = process.env.APEX_SILENT === '1';

  startServer({ projectPath, port, silent }).catch(console.error);
}
