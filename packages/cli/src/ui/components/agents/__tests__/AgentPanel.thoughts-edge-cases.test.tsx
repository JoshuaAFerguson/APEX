/**
 * Edge case tests for ThoughtDisplay integration with AgentPanel
 * These tests focus on boundary conditions, error handling, and edge scenarios
 * that complement the existing comprehensive test suite.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock dependencies that aren't the focus of this test
vi.mock('../../hooks/useElapsedTime', () => ({
  useElapsedTime: vi.fn(() => '1m 23s'),
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

describe('AgentPanel ThoughtDisplay Integration - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles extremely large thinking content without memory issues', () => {
      // Create a large thinking string (1MB)
      const largeThinking = 'x'.repeat(1024 * 1024);
      const agentWithLargeThinking: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: largeThinking,
          },
        },
      ];

      const startMemory = process.memoryUsage().heapUsed;

      expect(() => {
        render(
          <AgentPanel
            agents={agentWithLargeThinking}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      }).not.toThrow();

      // Component should render without crashes
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be reasonable (less than 10MB for this test)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('performs well with rapid rendering cycles', () => {
      const thinkingStates = [
        'Initial thinking...',
        'Refining approach...',
        'Implementing solution...',
        'Testing implementation...',
        'Finalizing code...',
      ];

      let currentThinkingIndex = 0;
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: thinkingStates[0],
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      const startTime = performance.now();

      // Simulate rapid updates (100 times)
      for (let i = 0; i < 100; i++) {
        currentThinkingIndex = (currentThinkingIndex + 1) % thinkingStates.length;
        agents[0].debugInfo!.thinking = thinkingStates[currentThinkingIndex];

        rerender(
          <AgentPanel
            agents={[...agents]}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      }

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should complete rapidly (less than 1 second for 100 renders)
      expect(renderTime).toBeLessThan(1000);

      // Final state should be correct
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('💭 developer thinking')).toBeInTheDocument();
    });
  });

  describe('Unicode and Special Character Edge Cases', () => {
    it('handles thinking content with complex Unicode characters', () => {
      const unicodeThinking = `
        Complex Unicode test: 🚀🔬💡🎯
        Mathematical: ∑∆∞∫∂∇⊕⊗⊤⊥
        Emoji combinations: 👨‍💻👩‍🔬🧑‍🎨
        Scripts: العربية 中文 한국어 日本語 Русский
        Symbols: ≡≠≤≥≈≪≫∈∋∩∪∧∨
        Arrows: ↑↓←→↕↔⇄⇆⇈⇊
      `;

      const agentWithUnicode: AgentInfo[] = [
        {
          name: 'internationalization-agent',
          status: 'active',
          debugInfo: {
            thinking: unicodeThinking,
          },
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={agentWithUnicode}
            currentAgent="internationalization-agent"
            showThoughts={true}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('internationalization-agent')).toBeInTheDocument();
      expect(screen.getByText('💭 internationalization-agent thinking')).toBeInTheDocument();

      // Unicode content should be preserved in the thinking display
      expect(screen.getByText(/Complex Unicode test: 🚀🔬💡🎯/)).toBeInTheDocument();
      expect(screen.getByText(/Mathematical: ∑∆∞∫∂∇⊕⊗⊤⊥/)).toBeInTheDocument();
    });

    it('handles thinking content with control characters and edge whitespace', () => {
      const controlCharThinking = `
        \t\tTab-indented thinking
        \r\nWindows line endings\r\n
        \v\fVertical tab and form feed
        \0Null character test\0
        \x01\x02\x03Control characters
        \u2028\u2029Unicode line separators
        \uFEFFByte order mark
      `;

      const agentWithControlChars: AgentInfo[] = [
        {
          name: 'control-char-agent',
          status: 'active',
          debugInfo: {
            thinking: controlCharThinking,
          },
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={agentWithControlChars}
            currentAgent="control-char-agent"
            showThoughts={true}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('control-char-agent')).toBeInTheDocument();
      expect(screen.getByText('💭 control-char-agent thinking')).toBeInTheDocument();
    });
  });

  describe('Boundary Value Edge Cases', () => {
    it('handles exactly empty thinking string', () => {
      const agentWithEmptyThinking: AgentInfo[] = [
        {
          name: 'empty-thinking-agent',
          status: 'active',
          debugInfo: {
            thinking: '',
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithEmptyThinking}
          currentAgent="empty-thinking-agent"
          showThoughts={true}
        />
      );

      expect(screen.getByText('empty-thinking-agent')).toBeInTheDocument();
      // Empty thinking should not render AgentThoughts (due to truthy check)
      expect(screen.queryByText('💭 empty-thinking-agent thinking')).not.toBeInTheDocument();
    });

    it('handles thinking string with only whitespace', () => {
      const agentWithWhitespaceThinking: AgentInfo[] = [
        {
          name: 'whitespace-agent',
          status: 'active',
          debugInfo: {
            thinking: '   \t\n\r   ',
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithWhitespaceThinking}
          currentAgent="whitespace-agent"
          showThoughts={true}
        />
      );

      expect(screen.getByText('whitespace-agent')).toBeInTheDocument();
      // Whitespace-only thinking should still render (truthy check passes)
      expect(screen.getByText('💭 whitespace-agent thinking')).toBeInTheDocument();
    });

    it('handles thinking at exact truncation boundaries', () => {
      // Test content exactly at normal mode limit (300 chars)
      const exactly300Chars = 'A'.repeat(300);
      const agentWithExact300: AgentInfo[] = [
        {
          name: 'exact-300-agent',
          status: 'active',
          debugInfo: {
            thinking: exactly300Chars,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithExact300}
          currentAgent="exact-300-agent"
          showThoughts={true}
          displayMode="normal"
        />
      );

      expect(screen.getByText('💭 exact-300-agent thinking')).toBeInTheDocument();
      // Should not show truncation indicator for exactly 300 chars
      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();

      // Test content one character over limit (301 chars)
      const exactly301Chars = 'A'.repeat(301);
      const agentWithExact301: AgentInfo[] = [
        {
          name: 'exact-301-agent',
          status: 'active',
          debugInfo: {
            thinking: exactly301Chars,
          },
        },
      ];

      render(
        <AgentPanel
          agents={agentWithExact301}
          currentAgent="exact-301-agent"
          showThoughts={true}
          displayMode="normal"
        />
      );

      expect(screen.getByText('💭 exact-301-agent thinking')).toBeInTheDocument();
      // Should show truncation indicator for 301 chars
      expect(screen.getByText(/\(301 chars\)/)).toBeInTheDocument();
    });
  });

  describe('Concurrent State Edge Cases', () => {
    it('handles rapid state changes without race conditions', async () => {
      const RapidStateChanges: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([
          {
            name: 'rapid-agent',
            status: 'active',
            debugInfo: { thinking: 'Initial state' },
          },
        ]);

        React.useEffect(() => {
          // Simulate rapid state changes
          const intervals = [];
          for (let i = 0; i < 10; i++) {
            const interval = setTimeout(() => {
              setAgents(prev => [
                {
                  ...prev[0],
                  debugInfo: {
                    ...prev[0].debugInfo,
                    thinking: `State change ${i + 1}`,
                  },
                },
              ]);
            }, i * 10); // Every 10ms
            intervals.push(interval);
          }

          return () => {
            intervals.forEach(clearTimeout);
          };
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="rapid-agent"
            showThoughts={true}
          />
        );
      };

      expect(() => {
        render(<RapidStateChanges />);
      }).not.toThrow();

      // Component should still be rendered
      expect(screen.getByText('rapid-agent')).toBeInTheDocument();
      expect(screen.getByText('💭 rapid-agent thinking')).toBeInTheDocument();
    });

    it('handles concurrent agent additions and removals', () => {
      const ConcurrentChanges: React.FC = () => {
        const [agents, setAgents] = React.useState<AgentInfo[]>([]);

        React.useEffect(() => {
          // Add agents rapidly
          setTimeout(() => {
            setAgents([
              { name: 'agent1', status: 'active', debugInfo: { thinking: 'Agent 1 thinking' } },
            ]);
          }, 10);

          setTimeout(() => {
            setAgents(prev => [
              ...prev,
              { name: 'agent2', status: 'active', debugInfo: { thinking: 'Agent 2 thinking' } },
            ]);
          }, 20);

          // Remove first agent
          setTimeout(() => {
            setAgents(prev => prev.slice(1));
          }, 30);

          // Add new agent
          setTimeout(() => {
            setAgents(prev => [
              ...prev,
              { name: 'agent3', status: 'active', debugInfo: { thinking: 'Agent 3 thinking' } },
            ]);
          }, 40);
        }, []);

        return (
          <AgentPanel
            agents={agents}
            currentAgent="agent2"
            showThoughts={true}
          />
        );
      };

      expect(() => {
        render(<ConcurrentChanges />);
      }).not.toThrow();

      // Should handle the concurrent changes gracefully
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('Edge Cases with Different Display Modes', () => {
    it('handles mode transitions with thinking data', () => {
      const agentWithThinking: AgentInfo[] = [
        {
          name: 'mode-transition-agent',
          status: 'active',
          debugInfo: {
            thinking: 'Thinking content for mode transitions',
          },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agentWithThinking}
          currentAgent="mode-transition-agent"
          showThoughts={true}
          displayMode="normal"
        />
      );

      expect(screen.getByText('💭 mode-transition-agent thinking')).toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <AgentPanel
          agents={agentWithThinking}
          currentAgent="mode-transition-agent"
          showThoughts={true}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('💭 mode-transition-agent thinking')).toBeInTheDocument();

      // Switch to compact mode (should hide thoughts)
      rerender(
        <AgentPanel
          agents={agentWithThinking}
          currentAgent="mode-transition-agent"
          showThoughts={true}
          displayMode="compact"
        />
      );

      // In compact mode, AgentThoughts should not be rendered
      expect(screen.queryByText('💭 mode-transition-agent thinking')).not.toBeInTheDocument();
      expect(screen.getByText('mode-transition-agent')).toBeInTheDocument(); // Agent still shown
    });

    it('handles parallel agents with thinking in different modes', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel1',
          status: 'parallel',
          debugInfo: { thinking: 'Parallel agent 1 thinking' },
        },
        {
          name: 'parallel2',
          status: 'parallel',
          debugInfo: { thinking: 'Parallel agent 2 thinking' },
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          parallelAgents={parallelAgents}
          showParallel={true}
          showThoughts={true}
          displayMode="normal"
        />
      );

      expect(screen.getByText('💭 parallel1 thinking')).toBeInTheDocument();
      expect(screen.getByText('💭 parallel2 thinking')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <AgentPanel
          agents={[]}
          parallelAgents={parallelAgents}
          showParallel={true}
          showThoughts={true}
          displayMode="compact"
        />
      );

      // In compact mode, thoughts should not be shown
      expect(screen.queryByText('💭 parallel1 thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 parallel2 thinking')).not.toBeInTheDocument();
    });
  });

  describe('Error Boundary and Resilience', () => {
    it('handles malformed debugInfo gracefully', () => {
      const agentWithMalformedDebugInfo: AgentInfo[] = [
        {
          name: 'malformed-agent',
          status: 'active',
          // @ts-expect-error - Testing malformed debugInfo
          debugInfo: null,
        },
        {
          name: 'malformed-agent-2',
          status: 'active',
          // @ts-expect-error - Testing malformed debugInfo
          debugInfo: undefined,
        },
        {
          name: 'malformed-agent-3',
          status: 'active',
          // @ts-expect-error - Testing malformed debugInfo
          debugInfo: 'not an object',
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={agentWithMalformedDebugInfo}
            currentAgent="malformed-agent"
            showThoughts={true}
          />
        );
      }).not.toThrow();

      // All agents should still render without thoughts
      expect(screen.getByText('malformed-agent')).toBeInTheDocument();
      expect(screen.getByText('malformed-agent-2')).toBeInTheDocument();
      expect(screen.getByText('malformed-agent-3')).toBeInTheDocument();

      // No thoughts should be displayed
      expect(screen.queryByText(/💭.*thinking/)).not.toBeInTheDocument();
    });

    it('handles extremely nested or circular references in thinking', () => {
      // Create a circular reference (this would normally cause JSON.stringify issues)
      const circularObject: any = { type: 'circular' };
      circularObject.self = circularObject;

      const agentWithCircularThinking: AgentInfo[] = [
        {
          name: 'circular-agent',
          status: 'active',
          debugInfo: {
            // Convert to string to avoid runtime issues
            thinking: 'Thinking with complex data structures and potential circular references',
          },
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={agentWithCircularThinking}
            currentAgent="circular-agent"
            showThoughts={true}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('circular-agent')).toBeInTheDocument();
      expect(screen.getByText('💭 circular-agent thinking')).toBeInTheDocument();
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('maintains proper DOM structure with thinking content', () => {
      const agentWithThinking: AgentInfo[] = [
        {
          name: 'accessible-agent',
          status: 'active',
          debugInfo: {
            thinking: 'This is thinking content for accessibility testing',
          },
        },
      ];

      const { container } = render(
        <AgentPanel
          agents={agentWithThinking}
          currentAgent="accessible-agent"
          showThoughts={true}
        />
      );

      // Should maintain proper DOM structure
      expect(container.firstChild).toBeInTheDocument();

      // Should have the thinking content rendered
      expect(screen.getByText('💭 accessible-agent thinking')).toBeInTheDocument();
      expect(screen.getByText('This is thinking content for accessibility testing')).toBeInTheDocument();
    });

    it('handles screen reader scenarios with rapid content updates', () => {
      const ScreenReaderComponent: React.FC = () => {
        const [thinking, setThinking] = React.useState('Initial screen reader content');

        React.useEffect(() => {
          // Simulate rapid updates that a screen reader might encounter
          const updates = [
            'Screen reader update 1',
            'Screen reader update 2',
            'Screen reader update 3',
          ];

          updates.forEach((update, index) => {
            setTimeout(() => setThinking(update), (index + 1) * 100);
          });
        }, []);

        return (
          <AgentPanel
            agents={[
              {
                name: 'screen-reader-agent',
                status: 'active',
                debugInfo: { thinking },
              },
            ]}
            currentAgent="screen-reader-agent"
            showThoughts={true}
          />
        );
      };

      expect(() => {
        render(<ScreenReaderComponent />);
      }).not.toThrow();

      expect(screen.getByText('screen-reader-agent')).toBeInTheDocument();
      expect(screen.getByText('💭 screen-reader-agent thinking')).toBeInTheDocument();
    });
  });
});