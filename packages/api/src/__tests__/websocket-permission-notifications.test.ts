import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { EventEmitter } from 'eventemitter3';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

/**
 * Test suite for WebSocket permission notification broadcasting
 *
 * This verifies that:
 * 1. API/WebSocket clients receive real-time permission updates
 * 2. Notification content is accurate and actionable
 * 3. WebSocket broadcasting works correctly for multiple clients
 * 4. Permission events are properly serialized for WebSocket transmission
 */
describe('WebSocket Permission Notifications', () => {
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
        websocketFastify.get('/ws', { websocket: true }, (connection: any) => {
          const ws = connection.socket;
          wsClients.push(ws);

          // Listen for permission events from orchestrator and broadcast
          const handlePermissionRequest = (event: any) => {
            ws.send(JSON.stringify({
              type: 'permission:request',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handlePermissionGranted = (event: any) => {
            ws.send(JSON.stringify({
              type: 'permission:granted',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handlePermissionDenied = (event: any) => {
            ws.send(JSON.stringify({
              type: 'permission:denied',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handleDangerousDetected = (event: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:detected',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handleDangerousConfirmed = (event: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:confirmed',
              timestamp: new Date().toISOString(),
              data: event
            }));
          };

          const handleDangerousBlocked = (event: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:blocked',
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

  describe('Real-time Permission Update Broadcasting', () => {
    it('should broadcast permission request events to WebSocket clients', async () => {
      // Connect WebSocket client
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Wait for connection
      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit permission request event
      const requestEvent = {
        taskId: 'websocket-test-123',
        toolName: 'Write',
        timestamp: new Date(),
        scope: '/project/src/component.tsx',
        reason: 'Need to create new React component',
        agentName: 'developer'
      };

      mockOrchestrator.emit('permission:request', requestEvent);

      // Wait for message to be received
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('permission:request');
      expect(messages[0].data.taskId).toBe('websocket-test-123');
      expect(messages[0].data.toolName).toBe('Write');
      expect(messages[0].data.scope).toBe('/project/src/component.tsx');
      expect(messages[0].data.reason).toBe('Need to create new React component');
      expect(messages[0].data.agentName).toBe('developer');

      ws.close();
    });

    it('should broadcast permission granted events with correct serialization', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const grantedEvent = {
        taskId: 'websocket-granted-456',
        toolName: 'Edit',
        timestamp: new Date(),
        level: 'allow-once' as const,
        grantedBy: 'user',
        grantReason: 'Approved for component update'
      };

      mockOrchestrator.emit('permission:granted', grantedEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('permission:granted');
      expect(messages[0].data.taskId).toBe('websocket-granted-456');
      expect(messages[0].data.level).toBe('allow-once');
      expect(messages[0].data.grantedBy).toBe('user');
      expect(messages[0].data.grantReason).toBe('Approved for component update');

      ws.close();
    });

    it('should broadcast permission denied events with accurate information', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const deniedEvent = {
        taskId: 'websocket-denied-789',
        toolName: 'Bash',
        timestamp: new Date(),
        denialReason: 'Tool not allowed in read-only mode',
        deniedBy: 'system'
      };

      mockOrchestrator.emit('permission:denied', deniedEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('permission:denied');
      expect(messages[0].data.taskId).toBe('websocket-denied-789');
      expect(messages[0].data.toolName).toBe('Bash');
      expect(messages[0].data.denialReason).toBe('Tool not allowed in read-only mode');
      expect(messages[0].data.deniedBy).toBe('system');

      ws.close();
    });
  });

  describe('Dangerous Operation Notifications via WebSocket', () => {
    it('should broadcast dangerous operation detection events', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const dangerousEvent = {
        taskId: 'websocket-dangerous-123',
        toolName: 'Bash',
        timestamp: new Date(),
        operationType: 'file-deletion',
        riskLevel: 'high' as const,
        description: 'Attempting to delete critical system files',
        metadata: { command: 'rm -rf /etc/*' }
      };

      mockOrchestrator.emit('dangerous:detected', dangerousEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('dangerous:detected');
      expect(messages[0].data.operationType).toBe('file-deletion');
      expect(messages[0].data.riskLevel).toBe('high');
      expect(messages[0].data.description).toBe('Attempting to delete critical system files');
      expect(messages[0].data.metadata.command).toBe('rm -rf /etc/*');

      ws.close();
    });

    it('should broadcast dangerous operation confirmation and blocking events', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Test confirmation event
      mockOrchestrator.emit('dangerous:confirmed', {
        taskId: 'websocket-confirmed-456',
        toolName: 'Bash',
        timestamp: new Date(),
        operationType: 'privilege-escalation',
        confirmedBy: 'admin',
        confirmation: 'Admin approved sudo access for deployment'
      });

      // Test blocking event
      mockOrchestrator.emit('dangerous:blocked', {
        taskId: 'websocket-blocked-789',
        toolName: 'Write',
        timestamp: new Date(),
        operationType: 'data-modification',
        blockReason: 'Operation exceeds safety threshold',
        blockedBy: 'safety-system'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(2);

      // Verify confirmation event
      const confirmEvent = messages.find(m => m.type === 'dangerous:confirmed');
      expect(confirmEvent.data.confirmedBy).toBe('admin');
      expect(confirmEvent.data.confirmation).toBe('Admin approved sudo access for deployment');

      // Verify blocking event
      const blockEvent = messages.find(m => m.type === 'dangerous:blocked');
      expect(blockEvent.data.blockReason).toBe('Operation exceeds safety threshold');
      expect(blockEvent.data.blockedBy).toBe('safety-system');

      ws.close();
    });
  });

  describe('Multiple Client Broadcasting', () => {
    it('should broadcast permission events to multiple WebSocket clients simultaneously', async () => {
      // Connect multiple WebSocket clients
      const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
      const ws3 = new WebSocket(`ws://localhost:${port}/ws`);

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
        taskId: 'multicast-test-123',
        toolName: 'MultiTool',
        timestamp: new Date(),
        level: 'allow-always' as const,
        grantedBy: 'system'
      };

      mockOrchestrator.emit('permission:granted', multicastEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      // All clients should receive the same event
      expect(messages1).toHaveLength(1);
      expect(messages2).toHaveLength(1);
      expect(messages3).toHaveLength(1);

      expect(messages1[0].data.taskId).toBe('multicast-test-123');
      expect(messages2[0].data.taskId).toBe('multicast-test-123');
      expect(messages3[0].data.taskId).toBe('multicast-test-123');

      ws1.close();
      ws2.close();
      ws3.close();
    });

    it('should handle client disconnections gracefully without affecting other clients', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws`);

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
      mockOrchestrator.emit('permission:request', {
        taskId: 'disconnect-test-123',
        toolName: 'Test',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages1).toHaveLength(0); // Closed client receives nothing
      expect(messages2).toHaveLength(1); // Active client receives event

      ws2.close();
    });
  });

  describe('WebSocket Message Format and Serialization', () => {
    it('should properly serialize timestamps in WebSocket messages', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const testTimestamp = new Date('2024-01-15T10:30:00.123Z');
      mockOrchestrator.emit('permission:request', {
        taskId: 'timestamp-test',
        toolName: 'Test',
        timestamp: testTimestamp
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].data.timestamp).toBe(testTimestamp.toISOString());
      expect(typeof messages[0].timestamp).toBe('string'); // Message timestamp should be string

      ws.close();
    });

    it('should handle complex metadata objects in dangerous operation events', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      const complexMetadata = {
        command: 'rm -rf /tmp/*',
        flags: ['--force', '--recursive'],
        targetPaths: ['/tmp/file1', '/tmp/file2'],
        estimatedFiles: 1250,
        riskFactors: ['system-directory', 'bulk-deletion', 'no-confirmation']
      };

      mockOrchestrator.emit('dangerous:detected', {
        taskId: 'complex-metadata-test',
        toolName: 'Bash',
        timestamp: new Date(),
        operationType: 'file-deletion',
        riskLevel: 'high' as const,
        description: 'Bulk file deletion detected',
        metadata: complexMetadata
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].data.metadata).toEqual(complexMetadata);
      expect(messages[0].data.metadata.estimatedFiles).toBe(1250);
      expect(messages[0].data.metadata.riskFactors).toContain('bulk-deletion');

      ws.close();
    });
  });

  describe('Error Handling and Connection Management', () => {
    it('should not crash when emitting events with no connected clients', () => {
      // Emit events without any WebSocket clients connected
      expect(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'no-clients-test',
          toolName: 'Test',
          timestamp: new Date()
        });

        mockOrchestrator.emit('permission:granted', {
          taskId: 'no-clients-test',
          toolName: 'Test',
          timestamp: new Date(),
          level: 'allow-once' as const,
          grantedBy: 'system'
        });
      }).not.toThrow();
    });

    it('should handle malformed event data gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: any[] = [];
      const errors: any[] = [];

      ws.on('message', (data) => {
        try {
          messages.push(JSON.parse(data.toString()));
        } catch (e) {
          errors.push(e);
        }
      });

      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Emit event with invalid data
      mockOrchestrator.emit('permission:request', {
        // Missing required fields
        invalidField: 'test'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still attempt to send message (even if malformed)
      // The error handling is client-side responsibility
      expect(errors).toHaveLength(0); // No JSON parsing errors
      expect(messages).toHaveLength(1); // Message was sent

      ws.close();
    });
  });
});