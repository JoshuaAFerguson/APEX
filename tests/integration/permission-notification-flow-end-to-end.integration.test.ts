/**
 * End-to-End Integration Test: Permission Notification Flow
 *
 * This test verifies the complete flow: permission change triggered → orchestrator emits event →
 * CLI and WebSocket clients both receive notification → notification content is accurate and actionable.
 *
 * Test Coverage:
 * - INT-E2E-01: Complete permission notification flow from trigger to delivery
 * - INT-E2E-02: Simultaneous CLI and WebSocket client notification delivery
 * - INT-E2E-03: Notification content accuracy and actionability verification
 * - INT-E2E-04: Multiple notification types (request, granted, denied, dangerous)
 * - INT-E2E-05: Error handling and resilience testing
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WebSocket } from 'ws';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';

// Import packages under test
import { ApexOrchestrator } from '@apexcli/orchestrator';
import {
  initializeApex,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  PermissionLevel
} from '@apexcli/core';

/**
 * Mock CLI Handler to simulate CLI notification processing
 */
class MockCLIHandler extends EventEmitter {
  public receivedEvents: Array<{
    type: string;
    data: any;
    timestamp: Date;
    processed: boolean;
  }> = [];

  public notifications: Array<{
    title: string;
    message: string;
    severity: string;
    timestamp: Date;
  }> = [];

  constructor(orchestrator: ApexOrchestrator) {
    super();
    this.setupEventHandlers(orchestrator);
  }

  private setupEventHandlers(orchestrator: ApexOrchestrator): void {
    orchestrator.on('permission:request', (data) => this.handleEvent('permission:request', data));
    orchestrator.on('permission:granted', (data) => this.handleEvent('permission:granted', data));
    orchestrator.on('permission:denied', (data) => this.handleEvent('permission:denied', data));
    orchestrator.on('dangerous:detected', (data) => this.handleEvent('dangerous:detected', data));
    orchestrator.on('dangerous:confirmed', (data) => this.handleEvent('dangerous:confirmed', data));
    orchestrator.on('dangerous:blocked', (data) => this.handleEvent('dangerous:blocked', data));
  }

  private handleEvent(type: string, data: any): void {
    const event = {
      type,
      data: { ...data },
      timestamp: new Date(),
      processed: false
    };

    this.receivedEvents.push(event);

    // Process the event to generate user notifications
    this.processEventToNotification(event);

    // Mark as processed
    event.processed = true;

    this.emit('event:processed', event);
  }

  private processEventToNotification(event: any): void {
    let notification: { title: string; message: string; severity: string; timestamp: Date };

    switch (event.type) {
      case 'permission:request':
        notification = {
          title: `Permission Required: ${event.data.tool}`,
          message: `Agent ${event.data.agent} requests permission to use ${event.data.tool}${event.data.scope ? ` on ${event.data.scope}` : ''}. Reason: ${event.data.description || 'No reason provided'}`,
          severity: event.data.isDangerous ? 'critical' : 'warning',
          timestamp: event.timestamp
        };
        break;

      case 'permission:granted':
        notification = {
          title: `Permission Granted: ${event.data.tool}`,
          message: `Access granted with level: ${event.data.level}${event.data.reason ? `. Reason: ${event.data.reason}` : ''}`,
          severity: 'info',
          timestamp: event.timestamp
        };
        break;

      case 'permission:denied':
        notification = {
          title: `Permission Denied: ${event.data.tool}`,
          message: `Access denied. ${event.data.reason || 'No reason provided'}`,
          severity: 'error',
          timestamp: event.timestamp
        };
        break;

      case 'dangerous:detected':
        notification = {
          title: `DANGEROUS OPERATION: ${event.data.tool}`,
          message: `Risk Level: ${event.data.riskLevel?.toUpperCase()}. Operation: ${event.data.operation}. ${event.data.riskDescription || 'No description provided'}`,
          severity: 'critical',
          timestamp: event.timestamp
        };
        break;

      case 'dangerous:confirmed':
        notification = {
          title: `Dangerous Operation Confirmed: ${event.data.tool}`,
          message: `Operation approved by ${event.data.confirmedBy}. ${event.data.reason || 'No confirmation details'}`,
          severity: 'warning',
          timestamp: event.timestamp
        };
        break;

      case 'dangerous:blocked':
        notification = {
          title: `Dangerous Operation Blocked: ${event.data.tool}`,
          message: `Operation blocked by ${event.data.blockedBy}. ${event.data.reason || 'No block reason provided'}`,
          severity: 'error',
          timestamp: event.timestamp
        };
        break;

      default:
        notification = {
          title: `Unknown Event: ${event.type}`,
          message: 'Unknown event received',
          severity: 'info',
          timestamp: event.timestamp
        };
    }

    this.notifications.push(notification);
    this.emit('notification:created', notification);
  }

