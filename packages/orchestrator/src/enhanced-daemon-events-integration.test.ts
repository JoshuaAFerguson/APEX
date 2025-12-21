import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedDaemon, EnhancedDaemonEvents } from './enhanced-daemon';
import { TaskSessionResumedEvent } from './index';
import { ApexConfig } from '@apexcli/core';

describe('EnhancedDaemon Events Integration', () => {
  let enhancedDaemon: EnhancedDaemon;
  let mockProjectPath: string;
  let mockConfig: ApexConfig;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    mockConfig = {
      version: '1.0',
      project: { name: 'test-project' },
      daemon: {
        timeBasedUsage: { enabled: false },
        sessionRecovery: { enabled: false },
        idleProcessing: { enabled: false },
        healthCheck: { enabled: false },
        watchdog: { enabled: false },
        installAsService: false,
      },
      limits: {
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3,
        dailyBudget: 100.0,
      },
    };

    enhancedDaemon = new EnhancedDaemon(mockProjectPath, mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('EnhancedDaemonEvents Interface', () => {
    it('should include task:session-resumed event in EnhancedDaemonEvents interface', () => {
      // This test verifies TypeScript compilation - if the interface doesn't include
      // the event, TypeScript compilation will fail

      const mockHandler = vi.fn();

      // These should all compile without TypeScript errors
      enhancedDaemon.on('daemon:started', mockHandler);
      enhancedDaemon.on('daemon:stopped', mockHandler);
      enhancedDaemon.on('daemon:error', mockHandler);
      enhancedDaemon.on('service:installed', mockHandler);
      enhancedDaemon.on('service:uninstalled', mockHandler);
      enhancedDaemon.on('usage:mode-changed', mockHandler);
      enhancedDaemon.on('session:recovered', mockHandler);
      enhancedDaemon.on('workspace:created', mockHandler);
      enhancedDaemon.on('workspace:cleaned', mockHandler);
      enhancedDaemon.on('idle:suggestion', mockHandler);
      enhancedDaemon.on('thought:captured', mockHandler);
      enhancedDaemon.on('interaction:received', mockHandler);
      enhancedDaemon.on('capacity:restored', mockHandler);
      enhancedDaemon.on('tasks:auto-resumed', mockHandler);

      // This is the key test - the new event should be properly typed
      enhancedDaemon.on('task:session-resumed', mockHandler);

      expect(mockHandler).toBeDefined();
    });

    it('should allow proper typing for task:session-resumed event handler', () => {
      // Test that the event handler receives the correct type
      const typedHandler = vi.fn((event: TaskSessionResumedEvent) => {
        // TypeScript should enforce correct event structure
        expect(event.taskId).toBeDefined();
        expect(event.resumeReason).toBeDefined();
        expect(event.contextSummary).toBeDefined();
        expect(event.previousStatus).toBeDefined();
        expect(event.sessionData).toBeDefined();
        expect(event.timestamp).toBeDefined();
      });

      // This should compile without TypeScript errors
      enhancedDaemon.on('task:session-resumed', typedHandler);

      // Create a mock event and emit it manually to test typing
      const mockEvent: TaskSessionResumedEvent = {
        taskId: 'test-task-123',
        resumeReason: 'manual_resume',
        contextSummary: 'Test context summary',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Session context',
          conversationHistory: undefined,
          stageState: undefined,
          resumePoint: undefined
        },
        timestamp: new Date()
      };

      enhancedDaemon.emit('task:session-resumed', mockEvent);

      expect(typedHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should maintain all existing event types in interface', () => {
      // Verify all expected event types are available
      const eventTypes: Array<keyof EnhancedDaemonEvents> = [
        'daemon:started',
        'daemon:stopped',
        'daemon:error',
        'service:installed',
        'service:uninstalled',
        'usage:mode-changed',
        'session:recovered',
        'workspace:created',
        'workspace:cleaned',
        'idle:suggestion',
        'thought:captured',
        'interaction:received',
        'capacity:restored',
        'tasks:auto-resumed',
        'task:session-resumed' // Our new event
      ];

      // All event types should be valid keys
      eventTypes.forEach(eventType => {
        const handler = vi.fn();

        // This should not throw TypeScript errors
        expect(() => {
          enhancedDaemon.on(eventType, handler as any);
        }).not.toThrow();
      });

      expect(eventTypes).toContain('task:session-resumed');
    });

    it('should support event handler removal for task:session-resumed', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      // Add handlers
      enhancedDaemon.on('task:session-resumed', handler1);
      enhancedDaemon.on('task:session-resumed', handler2);

      // Remove one handler
      enhancedDaemon.off('task:session-resumed', handler1);

      // Create and emit test event
      const mockEvent: TaskSessionResumedEvent = {
        taskId: 'test-removal',
        resumeReason: 'auto_resume',
        contextSummary: 'Test context',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Session context',
          conversationHistory: undefined,
          stageState: undefined
        },
        timestamp: new Date()
      };

      enhancedDaemon.emit('task:session-resumed', mockEvent);

      // Only handler2 should be called
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(mockEvent);
    });

    it('should support once() method for task:session-resumed event', () => {
      const onceHandler = vi.fn();

      enhancedDaemon.once('task:session-resumed', onceHandler);

      // Create test events
      const event1: TaskSessionResumedEvent = {
        taskId: 'test-once-1',
        resumeReason: 'manual_resume',
        contextSummary: 'First event',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Session 1'
        },
        timestamp: new Date()
      };

      const event2: TaskSessionResumedEvent = {
        taskId: 'test-once-2',
        resumeReason: 'auto_resume',
        contextSummary: 'Second event',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Session 2'
        },
        timestamp: new Date()
      };

      // Emit both events
      enhancedDaemon.emit('task:session-resumed', event1);
      enhancedDaemon.emit('task:session-resumed', event2);

      // Handler should only be called once
      expect(onceHandler).toHaveBeenCalledTimes(1);
      expect(onceHandler).toHaveBeenCalledWith(event1);
    });
  });

  describe('Event Forwarding Setup', () => {
    it('should set up event forwarding from orchestrator during construction', () => {
      // Verify that the orchestrator event listener is set up
      const orchestrator = enhancedDaemon['orchestrator'];

      // The setupEventHandlers method should have registered a listener
      // We can verify this by checking that the orchestrator.on method was called
      expect(orchestrator).toBeDefined();

      // Since we can't directly inspect the event listeners without mocking,
      // we'll verify the behavior through emission
      const daemonHandler = vi.fn();
      enhancedDaemon.on('task:session-resumed', daemonHandler);

      // Simulate orchestrator emitting the event
      const mockEvent: TaskSessionResumedEvent = {
        taskId: 'forwarding-test',
        resumeReason: 'capacity_restored',
        contextSummary: 'Forwarding test context',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Forwarded session data'
        },
        timestamp: new Date()
      };

      // Manually emit on orchestrator to simulate the forwarding behavior
      orchestrator.emit('task:session-resumed', mockEvent);

      // The daemon should have forwarded the event
      expect(daemonHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should forward event without modifying the payload', () => {
      const originalEvent: TaskSessionResumedEvent = {
        taskId: 'payload-integrity-test',
        resumeReason: 'budget_reset',
        contextSummary: 'Original context with special characters: åäö, 中文, emoji 🚀',
        previousStatus: 'paused',
        sessionData: {
          lastCheckpoint: new Date('2024-01-15T10:30:00.123Z'),
          contextSummary: 'Complex session data with nested objects',
          conversationHistory: [
            {
              type: 'user',
              content: [{ type: 'text', text: 'Complex conversation entry' }]
            }
          ],
          stageState: {
            complexData: {
              nested: {
                array: [1, 2, 3],
                boolean: true,
                nullValue: null
              }
            }
          },
          resumePoint: {
            stage: 'testing',
            stepIndex: 42,
            metadata: {
              specialChars: 'åäö 中文 🚀',
              largeNumber: 1234567890.123456789
            }
          }
        },
        timestamp: new Date('2024-01-15T10:30:00.123Z')
      };

      const forwardedEventCapture = vi.fn();
      enhancedDaemon.on('task:session-resumed', forwardedEventCapture);

      // Emit original event on orchestrator
      const orchestrator = enhancedDaemon['orchestrator'];
      orchestrator.emit('task:session-resumed', originalEvent);

      expect(forwardedEventCapture).toHaveBeenCalledTimes(1);
      const forwardedEvent = forwardedEventCapture.mock.calls[0][0];

      // Event should be forwarded without modification
      expect(forwardedEvent).toEqual(originalEvent);

      // Verify deep equality of complex nested data
      expect(forwardedEvent.sessionData.stageState?.complexData?.nested?.array).toEqual([1, 2, 3]);
      expect(forwardedEvent.sessionData.resumePoint?.metadata?.specialChars).toBe('åäö 中文 🚀');
      expect(forwardedEvent.timestamp).toEqual(new Date('2024-01-15T10:30:00.123Z'));
    });
  });

  describe('Event System Compatibility', () => {
    it('should not interfere with existing event patterns', () => {
      // Test that adding the new event doesn't break existing functionality
      const existingEventHandlers = {
        'daemon:started': vi.fn(),
        'daemon:error': vi.fn(),
        'capacity:restored': vi.fn(),
        'tasks:auto-resumed': vi.fn(),
        'task:session-resumed': vi.fn() // New event
      };

      // Register all handlers
      Object.entries(existingEventHandlers).forEach(([event, handler]) => {
        enhancedDaemon.on(event as keyof EnhancedDaemonEvents, handler as any);
      });

      // Emit some events to test isolation
      enhancedDaemon.emit('daemon:started');
      enhancedDaemon.emit('daemon:error', new Error('Test error'));

      // Only the appropriate handlers should be called
      expect(existingEventHandlers['daemon:started']).toHaveBeenCalledTimes(1);
      expect(existingEventHandlers['daemon:error']).toHaveBeenCalledTimes(1);
      expect(existingEventHandlers['capacity:restored']).not.toHaveBeenCalled();
      expect(existingEventHandlers['tasks:auto-resumed']).not.toHaveBeenCalled();
      expect(existingEventHandlers['task:session-resumed']).not.toHaveBeenCalled();
    });

    it('should handle concurrent event listeners across different event types', () => {
      const eventLog: Array<{ type: string; timestamp: number }> = [];

      // Set up listeners for multiple event types
      enhancedDaemon.on('daemon:started', () => {
        eventLog.push({ type: 'daemon:started', timestamp: Date.now() });
      });

      enhancedDaemon.on('task:session-resumed', () => {
        eventLog.push({ type: 'task:session-resumed', timestamp: Date.now() });
      });

      enhancedDaemon.on('capacity:restored', () => {
        eventLog.push({ type: 'capacity:restored', timestamp: Date.now() });
      });

      // Emit events in sequence
      enhancedDaemon.emit('daemon:started');
      enhancedDaemon.emit('task:session-resumed', {
        taskId: 'concurrent-test',
        resumeReason: 'manual_resume',
        contextSummary: 'Concurrent test',
        previousStatus: 'paused',
        sessionData: { lastCheckpoint: new Date() },
        timestamp: new Date()
      } as TaskSessionResumedEvent);

      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].type).toBe('daemon:started');
      expect(eventLog[1].type).toBe('task:session-resumed');
    });
  });

  describe('Error Handling in Event System', () => {
    it('should handle errors in task:session-resumed handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler failed');
      });
      const workingHandler = vi.fn();

      enhancedDaemon.on('task:session-resumed', errorHandler);
      enhancedDaemon.on('task:session-resumed', workingHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const testEvent: TaskSessionResumedEvent = {
        taskId: 'error-handling-test',
        resumeReason: 'manual_resume',
        contextSummary: 'Error handling test',
        previousStatus: 'paused',
        sessionData: { lastCheckpoint: new Date() },
        timestamp: new Date()
      };

      // Emit event - should not throw despite error handler
      expect(() => {
        enhancedDaemon.emit('task:session-resumed', testEvent);
      }).not.toThrow();

      // Both handlers should have been called
      expect(errorHandler).toHaveBeenCalledWith(testEvent);
      expect(workingHandler).toHaveBeenCalledWith(testEvent);

      consoleSpy.mockRestore();
    });

    it('should handle invalid event data gracefully', () => {
      const handler = vi.fn();
      enhancedDaemon.on('task:session-resumed', handler);

      // Try to emit with invalid data (this tests runtime behavior)
      const invalidEvent = {
        taskId: null, // Invalid
        resumeReason: undefined, // Invalid
        // Missing required fields
      } as any;

      expect(() => {
        enhancedDaemon.emit('task:session-resumed', invalidEvent);
      }).not.toThrow();

      expect(handler).toHaveBeenCalledWith(invalidEvent);
    });
  });
});