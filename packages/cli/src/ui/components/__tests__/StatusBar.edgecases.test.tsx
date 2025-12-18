import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Mock useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn(() => ({
  width: 120,
  height: 30,
  breakpoint: 'normal' as const,
  isAvailable: true,
  isNarrow: false,
  isCompact: false,
  isNormal: true,
  isWide: false,
}));

vi.mock('../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StatusBar - Edge Cases and Error Conditions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal' as const,
      isAvailable: true,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
  };

  describe('Malformed and extreme data handling', () => {
    it('handles negative token values gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70, // Test abbreviations with edge case data
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: -100, output: -50 }}
          model="opus"
        />
      );

      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument();
      // Component should not crash with negative values
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles NaN and Infinity cost values', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      // Test NaN cost
      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          cost={NaN}
        />
      );

      expect(screen.getByText('●')).toBeInTheDocument();

      // Test Infinity cost
      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          cost={Infinity}
        />
      );

      expect(screen.getByText('●')).toBeInTheDocument();

      // Test -Infinity cost
      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          cost={-Infinity}
        />
      );

      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles extremely long strings gracefully', () => {
      const veryLongString = 'a'.repeat(1000);

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          gitBranch={veryLongString}
          agent={veryLongString}
          workflowStage={veryLongString}
          model={veryLongString}
          sessionName={veryLongString}
        />
      );

      // Should render without errors and potentially truncate
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles empty and whitespace-only strings', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          gitBranch=""
          agent="   "
          workflowStage="\t\n"
          model=""
          tokens={{ input: 500, output: 300 }}
        />
      );

      // Should still show abbreviations for valid data
      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles zero and very small terminal dimensions', () => {
      const extremeCases = [
        { width: 0, height: 0 },
        { width: 1, height: 1 },
        { width: 5, height: 1 },
      ];

      extremeCases.forEach(({ width, height }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height,
          breakpoint: 'narrow' as const,
          isAvailable: false,
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(
          <StatusBar
            {...defaultProps}
            displayMode="normal"
            tokens={{ input: 100, output: 50 }}
            cost={0.1234}
            model="opus"
          />
        );

        // Should render without crashing
        expect(screen.getByText('●')).toBeInTheDocument();
      });
    });

    it('handles extremely large terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10000,
        height: 1000,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
        />
      );

      // Should use full labels in very wide terminal
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument();
    });
  });

  describe('Invalid date and time handling', () => {
    it('handles invalid session start time', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          sessionStartTime={new Date('invalid date')}
        />
      );

      // Should show default timer
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles session start time in the future', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute in the future

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          sessionStartTime={futureDate}
        />
      );

      // Should handle gracefully
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles very old session start time', () => {
      const veryOldDate = new Date('1970-01-01T00:00:00Z');

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          sessionStartTime={veryOldDate}
        />
      );

      // Should handle gracefully without overflow
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('Verbose mode edge cases', () => {
    it('handles missing or invalid detailed timing data', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const invalidTimingCases = [
        { totalActiveTime: NaN },
        { totalActiveTime: -1000 },
        { totalIdleTime: Infinity },
        { currentStageElapsed: undefined },
        {
          totalActiveTime: null as any,
          totalIdleTime: 'invalid' as any,
          currentStageElapsed: {} as any,
        },
      ];

      invalidTimingCases.forEach((detailedTiming, index) => {
        const { unmount } = render(
          <StatusBar
            {...defaultProps}
            displayMode="verbose"
            workflowStage="testing"
            tokens={{ input: 500, output: 300 }}
            detailedTiming={detailedTiming}
          />
        );

        // Should still render verbose mode indicator
        expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
        expect(screen.getByText('tokens:')).toBeInTheDocument();

        unmount();
      });
    });

    it('handles verbose mode with missing session cost', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          cost={0.1234}
          sessionCost={undefined}
        />
      );

      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('session:')).not.toBeInTheDocument();
    });

    it('handles verbose mode with zero timing values', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          workflowStage="testing"
          detailedTiming={{
            totalActiveTime: 0,
            totalIdleTime: 0,
            currentStageElapsed: 0,
          }}
        />
      );

      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('0s')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
    });
  });

  describe('Abbreviation system edge cases', () => {
    it('handles missing abbreviatedLabel properties gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70, // Force abbreviations
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      // Test with all possible segments to ensure no abbreviation is missing
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          gitBranch="test"
          agent="planner"
          workflowStage="implementation"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          sessionCost={0.5678}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionStartTime={new Date()}
          subtaskProgress={{ completed: 3, total: 5 }}
          sessionName="Test Session"
        />
      );

      // Should not crash and should render abbreviated labels where available
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
    });

    it('handles rapid switching between abbreviation modes', () => {
      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // Rapidly switch terminal widths to trigger abbreviation changes
      const widths = [120, 70, 120, 50, 150, 60, 100, 75];

      widths.forEach((width) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: width < 80 ? 'narrow' : (width < 100 ? 'compact' : (width < 120 ? 'normal' : 'wide')) as any,
          isAvailable: true,
          isNarrow: width < 80,
          isCompact: width >= 80 && width < 100,
          isNormal: width >= 100 && width < 120,
          isWide: width >= 120,
        });

        rerender(
          <StatusBar
            {...defaultProps}
            displayMode="normal"
            tokens={{ input: 500, output: 300 }}
            model="opus"
          />
        );
      });

      // Should still render correctly after rapid changes
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles boundary conditions for auto abbreviation mode', () => {
      const boundaryCases = [
        { width: 79.9, expectAbbreviated: true },  // Just under 80
        { width: 80.0, expectAbbreviated: false }, // Exactly 80
        { width: 80.1, expectAbbreviated: false }, // Just over 80
      ];

      boundaryCases.forEach(({ width, expectAbbreviated }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width: Math.floor(width), // Terminal width is integer
          height: 24,
          breakpoint: width < 80 ? 'narrow' : 'compact' as any,
          isAvailable: true,
          isNarrow: width < 80,
          isCompact: width >= 80,
          isNormal: false,
          isWide: false,
        });

        const { unmount } = render(
          <StatusBar
            {...defaultProps}
            displayMode="normal"
            tokens={{ input: 500, output: 300 }}
            model="opus"
          />
        );

        if (expectAbbreviated) {
          expect(screen.getByText('tok:')).toBeInTheDocument();
          expect(screen.getByText('mod:')).toBeInTheDocument();
        } else {
          expect(screen.getByText('tokens:')).toBeInTheDocument();
          expect(screen.getByText('model:')).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('React component lifecycle edge cases', () => {
    it('handles unmounting during timer updates', () => {
      const startTime = new Date();

      const { unmount } = render(
        <StatusBar
          {...defaultProps}
          sessionStartTime={startTime}
        />
      );

      // Advance timers to trigger updates
      vi.advanceTimersByTime(1000);

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles multiple rapid re-renders with different props', () => {
      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
        />
      );

      // Rapidly change props to test state management
      const propChanges = [
        { displayMode: 'compact' as const, tokens: { input: 100, output: 50 } },
        { displayMode: 'verbose' as const, tokens: { input: 200, output: 100 } },
        { displayMode: 'normal' as const, tokens: { input: 300, output: 150 } },
        { displayMode: 'compact' as const, tokens: { input: 400, output: 200 } },
        { displayMode: 'verbose' as const, tokens: { input: 500, output: 250 } },
      ];

      propChanges.forEach((props) => {
        rerender(
          <StatusBar
            {...defaultProps}
            {...props}
          />
        );
      });

      // Should end up in final state without errors
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('handles component re-mounting with same props', () => {
      const props = {
        ...defaultProps,
        displayMode: 'normal' as const,
        tokens: { input: 500, output: 300 },
        cost: 0.1234,
        model: 'opus',
      };

      // Mount, unmount, and remount
      let { unmount } = render(<StatusBar {...props} />);
      unmount();

      ({ unmount } = render(<StatusBar {...props} />));
      unmount();

      // Final mount should work correctly
      render(<StatusBar {...props} />);

      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
    });
  });

  describe('Memory and performance edge cases', () => {
    it('handles large number of segments without memory issues', () => {
      // Create a scenario with maximum number of segments
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          isConnected={true}
          gitBranch="feature/memory-test"
          agent="comprehensive-agent"
          workflowStage="comprehensive-testing"
          tokens={{ input: 50000, output: 30000 }}
          cost={15.6789}
          sessionCost={25.1234}
          model="claude-3-opus-very-long-model-name"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionStartTime={new Date()}
          subtaskProgress={{ completed: 99, total: 100 }}
          sessionName="Very Long Session Name for Memory Testing Purposes"
          previewMode={true}
          showThoughts={true}
          detailedTiming={{
            totalActiveTime: 7200000, // 2 hours
            totalIdleTime: 3600000,   // 1 hour
            currentStageElapsed: 1800000, // 30 minutes
          }}
        />
      );

      // Should handle all segments without performance issues
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('handles repeated renders with complex data efficiently', () => {
      const complexProps = {
        ...defaultProps,
        displayMode: 'verbose' as const,
        tokens: { input: 10000, output: 8000 },
        cost: 5.6789,
        sessionCost: 12.3456,
        model: 'opus',
        detailedTiming: {
          totalActiveTime: 3600000,
          totalIdleTime: 1800000,
          currentStageElapsed: 900000,
        },
      };

      const { rerender } = render(<StatusBar {...complexProps} />);

      // Perform many re-renders to test for memory leaks
      for (let i = 0; i < 100; i++) {
        rerender(
          <StatusBar
            {...complexProps}
            tokens={{
              input: 10000 + i,
              output: 8000 + i,
            }}
            cost={5.6789 + (i * 0.001)}
          />
        );
      }

      // Should complete without performance degradation
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });
  });
});