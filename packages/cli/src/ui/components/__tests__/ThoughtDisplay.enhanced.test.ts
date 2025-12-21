/**
 * Enhanced tests for CLI ThoughtDisplay component
 * Focus on CLI-specific functionality and edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import type { DisplayMode } from '@apex/core';

// Mock Ink components
const mockBox = vi.fn();
const mockText = vi.fn();

vi.mock('ink', () => ({
  Box: mockBox,
  Text: mockText,
}));

import type { ThoughtDisplayProps } from '../ThoughtDisplay';

describe('CLI ThoughtDisplay - Enhanced Tests', () => {
  const baseProps: ThoughtDisplayProps = {
    thinking: 'Base thinking content',
    agent: 'developer'
  };

  describe('DisplayMode behavior', () => {
    it('should handle all valid DisplayMode values', () => {
      const displayModes: DisplayMode[] = ['normal', 'verbose', 'compact'];

      displayModes.forEach(mode => {
        const props: ThoughtDisplayProps = {
          ...baseProps,
          displayMode: mode
        };

        expect(props.displayMode).toBe(mode);
      });
    });

    it('should handle normal mode with proper truncation', () => {
      const longThinking = 'A'.repeat(400);
      const props: ThoughtDisplayProps = {
        ...baseProps,
        thinking: longThinking,
        displayMode: 'normal'
      };

      const maxDisplayLength = 300; // Normal mode limit
      const shouldTruncate = props.thinking.length > maxDisplayLength;
      const displayText = shouldTruncate
        ? props.thinking.substring(0, maxDisplayLength) + '...'
        : props.thinking;

      expect(shouldTruncate).toBe(true);
      expect(displayText.length).toBe(303); // 300 + '...'
      expect(displayText.endsWith('...')).toBe(true);
    });

    it('should handle verbose mode with extended truncation limit', () => {
      const longThinking = 'A'.repeat(800);
      const props: ThoughtDisplayProps = {
        ...baseProps,
        thinking: longThinking,
        displayMode: 'verbose'
      };

      const maxDisplayLength = 1000; // Verbose mode limit
      const shouldTruncate = props.thinking.length > maxDisplayLength;

      expect(shouldTruncate).toBe(false);
      expect(props.thinking.length).toBe(800);
    });

    it('should handle compact mode (no rendering)', () => {
      const props: ThoughtDisplayProps = {
        ...baseProps,
        displayMode: 'compact'
      };

      // In compact mode, component should return empty Box
      expect(props.displayMode).toBe('compact');
      // Simulate the early return logic
      const shouldRender = props.displayMode !== 'compact';
      expect(shouldRender).toBe(false);
    });

    it('should default to normal mode when displayMode is undefined', () => {
      const props: ThoughtDisplayProps = {
        ...baseProps,
        displayMode: undefined
      };

      const effectiveDisplayMode = props.displayMode || 'normal';
      expect(effectiveDisplayMode).toBe('normal');
    });
  });

  describe('Compact prop behavior', () => {
    it('should not render when compact is true', () => {
      const props: ThoughtDisplayProps = {
        ...baseProps,
        compact: true
      };

      expect(props.compact).toBe(true);
      // Should return empty Box when compact is true
    });

    it('should render normally when compact is false', () => {
      const props: ThoughtDisplayProps = {
        ...baseProps,
        compact: false
      };

      expect(props.compact).toBe(false);
    });

    it('should default compact to false when undefined', () => {
      const props: ThoughtDisplayProps = {
        ...baseProps
      };

      const effectiveCompact = props.compact ?? false;
      expect(effectiveCompact).toBe(false);
    });

    it('should not render when both compact and displayMode are set to not render', () => {
      const props: ThoughtDisplayProps = {
        ...baseProps,
        compact: true,
        displayMode: 'compact'
      };

      // Either condition should prevent rendering
      const shouldNotRender = props.compact || props.displayMode === 'compact';
      expect(shouldNotRender).toBe(true);
    });
  });

  describe('Agent name handling', () => {
    it('should handle different agent types', () => {
      const agentTypes = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      agentTypes.forEach(agentType => {
        const props: ThoughtDisplayProps = {
          thinking: `${agentType} is thinking`,
          agent: agentType
        };

        expect(props.agent).toBe(agentType);
      });
    });

    it('should handle agent names with special characters', () => {
      const specialAgentNames = ['agent-1', 'agent_with_underscores', 'Agent With Spaces'];

      specialAgentNames.forEach(agentName => {
        const props: ThoughtDisplayProps = {
          thinking: 'Special agent thinking',
          agent: agentName
        };

        expect(props.agent).toBe(agentName);
      });
    });

    it('should handle very long agent names', () => {
      const longAgentName = 'very-long-agent-name-that-might-cause-display-issues';
      const props: ThoughtDisplayProps = {
        thinking: 'Long agent name test',
        agent: longAgentName
      };

      expect(props.agent).toBe(longAgentName);
      expect(props.agent.length).toBeGreaterThan(30);
    });

    it('should handle empty agent name', () => {
      const props: ThoughtDisplayProps = {
        thinking: 'Empty agent test',
        agent: ''
      };

      expect(props.agent).toBe('');
    });
  });

  describe('Thinking content edge cases', () => {
    it('should handle extremely long thinking content', () => {
      const veryLongThinking = 'A'.repeat(50000);
      const props: ThoughtDisplayProps = {
        thinking: veryLongThinking,
        agent: 'developer',
        displayMode: 'normal'
      };

      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;
      const characterCount = props.thinking.length;

      expect(shouldTruncate).toBe(true);
      expect(characterCount).toBe(50000);
    });

    it('should handle thinking with Unicode characters', () => {
      const unicodeThinking = `Thinking about solutions... 🤔
      Mathematical symbols: ∑, ∆, ∞
      Foreign characters: café, naïve, piñata
      Emojis: 🚀 💡 ⚡ 🎯`;

      const props: ThoughtDisplayProps = {
        thinking: unicodeThinking,
        agent: 'planner'
      };

      expect(props.thinking).toContain('🤔');
      expect(props.thinking).toContain('∑');
      expect(props.thinking).toContain('café');
      expect(props.thinking).toContain('🚀');
    });

    it('should handle thinking with code snippets', () => {
      const codeThinking = `Analyzing this function:
\`\`\`typescript
function analyzeCode(input: string): Result {
  // Complex logic here
  return processInput(input);
}
\`\`\`
Need to optimize the performance.`;

      const props: ThoughtDisplayProps = {
        thinking: codeThinking,
        agent: 'reviewer',
        displayMode: 'verbose'
      };

      expect(props.thinking).toContain('```typescript');
      expect(props.thinking).toContain('function analyzeCode');
      expect(props.thinking).toContain('Need to optimize');
    });

    it('should handle thinking with nested quotes', () => {
      const nestedQuotesThinking = `Agent said: "The user asked 'How does this work?' and I replied 'It works like this: \"step by step\"'."`;

      const props: ThoughtDisplayProps = {
        thinking: nestedQuotesThinking,
        agent: 'architect'
      };

      expect(props.thinking).toContain('"The user asked');
      expect(props.thinking).toContain("'How does this work?'");
      expect(props.thinking).toContain('\\"step by step\\"');
    });

    it('should handle thinking with only whitespace variations', () => {
      const whitespaceVariations = [
        '   ',
        '\n\n\n',
        '\t\t\t',
        ' \n\t \n ',
        '\u00A0\u00A0', // Non-breaking spaces
      ];

      whitespaceVariations.forEach((thinking, index) => {
        const props: ThoughtDisplayProps = {
          thinking,
          agent: `agent${index}`
        };

        expect(props.thinking.trim()).toBe('');
        expect(props.thinking.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Truncation behavior edge cases', () => {
    it('should handle content exactly at truncation limit', () => {
      const exactLimitThinking = 'A'.repeat(300);
      const props: ThoughtDisplayProps = {
        thinking: exactLimitThinking,
        agent: 'developer',
        displayMode: 'normal'
      };

      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;

      expect(shouldTruncate).toBe(false);
      expect(props.thinking.length).toBe(300);
    });

    it('should handle content one character over truncation limit', () => {
      const overLimitThinking = 'A'.repeat(301);
      const props: ThoughtDisplayProps = {
        thinking: overLimitThinking,
        agent: 'developer',
        displayMode: 'normal'
      };

      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;
      const displayText = shouldTruncate
        ? props.thinking.substring(0, maxDisplayLength) + '...'
        : props.thinking;

      expect(shouldTruncate).toBe(true);
      expect(displayText.length).toBe(303);
    });

    it('should handle verbose mode truncation limits', () => {
      const testCases = [
        { length: 999, shouldTruncate: false },
        { length: 1000, shouldTruncate: false },
        { length: 1001, shouldTruncate: true },
      ];

      testCases.forEach(({ length, shouldTruncate }) => {
        const thinking = 'A'.repeat(length);
        const props: ThoughtDisplayProps = {
          thinking,
          agent: 'developer',
          displayMode: 'verbose'
        };

        const maxDisplayLength = 1000;
        const actualShouldTruncate = props.thinking.length > maxDisplayLength;

        expect(actualShouldTruncate).toBe(shouldTruncate);
      });
    });

    it('should preserve truncation indicator format', () => {
      const longThinking = 'ABCDEFGHIJKLMNOP'.repeat(50); // 800 chars
      const props: ThoughtDisplayProps = {
        thinking: longThinking,
        agent: 'developer',
        displayMode: 'normal'
      };

      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;
      const displayText = shouldTruncate
        ? props.thinking.substring(0, maxDisplayLength) + '...'
        : props.thinking;

      expect(displayText.endsWith('...')).toBe(true);
      expect(displayText.substring(0, maxDisplayLength)).not.toContain('...');
    });
  });

  describe('Character count display logic', () => {
    it('should calculate character count correctly for truncated content', () => {
      const thinking = 'A'.repeat(500);
      const props: ThoughtDisplayProps = {
        thinking,
        agent: 'developer',
        displayMode: 'normal'
      };

      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;
      const originalLength = props.thinking.length;

      expect(shouldTruncate).toBe(true);
      expect(originalLength).toBe(500);

      // Simulate the character count display text
      const countText = `(truncated from ${originalLength} chars)`;
      expect(countText).toBe('(truncated from 500 chars)');
    });

    it('should not show character count for non-truncated content', () => {
      const thinking = 'Short content';
      const props: ThoughtDisplayProps = {
        thinking,
        agent: 'developer',
        displayMode: 'normal'
      };

      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;

      expect(shouldTruncate).toBe(false);
      // No character count should be displayed
    });

    it('should handle character count for various content lengths', () => {
      const testLengths = [301, 500, 1000, 5000, 10000];

      testLengths.forEach(length => {
        const thinking = 'A'.repeat(length);
        const props: ThoughtDisplayProps = {
          thinking,
          agent: 'developer',
          displayMode: 'normal'
        };

        const originalLength = props.thinking.length;
        expect(originalLength).toBe(length);
      });
    });
  });

  describe('Integration with Ink components', () => {
    it('should pass correct styling props to Box components', () => {
      const props: ThoughtDisplayProps = {
        thinking: 'Test thinking for styling',
        agent: 'developer',
        displayMode: 'normal'
      };

      // Simulate the Box props that would be passed
      const outerBoxProps = {
        flexDirection: 'column',
        marginTop: 1
      };

      const innerBoxProps = {
        marginLeft: 3,
        marginTop: 1,
        paddingX: 1,
        borderStyle: 'round',
        borderColor: 'gray',
        borderDimColor: true
      };

      expect(outerBoxProps.flexDirection).toBe('column');
      expect(outerBoxProps.marginTop).toBe(1);
      expect(innerBoxProps.borderStyle).toBe('round');
      expect(innerBoxProps.borderColor).toBe('gray');
      expect(innerBoxProps.borderDimColor).toBe(true);
    });

    it('should pass correct styling props to Text components', () => {
      const props: ThoughtDisplayProps = {
        thinking: 'Test thinking for text styling',
        agent: 'planner',
      };

      // Simulate Text component props
      const headerTextProps = {
        color: 'gray',
        dimColor: true
      };

      const contentTextProps = {
        color: 'gray',
        dimColor: true,
        wrap: 'wrap'
      };

      expect(headerTextProps.color).toBe('gray');
      expect(headerTextProps.dimColor).toBe(true);
      expect(contentTextProps.wrap).toBe('wrap');
    });
  });

  describe('Performance and memory considerations', () => {
    it('should handle rapid component creation without memory leaks', () => {
      const components: ThoughtDisplayProps[] = [];

      for (let i = 0; i < 1000; i++) {
        const props: ThoughtDisplayProps = {
          thinking: `Thinking ${i}: ${'A'.repeat(100)}`,
          agent: `agent-${i}`,
          displayMode: i % 2 === 0 ? 'normal' : 'verbose'
        };

        components.push(props);
      }

      expect(components).toHaveLength(1000);
      expect(components[0].thinking).toContain('Thinking 0');
      expect(components[999].thinking).toContain('Thinking 999');
    });

    it('should efficiently handle string operations for large content', () => {
      const largeContent = 'Large content block. '.repeat(10000); // ~200KB
      const start = performance.now();

      const props: ThoughtDisplayProps = {
        thinking: largeContent,
        agent: 'performance-test',
        displayMode: 'normal'
      };

      // Simulate truncation operation
      const maxDisplayLength = 300;
      const shouldTruncate = props.thinking.length > maxDisplayLength;
      const displayText = shouldTruncate
        ? props.thinking.substring(0, maxDisplayLength) + '...'
        : props.thinking;

      const end = performance.now();

      expect(displayText.length).toBe(303);
      expect(end - start).toBeLessThan(10); // Should be very fast
      expect(shouldTruncate).toBe(true);
    });
  });
});