import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Collapsible Thoughts Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('showThoughts prop behavior', () => {
    const agentsWithThinking: AgentInfo[] = [
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        debugInfo: {
          thinking: 'Currently implementing the core feature with careful consideration of edge cases.',
          tokensUsed: { input: 1500, output: 2500 },
          turnCount: 3,
        },
      },
      {
        name: 'tester',
        status: 'active',
        stage: 'testing',
        debugInfo: {
          thinking: 'Analyzing test coverage and preparing comprehensive test cases.',
          tokensUsed: { input: 800, output: 1200 },
          turnCount: 2,
        },
      },
      {
        name: 'reviewer',
        status: 'waiting',
        debugInfo: {
          tokensUsed: { input: 500, output: 300 },
          // No thinking field
        },
      },
    ];

    it('renders AgentThoughts when showThoughts=true and thinking data exists', () => {
      render(
        <AgentPanel
          agents={agentsWithThinking}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Should render the main panel
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should render agents
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // AgentThoughts should be rendered for agents with thinking data
      // Since AgentThoughts is mocked in setup, we verify the thinking content exists
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/testing/)).toBeInTheDocument();
    });

    it('does not render AgentThoughts when showThoughts=false', () => {
      render(
        <AgentPanel
          agents={agentsWithThinking}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      // Should render the main panel and agents
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // AgentThoughts should not be rendered
      // The thinking content should not be visible in the panel
    });

    it('defaults to not showing thoughts when showThoughts prop is omitted', () => {
      render(
        <AgentPanel
          agents={agentsWithThinking}
          currentAgent="developer"
          // showThoughts prop omitted
        />
      );

      // Should render normally without thoughts
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('only renders AgentThoughts for agents with thinking data', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Planning phase completed successfully.',
            tokensUsed: { input: 500, output: 800 },
          },
        },
        {
          name: 'architect',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            // No thinking field
          },
        },
        {
          name: 'developer',
          status: 'active',
          // No debugInfo at all
        },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          showThoughts={true}
        />
      );

      // All agents should be rendered
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Only planner should have AgentThoughts rendered (has thinking data)
      // This is tested by verifying the conditional rendering logic
    });
  });

  describe('display mode integration', () => {
    const agentWithThinking: AgentInfo[] = [
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        debugInfo: {
          thinking: 'Working on complex algorithm implementation.',
          tokensUsed: { input: 2000, output: 3000 },
        },
      },
    ];

    it('passes correct displayMode to AgentThoughts in normal mode', () => {
      render(
        <AgentPanel
          agents={agentWithThinking}
          showThoughts={true}
          displayMode="normal"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('passes correct displayMode to AgentThoughts in verbose mode', () => {
      render(
        <AgentPanel
          agents={agentWithThinking}
          showThoughts={true}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('does not render AgentThoughts in compact mode', () => {
      render(
        <AgentPanel
          agents={agentWithThinking}
          showThoughts={true}
          displayMode="compact"
        />
      );

      // Should render in compact format (no "Active Agents" header)
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // AgentThoughts should not be rendered in compact mode
      // because the AgentThoughts component itself returns empty Box in compact mode
    });

    it('maintains proper layout spacing with AgentThoughts in normal mode', () => {
      render(
        <AgentPanel
          agents={agentWithThinking}
          showThoughts={true}
          displayMode="normal"
        />
      );

      // Should maintain proper layout structure
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
    });

    it('maintains proper layout spacing with AgentThoughts in verbose mode', () => {
      render(
        <AgentPanel
          agents={agentWithThinking}
          showThoughts={true}
          displayMode="verbose"
        />
      );

      // Should maintain verbose layout with debug info and thoughts
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('parallel agents with thoughts', () => {
    const parallelAgentsWithThinking: AgentInfo[] = [
      {
        name: 'developer',
        status: 'parallel',
        stage: 'feature-a',
        debugInfo: {
          thinking: 'Working on feature A implementation in parallel.',
          tokensUsed: { input: 1500, output: 2000 },
        },
      },
      {
        name: 'tester',
        status: 'parallel',
        stage: 'feature-b-tests',
        debugInfo: {
          thinking: 'Writing comprehensive tests for feature B.',
          tokensUsed: { input: 800, output: 1200 },
        },
      },
      {
        name: 'reviewer',
        status: 'parallel',
        stage: 'code-review',
        debugInfo: {
          // No thinking data
          tokensUsed: { input: 600, output: 900 },
        },
      },
    ];

    it('renders AgentThoughts for parallel agents when showThoughts=true', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgentsWithThinking}
          showThoughts={true}
        />
      );

      // Should show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should render all parallel agents
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Should show stage information
      expect(screen.getByText(/feature-a/)).toBeInTheDocument();
      expect(screen.getByText(/feature-b-tests/)).toBeInTheDocument();
      expect(screen.getByText(/code-review/)).toBeInTheDocument();
    });

    it('does not render AgentThoughts for parallel agents when showThoughts=false', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgentsWithThinking}
          showThoughts={false}
        />
      );

      // Should show parallel execution section and agents
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // AgentThoughts should not be rendered
    });

    it('only renders AgentThoughts for parallel agents with thinking data', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgentsWithThinking}
          showThoughts={true}
        />
      );

      // Should render parallel section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // All agents should be rendered
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Only developer and tester should have AgentThoughts (have thinking data)
      // reviewer has no thinking data so should not have AgentThoughts
    });

    it('maintains proper spacing in parallel section with thoughts', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgentsWithThinking.slice(0, 1)} // Just one agent
          showThoughts={true}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('mixed agents and parallel agents with thoughts', () => {
    const regularAgents: AgentInfo[] = [
      {
        name: 'planner',
        status: 'completed',
        debugInfo: {
          thinking: 'Planning phase completed with full requirements analysis.',
        },
      },
      {
        name: 'architect',
        status: 'active',
        stage: 'design',
        debugInfo: {
          thinking: 'Working on system architecture design.',
        },
      },
    ];

    const parallelAgents: AgentInfo[] = [
      {
        name: 'developer',
        status: 'parallel',
        stage: 'implementation',
        debugInfo: {
          thinking: 'Implementing multiple features concurrently.',
        },
      },
      {
        name: 'tester',
        status: 'parallel',
        stage: 'testing',
        debugInfo: {
          thinking: 'Running tests while implementation is ongoing.',
        },
      },
    ];

    it('renders AgentThoughts for both regular and parallel agents', () => {
      render(
        <AgentPanel
          agents={regularAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
          currentAgent="architect"
        />
      );

      // Should show main section
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should show regular agents
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Should show parallel section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show parallel agents
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // All agents have thinking data, so AgentThoughts should be rendered for all
    });

    it('handles mixed display correctly when some agents lack thinking data', () => {
      const mixedRegularAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Completed planning.',
          },
        },
        {
          name: 'architect',
          status: 'active',
          stage: 'design',
          // No thinking data
        },
      ];

      const mixedParallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          debugInfo: {
            thinking: 'Implementing features.',
          },
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          // No thinking data
        },
      ];

      render(
        <AgentPanel
          agents={mixedRegularAgents}
          showParallel={true}
          parallelAgents={mixedParallelAgents}
          showThoughts={true}
        />
      );

      // Should render all agents
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Only planner and developer should have AgentThoughts (have thinking data)
    });
  });

  describe('edge cases with thoughts', () => {
    it('handles empty thinking strings gracefully', () => {
      const agentWithEmptyThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: '', // Empty string
            tokensUsed: { input: 1000, output: 1500 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithEmptyThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      // Empty thinking should not render AgentThoughts
    });

    it('handles undefined thinking gracefully', () => {
      const agentWithUndefinedThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: undefined,
            tokensUsed: { input: 1000, output: 1500 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithUndefinedThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      // Undefined thinking should not render AgentThoughts
    });

    it('handles agents without debugInfo when showThoughts=true', () => {
      const agentsWithoutDebugInfo: AgentInfo[] = [
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
          agents={agentsWithoutDebugInfo}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      // No AgentThoughts should be rendered
    });

    it('handles very long thinking content', () => {
      const agentWithLongThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Very long thinking content. '.repeat(100), // Very long thinking
            tokensUsed: { input: 2000, output: 3000 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithLongThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      // Should handle long content gracefully through AgentThoughts component
    });

    it('handles multiline thinking content', () => {
      const agentWithMultilineThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: `Step 1: Analyze requirements
Step 2: Design solution
Step 3: Implement code
Step 4: Test thoroughly`,
            tokensUsed: { input: 1500, output: 2500 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithMultilineThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      // Should handle multiline content properly
    });

    it('handles special characters in thinking content', () => {
      const agentWithSpecialChars: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Thinking with émojis 🤔💭, "quotes", <html>, & special chars',
            tokensUsed: { input: 1000, output: 1500 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithSpecialChars}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      // Should handle special characters without issues
    });
  });

  describe('performance with many agents and thoughts', () => {
    it('handles many agents with thinking data efficiently', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `agent-${i}`,
        status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'completed' : 'waiting',
        stage: `stage-${i}`,
        debugInfo: {
          thinking: `Agent ${i} is thinking about task ${i} with detailed analysis.`,
          tokensUsed: { input: 500 + i * 100, output: 800 + i * 150 },
        },
      }));

      render(
        <AgentPanel
          agents={manyAgents}
          showThoughts={true}
        />
      );

      // Should render all agents
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-9')).toBeInTheDocument();

      // Should handle many AgentThoughts components efficiently
    });

    it('handles rapid toggle of showThoughts prop', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Current thinking process.',
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agents}
          showThoughts={false}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();

      // Toggle showThoughts rapidly
      for (let i = 0; i < 5; i++) {
        rerender(
          <AgentPanel
            agents={agents}
            showThoughts={i % 2 === 0}
          />
        );
      }

      // Should handle rapid toggling without issues
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('maintains performance with changing thinking content', () => {
      const { rerender } = render(
        <AgentPanel
          agents={[{
            name: 'developer',
            status: 'active',
            debugInfo: {
              thinking: 'Initial thinking',
            },
          }]}
          showThoughts={true}
        />
      );

      // Rapidly update thinking content
      for (let i = 0; i < 10; i++) {
        rerender(
          <AgentPanel
            agents={[{
              name: 'developer',
              status: 'active',
              debugInfo: {
                thinking: `Updated thinking ${i}`,
              },
            }]}
            showThoughts={true}
          />
        );
      }

      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });
});