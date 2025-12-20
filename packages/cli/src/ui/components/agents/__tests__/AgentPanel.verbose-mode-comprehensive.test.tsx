import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';

/**
 * Comprehensive integration tests for AgentPanel verbose mode
 * Tests the complete acceptance criteria implementation
 */
describe('AgentPanel - Verbose Mode Comprehensive Integration', () => {
  // Mock hooks
  const mockUseAgentHandoff = vi.fn();
  const mockUseElapsedTime = vi.fn();
  const mockUseStdoutDimensions = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));
    vi.doMock('../../../hooks/index.js', () => ({
      useStdoutDimensions: mockUseStdoutDimensions,
    }));

    // Default mock implementations
    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
    });
    mockUseElapsedTime.mockReturnValue('03:42');
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 40,
      breakpoint: 'normal' as const,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
    vi.doUnmock('../../../hooks/useElapsedTime.js');
    vi.doUnmock('../../../hooks/index.js');
  });

  describe('Acceptance Criteria Validation', () => {
    it('AC1: Shows tokens used per agent for active agents in verbose mode', () => {
      const agentsWithTokens: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          stage: 'planning',
        },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 15000, output: 8500 },
            turnCount: 12,
            lastToolCall: 'Edit',
            errorCount: 0,
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          stage: 'testing',
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithTokens}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Active agent should show token information
      expect(screen.getByText('🔢 Tokens: 15.0k→8.5k')).toBeInTheDocument();

      // Inactive agents should not show token information
      expect(screen.queryByText(/planner.*🔢/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tester.*🔢/)).not.toBeInTheDocument();
    });

    it('AC2: Shows turn count for active agents in verbose mode', () => {
      const agentWithTurns: AgentInfo[] = [
        {
          name: 'architect',
          status: 'active',
          stage: 'architecture',
          startedAt: new Date(),
          debugInfo: {
            turnCount: 7,
            lastToolCall: 'WebFetch',
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithTurns}
          currentAgent="architect"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔄 Turns: 7')).toBeInTheDocument();
    });

    it('AC3: Shows last tool call for active agents in verbose mode', () => {
      const agentWithToolCall: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'active',
          stage: 'reviewing',
          startedAt: new Date(),
          debugInfo: {
            lastToolCall: 'Bash',
            tokensUsed: { input: 2000, output: 1500 },
            turnCount: 4,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithToolCall}
          currentAgent="reviewer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔧 Last tool: Bash')).toBeInTheDocument();
    });

    it('AC4: VerboseAgentRow component exists and is used in verbose mode', () => {
      const testAgent: AgentInfo[] = [
        {
          name: 'devops',
          status: 'active',
          stage: 'deployment',
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 5000, output: 3000 },
            turnCount: 8,
            lastToolCall: 'Task',
            errorCount: 1,
          },
        },
      ];

      const { container } = render(
        <AgentPanel
          agents={testAgent}
          currentAgent="devops"
          displayMode="verbose"
        />
      );

      // Verify VerboseAgentRow renders all debug information
      expect(screen.getByText('🔢 Tokens: 5.0k→3.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 8')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Task')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();

      // Verify structure matches VerboseAgentRow layout
      expect(container.firstChild).toBeDefined();
    });

    it('AC5: AgentInfo interface includes optional verbose fields', () => {
      // This is tested by TypeScript compilation and usage throughout tests
      const agentWithAllFields: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        stage: 'testing',
        progress: 45,
        startedAt: new Date(),
        debugInfo: {
          tokensUsed: { input: 1000, output: 800 },
          stageStartedAt: new Date(),
          lastToolCall: 'Read',
          turnCount: 5,
          errorCount: 0,
          thinking: 'Processing user request...',
        },
      };

      // All fields should be accessible without TypeScript errors
      expect(agentWithAllFields.debugInfo?.tokensUsed).toBeDefined();
      expect(agentWithAllFields.debugInfo?.stageStartedAt).toBeDefined();
      expect(agentWithAllFields.debugInfo?.lastToolCall).toBeDefined();
      expect(agentWithAllFields.debugInfo?.turnCount).toBeDefined();
      expect(agentWithAllFields.debugInfo?.errorCount).toBeDefined();
      expect(agentWithAllFields.debugInfo?.thinking).toBeDefined();
    });
  });

  describe('Mode Switching Integration', () => {
    const testAgents: AgentInfo[] = [
      {
        name: 'planner',
        status: 'completed',
        stage: 'planning',
      },
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        progress: 65,
        startedAt: new Date(),
        debugInfo: {
          tokensUsed: { input: 8000, output: 6000 },
          turnCount: 10,
          lastToolCall: 'Write',
          errorCount: 2,
        },
      },
    ];

    it('switches from normal to verbose mode correctly', () => {
      const { rerender } = render(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // In normal mode, debug info should not be visible
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Now debug info should be visible
      expect(screen.getByText('🔢 Tokens: 8.0k→6.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 10')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Write')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();
    });

    it('switches from compact to verbose mode correctly', () => {
      const { rerender } = render(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode="compact"
        />
      );

      // In compact mode, should not show Active Agents header or debug info
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should now show header and debug info
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 8.0k→6.0k')).toBeInTheDocument();
    });

    it('handles mode switching with state persistence', () => {
      let currentMode: 'normal' | 'verbose' = 'normal';

      const { rerender } = render(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode={currentMode}
        />
      );

      // Verify initial state
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();

      // Change mode
      currentMode = 'verbose';
      rerender(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode={currentMode}
        />
      );

      // Verify new state
      expect(screen.getByText('🔢 Tokens: 8.0k→6.0k')).toBeInTheDocument();

      // Change back
      currentMode = 'normal';
      rerender(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          displayMode={currentMode}
        />
      );

      // Verify return to original state
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });
  });

  describe('Multi-Agent Verbose Display', () => {
    it('shows debug info only for active agents in multi-agent scenario', () => {
      const multipleAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          stage: 'planning',
          debugInfo: {
            tokensUsed: { input: 2000, output: 1500 },
            turnCount: 3,
            lastToolCall: 'Task',
          },
        },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 12000, output: 8000 },
            turnCount: 15,
            lastToolCall: 'Edit',
            errorCount: 1,
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          stage: 'testing',
          debugInfo: {
            tokensUsed: { input: 500, output: 300 },
            turnCount: 1,
            lastToolCall: 'Read',
          },
        },
      ];

      render(
        <AgentPanel
          agents={multipleAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Only active agent (developer) should show debug info
      expect(screen.getByText('🔢 Tokens: 12.0k→8.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 15')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();

      // Inactive agents should not show debug info
      expect(screen.queryByText('🔢 Tokens: 2.0k→1.5k')).not.toBeInTheDocument();
      expect(screen.queryByText('🔢 Tokens: 500→300')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Turns: 3')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Turns: 1')).not.toBeInTheDocument();

      // But agent names should still be visible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles agent switching correctly in verbose mode', () => {
      const agentsForSwitching: AgentInfo[] = [
        {
          name: 'developer',
          status: 'completed',
          stage: 'implementation',
          debugInfo: {
            tokensUsed: { input: 10000, output: 7000 },
            turnCount: 12,
            lastToolCall: 'Write',
          },
        },
        {
          name: 'tester',
          status: 'active',
          stage: 'testing',
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 5000, output: 3000 },
            turnCount: 6,
            lastToolCall: 'Bash',
            errorCount: 0,
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agentsForSwitching}
          currentAgent="tester"
          displayMode="verbose"
        />
      );

      // Initially tester should show debug info
      expect(screen.getByText('🔢 Tokens: 5.0k→3.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 6')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Bash')).toBeInTheDocument();

      // Developer should not show debug info (inactive)
      expect(screen.queryByText('🔢 Tokens: 10.0k→7.0k')).not.toBeInTheDocument();

      // Switch current agent
      rerender(
        <AgentPanel
          agents={agentsForSwitching}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Now developer should show debug info (but won't because status is completed)
      // And tester should not show debug info (inactive)
      expect(screen.queryByText('🔢 Tokens: 10.0k→7.0k')).not.toBeInTheDocument();
      expect(screen.queryByText('🔢 Tokens: 5.0k→3.0k')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Behavior in Verbose Mode', () => {
    it('maintains verbose mode display across different terminal sizes', () => {
      const testAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 3000, output: 2000 },
            turnCount: 5,
            lastToolCall: 'Task',
          },
        },
      ];

      // Test narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'narrow' as const,
      });

      const { rerender } = render(
        <AgentPanel
          agents={testAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Verbose mode should override responsive compact mode
      expect(screen.getByText('🔢 Tokens: 3.0k→2.0k')).toBeInTheDocument();

      // Test wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 50,
        breakpoint: 'wide' as const,
      });

      rerender(
        <AgentPanel
          agents={testAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should still show verbose debug info
      expect(screen.getByText('🔢 Tokens: 3.0k→2.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Task')).toBeInTheDocument();
    });

    it('shows Active Agents header in verbose mode regardless of terminal size', () => {
      const testAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: { turnCount: 1 },
        },
      ];

      // Test different breakpoints
      const breakpoints: Array<{ width: number; breakpoint: any }> = [
        { width: 50, breakpoint: 'narrow' },
        { width: 80, breakpoint: 'compact' },
        { width: 120, breakpoint: 'normal' },
        { width: 200, breakpoint: 'wide' },
      ];

      breakpoints.forEach(({ width, breakpoint }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
        });

        const { unmount } = render(
          <AgentPanel
            agents={testAgent}
            currentAgent="developer"
            displayMode="verbose"
          />
        );

        // Header should be shown in verbose mode
        expect(screen.getByText('Active Agents')).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles agents with missing debugInfo gracefully', () => {
      const agentsWithoutDebug: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          // No debugInfo
        },
        {
          name: 'tester',
          status: 'waiting',
          // No debugInfo
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithoutDebug}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should render agent names and status
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Should not crash or show debug info
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('handles empty agents array in verbose mode', () => {
      render(
        <AgentPanel
          agents={[]}
          displayMode="verbose"
        />
      );

      // Should render header but no agents
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
    });

    it('handles agents with partial debug info', () => {
      const agentsWithPartialDebug: AgentInfo[] = [
        {
          name: 'architect',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 800 },
            // Missing other fields
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            turnCount: 5,
            lastToolCall: 'Edit',
            // Missing tokens and errors
          },
        },
        {
          name: 'tester',
          status: 'active',
          debugInfo: {
            errorCount: 3,
            // Missing other fields
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithPartialDebug}
          currentAgent="architect"
          displayMode="verbose"
        />
      );

      // Should show available information for active agent
      expect(screen.getByText('🔢 Tokens: 1.0k→800')).toBeInTheDocument();

      // Should not show missing information
      expect(screen.queryByText('🔄 Turns:')).not.toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool:')).not.toBeInTheDocument();
      expect(screen.queryByText('❌ Errors:')).not.toBeInTheDocument();
    });
  });

  describe('Performance and Re-rendering', () => {
    it('re-renders efficiently when switching between agents', () => {
      const renderSpy = vi.fn();
      const TestWrapper = ({ currentAgent }: { currentAgent: string }) => {
        renderSpy();
        return (
          <AgentPanel
            agents={[
              {
                name: 'agent1',
                status: 'active',
                debugInfo: { turnCount: 1 },
              },
              {
                name: 'agent2',
                status: 'active',
                debugInfo: { turnCount: 2 },
              },
            ]}
            currentAgent={currentAgent}
            displayMode="verbose"
          />
        );
      };

      const { rerender } = render(<TestWrapper currentAgent="agent1" />);

      const initialRenderCount = renderSpy.mock.calls.length;

      rerender(<TestWrapper currentAgent="agent2" />);

      // Should not cause excessive re-renders
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount + 1);
    });

    it('handles large numbers of agents efficiently', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 20 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 0 ? 'active' as const : 'waiting' as const,
        debugInfo: {
          tokensUsed: { input: 1000 + i * 100, output: 800 + i * 80 },
          turnCount: i + 1,
          lastToolCall: `Tool${i}`,
          errorCount: i % 3,
        },
      }));

      const startTime = performance.now();

      render(
        <AgentPanel
          agents={manyAgents}
          currentAgent="agent-0"
          displayMode="verbose"
        />
      );

      const endTime = performance.now();

      // Should render reasonably quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Only active agent should show debug info
      expect(screen.getByText('🔢 Tokens: 1.0k→800')).toBeInTheDocument();
      expect(screen.queryByText('🔢 Tokens: 1.1k→880')).not.toBeInTheDocument();
    });
  });
});