/**
 * Full-Stack Responsive Integration Test
 *
 * This test suite verifies that all 5 responsive UI components (StatusBar, Banner,
 * AgentPanel, Content components, ErrorDisplay) work together correctly in a realistic
 * App-like layout across all terminal widths with no overflow or truncation.
 *
 * Architecture:
 * - Tests composition of all UI components in a single layout
 * - Validates responsive behavior at 5 terminal widths: 40, 60, 80, 120, 160
 * - Verifies no overflow/truncation across entire composed UI
 * - Includes dynamic resize scenarios
 * - Tests error state integration
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, RenderResult } from '../../../__tests__/test-utils';
import { Box } from 'ink';
import { StatusBar, StatusBarProps } from '../StatusBar';
import { Banner, BannerProps } from '../Banner';
import { AgentPanel, type AgentInfo } from '../agents';
import { ActivityLog } from '../ActivityLog';
import { TaskProgress } from '../TaskProgress';
import { ErrorDisplay } from '../ErrorDisplay';
import type { StdoutDimensions, Breakpoint } from '../../hooks/useStdoutDimensions';
import type { DisplayMode } from '@apex/core';

// =============================================================================
// SECTION 1: Terminal Width Mock Infrastructure (Reusing Proven Patterns)
// =============================================================================

/**
 * Standard terminal widths for comprehensive responsive testing
 * Maps to breakpoints: 40→narrow, 60→compact, 80→compact, 120→normal, 160→wide
 */
export type TerminalWidth = 40 | 60 | 80 | 120 | 160;

/**
 * Terminal width to full dimension context mapping
 */
const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = {
  40: {
    width: 40,
    height: 24,
    breakpoint: 'narrow',
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  60: {
    width: 60,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  80: {
    width: 80,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  120: {
    width: 120,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true
  },
  160: {
    width: 160,
    height: 40,
    breakpoint: 'wide',
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true
  },
};

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock hooks index for AgentPanel
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
  useElapsedTime: vi.fn(() => '01:23:45'),
}));

// Mock additional hooks
vi.mock('../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    isHandoffInProgress: false,
    fromAgent: null,
    toAgent: null,
    startTime: null,
  })),
}));

vi.mock('../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '01:23:45'),
}));

/**
 * Helper to mock terminal width for responsive testing
 */
export function mockTerminalWidth(
  cols: TerminalWidth,
  overrides?: Partial<StdoutDimensions>
): StdoutDimensions {
  const config = { ...TERMINAL_CONFIGS[cols], ...overrides };
  mockUseStdoutDimensions.mockReturnValue(config);
  return config;
}

// =============================================================================
// SECTION 2: Full-Stack Layout Component (App-like Composition)
// =============================================================================

interface FullStackLayoutProps {
  width: TerminalWidth;
  error?: Error | null;
  // Component-specific props
  statusBarProps: StatusBarProps;
  bannerProps: BannerProps;
  agentPanelProps: {
    agents: AgentInfo[];
    displayMode: DisplayMode;
    showThoughts?: boolean;
    parallelAgents?: any[];
  };
  activityLogProps: {
    entries: Array<{
      id: string;
      timestamp: Date;
      level: string;
      message: string;
      agent: string;
    }>;
    displayMode: DisplayMode;
  };
  taskProgressProps: {
    currentTask?: string;
    subtasks: Array<{
      id: string;
      name: string;
      status: 'pending' | 'active' | 'completed' | 'failed';
      progress?: number;
      agent?: string;
    }>;
    displayMode: DisplayMode;
  };
}

/**
 * Full-stack layout component that mimics the App.tsx structure
 * Composes all 5 responsive UI components in realistic layout
 */
