import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { AgentThoughts } from '../AgentThoughts';
import { AgentPanel, AgentInfo } from '../agents/AgentPanel';

// Mock the CollapsibleSection to capture keyboard props
const mockCollapsibleSection = vi.fn(({ title, children, allowKeyboardToggle, toggleKey, ...props }) => (
  <div
    data-testid="collapsible-section"
    data-keyboard-enabled={allowKeyboardToggle}
    data-toggle-key={toggleKey}
    data-title={title}
  >
    <div data-testid="title">{title}</div>
    <div data-testid="content">{children}</div>
  </div>
));

vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: mockCollapsibleSection,
}));

describe('AgentThoughts - Keyboard Integration', () => {
  const mockThinking = 'This is agent thinking that can be collapsed/expanded with keyboard shortcuts';
  const agentName = 'developer';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('keyboard accessibility inheritance', () => {
    it('enables keyboard interaction by default', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
        />
      );

      const section = screen.getByTestId('collapsible-section');
      // Should enable keyboard toggle by default (CollapsibleSection default)
      expect(section).toHaveAttribute('data-keyboard-enabled', 'true');
    });

    it('passes keyboard toggle settings to CollapsibleSection', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
        />
      );

      // Should inherit CollapsibleSection's default keyboard behavior
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true, // CollapsibleSection default
        }),
        expect.any(Object)
      );
    });

    it('maintains keyboard functionality across display modes', () => {
      const displayModes: Array<'normal' | 'verbose'> = ['normal', 'verbose'];

      displayModes.forEach(mode => {
        mockCollapsibleSection.mockClear();

        render(
          <AgentThoughts
            thinking={mockThinking}
            agent={agentName}
            displayMode={mode}
          />
        );

        expect(mockCollapsibleSection).toHaveBeenCalledWith(
          expect.objectContaining({
            displayMode: mode,
            allowKeyboardToggle: true,
          }),
          expect.any(Object)
        );
      });
    });

    it('does not render keyboard-enabled component in compact mode', () => {
      const { container } = render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
          displayMode="compact"
        />
      );

      // In compact mode, returns empty Box, no keyboard functionality needed
      expect(container.firstChild).toBeTruthy();
      expect(screen.queryByTestId('collapsible-section')).not.toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts for thinking toggle', () => {
    it('provides clear visual indication of keyboard functionality', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
          defaultCollapsed={false}
        />
      );

      // Should show thinking content and title for keyboard accessibility
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      expect(screen.getByText(mockThinking)).toBeInTheDocument();
    });

    it('maintains accessible title for keyboard navigation', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
          useAsciiIcons={true}
        />
      );

      // ASCII icons provide better accessibility in terminal environments
      expect(screen.getByText(/\[T\] developer thinking/)).toBeInTheDocument();
    });

    it('supports custom icons while maintaining keyboard accessibility', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
          icon="🧠"
        />
      );

      expect(screen.getByText(/🧠 developer thinking/)).toBeInTheDocument();
    });
  });

  describe('integration with AgentPanel keyboard functionality', () => {
    const agentsWithThinking: AgentInfo[] = [
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        debugInfo: {
          thinking: 'Working on feature implementation with keyboard shortcuts support.',
          tokensUsed: { input: 1500, output: 2500 },
        },
      },
      {
        name: 'tester',
        status: 'active',
        stage: 'testing',
        debugInfo: {
          thinking: 'Testing keyboard accessibility features.',
          tokensUsed: { input: 800, output: 1200 },
        },
      },
    ];

    it('enables keyboard interaction for all AgentThoughts in AgentPanel', () => {
      render(
        <AgentPanel
          agents={agentsWithThinking}
          showThoughts={true}
          currentAgent="developer"
        />
      );

      // Should render AgentPanel with thoughts
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Each AgentThoughts component should have keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledTimes(2);

      // Both calls should enable keyboard interaction
      mockCollapsibleSection.mock.calls.forEach(call => {
        expect(call[0]).toMatchObject({
          allowKeyboardToggle: true,
        });
      });
    });

    it('maintains keyboard functionality in verbose mode', () => {
      render(
        <AgentPanel
          agents={agentsWithThinking}
          showThoughts={true}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should pass verbose mode to AgentThoughts components
      mockCollapsibleSection.mock.calls.forEach(call => {
        expect(call[0]).toMatchObject({
          displayMode: 'verbose',
          allowKeyboardToggle: true,
        });
      });
    });

    it('handles keyboard interaction with parallel agents', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel-dev',
          status: 'parallel',
          stage: 'feature-a',
          debugInfo: {
            thinking: 'Working on feature A in parallel.',
          },
        },
        {
          name: 'parallel-test',
          status: 'parallel',
          stage: 'feature-b',
          debugInfo: {
            thinking: 'Testing feature B in parallel.',
          },
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('parallel-dev')).toBeInTheDocument();
      expect(screen.getByText('parallel-test')).toBeInTheDocument();

      // Should enable keyboard for parallel agent thoughts
      expect(mockCollapsibleSection).toHaveBeenCalledTimes(2);
    });

    it('provides consistent keyboard experience across regular and parallel agents', () => {
      const regularAgents: AgentInfo[] = [
        {
          name: 'architect',
          status: 'active',
          debugInfo: { thinking: 'Regular agent thinking.' },
        },
      ];

      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          debugInfo: { thinking: 'Parallel agent thinking.' },
        },
      ];

      render(
        <AgentPanel
          agents={regularAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
        />
      );

      // Both regular and parallel agents should have same keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledTimes(2);

      const calls = mockCollapsibleSection.mock.calls;
      calls.forEach(call => {
        expect(call[0]).toMatchObject({
          allowKeyboardToggle: true,
          dimmed: true,
          borderStyle: 'round',
        });
      });
    });
  });

  describe('keyboard accessibility edge cases', () => {
    it('handles agents with very long thinking content', () => {
      const longThinking = 'Very long thinking content that might require scrolling. '.repeat(50);
      const agentWithLongThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: longThinking,
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

      // Should still provide keyboard accessibility for long content
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('handles agents with multiline thinking content', () => {
      const multilineThinking = `Step 1: Analyze requirements
Step 2: Design solution
Step 3: Implement with keyboard shortcuts
Step 4: Test accessibility`;

      const agentWithMultilineThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: multilineThinking,
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

      // Should handle multiline content with keyboard accessibility
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('handles special characters in thinking content for keyboard display', () => {
      const specialThinking = 'Thinking with émojis 🤔💭, keyboard shortcuts (Ctrl+C), and special chars';

      const agentWithSpecialThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: specialThinking,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithSpecialThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should handle special characters without breaking keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('maintains keyboard functionality when rapidly toggling showThoughts', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Test thinking for rapid toggle.',
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agents}
          showThoughts={false}
        />
      );

      // Toggle showThoughts rapidly
      for (let i = 0; i < 5; i++) {
        rerender(
          <AgentPanel
            agents={agents}
            showThoughts={i % 2 === 0}
          />
        );
      }

      // Should handle rapid toggling without keyboard functionality issues
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('keyboard functionality with different agent states', () => {
    it('provides keyboard access for thoughts from completed agents', () => {
      const completedAgentWithThinking: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Planning completed with full analysis.',
          },
        },
      ];

      render(
        <AgentPanel
          agents={completedAgentWithThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();

      // Completed agents' thoughts should still have keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('provides keyboard access for thoughts from waiting agents', () => {
      const waitingAgentWithThinking: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'waiting',
          debugInfo: {
            thinking: 'Waiting for implementation to complete.',
          },
        },
      ];

      render(
        <AgentPanel
          agents={waitingAgentWithThinking}
          showThoughts={true}
        />
      );

      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Waiting agents' thoughts should have keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('provides consistent keyboard shortcuts across all agent statuses', () => {
      const mixedStatusAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: { thinking: 'Completed thoughts.' },
        },
        {
          name: 'architect',
          status: 'active',
          debugInfo: { thinking: 'Active thoughts.' },
        },
        {
          name: 'reviewer',
          status: 'waiting',
          debugInfo: { thinking: 'Waiting thoughts.' },
        },
        {
          name: 'tester',
          status: 'idle',
          debugInfo: { thinking: 'Idle thoughts.' },
        },
      ];

      render(
        <AgentPanel
          agents={mixedStatusAgents}
          showThoughts={true}
        />
      );

      // All agents should be rendered
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // All should have consistent keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledTimes(4);

      mockCollapsibleSection.mock.calls.forEach(call => {
        expect(call[0]).toMatchObject({
          allowKeyboardToggle: true,
          dimmed: true,
          borderStyle: 'round',
        });
      });
    });
  });

  describe('terminal-specific keyboard considerations', () => {
    it('supports ASCII icons for better terminal compatibility', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
          useAsciiIcons={true}
        />
      );

      // ASCII icons should be more compatible with terminal keyboard navigation
      expect(screen.getByText(/\[T\] developer thinking/)).toBeInTheDocument();

      // Should still maintain keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('handles truncation gracefully with keyboard navigation', () => {
      const longThinking = 'a'.repeat(1000);

      render(
        <AgentThoughts
          thinking={longThinking}
          agent={agentName}
          maxLength={100}
        />
      );

      // Should show character count for truncated content
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          headerExtra: expect.any(Object), // Character count display
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });

    it('maintains keyboard functionality with custom borders', () => {
      render(
        <AgentThoughts
          thinking={mockThinking}
          agent={agentName}
        />
      );

      // Should use round border style with keyboard functionality
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          borderStyle: 'round',
          allowKeyboardToggle: true,
        }),
        expect.any(Object)
      );
    });
  });
});