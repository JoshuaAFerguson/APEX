import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import {
  Task,
  TaskStatus,
  CreateTaskRequest,
  CreateTaskResponse,
  UpdateTaskStatusRequest,
  ApproveGateRequest,
  ApexEvent,
  SubtaskStrategy,
  SubtaskDefinition,
} from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Subtask API request types
interface DecomposeTaskRequest {
  subtasks: SubtaskDefinition[];
  strategy?: SubtaskStrategy;
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
    orchestrator.executeTask(task.id).catch((error) => {
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
      orchestrator.executeTask(id).catch((error) => {
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
        orchestrator.executeTask(id).catch((error) => {
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
          orchestrator.continuePendingSubtasks(id).catch((error) => {
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

      const subtasks = await orchestrator.decomposeTask(id, subtaskDefinitions, strategy);

      return {
        ok: true,
        parentTaskId: id,
        subtasks: subtasks.map(s => ({
          id: s.id,
          description: s.description,
          status: s.status,
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
      orchestrator.executeSubtasks(id).catch((error) => {
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
      orchestrator.getTask(taskId).then((task) => {
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
  orchestrator.on('task:created', (task) => {
    broadcast(task.id, {
      type: 'task:created',
      taskId: task.id,
      timestamp: new Date(),
      data: { ...task } as Record<string, unknown>,
    });
  });

  orchestrator.on('task:started', (task) => {
    broadcast(task.id, {
      type: 'task:started',
      taskId: task.id,
      timestamp: new Date(),
      data: { ...task } as Record<string, unknown>,
    });
  });

  orchestrator.on('task:completed', (task) => {
    broadcast(task.id, {
      type: 'task:completed',
      taskId: task.id,
      timestamp: new Date(),
      data: { ...task } as Record<string, unknown>,
    });
  });

  orchestrator.on('task:failed', (task, error) => {
    broadcast(task.id, {
      type: 'task:failed',
      taskId: task.id,
      timestamp: new Date(),
      data: { task: { ...task }, error: error.message },
    });
  });

  orchestrator.on('task:paused', (task, reason) => {
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

  orchestrator.on('agent:message', (taskId, message) => {
    broadcast(taskId, {
      type: 'agent:message',
      taskId,
      timestamp: new Date(),
      data: { message },
    });
  });

  orchestrator.on('agent:thinking', (taskId, agent, thinking) => {
    broadcast(taskId, {
      type: 'agent:thinking',
      taskId,
      timestamp: new Date(),
      data: { agent, thinking },
    });
  });

  orchestrator.on('agent:tool-use', (taskId, tool, input) => {
    broadcast(taskId, {
      type: 'agent:tool-use',
      taskId,
      timestamp: new Date(),
      data: { tool, input },
    });
  });

  orchestrator.on('usage:updated', (taskId, usage) => {
    broadcast(taskId, {
      type: 'usage:updated',
      taskId,
      timestamp: new Date(),
      data: { ...usage },
    });
  });

  // Subtask events
  orchestrator.on('task:decomposed', (task, subtaskIds) => {
    broadcast(task.id, {
      type: 'task:decomposed',
      taskId: task.id,
      timestamp: new Date(),
      data: { subtaskIds, strategy: task.subtaskStrategy },
    });
  });

  orchestrator.on('subtask:created', (subtask, parentTaskId) => {
    broadcast(parentTaskId, {
      type: 'subtask:created',
      taskId: parentTaskId,
      timestamp: new Date(),
      data: { subtask: { ...subtask } as Record<string, unknown> },
    });
  });

  orchestrator.on('subtask:completed', (subtask, parentTaskId) => {
    broadcast(parentTaskId, {
      type: 'subtask:completed',
      taskId: parentTaskId,
      timestamp: new Date(),
      data: { subtask: { ...subtask } as Record<string, unknown> },
    });
  });

  orchestrator.on('subtask:failed', (subtask, parentTaskId, error) => {
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
