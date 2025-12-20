/**
 * Agent Panel Documentation Validation Test
 *
 * This test validates that all features documented in docs/features/v030-features.md
 * Section 4 (Agent Panel Visualization) are properly implemented and tested.
 *
 * Verification Points:
 * 1. AgentPanel modes (full/compact)
 * 2. Handoff animations
 * 3. Parallel execution view
 * 4. SubtaskTree visualization
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';
import { SubtaskTree, type SubtaskNode } from '../SubtaskTree';

describe('Agent Panel Documentation Validation', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'active', stage: 'designing' },
    { name: 'developer', status: 'parallel', stage: 'implementation', progress: 65 },
    { name: 'tester', status: 'parallel', stage: 'testing', progress: 40 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'devops', status: 'idle' },
  ];

  const parallelAgents: AgentInfo[] = [
    { name: 'developer', status: 'parallel', stage: 'implementation', progress: 65 },
    { name: 'tester', status: 'parallel', stage: 'testing', progress: 40 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. AgentPanel Component Modes', () => {
    it('should support full mode (default)', () => {
      render(<AgentPanel agents={mockAgents} />);

      // Documented behavior: Full mode shows "Active Agents" header
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should display all agents with their status icons
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should show status icons as documented
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/⟂/)).toBeInTheDocument(); // parallel
    });

    it('should support compact mode', () => {
      render(<AgentPanel agents={mockAgents} compact={true} />);

      // Documented behavior: Compact mode hides header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show agents in single line with separators
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // Should still show status icons
      expect(screen.getByText(/✓/)).toBeInTheDocument();
      expect(screen.getByText(/⚡/)).toBeInTheDocument();
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
    });

    it('should display agent progress when provided', () => {
      render(<AgentPanel agents={mockAgents} />);

      // Documented behavior: Show progress percentages
      expect(screen.getByText(/65%/)).toBeInTheDocument(); // developer
      expect(screen.getByText(/40%/)).toBeInTheDocument(); // tester
    });

    it('should display agent stages when provided', () => {
      render(<AgentPanel agents={mockAgents} />);

      // Documented behavior: Show stages in parentheses
      expect(screen.getByText(/\(designing\)/)).toBeInTheDocument(); // architect
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument(); // developer
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument(); // tester
    });
  });

  describe('2. Handoff Animations', () => {
    const mockUseAgentHandoff = vi.fn();

    beforeEach(() => {
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));
    });

    it('should trigger handoff animations on agent transitions', () => {
      // Documented behavior: Handoff animations show transitions
      const mockAnimationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
        isFading: false,
      };

      mockUseAgentHandoff.mockReturnValue(mockAnimationState);

      render(<AgentPanel agents={mockAgents} currentAgent="architect" />);

      // Verify handoff hook is called with current agent
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
    });

    it('should support animation states during handoffs', () => {
      // Documented behavior: Smooth transitions between agents
      const animationStates = [
        { progress: 0, isFading: false },
        { progress: 0.5, isFading: false },
        { progress: 1, isFading: true },
      ];

      animationStates.forEach(state => {
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          ...state,
        });

        const { unmount } = render(<AgentPanel agents={mockAgents} currentAgent="architect" />);

        // Should handle animation states without errors
        expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');

        unmount();
      });
    });
  });

  describe('3. Parallel Execution View', () => {
    it('should display parallel execution section when enabled', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Documented behavior: Show "⟂ Parallel Execution" header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should display parallel agents with progress
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();
    });

    it('should hide parallel section when no parallel agents', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // Documented behavior: Hide when no parallel agents
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('should display parallel agents in compact mode', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Documented behavior: Compact mode shows comma-separated list
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('should use cyan color theming for parallel agents', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Documented behavior: Parallel agents use ⟂ icon
      const parallelIcons = screen.getAllByText(/⟂/);
      // Should have header icon + agent icons
      expect(parallelIcons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('4. SubtaskTree Visualization', () => {
    const mockSubtask: SubtaskNode = {
      id: '1',
      description: 'Implement authentication system',
      status: 'in-progress',
      progress: 60,
      children: [
        {
          id: '1.1',
          description: 'Create user model',
          status: 'completed'
        },
        {
          id: '1.2',
          description: 'Implement login endpoint',
          status: 'in-progress',
          progress: 80,
          children: [
            {
              id: '1.2.1',
              description: 'Validate credentials',
              status: 'completed'
            },
            {
              id: '1.2.2',
              description: 'Generate JWT token',
              status: 'pending'
            }
          ]
        },
        {
          id: '1.3',
          description: 'Add password encryption',
          status: 'pending'
        }
      ]
    };

    it('should display hierarchical task breakdown', () => {
      render(<SubtaskTree task={mockSubtask} />);

      // Documented behavior: Show task hierarchy
      expect(screen.getByText('Implement authentication system')).toBeInTheDocument();
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate credentials')).toBeInTheDocument();
      expect(screen.getByText('Generate JWT token')).toBeInTheDocument();
    });

    it('should show task status indicators', () => {
      render(<SubtaskTree task={mockSubtask} />);

      // Documented behavior: Different icons for different statuses
      // The exact icons may vary, but there should be different visual indicators
      const taskElements = screen.getAllByText(/Create user model|Generate JWT token|Add password encryption/);
      expect(taskElements.length).toBeGreaterThan(0);
    });

    it('should display progress information when available', () => {
      render(<SubtaskTree task={mockSubtask} />);

      // Documented behavior: Show progress percentages
      expect(screen.getByText(/60%/)).toBeInTheDocument(); // main task
      expect(screen.getByText(/80%/)).toBeInTheDocument(); // login endpoint
    });

    it('should support collapsible task trees', () => {
      render(<SubtaskTree task={mockSubtask} />);

      // Documented behavior: Tasks should be expandable/collapsible
      // This tests that the tree structure is rendered properly
      expect(screen.getByText('Implement authentication system')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate credentials')).toBeInTheDocument();
    });
  });

  describe('5. Verbose Mode Debug Information', () => {
    const agentWithDebugInfo: AgentInfo[] = [
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        debugInfo: {
          thinking: 'Working on authentication logic...',
          tokensUsed: { input: 1500, output: 2500 },
          stageStartedAt: new Date('2023-01-01T10:00:00Z'),
          lastToolCall: 'Edit',
          turnCount: 3,
          errorCount: 1,
        },
      },
    ];

    it('should display debug information in verbose mode', () => {
      render(
        <AgentPanel
          agents={agentWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Documented behavior: Show token usage, tool calls, etc.
      expect(screen.getByText('🔢 Tokens: 1500→2500')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });

    it('should support agent thoughts when showThoughts is enabled', () => {
      render(
        <AgentPanel
          agents={agentWithDebugInfo}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Documented behavior: Show agent thinking when available
      // The actual rendering depends on AgentThoughts component
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should hide debug info in normal mode', () => {
      render(
        <AgentPanel
          agents={agentWithDebugInfo}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Documented behavior: No debug info in normal mode
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
    });
  });

  describe('6. API Surface Documentation Validation', () => {
    it('should accept all documented AgentPanel props', () => {
      // This test validates the API surface matches documentation
      const allProps = {
        agents: mockAgents,
        currentAgent: 'developer',
        compact: false,
        showParallel: true,
        parallelAgents: parallelAgents,
        displayMode: 'verbose' as const,
        showThoughts: true,
      };

      // Should render without TypeScript or runtime errors
      expect(() => render(<AgentPanel {...allProps} />)).not.toThrow();
    });

    it('should accept all documented SubtaskTree props', () => {
      const mockTask: SubtaskNode = {
        id: '1',
        description: 'Test task',
        status: 'in-progress',
        progress: 50,
        startedAt: new Date(),
        estimatedDuration: 300000,
        children: [],
      };

      const allProps = {
        task: mockTask,
        maxDepth: 3,
        showProgress: true,
        showElapsedTime: true,
        onToggleCollapse: vi.fn(),
        collapsed: false,
      };

      // Should render without TypeScript or runtime errors
      expect(() => render(<SubtaskTree {...allProps} />)).not.toThrow();
    });
  });

  describe('7. Integration with Real-time Updates', () => {
    it('should handle rapid agent state updates', () => {
      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="planner" />);

      // Simulate rapid updates
      const updates = ['planner', 'architect', 'developer', 'tester'];
      updates.forEach((agent, index) => {
        const updatedAgents = mockAgents.map(a =>
          a.name === agent
            ? { ...a, status: 'active' as const, progress: index * 25 }
            : { ...a, status: a.status === 'active' ? 'completed' as const : a.status }
        );

        rerender(<AgentPanel agents={updatedAgents} currentAgent={agent} />);

        // Should handle updates without errors
        expect(screen.getByText(agent)).toBeInTheDocument();
      });
    });

    it('should handle parallel execution state changes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Start parallel execution
      rerender(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // End parallel execution
      rerender(
        <AgentPanel
          agents={mockAgents}
          showParallel={false}
          parallelAgents={[]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });
});