/**
 * Edge Case Tests for Responsive Layout System
 *
 * This test suite verifies that the responsive layout system handles
 * extreme terminal width conditions correctly and gracefully.
 */

import React from 'react';
import { render, screen } from '../../../__tests__/test-utils.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusBar, StatusBarProps } from '../StatusBar.js';
import { Banner, BannerProps } from '../Banner.js';
import * as useStdoutDimensionsModule from '../../hooks/useStdoutDimensions.js';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.spyOn(useStdoutDimensionsModule, 'useStdoutDimensions');

describe('Responsive Layout Edge Cases', () => {
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

  describe('Extremely narrow terminals', () => {
    it('handles 1-column terminal gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 1,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      const { container } = render(<StatusBar {...props} />);

      // Should render without crashing
      expect(container).toBeTruthy();

      // Should at least show connection status (critical priority)
      const connectionElement = container.querySelector('[color="green"]');
      expect(connectionElement).toBeTruthy();
    });

    it('handles 5-column terminal with minimal content', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 5,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      const { container } = render(<StatusBar {...props} />);

      expect(container).toBeTruthy();

      // Should preserve critical segments only
      const textElements = Array.from(container.querySelectorAll('*'));
      const hasTimer = textElements.some(el => el.textContent?.match(/\d{2}:\d{2}/));
      expect(hasTimer).toBe(true);
    });

    it('Banner adapts to extremely narrow terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const props = createBannerProps();
      const { container } = render(<Banner {...props} />);

      expect(container).toBeTruthy();

      // Should show text-only mode
      const textElements = Array.from(container.querySelectorAll('*'));
      const hasApexText = textElements.some(el => el.textContent?.includes('APEX'));
      expect(hasApexText).toBe(true);

      // Should not show ASCII art
      const hasAsciiArt = textElements.some(el => el.textContent?.includes('█'));
      expect(hasAsciiArt).toBe(false);
    });
  });

  describe('Extremely wide terminals', () => {
    it('handles 500-column terminal efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 500,
        height: 100,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      const { container } = render(<StatusBar {...props} />);

      expect(container).toBeTruthy();

      // Should show all segments including low priority
      const textElements = Array.from(container.querySelectorAll('*'));

      // Check for presence of all priority levels
      const hasConnection = container.querySelector('[color="green"]');
      const hasGitBranch = textElements.some(el => el.textContent?.includes('main'));
      const hasWorkflowStage = textElements.some(el => el.textContent?.includes('planning'));
      const hasSessionName = textElements.some(el => el.textContent?.includes('test-session'));

      expect(hasConnection).toBeTruthy();
      expect(hasGitBranch).toBe(true);
      expect(hasWorkflowStage).toBe(true);
      expect(hasSessionName).toBe(true);
    });

    it('handles 1000-column terminal without performance issues', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 1000,
        height: 200,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      const props = createStatusBarProps();

      // Measure render time
      const startTime = performance.now();
      const { container } = render(<StatusBar {...props} />);
      const endTime = performance.now();

      expect(container).toBeTruthy();

      // Should render quickly (under 100ms for this simple component)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Zero and negative width edge cases', () => {
    it('handles zero width gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: false,
      });

      const props = createStatusBarProps();
      const { container } = render(<StatusBar {...props} />);

      // Should use fallback behavior and not crash
      expect(container).toBeTruthy();
    });

    it('handles negative width by using fallback', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: -10,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: false,
      });

      const props = createStatusBarProps();
      const { container } = render(<StatusBar {...props} />);

      // Should handle gracefully
      expect(container).toBeTruthy();
    });
  });

  describe('Terminal resize simulation', () => {
    it('adapts correctly during rapid width changes', () => {
      const widthSequence = [200, 50, 100, 30, 150, 20, 300];

      let currentWidth = widthSequence[0];
      mockUseStdoutDimensions.mockImplementation(() => ({
        width: currentWidth,
        height: 24,
        breakpoint: currentWidth < 60 ? 'narrow' : currentWidth < 100 ? 'compact' : currentWidth < 160 ? 'normal' : 'wide',
        isNarrow: currentWidth < 60,
        isCompact: currentWidth >= 60 && currentWidth < 100,
        isNormal: currentWidth >= 100 && currentWidth < 160,
        isWide: currentWidth >= 160,
        isAvailable: true,
      }));

      const props = createStatusBarProps();
      const { container, rerender } = render(<StatusBar {...props} />);

      // Simulate rapid terminal resizing
      widthSequence.forEach((width, index) => {
        currentWidth = width;
        rerender(<StatusBar {...props} />);

        // Should render without errors at each width
        expect(container).toBeTruthy();

        // Check that appropriate content is shown for width
        const textElements = Array.from(container.querySelectorAll('*'));
        const hasConnection = container.querySelector('[color="green"]');

        // Connection should always be present (critical priority)
        expect(hasConnection).toBeTruthy();

        if (width < 60) {
          // Narrow mode - should hide medium/low priority segments
          const hasWorkflowStage = textElements.some(el => el.textContent?.includes('planning'));
          expect(hasWorkflowStage).toBe(false);
        } else if (width >= 160) {
          // Wide mode - should show low priority segments
          const hasSessionName = textElements.some(el => el.textContent?.includes('test-session'));
          expect(hasSessionName).toBe(true);
        }
      });
    });
  });

  describe('Boundary value testing', () => {
    const criticalBoundaries = [
      { width: 59, expectedBreakpoint: 'narrow' },
      { width: 60, expectedBreakpoint: 'compact' },
      { width: 99, expectedBreakpoint: 'compact' },
      { width: 100, expectedBreakpoint: 'normal' },
      { width: 159, expectedBreakpoint: 'normal' },
      { width: 160, expectedBreakpoint: 'wide' },
    ];

    criticalBoundaries.forEach(({ width, expectedBreakpoint }) => {
      it(`correctly handles boundary at ${width} columns`, () => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: expectedBreakpoint as any,
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width < 160,
          isWide: width >= 160,
          isAvailable: true,
        });

        const props = createStatusBarProps();
        const { container } = render(<StatusBar {...props} />);

        expect(container).toBeTruthy();

        const textElements = Array.from(container.querySelectorAll('*'));

        // Verify priority-based content filtering
        if (width < 60) {
          // Only critical and high priority should be shown
          const hasWorkflowStage = textElements.some(el => el.textContent?.includes('planning'));
          expect(hasWorkflowStage).toBe(false);
        } else if (width < 160) {
          // Should show medium priority but not low priority
          const hasWorkflowStage = textElements.some(el => el.textContent?.includes('planning'));
          const hasSessionName = textElements.some(el => el.textContent?.includes('test-session'));
          expect(hasWorkflowStage).toBe(true);
          expect(hasSessionName).toBe(false);
        } else {
          // Wide: should show all priorities including low
          const hasSessionName = textElements.some(el => el.textContent?.includes('test-session'));
          expect(hasSessionName).toBe(true);
        }
      });
    });
  });

  describe('Display mode overrides with extreme widths', () => {
    it('compact mode works correctly in very wide terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 400,
        height: 100,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      props.displayMode = 'compact';
      const { container } = render(<StatusBar {...props} />);

      const textElements = Array.from(container.querySelectorAll('*'));

      // Even in 400-column terminal, compact mode should only show minimal segments
      const hasGitBranch = textElements.some(el => el.textContent?.includes('main'));
      const hasWorkflowStage = textElements.some(el => el.textContent?.includes('planning'));

      expect(hasGitBranch).toBe(true); // Should be shown in compact
      expect(hasWorkflowStage).toBe(false); // Should be hidden in compact
    });

    it('verbose mode shows all segments even in very narrow terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      props.displayMode = 'verbose';
      props.detailedTiming = {
        totalActiveTime: 120000,
        totalIdleTime: 60000,
        currentStageElapsed: 30000,
      };

      const { container } = render(<StatusBar {...props} />);

      const textElements = Array.from(container.querySelectorAll('*'));

      // Even in 25-column terminal, verbose mode should show session name
      const hasSessionName = textElements.some(el => el.textContent?.includes('test-session'));
      const hasWorkflowStage = textElements.some(el => el.textContent?.includes('planning'));

      expect(hasSessionName).toBe(true); // Should be shown in verbose despite narrow width
      expect(hasWorkflowStage).toBe(true); // Should be shown in verbose despite narrow width
    });
  });

  describe('Content truncation and overflow prevention', () => {
    it('prevents overflow with extremely long content in narrow terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      props.gitBranch = 'feature/extremely-long-branch-name-that-should-be-truncated-properly';
      props.model = 'claude-3-opus-with-extremely-long-model-name-for-testing-truncation';
      props.sessionName = 'extremely-long-session-name-that-exceeds-reasonable-terminal-width-limits';

      const { container } = render(<StatusBar {...props} />);

      // Should render without visual overflow
      expect(container).toBeTruthy();

      // The Box component should respect width constraints
      const statusBarBox = container.querySelector('[style*="width"]');
      expect(statusBarBox).toBeTruthy();
    });

    it('handles unicode characters in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const props = createStatusBarProps();
      props.gitBranch = 'feature/🚀-unicode-branch-💫-with-emojis-✨';
      props.agent = '🤖-unicode-agent-🎯';

      const { container } = render(<StatusBar {...props} />);

      // Should handle unicode characters gracefully
      expect(container).toBeTruthy();

      const textElements = Array.from(container.querySelectorAll('*'));
      const hasUnicodeContent = textElements.some(el =>
        el.textContent?.includes('🚀') || el.textContent?.includes('🤖')
      );
      expect(hasUnicodeContent).toBe(true);
    });
  });
});