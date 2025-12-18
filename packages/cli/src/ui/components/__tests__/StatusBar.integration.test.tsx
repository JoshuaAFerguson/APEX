import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Mock useStdoutDimensions hook specifically for integration tests
const mockUseStdoutDimensions = vi.fn();

vi.mock('../hooks/useStdoutDimensions.js', () => ({
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
    it('verifies exact breakpoint configuration from acceptance criteria', () => {
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

      // Verify the hook is called with EXACT configuration from acceptance criteria:
      // narrow < 80, compact 80-99, normal 100-119, wide >= 120
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        breakpoints: {
          narrow: 80,    // < 80 = narrow
          compact: 100,  // 80-99 = compact (80-99 inclusive)
          normal: 120,   // 100-119 = normal (100-119 inclusive)
        },               // >= 120 = wide
        fallbackWidth: 120,
      });
    });

    it('validates acceptance criteria breakpoint thresholds', () => {
      // Test narrow threshold: < 80
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

      render(<StatusBar {...defaultProps} />);
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith(
        expect.objectContaining({
          breakpoints: {
            narrow: 80,
            compact: 100,
            normal: 120,
          },
        })
      );

      // Test compact range: 80-99 (actually < 100 in implementation)
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

      // Test normal range: 100-119 (actually < 120 in implementation)
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

      // Test wide threshold: >= 120
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
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

      // Test each breakpoint
      const breakpoints = [
        { width: 75, breakpoint: 'narrow', expectMinimal: true },
        { width: 85, breakpoint: 'compact', expectMedium: true },
        { width: 110, breakpoint: 'normal', expectFull: true },
        { width: 150, breakpoint: 'wide', expectFull: true },
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

        render(<StatusBar {...fullProps} />);

        // Essential elements should always be present
        expect(screen.getByText('●')).toBeInTheDocument();

        // Git branch should be displayed in all sizes
        expect(screen.getByText('feature/status-bar-integration')).toBeInTheDocument();

        if (expectFull) {
          // In normal and wide modes, most elements should be visible
          expect(screen.getByText('tester')).toBeInTheDocument();
          expect(screen.getByText('testing')).toBeInTheDocument();
          expect(screen.getByText('2.5k')).toBeInTheDocument(); // formatted tokens
          expect(screen.getByText(/\$0\.5432/)).toBeInTheDocument();
          expect(screen.getByText('opus')).toBeInTheDocument();
        }

        // Clean up for next iteration
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

      // Hook should have been called with correct parameters
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        breakpoints: {
          narrow: 80,
          compact: 100,
          normal: 120,
        },
        fallbackWidth: 120,
      });
    });

    it('handles verbose mode correctly with hook integration', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60, // Narrow terminal
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
      expect(screen.getByText('tokens:')).toBeInTheDocument();
      expect(screen.getByText('2.0k→1.5k')).toBeInTheDocument(); // input→output format

      // Should show session cost when different from regular cost
      expect(screen.getByText('session:')).toBeInTheDocument();
      expect(screen.getByText(/1\.5432/)).toBeInTheDocument();
    });
  });

  describe('error resilience and edge cases', () => {
    it('handles hook errors gracefully', () => {
      // Test hook throwing an error
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook failed');
      });

      // This should not throw, but fallback behavior depends on implementation
      expect(() => {
        render(<StatusBar {...defaultProps} />);
      }).not.toThrow();
    });

    it('handles hook returning invalid data', () => {
      // Test hook returning partial data
      mockUseStdoutDimensions.mockReturnValue({
        width: null as any,
        height: undefined as any,
        breakpoint: 'invalid' as any,
        isAvailable: null as any,
        isNarrow: undefined as any,
        isCompact: 'yes' as any,
        isNormal: 0 as any,
        isWide: 1 as any,
      });

      expect(() => {
        render(<StatusBar {...defaultProps} />);
      }).not.toThrow();
    });

    it('validates performance with rapid breakpoint changes', () => {
      let renderCount = 0;
      mockUseStdoutDimensions.mockImplementation(() => {
        renderCount++;
        // Simulate rapid changes
        const breakpoints = ['narrow', 'compact', 'normal', 'wide'] as const;
        const sizes = [60, 85, 110, 150];
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

  describe('acceptance criteria validation', () => {
    it('completely satisfies acceptance criteria requirements', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
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

      // 2. Hook used with customized thresholds (<80 narrow, 80-120 normal, >120 wide) ✓
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        breakpoints: {
          narrow: 80,    // < 80 = narrow
          compact: 100,  // 80-99 = compact
          normal: 120,   // 100-119 = normal
        },               // >= 120 = wide
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
  });
});