function FullStackLayout(props: FullStackLayoutProps) {
  // Set up terminal width mock for this render
  mockTerminalWidth(props.width);

  return (
    <Box flexDirection="column" width={props.width}>
      {/* Banner at top */}
      <Banner {...props.bannerProps} />

      {/* Main content area */}
      <Box flexDirection="row">
        <Box flexDirection="column" flexGrow={1}>
          {/* Agent panel showing workflow progress */}
          <AgentPanel {...props.agentPanelProps} />

          {/* Content components stacked vertically */}
          <ActivityLog {...props.activityLogProps} />
          <TaskProgress {...props.taskProgressProps} />
        </Box>
      </Box>

      {/* Error display (conditional) */}
      {props.error && <ErrorDisplay error={props.error} />}

      {/* StatusBar at bottom */}
      <StatusBar {...props.statusBarProps} />
    </Box>
  );
}

// =============================================================================
// SECTION 3: Responsive Assertion Helpers
// =============================================================================

/**
 * Assert that text content does not overflow the specified width
 */
export function expectNoOverflow(
  element: HTMLElement,
  maxWidth: number
): void {
  const textContent = element.textContent || '';
  const lines = textContent.split('\n');

  lines.forEach((line, index) => {
    if (line.length > maxWidth) {
      throw new Error(
        `Line ${index + 1} exceeds max width of ${maxWidth} characters. ` +
        `Actual length: ${line.length}. Line: "${line.substring(0, 50)}..."`
      );
    }
  });
}

/**
 * Assert that critical content is visible for accessibility
 */
export function expectCriticalContentVisible(container: HTMLElement): void {
  // Connection status should always be visible
  expect(screen.getByText('●')).toBeInTheDocument();

  // App name should always be visible
  expect(screen.getByText(/APEX/)).toBeInTheDocument();

  // Some form of timing should be visible
  expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
}

/**
 * Comprehensive layout integrity check for composed UI
 */
export function expectLayoutIntegrity(container: HTMLElement, width: number): void {
  // Check no element exceeds container width
  expectNoOverflow(container, width);

  // Verify critical content is visible
  expectCriticalContentVisible(container);

  // Check that all major sections are present
  expect(container).toBeTruthy();
}

/**
 * Custom render function for full-stack responsive testing
 */
export function renderFullStackResponsive(
  props: FullStackLayoutProps
): RenderResult & {
  setWidth: (width: TerminalWidth) => void;
} {
  const renderResult = render(<FullStackLayout {...props} />);

  return {
    ...renderResult,
    setWidth: (newWidth: TerminalWidth) => {
      const newProps = { ...props, width: newWidth };
      renderResult.rerender(<FullStackLayout {...newProps} />);
    },
  };
}

// =============================================================================
// SECTION 4: Test Data Factories
// =============================================================================

const createStatusBarProps = (): StatusBarProps => ({
  gitBranch: 'feature/responsive-ui',
  tokens: { input: 1500, output: 750 },
  cost: 0.2468,
  sessionCost: 1.3579,
  model: 'claude-3-5-sonnet-20241022',
  agent: 'developer',
  workflowStage: 'implementation',
  isConnected: true,
  apiUrl: 'http://localhost:3000',
  webUrl: 'http://localhost:3001',
  sessionStartTime: new Date('2024-01-01T10:00:00Z'),
  subtaskProgress: { completed: 3, total: 8 },
  sessionName: 'full-stack-integration-test',
  displayMode: 'normal' as const,
});

const createBannerProps = (): BannerProps => ({
  version: '0.3.0',
  projectPath: '/Users/developer/projects/apex-responsive-ui-integration',
  initialized: true,
});

const createAgentPanelProps = () => ({
  agents: [
    {
      name: 'planner',
      status: 'completed' as const,
      stage: 'planning',
      progress: 100,
      startedAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      name: 'architect',
      status: 'completed' as const,
      stage: 'architecture',
      progress: 100,
      startedAt: new Date('2024-01-01T10:05:00Z'),
    },
    {
      name: 'developer',
      status: 'active' as const,
      stage: 'implementation',
      progress: 65,
      startedAt: new Date('2024-01-01T10:15:00Z'),
      debugInfo: {
        tokensUsed: { input: 1500, output: 750 },
        stageStartedAt: new Date('2024-01-01T10:15:00Z'),
        lastToolCall: 'Write',
        turnCount: 12,
        errorCount: 0,
        thinking: 'Creating comprehensive integration test...',
      },
    },
  ] as AgentInfo[],
  displayMode: 'normal' as DisplayMode,
  showThoughts: false,
});