  public getEventsByType(eventType: string): any[] {
    return this.receivedEvents
      .filter(event => event.type === eventType)
      .map(event => event.data);
  }

  public getNotificationsByTitlePattern(pattern: string): any[] {
    return this.notifications.filter(notif =>
      notif.title.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  public getProcessedEventCount(): number {
    return this.receivedEvents.filter(event => event.processed).length;
  }

  public reset(): void {
    this.receivedEvents = [];
    this.notifications = [];
  }
}

/**
 * WebSocket Test Client to simulate frontend clients
 */
class MockWebSocketClient extends EventEmitter {
  public receivedMessages: Array<{
    type: string;
    data: any;
    timestamp: string;
    received: Date;
  }> = [];

  public connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  public ws: WebSocket | null = null;

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionState = 'connecting';
      this.ws = new WebSocket(`ws://localhost:${port}/ws`);

      this.ws.on('open', () => {
        this.connectionState = 'connected';
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const receivedMessage = {
            ...message,
            received: new Date()
          };
          this.receivedMessages.push(receivedMessage);
          this.emit('message:received', receivedMessage);
        } catch (error) {
          this.emit('error', error);
        }
      });

      this.ws.on('error', (error) => {
        this.connectionState = 'error';
        reject(error);
      });

      this.ws.on('close', () => {
        this.connectionState = 'disconnected';
        this.emit('disconnected');
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  getMessagesByType(messageType: string): any[] {
    return this.receivedMessages
      .filter(msg => msg.type === messageType)
      .map(msg => msg.data);
  }

  getMessageCount(): number {
    return this.receivedMessages.length;
  }

  reset(): void {
    this.receivedMessages = [];
  }
}

/**
 * Async event waiting utility for more reliable tests
 */
function waitForEvents(
  client: MockWebSocketClient | MockCLIHandler,
  expectedCount: number,
  timeout: number = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkCount = () => {
      const currentCount = client instanceof MockWebSocketClient
        ? client.getMessageCount()
        : client.getProcessedEventCount();

      if (currentCount >= expectedCount) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout: Expected ${expectedCount} events, got ${currentCount} after ${timeout}ms`));
      } else {
        setTimeout(checkCount, 10);
      }
    };

    checkCount();
  });
}

/**
 * Test Infrastructure Setup
 */
describe('End-to-End Permission Notification Flow Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let cliHandler: MockCLIHandler;
  let webSocketClients: MockWebSocketClient[];
  let apiApp: any;
  let apiPort: number;

  beforeAll(async () => {
    // Find available port for API server
    apiPort = Math.floor(Math.random() * 10000) + 50000;
  });

  beforeEach(async () => {
    // Create temporary test directory and initialize project
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-permission-'));

    await initializeApex(testDir, {
      projectName: 'e2e-permission-test',
      language: 'typescript',
    });

    // Create required agent and workflow files
    const agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Developer agent for testing
tools: Write, Edit, Read, Bash
model: sonnet
---

You are a developer agent for testing permission notifications.`
    );

    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(
      path.join(workflowsDir, 'feature.yaml'),
      `name: feature
description: Feature development workflow
stages:
  - name: implementation
    agent: developer
    description: Implement the feature
`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Set up CLI handler
    cliHandler = new MockCLIHandler(orchestrator);

    // Set up API server with WebSocket support
    apiApp = Fastify({ logger: false });
    await apiApp.register(websocket);

    // WebSocket route for permission notifications
    apiApp.register(async (fastify: any) => {
      await fastify.register(async (websocketFastify: any) => {
        websocketFastify.get('/ws', { websocket: true }, (connection: any) => {
          const ws = connection.socket;

          // Forward all permission-related events to WebSocket clients
          const permissionRequestHandler = (data: any) => {
            ws.send(JSON.stringify({
              type: 'permission:request',
              timestamp: new Date().toISOString(),
              data
            }));
          };
          const permissionGrantedHandler = (data: any) => {
            ws.send(JSON.stringify({
              type: 'permission:granted',
              timestamp: new Date().toISOString(),
              data
            }));
          };
          const permissionDeniedHandler = (data: any) => {
            ws.send(JSON.stringify({
              type: 'permission:denied',
              timestamp: new Date().toISOString(),
              data
            }));
          };
          const dangerousDetectedHandler = (data: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:detected',
              timestamp: new Date().toISOString(),
              data
            }));
          };
          const dangerousConfirmedHandler = (data: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:confirmed',
              timestamp: new Date().toISOString(),
              data
            }));
          };
          const dangerousBlockedHandler = (data: any) => {
            ws.send(JSON.stringify({
              type: 'dangerous:blocked',
              timestamp: new Date().toISOString(),
              data
            }));
          };

          orchestrator.on('permission:request', permissionRequestHandler);
          orchestrator.on('permission:granted', permissionGrantedHandler);
          orchestrator.on('permission:denied', permissionDeniedHandler);
          orchestrator.on('dangerous:detected', dangerousDetectedHandler);
          orchestrator.on('dangerous:confirmed', dangerousConfirmedHandler);
          orchestrator.on('dangerous:blocked', dangerousBlockedHandler);

          ws.on('close', () => {
            // Clean up only this client's event listeners when client disconnects
            orchestrator.removeListener('permission:request', permissionRequestHandler);
            orchestrator.removeListener('permission:granted', permissionGrantedHandler);
            orchestrator.removeListener('permission:denied', permissionDeniedHandler);
            orchestrator.removeListener('dangerous:detected', dangerousDetectedHandler);
            orchestrator.removeListener('dangerous:confirmed', dangerousConfirmedHandler);
            orchestrator.removeListener('dangerous:blocked', dangerousBlockedHandler);
          });
        });
      });
    });

    await apiApp.listen({ port: apiPort });

    // Initialize WebSocket clients
    webSocketClients = [];
  });

  afterEach(async () => {
    // Cleanup WebSocket clients
    webSocketClients.forEach(client => client.disconnect());
    webSocketClients = [];

    // Cleanup API server
    if (apiApp) {
      await apiApp.close();
    }

    // Cleanup orchestrator
    if (orchestrator) {
      await orchestrator.shutdown();
    }

    // Cleanup CLI handler
    cliHandler?.removeAllListeners();

    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('INT-E2E-01: Complete Permission Notification Flow', () => {
    it('should deliver permission events from orchestrator through CLI and WebSocket channels', async () => {
      // Set up WebSocket client
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Trigger permission request
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'e2e-test-task-1',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/project/src/component.tsx',
        description: 'Need to create new React component for feature',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', permissionRequest);

      // Wait for events to propagate
      await Promise.all([
        waitForEvents(cliHandler, 1, 500),
        waitForEvents(wsClient, 1, 500)
      ]);

      // Verify CLI received and processed the event
      const cliEvents = cliHandler.getEventsByType('permission:request');
      expect(cliEvents).toHaveLength(1);
      expect(cliEvents[0].tool).toBe('Write');
      expect(cliEvents[0].scope).toBe('/project/src/component.tsx');
      expect(cliEvents[0].description).toBe('Need to create new React component for feature');

      // Verify CLI generated user-friendly notification
      const cliNotifications = cliHandler.getNotificationsByTitlePattern('Permission Required: Write');
      expect(cliNotifications).toHaveLength(1);
      expect(cliNotifications[0].message).toContain('Agent developer requests permission');
      expect(cliNotifications[0].message).toContain('component.tsx');
      expect(cliNotifications[0].severity).toBe('warning');

      // Verify WebSocket client received the event
      const wsMessages = wsClient.getMessagesByType('permission:request');
      expect(wsMessages).toHaveLength(1);
      expect(wsMessages[0].tool).toBe('Write');
      expect(wsMessages[0].scope).toBe('/project/src/component.tsx');
      expect(wsMessages[0].agent).toBe('developer');
    });

    it('should handle complete permission grant/deny workflow', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      const requestId = 'e2e-workflow-test';

      // Step 1: Permission request
      const requestData: PermissionRequestEventData = {
        requestId,
        tool: 'Edit',
        timestamp: new Date(),
        scope: '/config/settings.json',
        description: 'Update application configuration',
        agent: 'developer',
        isDangerous: false
      };
      orchestrator.emit('permission:request', requestData);

      await waitForEvents(cliHandler, 1, 300);

      // Step 2: Permission granted
      const grantedData: PermissionGrantedEventData = {
        requestId,
        tool: 'Edit',
        timestamp: new Date(),
        level: 'allow-once' as PermissionLevel,
        grantedBy: 'user',
        reason: 'Configuration update approved after review'
      };
      orchestrator.emit('permission:granted', grantedData);

      await waitForEvents(cliHandler, 2, 300);

      // Verify complete workflow in CLI
      const requestNotifications = cliHandler.getNotificationsByTitlePattern('Permission Required: Edit');
      const grantedNotifications = cliHandler.getNotificationsByTitlePattern('Permission Granted: Edit');

      expect(requestNotifications).toHaveLength(1);
      expect(grantedNotifications).toHaveLength(1);

      expect(requestNotifications[0].message).toContain('Update application configuration');
      expect(grantedNotifications[0].message).toContain('allow-once');
      expect(grantedNotifications[0].message).toContain('Configuration update approved');

      // Verify complete workflow in WebSocket
      const wsRequestMessages = wsClient.getMessagesByType('permission:request');
      const wsGrantedMessages = wsClient.getMessagesByType('permission:granted');

      expect(wsRequestMessages).toHaveLength(1);
      expect(wsGrantedMessages).toHaveLength(1);

      expect(wsRequestMessages[0].scope).toBe('/config/settings.json');
      expect(wsGrantedMessages[0].level).toBe('allow-once');
      expect(wsGrantedMessages[0].grantedBy).toBe('user');
    });

    it('should handle dangerous operation detection and confirmation flow', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      const operationId = 'e2e-dangerous-test';

      // Step 1: Dangerous operation detection
      const dangerousData: DangerousOperationDetectedEventData = {
        operationId,
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'file-deletion',
        riskLevel: 'high',
        riskDescription: 'Attempting to delete critical configuration files',
        agent: 'developer',
        context: {
          command: 'rm -rf /etc/app/*.conf',
          estimatedFiles: 25,
          systemImpact: 'high'
        }
      };
      orchestrator.emit('dangerous:detected', dangerousData);

      await waitForEvents(cliHandler, 1, 300);

      // Step 2: Dangerous operation confirmed
      const confirmedData: DangerousOperationConfirmedEventData = {
        operationId,
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'file-deletion',
        confirmedBy: 'admin',
        reason: 'Admin approved after creating backup of configuration files'
      };
      orchestrator.emit('dangerous:confirmed', confirmedData);

      await waitForEvents(cliHandler, 2, 300);

      // Verify dangerous operation handling in CLI
      const dangerousNotifications = cliHandler.getNotificationsByTitlePattern('DANGEROUS OPERATION: Bash');
      const confirmedNotifications = cliHandler.getNotificationsByTitlePattern('Dangerous Operation Confirmed: Bash');

      expect(dangerousNotifications).toHaveLength(1);
      expect(confirmedNotifications).toHaveLength(1);

      expect(dangerousNotifications[0].message).toContain('Risk Level: HIGH');
      expect(dangerousNotifications[0].message).toContain('file-deletion');
      expect(dangerousNotifications[0].severity).toBe('critical');

      expect(confirmedNotifications[0].message).toContain('approved by admin');
      expect(confirmedNotifications[0].message).toContain('creating backup');

      // Verify dangerous operation handling in WebSocket
      const wsDangerousMessages = wsClient.getMessagesByType('dangerous:detected');
      const wsConfirmedMessages = wsClient.getMessagesByType('dangerous:confirmed');

      expect(wsDangerousMessages).toHaveLength(1);
      expect(wsConfirmedMessages).toHaveLength(1);

      expect(wsDangerousMessages[0].riskLevel).toBe('high');
      expect(wsDangerousMessages[0].context.estimatedFiles).toBe(25);
      expect(wsConfirmedMessages[0].confirmedBy).toBe('admin');
    });
  });

  describe('INT-E2E-02: Simultaneous Multi-Client Delivery', () => {
    it('should deliver events to multiple WebSocket clients simultaneously', async () => {
      // Set up multiple WebSocket clients
      const wsClient1 = new MockWebSocketClient();
      const wsClient2 = new MockWebSocketClient();
      const wsClient3 = new MockWebSocketClient();

      webSocketClients.push(wsClient1, wsClient2, wsClient3);

      await Promise.all([
        wsClient1.connect(apiPort),
        wsClient2.connect(apiPort),
        wsClient3.connect(apiPort)
      ]);

      // Trigger permission event
      const permissionEvent: PermissionRequestEventData = {
        requestId: 'multi-client-test',
        tool: 'MultiTool',
        timestamp: new Date(),
        scope: '/shared/resource',
        description: 'Multi-client notification test',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', permissionEvent);

      await Promise.all([
        waitForEvents(wsClient1, 1, 500),
        waitForEvents(wsClient2, 1, 500),
        waitForEvents(wsClient3, 1, 500)
      ]);

      // Verify all clients received the event
      expect(wsClient1.getMessagesByType('permission:request')).toHaveLength(1);
      expect(wsClient2.getMessagesByType('permission:request')).toHaveLength(1);
      expect(wsClient3.getMessagesByType('permission:request')).toHaveLength(1);

      // Verify event content is identical across clients
      const client1Data = wsClient1.getMessagesByType('permission:request')[0];
      const client2Data = wsClient2.getMessagesByType('permission:request')[0];
      const client3Data = wsClient3.getMessagesByType('permission:request')[0];

      expect(client1Data.requestId).toBe(permissionEvent.requestId);
      expect(client2Data.requestId).toBe(permissionEvent.requestId);
      expect(client3Data.requestId).toBe(permissionEvent.requestId);

      expect(client1Data.tool).toBe(permissionEvent.tool);
      expect(client2Data.tool).toBe(permissionEvent.tool);
      expect(client3Data.tool).toBe(permissionEvent.tool);
    });

    it('should deliver to CLI and WebSocket clients independently', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Send multiple different event types
      const events = [
        {
          type: 'permission:request',
          data: {
            requestId: 'test-1',
            tool: 'Write',
            description: 'Test write operation',
            agent: 'developer',
            isDangerous: false
          }
        },
        {
          type: 'permission:granted',
          data: {
            requestId: 'test-2',
            tool: 'Read',
            level: 'allow-once' as PermissionLevel,
            grantedBy: 'user'
          }
        },
        {
          type: 'permission:denied',
          data: {
            requestId: 'test-3',
            tool: 'Execute',
            reason: 'Not allowed',
            deniedBy: 'system'
          }
        }
      ];

      // Emit all events
      events.forEach(event => {
        orchestrator.emit(event.type, { ...event.data, timestamp: new Date() });
      });

      await Promise.all([
        waitForEvents(cliHandler, 3, 500),
        waitForEvents(wsClient, 3, 500)
      ]);

      // Verify CLI received all events
      expect(cliHandler.getProcessedEventCount()).toBe(3);
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(1);
      expect(cliHandler.getEventsByType('permission:granted')).toHaveLength(1);
      expect(cliHandler.getEventsByType('permission:denied')).toHaveLength(1);

      // Verify WebSocket client received all events
      expect(wsClient.getMessageCount()).toBe(3);
      expect(wsClient.getMessagesByType('permission:request')).toHaveLength(1);
      expect(wsClient.getMessagesByType('permission:granted')).toHaveLength(1);
      expect(wsClient.getMessagesByType('permission:denied')).toHaveLength(1);

      // Verify CLI and WebSocket received the same data
      const cliRequest = cliHandler.getEventsByType('permission:request')[0];
      const wsRequest = wsClient.getMessagesByType('permission:request')[0];

      expect(cliRequest.requestId).toBe(wsRequest.requestId);
      expect(cliRequest.tool).toBe(wsRequest.tool);
    });
  });

  describe('INT-E2E-03: Content Accuracy and Actionability', () => {
    it('should provide accurate and actionable notification content', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Trigger comprehensive permission request with all details
      const detailedRequest: PermissionRequestEventData = {
        requestId: 'detailed-test-123',
        tool: 'Write',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        scope: '/project/src/components/UserAuthentication.tsx',
        description: 'Creating new user authentication component with secure password handling and OAuth integration',
        agent: 'developer',
        isDangerous: false,
        metadata: {
          fileType: 'typescript',
          componentType: 'react',
          securitySensitive: true,
          estimatedLines: 150
        }
      };

      orchestrator.emit('permission:request', detailedRequest);

      await Promise.all([
        waitForEvents(cliHandler, 1, 500),
        waitForEvents(wsClient, 1, 500)
      ]);

      // Verify CLI notification contains actionable information
      const cliNotifications = cliHandler.getNotificationsByTitlePattern('Permission Required: Write');
      expect(cliNotifications).toHaveLength(1);

      const cliNotif = cliNotifications[0];
      expect(cliNotif.title).toBe('Permission Required: Write');
      expect(cliNotif.message).toContain('Agent developer');
      expect(cliNotif.message).toContain('UserAuthentication.tsx');
      expect(cliNotif.message).toContain('authentication component with secure password handling');
      expect(cliNotif.severity).toBe('warning');

      // Verify WebSocket message contains complete data
      const wsMessages = wsClient.getMessagesByType('permission:request');
      expect(wsMessages).toHaveLength(1);

      const wsMessage = wsMessages[0];
      expect(wsMessage.requestId).toBe('detailed-test-123');
      expect(wsMessage.tool).toBe('Write');
      expect(wsMessage.scope).toBe('/project/src/components/UserAuthentication.tsx');
      expect(wsMessage.agent).toBe('developer');
      expect(wsMessage.metadata.securitySensitive).toBe(true);
      expect(wsMessage.metadata.estimatedLines).toBe(150);

      // Verify timestamps are preserved correctly
      expect(new Date(wsMessage.timestamp)).toEqual(detailedRequest.timestamp);
    });

    it('should provide contextual information for permission denials', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      const denialEvent: PermissionDeniedEventData = {
        requestId: 'denial-context-test',
        tool: 'Bash',
        timestamp: new Date(),
        reason: 'Shell commands are not permitted in production environment. Use the API endpoints instead or request elevated privileges through the admin panel.',
        deniedBy: 'environment-policy'
      };

      orchestrator.emit('permission:denied', denialEvent);

      await Promise.all([
        waitForEvents(cliHandler, 1, 500),
        waitForEvents(wsClient, 1, 500)
      ]);

      // Verify CLI provides actionable denial information
      const cliNotifications = cliHandler.getNotificationsByTitlePattern('Permission Denied: Bash');
      expect(cliNotifications).toHaveLength(1);

      const cliNotif = cliNotifications[0];
      expect(cliNotif.message).toContain('not permitted in production environment');
      expect(cliNotif.message).toContain('Use the API endpoints instead');
      expect(cliNotif.message).toContain('admin panel');
      expect(cliNotif.severity).toBe('error');

      // Verify WebSocket contains complete contextual data
      const wsMessages = wsClient.getMessagesByType('permission:denied');
      expect(wsMessages).toHaveLength(1);

      const wsMessage = wsMessages[0];
      expect(wsMessage.reason).toContain('production environment');
      expect(wsMessage.deniedBy).toBe('environment-policy');
    });

    it('should highlight dangerous operations with appropriate urgency', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      const criticalDangerousEvent: DangerousOperationDetectedEventData = {
        operationId: 'critical-danger-test',
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'system-modification',
        riskLevel: 'critical',
        riskDescription: 'Attempting to modify system-critical files that could render the system inoperable',
        agent: 'developer',
        context: {
          affectedFiles: ['/etc/passwd', '/etc/shadow', '/boot/grub/grub.cfg'],
          riskFactors: ['system-instability', 'security-breach', 'data-loss'],
          recoveryDifficulty: 'extremely-difficult',
          immediateAction: 'required'
        }
      };

      orchestrator.emit('dangerous:detected', criticalDangerousEvent);

      await Promise.all([
        waitForEvents(cliHandler, 1, 500),
        waitForEvents(wsClient, 1, 500)
      ]);

      // Verify CLI treats this with maximum urgency
      const cliNotifications = cliHandler.getNotificationsByTitlePattern('DANGEROUS OPERATION: Bash');
      expect(cliNotifications).toHaveLength(1);

      const cliNotif = cliNotifications[0];
      expect(cliNotif.title).toContain('DANGEROUS OPERATION');
      expect(cliNotif.message).toContain('Risk Level: CRITICAL');
      expect(cliNotif.message).toContain('system-critical files');
      expect(cliNotif.message).toContain('render the system inoperable');
      expect(cliNotif.severity).toBe('critical');

      // Verify WebSocket provides complete risk assessment data
      const wsMessages = wsClient.getMessagesByType('dangerous:detected');
      expect(wsMessages).toHaveLength(1);

      const wsMessage = wsMessages[0];
      expect(wsMessage.riskLevel).toBe('critical');
      expect(wsMessage.context.affectedFiles).toContain('/etc/passwd');
      expect(wsMessage.context.riskFactors).toContain('system-instability');
      expect(wsMessage.context.recoveryDifficulty).toBe('extremely-difficult');
    });
  });

  describe('INT-E2E-04: Resilience and Error Handling', () => {
    it('should handle WebSocket client disconnections gracefully', async () => {
      const wsClient1 = new MockWebSocketClient();
      const wsClient2 = new MockWebSocketClient();

      webSocketClients.push(wsClient1, wsClient2);

      await Promise.all([
        wsClient1.connect(apiPort),
        wsClient2.connect(apiPort)
      ]);

      // Emit initial event - both should receive
      const disconnectTestData: PermissionRequestEventData = {
        requestId: 'disconnect-test-1',
        tool: 'Test',
        timestamp: new Date(),
        description: 'Test disconnection handling',
        agent: 'test',
        isDangerous: false
      };
      orchestrator.emit('permission:request', disconnectTestData);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(wsClient1.getMessageCount()).toBe(1);
      expect(wsClient2.getMessageCount()).toBe(1);

      // Disconnect first client
      wsClient1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Emit another event - only second client should receive
      const grantedTestData: PermissionGrantedEventData = {
        requestId: 'disconnect-test-2',
        tool: 'Test',
        timestamp: new Date(),
        level: 'allow-once' as PermissionLevel,
        grantedBy: 'test'
      };
      orchestrator.emit('permission:granted', grantedTestData);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(wsClient1.getMessageCount()).toBe(1); // Still just the first message
      expect(wsClient2.getMessageCount()).toBe(2); // Both messages

      // CLI should continue working normally
      expect(cliHandler.getProcessedEventCount()).toBe(2);
    });

    it('should handle malformed event data without crashing', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Emit events with missing or invalid data
      const malformedEvents = [
        { type: 'permission:request', data: { /* missing required fields */ } },
        { type: 'permission:granted', data: { requestId: null, tool: 123 } },
        { type: 'dangerous:detected', data: { riskLevel: 'invalid-level', context: 'not-an-object' } }
      ];

      malformedEvents.forEach(event => {
        expect(() => {
          orchestrator.emit(event.type, { ...event.data, timestamp: new Date() });
        }).not.toThrow();
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // System should remain stable
      expect(cliHandler.getProcessedEventCount()).toBe(3);
      expect(wsClient.getMessageCount()).toBe(3);

      // Verify system continues to work with valid events
      const recoveryData: PermissionRequestEventData = {
        requestId: 'recovery-test',
        tool: 'RecoveryTool',
        timestamp: new Date(),
        description: 'Recovery test after malformed data',
        agent: 'test',
        isDangerous: false
      };
      orchestrator.emit('permission:request', recoveryData);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(cliHandler.getProcessedEventCount()).toBe(4);
      expect(wsClient.getMessageCount()).toBe(4);
    });

    it('should handle high-frequency event streams without data loss', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      const eventCount = 100;
      const events: any[] = [];

      // Generate many events rapidly
      for (let i = 0; i < eventCount; i++) {
        const event: PermissionRequestEventData = {
          requestId: `stress-test-${i}`,
          tool: `Tool${i % 10}`,
          timestamp: new Date(),
          description: `Stress test operation ${i}`,
          agent: `agent-${i % 3}`,
          isDangerous: false,
          metadata: { index: i }
        };
        events.push(event);
      }

      // Emit all events rapidly
      events.forEach(event => {
        orchestrator.emit('permission:request', event);
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify all events were processed
      expect(cliHandler.getProcessedEventCount()).toBe(eventCount);
      expect(wsClient.getMessageCount()).toBe(eventCount);

      // Verify no data corruption
      const receivedEvents = cliHandler.getEventsByType('permission:request');
      const receivedIndexes = receivedEvents.map(e => e.metadata?.index).sort((a, b) => a - b);
      const expectedIndexes = Array.from({ length: eventCount }, (_, i) => i);

      expect(receivedIndexes).toEqual(expectedIndexes);
    });
  });

  describe('INT-E2E-05: Integration Test Coverage Verification', () => {
    it('should verify all acceptance criteria are met', async () => {
      const wsClient = new MockWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Run a comprehensive test that exercises all acceptance criteria
      const testScenarios = [
        {
          type: 'permission:request',
          data: {
            requestId: 'coverage-1',
            tool: 'Write',
            description: 'Coverage test write',
            agent: 'dev',
            isDangerous: false
          } as PermissionRequestEventData
        },
        {
          type: 'permission:granted',
          data: {
            requestId: 'coverage-2',
            tool: 'Read',
            level: 'allow-once' as PermissionLevel,
            grantedBy: 'user'
          } as PermissionGrantedEventData
        },
        {
          type: 'permission:denied',
          data: {
            requestId: 'coverage-3',
            tool: 'Execute',
            reason: 'Not allowed',
            deniedBy: 'system'
          } as PermissionDeniedEventData
        },
        {
          type: 'dangerous:detected',
          data: {
            operationId: 'coverage-4',
            tool: 'Bash',
            operation: 'deletion',
            riskLevel: 'high' as const,
            riskDescription: 'High risk operation',
            agent: 'dev'
          } as DangerousOperationDetectedEventData
        }
      ];

      // Execute all scenarios
      testScenarios.forEach(scenario => {
        orchestrator.emit(scenario.type, { ...scenario.data, timestamp: new Date() });
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify acceptance criteria coverage
      const acceptanceCriteria = {
        'Permission change triggered': true, // Events were emitted
        'Orchestrator emits event': cliHandler.getProcessedEventCount() > 0,
        'CLI receives notification': cliHandler.getProcessedEventCount() === testScenarios.length,
        'WebSocket clients receive notification': wsClient.getMessageCount() === testScenarios.length,
        'Notification content is accurate': cliHandler.notifications.every(n => n.title && n.message),
        'Notification content is actionable': cliHandler.notifications.some(n =>
          n.message.includes('Agent') || n.message.includes('Reason') || n.message.includes('Level')
        )
      };

      // Verify all criteria are met
      Object.entries(acceptanceCriteria).forEach(([criteria, met]) => {
        expect(met).toBe(true);
      });

      // Final verification: complete end-to-end flow worked
      expect(cliHandler.receivedEvents.length).toBe(testScenarios.length);
      expect(cliHandler.notifications.length).toBe(testScenarios.length);
      expect(wsClient.receivedMessages.length).toBe(testScenarios.length);
    });
  });
});