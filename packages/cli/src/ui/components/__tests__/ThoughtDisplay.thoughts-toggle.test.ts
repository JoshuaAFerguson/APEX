/**
 * Tests for ThoughtDisplay component integration with thoughts toggle functionality
 * Tests rendering behavior, content display, and interaction with showThoughts state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import React from 'react';
import { ThoughtDisplay } from '../ThoughtDisplay.js';

describe('ThoughtDisplay - Thoughts Toggle Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Basic rendering with thoughts content', () => {
    it('should render thinking content when provided', () => {
      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="This is my reasoning process"
          agent="developer"
        />
      );

      const output = lastFrame();
      expect(output).toContain('This is my reasoning process');
      expect(output).toContain('developer');
    });

    it('should handle empty thinking content gracefully', () => {
      const { lastFrame } = render(
        <ThoughtDisplay
          thinking=""
          agent="developer"
        />
      );

      const output = lastFrame();
      // Should render but with minimal content
      expect(output).toBeDefined();
    });

    it('should handle whitespace-only thinking content', () => {
      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="   \n\t   "
          agent="developer"
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should display agent information correctly', () => {
      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="Testing agent display"
          agent="tester"
        />
      );

      const output = lastFrame();
      expect(output).toContain('tester');
      expect(output).toContain('Testing agent display');
    });
  });

  describe('Content formatting and display', () => {
    it('should handle long thinking content', () => {
      const longThinking = 'A'.repeat(1000) + ' This is a very long thought process that should be handled properly by the component.';

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking={longThinking}
          agent="developer"
        />
      );

      const output = lastFrame();
      expect(output).toContain('This is a very long thought process');
    });

    it('should handle multiline thinking content', () => {
      const multilineThinking = `First line of thinking
Second line with more details
Third line with conclusion`;

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking={multilineThinking}
          agent="architect"
        />
      );

      const output = lastFrame();
      expect(output).toContain('First line of thinking');
      expect(output).toContain('Second line with more details');
      expect(output).toContain('Third line with conclusion');
    });

    it('should handle special characters and formatting', () => {
      const specialThinking = `Thinking with symbols: @#$%^&*()
Code snippets: \`const x = 1;\`
And emojis: 🤔💭✨`;

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking={specialThinking}
          agent="developer"
        />
      );

      const output = lastFrame();
      expect(output).toContain('@#$%^&*()');
      expect(output).toContain('const x = 1;');
    });

    it('should maintain text formatting integrity', () => {
      const formattedThinking = `**Bold text** and *italic text*
- List item 1
- List item 2
> Quoted text`;

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking={formattedThinking}
          agent="reviewer"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Bold text');
      expect(output).toContain('List item 1');
      expect(output).toContain('Quoted text');
    });
  });

  describe('Different agent types', () => {
    it('should handle all standard agent types', () => {
      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      agents.forEach(agent => {
        const { lastFrame } = render(
          <ThoughtDisplay
            thinking={`Thoughts from ${agent}`}
            agent={agent}
          />
        );

        const output = lastFrame();
        expect(output).toContain(agent);
        expect(output).toContain(`Thoughts from ${agent}`);
      });
    });

    it('should handle custom agent names', () => {
      const customAgents = ['custom-agent', 'my-special-agent', 'ai-assistant'];

      customAgents.forEach(agent => {
        const { lastFrame } = render(
          <ThoughtDisplay
            thinking="Custom agent thinking"
            agent={agent}
          />
        );

        const output = lastFrame();
        expect(output).toContain(agent);
      });
    });

    it('should handle agent names with special characters', () => {
      const specialAgentNames = ['agent-1', 'agent_test', 'agent@v2', 'agent.new'];

      specialAgentNames.forEach(agent => {
        const { lastFrame } = render(
          <ThoughtDisplay
            thinking="Testing special characters"
            agent={agent}
          />
        );

        const output = lastFrame();
        expect(output).toContain('Testing special characters');
      });
    });
  });

  describe('Performance and optimization', () => {
    it('should render quickly with normal content', () => {
      const start = performance.now();

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="Normal thinking content for performance test"
          agent="developer"
        />
      );

      lastFrame();
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });

    it('should handle frequent re-renders efficiently', () => {
      const { rerender, lastFrame } = render(
        <ThoughtDisplay
          thinking="Initial thinking"
          agent="developer"
        />
      );

      const start = performance.now();

      // Simulate frequent updates
      for (let i = 0; i < 100; i++) {
        rerender(
          <ThoughtDisplay
            thinking={`Updated thinking ${i}`}
            agent="developer"
          />
        );
      }

      const end = performance.now();
      lastFrame();

      expect(end - start).toBeLessThan(500);
    });

    it('should handle large content efficiently', () => {
      const largeContent = 'This is a very large thought process. '.repeat(100);

      const start = performance.now();

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking={largeContent}
          agent="architect"
        />
      );

      lastFrame();
      const end = performance.now();

      expect(end - start).toBeLessThan(200);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null thinking content gracefully', () => {
      expect(() => {
        render(
          <ThoughtDisplay
            thinking={null as any}
            agent="developer"
          />
        );
      }).not.toThrow();
    });

    it('should handle undefined thinking content gracefully', () => {
      expect(() => {
        render(
          <ThoughtDisplay
            thinking={undefined as any}
            agent="developer"
          />
        );
      }).not.toThrow();
    });

    it('should handle null agent gracefully', () => {
      expect(() => {
        render(
          <ThoughtDisplay
            thinking="Some thinking content"
            agent={null as any}
          />
        );
      }).not.toThrow();
    });

    it('should handle empty agent name', () => {
      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="Thinking with empty agent"
          agent=""
        />
      );

      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle very long agent names', () => {
      const longAgentName = 'a'.repeat(100);

      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="Testing long agent name"
          agent={longAgentName}
        />
      );

      expect(() => lastFrame()).not.toThrow();
    });
  });

  describe('Integration with App state management', () => {
    it('should conditionally render based on showThoughts state simulation', () => {
      // Simulate the App component's conditional rendering logic
      const showThoughts = true;
      const thinking = "This should be visible when showThoughts is true";
      const agent = "developer";

      const ComponentWithCondition = () => {
        if (showThoughts && thinking && thinking.trim().length > 0 && agent) {
          return <ThoughtDisplay thinking={thinking} agent={agent} />;
        }
        return null;
      };

      const { lastFrame } = render(<ComponentWithCondition />);

      const output = lastFrame();
      expect(output).toContain('This should be visible when showThoughts is true');
    });

    it('should not render when simulating showThoughts=false', () => {
      // Simulate the App component's conditional rendering logic
      const showThoughts = false;
      const thinking = "This should not be visible when showThoughts is false";
      const agent = "developer";

      const ComponentWithCondition = () => {
        if (showThoughts && thinking && thinking.trim().length > 0 && agent) {
          return <ThoughtDisplay thinking={thinking} agent={agent} />;
        }
        return null;
      };

      const { lastFrame } = render(<ComponentWithCondition />);

      const output = lastFrame();
      expect(output).toBe('');
    });

    it('should handle conditional rendering with edge cases', () => {
      const testCases = [
        { showThoughts: true, thinking: '', agent: 'dev', shouldRender: false },
        { showThoughts: true, thinking: 'content', agent: '', shouldRender: false },
        { showThoughts: true, thinking: '   ', agent: 'dev', shouldRender: false },
        { showThoughts: false, thinking: 'content', agent: 'dev', shouldRender: false },
        { showThoughts: true, thinking: 'content', agent: 'dev', shouldRender: true },
      ];

      testCases.forEach(({ showThoughts, thinking, agent, shouldRender }, index) => {
        const ComponentWithCondition = () => {
          if (showThoughts && thinking && thinking.trim().length > 0 && agent) {
            return <ThoughtDisplay thinking={thinking} agent={agent} />;
          }
          return null;
        };

        const { lastFrame } = render(<ComponentWithCondition />);
        const output = lastFrame();

        if (shouldRender) {
          expect(output, `Test case ${index + 1} should render`).toContain('content');
        } else {
          expect(output, `Test case ${index + 1} should not render`).toBe('');
        }
      });
    });
  });

  describe('Accessibility and usability', () => {
    it('should provide clear visual distinction for thoughts', () => {
      const { lastFrame } = render(
        <ThoughtDisplay
          thinking="This thought should be clearly distinguishable"
          agent="developer"
        />
      );

      const output = lastFrame();

      // Should contain visual indicators for thoughts (emojis, formatting, etc.)
      expect(output).toMatch(/💭|🤔|💡|Thinking|Thought/i);
    });

    it('should maintain readability with different content lengths', () => {
      const contents = [
        'Short',
        'This is a medium length thought that contains a bit more detail.',
        'This is a very long thought process that goes into extensive detail about the reasoning, considerations, and decision-making process that led to a particular conclusion or approach. It demonstrates how the component handles longer content appropriately.'
      ];

      contents.forEach(content => {
        const { lastFrame } = render(
          <ThoughtDisplay
            thinking={content}
            agent="developer"
          />
        );

        const output = lastFrame();
        expect(output).toContain(content.substring(0, 50)); // At least first part should be visible
      });
    });

    it('should handle rapid content changes smoothly', () => {
      const { rerender, lastFrame } = render(
        <ThoughtDisplay
          thinking="Initial content"
          agent="developer"
        />
      );

      const contentChanges = [
        'First update',
        'Second update with more detail',
        'Third update',
        'Final content'
      ];

      contentChanges.forEach(content => {
        rerender(
          <ThoughtDisplay
            thinking={content}
            agent="developer"
          />
        );

        expect(() => lastFrame()).not.toThrow();
      });

      // Final content should be displayed
      expect(lastFrame()).toContain('Final content');
    });
  });
});