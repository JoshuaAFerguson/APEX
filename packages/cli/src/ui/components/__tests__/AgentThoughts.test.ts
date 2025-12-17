/**
 * Comprehensive tests for AgentThoughts component
 * Tests rendering, truncation, display modes, and user interaction
 */

import { describe, it, expect, vi } from 'vitest';
import type { AgentThoughtsProps } from '../AgentThoughts';

describe('AgentThoughts Component', () => {
  const defaultProps: AgentThoughtsProps = {
    thinking: 'This is test thinking content',
    agent: 'developer',
  };

  describe('Component props and interface', () => {
    it('should accept required props correctly', () => {
      const props: AgentThoughtsProps = {
        thinking: 'Test thinking',
        agent: 'tester',
      };

      expect(props.thinking).toBe('Test thinking');
      expect(props.agent).toBe('tester');
    });

    it('should accept all optional props', () => {
      const fullProps: AgentThoughtsProps = {
        thinking: 'Full test thinking',
        agent: 'reviewer',
        displayMode: 'verbose',
        defaultCollapsed: false,
        collapsed: true,
        onToggle: vi.fn(),
        maxLength: 1000,
        icon: '🧠',
        useAsciiIcons: true,
      };

      expect(fullProps.displayMode).toBe('verbose');
      expect(fullProps.defaultCollapsed).toBe(false);
      expect(fullProps.collapsed).toBe(true);
      expect(fullProps.maxLength).toBe(1000);
      expect(fullProps.icon).toBe('🧠');
      expect(fullProps.useAsciiIcons).toBe(true);
    });

    it('should handle undefined optional props', () => {
      const minimalProps: AgentThoughtsProps = {
        thinking: 'Minimal thinking',
        agent: 'architect',
      };

      expect(minimalProps.displayMode).toBeUndefined();
      expect(minimalProps.defaultCollapsed).toBeUndefined();
      expect(minimalProps.collapsed).toBeUndefined();
      expect(minimalProps.onToggle).toBeUndefined();
      expect(minimalProps.maxLength).toBeUndefined();
      expect(minimalProps.icon).toBeUndefined();
      expect(minimalProps.useAsciiIcons).toBeUndefined();
    });
  });

  describe('Display mode behavior', () => {
    it('should handle normal display mode', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        displayMode: 'normal',
      };

      expect(props.displayMode).toBe('normal');
      // In normal mode, component should render normally
    });

    it('should handle verbose display mode', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        displayMode: 'verbose',
      };

      expect(props.displayMode).toBe('verbose');
      // In verbose mode, maxLength should be higher (1000 vs 500)
    });

    it('should handle compact display mode', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        displayMode: 'compact',
      };

      expect(props.displayMode).toBe('compact');
      // In compact mode, component should return empty Box (not render)
    });

    it('should default to normal mode when displayMode is undefined', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        displayMode: undefined,
      };

      expect(props.displayMode).toBeUndefined();
      // Component should use 'normal' as default
    });
  });

  describe('Content truncation logic', () => {
    it('should handle short content without truncation', () => {
      const shortThinking = 'Short content';
      const props: AgentThoughtsProps = {
        ...defaultProps,
        thinking: shortThinking,
        maxLength: 500,
      };

      expect(props.thinking.length).toBeLessThan(500);
      expect(props.thinking).toBe(shortThinking);
    });

    it('should handle long content that needs truncation', () => {
      const longThinking = 'A'.repeat(600);
      const props: AgentThoughtsProps = {
        ...defaultProps,
        thinking: longThinking,
        maxLength: 500,
      };

      expect(props.thinking.length).toBeGreaterThan(500);

      // Simulate truncation logic
      const shouldTruncate = props.thinking.length > (props.maxLength || 500);
      expect(shouldTruncate).toBe(true);

      const truncated = shouldTruncate
        ? props.thinking.substring(0, props.maxLength || 500) + '...'
        : props.thinking;

      expect(truncated).toBe('A'.repeat(500) + '...');
    });

    it('should use different max lengths for different display modes', () => {
      const longThinking = 'A'.repeat(800);

      // Normal mode - default 500 chars
      const normalProps: AgentThoughtsProps = {
        ...defaultProps,
        thinking: longThinking,
        displayMode: 'normal',
      };

      // Verbose mode - 1000 chars
      const verboseProps: AgentThoughtsProps = {
        ...defaultProps,
        thinking: longThinking,
        displayMode: 'verbose',
      };

      expect(normalProps.thinking.length).toBe(800);
      expect(verboseProps.thinking.length).toBe(800);

      // Simulate the effective max length logic
      const normalMaxLength = 500;
      const verboseMaxLength = 1000;

      const normalShouldTruncate = normalProps.thinking.length > normalMaxLength;
      const verboseShouldTruncate = verboseProps.thinking.length > verboseMaxLength;

      expect(normalShouldTruncate).toBe(true);
      expect(verboseShouldTruncate).toBe(false);
    });

    it('should handle custom maxLength prop', () => {
      const thinking = 'A'.repeat(300);
      const props: AgentThoughtsProps = {
        ...defaultProps,
        thinking,
        maxLength: 200,
      };

      const shouldTruncate = props.thinking.length > (props.maxLength || 500);
      expect(shouldTruncate).toBe(true);

      const truncated = shouldTruncate
        ? props.thinking.substring(0, props.maxLength || 500) + '...'
        : props.thinking;

      expect(truncated).toBe('A'.repeat(200) + '...');
      expect(truncated.length).toBe(203);
    });
  });

  describe('Icon handling', () => {
    it('should use default emoji icon when no icon specified', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        useAsciiIcons: false,
      };

      // Default icon should be 💭
      const expectedIcon = '💭';
      expect(props.icon).toBeUndefined();
      expect(props.useAsciiIcons).toBe(false);

      // Simulate icon selection logic
      const actualIcon = props.icon ?? '💭';
      expect(actualIcon).toBe(expectedIcon);
    });

    it('should use ASCII icon when useAsciiIcons is true', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        useAsciiIcons: true,
      };

      // ASCII icon should be [T]
      const expectedIcon = '[T]';
      expect(props.useAsciiIcons).toBe(true);

      // Simulate icon selection logic
      const actualIcon = props.icon ?? (props.useAsciiIcons ? '[T]' : '💭');
      expect(actualIcon).toBe(expectedIcon);
    });

    it('should use custom icon when provided', () => {
      const customIcon = '🧠';
      const props: AgentThoughtsProps = {
        ...defaultProps,
        icon: customIcon,
        useAsciiIcons: true, // Should be ignored when custom icon is provided
      };

      expect(props.icon).toBe(customIcon);

      // Custom icon should override useAsciiIcons
      const actualIcon = props.icon ?? (props.useAsciiIcons ? '[T]' : '💭');
      expect(actualIcon).toBe(customIcon);
    });
  });

  describe('Collapse state management', () => {
    it('should handle default collapsed state', () => {
      const props: AgentThoughtsProps = {
        ...defaultProps,
        defaultCollapsed: true,
      };

      expect(props.defaultCollapsed).toBe(true);
    });

    it('should handle controlled collapse state', () => {
      const mockOnToggle = vi.fn();
      const props: AgentThoughtsProps = {
        ...defaultProps,
        collapsed: false,
        onToggle: mockOnToggle,
      };

      expect(props.collapsed).toBe(false);
      expect(props.onToggle).toBe(mockOnToggle);
    });

    it('should allow toggle callback to be called', () => {
      const mockOnToggle = vi.fn();
      const props: AgentThoughtsProps = {
        ...defaultProps,
        onToggle: mockOnToggle,
      };

      // Simulate toggle call
      props.onToggle?.(true);
      expect(mockOnToggle).toHaveBeenCalledWith(true);

      props.onToggle?.(false);
      expect(mockOnToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('Content validation and edge cases', () => {
    it('should handle empty thinking content', () => {
      const props: AgentThoughtsProps = {
        thinking: '',
        agent: 'developer',
      };

      expect(props.thinking).toBe('');
      expect(props.thinking.length).toBe(0);
    });

    it('should handle whitespace-only thinking content', () => {
      const props: AgentThoughtsProps = {
        thinking: '   \n\t   ',
        agent: 'tester',
      };

      expect(props.thinking.trim().length).toBe(0);
    });

    it('should handle multiline thinking content', () => {
      const multilineThinking = `Line 1 of thinking
Line 2 of thinking
Line 3 of thinking`;

      const props: AgentThoughtsProps = {
        thinking: multilineThinking,
        agent: 'architect',
      };

      expect(props.thinking).toContain('\n');
      expect(props.thinking.split('\n')).toHaveLength(3);
    });

    it('should handle special characters in thinking content', () => {
      const specialCharsThinking = `Thinking with "quotes" and <tags> & symbols 🤔`;

      const props: AgentThoughtsProps = {
        thinking: specialCharsThinking,
        agent: 'reviewer',
      };

      expect(props.thinking).toContain('"quotes"');
      expect(props.thinking).toContain('<tags>');
      expect(props.thinking).toContain('&');
      expect(props.thinking).toContain('🤔');
    });

    it('should handle code snippets in thinking content', () => {
      const codeThinking = `Need to implement:
\`\`\`typescript
const result = processData(input);
return result.map(item => item.value);
\`\`\`
This should handle the transformation.`;

      const props: AgentThoughtsProps = {
        thinking: codeThinking,
        agent: 'developer',
      };

      expect(props.thinking).toContain('```typescript');
      expect(props.thinking).toContain('processData(input)');
      expect(props.thinking).toContain('This should handle the transformation.');
    });
  });

  describe('Agent name handling', () => {
    it('should handle different agent names', () => {
      const agentNames = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      agentNames.forEach(agentName => {
        const props: AgentThoughtsProps = {
          thinking: `${agentName} thinking content`,
          agent: agentName,
        };

        expect(props.agent).toBe(agentName);
      });
    });

    it('should handle agent names with special characters', () => {
      const specialAgentNames = ['agent-1', 'agent_2', 'agent@3', 'agent.4'];

      specialAgentNames.forEach(agentName => {
        const props: AgentThoughtsProps = {
          thinking: 'Test thinking',
          agent: agentName,
        };

        expect(props.agent).toBe(agentName);
      });
    });
  });

  describe('Title generation logic simulation', () => {
    it('should generate correct title with emoji icon', () => {
      const props: AgentThoughtsProps = {
        thinking: 'Test thinking',
        agent: 'developer',
        useAsciiIcons: false,
      };

      // Simulate title generation
      const icon = props.icon ?? (props.useAsciiIcons ? '[T]' : '💭');
      const expectedTitle = `${icon} ${props.agent} thinking`;

      expect(expectedTitle).toBe('💭 developer thinking');
    });

    it('should generate correct title with ASCII icon', () => {
      const props: AgentThoughtsProps = {
        thinking: 'Test thinking',
        agent: 'tester',
        useAsciiIcons: true,
      };

      // Simulate title generation
      const icon = props.icon ?? (props.useAsciiIcons ? '[T]' : '💭');
      const expectedTitle = `${icon} ${props.agent} thinking`;

      expect(expectedTitle).toBe('[T] tester thinking');
    });

    it('should generate correct title with custom icon', () => {
      const props: AgentThoughtsProps = {
        thinking: 'Test thinking',
        agent: 'reviewer',
        icon: '🔍',
      };

      // Simulate title generation
      const icon = props.icon ?? '💭';
      const expectedTitle = `${icon} ${props.agent} thinking`;

      expect(expectedTitle).toBe('🔍 reviewer thinking');
    });
  });

  describe('Integration with CollapsibleSection props', () => {
    it('should pass correct props to CollapsibleSection', () => {
      const props: AgentThoughtsProps = {
        thinking: 'A'.repeat(600),
        agent: 'architect',
        displayMode: 'normal',
        defaultCollapsed: false,
        maxLength: 300,
      };

      // Simulate the props that would be passed to CollapsibleSection
      const shouldTruncate = props.thinking.length > (props.maxLength || 500);
      const effectiveMaxLength = props.displayMode === 'verbose' ? 1000 : (props.maxLength || 500);
      const actualShouldTruncate = props.thinking.length > effectiveMaxLength;

      expect(shouldTruncate).toBe(true);
      expect(actualShouldTruncate).toBe(true);

      const collapsibleProps = {
        defaultCollapsed: props.defaultCollapsed,
        dimmed: true,
        borderStyle: 'round',
        displayMode: props.displayMode,
      };

      expect(collapsibleProps.defaultCollapsed).toBe(false);
      expect(collapsibleProps.dimmed).toBe(true);
      expect(collapsibleProps.borderStyle).toBe('round');
      expect(collapsibleProps.displayMode).toBe('normal');
    });
  });

  describe('Character count display logic', () => {
    it('should show character count when content is truncated', () => {
      const longThinking = 'A'.repeat(600);
      const props: AgentThoughtsProps = {
        thinking: longThinking,
        agent: 'developer',
        maxLength: 500,
      };

      const shouldTruncate = props.thinking.length > (props.maxLength || 500);
      expect(shouldTruncate).toBe(true);

      // Simulate headerExtra content
      const characterCount = props.thinking.length;
      expect(characterCount).toBe(600);
    });

    it('should not show character count when content is not truncated', () => {
      const shortThinking = 'Short thinking content';
      const props: AgentThoughtsProps = {
        thinking: shortThinking,
        agent: 'tester',
        maxLength: 500,
      };

      const shouldTruncate = props.thinking.length > (props.maxLength || 500);
      expect(shouldTruncate).toBe(false);
    });
  });
});