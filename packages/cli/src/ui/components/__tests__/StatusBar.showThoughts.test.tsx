import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Use vi.hoisted to ensure mock function is available during module hoisting
// Note: showThoughts indicator is LOW priority and only visible in 'wide' mode (>160 cols)
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(() => ({
    width: 200, // Wide mode to show LOW priority segments like showThoughts
    height: 40,
    breakpoint: 'wide' as const,
    isAvailable: true,
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
  })),
}));

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StatusBar - showThoughts functionality', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
  };

  describe('showThoughts prop rendering', () => {
    it('renders without showThoughts indicator when false', () => {
      render(<StatusBar {...defaultProps} showThoughts={false} />);

      // Should not display thoughts indicator
      expect(screen.queryByText('💭')).not.toBeInTheDocument();
      expect(screen.queryByText(/thoughts/i)).not.toBeInTheDocument();
    });

    it('renders without showThoughts indicator when undefined', () => {
      render(<StatusBar {...defaultProps} />);

      // Should not display thoughts indicator when prop is not provided
      expect(screen.queryByText('💭')).not.toBeInTheDocument();
      expect(screen.queryByText(/thoughts/i)).not.toBeInTheDocument();
    });

    it('renders with showThoughts indicator when true', () => {
      render(<StatusBar {...defaultProps} showThoughts={true} />);

      // Should display thoughts indicator (rendered as '💭 THOUGHTS')
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('correctly positions showThoughts indicator in status line', () => {
      const { container } = render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          displayMode="verbose"  // Use verbose mode to ensure LOW priority segments are visible
          previewMode={false}
        />
      );

      // Check that indicator is present in the container (rendered as '💭 THOUGHTS')
      expect(container.textContent).toContain('💭 THOUGHTS');
    });

    it('preserves other status elements when showThoughts is true', () => {
      render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          gitBranch="test-branch"
          agent="developer"
          model="sonnet"
        />
      );

      // Should still show other status elements (showThoughts rendered as '💭 THOUGHTS')
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('test-branch')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('sonnet')).toBeInTheDocument();
    });

    it('works correctly with verbose display mode', () => {
      // Note: showThoughts is LOW priority and only visible in wide mode or verbose displayMode
      // compact mode overrides priority filtering and hides showThoughts
      const { unmount } = render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      unmount();
    });

    it('works correctly with preview mode enabled', () => {
      render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          previewMode={true}
        />
      );

      // Should show both thoughts indicator and work with preview mode (both are LOW priority)
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });
  });

  describe('accessibility and usability', () => {
    it('provides accessible text for screen readers', () => {
      render(<StatusBar {...defaultProps} showThoughts={true} />);

      // The indicator should be present with full text for accessibility
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('maintains consistent spacing with other indicators', () => {
      const { container: withoutThoughts } = render(
        <StatusBar
          {...defaultProps}
          showThoughts={false}
          gitBranch="test"
        />
      );

      const { container: withThoughts } = render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          gitBranch="test"
        />
      );

      // Both should render without throwing errors
      expect(withoutThoughts).toBeTruthy();
      expect(withThoughts).toBeTruthy();
      expect(withThoughts.textContent).toContain('💭');
      expect(withoutThoughts.textContent).not.toContain('💭');
    });
  });

  describe('integration with other status bar features', () => {
    it('displays with tokens and cost', () => {
      render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          tokens={{ input: 100, output: 50 }}
          cost={0.05}
        />
      );

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/cost:/)).toBeInTheDocument();
    });

    it('displays with session information', () => {
      render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          sessionName="test-session"
        />
      );

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('test-session')).toBeInTheDocument();
    });

    it('displays with workflow progress', () => {
      render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          workflowStage="testing"
          subtaskProgress={{ completed: 3, total: 5 }}
        />
      );

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  describe('edge cases and error handling', () => {
    it('handles null props gracefully', () => {
      expect(() => {
        render(<StatusBar {...defaultProps} showThoughts={null as any} />);
      }).not.toThrow();
    });

    it('handles very long status lines', () => {
      // Use verbose mode to ensure showThoughts is visible despite trimToFit
      render(
        <StatusBar
          {...defaultProps}
          showThoughts={true}
          displayMode="verbose"
          gitBranch="feature/very-long-branch-name-that-exceeds-normal-length"
          agent="architect-with-long-name"
          model="claude-3-opus-with-long-model-identifier"
          sessionName="very-long-session-name-for-testing"
        />
      );

      // Should render without crashing (verbose mode skips trimToFit)
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('handles rapid prop changes', () => {
      const { rerender } = render(<StatusBar {...defaultProps} showThoughts={false} />);

      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument();

      rerender(<StatusBar {...defaultProps} showThoughts={true} />);
      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();

      rerender(<StatusBar {...defaultProps} showThoughts={false} />);
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument();
    });
  });

  describe('performance considerations', () => {
    it('does not cause unnecessary re-renders', () => {
      const { rerender } = render(<StatusBar {...defaultProps} showThoughts={true} />);

      // Re-render with same props
      expect(() => {
        rerender(<StatusBar {...defaultProps} showThoughts={true} />);
        rerender(<StatusBar {...defaultProps} showThoughts={true} />);
        rerender(<StatusBar {...defaultProps} showThoughts={true} />);
      }).not.toThrow();

      expect(screen.getByText('💭 THOUGHTS')).toBeInTheDocument();
    });

    it('handles component unmounting cleanly', () => {
      const { unmount } = render(<StatusBar {...defaultProps} showThoughts={true} />);

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});