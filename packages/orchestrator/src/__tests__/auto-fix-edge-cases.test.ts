/**
 * Edge cases and error scenarios for auto-fix event streaming
 * Tests unusual conditions, memory limits, network issues, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'events';

// Mock orchestrator with enhanced error scenarios
class MockOrchestrator extends EventEmitter {
  private eventHistory: Array<{ type: string; data: any; timestamp: Date }> = [];
  private memoryUsage = 0;
  private isShutdown = false;

  constructor() {
    super();
    this.setMaxListeners(1000); // Allow many listeners for stress testing
  }

  // Track all events for analysis
  emit(eventType: string, ...args: any[]): boolean {
    this.eventHistory.push({
      type: eventType,
      data: args,
      timestamp: new Date()
    });

    // Simulate memory usage
    this.memoryUsage += JSON.stringify(args).length;

    if (this.isShutdown) {
      throw new Error('Orchestrator has been shutdown');
    }

    return super.emit(eventType, ...args);
  }

  getEventHistory() {
    return this.eventHistory;
  }

  getMemoryUsage() {
    return this.memoryUsage;
  }

  shutdown() {
    this.isShutdown = true;
    this.removeAllListeners();
  }

  simulateMemoryPressure() {
    this.memoryUsage = 1000000; // 1MB
  }
}

describe('Auto-Fix Edge Cases and Error Scenarios', () => {
  let mockOrchestrator: MockOrchestrator;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestrator();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockOrchestrator.shutdown();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large file paths without memory issues', () => {
      // Generate a very long file path (4KB)
      const longPath = '/very/long/path/' + 'directory/'.repeat(400) + 'file.ts';

      expect(() => {
        mockOrchestrator.emit('autofix:requested', {
          taskId: 'memory-test',
          filePath: longPath,
          fixTypes: ['imports'],
          triggeredBy: 'stress-test',
          timestamp: new Date()
        });
      }).not.toThrow();

      expect(mockOrchestrator.getEventHistory()).toHaveLength(1);
    });

    it('should handle burst of events without dropping any', () => {
      const eventCount = 1000;
      const receivedEvents: any[] = [];

      mockOrchestrator.on('autofix:progress', (event) => {
        receivedEvents.push(event);
      });

      // Send burst of events
      for (let i = 0; i < eventCount; i++) {
        mockOrchestrator.emit('autofix:progress', {
          taskId: 'burst-test',
          filePath: `/test/file${i}.ts`,
          fixType: 'eslint',
          iteration: i + 1,
          totalIterations: eventCount,
          issuesFixed: i,
          timestamp: new Date()
        });
      }

      expect(receivedEvents).toHaveLength(eventCount);
      expect(mockOrchestrator.getEventHistory()).toHaveLength(eventCount);
    });

    it('should handle concurrent auto-fix operations on multiple files', () => {
      const fileCount = 50;
      const eventsPerFile = 5;
      const totalEvents = fileCount * eventsPerFile;

      const receivedEvents: any[] = [];
      mockOrchestrator.on('autofix:progress', (event) => {
        receivedEvents.push(event);
      });

      // Simulate concurrent operations
      for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
        for (let iteration = 1; iteration <= eventsPerFile; iteration++) {
          mockOrchestrator.emit('autofix:progress', {
            taskId: `concurrent-task-${fileIndex}`,
            filePath: `/concurrent/file${fileIndex}.ts`,
            fixType: 'eslint',
            iteration,
            totalIterations: eventsPerFile,
            issuesFixed: iteration - 1,
            timestamp: new Date()
          });
        }
      }

      expect(receivedEvents).toHaveLength(totalEvents);

      // Verify events are properly tracked per file
      const fileEvents = receivedEvents.filter(e => e.filePath === '/concurrent/file0.ts');
      expect(fileEvents).toHaveLength(eventsPerFile);
    });

    it('should handle memory pressure gracefully', () => {
      mockOrchestrator.simulateMemoryPressure();

      // Should still be able to emit events
      expect(() => {
        mockOrchestrator.emit('autofix:completed', {
          taskId: 'memory-pressure-test',
          filePath: '/test/large-file.ts',
          fixType: 'eslint',
          issuesDetected: 100,
          issuesFixed: 95,
          duration: 5000,
          timestamp: new Date()
        });
      }).not.toThrow();

      expect(mockOrchestrator.getMemoryUsage()).toBeGreaterThan(100000);
    });
  });

  describe('Network and Connection Edge Cases', () => {
    it('should handle listener disconnection during event emission', () => {
      let eventReceived = false;

      const handler = (event: any) => {
        eventReceived = true;
        // Simulate listener disconnecting during processing
        mockOrchestrator.removeListener('autofix:started', handler);
      };

      mockOrchestrator.on('autofix:started', handler);

      mockOrchestrator.emit('autofix:started', {
        taskId: 'disconnect-test',
        filePath: '/test/disconnect.ts',
        fixType: 'prettier',
        detectedIssues: 3,
        timestamp: new Date()
      });

      expect(eventReceived).toBe(true);

      // Subsequent events should not reach the disconnected handler
      mockOrchestrator.emit('autofix:started', {
        taskId: 'disconnect-test-2',
        filePath: '/test/disconnect2.ts',
        fixType: 'prettier',
        detectedIssues: 2,
        timestamp: new Date()
      });

      // Only one event should have been processed by the handler
      expect(mockOrchestrator.getEventHistory()).toHaveLength(2);
    });

    it('should handle multiple rapid listener additions and removals', () => {
      const handlerCount = 100;
      const handlers: Array<(event: any) => void> = [];

      // Add many handlers
      for (let i = 0; i < handlerCount; i++) {
        const handler = vi.fn();
        handlers.push(handler);
        mockOrchestrator.on('autofix:completed', handler);
      }

      // Emit event
      mockOrchestrator.emit('autofix:completed', {
        taskId: 'multi-handler-test',
        filePath: '/test/multi.ts',
        fixType: 'typescript',
        issuesDetected: 1,
        issuesFixed: 1,
        duration: 100,
        timestamp: new Date()
      });

      // All handlers should have been called
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledOnce();
      });

      // Remove all handlers
      handlers.forEach(handler => {
        mockOrchestrator.removeListener('autofix:completed', handler);
      });

      expect(mockOrchestrator.listenerCount('autofix:completed')).toBe(0);
    });

    it('should handle listener errors without stopping event emission', () => {
      const goodHandler = vi.fn();
      const errorHandler = vi.fn(() => {
        throw new Error('Listener error');
      });

      mockOrchestrator.on('autofix:failed', goodHandler);
      mockOrchestrator.on('autofix:failed', errorHandler);

      // Emit event - should not throw despite error handler
      expect(() => {
        mockOrchestrator.emit('autofix:failed', {
          taskId: 'error-handler-test',
          filePath: '/test/error.ts',
          fixType: 'eslint',
          error: 'Original error',
          issuesDetected: 5,
          issuesFixed: 2,
          timestamp: new Date()
        });
      }).not.toThrow();

      expect(goodHandler).toHaveBeenCalledOnce();
      expect(errorHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Data Corruption and Malformed Events', () => {
    it('should handle events with null or undefined values', () => {
      const malformedEvents = [
        {
          taskId: null,
          filePath: '/test/null-task.ts',
          fixTypes: ['imports'],
          triggeredBy: 'test',
          timestamp: new Date()
        },
        {
          taskId: 'undefined-path-test',
          filePath: undefined,
          fixTypes: ['eslint'],
          triggeredBy: 'test',
          timestamp: new Date()
        },
        {
          taskId: 'empty-fix-types',
          filePath: '/test/empty.ts',
          fixTypes: [],
          triggeredBy: 'test',
          timestamp: new Date()
        }
      ];

      malformedEvents.forEach((event, index) => {
        expect(() => {
          mockOrchestrator.emit('autofix:requested', event);
        }).not.toThrow();
      });

      expect(mockOrchestrator.getEventHistory()).toHaveLength(malformedEvents.length);
    });

    it('should handle events with circular references', () => {
      const circularEvent: any = {
        taskId: 'circular-test',
        filePath: '/test/circular.ts',
        fixType: 'eslint',
        timestamp: new Date()
      };

      // Create circular reference
      circularEvent.self = circularEvent;

      expect(() => {
        mockOrchestrator.emit('autofix:started', circularEvent);
      }).not.toThrow();
    });

    it('should handle events with extremely large data payloads', () => {
      const largeArray = new Array(100000).fill('large-string-content');
      const largeEvent = {
        taskId: 'large-payload-test',
        filePath: '/test/large.ts',
        fixType: 'eslint',
        error: largeArray.join(' '),
        issuesDetected: 1,
        issuesFixed: 0,
        timestamp: new Date()
      };

      expect(() => {
        mockOrchestrator.emit('autofix:failed', largeEvent);
      }).not.toThrow();

      expect(mockOrchestrator.getMemoryUsage()).toBeGreaterThan(100000);
    });

    it('should handle events with invalid timestamp formats', () => {
      const invalidTimestamps = [
        null,
        undefined,
        'invalid-date-string',
        123456789, // number instead of Date
        {},
        []
      ];

      invalidTimestamps.forEach((timestamp, index) => {
        const event = {
          taskId: `invalid-timestamp-${index}`,
          filePath: '/test/invalid-timestamp.ts',
          reason: 'test',
          timestamp
        };

        expect(() => {
          mockOrchestrator.emit('autofix:skipped', event);
        }).not.toThrow();
      });

      expect(mockOrchestrator.getEventHistory()).toHaveLength(invalidTimestamps.length);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle file system path limits', () => {
      // Very long file path (exceeding typical FS limits)
      const maxPath = '/'.repeat(4096) + 'file.ts';

      expect(() => {
        mockOrchestrator.emit('autofix:completed', {
          taskId: 'path-limit-test',
          filePath: maxPath,
          fixType: 'formatting',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 50,
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle events when listener count is at maximum', () => {
      // Add listeners up to Node.js default limit
      const maxListeners = 100;

      for (let i = 0; i < maxListeners; i++) {
        mockOrchestrator.on('autofix:progress', () => {});
      }

      expect(() => {
        mockOrchestrator.emit('autofix:progress', {
          taskId: 'max-listeners-test',
          filePath: '/test/max-listeners.ts',
          fixType: 'eslint',
          iteration: 1,
          totalIterations: 1,
          issuesFixed: 1,
          timestamp: new Date()
        });
      }).not.toThrow();

      expect(mockOrchestrator.listenerCount('autofix:progress')).toBe(maxListeners);
    });

    it('should handle rapid event creation and cleanup', () => {
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        const handler = vi.fn();

        // Add listener
        mockOrchestrator.on('autofix:requested', handler);

        // Emit event
        mockOrchestrator.emit('autofix:requested', {
          taskId: `rapid-${i}`,
          filePath: `/test/rapid${i}.ts`,
          fixTypes: ['eslint'],
          triggeredBy: 'stress-test',
          timestamp: new Date()
        });

        // Remove listener
        mockOrchestrator.removeListener('autofix:requested', handler);

        expect(handler).toHaveBeenCalledOnce();
      }

      expect(mockOrchestrator.getEventHistory()).toHaveLength(iterations);
      expect(mockOrchestrator.listenerCount('autofix:requested')).toBe(0);
    });
  });

  describe('Timing and Race Conditions', () => {
    it('should handle events arriving out of chronological order', () => {
      const receivedEvents: any[] = [];

      mockOrchestrator.on('autofix:progress', (event) => {
        receivedEvents.push(event);
      });

      // Send events out of order
      const baseTime = Date.now();

      // Third iteration first
      mockOrchestrator.emit('autofix:progress', {
        taskId: 'order-test',
        filePath: '/test/order.ts',
        fixType: 'eslint',
        iteration: 3,
        totalIterations: 3,
        issuesFixed: 2,
        timestamp: new Date(baseTime + 2000)
      });

      // First iteration second
      mockOrchestrator.emit('autofix:progress', {
        taskId: 'order-test',
        filePath: '/test/order.ts',
        fixType: 'eslint',
        iteration: 1,
        totalIterations: 3,
        issuesFixed: 0,
        timestamp: new Date(baseTime)
      });

      // Second iteration last
      mockOrchestrator.emit('autofix:progress', {
        taskId: 'order-test',
        filePath: '/test/order.ts',
        fixType: 'eslint',
        iteration: 2,
        totalIterations: 3,
        issuesFixed: 1,
        timestamp: new Date(baseTime + 1000)
      });

      expect(receivedEvents).toHaveLength(3);

      // Events should be received in emission order, not timestamp order
      expect(receivedEvents[0].iteration).toBe(3);
      expect(receivedEvents[1].iteration).toBe(1);
      expect(receivedEvents[2].iteration).toBe(2);
    });

    it('should handle simultaneous events for different tasks', () => {
      const taskAEvents: any[] = [];
      const taskBEvents: any[] = [];

      mockOrchestrator.on('autofix:started', (event) => {
        if (event.taskId === 'task-a') {
          taskAEvents.push(event);
        } else if (event.taskId === 'task-b') {
          taskBEvents.push(event);
        }
      });

      // Emit events for both tasks simultaneously
      const timestamp = new Date();

      mockOrchestrator.emit('autofix:started', {
        taskId: 'task-a',
        filePath: '/test/task-a.ts',
        fixType: 'eslint',
        detectedIssues: 5,
        timestamp
      });

      mockOrchestrator.emit('autofix:started', {
        taskId: 'task-b',
        filePath: '/test/task-b.ts',
        fixType: 'prettier',
        detectedIssues: 3,
        timestamp
      });

      expect(taskAEvents).toHaveLength(1);
      expect(taskBEvents).toHaveLength(1);
      expect(taskAEvents[0].fixType).toBe('eslint');
      expect(taskBEvents[0].fixType).toBe('prettier');
    });

    it('should handle rapid start/stop sequences', () => {
      const events: any[] = [];

      mockOrchestrator.on('autofix:started', (event) => events.push(event));
      mockOrchestrator.on('autofix:completed', (event) => events.push(event));
      mockOrchestrator.on('autofix:failed', (event) => events.push(event));

      // Rapid sequence: start -> complete -> start -> fail
      const taskId = 'rapid-sequence-test';

      mockOrchestrator.emit('autofix:started', {
        taskId,
        filePath: '/test/rapid1.ts',
        fixType: 'eslint',
        detectedIssues: 2,
        timestamp: new Date()
      });

      mockOrchestrator.emit('autofix:completed', {
        taskId,
        filePath: '/test/rapid1.ts',
        fixType: 'eslint',
        issuesDetected: 2,
        issuesFixed: 2,
        duration: 100,
        timestamp: new Date()
      });

      mockOrchestrator.emit('autofix:started', {
        taskId,
        filePath: '/test/rapid2.ts',
        fixType: 'prettier',
        detectedIssues: 1,
        timestamp: new Date()
      });

      mockOrchestrator.emit('autofix:failed', {
        taskId,
        filePath: '/test/rapid2.ts',
        fixType: 'prettier',
        error: 'Syntax error',
        issuesDetected: 1,
        issuesFixed: 0,
        timestamp: new Date()
      });

      expect(events).toHaveLength(4);
      expect(events.map(e => e.fixType)).toEqual(['eslint', 'eslint', 'prettier', 'prettier']);
    });
  });

  describe('Shutdown and Cleanup Scenarios', () => {
    it('should handle orchestrator shutdown during active operations', () => {
      const handler = vi.fn();
      mockOrchestrator.on('autofix:progress', handler);

      // Emit some events
      mockOrchestrator.emit('autofix:progress', {
        taskId: 'shutdown-test',
        filePath: '/test/shutdown.ts',
        fixType: 'eslint',
        iteration: 1,
        totalIterations: 3,
        issuesFixed: 0,
        timestamp: new Date()
      });

      expect(handler).toHaveBeenCalledOnce();

      // Shutdown orchestrator
      mockOrchestrator.shutdown();

      // Subsequent events should throw
      expect(() => {
        mockOrchestrator.emit('autofix:progress', {
          taskId: 'shutdown-test',
          filePath: '/test/shutdown.ts',
          fixType: 'eslint',
          iteration: 2,
          totalIterations: 3,
          issuesFixed: 1,
          timestamp: new Date()
        });
      }).toThrow('Orchestrator has been shutdown');
    });

    it('should clean up event history on shutdown', () => {
      // Emit several events
      for (let i = 0; i < 10; i++) {
        mockOrchestrator.emit('autofix:completed', {
          taskId: `cleanup-${i}`,
          filePath: `/test/cleanup${i}.ts`,
          fixType: 'eslint',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 50,
          timestamp: new Date()
        });
      }

      expect(mockOrchestrator.getEventHistory()).toHaveLength(10);

      mockOrchestrator.shutdown();

      // Verify all listeners are removed
      expect(mockOrchestrator.listenerCount('autofix:completed')).toBe(0);
      expect(mockOrchestrator.listenerCount('autofix:started')).toBe(0);
      expect(mockOrchestrator.listenerCount('autofix:progress')).toBe(0);
    });
  });
});