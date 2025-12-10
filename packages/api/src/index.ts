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
} from '@apex/core';
import { ApexOrchestrator } from '@apex/orchestrator';

// WebSocket client tracking
const clients = new Map<string, Set<WebSocket>>();

export interface ServerOptions {
  port?: number;
  host?: string;
  projectPath: string;
}

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const { port = 3000, host = '0.0.0.0', projectPath } = options;

  const app = Fastify({
    logger: {
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
      data: task,
    });
  });

  orchestrator.on('task:started', (task) => {
    broadcast(task.id, {
      type: 'task:started',
      taskId: task.id,
      timestamp: new Date(),
      data: task,
    });
  });

  orchestrator.on('task:completed', (task) => {
    broadcast(task.id, {
      type: 'task:completed',
      taskId: task.id,
      timestamp: new Date(),
      data: task,
    });
  });

  orchestrator.on('task:failed', (task, error) => {
    broadcast(task.id, {
      type: 'task:failed',
      taskId: task.id,
      timestamp: new Date(),
      data: { task, error: error.message },
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
      data: usage,
    });
  });
}

/**
 * Start the server
 */
export async function startServer(options: ServerOptions): Promise<void> {
  const { port = 3000, host = '0.0.0.0' } = options;

  const server = await createServer(options);

  try {
    await server.listen({ port, host });
    console.log(`\n🚀 APEX API Server running at http://${host}:${port}\n`);
    console.log('Endpoints:');
    console.log(`  POST   /tasks              - Create a new task`);
    console.log(`  GET    /tasks              - List tasks`);
    console.log(`  GET    /tasks/:id          - Get task details`);
    console.log(`  POST   /tasks/:id/status   - Update task status`);
    console.log(`  POST   /tasks/:id/log      - Add log entry`);
    console.log(`  GET    /tasks/:id/gates/:n - Check gate status`);
    console.log(`  POST   /tasks/:id/gates/:n/approve - Approve gate`);
    console.log(`  GET    /agents             - List agents`);
    console.log(`  GET    /config             - Get configuration`);
    console.log(`  WS     /stream/:taskId     - Real-time task updates\n`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

// CLI entry point
if (require.main === module) {
  const projectPath = process.env.APEX_PROJECT || process.cwd();
  const port = parseInt(process.env.PORT || '3000', 10);

  startServer({ projectPath, port }).catch(console.error);
}
