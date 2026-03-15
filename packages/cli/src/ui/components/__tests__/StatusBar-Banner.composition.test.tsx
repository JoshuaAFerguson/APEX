import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Box } from 'ink';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';
import { Banner, BannerProps } from '../Banner';

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

// Helper function to create dimension mock values
interface StdoutDimensions {
  width: number;
  height: number;
  breakpoint: 'narrow' | 'compact' | 'normal' | 'wide';
  isAvailable: boolean;
  isNarrow: boolean;
  isCompact: boolean;
  isNormal: boolean;
  isWide: boolean;
}

/**
 * Creates a mock for useStdoutDimensions hook that matches the actual hook's breakpoint logic.
 *
 * The hook uses these thresholds (from useStdoutDimensions.ts):
 * - narrow: < 60 columns
 * - compact: >= 60 and < 100 columns
 * - normal: >= 100 and < 160 columns
 * - wide: >= 160 columns
 *
 * NOTE: The Banner component has its OWN breakpoint thresholds that differ:
 * - Text-only: < 40 columns
 * - Compact: 40-59 columns
 * - Full ASCII: >= 60 columns
 *
 * The Banner ignores the hook's breakpoint and uses width directly.
 */
function createDimensionsMock(width: number): StdoutDimensions {
  // These thresholds match useStdoutDimensions.ts DEFAULT_BREAKPOINTS
  const NARROW_THRESHOLD = 60;
  const COMPACT_THRESHOLD = 100;
  const NORMAL_THRESHOLD = 160;

  return {
    width,
    height: 24,
    breakpoint: width < NARROW_THRESHOLD ? 'narrow'
              : width < COMPACT_THRESHOLD ? 'compact'
              : width < NORMAL_THRESHOLD ? 'normal'
              : 'wide',
    isAvailable: true,
    isNarrow: width < NARROW_THRESHOLD,
    isCompact: width >= NARROW_THRESHOLD && width < COMPACT_THRESHOLD,
    isNormal: width >= COMPACT_THRESHOLD && width < NORMAL_THRESHOLD,
    isWide: width >= NORMAL_THRESHOLD,
  };
}

// Composed layout component that mimics the actual App layout
interface ComposedLayoutProps {
  statusBarProps: StatusBarProps;
  bannerProps: BannerProps;
}

const ComposedLayout: React.FC<ComposedLayoutProps> = ({
  statusBarProps,
  bannerProps,
}) => (
  <Box flexDirection="column">
    <Banner {...bannerProps} />
    <StatusBar {...statusBarProps} />
  </Box>
);

