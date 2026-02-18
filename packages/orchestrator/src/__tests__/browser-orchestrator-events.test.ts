/**
 * Browser-Orchestrator Event Integration Tests
 *
 * Tests for the integration between BrowserManager events and orchestrator
 * EventEmitter system, ensuring proper event forwarding, task context correlation,
 * and streaming capabilities for CLI/API consumers.
 *
 * Tests cover:
 * - BrowserManager event emission
 * - Orchestrator event handling with task context
 * - End-to-end event flow from browser to consumers
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserConsoleStream } from '../browser-console-stream.js';
import type {
  BrowserConsoleEvent,
  BrowserErrorEvent,
  BrowserNetworkErrorEvent,
  BrowserPerformanceWarningEvent,
  BrowserSecurityViolationEvent,
  BrowserSessionStartedEvent,
  BrowserSessionEndedEvent
} from '../index.js';

// Mock dependencies
vi.mock('../browser-console-stream.js');
vi.mock('../browser-manager.js');
vi.mock('../store.js');

describe('Browser-Orchestrator Event Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockConsoleStream: EventEmitter;
  let mockBrowserTool: any;
  let mockStore: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock console stream
    mockConsoleStream = new EventEmitter();

    // Mock browser tool with console stream
    mockBrowserTool = {
      getConsoleStream: vi.fn(() => mockConsoleStream),
      setPermissionManager: vi.fn(),
    };

    // Mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('task-123')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'task-123',
        description: 'Test task',
        status: 'running',
        agentName: 'developer',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      listTasks: vi.fn(() => Promise.resolve([])),
      deleteTask: vi.fn(() => Promise.resolve()),
    };

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      store: mockStore,
      browserTool: mockBrowserTool,
    });

    // Set up current task/agent context for testing
    (orchestrator as any).currentTaskId = 'task-123';
    (orchestrator as any).currentAgentName = 'developer';
  });

  afterEach(async () => {
    // Clean up
    await orchestrator.shutdown();
  });

  describe('Browser Console Event Forwarding', () => {
    it('should forward console messages with task context', (done) => {
      const testMessage = {
        type: 'console.log',
        text: 'Test log message',
        timestamp: new Date(),
        level: 'info' as const,
        args: ['test', 'args'],
        location: {
          url: 'https://example.com',
          lineNumber: 10,
          columnNumber: 5,
        },
        stack: 'Error stack trace',
        sessionId: 'session-123',
        pageContext: {
          url: 'https://example.com',
          title: 'Test Page',
          userAgent: 'Test User Agent',
        },
      };

      orchestrator.once('browser:console', (event: BrowserConsoleEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.message.type).toBe(testMessage.type);
          expect(event.message.text).toBe(testMessage.text);
          expect(event.message.level).toBe(testMessage.level);
          expect(event.message.args).toEqual(testMessage.args);
          expect(event.message.location).toEqual(testMessage.location);
          expect(event.message.stack).toBe(testMessage.stack);
          expect(event.message.sessionId).toBe(testMessage.sessionId);
          expect(event.message.pageContext).toEqual(testMessage.pageContext);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger console message event
      mockConsoleStream.emit('message', testMessage);
    });

    it('should handle unknown task/agent context gracefully', (done) => {
      // Clear current context
      (orchestrator as any).currentTaskId = null;
      (orchestrator as any).currentAgentName = null;

      orchestrator.once('browser:console', (event: BrowserConsoleEvent) => {
        try {
          expect(event.taskId).toBe('unknown');
          expect(event.agentName).toBe('unknown');
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('message', {
        type: 'console.log',
        text: 'Test message',
        timestamp: new Date(),
        level: 'info',
      });
    });

    it('should forward minimal console messages without optional fields', (done) => {
      const minimalMessage = {
        type: 'console.warn',
        text: 'Warning message',
        timestamp: new Date(),
        level: 'warn' as const,
      };

      orchestrator.once('browser:console', (event: BrowserConsoleEvent) => {
        try {
          expect(event.message.type).toBe(minimalMessage.type);
          expect(event.message.text).toBe(minimalMessage.text);
          expect(event.message.level).toBe(minimalMessage.level);
          expect(event.message.args).toBeUndefined();
          expect(event.message.location).toBeUndefined();
          expect(event.message.stack).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('message', minimalMessage);
    });
  });

  describe('Browser Error Event Forwarding', () => {
    it('should forward runtime errors with task context', (done) => {
      const testError = {
        message: 'TypeError: Cannot read property',
        name: 'TypeError',
        stack: 'TypeError: Cannot read property\n    at example.com:10:5',
        timestamp: new Date(),
        source: {
          url: 'https://example.com',
          line: 10,
          column: 5,
        },
        category: 'javascript' as const,
        severity: 'high' as const,
        context: {
          userAgent: 'Mozilla/5.0...',
          pageUrl: 'https://example.com',
          pageTitle: 'Test Page',
          viewport: { width: 1920, height: 1080 },
          timestamp: new Date(),
        },
        sessionId: 'session-123',
      };

      orchestrator.once('browser:error', (event: BrowserErrorEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.error.message).toBe(testError.message);
          expect(event.error.name).toBe(testError.name);
          expect(event.error.stack).toBe(testError.stack);
          expect(event.error.source).toEqual(testError.source);
          expect(event.error.category).toBe(testError.category);
          expect(event.error.severity).toBe(testError.severity);
          expect(event.error.context).toEqual(testError.context);
          expect(event.error.sessionId).toBe(testError.sessionId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('error', testError);
    });

    it('should forward minimal errors without optional fields', (done) => {
      const minimalError = {
        message: 'Simple error',
        timestamp: new Date(),
        category: 'unknown' as const,
        severity: 'medium' as const,
      };

      orchestrator.once('browser:error', (event: BrowserErrorEvent) => {
        try {
          expect(event.error.message).toBe(minimalError.message);
          expect(event.error.category).toBe(minimalError.category);
          expect(event.error.severity).toBe(minimalError.severity);
          expect(event.error.name).toBeUndefined();
          expect(event.error.stack).toBeUndefined();
          expect(event.error.source).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('error', minimalError);
    });
  });

  describe('Browser Network Error Event Forwarding', () => {
    it('should forward network errors with task context', (done) => {
      const networkError = {
        url: 'https://api.example.com/data',
        method: 'GET',
        status: 404,
        statusText: 'Not Found',
        timestamp: new Date(),
        sessionId: 'session-123',
      };

      orchestrator.once('browser:network-error', (event: BrowserNetworkErrorEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.error.url).toBe(networkError.url);
          expect(event.error.method).toBe(networkError.method);
          expect(event.error.status).toBe(networkError.status);
          expect(event.error.statusText).toBe(networkError.statusText);
          expect(event.error.sessionId).toBe(networkError.sessionId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('network-error', networkError);
    });
  });

  describe('Browser Performance Warning Event Forwarding', () => {
    it('should forward performance warnings with task context', (done) => {
      const performanceWarning = {
        type: 'slow-script' as const,
        message: 'Script execution took too long',
        duration: 5000,
        timestamp: new Date(),
        sessionId: 'session-123',
      };

      orchestrator.once('browser:performance-warning', (event: BrowserPerformanceWarningEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.warning.type).toBe(performanceWarning.type);
          expect(event.warning.message).toBe(performanceWarning.message);
          expect(event.warning.duration).toBe(performanceWarning.duration);
          expect(event.warning.sessionId).toBe(performanceWarning.sessionId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('performance-warning', performanceWarning);
    });
  });

  describe('Browser Security Violation Event Forwarding', () => {
    it('should forward security violations with task context', (done) => {
      const securityViolation = {
        type: 'csp' as const,
        message: 'Content Security Policy violation',
        blockedURI: 'https://malicious-site.com/script.js',
        timestamp: new Date(),
        sessionId: 'session-123',
      };

      orchestrator.once('browser:security-violation', (event: BrowserSecurityViolationEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.violation.type).toBe(securityViolation.type);
          expect(event.violation.message).toBe(securityViolation.message);
          expect(event.violation.blockedURI).toBe(securityViolation.blockedURI);
          expect(event.violation.sessionId).toBe(securityViolation.sessionId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('security-violation', securityViolation);
    });
  });

  describe('Browser Session Lifecycle Events', () => {
    it('should forward session started events with task context', (done) => {
      const sessionConfig = {
        sessionId: 'session-123',
        browserType: 'chromium',
        userAgent: 'Custom Agent',
        viewport: { width: 1920, height: 1080 },
        headless: true,
      };

      orchestrator.once('browser:session-started', (event: BrowserSessionStartedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.session.sessionId).toBe('session-123');
          expect(event.session.browserType).toBe('chromium');
          expect(event.session.viewport).toEqual({ width: 1280, height: 720 }); // Default values
          expect(event.session.headless).toBe(true);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('stream-started', sessionConfig);
    });

    it('should forward session ended events with task context and stats', (done) => {
      // Mock the stats method
      mockConsoleStream.getStats = vi.fn(() => ({
        sessionId: 'session-123',
        messagesCount: 25,
        errorsCount: 3,
      }));

      orchestrator.once('browser:session-ended', (event: BrowserSessionEndedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.session.sessionId).toBe('session-123');
          expect(event.session.errorsCount).toBe(3);
          expect(event.session.consoleMessagesCount).toBe(25);
          expect(event.session.duration).toBe(0); // Default implementation
          expect(event.session.pagesVisited).toBe(1); // Default implementation
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('stream-stopped');
    });
  });

  describe('Context Tracking and Agent Transitions', () => {
    it('should update current agent context on agent transitions', () => {
      // Initial state
      expect((orchestrator as any).currentAgentName).toBe('developer');

      // Emit agent transition for current task
      orchestrator.emit('agent:transition', 'task-123', 'developer', 'tester');

      expect((orchestrator as any).currentAgentName).toBe('tester');
    });

    it('should not update agent context for different task transitions', () => {
      expect((orchestrator as any).currentAgentName).toBe('developer');

      // Emit agent transition for different task
      orchestrator.emit('agent:transition', 'different-task', 'developer', 'tester');

      // Should remain unchanged
      expect((orchestrator as any).currentAgentName).toBe('developer');
    });

    it('should use updated agent context in subsequent browser events', (done) => {
      // Update agent context
      orchestrator.emit('agent:transition', 'task-123', 'developer', 'tester');

      orchestrator.once('browser:console', (event: BrowserConsoleEvent) => {
        try {
          expect(event.agentName).toBe('tester');
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('message', {
        type: 'console.log',
        text: 'Test after transition',
        timestamp: new Date(),
        level: 'info',
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing console stream gracefully', () => {
      // Create orchestrator with browser tool that returns no console stream
      const mockBrowserToolNoStream = {
        getConsoleStream: vi.fn(() => null),
        setPermissionManager: vi.fn(),
      };

      // Should not throw when setting up browser events
      expect(() => {
        new ApexOrchestrator({
          store: mockStore,
          browserTool: mockBrowserToolNoStream,
        });
      }).not.toThrow();
    });

    it('should handle events when no console stream getStats method exists', (done) => {
      // Remove getStats method
      delete mockConsoleStream.getStats;

      orchestrator.once('browser:session-ended', (event: BrowserSessionEndedEvent) => {
        try {
          // Should handle gracefully with default values
          expect(event.session.sessionId).toBeUndefined();
          expect(event.session.errorsCount).toBeUndefined();
          expect(event.session.consoleMessagesCount).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      mockConsoleStream.emit('stream-stopped');
    });

    it('should handle malformed browser events gracefully', (done) => {
      let eventReceived = false;

      orchestrator.once('browser:console', (event: BrowserConsoleEvent) => {
        eventReceived = true;
        expect(event.taskId).toBe('task-123');
        expect(event.message.type).toBeUndefined();
        expect(event.message.text).toBeUndefined();
      });

      // Emit malformed event
      mockConsoleStream.emit('message', {});

      setTimeout(() => {
        expect(eventReceived).toBe(true);
        done();
      }, 10);
    });

    it('should continue forwarding events after error in event handler', (done) => {
      let secondEventReceived = false;

      // First handler that throws error
      orchestrator.once('browser:console', () => {
        throw new Error('Handler error');
      });

      // Second handler that should still work
      orchestrator.once('browser:console', () => {
        secondEventReceived = true;
      });

      // Emit event - first handler throws but second should still work
      mockConsoleStream.emit('message', {
        type: 'console.log',
        text: 'Test',
        timestamp: new Date(),
        level: 'info',
      });

      setTimeout(() => {
        expect(secondEventReceived).toBe(true);
        done();
      }, 10);
    });
  });

  describe('Event Streaming Performance', () => {
    it('should handle high-frequency browser events without blocking', (done) => {
      let eventCount = 0;
      const expectedEvents = 1000;

      orchestrator.on('browser:console', () => {
        eventCount++;
        if (eventCount === expectedEvents) {
          done();
        }
      });

      // Emit many events rapidly
      for (let i = 0; i < expectedEvents; i++) {
        mockConsoleStream.emit('message', {
          type: 'console.log',
          text: `Message ${i}`,
          timestamp: new Date(),
          level: 'info',
        });
      }
    });

    it('should maintain event order during rapid emission', (done) => {
      const receivedMessages: string[] = [];
      const expectedMessages = Array.from({ length: 100 }, (_, i) => `Message ${i}`);

      orchestrator.on('browser:console', (event: BrowserConsoleEvent) => {
        receivedMessages.push(event.message.text);

        if (receivedMessages.length === expectedMessages.length) {
          try {
            expect(receivedMessages).toEqual(expectedMessages);
            done();
          } catch (error) {
            done(error);
          }
        }
      });

      // Emit messages in order
      expectedMessages.forEach(message => {
        mockConsoleStream.emit('message', {
          type: 'console.log',
          text: message,
          timestamp: new Date(),
          level: 'info',
        });
      });
    });
  });

  describe('Multiple Event Types Concurrency', () => {
    it('should handle multiple event types simultaneously', (done) => {
      let consoleEventReceived = false;
      let errorEventReceived = false;
      let networkErrorReceived = false;

      function checkCompletion() {
        if (consoleEventReceived && errorEventReceived && networkErrorReceived) {
          done();
        }
      }

      orchestrator.once('browser:console', () => {
        consoleEventReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:error', () => {
        errorEventReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:network-error', () => {
        networkErrorReceived = true;
        checkCompletion();
      });

      // Emit different types of events
      mockConsoleStream.emit('message', {
        type: 'console.log',
        text: 'Test',
        timestamp: new Date(),
        level: 'info',
      });

      mockConsoleStream.emit('error', {
        message: 'Test error',
        timestamp: new Date(),
        category: 'javascript',
        severity: 'medium',
      });

      mockConsoleStream.emit('network-error', {
        url: 'https://example.com',
        method: 'GET',
        status: 500,
        statusText: 'Internal Server Error',
        timestamp: new Date(),
      });
    });
  });
});