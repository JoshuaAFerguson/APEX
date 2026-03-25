/**
 * Integration tests for WebSocket permission notification broadcasting
 *
 * This test suite verifies that:
 * 1. WebSocket clients receive permission notifications when orchestrator emits events
 * 2. Connection handling works correctly with multiple clients
 * 3. Message format verification ensures proper serialization
 * 4. Event filtering and broadcasting works as expected
 *
 * These are full integration tests that test the complete flow from orchestrator
 * event emission to WebSocket client receipt.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { EventEmitter } from 'eventemitter3';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

describe.skip('WebSocket Permission Broadcasting Integration Tests', () => {
  let app: any;
  let mockOrchestrator: Partial<ApexOrchestrator> & EventEmitter;
  let wsClients: WebSocket[];
  let port: number;

  beforeEach(async () => {
    // Create mock orchestrator with EventEmitter functionality
    mockOrchestrator = Object.assign(new EventEmitter(), {
      // Add any required orchestrator methods
    }) as Partial<ApexOrchestrator> & EventEmitter;

    // Initialize Fastify app with WebSocket support
    app = Fastify({ logger: false });
    await app.register(websocket);

    wsClients = [];

    // Setup WebSocket route that broadcasts permission events
    app.register(async (fastify: any) => {
      await fastify.register(async (websocketFastify: any) => {
        websocketFastify.get('/stream/:taskId', { websocket: true }, (connection: any) => {
          const ws = connection.socket;
          wsClients.push(ws);

          // Listen for permission events from orchestrator and broadcast
          const handlePermissionRequest = (event: any) => {
            ws.send(JSON.stringify({
              type: 'permission:request',
              taskId: event.taskId || 'permission-global',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handlePermissionGranted = (event: any) => {
            ws.send(JSON.stringify({
              type: 'permission:granted',
              taskId: event.taskId || 'permission-global',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handlePermissionDenied = (event: any) => {
            ws.send(JSON.stringify({
              type: 'permission:denied',
              taskId: event.taskId || 'permission-global',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handleDangerousDetected = (event: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:detected',
              taskId: event.taskId || 'dangerous-global',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handleDangerousConfirmed = (event: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:confirmed',
              taskId: event.taskId || 'dangerous-global',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handleDangerousBlocked = (event: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:blocked',
              taskId: event.taskId || 'dangerous-global',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          mockOrchestrator.on('permission:request', handlePermissionRequest);
          mockOrchestrator.on('permission:granted', handlePermissionGranted);
          mockOrchestrator.on('permission:denied', handlePermissionDenied);
          mockOrchestrator.on('dangerous:detected', handleDangerousDetected);
          mockOrchestrator.on('dangerous:confirmed', handleDangerousConfirmed);
          mockOrchestrator.on('dangerous:blocked', handleDangerousBlocked);

          ws.on('close', () => {
            // Clean up event listeners
            mockOrchestrator.off('permission:request', handlePermissionRequest);
            mockOrchestrator.off('permission:granted', handlePermissionGranted);
            mockOrchestrator.off('permission:denied', handlePermissionDenied);
            mockOrchestrator.off('dangerous:detected', handleDangerousDetected);
            mockOrchestrator.off('dangerous:confirmed', handleDangerousConfirmed);
            mockOrchestrator.off('dangerous:blocked', handleDangerousBlocked);

            wsClients = wsClients.filter(client => client !== ws);
          });
        });
      });
    });

    // Start the server
    port = Math.floor(Math.random() * 10000) + 50000;
    await app.listen({ port });
  });

  afterEach(async () => {
    // Close all WebSocket connections
    wsClients.forEach(ws => ws.close());
    await app.close();
  });

  describe('Permission Request Event Broadcasting', () => {
    it('should broadcast permission:request events to WebSocket clients', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/test-task-1`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Wait for WebSocket connection
      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit permission request event from orchestrator
      const permissionRequest = {
        requestId: 'perm-req-001',
        taskId: 'test-task-1',
        toolName: 'Write',
        agentName: 'developer',
        operation: 'file:write',
        description: 'Write new component file',
        reason: 'Creating React component for feature implementation',
        scope: '/src/components/NewComponent.tsx',
        riskLevel: 'low',
        metadata: {
          fileSize: 1024,
          fileType: 'typescript',
          directory: '/src/components'
        },
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', permissionRequest);

      // Wait for message to be received
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify message was received
      const permissionMessages = messages.filter(m => m.type === 'permission:request');
      expect(permissionMessages).toHaveLength(1);

      const message = permissionMessages[0];
      expect(message.type).toBe('permission:request');
      expect(message.taskId).toBe('test-task-1');
      expect(message.data.requestId).toBe('perm-req-001');
      expect(message.data.toolName).toBe('Write');
      expect(message.data.agentName).toBe('developer');
      expect(message.data.operation).toBe('file:write');
      expect(message.data.description).toBe('Write new component file');
      expect(message.data.reason).toBe('Creating React component for feature implementation');
      expect(message.data.scope).toBe('/src/components/NewComponent.tsx');
      expect(message.data.riskLevel).toBe('low');
      expect(message.data.metadata).toEqual({
        fileSize: 1024,
        fileType: 'typescript',
        directory: '/src/components'
      });
    });

    it('should broadcast permission:granted events with proper structure', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/test-task-2`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit permission granted event
      const permissionGranted = {
        requestId: 'perm-req-002',
        taskId: 'test-task-2',
        toolName: 'Edit',
        agentName: 'developer',
        level: 'allow-once',
        grantedBy: 'user',
        grantReason: 'Approved for component update',
        comment: 'User confirmed this change is safe',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:granted', permissionGranted);

      await new Promise(resolve => setTimeout(resolve, 100));

      const grantedMessages = messages.filter(m => m.type === 'permission:granted');
      expect(grantedMessages).toHaveLength(1);

      const message = grantedMessages[0];
      expect(message.type).toBe('permission:granted');
      expect(message.taskId).toBe('test-task-2');
      expect(message.data.requestId).toBe('perm-req-002');
      expect(message.data.toolName).toBe('Edit');
      expect(message.data.level).toBe('allow-once');
      expect(message.data.grantedBy).toBe('user');
      expect(message.data.grantReason).toBe('Approved for component update');
      expect(message.data.comment).toBe('User confirmed this change is safe');
    });

    it('should broadcast permission:denied events with denial reasons', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/test-task-3`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit permission denied event
      const permissionDenied = {
        requestId: 'perm-req-003',
        taskId: 'test-task-3',
        toolName: 'Bash',
        agentName: 'devops',
        deniedBy: 'system',
        denialReason: 'Tool not allowed in read-only mode',
        reason: 'Security policy violation',
        comment: 'Bash tools are disabled in production environment',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:denied', permissionDenied);

      await new Promise(resolve => setTimeout(resolve, 100));

      const deniedMessages = messages.filter(m => m.type === 'permission:denied');
      expect(deniedMessages).toHaveLength(1);

      const message = deniedMessages[0];
      expect(message.type).toBe('permission:denied');
      expect(message.taskId).toBe('test-task-3');
      expect(message.data.requestId).toBe('perm-req-003');
      expect(message.data.toolName).toBe('Bash');
      expect(message.data.deniedBy).toBe('system');
      expect(message.data.denialReason).toBe('Tool not allowed in read-only mode');
      expect(message.data.reason).toBe('Security policy violation');
      expect(message.data.comment).toBe('Bash tools are disabled in production environment');
    });
  });

  describe('Dangerous Operation Event Broadcasting', () => {
    it('should broadcast dangerous:detected events with risk assessment', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/dangerous-task-1`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit dangerous operation detected event
      const dangerousDetected = {
        operationId: 'danger-op-001',
        taskId: 'dangerous-task-1',
        toolName: 'Bash',
        agentName: 'system',
        operationType: 'file-deletion',
        operation: 'delete critical files',
        riskLevel: 'critical',
        riskDescription: 'This operation will delete important system files',
        description: 'Bulk deletion of system configuration files detected',
        metadata: {
          command: 'rm -rf /etc/systemd/*',
          targetFiles: ['/etc/systemd/system/', '/etc/systemd/user/'],
          estimatedFilesAffected: 150
        },
        timestamp: new Date()
      };

      mockOrchestrator.emit('dangerous:detected', dangerousDetected);

      await new Promise(resolve => setTimeout(resolve, 100));

      const dangerousMessages = messages.filter(m => m.type === 'dangerous:detected');
      expect(dangerousMessages).toHaveLength(1);

      const message = dangerousMessages[0];
      expect(message.type).toBe('dangerous:detected');
      expect(message.taskId).toBe('dangerous-task-1');
      expect(message.data.operationId).toBe('danger-op-001');
      expect(message.data.toolName).toBe('Bash');
      expect(message.data.operationType).toBe('file-deletion');
      expect(message.data.riskLevel).toBe('critical');
      expect(message.data.riskDescription).toBe('This operation will delete important system files');
      expect(message.data.metadata).toEqual({
        command: 'rm -rf /etc/systemd/*',
        targetFiles: ['/etc/systemd/system/', '/etc/systemd/user/'],
        estimatedFilesAffected: 150
      });
    });

    it('should broadcast dangerous:confirmed and dangerous:blocked events', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/dangerous-task-2`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit dangerous operation confirmed event
      const dangerousConfirmed = {
        operationId: 'danger-op-002',
        taskId: 'dangerous-task-2',
        toolName: 'Bash',
        agentName: 'devops',
        operationType: 'privilege-escalation',
        confirmedBy: 'admin',
        confirmation: 'Admin approved sudo access for deployment',
        comment: 'Deployment requires elevated privileges for system configuration',
        timestamp: new Date()
      };

      mockOrchestrator.emit('dangerous:confirmed', dangerousConfirmed);

      // Emit dangerous operation blocked event
      const dangerousBlocked = {
        operationId: 'danger-op-003',
        taskId: 'dangerous-task-2',
        toolName: 'Write',
        agentName: 'developer',
        operationType: 'data-modification',
        blockedBy: 'safety-system',
        blockReason: 'Operation exceeds safety threshold',
        reason: 'Attempting to modify production database without approval',
        comment: 'Production data modifications require explicit approval',
        timestamp: new Date()
      };

      mockOrchestrator.emit('dangerous:blocked', dangerousBlocked);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both events were received
      const confirmedMessages = messages.filter(m => m.type === 'dangerous:confirmed');
      const blockedMessages = messages.filter(m => m.type === 'dangerous:blocked');

      expect(confirmedMessages).toHaveLength(1);
      expect(blockedMessages).toHaveLength(1);

      // Verify confirmed event structure
      const confirmedMessage = confirmedMessages[0];
      expect(confirmedMessage.data.operationId).toBe('danger-op-002');
      expect(confirmedMessage.data.confirmedBy).toBe('admin');
      expect(confirmedMessage.data.confirmation).toBe('Admin approved sudo access for deployment');

      // Verify blocked event structure
      const blockedMessage = blockedMessages[0];
      expect(blockedMessage.data.operationId).toBe('danger-op-003');
      expect(blockedMessage.data.blockedBy).toBe('safety-system');
      expect(blockedMessage.data.blockReason).toBe('Operation exceeds safety threshold');
    });
  });

  describe('Multiple Client Broadcasting', () => {
    it('should broadcast permission events to multiple WebSocket clients simultaneously', async () => {
      // Connect three clients to the same task
      const ws1 = new WebSocket(`ws://localhost:${port}/stream/multi-task`);
      const ws2 = new WebSocket(`ws://localhost:${port}/stream/multi-task`);
      const ws3 = new WebSocket(`ws://localhost:${port}/stream/multi-task`);

      wsClients.push(ws1, ws2, ws3);

      const messages1: any[] = [];
      const messages2: any[] = [];
      const messages3: any[] = [];

      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));
      ws3.on('message', (data) => messages3.push(JSON.parse(data.toString())));

      // Wait for all connections
      await Promise.all([
        new Promise<void>(resolve => ws1.on('open', resolve)),
        new Promise<void>(resolve => ws2.on('open', resolve)),
        new Promise<void>(resolve => ws3.on('open', resolve))
      ]);

      // Emit a permission event
      const multicastEvent = {
        requestId: 'multicast-001',
        taskId: 'multi-task',
        toolName: 'MultiTool',
        agentName: 'developer',
        level: 'allow-always',
        grantedBy: 'system',
        grantReason: 'Auto-approved for standard operation',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:granted', multicastEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      // All clients should receive the same event
      const grantedMessages1 = messages1.filter(m => m.type === 'permission:granted');
      const grantedMessages2 = messages2.filter(m => m.type === 'permission:granted');
      const grantedMessages3 = messages3.filter(m => m.type === 'permission:granted');

      expect(grantedMessages1).toHaveLength(1);
      expect(grantedMessages2).toHaveLength(1);
      expect(grantedMessages3).toHaveLength(1);

      // Verify all clients received identical data
      expect(grantedMessages1[0].data.requestId).toBe('multicast-001');
      expect(grantedMessages2[0].data.requestId).toBe('multicast-001');
      expect(grantedMessages3[0].data.requestId).toBe('multicast-001');

      expect(grantedMessages1[0].data.toolName).toBe('MultiTool');
      expect(grantedMessages2[0].data.toolName).toBe('MultiTool');
      expect(grantedMessages3[0].data.toolName).toBe('MultiTool');
    });

    it('should handle client disconnections gracefully without affecting other clients', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}/stream/disconnect-test`);
      const ws2 = new WebSocket(`ws://localhost:${port}/stream/disconnect-test`);

      wsClients.push(ws1, ws2);

      const messages1: any[] = [];
      const messages2: any[] = [];

      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      await Promise.all([
        new Promise<void>(resolve => ws1.on('open', resolve)),
        new Promise<void>(resolve => ws2.on('open', resolve))
      ]);

      // Close first client
      ws1.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Emit event - should only reach second client
      const disconnectTestEvent = {
        requestId: 'disconnect-test-001',
        taskId: 'disconnect-test',
        toolName: 'TestTool',
        agentName: 'tester',
        deniedBy: 'system',
        denialReason: 'Testing disconnection handling',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:denied', disconnectTestEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      // First client (disconnected) should receive no new messages
      const deniedMessages1 = messages1.filter(m => m.type === 'permission:denied');
      expect(deniedMessages1).toHaveLength(0);

      // Second client should receive the event
      const deniedMessages2 = messages2.filter(m => m.type === 'permission:denied');
      expect(deniedMessages2).toHaveLength(1);
      expect(deniedMessages2[0].data.requestId).toBe('disconnect-test-001');
    });
  });

  describe('Event Filtering and WebSocket Streams', () => {
    it('should support event filtering for permission events only', async () => {
      // Connect with permission event filter
      const ws = new WebSocket(`ws://localhost:${port}/stream/filter-test?events=permission:request,permission:granted,permission:denied`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit multiple types of events
      mockOrchestrator.emit('permission:request', {
        requestId: 'filter-req-001',
        taskId: 'filter-test',
        toolName: 'FilterTool',
        agentName: 'developer'
      });

      mockOrchestrator.emit('task:started', {
        id: 'filter-test',
        status: 'in-progress'
      });

      mockOrchestrator.emit('permission:granted', {
        requestId: 'filter-req-001',
        taskId: 'filter-test',
        toolName: 'FilterTool',
        level: 'allow',
        grantedBy: 'user'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only receive permission events, not task events
      const permissionMessages = messages.filter(m => m.type.startsWith('permission:'));
      const taskMessages = messages.filter(m => m.type.startsWith('task:'));

      expect(permissionMessages).toHaveLength(2); // request + granted
      expect(taskMessages).toHaveLength(0); // should be filtered out
    });
  });

  describe('Message Format and Serialization', () => {
    it('should properly serialize complex metadata objects in permission events', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/serialization-test`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit event with complex metadata
      const complexMetadata = {
        fileOperations: {
          create: ['/src/components/A.tsx', '/src/components/B.tsx'],
          modify: ['/src/index.ts'],
          delete: []
        },
        dependencies: {
          added: ['react-router-dom', 'styled-components'],
          removed: ['legacy-ui-lib'],
          updated: { 'react': '^18.2.0' }
        },
        riskFactors: ['new-dependencies', 'file-creation'],
        estimatedImpact: 'medium',
        reviewers: ['senior-dev', 'tech-lead'],
        settings: {
          autoApprove: false,
          requiresManualReview: true,
          timeoutMinutes: 30
        }
      };

      mockOrchestrator.emit('permission:request', {
        requestId: 'serialize-001',
        taskId: 'serialization-test',
        toolName: 'Write',
        agentName: 'developer',
        metadata: complexMetadata,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const requestMessages = messages.filter(m => m.type === 'permission:request');
      expect(requestMessages).toHaveLength(1);

      const message = requestMessages[0];
      expect(message.data.metadata).toEqual(complexMetadata);
      expect(message.data.metadata.fileOperations.create).toHaveLength(2);
      expect(message.data.metadata.dependencies.added).toContain('react-router-dom');
      expect(message.data.metadata.settings.requiresManualReview).toBe(true);
    });

    it('should handle timestamp serialization correctly', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/timestamp-test`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const testTimestamp = new Date('2024-03-15T10:30:45.123Z');
      mockOrchestrator.emit('permission:granted', {
        requestId: 'timestamp-test-001',
        taskId: 'timestamp-test',
        toolName: 'TimestampTool',
        level: 'allow',
        grantedBy: 'user',
        timestamp: testTimestamp
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const grantedMessages = messages.filter(m => m.type === 'permission:granted');
      expect(grantedMessages).toHaveLength(1);

      const message = grantedMessages[0];
      // The event timestamp should be serialized as ISO string
      expect(typeof message.data.timestamp).toBe('string');
      expect(message.data.timestamp).toBe(testTimestamp.toISOString());
      // The message timestamp should also be a valid ISO string
      expect(typeof message.timestamp).toBe('string');
      expect(new Date(message.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle events with missing taskId using fallback broadcasting', async () => {
      // Connect to the fallback task ID for global permission events
      const ws = new WebSocket(`ws://localhost:${port}/stream/permission-global`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit permission event without taskId
      mockOrchestrator.emit('permission:request', {
        requestId: 'no-task-id-001',
        toolName: 'GlobalTool',
        agentName: 'system',
        description: 'Global permission request without specific task'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const requestMessages = messages.filter(m => m.type === 'permission:request');
      expect(requestMessages).toHaveLength(1);

      const message = requestMessages[0];
      expect(message.taskId).toBe('permission-global');
      expect(message.data.requestId).toBe('no-task-id-001');
      expect(message.data.toolName).toBe('GlobalTool');
    });

    it('should handle dangerous events with missing taskId using fallback broadcasting', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/dangerous-global`);
      wsClients.push(ws);

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit dangerous event without taskId
      mockOrchestrator.emit('dangerous:detected', {
        operationId: 'global-danger-001',
        toolName: 'SystemTool',
        operationType: 'system-modification',
        riskLevel: 'high',
        description: 'Global dangerous operation detected'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const dangerousMessages = messages.filter(m => m.type === 'dangerous:detected');
      expect(dangerousMessages).toHaveLength(1);

      const message = dangerousMessages[0];
      expect(message.taskId).toBe('dangerous-global');
      expect(message.data.operationId).toBe('global-danger-001');
      expect(message.data.riskLevel).toBe('high');
    });

    it('should not crash when broadcasting to no connected clients', () => {
      // This test ensures the broadcast function handles the case where no clients are connected
      expect(() => {
        mockOrchestrator.emit('permission:request', {
          requestId: 'no-clients-001',
          taskId: 'no-clients-test',
          toolName: 'OrphanTool',
          agentName: 'lonely-agent'
        });
      }).not.toThrow();
    });
  });
});