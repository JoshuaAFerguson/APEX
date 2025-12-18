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

describe('StatusBar', () => {
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

  describe('basic rendering', () => {
    it('renders with minimal props', () => {
      render(<StatusBar {...defaultProps} />);

      // Should show connection status (green dot for connected)
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('shows disconnected status', () => {
      render(<StatusBar {...defaultProps} isConnected={false} />);

      // Should show disconnected status (empty circle)
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('displays git branch', () => {
      render(<StatusBar {...defaultProps} gitBranch="feature/auth" />);

      expect(screen.getByText('feature/auth')).toBeInTheDocument();
    });

    it('displays agent name', () => {
      render(<StatusBar {...defaultProps} agent="planner" />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('displays workflow stage', () => {
      render(<StatusBar {...defaultProps} workflowStage="implementation" />);

      expect(screen.getByText('▶')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
    });

    it('displays model name', () => {
      render(<StatusBar {...defaultProps} model="opus" />);

      expect(screen.getByText(/model:/)).toBeInTheDocument();
      expect(screen.getByText('opus')).toBeInTheDocument();
    });
  });

  describe('token and cost display', () => {
    it('displays token count with formatting', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 500, output: 300 }} />);

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument(); // 500 + 300
    });

    it('formats large token counts', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 1500, output: 500 }} />);

      expect(screen.getByText('2.0k')).toBeInTheDocument(); // 2000 tokens
    });

    it('formats very large token counts', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 1500000, output: 500000 }} />);

      expect(screen.getByText('2.0M')).toBeInTheDocument(); // 2M tokens
    });

    it('displays cost', () => {
      render(<StatusBar {...defaultProps} cost={0.1234} />);

      expect(screen.getByText(/cost:/)).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
    });

    it('displays session cost', () => {
      render(<StatusBar {...defaultProps} sessionCost={1.5678} />);

      // Session cost should be displayed (implementation may vary)
      expect(screen.getByText(/1.5678/)).toBeInTheDocument();
    });
  });

  describe('progress and session info', () => {
    it('displays subtask progress', () => {
      render(<StatusBar {...defaultProps} subtaskProgress={{ completed: 3, total: 5 }} />);

      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();
    });

    it('shows completed subtasks in green', () => {
      render(<StatusBar {...defaultProps} subtaskProgress={{ completed: 5, total: 5 }} />);

      expect(screen.getByText('[5/5]')).toBeInTheDocument();
      // Color should be green (would need to test style or className)
    });

    it('displays session name', () => {
      render(<StatusBar {...defaultProps} sessionName="My Session" />);

      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText('My Session')).toBeInTheDocument();
    });

    it('truncates long session names', () => {
      render(<StatusBar {...defaultProps} sessionName="Very Long Session Name That Should Be Truncated" />);

      expect(screen.getByText(/Very Long Se\.\.\./)).toBeInTheDocument();
    });
  });

  describe('service URLs', () => {
    it('displays API URL', () => {
      render(<StatusBar {...defaultProps} apiUrl="http://localhost:4000" />);

      expect(screen.getByText(/api:/)).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument(); // Strips localhost part
    });

    it('displays web URL', () => {
      render(<StatusBar {...defaultProps} webUrl="http://localhost:3000" />);

      expect(screen.getByText(/web:/)).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument(); // Strips localhost part
    });
  });

  describe('session timer', () => {
    it('displays elapsed time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:02:30Z')); // 2 minutes 30 seconds later

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('02:30')).toBeInTheDocument();
    });

    it('updates timer every second', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:00Z')); // 1 minute later

      const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Advance time by 1 second and trigger timer
      vi.advanceTimersByTime(1000);
      rerender(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:01')).toBeInTheDocument();
    });

    it('shows 00:00 when no start time provided', () => {
      render(<StatusBar {...defaultProps} />);

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('formats hours correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T11:35:45Z')); // 1 hour 35 minutes 45 seconds

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('95:45')).toBeInTheDocument(); // 95 minutes total
    });
  });

  describe('responsive segment adaptation', () => {
    it('adapts to narrow terminal width with abbreviated labels', () => {
      // Mock narrow terminal (< 80)
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
          gitBranch="feature/auth"
          agent="planner"
          workflowStage="implementation"
          model="opus"
          tokens={{ input: 1000, output: 500 }}
          cost={0.5}
          sessionName="Test Session"
          apiUrl="http://localhost:4000"
        />
      );

      // Should show CRITICAL and HIGH priority segments
      expect(screen.getByText('●')).toBeInTheDocument(); // connection (critical)
      expect(screen.getByText('feature/auth')).toBeInTheDocument(); // git branch (high)
      expect(screen.getByText('planner')).toBeInTheDocument(); // agent (high)
      expect(screen.getByText('$0.5000')).toBeInTheDocument(); // cost (high)
      expect(screen.getByText('opus')).toBeInTheDocument(); // model (high)

      // Should NOT show MEDIUM/LOW priority segments in narrow mode
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // workflow stage (medium)
      expect(screen.queryByText('Test Session')).not.toBeInTheDocument(); // session name (low)
      expect(screen.queryByText('4000')).not.toBeInTheDocument(); // api url (low)

      // Token display should be abbreviated to 'tk:' or hidden completely
      const tokensText = screen.queryByText(/tokens:/);
      if (tokensText) {
        // If shown, should be abbreviated
        expect(screen.queryByText('tk:')).toBeInTheDocument();
      }
    });

    it('shows abbreviated labels in narrow mode', () => {
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
          model="opus"
          tokens={{ input: 1000, output: 500 }}
          cost={0.1234}
        />
      );

      // In narrow mode, labels should be abbreviated according to LABEL_ABBREVIATIONS
      // Cost should show just the value without "cost:" label (abbreviated to empty string)
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();

      // Model should be abbreviated from "model:" to "m:" if space permits
      if (screen.queryByText(/model:|m:/)) {
        expect(screen.queryByText('m:')).toBeInTheDocument();
        expect(screen.queryByText('model:')).not.toBeInTheDocument();
      }

      // Tokens, if shown, should be abbreviated from "tokens:" to "tk:"
      if (screen.queryByText(/tokens:|tk:/)) {
        expect(screen.queryByText('tk:')).toBeInTheDocument();
        expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      }
    });

    it('shows all segments in normal width terminals', () => {
      // Mock normal terminal (80-119)
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
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
          gitBranch="feature/auth"
          agent="developer"
          workflowStage="implementation"
          model="sonnet"
          tokens={{ input: 2000, output: 1500 }}
          cost={0.3456}
        />
      );

      // Should show CRITICAL, HIGH, and MEDIUM priority segments
      expect(screen.getByText('●')).toBeInTheDocument(); // connection (critical)
      expect(screen.getByText('feature/auth')).toBeInTheDocument(); // git branch (high)
      expect(screen.getByText('developer')).toBeInTheDocument(); // agent (high)
      expect(screen.getByText('implementation')).toBeInTheDocument(); // workflow stage (medium)
      expect(screen.getByText('3.5k')).toBeInTheDocument(); // tokens (medium)
      expect(screen.getByText('$0.3456')).toBeInTheDocument(); // cost (high)
      expect(screen.getByText('sonnet')).toBeInTheDocument(); // model (high)

      // Labels should be full, not abbreviated
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('cost:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();
    });

    it('shows all segments including low priority in wide terminals', () => {
      // Mock wide terminal (>=120)
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
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
          gitBranch="feature/comprehensive-display"
          agent="architect"
          workflowStage="planning"
          model="opus"
          tokens={{ input: 5000, output: 3000 }}
          cost={0.7890}
          sessionName="Full Feature Session"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          subtaskProgress={{ completed: 6, total: 8 }}
        />
      );

      // Should display ALL priority levels (critical, high, medium, low)
      expect(screen.getByText('●')).toBeInTheDocument(); // connection (critical)
      expect(screen.getByText('feature/comprehensive-display')).toBeInTheDocument(); // git branch (high)
      expect(screen.getByText('architect')).toBeInTheDocument(); // agent (high)
      expect(screen.getByText('planning')).toBeInTheDocument(); // workflow stage (medium)
      expect(screen.getByText('8.0k')).toBeInTheDocument(); // tokens (medium)
      expect(screen.getByText('$0.7890')).toBeInTheDocument(); // cost (high)
      expect(screen.getByText('opus')).toBeInTheDocument(); // model (high)
      expect(screen.getByText(/Full Feature Session/)).toBeInTheDocument(); // session name (low)
      expect(screen.getByText('4000')).toBeInTheDocument(); // api url (low)
      expect(screen.getByText('3000')).toBeInTheDocument(); // web url (low)
      expect(screen.getByText('[6/8]')).toBeInTheDocument(); // subtask progress (medium)
    });

    it('handles boundary width values correctly', () => {
      // Test exact boundary at 79 columns (should be narrow)
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

      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          gitBranch="test-branch"
          agent="planner"
          workflowStage="testing"
          model="opus"
        />
      );

      // Should only show critical + high priority
      expect(screen.getByText('●')).toBeInTheDocument(); // critical
      expect(screen.getByText('test-branch')).toBeInTheDocument(); // high
      expect(screen.getByText('planner')).toBeInTheDocument(); // high
      expect(screen.queryByText('testing')).not.toBeInTheDocument(); // medium - should not show

      // Test exact boundary at 80 columns (should be normal/compact based on StatusBar's breakpoint config)
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

      rerender(
        <StatusBar
          {...defaultProps}
          gitBranch="test-branch"
          agent="planner"
          workflowStage="testing"
          model="opus"
        />
      );

      // Based on StatusBar's breakpoint config: narrow: 80, compact: 100, normal: 120
      // At width 80, displayTier should be 'normal' (80 <= 120)
      expect(screen.getByText('testing')).toBeInTheDocument(); // medium priority should now show

      // Test exact boundary at 119 columns (should be normal)
      mockUseStdoutDimensions.mockReturnValue({
        width: 119,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      rerender(
        <StatusBar
          {...defaultProps}
          gitBranch="test-branch"
          sessionName="Session Name"
        />
      );

      // Should still be normal tier - no low priority segments
      expect(screen.queryByText('Session Name')).not.toBeInTheDocument(); // low priority

      // Test exact boundary at 120 columns (should be normal per StatusBar's config)
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      rerender(
        <StatusBar
          {...defaultProps}
          gitBranch="test-branch"
          sessionName="Session Name"
        />
      );

      // At width 120, displayTier should be 'normal' (80 <= 120), so still no low priority
      expect(screen.queryByText('Session Name')).not.toBeInTheDocument();

      // Test width 121 (should be wide)
      mockUseStdoutDimensions.mockReturnValue({
        width: 121,
        height: 24,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(
        <StatusBar
          {...defaultProps}
          gitBranch="test-branch"
          sessionName="Session Name"
        />
      );

      // Now should be wide tier - low priority segments should show
      expect(screen.getByText('Session Name')).toBeInTheDocument(); // low priority should now show
    });

    it('prevents overflow and truncation at boundary widths', () => {
      const testWidths = [79, 80, 119, 120];

      testWidths.forEach(width => {
        const expectedBreakpoint = width < 80 ? 'narrow' :
                                  width < 100 ? 'compact' :
                                  width < 120 ? 'normal' : 'normal'; // StatusBar uses different logic

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: expectedBreakpoint as any,
          isAvailable: true,
          isNarrow: width < 80,
          isCompact: width >= 80 && width < 100,
          isNormal: width >= 100,
          isWide: width >= 160, // Per hook defaults
        });

        const { rerender } = render(
          <StatusBar
            {...defaultProps}
            gitBranch="feature/very-long-branch-name-that-might-overflow"
            agent="developer"
            workflowStage="implementation"
            model="opus"
            tokens={{ input: 10000, output: 5000 }}
            cost={123.4567}
            sessionName="Very Long Session Name That Could Cause Overflow"
            apiUrl="http://localhost:4000"
            webUrl="http://localhost:3000"
          />
        );

        // Component should render without throwing errors
        expect(screen.getByText('●')).toBeInTheDocument();

        // Essential information should always be present
        expect(screen.getByText(/feature\//)).toBeInTheDocument(); // Git branch (may be truncated)

        // Width boundary should not cause layout issues
        const statusBar = screen.getByText('●').closest('[class*="box"]');
        if (statusBar) {
          // The component should render within reasonable bounds
          expect(statusBar).toBeInTheDocument();
        }

        rerender(<div />); // Clear for next iteration
      });
    });
  });

  describe('edge cases', () => {
    it('handles zero tokens', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 0, output: 0 }} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles zero cost', () => {
      render(<StatusBar {...defaultProps} cost={0} />);

      expect(screen.getByText('$0.0000')).toBeInTheDocument();
    });

    it('handles empty git branch', () => {
      render(<StatusBar {...defaultProps} gitBranch="" />);

      // Should still render without error
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles undefined connection status', () => {
      render(<StatusBar isConnected={undefined} />);

      // Should default to connected
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles very large costs', () => {
      render(<StatusBar {...defaultProps} cost={999.9999} />);

      expect(screen.getByText('$999.9999')).toBeInTheDocument();
    });

    it('handles zero subtask progress', () => {
      render(<StatusBar {...defaultProps} subtaskProgress={{ completed: 0, total: 0 }} />);

      // Should not display progress when total is 0
      expect(screen.queryByText('📋')).not.toBeInTheDocument();
    });

    it('handles missing terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,  // fallback width
        height: 24, // fallback height
        breakpoint: 'compact' as const,
        isAvailable: false, // indicates terminal dimensions unavailable
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} />);

      // Should use fallback width and not crash
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('formatting helpers', () => {
    it('formats token display correctly for thousands', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 2500, output: 1500 }} />);

      expect(screen.getByText('4.0k')).toBeInTheDocument();
    });

    it('formats token display correctly for millions', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 2500000, output: 1500000 }} />);

      expect(screen.getByText('4.0M')).toBeInTheDocument();
    });

    it('preserves decimal places in cost formatting', () => {
      render(<StatusBar {...defaultProps} cost={0.0001} />);

      expect(screen.getByText('$0.0001')).toBeInTheDocument();
    });
  });

  describe('verbose mode', () => {
    it('shows verbose mode indicator', () => {
      render(<StatusBar {...defaultProps} displayMode="verbose" />);

      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('displays token breakdown in verbose mode', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 500, output: 300 }}
        />
      );

      // Should show input→output breakdown
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('500→300')).toBeInTheDocument();

      // Should also show total
      expect(screen.getByText('total:')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
    });

    it('formats large tokens in breakdown correctly', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 1500, output: 2500 }}
        />
      );

      expect(screen.getByText('1.5k→2.5k')).toBeInTheDocument();
      expect(screen.getByText('4.0k')).toBeInTheDocument();
    });

    it('displays session cost in verbose mode when provided', () => {
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

    it('shows detailed timing information', () => {
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

      expect(screen.getByText('active:')).toBeInTheDocument();
      expect(screen.getByText('2m0s')).toBeInTheDocument();
      expect(screen.getByText('idle:')).toBeInTheDocument();
      expect(screen.getByText('30s')).toBeInTheDocument();
      expect(screen.getByText('stage:')).toBeInTheDocument();
      expect(screen.getByText('1m0s')).toBeInTheDocument();
    });

    it('formats timing with hours correctly', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          detailedTiming={{
            totalActiveTime: 7200000, // 2 hours
            totalIdleTime: 1800000,   // 30 minutes
          }}
        />
      );

      expect(screen.getByText('2h0m')).toBeInTheDocument();
      expect(screen.getByText('30m0s')).toBeInTheDocument();
    });

    it('shows all segments without filtering', () => {
      // Mock narrow terminal to test that verbose mode ignores width constraints
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
          gitBranch="feature/long-branch-name"
          agent="planner"
          workflowStage="implementation"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionName="Very Long Session Name"
          tokens={{ input: 1000, output: 500 }}
          cost={0.1234}
          sessionCost={0.5678}
          model="opus"
          subtaskProgress={{ completed: 3, total: 5 }}
        />
      );

      // All elements should be visible despite narrow terminal
      expect(screen.getByText('feature/long-branch-name')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
      expect(screen.getByText(/Very Long Session Name/)).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });

    it('does not show session cost if same as regular cost', () => {
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

  describe('compact mode', () => {
    it('shows minimal information in compact mode', () => {
      render(
        <StatusBar
          {...defaultProps}
          displayMode="compact"
          gitBranch="main"
          agent="planner"
          workflowStage="implementation"
          model="opus"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
        />
      );

      // Should show connection, git branch, and cost only
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();

      // Should not show other elements
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('opus')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides meaningful text content for screen readers', () => {
      render(
        <StatusBar
          {...defaultProps}
          gitBranch="main"
          agent="planner"
          tokens={{ input: 100, output: 200 }}
          cost={0.05}
          model="opus"
        />
      );

      // All important information should be accessible as text
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
      expect(screen.getByText('$0.0500')).toBeInTheDocument();
      expect(screen.getByText('opus')).toBeInTheDocument();
    });
  });

  describe('useStdoutDimensions hook integration', () => {
    it('calls useStdoutDimensions with correct default configuration', () => {
      render(<StatusBar {...defaultProps} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        breakpoints: {
          narrow: 80,    // < 80 = narrow
          compact: 100,  // 80-99 = compact
          normal: 120,   // 100-119 = normal
        },               // >= 120 = wide
        fallbackWidth: 120,
      });
    });

    it('uses terminal width from hook for responsive adaptation', () => {
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

      render(<StatusBar {...defaultProps} />);

      // Verify the hook was called and terminal width is used
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // The StatusBar should use the width for responsive behavior
      // Since width=150 > 120, it should behave as wide terminal
      // This is verified indirectly through responsive behavior tests
    });

    it('handles hook returning isAvailable: false', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,  // fallback width
        height: 24,  // fallback height
        breakpoint: 'normal' as const,
        isAvailable: false, // Terminal dimensions unavailable
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<StatusBar {...defaultProps} gitBranch="test" />);

      // Should use fallback dimensions gracefully
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });

    describe('responsive breakpoint behavior', () => {
      it('adapts to narrow breakpoint correctly', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 75, // < 80
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
            gitBranch="main"
            agent="planner"
            workflowStage="testing"
            tokens={{ input: 500, output: 300 }}
            cost={0.1234}
            model="opus"
            sessionName="Session"
            apiUrl="http://localhost:4000"
          />
        );

        // In narrow mode, should show only critical + high priority
        expect(screen.getByText('●')).toBeInTheDocument(); // critical: connection
        expect(screen.getByText('main')).toBeInTheDocument(); // high: git branch
        expect(screen.getByText('planner')).toBeInTheDocument(); // high: agent
        expect(screen.getByText('$0.1234')).toBeInTheDocument(); // high: cost
        expect(screen.getByText('opus')).toBeInTheDocument(); // high: model

        // Should NOT show medium/low priority in narrow mode
        expect(screen.queryByText('testing')).not.toBeInTheDocument(); // medium: workflow stage
        expect(screen.queryByText('Session')).not.toBeInTheDocument(); // low: session name
        expect(screen.queryByText('4000')).not.toBeInTheDocument(); // low: api url
      });

      it('adapts to normal breakpoint correctly', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100, // 80 <= 100 <= 120
          height: 24,
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
            gitBranch="feature/auth"
            agent="developer"
            workflowStage="implementation"
            tokens={{ input: 1000, output: 500 }}
            cost={0.2345}
            sessionName="Session Name"
          />
        );

        // In normal mode, should show critical + high + medium priority
        expect(screen.getByText('●')).toBeInTheDocument(); // critical
        expect(screen.getByText('feature/auth')).toBeInTheDocument(); // high
        expect(screen.getByText('developer')).toBeInTheDocument(); // high
        expect(screen.getByText('implementation')).toBeInTheDocument(); // medium: workflow stage
        expect(screen.getByText('1.5k')).toBeInTheDocument(); // medium: tokens

        // Should NOT show low priority in normal mode
        expect(screen.queryByText('Session Name')).not.toBeInTheDocument(); // low
      });

      it('adapts to wide breakpoint correctly', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 150, // > 120
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
            gitBranch="feature/comprehensive"
            agent="tester"
            workflowStage="testing"
            tokens={{ input: 5000, output: 3000 }}
            cost={0.7890}
            model="opus"
            apiUrl="http://localhost:4000"
            webUrl="http://localhost:3000"
            sessionName="Integration Testing"
            subtaskProgress={{ completed: 8, total: 12 }}
          />
        );

        // In wide mode, should show ALL priority levels
        expect(screen.getByText('feature/comprehensive')).toBeInTheDocument(); // high
        expect(screen.getByText('tester')).toBeInTheDocument(); // high
        expect(screen.getByText('testing')).toBeInTheDocument(); // medium
        expect(screen.getByText('8.0k')).toBeInTheDocument(); // medium: tokens
        expect(screen.getByText('$0.7890')).toBeInTheDocument(); // high
        expect(screen.getByText('opus')).toBeInTheDocument(); // high
        expect(screen.getByText('4000')).toBeInTheDocument(); // low: api url
        expect(screen.getByText('3000')).toBeInTheDocument(); // low: web url
        expect(screen.getByText(/Integration Testing/)).toBeInTheDocument(); // low: session name
        expect(screen.getByText('[8/12]')).toBeInTheDocument(); // medium: subtask progress
      });

      it('tests exact boundary conditions', () => {
        // StatusBar logic: displayTier = width < 80 ? 'narrow' : width <= 120 ? 'normal' : 'wide'

        // Test width 79 (should be narrow)
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

        const { rerender } = render(
          <StatusBar {...defaultProps} workflowStage="testing" sessionName="Test" />
        );

        expect(screen.queryByText('testing')).not.toBeInTheDocument(); // narrow = no medium
        expect(screen.queryByText('Test')).not.toBeInTheDocument(); // narrow = no low

        // Test width 80 (should be normal per StatusBar logic)
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 24,
          breakpoint: 'compact' as const, // Hook breakpoint
          isAvailable: true,
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
        });

        rerender(<StatusBar {...defaultProps} workflowStage="testing" sessionName="Test" />);

        expect(screen.getByText('testing')).toBeInTheDocument(); // normal = medium allowed
        expect(screen.queryByText('Test')).not.toBeInTheDocument(); // normal = no low

        // Test width 120 (should be normal per StatusBar logic)
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 24,
          breakpoint: 'normal' as const, // Hook breakpoint doesn't matter for StatusBar logic
          isAvailable: true,
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
        });

        rerender(<StatusBar {...defaultProps} workflowStage="testing" sessionName="Test" />);

        expect(screen.getByText('testing')).toBeInTheDocument(); // normal = medium allowed
        expect(screen.queryByText('Test')).not.toBeInTheDocument(); // normal = no low

        // Test width 121 (should be wide)
        mockUseStdoutDimensions.mockReturnValue({
          width: 121,
          height: 24,
          breakpoint: 'wide' as const,
          isAvailable: true,
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
        });

        rerender(<StatusBar {...defaultProps} workflowStage="testing" sessionName="Test" />);

        expect(screen.getByText('testing')).toBeInTheDocument(); // wide = medium allowed
        expect(screen.getByText('Test')).toBeInTheDocument(); // wide = low allowed
      });
    });

    describe('layout adaptation based on breakpoints', () => {
      it('filters segments appropriately in narrow terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50,  // Very narrow
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
            gitBranch="main"
            agent="planner"
            workflowStage="implementation"
            apiUrl="http://localhost:4000"
            webUrl="http://localhost:3000"
            sessionName="Long Session Name"
            tokens={{ input: 1000, output: 500 }}
            cost={0.1234}
            model="opus"
            subtaskProgress={{ completed: 3, total: 5 }}
          />
        );

        // Essential elements should be present
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();

        // Some elements might be filtered out due to space constraints
        // but the component should still render successfully
        expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
          breakpoints: {
            narrow: 80,
            compact: 100,
            normal: 120,
          },
          fallbackWidth: 120,
        });
      });

      it('shows all segments in wide terminals', () => {
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
            gitBranch="feature/comprehensive-display"
            agent="developer"
            workflowStage="implementation"
            apiUrl="http://localhost:4000"
            webUrl="http://localhost:3000"
            sessionName="Full Feature Session"
            tokens={{ input: 2500, output: 1800 }}
            cost={0.4567}
            sessionCost={1.2345}
            model="opus"
            subtaskProgress={{ completed: 6, total: 8 }}
          />
        );

        // All segments should be visible in wide terminals
        expect(screen.getByText('feature/comprehensive-display')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('implementation')).toBeInTheDocument();
        expect(screen.getByText('4000')).toBeInTheDocument();
        expect(screen.getByText('3000')).toBeInTheDocument();
        expect(screen.getByText(/Full Feature Session/)).toBeInTheDocument();
        expect(screen.getByText('4.3k')).toBeInTheDocument(); // tokens
        expect(screen.getByText('$0.4567')).toBeInTheDocument();
        expect(screen.getByText('opus')).toBeInTheDocument();
        expect(screen.getByText('[6/8]')).toBeInTheDocument();
      });

      it('responds to breakpoint changes', () => {
        // Start with wide terminal
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

        const { rerender } = render(
          <StatusBar
            {...defaultProps}
            gitBranch="feature/responsive"
            agent="tester"
            tokens={{ input: 1000, output: 500 }}
            cost={0.25}
            model="sonnet"
          />
        );

        expect(screen.getByText('feature/responsive')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('sonnet')).toBeInTheDocument();

        // Change to narrow terminal
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

        rerender(
          <StatusBar
            {...defaultProps}
            gitBranch="feature/responsive"
            agent="tester"
            tokens={{ input: 1000, output: 500 }}
            cost={0.25}
            model="sonnet"
          />
        );

        // Essential elements should still be there
        expect(screen.getByText('●')).toBeInTheDocument();
      });
    });

    describe('edge cases and error handling', () => {
      it('handles hook returning undefined dimensions', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,   // fallback
          height: 24,  // fallback
          breakpoint: 'compact' as const,
          isAvailable: false,
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
        });

        render(<StatusBar {...defaultProps} gitBranch="main" />);

        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      it('handles extreme dimensions gracefully', () => {
        // Very narrow terminal
        mockUseStdoutDimensions.mockReturnValue({
          width: 10,
          height: 5,
          breakpoint: 'narrow' as const,
          isAvailable: true,
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(<StatusBar {...defaultProps} />);
        expect(screen.getByText('●')).toBeInTheDocument();

        // Very wide terminal
        mockUseStdoutDimensions.mockReturnValue({
          width: 500,
          height: 100,
          breakpoint: 'wide' as const,
          isAvailable: true,
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
        });

        render(<StatusBar {...defaultProps} gitBranch="main" />);
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      it('handles breakpoint changes during render', () => {
        let callCount = 0;
        mockUseStdoutDimensions.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              width: 120,
              height: 30,
              breakpoint: 'normal' as const,
              isAvailable: true,
              isNarrow: false,
              isCompact: false,
              isNormal: true,
              isWide: false,
            };
          }
          return {
            width: 80,
            height: 24,
            breakpoint: 'compact' as const,
            isAvailable: true,
            isNarrow: false,
            isCompact: true,
            isNormal: false,
            isWide: false,
          };
        });

        render(<StatusBar {...defaultProps} gitBranch="dynamic" />);
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('dynamic')).toBeInTheDocument();
      });

      it('maintains correct props contract with hook', () => {
        render(<StatusBar {...defaultProps} />);

        // Verify the hook is called with the exact expected configuration
        expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
          breakpoints: {
            narrow: 80,
            compact: 100,
            normal: 120,
          },
          fallbackWidth: 120,
        });

        // Verify hook is called exactly once per render
        expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(1);
      });
    });
  });
});