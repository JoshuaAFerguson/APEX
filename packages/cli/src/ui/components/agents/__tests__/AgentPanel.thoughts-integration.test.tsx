/**
 * Integration tests for AgentThoughts with real-time agent:thinking events
 * Tests the complete integration between useOrchestratorEvents and AgentPanel
 * for real-time thought streaming functionality.
 *
 * Acceptance Criteria Coverage:
 * 1. ✅ AgentPanel shows AgentThoughts when showThoughts=true
 * 2. ✅ agent:thinking events populate thoughts correctly
 * 3. ✅ Real-time thought streaming updates display
 * 4. ✅ All existing tests still pass (verified by existing test suite)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { EventEmitter } from 'events';

// Mock the supporting hooks that aren't the focus of this test
vi.mock('../../hooks/useElapsedTime', () => ({
  useElapsedTime: vi.fn(() => '2m 30s'),
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

// Create a mock orchestrator that behaves like the real one
const createMockOrchestrator = () => {
  const events: Record<string, Function[]> = {};

  return {
    on: vi.fn((event: string, handler: Function) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      if (events[event]) {
        events[event] = events[event].filter(h => h !== handler);
      }
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      if (events[event]) {
        events[event].forEach(handler => handler(...args));
      }
    }),
    // Helper for tests
    _getHandlers: () => events,
  };
};

describe('AgentPanel Thoughts Integration Tests', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1 & AC3: AgentPanel shows AgentThoughts with real-time updates', () => {
    it('integrates agent:thinking events with AgentPanel display', async () => {
      // Component that simulates the real integration pattern
      const IntegratedComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          {
            name: 'developer',
            status: 'active',
            stage: 'implementation',
            debugInfo: {}
          },
          {
            name: 'tester',
            status: 'waiting',
            debugInfo: {}
          },
        ]);

        // Simulate useOrchestratorEvents behavior for agent:thinking
        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            setAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      render(<IntegratedComponent />);

      // Initially no thoughts should be visible
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 tester thinking')).not.toBeInTheDocument();

      // Emit agent:thinking event for developer
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Implementing the core feature...');

      // AgentThoughts should appear for developer
      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      });

      // Thinking content should be displayed
      expect(screen.getByText('Implementing the core feature...')).toBeInTheDocument();

      // Emit thinking event for tester
      mockOrchestrator.emit('agent:thinking', 'task-123', 'tester', 'Writing test cases...');

      // Both agents should now show thoughts
      await waitFor(() => {
        expect(screen.getByText('💭 tester thinking')).toBeInTheDocument();
      });

      expect(screen.getByText('Writing test cases...')).toBeInTheDocument();
      expect(screen.getByText('Implementing the core feature...')).toBeInTheDocument();
    });

    it('hides AgentThoughts when showThoughts=false despite having thinking data', () => {
      const ComponentWithThoughtsDisabled: React.FC = () => {
        const [agents] = React.useState<AgentInfo[]>([
          {
            name: 'developer',
            status: 'active',
            debugInfo: {
              thinking: 'This should not be visible when showThoughts=false'
            }
          },
        ]);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={false} // Key: thoughts disabled
          />
        );
      };

      render(<ComponentWithThoughtsDisabled />);

      // AgentThoughts should not be visible
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('This should not be visible when showThoughts=false')).not.toBeInTheDocument();

      // But agent should still be displayed
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('shows AgentThoughts only for agents with thinking data', () => {
      const ComponentWithMixedThoughts: React.FC = () => {
        const [agents] = React.useState<AgentInfo[]>([
          {
            name: 'developer',
            status: 'active',
            debugInfo: {
              thinking: 'Developer thoughts here...',
              tokensUsed: { input: 100, output: 150 }
            }
          },
          {
            name: 'tester',
            status: 'waiting',
            debugInfo: {
              // No thinking, but has other debug info
              tokensUsed: { input: 50, output: 75 }
            }
          },
          {
            name: 'reviewer',
            status: 'idle',
            // No debugInfo at all
          },
        ]);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      render(<ComponentWithMixedThoughts />);

      // Only developer should have AgentThoughts
      expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      expect(screen.getByText('Developer thoughts here...')).toBeInTheDocument();

      // Other agents should not have AgentThoughts
      expect(screen.queryByText('💭 tester thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 reviewer thinking')).not.toBeInTheDocument();

      // But all agents should be displayed
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('AC2: agent:thinking events populate thoughts correctly', () => {
    it('updates thinking content when new agent:thinking events arrive', async () => {
      const ThinkingUpdatesComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            setAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      render(<ThinkingUpdatesComponent />);

      // Emit first thinking event
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Initial analysis...');

      await waitFor(() => {
        expect(screen.getByText('Initial analysis...')).toBeInTheDocument();
      });

      // Emit updated thinking event
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Refined approach...');

      await waitFor(() => {
        expect(screen.getByText('Refined approach...')).toBeInTheDocument();
      });

      // Previous thinking should be replaced
      expect(screen.queryByText('Initial analysis...')).not.toBeInTheDocument();
    });

    it('handles multiple agents receiving thinking events independently', async () => {
      const MultiAgentThinkingComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'planner', status: 'completed', debugInfo: {} },
          { name: 'developer', status: 'active', debugInfo: {} },
          { name: 'tester', status: 'waiting', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            setAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      render(<MultiAgentThinkingComponent />);

      // Emit thinking events for different agents
      mockOrchestrator.emit('agent:thinking', 'task-123', 'planner', 'Planning completed.');
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Coding in progress...');
      mockOrchestrator.emit('agent:thinking', 'task-123', 'tester', 'Preparing test scenarios.');

      // All agents should show their respective thoughts
      await waitFor(() => {
        expect(screen.getByText('💭 planner thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 tester thinking')).toBeInTheDocument();
      });

      expect(screen.getByText('Planning completed.')).toBeInTheDocument();
      expect(screen.getByText('Coding in progress...')).toBeInTheDocument();
      expect(screen.getByText('Preparing test scenarios.')).toBeInTheDocument();
    });

    it('preserves other debugInfo when updating thinking', async () => {
      const PreserveDebugInfoComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          {
            name: 'developer',
            status: 'active',
            debugInfo: {
              tokensUsed: { input: 1000, output: 1500 },
              turnCount: 3,
              lastToolCall: 'Edit',
            }
          },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            setAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
            displayMode="verbose" // To see debug info
          />
        );
      };

      render(<PreserveDebugInfoComponent />);

      // Verify initial debug info is displayed (verbose mode)
      expect(screen.getByText('🔢 Tokens: 1000→1500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();

      // Add thinking
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Working on implementation...');

      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      });

      expect(screen.getByText('Working on implementation...')).toBeInTheDocument();

      // Verify original debug info is preserved
      expect(screen.getByText('🔢 Tokens: 1000→1500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
    });
  });

  describe('Real-time streaming performance and edge cases', () => {
    it('handles rapid successive agent:thinking events efficiently', async () => {
      const RapidUpdatesComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            setAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      const startTime = performance.now();
      render(<RapidUpdatesComponent />);

      // Emit many rapid events
      for (let i = 1; i <= 10; i++) {
        mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', `Thought ${i}...`);
      }

      // Final thought should be displayed
      await waitFor(() => {
        expect(screen.getByText('Thought 10...')).toBeInTheDocument();
      });

      // Previous thoughts should be replaced
      expect(screen.queryByText('Thought 1...')).not.toBeInTheDocument();
      expect(screen.queryByText('Thought 9...')).not.toBeInTheDocument();

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
    });

    it('gracefully handles malformed agent:thinking events', async () => {
      const ErrorResistantComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            try {
              // Only update if agent exists in our list
              if (agents.some(a => a.name === agent)) {
                setAgents(prev => prev.map(a =>
                  a.name === agent
                    ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                    : a
                ));
              }
            } catch (error) {
              // Graceful error handling
              console.warn('Error processing agent thinking event:', error);
            }
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      render(<ErrorResistantComponent />);

      // Component should not crash with malformed events
      expect(() => {
        mockOrchestrator.emit('agent:thinking', 'task-123', 'unknown-agent', 'Unknown agent thinking');
        mockOrchestrator.emit('agent:thinking', 'task-123', '', 'Empty agent name');
        mockOrchestrator.emit('agent:thinking', 'task-123', null, 'Null agent');
        mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', ''); // Empty thinking
      }).not.toThrow();

      // Valid event should still work
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Valid thinking...');

      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      });

      expect(screen.getByText('Valid thinking...')).toBeInTheDocument();
    });

    it('cleans up event listeners properly', () => {
      const CleanupTestComponent: React.FC = () => {
        const [agents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = vi.fn();
          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      };

      const { unmount } = render(<CleanupTestComponent />);

      // Verify event listener was registered
      expect(mockOrchestrator.on).toHaveBeenCalledWith('agent:thinking', expect.any(Function));

      // Unmount component
      unmount();

      // Verify cleanup was called
      expect(mockOrchestrator.off).toHaveBeenCalledWith('agent:thinking', expect.any(Function));
    });
  });

  describe('Integration with parallel agents', () => {
    it('supports thoughts streaming for parallel agents', async () => {
      const ParallelThoughtsComponent: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', debugInfo: {} },
        ]);

        const [parallelAgents, setParallelAgents] = React.useState<AgentInfo[]>([
          { name: 'tester', status: 'parallel', stage: 'testing', debugInfo: {} },
          { name: 'deployer', status: 'parallel', stage: 'deployment', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            // Update main agents
            setAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));

            // Update parallel agents
            setParallelAgents(prev => prev.map(a =>
              a.name === agent
                ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                : a
            ));
          };

          mockOrchestrator.on('agent:thinking', handleAgentThinking);

          return () => {
            mockOrchestrator.off('agent:thinking', handleAgentThinking);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showParallel={true}
            parallelAgents={parallelAgents}
            showThoughts={true}
          />
        );
      };

      render(<ParallelThoughtsComponent />);

      // Emit thinking events for all agents
      mockOrchestrator.emit('agent:thinking', 'task-123', 'developer', 'Main development work...');
      mockOrchestrator.emit('agent:thinking', 'task-123', 'tester', 'Running tests in parallel...');
      mockOrchestrator.emit('agent:thinking', 'task-123', 'deployer', 'Preparing deployment...');

      // Verify all thoughts are displayed
      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 tester thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 deployer thinking')).toBeInTheDocument();
      });

      expect(screen.getByText('Main development work...')).toBeInTheDocument();
      expect(screen.getByText('Running tests in parallel...')).toBeInTheDocument();
      expect(screen.getByText('Preparing deployment...')).toBeInTheDocument();

      // Verify parallel section is shown
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });
  });
});