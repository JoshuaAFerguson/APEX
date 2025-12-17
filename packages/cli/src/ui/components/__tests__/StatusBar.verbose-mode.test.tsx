import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Mock useStdoutDimensions hook
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 120,
    height: 30,
    breakpoint: 'wide' as const,
  })),
}));

// Mock ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

describe('StatusBar - Verbose Mode Features', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/verbose-mode',
    tokens: { input: 1200, output: 800 },
    cost: 0.0456,
    model: 'claude-3-sonnet',
    agent: 'developer',
    workflowStage: 'implementation',
    sessionStartTime: new Date(Date.now() - 180000), // 3 minutes ago
    displayMode: 'verbose',
  };

  describe('Token Breakdown Format (input→output)', () => {
    it('should display tokens in input→output format in verbose mode', () => {
      render(<StatusBar {...baseProps} />);

      // Should show the breakdown format
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('1.2k→800')).toBeInTheDocument();
    });

    it('should format large token values correctly in breakdown', () => {
      const largeTokenProps = {
        ...baseProps,
        tokens: { input: 1500000, output: 2500000 },
      };

      render(<StatusBar {...largeTokenProps} />);

      expect(screen.getByText('1.5M→2.5M')).toBeInTheDocument();
    });

    it('should format mixed scale token values correctly', () => {
      const mixedTokenProps = {
        ...baseProps,
        tokens: { input: 500, output: 1500 },
      };

      render(<StatusBar {...mixedTokenProps} />);

      expect(screen.getByText('500→1.5k')).toBeInTheDocument();
    });

    it('should show total tokens alongside breakdown in verbose mode', () => {
      render(<StatusBar {...baseProps} />);

      // Should show both breakdown and total
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('1.2k→800')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('2.0k')).toBeInTheDocument(); // 1200 + 800
    });

    it('should handle zero input or output tokens', () => {
      const zeroInputProps = {
        ...baseProps,
        tokens: { input: 0, output: 500 },
      };

      render(<StatusBar {...zeroInputProps} />);

      expect(screen.getByText('0→500')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument(); // Total
    });
  });

  describe('Detailed Timing Segments', () => {
    const timingProps = {
      ...baseProps,
      detailedTiming: {
        totalActiveTime: 120000,  // 2 minutes
        totalIdleTime: 60000,     // 1 minute
        currentStageElapsed: 30000, // 30 seconds
      },
    };

    it('should display active time segment when provided', () => {
      render(<StatusBar {...timingProps} />);

      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('2m0s')).toBeInTheDocument();
    });

    it('should display idle time segment when provided', () => {
      render(<StatusBar {...timingProps} />);

      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('1m0s')).toBeInTheDocument();
    });

    it('should display current stage elapsed time when provided', () => {
      render(<StatusBar {...timingProps} />);

      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('should format hours correctly in timing segments', () => {
      const hourTimingProps = {
        ...baseProps,
        detailedTiming: {
          totalActiveTime: 7200000, // 2 hours
          totalIdleTime: 3600000,   // 1 hour
          currentStageElapsed: 5400000, // 1 hour 30 minutes
        },
      };

      render(<StatusBar {...hourTimingProps} />);

      expect(screen.getByText('2h0m')).toBeInTheDocument();
      expect(screen.getByText('1h0m')).toBeInTheDocument();
      expect(screen.getByText('1h30m')).toBeInTheDocument();
    });

    it('should only show timing segments when detailedTiming is provided', () => {
      render(<StatusBar {...baseProps} />);

      // Without detailedTiming, these labels should not appear
      expect(screen.queryByText('active:')).not.toBeInTheDocument();
      expect(screen.queryByText('idle:')).not.toBeInTheDocument();
      expect(screen.queryByText('stage:')).not.toBeInTheDocument();
    });

    it('should show stage time only when workflowStage is also provided', () => {
      const noStageProps = {
        ...baseProps,
        workflowStage: undefined,
        detailedTiming: {
          totalActiveTime: 60000,
          totalIdleTime: 30000,
          currentStageElapsed: 15000,
        },
      };

      render(<StatusBar {...noStageProps} />);

      // Should show active and idle, but not stage since no workflowStage
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.queryByText('stage:')).not.toBeInTheDocument();
    });
  });

  describe('Session Cost Display Logic', () => {
    it('should show session cost when different from regular cost', () => {
      const differentCostProps = {
        ...baseProps,
        cost: 0.0456,
        sessionCost: 1.2345,
      };

      render(<StatusBar {...differentCostProps} />);

      // Should show both cost and session cost
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.0456')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$1.2345')).toBeInTheDocument();
    });

    it('should NOT show session cost when same as regular cost', () => {
      const sameCostProps = {
        ...baseProps,
        cost: 0.0456,
        sessionCost: 0.0456,
      };

      render(<StatusBar {...sameCostProps} />);

      // Should show regular cost but not session cost
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.0456')).toBeInTheDocument();
      expect(screen.queryByText('session:')).not.toBeInTheDocument();
    });

    it('should handle sessionCost without regular cost', () => {
      const sessionOnlyProps = {
        ...baseProps,
        cost: undefined,
        sessionCost: 1.2345,
      };

      render(<StatusBar {...sessionOnlyProps} />);

      // Should not show session cost if no regular cost is provided
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
      expect(screen.queryByText('session:')).not.toBeInTheDocument();
    });

    it('should handle very small cost differences correctly', () => {
      const smallDiffProps = {
        ...baseProps,
        cost: 0.0001,
        sessionCost: 0.0002,
      };

      render(<StatusBar {...smallDiffProps} />);

      // Should show both since they are different
      expect(screen.getByText('$0.0001')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$0.0002')).toBeInTheDocument();
    });

    it('should handle floating point precision issues', () => {
      const precisionProps = {
        ...baseProps,
        cost: 0.1 + 0.2, // Results in 0.30000000000000004
        sessionCost: 0.3,
      };

      render(<StatusBar {...precisionProps} />);

      // Should recognize these as the same due to proper comparison
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.queryByText('session:')).not.toBeInTheDocument();
    });
  });

  describe('All Metrics Segments Without Width Filtering', () => {
    const fullProps: StatusBarProps = {
      ...baseProps,
      gitBranch: 'feature/very-long-branch-name-that-would-be-filtered-in-normal-mode',
      agent: 'developer',
      workflowStage: 'implementation',
      apiUrl: 'http://localhost:4000',
      webUrl: 'http://localhost:3000',
      sessionName: 'Very Long Session Name That Should Still Be Shown',
      subtaskProgress: { completed: 3, total: 7 },
      previewMode: true,
      showThoughts: true,
      model: 'claude-3-sonnet-20240229',
      detailedTiming: {
        totalActiveTime: 150000,
        totalIdleTime: 45000,
        currentStageElapsed: 75000,
      },
    };

    it('should show all segments in narrow terminal width', () => {
      // Mock very narrow terminal
      const useStdoutDimensionsMock = vi.mocked(require('../../hooks/useStdoutDimensions').useStdoutDimensions);
      useStdoutDimensionsMock.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'narrow' as const,
      });

      render(<StatusBar {...fullProps} />);

      // All elements should still be visible despite narrow terminal
      expect(screen.getByText('feature/very-long-branch-name-that-would-be-filtered-in-normal-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument(); // API URL
      expect(screen.getByText('3000')).toBeInTheDocument(); // Web URL
      expect(screen.getByText(/Very Long Session Name/)).toBeInTheDocument();
      expect(screen.getByText('[3/7]')).toBeInTheDocument();
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet-20240229')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('should show verbose mode indicator', () => {
      render(<StatusBar {...baseProps} />);

      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('should show all timing segments simultaneously', () => {
      render(<StatusBar {...fullProps} />);

      // All timing segments should be visible
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('2m30s')).toBeInTheDocument(); // 150000ms
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('45s')).toBeInTheDocument(); // 45000ms
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('1m15s')).toBeInTheDocument(); // 75000ms
    });

    it('should preserve all segments even with maximum content', () => {
      // Add session cost to maximize content
      const maxContentProps = {
        ...fullProps,
        sessionCost: 5.6789,
      };

      render(<StatusBar {...maxContentProps} />);

      // Should still show all major elements
      expect(screen.getByText(/feature\/very-long/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet-20240229')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$5.6789')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('should handle missing optional props gracefully', () => {
      const minimalVerboseProps: StatusBarProps = {
        isConnected: true,
        displayMode: 'verbose',
        tokens: { input: 100, output: 50 },
      };

      render(<StatusBar {...minimalVerboseProps} />);

      // Should show what's available without crashing
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('100→50')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument(); // Default timer
    });
  });

  describe('Verbose Mode vs Other Modes Comparison', () => {
    it('should show more information than normal mode', () => {
      const { rerender } = render(<StatusBar {...baseProps} displayMode="normal" />);

      // In normal mode, might not show breakdown
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('2.0k')).toBeInTheDocument(); // Total only

      // Switch to verbose
      rerender(<StatusBar {...baseProps} displayMode="verbose" />);

      // Should now show breakdown and total
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('1.2k→800')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('2.0k')).toBeInTheDocument();
    });

    it('should show much more information than compact mode', () => {
      const { rerender } = render(<StatusBar {...baseProps} displayMode="compact" />);

      // Compact mode shows minimal info
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/verbose-mode')).toBeInTheDocument();
      expect(screen.queryByText('developer')).not.toBeInTheDocument();

      // Switch to verbose
      rerender(<StatusBar {...baseProps} displayMode="verbose" />);

      // Should show all detailed information
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/verbose-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });
  });

  describe('Integration with Other Features', () => {
    it('should work correctly with preview mode', () => {
      const previewProps = {
        ...baseProps,
        previewMode: true,
      };

      render(<StatusBar {...previewProps} />);

      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('should work correctly with show thoughts', () => {
      const thoughtsProps = {
        ...baseProps,
        showThoughts: true,
      };

      render(<StatusBar {...thoughtsProps} />);

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('should work correctly with all features enabled', () => {
      const allFeaturesProps = {
        ...baseProps,
        previewMode: true,
        showThoughts: true,
        sessionCost: 2.5,
        detailedTiming: {
          totalActiveTime: 90000,
          totalIdleTime: 30000,
          currentStageElapsed: 45000,
        },
      };

      render(<StatusBar {...allFeaturesProps} />);

      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$2.5000')).toBeInTheDocument();
      expect(screen.getByText('1.2k→800')).toBeInTheDocument();
      expect(screen.getByText('active:')).toBeInTheDocument();
    });
  });
});