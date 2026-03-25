import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from './index';
import { FastifyInstance } from 'fastify';
import { ApprovalRequiredEventData, ApprovalGrantedEventData, ApprovalDeniedEventData } from '@apexcli/core';

// Mock the orchestrator to control event emission for testing WebSocket approval events
vi.mock('@apexcli/orchestrator', () => {
  const mockEvents = new Map<string, any>();

  const mockOrchestrator = {
    on: vi.fn((event: string, handler: any) => {
      mockEvents.set(event, handler);
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      const handler = mockEvents.get(event);
      if (handler) {
        handler(...args);
      }
    }),
    initialize: vi.fn().mockResolvedValue(void 0),
    getTask: vi.fn().mockResolvedValue(null),
    createTask: vi.fn().mockResolvedValue({
      id: 'test-task-approval-ws',
      description: 'Test approval WebSocket events',
      status: 'pending'
    }),
    // Mock methods to satisfy interface
    updateTaskStatus: vi.fn(),
    executeTask: vi.fn(),
    listTasks: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({ api: { auth: { enabled: false, apiKeys: [] } } }),
    getAgents: vi.fn().mockResolvedValue([]),
    store: {
      getPendingApprovals: vi.fn().mockResolvedValue([])
    },
    grantApproval: vi.fn(),
    denyApproval: vi.fn(),
  };

  return {
    ApexOrchestrator: vi.fn(() => mockOrchestrator),
    DaemonManager: vi.fn(() => ({
      getStatus: vi.fn().mockResolvedValue({ running: false })
    })),
    HealthMonitor: vi.fn(() => ({
      getHealthReport: vi.fn().mockReturnValue({
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      })
    })),
  };
});

