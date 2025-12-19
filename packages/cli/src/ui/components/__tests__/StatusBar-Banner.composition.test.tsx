import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Box } from 'ink';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';
import { Banner, BannerProps } from '../Banner';

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

function createDimensionsMock(width: number): StdoutDimensions {
  return {
    width,
    height: 24,
    breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
    isAvailable: true,
    isNarrow: width < 60,
    isCompact: width >= 60 && width < 100,
    isNormal: width >= 100 && width < 160,
    isWide: width >= 160,
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
          const statusBarBox = container.querySelector('[borderStyle="single"]');
          expect(statusBarBox).toHaveAttribute('width', width.toString());

          // Verify both components render
          expect(screen.getByText(/APEX/)).toBeInTheDocument();
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
            // Narrow tier + compact banner
            // Banner: compact box mode
            expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
            expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

            // StatusBar: critical + high priority only
            expect(screen.getByText('●')).toBeInTheDocument(); // Connection
            expect(screen.getByText('main')).toBeInTheDocument(); // Git branch
            expect(screen.getByText('developer')).toBeInTheDocument(); // Agent
            expect(screen.getByText('$0.0234')).toBeInTheDocument(); // Cost

            // Hidden: workflow stage, tokens, subtask progress
            expect(screen.queryByText('implementation')).not.toBeInTheDocument();
            expect(screen.queryByText(/tk:/)).not.toBeInTheDocument();
            expect(screen.queryByText('[2/5]')).not.toBeInTheDocument();
          }

          if (width === 60) {
            // Normal tier + full banner
            // Banner: full ASCII art mode
            expect(screen.getByText(/█████╗ ██████╗ ███████╗██╗  ██╗/)).toBeInTheDocument();
            expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();

            // StatusBar: critical + high + medium priority
            expect(screen.getByText('●')).toBeInTheDocument();
            expect(screen.getByText('main')).toBeInTheDocument();
            expect(screen.getByText('developer')).toBeInTheDocument();
            expect(screen.getByText('implementation')).toBeInTheDocument(); // Medium priority visible
            expect(screen.getByText('[2/5]')).toBeInTheDocument(); // Subtask progress

            // Hidden: session name, URLs (low priority)
            expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
            expect(screen.queryByText('4000')).not.toBeInTheDocument();
          }

          if (width >= 80 && width < 160) {
            // Normal tier + full banner (same as 60 columns behavior)
            expect(screen.getByText(/█████╗/)).toBeInTheDocument();
            expect(screen.getByText('implementation')).toBeInTheDocument();
            expect(screen.getByText('[2/5]')).toBeInTheDocument();
            expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
          }

          if (width === 160) {
            // Wide tier + full banner
            expect(screen.getByText(/█████╗/)).toBeInTheDocument();
            expect(screen.getByText('implementation')).toBeInTheDocument();
            expect(screen.getByText('[2/5]')).toBeInTheDocument();
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

          // Git branch should not be truncated if short
          expect(screen.getByText('main')).toBeInTheDocument();
        });
      });
    });
  });

  describe('Terminal Resize Behavior', () => {
    it('adapts both components when resizing from 80 to 40', () => {
      // Start at 80 columns
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(80));
      const { rerender } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Verify normal tier behavior
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();

      // Resize to 40 columns
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));
      rerender(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Verify narrow tier behavior
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
    });

    it('adapts both components when resizing from 40 to 160', () => {
      // Start at 40 columns
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));
      const { rerender } = render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Verify narrow tier behavior
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/Test Session/)).not.toBeInTheDocument();
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();

      // Resize to 160 columns
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(160));
      rerender(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Verify wide tier behavior
      expect(screen.getByText('implementation')).toBeInTheDocument();
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

      // Banner should still be compact due to narrow width
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();

      // StatusBar should show verbose indicator despite narrow width
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
      expect(screen.getByText('active:')).toBeInTheDocument();
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

      // Should show truncated version in narrow mode
      expect(screen.getByText(/feature\/v\.\.\./)).toBeInTheDocument();
      expect(screen.queryByText('feature/very-long-branch-name-that-should-be-truncated')).not.toBeInTheDocument();

      // Banner should still render correctly
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
    });

    it('handles very long project path without breaking layout', () => {
      const longPath = '/very/very/very/long/path/to/my/super/duper/long/project/name/that/exceeds/terminal/width';

      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));

      render(
        <ComposedLayout
          bannerProps={{
            ...defaultBannerProps,
            projectPath: longPath
          }}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Banner should truncate long path
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
      // Test exact boundary at 60 columns (full banner + normal StatusBar)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(60));

      render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Should show full banner at exactly 60 cols
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      // Should show medium priority segments
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Test exact boundary at 40 columns (compact banner + narrow StatusBar)
      mockUseStdoutDimensions.mockReturnValue(createDimensionsMock(40));

      render(
        <ComposedLayout
          bannerProps={defaultBannerProps}
          statusBarProps={defaultStatusBarProps}
        />
      );

      // Should show compact banner at exactly 40 cols
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
      // Should hide medium priority segments
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
        expect(screen.getByText(/APEX/)).toBeInTheDocument();
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
      expect(screen.getByText('test-version')).toBeInTheDocument();
      expect(screen.getByText('test-agent')).toBeInTheDocument();

      // They should not interfere with each other's functionality
      expect(screen.getByText(/█████╗/)).toBeInTheDocument(); // Banner ASCII art
      expect(screen.getByText('implementation')).toBeInTheDocument(); // StatusBar workflow stage
    });
  });
});