/**
 * Enhanced End-to-End Permission Notification Flow Test
 *
 * This test provides additional coverage for edge cases and advanced scenarios
 * beyond the core permission-flow-complete-e2e test, specifically:
 * - High-frequency notification bursts
 * - Complex permission metadata handling
 * - Edge cases with malformed data
 * - Performance degradation scenarios
 * - WebSocket reconnection edge cases
 *
 * Supplements the main acceptance criteria validation with stress testing
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WebSocket } from 'ws';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';

// Import APEX components
import { ApexOrchestrator } from '@apex/orchestrator';
import {
  PermissionNotification,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  PermissionLevel,
  initializeApex
} from '@apex/core';

/**
 * Comprehensive CLI Handler that mimics real CLI notification processing
 */
class ComprehensiveCLIHandler extends EventEmitter {
  public receivedEvents: Array<{
    type: string;
    data: any;
    timestamp: Date;
    processed: boolean;
    processingTime: number;
  }> = [];

  public userNotifications: Array<{
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    timestamp: Date;
    actionable: boolean;
    actions: string[];
  }> = [];

  public statistics = {
    totalEventsReceived: 0,
    totalNotificationsGenerated: 0,
    averageProcessingTime: 0,
    errorCount: 0
  };

  constructor(orchestrator: ApexOrchestrator) {
    super();
    this.setupEventHandlers(orchestrator);
  }

  private setupEventHandlers(orchestrator: ApexOrchestrator): void {
    // Comprehensive event handler registration
    orchestrator.on('permission:request', (data) => this.handleEvent('permission:request', data));
    orchestrator.on('permission:granted', (data) => this.handleEvent('permission:granted', data));
    orchestrator.on('permission:denied', (data) => this.handleEvent('permission:denied', data));
    orchestrator.on('dangerous:detected', (data) => this.handleEvent('dangerous:detected', data));
    orchestrator.on('dangerous:confirmed', (data) => this.handleEvent('dangerous:confirmed', data));
    orchestrator.on('dangerous:blocked', (data) => this.handleEvent('dangerous:blocked', data));
    orchestrator.on('permission:notification', (data) => this.handleEvent('permission:notification', data));
  }

  private handleEvent(type: string, data: any): void {
    const startTime = Date.now();

    try {
      const event = {
        type,
        data: { ...data },
        timestamp: new Date(),
        processed: false,
        processingTime: 0
      };

      this.receivedEvents.push(event);
      this.statistics.totalEventsReceived++;

      // Generate user-friendly notification
      const notification = this.generateUserNotification(event);
      if (notification) {
        this.userNotifications.push(notification);
        this.statistics.totalNotificationsGenerated++;
      }

      // Mark as processed
      event.processed = true;
      event.processingTime = Date.now() - startTime;

      // Update statistics
      this.updateStatistics();

      this.emit('event:processed', event);
      this.emit('notification:created', notification);
    } catch (error) {
      this.statistics.errorCount++;
      this.emit('error', error);
    }
  }

  private generateUserNotification(event: any): any {
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let notification: any;

    switch (event.type) {
      case 'permission:request':
        notification = {
          id: notificationId,
          title: `Permission Required: ${event.data.tool}`,
          message: `Agent ${event.data.agent} requests permission to use ${event.data.tool}${event.data.scope ? ` on ${event.data.scope}` : ''}. ${event.data.description || 'No description provided'}`,
          severity: event.data.isDangerous ? 'critical' : 'warning',
          timestamp: event.timestamp,
          actionable: true,
          actions: ['Approve', 'Deny', 'View Details']
        };
        break;

      case 'permission:granted':
        notification = {
          id: notificationId,
          title: `Permission Granted: ${event.data.tool}`,
          message: `Access granted with level: ${event.data.level}. ${event.data.reason || 'Approved by ' + event.data.grantedBy}`,
          severity: 'info',
          timestamp: event.timestamp,
          actionable: false,
          actions: ['View Details']
        };
        break;

      case 'permission:denied':
        notification = {
          id: notificationId,
          title: `Permission Denied: ${event.data.tool}`,
          message: `Access denied. ${event.data.reason || 'No reason provided'}`,
          severity: 'error',
          timestamp: event.timestamp,
          actionable: true,
          actions: ['Request Review', 'View Policy', 'Contact Admin']
        };
        break;

      case 'dangerous:detected':
        notification = {
          id: notificationId,
          title: `🚨 DANGEROUS OPERATION: ${event.data.tool}`,
          message: `Risk Level: ${event.data.riskLevel?.toUpperCase()}. Operation: ${event.data.operation}. ${event.data.riskDescription || 'No risk description'}`,
          severity: 'critical',
          timestamp: event.timestamp,
          actionable: true,
          actions: ['Block Operation', 'Override with Approval', 'View Risk Assessment']
        };
        break;

      case 'dangerous:confirmed':
        notification = {
          id: notificationId,
          title: `Dangerous Operation Approved: ${event.data.tool}`,
          message: `Operation confirmed by ${event.data.confirmedBy}. ${event.data.reason || 'No confirmation details'}`,
          severity: 'warning',
          timestamp: event.timestamp,
          actionable: true,
          actions: ['Monitor Progress', 'View Confirmation Details']
        };
        break;

      case 'dangerous:blocked':
        notification = {
          id: notificationId,
          title: `Dangerous Operation Blocked: ${event.data.tool}`,
          message: `Operation blocked by ${event.data.blockedBy}. ${event.data.reason || 'No block reason'}`,
          severity: 'error',
          timestamp: event.timestamp,
          actionable: true,
          actions: ['Review Block Reason', 'Request Override', 'Contact Support']
        };
        break;

      case 'permission:notification':
        notification = {
          id: notificationId,
          title: event.data.title || 'Permission Notification',
          message: event.data.message || 'Permission notification received',
          severity: event.data.severity || 'info',
          timestamp: event.timestamp,
          actionable: event.data.actionable || false,
          actions: event.data.actions || []
        };
        break;

      default:
        notification = {
          id: notificationId,
          title: `Unknown Event: ${event.type}`,
          message: 'Unknown permission event received',
          severity: 'info',
          timestamp: event.timestamp,
          actionable: false,
          actions: []
        };
    }

    return notification;
  }

