import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalState, Task, ApexEvent } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface WebSocketMessage {
  type: string;
  taskId?: string;
  timestamp: string; // WebSocket receives JSON-serialized dates as strings
  data: Record<string, unknown>;
}

describe('Confirmations WebSocket Streaming Integration Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;
  let serverPort: number;
  let wsUrl: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-confirmation-ws-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create config.yaml with confirmation workflow
    const configContent = `
version: "1.0"
name: "confirmation-websocket-test"
description: "Integration test project for confirmation WebSocket streaming"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires confirmation"
  developer:
    name: "Development Agent"
    role: "Implements features after confirmation"
workflows:
  confirmation-workflow:
    name: "Feature Development with Confirmation"
    description: "Development workflow requiring confirmations at key stages"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
        gate: "plan-confirmation"
      - name: "implementation"
        agent: "developer"
        description: "Implement the feature"
        gate: "code-confirmation"
autonomy:
  level: "supervised"
  gates:
    plan-confirmation:
      type: "before-commit"
      description: "Requires confirmation before committing plan changes"
      required: true
    code-confirmation:
      type: "before-deploy"
      description: "Requires confirmation before deploying code"
      required: true
`.trim();

    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

    // Initialize server with dynamic port
    server = await createServer({ projectPath, port: 0 });
    await server.listen({ port: 0 });

    // Get the actual port assigned
    const address = server.server.address();
    serverPort = typeof address === 'string' ? parseInt(address.split(':').pop() || '3000') : address?.port || 3000;
    wsUrl = `ws://localhost:${serverPort}`;

    // Get orchestrator instance from server
    orchestrator = (server as any).orchestrator || new ApexOrchestrator({ projectPath });
    if (!orchestrator.isInitialized) {
      await orchestrator.initialize();
    }
  });

  afterAll(async () => {
    await server?.close();
    // Clean up temporary directory
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  beforeEach(async () => {
    // Clear any existing data before each test
    await orchestrator.store.clearAll?.();
  });

  describe('Real-time confirmation state change streaming', () => {
    it('should stream approval:granted event when confirmation is accepted', async () => {
      // Create a test task
      const task = await orchestrator.createTask({
        description: 'Test task requiring confirmation',
        workflow: 'confirmation-workflow',
        autonomy: { level: 'supervised' }
      });

      // Set up WebSocket connection with event filtering for approval events
      const ws = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:granted,approval:denied`);
      const receivedEvents: WebSocketMessage[] = [];

      // Promise to handle WebSocket events
      const eventPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for WebSocket events'));
        }, 10000); // 10 second timeout

        ws.on('open', () => {
          console.log('WebSocket connected for approval streaming test');
        });

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            receivedEvents.push(message);

            // Resolve when we receive the approval:granted event
            if (message.type === 'approval:granted') {
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Wait for WebSocket to be ready
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Mock an approval state and orchestrator methods
      const confirmationId = 'test-confirmation-ws-accept';
      const mockApprovalState: ApprovalState = {
        requestId: confirmationId,
        gateName: 'plan-confirmation',
        status: 'pending',
        requestedAt: new Date(),
        context: { stage: 'planning', changesSummary: 'Plan implementation changes' },
        stage: 'planning',
        agent: 'planner'
      };

      // Store original methods
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      // Mock orchestrator methods to simulate approval process
      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        expect(id).toBe(confirmationId);

        // Trigger the approval:granted event that would normally be emitted by orchestrator
        const eventData = {
          taskId: task.id,
          approvalId: confirmationId,
          approver,
          comment: comments,
        };

        // Simulate the orchestrator emitting the event
        setTimeout(() => {
          orchestrator.emit('approval:approved', eventData);
        }, 100);

        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          ...mockApprovalState,
          status: 'approved' as any,
          respondedBy: 'test-user',
          respondedAt: new Date()
        });
      };

      try {
        // Send confirmation acceptance via API
        const apiResponse = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'test-user',
            comments: 'Plan looks good, proceed with implementation'
          }
        });

        expect(apiResponse.statusCode).toBe(200);

        // Wait for the WebSocket event
        await eventPromise;

        // Verify we received the approval:granted event
        const approvalGrantedEvent = receivedEvents.find(event => event.type === 'approval:granted');
        expect(approvalGrantedEvent).toBeDefined();
        expect(approvalGrantedEvent?.taskId).toBe(task.id);
        expect(approvalGrantedEvent?.data).toMatchObject({
          approvalId: confirmationId,
          approver: 'test-user',
          comment: 'Plan looks good, proceed with implementation'
        });

        // Verify the event has proper timestamp
        expect(new Date(approvalGrantedEvent!.timestamp)).toBeInstanceOf(Date);

      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
        ws.close();
      }
    });

    it('should stream approval:denied event when confirmation is rejected', async () => {
      // Create a test task
      const task = await orchestrator.createTask({
        description: 'Test task for rejection streaming',
        workflow: 'confirmation-workflow',
        autonomy: { level: 'supervised' }
      });

      // Set up WebSocket connection
      const ws = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:denied`);
      const receivedEvents: WebSocketMessage[] = [];

      // Promise to handle WebSocket events
      const eventPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for approval:denied event'));
        }, 10000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            receivedEvents.push(message);

            if (message.type === 'approval:denied') {
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Wait for WebSocket to be ready
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Mock approval state and orchestrator methods
      const confirmationId = 'test-confirmation-ws-reject';
      const originalDenyApproval = orchestrator.denyApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.denyApproval = async (id: string, approver: string, reason: string) => {
        expect(id).toBe(confirmationId);

        // Trigger the approval:denied event
        const eventData = {
          taskId: task.id,
          approvalId: confirmationId,
          approver,
          reason,
        };

        setTimeout(() => {
          orchestrator.emit('approval:denied', eventData);
        }, 100);

        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'code-confirmation',
          status: 'denied' as any,
          requestedAt: new Date(),
          respondedBy: 'test-reviewer',
          respondedAt: new Date(),
          context: { stage: 'implementation', reason: 'Code needs refactoring' },
          stage: 'implementation',
          agent: 'developer'
        });
      };

      try {
        // Send confirmation rejection via API
        const apiResponse = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'reject',
            approver: 'test-reviewer',
            comments: 'Code needs refactoring before deployment'
          }
        });

        expect(apiResponse.statusCode).toBe(200);

        // Wait for the WebSocket event
        await eventPromise;

        // Verify we received the approval:denied event
        const approvalDeniedEvent = receivedEvents.find(event => event.type === 'approval:denied');
        expect(approvalDeniedEvent).toBeDefined();
        expect(approvalDeniedEvent?.taskId).toBe(task.id);
        expect(approvalDeniedEvent?.data).toMatchObject({
          approvalId: confirmationId,
          approver: 'test-reviewer',
          reason: 'Code needs refactoring before deployment'
        });

        // Verify the event has proper timestamp
        expect(new Date(approvalDeniedEvent!.timestamp)).toBeInstanceOf(Date);

      } finally {
        // Restore original methods
        orchestrator.denyApproval = originalDenyApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
        ws.close();
      }
    });

    it('should handle multiple clients receiving the same confirmation events', async () => {
      // Create a test task
      const task = await orchestrator.createTask({
        description: 'Test task for multiple client streaming',
        workflow: 'confirmation-workflow',
        autonomy: { level: 'supervised' }
      });

      // Set up multiple WebSocket connections
      const ws1 = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:granted`);
      const ws2 = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:granted`);
      const ws3 = new WebSocket(`${wsUrl}/stream/${task.id}`); // No filter, receives all events

      const client1Events: WebSocketMessage[] = [];
      const client2Events: WebSocketMessage[] = [];
      const client3Events: WebSocketMessage[] = [];

      // Set up event listeners for all clients
      const setupClient = (ws: WebSocket, events: WebSocketMessage[]) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout setting up WebSocket client'));
          }, 5000);

          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });

          ws.on('message', (data) => {
            const message: WebSocketMessage = JSON.parse(data.toString());
            events.push(message);
          });

          ws.on('error', reject);
        });
      };

      await Promise.all([
        setupClient(ws1, client1Events),
        setupClient(ws2, client2Events),
        setupClient(ws3, client3Events)
      ]);

      // Promise to wait for all clients to receive the event
      const allClientsReceived = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for all clients to receive event'));
        }, 10000);

        const checkAllReceived = () => {
          const client1HasEvent = client1Events.some(e => e.type === 'approval:granted');
          const client2HasEvent = client2Events.some(e => e.type === 'approval:granted');
          const client3HasEvent = client3Events.some(e => e.type === 'approval:granted');

          if (client1HasEvent && client2HasEvent && client3HasEvent) {
            clearTimeout(timeout);
            resolve();
          }
        };

        // Check every 100ms
        const interval = setInterval(checkAllReceived, 100);
        setTimeout(() => clearInterval(interval), 10000);
      });

      // Mock orchestrator for approval
      const confirmationId = 'test-confirmation-multi-client';
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        setTimeout(() => {
          orchestrator.emit('approval:approved', {
            taskId: task.id,
            approvalId: confirmationId,
            approver,
            comment: comments,
          });
        }, 100);
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async () => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'plan-confirmation',
          status: 'approved' as any,
          requestedAt: new Date(),
          respondedBy: 'multi-client-user',
          respondedAt: new Date(),
          context: { stage: 'planning' },
          stage: 'planning',
          agent: 'planner'
        });
      };

      try {
        // Trigger confirmation approval
        const apiResponse = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'multi-client-user',
            comments: 'Approved by all stakeholders'
          }
        });

        expect(apiResponse.statusCode).toBe(200);

        // Wait for all clients to receive the event
        await allClientsReceived;

        // Verify all clients received the event
        expect(client1Events.some(e => e.type === 'approval:granted')).toBe(true);
        expect(client2Events.some(e => e.type === 'approval:granted')).toBe(true);
        expect(client3Events.some(e => e.type === 'approval:granted')).toBe(true);

        // Verify event content is consistent across clients
        const client1Event = client1Events.find(e => e.type === 'approval:granted');
        const client2Event = client2Events.find(e => e.type === 'approval:granted');
        const client3Event = client3Events.find(e => e.type === 'approval:granted');

        expect(client1Event?.data).toEqual(client2Event?.data);
        expect(client2Event?.data).toEqual(client3Event?.data);
        expect(client1Event?.taskId).toBe(task.id);

      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;

        // Close all WebSocket connections
        ws1.close();
        ws2.close();
        ws3.close();
      }
    });

    it('should properly filter events based on WebSocket query parameters', async () => {
      // Create a test task
      const task = await orchestrator.createTask({
        description: 'Test task for event filtering',
        workflow: 'confirmation-workflow',
        autonomy: { level: 'supervised' }
      });

      // Set up WebSocket connections with different filters
      const wsApprovalOnly = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:granted`);
      const wsDenialOnly = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:denied`);
      const wsAllEvents = new WebSocket(`${wsUrl}/stream/${task.id}`);

      const approvalOnlyEvents: WebSocketMessage[] = [];
      const denialOnlyEvents: WebSocketMessage[] = [];
      const allEvents: WebSocketMessage[] = [];

      // Set up event listeners
      const setupEventListener = (ws: WebSocket, events: WebSocketMessage[]) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WebSocket setup timeout')), 5000);

          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });

          ws.on('message', (data) => {
            const message: WebSocketMessage = JSON.parse(data.toString());
            events.push(message);
          });

          ws.on('error', reject);
        });
      };

      await Promise.all([
        setupEventListener(wsApprovalOnly, approvalOnlyEvents),
        setupEventListener(wsDenialOnly, denialOnlyEvents),
        setupEventListener(wsAllEvents, allEvents)
      ]);

      // Mock orchestrator methods
      const originalGrantApproval = orchestrator.grantApproval;
      const originalDenyApproval = orchestrator.denyApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        setTimeout(() => {
          orchestrator.emit('approval:approved', {
            taskId: task.id,
            approvalId: id,
            approver,
            comment: comments,
          });
        }, 100);
        return Promise.resolve();
      };

      orchestrator.denyApproval = async (id: string, approver: string, reason: string) => {
        setTimeout(() => {
          orchestrator.emit('approval:denied', {
            taskId: task.id,
            approvalId: id,
            approver,
            reason,
          });
        }, 100);
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          requestId: id,
          gateName: 'test-gate',
          status: 'approved' as any,
          requestedAt: new Date(),
          context: {},
          stage: 'test',
          agent: 'test'
        });
      };

      try {
        // Send approval
        await server.inject({
          method: 'POST',
          url: '/confirmations/filter-test-approval/respond',
          payload: { response: 'accept', approver: 'filter-tester' }
        });

        // Send denial
        await server.inject({
          method: 'POST',
          url: '/confirmations/filter-test-denial/respond',
          payload: { response: 'reject', approver: 'filter-tester', comments: 'Testing denial' }
        });

        // Wait for events to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify event filtering
        expect(approvalOnlyEvents.some(e => e.type === 'approval:granted')).toBe(true);
        expect(approvalOnlyEvents.some(e => e.type === 'approval:denied')).toBe(false);

        expect(denialOnlyEvents.some(e => e.type === 'approval:granted')).toBe(false);
        expect(denialOnlyEvents.some(e => e.type === 'approval:denied')).toBe(true);

        expect(allEvents.some(e => e.type === 'approval:granted')).toBe(true);
        expect(allEvents.some(e => e.type === 'approval:denied')).toBe(true);

      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.denyApproval = originalDenyApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;

        // Close WebSocket connections
        wsApprovalOnly.close();
        wsDenialOnly.close();
        wsAllEvents.close();
      }
    });

    it('should handle proper message format for state change events', async () => {
      // Create a test task
      const task = await orchestrator.createTask({
        description: 'Test task for message format validation',
        workflow: 'confirmation-workflow',
        autonomy: { level: 'supervised' }
      });

      const ws = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:granted,approval:denied`);
      const receivedEvents: WebSocketMessage[] = [];

      const eventPromise = new Promise<WebSocketMessage>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for properly formatted event'));
        }, 10000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            receivedEvents.push(message);

            if (message.type === 'approval:granted') {
              clearTimeout(timeout);
              resolve(message);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Wait for WebSocket to be ready
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Mock orchestrator
      const confirmationId = 'format-test-confirmation';
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        setTimeout(() => {
          orchestrator.emit('approval:approved', {
            taskId: task.id,
            approvalId: confirmationId,
            approver,
            comment: comments,
          });
        }, 100);
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async () => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'plan-confirmation',
          status: 'approved' as any,
          requestedAt: new Date(),
          respondedBy: 'format-tester',
          respondedAt: new Date(),
          context: { stage: 'planning', changesSummary: 'Test changes' },
          stage: 'planning',
          agent: 'planner'
        });
      };

      try {
        // Trigger confirmation approval
        await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'format-tester',
            comments: 'Testing message format'
          }
        });

        // Wait for and validate the event
        const event = await eventPromise;

        // Verify the message format matches ApexEvent structure
        expect(event).toMatchObject({
          type: 'approval:granted',
          taskId: task.id,
          timestamp: expect.any(String),
          data: {
            approvalId: confirmationId,
            approver: 'format-tester',
            comment: 'Testing message format'
          }
        });

        // Verify timestamp is valid ISO date string
        expect(new Date(event.timestamp)).toBeInstanceOf(Date);
        expect(isNaN(new Date(event.timestamp).getTime())).toBe(false);

        // Verify data structure contains required fields for confirmation events
        expect(event.data).toHaveProperty('approvalId');
        expect(event.data).toHaveProperty('approver');
        expect(event.data).toHaveProperty('comment');

      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
        ws.close();
      }
    });
  });

  describe('WebSocket connection management for confirmations', () => {
    it('should handle WebSocket disconnection gracefully during confirmation processing', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for connection handling',
        workflow: 'confirmation-workflow'
      });

      const ws = new WebSocket(`${wsUrl}/stream/${task.id}?events=approval:granted`);

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Close the WebSocket before sending the confirmation
      ws.close();

      // Mock orchestrator
      const confirmationId = 'disconnect-test-confirmation';
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async () => {
        // This should still work even with disconnected WebSocket
        setTimeout(() => {
          orchestrator.emit('approval:approved', {
            taskId: task.id,
            approvalId: confirmationId,
            approver: 'disconnect-tester',
            comment: 'Testing disconnection handling'
          });
        }, 100);
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async () => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'plan-confirmation',
          status: 'approved' as any,
          requestedAt: new Date(),
          context: {},
          stage: 'planning',
          agent: 'planner'
        });
      };

      try {
        // This should not fail even with disconnected WebSocket
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'disconnect-tester',
            comments: 'Testing disconnection handling'
          }
        });

        expect(response.statusCode).toBe(200);

      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle rapid state changes via WebSocket', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for rapid state changes',
        workflow: 'confirmation-workflow'
      });

      const ws = new WebSocket(`${wsUrl}/stream/${task.id}`);
      const receivedEvents: WebSocketMessage[] = [];

      const eventsPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for rapid events'));
        }, 15000);

        ws.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          receivedEvents.push(message);

          // Resolve when we've received multiple approval events
          if (receivedEvents.filter(e => e.type.startsWith('approval:')).length >= 3) {
            clearTimeout(timeout);
            resolve();
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Wait for WebSocket connection
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Mock orchestrator for rapid events
      const originalGrantApproval = orchestrator.grantApproval;
      const originalDenyApproval = orchestrator.denyApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      let approvalCount = 0;
      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        setTimeout(() => {
          orchestrator.emit('approval:approved', {
            taskId: task.id,
            approvalId: id,
            approver,
            comment: comments,
          });
        }, 50);
        return Promise.resolve();
      };

      orchestrator.denyApproval = async (id: string, approver: string, reason: string) => {
        setTimeout(() => {
          orchestrator.emit('approval:denied', {
            taskId: task.id,
            approvalId: id,
            approver,
            reason,
          });
        }, 50);
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async () => {
        return Promise.resolve({
          requestId: 'rapid-test',
          gateName: 'test-gate',
          status: 'approved' as any,
          requestedAt: new Date(),
          context: {},
          stage: 'test',
          agent: 'test'
        });
      };

      try {
        // Send multiple rapid confirmations
        const requests = [
          server.inject({
            method: 'POST',
            url: '/confirmations/rapid-1/respond',
            payload: { response: 'accept', approver: 'rapid-tester-1' }
          }),
          server.inject({
            method: 'POST',
            url: '/confirmations/rapid-2/respond',
            payload: { response: 'reject', approver: 'rapid-tester-2', comments: 'Rapid test rejection' }
          }),
          server.inject({
            method: 'POST',
            url: '/confirmations/rapid-3/respond',
            payload: { response: 'accept', approver: 'rapid-tester-3' }
          })
        ];

        // Wait for all API calls to complete
        const responses = await Promise.all(requests);
        responses.forEach(response => {
          expect(response.statusCode).toBe(200);
        });

        // Wait for all WebSocket events
        await eventsPromise;

        // Verify we received the expected events
        const approvalEvents = receivedEvents.filter(e => e.type === 'approval:granted');
        const denialEvents = receivedEvents.filter(e => e.type === 'approval:denied');

        expect(approvalEvents.length).toBeGreaterThanOrEqual(2);
        expect(denialEvents.length).toBeGreaterThanOrEqual(1);

      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.denyApproval = originalDenyApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
        ws.close();
      }
    });
  });
});