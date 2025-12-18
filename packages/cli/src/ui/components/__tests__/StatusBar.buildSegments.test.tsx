import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
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

describe('StatusBar - buildSegments Function', () => {
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

  describe('abbreviationMode parameter handling', () => {
    it('correctly applies abbreviation mode from display mode', () => {
      const testCases = [
        { displayMode: 'compact', expectedAbbreviated: true },
        { displayMode: 'verbose', expectedAbbreviated: false },
        { displayMode: 'normal', expectedAbbreviated: false }, // auto mode, wide terminal
      ] as const;

      testCases.forEach(({ displayMode, expectedAbbreviated }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120, // Wide terminal
          height: 30,
          breakpoint: 'normal' as const,
          isAvailable: true,
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
        });

        const { unmount } = render(
          <StatusBar
            {...defaultProps}
            displayMode={displayMode}
            tokens={{ input: 500, output: 300 }}
            model="opus"
          />
        );

        if (displayMode === 'compact') {
          // In compact mode, most segments are not shown
          expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
          expect(screen.queryByText('tok:')).not.toBeInTheDocument();
          expect(screen.queryByText('model:')).not.toBeInTheDocument();
          expect(screen.queryByText('mod:')).not.toBeInTheDocument();
        } else if (expectedAbbreviated) {
          expect(screen.getByText('tok:')).toBeInTheDocument();
          expect(screen.getByText('mod:')).toBeInTheDocument();
        } else {
          expect(screen.getByText('tokens:')).toBeInTheDocument();
          expect(screen.getByText('model:')).toBeInTheDocument();
        }

        unmount();
      });
    });

    it('handles auto mode abbreviation based on terminal width', () => {
      const testCases = [
        { width: 60, expectAbbreviated: true },  // < 80
        { width: 79, expectAbbreviated: true },  // < 80
        { width: 80, expectAbbreviated: false }, // >= 80
        { width: 120, expectAbbreviated: false }, // >= 80
      ];

      testCases.forEach(({ width, expectAbbreviated }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: width < 80 ? 'narrow' : (width < 100 ? 'compact' : 'normal') as any,
          isAvailable: true,
          isNarrow: width < 80,
          isCompact: width >= 80 && width < 100,
          isNormal: width >= 100,
          isWide: false,
        });

        const { unmount } = render(
          <StatusBar
            {...defaultProps}
            displayMode="normal" // auto mode
            tokens={{ input: 500, output: 300 }}
            model="opus"
          />
        );

        if (expectAbbreviated) {
          expect(screen.getByText('tok:')).toBeInTheDocument();
          expect(screen.getByText('mod:')).toBeInTheDocument();
          expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
          expect(screen.queryByText('model:')).not.toBeInTheDocument();
        } else {
          expect(screen.getByText('tokens:')).toBeInTheDocument();
          expect(screen.getByText('model:')).toBeInTheDocument();
          expect(screen.queryByText('tok:')).not.toBeInTheDocument();
          expect(screen.queryByText('mod:')).not.toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('segment generation with abbreviations', () => {
    it('creates segments with correct abbreviatedLabel properties', () => {
      // Test that all expected segments are generated with their abbreviations
      mockUseStdoutDimensions.mockReturnValue({
        width: 70, // Force abbreviated mode
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
          cost={0.1234}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          detailedTiming={{
            totalActiveTime: 120000,
            totalIdleTime: 30000,
            currentStageElapsed: 60000,
          }}
          workflowStage="implementation"
        />
      );

      // Check abbreviated labels are used
      expect(screen.getByText('tok:')).toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();

      // Cost should show just value (no label when abbreviated)
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });

    it('handles segments without abbreviatedLabel property', () => {
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
          sessionStartTime={new Date()}
        />
      );

      // Elements without labels should render normally
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection indicator
      expect(screen.getByText('main')).toBeInTheDocument(); // Git branch
      expect(screen.getByText('planner')).toBeInTheDocument(); // Agent name
      expect(screen.getByText('00:00')).toBeInTheDocument(); // Timer (no label)
    });
  });

  describe('verbose mode segment generation', () => {
    it('generates detailed timing segments with abbreviations', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          workflowStage="implementation"
          detailedTiming={{
            totalActiveTime: 120000, // 2 minutes
            totalIdleTime: 30000,    // 30 seconds
            currentStageElapsed: 60000, // 1 minute
          }}
        />
      );

      // In verbose mode, should use full labels
      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('2m0s')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('30s')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('1m0s')).toBeInTheDocument();
    });

    it('generates token breakdown segments in verbose mode', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 1500, output: 2500 }}
        />
      );

      // Should show both breakdown and total in verbose mode
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('1.5k→2.5k')).toBeInTheDocument(); // Breakdown
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('4.0k')).toBeInTheDocument(); // Total
    });

    it('generates session cost segment in verbose mode when different from regular cost', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          cost={0.1234}
          sessionCost={0.5678}
        />
      );

      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('$0.5678')).toBeInTheDocument();
    });

    it('does not duplicate session cost when same as regular cost', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          cost={0.1234}
          sessionCost={0.1234}
        />
      );

      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('session:')).not.toBeInTheDocument();
    });
  });

  describe('compact mode segment generation', () => {
    it('generates minimal segments in compact mode', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="compact"
          gitBranch="main"
          agent="planner"
          workflowStage="implementation"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
        />
      );

      // Should only show connection, git branch, and cost
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();

      // Should not show other elements in compact mode
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
      expect(screen.queryByText('opus')).not.toBeInTheDocument();
    });

    it('handles missing cost in compact mode gracefully', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="compact"
          gitBranch="main"
        />
      );

      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      // No error should occur
    });
  });

  describe('segment filtering behavior', () => {
    it('filters segments when terminal width is insufficient', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40, // Very narrow terminal
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
          gitBranch="feature/very-long-branch-name"
          agent="planner"
          workflowStage="implementation"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionName="Very Long Session Name"
        />
      );

      // Essential elements should be preserved
      expect(screen.getByText('●')).toBeInTheDocument();

      // Component should render without errors despite space constraints
      // Some segments may be filtered out, but core functionality remains
    });

    it('does not filter segments in verbose mode regardless of width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40, // Very narrow terminal
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
          gitBranch="feature/verbose-mode"
          agent="planner"
          workflowStage="implementation"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          sessionCost={0.5678}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
        />
      );

      // All segments should be present in verbose mode
      expect(screen.getByText('feature/verbose-mode')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });
  });

  describe('left and right segment allocation', () => {
    it('correctly allocates segments to left and right sides', () => {
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
          sessionStartTime={new Date()}
        />
      );

      // Left side should have connection, git, agent, workflow
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Right side should have timer, tokens, cost, model
      expect(screen.getByText('00:00')).toBeInTheDocument();
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
    });

    it('handles subtask progress on left side', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          subtaskProgress={{ completed: 3, total: 5 }}
        />
      );

      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();
    });

    it('handles session name truncation on left side', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          sessionName="This is a very long session name that should be truncated"
        />
      );

      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText(/This is a ve\.\.\./)).toBeInTheDocument();
    });

    it('does not show subtask progress when total is 0', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          subtaskProgress={{ completed: 0, total: 0 }}
        />
      );

      expect(screen.queryByText('📋')).not.toBeInTheDocument();
      expect(screen.queryByText('[0/0]')).not.toBeInTheDocument();
    });
  });

  describe('special indicators and modes', () => {
    it('includes preview mode indicator', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          previewMode={true}
        />
      );

      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
    });

    it('includes show thoughts indicator', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          showThoughts={true}
        />
      );

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('includes verbose mode indicator', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('handles multiple indicators simultaneously', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          previewMode={true}
          showThoughts={true}
        />
      );

      expect(screen.getByText('📋 PREVIEW')).toBeInTheDocument();
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });
  });

  describe('URL formatting', () => {
    it('strips localhost from API and web URLs', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
        />
      );

      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();

      // Should not show full localhost URLs
      expect(screen.queryByText('http://localhost:4000')).not.toBeInTheDocument();
      expect(screen.queryByText('http://localhost:3000')).not.toBeInTheDocument();
    });

    it('handles non-localhost URLs correctly', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          apiUrl="https://api.example.com:4000"
          webUrl="https://web.example.com:3000"
        />
      );

      expect(screen.getByText('api:')).toBeInTheDocument();
      expect(screen.getByText('https://api.example.com:4000')).toBeInTheDocument();
      expect(screen.getByText('web:')).toBeInTheDocument();
      expect(screen.getByText('https://web.example.com:3000')).toBeInTheDocument();
    });
  });

  describe('error and edge cases', () => {
    it('handles undefined elapsed time gracefully', () => {
      // Simulate edge case where elapsed time calculation fails
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          sessionStartTime={undefined}
        />
      );

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles undefined tokens gracefully', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={undefined}
        />
      );

      // Should render without errors
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('tok:')).not.toBeInTheDocument();
    });

    it('handles zero cost correctly', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          cost={0}
        />
      );

      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.0000')).toBeInTheDocument();
    });

    it('handles very large token values', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 5000000, output: 3000000 }}
        />
      );

      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('8.0M')).toBeInTheDocument(); // 8 million tokens
    });

    it('handles disconnected state', () => {
      render(
        <StatusBar
          {...defaultProps}
          isConnected={false}
        />
      );

      expect(screen.getByText('○')).toBeInTheDocument(); // Disconnected indicator
      expect(screen.queryByText('●')).not.toBeInTheDocument();
    });
  });
});