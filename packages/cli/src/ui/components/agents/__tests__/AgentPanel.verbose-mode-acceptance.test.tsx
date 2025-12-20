import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';

/**
 * Acceptance tests for AgentPanel verbose mode feature
 * Validates complete acceptance criteria implementation
 */
describe('AgentPanel - Verbose Mode Acceptance Tests', () => {
  // Mock all required hooks
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

    // Setup default mock returns
    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
    });
    mockUseElapsedTime.mockReturnValue('04:27');
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

  /**
   * Complete workflow agents representing a realistic scenario
   */
  const workflowAgents: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
      progress: 100,
      startedAt: new Date('2023-01-01T10:00:00Z'),
      debugInfo: {
        tokensUsed: { input: 2500, output: 1800 },
        turnCount: 4,
        lastToolCall: 'Task',
        errorCount: 0,
      },
    },
    {
      name: 'architect',
      status: 'completed',
      stage: 'architecture',
      progress: 100,
      startedAt: new Date('2023-01-01T10:05:00Z'),
      debugInfo: {
        tokensUsed: { input: 4200, output: 3100 },
        turnCount: 6,
        lastToolCall: 'Write',
        errorCount: 1,
      },
    },
    {
      name: 'developer',
      status: 'active',
      stage: 'implementation',
      progress: 75,
      startedAt: new Date('2023-01-01T10:15:00Z'),
      debugInfo: {
        tokensUsed: { input: 15750, output: 9200 },
        turnCount: 18,
        lastToolCall: 'Edit',
        errorCount: 3,
      },
    },
    {
      name: 'tester',
      status: 'waiting',
      stage: 'testing',
      debugInfo: {
        tokensUsed: { input: 0, output: 0 },
        turnCount: 0,
        lastToolCall: undefined,
        errorCount: 0,
      },
    },
    {
      name: 'reviewer',
      status: 'waiting',
      stage: 'reviewing',
    },
    {
      name: 'devops',
      status: 'waiting',
      stage: 'deployment',
    },
  ];

  describe('ACCEPTANCE CRITERIA VALIDATION', () => {
    describe('AC1: Tokens used per agent display', () => {
      it('displays token usage only for active agents with debug info', () => {
        render(
          <AgentPanel
            agents={workflowAgents}
            currentAgent="developer"
            displayMode="verbose"
          />
        );

        // ✓ Active agent (developer) should show token usage
        expect(screen.getByText('🔢 Tokens: 15.8k→9.2k')).toBeInTheDocument();

        // ✓ Inactive agents should NOT show token usage
        expect(screen.queryByText('🔢 Tokens: 2.5k→1.8k')).not.toBeInTheDocument(); // planner
        expect(screen.queryByText('🔢 Tokens: 4.2k→3.1k')).not.toBeInTheDocument(); // architect
        expect(screen.queryByText('🔢 Tokens: 0→0')).not.toBeInTheDocument(); // tester

        // ✓ Agent names should still be visible
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
      });

      it('handles various token count magnitudes correctly', () => {
        const tokenTestAgents: AgentInfo[] = [
          {
            name: 'small-tokens',
            status: 'active',
            debugInfo: { tokensUsed: { input: 500, output: 300 } },
          },
          {
            name: 'medium-tokens',
            status: 'active',
            debugInfo: { tokensUsed: { input: 15500, output: 8200 } },
          },
          {
            name: 'large-tokens',
            status: 'active',
            debugInfo: { tokensUsed: { input: 2500000, output: 1800000 } },
          },
        ];

        tokenTestAgents.forEach((agent) => {
          const { unmount } = render(
            <AgentPanel
              agents={[agent]}
              currentAgent={agent.name}
              displayMode="verbose"
            />
          );

          if (agent.name === 'small-tokens') {
            expect(screen.getByText('🔢 Tokens: 500→300')).toBeInTheDocument();
          } else if (agent.name === 'medium-tokens') {
            expect(screen.getByText('🔢 Tokens: 15.5k→8.2k')).toBeInTheDocument();
          } else if (agent.name === 'large-tokens') {
            expect(screen.getByText('🔢 Tokens: 2.5M→1.8M')).toBeInTheDocument();
          }

          unmount();
        });
      });
    });

    describe('AC2: Turn count display', () => {
      it('displays turn count only for active agents', () => {
        render(
          <AgentPanel
            agents={workflowAgents}
            currentAgent="developer"
            displayMode="verbose"
          />
        );

        // ✓ Active agent should show turn count
        expect(screen.getByText('🔄 Turns: 18')).toBeInTheDocument();

        // ✓ Inactive agents should NOT show turn count
        expect(screen.queryByText('🔄 Turns: 4')).not.toBeInTheDocument(); // planner
        expect(screen.queryByText('🔄 Turns: 6')).not.toBeInTheDocument(); // architect
        expect(screen.queryByText('🔄 Turns: 0')).not.toBeInTheDocument(); // tester
      });

      it('handles various turn count values correctly', () => {
        const turnTestCases = [
          { name: 'zero-turns', turns: 0 },
          { name: 'single-turn', turns: 1 },
          { name: 'many-turns', turns: 999 },
        ];

        turnTestCases.forEach(({ name, turns }) => {
          const agent: AgentInfo = {
            name,
            status: 'active',
            debugInfo: { turnCount: turns },
          };

          const { unmount } = render(
            <AgentPanel
              agents={[agent]}
              currentAgent={name}
              displayMode="verbose"
            />
          );

          if (turns > 0) {
            expect(screen.getByText(`🔄 Turns: ${turns}`)).toBeInTheDocument();
          } else {
            expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
          }

          unmount();
        });
      });
    });

    describe('AC3: Last tool call display', () => {
      it('displays last tool call only for active agents', () => {
        render(
          <AgentPanel
            agents={workflowAgents}
            currentAgent="developer"
            displayMode="verbose"
          />
        );

        // ✓ Active agent should show last tool call
        expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();

        // ✓ Inactive agents should NOT show last tool call
        expect(screen.queryByText('🔧 Last tool: Task')).not.toBeInTheDocument(); // planner
        expect(screen.queryByText('🔧 Last tool: Write')).not.toBeInTheDocument(); // architect
      });

      it('handles various tool names correctly', () => {
        const toolTestCases = [
          'Edit', 'Write', 'Read', 'Bash', 'WebFetch', 'Task',
          'ComplexToolWithLongName', 'tool_with_underscores', 'tool-with-hyphens'
        ];

        toolTestCases.forEach((toolName) => {
          const agent: AgentInfo = {
            name: 'test-agent',
            status: 'active',
            debugInfo: { lastToolCall: toolName },
          };

          const { unmount } = render(
            <AgentPanel
              agents={[agent]}
              currentAgent="test-agent"
              displayMode="verbose"
            />
          );

          expect(screen.getByText(`🔧 Last tool: ${toolName}`)).toBeInTheDocument();
          unmount();
        });
      });
    });

    describe('AC4: VerboseAgentRow component usage', () => {
      it('uses VerboseAgentRow component in verbose mode', () => {
        const { container } = render(
          <AgentPanel
            agents={workflowAgents}
            currentAgent="developer"
            displayMode="verbose"
          />
        );

        // ✓ Should render debug information (indicating VerboseAgentRow is used)
        expect(screen.getByText('🔢 Tokens: 15.8k→9.2k')).toBeInTheDocument();
        expect(screen.getByText('🔄 Turns: 18')).toBeInTheDocument();
        expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
        expect(screen.getByText('❌ Errors: 3')).toBeInTheDocument();

        // ✓ Should show progress bar for active agent
        expect(screen.getByText(/75%/)).toBeInTheDocument();

        // ✓ Should show elapsed time for active agent
        expect(screen.getByText(/\[04:27\]/)).toBeInTheDocument();

        // ✓ Component structure should be present
        expect(container.firstChild).toBeDefined();
      });

      it('does NOT use VerboseAgentRow in normal mode', () => {
        render(
          <AgentPanel
            agents={workflowAgents}
            currentAgent="developer"
            displayMode="normal"
          />
        );

        // ✓ Should NOT show debug information in normal mode
        expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();

        // ✓ Should still show basic agent info
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText(/75%/)).toBeInTheDocument(); // Progress still shown
      });
    });

    describe('AC5: AgentInfo interface with optional verbose fields', () => {
      it('supports all required debugInfo fields', () => {
        // ✓ This test validates the TypeScript interface by usage
        const completeAgent: AgentInfo = {
          name: 'complete-agent',
          status: 'active',
          stage: 'testing',
          progress: 50,
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 5000, output: 3500 },
            stageStartedAt: new Date(),
            lastToolCall: 'TestTool',
            turnCount: 12,
            errorCount: 2,
            thinking: 'Processing complex task...',
          },
        };

        render(
          <AgentPanel
            agents={[completeAgent]}
            currentAgent="complete-agent"
            displayMode="verbose"
          />
        );

        // ✓ All debug fields should be accessible and displayable
        expect(screen.getByText('🔢 Tokens: 5.0k→3.5k')).toBeInTheDocument();
        expect(screen.getByText('🔄 Turns: 12')).toBeInTheDocument();
        expect(screen.getByText('🔧 Last tool: TestTool')).toBeInTheDocument();
        expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();
      });

      it('supports optional debugInfo fields gracefully', () => {
        const minimalAgent: AgentInfo = {
          name: 'minimal-agent',
          status: 'active',
          // ✓ No debugInfo - should work fine
        };

        const partialAgent: AgentInfo = {
          name: 'partial-agent',
          status: 'active',
          debugInfo: {
            // ✓ Only some fields - should work fine
            tokensUsed: { input: 1000, output: 800 },
            turnCount: 5,
            // Missing lastToolCall and errorCount
          },
        };

        [minimalAgent, partialAgent].forEach((agent) => {
          const { unmount } = render(
            <AgentPanel
              agents={[agent]}
              currentAgent={agent.name}
              displayMode="verbose"
            />
          );

          // Should render without errors
          expect(screen.getByText(agent.name)).toBeInTheDocument();

          if (agent.name === 'partial-agent') {
            expect(screen.getByText('🔢 Tokens: 1.0k→800')).toBeInTheDocument();
            expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
            expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
            expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
          }

          unmount();
        });
      });
    });
  });

  describe('INTEGRATION SCENARIOS', () => {
    it('handles complete workflow progression in verbose mode', () => {
      const { rerender } = render(
        <AgentPanel
          agents={workflowAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // ✓ Initial state: developer is active
      expect(screen.getByText('🔢 Tokens: 15.8k→9.2k')).toBeInTheDocument();

      // ✓ Simulate progression to tester
      const updatedAgents = workflowAgents.map(agent => {
        if (agent.name === 'developer') {
          return { ...agent, status: 'completed' as const, progress: 100 };
        }
        if (agent.name === 'tester') {
          return {
            ...agent,
            status: 'active' as const,
            startedAt: new Date(),
            debugInfo: {
              ...agent.debugInfo!,
              tokensUsed: { input: 2000, output: 1500 },
              turnCount: 3,
              lastToolCall: 'Bash',
            },
          };
        }
        return agent;
      });

      rerender(
        <AgentPanel
          agents={updatedAgents}
          currentAgent="tester"
          displayMode="verbose"
        />
      );

      // ✓ Now tester should show debug info
      expect(screen.getByText('🔢 Tokens: 2.0k→1.5k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Bash')).toBeInTheDocument();

      // ✓ Developer should no longer show debug info
      expect(screen.queryByText('🔢 Tokens: 15.8k→9.2k')).not.toBeInTheDocument();
    });

    it('maintains verbose mode across different terminal sizes', () => {
      // ✓ Test narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'narrow' as const,
      });

      const { rerender } = render(
        <AgentPanel
          agents={workflowAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // ✓ Should still show verbose info despite narrow terminal
      expect(screen.getByText('🔢 Tokens: 15.8k→9.2k')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // ✓ Test wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide' as const,
      });

      rerender(
        <AgentPanel
          agents={workflowAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // ✓ Should maintain verbose info in wide terminal
      expect(screen.getByText('🔢 Tokens: 15.8k→9.2k')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles real-time debug info updates', () => {
      const initialAgent: AgentInfo = {
        name: 'realtime-agent',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 1000, output: 800 },
          turnCount: 5,
          lastToolCall: 'Read',
          errorCount: 0,
        },
      };

      const { rerender } = render(
        <AgentPanel
          agents={[initialAgent]}
          currentAgent="realtime-agent"
          displayMode="verbose"
        />
      );

      // ✓ Initial state
      expect(screen.getByText('🔢 Tokens: 1.0k→800')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Read')).toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();

      // ✓ Simulate real-time updates
      const updatedAgent: AgentInfo = {
        ...initialAgent,
        debugInfo: {
          tokensUsed: { input: 2500, output: 1800 },
          turnCount: 8,
          lastToolCall: 'Write',
          errorCount: 1,
        },
      };

      rerender(
        <AgentPanel
          agents={[updatedAgent]}
          currentAgent="realtime-agent"
          displayMode="verbose"
        />
      );

      // ✓ Updated state
      expect(screen.getByText('🔢 Tokens: 2.5k→1.8k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 8')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Write')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });
  });

  describe('ERROR HANDLING', () => {
    it('handles malformed debug data gracefully', () => {
      const malformedAgent: AgentInfo = {
        name: 'malformed-agent',
        status: 'active',
        debugInfo: {
          // @ts-expect-error Testing malformed data
          tokensUsed: 'invalid',
          turnCount: undefined,
          lastToolCall: null,
          errorCount: -1,
        },
      };

      expect(() => {
        render(
          <AgentPanel
            agents={[malformedAgent]}
            currentAgent="malformed-agent"
            displayMode="verbose"
          />
        );
      }).not.toThrow();

      // ✓ Should render agent name at minimum
      expect(screen.getByText('malformed-agent')).toBeInTheDocument();
    });

    it('handles empty agent list in verbose mode', () => {
      render(
        <AgentPanel
          agents={[]}
          displayMode="verbose"
        />
      );

      // ✓ Should show header but no agents
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('PERFORMANCE VALIDATION', () => {
    it('renders verbose mode efficiently with many agents', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 5 ? 'active' as const : 'waiting' as const,
        debugInfo: {
          tokensUsed: { input: 1000 + i * 100, output: 800 + i * 50 },
          turnCount: i + 1,
          lastToolCall: `Tool${i}`,
          errorCount: i % 3,
        },
      }));

      const startTime = performance.now();

      render(
        <AgentPanel
          agents={manyAgents}
          currentAgent="agent-5"
          displayMode="verbose"
        />
      );

      const endTime = performance.now();

      // ✓ Should render efficiently
      expect(endTime - startTime).toBeLessThan(100);

      // ✓ Only active agent should show debug info
      expect(screen.getByText('🔢 Tokens: 1.5k→1.0k')).toBeInTheDocument(); // agent-5
      expect(screen.queryByText('🔢 Tokens: 1.0k→800')).not.toBeInTheDocument(); // agent-0
    });
  });
});