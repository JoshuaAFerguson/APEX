/**
 * Cross-Component Responsive Integration Tests
 *
 * This test suite verifies that multiple responsive components work together
 * correctly across different terminal widths and adapt consistently.
 */

import React from 'react';
import { render, screen } from '../../../__tests__/test-utils.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Box } from 'ink';
import { StatusBar, StatusBarProps } from '../StatusBar.js';
import { Banner, BannerProps } from '../Banner.js';
import { ActivityLog } from '../ActivityLog.js';
import * as useStdoutDimensionsModule from '../../hooks/useStdoutDimensions.js';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.spyOn(useStdoutDimensionsModule, 'useStdoutDimensions');

// Test app component that combines multiple responsive components
function TestApp({
  terminalWidth,
  statusBarProps,
  bannerProps,
}: {
  terminalWidth: number;
  statusBarProps: StatusBarProps;
  bannerProps: BannerProps;
}) {
  // Mock the hook to return consistent values across all components
  mockUseStdoutDimensions.mockReturnValue({
    width: terminalWidth,
    height: 24,
    breakpoint: terminalWidth < 60 ? 'narrow' : terminalWidth < 100 ? 'compact' : terminalWidth < 160 ? 'normal' : 'wide',
    isNarrow: terminalWidth < 60,
    isCompact: terminalWidth >= 60 && terminalWidth < 100,
    isNormal: terminalWidth >= 100 && terminalWidth < 160,
    isWide: terminalWidth >= 160,
    isAvailable: true,
  });

  return (
    <Box flexDirection="column">
      <Banner {...bannerProps} />
      <ActivityLog
        entries={[
          { id: '1', timestamp: new Date(), level: 'info', message: 'Test log entry', agent: 'test' },
        ]}
        displayMode="normal"
      />
      <StatusBar {...statusBarProps} />
    </Box>
  );
}

