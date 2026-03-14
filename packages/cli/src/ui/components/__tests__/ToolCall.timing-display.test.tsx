import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ToolCall } from '../ToolCall.jsx';

// Mock the useElapsedTime hook
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn()
}));

// Mock the formatDuration utility
vi.mock('@apexcli/core', () => ({
  formatDuration: vi.fn((duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  })
}));

import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { formatDuration } from '@apexcli/core';

const mockUseElapsedTime = vi.mocked(useElapsedTime);
const mockFormatDuration = vi.mocked(formatDuration);

describe('ToolCall Timing Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Acceptance Criteria 5: ToolCall.tsx Timing Display', () => {
    describe('Real-time elapsed time display during running state', () => {
      it('should display real-time elapsed time when tool is running with startTime', () => {
        const startTime = new Date(Date.now() - 5000); // 5 seconds ago
        mockUseElapsedTime.mockReturnValue('5s');

        const { lastFrame } = render(
          <ToolCall
            toolName="LongRunningTool"
            input={{ param: 'value' }}
            status="running"
            startTime={startTime}
            displayMode="normal"
          />
        );

        expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
        expect(lastFrame()).toContain('(5s)');
        expect(lastFrame()).toContain('LongRunningTool');
      });

      it('should not show elapsed time when tool is running but no startTime provided', () => {
        mockUseElapsedTime.mockReturnValue(null);

        const { lastFrame } = render(
          <ToolCall
            toolName="NoTimeTool"
            input={{ param: 'value' }}
            status="running"
            displayMode="normal"
          />
        );

        expect(mockUseElapsedTime).toHaveBeenCalledWith(undefined);
        expect(lastFrame()).not.toContain('(');
        expect(lastFrame()).toContain('NoTimeTool');
      });

      it('should handle edge case of just-started tool (0s elapsed)', () => {
        const startTime = new Date(); // Right now
        mockUseElapsedTime.mockReturnValue('0s');

        const { lastFrame } = render(
          <ToolCall
            toolName="JustStartedTool"
            status="running"
            startTime={startTime}
            displayMode="compact"
          />
        );

        expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
        expect(lastFrame()).toContain('(0s)');
      });

      it('should update elapsed time display in real-time', () => {
        const startTime = new Date(Date.now() - 2000); // 2 seconds ago

        // First render - 2 seconds elapsed
        mockUseElapsedTime.mockReturnValue('2s');
        const { rerender, lastFrame } = render(
          <ToolCall
            toolName="UpdatingTool"
            status="running"
            startTime={startTime}
          />
        );

        expect(lastFrame()).toContain('(2s)');

        // Simulate time passing - 5 seconds elapsed
        mockUseElapsedTime.mockReturnValue('5s');
        rerender(
          <ToolCall
            toolName="UpdatingTool"
            status="running"
            startTime={startTime}
          />
        );

        expect(lastFrame()).toContain('(5s)');
      });
    });

    describe('Fixed duration display after completion', () => {
      it('should display formatted duration when tool completes successfully', () => {
        mockFormatDuration.mockReturnValue('1s 250ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="CompletedTool"
            input={{ param: 'test' }}
            output="Success"
            status="success"
            duration={1250}
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).toHaveBeenCalledWith(1250);
        expect(lastFrame()).toContain('(1s 250ms)');
        expect(lastFrame()).toContain('CompletedTool');
      });

      it('should display formatted duration when tool fails', () => {
        mockFormatDuration.mockReturnValue('500ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="FailedTool"
            input={{ param: 'test' }}
            output="Error occurred"
            status="error"
            duration={500}
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).toHaveBeenCalledWith(500);
        expect(lastFrame()).toContain('500ms');
        expect(lastFrame()).toContain('FailedTool');
      });

      it('should not display duration when tool is pending', () => {
        const { lastFrame } = render(
          <ToolCall
            toolName="PendingTool"
            input={{ param: 'test' }}
            status="pending"
            duration={undefined}
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).not.toHaveBeenCalled();
        expect(lastFrame()).not.toContain('ms');
        expect(lastFrame()).not.toMatch(/\d+s/); // More specific regex to avoid false positives
      });

      it('should prioritize duration over elapsed time when tool is completed', () => {
        const startTime = new Date(Date.now() - 3000);
        mockUseElapsedTime.mockReturnValue('3s');
        mockFormatDuration.mockReturnValue('2s 800ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="CompletedWithBothTool"
            status="success"
            duration={2800}
            startTime={startTime}
            displayMode="normal"
          />
        );

        // Should show duration, not elapsed time
        expect(lastFrame()).toContain('(2s 800ms)');
        expect(lastFrame()).not.toContain('(3s)');
      });
    });

    describe('Display mode variations', () => {
      it('should show timing in compact mode correctly', () => {
        mockFormatDuration.mockReturnValue('750ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="CompactTool"
            input={{ file: 'test.txt' }}
            status="success"
            duration={750}
            displayMode="compact"
          />
        );

        expect(lastFrame()).toContain('CompactTool');
        expect(lastFrame()).toContain('750ms');
        expect(lastFrame()).toContain('file: "test.txt"');
      });

      it('should show running tool timing in compact mode', () => {
        const startTime = new Date(Date.now() - 1500);
        mockUseElapsedTime.mockReturnValue('1s');

        const { lastFrame } = render(
          <ToolCall
            toolName="CompactRunningTool"
            input={{ param: 'value' }}
            status="running"
            startTime={startTime}
            displayMode="compact"
          />
        );

        expect(lastFrame()).toContain('CompactRunningTool');
        expect(lastFrame()).toContain('(1s)');
      });

      it('should show timing in verbose mode with status indicator', () => {
        mockFormatDuration.mockReturnValue('2s');

        const { lastFrame } = render(
          <ToolCall
            toolName="VerboseTool"
            input={{ complex: 'data' }}
            output="Detailed output"
            status="success"
            duration={2000}
            displayMode="verbose"
          />
        );

        expect(lastFrame()).toContain('VerboseTool');
        expect(lastFrame()).toContain('(2s)');
        expect(lastFrame()).toContain('[success]');
      });

      it('should handle collapsed mode correctly with timing', () => {
        mockFormatDuration.mockReturnValue('100ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="CollapsedTool"
            input={{ data: 'test' }}
            output="Output that should be hidden"
            status="success"
            duration={100}
            collapsed={true}
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('CollapsedTool');
        expect(lastFrame()).toContain('100ms');
        // Output should be hidden due to collapsed=true
        expect(lastFrame()).not.toContain('Output that should be hidden');
      });
    });

    describe('Edge cases and error handling', () => {
      it('should handle zero duration gracefully', () => {
        mockFormatDuration.mockReturnValue('0ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="InstantTool"
            status="success"
            duration={0}
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).toHaveBeenCalledWith(0);
        expect(lastFrame()).toContain('0ms');
      });

      it('should handle very large durations', () => {
        const largeDuration = 300000; // 5 minutes
        mockFormatDuration.mockReturnValue('5m 0s');

        const { lastFrame } = render(
          <ToolCall
            toolName="LongTool"
            status="success"
            duration={largeDuration}
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).toHaveBeenCalledWith(largeDuration);
        expect(lastFrame()).toContain('5m 0s');
      });

      it('should handle invalid startTime gracefully', () => {
        const invalidStartTime = new Date('invalid');
        mockUseElapsedTime.mockReturnValue(null);

        const { lastFrame } = render(
          <ToolCall
            toolName="InvalidTimeTool"
            status="running"
            startTime={invalidStartTime}
            displayMode="normal"
          />
        );

        expect(mockUseElapsedTime).toHaveBeenCalledWith(invalidStartTime);
        expect(lastFrame()).not.toContain('(');
        expect(lastFrame()).toContain('InvalidTimeTool');
      });

      it('should not show timing when status is running but startTime is undefined', () => {
        mockUseElapsedTime.mockReturnValue(null);

        const { lastFrame } = render(
          <ToolCall
            toolName="NoStartTimeTool"
            status="running"
            displayMode="normal"
          />
        );

        expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
        expect(lastFrame()).not.toContain('(');
      });

      it('should handle negative duration edge case', () => {
        // This shouldn't happen in practice, but let's test graceful handling
        mockFormatDuration.mockReturnValue('-1ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="NegativeDurationTool"
            status="error"
            duration={-1}
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).toHaveBeenCalledWith(-1);
        expect(lastFrame()).toContain('-1ms');
      });
    });

    describe('Integration with tool status and timing', () => {
      it('should show appropriate timing for error status with duration', () => {
        mockFormatDuration.mockReturnValue('300ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="ErrorTool"
            input={{ param: 'test' }}
            output="Error: File not found"
            status="error"
            duration={300}
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('ErrorTool');
        expect(lastFrame()).toContain('300ms');
        expect(lastFrame()).toContain('✗'); // Error icon
      });

      it('should not interfere with output display in normal mode', () => {
        mockFormatDuration.mockReturnValue('1s');

        const { lastFrame } = render(
          <ToolCall
            toolName="OutputTool"
            input={{ file: 'test.txt' }}
            output="File contents here"
            status="success"
            duration={1000}
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('OutputTool');
        expect(lastFrame()).toContain('1s');
        expect(lastFrame()).toContain('File contents here');
      });

      it('should handle missing input gracefully with timing', () => {
        mockFormatDuration.mockReturnValue('150ms');

        const { lastFrame } = render(
          <ToolCall
            toolName="NoInputTool"
            status="success"
            duration={150}
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('NoInputTool');
        expect(lastFrame()).toContain('150ms');
      });
    });

    describe('Real-time updates during tool execution', () => {
      it('should handle state transitions from running to completed', () => {
        const startTime = new Date(Date.now() - 2000);
        mockUseElapsedTime.mockReturnValue('2s');

        // Initial render - tool is running
        const { rerender, lastFrame } = render(
          <ToolCall
            toolName="TransitionTool"
            status="running"
            startTime={startTime}
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('(2s)');

        // Tool completes - switch to duration display
        mockFormatDuration.mockReturnValue('2s 100ms');
        rerender(
          <ToolCall
            toolName="TransitionTool"
            status="success"
            duration={2100}
            output="Completed successfully"
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('(2s 100ms)');
        expect(lastFrame()).not.toContain('(2s)');
        expect(lastFrame()).toContain('✓'); // Success icon
      });

      it('should handle state transition from running to error', () => {
        const startTime = new Date(Date.now() - 1000);
        mockUseElapsedTime.mockReturnValue('1s');

        // Initial render - tool is running
        const { rerender, lastFrame } = render(
          <ToolCall
            toolName="ErrorTransitionTool"
            status="running"
            startTime={startTime}
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('(1s)');

        // Tool fails - switch to duration display
        mockFormatDuration.mockReturnValue('1s 50ms');
        rerender(
          <ToolCall
            toolName="ErrorTransitionTool"
            status="error"
            duration={1050}
            output="Error: Operation failed"
            displayMode="normal"
          />
        );

        expect(lastFrame()).toContain('(1s 50ms)');
        expect(lastFrame()).toContain('✗'); // Error icon
      });
    });

    describe('Performance considerations', () => {
      it('should not call formatDuration when duration is undefined', () => {
        mockUseElapsedTime.mockReturnValue(null);

        render(
          <ToolCall
            toolName="NoDurationTool"
            status="pending"
            displayMode="normal"
          />
        );

        expect(mockFormatDuration).not.toHaveBeenCalled();
      });

      it('should not call useElapsedTime when status is not running', () => {
        const startTime = new Date();
        mockFormatDuration.mockReturnValue('500ms');

        render(
          <ToolCall
            toolName="CompletedTool"
            status="success"
            duration={500}
            startTime={startTime}
            displayMode="normal"
          />
        );

        expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      });
    });
  });
});