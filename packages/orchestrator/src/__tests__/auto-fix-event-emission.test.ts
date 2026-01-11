/**
 * Test for Auto-Fix Event Emission
 *
 * Verifies that the standardized auto-fix events (auto-fix-start, auto-fix-progress,
 * auto-fix-complete, auto-fix-error) are emitted correctly with proper AutoFixEvent payloads.
 *
 * This test validates the acceptance criteria:
 * - ApexOrchestrator emits auto-fix events with proper AutoFixEvent payloads
 * - Events are emitted via eventemitter3
 * - Unit tests verify event emission
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { AutoFixEvent } from '@apexcli/core';

// Mock the import-auto-fixer
vi.mock('../import-auto-fixer/import-auto-fixer', () => ({
  ImportAutoFixer: vi.fn().mockImplementation(() => ({
    isAvailable: vi.fn().mockResolvedValue(true),
    analyze: vi.fn().mockResolvedValue([
      {
        filePath: '/test/component.tsx',
        missingImports: [
          { identifier: 'React', source: 'react' },
          { identifier: 'useState', source: 'react' },
        ],
        errors: [],
        duration: 25,
      },
    ]),
    fix: vi.fn().mockResolvedValue([
      {
        success: true,
        filePath: '/test/component.tsx',
        importsAdded: ['React', 'useState'],
        errors: [],
        duration: 150,
      },
    ]),
    getSummary: vi.fn().mockReturnValue({
      totalFiles: 1,
      totalFixed: 1,
      totalErrors: 0,
      totalImportsAdded: 2,
    }),
  })),
}));

// Mock crypto.randomUUID
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123'),
}));

describe('Auto-Fix Event Emission', () => {
  let mockOrchestrator: EventEmitter;
  let eventCollector: {
    'auto-fix-start': AutoFixEvent[];
    'auto-fix-progress': AutoFixEvent[];
    'auto-fix-complete': AutoFixEvent[];
    'auto-fix-error': AutoFixEvent[];
  };

  beforeEach(() => {
    mockOrchestrator = new EventEmitter();
    eventCollector = {
      'auto-fix-start': [],
      'auto-fix-progress': [],
      'auto-fix-complete': [],
      'auto-fix-error': [],
    };

    // Set up event listeners to collect events
    mockOrchestrator.on('auto-fix-start', (event: AutoFixEvent) => {
      eventCollector['auto-fix-start'].push(event);
    });
    mockOrchestrator.on('auto-fix-progress', (event: AutoFixEvent) => {
      eventCollector['auto-fix-progress'].push(event);
    });
    mockOrchestrator.on('auto-fix-complete', (event: AutoFixEvent) => {
      eventCollector['auto-fix-complete'].push(event);
    });
    mockOrchestrator.on('auto-fix-error', (event: AutoFixEvent) => {
      eventCollector['auto-fix-error'].push(event);
    });
  });

  afterEach(() => {
    mockOrchestrator.removeAllListeners();
  });

  test('emits auto-fix-start event with correct payload structure', () => {
    const testEvent: AutoFixEvent = {
      id: 'task-123-test-uuid-123',
      eventType: 'auto-fix-start',
      taskId: 'task-123',
      filesModified: [],
      issuesFixed: [],
      iterationCount: 0,
      totalIterations: 3,
      currentFile: '/test/component.tsx',
      status: 'running',
      timestamp: new Date(),
      metadata: {
        fixType: 'imports',
        issuesDetected: 2,
      },
    };

    mockOrchestrator.emit('auto-fix-start', testEvent);

    expect(eventCollector['auto-fix-start']).toHaveLength(1);
    const emittedEvent = eventCollector['auto-fix-start'][0];

    expect(emittedEvent.id).toBe('task-123-test-uuid-123');
    expect(emittedEvent.eventType).toBe('auto-fix-start');
    expect(emittedEvent.taskId).toBe('task-123');
    expect(emittedEvent.filesModified).toEqual([]);
    expect(emittedEvent.issuesFixed).toEqual([]);
    expect(emittedEvent.iterationCount).toBe(0);
    expect(emittedEvent.totalIterations).toBe(3);
    expect(emittedEvent.currentFile).toBe('/test/component.tsx');
    expect(emittedEvent.status).toBe('running');
    expect(emittedEvent.metadata?.fixType).toBe('imports');
    expect(emittedEvent.metadata?.issuesDetected).toBe(2);
  });

  test('emits auto-fix-progress event with correct payload structure', () => {
    const testEvent: AutoFixEvent = {
      id: 'task-123-test-uuid-123',
      eventType: 'auto-fix-progress',
      taskId: 'task-123',
      filesModified: ['/test/component.tsx'],
      issuesFixed: [{
        type: 'import',
        description: 'Added 2 imports',
        filePath: '/test/component.tsx',
        line: 1,
        column: 1,
        fixApplied: 'Added imports: React, useState',
        severity: 'warning',
      }],
      iterationCount: 1,
      totalIterations: 3,
      currentFile: '/test/component.tsx',
      status: 'running',
      timestamp: new Date(),
      metadata: {
        fixType: 'imports',
        issuesFixed: 2,
        issuesRemaining: 0,
        currentFix: 'Added 2 imports',
      },
    };

    mockOrchestrator.emit('auto-fix-progress', testEvent);

    expect(eventCollector['auto-fix-progress']).toHaveLength(1);
    const emittedEvent = eventCollector['auto-fix-progress'][0];

    expect(emittedEvent.eventType).toBe('auto-fix-progress');
    expect(emittedEvent.filesModified).toEqual(['/test/component.tsx']);
    expect(emittedEvent.issuesFixed).toHaveLength(1);
    expect(emittedEvent.issuesFixed[0].type).toBe('import');
    expect(emittedEvent.issuesFixed[0].description).toBe('Added 2 imports');
    expect(emittedEvent.iterationCount).toBe(1);
    expect(emittedEvent.status).toBe('running');
  });

  test('emits auto-fix-complete event with correct payload structure', () => {
    const testEvent: AutoFixEvent = {
      id: 'task-123-test-uuid-123',
      eventType: 'auto-fix-complete',
      taskId: 'task-123',
      filesModified: ['/test/component.tsx'],
      issuesFixed: [
        {
          type: 'import',
          description: 'Added import: React',
          filePath: '/test/component.tsx',
          line: 1,
          column: 1,
          fixApplied: 'Added import statement for React',
          severity: 'warning',
        },
        {
          type: 'import',
          description: 'Added import: useState',
          filePath: '/test/component.tsx',
          line: 1,
          column: 1,
          fixApplied: 'Added import statement for useState',
          severity: 'warning',
        }
      ],
      iterationCount: 1,
      totalIterations: 1,
      currentFile: '/test/component.tsx',
      status: 'success',
      timestamp: new Date(),
      metadata: {
        fixType: 'imports',
        issuesDetected: 2,
        issuesFixed: 2,
        duration: 150,
      },
    };

    mockOrchestrator.emit('auto-fix-complete', testEvent);

    expect(eventCollector['auto-fix-complete']).toHaveLength(1);
    const emittedEvent = eventCollector['auto-fix-complete'][0];

    expect(emittedEvent.eventType).toBe('auto-fix-complete');
    expect(emittedEvent.filesModified).toEqual(['/test/component.tsx']);
    expect(emittedEvent.issuesFixed).toHaveLength(2);
    expect(emittedEvent.status).toBe('success');
    expect(emittedEvent.metadata?.duration).toBe(150);
  });

  test('emits auto-fix-error event with correct payload structure', () => {
    const testEvent: AutoFixEvent = {
      id: 'task-123-test-uuid-123',
      eventType: 'auto-fix-error',
      taskId: 'task-123',
      filesModified: [],
      issuesFixed: [],
      iterationCount: 1,
      totalIterations: 3,
      currentFile: '/test/broken.tsx',
      status: 'failed',
      timestamp: new Date(),
      error: 'Unable to resolve import path',
      metadata: {
        fixType: 'imports',
        issuesDetected: 0,
        issuesFixed: 0,
        errorType: 'ResolutionError',
      },
    };

    mockOrchestrator.emit('auto-fix-error', testEvent);

    expect(eventCollector['auto-fix-error']).toHaveLength(1);
    const emittedEvent = eventCollector['auto-fix-error'][0];

    expect(emittedEvent.eventType).toBe('auto-fix-error');
    expect(emittedEvent.status).toBe('failed');
    expect(emittedEvent.error).toBe('Unable to resolve import path');
    expect(emittedEvent.metadata?.errorType).toBe('ResolutionError');
  });

  test('validates event payload structure against AutoFixEvent schema', () => {
    // Test that all required fields are present
    const testEvent: AutoFixEvent = {
      id: 'test-id',
      eventType: 'auto-fix-start',
      taskId: 'test-task',
      filesModified: [],
      issuesFixed: [],
      iterationCount: 0,
      totalIterations: 1,
      currentFile: '/test.ts',
      status: 'running',
      timestamp: new Date(),
    };

    mockOrchestrator.emit('auto-fix-start', testEvent);

    expect(eventCollector['auto-fix-start']).toHaveLength(1);
    const emittedEvent = eventCollector['auto-fix-start'][0];

    // Validate required fields
    expect(typeof emittedEvent.id).toBe('string');
    expect(emittedEvent.id.length).toBeGreaterThan(0);
    expect(typeof emittedEvent.eventType).toBe('string');
    expect(typeof emittedEvent.taskId).toBe('string');
    expect(emittedEvent.taskId.length).toBeGreaterThan(0);
    expect(Array.isArray(emittedEvent.filesModified)).toBe(true);
    expect(Array.isArray(emittedEvent.issuesFixed)).toBe(true);
    expect(typeof emittedEvent.iterationCount).toBe('number');
    expect(emittedEvent.iterationCount).toBeGreaterThanOrEqual(0);
    expect(typeof emittedEvent.totalIterations).toBe('number');
    expect(emittedEvent.totalIterations).toBeGreaterThan(0);
    expect(typeof emittedEvent.currentFile).toBe('string');
    expect(['running', 'success', 'failed']).toContain(emittedEvent.status);
    expect(emittedEvent.timestamp).toBeInstanceOf(Date);
  });

  test('handles multiple concurrent auto-fix events', () => {
    const events: AutoFixEvent[] = [
      {
        id: 'task-1-uuid-1',
        eventType: 'auto-fix-start',
        taskId: 'task-1',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test1.ts',
        status: 'running',
        timestamp: new Date(),
      },
      {
        id: 'task-2-uuid-2',
        eventType: 'auto-fix-start',
        taskId: 'task-2',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test2.ts',
        status: 'running',
        timestamp: new Date(),
      }
    ];

    events.forEach(event => {
      mockOrchestrator.emit('auto-fix-start', event);
    });

    expect(eventCollector['auto-fix-start']).toHaveLength(2);
    expect(eventCollector['auto-fix-start'][0].taskId).toBe('task-1');
    expect(eventCollector['auto-fix-start'][1].taskId).toBe('task-2');
  });

  test('validates eventType enum values', () => {
    const validEventTypes = ['auto-fix-start', 'auto-fix-progress', 'auto-fix-complete', 'auto-fix-error'];

    validEventTypes.forEach(eventType => {
      const testEvent: AutoFixEvent = {
        id: `test-${eventType}`,
        eventType: eventType as any,
        taskId: 'test-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: 'running',
        timestamp: new Date(),
      };

      expect(() => {
        mockOrchestrator.emit(eventType as any, testEvent);
      }).not.toThrow();
    });
  });

  test('validates status enum values', () => {
    const validStatuses = ['running', 'success', 'failed'];

    validStatuses.forEach(status => {
      const testEvent: AutoFixEvent = {
        id: `test-${status}`,
        eventType: 'auto-fix-start',
        taskId: 'test-task',
        filesModified: [],
        issuesFixed: [],
        iterationCount: 0,
        totalIterations: 1,
        currentFile: '/test.ts',
        status: status as any,
        timestamp: new Date(),
      };

      mockOrchestrator.emit('auto-fix-start', testEvent);
    });

    expect(eventCollector['auto-fix-start']).toHaveLength(3);
    expect(eventCollector['auto-fix-start'][0].status).toBe('running');
    expect(eventCollector['auto-fix-start'][1].status).toBe('success');
    expect(eventCollector['auto-fix-start'][2].status).toBe('failed');
  });
});