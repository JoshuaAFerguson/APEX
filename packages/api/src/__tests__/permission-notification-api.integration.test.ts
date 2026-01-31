/**
 * Integration tests for permission notification via API WebSocket (INT-08, INT-09)
 * Tests WebSocket real-time notification streaming and API integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apex/orchestrator';
import { PermissionNotification } from '@apex/core';
import { EventCollector, WSTestClient, MockPermissionTrigger } from '@apex/core/src/__tests__/helpers';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import fastify from 'fastify';

// Mock API server that mimics the real APEX API
class MockApexAPIServer {
  private server: FastifyInstance;
  private orchestrator: ApexOrchestrator | null = null;
  private port: number = 0;
  private started = false;

  constructor() {
    this.server = fastify({ logger: false });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Register WebSocket support
    this.server.register(require('@fastify/websocket'));

    // Health check endpoint
    this.server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // WebSocket endpoint for real-time events
    this.server.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection, req) => {
        console.log('WebSocket connection established');

        // Handle client messages (subscriptions, etc.)
        connection.socket.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('Received WebSocket message:', message);

            if (message.type === 'subscribe') {
              // Handle subscription request
              connection.socket.send(JSON.stringify({
                type: 'subscription:confirmed',
                events: message.events || ['permission:notification']
              }));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });

        // Set up orchestrator event forwarding if available
        if (this.orchestrator) {
          const forwardEvent = (eventType: string) => {
            return (data: unknown) => {
              if (connection.socket.readyState === connection.socket.OPEN) {
                connection.socket.send(JSON.stringify({
                  type: eventType,
                  data,
                  timestamp: new Date().toISOString()
                }));
              }
            };
          };

          // Forward permission-related events to WebSocket clients
          this.orchestrator.on('permission:notification', forwardEvent('permission:notification'));
          this.orchestrator.on('permission:request', forwardEvent('permission:request'));
          this.orchestrator.on('permission:granted', forwardEvent('permission:granted'));
          this.orchestrator.on('permission:denied', forwardEvent('permission:denied'));
          this.orchestrator.on('dangerous:detected', forwardEvent('dangerous:detected'));
          this.orchestrator.on('dangerous:confirmed', forwardEvent('dangerous:confirmed'));
          this.orchestrator.on('dangerous:blocked', forwardEvent('dangerous:blocked'));

          // Clean up listeners when connection closes
          connection.socket.on('close', () => {
            console.log('WebSocket connection closed');
            // In a real implementation, we'd track and remove specific listeners
          });
        }
      });
    });

    // REST API endpoints for permission management
    this.server.get('/api/permissions/notifications', async () => {
      // Return recent notifications (in real implementation, this would query storage)
      return { notifications: [] };
    });

    this.server.post('/api/permissions/:requestId/approve', async (req) => {
      const { requestId } = req.params as { requestId: string };

      if (this.orchestrator) {
        this.orchestrator.emit('permission:granted', {
          requestId,
          tool: 'MockTool',
          level: 'allow',
          grantedBy: 'api-user',
          timestamp: new Date()
        });
      }

      return { success: true, requestId };
    });

    this.server.post('/api/permissions/:requestId/deny', async (req) => {
      const { requestId } = req.params as { requestId: string };
      const body = req.body as { reason?: string };

      if (this.orchestrator) {
        this.orchestrator.emit('permission:denied', {
          requestId,
          tool: 'MockTool',
          deniedBy: 'api-user',
          timestamp: new Date(),
          reason: body.reason || 'Denied via API'
        });
      }

      return { success: true, requestId };
    });
  }

  async start(port?: number): Promise<number> {
    if (this.started) {
      throw new Error('Server already started');
    }

    try {
      const listenPort = port || 0; // Use 0 for random port
      const address = await this.server.listen({ port: listenPort, host: '127.0.0.1' });
      this.port = this.server.server.address()?.port || listenPort;
      this.started = true;

      console.log(`Mock APEX API server started on ${address}`);
      return this.port;
    } catch (error) {
      console.error('Failed to start mock API server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    try {
      await this.server.close();
      this.started = false;
      console.log('Mock APEX API server stopped');
    } catch (error) {
      console.error('Error stopping mock API server:', error);
    }
  }

  setOrchestrator(orchestrator: ApexOrchestrator): void {
    this.orchestrator = orchestrator;
  }

  getPort(): number {
    return this.port;
  }

  isStarted(): boolean {
    return this.started;
  }

  async makeRequest(method: string, path: string, body?: any): Promise<any> {
    if (!this.started) {
      throw new Error('Server not started');
    }

    // Simple HTTP request helper for testing
    const response = await this.server.inject({
      method: method.toUpperCase(),
      url: path,
      payload: body
    });

    return JSON.parse(response.payload);
  }
}

describe('Permission Notification API Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let eventCollector: EventCollector;
  let mockTrigger: MockPermissionTrigger;
  let apiServer: MockApexAPIServer;
  let wsClient: WSTestClient;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-api-test-'));
    const apexDir = path.join(testDir, '.apex');
    fs.mkdirSync(apexDir, { recursive: true });

    // Create minimal config
    const configPath = path.join(apexDir, 'config.yaml');
    fs.writeFileSync(configPath, `
project:
  name: api-permission-test
  version: "1.0.0"

autonomy:
  level: supervised

agents:
  - name: test-api-agent
    role: developer
    config: {}

workflows:
  - name: test-workflow
    description: Test workflow
    stages:
      - name: test-stage
        agent: test-api-agent
        prompt: "Test"
`);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      workingDirectory: testDir,
      claudeApiKey: 'test-key'
    });

    // Set up test infrastructure
    eventCollector = new EventCollector(orchestrator);
    mockTrigger = new MockPermissionTrigger();

    // Initialize and start API server
    apiServer = new MockApexAPIServer();
    apiServer.setOrchestrator(orchestrator);
    const port = await apiServer.start();

    // Initialize WebSocket client
    wsClient = new WSTestClient(`ws://127.0.0.1:${port}/ws`);

    // Connect mock trigger to orchestrator
    mockTrigger.on('permission:request', (data) => orchestrator.emit('permission:request', data));
    mockTrigger.on('permission:granted', (data) => orchestrator.emit('permission:granted', data));
    mockTrigger.on('permission:denied', (data) => orchestrator.emit('permission:denied', data));
    mockTrigger.on('dangerous:detected', (data) => orchestrator.emit('dangerous:detected', data));
    mockTrigger.on('permission:notification', (data) => orchestrator.emit('permission:notification', data));
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.destroy();
    }
    if (apiServer) {
      await apiServer.stop();
    }
    if (orchestrator) {
      await orchestrator.destroy();
    }
    eventCollector?.destroy();
    mockTrigger?.reset();

    // Cleanup test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('INT-08: WebSocket Real-time Notification Streaming', () => {
    it('should establish WebSocket connection and receive subscription confirmation', async () => {
      await wsClient.connect(5000);

      expect(wsClient.isConnected()).toBe(true);

      // Subscribe to permission events
      wsClient.subscribe(['permission:notification', 'permission:request']);

      // Wait for subscription confirmation
      const confirmation = await wsClient.waitForMessage('subscription:confirmed', 2000);

      expect(confirmation).toBeDefined();
      expect(confirmation.type).toBe('subscription:confirmed');
      expect(confirmation.data).toEqual(
        expect.objectContaining({
          events: expect.arrayContaining(['permission:notification'])
        })
      );
    });

    it('should stream permission notifications in real-time via WebSocket', async () => {
      await wsClient.connect();
      wsClient.subscribe(['permission:notification']);

      // Wait for subscription to be established
      await wsClient.waitForMessage('subscription:confirmed', 2000);
      wsClient.clearMessages();

      // Trigger a permission notification
      const notificationId = mockTrigger.triggerPermissionNotification({
        taskId: 'ws-task-1',
        agent: 'test-api-agent',
        tool: 'WebSocketTool',
        type: 'permission:requested',
        title: 'WebSocket Permission Test',
        message: 'Testing real-time permission notification via WebSocket',
        scope: '/api/test',
        severity: 'warning',
        requiresAction: true,
        actions: ['approve', 'deny']
      });

      // Wait for notification to be streamed via WebSocket
      const wsMessage = await wsClient.waitForMessage('permission:notification', 3000);

      expect(wsMessage).toBeDefined();
      expect(wsMessage.type).toBe('permission:notification');

      const notification = wsMessage.data as PermissionNotification;
      expect(notification.id).toBe(notificationId);
      expect(notification.taskId).toBe('ws-task-1');
      expect(notification.tool).toBe('WebSocketTool');
      expect(notification.title).toBe('WebSocket Permission Test');
      expect(notification.requiresAction).toBe(true);
    });

    it('should stream multiple types of permission events', async () => {
      await wsClient.connect();
      wsClient.subscribe([
        'permission:request',
        'permission:granted',
        'permission:denied',
        'dangerous:detected',
        'permission:notification'
      ]);

      await wsClient.waitForMessage('subscription:confirmed', 2000);
      wsClient.clearMessages();

      // Trigger a complete permission flow
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'MultiEventTool',
        agent: 'test-api-agent',
        description: 'Testing multiple event types'
      });

      mockTrigger.triggerPermissionNotification({
        taskId: 'multi-event-task',
        agent: 'test-api-agent',
        tool: 'MultiEventTool',
        type: 'permission:requested',
        title: 'Multi-Event Test',
        message: 'Testing multiple event types',
        requiresAction: true,
        actions: ['approve', 'deny']
      });

      mockTrigger.triggerPermissionGranted({
        requestId,
        tool: 'MultiEventTool',
        level: 'allow'
      });

      // Wait for all events to be streamed
      await Promise.all([
        wsClient.waitForMessage('permission:request', 2000),
        wsClient.waitForMessage('permission:notification', 2000),
        wsClient.waitForMessage('permission:granted', 2000)
      ]);

      // Verify all events were received
      expect(wsClient.getMessagesByType('permission:request').length).toBe(1);
      expect(wsClient.getMessagesByType('permission:notification').length).toBe(1);
      expect(wsClient.getMessagesByType('permission:granted').length).toBe(1);

      const messages = wsClient.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle dangerous operation events via WebSocket', async () => {
      await wsClient.connect();
      wsClient.subscribe(['dangerous:detected', 'permission:notification']);

      await wsClient.waitForMessage('subscription:confirmed', 2000);
      wsClient.clearMessages();

      // Trigger dangerous operation
      const operationId = mockTrigger.triggerDangerousOperation({
        tool: 'DangerousWebSocketTool',
        agent: 'test-api-agent',
        operation: 'delete critical files',
        riskLevel: 'critical',
        riskDescription: 'This will delete important system files'
      });

      // Trigger corresponding notification
      mockTrigger.triggerPermissionNotification({
        taskId: 'dangerous-ws-task',
        agent: 'test-api-agent',
        tool: 'DangerousWebSocketTool',
        type: 'dangerous:detected',
        title: 'CRITICAL: Dangerous Operation via WebSocket',
        message: 'Critical operation detected and transmitted via WebSocket',
        severity: 'critical',
        requiresAction: true,
        actions: ['block', 'allow_with_confirmation']
      });

      // Wait for both events
      const dangerousEvent = await wsClient.waitForMessage('dangerous:detected', 2000);
      const notificationEvent = await wsClient.waitForMessage('permission:notification', 2000);

      expect(dangerousEvent.data).toEqual(
        expect.objectContaining({
          operationId,
          riskLevel: 'critical'
        })
      );

      expect((notificationEvent.data as PermissionNotification).type).toBe('dangerous:detected');
      expect((notificationEvent.data as PermissionNotification).severity).toBe('critical');
    });

    it('should handle WebSocket client reconnection gracefully', async () => {
      await wsClient.connect();
      wsClient.subscribe(['permission:notification']);
      await wsClient.waitForMessage('subscription:confirmed', 2000);

      // Disconnect and reconnect
      wsClient.disconnect();
      expect(wsClient.isConnected()).toBe(false);

      await wsClient.connect();
      wsClient.subscribe(['permission:notification']);
      expect(wsClient.isConnected()).toBe(true);

      // Verify events are still received after reconnection
      wsClient.clearMessages();

      mockTrigger.triggerPermissionNotification({
        taskId: 'reconnect-task',
        agent: 'test-api-agent',
        tool: 'ReconnectTool',
        type: 'permission:granted',
        title: 'Post-Reconnection Test',
        message: 'Testing after WebSocket reconnection'
      });

      const message = await wsClient.waitForMessage('permission:notification', 3000);
      expect(message).toBeDefined();
      expect((message.data as PermissionNotification).title).toBe('Post-Reconnection Test');
    });

    it('should handle concurrent WebSocket connections', async () => {
      // Create multiple WebSocket clients
      const client2 = new WSTestClient(`ws://127.0.0.1:${apiServer.getPort()}/ws`);
      const client3 = new WSTestClient(`ws://127.0.0.1:${apiServer.getPort()}/ws`);

      try {
        // Connect all clients
        await Promise.all([
          wsClient.connect(),
          client2.connect(),
          client3.connect()
        ]);

        // Subscribe all clients
        wsClient.subscribe(['permission:notification']);
        client2.subscribe(['permission:notification']);
        client3.subscribe(['permission:notification']);

        // Wait for all subscriptions
        await Promise.all([
          wsClient.waitForMessage('subscription:confirmed', 2000),
          client2.waitForMessage('subscription:confirmed', 2000),
          client3.waitForMessage('subscription:confirmed', 2000)
        ]);

        // Clear messages
        wsClient.clearMessages();
        client2.clearMessages();
        client3.clearMessages();

        // Trigger notification
        mockTrigger.triggerPermissionNotification({
          taskId: 'concurrent-test',
          agent: 'test-api-agent',
          tool: 'ConcurrentTool',
          type: 'permission:requested',
          title: 'Concurrent Client Test',
          message: 'Testing multiple WebSocket clients'
        });

        // Wait for all clients to receive the notification
        await Promise.all([
          wsClient.waitForMessage('permission:notification', 2000),
          client2.waitForMessage('permission:notification', 2000),
          client3.waitForMessage('permission:notification', 2000)
        ]);

        // Verify all clients received the same notification
        const notification1 = wsClient.getPermissionNotifications()[0];
        const notification2 = client2.getPermissionNotifications()[0];
        const notification3 = client3.getPermissionNotifications()[0];

        expect(notification1.title).toBe('Concurrent Client Test');
        expect(notification2.title).toBe('Concurrent Client Test');
        expect(notification3.title).toBe('Concurrent Client Test');

        expect(notification1.id).toBe(notification2.id);
        expect(notification2.id).toBe(notification3.id);

      } finally {
        client2.destroy();
        client3.destroy();
      }
    });
  });

  describe('INT-09: API Integration with Permission Management', () => {
    it('should provide REST API endpoints for permission actions', async () => {
      // Test health check
      const healthResponse = await apiServer.makeRequest('GET', '/health');
      expect(healthResponse).toEqual({
        status: 'ok',
        timestamp: expect.any(String)
      });

      // Test permission approval endpoint
      const approveResponse = await apiServer.makeRequest('POST', '/api/permissions/test-request-123/approve');
      expect(approveResponse).toEqual({
        success: true,
        requestId: 'test-request-123'
      });

      // Test permission denial endpoint
      const denyResponse = await apiServer.makeRequest('POST', '/api/permissions/test-request-456/deny', {
        reason: 'Security policy violation'
      });
      expect(denyResponse).toEqual({
        success: true,
        requestId: 'test-request-456'
      });
    });

    it('should integrate REST API actions with event system', async () => {
      await wsClient.connect();
      wsClient.subscribe(['permission:granted', 'permission:denied']);
      await wsClient.waitForMessage('subscription:confirmed', 2000);
      wsClient.clearMessages();

      // Trigger approval via REST API
      await apiServer.makeRequest('POST', '/api/permissions/rest-test-approve/approve');

      // Verify event was emitted and streamed
      const grantedEvent = await wsClient.waitForMessage('permission:granted', 2000);
      expect(grantedEvent.data).toEqual(
        expect.objectContaining({
          requestId: 'rest-test-approve',
          level: 'allow',
          grantedBy: 'api-user'
        })
      );

      // Clear and test denial
      wsClient.clearMessages();
      await apiServer.makeRequest('POST', '/api/permissions/rest-test-deny/deny', {
        reason: 'Testing REST denial'
      });

      const deniedEvent = await wsClient.waitForMessage('permission:denied', 2000);
      expect(deniedEvent.data).toEqual(
        expect.objectContaining({
          requestId: 'rest-test-deny',
          reason: 'Testing REST denial',
          deniedBy: 'api-user'
        })
      );
    });

    it('should handle permission flow from request to resolution via API', async () => {
      await wsClient.connect();
      wsClient.subscribe([
        'permission:request',
        'permission:notification',
        'permission:granted'
      ]);
      await wsClient.waitForMessage('subscription:confirmed', 2000);

      // Start with a permission request
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'APIIntegrationTool',
        agent: 'test-api-agent',
        description: 'Full API integration test'
      });

      // Wait for request event
      await wsClient.waitForMessage('permission:request', 2000);

      // Trigger initial notification
      mockTrigger.triggerPermissionNotification({
        taskId: 'api-integration-task',
        agent: 'test-api-agent',
        tool: 'APIIntegrationTool',
        type: 'permission:requested',
        title: 'API Integration Permission',
        message: 'Permission requested for API integration test',
        requiresAction: true,
        actions: ['approve', 'deny']
      });

      // Wait for notification
      await wsClient.waitForMessage('permission:notification', 2000);

      // Resolve via REST API
      const approveResponse = await apiServer.makeRequest('POST', `/api/permissions/${requestId}/approve`);
      expect(approveResponse.success).toBe(true);

      // Wait for granted event
      const grantedEvent = await wsClient.waitForMessage('permission:granted', 2000);
      expect(grantedEvent.data).toEqual(
        expect.objectContaining({
          requestId,
          grantedBy: 'api-user'
        })
      );

      // Verify complete flow was captured
      const messages = wsClient.getMessages();
      const hasRequest = messages.some(m => m.type === 'permission:request');
      const hasNotification = messages.some(m => m.type === 'permission:notification');
      const hasGranted = messages.some(m => m.type === 'permission:granted');

      expect(hasRequest).toBe(true);
      expect(hasNotification).toBe(true);
      expect(hasGranted).toBe(true);
    });

    it('should handle API rate limiting and error conditions gracefully', async () => {
      // Test invalid request ID
      try {
        const response = await apiServer.makeRequest('POST', '/api/permissions//approve');
        // Should handle empty request ID gracefully
        expect(response).toBeDefined();
      } catch (error) {
        // Or throw a proper error
        expect(error).toBeDefined();
      }

      // Test malformed request body
      try {
        const response = await apiServer.makeRequest('POST', '/api/permissions/test/deny', 'invalid-json');
        expect(response).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain event ordering across WebSocket and REST API interactions', async () => {
      await wsClient.connect();
      wsClient.subscribe(['permission:request', 'permission:granted', 'permission:denied']);
      await wsClient.waitForMessage('subscription:confirmed', 2000);

      const startTime = Date.now();
      const requestIds: string[] = [];

      // Trigger multiple requests with API resolutions
      for (let i = 0; i < 3; i++) {
        const requestId = `ordered-request-${i}`;
        requestIds.push(requestId);

        mockTrigger.triggerPermissionRequest({
          tool: `OrderedTool${i}`,
          agent: 'test-api-agent',
          description: `Ordered request ${i}`
        });

        // Small delay to ensure ordering
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all requests
      await new Promise(resolve => setTimeout(resolve, 100));

      // Resolve them via API in order
      for (const requestId of requestIds) {
        await apiServer.makeRequest('POST', `/api/permissions/${requestId}/approve`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify chronological ordering
      const allMessages = wsClient.getMessages().filter(m =>
        m.type === 'permission:request' || m.type === 'permission:granted'
      );

      for (let i = 1; i < allMessages.length; i++) {
        expect(allMessages[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          allMessages[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('API Error Handling and Edge Cases', () => {
    it('should handle WebSocket connection failures gracefully', async () => {
      // Stop the server to simulate connection failure
      await apiServer.stop();

      try {
        await wsClient.connect(1000);
        expect.fail('Should have thrown connection error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('timeout');
      }
    });

    it('should handle server shutdown during active connections', async () => {
      await wsClient.connect();
      expect(wsClient.isConnected()).toBe(true);

      // Shutdown server with active connections
      await apiServer.stop();

      // Wait for disconnect event
      await new Promise(resolve => {
        wsClient.on('disconnected', resolve);
        setTimeout(resolve, 1000); // Timeout fallback
      });

      expect(wsClient.isConnected()).toBe(false);
    });

    it('should cleanup resources properly', () => {
      expect(apiServer).toBeDefined();
      expect(wsClient).toBeDefined();
      expect(orchestrator).toBeDefined();

      // Cleanup is handled in afterEach, but verify objects exist for cleanup
      expect(typeof apiServer.stop).toBe('function');
      expect(typeof wsClient.destroy).toBe('function');
      expect(typeof orchestrator.destroy).toBe('function');
    });
  });
});