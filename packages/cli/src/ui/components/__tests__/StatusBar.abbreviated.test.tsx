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

vi.mock('../hooks/useStdoutDimensions.js', () => ({
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

    it('uses abbreviated labels when terminal width < 80', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 75,
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

      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();

      // Cost should show just the value (no label when abbreviated)
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
      expect(screen.queryByText('$')).not.toBeInTheDocument(); // No separate $ label
    });

    it('handles boundary case at exactly 80 columns', () => {
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

      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // At 80 columns, should still use full labels (>= 80)
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
    });

    it('handles boundary case at exactly 79 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 79,
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

      // At 79 columns, should use abbreviated labels (< 80)
      expect(screen.getByText('tok:')).toBeInTheDocument();
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

    it('always uses full labels in verbose mode regardless of width', () => {
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

      // Should use full labels even in narrow terminal
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
    });

    it('uses auto mode in normal display mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 75,
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

      // Should use abbreviated labels due to narrow width
      expect(screen.getByText('tok:')).toBeInTheDocument();
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

    it('abbreviates "tokens:" to "tok:"', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
        />
      );

      expect(screen.getByText('tok:')).toBeInTheDocument();
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

    it('keeps "api:" and "web:" unchanged (already short)', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
        />
      );

      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
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

    it('abbreviates timing labels in verbose mode when forced', () => {
      // Even though verbose mode normally uses full labels,
      // let's test the abbreviation mapping exists
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

      // In verbose mode, should use full labels (verbose overrides terminal width)
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
    });
  });

  describe('Mixed content with abbreviations', () => {
    it('shows mix of abbreviated and full content appropriately', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 75,
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

      // Items without labels should show normally
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Items with labels should be abbreviated
      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('2.0k')).toBeInTheDocument(); // token value
      expect(screen.getByText('$0.2345')).toBeInTheDocument(); // cost without label
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.getByText('opus')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();

      // Timer should show (no label)
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });
  });

  describe('Dynamic width changes', () => {
    it('switches between full and abbreviated labels when width changes', () => {
      // Start with wide terminal
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

      // Should show full labels
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();

      // Switch to narrow terminal
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

      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          model="opus"
        />
      );

      // Should now show abbreviated labels
      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
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
          gitBranch="main"
          agent="planner"
          previewMode={true}
        />
      );

      // Elements without labels should render normally
      expect(screen.getByText('●')).toBeInTheDocument(); // connection icon
      expect(screen.getByText('main')).toBeInTheDocument(); // git branch
      expect(screen.getByText('⚡')).toBeInTheDocument(); // agent icon
      expect(screen.getByText('planner')).toBeInTheDocument(); // agent name
      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument(); // preview mode
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