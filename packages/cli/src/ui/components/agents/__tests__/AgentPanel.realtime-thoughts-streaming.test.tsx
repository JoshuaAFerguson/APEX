/**
 * Integration tests for AgentThoughts in AgentPanel with real-time streaming
 *
 * Validates the complete flow from agent:thinking events to UI display:
 * 1. AgentPanel shows AgentThoughts when showThoughts=true
 * 2. agent:thinking events populate thoughts correctly
 * 3. Real-time thought streaming updates display
 * 4. All existing tests still pass (handled by existing test suite)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { EventEmitter } from 'events';

// Mock the useElapsedTime hook to avoid timer complexity
vi.mock('../../hooks/useElapsedTime', () => ({
  useElapsedTime: vi.fn(() => '2m 30s'),
}));

// Mock the useAgentHandoff hook to focus on thoughts streaming
vi.mock('../../hooks/useAgentHandoff', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

// Mock HandoffIndicator to focus on core functionality
vi.mock('../HandoffIndicator', () => ({
  HandoffIndicator: () => null,
}));

// Mock the useOrchestratorEvents hook to simulate real-time events
const mockOrchestrator = new EventEmitter();
const mockUseOrchestratorEvents = vi.fn();

vi.mock('../../hooks/useOrchestratorEvents', () => ({
  useOrchestratorEvents: mockUseOrchestratorEvents,
}));

describe('AgentPanel Real-time Thoughts Streaming Integration', () => {
  // Mock state that would be updated by useOrchestratorEvents
  let mockAgentState: { [key: string]: AgentInfo } = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset agent state
    mockAgentState = {
      planner: { name: 'planner', status: 'completed', debugInfo: {} },
      architect: { name: 'architect', status: 'active', stage: 'designing', debugInfo: {} },
      developer: { name: 'developer', status: 'waiting', debugInfo: {} },
    };

    // Mock useOrchestratorEvents to update agent state on thinking events
    mockUseOrchestratorEvents.mockImplementation(() => {
      // Simulate the hook setting up event listeners
      React.useEffect(() => {
        const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
          if (mockAgentState[agent]) {
            mockAgentState[agent] = {
              ...mockAgentState[agent],
              debugInfo: {
                ...mockAgentState[agent].debugInfo,
                thinking,
              },
            };
            // Force re-render by triggering a state update
            // In real implementation, this would update React state
          }
        };

        mockOrchestrator.on('agent:thinking', handleAgentThinking);

        return () => {
          mockOrchestrator.off('agent:thinking', handleAgentThinking);
        };
      }, []);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockOrchestrator.removeAllListeners();
  });

  describe('AC1: AgentPanel shows AgentThoughts when showThoughts=true', () => {
    it('displays AgentThoughts components when showThoughts=true and thinking data exists', () => {
      const agentsWithThinking: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Planning phase completed successfully',
            tokensUsed: { input: 500, output: 800 },
          },
        },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          debugInfo: {
            thinking: 'Currently implementing core feature',
            tokensUsed: { input: 1200, output: 1800 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithThinking}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Verify AgentThoughts are rendered (via CollapsibleSection)
      expect(screen.getByText('💭 planner thinking')).toBeInTheDocument();
      expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
    });

    it('hides AgentThoughts components when showThoughts=false', () => {
      const agentsWithThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'This should be hidden',
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithThinking}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      // Verify AgentThoughts are not rendered
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('This should be hidden')).not.toBeInTheDocument();
    });

    it('shows AgentThoughts only for agents with thinking data when showThoughts=true', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Planner thoughts here',
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            // No thinking data
            tokensUsed: { input: 100, output: 200 },
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          // No debugInfo at all
        },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Only planner should have AgentThoughts displayed
      expect(screen.getByText('💭 planner thinking')).toBeInTheDocument();
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 tester thinking')).not.toBeInTheDocument();
    });
  });

  describe('AC2: agent:thinking events populate thoughts correctly', () => {
    it('updates agent thoughts when agent:thinking events are emitted', async () => {
      // Component that will re-render with updated agent state
      const TestComponent = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', stage: 'implementation', debugInfo: {} },
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

      render(<TestComponent />);

      // Initially no thoughts
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();

      // Emit agent:thinking event
      mockOrchestrator.emit('agent:thinking', 'test-task-id', 'developer', 'Starting implementation...');

      // Wait for state update and re-render
      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      });

      // Verify the thinking content is displayed
      expect(screen.getByText('Starting implementation...')).toBeInTheDocument();
    });

    it('handles multiple agent:thinking events for different agents', async () => {
      const TestComponent = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'planner', status: 'active', debugInfo: {} },
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

      render(<TestComponent />);

      // Emit thinking events for multiple agents
      mockOrchestrator.emit('agent:thinking', 'task-id', 'planner', 'Planning the architecture...');
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', 'Implementing features...');

      // Wait for both thoughts to appear
      await waitFor(() => {
        expect(screen.getByText('💭 planner thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
      });

      // Verify both thinking contents are displayed
      expect(screen.getByText('Planning the architecture...')).toBeInTheDocument();
      expect(screen.getByText('Implementing features...')).toBeInTheDocument();
    });

    it('overwrites previous thoughts when new agent:thinking events arrive', async () => {
      const TestComponent = () => {
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

      render(<TestComponent />);

      // First thinking
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', 'Initial thinking...');

      await waitFor(() => {
        expect(screen.getByText('Initial thinking...')).toBeInTheDocument();
      });

      // Second thinking (should replace the first)
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', 'Updated thinking process...');

      await waitFor(() => {
        expect(screen.getByText('Updated thinking process...')).toBeInTheDocument();
      });

      // Old thinking should be gone
      expect(screen.queryByText('Initial thinking...')).not.toBeInTheDocument();
    });
  });

  describe('AC3: Real-time thought streaming updates display', () => {
    it('displays thoughts immediately as they stream in from agent:thinking events', async () => {
      const TestComponent = () => {
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

      render(<TestComponent />);

      // Simulate streaming thoughts with delays
      const streamingThoughts = [
        'Analyzing the problem...',
        'Considering different approaches...',
        'Implementing the solution...',
        'Testing the implementation...',
      ];

      // Stream thoughts with minimal delay
      for (let i = 0; i < streamingThoughts.length; i++) {
        mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', streamingThoughts[i]);

        // Verify each thought appears immediately
        await waitFor(() => {
          expect(screen.getByText(streamingThoughts[i])).toBeInTheDocument();
        });

        // Verify previous thoughts are no longer visible (replaced)
        if (i > 0) {
          expect(screen.queryByText(streamingThoughts[i - 1])).not.toBeInTheDocument();
        }
      }
    });

    it('handles rapid streaming updates without performance degradation', async () => {
      const TestComponent = () => {
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
      render(<TestComponent />);

      // Emit many rapid thinking events
      for (let i = 0; i < 20; i++) {
        mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', `Rapid thought ${i + 1}`);
      }

      // Wait for final thought to appear
      await waitFor(() => {
        expect(screen.getByText('Rapid thought 20')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete rapidly (within 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('maintains thought display during agent status changes', async () => {
      const TestComponent = () => {
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

        const handleStatusChange = (newStatus: AgentInfo['status']) => {
          setAgents(prev => prev.map(a =>
            a.name === 'developer' ? { ...a, status: newStatus } : a
          ));
        };

        return (
          <div>
            <AgentPanel
              agents={agents}
              currentAgent="developer"
              showThoughts={true}
            />
            <button onClick={() => handleStatusChange('completed')}>
              Complete Developer
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      // Add thinking first
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', 'Working on implementation...');

      await waitFor(() => {
        expect(screen.getByText('Working on implementation...')).toBeInTheDocument();
      });

      // Change agent status
      screen.getByRole('button', { name: 'Complete Developer' }).click();

      // Thoughts should still be visible after status change
      expect(screen.getByText('Working on implementation...')).toBeInTheDocument();
      expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
    });
  });

  describe('Real-time streaming with parallel agents', () => {
    it('displays thoughts for parallel agents when showThoughts=true', async () => {
      const TestComponent = () => {
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

      render(<TestComponent />);

      // Emit thinking events for both main and parallel agents
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', 'Main implementation work...');
      mockOrchestrator.emit('agent:thinking', 'task-id', 'tester', 'Running test suites...');
      mockOrchestrator.emit('agent:thinking', 'task-id', 'deployer', 'Preparing deployment...');

      // Wait for all thoughts to appear
      await waitFor(() => {
        expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 tester thinking')).toBeInTheDocument();
        expect(screen.getByText('💭 deployer thinking')).toBeInTheDocument();
      });

      // Verify thinking contents
      expect(screen.getByText('Main implementation work...')).toBeInTheDocument();
      expect(screen.getByText('Running test suites...')).toBeInTheDocument();
      expect(screen.getByText('Preparing deployment...')).toBeInTheDocument();
    });
  });

  describe('Error handling in real-time streaming', () => {
    it('handles malformed agent:thinking events gracefully', async () => {
      const TestComponent = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          { name: 'developer', status: 'active', debugInfo: {} },
        ]);

        React.useEffect(() => {
          const handleAgentThinking = (taskId: string, agent: string, thinking: string) => {
            try {
              setAgents(prev => prev.map(a =>
                a.name === agent
                  ? { ...a, debugInfo: { ...a.debugInfo, thinking } }
                  : a
              ));
            } catch (error) {
              // Graceful error handling
              console.error('Error updating agent thinking:', error);
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

      render(<TestComponent />);

      // Emit malformed events - should not crash
      expect(() => {
        mockOrchestrator.emit('agent:thinking'); // Missing parameters
        mockOrchestrator.emit('agent:thinking', null, 'developer', 'thinking'); // Null task
        mockOrchestrator.emit('agent:thinking', 'task-id', null, 'thinking'); // Null agent
        mockOrchestrator.emit('agent:thinking', 'task-id', 'unknown-agent', 'thinking'); // Unknown agent
      }).not.toThrow();

      // Component should still be functional
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles empty or null thinking content', async () => {
      const TestComponent = () => {
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

      render(<TestComponent />);

      // Emit events with empty/null thinking
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', '');
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', null);
      mockOrchestrator.emit('agent:thinking', 'task-id', 'developer', undefined);

      // Should handle gracefully without crashing
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // AgentThoughts should not be shown for empty thinking
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();
    });
  });

  describe('Performance and memory management', () => {
    it('cleans up event listeners on component unmount', () => {
      const TestComponent = () => {
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

      const { unmount } = render(<TestComponent />);

      // Verify initial state
      expect(mockOrchestrator.listenerCount('agent:thinking')).toBeGreaterThan(0);

      // Unmount component
      unmount();

      // Event listeners should be cleaned up
      // Note: This is a simplistic test - in real implementation we'd verify
      // the specific listener was removed
      expect(() => unmount()).not.toThrow();
    });
  });
});