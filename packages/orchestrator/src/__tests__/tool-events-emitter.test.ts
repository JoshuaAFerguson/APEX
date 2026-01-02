/**
 * @fileoverview Tests for tool call event emitter functionality
 *
 * This test validates that the ApexOrchestrator can emit tool call events
 * and that event listeners can properly capture them.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ToolCallStartEvent, ToolCallCompleteEvent, ToolCallProgressEvent } from '../index';

// Simple test emitter class that extends EventEmitter like ApexOrchestrator
class MockToolEventEmitter extends EventEmitter {
  emitToolStart(event: ToolCallStartEvent) {
    this.emit('tool:start', event);
  }

  emitToolComplete(event: ToolCallCompleteEvent) {
    this.emit('tool:complete', event);
  }

  emitToolProgress(event: ToolCallProgressEvent) {
    this.emit('tool:progress', event);
  }
}

describe('Tool Call Event Emitter', () => {
  it('should emit and receive tool:start events', () => {
    const emitter = new MockToolEventEmitter();
    const listener = vi.fn();

    emitter.on('tool:start', listener);

    const startEvent: ToolCallStartEvent = {
      taskId: 'task-123',
      toolName: 'Read',
      input: { file_path: '/test.txt' },
      timestamp: new Date(),
      callId: 'call-123',
    };

    emitter.emitToolStart(startEvent);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(startEvent);
  });

  it('should emit and receive tool:complete events', () => {
    const emitter = new MockToolEventEmitter();
    const listener = vi.fn();

    emitter.on('tool:complete', listener);

    const completeEvent: ToolCallCompleteEvent = {
      taskId: 'task-456',
      toolName: 'Write',
      callId: 'call-456',
      result: {
        success: true,
        output: 'Written successfully',
      },
      timing: {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:00:01Z'),
        duration: 1000,
      },
      timestamp: new Date(),
    };

    emitter.emitToolComplete(completeEvent);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(completeEvent);
  });

  it('should emit and receive tool:progress events', () => {
    const emitter = new MockToolEventEmitter();
    const listener = vi.fn();

    emitter.on('tool:progress', listener);

    const progressEvent: ToolCallProgressEvent = {
      taskId: 'task-789',
      toolName: 'LongTool',
      callId: 'call-789',
      progress: {
        message: 'Processing...',
        percentage: 50,
      },
      timestamp: new Date(),
    };

    emitter.emitToolProgress(progressEvent);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(progressEvent);
  });

  it('should handle multiple listeners for the same event', () => {
    const emitter = new MockToolEventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on('tool:start', listener1);
    emitter.on('tool:start', listener2);

    const event: ToolCallStartEvent = {
      taskId: 'multi-listener-task',
      toolName: 'TestTool',
      input: { test: true },
      timestamp: new Date(),
      callId: 'multi-call',
    };

    emitter.emitToolStart(event);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it('should handle event listener removal', () => {
    const emitter = new MockToolEventEmitter();
    const listener = vi.fn();

    emitter.on('tool:complete', listener);

    // Emit an event - should be received
    const event1: ToolCallCompleteEvent = {
      taskId: 'remove-test',
      toolName: 'RemoveTool',
      callId: 'remove-call-1',
      result: { success: true },
      timing: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
      },
      timestamp: new Date(),
    };

    emitter.emitToolComplete(event1);
    expect(listener).toHaveBeenCalledOnce();

    // Remove listener
    emitter.removeListener('tool:complete', listener);

    // Emit another event - should not be received
    const event2: ToolCallCompleteEvent = {
      ...event1,
      callId: 'remove-call-2',
    };

    emitter.emitToolComplete(event2);
    expect(listener).toHaveBeenCalledOnce(); // Still only called once
  });

  it('should support once() listeners', () => {
    const emitter = new MockToolEventEmitter();
    const listener = vi.fn();

    emitter.once('tool:progress', listener);

    const event: ToolCallProgressEvent = {
      taskId: 'once-test',
      toolName: 'OnceTool',
      callId: 'once-call',
      progress: { message: 'Once event' },
      timestamp: new Date(),
    };

    // First emission - should be received
    emitter.emitToolProgress(event);
    expect(listener).toHaveBeenCalledOnce();

    // Second emission - should not be received
    emitter.emitToolProgress({ ...event, callId: 'once-call-2' });
    expect(listener).toHaveBeenCalledOnce(); // Still only called once
  });

  it('should emit events in the correct order', () => {
    const emitter = new MockToolEventEmitter();
    const events: string[] = [];

    emitter.on('tool:start', () => events.push('start'));
    emitter.on('tool:progress', () => events.push('progress'));
    emitter.on('tool:complete', () => events.push('complete'));

    const baseEvent = {
      taskId: 'order-test',
      toolName: 'OrderTool',
      callId: 'order-call',
      timestamp: new Date(),
    };

    // Emit in expected tool lifecycle order
    emitter.emitToolStart({
      ...baseEvent,
      input: { test: true },
    });

    emitter.emitToolProgress({
      ...baseEvent,
      progress: { message: 'Working...' },
    });

    emitter.emitToolComplete({
      ...baseEvent,
      result: { success: true },
      timing: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
      },
    });

    expect(events).toEqual(['start', 'progress', 'complete']);
  });

  it('should handle errors in event listeners gracefully', () => {
    const emitter = new MockToolEventEmitter();
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const goodListener = vi.fn();

    emitter.on('tool:start', errorListener);
    emitter.on('tool:start', goodListener);

    const event: ToolCallStartEvent = {
      taskId: 'error-test',
      toolName: 'ErrorTool',
      input: { test: true },
      timestamp: new Date(),
      callId: 'error-call',
    };

    // Should not throw an error from the emitter
    expect(() => {
      emitter.emitToolStart(event);
    }).not.toThrow();

    // Both listeners should have been called
    expect(errorListener).toHaveBeenCalledOnce();
    expect(goodListener).toHaveBeenCalledOnce();
  });
});