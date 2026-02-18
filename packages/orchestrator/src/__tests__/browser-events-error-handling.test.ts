/**
 * Browser Events Error Handling and Edge Cases Tests
 *
 * Comprehensive tests for error handling and edge cases in the browser
 * event integration system. Focuses on resilience, graceful degradation,
 * and proper error propagation.
 *
 * Test areas:
 * - Event handler errors and recovery
 * - Malformed event data handling
 * - Memory leak prevention
 * - Resource cleanup on errors
 * - Network failure simulation
 * - Browser crash simulation
 * - Performance degradation scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserManager } from '../browser-manager.js';
import type {
  BrowserManagerLaunchedEvent,
  BrowserManagerErrorEvent,
  BrowserConsoleEvent,
} from '../index.js';

// Mock dependencies
vi.mock('../store.js');

describe('Browser Events Error Handling and Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let browserManager: BrowserManager;
  let mockStore: any;
  let mockBrowserTool: any;
  let mockConsoleStream: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock console stream
    mockConsoleStream = new EventEmitter();
    mockConsoleStream.getStats = vi.fn(() => ({
      sessionId: 'session-error-test',
      messagesCount: 0,
      errorsCount: 0,
    }));

    // Mock browser tool
    mockBrowserTool = {
      getConsoleStream: vi.fn(() => mockConsoleStream),
      setPermissionManager: vi.fn(),
    };

    // Mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('task-error-123')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'task-error-123',
        description: 'Error handling test task',
        status: 'running',
        agentName: 'error-test-agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      listTasks: vi.fn(() => Promise.resolve([])),
      deleteTask: vi.fn(() => Promise.resolve()),
    };

    // Create orchestrator
    orchestrator = new ApexOrchestrator({
      store: mockStore,
      browserTool: mockBrowserTool,
    });

    browserManager = (orchestrator as any).browserManager;

    // Set up task context
    (orchestrator as any).currentTaskId = 'task-error-123';
    (orchestrator as any).currentAgentName = 'error-test-agent';
  });

  afterEach(async () => {
    try {
      await orchestrator.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Event Handler Error Recovery', () => {
    it('should recover from event handler exceptions', (done) => {
      let errorThrown = false;
      let subsequentEventReceived = false;

      // First handler that throws an error
      orchestrator.on('browser:launched', () => {
        errorThrown = true;
        throw new Error('Handler crashed');
      });

      // Second handler that should still execute
      orchestrator.on('browser:launched', () => {
        subsequentEventReceived = true;
      });

      // Third handler to check completion
      orchestrator.on('browser:launched', () => {
        setTimeout(() => {
          expect(errorThrown).toBe(true);
          expect(subsequentEventReceived).toBe(true);
          done();
        }, 10);
      });

      // Trigger event
      const mockBrowserInfo = {
        id: 'browser_error_recovery',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowserInfo);
    });

    it('should handle async handler errors gracefully', (done) => {
      let asyncErrorHandled = false;
      let normalEventProcessed = false;

      // Async handler that throws
      orchestrator.on('browser:closed', async () => {
        asyncErrorHandled = true;
        throw new Error('Async handler error');
      });

      // Normal handler
      orchestrator.on('browser:closed', () => {
        normalEventProcessed = true;
        setTimeout(() => {
          expect(asyncErrorHandled).toBe(true);
          expect(normalEventProcessed).toBe(true);
          done();
        }, 50);
      });

      browserManager.emit('browser:closed', 'browser_async_error');
    });
  });

  describe('Malformed Event Data Handling', () => {
    it('should handle null browser info gracefully', (done) => {
      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.taskId).toBe('task-error-123');
          expect(event.browserInfo).toBeNull();
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('browser:launched', null as any);
    });

    it('should handle undefined event parameters', (done) => {
      orchestrator.once('browser:context-closed', (event) => {
        try {
          expect(event.taskId).toBe('task-error-123');
          expect(event.contextId).toBeUndefined();
          expect(event.browserId).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('context:closed', undefined, undefined);
    });

    it('should handle corrupted browser info objects', (done) => {
      const corruptedBrowserInfo = {
        id: 'browser_corrupted',
        engine: 'invalid-engine' as any,
        version: null,
        isConnected: 'not-a-boolean' as any,
        contextCount: 'not-a-number' as any,
        config: null,
        createdAt: 'not-a-date' as any,
        lastActivityAt: undefined,
      };

      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.taskId).toBe('task-error-123');
          expect(event.browserInfo).toEqual(corruptedBrowserInfo);
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('browser:launched', corruptedBrowserInfo);
    });

    it('should handle empty event objects', (done) => {
      orchestrator.once('browser:manager-error', (event: BrowserManagerErrorEvent) => {
        try {
          expect(event.taskId).toBe('task-error-123');
          expect(event.error).toEqual({});
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('error', {} as any);
    });
  });

  describe('Console Stream Error Scenarios', () => {
    it('should handle console stream errors without affecting BrowserManager events', (done) => {
      let consoleErrorReceived = false;
      let browserEventReceived = false;

      orchestrator.on('browser:console', () => {
        consoleErrorReceived = true;
        checkCompletion();
      });

      orchestrator.on('browser:launched', () => {
        browserEventReceived = true;
        checkCompletion();
      });

      function checkCompletion() {
        if (consoleErrorReceived && browserEventReceived) {
          done();
        }
      }

      // Emit malformed console message
      mockConsoleStream.emit('message', {
        type: null,
        text: undefined,
        timestamp: 'invalid-date',
        level: 'invalid-level',
        malformedProperty: { nested: { deep: 'object' } }
      });

      // Emit normal browser event
      setTimeout(() => {
        const mockBrowserInfo = {
          id: 'browser_console_error_isolation',
          engine: 'chromium' as const,
          version: '1.40.0',
          isConnected: true,
          contextCount: 0,
          config: { engine: 'chromium' as const },
          createdAt: new Date(),
          lastActivityAt: new Date(),
        };

        browserManager.emit('browser:launched', mockBrowserInfo);
      }, 10);
    });

    it('should handle missing console stream methods', (done) => {
      // Remove getStats method to simulate broken console stream
      delete mockConsoleStream.getStats;

      orchestrator.once('browser:session-ended', (event) => {
        try {
          expect(event.taskId).toBe('task-error-123');
          expect(event.session.sessionId).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('stream-stopped');
    });

    it('should handle console stream that throws on getStats', (done) => {
      mockConsoleStream.getStats = vi.fn(() => {
        throw new Error('getStats failed');
      });

      orchestrator.once('browser:session-ended', (event) => {
        try {
          expect(event.taskId).toBe('task-error-123');
          // Should handle error gracefully with undefined values
          expect(event.session.sessionId).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('stream-stopped');
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle memory pressure during high event volume', (done) => {
      const eventCount = 10000;
      let processedCount = 0;
      const startTime = Date.now();

      orchestrator.on('browser:closed', (event) => {
        processedCount++;

        // Verify event integrity under memory pressure
        expect(event.taskId).toBe('task-error-123');
        expect(typeof event.browserId).toBe('string');

        if (processedCount === eventCount) {
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Should complete within reasonable time (adjust threshold as needed)
          expect(duration).toBeLessThan(5000);
          done();
        }
      });

      // Rapidly emit many events to simulate memory pressure
      for (let i = 0; i < eventCount; i++) {
        browserManager.emit('browser:closed', `browser_memory_${i}`);
      }
    });

    it('should clean up event listeners properly', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      // Add listeners
      orchestrator.on('browser:launched', handler1);
      orchestrator.on('browser:closed', handler2);

      // Verify listeners were added
      expect((orchestrator as any).listenerCount('browser:launched')).toBeGreaterThan(0);
      expect((orchestrator as any).listenerCount('browser:closed')).toBeGreaterThan(0);

      // Remove specific listener
      orchestrator.off('browser:launched', handler1);

      // Emit events to verify cleanup
      const mockBrowser = {
        id: 'browser_cleanup_test',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowser);
      browserManager.emit('browser:closed', 'browser_cleanup_test');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Context Corruption Scenarios', () => {
    it('should handle missing task context gracefully', (done) => {
      // Corrupt task context
      (orchestrator as any).currentTaskId = null;
      (orchestrator as any).currentAgentName = null;

      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.taskId).toBe('unknown');
          expect(event.agentName).toBe('unknown');
          done();
        } catch (error) {
          done(error);
        }
      });

      const mockBrowser = {
        id: 'browser_missing_context',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowser);
    });

    it('should handle invalid task context types', (done) => {
      // Set invalid context types
      (orchestrator as any).currentTaskId = { invalid: 'object' };
      (orchestrator as any).currentAgentName = 12345;

      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          // Should convert to strings or use fallback
          expect(typeof event.taskId).toBe('string');
          expect(typeof event.agentName).toBe('string');
          done();
        } catch (error) {
          done(error);
        }
      });

      const mockBrowser = {
        id: 'browser_invalid_context',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowser);
    });
  });

  describe('Timing and Race Condition Edge Cases', () => {
    it('should handle rapid agent transitions during events', (done) => {
      const agentTransitions = ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'];
      let transitionIndex = 0;
      const receivedEvents: any[] = [];

      orchestrator.on('browser:closed', (event) => {
        receivedEvents.push({
          browserId: event.browserId,
          agentName: event.agentName,
          timestamp: event.timestamp
        });

        if (receivedEvents.length === agentTransitions.length) {
          // Verify that agent context was captured correctly for each event
          receivedEvents.forEach((event, index) => {
            expect(event.browserId).toBe(`browser_transition_${index}`);
            // Agent name should be one of the transition states
            expect(agentTransitions).toContain(event.agentName);
          });
          done();
        }
      });

      // Rapidly change agent context and emit events
      agentTransitions.forEach((agentName, index) => {
        setTimeout(() => {
          (orchestrator as any).currentAgentName = agentName;
          browserManager.emit('browser:closed', `browser_transition_${index}`);
        }, index * 5); // 5ms intervals
      });
    });

    it('should handle concurrent event emissions', (done) => {
      const eventTypes = [
        'browser:launched',
        'browser:closed',
        'browser:context-created',
        'browser:page-created',
        'browser:manager-error'
      ];

      const receivedEvents: string[] = [];

      eventTypes.forEach(eventType => {
        orchestrator.on(eventType, () => {
          receivedEvents.push(eventType);
          if (receivedEvents.length === eventTypes.length) {
            // All events should be received
            eventTypes.forEach(type => {
              expect(receivedEvents).toContain(type);
            });
            done();
          }
        });
      });

      // Emit all events simultaneously
      const mockBrowser = {
        id: 'browser_concurrent',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockContext = {
        id: 'context_concurrent',
        browserId: 'browser_concurrent',
        pageCount: 0,
        config: {},
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockPage = { url: () => 'https://concurrent.test' };

      // Emit all events in rapid succession
      browserManager.emit('browser:launched', mockBrowser);
      browserManager.emit('browser:closed', 'browser_concurrent');
      browserManager.emit('context:created', mockContext);
      browserManager.emit('page:created', mockPage, 'context_concurrent', 'browser_concurrent');
      browserManager.emit('error', new Error('Concurrent error'), 'concurrentTest');
    });
  });

  describe('Error Propagation and Isolation', () => {
    it('should isolate BrowserManager errors from console stream errors', (done) => {
      let managerErrorReceived = false;
      let consoleErrorReceived = false;
      let bothCompleted = false;

      const checkCompletion = () => {
        if (managerErrorReceived && consoleErrorReceived && !bothCompleted) {
          bothCompleted = true;
          done();
        }
      };

      orchestrator.on('browser:manager-error', () => {
        managerErrorReceived = true;
        checkCompletion();
      });

      orchestrator.on('browser:error', () => {
        consoleErrorReceived = true;
        checkCompletion();
      });

      // Emit browser manager error
      browserManager.emit('error', new Error('Manager isolation test'));

      // Emit console error
      mockConsoleStream.emit('error', {
        message: 'Console isolation test',
        timestamp: new Date(),
        category: 'javascript',
        severity: 'high',
      });
    });

    it('should maintain error context across multiple error types', (done) => {
      const errors: any[] = [];

      ['browser:manager-error', 'browser:error', 'browser:network-error'].forEach(errorType => {
        orchestrator.on(errorType, (event) => {
          errors.push({
            type: errorType,
            taskId: event.taskId,
            agentName: event.agentName
          });

          if (errors.length === 3) {
            // All errors should maintain consistent context
            errors.forEach(error => {
              expect(error.taskId).toBe('task-error-123');
              expect(error.agentName).toBe('error-test-agent');
            });
            done();
          }
        });
      });

      // Emit different error types
      browserManager.emit('error', new Error('Manager error'));
      mockConsoleStream.emit('error', { message: 'Console error', timestamp: new Date(), category: 'javascript', severity: 'medium' });
      mockConsoleStream.emit('network-error', { url: 'https://error.test', method: 'GET', status: 500, statusText: 'Error', timestamp: new Date() });
    });
  });
});