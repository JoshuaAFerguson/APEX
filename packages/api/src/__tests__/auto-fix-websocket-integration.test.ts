/**
 * Integration test for auto-fix WebSocket event broadcasting
 * Tests real WebSocket connections and event filtering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { WebSocket } from 'ws';
import { createServer } from '../index.js';
import { AddressInfo } from 'net';

describe('Auto-fix WebSocket Integration', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let server: any;
  let eventHandlers: Record<string, Function>;
  let serverAddress: AddressInfo;

  beforeEach(async () => {
    eventHandlers = {};

    // Mock ApexOrchestrator
    mockOrchestrator = {
      initialize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      getTask: vi.fn().mockResolvedValue({
        id: 'test-task',
        status: 'running',
        description: 'Test task',
        logs: []
      }),
    };

    // Mock the ApexOrchestrator constructor
    vi.mock('@apexcli/orchestrator', () => ({
      ApexOrchestrator: vi.fn(() => mockOrchestrator),
      DaemonManager: vi.fn(() => ({
        getStatus: vi.fn().mockResolvedValue({ running: false }),
      })),
      HealthMonitor: vi.fn(() => ({
        getHealthReport: vi.fn().mockReturnValue({
          uptime: 1000,
          memoryUsage: { heapUsed: 100000000 },
          taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
          lastHealthCheck: new Date(),
          healthChecksPassed: 0,
          healthChecksFailed: 0,
          restartHistory: [],
        }),
        performHealthCheck: vi.fn(),
      })),
    }));

    // Create server instance
    server = await createServer({
      projectPath: '/test',
      port: 0, // Use random port
      silent: true
    });

    await server.listen({ port: 0, host: '127.0.0.1' });
    serverAddress = server.server.address() as AddressInfo;
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    vi.clearAllMocks();
  });

  describe('WebSocket Connection and Event Broadcasting', () => {
    it('should broadcast auto-fix events to connected WebSocket clients', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/test-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Trigger auto-fix requested event
      const autoFixEvent = {
        taskId: 'test-task',
        filePath: '/test/component.tsx',
        fixTypes: ['imports', 'formatting'],
        triggeredBy: 'hook',
        timestamp: new Date()
      };

      eventHandlers['autofix:requested'](autoFixEvent);

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check that the WebSocket received the event
      const autoFixMessage = messages.find(m => m.type === 'autofix:requested');
      expect(autoFixMessage).toBeDefined();
      expect(autoFixMessage.taskId).toBe('test-task');
      expect(autoFixMessage.data.filePath).toBe('/test/component.tsx');
      expect(autoFixMessage.data.fixTypes).toEqual(['imports', 'formatting']);

      ws.close();
    });

    it('should broadcast complete auto-fix lifecycle events', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/lifecycle-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Simulate complete auto-fix lifecycle
      const baseEvent = {
        taskId: 'lifecycle-task',
        filePath: '/test/large-file.js',
        timestamp: new Date()
      };

      // Step 1: Request
      eventHandlers['autofix:requested']({
        ...baseEvent,
        fixTypes: ['eslint', 'prettier'],
        triggeredBy: 'manual'
      });

      // Step 2: Start
      eventHandlers['autofix:started']({
        ...baseEvent,
        fixType: 'eslint',
        detectedIssues: 12
      });

      // Step 3: Progress
      eventHandlers['autofix:progress']({
        ...baseEvent,
        fixType: 'eslint',
        iteration: 1,
        totalIterations: 3,
        issuesFixed: 4
      });

      // Step 4: Progress
      eventHandlers['autofix:progress']({
        ...baseEvent,
        fixType: 'eslint',
        iteration: 2,
        totalIterations: 3,
        issuesFixed: 8
      });

      // Step 5: Complete
      eventHandlers['autofix:completed']({
        ...baseEvent,
        fixType: 'eslint',
        issuesDetected: 12,
        issuesFixed: 12,
        duration: 480
      });

      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all lifecycle events were broadcast
      const eventTypes = messages.map(m => m.type);
      expect(eventTypes).toContain('autofix:requested');
      expect(eventTypes).toContain('autofix:started');
      expect(eventTypes).toContain('autofix:progress');
      expect(eventTypes).toContain('autofix:completed');

      // Verify progress events
      const progressEvents = messages.filter(m => m.type === 'autofix:progress');
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0].data.iteration).toBe(1);
      expect(progressEvents[1].data.iteration).toBe(2);

      ws.close();
    });

    it('should handle auto-fix failure scenarios', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/fail-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Simulate auto-fix failure
      eventHandlers['autofix:failed']({
        taskId: 'fail-task',
        filePath: '/test/broken-file.ts',
        fixType: 'typescript',
        error: 'Cannot parse TypeScript syntax',
        issuesDetected: 5,
        issuesFixed: 2,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const failedEvent = messages.find(m => m.type === 'autofix:failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent.data.error).toBe('Cannot parse TypeScript syntax');
      expect(failedEvent.data.issuesDetected).toBe(5);
      expect(failedEvent.data.issuesFixed).toBe(2);

      ws.close();
    });

    it('should handle auto-fix skipped scenarios', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/skip-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Simulate auto-fix skipped
      eventHandlers['autofix:skipped']({
        taskId: 'skip-task',
        filePath: '/test/clean-file.js',
        reason: 'no_issues',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const skippedEvent = messages.find(m => m.type === 'autofix:skipped');
      expect(skippedEvent).toBeDefined();
      expect(skippedEvent.data.filePath).toBe('/test/clean-file.js');
      expect(skippedEvent.data.reason).toBe('no_issues');

      ws.close();
    });
  });

  describe('Event Filtering', () => {
    it('should filter events based on query parameters', async () => {
      // Connect with auto-fix event filter
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/filter-task?events=autofix:completed,autofix:failed`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send various events
      eventHandlers['autofix:requested']({
        taskId: 'filter-task',
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });

      eventHandlers['autofix:started']({
        taskId: 'filter-task',
        filePath: '/test/file.ts',
        fixType: 'imports',
        detectedIssues: 3,
        timestamp: new Date()
      });

      eventHandlers['autofix:completed']({
        taskId: 'filter-task',
        filePath: '/test/file.ts',
        fixType: 'imports',
        issuesDetected: 3,
        issuesFixed: 3,
        duration: 150,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only receive task:state and autofix:completed (filtered)
      const eventTypes = messages.map(m => m.type);
      expect(eventTypes).toContain('task:state'); // Initial state
      expect(eventTypes).toContain('autofix:completed');
      expect(eventTypes).not.toContain('autofix:requested');
      expect(eventTypes).not.toContain('autofix:started');

      ws.close();
    });

    it('should receive all events when no filter is specified', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/unfiltered-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send multiple event types
      eventHandlers['autofix:requested']({
        taskId: 'unfiltered-task',
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });

      eventHandlers['autofix:progress']({
        taskId: 'unfiltered-task',
        filePath: '/test/file.ts',
        fixType: 'imports',
        iteration: 1,
        totalIterations: 2,
        issuesFixed: 1,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should receive all events
      const eventTypes = messages.map(m => m.type);
      expect(eventTypes).toContain('autofix:requested');
      expect(eventTypes).toContain('autofix:progress');

      ws.close();
    });
  });

  describe('Multiple Client Broadcasting', () => {
    it('should broadcast events to all connected clients for the same task', async () => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/multi-client-task`);
      const ws2 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/multi-client-task`);

      const messages1: any[] = [];
      const messages2: any[] = [];

      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      // Trigger event
      eventHandlers['autofix:completed']({
        taskId: 'multi-client-task',
        filePath: '/test/shared-file.ts',
        fixType: 'eslint',
        issuesDetected: 2,
        issuesFixed: 2,
        duration: 200,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Both clients should receive the event
      const event1 = messages1.find(m => m.type === 'autofix:completed');
      const event2 = messages2.find(m => m.type === 'autofix:completed');

      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
      expect(event1.data.filePath).toBe('/test/shared-file.ts');
      expect(event2.data.filePath).toBe('/test/shared-file.ts');

      ws1.close();
      ws2.close();
    });

    it('should not broadcast events to clients subscribed to different tasks', async () => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/task-a`);
      const ws2 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/task-b`);

      const messages1: any[] = [];
      const messages2: any[] = [];

      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      // Trigger event for task-a only
      eventHandlers['autofix:started']({
        taskId: 'task-a',
        filePath: '/test/file-a.ts',
        fixType: 'imports',
        detectedIssues: 1,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Only ws1 (task-a) should receive the event
      const autoFixEvent1 = messages1.find(m => m.type === 'autofix:started');
      const autoFixEvent2 = messages2.find(m => m.type === 'autofix:started');

      expect(autoFixEvent1).toBeDefined();
      expect(autoFixEvent2).toBeUndefined();

      ws1.close();
      ws2.close();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high frequency of auto-fix events', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/performance-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send many rapid events
      const eventCount = 50;
      for (let i = 0; i < eventCount; i++) {
        eventHandlers['autofix:progress']({
          taskId: 'performance-task',
          filePath: `/test/file${i}.ts`,
          fixType: 'eslint',
          iteration: 1,
          totalIterations: 1,
          issuesFixed: i % 5,
          timestamp: new Date()
        });
      }

      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 200));

      const progressEvents = messages.filter(m => m.type === 'autofix:progress');
      expect(progressEvents.length).toBeGreaterThanOrEqual(eventCount);

      ws.close();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed event data gracefully', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/error-task`);
      const messages: any[] = [];
      const errors: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      ws.on('error', (error) => errors.push(error));

      // Send event with missing required fields
      try {
        eventHandlers['autofix:completed']({
          taskId: 'error-task',
          // Missing filePath
          fixType: 'imports',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 100,
          timestamp: new Date()
        });
      } catch (error) {
        // Should not throw
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // WebSocket should remain stable
      expect(errors.length).toBe(0);

      ws.close();
    });

    it('should handle client disconnection during event broadcasting', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/disconnect-task`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      // Disconnect client
      ws.close();

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send event after client disconnection - should not throw
      expect(() => {
        eventHandlers['autofix:completed']({
          taskId: 'disconnect-task',
          filePath: '/test/file.ts',
          fixType: 'imports',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 100,
          timestamp: new Date()
        });
      }).not.toThrow();
    });
  });

  describe('Event Payload Validation', () => {
    it('should include all required fields in auto-fix events', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/validation-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Test autofix:requested event structure
      eventHandlers['autofix:requested']({
        taskId: 'validation-task',
        filePath: '/test/validation-file.ts',
        fixTypes: ['imports', 'formatting', 'eslint'],
        triggeredBy: 'manual',
        timestamp: new Date('2023-01-01T10:00:00Z')
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const requestedEvent = messages.find(m => m.type === 'autofix:requested');
      expect(requestedEvent).toBeDefined();

      // Validate event structure
      expect(requestedEvent).toMatchObject({
        type: 'autofix:requested',
        taskId: 'validation-task',
        timestamp: expect.any(String),
        data: {
          filePath: '/test/validation-file.ts',
          fixTypes: ['imports', 'formatting', 'eslint'],
          triggeredBy: 'manual'
        }
      });

      ws.close();
    });

    it('should preserve timestamp precision in events', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/timestamp-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      const originalTimestamp = new Date('2023-06-15T14:30:45.123Z');

      eventHandlers['autofix:completed']({
        taskId: 'timestamp-task',
        filePath: '/test/timing-file.ts',
        fixType: 'prettier',
        issuesDetected: 1,
        issuesFixed: 1,
        duration: 150,
        timestamp: originalTimestamp
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const completedEvent = messages.find(m => m.type === 'autofix:completed');
      expect(completedEvent).toBeDefined();

      // Timestamp should be preserved
      expect(new Date(completedEvent.timestamp).getTime()).toBe(originalTimestamp.getTime());

      ws.close();
    });
  });
});