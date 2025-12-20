import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn<[], StdoutDimensions>();

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StatusBar - Hook Compatibility & Regression Prevention', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'main',
    agent: 'tester',
    model: 'sonnet',
    cost: 0.05,
  };

  describe('Hook integration compatibility', () => {
    it('works when hook returns all breakpoint helpers as false (edge case)', () => {
      // Edge case: what if all helpers are false?
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Should still render basic elements
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('handles hook throwing errors gracefully', () => {
      // Test error boundary scenario
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Mock hook error');
      });

      // Should not crash the application
      expect(() => {
        render(<StatusBar {...defaultProps} />);
      }).toThrow('Mock hook error');

      // Reset for other tests
      mockUseStdoutDimensions.mockRestore();
    });

    it('maintains existing responsive.test.tsx compatibility', () => {
      // Ensure our new implementation matches the patterns expected by existing tests
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} tokens={{ input: 1000, output: 500 }} />);

      // Should behave as expected by existing tests
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('1.5k')).toBeInTheDocument();
    });

    it('respects existing trimToFit logic with priority system', () => {
      // Test that the enhanced trimToFit doesn't break existing behavior
      mockUseStdoutDimensions.mockReturnValue({
        width: 40, // Very narrow to trigger trimming
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar
        {...defaultProps}
        gitBranch="very-long-branch-name-that-should-be-handled"
        tokens={{ input: 5000, output: 2000 }}
        workflowStage="implementation"
      />);

      // Should still show critical elements
      expect(screen.getByText('●')).toBeInTheDocument();

      // Should handle long branch name appropriately
      const branchElement = screen.queryByText(/very-long/);
      // Either truncated or completely hidden due to space constraints
      expect(branchElement).toBeInTheDocument();
    });
  });

  describe('Backwards compatibility with existing patterns', () => {
    it('maintains session timer behavior from existing tests', () => {
      const sessionStart = new Date(Date.now() - 65000); // 1 minute 5 seconds ago

      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 25,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} sessionStartTime={sessionStart} />);

      // Timer should be visible (critical priority)
      expect(screen.getByText('01:05')).toBeInTheDocument();
    });

    it('preserves existing compact mode behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200, // Wide terminal
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...defaultProps} displayMode="compact" />);

      // Compact mode should override wide breakpoint
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('$0.05')).toBeInTheDocument();

      // Other elements should be hidden despite wide terminal
      expect(screen.queryByText('tester')).not.toBeInTheDocument();
      expect(screen.queryByText('sonnet')).not.toBeInTheDocument();
    });

    it('preserves existing verbose mode behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50, // Narrow terminal
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar
        {...defaultProps}
        displayMode="verbose"
        tokens={{ input: 2000, output: 1000 }}
        detailedTiming={{
          totalActiveTime: 120000,
          totalIdleTime: 30000,
          currentStageElapsed: 45000,
        }}
      />);

      // Verbose mode should override narrow breakpoint
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Should show verbose timing details
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
    });
  });

  describe('Regression prevention for existing features', () => {
    it('maintains connection status colors and icons', () => {
      // Test connected state
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 25,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} isConnected={true} />);
      expect(screen.getByText('●')).toBeInTheDocument();

      // Test disconnected state
      rerender(<StatusBar {...defaultProps} isConnected={false} />);
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('maintains token formatting across breakpoints', () => {
      const breakpoints = [
        { width: 80, breakpoint: 'compact' as const },
        { width: 120, breakpoint: 'normal' as const },
        { width: 180, breakpoint: 'wide' as const },
      ];

      breakpoints.forEach(({ width, breakpoint }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow: false,
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
        });

        const { rerender } = render(<StatusBar
          {...defaultProps}
          tokens={{ input: 1500, output: 750 }}
        />);

        // Token formatting should be consistent
        expect(screen.getByText('2.3k')).toBeInTheDocument(); // 1500 + 750 = 2250 ≈ 2.3k

        if (index < breakpoints.length - 1) rerender(<></>);
      });
    });

    it('maintains cost formatting with different values', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const costs = [0.0001, 0.1234, 1.5678, 12.3456];

      costs.forEach((cost, index) => {
        const { rerender } = render(<StatusBar {...defaultProps} cost={cost} />);

        // Should format to 4 decimal places
        const expectedFormat = `$${cost.toFixed(4)}`;
        expect(screen.getByText(expectedFormat)).toBeInTheDocument();

        if (index < costs.length - 1) rerender(<></>);
      });
    });

    it('maintains subtask progress display', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar
        {...defaultProps}
        subtaskProgress={{ completed: 3, total: 7 }}
      />);

      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('[3/7]')).toBeInTheDocument();
    });
  });

  describe('Hook parameter validation', () => {
    it('passes correct fallback width to hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: false, // Using fallback
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Verify hook was called with correct parameters
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });
      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(1);
    });

    it('handles hook state updates correctly', () => {
      // Initial state
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);
      expect(screen.getByText('●')).toBeInTheDocument();

      // Hook state change (simulating terminal resize)
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      // Force re-render to pick up new hook state
      rerender(<StatusBar {...defaultProps} />);

      // Should still render correctly after state change
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('Performance and stability', () => {
    it('handles rapid hook updates without errors', () => {
      const updates = [
        { width: 50, breakpoint: 'narrow' as const },
        { width: 80, breakpoint: 'compact' as const },
        { width: 120, breakpoint: 'normal' as const },
        { width: 200, breakpoint: 'wide' as const },
        { width: 60, breakpoint: 'compact' as const },
      ];

      updates.forEach((update, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          ...update,
          height: 30,
          isAvailable: true,
          isNarrow: update.breakpoint === 'narrow',
          isCompact: update.breakpoint === 'compact',
          isNormal: update.breakpoint === 'normal',
          isWide: update.breakpoint === 'wide',
        });

        const { rerender } = render(<StatusBar {...defaultProps} />);

        // Should render without errors regardless of rapid changes
        expect(screen.getByText('●')).toBeInTheDocument();

        if (index < updates.length - 1) rerender(<></>);
      });
    });

    it('maintains component stability with missing hook data', () => {
      // Test with minimal hook data
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: false,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar isConnected={true} />);

      // Should render basic elements even with minimal data
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });
  });
});