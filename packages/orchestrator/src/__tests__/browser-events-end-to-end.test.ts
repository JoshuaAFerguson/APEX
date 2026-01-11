/**
 * Browser Events End-to-End Integration Tests
 *
 * Comprehensive integration tests for browser event flow from BrowserManager
 * through orchestrator to CLI/API consumers. Tests the complete pipeline
 * including task context correlation, event transformation, and streaming.
 *
 * Test scenarios:
 * - Real browser lifecycle with event correlation
 * - Multiple browsers and contexts with proper event isolation
 * - Event streaming to external consumers
 * - Browser session lifecycle with complete event flow
 * - Performance under high event load
 * - Error recovery and resilience
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index.js';
import { BrowserManager } from '../browser-manager.js';
import { BrowserConsoleStream } from '../browser-console-stream.js';
import type {
  BrowserManagerLaunchedEvent,
  BrowserManagerClosedEvent,
  BrowserManagerContextCreatedEvent,
  BrowserManagerPageCreatedEvent,
  BrowserConsoleEvent,
  BrowserErrorEvent,
} from '../index.js';

// Mock external dependencies
vi.mock('../store.js');
vi.mock('../browser-console-stream.js');

// Create comprehensive mock setup
const createMockBrowser = (id: string, pid: number = 12345) => ({
  isConnected: vi.fn(() => true),
  version: vi.fn(() => '1.40.0'),
  newContext: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  contexts: vi.fn(() => []),
  _connection: { _transport: { _ws: { process: { pid } } } }
});

const createMockContext = (id: string) => ({
  close: vi.fn(),
  on: vi.fn(),
  pages: vi.fn(() => []),
});

const createMockPage = (url: string = 'https://example.com') => ({
  url: () => url,
  title: () => 'Test Page',
  close: vi.fn(),
  on: vi.fn(),
});

describe('Browser Events End-to-End Integration', () => {
  let orchestrator: ApexOrchestrator;
  let browserManager: BrowserManager;
  let mockStore: any;
  let mockBrowserTool: any;
  let mockConsoleStream: EventEmitter;
  let eventCollector: Array<{ type: string; event: any; timestamp: Date }>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize event collector
    eventCollector = [];

    // Create mock console stream
    mockConsoleStream = new EventEmitter();
    mockConsoleStream.getStats = vi.fn(() => ({
      sessionId: 'session-123',
      messagesCount: 0,
      errorsCount: 0,
    }));

    // Mock browser tool with console stream
    mockBrowserTool = {
      getConsoleStream: vi.fn(() => mockConsoleStream),
      setPermissionManager: vi.fn(),
    };

    // Mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('task-integration-123')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'task-integration-123',
        description: 'Integration test task',
        status: 'running',
        agentName: 'integration-agent',
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
    (orchestrator as any).currentTaskId = 'task-integration-123';
    (orchestrator as any).currentAgentName = 'integration-agent';

    // Set up event collection
    const events = [
      'browser:launched', 'browser:closed',
      'browser:context-created', 'browser:context-closed',
      'browser:page-created', 'browser:page-closed',
      'browser:manager-error',
      'browser:console', 'browser:error',
      'browser:session-started', 'browser:session-ended'
    ];

    events.forEach(eventType => {
      orchestrator.on(eventType, (event) => {
        eventCollector.push({
          type: eventType,
          event,
          timestamp: new Date()
        });
      });
    });
  });

  afterEach(async () => {
    try {
      await orchestrator.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Browser Lifecycle', () => {
    it('should handle complete browser lifecycle with event correlation', (done) => {
      let eventsCompleted = 0;
      const expectedEvents = 6; // launched, context-created, page-created, page-closed, context-closed, closed

      function checkCompletion() {
        eventsCompleted++;
        if (eventsCompleted === expectedEvents) {
          // Verify all events have correct task context
          const allEvents = eventCollector;
          expect(allEvents).toHaveLength(expectedEvents);

          allEvents.forEach(({ event }) => {
            expect(event.taskId).toBe('task-integration-123');
            expect(event.agentName).toBe('integration-agent');
            expect(event.timestamp).toBeInstanceOf(Date);
          });

          // Verify event order
          const eventTypes = allEvents.map(e => e.type);
          expect(eventTypes[0]).toBe('browser:launched');
          expect(eventTypes[1]).toBe('browser:context-created');
          expect(eventTypes[2]).toBe('browser:page-created');
          expect(eventTypes[3]).toBe('browser:page-closed');
          expect(eventTypes[4]).toBe('browser:context-closed');
          expect(eventTypes[5]).toBe('browser:closed');

          done();
        }
      }

      // Set up event listeners
      orchestrator.on('browser:launched', checkCompletion);
      orchestrator.on('browser:context-created', checkCompletion);
      orchestrator.on('browser:page-created', checkCompletion);
      orchestrator.on('browser:page-closed', checkCompletion);
      orchestrator.on('browser:context-closed', checkCompletion);
      orchestrator.on('browser:closed', checkCompletion);

      // Simulate complete lifecycle
      const mockBrowserInfo = {
        id: 'browser_lifecycle_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        pid: 12345,
        config: { engine: 'chromium' as const, headless: true },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockContextInfo = {
        id: 'context_lifecycle_1',
        browserId: 'browser_lifecycle_1',
        pageCount: 0,
        config: {},
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockPage = createMockPage('https://test.example.com');

      // Simulate events in order
      setTimeout(() => browserManager.emit('browser:launched', mockBrowserInfo), 10);
      setTimeout(() => browserManager.emit('context:created', mockContextInfo), 20);
      setTimeout(() => browserManager.emit('page:created', mockPage, 'context_lifecycle_1', 'browser_lifecycle_1'), 30);
      setTimeout(() => browserManager.emit('page:closed', 'context_lifecycle_1', 'browser_lifecycle_1'), 40);
      setTimeout(() => browserManager.emit('context:closed', 'context_lifecycle_1', 'browser_lifecycle_1'), 50);
      setTimeout(() => browserManager.emit('browser:closed', 'browser_lifecycle_1'), 60);
    }, 10000); // 10 second timeout for this complex test
  });

  describe('Multiple Browser Session Management', () => {
    it('should handle multiple browsers with isolated event contexts', (done) => {
      const browser1Events: any[] = [];
      const browser2Events: any[] = [];

      // Update agent context for second browser
      setTimeout(() => {
        (orchestrator as any).currentAgentName = 'second-agent';
      }, 100);

      orchestrator.on('browser:launched', (event: BrowserManagerLaunchedEvent) => {
        if (event.browserInfo.id === 'browser_multi_1') {
          browser1Events.push(event);
          expect(event.agentName).toBe('integration-agent');
        } else if (event.browserInfo.id === 'browser_multi_2') {
          browser2Events.push(event);
          expect(event.agentName).toBe('second-agent');
        }

        if (browser1Events.length === 1 && browser2Events.length === 1) {
          // Verify isolation
          expect(browser1Events[0].browserInfo.id).toBe('browser_multi_1');
          expect(browser2Events[0].browserInfo.id).toBe('browser_multi_2');
          expect(browser1Events[0].agentName).not.toBe(browser2Events[0].agentName);
          done();
        }
      });

      // Launch first browser with first agent
      const mockBrowser1 = {
        id: 'browser_multi_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      // Launch second browser with second agent (after context change)
      const mockBrowser2 = {
        id: 'browser_multi_2',
        engine: 'firefox' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'firefox' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowser1);

      setTimeout(() => {
        browserManager.emit('browser:launched', mockBrowser2);
      }, 150);
    });
  });

  describe('Browser Console and Manager Event Integration', () => {
    it('should correlate console events with browser lifecycle events', (done) => {
      let browserLaunched = false;
      let consoleEventReceived = false;
      let browserClosed = false;

      function checkCompletion() {
        if (browserLaunched && consoleEventReceived && browserClosed) {
          const allEvents = eventCollector;

          // Find specific events
          const launchedEvent = allEvents.find(e => e.type === 'browser:launched');
          const consoleEvent = allEvents.find(e => e.type === 'browser:console');
          const closedEvent = allEvents.find(e => e.type === 'browser:closed');

          expect(launchedEvent).toBeDefined();
          expect(consoleEvent).toBeDefined();
          expect(closedEvent).toBeDefined();

          // Verify all have same task context
          [launchedEvent, consoleEvent, closedEvent].forEach(({ event }) => {
            expect(event.taskId).toBe('task-integration-123');
            expect(event.agentName).toBe('integration-agent');
          });

          done();
        }
      }

      orchestrator.once('browser:launched', () => {
        browserLaunched = true;
        checkCompletion();
      });

      orchestrator.once('browser:console', () => {
        consoleEventReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:closed', () => {
        browserClosed = true;
        checkCompletion();
      });

      // Emit browser lifecycle events
      const mockBrowserInfo = {
        id: 'browser_console_integration_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowserInfo);

      // Emit console event
      setTimeout(() => {
        mockConsoleStream.emit('message', {
          type: 'console.log',
          text: 'Integration test message',
          timestamp: new Date(),
          level: 'info',
          sessionId: 'session-123',
        });
      }, 10);

      // Close browser
      setTimeout(() => {
        browserManager.emit('browser:closed', 'browser_console_integration_1');
      }, 20);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle both BrowserManager and console errors with proper correlation', (done) => {
      let managerErrorReceived = false;
      let consoleErrorReceived = false;

      function checkCompletion() {
        if (managerErrorReceived && consoleErrorReceived) {
          const allEvents = eventCollector;

          const managerError = allEvents.find(e => e.type === 'browser:manager-error');
          const consoleError = allEvents.find(e => e.type === 'browser:error');

          expect(managerError).toBeDefined();
          expect(consoleError).toBeDefined();

          // Both should have same task context
          expect(managerError?.event.taskId).toBe('task-integration-123');
          expect(consoleError?.event.taskId).toBe('task-integration-123');

          done();
        }
      }

      orchestrator.once('browser:manager-error', () => {
        managerErrorReceived = true;
        checkCompletion();
      });

      orchestrator.once('browser:error', () => {
        consoleErrorReceived = true;
        checkCompletion();
      });

      // Emit BrowserManager error
      const managerError = new Error('Browser management error');
      browserManager.emit('error', managerError, 'testOperation');

      // Emit console error
      setTimeout(() => {
        mockConsoleStream.emit('error', {
          message: 'Console error message',
          timestamp: new Date(),
          category: 'javascript',
          severity: 'high',
        });
      }, 10);
    });
  });

  describe('High Load Performance', () => {
    it('should handle rapid browser events without losing context', (done) => {
      const eventCount = 1000;
      let receivedCount = 0;

      orchestrator.on('browser:closed', (event: BrowserManagerClosedEvent) => {
        receivedCount++;

        // Every event should have correct context
        expect(event.taskId).toBe('task-integration-123');
        expect(event.agentName).toBe('integration-agent');

        if (receivedCount === eventCount) {
          expect(eventCollector.filter(e => e.type === 'browser:closed')).toHaveLength(eventCount);
          done();
        }
      });

      // Emit many close events rapidly
      for (let i = 0; i < eventCount; i++) {
        browserManager.emit('browser:closed', `browser_load_${i}`);
      }
    });
  });

  describe('Session Lifecycle Integration', () => {
    it('should handle complete browser session with all event types', (done) => {
      const expectedEventTypes = [
        'browser:session-started',
        'browser:launched',
        'browser:context-created',
        'browser:page-created',
        'browser:console',
        'browser:page-closed',
        'browser:context-closed',
        'browser:closed',
        'browser:session-ended'
      ];

      let eventIndex = 0;

      // Custom event checker that validates order
      const eventChecker = () => {
        const receivedEvents = eventCollector.map(e => e.type);

        if (receivedEvents.length === expectedEventTypes.length) {
          // Check that all expected events were received
          expectedEventTypes.forEach(expectedType => {
            expect(receivedEvents).toContain(expectedType);
          });

          // Verify all events have consistent task context
          eventCollector.forEach(({ event }) => {
            expect(event.taskId).toBe('task-integration-123');
            expect(event.agentName).toBe('integration-agent');
          });

          done();
        }
      };

      // Set up listener for all expected events
      expectedEventTypes.forEach(eventType => {
        orchestrator.on(eventType, eventChecker);
      });

      // Simulate complete session lifecycle
      const sessionConfig = {
        sessionId: 'session-integration-123',
        browserType: 'chromium',
        viewport: { width: 1280, height: 720 },
        headless: true,
      };

      const mockBrowserInfo = {
        id: 'browser_session_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockContextInfo = {
        id: 'context_session_1',
        browserId: 'browser_session_1',
        pageCount: 0,
        config: {},
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      const mockPage = createMockPage('https://session.example.com');

      // Execute session lifecycle with proper timing
      setTimeout(() => mockConsoleStream.emit('stream-started', sessionConfig), 10);
      setTimeout(() => browserManager.emit('browser:launched', mockBrowserInfo), 20);
      setTimeout(() => browserManager.emit('context:created', mockContextInfo), 30);
      setTimeout(() => browserManager.emit('page:created', mockPage, 'context_session_1', 'browser_session_1'), 40);
      setTimeout(() => {
        mockConsoleStream.emit('message', {
          type: 'console.log',
          text: 'Session test message',
          timestamp: new Date(),
          level: 'info',
        });
      }, 50);
      setTimeout(() => browserManager.emit('page:closed', 'context_session_1', 'browser_session_1'), 60);
      setTimeout(() => browserManager.emit('context:closed', 'context_session_1', 'browser_session_1'), 70);
      setTimeout(() => browserManager.emit('browser:closed', 'browser_session_1'), 80);
      setTimeout(() => mockConsoleStream.emit('stream-stopped'), 90);
    }, 15000); // Longer timeout for complex sequence
  });

  describe('Event Streaming to External Consumers', () => {
    it('should provide events in consumable format for CLI/API', (done) => {
      // Simulate external consumer listening to orchestrator events
      const externalEventBuffer: any[] = [];

      const simulateExternalConsumer = (eventType: string) => {
        orchestrator.on(eventType, (event) => {
          // External consumer processes event
          externalEventBuffer.push({
            eventType,
            data: event,
            processedAt: new Date(),
            valid: event.taskId && event.agentName && event.timestamp
          });
        });
      };

      // Set up external consumer for key event types
      ['browser:launched', 'browser:closed', 'browser:console', 'browser:manager-error'].forEach(simulateExternalConsumer);

      // Wait for several events to be processed
      setTimeout(() => {
        expect(externalEventBuffer.length).toBeGreaterThan(0);

        // All events should be valid for external consumption
        externalEventBuffer.forEach(({ valid, data }) => {
          expect(valid).toBe(true);
          expect(data).toHaveProperty('taskId');
          expect(data).toHaveProperty('agentName');
          expect(data).toHaveProperty('timestamp');
        });

        done();
      }, 100);

      // Trigger events that external consumer would receive
      const mockBrowser = {
        id: 'browser_external_1',
        engine: 'chromium' as const,
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        config: { engine: 'chromium' as const },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      browserManager.emit('browser:launched', mockBrowser);
      browserManager.emit('browser:closed', 'browser_external_1');

      mockConsoleStream.emit('message', {
        type: 'console.log',
        text: 'External consumer test',
        timestamp: new Date(),
        level: 'info',
      });

      browserManager.emit('error', new Error('External test error'), 'externalTest');
    });
  });
});