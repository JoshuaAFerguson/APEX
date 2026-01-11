/**
 * Test auto-fix event streaming integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { useOrchestratorEvents } from '../ui/hooks/useOrchestratorEvents.js';
import { renderHook, act } from '@testing-library/react';

// Mock ora to avoid side effects in tests
vi.mock('ora', () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: ''
  };

  return {
    default: vi.fn(() => mockSpinner)
  };
});

describe('Auto-fix Event Streaming', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    eventHandlers = {};

    mockOrchestrator = {
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      off: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register auto-fix event listeners', () => {
    renderHook(() => useOrchestratorEvents({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task'
    }));

    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:requested', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:started', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:progress', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:completed', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:failed', expect.any(Function));
    expect(mockOrchestrator.on).toHaveBeenCalledWith('autofix:skipped', expect.any(Function));
  });

  it('should handle autofix:requested event', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useOrchestratorEvents({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task'
    }));

    act(() => {
      eventHandlers['autofix:requested']({
        taskId: 'test-task',
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });
    });

    // Verify ora was called to create a spinner
    const ora = require('ora').default;
    expect(ora).toHaveBeenCalledWith({
      text: expect.stringContaining('Auto-fixing'),
      color: 'yellow'
    });

    consoleSpy.mockRestore();
  });

  it('should handle autofix:completed event', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useOrchestratorEvents({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task'
    }));

    // First trigger autofix:requested to set up the spinner
    act(() => {
      eventHandlers['autofix:requested']({
        taskId: 'test-task',
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });
    });

    // Then trigger autofix:completed
    act(() => {
      eventHandlers['autofix:completed']({
        taskId: 'test-task',
        filePath: '/test/file.ts',
        fixType: 'imports',
        issuesDetected: 3,
        issuesFixed: 3,
        duration: 150,
        timestamp: new Date()
      });
    });

    // The spinner should have succeeded
    const ora = require('ora').default;
    const mockSpinner = ora();
    expect(mockSpinner.succeed).toHaveBeenCalledWith(
      expect.stringContaining('Fixed 3/3 imports issues')
    );

    consoleSpy.mockRestore();
  });

  it('should handle autofix:failed event', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useOrchestratorEvents({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task'
    }));

    // First trigger autofix:requested to set up the spinner
    act(() => {
      eventHandlers['autofix:requested']({
        taskId: 'test-task',
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });
    });

    // Then trigger autofix:failed
    act(() => {
      eventHandlers['autofix:failed']({
        taskId: 'test-task',
        filePath: '/test/file.ts',
        fixType: 'imports',
        error: 'Parse error',
        issuesDetected: 3,
        issuesFixed: 1,
        timestamp: new Date()
      });
    });

    // The spinner should have failed
    const ora = require('ora').default;
    const mockSpinner = ora();
    expect(mockSpinner.fail).toHaveBeenCalledWith(
      expect.stringContaining('Auto-fix failed - Parse error')
    );

    consoleSpy.mockRestore();
  });

  it('should clean up spinners on task completion', () => {
    renderHook(() => useOrchestratorEvents({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task'
    }));

    // Set up a spinner
    act(() => {
      eventHandlers['autofix:requested']({
        taskId: 'test-task',
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });
    });

    // Complete the task
    act(() => {
      eventHandlers['task:completed']({
        id: 'test-task',
        status: 'completed'
      });
    });

    // The spinner should have been stopped
    const ora = require('ora').default;
    const mockSpinner = ora();
    expect(mockSpinner.stop).toHaveBeenCalled();
  });

  it('should ignore events for different task IDs', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useOrchestratorEvents({
      orchestrator: mockOrchestrator as ApexOrchestrator,
      taskId: 'test-task'
    }));

    act(() => {
      eventHandlers['autofix:requested']({
        taskId: 'other-task', // Different task ID
        filePath: '/test/file.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      });
    });

    // Ora should not have been called since the task ID doesn't match
    const ora = require('ora').default;
    expect(ora).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});