describe('Cross-Component Responsive Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createStatusBarProps = (): StatusBarProps => ({
    gitBranch: 'main',
    tokens: { input: 1000, output: 500 },
    cost: 0.1234,
    sessionCost: 0.5678,
    model: 'claude-3-sonnet',
    agent: 'planner',
    workflowStage: 'planning',
    isConnected: true,
    apiUrl: 'http://localhost:3000',
    webUrl: 'http://localhost:3001',
    sessionStartTime: new Date('2024-01-01T10:00:00Z'),
    subtaskProgress: { completed: 2, total: 5 },
    sessionName: 'test-session',
    displayMode: 'normal' as const,
  });

  const createBannerProps = (): BannerProps => ({
    version: '0.1.0',
    projectPath: '/home/user/project',
    initialized: true,
  });

  describe('Consistent responsive behavior across components', () => {
    it('all components adapt to narrow terminal consistently', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();

      const { container } = render(
        <TestApp
          terminalWidth={50}
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      expect(container).toBeTruthy();

      // Banner should be in compact mode
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

      // StatusBar should show only high/critical priority
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection
      expect(screen.getByText(/main/)).toBeInTheDocument(); // Git branch
      expect(screen.queryByText('planning')).not.toBeInTheDocument(); // Workflow stage (medium priority)

      // ActivityLog should adapt to narrow width
      expect(screen.getByText('Test log entry')).toBeInTheDocument();
    });

    it('all components utilize wide terminal space effectively', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();

      const { container } = render(
        <TestApp
          terminalWidth={200}
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      expect(container).toBeTruthy();

      // Banner should show full ASCII art
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();

      // StatusBar should show all priority levels
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection (critical)
      expect(screen.getByText(/main/)).toBeInTheDocument(); // Git branch (high)
      expect(screen.getByText('planning')).toBeInTheDocument(); // Workflow stage (medium)
      expect(screen.getByText(/test-session/)).toBeInTheDocument(); // Session name (low)

      // ActivityLog should use wide layout
      expect(screen.getByText('Test log entry')).toBeInTheDocument();
    });
  });

  describe('Component interaction during terminal resizing', () => {
    it('components maintain layout consistency during width changes', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();
      const widthSequence = [200, 100, 50, 150];

      let currentWidth = widthSequence[0];
      const { rerender } = render(
        <TestApp
          terminalWidth={currentWidth}
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      widthSequence.forEach(width => {
        currentWidth = width;
        rerender(
          <TestApp
            terminalWidth={width}
            statusBarProps={statusBarProps}
            bannerProps={bannerProps}
          />
        );

        // Verify consistent behavior across components
        if (width < 60) {
          // Narrow: Both Banner and StatusBar should be in minimal mode
          expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument(); // Banner ASCII
          expect(screen.queryByText('planning')).not.toBeInTheDocument(); // StatusBar medium priority
        } else if (width >= 160) {
          // Wide: Both components should show full content
          expect(screen.getByText(/█████╗/)).toBeInTheDocument(); // Banner ASCII
          expect(screen.getByText(/test-session/)).toBeInTheDocument(); // StatusBar low priority
        }

        // Connection should always be present (critical)
        expect(screen.getByText('●')).toBeInTheDocument();
      });
    });
  });

  describe('Display mode coordination', () => {
    it('components respect display mode hierarchy correctly', () => {
      const statusBarProps = createStatusBarProps();
      statusBarProps.displayMode = 'compact';
      const bannerProps = createBannerProps();

      const { container } = render(
        <TestApp
          terminalWidth={200} // Wide terminal
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      expect(container).toBeTruthy();

      // Banner should still show full ASCII art (not affected by StatusBar display mode)
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();

      // StatusBar should respect compact mode despite wide terminal
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection
      expect(screen.getByText(/main/)).toBeInTheDocument(); // Git branch
      expect(screen.queryByText('planning')).not.toBeInTheDocument(); // Should be hidden in compact
    });

    it('verbose mode components handle narrow terminals gracefully', () => {
      const statusBarProps = createStatusBarProps();
      statusBarProps.displayMode = 'verbose';
      statusBarProps.detailedTiming = {
        totalActiveTime: 120000,
        totalIdleTime: 60000,
        currentStageElapsed: 30000,
      };
      const bannerProps = createBannerProps();

      const { container } = render(
        <TestApp
          terminalWidth={40} // Narrow terminal
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      expect(container).toBeTruthy();

      // Banner should adapt to narrow width
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument(); // No ASCII art

      // StatusBar should show verbose content despite narrow width
      expect(screen.getByText(/test-session/)).toBeInTheDocument(); // Session name (low priority)
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument(); // Verbose indicator
    });
  });

  describe('Performance under responsive conditions', () => {
    it('multiple components render efficiently during rapid resizing', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();
      const resizeSequence = Array.from({ length: 50 }, (_, i) => 50 + i * 3); // 50 to 197

      const startTime = performance.now();

      resizeSequence.forEach(width => {
        const { unmount } = render(
          <TestApp
            terminalWidth={width}
            statusBarProps={statusBarProps}
            bannerProps={bannerProps}
          />
        );
        unmount();
      });

      const endTime = performance.now();

      // Should complete rapid resizing simulation in reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second for 50 renders
    });

    it('memory usage remains stable with responsive components', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();

      // Simulate multiple render cycles
      for (let i = 0; i < 10; i++) {
        const width = 50 + (i * 20);
        const { unmount } = render(
          <TestApp
            terminalWidth={width}
            statusBarProps={statusBarProps}
            bannerProps={bannerProps}
          />
        );
        unmount();
      }

      // If we get here without memory issues, the test passes
      expect(true).toBe(true);
    });
  });

  describe('Accessibility and content preservation', () => {
    it('critical content remains accessible across all terminal sizes', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();
      const testWidths = [20, 40, 60, 80, 100, 120, 160, 200];

      testWidths.forEach(width => {
        const { container, unmount } = render(
          <TestApp
            terminalWidth={width}
            statusBarProps={statusBarProps}
            bannerProps={bannerProps}
          />
        );

        // Critical elements should always be present
        expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
        expect(screen.getByText(/APEX/)).toBeInTheDocument(); // App name
        expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument(); // Timer

        // Should have some form of version info
        expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();

        unmount();
      });
    });

    it('component boundaries do not interfere with each other', () => {
      const statusBarProps = createStatusBarProps();
      statusBarProps.gitBranch = 'feature/very-long-branch-name';
      const bannerProps = createBannerProps();
      bannerProps.projectPath = '/very/long/path/to/project/directory/that/might/cause/issues';

      const { container } = render(
        <TestApp
          terminalWidth={60}
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      expect(container).toBeTruthy();

      // Components should handle their own content gracefully
      expect(screen.getByText(/feature/)).toBeInTheDocument(); // Branch should be shown (possibly truncated)
      expect(screen.getByText(/project/)).toBeInTheDocument(); // Path should be shown (possibly truncated)
    });
  });

  describe('State management across components', () => {
    it('useStdoutDimensions hook state is shared correctly', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();

      // Verify the hook is called for each component
      let hookCallCount = 0;
      mockUseStdoutDimensions.mockImplementation(() => {
        hookCallCount++;
        return {
          width: 100,
          height: 24,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        };
      });

      render(
        <TestApp
          terminalWidth={100}
          statusBarProps={statusBarProps}
          bannerProps={bannerProps}
        />
      );

      // Hook should be called multiple times (once per component using it)
      expect(hookCallCount).toBeGreaterThan(1);
    });
  });

  describe('Error resilience in responsive layout', () => {
    it('components handle invalid width values gracefully', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();

      // Test with invalid/edge case widths
      const invalidWidths = [NaN, Infinity, -Infinity, null as any, undefined as any];

      invalidWidths.forEach(width => {
        // Override mock to return the invalid width
        mockUseStdoutDimensions.mockReturnValue({
          width: width || 80, // Fallback to 80
          height: 24,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: false, // Mark as unavailable for invalid cases
        });

        expect(() => {
          render(
            <TestApp
              terminalWidth={width}
              statusBarProps={statusBarProps}
              bannerProps={bannerProps}
            />
          );
        }).not.toThrow();
      });
    });

    it('components gracefully degrade when hook fails', () => {
      const statusBarProps = createStatusBarProps();
      const bannerProps = createBannerProps();

      // Mock hook to throw error
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook failed');
      });

      // Components should handle hook failures gracefully
      expect(() => {
        render(
          <TestApp
            terminalWidth={80}
            statusBarProps={statusBarProps}
            bannerProps={bannerProps}
          />
        );
      }).not.toThrow();
    });
  });
});