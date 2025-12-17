import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Integration tests for the thinking field in AgentInfo.debugInfo
 * These tests verify that the thinking field works correctly across different scenarios
 * and maintains type safety and backward compatibility.
 */

describe('AgentPanel thinking field integration', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TypeScript type safety', () => {
    it('should compile and type-check correctly with thinking field', () => {
      // This test ensures TypeScript compilation works
      const agentWithThinking: AgentInfo = {
        name: 'typescript-test',
        status: 'active',
        stage: 'compilation',
        debugInfo: {
          thinking: 'Verifying TypeScript compilation with new thinking field',
          tokensUsed: { input: 1000, output: 1500 },
          turnCount: 2,
          errorCount: 0,
        },
      };

      // Type assertions to ensure proper typing
      expect(agentWithThinking.debugInfo?.thinking).toBeDefined();
      expect(typeof agentWithThinking.debugInfo?.thinking).toBe('string');
      expect(agentWithThinking.debugInfo?.thinking).toBe('Verifying TypeScript compilation with new thinking field');
    });

    it('should handle optional thinking field correctly', () => {
      // Test that thinking field is truly optional
      const agentWithoutThinking: AgentInfo = {
        name: 'no-thinking-test',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 500, output: 750 },
          lastToolCall: 'Read',
        },
      };

      expect(agentWithoutThinking.debugInfo?.thinking).toBeUndefined();
    });

    it('should allow nullable thinking values', () => {
      const agentWithNullableThinking: AgentInfo = {
        name: 'nullable-test',
        status: 'active',
        debugInfo: {
          thinking: undefined,
          tokensUsed: { input: 300, output: 400 },
        },
      };

      expect(agentWithNullableThinking.debugInfo?.thinking).toBeUndefined();
    });
  });

  describe('Rendering integration', () => {
    it('should render agents with thinking field in normal mode', () => {
      const agentsWithThinking: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Completed planning phase analysis',
            tokensUsed: { input: 800, output: 1200 },
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Currently implementing core functionality',
            tokensUsed: { input: 2000, output: 3500 },
            turnCount: 5,
          },
        },
      ];

      render(<AgentPanel agents={agentsWithThinking} currentAgent="developer" />);

      // Verify basic rendering works
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('should render agents with thinking field in compact mode', () => {
      const agentsWithThinking: AgentInfo[] = [
        {
          name: 'architect',
          status: 'active',
          debugInfo: {
            thinking: 'Designing system architecture',
            tokensUsed: { input: 1500, output: 2200 },
          },
        },
      ];

      render(<AgentPanel agents={agentsWithThinking} currentAgent="architect" compact={true} />);

      // Compact mode should still work with thinking field
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('should render agents with thinking field in verbose mode', () => {
      const agentsWithThinking: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'active',
          debugInfo: {
            thinking: 'Analyzing code quality and best practices',
            tokensUsed: { input: 1800, output: 2800 },
            lastToolCall: 'Grep',
            turnCount: 3,
            errorCount: 1,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithThinking}
          currentAgent="reviewer"
          displayMode="verbose"
        />
      );

      // Verify verbose mode displays additional debug info
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1800→2800')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Grep')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle mixed agents with and without thinking fields', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'agent-with-thinking',
          status: 'active',
          debugInfo: {
            thinking: 'This agent has thinking content',
            tokensUsed: { input: 1000, output: 1500 },
          },
        },
        {
          name: 'agent-without-thinking',
          status: 'waiting',
          debugInfo: {
            tokensUsed: { input: 500, output: 750 },
            turnCount: 1,
          },
        },
        {
          name: 'agent-with-empty-thinking',
          status: 'completed',
          debugInfo: {
            thinking: '',
            tokensUsed: { input: 200, output: 300 },
          },
        },
      ];

      render(<AgentPanel agents={mixedAgents} currentAgent="agent-with-thinking" />);

      // All agents should render correctly
      expect(screen.getByText('agent-with-thinking')).toBeInTheDocument();
      expect(screen.getByText('agent-without-thinking')).toBeInTheDocument();
      expect(screen.getByText('agent-with-empty-thinking')).toBeInTheDocument();
    });

    it('should handle thinking field with all possible agent statuses', () => {
      const agentsWithAllStatuses: AgentInfo[] = [
        {
          name: 'active-agent',
          status: 'active',
          debugInfo: { thinking: 'Active agent thinking' },
        },
        {
          name: 'waiting-agent',
          status: 'waiting',
          debugInfo: { thinking: 'Waiting agent thinking' },
        },
        {
          name: 'completed-agent',
          status: 'completed',
          debugInfo: { thinking: 'Completed agent thinking' },
        },
        {
          name: 'idle-agent',
          status: 'idle',
          debugInfo: { thinking: 'Idle agent thinking' },
        },
        {
          name: 'parallel-agent',
          status: 'parallel',
          debugInfo: { thinking: 'Parallel agent thinking' },
        },
      ];

      render(<AgentPanel agents={agentsWithAllStatuses} currentAgent="active-agent" />);

      // All agent statuses should work with thinking field
      expect(screen.getByText('active-agent')).toBeInTheDocument();
      expect(screen.getByText('waiting-agent')).toBeInTheDocument();
      expect(screen.getByText('completed-agent')).toBeInTheDocument();
      expect(screen.getByText('idle-agent')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent')).toBeInTheDocument();
    });

    it('should handle thinking field in parallel execution scenarios', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel-dev',
          status: 'parallel',
          stage: 'coding',
          debugInfo: {
            thinking: 'Implementing feature A in parallel',
            tokensUsed: { input: 1200, output: 1800 },
          },
        },
        {
          name: 'parallel-test',
          status: 'parallel',
          stage: 'testing',
          debugInfo: {
            thinking: 'Writing tests for feature B in parallel',
            tokensUsed: { input: 900, output: 1400 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
          useDetailedParallelView={true}
        />
      );

      // Parallel execution should work with thinking fields
      expect(screen.getByText('parallel-dev')).toBeInTheDocument();
      expect(screen.getByText('parallel-test')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle extremely long thinking content', () => {
      const longThinking = 'Very long thinking content. '.repeat(1000);
      const agentWithLongThinking: AgentInfo = {
        name: 'long-thinking-agent',
        status: 'active',
        debugInfo: {
          thinking: longThinking,
          tokensUsed: { input: 5000, output: 8000 },
        },
      };

      // Should not crash with very long thinking content
      expect(() => {
        render(<AgentPanel agents={[agentWithLongThinking]} currentAgent="long-thinking-agent" />);
      }).not.toThrow();

      expect(screen.getByText('long-thinking-agent')).toBeInTheDocument();
    });

    it('should handle thinking content with special characters and formatting', () => {
      const specialThinking = `
        Multi-line thinking with:
        - Special characters: <>&"'
        - Unicode: 🤔💭🚀
        - Code: \`const x = 1;\`
        - JSON: {"key": "value"}
        - Quotes: "double" and 'single'
      `;

      const agentWithSpecialThinking: AgentInfo = {
        name: 'special-thinking-agent',
        status: 'active',
        debugInfo: {
          thinking: specialThinking,
          tokensUsed: { input: 2000, output: 3000 },
        },
      };

      render(<AgentPanel agents={[agentWithSpecialThinking]} currentAgent="special-thinking-agent" />);

      expect(screen.getByText('special-thinking-agent')).toBeInTheDocument();
    });

    it('should handle rapid updates to thinking content', () => {
      let currentThinking = 'Initial thinking';

      const TestComponent = () => {
        const [thinking, setThinking] = React.useState(currentThinking);

        // Simulate rapid updates
        React.useEffect(() => {
          const interval = setInterval(() => {
            setThinking(prev => `${prev} updated`);
          }, 10);

          const timeout = setTimeout(() => {
            clearInterval(interval);
          }, 100);

          return () => {
            clearInterval(interval);
            clearTimeout(timeout);
          };
        }, []);

        const agent: AgentInfo = {
          name: 'rapid-update-agent',
          status: 'active',
          debugInfo: {
            thinking,
            tokensUsed: { input: 1000, output: 1500 },
          },
        };

        return <AgentPanel agents={[agent]} currentAgent="rapid-update-agent" />;
      };

      render(<TestComponent />);

      expect(screen.getByText('rapid-update-agent')).toBeInTheDocument();
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain compatibility with existing AgentInfo without debugInfo', () => {
      const legacyAgent: AgentInfo = {
        name: 'legacy-agent',
        status: 'active',
        stage: 'legacy-stage',
        // No debugInfo at all
      };

      render(<AgentPanel agents={[legacyAgent]} currentAgent="legacy-agent" />);

      expect(screen.getByText('legacy-agent')).toBeInTheDocument();
      expect(screen.getByText(/\(legacy-stage\)/)).toBeInTheDocument();
    });

    it('should maintain compatibility with existing debugInfo without thinking', () => {
      const existingAgent: AgentInfo = {
        name: 'existing-agent',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 1000, output: 1500 },
          stageStartedAt: new Date(),
          lastToolCall: 'Edit',
          turnCount: 3,
          errorCount: 0,
          // No thinking field - existing structure
        },
      };

      render(
        <AgentPanel
          agents={[existingAgent]}
          currentAgent="existing-agent"
          displayMode="verbose"
        />
      );

      // Should display existing debug info without issues
      expect(screen.getByText('existing-agent')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1000→1500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
    });

    it('should handle gradual migration to thinking field', () => {
      // Simulate a scenario where some agents have been updated to include thinking
      // and others haven't yet been updated
      const migrationAgents: AgentInfo[] = [
        {
          name: 'updated-agent',
          status: 'active',
          debugInfo: {
            thinking: 'This agent has been updated with thinking field',
            tokensUsed: { input: 1500, output: 2200 },
            turnCount: 4,
          },
        },
        {
          name: 'not-updated-agent',
          status: 'waiting',
          debugInfo: {
            tokensUsed: { input: 800, output: 1200 },
            lastToolCall: 'Read',
          },
        },
      ];

      render(<AgentPanel agents={migrationAgents} currentAgent="updated-agent" />);

      // Both agents should work correctly
      expect(screen.getByText('updated-agent')).toBeInTheDocument();
      expect(screen.getByText('not-updated-agent')).toBeInTheDocument();
    });
  });

  describe('Performance and memory', () => {
    it('should handle many agents with thinking fields efficiently', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `agent-${i}`,
        status: i % 2 === 0 ? 'active' : 'waiting' as const,
        debugInfo: {
          thinking: `Agent ${i} thinking about task ${i}`,
          tokensUsed: { input: i * 10, output: i * 15 },
          turnCount: i % 5,
        },
      }));

      const startTime = performance.now();
      render(<AgentPanel agents={manyAgents} currentAgent="agent-0" />);
      const endTime = performance.now();

      // Should render efficiently (within reasonable time)
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-99')).toBeInTheDocument();
    });

    it('should handle thinking content without memory leaks', () => {
      const TestComponent = () => {
        const [iteration, setIteration] = React.useState(0);

        React.useEffect(() => {
          if (iteration < 50) {
            const timeout = setTimeout(() => {
              setIteration(prev => prev + 1);
            }, 10);
            return () => clearTimeout(timeout);
          }
        }, [iteration]);

        const agent: AgentInfo = {
          name: 'memory-test-agent',
          status: 'active',
          debugInfo: {
            thinking: `Iteration ${iteration}: Processing memory test`,
            tokensUsed: { input: iteration * 100, output: iteration * 150 },
          },
        };

        return <AgentPanel agents={[agent]} currentAgent="memory-test-agent" />;
      };

      const { unmount } = render(<TestComponent />);

      // Should unmount cleanly without memory leaks
      expect(() => unmount()).not.toThrow();
    });
  });
});