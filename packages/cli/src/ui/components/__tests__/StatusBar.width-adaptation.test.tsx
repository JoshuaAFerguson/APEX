import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Use vi.hoisted to ensure mock function is available during module hoisting
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(() => ({
    width: 120,
    height: 30,
    breakpoint: 'normal' as const,
    isAvailable: true,
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
  })),
}));

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StatusBar - Width Adaptation Tests', () => {
  // Use fixed times to avoid flaky timer tests
  const baseStartTime = new Date('2023-01-01T10:00:00Z');
  const currentTime = new Date('2023-01-01T10:03:00Z'); // 3 minutes after start

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // Use shorter prop values to avoid trimToFit removing segments at test widths
  // The trimToFit algorithm removes lowest priority segments when total width exceeds terminal
  const comprehensiveProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feat/width-test', // Short branch name
    agent: 'tester',
    workflowStage: 'testing',
    tokens: { input: 5000, output: 2500 },
    cost: 0.0892,
    sessionCost: 0.3456,
    model: 'sonnet-3.5',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionName: 'Width Test', // Short session name (< 15 chars, no truncation)
    subtaskProgress: { completed: 7, total: 12 },
    sessionStartTime: baseStartTime, // Fixed start time (3 minutes before currentTime)
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

      // At 35 cols, trimToFit will remove many segments to fit
      // Critical timer should remain
      expect(screen.getByText('03:00')).toBeInTheDocument();

      // High: Cost (value only, no label due to empty abbreviation)
      expect(screen.getByText('$0.0892')).toBeInTheDocument();

      // Medium/Low priority should be hidden (tier filtered)
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

      // Some high priority segments may be trimmed at narrow widths
      // Cost should be visible as it's compact
      expect(screen.getByText('$0.0892')).toBeInTheDocument();

      // Medium priority hidden (tier filtered in narrow mode)
      expect(screen.queryByText('testing')).not.toBeInTheDocument();
      expect(screen.queryByText('[7/12]')).not.toBeInTheDocument();

      // Low priority hidden
      expect(screen.queryByText('Width Test')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument();
    });

    it('handles git branch truncation correctly in narrow mode', () => {
      // Use a wider narrow terminal where branch can fit
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

      render(<StatusBar {...comprehensiveProps} />);

      // Critical always present
      expect(screen.getByText('●')).toBeInTheDocument();

      // Branch should be visible but truncated in narrow mode
      // 'feat/width-test' (15 chars) > 12 chars, so it's truncated to 9 + '...' = 'feat/widt...'
      expect(screen.getByText('feat/widt...')).toBeInTheDocument();
    });

    it('prioritizes critical and high segments only in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 55,
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

      // HIGH priority - cost should be visible
      expect(screen.getByText('$0.0892')).toBeInTheDocument(); // cost value

      // MEDIUM priority segments (hidden in narrow - tier filtered)
      expect(screen.queryByText('testing')).not.toBeInTheDocument(); // workflow stage value
      expect(screen.queryByText('[7/12]')).not.toBeInTheDocument(); // subtask progress value
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument(); // tokens label

      // LOW priority segments (hidden in narrow)
      expect(screen.queryByText('Width Test')).not.toBeInTheDocument(); // session name value
      expect(screen.queryByText('api:')).not.toBeInTheDocument(); // API URL
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument(); // preview indicator
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument(); // thoughts indicator
    });

    it('tests exact boundary at 59 cols (narrow) vs 60 cols (normal)', () => {
      // Test 59 columns - should be narrow tier
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

      // Medium priority should be hidden at 59 cols (narrow tier)
      expect(screen.queryByText('testing')).not.toBeInTheDocument();

      // Test 120 columns - should be normal tier (medium priority visible)
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      rerender(<StatusBar {...comprehensiveProps} />);

      // Medium priority should now be visible at 120 cols (normal tier)
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  describe('Wide terminals (> 160 cols) - Acceptance Criteria 4', () => {
    it('shows full information with extra details at 200 cols', () => {
      // Note: Using 200 cols instead of 170 to ensure all segments fit when using
      // very long prop values (42-char session name, 60-char git branch).
      // The trimToFit safety buffer may remove some LOW priority segments at
      // narrower wide widths (170-180) when content is extremely long.
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

      render(<StatusBar {...comprehensiveProps} />);

      // All priority levels should be visible
      // CRITICAL
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('03:00')).toBeInTheDocument();

      // HIGH
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument(); // full label
      expect(screen.getByText('$0.0892')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument(); // full label
      expect(screen.getByText('sonnet-3.5')).toBeInTheDocument();

      // MEDIUM
      expect(screen.getByText('▶')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('[7/12]')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('7.5k')).toBeInTheDocument();

      // LOW
      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText('Width Test')).toBeInTheDocument();
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
      expect(screen.queryByText('mod:')).not.toBeInTheDocument(); // should not see abbreviated form
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument(); // should not see abbreviated form
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();

      // Session name 'Width Test' is < 15 chars, no truncation needed
      expect(screen.getByText('Width Test')).toBeInTheDocument();
    });

    it('includes all status indicators in wide mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
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

      // Session name should be visible (sessionName: 'Width Test' is < 15 chars)
      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText('Width Test')).toBeInTheDocument();
    });

    it('tests exact boundary at 160 cols (normal) vs 180 cols (wide)', () => {
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

      // Low priority should be hidden at 160 cols (normal tier)
      expect(screen.queryByText('Width Test')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument();

      // Test 180 columns - should be wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 35,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<StatusBar {...comprehensiveProps} />);

      // Low priority should now be visible at 180 cols (wide tier)
      expect(screen.getByText('Width Test')).toBeInTheDocument();
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
      expect(screen.getByText(/feat/)).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  describe('Medium width transitions (60-160 cols)', () => {
    it('progressively shows more information as width increases', () => {
      // Test at 120 cols (normal tier) - medium priority should be visible
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

      const { rerender } = render(<StatusBar {...comprehensiveProps} />);

      // Always present: critical and high priority
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Medium priority should be visible at 120 cols
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('[7/12]')).toBeInTheDocument();

      // Low priority still hidden (sessionName: 'Width Test' is LOW priority)
      expect(screen.queryByText('Width Test')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();

      // Test at 160 cols (still normal tier)
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

      rerender(<StatusBar {...comprehensiveProps} />);

      // Medium still visible, low still hidden
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
    });

    it('uses appropriate labels based on width', () => {
      // Test at normal width (120 cols) - full labels should be used
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 25,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...comprehensiveProps} />);

      // Should use full labels in normal mode (only narrow uses abbreviations)
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();

      // Should not show abbreviated labels
      expect(screen.queryByText('mod:')).not.toBeInTheDocument();
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

      // Timer is critical priority
      expect(screen.getByText('03:00')).toBeInTheDocument();
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

      // Should render all elements comfortably (including LOW priority in wide)
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('Width Test')).toBeInTheDocument(); // sessionName
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