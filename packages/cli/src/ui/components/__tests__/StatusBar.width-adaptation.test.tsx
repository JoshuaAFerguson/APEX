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

describe('StatusBar - Width Adaptation Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const comprehensiveProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/width-adaptation-testing-branch-with-very-long-name',
    agent: 'tester',
    workflowStage: 'testing',
    tokens: { input: 5000, output: 2500 },
    cost: 0.0892,
    sessionCost: 0.3456,
    model: 'sonnet-3.5',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionName: 'Width Adaptation Comprehensive Test Session',
    subtaskProgress: { completed: 7, total: 12 },
    sessionStartTime: new Date(Date.now() - 180000), // 3 minutes ago
    previewMode: true,
    showThoughts: true,
  };

  describe('Narrow terminals (< 60 cols) - Acceptance Criteria 3', () => {
    it('shows abbreviated content with icons only in very narrow terminals (< 40)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // Critical: Connection status (icon only)
      expect(screen.getByText('●')).toBeInTheDocument();

      // High: Git branch should show truncated
      expect(screen.getByText(/feature\/w\.\.\./)).toBeInTheDocument();

      // High: Agent (icon + minimal text)
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // High: Cost (value only, no label due to empty abbreviation)
      expect(screen.getByText('$0.0892')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();

      // High: Model with abbreviated label
      expect(screen.getByText('m:')).toBeInTheDocument();
      expect(screen.getByText('sonnet-3.5')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();

      // Medium/Low priority should be hidden
      expect(screen.queryByText('testing')).not.toBeInTheDocument();
      expect(screen.queryByText('[7/12]')).not.toBeInTheDocument();
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument();
    });

    it('shows minimal text with essential info at 50-59 cols', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 55,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // Critical segments always visible
      expect(screen.getByText('●')).toBeInTheDocument(); // connection
      expect(screen.getByText('03:00')).toBeInTheDocument(); // session timer

      // High priority with abbreviated labels where applicable
      expect(screen.getByText(/feature/)).toBeInTheDocument(); // git branch (potentially truncated)
      expect(screen.getByText('tester')).toBeInTheDocument(); // agent
      expect(screen.getByText('$0.0892')).toBeInTheDocument(); // cost (no label)
      expect(screen.getByText('m:')).toBeInTheDocument(); // model (abbreviated)

      // Medium priority hidden
      expect(screen.queryByText('testing')).not.toBeInTheDocument();
      expect(screen.queryByText('7.5k')).not.toBeInTheDocument(); // tokens
      expect(screen.queryByText('[7/12]')).not.toBeInTheDocument();

      // Low priority hidden
      expect(screen.queryByText('Width Adaptation')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument();
    });

    it('handles git branch truncation correctly in narrow mode', () => {
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

      render(<StatusBar {...comprehensiveProps} />);

      // Long branch name should be truncated to fit narrow terminal
      const branchElement = screen.getByText(/feature\/w\.\.\./);
      expect(branchElement).toBeInTheDocument();
      expect(screen.queryByText('feature/width-adaptation-testing-branch-with-very-long-name')).not.toBeInTheDocument();
    });

    it('prioritizes critical and high segments only in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // CRITICAL priority segments (always shown)
      expect(screen.getByText('●')).toBeInTheDocument(); // connection status
      expect(screen.getByText('03:00')).toBeInTheDocument(); // session timer

      // HIGH priority segments (shown in narrow)
      expect(screen.getByText(/feature/)).toBeInTheDocument(); // git branch
      expect(screen.getByText('⚡')).toBeInTheDocument(); // agent icon
      expect(screen.getByText('tester')).toBeInTheDocument(); // agent value
      expect(screen.getByText('$0.0892')).toBeInTheDocument(); // cost value
      expect(screen.getByText('m:')).toBeInTheDocument(); // model label (abbreviated)
      expect(screen.getByText('sonnet-3.5')).toBeInTheDocument(); // model value

      // MEDIUM priority segments (hidden in narrow)
      expect(screen.queryByText('▶')).not.toBeInTheDocument(); // workflow stage icon
      expect(screen.queryByText('testing')).not.toBeInTheDocument(); // workflow stage value
      expect(screen.queryByText('📋')).not.toBeInTheDocument(); // subtask progress icon
      expect(screen.queryByText('[7/12]')).not.toBeInTheDocument(); // subtask progress value
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument(); // tokens label
      expect(screen.queryByText('7.5k')).not.toBeInTheDocument(); // tokens value

      // LOW priority segments (hidden in narrow)
      expect(screen.queryByText('💾')).not.toBeInTheDocument(); // session name icon
      expect(screen.queryByText('Width Adaptation')).not.toBeInTheDocument(); // session name value
      expect(screen.queryByText('api:')).not.toBeInTheDocument(); // API URL
      expect(screen.queryByText('web:')).not.toBeInTheDocument(); // Web URL
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument(); // preview indicator
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument(); // thoughts indicator
    });

    it('tests exact boundary at 59 cols (narrow) vs 60 cols (compact)', () => {
      // Test 59 columns - should be narrow
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

      const { rerender } = render(<StatusBar {...comprehensiveProps} />);

      // Medium priority should be hidden at 59 cols
      expect(screen.queryByText('testing')).not.toBeInTheDocument();

      // Test 60 columns - should be compact (not narrow)
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

      rerender(<StatusBar {...comprehensiveProps} />);

      // Medium priority should now be visible at 60 cols
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  describe('Wide terminals (> 160 cols) - Acceptance Criteria 4', () => {
    it('shows full information with extra details at 170 cols', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 170,
        height: 40,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // All priority levels should be visible
      // CRITICAL
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('03:00')).toBeInTheDocument();

      // HIGH
      expect(screen.getByText('feature/width-adaptation-testing-branch-with-very-long-name')).toBeInTheDocument(); // full branch name
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument(); // full label
      expect(screen.getByText('$0.0892')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument(); // full label
      expect(screen.getByText('sonnet-3.5')).toBeInTheDocument();

      // MEDIUM
      expect(screen.getByText('▶')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('[7/12]')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('7.5k')).toBeInTheDocument();

      // LOW
      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText(/Width Adaptation/)).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('shows full labels with generous spacing at 200+ cols', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 220,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // All labels should be full, no abbreviations
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.queryByText('m:')).not.toBeInTheDocument(); // should not see abbreviated form
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument(); // should not see abbreviated form
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument(); // should not see abbreviated form
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.queryByText('↗')).not.toBeInTheDocument(); // should not see abbreviated form

      // Git branch should not be truncated
      expect(screen.getByText('feature/width-adaptation-testing-branch-with-very-long-name')).toBeInTheDocument();

      // Session name should show full text (or truncated to max length)
      expect(screen.getByText(/Width Adaptation/)).toBeInTheDocument();
    });

    it('includes all status indicators in wide mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 45,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // Should show all indicators
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();

      // URLs should be visible with full labels
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();

      // Session name should be visible
      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText(/Width Adaptation/)).toBeInTheDocument();
    });

    it('tests exact boundary at 160 cols (normal) vs 161 cols (wide)', () => {
      // Test 160 columns - should be normal (not wide)
      mockUseStdoutDimensions.mockReturnValue({
        width: 160,
        height: 35,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...comprehensiveProps} />);

      // Low priority should be hidden at 160 cols
      expect(screen.queryByText('Width Adaptation')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument();

      // Test 161 columns - should be wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 161,
        height: 35,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<StatusBar {...comprehensiveProps} />);

      // Low priority should now be visible at 161 cols
      expect(screen.getByText(/Width Adaptation/)).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
    });

    it('handles verbose mode in wide terminals with detailed timing', () => {
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

      render(<StatusBar {...comprehensiveProps} displayMode="verbose" detailedTiming={{
        totalActiveTime: 125000, // 2m 5s
        totalIdleTime: 55000,    // 55s
        currentStageElapsed: 32000, // 32s
      }} />);

      // Should show verbose-specific elements
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Should show detailed timing with full labels
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('2m5s')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('55s')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('32s')).toBeInTheDocument();

      // Should show token breakdown in verbose mode
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('5.0k→2.5k')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('7.5k')).toBeInTheDocument();

      // All regular elements should still be present
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  describe('Medium width transitions (60-160 cols)', () => {
    it('progressively shows more information as width increases', () => {
      const testCases = [
        {
          width: 60,
          breakpoint: 'compact' as const,
          expectMedium: true,
          expectLow: false,
          description: 'compact mode at 60 cols'
        },
        {
          width: 90,
          breakpoint: 'compact' as const,
          expectMedium: true,
          expectLow: false,
          description: 'compact mode at 90 cols'
        },
        {
          width: 100,
          breakpoint: 'normal' as const,
          expectMedium: true,
          expectLow: false,
          description: 'normal mode at 100 cols'
        },
        {
          width: 130,
          breakpoint: 'normal' as const,
          expectMedium: true,
          expectLow: false,
          description: 'normal mode at 130 cols'
        },
        {
          width: 160,
          breakpoint: 'normal' as const,
          expectMedium: true,
          expectLow: false,
          description: 'normal mode at 160 cols (boundary)'
        },
      ];

      testCases.forEach(({ width, breakpoint, expectMedium, expectLow, description }, index) => {
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

        const { rerender } = render(<StatusBar {...comprehensiveProps} />);

        // Always present: critical and high priority
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText(/feature/)).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();

        // Medium priority visibility
        if (expectMedium) {
          expect(screen.getByText('testing')).toBeInTheDocument();
          expect(screen.getByText('[7/12]')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('testing')).not.toBeInTheDocument();
        }

        // Low priority visibility
        if (expectLow) {
          expect(screen.getByText(/Width Adaptation/)).toBeInTheDocument();
          expect(screen.getByText('api:')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Width Adaptation')).not.toBeInTheDocument();
          expect(screen.queryByText('api:')).not.toBeInTheDocument();
        }

        if (index < testCases.length - 1) rerender(<></>);
      });
    });

    it('uses appropriate labels based on width', () => {
      // Test abbreviated labels in compact mode
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

      const { rerender } = render(<StatusBar {...comprehensiveProps} />);

      // Should use full labels even in compact mode (only narrow uses abbreviations)
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();

      // Should not show abbreviated labels
      expect(screen.queryByText('m:')).not.toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases and stress testing', () => {
    it('handles extreme narrow widths gracefully (< 30 cols)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // Should still render essential elements without crashing
      expect(screen.getByText('●')).toBeInTheDocument();

      // May still show timer and cost as they're critical/high priority
      expect(screen.getByText('03:00')).toBeInTheDocument();
      expect(screen.getByText('$0.0892')).toBeInTheDocument();
    });

    it('handles extreme wide widths gracefully (> 300 cols)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 350,
        height: 80,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // Should render all elements comfortably
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/width-adaptation-testing-branch-with-very-long-name')).toBeInTheDocument();
      expect(screen.getByText(/Width Adaptation/)).toBeInTheDocument();
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('handles missing optional props at different widths', () => {
      const minimalProps: StatusBarProps = {
        isConnected: true,
      };

      // Test at narrow width
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

      const { rerender } = render(<StatusBar {...minimalProps} />);
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();

      // Test at wide width
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 40,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<StatusBar {...minimalProps} />);
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles rapid width changes without errors', () => {
      const widths = [30, 80, 150, 200, 60, 45, 180, 100];

      widths.forEach((width, index) => {
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

        const { rerender } = render(<StatusBar {...comprehensiveProps} />);

        // Should always render critical elements
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('03:00')).toBeInTheDocument();

        if (index < widths.length - 1) rerender(<></>);
      });
    });
  });
});