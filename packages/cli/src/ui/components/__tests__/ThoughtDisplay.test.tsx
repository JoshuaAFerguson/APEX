/**
 * Unit tests for ThoughtDisplay component
 * Tests rendering behavior, display modes, and text truncation
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ThoughtDisplay, type ThoughtDisplayProps } from '../ThoughtDisplay.js';

// Mock ink components for testing
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

describe('ThoughtDisplay Component', () => {
  const defaultProps: ThoughtDisplayProps = {
    thinking: 'This is a test thought process from an AI agent.',
    agent: 'developer',
    displayMode: 'normal',
    compact: false,
  };

  describe('Basic Rendering', () => {
    it('should render thinking content with agent name', () => {
      render(<ThoughtDisplay {...defaultProps} />);

      // Should show agent thinking indicator
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();

      // Should show the thinking content
      expect(screen.getByText(defaultProps.thinking)).toBeInTheDocument();
    });

    it('should apply correct styling for thought content', () => {
      render(<ThoughtDisplay {...defaultProps} />);

      // Find text elements
      const textElements = screen.getAllByTestId('text');

      // Agent thinking header should be gray and dimmed
      const thinkingHeader = textElements.find(el =>
        el.textContent?.includes('💭 developer thinking')
      );
      expect(thinkingHeader).toHaveAttribute('data-color', 'gray');
      expect(thinkingHeader).toHaveAttribute('data-dim', 'true');

      // Content should be gray, dimmed, and wrapped
      const content = textElements.find(el =>
        el.textContent === defaultProps.thinking
      );
      expect(content).toHaveAttribute('data-color', 'gray');
      expect(content).toHaveAttribute('data-dim', 'true');
      expect(content).toHaveAttribute('data-wrap', 'wrap');
    });

    it('should render with proper box structure', () => {
      render(<ThoughtDisplay {...defaultProps} />);

      const boxes = screen.getAllByTestId('box');
      expect(boxes.length).toBeGreaterThan(0);
    });
  });

  describe('Display Mode Handling', () => {
    it('should not render in compact mode', () => {
      render(<ThoughtDisplay {...defaultProps} compact={true} />);

      // Should render empty box
      const boxes = screen.getAllByTestId('box');
      expect(boxes).toHaveLength(1);

      // Should not show thinking content
      expect(screen.queryByText(/thinking/)).not.toBeInTheDocument();
      expect(screen.queryByText(defaultProps.thinking)).not.toBeInTheDocument();
    });

    it('should not render when displayMode is compact', () => {
      render(<ThoughtDisplay {...defaultProps} displayMode="compact" />);

      // Should render empty box
      const boxes = screen.getAllByTestId('box');
      expect(boxes).toHaveLength(1);

      // Should not show thinking content
      expect(screen.queryByText(/thinking/)).not.toBeInTheDocument();
      expect(screen.queryByText(defaultProps.thinking)).not.toBeInTheDocument();
    });

    it('should render normally in normal mode', () => {
      render(<ThoughtDisplay {...defaultProps} displayMode="normal" />);

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      expect(screen.getByText(defaultProps.thinking)).toBeInTheDocument();
    });

    it('should render normally in verbose mode', () => {
      render(<ThoughtDisplay {...defaultProps} displayMode="verbose" />);

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      expect(screen.getByText(defaultProps.thinking)).toBeInTheDocument();
    });
  });

  describe('Text Truncation', () => {
    it('should truncate long text in normal mode', () => {
      const longThinking = 'A'.repeat(400); // Longer than 300 char limit

      render(<ThoughtDisplay {...defaultProps} thinking={longThinking} displayMode="normal" />);

      // Should show truncated text
      expect(screen.getByText(/^A{300}\.\.\.$/)).toBeInTheDocument();

      // Should show truncation indicator
      expect(screen.getByText(/\(truncated from 400 chars\)/)).toBeInTheDocument();
    });

    it('should allow longer text in verbose mode', () => {
      const longThinking = 'B'.repeat(800); // Longer than normal limit but under verbose limit

      render(<ThoughtDisplay {...defaultProps} thinking={longThinking} displayMode="verbose" />);

      // Should show full text (under 1000 char verbose limit)
      expect(screen.getByText(longThinking)).toBeInTheDocument();

      // Should not show truncation indicator
      expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
    });

    it('should truncate very long text even in verbose mode', () => {
      const veryLongThinking = 'C'.repeat(1200); // Longer than 1000 char verbose limit

      render(<ThoughtDisplay {...defaultProps} thinking={veryLongThinking} displayMode="verbose" />);

      // Should show truncated text
      expect(screen.getByText(/^C{1000}\.\.\.$/)).toBeInTheDocument();

      // Should show truncation indicator
      expect(screen.getByText(/\(truncated from 1200 chars\)/)).toBeInTheDocument();
    });

    it('should not truncate short text', () => {
      const shortThinking = 'Short thought';

      render(<ThoughtDisplay {...defaultProps} thinking={shortThinking} />);

      // Should show full text
      expect(screen.getByText(shortThinking)).toBeInTheDocument();

      // Should not show truncation indicator
      expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
    });

    it('should handle text exactly at the limit', () => {
      const exactLimitThinking = 'D'.repeat(300); // Exactly 300 chars

      render(<ThoughtDisplay {...defaultProps} thinking={exactLimitThinking} displayMode="normal" />);

      // Should show full text without truncation
      expect(screen.getByText(exactLimitThinking)).toBeInTheDocument();

      // Should not show truncation indicator
      expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
    });
  });

  describe('Agent Name Handling', () => {
    it('should display different agent names', () => {
      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      agents.forEach(agent => {
        const { rerender } = render(<ThoughtDisplay {...defaultProps} agent={agent} />);

        expect(screen.getByText(new RegExp(`💭 ${agent} thinking`))).toBeInTheDocument();

        rerender(<div />); // Clear between tests
      });
    });

    it('should handle custom agent names', () => {
      render(<ThoughtDisplay {...defaultProps} agent="custom-agent" />);

      expect(screen.getByText(/💭 custom-agent thinking/)).toBeInTheDocument();
    });

    it('should handle empty agent name gracefully', () => {
      render(<ThoughtDisplay {...defaultProps} agent="" />);

      expect(screen.getByText(/💭  thinking/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty thinking content', () => {
      render(<ThoughtDisplay {...defaultProps} thinking="" />);

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      // Empty content should still render (empty text element)
      const textElements = screen.getAllByTestId('text');
      const contentElement = textElements.find(el => el.textContent === '');
      expect(contentElement).toBeDefined();
    });

    it('should handle whitespace-only thinking content', () => {
      const whitespaceThinking = '   \n\t   ';

      render(<ThoughtDisplay {...defaultProps} thinking={whitespaceThinking} />);

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      expect(screen.getByText(whitespaceThinking)).toBeInTheDocument();
    });

    it('should handle special characters in thinking content', () => {
      const specialThinking = '🤖 Analyzing... 100% complete! @#$%^&*()';

      render(<ThoughtDisplay {...defaultProps} thinking={specialThinking} />);

      expect(screen.getByText(specialThinking)).toBeInTheDocument();
    });

    it('should handle newlines in thinking content', () => {
      const multilineThinking = 'Line 1\nLine 2\nLine 3';

      render(<ThoughtDisplay {...defaultProps} thinking={multilineThinking} />);

      expect(screen.getByText(multilineThinking)).toBeInTheDocument();
    });

    it('should handle undefined displayMode gracefully', () => {
      render(<ThoughtDisplay {...defaultProps} displayMode={undefined} />);

      // Should default to normal behavior
      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      expect(screen.getByText(defaultProps.thinking)).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('should handle all required props', () => {
      const minimalProps = {
        thinking: 'Test thinking',
        agent: 'test-agent',
      };

      render(<ThoughtDisplay {...minimalProps} />);

      expect(screen.getByText(/💭 test-agent thinking/)).toBeInTheDocument();
      expect(screen.getByText('Test thinking')).toBeInTheDocument();
    });

    it('should use default values for optional props', () => {
      const minimalProps = {
        thinking: 'Test thinking',
        agent: 'test-agent',
      };

      render(<ThoughtDisplay {...minimalProps} />);

      // Should render (not compact by default)
      expect(screen.getByText(/thinking/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render content that is accessible to screen readers', () => {
      render(<ThoughtDisplay {...defaultProps} />);

      // Content should be in the DOM and accessible
      const thinkingIndicator = screen.getByText(/💭 developer thinking/);
      const thinkingContent = screen.getByText(defaultProps.thinking);

      expect(thinkingIndicator).toBeInTheDocument();
      expect(thinkingContent).toBeInTheDocument();
    });

    it('should maintain text wrapping for long content', () => {
      const longThinking = 'This is a very long thought that should wrap properly in the terminal display to maintain readability.';

      render(<ThoughtDisplay {...defaultProps} thinking={longThinking} />);

      const contentElement = screen.getByText(longThinking);
      expect(contentElement).toHaveAttribute('data-wrap', 'wrap');
    });
  });
});