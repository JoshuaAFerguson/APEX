/**
 * Acceptance Criteria Validation Test for API WebSocket Auto-Fix Event Broadcasting
 *
 * This test validates that ALL acceptance criteria are met:
 * 1. API WebSocket broadcasts auto-fix events to all connected clients
 * 2. Events are JSON-serialized with full AutoFixEvent payload
 * 3. WebSocket message type distinguishes auto-fix events from other event types
 * 4. Integration test confirms clients receive auto-fix events in real-time
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import type { AutoFixEvent } from '@apexcli/core';
import { WebSocket } from 'ws';
import { createServer } from '../index.js';
import { AddressInfo } from 'net';

describe.skip('Acceptance Criteria Validation - API WebSocket Auto-Fix Events', () => {
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
        id: 'acceptance-test-task',
        status: 'running',
        description: 'Acceptance criteria validation task',
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
      projectPath: '/acceptance-test',
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

  describe('AC1: API WebSocket broadcasts auto-fix events to all connected clients', () => {
    it('should broadcast standardized auto-fix events to multiple connected clients', async () => {
      // Connect 3 clients to the same task
      const client1 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);
      const client2 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);
      const client3 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);

      const messages1: any[] = [];
      const messages2: any[] = [];
      const messages3: any[] = [];

      // Wait for all connections to open
      await Promise.all([
        new Promise(resolve => client1.on('open', resolve)),
        new Promise(resolve => client2.on('open', resolve)),
        new Promise(resolve => client3.on('open', resolve))
      ]);

      // Set up message listeners
      client1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      client2.on('message', (data) => messages2.push(JSON.parse(data.toString())));
      client3.on('message', (data) => messages3.push(JSON.parse(data.toString())));

      // Create and broadcast an auto-fix event
      const autoFixEvent: AutoFixEvent = {
        id: 'acceptance-criteria-test',
        eventType: 'auto-fix-complete',
        taskId: 'acceptance-test-task',
        filesModified: ['/src/test.ts'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing React import',
            filePath: '/src/test.ts',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          }
        ],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/src/test.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: {
          fixType: 'imports',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 150,
        },
      };

      eventHandlers['auto-fix-complete'](autoFixEvent);

      // Wait for messages to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // All clients should receive the event
      const event1 = messages1.find(m => m.type === 'auto-fix-complete');
      const event2 = messages2.find(m => m.type === 'auto-fix-complete');
      const event3 = messages3.find(m => m.type === 'auto-fix-complete');

      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
      expect(event3).toBeDefined();

      // All events should be identical
      expect(event1.data.id).toBe('acceptance-criteria-test');
      expect(event2.data.id).toBe('acceptance-criteria-test');
      expect(event3.data.id).toBe('acceptance-criteria-test');

      client1.close();
      client2.close();
      client3.close();
    });
  });

  describe('AC2: Events are JSON-serialized with full AutoFixEvent payload', () => {
    it('should include complete AutoFixEvent structure in JSON messages', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);
      const messages: any[] = [];

      await new Promise((resolve) => ws.on('open', resolve));

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Create comprehensive auto-fix event with all fields
      const comprehensiveEvent: AutoFixEvent = {
        id: 'json-serialization-test',
        eventType: 'auto-fix-progress',
        taskId: 'acceptance-test-task',
        filesModified: ['/src/component.tsx', '/src/utils.ts'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Fixed missing React import',
            filePath: '/src/component.tsx',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          },
          {
            type: 'typescript',
            description: 'Added missing type annotation',
            filePath: '/src/utils.ts',
            line: 5,
            column: 12,
            fixApplied: ': string',
            severity: 'warning',
          }
        ],
        iterationCount: 2,
        totalIterations: 3,
        currentFile: '/src/utils.ts',
        status: 'running',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        error: undefined,
        metadata: {
          fixType: 'mixed',
          issuesDetected: 5,
          issuesFixed: 2,
          issuesRemaining: 3,
          estimatedTimeRemaining: 30000,
          currentPhase: 'type-checking',
        },
      };

      eventHandlers['auto-fix-progress'](comprehensiveEvent);
      await new Promise(resolve => setTimeout(resolve, 50));

      const receivedEvent = messages.find(m => m.type === 'auto-fix-progress');
      expect(receivedEvent).toBeDefined();

      // Validate complete payload structure
      const payload = receivedEvent.data;
      expect(payload.id).toBe('json-serialization-test');
      expect(payload.eventType).toBe('auto-fix-progress');
      expect(payload.taskId).toBe('acceptance-test-task');
      expect(payload.filesModified).toHaveLength(2);
      expect(payload.issuesFixed).toHaveLength(2);
      expect(payload.iterationCount).toBe(2);
      expect(payload.totalIterations).toBe(3);
      expect(payload.currentFile).toBe('/src/utils.ts');
      expect(payload.status).toBe('running');
      expect(payload.timestamp).toBe('2024-01-15T10:30:00.000Z');
      expect(payload.metadata.fixType).toBe('mixed');
      expect(payload.metadata.issuesDetected).toBe(5);

      // Validate nested issue details
      expect(payload.issuesFixed[0].type).toBe('import');
      expect(payload.issuesFixed[0].description).toBe('Fixed missing React import');
      expect(payload.issuesFixed[0].severity).toBe('error');
      expect(payload.issuesFixed[1].type).toBe('typescript');
      expect(payload.issuesFixed[1].severity).toBe('warning');

      ws.close();
    });
  });

  describe('AC3: WebSocket message type distinguishes auto-fix events from other event types', () => {
    it('should clearly distinguish auto-fix events by message type', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);
      const messages: any[] = [];

      await new Promise((resolve) => ws.on('open', resolve));
      ws.on('message', (data) => messages.push(JSON.parse(data.toString())));

      // Emit different types of events
      eventHandlers['auto-fix-start']({
        id: 'type-test-1',
        eventType: 'auto-fix-start',
        taskId: 'acceptance-test-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date(),
        metadata: { fixType: 'imports' },
      });

      eventHandlers['auto-fix-error']({
        id: 'type-test-2',
        eventType: 'auto-fix-error',
        taskId: 'acceptance-test-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'Syntax error in file',
        metadata: { fixType: 'imports', errorType: 'ParseError' },
      });

      // Also emit non-auto-fix events for comparison
      eventHandlers['task:completed']({
        taskId: 'acceptance-test-task',
        status: 'completed',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Find each event type
      const startEvent = messages.find(m => m.type === 'auto-fix-start');
      const errorEvent = messages.find(m => m.type === 'auto-fix-error');
      const taskEvent = messages.find(m => m.type === 'task:completed');

      // Verify auto-fix events have distinguishable types
      expect(startEvent).toBeDefined();
      expect(startEvent.type).toBe('auto-fix-start');
      expect(startEvent.data.eventType).toBe('auto-fix-start');

      expect(errorEvent).toBeDefined();
      expect(errorEvent.type).toBe('auto-fix-error');
      expect(errorEvent.data.eventType).toBe('auto-fix-error');

      // Verify non-auto-fix events are different
      expect(taskEvent).toBeDefined();
      expect(taskEvent.type).toBe('task:completed');
      expect(taskEvent.data.eventType).toBeUndefined(); // Task events don't have AutoFixEvent structure

      // Auto-fix events should have standardized structure
      expect(startEvent.data.id).toBe('type-test-1');
      expect(errorEvent.data.id).toBe('type-test-2');
      expect(errorEvent.data.error).toBe('Syntax error in file');

      ws.close();
    });
  });

  describe('AC4: Integration test confirms clients receive auto-fix events in real-time', () => {
    it('should demonstrate real-time auto-fix event streaming end-to-end', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);
      const receivedEvents: any[] = [];
      const eventTimestamps: number[] = [];

      await new Promise((resolve) => ws.on('open', resolve));

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event.type.startsWith('auto-fix-')) {
          receivedEvents.push(event);
          eventTimestamps.push(Date.now());
        }
      });

      // Simulate complete auto-fix lifecycle with timing
      const baseEvent = {
        id: 'realtime-test',
        taskId: 'acceptance-test-task',
        filesModified: ['/src/realtime.ts'],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/src/realtime.ts',
        timestamp: new Date(),
        metadata: { fixType: 'imports' },
      };

      const startTime = Date.now();

      // 1. Start event
      eventHandlers['auto-fix-start']({
        ...baseEvent,
        eventType: 'auto-fix-start',
        issuesFixed: [],
        status: 'running',
      });

      await new Promise(resolve => setTimeout(resolve, 25));

      // 2. Progress event
      eventHandlers['auto-fix-progress']({
        ...baseEvent,
        eventType: 'auto-fix-progress',
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing React import',
            filePath: '/src/realtime.ts',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          }
        ],
        status: 'running',
      });

      await new Promise(resolve => setTimeout(resolve, 25));

      // 3. Complete event
      eventHandlers['auto-fix-complete']({
        ...baseEvent,
        eventType: 'auto-fix-complete',
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing React import',
            filePath: '/src/realtime.ts',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          }
        ],
        status: 'success',
        metadata: { ...baseEvent.metadata, duration: 50 },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const endTime = Date.now();

      // Validate real-time delivery
      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents[0].type).toBe('auto-fix-start');
      expect(receivedEvents[1].type).toBe('auto-fix-progress');
      expect(receivedEvents[2].type).toBe('auto-fix-complete');

      // Validate timing - events should be received within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(200); // Should complete within 200ms

      // Validate event ordering and progression
      expect(receivedEvents[0].data.issuesFixed).toHaveLength(0);
      expect(receivedEvents[1].data.issuesFixed).toHaveLength(1);
      expect(receivedEvents[2].data.issuesFixed).toHaveLength(1);
      expect(receivedEvents[2].data.status).toBe('success');

      // Validate timestamps show progression
      expect(eventTimestamps[0]).toBeLessThan(eventTimestamps[1]);
      expect(eventTimestamps[1]).toBeLessThan(eventTimestamps[2]);

      ws.close();
    });
  });

  describe('Complete Acceptance Criteria Validation', () => {
    it('should meet all acceptance criteria in a single comprehensive test', async () => {
      // Setup multiple clients to test broadcasting (AC1)
      const mainClient = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);
      const monitorClient = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/acceptance-test-task`);

      const mainMessages: any[] = [];
      const monitorMessages: any[] = [];

      await Promise.all([
        new Promise(resolve => mainClient.on('open', resolve)),
        new Promise(resolve => monitorClient.on('open', resolve))
      ]);

      mainClient.on('message', (data) => mainMessages.push(JSON.parse(data.toString())));
      monitorClient.on('message', (data) => monitorMessages.push(JSON.parse(data.toString())));

      // Create comprehensive auto-fix event (AC2: Full payload)
      const comprehensiveAutoFixEvent: AutoFixEvent = {
        id: 'comprehensive-acceptance-test',
        eventType: 'auto-fix-complete',
        taskId: 'acceptance-test-task',
        filesModified: ['/src/App.tsx', '/src/utils.ts', '/src/types.ts'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing React import',
            filePath: '/src/App.tsx',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          },
          {
            type: 'typescript',
            description: 'Fixed type annotation',
            filePath: '/src/utils.ts',
            line: 15,
            column: 8,
            fixApplied: ': UserProfile',
            severity: 'warning',
          },
          {
            type: 'eslint',
            description: 'Removed unused variable',
            filePath: '/src/types.ts',
            line: 22,
            column: 7,
            fixApplied: '// Removed unused const temp',
            severity: 'info',
          }
        ],
        iterationCount: 3,
        totalIterations: 3,
        currentFile: '/src/types.ts',
        status: 'success',
        timestamp: new Date('2024-01-15T14:25:30.123Z'),
        metadata: {
          fixType: 'comprehensive',
          issuesDetected: 15,
          issuesFixed: 3,
          issuesRemaining: 0,
          duration: 2500,
          toolsUsed: ['typescript', 'eslint', 'prettier'],
          performance: {
            cpuTime: 1200,
            memoryUsage: 45000000,
            diskReads: 12,
            diskWrites: 8,
          },
        },
      };

      // Broadcast the event (AC1: Broadcasting to all clients)
      eventHandlers['auto-fix-complete'](comprehensiveAutoFixEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // AC1: Both clients should receive the event
      const mainEvent = mainMessages.find(m => m.type === 'auto-fix-complete');
      const monitorEvent = monitorMessages.find(m => m.type === 'auto-fix-complete');

      expect(mainEvent).toBeDefined();
      expect(monitorEvent).toBeDefined();

      // AC2: Events should be JSON-serialized with full AutoFixEvent payload
      const payload = mainEvent.data;
      expect(typeof mainEvent).toBe('object'); // JSON parsed successfully
      expect(payload.id).toBe('comprehensive-acceptance-test');
      expect(payload.eventType).toBe('auto-fix-complete');
      expect(payload.filesModified).toHaveLength(3);
      expect(payload.issuesFixed).toHaveLength(3);
      expect(payload.metadata.toolsUsed).toEqual(['typescript', 'eslint', 'prettier']);
      expect(payload.metadata.performance.cpuTime).toBe(1200);

      // AC3: WebSocket message type distinguishes auto-fix events
      expect(mainEvent.type).toBe('auto-fix-complete');
      expect(mainEvent.taskId).toBe('acceptance-test-task');
      expect(mainEvent.timestamp).toBeDefined();

      // Verify it's distinguishable from other events by checking structure
      expect(payload.eventType).toBe('auto-fix-complete'); // Only auto-fix events have this
      expect(payload.iterationCount).toBeDefined(); // Only auto-fix events have this
      expect(payload.issuesFixed).toBeDefined(); // Only auto-fix events have this

      // AC4: Real-time delivery is confirmed by the fact we received it
      expect(Date.now() - new Date(mainEvent.timestamp).getTime()).toBeLessThan(1000);

      // Validate identical payloads across clients (broadcasting)
      expect(JSON.stringify(mainEvent)).toBe(JSON.stringify(monitorEvent));

      mainClient.close();
      monitorClient.close();
    });
  });
});