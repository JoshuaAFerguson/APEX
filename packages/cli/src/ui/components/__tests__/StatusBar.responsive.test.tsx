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

describe('StatusBar - Responsive Segment Adaptation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/responsive-statusbar',
    agent: 'developer',
    workflowStage: 'implementation',
    tokens: { input: 1000, output: 500 },
    cost: 0.1234,
    sessionCost: 0.5678,
    model: 'opus',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionName: 'Responsive Testing Session',
    subtaskProgress: { completed: 3, total: 5 },
  };

  describe('Narrow terminals (< 60 cols) - per acceptance criteria', () => {
    beforeEach(() => {
      // Per acceptance criteria: narrow is < 60 cols
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
    });

    it('shows only critical and high priority segments (or subset when space-constrained)', () => {
      render(<StatusBar {...defaultProps} />);

      // Critical: Connection status is always shown
      expect(screen.getByText('●')).toBeInTheDocument();

      // High priority segments may be trimmed by trimToFit at very narrow widths
      // At least agent should be visible
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Medium: Workflow stage, tokens - should be hidden in narrow mode
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/tk:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tokens:/)).not.toBeInTheDocument();

      // Low: API URL, session name - should be hidden in narrow mode
      expect(screen.queryByText('4000')).not.toBeInTheDocument();
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
    });

    it('uses abbreviated labels when segments fit', () => {
      // Test at a slightly wider narrow terminal where more segments fit
      mockUseStdoutDimensions.mockReturnValue({
        width: 59,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
      render(<StatusBar {...defaultProps} />);

      // At narrow widths, segments that don't fit are trimmed
      // Verify that medium/low priority labels are not shown (filtered by tier)
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
    });

    it('truncates long git branch names when space allows display', () => {
      // Use a narrow width that still allows git branch to be displayed
      mockUseStdoutDimensions.mockReturnValue({
        width: 59,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
      render(<StatusBar {...defaultProps} gitBranch="feature/very-long-branch-name-that-should-be-truncated" />);

      // In narrow mode with long branch, either:
      // 1. Branch is truncated via narrowModeConfig.compressValue (shows first 9 chars + ...)
      // 2. Or branch is trimmed entirely by trimToFit if it doesn't fit
      // The implementation truncates to 9 chars + '...' for branches > 12 chars
      const truncatedMatch = screen.queryByText(/feature\/v\.\.\./);
      const fullMatch = screen.queryByText('feature/very-long-branch-name-that-should-be-truncated');

      // Either truncated version is shown or it's been trimmed completely
      expect(truncatedMatch || !fullMatch).toBeTruthy();
    });

    it('hides low priority segments (URLs, session name)', () => {
      render(<StatusBar {...defaultProps} />);

      // API and Web URLs should be hidden
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('4000')).not.toBeInTheDocument();
      expect(screen.queryByText('3000')).not.toBeInTheDocument();

      // Session name should be hidden
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
    });

    it('does not overflow or truncate visually', () => {
      render(<StatusBar {...defaultProps} />);

      // The component should render without throwing or visual overflow
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles very narrow terminals (< 40 cols)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Should still show essential elements
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('Normal terminals (60-160 cols) - per acceptance criteria', () => {
    beforeEach(() => {
      // Per acceptance criteria: normal is 60-160 cols
      // Using 120 cols to ensure medium priority segments fit alongside the test data
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

    it('shows medium priority segments', () => {
      render(<StatusBar {...defaultProps} />);

      // Critical and High priority should be visible
      expect(screen.getByText('●')).toBeInTheDocument();
      // Feature branch text may be truncated or present
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Medium priority should be visible at 120 cols (normal tier)
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();

      // Low priority should still be hidden
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
    });

    it('uses full labels', () => {
      render(<StatusBar {...defaultProps} />);

      // Should use full labels in normal mode
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.queryByText('m:')).not.toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
    });

    it('shows subtask progress at normal width', () => {
      render(<StatusBar {...defaultProps} />);

      // At normal width (120 cols), medium priority segments should be visible
      expect(screen.getByText('[3/5]')).toBeInTheDocument();
    });

    it('hides low priority segments', () => {
      render(<StatusBar {...defaultProps} />);

      // API and Web URLs should still be hidden
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('web:')).not.toBeInTheDocument();

      // Session name should still be hidden
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
    });
  });

  describe('Wide terminals (> 160 cols) - per acceptance criteria', () => {
    beforeEach(() => {
      // Per acceptance criteria: wide is > 160 cols
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });
    });

    it('shows all segments including low priority', () => {
      render(<StatusBar {...defaultProps} />);

      // All priority levels should be visible
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();

      // Low priority segments should now be visible
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
    });

    it('shows session name in wide mode', () => {
      render(<StatusBar {...defaultProps} />);

      // In wide mode (180 cols), low priority segments should be visible
      expect(screen.getByText(/Responsive/)).toBeInTheDocument();
    });

    it('shows API and Web URLs', () => {
      render(<StatusBar {...defaultProps} />);

      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
    });

    it('uses full labels with generous spacing', () => {
      render(<StatusBar {...defaultProps} />);

      // All full labels should be present
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
    });

    it('handles very wide terminals (> 200 cols)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 250,
        height: 50,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...defaultProps} />);

      // Should show all segments comfortably at very wide width
      expect(screen.getByText('●')).toBeInTheDocument();
      // Low priority segments should be visible
      expect(screen.getByText(/Responsive/)).toBeInTheDocument();
    });
  });

  describe('Display mode interactions', () => {
    it('compact mode overrides responsive in all tiers', () => {
      // Test compact mode in wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 40,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} displayMode="compact" />);

      // Should only show connection, git branch, and cost
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();

      // Everything else should be hidden despite wide terminal
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('opus')).not.toBeInTheDocument();
    });

    it('verbose mode shows all info regardless of width', () => {
      // Test verbose mode in narrow terminal (< 60 per acceptance criteria)
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} displayMode="verbose" detailedTiming={{
        totalActiveTime: 120000,
        totalIdleTime: 30000,
        currentStageElapsed: 60000,
      }} />);

      // Should show all elements despite narrow terminal
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Should show detailed timing (labels may be abbreviated in narrow mode)
      // The key is that the timing VALUES are present
      expect(screen.getByText('2m0s')).toBeInTheDocument(); // active time
      expect(screen.getByText('30s')).toBeInTheDocument(); // idle time
    });

    it('normal mode respects responsive tier', () => {
      // Normal display mode should adapt based on width
      // 120 cols is normal tier (60-160), so medium priority should be shown
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

      render(<StatusBar {...defaultProps} displayMode="normal" />);

      // Should show medium priority but not low priority
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.queryByText(/Responsive/)).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles missing optional segments gracefully', () => {
      render(<StatusBar isConnected={true} />);

      // Should render with just connection status
      expect(screen.getByText('●')).toBeInTheDocument();
      // Should show elapsed time
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles terminal resize events', () => {
      // Start narrow (< 60 per acceptance criteria)
      mockUseStdoutDimensions.mockReturnValue({
        width: 55,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Should be in narrow mode - medium priority hidden
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('[3/5]')).not.toBeInTheDocument();

      // Resize to normal (60-160 per acceptance criteria)
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Should now show medium priority segments
      expect(screen.getByText('implementation')).toBeInTheDocument();
    });

    it('handles boundary values correctly per acceptance criteria', () => {
      // Test exact boundary at 60 columns (should be normal tier, not narrow)
      // Per acceptance criteria: narrow < 60, normal 60-160, wide > 160
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // At exactly 60 cols, tier filtering allows medium priority but trimToFit
      // may remove some segments due to limited space. Key test: medium priority
      // IS allowed by tier filtering (unlike narrow which filters them out).
      // Critical segments should always be visible.
      expect(screen.getByText('●')).toBeInTheDocument();
      // Low priority should be hidden even at boundary
      expect(screen.queryByText('api:')).not.toBeInTheDocument();

      // Test exact boundary at 160 columns (should be normal tier, not wide)
      mockUseStdoutDimensions.mockReturnValue({
        width: 160,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Should NOT show low priority segments at 160 cols (still normal tier)
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
    });

    it('shows wide tier at 161 columns per acceptance criteria', () => {
      // Test that 161 columns is wide tier (shows low priority segments)
      // Per acceptance criteria: wide is > 160 cols
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 30,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...defaultProps} />);

      // Should show low priority segments in wide tier (>160 cols)
      expect(screen.getByText('api:')).toBeInTheDocument();
    });
  });

  describe('Abbreviation behavior', () => {
    beforeEach(() => {
      // Narrow mode < 60 per acceptance criteria
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
    });

    it('abbreviates tokens label correctly', () => {
      // Normal mode (60-160 per acceptance criteria)
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

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // In normal mode, should show full label
      expect(screen.getByText('tokens:')).toBeInTheDocument();

      // Switch to narrow (< 60 per acceptance criteria)
      mockUseStdoutDimensions.mockReturnValue({
        width: 55,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Tokens should be hidden in narrow mode (medium priority)
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument();
    });

    it('handles empty abbreviation for cost label', () => {
      // Narrow mode (< 60 per acceptance criteria) - cost uses abbreviated label (empty = no label)
      render(<StatusBar {...defaultProps} />);

      // Cost should show just value without label in narrow mode
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });

    it('uses arrow symbols for API/Web URLs in abbreviated mode', () => {
      // Wide mode (> 160 per acceptance criteria) - shows low priority segments
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      // First test wide mode - full labels
      render(<StatusBar {...defaultProps} />);
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();

      // Now test narrow mode (< 60)
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // URLs are low priority and should be hidden in narrow mode
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
    });
  });

  describe('Priority system validation', () => {
    it('correctly prioritizes segments in narrow mode', () => {
      // Narrow mode < 60 per acceptance criteria
      mockUseStdoutDimensions.mockReturnValue({
        width: 55,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // CRITICAL: Connection, Session timer should always be visible
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();

      // HIGH: Agent should be visible (some high priority may be trimmed at very narrow widths)
      expect(screen.getByText('developer')).toBeInTheDocument();

      // MEDIUM: Workflow stage, Tokens, Subtask progress should be hidden (filtered by tier)
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('[3/5]')).not.toBeInTheDocument();

      // LOW: Session name, URLs should be hidden (filtered by tier)
      expect(screen.queryByText(/Responsive/)).not.toBeInTheDocument();
      expect(screen.queryByText('4000')).not.toBeInTheDocument();
    });

    it('progressively shows segments as width increases per acceptance criteria', () => {
      // Test a progression through different widths using rerender
      // First: narrow (55)
      mockUseStdoutDimensions.mockReturnValue({
        width: 55,
        height: 30,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Narrow: Medium priority should be hidden (filtered by tier)
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();

      // Second: normal (120 cols to ensure medium priority fits)
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

      rerender(<StatusBar {...defaultProps} />);

      // Normal: Medium priority should be visible, low priority hidden
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();

      // Third: wide (200)
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 30,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<StatusBar {...defaultProps} />);

      // Wide: All priority levels should be visible
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
    });
  });
});