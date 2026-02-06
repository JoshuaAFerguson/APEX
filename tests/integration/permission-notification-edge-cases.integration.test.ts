/**
 * Edge Cases and Error Scenarios for Permission Notification Flow
 *
 * This test suite complements the main acceptance criteria verification by testing:
 * - Error handling in permission notification flow
 * - Edge cases like WebSocket disconnection during notifications
 * - Recovery scenarios after connection failures
 * - Performance under load (multiple simultaneous notifications)
 * - Timeout handling
 *
 * This ensures robust behavior beyond just the happy path acceptance criteria.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WebSocket } from 'ws';

// Import APEX components
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { createServer, type ServerOptions } from '@apexcli/api';
import {
  initializeApex,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData
} from '@apexcli/core';

/**
 * Test CLI Handler for edge case scenarios
 */
class EdgeCaseCLIHandler extends EventEmitter {
  public events: Array<{ type: string; data: any; timestamp: Date }> = [];
  public errors: Array<{ error: Error; timestamp: Date }> = [];

  constructor(orchestrator: ApexOrchestrator) {
    super();
    this.setupHandlers(orchestrator);
  }

  private setupHandlers(orchestrator: ApexOrchestrator): void {
    orchestrator.on('permission:request', (data) => this.recordEvent('permission:request', data));
    orchestrator.on('permission:granted', (data) => this.recordEvent('permission:granted', data));
    orchestrator.on('permission:denied', (data) => this.recordEvent('permission:denied', data));

    // Listen for error events
    orchestrator.on('error', (error) => this.recordError(error));
  }

  private recordEvent(type: string, data: any): void {
    this.events.push({ type, data, timestamp: new Date() });
    this.emit('event:received', { type, data });
  }

  private recordError(error: Error): void {
    this.errors.push({ error, timestamp: new Date() });
    this.emit('error:received', { error });
  }

  public reset(): void {
    this.events = [];
    this.errors = [];
  }

  public hasEvents(): boolean {
    return this.events.length > 0;
  }

  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  public getEventsByType(type: string): any[] {
    return this.events.filter(e => e.type === type).map(e => e.data);
  }
}

/**
 * Enhanced WebSocket Client for edge case testing
 */
class EdgeCaseWSClient {
  public messages: Array<{ type: string; data: any; timestamp: string }> = [];
  public errors: Array<{ error: Error; timestamp: Date }> = [];
  public connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  public ws: WebSocket | null = null;

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionState = 'connecting';
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        this.connectionState = 'error';
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connectionState = 'connected';
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.connectionState = 'error';
        this.errors.push({ error: error as Error, timestamp: new Date() });
        reject(error);
      });

      this.ws.on('close', () => {
        this.connectionState = 'disconnected';
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.messages.push(message);
        } catch (error) {
          this.errors.push({ error: error as Error, timestamp: new Date() });
        }
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  simulateNetworkError(): void {
    if (this.ws) {
      this.ws.terminate(); // Simulate abrupt disconnection
      this.connectionState = 'error';
    }
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  reset(): void {
    this.messages = [];
    this.errors = [];
  }
}

/**
 * Utility to wait for conditions with custom timeout
 */
async function waitForCondition(
  condition: () => boolean,
  timeout: number = 1000,
  checkInterval: number = 10
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
      } else {
        setTimeout(check, checkInterval);
      }
    };
    check();
  });
}

