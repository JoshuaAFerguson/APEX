import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

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

describe('StatusBar - Priority System with Breakpoint Helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime); // Set time to 4 minutes after start
    // Reset mock to default value before each test
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

  // Use fixed dates for timer testing - set system time to 4 minutes after start time
  const baseStartTime = new Date('2023-01-01T10:00:00Z');
  const currentTime = new Date('2023-01-01T10:04:00Z'); // 4 minutes after start

  const fullFeatureProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/priority-system',
    agent: 'developer',
    workflowStage: 'implementation',
    tokens: { input: 3000, output: 1500 },
    cost: 0.0678,
    sessionCost: 0.1234,
    model: 'claude-3-opus',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionName: 'Priority System Test',
    subtaskProgress: { completed: 5, total: 8 },
    sessionStartTime: baseStartTime, // Fixed start time
    previewMode: true,
    showThoughts: false,
  };

  describe('CRITICAL Priority Segments (Always Visible)', () => {
    it('shows connection status in all breakpoints', () => {
      const testBreakpoints: Array<{
        width: number;
        breakpoint: StdoutDimensions['breakpoint'];
        isNarrow: boolean;
        isCompact: boolean;
        isNormal: boolean;
        isWide: boolean;
      }> = [
        { width: 30, breakpoint: 'narrow', isNarrow: true, isCompact: false, isNormal: false, isWide: false },
        { width: 80, breakpoint: 'compact', isNarrow: false, isCompact: true, isNormal: false, isWide: false },
        { width: 120, breakpoint: 'normal', isNarrow: false, isCompact: false, isNormal: true, isWide: false },
        { width: 200, breakpoint: 'wide', isNarrow: false, isCompact: false, isNormal: false, isWide: true },
      ];

      testBreakpoints.forEach(({ width, breakpoint, isNarrow, isCompact, isNormal, isWide }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow,
          isCompact,
          isNormal,
          isWide,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} />);

        // Connection status (CRITICAL) should always be visible
        expect(screen.getByText('●')).toBeInTheDocument();

        if (index < testBreakpoints.length - 1) rerender(<></>);
      });
    });

    it('shows session timer in all breakpoints', () => {
      const testBreakpoints = [
        { width: 30, breakpoint: 'narrow' as const, isNarrow: true, isCompact: false, isNormal: false, isWide: false },
        { width: 80, breakpoint: 'compact' as const, isNarrow: false, isCompact: true, isNormal: false, isWide: false },
        { width: 120, breakpoint: 'normal' as const, isNarrow: false, isCompact: false, isNormal: true, isWide: false },
        { width: 200, breakpoint: 'wide' as const, isNarrow: false, isCompact: false, isNormal: false, isWide: true },
      ];

      testBreakpoints.forEach(({ width, breakpoint, isNarrow, isCompact, isNormal, isWide }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow,
          isCompact,
          isNormal,
          isWide,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} />);

        // Session timer (CRITICAL) should always be visible
        expect(screen.getByText('04:00')).toBeInTheDocument();

        if (index < testBreakpoints.length - 1) rerender(<></>);
      });
    });

    it('prioritizes critical segments during width-based trimming', () => {
      // Test very narrow width where trimToFit should kick in
      mockUseStdoutDimensions.mockReturnValue({
        width: 20, // Extremely narrow to force trimming
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} />);

      // Critical segments should still be preserved
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('04:00')).toBeInTheDocument();
    });
  });

  describe('HIGH Priority Segments (Visible in compact and above)', () => {
    it('shows high priority segments in narrow mode', () => {
      // Use a width that can reasonably fit HIGH priority segments
      // Note: width must be narrow enough (<60) to trigger narrow breakpoint
      // but large enough to fit high priority content without trimToFit removing them
      mockUseStdoutDimensions.mockReturnValue({
        width: 59, // Max narrow width before compact
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} />);

      // HIGH priority segments should be visible in narrow mode
      // Note: Some segments may be trimmed by trimToFit if width is too narrow
      // Connection (CRITICAL) - always visible
      expect(screen.getByText('●')).toBeInTheDocument();
      // Timer (CRITICAL) - always visible
      expect(screen.getByText('04:00')).toBeInTheDocument();
      // Agent icon and value (HIGH) - should be visible
      expect(screen.getByText('⚡')).toBeInTheDocument(); // agent icon
      expect(screen.getByText('developer')).toBeInTheDocument(); // agent value
      // Cost (HIGH) - should be visible with abbreviated label (empty = no label)
      expect(screen.getByText('$0.0678')).toBeInTheDocument(); // cost value
      // Model (HIGH) - with abbreviated label in narrow mode
      expect(screen.getByText('mod:')).toBeInTheDocument(); // model label (abbreviated)
      expect(screen.getByText('claude-3-opus')).toBeInTheDocument(); // model value
    });

    it('uses appropriate labeling based on breakpoint helpers', () => {
      // Test narrow mode - should use abbreviated labels
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

      const { rerender } = render(<StatusBar {...fullFeatureProps} />);

      // Cost should have no label (empty abbreviation)
      expect(screen.getByText('$0.0678')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();

      // Model should use abbreviated label
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();

      // Switch to compact mode - should use full labels
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

      rerender(<StatusBar {...fullFeatureProps} />);

      // Should now use full labels
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.queryByText('mod:')).not.toBeInTheDocument();
    });

    it('maintains high priority visibility across all non-compact display modes', () => {
      const displayModes: Array<{ mode: 'normal' | 'verbose'; description: string }> = [
        { mode: 'normal', description: 'normal mode' },
        { mode: 'verbose', description: 'verbose mode' },
      ];

      displayModes.forEach(({ mode }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50, // Narrow width
          height: 20,
          breakpoint: 'narrow',
          isAvailable: true,
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} displayMode={mode} />);

        // High priority should be visible even in narrow mode
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('$0.0678')).toBeInTheDocument();
        expect(screen.getByText('claude-3-opus')).toBeInTheDocument();

        if (index < displayModes.length - 1) rerender(<></>);
      });
    });
  });

  describe('MEDIUM Priority Segments (Visible in compact and above)', () => {
    it('hides medium priority segments in narrow mode', () => {
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

      render(<StatusBar {...fullFeatureProps} />);

      // MEDIUM priority segments should be hidden in narrow mode
      expect(screen.queryByText('▶')).not.toBeInTheDocument(); // workflow stage icon
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // workflow stage value
      expect(screen.queryByText('📋')).not.toBeInTheDocument(); // subtask progress icon
      expect(screen.queryByText('[5/8]')).not.toBeInTheDocument(); // subtask progress value
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument(); // tokens label
      expect(screen.queryByText('4.5k')).not.toBeInTheDocument(); // tokens value
    });

    it('shows medium priority segments in compact mode', () => {
      // Use a width in the compact range (60-100)
      // Note: In compact mode, some segments may be trimmed by trimToFit
      mockUseStdoutDimensions.mockReturnValue({
        width: 99, // Max compact width before normal
        height: 25,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} />);

      // In compact mode, MEDIUM priority segments are allowed by tier filtering
      // However, trimToFit may remove some if they don't fit in the width
      // Test for presence of SOME medium priority segments (not necessarily all)

      // Tokens (MEDIUM) - typically shown
      expect(screen.getByText('tokens:')).toBeInTheDocument(); // tokens label
      expect(screen.getByText('4.5k')).toBeInTheDocument(); // tokens value

      // Subtask progress (MEDIUM) - typically shown when present
      expect(screen.getByText('📋')).toBeInTheDocument(); // subtask progress icon
      expect(screen.getByText('[5/8]')).toBeInTheDocument(); // subtask progress value

      // HIGH priority should definitely be visible
      expect(screen.getByText('●')).toBeInTheDocument(); // connection (CRITICAL)
      expect(screen.getByText('04:00')).toBeInTheDocument(); // timer (CRITICAL)
      expect(screen.getByText('developer')).toBeInTheDocument(); // agent (HIGH)
      expect(screen.getByText('$0.0678')).toBeInTheDocument(); // cost (HIGH)
    });

    it('maintains medium priority visibility in normal and wide modes', () => {
      const modes = [
        { width: 120, breakpoint: 'normal' as const, isNormal: true, isWide: false },
        { width: 180, breakpoint: 'wide' as const, isNormal: false, isWide: true },
      ];

      modes.forEach(({ width, breakpoint, isNormal, isWide }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow: false,
          isCompact: false,
          isNormal,
          isWide,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} />);

        // MEDIUM priority should be visible in both normal and wide
        expect(screen.getByText('implementation')).toBeInTheDocument();
        expect(screen.getByText('[5/8]')).toBeInTheDocument();
        expect(screen.getByText('4.5k')).toBeInTheDocument();

        if (index < modes.length - 1) rerender(<></>);
      });
    });

    it('handles verbose mode timing segments (medium priority)', () => {
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

      render(<StatusBar {...fullFeatureProps} displayMode="verbose" detailedTiming={{
        totalActiveTime: 180000, // 3 minutes
        totalIdleTime: 60000,    // 1 minute
        currentStageElapsed: 45000, // 45 seconds
      }} />);

      // Verbose timing segments should be visible (medium priority in compact+)
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('3m0s')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('1m0s')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('45s')).toBeInTheDocument();

      // Should also show verbose token breakdown
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('3.0k→1.5k')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('4.5k')).toBeInTheDocument();
    });
  });

  describe('LOW Priority Segments (Visible only in wide)', () => {
    it('hides low priority segments in narrow, compact, and normal modes', () => {
      const modes = [
        { width: 50, breakpoint: 'narrow' as const, isNarrow: true, isCompact: false, isNormal: false, isWide: false },
        { width: 80, breakpoint: 'compact' as const, isNarrow: false, isCompact: true, isNormal: false, isWide: false },
        { width: 120, breakpoint: 'normal' as const, isNarrow: false, isCompact: false, isNormal: true, isWide: false },
      ];

      modes.forEach(({ width, breakpoint, isNarrow, isCompact, isNormal, isWide }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow,
          isCompact,
          isNormal,
          isWide,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} />);

        // LOW priority segments should be hidden
        expect(screen.queryByText('💾')).not.toBeInTheDocument(); // session name icon
        expect(screen.queryByText('Priority System Test')).not.toBeInTheDocument(); // session name
        expect(screen.queryByText('api:')).not.toBeInTheDocument(); // API URL label
        expect(screen.queryByText('4000')).not.toBeInTheDocument(); // API URL value
        expect(screen.queryByText('web:')).not.toBeInTheDocument(); // Web URL label
        expect(screen.queryByText('3000')).not.toBeInTheDocument(); // Web URL value
        expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument(); // preview indicator

        if (index < modes.length - 1) rerender(<></>);
      });
    });

    it('shows low priority segments only in wide mode', () => {
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

      render(<StatusBar {...fullFeatureProps} />);

      // LOW priority segments should be visible in wide mode
      expect(screen.getByText('💾')).toBeInTheDocument(); // session name icon
      // Note: Session names > 15 chars are truncated to 12 chars + '...'
      // 'Priority System Test' (20 chars) -> 'Priority Sys...' (15 chars)
      expect(screen.getByText('Priority Sys...')).toBeInTheDocument(); // session name (truncated)
      expect(screen.getByText('api:')).toBeInTheDocument(); // API URL label
      expect(screen.getByText('4000')).toBeInTheDocument(); // API URL value
      expect(screen.getByText('web:')).toBeInTheDocument(); // Web URL label
      expect(screen.getByText('3000')).toBeInTheDocument(); // Web URL value
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument(); // preview indicator
    });

    it('handles session cost visibility in verbose mode (low priority)', () => {
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

      render(<StatusBar {...fullFeatureProps} displayMode="verbose" />);

      // Session cost should be visible in verbose mode when different from cost
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
    });

    it('handles abbreviations correctly for low priority segments', () => {
      // Test that API/Web URLs would use abbreviated labels if they were in narrow mode
      // (though they won't show due to priority filtering)
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

      render(<StatusBar {...fullFeatureProps} />);

      // In wide mode, should use full labels
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();

      // Should not see abbreviated forms
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
    });
  });

  describe('Priority System Integration with Display Modes', () => {
    it('compact display mode overrides breakpoint priority system', () => {
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

      render(<StatusBar {...fullFeatureProps} displayMode="compact" />);

      // Compact mode should only show specific segments regardless of wide terminal
      expect(screen.getByText('●')).toBeInTheDocument(); // connection (allowed in compact)
      expect(screen.getByText('feature/priority-system')).toBeInTheDocument(); // git branch (allowed in compact)
      expect(screen.getByText('$0.0678')).toBeInTheDocument(); // cost (allowed in compact)

      // Everything else should be hidden despite wide terminal
      expect(screen.queryByText('developer')).not.toBeInTheDocument(); // agent
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // workflow stage
      expect(screen.queryByText('claude-3-opus')).not.toBeInTheDocument(); // model
      expect(screen.queryByText('Priority System Test')).not.toBeInTheDocument(); // session name
    });

    it('verbose display mode overrides breakpoint priority system', () => {
      // Verbose mode shows ALL segments regardless of terminal width
      // Note: trimToFit is skipped in verbose mode, so width doesn't affect visibility
      // However, abbreviation logic still applies based on displayTier (narrow uses abbreviated labels)
      mockUseStdoutDimensions.mockReturnValue({
        width: 40, // Very narrow terminal
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} displayMode="verbose" detailedTiming={{
        totalActiveTime: 90000,
        totalIdleTime: 150000,
        currentStageElapsed: 30000,
      }} />);

      // Verbose mode should show all segments despite narrow terminal
      expect(screen.getByText('●')).toBeInTheDocument(); // critical
      expect(screen.getByText('developer')).toBeInTheDocument(); // high
      expect(screen.getByText('implementation')).toBeInTheDocument(); // medium
      // Note: Session names > 15 chars are truncated regardless of mode
      expect(screen.getByText('Priority Sys...')).toBeInTheDocument(); // low (truncated session name)
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument(); // verbose indicator

      // Should also show verbose-specific timing details
      // Note: In narrow mode, abbreviated labels are used (act:, i:, s:)
      expect(screen.getByText('act:')).toBeInTheDocument(); // 'active:' abbreviated
      expect(screen.getByText('i:')).toBeInTheDocument(); // 'idle:' abbreviated
      expect(screen.getByText('s:')).toBeInTheDocument(); // 'stage:' abbreviated
    });

    it('normal display mode respects breakpoint priority system', () => {
      // Test each breakpoint with normal display mode
      // Note: Use widths that won't trigger excessive trimToFit removal
      // The test verifies that medium priority segments are ALLOWED in compact+ modes
      // (though some may be trimmed by trimToFit due to width constraints)
      const breakpoints = [
        {
          width: 59, // Max narrow width
          breakpoint: 'narrow' as const,
          isNarrow: true, isCompact: false, isNormal: false, isWide: false,
          expectMedium: false, expectLow: false
        },
        {
          width: 99, // Max compact width
          breakpoint: 'compact' as const,
          isNarrow: false, isCompact: true, isNormal: false, isWide: false,
          expectMedium: true, expectLow: false
        },
        {
          width: 159, // Max normal width
          breakpoint: 'normal' as const,
          isNarrow: false, isCompact: false, isNormal: true, isWide: false,
          expectMedium: true, expectLow: false
        },
        {
          width: 200, // Wide mode
          breakpoint: 'wide' as const,
          isNarrow: false, isCompact: false, isNormal: false, isWide: true,
          expectMedium: true, expectLow: true
        },
      ];

      breakpoints.forEach(({ width, breakpoint, isNarrow, isCompact, isNormal, isWide, expectMedium, expectLow }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow, isCompact, isNormal, isWide,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} displayMode="normal" />);

        // Critical and high should always be visible
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Medium priority - check for tokens (a shorter MEDIUM segment that typically fits)
        // Note: 'implementation' may be trimmed by trimToFit in compact mode due to width
        if (expectMedium) {
          // Tokens is a MEDIUM priority segment that typically fits better
          expect(screen.getByText('tokens:')).toBeInTheDocument();
          expect(screen.getByText('4.5k')).toBeInTheDocument();
        } else {
          // In narrow mode, medium priority segments should be filtered out
          expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
        }

        // Low priority - session name is truncated to 'Priority Sys...'
        if (expectLow) {
          expect(screen.getByText('Priority Sys...')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Priority Sys...')).not.toBeInTheDocument();
        }

        if (index < breakpoints.length - 1) rerender(<></>);
      });
    });
  });

  describe('Priority-based trimToFit functionality', () => {
    it('preserves critical segments when width-based trimming occurs', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25, // Extremely narrow to force aggressive trimming
        height: 10,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} />);

      // Critical priority should never be removed
      expect(screen.getByText('●')).toBeInTheDocument(); // connection
      expect(screen.getByText('04:00')).toBeInTheDocument(); // timer
    });

    it('removes lower priority segments before higher priority ones during trimming', () => {
      // Use a width that should trigger some trimming but not remove everything
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

      render(<StatusBar {...fullFeatureProps} />);

      // Critical should be preserved
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('04:00')).toBeInTheDocument();

      // High priority should be preserved over medium/low
      expect(screen.getByText('$0.0678')).toBeInTheDocument();

      // Medium/low should be removed by tier filtering anyway,
      // but this tests that the priority system works in edge cases
    });

    it('maintains at least critical segments even in extreme cases', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 15, // Impossibly narrow
        height: 5,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} />);

      // Should keep at least the critical timer and connection
      // Component shouldn't crash
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('04:00')).toBeInTheDocument();
    });
  });

  describe('Breakpoint Helper Integration Validation', () => {
    it('correctly uses isNarrow helper for abbreviation logic', () => {
      // Mock returning true for isNarrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true, // This should trigger abbreviation logic
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...fullFeatureProps} />);

      // Should use abbreviated labels when isNarrow is true
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();

      // Cost should have no label (empty abbreviation)
      expect(screen.getByText('$0.0678')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });

    it('correctly uses isWide helper for low priority visibility', () => {
      // Mock returning true for isWide
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true, // This should enable low priority segments
      });

      render(<StatusBar {...fullFeatureProps} />);

      // Low priority segments should be visible when isWide is true
      expect(screen.getByText('💾')).toBeInTheDocument();
      // Note: Session names > 15 chars are truncated to 12 chars + '...'
      expect(screen.getByText('Priority Sys...')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
    });

    it('validates breakpoint enum consistency with helpers', () => {
      const testCases = [
        { breakpoint: 'narrow' as const, expectedHelpers: { isNarrow: true, isCompact: false, isNormal: false, isWide: false } },
        { breakpoint: 'compact' as const, expectedHelpers: { isNarrow: false, isCompact: true, isNormal: false, isWide: false } },
        { breakpoint: 'normal' as const, expectedHelpers: { isNarrow: false, isCompact: false, isNormal: true, isWide: false } },
        { breakpoint: 'wide' as const, expectedHelpers: { isNarrow: false, isCompact: false, isNormal: false, isWide: true } },
      ];

      testCases.forEach(({ breakpoint, expectedHelpers }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100, // Use consistent width
          height: 30,
          breakpoint,
          isAvailable: true,
          ...expectedHelpers,
        });

        const { rerender } = render(<StatusBar {...fullFeatureProps} />);

        // Verify that the hook was called and the component uses the breakpoint
        expect(mockUseStdoutDimensions).toHaveBeenCalled();

        // Basic rendering verification - component should work with all breakpoints
        expect(screen.getByText('●')).toBeInTheDocument();

        if (index < testCases.length - 1) rerender(<></>);
      });
    });
  });
});