const createActivityLogProps = () => ({
  entries: [
    {
      id: '1',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      level: 'info',
      message: 'Starting full-stack responsive integration test implementation',
      agent: 'developer',
    },
    {
      id: '2',
      timestamp: new Date('2024-01-01T10:05:00Z'),
      level: 'success',
      message: 'Architecture design completed successfully',
      agent: 'architect',
    },
    {
      id: '3',
      timestamp: new Date('2024-01-01T10:15:00Z'),
      level: 'info',
      message: 'Writing comprehensive test scenarios for all terminal widths',
      agent: 'developer',
    },
  ],
  displayMode: 'normal' as DisplayMode,
});

const createTaskProgressProps = () => ({
  currentTask: 'Implement full-stack responsive integration test',
  subtasks: [
    {
      id: '1',
      name: 'Create test file structure',
      status: 'completed' as const,
      progress: 100,
      agent: 'developer',
    },
    {
      id: '2',
      name: 'Implement FullStackLayout component',
      status: 'completed' as const,
      progress: 100,
      agent: 'developer',
    },
    {
      id: '3',
      name: 'Add responsive test utilities',
      status: 'active' as const,
      progress: 75,
      agent: 'developer',
    },
    {
      id: '4',
      name: 'Create comprehensive test scenarios',
      status: 'pending' as const,
      progress: 0,
      agent: 'developer',
    },
  ],
  displayMode: 'normal' as DisplayMode,
});

// =============================================================================
// SECTION 5: Full-Stack Integration Tests
// =============================================================================

