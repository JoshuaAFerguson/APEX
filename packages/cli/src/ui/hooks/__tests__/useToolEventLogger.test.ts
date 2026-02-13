/**
 * Tests for useToolEventLogger hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolEventLogger, type ToolEventLoggerOptions } from '../useToolEventLogger.js';
import type {
  ApexOrchestrator,
  ToolCallStartEvent,
  ToolCallCompleteEvent,
  ToolCallProgressEvent
} from '@apexcli/orchestrator';

describe('useToolEventLogger', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let eventListeners: Record<string, Function>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventListeners = {};

    mockOrchestrator = {
      on: vi.fn((event: string, handler: Function) => {
        eventListeners[event] = handler;
      }),
      off: vi.fn((event: string, handler: Function) => {
        delete eventListeners[event];
      }),
    };

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  const createMockToolStartEvent = (overrides?: Partial<ToolCallStartEvent>): ToolCallStartEvent => ({
    taskId: 'task_123',
    callId: 'call_456',
    toolName: 'FileRead',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    input: { file: 'test.txt' },
    ...overrides,
  });

  const createMockToolCompleteEvent = (overrides?: Partial<ToolCallCompleteEvent>): ToolCallCompleteEvent => ({
    taskId: 'task_123',
    callId: 'call_456',
    toolName: 'FileRead',
    result: {
      success: true,
      data: { content: 'file content' },
    },
    timing: {
      startTime: new Date('2024-01-01T12:00:00Z'),
      endTime: new Date('2024-01-01T12:00:01Z'),
      duration: 1000,
    },
    timestamp: new Date('2024-01-01T12:00:01Z'),
    ...overrides,
  });

  const createMockToolProgressEvent = (overrides?: Partial<ToolCallProgressEvent>): ToolCallProgressEvent => ({
    taskId: 'task_123',
    callId: 'call_456',
    toolName: 'FileRead',
    timestamp: new Date('2024-01-01T12:00:00.5Z'),
    progress: {
      message: 'Reading file...',
      percentage: 50,
    },
    ...overrides,
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useToolEventLogger());

    expect(result.current.toolLogs).toEqual([]);
    expect(result.current.activeToolCalls).toEqual(new Map());
    expect(result.current.stats).toEqual({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
    });
  });

  it('should register event listeners when orchestrator is provided', () => {
    renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    expect(mockOrchestrator.on).toHaveBeenCalledWith('tool:start', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('tool:progress', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('tool:complete', expect.any(Function));
  });

  it('should not register listeners when orchestrator is not provided', () => {
    renderHook(() => useToolEventLogger({}));

    expect(mockOrchestrator.on).not.toHaveBeenCalled();
  });

  it('should handle tool start events', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    const startEvent = createMockToolStartEvent();

    act(() => {
      eventListeners['tool:start'](startEvent);
    });

    expect(result.current.toolLogs).toHaveLength(1);
    expect(result.current.toolLogs[0]).toMatchObject({
      level: 'info',
      message: 'Started FileRead',
      category: 'tool',
      agent: 'system',
    });
    expect(result.current.toolLogs[0].data).toMatchObject({
      toolName: 'FileRead',
      callId: 'call_456',
      status: 'started',
    });
    expect(result.current.activeToolCalls.has('call_456')).toBe(true);
    expect(result.current.stats.totalCalls).toBe(1);
  });

  it('should handle tool progress events with messages', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    const progressEvent = createMockToolProgressEvent();

    act(() => {
      eventListeners['tool:progress'](progressEvent);
    });

    expect(result.current.toolLogs).toHaveLength(1);
    expect(result.current.toolLogs[0]).toMatchObject({
      level: 'debug',
      message: 'FileRead: Reading file...',
      category: 'tool',
    });
    expect(result.current.toolLogs[0].data).toMatchObject({
      status: 'progress',
      progress: { message: 'Reading file...', percentage: 50 },
    });
  });

  it('should ignore progress events without messages', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    const progressEvent = createMockToolProgressEvent({
      progress: { percentage: 50 }, // No message
    });

    act(() => {
      eventListeners['tool:progress'](progressEvent);
    });

    expect(result.current.toolLogs).toHaveLength(0);
  });

  it('should handle successful tool completion', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    const startEvent = createMockToolStartEvent();
    const completeEvent = createMockToolCompleteEvent();

    act(() => {
      eventListeners['tool:start'](startEvent);
      eventListeners['tool:complete'](completeEvent);
    });

    expect(result.current.toolLogs).toHaveLength(2);
    expect(result.current.toolLogs[1]).toMatchObject({
      level: 'success',
      message: 'Completed FileRead (1.0s)',
      category: 'tool',
      duration: 1000,
    });
    expect(result.current.toolLogs[1].data).toMatchObject({
      status: 'completed',
    });
    expect(result.current.activeToolCalls.has('call_456')).toBe(false);
    expect(result.current.stats.successfulCalls).toBe(1);
    expect(result.current.stats.averageDuration).toBe(1000);
  });

  it('should handle failed tool completion', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    const completeEvent = createMockToolCompleteEvent({
      result: {
        success: false,
        error: 'File not found',
      },
    });

    act(() => {
      eventListeners['tool:complete'](completeEvent);
    });

    expect(result.current.toolLogs).toHaveLength(1);
    expect(result.current.toolLogs[0]).toMatchObject({
      level: 'error',
      message: 'Failed FileRead: File not found',
    });
    expect(result.current.toolLogs[0].data).toMatchObject({
      status: 'failed',
    });
    expect(result.current.stats.failedCalls).toBe(1);
  });

  it('should filter events by taskId when provided', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'task_123',
    }));

    const matchingEvent = createMockToolStartEvent({ taskId: 'task_123' });
    const nonMatchingEvent = createMockToolStartEvent({ taskId: 'task_456' });

    act(() => {
      eventListeners['tool:start'](matchingEvent);
      eventListeners['tool:start'](nonMatchingEvent);
    });

    expect(result.current.toolLogs).toHaveLength(1);
    expect(result.current.stats.totalCalls).toBe(1);
  });

  it('should respect maxEntries limit', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      maxEntries: 2,
    }));

    // Add 3 entries
    act(() => {
      eventListeners['tool:start'](createMockToolStartEvent({ callId: 'call_1' }));
      eventListeners['tool:start'](createMockToolStartEvent({ callId: 'call_2' }));
      eventListeners['tool:start'](createMockToolStartEvent({ callId: 'call_3' }));
    });

    // Should only keep the last 2
    expect(result.current.toolLogs).toHaveLength(2);
    expect(result.current.toolLogs[0].data.callId).toBe('call_2');
    expect(result.current.toolLogs[1].data.callId).toBe('call_3');
  });

  it('should enable debug logging when debug option is true', () => {
    renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      debug: true,
    }));

    const startEvent = createMockToolStartEvent();

    act(() => {
      eventListeners['tool:start'](startEvent);
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[useToolEventLogger] Tool start',
      { tool: 'FileRead', callId: 'call_456' }
    );
  });

  it('should not log when debug option is false', () => {
    renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      debug: false,
    }));

    const startEvent = createMockToolStartEvent();

    act(() => {
      eventListeners['tool:start'](startEvent);
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const { unmount } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    unmount();

    expect(mockOrchestrator.off).toHaveBeenCalledWith('tool:start', expect.any(Function));
    expect(mockOrchestrator.off).toHaveBeenCalledWith('tool:progress', expect.any(Function));
    expect(mockOrchestrator.off).toHaveBeenCalledWith('tool:complete', expect.any(Function));
  });

  it('should calculate average duration correctly', () => {
    const { result } = renderHook(() => useToolEventLogger({
      orchestrator: mockOrchestrator as ApexOrchestrator
    }));

    act(() => {
      eventListeners['tool:complete'](createMockToolCompleteEvent({
        callId: 'call_1',
        timing: { startTime: new Date(), endTime: new Date(), duration: 1000 }
      }));
      eventListeners['tool:complete'](createMockToolCompleteEvent({
        callId: 'call_2',
        timing: { startTime: new Date(), endTime: new Date(), duration: 2000 }
      }));
    });

    expect(result.current.stats.averageDuration).toBe(1500);
  });

  describe('duration formatting', () => {
    it('should format milliseconds correctly', () => {
      const { result } = renderHook(() => useToolEventLogger({
        orchestrator: mockOrchestrator as ApexOrchestrator
      }));

      const completeEvent = createMockToolCompleteEvent({
        timing: { startTime: new Date(), endTime: new Date(), duration: 500 }
      });

      act(() => {
        eventListeners['tool:complete'](completeEvent);
      });

      expect(result.current.toolLogs[0].message).toContain('(500ms)');
    });

    it('should format seconds correctly', () => {
      const { result } = renderHook(() => useToolEventLogger({
        orchestrator: mockOrchestrator as ApexOrchestrator
      }));

      const completeEvent = createMockToolCompleteEvent({
        timing: { startTime: new Date(), endTime: new Date(), duration: 1500 }
      });

      act(() => {
        eventListeners['tool:complete'](completeEvent);
      });

      expect(result.current.toolLogs[0].message).toContain('(1.5s)');
    });

    it('should format minutes correctly', () => {
      const { result } = renderHook(() => useToolEventLogger({
        orchestrator: mockOrchestrator as ApexOrchestrator
      }));

      const completeEvent = createMockToolCompleteEvent({
        timing: { startTime: new Date(), endTime: new Date(), duration: 125000 } // 2m 5s
      });

      act(() => {
        eventListeners['tool:complete'](completeEvent);
      });

      expect(result.current.toolLogs[0].message).toContain('(2m 5s)');
    });
  });
});