describe.skip('WebSocket Approval Events', () => {
  let server: FastifyInstance;
  let projectPath: string;
  let serverOptions: ServerOptions;

  beforeEach(async () => {
    // Create temporary test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-approval-'));

    // Create .apex directory and minimal config
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
version: "1.0"
name: "test-project"
description: "Test project for WebSocket approval events"
`);

    serverOptions = {
      projectPath,
      port: 0, // Use random port
      silent: true,
    };

    server = await createServer(serverOptions);
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  it('should broadcast approval:required events to WebSocket clients', (done) => {
    const taskId = 'test-task-approval';

    // Get server address
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    const port = address.port;

    // Connect WebSocket client
    const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

    const receivedEvents: any[] = [];

    ws.on('open', () => {
      // Simulate approval required event from orchestrator
      const mockEventData: ApprovalRequiredEventData = {
        approvalId: 'approval-123',
        taskId: taskId,
        gateName: 'test-gate',
        gateType: 'approval',
        description: 'Test approval gate',
        minApprovals: 1,
        stage: 'planning',
        agent: 'planner',
        timestamp: new Date(),
        blocking: true,
      };

      // Get the mock orchestrator and trigger the event
      const { ApexOrchestrator } = require('@apexcli/orchestrator');
      const orchestratorInstance = new ApexOrchestrator();

      // Find and call the approval:required handler directly
      const mockOn = orchestratorInstance.on as any;
      const calls = mockOn.mock.calls;
      const approvalRequiredHandler = calls.find((call: any) => call[0] === 'approval:required')?.[1];

      if (approvalRequiredHandler) {
        approvalRequiredHandler(mockEventData);
      }
    });

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        receivedEvents.push(event);

        // Check if we received the approval:required event
        if (event.type === 'approval:required') {
          expect(event.taskId).toBe(taskId);
          expect(event.data.approvalId).toBe('approval-123');
          expect(event.data.gateName).toBe('test-gate');
          expect(event.data.gateType).toBe('approval');
          expect(event.data.description).toBe('Test approval gate');
          expect(event.data.minApprovals).toBe(1);
          expect(event.data.stage).toBe('planning');
          expect(event.data.agent).toBe('planner');
          expect(event.data.blocking).toBe(true);

          ws.close();
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should broadcast approval:granted events to WebSocket clients', (done) => {
    const taskId = 'test-task-approval-granted';

    // Get server address
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    const port = address.port;

    // Connect WebSocket client
    const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

    ws.on('open', () => {
      // Simulate approval granted event
      const mockEventData: ApprovalGrantedEventData = {
        approvalId: 'approval-456',
        taskId: taskId,
        approver: 'test-approver',
        comment: 'Approval granted for testing',
        timestamp: new Date(),
      };

      // Get the mock orchestrator and trigger the event
      const { ApexOrchestrator } = require('@apexcli/orchestrator');
      const orchestratorInstance = new ApexOrchestrator();

      // Find and call the approval:approved handler
      const mockOn = orchestratorInstance.on as any;
      const calls = mockOn.mock.calls;
      const approvalGrantedHandler = calls.find((call: any) => call[0] === 'approval:approved')?.[1];

      if (approvalGrantedHandler) {
        approvalGrantedHandler(mockEventData);
      }
    });

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());

        // Check if we received the approval:granted event
        if (event.type === 'approval:granted') {
          expect(event.taskId).toBe(taskId);
          expect(event.data.approvalId).toBe('approval-456');
          expect(event.data.approver).toBe('test-approver');
          expect(event.data.comment).toBe('Approval granted for testing');

          ws.close();
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should broadcast approval:denied events to WebSocket clients', (done) => {
    const taskId = 'test-task-approval-denied';

    // Get server address
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    const port = address.port;

    // Connect WebSocket client
    const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

    ws.on('open', () => {
      // Simulate approval denied event
      const mockEventData: ApprovalDeniedEventData = {
        approvalId: 'approval-789',
        taskId: taskId,
        approver: 'test-approver',
        reason: 'Security concerns - request denied',
        timestamp: new Date(),
      };

      // Get the mock orchestrator and trigger the event
      const { ApexOrchestrator } = require('@apexcli/orchestrator');
      const orchestratorInstance = new ApexOrchestrator();

      // Find and call the approval:denied handler
      const mockOn = orchestratorInstance.on as any;
      const calls = mockOn.mock.calls;
      const approvalDeniedHandler = calls.find((call: any) => call[0] === 'approval:denied')?.[1];

      if (approvalDeniedHandler) {
        approvalDeniedHandler(mockEventData);
      }
    });

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());

        // Check if we received the approval:denied event
        if (event.type === 'approval:denied') {
          expect(event.taskId).toBe(taskId);
          expect(event.data.approvalId).toBe('approval-789');
          expect(event.data.approver).toBe('test-approver');
          expect(event.data.reason).toBe('Security concerns - request denied');

          ws.close();
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should filter approval events when using event filters', (done) => {
    const taskId = 'test-task-approval-filter';

    // Get server address
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    const port = address.port;

    // Connect WebSocket client with specific event filter for approval events only
    const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=approval:required,approval:granted,approval:denied`);

    let approvalEventReceived = false;

    ws.on('open', () => {
      // Simulate both approval and non-approval events
      const { ApexOrchestrator } = require('@apexcli/orchestrator');
      const orchestratorInstance = new ApexOrchestrator();

      const mockOn = orchestratorInstance.on as any;
      const calls = mockOn.mock.calls;

      // Trigger an approval event
      const approvalRequiredHandler = calls.find((call: any) => call[0] === 'approval:required')?.[1];
      if (approvalRequiredHandler) {
        const mockEventData: ApprovalRequiredEventData = {
          approvalId: 'approval-filter-test',
          taskId: taskId,
          gateName: 'filter-gate',
          gateType: 'approval',
          timestamp: new Date(),
        };
        approvalRequiredHandler(mockEventData);
      }

      // Simulate a task event (which should be filtered out)
      const taskEventData = {
        id: taskId,
        description: 'Test task',
        status: 'completed'
      };

      // Find and trigger a task event handler that should be filtered
      const taskCompletedHandler = calls.find((call: any) => call[0] === 'task:completed')?.[1];
      if (taskCompletedHandler) {
        taskCompletedHandler(taskEventData);
      }
    });

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());

        // Should only receive approval events due to filtering
        if (event.type === 'approval:required') {
          approvalEventReceived = true;
          expect(event.data.approvalId).toBe('approval-filter-test');
        } else if (event.type === 'task:completed') {
          // This should not happen due to event filtering
          done(new Error('Received filtered event that should have been blocked'));
        }

        // Close after receiving expected approval event
        if (approvalEventReceived) {
          ws.close();
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    ws.on('error', (error) => {
      done(error);
    });

    // Add timeout to ensure filtering is working
    setTimeout(() => {
      if (approvalEventReceived) {
        ws.close();
        done();
      } else {
        done(new Error('Expected approval event was not received'));
      }
    }, 5000);
  }, 10000);
});