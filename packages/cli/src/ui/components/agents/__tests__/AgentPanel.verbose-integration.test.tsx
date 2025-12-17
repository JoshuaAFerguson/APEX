import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';

/**
 * Comprehensive integration tests for AgentPanel verbose mode
 * Focuses on edge cases, performance scenarios, and real-world usage patterns
 * that complement the existing test coverage.
 */
describe('AgentPanel - Verbose Mode Edge Cases & Integration', () => {
  // Mock hooks
  const mockUseAgentHandoff = vi.fn();
  const mockUseElapsedTime = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
    });
    mockUseElapsedTime.mockReturnValue('01:23');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  describe('extreme token count scenarios', () => {
    it('handles very large token counts with proper formatting', () => {
      const extremeTokenAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 999999999, output: 1234567890 },
            turnCount: 100,
            lastToolCall: 'LargeDataProcessing',
            errorCount: 0,
          },
        },
      ];

      render(
        <AgentPanel
          agents={extremeTokenAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should format very large numbers to millions
      expect(screen.getByText('🔢 Tokens: 999.9M→1234.5M')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 100')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: LargeDataProcessing')).toBeInTheDocument();
    });

    it('handles zero token counts', () => {
      const zeroTokenAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 0, output: 0 },
            turnCount: 1,
            lastToolCall: 'Initialize',
          },
        },
      ];

      render(
        <AgentPanel
          agents={zeroTokenAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔢 Tokens: 0→0')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Initialize')).toBeInTheDocument();
    });

    it('handles asymmetric token usage patterns', () => {
      const asymmetricAgent: AgentInfo[] = [
        {
          name: 'analyzer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 50000, output: 100 }, // High input, low output
          },
        },
      ];

      render(
        <AgentPanel
          agents={asymmetricAgent}
          currentAgent="analyzer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔢 Tokens: 50.0k→100')).toBeInTheDocument();
    });
  });

  describe('complex tool call scenarios', () => {
    it('handles tool calls with special characters and long names', () => {
      const specialToolAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            lastToolCall: 'AgentPanel.verbose-integration.test@2024-special_chars:with-dashes',
          },
        },
      ];

      render(
        <AgentPanel
          agents={specialToolAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔧 Last tool: AgentPanel.verbose-integration.test@2024-special_chars:with-dashes')).toBeInTheDocument();
    });

    it('handles empty tool call strings', () => {
      const emptyToolAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            lastToolCall: '',
            turnCount: 1,
          },
        },
      ];

      render(
        <AgentPanel
          agents={emptyToolAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔧 Last tool: ')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 1')).toBeInTheDocument();
    });

    it('handles tool calls with unicode characters', () => {
      const unicodeToolAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            lastToolCall: 'TestTool🧪→📊Analysis',
          },
        },
      ];

      render(
        <AgentPanel
          agents={unicodeToolAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔧 Last tool: TestTool🧪→📊Analysis')).toBeInTheDocument();
    });
  });

  describe('error count edge cases', () => {
    it('handles very high error counts', () => {
      const highErrorAgent: AgentInfo[] = [
        {
          name: 'problematic-agent',
          status: 'active',
          debugInfo: {
            errorCount: 9999,
            turnCount: 10000,
          },
        },
      ];

      render(
        <AgentPanel
          agents={highErrorAgent}
          currentAgent="problematic-agent"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('❌ Errors: 9999')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 10000')).toBeInTheDocument();
    });

    it('handles negative error counts (defensive programming)', () => {
      const negativeErrorAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            errorCount: -1, // Invalid but should be handled gracefully
            turnCount: 5,
          },
        },
      ];

      render(
        <AgentPanel
          agents={negativeErrorAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should not show negative errors
      expect(screen.queryByText('❌ Errors: -1')).not.toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
    });
  });

  describe('turn count edge cases', () => {
    it('handles zero turn count', () => {
      const zeroTurnAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            turnCount: 0,
            tokensUsed: { input: 1000, output: 500 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={zeroTurnAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔄 Turns: 0')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1k→500')).toBeInTheDocument();
    });

    it('handles negative turn count (defensive programming)', () => {
      const negativeTurnAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            turnCount: -5, // Invalid but should be handled
            tokensUsed: { input: 1000, output: 500 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={negativeTurnAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should not display negative turn counts
      expect(screen.queryByText('🔄 Turns: -5')).not.toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1k→500')).toBeInTheDocument();
    });
  });

  describe('multiple agents with debug info', () => {
    it('shows debug info only for active agent when multiple have debug data', () => {
      const multipleDebugAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            tokensUsed: { input: 1000, output: 800 },
            turnCount: 3,
            lastToolCall: 'PlanningTool',
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 5000, output: 3000 },
            turnCount: 8,
            lastToolCall: 'Edit',
            errorCount: 2,
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          debugInfo: {
            tokensUsed: { input: 500, output: 200 },
            turnCount: 1,
            lastToolCall: 'TestTool',
          },
        },
      ];

      render(
        <AgentPanel
          agents={multipleDebugAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Only developer's debug info should be shown
      expect(screen.getByText('🔢 Tokens: 5k→3k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 8')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();

      // Other agents' debug info should not be shown
      expect(screen.queryByText('🔢 Tokens: 1k→800')).not.toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: PlanningTool')).not.toBeInTheDocument();
      expect(screen.queryByText('🔢 Tokens: 500→200')).not.toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: TestTool')).not.toBeInTheDocument();
    });

    it('switches debug info display when current agent changes', () => {
      const agentsWithDebug: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 2000, output: 1500 },
            turnCount: 5,
            lastToolCall: 'Edit',
          },
        },
        {
          name: 'tester',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 800, output: 600 },
            turnCount: 3,
            lastToolCall: 'Test',
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agentsWithDebug}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Initially shows developer's debug info
      expect(screen.getByText('🔢 Tokens: 2k→1.5k')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: Test')).not.toBeInTheDocument();

      // Switch to tester
      rerender(
        <AgentPanel
          agents={agentsWithDebug}
          currentAgent="tester"
          displayMode="verbose"
        />
      );

      // Now shows tester's debug info
      expect(screen.getByText('🔢 Tokens: 800→600')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Test')).toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: Edit')).not.toBeInTheDocument();
    });
  });

  describe('display mode switching with debug info', () => {
    const richDebugAgent: AgentInfo[] = [
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        progress: 75,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        debugInfo: {
          tokensUsed: { input: 12500, output: 8750 },
          turnCount: 15,
          lastToolCall: 'ComplexEdit',
          errorCount: 3,
        },
      },
    ];

    it('maintains all standard features when switching to verbose mode', () => {
      const { rerender } = render(
        <AgentPanel
          agents={richDebugAgent}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Initially in normal mode - should have standard features
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/\[01:23\]/)).toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <AgentPanel
          agents={richDebugAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should still have all standard features plus debug info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/\[01:23\]/)).toBeInTheDocument();

      // Plus debug information
      expect(screen.getByText('🔢 Tokens: 12.5k→8.8k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 15')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: ComplexEdit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 3')).toBeInTheDocument();
    });

    it('hides debug info when switching from verbose to normal mode', () => {
      const { rerender } = render(
        <AgentPanel
          agents={richDebugAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Initially in verbose mode - should show debug info
      expect(screen.getByText('🔢 Tokens: 12.5k→8.8k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 15')).toBeInTheDocument();

      // Switch to normal mode
      rerender(
        <AgentPanel
          agents={richDebugAgent}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Debug info should be hidden
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();

      // Standard features should remain
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('hides debug info in compact mode even with verbose displayMode', () => {
      render(
        <AgentPanel
          agents={richDebugAgent}
          currentAgent="developer"
          displayMode="verbose"
          compact={true}
        />
      );

      // Compact mode should override verbose displayMode for debug info
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();

      // But should still show agent and progress
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });
  });

  describe('performance and stress testing scenarios', () => {
    it('handles many agents with extensive debug info', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 5 ? 'active' : 'waiting' as const,
        stage: `stage-${i}`,
        debugInfo: {
          tokensUsed: { input: 1000 * (i + 1), output: 500 * (i + 1) },
          turnCount: i + 1,
          lastToolCall: `Tool${i}`,
          errorCount: i % 3, // Varying error counts
        },
      }));

      render(
        <AgentPanel
          agents={manyAgents}
          currentAgent="agent-5"
          displayMode="verbose"
        />
      );

      // Should show all agent names
      manyAgents.forEach((agent) => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // Should only show debug info for active agent (agent-5)
      expect(screen.getByText('🔢 Tokens: 6k→3k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 6')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Tool5')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();

      // Should not show other agents' debug info
      expect(screen.queryByText('🔢 Tokens: 1k→500')).not.toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: Tool0')).not.toBeInTheDocument();
    });

    it('handles rapid switching between agents with debug info', () => {
      const switchableAgents: AgentInfo[] = [
        {
          name: 'agent-a',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 500 },
            lastToolCall: 'ToolA',
          },
        },
        {
          name: 'agent-b',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 2000, output: 1500 },
            lastToolCall: 'ToolB',
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={switchableAgents}
          currentAgent="agent-a"
          displayMode="verbose"
        />
      );

      // Initial state
      expect(screen.getByText('🔢 Tokens: 1k→500')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: ToolA')).toBeInTheDocument();

      // Rapid switching simulation
      for (let i = 0; i < 5; i++) {
        const currentAgent = i % 2 === 0 ? 'agent-b' : 'agent-a';
        rerender(
          <AgentPanel
            agents={switchableAgents}
            currentAgent={currentAgent}
            displayMode="verbose"
          />
        );

        if (currentAgent === 'agent-a') {
          expect(screen.getByText('🔢 Tokens: 1k→500')).toBeInTheDocument();
          expect(screen.getByText('🔧 Last tool: ToolA')).toBeInTheDocument();
        } else {
          expect(screen.getByText('🔢 Tokens: 2k→1.5k')).toBeInTheDocument();
          expect(screen.getByText('🔧 Last tool: ToolB')).toBeInTheDocument();
        }
      }
    });
  });

  describe('accessibility and usability', () => {
    it('maintains accessible content in verbose mode', () => {
      const accessibleAgent: AgentInfo[] = [
        {
          name: 'accessibility-agent',
          status: 'active',
          stage: 'testing-accessibility',
          debugInfo: {
            tokensUsed: { input: 2500, output: 1800 },
            turnCount: 7,
            lastToolCall: 'AccessibilityTest',
            errorCount: 0,
          },
        },
      ];

      render(
        <AgentPanel
          agents={accessibleAgent}
          currentAgent="accessibility-agent"
          displayMode="verbose"
        />
      );

      // All text content should be accessible
      expect(screen.getByText('accessibility-agent')).toBeInTheDocument();
      expect(screen.getByText(/testing-accessibility/)).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 2.5k→1.8k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 7')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: AccessibilityTest')).toBeInTheDocument();

      // Icons should be present and provide semantic meaning
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Active status
    });

    it('handles very long agent names in verbose mode', () => {
      const longNameAgent: AgentInfo[] = [
        {
          name: 'very-long-agent-name-that-might-cause-layout-issues-in-verbose-mode-display',
          status: 'active',
          stage: 'very-long-stage-name-for-testing-layout-handling',
          debugInfo: {
            tokensUsed: { input: 1500, output: 1200 },
            turnCount: 4,
            lastToolCall: 'VeryLongToolNameThatMightCauseWrappingIssues',
          },
        },
      ];

      render(
        <AgentPanel
          agents={longNameAgent}
          currentAgent="very-long-agent-name-that-might-cause-layout-issues-in-verbose-mode-display"
          displayMode="verbose"
        />
      );

      // Should handle long names gracefully
      expect(screen.getByText('very-long-agent-name-that-might-cause-layout-issues-in-verbose-mode-display')).toBeInTheDocument();
      expect(screen.getByText(/very-long-stage-name-for-testing-layout-handling/)).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: VeryLongToolNameThatMightCauseWrappingIssues')).toBeInTheDocument();
    });
  });

  describe('defensive programming and error resilience', () => {
    it('handles corrupted debug info gracefully', () => {
      const corruptedAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            // @ts-expect-error Testing invalid data
            tokensUsed: { input: 'invalid', output: null },
            // @ts-expect-error Testing invalid data
            turnCount: 'not-a-number',
            lastToolCall: undefined,
            // @ts-expect-error Testing invalid data
            errorCount: NaN,
          },
        },
      ];

      render(
        <AgentPanel
          agents={corruptedAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should render agent name but handle invalid debug data gracefully
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should not crash or render invalid data
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('handles agent with malformed name in verbose mode', () => {
      const malformedAgent: AgentInfo[] = [
        {
          // @ts-expect-error Testing edge case
          name: null,
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 500 },
            turnCount: 1,
          },
        },
      ];

      // Should not crash even with invalid agent data
      render(
        <AgentPanel
          agents={malformedAgent}
          currentAgent={null as any}
          displayMode="verbose"
        />
      );

      // Should render the component without crashing
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });
});