import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
  ApexEvent,
  SubtaskStrategy,
  SubtaskDefinition,
  TaskTemplate,
} from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Subtask API request types
interface DecomposeTaskRequest {
  subtasks: SubtaskDefinition[];
  strategy?: SubtaskStrategy;
}

// Template API request types
interface CreateTemplateRequest {
  name: string;
  description: string;
  workflow: string;
  priority?: string;
  effort?: string;
  acceptanceCriteria?: string;
  tags?: string[];
}

interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  workflow?: string;
  priority?: string;
  effort?: string;
  acceptanceCriteria?: string;
  tags?: string[];
}

// WebSocket client tracking
const clients = new Map<string, Set<WebSocket>>();

export interface ServerOptions {
  port?: number;
  host?: string;
  projectPath: string;
  silent?: boolean;
}

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

  // Initialize orchestrator
  const orchestrator = new ApexOrchestrator({ projectPath, apiUrl: `http://${host}:${port}` });
  await orchestrator.initialize();

  // Set up orchestrator event handlers for broadcasting
  setupEventBroadcasting(orchestrator);

  // ============================================================================
  // Health check
  // ============================================================================

  app.get('/health', async () => {
    return { status: 'ok', version: '0.1.0' };
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
  app.get<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    const { id } = request.params;
    const task = await orchestrator.getTask(id);

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return task;
  });

  // List tasks
  app.get<{ Querystring: { status?: TaskStatus; limit?: string } }>(
    '/tasks',
    async (request, reply) => {
      const { status, limit } = request.query;
      const tasks = await orchestrator.listTasks({
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return { tasks, count: tasks.length };
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

      // Handle paused tasks
      if (task.status === 'paused') {
        const resumed = await orchestrator.resumePausedTask(id);
        if (!resumed) {
          return reply.status(500).send({
            error: 'Failed to resume task. Check if the task has a valid checkpoint.'
          });
        }
        return { ok: true, message: 'Task resumed from paused state', taskId: id };
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
  // Agents API
  // ============================================================================

  // List available agents
  app.get('/agents', async () => {
    const agents = await orchestrator.getAgents();
    return { agents };
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

  app.get<{ Params: { taskId: string } }>(
    '/stream/:taskId',
    { websocket: true },
    (socket, request) => {
      const { taskId } = request.params;

      // Register client
      if (!clients.has(taskId)) {
        clients.set(taskId, new Set());
      }
      clients.get(taskId)!.add(socket);

      app.log.info(`WebSocket client connected for task ${taskId}`);

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
        clients.get(taskId)?.delete(socket);
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

  return app;
}

/**
 * Broadcast an event to all connected clients for a task
 */
function broadcast(taskId: string, event: ApexEvent): void {
  const taskClients = clients.get(taskId);
  if (!taskClients) return;

  const message = JSON.stringify(event);
  for (const client of taskClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
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
    broadcast(taskId, {
      type: 'agent:tool-use',
      taskId,
      timestamp: new Date(),
      data: { tool, input },
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
}

/**
 * Start the server
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
      console.log('Other Endpoints:');
      console.log(`  GET    /agents                   - List agents`);
      console.log(`  GET    /config                   - Get configuration`);
      console.log(`  WS     /stream/:taskId           - Real-time task updates\n`);
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
