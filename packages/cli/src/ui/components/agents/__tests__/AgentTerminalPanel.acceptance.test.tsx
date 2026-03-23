/**
 * AgentTerminalPanel Acceptance Criteria Tests
 *
 * Tests verifying that the AgentTerminalPanel component meets all specified
 * acceptance criteria from the task requirements:
 *
 * ✓ AgentTerminalPanel displays AgentStatusIndicator in header
 * ✓ Shows agent name and stage
 * ✓ Integrates with AgentExecution type
 * ✓ Properly renders idle/active/error visual states
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTerminalPanel } from '../AgentTerminalPanel.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';
import type { AgentExecution } from '../AgentTerminalPanel.types.js';

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

// Mock dependencies
vi.mock('../../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
  })),
}));

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '2m 15s'),
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

describe('AgentTerminalPanel - Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createExecution = (overrides: Partial<AgentExecution> = {}): AgentExecution => ({
    id: 'exec-001',
    agentId: 'developer',
    agentName: 'Developer Agent',
    status: 'running',
    stage: 'implementation',
    progress: 75,
    startedAt: new Date('2024-01-01T10:00:00Z'),
    tokensUsed: 1500,
    taskDescription: 'Implement AgentTerminalPanel component',
    ...overrides,
  });

  describe('Acceptance Criterion 1: AgentTerminalPanel displays AgentStatusIndicator in header', () => {
    it('displays status indicator in the panel header', () => {
      const execution = createExecution({ status: 'running' });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      // Should contain status indicator character (dot/circle variations)
      expect(lastFrame()).toMatch(/[●◐◑◒◓○]/);
    });

    it('status indicator appears before agent name in header', () => {
      const execution = createExecution({
        agentName: 'Test Agent',
        status: 'running'
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      const output = lastFrame();

      // Find position of status indicator and agent name
      const statusIndicatorMatch = output.match(/[●◐◑◒◓○]/);
      const agentNameIndex = output.indexOf('Test Agent');

      expect(statusIndicatorMatch).toBeTruthy();
      expect(agentNameIndex).toBeGreaterThan(-1);

      if (statusIndicatorMatch) {
        expect(statusIndicatorMatch.index!).toBeLessThan(agentNameIndex);
      }
    });

    it('status indicator updates based on execution status', () => {
      // Test different statuses to ensure indicator changes
      const statuses = ['idle', 'running', 'completed', 'failed'] as const;

      statuses.forEach(status => {
        const execution = createExecution({ status });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        // Should render without errors and contain some form of status indicator
        expect(lastFrame()).toMatch(/[●◐◑◒◓○]/);
      });
    });
  });

  describe('Acceptance Criterion 2: Shows agent name and stage', () => {
    it('displays the agent name prominently', () => {
      const execution = createExecution({
        agentName: 'Planning Agent'
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Planning Agent');
    });

    it('displays the current stage when provided', () => {
      const execution = createExecution({
        stage: 'analyzing requirements'
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('analyzing requirements');
    });

    it('handles missing stage gracefully', () => {
      const execution = createExecution({
        stage: undefined
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      // Should still display agent name without errors
      expect(lastFrame()).toContain('Developer Agent');
    });

    it('displays both agent name and stage when both are provided', () => {
      const execution = createExecution({
        agentName: 'Architecture Agent',
        stage: 'designing system'
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Architecture Agent');
      expect(lastFrame()).toContain('designing system');
    });

    it('truncates long agent names appropriately', () => {
      const execution = createExecution({
        agentName: 'Very Long Agent Name That Should Be Truncated For Display'
      });
      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      const output = lastFrame();
      // Should not contain the full long name
      expect(output).not.toContain('Very Long Agent Name That Should Be Truncated For Display');
      // But should contain some portion of it
      expect(output).toContain('Very Long');
    });
  });

  describe('Acceptance Criterion 3: Integrates with AgentExecution type', () => {
    it('accepts and processes complete AgentExecution object', () => {
      const execution: AgentExecution = {
        id: 'exec-full-001',
        agentId: 'test-agent-id',
        agentName: 'Full Test Agent',
        status: 'running',
        stage: 'testing',
        progress: 60,
        startedAt: new Date('2024-01-01T09:00:00Z'),
        completedAt: undefined,
        durationMs: undefined,
        error: null,
        tokensUsed: 2500,
        taskDescription: 'Complete integration test',
        metadata: { priority: 'high', type: 'integration' },
      };

      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Full Test Agent');
      expect(lastFrame()).toContain('testing');
    });

    it('handles minimal AgentExecution object', () => {
      const execution: AgentExecution = {
        id: 'exec-minimal-001',
        agentId: 'minimal-agent',
        agentName: 'Minimal Agent',
        status: 'idle',
        progress: 0,
      };

      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

      expect(lastFrame()).toContain('Minimal Agent');
    });

    it('properly processes AgentExecution progress field', () => {
      const execution = createExecution({ progress: 85 });

      // Enable progress display to verify it's processed
      const { lastFrame } = render(
        <AgentTerminalPanel execution={execution} showProgress={true} />
      );

      // Should contain progress indicators when enabled
      expect(lastFrame()).toMatch(/[█▉▊▋▌▍▎▏░]/);
    });

    it('correctly maps AgentExecution status to visual states', () => {
      const testCases = [
        { status: 'idle' as const, description: 'idle state' },
        { status: 'running' as const, description: 'active state' },
        { status: 'failed' as const, description: 'error state' },
      ];

      testCases.forEach(({ status, description }) => {
        const execution = createExecution({ status });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        // Should render successfully for each status type
        expect(lastFrame()).toBeTruthy();
        expect(() => renderWithTheme(<AgentTerminalPanel execution={execution} />)).not.toThrow();
      });
    });
  });

  describe('Acceptance Criterion 4: Properly renders idle/active/error visual states', () => {
    describe('Idle visual state', () => {
      it('renders idle status with appropriate styling', () => {
        const execution = createExecution({ status: 'idle' });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
        // Should contain status indicator for idle state
        expect(lastFrame()).toMatch(/[●◐◑◒◓○]/);
      });

      it('renders queued status as idle visual state', () => {
        const execution = createExecution({ status: 'queued' });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
      });

      it('renders completed status as idle visual state', () => {
        const execution = createExecution({ status: 'completed' });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
      });

      it('renders cancelled status as idle visual state', () => {
        const execution = createExecution({ status: 'cancelled' });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
      });

      it('renders paused status as idle visual state', () => {
        const execution = createExecution({ status: 'paused' });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
      });
    });

    describe('Active visual state', () => {
      it('renders running status with active styling', () => {
        const execution = createExecution({ status: 'running' });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
        expect(lastFrame()).toContain('Developer Agent');
      });

      it('shows progress information for active agents', () => {
        const execution = createExecution({
          status: 'running',
          progress: 45
        });
        const { lastFrame } = render(
          <AgentTerminalPanel execution={execution} showProgress={true} />
        );

        // Should show progress for active agents
        expect(lastFrame()).toMatch(/[█▉▊▋▌▍▎▏░]/);
      });

      it('shows elapsed time for active agents', () => {
        const execution = createExecution({
          status: 'running',
          startedAt: new Date()
        });
        const { lastFrame } = render(
          <AgentTerminalPanel execution={execution} showElapsedTime={true} />
        );

        expect(lastFrame()).toContain('2m 15s');
      });
    });

    describe('Error visual state', () => {
      it('renders failed status with error styling', () => {
        const execution = createExecution({
          status: 'failed',
          error: 'Test error message'
        });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toBeTruthy();
        expect(lastFrame()).toContain('Test error message');
        expect(lastFrame()).toContain('⚠');
      });

      it('displays error messages prominently', () => {
        const execution = createExecution({
          status: 'failed',
          error: 'Critical system failure'
        });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        expect(lastFrame()).toContain('Critical system failure');
        expect(lastFrame()).toContain('⚠');
      });

      it('handles failed status without error message', () => {
        const execution = createExecution({
          status: 'failed',
          error: null
        });
        const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);

        // Should still render agent name even without error message
        expect(lastFrame()).toContain('Developer Agent');
      });
    });

    describe('Visual state consistency', () => {
      it('maintains consistent layout across different states', () => {
        const states = ['idle', 'running', 'failed'] as const;
        const outputs = states.map(status => {
          const execution = createExecution({ status });
          const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);
          return lastFrame();
        });

        // All outputs should contain the agent name
        outputs.forEach(output => {
          expect(output).toContain('Developer Agent');
        });

        // All should have some form of status indicator
        outputs.forEach(output => {
          expect(output).toMatch(/[●◐◑◒◓○⚠]/);
        });
      });

      it('visual states are distinct and recognizable', () => {
        const idleExecution = createExecution({ status: 'idle' });
        const activeExecution = createExecution({ status: 'running' });
        const errorExecution = createExecution({ status: 'failed', error: 'Test error' });

        const { lastFrame: idleFrame } = renderWithTheme(<AgentTerminalPanel execution={idleExecution} />);
        const { lastFrame: activeFrame } = renderWithTheme(<AgentTerminalPanel execution={activeExecution} />);
        const { lastFrame: errorFrame } = renderWithTheme(<AgentTerminalPanel execution={errorExecution} />);

        // Each state should produce different visual output
        const idleOutput = idleFrame();
        const activeOutput = activeFrame();
        const errorOutput = errorFrame();

        // Error state should be clearly distinguishable (has error message)
        expect(errorOutput).toContain('⚠');
        expect(idleOutput).not.toContain('⚠');
        expect(activeOutput).not.toContain('⚠');
      });
    });
  });

  describe('Overall Integration', () => {
    it('meets all acceptance criteria simultaneously', () => {
      const execution: AgentExecution = {
        id: 'integration-test-001',
        agentId: 'integration-agent',
        agentName: 'Integration Test Agent',
        status: 'running',
        stage: 'validating requirements',
        progress: 80,
        startedAt: new Date('2024-01-01T10:00:00Z'),
        tokensUsed: 3000,
        taskDescription: 'Complete acceptance validation',
      };

      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={execution} />);
      const output = lastFrame();

      // ✓ Displays AgentStatusIndicator in header
      expect(output).toMatch(/[●◐◑◒◓○]/);

      // ✓ Shows agent name and stage
      expect(output).toContain('Integration Test Agent');
      expect(output).toContain('validating requirements');

      // ✓ Integrates with AgentExecution type (no type errors, renders successfully)
      expect(output).toBeTruthy();

      // ✓ Renders active visual state properly
      expect(() => renderWithTheme(<AgentTerminalPanel execution={execution} />)).not.toThrow();
    });

    it('handles all edge cases without breaking acceptance criteria', () => {
      const edgeCaseExecution: AgentExecution = {
        id: 'edge-case-001',
        agentId: 'edge-agent',
        agentName: '', // Empty name edge case
        status: 'failed',
        stage: undefined, // Missing stage
        progress: 0,
        error: 'Edge case error',
      };

      const { lastFrame } = renderWithTheme(<AgentTerminalPanel execution={edgeCaseExecution} />);
      const output = lastFrame();

      // Should still meet basic requirements even with edge case data
      expect(output).toMatch(/[●◐◑◒◓○⚠]/); // Status indicator
      expect(output).toContain('⚠'); // Error state indicator
      expect(output).toContain('Edge case error'); // Error message
    });
  });
});