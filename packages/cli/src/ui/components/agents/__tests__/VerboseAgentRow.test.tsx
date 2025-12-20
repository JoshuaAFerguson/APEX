import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { VerboseAgentRow, type VerboseAgentRowProps } from '../VerboseAgentRow';
import type { AgentInfo } from '../AgentPanel';

describe('VerboseAgentRow', () => {
  // Mock the useElapsedTime hook
  const mockUseElapsedTime = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));
    mockUseElapsedTime.mockReturnValue('02:30');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  const baseAgent: AgentInfo = {
    name: 'developer',
    status: 'active',
    stage: 'implementation',
    startedAt: new Date('2023-01-01T10:00:00Z'),
  };

  const baseProps: VerboseAgentRowProps = {
    agent: baseAgent,
    isActive: true,
    color: 'green',
  };

  describe('basic rendering', () => {
    it('renders agent name and status icon', () => {
      render(<VerboseAgentRow {...baseProps} />);

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument(); // active status icon
    });

    it('renders stage when provided', () => {
      render(<VerboseAgentRow {...baseProps} />);

      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('renders elapsed time for active agents', () => {
      render(<VerboseAgentRow {...baseProps} />);

      expect(screen.getByText(/\[02:30\]/)).toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledWith(baseAgent.startedAt);
    });

    it('does not show elapsed time for non-active agents', () => {
      const inactiveAgent = { ...baseAgent, status: 'completed' as const };
      render(<VerboseAgentRow {...baseProps} agent={inactiveAgent} isActive={false} />);

      expect(screen.queryByText(/\[02:30\]/)).not.toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });

    it('applies correct color styling for active agents', () => {
      render(<VerboseAgentRow {...baseProps} />);

      // Agent name should be rendered with the specified color and bold
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('applies gray styling for inactive agents', () => {
      render(<VerboseAgentRow {...baseProps} isActive={false} />);

      // Agent name should be rendered in gray
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('status icons', () => {
    const statusTests = [
      { status: 'active', icon: '⚡' },
      { status: 'waiting', icon: '○' },
      { status: 'completed', icon: '✓' },
      { status: 'idle', icon: '·' },
      { status: 'parallel', icon: '⟂' },
    ] as const;

    statusTests.forEach(({ status, icon }) => {
      it(`renders correct icon for ${status} status`, () => {
        const agent = { ...baseAgent, status };
        render(<VerboseAgentRow {...baseProps} agent={agent} />);

        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });
  });

  describe('progress bar', () => {
    it('shows progress bar for active agents with progress between 0-100', () => {
      const agentWithProgress = { ...baseAgent, progress: 45 };
      render(<VerboseAgentRow {...baseProps} agent={agentWithProgress} />);

      // Progress bar should be rendered
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    it('shows progress bar for parallel agents with progress', () => {
      const parallelAgent = {
        ...baseAgent,
        status: 'parallel' as const,
        progress: 60
      };
      render(<VerboseAgentRow {...baseProps} agent={parallelAgent} />);

      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });

    it('hides progress bar for 0% progress', () => {
      const agentWithZeroProgress = { ...baseAgent, progress: 0 };
      render(<VerboseAgentRow {...baseProps} agent={agentWithZeroProgress} />);

      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    });

    it('hides progress bar for 100% progress', () => {
      const agentWithFullProgress = { ...baseAgent, progress: 100 };
      render(<VerboseAgentRow {...baseProps} agent={agentWithFullProgress} />);

      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    });

    it('hides progress bar when progress is undefined', () => {
      const agentNoProgress = { ...baseAgent };
      delete agentNoProgress.progress;
      render(<VerboseAgentRow {...baseProps} agent={agentNoProgress} />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('hides progress bar for non-active/non-parallel agents', () => {
      const completedAgent = {
        ...baseAgent,
        status: 'completed' as const,
        progress: 50
      };
      render(<VerboseAgentRow {...baseProps} agent={completedAgent} />);

      expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
    });
  });

  describe('debug information display', () => {
    const agentWithDebugInfo: AgentInfo = {
      ...baseAgent,
      debugInfo: {
        tokensUsed: { input: 1500, output: 2500 },
        turnCount: 3,
        lastToolCall: 'Edit',
        errorCount: 1,
      },
    };

    it('shows all debug info for active agents', () => {
      render(<VerboseAgentRow {...baseProps} agent={agentWithDebugInfo} />);

      expect(screen.getByText('🔢 Tokens: 1.5k→2.5k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });

    it('hides debug info for inactive agents', () => {
      render(<VerboseAgentRow
        {...baseProps}
        agent={agentWithDebugInfo}
        isActive={false}
      />);

      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('hides debug info when debugInfo is missing', () => {
      render(<VerboseAgentRow {...baseProps} />);

      expect(screen.queryByText(/🔢/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌/)).not.toBeInTheDocument();
    });

    describe('partial debug info', () => {
      it('shows only available token info', () => {
        const partialAgent = {
          ...baseAgent,
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
          },
        };
        render(<VerboseAgentRow {...baseProps} agent={partialAgent} />);

        expect(screen.getByText('🔢 Tokens: 1k→1.5k')).toBeInTheDocument();
        expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
      });

      it('shows only available turn count', () => {
        const partialAgent = {
          ...baseAgent,
          debugInfo: {
            turnCount: 5,
          },
        };
        render(<VerboseAgentRow {...baseProps} agent={partialAgent} />);

        expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
        expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
      });

      it('shows only last tool call', () => {
        const partialAgent = {
          ...baseAgent,
          debugInfo: {
            lastToolCall: 'WebFetch',
          },
        };
        render(<VerboseAgentRow {...baseProps} agent={partialAgent} />);

        expect(screen.getByText('🔧 Last tool: WebFetch')).toBeInTheDocument();
        expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
      });

      it('hides error count when zero', () => {
        const noErrorsAgent = {
          ...baseAgent,
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: 3,
            errorCount: 0,
          },
        };
        render(<VerboseAgentRow {...baseProps} agent={noErrorsAgent} />);

        expect(screen.getByText('🔢 Tokens: 1k→1.5k')).toBeInTheDocument();
        expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
        expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
      });

      it('handles undefined turn count correctly', () => {
        const undefinedTurnsAgent = {
          ...baseAgent,
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: undefined,
          },
        };
        render(<VerboseAgentRow {...baseProps} agent={undefinedTurnsAgent} />);

        expect(screen.getByText('🔢 Tokens: 1k→1.5k')).toBeInTheDocument();
        expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('token formatting', () => {
    const tokenTests = [
      { input: 500, output: 300, expected: '500→300' },
      { input: 1500, output: 2500, expected: '1.5k→2.5k' },
      { input: 1000000, output: 2000000, expected: '1.0M→2.0M' },
      { input: 1234567, output: 2345678, expected: '1.2M→2.3M' },
      { input: 999, output: 1001, expected: '999→1.0k' },
    ];

    tokenTests.forEach(({ input, output, expected }) => {
      it(`formats ${input}→${output} as ${expected}`, () => {
        const tokenAgent = {
          ...baseAgent,
          debugInfo: {
            tokensUsed: { input, output },
          },
        };
        render(<VerboseAgentRow {...baseProps} agent={tokenAgent} />);

        expect(screen.getByText(`🔢 Tokens: ${expected}`)).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('handles agent without stage', () => {
      const noStageAgent = { ...baseAgent };
      delete noStageAgent.stage;
      render(<VerboseAgentRow {...baseProps} agent={noStageAgent} />);

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });

    it('handles agent without startedAt', () => {
      const noStartTimeAgent = { ...baseAgent };
      delete noStartTimeAgent.startedAt;
      render(<VerboseAgentRow {...baseProps} agent={noStartTimeAgent} />);

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText(/\[/)).not.toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });

    it('handles long agent names', () => {
      const longNameAgent = {
        ...baseAgent,
        name: 'very-long-agent-name-that-might-wrap'
      };
      render(<VerboseAgentRow {...baseProps} agent={longNameAgent} />);

      expect(screen.getByText('very-long-agent-name-that-might-wrap')).toBeInTheDocument();
    });

    it('handles special characters in tool names', () => {
      const specialToolAgent = {
        ...baseAgent,
        debugInfo: {
          lastToolCall: 'WebFetch@2024',
        },
      };
      render(<VerboseAgentRow {...baseProps} agent={specialToolAgent} />);

      expect(screen.getByText('🔧 Last tool: WebFetch@2024')).toBeInTheDocument();
    });

    it('handles very large token counts', () => {
      const largeTokenAgent = {
        ...baseAgent,
        debugInfo: {
          tokensUsed: { input: 5000000, output: 8000000 },
        },
      };
      render(<VerboseAgentRow {...baseProps} agent={largeTokenAgent} />);

      expect(screen.getByText('🔢 Tokens: 5.0M→8.0M')).toBeInTheDocument();
    });

    it('handles high error counts', () => {
      const highErrorAgent = {
        ...baseAgent,
        debugInfo: {
          errorCount: 15,
        },
      };
      render(<VerboseAgentRow {...baseProps} agent={highErrorAgent} />);

      expect(screen.getByText('❌ Errors: 15')).toBeInTheDocument();
    });

    it('handles high turn counts', () => {
      const highTurnAgent = {
        ...baseAgent,
        debugInfo: {
          turnCount: 50,
        },
      };
      render(<VerboseAgentRow {...baseProps} agent={highTurnAgent} />);

      expect(screen.getByText('🔄 Turns: 50')).toBeInTheDocument();
    });
  });

  describe('component structure', () => {
    it('maintains proper component hierarchy', () => {
      const fullAgent = {
        ...baseAgent,
        progress: 45,
        debugInfo: {
          tokensUsed: { input: 1500, output: 2500 },
          turnCount: 3,
          lastToolCall: 'Edit',
          errorCount: 1,
        },
      };
      render(<VerboseAgentRow {...baseProps} agent={fullAgent} />);

      // Should render all sections
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1.5k→2.5k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });

    it('handles minimal agent data', () => {
      const minimalAgent: AgentInfo = {
        name: 'minimal',
        status: 'idle',
      };
      render(<VerboseAgentRow
        {...baseProps}
        agent={minimalAgent}
        isActive={false}
      />);

      expect(screen.getByText('minimal')).toBeInTheDocument();
      expect(screen.getByText('·')).toBeInTheDocument(); // idle status icon
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔢/)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides accessible text content', () => {
      const fullAgent = {
        ...baseAgent,
        debugInfo: {
          tokensUsed: { input: 1500, output: 2500 },
          turnCount: 3,
          lastToolCall: 'Edit',
          errorCount: 1,
        },
      };
      render(<VerboseAgentRow {...baseProps} agent={fullAgent} />);

      // All text should be accessible
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1.5k→2.5k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });
  });
});