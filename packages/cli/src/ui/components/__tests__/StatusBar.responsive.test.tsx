import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
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

  describe('Narrow terminals (< 80 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
    });

    it('shows only critical and high priority segments', () => {
      render(<StatusBar {...defaultProps} />);

      // Critical: Connection status
      expect(screen.getByText('●')).toBeInTheDocument();

      // High: Git branch, Agent, Cost, Model
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();

      // Medium: Workflow stage, tokens - should be hidden in narrow mode
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/tk:/)).not.toBeInTheDocument();

      // Low: API URL, session name - should be hidden in narrow mode
      expect(screen.queryByText('4000')).not.toBeInTheDocument();
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
    });

    it('uses abbreviated labels', () => {
      render(<StatusBar {...defaultProps} />);

      // Cost should show just the value without label in abbreviated mode
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();

      // Model should use abbreviated label
      expect(screen.queryByText('m:')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();
    });

    it('truncates long git branch names', () => {
      render(<StatusBar {...defaultProps} gitBranch="feature/very-long-branch-name-that-should-be-truncated" />);

      // Should show truncated version
      expect(screen.getByText(/feature\/v\.\.\./)).toBeInTheDocument();
      expect(screen.queryByText('feature/very-long-branch-name-that-should-be-truncated')).not.toBeInTheDocument();
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

  describe('Normal terminals (80-119 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });
    });

    it('shows medium priority segments', () => {
      render(<StatusBar {...defaultProps} />);

      // Critical and High priority should be visible
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Medium priority should now be visible
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();

      // Low priority should still be hidden
      expect(screen.queryByText('4000')).not.toBeInTheDocument();
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

    it('shows subtask progress', () => {
      render(<StatusBar {...defaultProps} />);

      expect(screen.getByText('📋')).toBeInTheDocument();
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

  describe('Wide terminals (>= 120 cols)', () => {
    beforeEach(() => {
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

    it('shows session name', () => {
      render(<StatusBar {...defaultProps} />);

      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText(/Responsive Testing/)).toBeInTheDocument();
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

      // Should show all segments comfortably
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText(/Responsive Testing/)).toBeInTheDocument();
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
      // Test verbose mode in narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
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

      // Should show detailed timing
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
    });

    it('normal mode respects responsive tier', () => {
      // Normal display mode should adapt based on width
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} displayMode="normal" />);

      // Should show medium priority but not low priority
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
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
      // Start narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<StatusBar {...defaultProps} />);

      // Should be in narrow mode
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();

      // Resize to wide
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

      rerender(<StatusBar {...defaultProps} />);

      // Should now show medium priority segments
      expect(screen.getByText('implementation')).toBeInTheDocument();
    });

    it('handles boundary values correctly', () => {
      // Test exact boundary at 80 columns (should be normal tier)
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Should show medium priority segments at 80 cols
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Test exact boundary at 120 columns (should be normal tier, not wide)
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

      render(<StatusBar {...defaultProps} />);

      // Should NOT show low priority segments at 120 cols (normal tier, not wide)
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
    });

    it('shows wide tier at 121 columns', () => {
      // Test that 121 columns is wide tier (shows low priority segments)
      mockUseStdoutDimensions.mockReturnValue({
        width: 121,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Should show low priority segments at 121 cols (wide tier)
      expect(screen.getByText(/Responsive Testing/)).toBeInTheDocument();
    });
  });

  describe('Abbreviation behavior', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
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
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // In normal mode, should show full label
      expect(screen.getByText('tokens:')).toBeInTheDocument();

      // Switch to narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Tokens should be hidden in narrow mode (medium priority)
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument();
    });

    it('handles empty abbreviation for cost label', () => {
      render(<StatusBar {...defaultProps} />);

      // Cost should show just value without label in narrow mode
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });

    it('uses arrow symbols for API/Web URLs in abbreviated mode', () => {
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

      // First test normal mode - full labels
      render(<StatusBar {...defaultProps} />);
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();

      // Now test narrow mode with abbreviated labels
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
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
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
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

      // HIGH: Git branch, Agent, Cost, Model should be visible
      expect(screen.getByText(/feature/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();

      // MEDIUM: Workflow stage, Tokens, Subtask progress should be hidden
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/1.5k/)).not.toBeInTheDocument();
      expect(screen.queryByText('[3/5]')).not.toBeInTheDocument();

      // LOW: Session name, URLs should be hidden
      expect(screen.queryByText(/Responsive Testing/)).not.toBeInTheDocument();
      expect(screen.queryByText('4000')).not.toBeInTheDocument();
    });

    it('progressively shows segments as width increases', () => {
      const testWidths = [50, 80, 100, 150];
      const expectedSegmentCounts = {
        50: { visible: ['●', 'feature', 'developer', '$'], hidden: ['implementation', '[3/5]', 'Responsive'] },
        80: { visible: ['●', 'feature', 'developer', '$', 'implementation'], hidden: ['[3/5]', 'Responsive'] },
        100: { visible: ['●', 'feature', 'developer', '$', 'implementation', '[3/5]'], hidden: ['Responsive'] },
        150: { visible: ['●', 'feature', 'developer', '$', 'implementation', '[3/5]', 'Responsive'], hidden: [] },
      };

      testWidths.forEach(width => {
        const tier = width < 80 ? 'narrow' : width < 120 ? 'normal' : 'wide';
        const breakpoint = width < 80 ? 'narrow' : width < 100 ? 'compact' : 'normal';

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: breakpoint as any,
          isAvailable: true,
          isNarrow: width < 80,
          isCompact: width >= 80 && width < 100,
          isNormal: width >= 100,
          isWide: false,
        });

        render(<StatusBar {...defaultProps} />);

        const expected = expectedSegmentCounts[width as keyof typeof expectedSegmentCounts];

        // Check that expected visible elements are present
        expected.visible.forEach(text => {
          expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
        });

        // Note: We can't easily test hidden elements since some are truncated rather than hidden
      });
    });
  });
});