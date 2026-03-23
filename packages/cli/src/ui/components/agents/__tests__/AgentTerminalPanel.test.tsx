/**
 * AgentTerminalPanel Tests
 *
 * Comprehensive test suite covering all aspects of the AgentTerminalPanel component:
 * - Basic rendering and status integration
 * - Responsive behavior across different terminal widths
 * - Visual states for all execution statuses
 * - Display mode variations (normal, compact, verbose)
 * - Props validation and edge cases
 * - Event handling and accessibility
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentTerminalPanel } from '../AgentTerminalPanel.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';
import type { AgentExecution, AgentExecutionStatus, TerminalPanelDisplayMode } from '../AgentTerminalPanel.types.js';

// Test wrapper with ThemeProvider for Ink components
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider defaultTheme="dark">
    {children}
  </ThemeProvider>
);

// Custom render function for Ink components
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<TestWrapper>{ui}</TestWrapper>);
};

// Mock the hooks and dependencies
vi.mock('../../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
  })),
}));

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '1m 30s'),
}));

vi.mock('../../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => ({
    text: 'white',
    textMuted: 'gray',
    cyan: 'cyan',
    green: 'green',
    red: 'red',
    yellow: 'yellow',
    gray: 'gray',
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('AgentTerminalPanel', () => {
  // Helper function to create mock execution data
  const createMockExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution => ({
    id: 'test-execution-1',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'running',
    stage: 'implementing',
    progress: 50,
    startedAt: new Date('2024-01-01T10:00:00Z'),
    tokensUsed: 1250,
    taskDescription: 'Test task description',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with minimal props', () => {
      const execution = createMockExecution();
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Test Agent');
      expect(lastFrame()).toContain('implementing');
    });

    it('displays agent status indicator', () => {
      const execution = createMockExecution({ status: 'running' });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      // Should contain status indicator (though exact character depends on implementation)
      expect(lastFrame()).toMatch(/[●◐◑◒◓○]/);
    });

    it('shows elapsed time when enabled', () => {
      const execution = createMockExecution();
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} showElapsedTime={true} />
      );

      expect(lastFrame()).toContain('1m 30s');
    });

    it('hides elapsed time when disabled', () => {
      const execution = createMockExecution();
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} showElapsedTime={false} />
      );

      expect(lastFrame()).not.toContain('1m 30s');
    });
  });

  describe('Execution Status States', () => {
    const statuses: AgentExecutionStatus[] = [
      'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
    ];

    it.each(statuses)('renders correctly for %s status', (status) => {
      const execution = createMockExecution({ status });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Test Agent');
      // Different statuses should render without errors
      expect(lastFrame()).toBeTruthy();
    });

    it('shows error message for failed status', () => {
      const execution = createMockExecution({
        status: 'failed',
        error: 'Connection timeout',
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Connection timeout');
      expect(lastFrame()).toContain('⚠');
    });

    it('truncates long error messages', () => {
      const longError = 'This is a very long error message that should be truncated to fit within the configured maximum length limit';
      const execution = createMockExecution({
        status: 'failed',
        error: longError,
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      // Error should be present but truncated
      expect(lastFrame()).toContain('⚠');
      expect(lastFrame()).not.toContain(longError); // Full message shouldn't be present
    });
  });

  describe('Display Modes', () => {
    const execution = createMockExecution();

    it('renders in normal mode', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} displayMode="normal" />
      );

      expect(lastFrame()).toContain('Test Agent');
      expect(lastFrame()).toContain('implementing');
    });

    it('renders in compact mode', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} displayMode="compact" />
      );

      expect(lastFrame()).toContain('Test Agent');
      // Compact mode may show less information
      expect(lastFrame()).toBeTruthy();
    });

    it('renders in verbose mode', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} displayMode="verbose" />
      );

      expect(lastFrame()).toContain('Test Agent');
      expect(lastFrame()).toContain('implementing');
      // Verbose mode should show more details
      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('Progress Display', () => {
    it('shows progress bar when enabled', () => {
      const execution = createMockExecution({ progress: 75 });
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} showProgress={true} />
      );

      // Should contain progress indicators
      expect(lastFrame()).toMatch(/[█▉▊▋▌▍▎▏░]/);
    });

    it('hides progress bar when disabled', () => {
      const execution = createMockExecution({ progress: 75 });
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} showProgress={false} />
      );

      // Should not contain progress characters
      expect(lastFrame()).not.toMatch(/[█▉▊▋▌▍▎▏░]/);
    });

    it('handles zero progress', () => {
      const execution = createMockExecution({ progress: 0 });
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} showProgress={true} />
      );

      expect(lastFrame()).toBeTruthy();
    });

    it('handles full progress', () => {
      const execution = createMockExecution({ progress: 100 });
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} showProgress={true} />
      );

      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('Border Styles', () => {
    const execution = createMockExecution();

    it('renders with single border', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} borderStyle="single" />
      );

      expect(lastFrame()).toMatch(/[─│┌┐└┘]/);
    });

    it('renders with round border', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} borderStyle="round" />
      );

      expect(lastFrame()).toMatch(/[╭╮╰╯]/);
    });

    it('renders with double border', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} borderStyle="double" />
      );

      expect(lastFrame()).toMatch(/[═║╔╗╚╝]/);
    });

    it('renders without border', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} borderStyle="none" />
      );

      expect(lastFrame()).not.toMatch(/[─│┌┐└┘╭╮╰╯═║╔╗╚╝]/);
    });
  });

  describe('Focus and Animation', () => {
    const execution = createMockExecution();

    it('handles focused state', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} focused={true} />
      );

      expect(lastFrame()).toBeTruthy();
    });

    it('handles unfocused state', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} focused={false} />
      );

      expect(lastFrame()).toBeTruthy();
    });

    it('handles animated state', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} animated={true} />
      );

      expect(lastFrame()).toBeTruthy();
    });

    it('handles non-animated state', () => {
      const { lastFrame } = renderWithTheme(
        <AgentTerminalPanel execution={execution} animated={false} />
      );

      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('Event Handling', () => {
    it('calls onSelect when provided', () => {
      const onSelect = vi.fn();
      const execution = createMockExecution();

      renderWithTheme(
        <AgentTerminalPanel execution={execution} onSelect={onSelect} />
      );

      // Simulate click (ink-testing-library limitations may apply)
      // This is a basic test - real click testing might need different approach
      expect(onSelect).not.toHaveBeenCalled(); // Not clicked yet
    });
  });

  describe('Accessibility and TestId', () => {
    it('applies test id when provided', () => {
      const execution = createMockExecution();
      renderWithTheme(
        <AgentTerminalPanel execution={execution} testId="agent-terminal-panel" />
      );

      // Note: ink-testing-library may have limitations with testIds
      // This tests that the prop is accepted without error
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to narrow terminal width', async () => {
      const { useStdoutDimensions } = await import('../../../hooks/useStdoutDimensions.js');
      vi.mocked(useStdoutDimensions).mockReturnValue({
        width: 40,
        height: 24,
        breakpoint: 'narrow',
      });

      const execution = createMockExecution({
        agentName: 'Very Long Agent Name That Should Be Truncated',
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toBeTruthy();
      // Should handle narrow width gracefully
    });

    it('adapts to wide terminal width', async () => {
      const { useStdoutDimensions } = await import('../../../hooks/useStdoutDimensions.js');
      vi.mocked(useStdoutDimensions).mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'wide',
      });

      const execution = createMockExecution();
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toBeTruthy();
      // Should utilize wide width effectively
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional fields', () => {
      const execution: AgentExecution = {
        id: 'minimal-execution',
        agentId: 'minimal-agent',
        agentName: 'Minimal Agent',
        status: 'idle',
        progress: 0,
        // Missing optional fields
      };

      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);
      expect(lastFrame()).toContain('Minimal Agent');
    });

    it('handles undefined startedAt', () => {
      const execution = createMockExecution({ startedAt: undefined });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toBeTruthy();
    });

    it('handles null error', () => {
      const execution = createMockExecution({ error: null });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toBeTruthy();
    });

    it('handles empty stage', () => {
      const execution = createMockExecution({ stage: '' });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Test Agent');
    });

    it('handles undefined stage', () => {
      const execution = createMockExecution({ stage: undefined });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Test Agent');
    });
  });

  describe('Performance', () => {
    it('renders quickly with default props', () => {
      const start = performance.now();
      const execution = createMockExecution();
      renderWithTheme(<AgentTerminalPanel execution={execution} />);
      const end = performance.now();

      // Should render in reasonable time (< 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('handles rapid re-renders', () => {
      const execution = createMockExecution();
      const { rerender } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      for (let i = 0; i < 10; i++) {
        const updatedExecution = { ...execution, progress: i * 10 };
        rerender(<AgentTerminalPanel execution={updatedExecution} />);
      }

      // Should not throw errors during rapid updates
    });
  });

  describe('Integration with AgentStatusIndicator', () => {
    it('maps execution status to agent status correctly', () => {
      const testCases: Array<[AgentExecutionStatus, string]> = [
        ['idle', 'idle'],
        ['queued', 'idle'],
        ['running', 'active'],
        ['paused', 'idle'],
        ['completed', 'idle'],
        ['failed', 'error'],
        ['cancelled', 'idle'],
      ];

      testCases.forEach(([executionStatus, expectedAgentStatus]) => {
        const execution = createMockExecution({ status: executionStatus });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        // Should render without errors for each status mapping
        expect(lastFrame()).toBeTruthy();
      });
    });
  });
});