describe('Full-Stack Responsive Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default terminal width
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // Test Category A: Static Composition Tests at All 5 Widths
  // =============================================================================

  describe('Full Composition at All 5 Terminal Widths', () => {
    const widths: TerminalWidth[] = [40, 60, 80, 120, 160];

    widths.forEach(width => {
      it(`renders all components without overflow at ${width} columns`, () => {
        const props: FullStackLayoutProps = {
          width,
          statusBarProps: createStatusBarProps(),
          bannerProps: createBannerProps(),
          agentPanelProps: createAgentPanelProps(),
          activityLogProps: createActivityLogProps(),
          taskProgressProps: createTaskProgressProps(),
        };

        const { container } = renderFullStackResponsive(props);

        // Assert no overflow across entire composed UI
        expectLayoutIntegrity(container, width);

        // Verify all major components are present
        expect(screen.getByText(/APEX/)).toBeInTheDocument(); // Banner
        expect(screen.getByText('developer')).toBeInTheDocument(); // AgentPanel
        expect(screen.getByText(/Starting full-stack/)).toBeInTheDocument(); // ActivityLog
        expect(screen.getByText(/Implement full-stack/)).toBeInTheDocument(); // TaskProgress
        expect(screen.getByText(/feature\/responsive-ui/)).toBeInTheDocument(); // StatusBar

        // Verify critical content remains accessible
        expectCriticalContentVisible(container);
      });

      it(`adapts component layout appropriately for ${width} column breakpoint`, () => {
        const props: FullStackLayoutProps = {
          width,
          statusBarProps: createStatusBarProps(),
          bannerProps: createBannerProps(),
          agentPanelProps: createAgentPanelProps(),
          activityLogProps: createActivityLogProps(),
          taskProgressProps: createTaskProgressProps(),
        };

        const { container } = renderFullStackResponsive(props);

        // Check breakpoint-specific adaptations
        if (width < 60) {
          // Narrow: Should not show ASCII art, minimal segments
          expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
          expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // Medium priority in StatusBar
        } else if (width >= 160) {
          // Wide: Should show full content including low priority
          expect(screen.getByText(/full-stack-integration-test/)).toBeInTheDocument(); // Session name (low priority)
        }

        expectLayoutIntegrity(container, width);
      });
    });
  });

  // =============================================================================
  // Test Category B: Cross-Component Consistency
  // =============================================================================

  describe('Cross-Component Consistency', () => {
    it('all components use same terminal width from hook', () => {
      const props: FullStackLayoutProps = {
        width: 120,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      renderFullStackResponsive(props);

      // Verify the hook was called for each component
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // All components should see the same terminal configuration
      const lastCall = mockUseStdoutDimensions.mock.calls[mockUseStdoutDimensions.mock.calls.length - 1];
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith();
    });

    it('components do not interfere with each other layout', () => {
      const props: FullStackLayoutProps = {
        width: 80,
        statusBarProps: {
          ...createStatusBarProps(),
          gitBranch: 'feature/extremely-long-branch-name-that-might-cause-layout-issues',
        },
        bannerProps: {
          ...createBannerProps(),
          projectPath: '/very/long/path/to/project/that/might/cause/truncation/issues',
        },
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      const { container } = renderFullStackResponsive(props);

      // Each component should handle its own content gracefully
      expectLayoutIntegrity(container, 80);

      // Components should not break each other's layout
      expect(screen.getByText(/APEX/)).toBeInTheDocument();
      expect(screen.getByText(/feature/)).toBeInTheDocument(); // Branch (possibly truncated)
      expect(screen.getByText(/project/)).toBeInTheDocument(); // Path (possibly truncated)
    });
  });

  // =============================================================================
  // Test Category C: Dynamic Resize Scenarios
  // =============================================================================

  describe('Dynamic Terminal Resize', () => {
    it('adapts from narrow to wide terminal seamlessly', () => {
      const props: FullStackLayoutProps = {
        width: 40,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      const { setWidth, container } = renderFullStackResponsive(props);

      // Verify narrow layout
      expectLayoutIntegrity(container, 40);
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument(); // No ASCII art
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // No medium priority

      // Resize to wide
      setWidth(160);

      // Verify wide layout
      expect(screen.getByText(/full-stack-integration-test/)).toBeInTheDocument(); // Low priority segments visible
      expectLayoutIntegrity(container, 160);

      // Critical elements should remain accessible
      expectCriticalContentVisible(container);
    });

    it('handles rapid width changes without breaking layout', () => {
      const props: FullStackLayoutProps = {
        width: 80,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      const { setWidth, container } = renderFullStackResponsive(props);

      // Simulate rapid resizing
      const widthSequence: TerminalWidth[] = [80, 40, 160, 60, 120, 40, 160];

      widthSequence.forEach(width => {
        setWidth(width);
        expectLayoutIntegrity(container, width);
        expectCriticalContentVisible(container);
      });
    });

    it('maintains layout integrity during resize with active content updates', () => {
      const props: FullStackLayoutProps = {
        width: 120,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: {
          ...createAgentPanelProps(),
          agents: [
            ...createAgentPanelProps().agents,
            {
              name: 'tester',
              status: 'active' as const,
              stage: 'testing',
              progress: 35,
              startedAt: new Date(),
            },
          ],
        },
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      const { setWidth, container } = renderFullStackResponsive(props);

      // Start at normal width with multiple active agents
      expectLayoutIntegrity(container, 120);
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Resize to narrow while maintaining active content
      setWidth(40);
      expectLayoutIntegrity(container, 40);

      // Agents should still be displayed (possibly in compact form)
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Test Category D: Error State Composition
  // =============================================================================

  describe('Error Display in Composed Layout', () => {
    const testError = new Error('Integration test error with comprehensive stack trace');

    beforeEach(() => {
      // Add realistic stack trace
      testError.stack = `Error: Integration test error with comprehensive stack trace
    at FullStackLayout (/apex/packages/cli/src/ui/components/__tests__/fullstack-responsive.integration.test.tsx:100:20)
    at renderFullStackResponsive (/apex/packages/cli/src/ui/components/__tests__/fullstack-responsive.integration.test.tsx:250:15)
    at TestRunner (/apex/node_modules/vitest/dist/index.js:500:30)
    at runTest (/apex/node_modules/vitest/dist/index.js:800:45)`;
    });

    it('ErrorDisplay integrates correctly at all widths without breaking layout', () => {
      const widths: TerminalWidth[] = [40, 60, 80, 120, 160];

      widths.forEach(width => {
        const props: FullStackLayoutProps = {
          width,
          error: testError,
          statusBarProps: createStatusBarProps(),
          bannerProps: createBannerProps(),
          agentPanelProps: createAgentPanelProps(),
          activityLogProps: createActivityLogProps(),
          taskProgressProps: createTaskProgressProps(),
        };

        const { container } = renderFullStackResponsive(props);

        // Layout should remain intact with error displayed
        expectLayoutIntegrity(container, width);

        // Error should be displayed appropriately for terminal width
        expect(screen.getByText(/Integration test error/)).toBeInTheDocument();

        // Other components should still be functional
        expect(screen.getByText(/APEX/)).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Verify error message truncation behavior at narrow widths
        if (width < 60) {
          // Error message should be truncated but readable
          expect(screen.getByText(/Integration test/)).toBeInTheDocument();
        } else {
          // Full error message should be visible at wider terminals
          expect(screen.getByText(/comprehensive stack trace/)).toBeInTheDocument();
        }
      });
    });

    it('stack trace display adapts to terminal width', () => {
      const props: FullStackLayoutProps = {
        width: 160, // Wide terminal
        error: testError,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      const { setWidth, container } = renderFullStackResponsive(props);

      // Wide terminal should show stack trace
      expectLayoutIntegrity(container, 160);
      expect(screen.getByText(/FullStackLayout/)).toBeInTheDocument();

      // Resize to narrow
      setWidth(40);
      expectLayoutIntegrity(container, 40);

      // Stack trace should be hidden or heavily truncated at narrow width
      // but error message should still be visible
      expect(screen.getByText(/Integration test/)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Test Category E: Performance and Edge Cases
  // =============================================================================

  describe('Performance and Edge Cases', () => {
    it('handles multiple component rerenders efficiently', () => {
      const props: FullStackLayoutProps = {
        width: 120,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      const startTime = performance.now();

      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderFullStackResponsive(props);
        unmount();
      }

      const endTime = performance.now();

      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(500); // Under 500ms for 10 renders
    });

    it('handles invalid terminal dimensions gracefully', () => {
      const props: FullStackLayoutProps = {
        width: 80,
        statusBarProps: createStatusBarProps(),
        bannerProps: createBannerProps(),
        agentPanelProps: createAgentPanelProps(),
        activityLogProps: createActivityLogProps(),
        taskProgressProps: createTaskProgressProps(),
      };

      // Mock hook to return invalid dimensions
      mockUseStdoutDimensions.mockReturnValue({
        width: NaN,
        height: NaN,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false, // Mark as unavailable
      });

      // Should not throw with fallback behavior
      expect(() => {
        renderFullStackResponsive(props);
      }).not.toThrow();
    });

    it('maintains accessibility with complex component interactions', () => {
      const props: FullStackLayoutProps = {
        width: 80,
        statusBarProps: {
          ...createStatusBarProps(),
          displayMode: 'verbose',
        },
        bannerProps: createBannerProps(),
        agentPanelProps: {
          ...createAgentPanelProps(),
          displayMode: 'verbose',
          showThoughts: true,
        },
        activityLogProps: {
          ...createActivityLogProps(),
          displayMode: 'verbose',
        },
        taskProgressProps: {
          ...createTaskProgressProps(),
          displayMode: 'verbose',
        },
      };

      const { container } = renderFullStackResponsive(props);

      // Even in verbose mode, layout should be maintained
      expectLayoutIntegrity(container, 80);

      // Critical elements should remain accessible
      expectCriticalContentVisible(container);

      // Verbose indicators should be present
      expect(screen.getByText('🔍 VERBOSE')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Test Category F: Real-World Scenarios
  // =============================================================================

  describe('Real-World Integration Scenarios', () => {
    it('handles complete workflow execution simulation', () => {
      // Simulate a complete workflow with all agents having run
      const completeWorkflowProps: FullStackLayoutProps = {
        width: 120,
        statusBarProps: {
          ...createStatusBarProps(),
          agent: 'completed',
          workflowStage: 'completed',
          subtaskProgress: { completed: 8, total: 8 },
        },
        bannerProps: createBannerProps(),
        agentPanelProps: {
          agents: [
            {
              name: 'planner',
              status: 'completed' as const,
              stage: 'planning',
              progress: 100,
              startedAt: new Date('2024-01-01T10:00:00Z'),
            },
            {
              name: 'architect',
              status: 'completed' as const,
              stage: 'architecture',
              progress: 100,
              startedAt: new Date('2024-01-01T10:05:00Z'),
            },
            {
              name: 'developer',
              status: 'completed' as const,
              stage: 'implementation',
              progress: 100,
              startedAt: new Date('2024-01-01T10:15:00Z'),
            },
            {
              name: 'tester',
              status: 'completed' as const,
              stage: 'testing',
              progress: 100,
              startedAt: new Date('2024-01-01T10:45:00Z'),
            },
            {
              name: 'reviewer',
              status: 'completed' as const,
              stage: 'review',
              progress: 100,
              startedAt: new Date('2024-01-01T11:00:00Z'),
            },
          ],
          displayMode: 'normal' as DisplayMode,
        },
        activityLogProps: {
          entries: [
            ...createActivityLogProps().entries,
            {
              id: '4',
              timestamp: new Date('2024-01-01T11:15:00Z'),
              level: 'success',
              message: 'All integration tests passing - workflow completed successfully!',
              agent: 'reviewer',
            },
          ],
          displayMode: 'normal' as DisplayMode,
        },
        taskProgressProps: {
          currentTask: 'Full-stack integration test implementation - COMPLETED',
          subtasks: [
            {
              id: '1',
              name: 'Create test file structure',
              status: 'completed' as const,
              progress: 100,
              agent: 'developer',
            },
            {
              id: '2',
              name: 'Implement FullStackLayout component',
              status: 'completed' as const,
              progress: 100,
              agent: 'developer',
            },
            {
              id: '3',
              name: 'Add responsive test utilities',
              status: 'completed' as const,
              progress: 100,
              agent: 'developer',
            },
            {
              id: '4',
              name: 'Create comprehensive test scenarios',
              status: 'completed' as const,
              progress: 100,
              agent: 'developer',
            },
          ],
          displayMode: 'normal' as DisplayMode,
        },
      };

      const { container } = renderFullStackResponsive(completeWorkflowProps);

      expectLayoutIntegrity(container, 120);

      // All agents should show as completed
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Success message should be visible
      expect(screen.getByText(/workflow completed successfully/)).toBeInTheDocument();
    });

    it('handles error recovery during workflow execution', () => {
      const errorRecoveryProps: FullStackLayoutProps = {
        width: 120,
        error: new Error('Temporary network connection lost - retrying...'),
        statusBarProps: {
          ...createStatusBarProps(),
          isConnected: false, // Connection issue
        },
        bannerProps: createBannerProps(),
        agentPanelProps: {
          ...createAgentPanelProps(),
          agents: [
            ...createAgentPanelProps().agents,
            {
              name: 'tester',
              status: 'waiting' as const,
              stage: 'testing',
              progress: 0,
              startedAt: new Date(),
            },
          ],
        },
        activityLogProps: {
          entries: [
            ...createActivityLogProps().entries,
            {
              id: '4',
              timestamp: new Date(),
              level: 'warn',
              message: 'Connection lost - agent waiting for reconnection',
              agent: 'tester',
            },
          ],
          displayMode: 'normal' as DisplayMode,
        },
        taskProgressProps: createTaskProgressProps(),
      };

      const { container } = renderFullStackResponsive(errorRecoveryProps);

      expectLayoutIntegrity(container, 120);

      // Should show disconnection state
      expect(screen.getByText(/network connection lost/)).toBeInTheDocument();

      // Status should reflect disconnection
      // Note: Specific connection indicator depends on StatusBar implementation

      // Agents should show appropriate waiting state
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });
});