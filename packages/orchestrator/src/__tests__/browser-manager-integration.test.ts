/**
 * BrowserManager Event Integration Tests
 *
 * Tests for the integration between BrowserManager and ApexOrchestrator,
 * specifically focusing on event forwarding, task context correlation,
 * and streaming capabilities for CLI/API consumers.
 *
 * This test suite covers:
 * - BrowserManager event forwarding to orchestrator
 * - Task context correlation for all BrowserManager events
 * - Event emission patterns and data structures
 * - Error handling and edge cases
 * - Integration with orchestrator event streaming
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserManager } from '../browser-manager.js';
import type {
  BrowserManagerLaunchedEvent,
  BrowserManagerClosedEvent,
  BrowserManagerContextCreatedEvent,
  BrowserManagerContextClosedEvent,
  BrowserManagerPageCreatedEvent,
  BrowserManagerPageClosedEvent,
  BrowserManagerErrorEvent
} from '../index.js';

// Mock dependencies
vi.mock('../browser-manager.js');
vi.mock('../store.js');

// Mock Playwright
const mockBrowser = {
  isConnected: vi.fn(() => true),
  version: vi.fn(() => '1.40.0'),
  newContext: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  _connection: { _transport: { _ws: { process: { pid: 12345 } } } }
};

const mockContext = {
  close: vi.fn(),
  on: vi.fn(),
};

const mockPage = {
  url: () => 'https://example.com',
  title: () => 'Test Page',
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('BrowserManager Event Integration', () => {
  let orchestrator: ApexOrchestrator;
  let browserManager: BrowserManager;
  let mockStore: any;
  let mockBrowserTool: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockBrowser.close.mockResolvedValue(undefined);
    mockContext.close.mockResolvedValue(undefined);

    // Mock browser tool
    mockBrowserTool = {
      getConsoleStream: vi.fn(() => null), // No console stream for these tests
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

    // Get reference to the browser manager created by orchestrator
    browserManager = (orchestrator as any).browserManager;

    // Set up current task/agent context for testing
    (orchestrator as any).currentTaskId = 'task-123';
    (orchestrator as any).currentAgentName = 'developer';
  });

  afterEach(async () => {
    // Clean up
    try {
      await orchestrator.shutdown();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Browser Launch Events', () => {
    it('should forward browser:launched events with task context', (done) => {
      const mockBrowserInfo = {
        id: 'browser_123_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        pid: 12345,
        config: {
          engine: 'chromium' as const,
          headless: true,
          viewport: { width: 1280, height: 720 },
          timeout: 30000,
        },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.browserInfo.id).toBe(mockBrowserInfo.id);
          expect(event.browserInfo.engine).toBe(mockBrowserInfo.engine);
          expect(event.browserInfo.version).toBe(mockBrowserInfo.version);
          expect(event.browserInfo.isConnected).toBe(mockBrowserInfo.isConnected);
          expect(event.browserInfo.pid).toBe(mockBrowserInfo.pid);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger browser launched event
      browserManager.emit('browser:launched', mockBrowserInfo);
    });

    it('should handle browser:launched events with unknown task context', (done) => {
      // Clear current context
      (orchestrator as any).currentTaskId = null;
      (orchestrator as any).currentAgentName = null;

      const mockBrowserInfo = {
        id: 'browser_123_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        pid: 12345,
        config: { engine: 'chromium' as const, headless: true },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.taskId).toBe('unknown');
          expect(event.agentName).toBe('unknown');
          expect(event.browserInfo.id).toBe(mockBrowserInfo.id);
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('browser:launched', mockBrowserInfo);
    });
  });

  describe('Browser Close Events', () => {
    it('should forward browser:closed events with task context', (done) => {
      const browserId = 'browser_123_1';

      orchestrator.once('browser:closed', (event: BrowserManagerClosedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.browserId).toBe(browserId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger browser closed event
      browserManager.emit('browser:closed', browserId);
    });
  });

  describe('Context Events', () => {
    it('should forward context:created events with task context', (done) => {
      const mockContextInfo = {
        id: 'context_456_1',
        browserId: 'browser_123_1',
        pageCount: 0,
        config: {
          viewport: { width: 1280, height: 720 },
          userAgent: 'Custom Agent',
        },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      orchestrator.once('browser:context-created', (event: BrowserManagerContextCreatedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.contextInfo.id).toBe(mockContextInfo.id);
          expect(event.contextInfo.browserId).toBe(mockContextInfo.browserId);
          expect(event.contextInfo.pageCount).toBe(mockContextInfo.pageCount);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger context created event
      browserManager.emit('context:created', mockContextInfo);
    });

    it('should forward context:closed events with task context', (done) => {
      const contextId = 'context_456_1';
      const browserId = 'browser_123_1';

      orchestrator.once('browser:context-closed', (event: BrowserManagerContextClosedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.contextId).toBe(contextId);
          expect(event.browserId).toBe(browserId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger context closed event
      browserManager.emit('context:closed', contextId, browserId);
    });
  });

  describe('Page Events', () => {
    it('should forward page:created events with task context', (done) => {
      const contextId = 'context_456_1';
      const browserId = 'browser_123_1';

      orchestrator.once('browser:page-created', (event: BrowserManagerPageCreatedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.contextId).toBe(contextId);
          expect(event.browserId).toBe(browserId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger page created event
      browserManager.emit('page:created', mockPage, contextId, browserId);
    });

    it('should forward page:closed events with task context', (done) => {
      const contextId = 'context_456_1';
      const browserId = 'browser_123_1';

      orchestrator.once('browser:page-closed', (event: BrowserManagerPageClosedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.contextId).toBe(contextId);
          expect(event.browserId).toBe(browserId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger page closed event
      browserManager.emit('page:closed', contextId, browserId);
    });
  });

  describe('Error Events', () => {
    it('should forward BrowserManager error events with task context', (done) => {
      const testError = new Error('Browser operation failed');
      testError.name = 'BrowserError';
      testError.stack = 'Error: Browser operation failed\n    at test:1:1';
      const operation = 'launchBrowser';

      orchestrator.once('browser:manager-error', (event: BrowserManagerErrorEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.error.message).toBe('Browser operation failed');
          expect(event.error.name).toBe('BrowserError');
          expect(event.error.stack).toBe(testError.stack);
          expect(event.error.operation).toBe(operation);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger BrowserManager error event
      browserManager.emit('error', testError, operation);
    });

    it('should handle BrowserManager errors without operation context', (done) => {
      const testError = new Error('Generic browser error');

      orchestrator.once('browser:manager-error', (event: BrowserManagerErrorEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.agentName).toBe('developer');
          expect(event.error.message).toBe('Generic browser error');
          expect(event.error.operation).toBeUndefined();
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger error without operation
      browserManager.emit('error', testError);
    });

    it('should handle minimal error objects', (done) => {
      const testError = new Error('Minimal error');
      // Remove stack and name properties
      delete testError.stack;
      delete (testError as any).name;

      orchestrator.once('browser:manager-error', (event: BrowserManagerErrorEvent) => {
        try {
          expect(event.error.message).toBe('Minimal error');
          expect(event.error.name).toBeUndefined();
          expect(event.error.stack).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('error', testError);
    });
  });

  describe('Agent Context Updates', () => {
    it('should use updated agent context for BrowserManager events', (done) => {
      // Update agent context through transition
      orchestrator.emit('agent:transition', 'task-123', 'developer', 'tester');

      // Verify agent context has been updated
      expect((orchestrator as any).currentAgentName).toBe('tester');

      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.agentName).toBe('tester');
          done();
        } catch (error) {
          done(error);
        }
      });

      const mockBrowserInfo = {
        id: 'browser_123_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        pid: 12345,
        config: { engine: 'chromium' as const, headless: true },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowserInfo);
    });

    it('should not update context for transitions of different tasks', () => {
      expect((orchestrator as any).currentAgentName).toBe('developer');

      // Emit transition for different task
      orchestrator.emit('agent:transition', 'different-task', 'developer', 'tester');

      // Should remain unchanged
      expect((orchestrator as any).currentAgentName).toBe('developer');
    });
  });

  describe('Event Streaming Performance', () => {
    it('should handle rapid BrowserManager event emission', (done) => {
      let eventCount = 0;
      const expectedEvents = 100;

      orchestrator.on('browser:closed', () => {
        eventCount++;
        if (eventCount === expectedEvents) {
          done();
        }
      });

      // Emit many events rapidly
      for (let i = 0; i < expectedEvents; i++) {
        browserManager.emit('browser:closed', `browser_${i}`);
      }
    });

    it('should maintain event order for BrowserManager events', (done) => {
      const receivedEvents: string[] = [];
      const expectedBrowserIds = Array.from({ length: 50 }, (_, i) => `browser_${i}`);

      orchestrator.on('browser:closed', (event: BrowserManagerClosedEvent) => {
        receivedEvents.push(event.browserId);

        if (receivedEvents.length === expectedBrowserIds.length) {
          try {
            expect(receivedEvents).toEqual(expectedBrowserIds);
            done();
          } catch (error) {
            done(error);
          }
        }
      });

      // Emit events in order
      expectedBrowserIds.forEach(browserId => {
        browserManager.emit('browser:closed', browserId);
      });
    });
  });

  describe('Concurrent Event Types', () => {
    it('should handle multiple BrowserManager event types simultaneously', (done) => {
      let launchedEventReceived = false;
      let closedEventReceived = false;
      let contextCreatedReceived = false;
      let pageCreatedReceived = false;
      let errorEventReceived = false;

      function checkCompletion() {
        if (launchedEventReceived && closedEventReceived && contextCreatedReceived &&
            pageCreatedReceived && errorEventReceived) {
          done();
        }
      }

      orchestrator.once('browser:launched', () => {
        launchedEventReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:closed', () => {
        closedEventReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:context-created', () => {
        contextCreatedReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:page-created', () => {
        pageCreatedReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:manager-error', () => {
        errorEventReceived = true;
        checkCompletion();
      });

      // Emit different types of BrowserManager events
      const mockBrowserInfo = {
        id: 'browser_123',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const, headless: true },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockContextInfo = {
        id: 'context_456',
        browserId: 'browser_123',
        pageCount: 0,
        config: {},
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowserInfo);
      browserManager.emit('browser:closed', 'browser_123');
      browserManager.emit('context:created', mockContextInfo);
      browserManager.emit('page:created', mockPage, 'context_456', 'browser_123');
      browserManager.emit('error', new Error('Test error'), 'testOperation');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should continue forwarding after handler error', (done) => {
      let secondEventReceived = false;

      // First handler that throws error
      orchestrator.once('browser:launched', () => {
        throw new Error('Handler error');
      });

      // Second handler that should still work
      orchestrator.once('browser:launched', () => {
        secondEventReceived = true;
      });

      const mockBrowserInfo = {
        id: 'browser_123',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowserInfo);

      setTimeout(() => {
        expect(secondEventReceived).toBe(true);
        done();
      }, 10);
    });

    it('should handle malformed browser info objects', (done) => {
      orchestrator.once('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.browserInfo).toBeDefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      // Emit event with minimal browser info
      browserManager.emit('browser:launched', {} as any);
    });

    it('should handle events with null/undefined values', (done) => {
      orchestrator.once('browser:closed', (event: BrowserManagerClosedEvent) => {
        try {
          expect(event.taskId).toBe('task-123');
          expect(event.browserId).toBeNull();
          done();
        } catch (error) {
          done(error);
        }
      });

      browserManager.emit('browser:closed', null as any);
    });
  });

  describe('Integration with Orchestrator Event System', () => {
    it('should maintain event emitter functionality', () => {
      // Verify orchestrator is still an EventEmitter
      expect(orchestrator).toBeInstanceOf(EventEmitter);

      // Verify it can emit and listen to other events
      let customEventReceived = false;
      orchestrator.once('custom:test', () => {
        customEventReceived = true;
      });

      orchestrator.emit('custom:test');
      expect(customEventReceived).toBe(true);
    });

    it('should allow multiple listeners for BrowserManager events', (done) => {
      let listener1Called = false;
      let listener2Called = false;

      orchestrator.on('browser:launched', () => {
        listener1Called = true;
        checkCompletion();
      });

      orchestrator.on('browser:launched', () => {
        listener2Called = true;
        checkCompletion();
      });

      function checkCompletion() {
        if (listener1Called && listener2Called) {
          done();
        }
      }

      const mockBrowserInfo = {
        id: 'browser_123',
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
  });
});