  private updateStatistics(): void {
    const totalProcessingTime = this.receivedEvents
      .filter(event => event.processed)
      .reduce((sum, event) => sum + event.processingTime, 0);

    this.statistics.averageProcessingTime = totalProcessingTime / this.statistics.totalEventsReceived;
  }

  // Public API for testing
  public getEventsByType(eventType: string): any[] {
    return this.receivedEvents
      .filter(event => event.type === eventType)
      .map(event => event.data);
  }

  public getNotificationsByTitlePattern(pattern: string): any[] {
    return this.userNotifications.filter(notif =>
      notif.title.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  public getActionableNotifications(): any[] {
    return this.userNotifications.filter(notif => notif.actionable);
  }

  public getStatistics() {
    return { ...this.statistics };
  }

  public reset(): void {
    this.receivedEvents = [];
    this.userNotifications = [];
    this.statistics = {
      totalEventsReceived: 0,
      totalNotificationsGenerated: 0,
      averageProcessingTime: 0,
      errorCount: 0
    };
  }
}

/**
 * Enhanced WebSocket Test Client with advanced features
 */
class EnhancedWebSocketClient extends EventEmitter {
  public receivedMessages: Array<{
    type: string;
    data: any;
    timestamp: string;
    received: Date;
    latency: number;
  }> = [];

  public connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  public connectionMetrics = {
    connectTime: 0,
    totalMessages: 0,
    averageLatency: 0,
    reconnections: 0
  };

  public ws: WebSocket | null = null;
  private connectStartTime = 0;

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectStartTime = Date.now();
      this.connectionState = 'connecting';
      this.ws = new WebSocket(`ws://localhost:${port}/ws`);

      this.ws.on('open', () => {
        this.connectionState = 'connected';
        this.connectionMetrics.connectTime = Date.now() - this.connectStartTime;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const receivedTime = new Date();
          const sentTime = new Date(message.timestamp);
          const latency = receivedTime.getTime() - sentTime.getTime();

          const receivedMessage = {
            ...message,
            received: receivedTime,
            latency: latency
          };

          this.receivedMessages.push(receivedMessage);
          this.connectionMetrics.totalMessages++;
          this.updateAverageLatency(latency);

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

  private updateAverageLatency(newLatency: number): void {
    const totalLatency = this.connectionMetrics.averageLatency * (this.connectionMetrics.totalMessages - 1) + newLatency;
    this.connectionMetrics.averageLatency = totalLatency / this.connectionMetrics.totalMessages;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  // Advanced query methods
  public getMessagesByType(messageType: string): any[] {
    return this.receivedMessages
      .filter(msg => msg.type === messageType)
      .map(msg => msg.data);
  }

  public getMessagesByTimeRange(start: Date, end: Date): any[] {
    return this.receivedMessages.filter(msg =>
      msg.received >= start && msg.received <= end
    );
  }

  public getLatencyStatistics() {
    const latencies = this.receivedMessages.map(msg => msg.latency);
    return {
      average: this.connectionMetrics.averageLatency,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      count: latencies.length
    };
  }

  public getConnectionMetrics() {
    return { ...this.connectionMetrics };
  }

  public reset(): void {
    this.receivedMessages = [];
    this.connectionMetrics = {
      connectTime: 0,
      totalMessages: 0,
      averageLatency: 0,
      reconnections: 0
    };
  }
}

/**
 * Async utilities for robust testing
 */
async function waitForCondition(
  condition: () => boolean,
  timeout: number = 1000,
  interval: number = 10
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout: Condition not met after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

async function waitForEvents(
  handler: ComprehensiveCLIHandler | EnhancedWebSocketClient,
  expectedCount: number,
  timeout: number = 1000
): Promise<void> {
  return waitForCondition(() => {
    const currentCount = handler instanceof EnhancedWebSocketClient
      ? handler.receivedMessages.length
      : handler.receivedEvents.filter(e => e.processed).length;
    return currentCount >= expectedCount;
  }, timeout);
}

/**
 * Enhanced Test Suite for Edge Cases and Performance
 */
describe('Enhanced Permission Notification Flow - Edge Cases & Performance', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let cliHandler: ComprehensiveCLIHandler;
  let webSocketClients: EnhancedWebSocketClient[];
  let apiApp: any;
  let apiPort: number;

  beforeAll(async () => {
    // Find available port
    apiPort = Math.floor(Math.random() * 10000) + 50000;
  });

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-complete-'));

    // Initialize APEX project
    await initializeApex(testDir, {
      projectName: 'complete-e2e-test',
      language: 'typescript',
    });

    // Create comprehensive agent definitions
    const agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Developer agent for comprehensive testing
tools: Write, Edit, Read, Bash, WebSearch
model: sonnet
permissions:
  default: ask
  dangerous: block
---

You are a developer agent with comprehensive tool access for testing permission notifications.`
    );

    // Create test workflow
    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(
      path.join(workflowsDir, 'feature.yaml'),
      `name: feature
description: Comprehensive feature development workflow
stages:
  - name: planning
    agent: developer
    description: Plan the feature implementation
  - name: implementation
    agent: developer
    description: Implement the feature with proper permissions
  - name: testing
    agent: developer
    description: Test the implementation
`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Initialize CLI handler
    cliHandler = new ComprehensiveCLIHandler(orchestrator);

    // Setup comprehensive API server
    apiApp = Fastify({ logger: false });
    await apiApp.register(websocket);

    // WebSocket routes with comprehensive event forwarding
    apiApp.register(async (fastify: any) => {
      await fastify.register(async (websocketFastify: any) => {
        websocketFastify.get('/ws', { websocket: true }, (connection: any) => {
          const ws = connection.socket;

          // Create event handlers for this specific connection
          const handlers = {
            'permission:request': (data: any) => ws.send(JSON.stringify({
              type: 'permission:request',
              timestamp: new Date().toISOString(),
              data
            })),
            'permission:granted': (data: any) => ws.send(JSON.stringify({
              type: 'permission:granted',
              timestamp: new Date().toISOString(),
              data
            })),
            'permission:denied': (data: any) => ws.send(JSON.stringify({
              type: 'permission:denied',
              timestamp: new Date().toISOString(),
              data
            })),
            'dangerous:detected': (data: any) => ws.send(JSON.stringify({
              type: 'dangerous:detected',
              timestamp: new Date().toISOString(),
              data
            })),
            'dangerous:confirmed': (data: any) => ws.send(JSON.stringify({
              type: 'dangerous:confirmed',
              timestamp: new Date().toISOString(),
              data
            })),
            'dangerous:blocked': (data: any) => ws.send(JSON.stringify({
              type: 'dangerous:blocked',
              timestamp: new Date().toISOString(),
              data
            })),
            'permission:notification': (data: any) => ws.send(JSON.stringify({
              type: 'permission:notification',
              timestamp: new Date().toISOString(),
              data
            }))
          };

          // Register all handlers
          Object.entries(handlers).forEach(([event, handler]) => {
            orchestrator.on(event, handler);
          });

          ws.on('close', () => {
            // Clean up only this connection's handlers
            Object.entries(handlers).forEach(([event, handler]) => {
              orchestrator.removeListener(event, handler);
            });
          });
        });
      });
    });

    await apiApp.listen({ port: apiPort });

    // Initialize WebSocket clients array
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

  describe('High-Frequency Event Burst Handling', () => {
    it('should maintain accuracy during rapid permission event sequences', async () => {
      const wsClient = new EnhancedWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Rapid burst of permission events simulating high activity
      const burstCount = 50;
      const events: any[] = [];

      for (let i = 0; i < burstCount; i++) {
        const eventType = i % 3 === 0 ? 'permission:request' :
                         i % 3 === 1 ? 'permission:granted' : 'permission:denied';

        let eventData: any;
        switch (eventType) {
          case 'permission:request':
            eventData = {
              requestId: `burst-${i}`,
              tool: `Tool-${i}`,
              agent: 'developer',
              description: `Burst test ${i}`,
              isDangerous: i % 10 === 0,
              metadata: { burstIndex: i }
            };
            break;
          case 'permission:granted':
            eventData = {
              requestId: `burst-${i}`,
              tool: `Tool-${i}`,
              level: 'allow-once' as PermissionLevel,
              grantedBy: 'system'
            };
            break;
          case 'permission:denied':
            eventData = {
              requestId: `burst-${i}`,
              tool: `Tool-${i}`,
              reason: `Burst denial ${i}`,
              deniedBy: 'policy'
            };
            break;
        }

        events.push({ type: eventType, data: eventData });
      }

      // Emit all events in quick succession
      events.forEach(event => {
        orchestrator.emit(event.type, { ...event.data, timestamp: new Date() });
      });

      // Wait for all events to be processed
      await waitForCondition(() =>
        cliHandler.receivedEvents.length >= burstCount, 2000
      );
      await waitForCondition(() =>
        wsClient.receivedMessages.length >= burstCount, 2000
      );

      // Verify no data loss
      expect(cliHandler.receivedEvents.length).toBe(burstCount);
      expect(wsClient.receivedMessages.length).toBe(burstCount);

      // Verify system remained stable
      const stats = cliHandler.getStatistics();
      expect(stats.errorCount).toBe(0);
      expect(stats.averageProcessingTime).toBeLessThan(50);
    });
  });

  describe('Complex Metadata and Edge Case Handling', () => {
    it('should handle complex permission metadata without data loss', async () => {
      const wsClient = new EnhancedWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Permission request with complex metadata
      const complexRequest: PermissionRequestEventData = {
        requestId: 'complex-metadata-test',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/project/src/auth/SecurityConfig.ts',
        description: 'Modifying security configuration with OAuth2 and JWT integration',
        agent: 'developer',
        isDangerous: false,
        metadata: {
          securityLevel: 'high',
          frameworks: ['oauth2', 'jwt', 'passport'],
          estimatedImpact: 'authentication-system',
          nestedConfig: {
            encryption: { algorithm: 'AES-256', mode: 'CBC' },
            tokens: { expiry: '24h', refresh: true },
            policies: ['2fa-required', 'rate-limiting']
          }
        }
      };

      orchestrator.emit('permission:request', complexRequest);

      await Promise.all([
        waitForEvents(cliHandler, 1, 1000),
        waitForEvents(wsClient, 1, 1000)
      ]);

      // Verify complex metadata is preserved
      const wsMessages = wsClient.getMessagesByType('permission:request');
      expect(wsMessages).toHaveLength(1);
      expect(wsMessages[0].metadata.nestedConfig.encryption.algorithm).toBe('AES-256');
      expect(wsMessages[0].metadata.nestedConfig.policies).toContain('2fa-required');

      const cliEvents = cliHandler.getEventsByType('permission:request');
      expect(cliEvents[0].metadata.frameworks).toEqual(['oauth2', 'jwt', 'passport']);
    });
  });

  describe('System Resilience Testing', () => {
    it('should gracefully handle WebSocket disconnection and reconnection', async () => {
      const wsClient = new EnhancedWebSocketClient();
      webSocketClients.push(wsClient);
      await wsClient.connect(apiPort);

      // Send initial event
      orchestrator.emit('permission:request', {
        requestId: 'reconnection-test-1',
        tool: 'Read',
        agent: 'developer',
        description: 'Before disconnect',
        isDangerous: false,
        timestamp: new Date()
      });

      await waitForEvents(wsClient, 1, 1000);
      expect(wsClient.receivedMessages.length).toBe(1);

      // Simulate disconnect
      wsClient.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send event while disconnected
      orchestrator.emit('permission:granted', {
        requestId: 'reconnection-test-2',
        tool: 'Read',
        level: 'allow-once' as PermissionLevel,
        grantedBy: 'user',
        timestamp: new Date()
      });

      // Reconnect
      await wsClient.connect(apiPort);

      // Send event after reconnection
      orchestrator.emit('permission:denied', {
        requestId: 'reconnection-test-3',
        tool: 'Write',
        reason: 'After reconnect test',
        deniedBy: 'system',
        timestamp: new Date()
      });

      await waitForEvents(wsClient, 2, 1000); // Should have 2 total (1 before + 1 after)

      // Verify system remained stable and CLI processed all events
      expect(cliHandler.receivedEvents.length).toBe(3); // CLI should get all events
      expect(wsClient.receivedMessages.length).toBe(2); // WS missed the middle one

      const stats = cliHandler.getStatistics();
      expect(stats.errorCount).toBe(0);
    });
  });
});