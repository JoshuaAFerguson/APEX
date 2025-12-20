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

describe('StatusBar - useStdoutDimensions Hook Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/hook-integration',
    agent: 'tester',
    workflowStage: 'testing',
    tokens: { input: 2000, output: 1000 },
    cost: 0.0543,
    sessionCost: 0.2189,
    model: 'sonnet',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionName: 'Hook Integration Test',
    subtaskProgress: { completed: 2, total: 4 },
    sessionStartTime: new Date(Date.now() - 125000), // 2m 5s ago
  };

  describe('Hook integration and breakpoint system', () => {
    it('properly integrates with useStdoutDimensions hook', () => {
      const mockDimensions: StdoutDimensions = {
        width: 100,
        height: 30,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      };

      mockUseStdoutDimensions.mockReturnValue(mockDimensions);

      render(<StatusBar {...defaultProps} />);

      // Verify hook is called
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });

      // Verify breakpoint-based filtering is working
      expect(screen.getByText('●')).toBeInTheDocument(); // critical
      expect(screen.getByText(/feature/)).toBeInTheDocument(); // high
      expect(screen.getByText('testing')).toBeInTheDocument(); // medium - should show in compact
    });

    it('uses correct fallback width when specified', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 24,
        breakpoint: 'normal',
        isAvailable: false, // Using fallback
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });
    });

    it('responds to breakpoint helper flags correctly', () => {
      // Test narrow breakpoint
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Only critical and high priority should show in narrow mode
      expect(screen.getByText('●')).toBeInTheDocument(); // critical: connection
      expect(screen.getByText(/feature/)).toBeInTheDocument(); // high: git branch
      expect(screen.getByText('tester')).toBeInTheDocument(); // high: agent
      expect(screen.getByText('$0.0543')).toBeInTheDocument(); // high: cost

      // Medium priority should be hidden in narrow
      expect(screen.queryByText('testing')).not.toBeInTheDocument(); // medium: workflow stage
      expect(screen.queryByText('3.0k')).not.toBeInTheDocument(); // medium: tokens
      expect(screen.queryByText('[2/4]')).not.toBeInTheDocument(); // medium: subtask progress
    });

    it('shows progressive segments as breakpoint changes', () => {
      // Start narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Verify narrow mode behavior
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.queryByText('testing')).not.toBeInTheDocument();
      expect(screen.queryByText('Hook Integration')).not.toBeInTheDocument();

      // Change to compact (60-100 cols)
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Should now show medium priority
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('[2/4]')).toBeInTheDocument();
      expect(screen.queryByText('Hook Integration')).not.toBeInTheDocument(); // still hide low priority

      // Change to normal (100-160 cols)
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

      rerender(<StatusBar {...defaultProps} />);

      // Should show medium but still hide low priority (URLs, session name)
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.queryByText('Hook Integration')).not.toBeInTheDocument(); // still low priority

      // Change to wide (>160 cols)
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

      rerender(<StatusBar {...defaultProps} />);

      // Should now show all segments including low priority
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('Hook Integration')).toBeInTheDocument(); // low priority now visible
      expect(screen.getByText('api:')).toBeInTheDocument(); // URLs now visible
    });
  });

  describe('Breakpoint thresholds validation', () => {
    it('correctly implements narrow threshold at 60 columns', () => {
      // Test boundary conditions for narrow (<60)

      // 59 cols should be narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 59,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Should hide medium priority segments
      expect(screen.queryByText('testing')).not.toBeInTheDocument();

      // 60 cols should be compact (not narrow)
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

      rerender(<StatusBar {...defaultProps} />);

      // Should now show medium priority segments
      expect(screen.getByText('testing')).toBeInTheDocument();
    });

    it('correctly implements wide threshold at 160 columns', () => {
      // Test boundary conditions for wide (>160)

      // 160 cols should be normal (not wide)
      mockUseStdoutDimensions.mockReturnValue({
        width: 160,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Should hide low priority segments
      expect(screen.queryByText('Hook Integration')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();

      // 161 cols should be wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 161,
        height: 30,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Should now show low priority segments
      expect(screen.getByText('Hook Integration')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
    });

    it('handles exact boundary values correctly for all thresholds', () => {
      const boundaries = [
        { width: 59, expected: { narrow: true, medium: false, low: false } },
        { width: 60, expected: { narrow: false, medium: true, low: false } },
        { width: 99, expected: { narrow: false, medium: true, low: false } },
        { width: 100, expected: { narrow: false, medium: true, low: false } },
        { width: 159, expected: { narrow: false, medium: true, low: false } },
        { width: 160, expected: { narrow: false, medium: true, low: false } },
        { width: 161, expected: { narrow: false, medium: true, low: true } },
      ];

      boundaries.forEach(({ width, expected }, index) => {
        const breakpoint = width < 60 ? 'narrow' :
                           width < 100 ? 'compact' :
                           width <= 160 ? 'normal' : 'wide';

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: breakpoint as any,
          isAvailable: true,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
        });

        const { rerender } = render(<StatusBar {...defaultProps} />);

        // Test medium priority visibility (workflow stage)
        const mediumVisible = screen.queryByText('testing') !== null;
        expect(mediumVisible).toBe(expected.medium);

        // Test low priority visibility (session name)
        const lowVisible = screen.queryByText('Hook Integration') !== null;
        expect(lowVisible).toBe(expected.low);

        if (index < boundaries.length - 1) rerender(<></>);
      });
    });
  });

  describe('Abbreviation behavior with hook integration', () => {
    it('applies abbreviations correctly in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Cost should have no label in narrow mode (empty abbreviation)
      expect(screen.getByText('$0.0543')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();

      // Model should use abbreviated label in narrow mode, but it's high priority so should show
      expect(screen.queryByText('m:')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();

      // Git branch should compress if too long
      const branch = screen.getByText(/feature/);
      expect(branch).toBeInTheDocument();
    });

    it('uses full labels when width allows', () => {
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

      render(<StatusBar {...defaultProps} />);

      // Should use full labels when not in narrow mode
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();

      // Should not show abbreviated forms
      expect(screen.queryByText('m:')).not.toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument();
    });
  });

  describe('Hook error handling and fallbacks', () => {
    it('handles hook returning undefined dimensions gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120, // Using fallback
        height: 24,
        breakpoint: 'normal',
        isAvailable: false, // Not available, using fallbacks
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Should still render normally with fallback dimensions
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });

    it('respects custom fallback width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 24,
        breakpoint: 'normal',
        isAvailable: false,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Verify the hook was called with the correct fallback
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });
    });

    it('handles dynamic terminal resizing', () => {
      // Start with narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Verify narrow layout
      expect(screen.queryByText('testing')).not.toBeInTheDocument();

      // Simulate terminal resize to wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Should now show all segments
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('Hook Integration')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
    });
  });

  describe('Display mode override behavior', () => {
    it('compact mode overrides hook breakpoint detection', () => {
      // Even with wide terminal, compact mode should limit segments
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...defaultProps} displayMode="compact" />);

      // Should only show compact mode segments regardless of width
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('$0.0543')).toBeInTheDocument();

      // All other segments should be hidden
      expect(screen.queryByText('tester')).not.toBeInTheDocument();
      expect(screen.queryByText('testing')).not.toBeInTheDocument();
      expect(screen.queryByText('sonnet')).not.toBeInTheDocument();
    });

    it('verbose mode overrides hook breakpoint detection', () => {
      // Even with narrow terminal, verbose mode should show all
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} displayMode="verbose" detailedTiming={{
        totalActiveTime: 85000,
        totalIdleTime: 40000,
        currentStageElapsed: 25000,
      }} />);

      // Should show all segments including verbose-specific ones
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('Hook Integration')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Should show detailed timing
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
    });

    it('normal mode properly integrates with hook breakpoints', () => {
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

      render(<StatusBar {...defaultProps} displayMode="normal" />);

      // Should respect breakpoint filtering in normal mode
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument(); // medium priority visible in compact
      expect(screen.queryByText('Hook Integration')).not.toBeInTheDocument(); // low priority hidden
    });
  });
});