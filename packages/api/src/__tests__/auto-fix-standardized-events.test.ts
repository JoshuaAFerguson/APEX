/**
 * Integration test for standardized auto-fix WebSocket event broadcasting (v0.5.0)
 * Tests real WebSocket connections for auto-fix-start, auto-fix-progress, auto-fix-complete, and auto-fix-error events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import type { AutoFixEvent } from '@apexcli/core';
import { WebSocket } from 'ws';
import { createServer } from '../index.js';
import { AddressInfo } from 'net';

describe.skip('Standardized Auto-Fix WebSocket Broadcasting', () => {
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

  describe('Standardized Event Broadcasting', () => {
    it('should broadcast auto-fix-start events with full AutoFixEvent payload', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/test-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Create a standardized auto-fix-start event
      const autoFixStartEvent: AutoFixEvent = {
        id: 'test-autofix-123',
        eventType: 'auto-fix-start',
        taskId: 'test-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 3,
        currentFile: '/test/component.tsx',
        status: 'running',
        timestamp: new Date(),
        metadata: {
          fixType: 'imports',
          issuesDetected: 5,
        },
      };

      eventHandlers['auto-fix-start'](autoFixStartEvent);

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check that the WebSocket received the event with full payload
      const startMessage = messages.find(m => m.type === 'auto-fix-start');
      expect(startMessage).toBeDefined();
      expect(startMessage.taskId).toBe('test-task');
      expect(startMessage.data).toEqual(autoFixStartEvent);
      expect(startMessage.data.id).toBe('test-autofix-123');
      expect(startMessage.data.currentFile).toBe('/test/component.tsx');
      expect(startMessage.data.totalIterations).toBe(3);

      ws.close();
    });

    it('should broadcast auto-fix-progress events with issue details', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/progress-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Create a standardized auto-fix-progress event with issue details
      const autoFixProgressEvent: AutoFixEvent = {
        id: 'progress-autofix-456',
        eventType: 'auto-fix-progress',
        taskId: 'progress-task',
        filesModified: ['/test/utils.ts'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing import for React',
            filePath: '/test/utils.ts',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          },
          {
            type: 'import',
            description: 'Added missing import for useState',
            filePath: '/test/utils.ts',
            line: 2,
            column: 1,
            fixApplied: 'import { useState } from "react";',
            severity: 'warning',
          }
        ],
        iterationCount: 2,
        totalIterations: 3,
        currentFile: '/test/utils.ts',
        status: 'running',
        timestamp: new Date(),
        metadata: {
          fixType: 'imports',
          issuesFixed: 2,
          issuesRemaining: 1,
          currentFix: 'Processing import statements',
        },
      };

      eventHandlers['auto-fix-progress'](autoFixProgressEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const progressMessage = messages.find(m => m.type === 'auto-fix-progress');
      expect(progressMessage).toBeDefined();
      expect(progressMessage.data.issuesFixed).toHaveLength(2);
      expect(progressMessage.data.issuesFixed[0].type).toBe('import');
      expect(progressMessage.data.issuesFixed[0].description).toBe('Added missing import for React');
      expect(progressMessage.data.iterationCount).toBe(2);
      expect(progressMessage.data.status).toBe('running');

      ws.close();
    });

    it('should broadcast auto-fix-complete events with success details', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/complete-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Create a standardized auto-fix-complete event
      const autoFixCompleteEvent: AutoFixEvent = {
        id: 'complete-autofix-789',
        eventType: 'auto-fix-complete',
        taskId: 'complete-task',
        filesModified: ['/test/complete-file.ts'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added missing import for lodash',
            filePath: '/test/complete-file.ts',
            line: 1,
            column: 1,
            fixApplied: 'import _ from "lodash";',
            severity: 'error',
          }
        ],
        iterationCount: 3,
        totalIterations: 3,
        currentFile: '/test/complete-file.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: {
          fixType: 'imports',
          issuesDetected: 3,
          issuesFixed: 3,
          duration: 1500,
        },
      };

      eventHandlers['auto-fix-complete'](autoFixCompleteEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const completeMessage = messages.find(m => m.type === 'auto-fix-complete');
      expect(completeMessage).toBeDefined();
      expect(completeMessage.data.status).toBe('success');
      expect(completeMessage.data.iterationCount).toBe(3);
      expect(completeMessage.data.totalIterations).toBe(3);
      expect(completeMessage.data.metadata.duration).toBe(1500);

      ws.close();
    });

    it('should broadcast auto-fix-error events with error details', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/error-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Create a standardized auto-fix-error event
      const autoFixErrorEvent: AutoFixEvent = {
        id: 'error-autofix-999',
        eventType: 'auto-fix-error',
        taskId: 'error-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 2,
        currentFile: '/test/broken-file.ts',
        status: 'failed',
        timestamp: new Date(),
        error: 'Unable to parse TypeScript syntax: Unexpected token',
        metadata: {
          fixType: 'imports',
          issuesDetected: 0,
          issuesFixed: 0,
          errorType: 'SyntaxError',
        },
      };

      eventHandlers['auto-fix-error'](autoFixErrorEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const errorMessage = messages.find(m => m.type === 'auto-fix-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.status).toBe('failed');
      expect(errorMessage.data.error).toBe('Unable to parse TypeScript syntax: Unexpected token');
      expect(errorMessage.data.metadata.errorType).toBe('SyntaxError');

      ws.close();
    });
  });

  describe('Event Filtering for Standardized Events', () => {
    it('should filter standardized auto-fix events based on query parameters', async () => {
      // Connect with specific auto-fix event filter
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/filter-task?events=auto-fix-complete,auto-fix-error`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send various standardized events
      const baseEvent = {
        id: 'filter-test',
        taskId: 'filter-task',
        filesModified: ['/test/filter-file.ts'],
        issuesFixed: [],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test/filter-file.ts',
        status: 'running' as const,
        timestamp: new Date(),
        metadata: { fixType: 'imports' },
      };

      eventHandlers['auto-fix-start']({ ...baseEvent, eventType: 'auto-fix-start' });
      eventHandlers['auto-fix-progress']({ ...baseEvent, eventType: 'auto-fix-progress' });
      eventHandlers['auto-fix-complete']({ ...baseEvent, eventType: 'auto-fix-complete', status: 'success' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only receive task:state and auto-fix-complete (filtered)
      const eventTypes = messages.map(m => m.type);
      expect(eventTypes).toContain('task:state'); // Initial state
      expect(eventTypes).toContain('auto-fix-complete');
      expect(eventTypes).not.toContain('auto-fix-start');
      expect(eventTypes).not.toContain('auto-fix-progress');

      ws.close();
    });
  });

  describe('Complete Standardized Event Lifecycle', () => {
    it('should handle a complete standardized auto-fix lifecycle', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/lifecycle-task`);
      const messages: any[] = [];

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      const baseEventData = {
        id: 'lifecycle-test',
        taskId: 'lifecycle-task',
        filesModified: ['/test/lifecycle-file.ts'],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test/lifecycle-file.ts',
        timestamp: new Date(),
        metadata: { fixType: 'imports', issuesDetected: 2 },
      };

      // Step 1: Start
      eventHandlers['auto-fix-start']({
        ...baseEventData,
        eventType: 'auto-fix-start',
        issuesFixed: [],
        status: 'running',
      });

      // Step 2: Progress
      eventHandlers['auto-fix-progress']({
        ...baseEventData,
        eventType: 'auto-fix-progress',
        issuesFixed: [
          {
            type: 'import',
            description: 'Added import for React',
            filePath: '/test/lifecycle-file.ts',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          }
        ],
        status: 'running',
        metadata: { ...baseEventData.metadata, issuesFixed: 1, issuesRemaining: 1 },
      });

      // Step 3: Complete
      eventHandlers['auto-fix-complete']({
        ...baseEventData,
        eventType: 'auto-fix-complete',
        issuesFixed: [
          {
            type: 'import',
            description: 'Added import for React',
            filePath: '/test/lifecycle-file.ts',
            line: 1,
            column: 1,
            fixApplied: 'import React from "react";',
            severity: 'error',
          },
          {
            type: 'import',
            description: 'Added import for useState',
            filePath: '/test/lifecycle-file.ts',
            line: 2,
            column: 1,
            fixApplied: 'import { useState } from "react";',
            severity: 'warning',
          }
        ],
        status: 'success',
        metadata: { ...baseEventData.metadata, issuesFixed: 2, issuesRemaining: 0, duration: 750 },
      });

      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify complete lifecycle was broadcast
      const eventTypes = messages.map(m => m.type);
      expect(eventTypes).toContain('auto-fix-start');
      expect(eventTypes).toContain('auto-fix-progress');
      expect(eventTypes).toContain('auto-fix-complete');

      // Verify progression in issue fixing
      const startEvent = messages.find(m => m.type === 'auto-fix-start');
      const progressEvent = messages.find(m => m.type === 'auto-fix-progress');
      const completeEvent = messages.find(m => m.type === 'auto-fix-complete');

      expect(startEvent.data.issuesFixed).toHaveLength(0);
      expect(progressEvent.data.issuesFixed).toHaveLength(1);
      expect(completeEvent.data.issuesFixed).toHaveLength(2);
      expect(completeEvent.data.status).toBe('success');

      ws.close();
    });
  });

  describe('Multiple Clients and Performance', () => {
    it('should broadcast standardized events to multiple clients efficiently', async () => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/multi-task`);
      const ws2 = new WebSocket(`ws://127.0.0.1:${serverAddress.port}/stream/multi-task`);

      const messages1: any[] = [];
      const messages2: any[] = [];

      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      // Trigger standardized event
      const autoFixEvent: AutoFixEvent = {
        id: 'multi-client-test',
        eventType: 'auto-fix-complete',
        taskId: 'multi-task',
        filesModified: ['/test/shared-file.ts'],
        issuesFixed: [
          {
            type: 'import',
            description: 'Added import for lodash',
            filePath: '/test/shared-file.ts',
            line: 1,
            column: 1,
            fixApplied: 'import _ from "lodash";',
            severity: 'error',
          }
        ],
        iterationCount: 1,
        totalIterations: 1,
        currentFile: '/test/shared-file.ts',
        status: 'success',
        timestamp: new Date(),
        metadata: { fixType: 'imports', issuesDetected: 1, issuesFixed: 1 },
      };

      eventHandlers['auto-fix-complete'](autoFixEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Both clients should receive the event
      const event1 = messages1.find(m => m.type === 'auto-fix-complete');
      const event2 = messages2.find(m => m.type === 'auto-fix-complete');

      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
      expect(event1.data.id).toBe('multi-client-test');
      expect(event2.data.id).toBe('multi-client-test');

      ws1.close();
      ws2.close();
    });
  });
});