/**
 * Unit tests for AgentThoughts component
 * Tests rendering behavior, collapsible functionality, display modes, and styling
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'ink';
import { AgentThoughts, type AgentThoughtsProps } from '../AgentThoughts.js';

// Mock CollapsibleSection component to test props passing
const mockCollapsibleSection = vi.fn(({ title, children, ...props }) => (
  <div
    data-testid="collapsible-section"
    data-props={JSON.stringify(props)}
    data-title={title}
  >
    <div data-testid="title">{title}</div>
    <div data-testid="content">{children}</div>
  </div>
));

vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: mockCollapsibleSection,
}));

// Mock ink components for consistent testing
vi.mock('ink', () => ({
  Box: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <div data-testid="box" {...props}>{children}</div>
  ),
  Text: ({ children, color, dimColor, wrap, ...props }: {
    children: React.ReactNode;
    color?: string;
    dimColor?: boolean;
    wrap?: string;
    [key: string]: any;
  }) => (
    <span
      data-testid="text"
      data-color={color}
      data-dim={dimColor}
      data-wrap={wrap}
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('AgentThoughts Component', () => {
  const defaultProps: AgentThoughtsProps = {
    thinking: 'This is a test thought process from an AI agent working on a complex problem.',
    agent: 'developer',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering Tests', () => {
    it('should render thinking content with agent name in title', () => {
      render(<AgentThoughts {...defaultProps} />);

      // Should show agent thinking indicator in title
      expect(screen.getByTestId('title')).toHaveTextContent('💭 developer thinking');
    });

    it('should render thinking icon emoji by default', () => {
      render(<AgentThoughts {...defaultProps} />);

      expect(screen.getByTestId('title')).toHaveTextContent('💭');
    });

    it('should render ASCII thinking icon when useAsciiIcons is true', () => {
      render(<AgentThoughts {...defaultProps} useAsciiIcons={true} />);

      expect(screen.getByTestId('title')).toHaveTextContent('[T]');
    });

    it('should use custom icon when provided', () => {
      render(<AgentThoughts {...defaultProps} icon="🤔" />);

      expect(screen.getByTestId('title')).toHaveTextContent('🤔');
    });

    it('should render thinking content in the body', () => {
      render(<AgentThoughts {...defaultProps} />);

      expect(screen.getByTestId('text')).toHaveTextContent(defaultProps.thinking);
    });
  });

  describe('CollapsibleSection Integration Tests', () => {
    it('should pass dimmed=true to CollapsibleSection', () => {
      render(<AgentThoughts {...defaultProps} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.dimmed).toBe(true);
    });

    it('should pass borderStyle="round" to CollapsibleSection', () => {
      render(<AgentThoughts {...defaultProps} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.borderStyle).toBe('round');
    });

    it('should pass defaultCollapsed=true by default', () => {
      render(<AgentThoughts {...defaultProps} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.defaultCollapsed).toBe(true);
    });

    it('should pass custom defaultCollapsed value', () => {
      render(<AgentThoughts {...defaultProps} defaultCollapsed={false} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.defaultCollapsed).toBe(false);
    });

    it('should pass controlled collapsed state', () => {
      render(<AgentThoughts {...defaultProps} collapsed={false} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.collapsed).toBe(false);
    });

    it('should pass onToggle callback', () => {
      const onToggle = vi.fn();
      render(<AgentThoughts {...defaultProps} onToggle={onToggle} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.onToggle).toBeDefined();
    });

    it('should pass displayMode to CollapsibleSection', () => {
      render(<AgentThoughts {...defaultProps} displayMode="verbose" />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.displayMode).toBe('verbose');
    });
  });

  describe('Display Mode Tests', () => {
    it('should render normally in normal display mode', () => {
      render(<AgentThoughts {...defaultProps} displayMode="normal" />);

      expect(screen.getByTestId('collapsible-section')).toBeInTheDocument();
    });

    it('should render empty Box in compact display mode', () => {
      render(<AgentThoughts {...defaultProps} displayMode="compact" />);

      expect(screen.getByTestId('box')).toBeInTheDocument();
      expect(screen.queryByTestId('collapsible-section')).not.toBeInTheDocument();
    });

    it('should render normally in verbose display mode', () => {
      render(<AgentThoughts {...defaultProps} displayMode="verbose" />);

      expect(screen.getByTestId('collapsible-section')).toBeInTheDocument();
    });
  });

  describe('Truncation Tests', () => {
    const longThinking = 'a'.repeat(1000); // 1000 character string

    it('should truncate content when it exceeds default maxLength (500)', () => {
      render(<AgentThoughts {...defaultProps} thinking={longThinking} />);

      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';

      // Should be truncated to 500 chars + '...'
      expect(displayedText).toHaveLength(503);
      expect(displayedText).toEndWith('...');
    });

    it('should not truncate content when it is shorter than maxLength', () => {
      const shortThinking = 'Short thought';
      render(<AgentThoughts {...defaultProps} thinking={shortThinking} />);

      expect(screen.getByTestId('text')).toHaveTextContent(shortThinking);
    });

    it('should respect custom maxLength prop', () => {
      render(<AgentThoughts {...defaultProps} thinking={longThinking} maxLength={100} />);

      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';

      // Should be truncated to 100 chars + '...'
      expect(displayedText).toHaveLength(103);
      expect(displayedText).toEndWith('...');
    });

    it('should use longer maxLength in verbose mode (1000 chars)', () => {
      const mediumThinking = 'a'.repeat(750); // Between normal (500) and verbose (1000) limits

      // In normal mode, should be truncated
      render(<AgentThoughts {...defaultProps} thinking={mediumThinking} displayMode="normal" />);
      let textElement = screen.getByTestId('text');
      let displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(503); // 500 + '...'

      // Re-render in verbose mode, should not be truncated
      render(<AgentThoughts {...defaultProps} thinking={mediumThinking} displayMode="verbose" />);
      textElement = screen.getByTestId('text');
      displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(750); // Full length
    });

    it('should show character count in headerExtra when truncated', () => {
      render(<AgentThoughts {...defaultProps} thinking={longThinking} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.headerExtra).toBeDefined();
    });

    it('should not show character count when content is not truncated', () => {
      const shortThinking = 'Short thought';
      render(<AgentThoughts {...defaultProps} thinking={shortThinking} />);

      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');
      expect(props.headerExtra).toBeUndefined();
    });
  });

  describe('Styling Tests', () => {
    it('should apply gray color and dimColor to thinking text', () => {
      render(<AgentThoughts {...defaultProps} />);

      const textElement = screen.getByTestId('text');
      expect(textElement).toHaveAttribute('data-color', 'gray');
      expect(textElement).toHaveAttribute('data-dim', 'true');
    });

    it('should apply wrap="wrap" to thinking text', () => {
      render(<AgentThoughts {...defaultProps} />);

      const textElement = screen.getByTestId('text');
      expect(textElement).toHaveAttribute('data-wrap', 'wrap');
    });
  });

  describe('Props Validation Tests', () => {
    it('should handle empty thinking content', () => {
      render(<AgentThoughts {...defaultProps} thinking="" />);

      expect(screen.getByTestId('text')).toHaveTextContent('');
    });

    it('should handle different agent names', () => {
      render(<AgentThoughts {...defaultProps} agent="architect" />);

      expect(screen.getByTestId('title')).toHaveTextContent('💭 architect thinking');
    });

    it('should handle numeric agent names as strings', () => {
      render(<AgentThoughts {...defaultProps} agent="agent-1" />);

      expect(screen.getByTestId('title')).toHaveTextContent('💭 agent-1 thinking');
    });

    it('should handle special characters in agent names', () => {
      render(<AgentThoughts {...defaultProps} agent="test-agent_v2" />);

      expect(screen.getByTestId('title')).toHaveTextContent('💭 test-agent_v2 thinking');
    });

    it('should handle special characters in thinking content', () => {
      const specialThinking = 'Testing with "quotes", <brackets>, and special chars: é, ñ, 中文';
      render(<AgentThoughts {...defaultProps} thinking={specialThinking} />);

      expect(screen.getByTestId('text')).toHaveTextContent(specialThinking);
    });
  });

  describe('Icon Handling Tests', () => {
    it('should prefer custom icon over ASCII setting', () => {
      render(<AgentThoughts {...defaultProps} icon="🧠" useAsciiIcons={true} />);

      expect(screen.getByTestId('title')).toHaveTextContent('🧠 developer thinking');
      expect(screen.getByTestId('title')).not.toHaveTextContent('[T]');
    });

    it('should handle empty custom icon gracefully', () => {
      render(<AgentThoughts {...defaultProps} icon="" />);

      expect(screen.getByTestId('title')).toHaveTextContent(' developer thinking');
    });

    it('should handle multi-character custom icons', () => {
      render(<AgentThoughts {...defaultProps} icon="🤖💭" />);

      expect(screen.getByTestId('title')).toHaveTextContent('🤖💭 developer thinking');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long agent names', () => {
      const longAgentName = 'very-long-agent-name-that-might-cause-layout-issues';
      render(<AgentThoughts {...defaultProps} agent={longAgentName} />);

      expect(screen.getByTestId('title')).toHaveTextContent(`💭 ${longAgentName} thinking`);
    });

    it('should handle whitespace-only thinking content', () => {
      render(<AgentThoughts {...defaultProps} thinking="   \n\t   " />);

      expect(screen.getByTestId('text')).toHaveTextContent('   \n\t   ');
    });

    it('should handle thinking content with newlines', () => {
      const multilineThinking = 'First line\nSecond line\nThird line';
      render(<AgentThoughts {...defaultProps} thinking={multilineThinking} />);

      expect(screen.getByTestId('text')).toHaveTextContent(multilineThinking);
    });

    it('should handle maxLength of 0', () => {
      render(<AgentThoughts {...defaultProps} maxLength={0} />);

      const textElement = screen.getByTestId('text');
      expect(textElement.textContent).toBe('...');
    });

    it('should handle negative maxLength gracefully', () => {
      render(<AgentThoughts {...defaultProps} maxLength={-10} />);

      const textElement = screen.getByTestId('text');
      expect(textElement.textContent).toBe('...');
    });
  });

  describe('Integration with CollapsibleSection', () => {
    it('should be compatible with CollapsibleSection API', () => {
      const onToggle = vi.fn();

      render(
        <AgentThoughts
          {...defaultProps}
          collapsed={true}
          onToggle={onToggle}
          displayMode="verbose"
        />
      );

      // Verify all props are passed through correctly
      const propsString = screen.getByTestId('collapsible-section').getAttribute('data-props');
      const props = JSON.parse(propsString || '{}');

      expect(props).toMatchObject({
        collapsed: true,
        dimmed: true,
        borderStyle: 'round',
        displayMode: 'verbose',
        defaultCollapsed: true,
      });
    });

    it('should maintain component encapsulation', () => {
      render(<AgentThoughts {...defaultProps} />);

      // Should not leak implementation details
      expect(mockCollapsibleSection).toHaveBeenCalledTimes(1);
      expect(mockCollapsibleSection).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '💭 developer thinking',
          dimmed: true,
          borderStyle: 'round',
        }),
        expect.any(Object)
      );
    });
  });
});