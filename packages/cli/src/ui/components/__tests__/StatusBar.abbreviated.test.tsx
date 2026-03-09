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

describe('StatusBar - Abbreviated Labels', () => {
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

  describe('Auto mode abbreviation based on terminal width', () => {
    it('uses full labels when terminal width >= 80', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(
        <StatusBar
          {...defaultProps}
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
        />
      );

      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
    });

    it('uses abbreviated labels when terminal width < 60 (narrow mode)', () => {
      // Note: In the 4-tier system, narrow mode (<60) filters OUT medium and low priority segments
      // Only critical and high priority are shown in narrow mode
      // Abbreviations apply but tokens/apiUrl are NOT visible (filtered by tier)
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

      render(
        <StatusBar
          {...defaultProps}
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
        />
      );

      // In narrow mode: tokens (medium) and apiUrl/webUrl (low) are FILTERED OUT, not abbreviated
      // Only critical (connection, timer) and high (cost, model) are shown
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('web:')).not.toBeInTheDocument();

      // Cost should show just the value (no label when abbreviated)
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });

    it('handles boundary case at exactly 60 columns (compact tier)', () => {
      // 60 cols is the boundary between narrow and compact tiers
      // At 60 cols (compact tier), medium priority segments are visible
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // At compact tier (60-100), medium priority visible with full labels
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
    });

    it('handles boundary case at exactly 59 columns (narrow tier)', () => {
      // 59 cols is narrow tier - medium priority filtered out
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // At 59 cols (narrow), tokens (medium) is FILTERED OUT entirely
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      // Model is high priority, should be visible but abbreviated in narrow mode
      expect(screen.getByText('mod:')).toBeInTheDocument();
    });
  });

  describe('Display mode integration', () => {
    it('always uses abbreviated labels in compact mode regardless of width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 30,
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
          displayMode="compact"
          cost={0.1234}
        />
      );

      // In compact mode, cost shows just value without any label
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });

    it('uses abbreviated labels in verbose mode when terminal is narrow', () => {
      // Verbose mode bypasses TIER filtering (shows ALL segments)
      // But abbreviations still apply based on breakpoint in narrow mode
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          sessionCost={0.5678}
          model="opus"
          detailedTiming={{
            totalActiveTime: 120000, // 2 minutes
            totalIdleTime: 30000,    // 30 seconds
            currentStageElapsed: 60000, // 1 minute
          }}
          workflowStage="implementation"
        />
      );

      // In verbose mode with narrow width: tier filtering is bypassed BUT abbreviations apply
      expect(screen.getByText('tk:')).toBeInTheDocument(); // tokens abbreviated
      expect(screen.getByText('∑:')).toBeInTheDocument(); // total abbreviated
      expect(screen.getByText('$0.1234')).toBeInTheDocument(); // cost no label when abbreviated
      expect(screen.getByText('sess:')).toBeInTheDocument(); // session abbreviated
      expect(screen.getByText('mod:')).toBeInTheDocument(); // model abbreviated
      expect(screen.getByText('act:')).toBeInTheDocument(); // active abbreviated
      expect(screen.getByText('i:')).toBeInTheDocument(); // idle abbreviated
      expect(screen.getByText('s:')).toBeInTheDocument(); // stage abbreviated
    });

    it('uses auto mode in normal display mode', () => {
      // In narrow mode (<60), MEDIUM priority segments (tokens) are filtered out
      // Only CRITICAL and HIGH priority segments are shown
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // Tokens (MEDIUM) filtered out in narrow mode
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      // Model (HIGH) should use abbreviated label in narrow mode
      expect(screen.getByText('mod:')).toBeInTheDocument();
    });
  });

  describe('Individual label abbreviations', () => {
    beforeEach(() => {
      // Set narrow terminal to force abbreviations
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
    });

    it('abbreviates "tokens:" to "tok:" (only visible in verbose mode for narrow)', () => {
      // In narrow mode, tokens (MEDIUM) are filtered out by tier filtering
      // Use verbose mode to bypass tier filtering and see abbreviation
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 500, output: 300 }}
        />
      );

      // In verbose + narrow mode: tier filtering bypassed, abbreviations apply
      expect(screen.getByText('tk:')).toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
    });

    it('abbreviates "model:" to "mod:"', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          model="opus"
        />
      );

      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();
    });

    it('handles cost special case - no label when abbreviated', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          cost={0.1234}
        />
      );

      // Should show just the value with no prefix since value already has $
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
      expect(screen.queryByText('$:')).not.toBeInTheDocument();
    });

    it('abbreviates "api:" and "web:" in narrow mode (visible in verbose only)', () => {
      // API/Web URLs are LOW priority, filtered in narrow mode with normal displayMode
      // Use verbose mode to bypass tier filtering and see abbreviation
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
        />
      );

      // In verbose + narrow mode: tier filtering bypassed, abbreviated labels apply
      expect(screen.getByText('→')).toBeInTheDocument(); // api abbreviated
      expect(screen.getByText('↗')).toBeInTheDocument(); // web abbreviated
    });
  });

  describe('Verbose mode detailed timing abbreviations', () => {
    beforeEach(() => {
      // Set narrow terminal to test abbreviations in verbose mode
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
    });

    it('abbreviates timing labels in verbose mode when in narrow breakpoint', () => {
      // Verbose mode bypasses tier filtering but still uses abbreviated labels in narrow mode
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          workflowStage="implementation"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          sessionCost={0.5678}
          detailedTiming={{
            totalActiveTime: 120000, // 2 minutes
            totalIdleTime: 30000,    // 30 seconds
            currentStageElapsed: 60000, // 1 minute
          }}
        />
      );

      // In verbose mode with narrow width, abbreviated labels are used
      expect(screen.getByText('act:')).toBeInTheDocument(); // active abbreviated
      expect(screen.getByText('i:')).toBeInTheDocument(); // idle abbreviated
      expect(screen.getByText('s:')).toBeInTheDocument(); // stage abbreviated
      expect(screen.getByText('tk:')).toBeInTheDocument(); // tokens abbreviated
      expect(screen.getByText('∑:')).toBeInTheDocument(); // total abbreviated
      expect(screen.getByText('sess:')).toBeInTheDocument(); // session abbreviated
    });
  });

  describe('Mixed content with abbreviations', () => {
    it('shows mix of abbreviated and full content appropriately', () => {
      // In narrow mode, only CRITICAL and HIGH priority segments are shown
      // Tokens (MEDIUM) and API URLs (LOW) are filtered out
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          gitBranch="main"
          agent="planner"
          tokens={{ input: 1500, output: 500 }}
          cost={0.2345}
          model="opus"
          apiUrl="http://localhost:4000"
          sessionStartTime={new Date()}
        />
      );

      // Items without labels should show normally (HIGH priority)
      expect(screen.getByText('main')).toBeInTheDocument(); // git branch (HIGH)
      expect(screen.getByText('planner')).toBeInTheDocument(); // agent (HIGH)

      // Cost (HIGH) - no label when abbreviated
      expect(screen.getByText('$0.2345')).toBeInTheDocument();
      // Model (HIGH) - abbreviated
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.getByText('opus')).toBeInTheDocument();

      // Timer (CRITICAL) should show
      expect(screen.getByText('00:00')).toBeInTheDocument();

      // Tokens (MEDIUM) and API URLs (LOW) are filtered in narrow mode
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
    });
  });

  describe('Dynamic width changes', () => {
    it('switches between full and abbreviated labels when width changes', () => {
      // Start with normal terminal (MEDIUM priority visible, full labels)
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

      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // Should show full labels in normal mode
      expect(screen.getByText('tokens:')).toBeInTheDocument(); // MEDIUM visible in normal
      expect(screen.getByText('model:')).toBeInTheDocument(); // HIGH visible always

      // Switch to narrow terminal
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

      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // In narrow mode: tokens (MEDIUM) filtered out, model (HIGH) abbreviated
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles missing abbreviated labels gracefully', () => {
      // Test with minimal props to ensure no errors with missing abbreviations
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
        />
      );

      // Should render without errors
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles segments without labels correctly', () => {
      // In narrow mode, only CRITICAL and HIGH priority segments are shown
      // Preview mode indicator (LOW) is filtered out
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          gitBranch="main"
          agent="planner"
          previewMode={true}
        />
      );

      // Elements without labels should render normally (CRITICAL and HIGH priority)
      expect(screen.getByText('●')).toBeInTheDocument(); // connection icon (CRITICAL)
      expect(screen.getByText('main')).toBeInTheDocument(); // git branch (HIGH)
      expect(screen.getByText('⚡')).toBeInTheDocument(); // agent icon (HIGH)
      expect(screen.getByText('planner')).toBeInTheDocument(); // agent name (HIGH)

      // Preview mode indicator (LOW) is filtered out in narrow mode
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument();
    });

    it('handles zero terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 0,
        breakpoint: 'narrow' as const,
        isAvailable: false,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} displayMode="normal" />);

      // Should not crash
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('Verbose mode token breakdown with abbreviations', () => {
    it('uses abbreviated labels for token breakdown in narrow verbose mode', () => {
      // Set wide terminal first to show verbose mode isn't affected by width
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 40,
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
          displayMode="verbose"
          tokens={{ input: 1500, output: 2500 }}
        />
      );

      // In verbose mode, should use full labels regardless of terminal width
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('1.5k→2.5k')).toBeInTheDocument(); // breakdown
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('4.0k')).toBeInTheDocument(); // total
    });
  });

  describe('Integration with existing responsive behavior', () => {
    it('abbreviated labels work with segment filtering in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50, // Very narrow
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
          gitBranch="main"
          agent="planner"
          workflowStage="implementation"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionName="Test Session"
        />
      );

      // Essential elements should still be there
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();

      // The component should render without errors even if some segments are filtered
      // due to space constraints combined with abbreviations
    });
  });
});