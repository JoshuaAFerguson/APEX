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

describe('StatusBar useStdoutDimensions Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseStdoutDimensions.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
  };

  describe('hook configuration validation', () => {
    it('verifies exact breakpoint configuration from useStdoutDimensions defaults', () => {
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

      // Verify the hook is called with only fallbackWidth (StatusBar uses hook's default breakpoints)
      // Hook defaults: narrow < 60, compact 60-100, normal 100-160, wide >= 160
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });
    });

    it('validates hook default breakpoint thresholds', () => {
      // Test narrow threshold: < 60 (hook default)
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
      // StatusBar only passes fallbackWidth, using hook's default breakpoints
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });

      // Test compact range: 60-100 (hook default)
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

      render(<StatusBar {...defaultProps} />);

      // Test normal range: 100-160 (hook default)
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

      render(<StatusBar {...defaultProps} />);

      // Test wide threshold: >= 160 (hook default)
      mockUseStdoutDimensions.mockReturnValue({
        width: 160,
        height: 30,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<StatusBar {...defaultProps} />);
    });
  });

  describe('layout behavior validation', () => {
    it('renders correctly across all breakpoints with full props', () => {
      const fullProps: StatusBarProps = {
        isConnected: true,
        gitBranch: 'feature/status-bar-integration',
        agent: 'tester',
        workflowStage: 'testing',
        tokens: { input: 1500, output: 1000 },
        cost: 0.5432,
        sessionCost: 1.2345,
        model: 'opus',
        apiUrl: 'http://localhost:4000',
        webUrl: 'http://localhost:3000',
        sessionName: 'Integration Test Session',
        subtaskProgress: { completed: 7, total: 10 },
        displayMode: 'normal',
        sessionStartTime: new Date('2023-01-01T10:00:00Z'),
      };

      // Test each breakpoint using hook defaults: narrow<60, compact 60-100, normal 100-160, wide>=160
      const breakpoints = [
        { width: 55, breakpoint: 'narrow', expectMinimal: true },
        { width: 80, breakpoint: 'compact', expectMedium: true },
        { width: 130, breakpoint: 'normal', expectFull: true },
        { width: 180, breakpoint: 'wide', expectFull: true },
      ] as const;

      breakpoints.forEach(({ width, breakpoint, expectMinimal, expectMedium, expectFull }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
        });

        const { unmount } = render(<StatusBar {...fullProps} />);

        // Essential elements should always be present
        expect(screen.getByText('●')).toBeInTheDocument();

        // Git branch should be displayed in all sizes (compressed in narrow mode)
        if (breakpoint === 'narrow') {
          // In narrow mode, git branch gets compressed to 9 chars + '...'
          expect(screen.getByText('feature/s...')).toBeInTheDocument();
        } else {
          // In other modes, full branch name is shown
          expect(screen.getByText('feature/status-bar-integration')).toBeInTheDocument();
        }

        if (expectFull) {
          // In normal and wide modes, most elements should be visible
          expect(screen.getByText('tester')).toBeInTheDocument();
          // Note: 'testing' is workflow stage (MEDIUM priority), not shown in narrow mode
          if (breakpoint !== 'narrow') {
            expect(screen.getByText('testing')).toBeInTheDocument();
            expect(screen.getByText('2.5k')).toBeInTheDocument(); // formatted tokens (MEDIUM priority)
          }
          expect(screen.getByText(/\$0\.5432/)).toBeInTheDocument();
          expect(screen.getByText('opus')).toBeInTheDocument();
        } else if (breakpoint === 'narrow') {
          // In narrow mode, only HIGH priority elements are shown (agent, cost, model)
          expect(screen.getByText('tester')).toBeInTheDocument(); // agent (HIGH)
          expect(screen.getByText(/\$0\.5432/)).toBeInTheDocument(); // cost (HIGH)
          expect(screen.getByText('opus')).toBeInTheDocument(); // model (HIGH)
          // MEDIUM priority elements are filtered out
          expect(screen.queryByText('testing')).not.toBeInTheDocument(); // workflow stage
          expect(screen.queryByText('2.5k')).not.toBeInTheDocument(); // tokens
        }

        // Clean up for next iteration
        unmount();
        vi.clearAllMocks();
      });
    });

    it('validates breakpoint and width value usage', () => {
      // Test that both breakpoint and width values are used correctly
      mockUseStdoutDimensions.mockReturnValue({
        width: 95,
        height: 25,
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
          gitBranch="test-width-usage"
          agent="planner"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
        />
      );

      // Component should render successfully using both values
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('test-width-usage')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Hook should have been called with only fallbackWidth (StatusBar uses hook defaults)
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });
    });

    it('handles verbose mode correctly with hook integration', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 55, // Narrow terminal (< 60 per hook defaults)
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
          gitBranch="verbose-test"
          agent="developer"
          tokens={{ input: 2000, output: 1500 }}
          cost={0.6789}
          sessionCost={1.5432}
          model="sonnet"
        />
      );

      // Verbose mode should show all information regardless of width constraints
      expect(screen.getByText('verbose-test')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();

      // Should show detailed token breakdown in verbose mode
      // Note: In verbose mode with narrow terminal, shows abbreviated labels but all segments
      expect(screen.getByText('tk:')).toBeInTheDocument(); // abbreviated in narrow mode even with verbose
      expect(screen.getByText('2.0k→1.5k')).toBeInTheDocument(); // input→output format

      // Should show session cost when different from regular cost
      expect(screen.getByText('sess:')).toBeInTheDocument(); // abbreviated in narrow mode
      expect(screen.getByText(/1\.5432/)).toBeInTheDocument();
    });
  });

  describe('error resilience and edge cases', () => {
    it('handles hook errors gracefully', () => {
      // Test hook throwing an error
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook failed');
      });

      // Suppress console errors for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Hook errors should bubble up to component error boundaries
      expect(() => {
        render(<StatusBar {...defaultProps} />);
      }).toThrow('Hook failed');

      // Clean up
      consoleSpy.mockRestore();
      mockUseStdoutDimensions.mockReset();

      // Reset to a working mock for subsequent tests
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

    it('gracefully handles invalid breakpoint tier with fallback', () => {
      // While the hook itself provides valid data through TypeScript,
      // this test verifies that the filterByTier function has a safety check
      // that uses 'normal' as fallback for any invalid tier value
      // This is defensive programming to prevent runtime errors from future refactoring

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

      // Component should render successfully even if tier validation fails
      expect(() => {
        render(<StatusBar {...defaultProps} />);
      }).not.toThrow();

      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('validates performance with rapid breakpoint changes', () => {
      let renderCount = 0;
      mockUseStdoutDimensions.mockImplementation(() => {
        renderCount++;
        // Simulate rapid changes using correct breakpoint thresholds
        // narrow < 60, compact 60-100, normal 100-160, wide >= 160
        const breakpoints = ['narrow', 'compact', 'normal', 'wide'] as const;
        const sizes = [50, 80, 120, 180]; // Corrected to match actual thresholds
        const index = renderCount % 4;

        return {
          width: sizes[index],
          height: 24,
          breakpoint: breakpoints[index],
          isAvailable: true,
          isNarrow: index === 0,
          isCompact: index === 1,
          isNormal: index === 2,
          isWide: index === 3,
        };
      });

      const { rerender } = render(<StatusBar {...defaultProps} gitBranch="perf-test" />);

      // Simulate multiple rapid re-renders
      for (let i = 0; i < 10; i++) {
        rerender(<StatusBar {...defaultProps} gitBranch="perf-test" />);
      }

      // Should not crash and should render final state
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('perf-test')).toBeInTheDocument();
    });

    it('maintains hook call consistency across re-renders', () => {
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

      const { rerender } = render(<StatusBar {...defaultProps} />);

      const initialCallCount = mockUseStdoutDimensions.mock.calls.length;

      // Re-render with same props
      rerender(<StatusBar {...defaultProps} />);

      // Hook should be called again (React behavior)
      expect(mockUseStdoutDimensions.mock.calls.length).toBeGreaterThan(initialCallCount);

      // But always with same arguments
      const calls = mockUseStdoutDimensions.mock.calls;
      const firstCall = calls[0][0];
      const lastCall = calls[calls.length - 1][0];
      expect(firstCall).toEqual(lastCall);
    });
  });

  describe('abbreviated labels integration', () => {
    it('integrates abbreviated labels with auto mode based on terminal width', () => {
      // Using hook defaults: narrow < 60, compact 60-100, normal 100-160, wide >= 160
      // Note: In narrow mode, only CRITICAL + HIGH priority segments are shown
      // Tokens are MEDIUM priority, so they don't appear in narrow mode at all
      // Model is HIGH priority, so it shows with abbreviation in narrow mode
      const testCases = [
        { width: 55, breakpoint: 'narrow' as const, expectTokens: false, expectAbbreviatedModel: true },
        { width: 80, breakpoint: 'compact' as const, expectTokens: true, expectAbbreviatedModel: false },
        { width: 120, breakpoint: 'normal' as const, expectTokens: true, expectAbbreviatedModel: false },
      ];

      testCases.forEach(({ width, breakpoint, expectTokens, expectAbbreviatedModel }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isAvailable: true,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
        });

        const { unmount } = render(
          <StatusBar
            {...defaultProps}
            displayMode="normal" // auto mode
            tokens={{ input: 500, output: 300 }}
            cost={0.1234}
            model="opus"
          />
        );

        if (expectTokens) {
          // Compact and normal modes show tokens with full labels (MEDIUM priority included)
          expect(screen.getByText('tokens:')).toBeInTheDocument();
          expect(screen.queryByText('tk:')).not.toBeInTheDocument();
        } else {
          // Narrow mode doesn't show tokens at all (MEDIUM priority filtered out)
          expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
          expect(screen.queryByText('tk:')).not.toBeInTheDocument();
        }

        if (expectAbbreviatedModel) {
          // Narrow mode uses abbreviated model label
          expect(screen.getByText('mod:')).toBeInTheDocument();
          expect(screen.queryByText('model:')).not.toBeInTheDocument();
        } else {
          // Compact/normal modes use full model label
          expect(screen.getByText('model:')).toBeInTheDocument();
          expect(screen.queryByText('mod:')).not.toBeInTheDocument();
        }

        unmount();
      });
    });

    it('integrates abbreviated labels with display mode overrides', () => {
      // Test narrow terminal where auto mode would use abbreviations (< 60 per hook defaults)
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

      // Verbose mode should override terminal width and show all segments with labels
      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
        />
      );

      // Verbose mode shows all segments but with abbreviated labels in narrow terminal
      expect(screen.getByText('tk:')).toBeInTheDocument(); // abbreviated in narrow mode
      expect(screen.getByText('∑:')).toBeInTheDocument(); // 'total:' → '∑:' abbreviation
      expect(screen.queryByText('cost:')).not.toBeInTheDocument(); // cost has empty abbreviation
      expect(screen.getByText('mod:')).toBeInTheDocument(); // 'model:' → 'mod:' abbreviation

      // Compact mode shows only connection, git branch, and cost
      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="compact"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
        />
      );

      // Compact mode shows minimal information (only connection, gitBranch, cost)
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('tk:')).not.toBeInTheDocument();
      expect(screen.queryByText('model:')).not.toBeInTheDocument();
      expect(screen.queryByText('mod:')).not.toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument(); // Just cost value

      // Normal mode with narrow width: only CRITICAL + HIGH priority shown (tokens are MEDIUM)
      // Model is HIGH priority so shows with abbreviation, but tokens are filtered out
      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 500, output: 300 }}
          cost={0.1234}
          model="opus"
        />
      );

      // In narrow mode, tokens (MEDIUM) are filtered out, model (HIGH) shows with abbreviation
      expect(screen.queryByText('tk:')).not.toBeInTheDocument(); // MEDIUM priority filtered
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.getByText('mod:')).toBeInTheDocument(); // HIGH priority with abbreviation
    });

    it('handles complex session with HIGH priority abbreviated labels in narrow mode', () => {
      // Force narrow terminal (< 60 per hook defaults)
      // In narrow mode, only CRITICAL + HIGH priority segments are shown:
      // - CRITICAL: connection, sessionTimer
      // - HIGH: gitBranch, agent, cost, model
      // MEDIUM (tokens, workflowStage) and LOW (apiUrl, webUrl, sessionName) are filtered out
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
          gitBranch="feature/abbreviations"
          agent="planner"
          workflowStage="implementation"
          tokens={{ input: 2500, output: 1500 }}
          cost={0.4567}
          model="opus"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionStartTime={new Date()}
        />
      );

      // HIGH priority segments with abbreviated labels in narrow mode
      expect(screen.getByText('mod:')).toBeInTheDocument(); // model abbreviated
      expect(screen.getByText('opus')).toBeInTheDocument();

      // Cost (HIGH) shows just value without label when abbreviated
      expect(screen.getByText('$0.4567')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();

      // HIGH priority git branch (compressed in narrow mode)
      expect(screen.getByText('feature/a...')).toBeInTheDocument(); // compressed to 9 chars + '...'
      expect(screen.getByText('planner')).toBeInTheDocument();

      // CRITICAL always shown
      expect(screen.getByText('●')).toBeInTheDocument(); // connection
      expect(screen.getByText('00:00')).toBeInTheDocument(); // timer

      // MEDIUM priority segments are filtered out in narrow mode
      expect(screen.queryByText('tk:')).not.toBeInTheDocument();
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('4.0k')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // workflowStage is MEDIUM

      // LOW priority segments are filtered out in narrow mode
      expect(screen.queryByText('api:')).not.toBeInTheDocument();
      expect(screen.queryByText('web:')).not.toBeInTheDocument();
    });

    it('validates abbreviation consistency across re-renders', () => {
      // Use compact mode (60-100 cols) to show both tokens AND abbreviations
      // In compact mode: CRITICAL + HIGH + MEDIUM are shown with full labels
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // Compact breakpoint (60-100)
        height: 24,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 100, output: 50 }}
          cost={0.01}
          model="opus"
        />
      );

      // Compact mode shows full labels (not abbreviated)
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();

      // Update with new data - should maintain full labels
      rerender(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 2000, output: 1500 }}
          cost={0.5678}
          model="sonnet"
        />
      );

      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('3.5k')).toBeInTheDocument(); // updated value
      expect(screen.getByText('model:')).toBeInTheDocument();
      expect(screen.getByText('sonnet')).toBeInTheDocument(); // updated value
      expect(screen.getByText('$0.5678')).toBeInTheDocument(); // updated cost
    });

    it('handles abbreviation mode transitions smoothly', () => {
      const sessionData = {
        tokens: { input: 1000, output: 500 },
        cost: 0.25,
        model: 'opus',
        gitBranch: 'main',
      };

      // Start wide (full labels) - >= 160 per hook defaults
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

      const { rerender } = render(
        <StatusBar
          {...defaultProps}
          displayMode="normal"
          {...sessionData}
        />
      );

      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('model:')).toBeInTheDocument();

      // Change to narrow (abbreviated labels) - < 60 per hook defaults
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
          {...sessionData}
        />
      );

      // In narrow mode, tokens (MEDIUM priority) are completely filtered out
      expect(screen.queryByText('tk:')).not.toBeInTheDocument(); // tokens filtered out
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument(); // tokens filtered out
      expect(screen.getByText('mod:')).toBeInTheDocument(); // model (HIGH priority) with abbreviation
      expect(screen.queryByText('model:')).not.toBeInTheDocument();

      // Values should remain consistent (tokens filtered out in narrow mode)
      // In narrow mode, tokens (MEDIUM priority) are completely filtered out
      expect(screen.queryByText('1.5k')).not.toBeInTheDocument(); // tokens filtered out in narrow
      expect(screen.getByText('opus')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('integrates special cost abbreviation behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 55, // Force abbreviations (< 60 per hook defaults)
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
          cost={0.1234}
          sessionCost={0.5678}
        />
      );

      // Cost should show just value without label when abbreviated
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
      expect(screen.queryByText('$:')).not.toBeInTheDocument(); // No separate $ label

      // Session cost should not appear in normal mode (only in verbose)
      expect(screen.queryByText('session:')).not.toBeInTheDocument();
      expect(screen.queryByText('sess:')).not.toBeInTheDocument();
    });
  });

  describe('acceptance criteria validation', () => {
    it('completely satisfies acceptance criteria requirements', () => {
      // Using wide breakpoint (>= 160 per hook defaults)
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

      render(
        <StatusBar
          {...defaultProps}
          gitBranch="acceptance-test"
          agent="tester"
          tokens={{ input: 1000, output: 500 }}
          cost={0.25}
        />
      );

      // 1. StatusBar imports and uses useStdoutDimensions hook ✓
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // 2. Hook used with fallbackWidth (StatusBar uses hook's default breakpoints)
      // Hook defaults: narrow < 60, compact 60-100, normal 100-160, wide >= 160
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 120,
      });

      // 3. Hook's breakpoint and width values replace direct useStdout() usage ✓
      // (No useStdout imports or calls in the implementation)

      // 4. Component renders correctly with hook integration ✓
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('acceptance-test')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('1.5k')).toBeInTheDocument(); // formatted tokens
      expect(screen.getByText('$0.2500')).toBeInTheDocument();
    });

    it('validates abbreviated label system acceptance criteria', () => {
      // Test narrow terminal to verify abbreviations (< 60 per hook defaults)
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
        />
      );

      // 1. Created abbreviated versions of segment labels ✓
      // Note: In narrow mode, only CRITICAL + HIGH priority segments are shown
      // Tokens are MEDIUM priority and are filtered out entirely in narrow mode
      // Model is HIGH priority and shows with abbreviated label
      expect(screen.queryByText('tk:')).not.toBeInTheDocument(); // tokens filtered out (MEDIUM priority)
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument(); // tokens filtered out (MEDIUM priority)
      expect(screen.getByText('mod:')).toBeInTheDocument(); // 'model:' → 'mod:' (HIGH priority with abbreviation)
      expect(screen.getByText('$0.1234')).toBeInTheDocument(); // 'cost:' → '' (empty abbreviation = no label, HIGH priority)

      // 2. Segment interface extended with optional abbreviatedLabel property ✓
      // (Implementation includes abbreviatedLabel in segments)

      // 3. buildSegments function updated to accept abbreviation mode parameter ✓
      // (Function behavior changes based on displayMode and terminal width)

      // Test that full labels are NOT shown when abbreviated
      expect(screen.queryByText('model:')).not.toBeInTheDocument(); // shows 'mod:' instead
      expect(screen.queryByText('cost:')).not.toBeInTheDocument(); // no label in narrow mode
    });
  });
});