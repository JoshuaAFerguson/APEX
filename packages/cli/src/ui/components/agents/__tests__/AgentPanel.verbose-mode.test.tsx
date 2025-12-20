import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';

describe('AgentPanel - Verbose Mode Integration', () => {
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
    mockUseElapsedTime.mockReturnValue('02:15');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  const mockAgentsWithDebugInfo: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
    },
    {
      name: 'developer',
      status: 'active',
      stage: 'implementation',
      progress: 75,
      startedAt: new Date('2023-01-01T10:00:00Z'),
      debugInfo: {
        tokensUsed: { input: 12500, output: 3200 },
        turnCount: 8,
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

  describe('verbose mode rendering', () => {
    it('renders VerboseAgentRow components in verbose mode', () => {
      render(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should render all agent names
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Should show debug information for active agent with debugInfo
      expect(screen.getByText('🔢 Tokens: 12.5k→3.2k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 8')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();

      // Error count should not be shown when it's 0
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('does not show debug info for inactive agents in verbose mode', () => {
      const agentsWithDebugForAll: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            tokensUsed: { input: 500, output: 300 },
            turnCount: 2,
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1500, output: 2500 },
            turnCount: 3,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithDebugForAll}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Only active agent's debug info should be shown
      expect(screen.getByText('🔢 Tokens: 1.5k→2.5k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();

      // Completed agent's debug info should not be shown
      expect(screen.queryByText('🔢 Tokens: 500→300')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 Turns: 2')).not.toBeInTheDocument();
    });

    it('shows progress bar in verbose mode', () => {
      render(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Progress should be shown for active agent
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('shows elapsed time in verbose mode', () => {
      render(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Elapsed time should be shown for active agent
      expect(screen.getByText(/\[02:15\]/)).toBeInTheDocument();
    });

    it('renders regular AgentRow components in normal mode', () => {
      render(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Should render all agent names
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should NOT show debug information in normal mode
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();

      // Should still show progress
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('renders regular AgentRow components in compact mode', () => {
      render(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="compact"
        />
      );

      // In compact mode, should not show "Active Agents" header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show agent names in compact format
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should NOT show debug information in compact mode
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });

    it('handles agents without debugInfo in verbose mode', () => {
      const agentsWithoutDebugInfo: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          // No debugInfo
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithoutDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should show normal agent info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();

      // Should not show any debug fields
      expect(screen.queryByText(/🔢/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌/)).not.toBeInTheDocument();
    });

    it('shows error count only when greater than zero', () => {
      const agentWithErrors: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: 5,
            lastToolCall: 'WebFetch',
            errorCount: 3,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithErrors}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should show error count when > 0
      expect(screen.getByText('❌ Errors: 3')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1k→1.5k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: WebFetch')).toBeInTheDocument();
    });

    it('handles partial debug info correctly', () => {
      const agentWithPartialDebug: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            lastToolCall: 'Read',
            // Missing other fields
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithPartialDebug}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should show available fields
      expect(screen.getByText('🔧 Last tool: Read')).toBeInTheDocument();

      // Should not show missing fields
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });
  });

  describe('token formatting in verbose mode', () => {
    const tokenFormattingTests = [
      { input: 500, output: 300, expected: '500→300' },
      { input: 1500, output: 2500, expected: '1.5k→2.5k' },
      { input: 1000000, output: 2000000, expected: '1.0M→2.0M' },
    ];

    tokenFormattingTests.forEach(({ input, output, expected }) => {
      it(`formats ${input}→${output} as ${expected}`, () => {
        const agent: AgentInfo[] = [
          {
            name: 'developer',
            status: 'active',
            debugInfo: {
              tokensUsed: { input, output },
            },
          },
        ];

        render(
          <AgentPanel
            agents={agent}
            currentAgent="developer"
            displayMode="verbose"
          />
        );

        expect(screen.getByText(`🔢 Tokens: ${expected}`)).toBeInTheDocument();
      });
    });
  });

  describe('mode switching', () => {
    it('switches between normal and verbose modes correctly', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Initially in normal mode - no debug info
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Now should show debug info
      expect(screen.getByText('🔢 Tokens: 12.5k→3.2k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 8')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();

      // Switch back to normal mode
      rerender(
        <AgentPanel
          agents={mockAgentsWithDebugInfo}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Debug info should be hidden again
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });
  });

  describe('agent color handling in verbose mode', () => {
    it('passes correct colors to VerboseAgentRow', () => {
      const knownAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'architect', status: 'active' },
        { name: 'developer', status: 'active' },
        { name: 'custom-agent', status: 'idle' },
      ];

      render(
        <AgentPanel
          agents={knownAgents}
          currentAgent="architect"
          displayMode="verbose"
        />
      );

      // All agents should be rendered (color testing requires manual verification)
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('custom-agent')).toBeInTheDocument();
    });
  });
});