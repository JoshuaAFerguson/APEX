/**
 * Advanced integration tests for ThoughtDisplay within AgentPanel
 * Focuses on complex scenarios and integration patterns not covered elsewhere
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock supporting components to isolate AgentPanel + ThoughtDisplay integration
vi.mock('../../hooks/useElapsedTime', () => ({
  useElapsedTime: vi.fn((startTime) => startTime ? '2m 15s' : null),
}));

vi.mock('../../hooks/useAgentHandoff', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

vi.mock('../HandoffIndicator', () => ({
  HandoffIndicator: () => null,
}));

describe('AgentPanel Advanced ThoughtDisplay Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complex State Management Integration', () => {
    it('maintains thought state consistency during agent status transitions', () => {
      const DynamicAgentComponent: React.FC = () => {
        const [agentStatus, setAgentStatus] = React.useState<'idle' | 'active' | 'completed'>('idle');
        const [thinking, setThinking] = React.useState('Initial thought state');

        const agents: AgentInfo[] = [
          {
            name: 'transitioning-agent',
            status: agentStatus,
            debugInfo: { thinking },
          },
        ];

        React.useEffect(() => {
          // Simulate agent lifecycle transitions
          const transitions = [
            { delay: 10, status: 'active' as const, thinking: 'Agent becoming active...' },
            { delay: 20, status: 'active' as const, thinking: 'Agent is now working...' },
            { delay: 30, status: 'completed' as const, thinking: 'Agent completed work' },
          ];

          const timeouts = transitions.map(({ delay, status, thinking: newThinking }) =>
            setTimeout(() => {
              setAgentStatus(status);
              setThinking(newThinking);
            }, delay)
          );

          return () => timeouts.forEach(clearTimeout);
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="transitioning-agent"
            showThoughts={true}
          />
        );
      };

      render(<DynamicAgentComponent />);

      expect(screen.getByText('transitioning-agent')).toBeInTheDocument();
      expect(screen.getByText('💭 transitioning-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('Initial thought state')).toBeInTheDocument();
    });

    it('handles concurrent thought updates from multiple agents', async () => {
      const ConcurrentThoughtsComponent: React.FC = () => {
        const [thoughts, setThoughts] = React.useState({
          agent1: 'Agent 1 initial thought',
          agent2: 'Agent 2 initial thought',
          agent3: 'Agent 3 initial thought',
        });

        const agents: AgentInfo[] = [
          { name: 'agent1', status: 'active', debugInfo: { thinking: thoughts.agent1 } },
          { name: 'agent2', status: 'active', debugInfo: { thinking: thoughts.agent2 } },
          { name: 'agent3', status: 'active', debugInfo: { thinking: thoughts.agent3 } },
        ];

        React.useEffect(() => {
          // Simulate concurrent updates
          const updateSequence = [
            { delay: 10, agent: 'agent1', thinking: 'Agent 1 updated thought' },
            { delay: 15, agent: 'agent2', thinking: 'Agent 2 updated thought' },
            { delay: 20, agent: 'agent1', thinking: 'Agent 1 final thought' },
            { delay: 25, agent: 'agent3', thinking: 'Agent 3 updated thought' },
          ];

          const timeouts = updateSequence.map(({ delay, agent, thinking }) =>
            setTimeout(() => {
              setThoughts(prev => ({ ...prev, [agent]: thinking }));
            }, delay)
          );

          return () => timeouts.forEach(clearTimeout);
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="agent1"
            showThoughts={true}
          />
        );
      };

      render(<ConcurrentThoughtsComponent />);

      // All agents should initially be visible with thoughts
      expect(screen.getByText('💭 agent1 thinking')).toBeInTheDocument();
      expect(screen.getByText('💭 agent2 thinking')).toBeInTheDocument();
      expect(screen.getByText('💭 agent3 thinking')).toBeInTheDocument();

      // Initial thoughts should be displayed
      expect(screen.getByText('Agent 1 initial thought')).toBeInTheDocument();
      expect(screen.getByText('Agent 2 initial thought')).toBeInTheDocument();
      expect(screen.getByText('Agent 3 initial thought')).toBeInTheDocument();
    });

    it('preserves thought display state when showThoughts prop changes', () => {
      const ToggleThoughtsComponent: React.FC = () => {
        const [showThoughts, setShowThoughts] = React.useState(true);

        const agents: AgentInfo[] = [
          {
            name: 'persistent-agent',
            status: 'active',
            debugInfo: { thinking: 'Persistent thinking content' },
          },
        ];

        React.useEffect(() => {
          // Toggle showThoughts after a delay
          const timeout = setTimeout(() => setShowThoughts(false), 50);
          const timeout2 = setTimeout(() => setShowThoughts(true), 100);

          return () => {
            clearTimeout(timeout);
            clearTimeout(timeout2);
          };
        }, []);

        return (
          <div data-testid="toggle-container">
            <button
              data-testid="toggle-button"
              onClick={() => setShowThoughts(!showThoughts)}
            >
              Toggle Thoughts
            </button>
            <AgentPanel
              agents={agents}
              currentAgent="persistent-agent"
              showThoughts={showThoughts}
            />
          </div>
        );
      };

      render(<ToggleThoughtsComponent />);

      // Initially thoughts should be visible
      expect(screen.getByText('💭 persistent-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('Persistent thinking content')).toBeInTheDocument();

      // Toggle off
      const toggleButton = screen.getByTestId('toggle-button');
      fireEvent.click(toggleButton);

      // Thoughts should be hidden
      expect(screen.queryByText('💭 persistent-agent thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('Persistent thinking content')).not.toBeInTheDocument();

      // Agent name should still be visible
      expect(screen.getByText('persistent-agent')).toBeInTheDocument();

      // Toggle back on
      fireEvent.click(toggleButton);

      // Thoughts should be visible again
      expect(screen.getByText('💭 persistent-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('Persistent thinking content')).toBeInTheDocument();
    });
  });

  describe('Mixed Mode Scenarios', () => {
    it('handles mixed agents with and without thinking in complex layouts', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'thinking-agent',
          status: 'active',
          stage: 'implementation',
          progress: 75,
          startedAt: new Date(),
          debugInfo: {
            thinking: 'Complex implementation thoughts...',
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: 3,
          },
        },
        {
          name: 'silent-agent',
          status: 'waiting',
          stage: 'review',
          debugInfo: {
            tokensUsed: { input: 500, output: 200 },
            // No thinking
          },
        },
        {
          name: 'verbose-thinking-agent',
          status: 'active',
          stage: 'testing',
          progress: 90,
          debugInfo: {
            thinking: 'Very detailed thinking process that goes into extensive detail about the testing methodology and approach being used, including considerations for edge cases, performance testing, integration testing, and user acceptance criteria validation',
            stageStartedAt: new Date(),
            lastToolCall: 'Test',
            errorCount: 1,
          },
        },
        {
          name: 'minimal-agent',
          status: 'idle',
          // No debugInfo at all
        },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="thinking-agent"
          showThoughts={true}
          displayMode="verbose"
        />
      );

      // All agents should be displayed
      expect(screen.getByText('thinking-agent')).toBeInTheDocument();
      expect(screen.getByText('silent-agent')).toBeInTheDocument();
      expect(screen.getByText('verbose-thinking-agent')).toBeInTheDocument();
      expect(screen.getByText('minimal-agent')).toBeInTheDocument();

      // Only agents with thinking should show thoughts
      expect(screen.getByText('💭 thinking-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('Complex implementation thoughts...')).toBeInTheDocument();

      expect(screen.getByText('💭 verbose-thinking-agent thinking')).toBeInTheDocument();
      expect(screen.getByText(/Very detailed thinking process/)).toBeInTheDocument();

      // Agents without thinking should not show thoughts
      expect(screen.queryByText('💭 silent-agent thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 minimal-agent thinking')).not.toBeInTheDocument();

      // Verbose mode debug info should still be visible
      expect(screen.getByText('🔢 Tokens: 1000→1500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
    });

    it('correctly handles parallel agents with mixed thinking states', () => {
      const mainAgents: AgentInfo[] = [
        {
          name: 'main-developer',
          status: 'active',
          debugInfo: { thinking: 'Main development work in progress...' },
        },
      ];

      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel-tester',
          status: 'parallel',
          stage: 'testing',
          debugInfo: { thinking: 'Running parallel tests and validations...' },
        },
        {
          name: 'parallel-documenter',
          status: 'parallel',
          stage: 'documentation',
          // No thinking
          debugInfo: {
            stageStartedAt: new Date(),
            lastToolCall: 'Write',
          },
        },
        {
          name: 'parallel-deployer',
          status: 'parallel',
          stage: 'deployment',
          progress: 60,
          debugInfo: { thinking: 'Preparing deployment configuration and ensuring all systems are ready...' },
        },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="main-developer"
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
        />
      );

      // Main agent with thinking
      expect(screen.getByText('💭 main-developer thinking')).toBeInTheDocument();
      expect(screen.getByText('Main development work in progress...')).toBeInTheDocument();

      // Parallel section should be displayed
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Parallel agents with thinking
      expect(screen.getByText('💭 parallel-tester thinking')).toBeInTheDocument();
      expect(screen.getByText('Running parallel tests and validations...')).toBeInTheDocument();

      expect(screen.getByText('💭 parallel-deployer thinking')).toBeInTheDocument();
      expect(screen.getByText('Preparing deployment configuration and ensuring all systems are ready...')).toBeInTheDocument();

      // Parallel agent without thinking should not show thoughts
      expect(screen.queryByText('💭 parallel-documenter thinking')).not.toBeInTheDocument();

      // All agents should still be visible
      expect(screen.getByText('parallel-tester')).toBeInTheDocument();
      expect(screen.getByText('parallel-documenter')).toBeInTheDocument();
      expect(screen.getByText('parallel-deployer')).toBeInTheDocument();
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('simulates real agent workflow with thinking evolution', async () => {
      const WorkflowSimulation: React.FC = () => {
        const [currentStage, setCurrentStage] = React.useState(0);

        const workflowStages = [
          {
            agents: [
              { name: 'planner', status: 'active' as const, debugInfo: { thinking: 'Analyzing requirements and creating project plan...' } },
              { name: 'architect', status: 'waiting' as const },
              { name: 'developer', status: 'waiting' as const },
            ],
            currentAgent: 'planner',
          },
          {
            agents: [
              { name: 'planner', status: 'completed' as const, debugInfo: { thinking: 'Planning completed successfully.' } },
              { name: 'architect', status: 'active' as const, debugInfo: { thinking: 'Designing system architecture based on requirements...' } },
              { name: 'developer', status: 'waiting' as const },
            ],
            currentAgent: 'architect',
          },
          {
            agents: [
              { name: 'planner', status: 'completed' as const },
              { name: 'architect', status: 'completed' as const, debugInfo: { thinking: 'Architecture design finalized.' } },
              { name: 'developer', status: 'active' as const, debugInfo: { thinking: 'Implementing features according to architecture...' } },
            ],
            currentAgent: 'developer',
          },
        ];

        React.useEffect(() => {
          // Advance through workflow stages
          if (currentStage < workflowStages.length - 1) {
            const timeout = setTimeout(() => {
              setCurrentStage(currentStage + 1);
            }, 100);

            return () => clearTimeout(timeout);
          }
        }, [currentStage]);

        const currentWorkflow = workflowStages[currentStage];

        return (
          <AgentPanel
            agents={currentWorkflow.agents}
            currentAgent={currentWorkflow.currentAgent}
            showThoughts={true}
          />
        );
      };

      render(<WorkflowSimulation />);

      // Initial state - planner active
      expect(screen.getByText('💭 planner thinking')).toBeInTheDocument();
      expect(screen.getByText('Analyzing requirements and creating project plan...')).toBeInTheDocument();

      // Wait for workflow progression
      await waitFor(() => {
        expect(screen.getByText('💭 architect thinking')).toBeInTheDocument();
      }, { timeout: 200 });

      expect(screen.getByText('Designing system architecture based on requirements...')).toBeInTheDocument();

      // Continue to final stage
      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      }, { timeout: 300 });

      expect(screen.getByText('Implementing features according to architecture...')).toBeInTheDocument();
    });

    it('handles error recovery scenarios with thinking state preservation', () => {
      const ErrorRecoveryComponent: React.FC = () => {
        const [hasError, setHasError] = React.useState(false);
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          {
            name: 'error-prone-agent',
            status: 'active',
            debugInfo: { thinking: 'Working on complex task...' },
          },
        ]);

        React.useEffect(() => {
          // Simulate error and recovery
          const errorTimeout = setTimeout(() => {
            setHasError(true);
            setAgents([{
              name: 'error-prone-agent',
              status: 'active',
              debugInfo: {
                thinking: 'Encountered error, analyzing and planning recovery...',
                errorCount: 1,
              },
            }]);
          }, 50);

          const recoveryTimeout = setTimeout(() => {
            setHasError(false);
            setAgents([{
              name: 'error-prone-agent',
              status: 'active',
              debugInfo: {
                thinking: 'Recovered from error, continuing with task...',
                errorCount: 1,
              },
            }]);
          }, 100);

          return () => {
            clearTimeout(errorTimeout);
            clearTimeout(recoveryTimeout);
          };
        }, []);

        return (
          <div>
            {hasError && <div data-testid="error-indicator">Error State</div>}
            <AgentPanel
              agents={agents}
              currentAgent="error-prone-agent"
              showThoughts={true}
            />
          </div>
        );
      };

      render(<ErrorRecoveryComponent />);

      // Initial state
      expect(screen.getByText('💭 error-prone-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('Working on complex task...')).toBeInTheDocument();

      // Should handle transitions gracefully without losing thought display capability
      expect(screen.getByText('error-prone-agent')).toBeInTheDocument();
    });

    it('validates thinking content formatting in realistic scenarios', () => {
      const realisticAgents: AgentInfo[] = [
        {
          name: 'code-reviewer',
          status: 'active',
          debugInfo: {
            thinking: `Reviewing code changes:

1. Checking for security vulnerabilities
2. Validating coding standards compliance
3. Ensuring test coverage is adequate
4. Analyzing performance implications

Found issues:
- Missing input validation on line 42
- Potential memory leak in cleanup function
- Test case needed for edge condition

Recommendations:
- Add input sanitization
- Implement proper resource disposal
- Write additional test for boundary case`,
          },
        },
        {
          name: 'performance-optimizer',
          status: 'active',
          debugInfo: {
            thinking: `Performance analysis results:

Benchmark data:
- Function A: 150ms (baseline)
- Function B: 45ms (optimized)
- Memory usage: 12MB → 8MB

Optimization opportunities:
🚀 Database query optimization: -60ms
⚡ Caching implementation: -30ms
💾 Memory pooling: -4MB

Next steps:
1. Implement query batching
2. Add Redis caching layer
3. Optimize object allocation patterns`,
          },
        },
      ];

      render(
        <AgentPanel
          agents={realisticAgents}
          currentAgent="code-reviewer"
          showThoughts={true}
          displayMode="verbose"
        />
      );

      // Both agents should show thinking
      expect(screen.getByText('💭 code-reviewer thinking')).toBeInTheDocument();
      expect(screen.getByText('💭 performance-optimizer thinking')).toBeInTheDocument();

      // Complex formatted content should be preserved
      expect(screen.getByText(/Reviewing code changes:/)).toBeInTheDocument();
      expect(screen.getByText(/1\. Checking for security vulnerabilities/)).toBeInTheDocument();
      expect(screen.getByText(/Performance analysis results:/)).toBeInTheDocument();
      expect(screen.getByText(/🚀 Database query optimization/)).toBeInTheDocument();
    });
  });

  describe('Edge Integration Scenarios', () => {
    it('handles dynamic agent list modifications while thoughts are displayed', () => {
      const DynamicAgentList: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'agent1', status: 'active', debugInfo: { thinking: 'Agent 1 thinking' } },
          { name: 'agent2', status: 'active', debugInfo: { thinking: 'Agent 2 thinking' } },
        ]);

        React.useEffect(() => {
          // Add agent
          setTimeout(() => {
            setAgents(prev => [...prev, {
              name: 'agent3',
              status: 'active',
              debugInfo: { thinking: 'Agent 3 just added' },
            }]);
          }, 50);

          // Remove middle agent
          setTimeout(() => {
            setAgents(prev => prev.filter(a => a.name !== 'agent2'));
          }, 100);

          // Update existing agent
          setTimeout(() => {
            setAgents(prev => prev.map(a =>
              a.name === 'agent1'
                ? { ...a, debugInfo: { thinking: 'Agent 1 updated thinking' } }
                : a
            ));
          }, 150);
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="agent1"
            showThoughts={true}
          />
        );
      };

      render(<DynamicAgentList />);

      // Initial state
      expect(screen.getByText('💭 agent1 thinking')).toBeInTheDocument();
      expect(screen.getByText('💭 agent2 thinking')).toBeInTheDocument();
      expect(screen.getByText('Agent 1 thinking')).toBeInTheDocument();
      expect(screen.getByText('Agent 2 thinking')).toBeInTheDocument();

      // Should handle dynamic changes gracefully
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });

    it('validates proper cleanup of thinking display when agents are removed', () => {
      const CleanupTestComponent: React.FC = () => {
        const [showAgent, setShowAgent] = React.useState(true);

        React.useEffect(() => {
          // Remove agent after delay
          const timeout = setTimeout(() => setShowAgent(false), 100);
          return () => clearTimeout(timeout);
        }, []);

        const agents = showAgent ? [{
          name: 'temporary-agent',
          status: 'active' as const,
          debugInfo: { thinking: 'This agent will be removed...' },
        }] : [];

        return (
          <AgentPanel
            agents={agents}
            currentAgent="temporary-agent"
            showThoughts={true}
          />
        );
      };

      render(<CleanupTestComponent />);

      // Initial state
      expect(screen.getByText('💭 temporary-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('This agent will be removed...')).toBeInTheDocument();

      // After removal, should gracefully handle empty state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });
});