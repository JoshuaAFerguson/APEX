/**
 * Comprehensive test suite for auto-fix event streaming
 * Tests CLI progress display, event sequencing, edge cases, and performance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { useOrchestratorEvents } from '../ui/hooks/useOrchestratorEvents.js';
import { renderHook, act } from '@testing-library/react';

// Mock ora to capture spinner interactions
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  text: '',
};

vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner)
}));

// Mock chalk for color output
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
  }
}));

describe('Auto-fix Event Streaming - Comprehensive Tests', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let eventHandlers: Record<string, Function>;
  let consoleSpy: any;

  beforeEach(() => {
    eventHandlers = {};

    mockOrchestrator = {
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      off: vi.fn()
    };

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Event Handler Registration', () => {
    it('should register all auto-fix event listeners', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      const expectedEvents = [
        'autofix:requested',
        'autofix:started',
        'autofix:progress',
        'autofix:completed',
        'autofix:failed',
        'autofix:skipped'
      ];

      expectedEvents.forEach(event => {
        expect(mockOrchestrator.on).toHaveBeenCalledWith(event, expect.any(Function));
      });
    });

    it('should properly cleanup event listeners', () => {
      const { unmount } = renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      unmount();

      const expectedEvents = [
        'autofix:requested',
        'autofix:started',
        'autofix:progress',
        'autofix:completed',
        'autofix:failed',
        'autofix:skipped'
      ];

      expectedEvents.forEach(event => {
        expect(mockOrchestrator.off).toHaveBeenCalledWith(event, expect.any(Function));
      });
    });
  });

  describe('Event Sequence Testing', () => {
    it('should handle complete auto-fix lifecycle correctly', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      const ora = require('ora').default;

      // Step 1: Auto-fix requested
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixTypes: ['imports', 'formatting'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      expect(ora).toHaveBeenCalledWith({
        text: expect.stringContaining('Auto-fixing'),
        color: 'yellow'
      });
      expect(mockSpinner.start).toHaveBeenCalled();

      // Step 2: Auto-fix started
      act(() => {
        eventHandlers['autofix:started']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixType: 'imports',
          detectedIssues: 5,
          timestamp: new Date()
        });
      });

      expect(mockSpinner.text).toContain('Fixing 5 imports issues');

      // Step 3: Auto-fix progress
      act(() => {
        eventHandlers['autofix:progress']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixType: 'imports',
          iteration: 1,
          totalIterations: 3,
          issuesFixed: 2,
          timestamp: new Date()
        });
      });

      expect(mockSpinner.text).toContain('1/3 - Fixed 2 imports issues');

      // Step 4: Auto-fix completed
      act(() => {
        eventHandlers['autofix:completed']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixType: 'imports',
          issuesDetected: 5,
          issuesFixed: 5,
          duration: 250,
          timestamp: new Date()
        });
      });

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('Fixed 5/5 imports issues')
      );
    });

    it('should handle auto-fix failure after progress', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      // Request and start auto-fix
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'test-task',
          filePath: '/test/large-file.ts',
          fixTypes: ['eslint'],
          triggeredBy: 'manual',
          timestamp: new Date()
        });
      });

      act(() => {
        eventHandlers['autofix:started']({
          taskId: 'test-task',
          filePath: '/test/large-file.ts',
          fixType: 'eslint',
          detectedIssues: 10,
          timestamp: new Date()
        });
      });

      // Show some progress
      act(() => {
        eventHandlers['autofix:progress']({
          taskId: 'test-task',
          filePath: '/test/large-file.ts',
          fixType: 'eslint',
          iteration: 2,
          totalIterations: 5,
          issuesFixed: 3,
          timestamp: new Date()
        });
      });

      // Then fail
      act(() => {
        eventHandlers['autofix:failed']({
          taskId: 'test-task',
          filePath: '/test/large-file.ts',
          fixType: 'eslint',
          error: 'Syntax error in file',
          issuesDetected: 10,
          issuesFixed: 3,
          timestamp: new Date()
        });
      });

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Auto-fix failed - Syntax error in file')
      );
    });
  });

  describe('Multiple File Handling', () => {
    it('should track multiple files being auto-fixed simultaneously', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'multi-file-task'
      }));

      // File 1: Start auto-fix
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'multi-file-task',
          filePath: '/test/file1.ts',
          fixTypes: ['imports'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      // File 2: Start auto-fix
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'multi-file-task',
          filePath: '/test/file2.ts',
          fixTypes: ['formatting'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      const ora = require('ora').default;
      expect(mockSpinner.text).toContain('2 file(s)');

      // Complete file 1
      act(() => {
        eventHandlers['autofix:completed']({
          taskId: 'multi-file-task',
          filePath: '/test/file1.ts',
          fixType: 'imports',
          issuesDetected: 3,
          issuesFixed: 3,
          duration: 120,
          timestamp: new Date()
        });
      });

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('file1.ts: Fixed 3/3 imports issues')
      );

      // Skip file 2
      act(() => {
        eventHandlers['autofix:skipped']({
          taskId: 'multi-file-task',
          filePath: '/test/file2.ts',
          reason: 'no_issues',
          timestamp: new Date()
        });
      });

      expect(mockSpinner.info).toHaveBeenCalledWith(
        expect.stringContaining('file2.ts: Skipped - no_issues')
      );
    });
  });

  describe('Task ID Filtering', () => {
    it('should ignore events for different task IDs', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'target-task'
      }));

      // Event for different task
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'other-task',
          filePath: '/test/file.ts',
          fixTypes: ['imports'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      // Should not create spinner for different task
      const ora = require('ora').default;
      expect(ora).not.toHaveBeenCalled();
    });

    it('should handle events for correct task ID', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'target-task'
      }));

      // Event for correct task
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'target-task',
          filePath: '/test/file.ts',
          fixTypes: ['imports'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      // Should create spinner for correct task
      const ora = require('ora').default;
      expect(ora).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle auto-fix events without existing spinner', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      // Complete without prior request (edge case)
      act(() => {
        eventHandlers['autofix:completed']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixType: 'imports',
          issuesDetected: 0,
          issuesFixed: 0,
          duration: 50,
          timestamp: new Date()
        });
      });

      // Should not throw error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No imports issues found')
      );
    });

    it('should handle progress events with undefined totalIterations', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixTypes: ['eslint'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      act(() => {
        eventHandlers['autofix:progress']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixType: 'eslint',
          iteration: 3,
          // totalIterations: undefined (not provided)
          issuesFixed: 2,
          timestamp: new Date()
        });
      });

      expect(mockSpinner.text).toContain('3'); // Should show iteration count
    });

    it('should handle very long file paths gracefully', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      const longPath = '/very/long/path/to/some/deeply/nested/directory/structure/with/many/levels/file.ts';

      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'test-task',
          filePath: longPath,
          fixTypes: ['imports'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      act(() => {
        eventHandlers['autofix:completed']({
          taskId: 'test-task',
          filePath: longPath,
          fixType: 'imports',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 100,
          timestamp: new Date()
        });
      });

      // Should extract just filename for display
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('file.ts: Fixed 1/1 imports issues')
      );
    });

    it('should handle empty or malformed fix types array', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'test-task'
      }));

      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixTypes: [], // Empty array
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      // Should not crash
      expect(mockSpinner.start).toHaveBeenCalled();
    });
  });

  describe('Performance and Timing', () => {
    it('should handle rapid sequence of events', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'rapid-task'
      }));

      // Rapid fire events
      const events = Array.from({ length: 10 }, (_, i) => ({
        taskId: 'rapid-task',
        filePath: `/test/file${i}.ts`,
        fixTypes: ['imports'],
        triggeredBy: 'batch',
        timestamp: new Date()
      }));

      act(() => {
        events.forEach(event => {
          eventHandlers['autofix:requested'](event);
        });
      });

      // Should handle all events
      expect(mockSpinner.text).toContain('10 file(s)');
    });

    it('should display meaningful duration information', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'timing-task'
      }));

      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'timing-task',
          filePath: '/test/slow-file.ts',
          fixTypes: ['eslint'],
          triggeredBy: 'manual',
          timestamp: new Date()
        });
      });

      // Test with various durations
      const durations = [50, 150, 1250, 5000];
      durations.forEach(duration => {
        act(() => {
          eventHandlers['autofix:completed']({
            taskId: 'timing-task',
            filePath: '/test/slow-file.ts',
            fixType: 'eslint',
            issuesDetected: 3,
            issuesFixed: 3,
            duration,
            timestamp: new Date()
          });
        });

        expect(mockSpinner.succeed).toHaveBeenCalledWith(
          expect.stringContaining(`(${duration}ms)`)
        );

        // Reset for next iteration
        vi.clearAllMocks();
      });
    });
  });

  describe('Integration with Task Lifecycle', () => {
    it('should clean up spinners when task completes', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'lifecycle-task'
      }));

      // Start auto-fix
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'lifecycle-task',
          filePath: '/test/file.ts',
          fixTypes: ['imports'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      // Task completes before auto-fix finishes
      act(() => {
        eventHandlers['task:completed']({
          id: 'lifecycle-task',
          status: 'completed'
        });
      });

      expect(mockSpinner.stop).toHaveBeenCalled();
    });

    it('should clean up spinners when task fails', () => {
      renderHook(() => useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId: 'failing-task'
      }));

      // Start auto-fix
      act(() => {
        eventHandlers['autofix:requested']({
          taskId: 'failing-task',
          filePath: '/test/file.ts',
          fixTypes: ['imports'],
          triggeredBy: 'hook',
          timestamp: new Date()
        });
      });

      // Task fails
      act(() => {
        eventHandlers['task:failed']({
          id: 'failing-task',
          status: 'failed'
        }, new Error('Task failed'));
      });

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Task failed')
      );
    });
  });
});