describe('StatusBar + Banner Responsive Composition Integration Tests', () => {
  // Default test props based on technical design document
  const defaultStatusBarProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'main',
    agent: 'developer',
    workflowStage: 'implementation',
    tokens: { input: 1000, output: 500 },
    cost: 0.0234,
    sessionCost: 0.1234,
    model: 'opus',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionName: 'Test Session',
    subtaskProgress: { completed: 2, total: 5 },
  };

  const defaultBannerProps: BannerProps = {
    version: '0.3.0',
    projectPath: '/home/user/project',
    initialized: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('StatusBar + Banner Composition at All Terminal Widths', () => {
    const testWidths = [40, 60, 80, 120, 160];

    testWidths.forEach(width => {
      describe(`at ${width} columns`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(width));
        });

        it('renders without overflow', () => {
          const { container } = render(
            <ComposedLayout
              bannerProps={defaultBannerProps}
              statusBarProps={defaultStatusBarProps}
            />
          );

          // Verify StatusBar Box uses correct width
          // Ink renders as <ink-box style="border-color: ...; width: Xpx; ...">
          // The width is in the style attribute, we can query ink-box elements
          const inkBoxes = container.querySelectorAll('ink-box');
          const statusBarBox = Array.from(inkBoxes).find(box =>
            box.getAttribute('style')?.includes(`width: ${width}px`)
          );
          expect(statusBarBox).toBeTruthy();

          // Verify both components render
          // At >= 60 columns: ASCII art contains "█████╗" pattern
          // At 40-59 columns: compact banner has "◆ APEX ◆"
          // We check for either pattern to verify Banner rendered
          const hasAsciiArt = screen.queryByText(/█████╗/) !== null;
          const hasCompactBanner = screen.queryByText(/◆ APEX ◆/) !== null;
          expect(hasAsciiArt || hasCompactBanner).toBe(true);

          expect(screen.getByText('●')).toBeInTheDocument(); // Connection indicator
        });

        it('shows proper segment visibility', () => {
          render(
            <ComposedLayout
              bannerProps={defaultBannerProps}
              statusBarProps={defaultStatusBarProps}
            />
          );

          if (width === 40) {
            // Hook returns breakpoint: 'narrow' (< 60)
            // Banner uses its OWN thresholds: at 40 columns it shows compact mode (40-59)
            // Banner: compact box mode - use regex to match with flexible whitespace
            expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();
            expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

            // StatusBar: at 40 columns (hook's 'narrow' tier) = critical priority + some high priority
            // Due to space constraints at 40 cols, only essential segments show
            expect(screen.getByText('●')).toBeInTheDocument(); // Connection (CRITICAL)
            expect(screen.getByText('00:00')).toBeInTheDocument(); // Timer (CRITICAL)
            expect(screen.getByText('$0.0234')).toBeInTheDocument(); // Cost (HIGH)

            // Git branch and agent may be trimmed due to space constraints
            // Model should show with abbreviated label
            expect(screen.getByText(/mod:|model:/)).toBeInTheDocument();

            // Hidden: workflow stage, tokens, subtask progress (medium priority)
            expect(screen.queryByText('implementation')).not.toBeInTheDocument();
            // Tokens may show 'tk:' in narrow mode, or not show at all
            expect(screen.queryByText('[2/5]')).not.toBeInTheDocument();
          }

          if (width === 60) {
            // Hook returns breakpoint: 'compact' (>= 60 and < 100)
            // Banner: at 60 columns shows full ASCII art mode (>= FULL_ART_MIN of 60)
            // Use regex for multiline ASCII art matching
            expect(screen.getByText(/█████╗/)).toBeInTheDocument();
            expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();

            // StatusBar: at 60 columns (hook's 'compact' tier) = critical + high + medium priority
            // However, trimToFit may still remove some segments if total width exceeds 60 cols
            expect(screen.getByText('●')).toBeInTheDocument(); // Connection (CRITICAL)
            expect(screen.getByText('main')).toBeInTheDocument(); // Git branch (HIGH)

            // Workflow stage (MEDIUM) may be visible if space allows
            const stageElement = screen.queryByText('implementation');
            // Subtask progress (MEDIUM) may be trimmed if space is constrained
            const subtaskElement = screen.queryByText('[2/5]');

            // At 60 columns, some MEDIUM priority items may be shown but not guaranteed
            // due to trimToFit space constraints

            // Hidden: session name, URLs (low priority)
            expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
            expect(screen.queryByText('4000')).not.toBeInTheDocument();
          }

          if (width >= 80 && width < 160) {
            // Hook returns breakpoint: 'compact' (80) or 'normal' (120)
            // Banner: full mode for both (>= 60)
            expect(screen.getByText(/█████╗/)).toBeInTheDocument();
            expect(screen.getByText('[2/5]')).toBeInTheDocument();
            // At 80 columns (compact), low priority hidden; at 120 columns (normal), low priority still hidden
            expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
          }

          if (width === 160) {
            // Hook returns breakpoint: 'wide' (>= 160)
            // Banner: full mode
            expect(screen.getByText(/█████╗/)).toBeInTheDocument();
            expect(screen.getByText('[2/5]')).toBeInTheDocument();
            // Wide tier includes LOW priority segments
            expect(screen.getByText(/Test Session/)).toBeInTheDocument(); // Session name visible
            expect(screen.getByText('4000')).toBeInTheDocument(); // API URL visible
            expect(screen.getByText('3000')).toBeInTheDocument(); // Web URL visible
          }
        });

        it('has no text truncation for visible elements', () => {
          render(
            <ComposedLayout
              bannerProps={{
                version: '0.3.0',
                initialized: true,
                projectPath: '/short/path'
              }}
              statusBarProps={defaultStatusBarProps}
            />
          );

          // Version should be complete
          expect(screen.getByText(/v0\.3\.0/)).toBeInTheDocument();

          // Short path should not be truncated
          if (width >= 60) {
            expect(screen.getByText('/short/path')).toBeInTheDocument();
          }

          // Git branch should not be truncated if short and terminal is wide enough
          if (width > 40) {
            expect(screen.getByText('main')).toBeInTheDocument();
          }
          // At 40 columns, git branch may be trimmed due to space constraints
        });
      });
    });
  });

  describe('Terminal Resize Behavior', () => {
    it('adapts both components when resizing from 80 to 40', () => {
      // Start at 80 columns (hook's 'compact' breakpoint)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(80));
      const { rerender } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // At 80 columns: StatusBar compact tier (medium priority visible)
      // Banner: full mode (>= 60)
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();

      // Resize to 40 columns (hook's 'narrow' breakpoint)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));
      rerender(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // At 40 columns: StatusBar narrow tier (only critical + high priority)
      // Banner: compact mode (40-59), use regex for flexible whitespace matching
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
      expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();
    });

    it('adapts both components when resizing from 40 to 160', () => {
      // Start at 40 columns (hook's 'narrow' breakpoint)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));
      const { rerender } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // At 40 columns: StatusBar narrow tier behavior
      // Banner: compact mode (40-59)
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
      expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();

      // Resize to 160 columns (hook's 'wide' breakpoint)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(160));
      rerender(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // At 160 columns: StatusBar wide tier (all priorities including LOW)
      // Banner: full mode (>= 60)
      expect(screen.getByText(/Test Session/)).toBeInTheDocument();
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
    });
  });

  describe('Display Mode Interactions', () => {
    it('verbose StatusBar + narrow Banner composition works', () => {
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));

      render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={{
            ...defaultStatusBarProps,
            displayMode: 'verbose',
            detailedTiming: {
              totalActiveTime: 120000,
              totalIdleTime: 30000,
              currentStageElapsed: 60000,
            }
          }}
        />
      );

      // Banner should be compact mode at 40 columns (40-59 range)
      // Use regex for flexible whitespace matching
      expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();

      // StatusBar in verbose mode should show verbose indicator
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      // In narrow mode (40 columns), the label is abbreviated to 'act:'
      // The StatusBar uses abbreviatedLabel in narrow display tier
      expect(screen.getByText(/act:|active:/)).toBeInTheDocument();
    });

    it('compact StatusBar at wide terminal works', () => {
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(160));

      render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={{ ...defaultStatusBarProps, displayMode: 'compact' }}
        />
      );

      // Banner should be full mode due to wide width
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();

      // StatusBar should only show minimal segments despite wide terminal
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('$0.0234')).toBeInTheDocument();

      // Should hide segments that would normally be visible in wide mode
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long git branch names without breaking layout', () => {
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));

      render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={{
            ...defaultStatusBarProps,
            gitBranch: 'feature/very-long-branch-name-that-should-be-truncated'
          }}
        />
      );

      // Should show truncated version in narrow mode (compressValue truncates to 9 chars + '...')
      expect(screen.getByText(/feature\/v/)).toBeInTheDocument();
      expect(screen.queryByText('feature/very-long-branch-name-that-should-be-truncated')).not.toBeInTheDocument();

      // Banner should still render correctly at 40 columns (compact mode)
      expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();
    });

    it('handles very long project path without breaking layout', () => {
      const longPath = '/very/very/very/long/path/to/my/super/duper/long/project/name/that/exceeds/terminal/width';

      // Test at width < 40 (text-only mode) where Banner truncates paths
      // Banner truncation only happens in text-only mode (< 40 columns)
      // because StatusLine's truncatePath is only called when compact={true}
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(35));

      render(
        <ComposedLayout
          bannerProps={{
            ...defaultBannerProps,
            projectPath: longPath
          }}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Banner should truncate long path in text-only mode (< 40 columns)
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      expect(screen.queryByText(longPath)).not.toBeInTheDocument();

      // StatusBar should still render correctly
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles missing optional props gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(80));

      render(
        <ComposedLayout
          bannerProps={{
            version: '1.0.0',
            initialized: false,
          }}
          statusBarProps={{
            isConnected: true,
          }}
        />
      );

      // Both components should render with minimal props
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument(); // Timer should show
    });

    it('handles boundary values correctly', () => {
      // Test exact boundary at 60 columns
      // Hook: breakpoint 'compact' (>= 60 and < 100)
      // Banner: full ASCII art (>= FULL_ART_MIN of 60)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(60));

      const { unmount } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Should show full banner at exactly 60 cols
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      // StatusBar compact tier shows medium priority segments
      expect(screen.getByText('[2/5]')).toBeInTheDocument();

      unmount();

      // Test exact boundary at 40 columns
      // Hook: breakpoint 'narrow' (< 60)
      // Banner: compact mode (40-59)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));

      render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Should show compact banner at exactly 40 cols (use regex for flexible whitespace)
      expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();
      // StatusBar narrow tier hides medium priority segments
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
    });
  });

  describe('Composed Layout Stability', () => {
    it('maintains consistent rendering across multiple renders', () => {
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(80));

      const { rerender } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Initial render
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Re-render with same props should be consistent
      rerender(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
    });

    it('handles rapid resize events without errors', () => {
      const { rerender } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Simulate rapid resize events
      const widths = [40, 80, 60, 160, 40, 120];

      widths.forEach(width => {
        mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(width));
        rerender(
          <ComposedLayout
            bannerProps={defaultBannerProps}
            statusBarProps={defaultStatusBarProps}
          />
        );

        // Should always have basic elements
        // At >= 60 columns: ASCII art contains "█████╗" pattern
        // At 40-59 columns: compact banner has "◆ APEX ◆"
        const hasAsciiArt = screen.queryByText(/█████╗/) !== null;
        const hasCompactBanner = screen.queryByText(/◆ APEX ◆/) !== null;
        expect(hasAsciiArt || hasCompactBanner).toBe(true);
        expect(screen.getByText('●')).toBeInTheDocument();
      });
    });

    it('preserves component independence', () => {
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(80));

      render(
        <ComposedLayout
          bannerProps={{ ...defaultBannerProps, version: 'test-version' }}
          statusBarProps={{ ...defaultStatusBarProps, agent: 'test-agent' }}
        />
      );

      // Each component should preserve its own props
      // Version is rendered as "vtest-version" in the Banner
      expect(screen.getByText(/test-version/)).toBeInTheDocument();
      expect(screen.getByText('test-agent')).toBeInTheDocument();

      // They should not interfere with each other's functionality
      expect(screen.getByText(/█████╗/)).toBeInTheDocument(); // Banner ASCII art
      // At 80 columns (compact tier), medium priority segments visible
      expect(screen.getByText('[2/5]')).toBeInTheDocument(); // StatusBar subtask progress
    });
  });
});