describe('Permission Notification Edge Cases and Error Scenarios', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let cliHandler: EdgeCaseCLIHandler;
  let wsClient: EdgeCaseWSClient;
  let apiServer: any;
  let apiPort: number;

  beforeEach(async () => {
    // Create temporary test project
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-cases-'));

    // Initialize APEX project
    await initializeApex(testDir, {
      projectName: 'edge-cases-test',
      language: 'typescript'
    });

    // Create basic agent
    const agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.writeFile(path.join(agentsDir, 'developer.md'),
      'name: developer\ndescription: Test developer agent\ntools: Write, Read, Bash\nmodel: sonnet\n'
    );

    // Create basic workflow
    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(path.join(workflowsDir, 'feature.yaml'),
      'name: feature\ndescription: Test workflow\nstages:\n  - name: implementation\n    agent: developer\n    description: Implement feature\n'
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Set up CLI handler
    cliHandler = new EdgeCaseCLIHandler(orchestrator);

    // Set up API server
    apiPort = Math.floor(Math.random() * 10000) + 40000;
    const serverOptions: ServerOptions = {
      port: apiPort,
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true
    };

    apiServer = await createServer(serverOptions);
    await apiServer.listen({ port: apiPort, host: '127.0.0.1' });

    // Set up WebSocket client
    wsClient = new EdgeCaseWSClient();
  });

  afterEach(async () => {
    wsClient?.disconnect();
    await apiServer?.close();
    await orchestrator?.shutdown();
    cliHandler?.removeAllListeners();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Error Handling', () => {
    it('should handle malformed permission events gracefully', async () => {
      // Create task for WebSocket stream
      const task = await orchestrator.createTask({
        description: 'Malformed events test',
        workflow: 'feature'
      });

      await wsClient.connect(`ws://127.0.0.1:${apiPort}/stream/${task.id}`);

      // Try to emit malformed event data
      const malformedData = {
        // Missing required fields intentionally
        tool: 'Write',
        timestamp: 'invalid-date', // Invalid date format
        scope: null, // Null scope
        // missing requestId
      };

      // The orchestrator should handle this gracefully
      try {
        orchestrator.emit('permission:request', malformedData);

        // Wait a bit to see if system handles it gracefully
        await new Promise(resolve => setTimeout(resolve, 100));

        // System should still be responsive
        expect(orchestrator.isInitialized()).toBe(true);

      } catch (error) {
        // If it throws, that's also acceptable - the key is it doesn't crash the system
        expect(error).toBeDefined();
      }

      // Verify the system is still functional
      const validPermissionRequest: PermissionRequestEventData = {
        requestId: 'valid-test',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/test/file.ts',
        description: 'Valid permission request after malformed one',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', validPermissionRequest);
      await waitForCondition(() => cliHandler.hasEvents(), 500);

      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(1);
    });

    it('should handle WebSocket disconnection during notification flow', async () => {
      const task = await orchestrator.createTask({
        description: 'Disconnection test',
        workflow: 'feature'
      });

      await wsClient.connect(`ws://127.0.0.1:${apiPort}/stream/${task.id}`);
      expect(wsClient.isConnected()).toBe(true);

      // Send initial permission request
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'disconnect-test',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/test/file.ts',
        description: 'Permission request before disconnection',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', permissionRequest);

      // Wait for CLI to receive (should work)
      await waitForCondition(() => cliHandler.hasEvents(), 500);
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(1);

      // Simulate network failure - disconnect WebSocket abruptly
      wsClient.simulateNetworkError();
      expect(wsClient.isConnected()).toBe(false);

      // Send another permission event - CLI should still work even if WebSocket is down
      const secondRequest: PermissionRequestEventData = {
        requestId: 'after-disconnect-test',
        tool: 'Read',
        timestamp: new Date(),
        scope: '/test/other.ts',
        description: 'Permission request after disconnection',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', secondRequest);

      // CLI should still receive events even when WebSocket is disconnected
      await waitForCondition(() => cliHandler.getEventsByType('permission:request').length >= 2, 500);
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(2);

      // WebSocket client should have registered the disconnection
      expect(wsClient.isConnected()).toBe(false);
    });
  });

  describe('Performance and Load', () => {
    it('should handle multiple rapid permission requests without loss', async () => {
      const task = await orchestrator.createTask({
        description: 'Load test',
        workflow: 'feature'
      });

      await wsClient.connect(`ws://127.0.0.1:${apiPort}/stream/${task.id}`);

      // Generate multiple rapid permission requests
      const requestCount = 10;
      const requests: PermissionRequestEventData[] = [];

      for (let i = 0; i < requestCount; i++) {
        requests.push({
          requestId: `load-test-${i}`,
          tool: 'Write',
          timestamp: new Date(),
          scope: `/test/file-${i}.ts`,
          description: `Load test permission request ${i}`,
          agent: 'developer',
          isDangerous: false
        });
      }

      // Emit all requests rapidly
      requests.forEach(req => orchestrator.emit('permission:request', req));

      // Wait for all events to be processed
      await waitForCondition(() => cliHandler.getEventsByType('permission:request').length >= requestCount, 2000);
      await waitForCondition(() => wsClient.getMessageCount() >= requestCount, 2000);

      // Verify all events were received
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(requestCount);
      expect(wsClient.getMessageCount()).toBe(requestCount);

      // Verify no errors occurred during load
      expect(cliHandler.hasErrors()).toBe(false);
      expect(wsClient.hasErrors()).toBe(false);

      // Verify all events have unique request IDs
      const cliRequestIds = cliHandler.getEventsByType('permission:request').map(e => e.requestId);
      const uniqueCliIds = new Set(cliRequestIds);
      expect(uniqueCliIds.size).toBe(requestCount);

      const wsRequestIds = wsClient.messages.map(m => m.data.requestId);
      const uniqueWsIds = new Set(wsRequestIds);
      expect(uniqueWsIds.size).toBe(requestCount);
    });

    it('should handle mixed event types in rapid succession', async () => {
      const task = await orchestrator.createTask({
        description: 'Mixed events test',
        workflow: 'feature'
      });

      await wsClient.connect(`ws://127.0.0.1:${apiPort}/stream/${task.id}`);

      // Create mixed permission events
      const events = [
        {
          type: 'permission:request',
          data: {
            requestId: 'mixed-1',
            tool: 'Write',
            timestamp: new Date(),
            scope: '/test/file1.ts',
            description: 'Mixed test request 1',
            agent: 'developer',
            isDangerous: false
          } as PermissionRequestEventData
        },
        {
          type: 'permission:granted',
          data: {
            requestId: 'mixed-1',
            tool: 'Write',
            timestamp: new Date(),
            level: 'allow-once' as const,
            grantedBy: 'user',
            reason: 'Approved for testing'
          } as PermissionGrantedEventData
        },
        {
          type: 'permission:request',
          data: {
            requestId: 'mixed-2',
            tool: 'Read',
            timestamp: new Date(),
            scope: '/test/file2.ts',
            description: 'Mixed test request 2',
            agent: 'developer',
            isDangerous: false
          } as PermissionRequestEventData
        },
        {
          type: 'permission:denied',
          data: {
            requestId: 'mixed-2',
            tool: 'Read',
            timestamp: new Date(),
            reason: 'Security policy violation',
            deniedBy: 'security-admin'
          } as PermissionDeniedEventData
        }
      ];

      // Emit all events rapidly
      events.forEach(event => orchestrator.emit(event.type, event.data));

      // Wait for all events to be processed
      await waitForCondition(() => cliHandler.events.length >= events.length, 1000);
      await waitForCondition(() => wsClient.getMessageCount() >= events.length, 1000);

      // Verify all event types were received by CLI
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(2);
      expect(cliHandler.getEventsByType('permission:granted')).toHaveLength(1);
      expect(cliHandler.getEventsByType('permission:denied')).toHaveLength(1);

      // Verify WebSocket received all events
      expect(wsClient.getMessageCount()).toBe(events.length);

      // Verify event order and content integrity
      const receivedEvents = cliHandler.events.map(e => ({ type: e.type, requestId: e.data.requestId }));
      expect(receivedEvents).toEqual([
        { type: 'permission:request', requestId: 'mixed-1' },
        { type: 'permission:granted', requestId: 'mixed-1' },
        { type: 'permission:request', requestId: 'mixed-2' },
        { type: 'permission:denied', requestId: 'mixed-2' }
      ]);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should maintain CLI event flow even when API server is temporarily unavailable', async () => {
      // Send permission request before setting up WebSocket
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'pre-ws-test',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/test/file.ts',
        description: 'Permission request before WebSocket connection',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', permissionRequest);

      // CLI should receive the event even without WebSocket connected
      await waitForCondition(() => cliHandler.hasEvents(), 500);
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(1);

      // Now temporarily shut down API server
      await apiServer.close();

      // Send another permission request
      const secondRequest: PermissionRequestEventData = {
        requestId: 'no-api-test',
        tool: 'Read',
        timestamp: new Date(),
        scope: '/test/other.ts',
        description: 'Permission request with API down',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', secondRequest);

      // CLI should still work
      await waitForCondition(() => cliHandler.getEventsByType('permission:request').length >= 2, 500);
      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(2);

      // Verify system is still responsive for other operations
      expect(orchestrator.isInitialized()).toBe(true);
    });

    it('should handle timeout scenarios gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Timeout test',
        workflow: 'feature'
      });

      // Try to connect to a non-existent WebSocket endpoint (should timeout)
      const invalidPort = apiPort + 1000;

      let connectionError: Error | null = null;
      try {
        await wsClient.connect(`ws://127.0.0.1:${invalidPort}/stream/${task.id}`);
      } catch (error) {
        connectionError = error as Error;
      }

      // Should have failed to connect
      expect(connectionError).toBeDefined();
      expect(connectionError?.message).toContain('timeout');
      expect(wsClient.isConnected()).toBe(false);

      // But orchestrator should still work for CLI events
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'timeout-test',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/test/file.ts',
        description: 'Permission request during timeout scenario',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', permissionRequest);
      await waitForCondition(() => cliHandler.hasEvents(), 500);

      expect(cliHandler.getEventsByType('permission:request')).toHaveLength(1);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain event data integrity across different notification channels', async () => {
      const task = await orchestrator.createTask({
        description: 'Data integrity test',
        workflow: 'feature'
      });

      await wsClient.connect(`ws://127.0.0.1:${apiPort}/stream/${task.id}`);

      // Create permission request with specific data
      const timestamp = new Date();
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'integrity-test-001',
        tool: 'Write',
        timestamp: timestamp,
        scope: '/path/with special chars & symbols/file.ts',
        description: 'Permission request with special characters: äöü 你好 🚀 "quotes" & <tags>',
        agent: 'developer',
        isDangerous: false
      };

      orchestrator.emit('permission:request', permissionRequest);

      // Wait for both channels to receive the event
      await waitForCondition(() => cliHandler.hasEvents(), 500);
      await waitForCondition(() => wsClient.getMessageCount() >= 1, 500);

      // Verify CLI received correct data
      const cliEvent = cliHandler.getEventsByType('permission:request')[0];
      expect(cliEvent.requestId).toBe('integrity-test-001');
      expect(cliEvent.tool).toBe('Write');
      expect(cliEvent.timestamp).toEqual(timestamp);
      expect(cliEvent.scope).toBe('/path/with special chars & symbols/file.ts');
      expect(cliEvent.description).toBe('Permission request with special characters: äöü 你好 🚀 "quotes" & <tags>');
      expect(cliEvent.agent).toBe('developer');
      expect(cliEvent.isDangerous).toBe(false);

      // Verify WebSocket received the same data
      const wsEvent = wsClient.messages[0];
      expect(wsEvent.data.requestId).toBe('integrity-test-001');
      expect(wsEvent.data.tool).toBe('Write');
      expect(wsEvent.data.scope).toBe('/path/with special chars & symbols/file.ts');
      expect(wsEvent.data.description).toBe('Permission request with special characters: äöü 你好 🚀 "quotes" & <tags>');
      expect(wsEvent.data.agent).toBe('developer');
      expect(wsEvent.data.isDangerous).toBe(false);

      // Verify both channels received identical core data
      expect(cliEvent.requestId).toBe(wsEvent.data.requestId);
      expect(cliEvent.tool).toBe(wsEvent.data.tool);
      expect(cliEvent.scope).toBe(wsEvent.data.scope);
      expect(cliEvent.description).toBe(wsEvent.data.description);
      expect(cliEvent.agent).toBe(wsEvent.data.agent);
      expect(cliEvent.isDangerous).toBe(wsEvent.data.isDangerous);
    });
  });
});