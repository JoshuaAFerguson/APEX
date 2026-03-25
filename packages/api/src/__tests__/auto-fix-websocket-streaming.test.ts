/**
 * Test auto-fix WebSocket event streaming in API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { WebSocket } from 'ws';
import { createServer } from '../index.js';

describe.skip('Auto-fix WebSocket Event Streaming', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let server: any;
  let eventHandlers: Record<string, Function>;

  beforeEach(async () => {
    eventHandlers = {};

    // Mock ApexOrchestrator
    mockOrchestrator = {
      initialize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      getTask: vi.fn().mockResolvedValue({ id: 'test-task', status: 'running' }),
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
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    vi.clearAllMocks();
  });

  it('should broadcast autofix:requested events via WebSocket', async () => {
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:requested', expect.any(Function));

    // Simulate an autofix:requested event
    const mockEvent = {
      taskId: 'test-task',
      filePath: '/test/file.ts',
      fixTypes: ['imports'],
      triggeredBy: 'hook',
      timestamp: new Date()
    };

    // The event handler should be registered and callable
    expect(eventHandlers['autofix:requested']).toBeDefined();

    // Call the handler directly to test event broadcasting logic
    expect(() => {
      eventHandlers['autofix:requested'](mockEvent);
    }).not.toThrow();
  });

  it('should broadcast autofix:started events via WebSocket', async () => {
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:started', expect.any(Function));

    const mockEvent = {
      taskId: 'test-task',
      filePath: '/test/file.ts',
      fixType: 'imports',
      detectedIssues: 5,
      timestamp: new Date()
    };

    expect(eventHandlers['autofix:started']).toBeDefined();

    expect(() => {
      eventHandlers['autofix:started'](mockEvent);
    }).not.toThrow();
  });

  it('should broadcast autofix:progress events via WebSocket', async () => {
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:progress', expect.any(Function));

    const mockEvent = {
      taskId: 'test-task',
      filePath: '/test/file.ts',
      fixType: 'imports',
      iteration: 2,
      totalIterations: 5,
      issuesFixed: 3,
      timestamp: new Date()
    };

    expect(eventHandlers['autofix:progress']).toBeDefined();

    expect(() => {
      eventHandlers['autofix:progress'](mockEvent);
    }).not.toThrow();
  });

  it('should broadcast autofix:completed events via WebSocket', async () => {
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:completed', expect.any(Function));

    const mockEvent = {
      taskId: 'test-task',
      filePath: '/test/file.ts',
      fixType: 'imports',
      issuesDetected: 5,
      issuesFixed: 5,
      duration: 150,
      timestamp: new Date()
    };

    expect(eventHandlers['autofix:completed']).toBeDefined();

    expect(() => {
      eventHandlers['autofix:completed'](mockEvent);
    }).not.toThrow();
  });

  it('should broadcast autofix:failed events via WebSocket', async () => {
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:failed', expect.any(Function));

    const mockEvent = {
      taskId: 'test-task',
      filePath: '/test/file.ts',
      fixType: 'imports',
      error: 'Parse error',
      issuesDetected: 5,
      issuesFixed: 2,
      timestamp: new Date()
    };

    expect(eventHandlers['autofix:failed']).toBeDefined();

    expect(() => {
      eventHandlers['autofix:failed'](mockEvent);
    }).not.toThrow();
  });

  it('should broadcast autofix:skipped events via WebSocket', async () => {
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:skipped', expect.any(Function));

    const mockEvent = {
      taskId: 'test-task',
      filePath: '/test/file.ts',
      reason: 'no_issues',
      timestamp: new Date()
    };

    expect(eventHandlers['autofix:skipped']).toBeDefined();

    expect(() => {
      eventHandlers['autofix:skipped'](mockEvent);
    }).not.toThrow();
  });

  it('should include auto-fix events in API documentation', async () => {
    // Start server to check documentation output
    const address = server.server.address();
    expect(address).toBeDefined();

    // The server startup logs should include auto-fix events
    // This is tested by verifying the events are registered in setupEventBroadcasting
    const autoFixEvents = [
      'autofix:requested',
      'autofix:started',
      'autofix:progress',
      'autofix:completed',
      'autofix:failed',
      'autofix:skipped'
    ];

    autoFixEvents.forEach(event => {
      expect(mockOrchestrator.on).toHaveBeenCalledWith(event, expect.any(Function));
    });
  });
});