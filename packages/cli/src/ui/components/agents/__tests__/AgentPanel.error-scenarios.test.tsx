import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';

/**
 * Error scenario and edge case tests for AgentPanel and VerboseAgentRow
 * Tests component resilience to invalid data and unexpected conditions
 */
describe('AgentPanel - Error Scenarios & Edge Cases', () => {
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
    mockUseElapsedTime.mockReturnValue('05:30');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  describe('invalid agent data scenarios', () => {
    it('handles agents with null names gracefully', () => {
      const invalidAgents = [
        // @ts-expect-error Testing invalid data
        { name: null, status: 'active' },
        { name: 'valid-agent', status: 'waiting' },
      ] as AgentInfo[];

      render(
        <AgentPanel
          agents={invalidAgents}
          currentAgent="valid-agent"
          displayMode="normal"
        />
      );

      // Should render what it can and not crash
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('valid-agent')).toBeInTheDocument();
      // Component should not crash
    });

    it('handles agents with undefined names', () => {
      const invalidAgents = [
        // @ts-expect-error Testing invalid data
        { name: undefined, status: 'active' },
        { name: 'valid-agent', status: 'completed' },
      ] as AgentInfo[];

      render(
        <AgentPanel
          agents={invalidAgents}
          currentAgent="valid-agent"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('valid-agent')).toBeInTheDocument();
    });

    it('handles agents with empty string names', () => {
      const emptyNameAgents: AgentInfo[] = [
        { name: '', status: 'active' },
        { name: 'normal-agent', status: 'waiting' },
      ];

      render(
        <AgentPanel
          agents={emptyNameAgents}
          currentAgent=""
          displayMode="normal"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('normal-agent')).toBeInTheDocument();
      // Empty name agent should still render without crashing
    });

    it('handles agents with invalid status values', () => {
      const invalidStatusAgents = [
        // @ts-expect-error Testing invalid data
        { name: 'agent1', status: 'unknown-status' },
        // @ts-expect-error Testing invalid data
        { name: 'agent2', status: null },
        { name: 'agent3', status: 'active' },
      ] as AgentInfo[];

      render(
        <AgentPanel
          agents={invalidStatusAgents}
          currentAgent="agent3"
          displayMode="normal"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });
  });

  describe('corrupted debug info scenarios', () => {
    it('handles corrupted token data in verbose mode', () => {
      const corruptedTokenAgent: AgentInfo[] = [
        {
          name: 'corrupted-agent',
          status: 'active',
          debugInfo: {
            // @ts-expect-error Testing invalid data
            tokensUsed: { input: 'invalid', output: 'also-invalid' },
            turnCount: 5,
            lastToolCall: 'ValidTool',
          },
        },
      ];

      render(
        <AgentPanel
          agents={corruptedTokenAgent}
          currentAgent="corrupted-agent"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('corrupted-agent')).toBeInTheDocument();

      // Should not display corrupted token info
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();

      // Should still display valid fields
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: ValidTool')).toBeInTheDocument();
    });

    it('handles malformed tokensUsed object', () => {
      const malformedTokenAgent: AgentInfo[] = [
        {
          name: 'malformed-agent',
          status: 'active',
          debugInfo: {
            // @ts-expect-error Testing invalid data
            tokensUsed: 'not-an-object',
            turnCount: 3,
          },
        },
      ];

      render(
        <AgentPanel
          agents={malformedTokenAgent}
          currentAgent="malformed-agent"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('malformed-agent')).toBeInTheDocument();
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
    });

    it('handles negative or invalid progress values', () => {
      const invalidProgressAgents: AgentInfo[] = [
        { name: 'negative-progress', status: 'active', progress: -50 },
        { name: 'over-100-progress', status: 'active', progress: 150 },
        // @ts-expect-error Testing invalid data
        { name: 'string-progress', status: 'active', progress: 'fifty' },
        // @ts-expect-error Testing invalid data
        { name: 'nan-progress', status: 'active', progress: NaN },
      ];

      render(
        <AgentPanel
          agents={invalidProgressAgents}
          currentAgent="negative-progress"
          displayMode="normal"
        />
      );

      // Should render agents without crashing
      expect(screen.getByText('negative-progress')).toBeInTheDocument();
      expect(screen.getByText('over-100-progress')).toBeInTheDocument();
      expect(screen.getByText('string-progress')).toBeInTheDocument();
      expect(screen.getByText('nan-progress')).toBeInTheDocument();

      // Should not show invalid progress values
      expect(screen.queryByText(/-50%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/150%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/fifty%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
    });

    it('handles invalid turn count values in verbose mode', () => {
      const invalidTurnAgents: AgentInfo[] = [
        {
          name: 'negative-turns',
          status: 'active',
          debugInfo: {
            turnCount: -5,
            tokensUsed: { input: 1000, output: 500 },
          },
        },
        {
          name: 'string-turns',
          status: 'active',
          debugInfo: {
            // @ts-expect-error Testing invalid data
            turnCount: 'many',
            tokensUsed: { input: 1500, output: 800 },
          },
        },
        {
          name: 'nan-turns',
          status: 'active',
          debugInfo: {
            turnCount: NaN,
            tokensUsed: { input: 2000, output: 1000 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={invalidTurnAgents}
          currentAgent="negative-turns"
          displayMode="verbose"
        />
      );

      // Should show valid token data
      expect(screen.getByText('🔢 Tokens: 1k→500')).toBeInTheDocument();

      // Should not show invalid turn counts
      expect(screen.queryByText(/🔄 Turns: -5/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns: many/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns: NaN/)).not.toBeInTheDocument();

      // Test other invalid agents
      const { rerender } = render(
        <AgentPanel
          agents={invalidTurnAgents}
          currentAgent="string-turns"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔢 Tokens: 1.5k→800')).toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();

      rerender(
        <AgentPanel
          agents={invalidTurnAgents}
          currentAgent="nan-turns"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔢 Tokens: 2k→1k')).toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
    });

    it('handles invalid error count values', () => {
      const invalidErrorAgents: AgentInfo[] = [
        {
          name: 'negative-errors',
          status: 'active',
          debugInfo: {
            errorCount: -10,
            turnCount: 5,
          },
        },
        {
          name: 'string-errors',
          status: 'active',
          debugInfo: {
            // @ts-expect-error Testing invalid data
            errorCount: 'none',
            turnCount: 8,
          },
        },
      ];

      render(
        <AgentPanel
          agents={invalidErrorAgents}
          currentAgent="negative-errors"
          displayMode="verbose"
        />
      );

      // Should show valid turn count
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();

      // Should not show negative error count
      expect(screen.queryByText(/❌ Errors: -10/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors: none/)).not.toBeInTheDocument();
    });
  });

  describe('edge cases with dates and times', () => {
    it('handles invalid startedAt dates', () => {
      const invalidDateAgents: AgentInfo[] = [
        {
          name: 'invalid-date',
          status: 'active',
          // @ts-expect-error Testing invalid data
          startedAt: 'not-a-date',
        },
        {
          name: 'null-date',
          status: 'active',
          // @ts-expect-error Testing invalid data
          startedAt: null,
        },
        {
          name: 'valid-date',
          status: 'active',
          startedAt: new Date('2023-01-01T10:00:00Z'),
        },
      ];

      render(
        <AgentPanel
          agents={invalidDateAgents}
          currentAgent="invalid-date"
          displayMode="normal"
        />
      );

      // Should render agents without crashing
      expect(screen.getByText('invalid-date')).toBeInTheDocument();
      expect(screen.getByText('null-date')).toBeInTheDocument();
      expect(screen.getByText('valid-date')).toBeInTheDocument();

      // Only valid date should show elapsed time
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // for invalid dates
    });

    it('handles future startedAt dates', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const futureDateAgent: AgentInfo[] = [
        {
          name: 'future-agent',
          status: 'active',
          startedAt: futureDate,
        },
      ];

      render(
        <AgentPanel
          agents={futureDateAgent}
          currentAgent="future-agent"
          displayMode="normal"
        />
      );

      expect(screen.getByText('future-agent')).toBeInTheDocument();
      // Hook should still be called with the future date
      expect(mockUseElapsedTime).toHaveBeenCalledWith(futureDate);
    });
  });

  describe('memory and performance edge cases', () => {
    it('handles very large arrays of agents', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 50 ? 'active' : 'idle' as const,
        stage: `stage-${i}`,
        progress: i,
        debugInfo: {
          tokensUsed: { input: 1000 * i, output: 500 * i },
          turnCount: i + 1,
          lastToolCall: `Tool${i}`,
          errorCount: i % 5,
        },
      }));

      render(
        <AgentPanel
          agents={manyAgents}
          currentAgent="agent-50"
          displayMode="verbose"
        />
      );

      // Should render without performance issues
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('agent-50')).toBeInTheDocument();

      // Should only show debug info for active agent (agent-50)
      expect(screen.getByText('🔢 Tokens: 50.0k→25.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 51')).toBeInTheDocument();
    });

    it('handles agents with extremely long names and data', () => {
      const longDataAgent: AgentInfo[] = [
        {
          name: 'a'.repeat(1000), // Very long name
          status: 'active',
          stage: 'b'.repeat(500), // Very long stage
          debugInfo: {
            tokensUsed: { input: 1000, output: 500 },
            lastToolCall: 'c'.repeat(200), // Very long tool name
            turnCount: 5,
          },
        },
      ];

      render(
        <AgentPanel
          agents={longDataAgent}
          currentAgent={'a'.repeat(1000)}
          displayMode="verbose"
        />
      );

      // Should handle long strings without crashing
      expect(screen.getByText('a'.repeat(1000))).toBeInTheDocument();
      expect(screen.getByText(new RegExp('b'.repeat(500)))).toBeInTheDocument();
      expect(screen.getByText(`🔧 Last tool: ${'c'.repeat(200)}`)).toBeInTheDocument();
    });
  });

  describe('concurrent update scenarios', () => {
    it('handles rapid agent updates without state corruption', () => {
      const initialAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 10 },
        { name: 'agent2', status: 'waiting' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={initialAgents}
          currentAgent="agent1"
          displayMode="normal"
        />
      );

      // Simulate rapid updates
      for (let i = 0; i < 50; i++) {
        const updatedAgents: AgentInfo[] = [
          { name: 'agent1', status: 'active', progress: i },
          { name: 'agent2', status: i % 2 === 0 ? 'waiting' : 'active' },
        ];

        rerender(
          <AgentPanel
            agents={updatedAgents}
            currentAgent={i % 2 === 0 ? 'agent1' : 'agent2'}
            displayMode={i % 3 === 0 ? 'verbose' : 'normal'}
          />
        );

        // Should maintain consistency
        expect(screen.getByText('agent1')).toBeInTheDocument();
        expect(screen.getByText('agent2')).toBeInTheDocument();
      }
    });

    it('handles simultaneous mode and data changes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={[{ name: 'test', status: 'active' }]}
          currentAgent="test"
          displayMode="normal"
        />
      );

      // Change both data and mode simultaneously
      rerender(
        <AgentPanel
          agents={[
            {
              name: 'test-updated',
              status: 'completed',
              debugInfo: {
                tokensUsed: { input: 1000, output: 500 },
                turnCount: 5,
              },
            }
          ]}
          currentAgent="test-updated"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('test-updated')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed status

      // Should not show debug info for completed agent even in verbose mode
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });
  });

  describe('browser compatibility edge cases', () => {
    it('handles missing console methods gracefully', () => {
      const originalConsole = console.error;
      console.error = undefined as any;

      try {
        render(
          <AgentPanel
            agents={[{ name: 'test', status: 'active' }]}
            currentAgent="test"
            displayMode="normal"
          />
        );

        expect(screen.getByText('test')).toBeInTheDocument();
      } finally {
        console.error = originalConsole;
      }
    });

    it('handles component in strict mode', () => {
      render(
        <React.StrictMode>
          <AgentPanel
            agents={[
              {
                name: 'strict-mode-test',
                status: 'active',
                debugInfo: {
                  tokensUsed: { input: 1000, output: 500 },
                  turnCount: 3,
                },
              },
            ]}
            currentAgent="strict-mode-test"
            displayMode="verbose"
          />
        </React.StrictMode>
      );

      expect(screen.getByText('strict-mode-test')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1k→500')).toBeInTheDocument();
    });
  });

  describe('cleanup and memory leaks', () => {
    it('properly unmounts without errors', () => {
      const agentsWithTimers: AgentInfo[] = [
        {
          name: 'timer-agent',
          status: 'active',
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 1000, output: 500 },
            turnCount: 5,
          },
        },
      ];

      const { unmount } = render(
        <AgentPanel
          agents={agentsWithTimers}
          currentAgent="timer-agent"
          displayMode="verbose"
        />
      );

      // Should unmount cleanly without console errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles component unmount during data updates', () => {
      const { rerender, unmount } = render(
        <AgentPanel
          agents={[{ name: 'test', status: 'active' }]}
          currentAgent="test"
          displayMode="normal"
        />
      );

      // Start an update
      rerender(
        <AgentPanel
          agents={[{ name: 'test-updated', status: 'active', progress: 50 }]}
          currentAgent="test-updated"
          displayMode="verbose"
        />
      );

      // Unmount during update
      expect(() => unmount()).not.toThrow();
    });
  });
});