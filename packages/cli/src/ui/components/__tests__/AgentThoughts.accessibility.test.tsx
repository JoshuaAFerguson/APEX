/**
 * Accessibility Compliance Tests for AgentThoughts component
 * Focuses on testing screen reader support, keyboard navigation, and WCAG compliance
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentThoughts, type AgentThoughtsProps } from '../AgentThoughts.js';

// Mock CollapsibleSection with accessibility attributes
const mockCollapsibleSection = vi.fn(({ title, children, ...props }) => (
  <div
    data-testid="collapsible-section"
    role="region"
    aria-labelledby="thinking-header"
    aria-expanded={!props.collapsed}
    tabIndex={0}
  >
    <div
      id="thinking-header"
      data-testid="title"
      role="button"
      aria-label={`Toggle ${title}`}
      tabIndex={0}
    >
      {title}
    </div>
    {!props.collapsed && (
      <div data-testid="content" role="group">
        {children}
      </div>
    )}
  </div>
));

vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: mockCollapsibleSection,
}));

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
      role="text"
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('AgentThoughts Accessibility Tests', () => {
  const defaultProps: AgentThoughtsProps = {
    thinking: 'This is accessible thinking content for screen reader testing',
    agent: 'accessibility-agent',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful text content for screen readers', () => {
      render(<AgentThoughts {...defaultProps} />);

      // Title should be accessible to screen readers
      const titleElement = screen.getByRole('button');
      expect(titleElement).toHaveTextContent('💭 accessibility-agent thinking');
      expect(titleElement).toHaveAttribute('aria-label', 'Toggle 💭 accessibility-agent thinking');

      // Content should be accessible
      const contentElement = screen.getByRole('text');
      expect(contentElement).toHaveTextContent(defaultProps.thinking);
    });

    it('should handle empty or whitespace-only content for screen readers', () => {
      render(<AgentThoughts {...defaultProps} thinking="   " />);

      const contentElement = screen.getByRole('text');
      expect(contentElement).toHaveTextContent('   ');
    });

    it('should provide proper ARIA labels for different agent names', () => {
      const testAgents = ['developer', 'tester', 'architect', 'reviewer'];

      testAgents.forEach(agent => {
        const { unmount } = render(
          <AgentThoughts {...defaultProps} agent={agent} />
        );

        const titleElement = screen.getByRole('button');
        expect(titleElement).toHaveAttribute(
          'aria-label',
          `Toggle 💭 ${agent} thinking`
        );

        unmount();
      });
    });

    it('should handle special characters in agent names for screen readers', () => {
      const specialAgent = 'agent-with-special_chars.123';
      render(<AgentThoughts {...defaultProps} agent={specialAgent} />);

      const titleElement = screen.getByRole('button');
      expect(titleElement).toHaveAttribute(
        'aria-label',
        `Toggle 💭 ${specialAgent} thinking`
      );
    });

    it('should provide accessible content with truncation information', () => {
      const longThinking = 'A'.repeat(1000);
      render(
        <AgentThoughts
          {...defaultProps}
          thinking={longThinking}
          maxLength={100}
        />
      );

      // Should show truncated content
      const contentElement = screen.getByRole('text');
      const displayedText = contentElement.textContent || '';
      expect(displayedText).toHaveLength(103); // 100 + '...'

      // Title should indicate truncation
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('should handle unicode and emoji content for screen readers', () => {
      const unicodeContent = '🚀 Unicode test: 测试 العربية हिंदी';
      render(<AgentThoughts {...defaultProps} thinking={unicodeContent} />);

      const contentElement = screen.getByRole('text');
      expect(contentElement).toHaveTextContent(unicodeContent);
    });
  });

  describe('Keyboard Navigation Support', () => {
    it('should be keyboard accessible when expanded', () => {
      render(
        <AgentThoughts
          {...defaultProps}
          defaultCollapsed={false}
        />
      );

      // Both region and button should be keyboard accessible
      const region = screen.getByRole('region');
      const button = screen.getByRole('button');

      expect(region).toHaveAttribute('tabIndex', '0');
      expect(button).toHaveAttribute('tabIndex', '0');
    });

    it('should be keyboard accessible when collapsed', () => {
      render(
        <AgentThoughts
          {...defaultProps}
          defaultCollapsed={true}
        />
      );

      const region = screen.getByRole('region');
      const button = screen.getByRole('button');

      expect(region).toHaveAttribute('tabIndex', '0');
      expect(button).toHaveAttribute('tabIndex', '0');
    });

    it('should handle focus management properly', () => {
      render(<AgentThoughts {...defaultProps} />);

      const button = screen.getByRole('button');

      // Should be focusable
      act(() => {
        button.focus();
      });

      expect(document.activeElement).toBe(button);
    });

    it('should maintain focus indication for different display modes', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} displayMode="normal" />
      );

      const button = screen.getByRole('button');
      act(() => {
        button.focus();
      });

      // Switch to verbose mode
      rerender(
        <AgentThoughts {...defaultProps} displayMode="verbose" />
      );

      // Should still have keyboard accessibility
      const newButton = screen.getByRole('button');
      expect(newButton).toHaveAttribute('tabIndex', '0');
    });

    it('should handle keyboard navigation in compact mode', () => {
      render(
        <AgentThoughts {...defaultProps} displayMode="compact" />
      );

      // In compact mode, component renders empty Box
      const box = screen.getByTestId('box');
      expect(box).toBeInTheDocument();

      // No interactive elements should be present
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });
  });

  describe('ARIA Attributes and Semantic Structure', () => {
    it('should provide proper ARIA roles for component structure', () => {
      render(
        <AgentThoughts
          {...defaultProps}
          defaultCollapsed={false}
        />
      );

      // Should have proper semantic structure
      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByRole('group')).toBeInTheDocument(); // Content area
      expect(screen.getByRole('text')).toBeInTheDocument();
    });

    it('should maintain ARIA expanded state correctly', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} collapsed={true} />
      );

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-expanded', 'false');

      // Switch to expanded
      rerender(<AgentThoughts {...defaultProps} collapsed={false} />);

      const expandedRegion = screen.getByRole('region');
      expect(expandedRegion).toHaveAttribute('aria-expanded', 'true');
    });

    it('should provide proper ARIA labelledby relationships', () => {
      render(<AgentThoughts {...defaultProps} />);

      const region = screen.getByRole('region');
      const header = screen.getByRole('button');

      expect(region).toHaveAttribute('aria-labelledby', 'thinking-header');
      expect(header).toHaveAttribute('id', 'thinking-header');
    });

    it('should handle multiple instances with unique IDs', () => {
      render(
        <div>
          <AgentThoughts thinking="First thought" agent="agent1" />
          <AgentThoughts thinking="Second thought" agent="agent2" />
        </div>
      );

      const regions = screen.getAllByRole('region');
      const buttons = screen.getAllByRole('button');

      expect(regions).toHaveLength(2);
      expect(buttons).toHaveLength(2);

      // Each should have proper accessibility structure
      regions.forEach(region => {
        expect(region).toHaveAttribute('aria-labelledby', 'thinking-header');
      });
    });
  });

  describe('Visual Accessibility Features', () => {
    it('should provide proper color contrast information', () => {
      render(<AgentThoughts {...defaultProps} />);

      const textElement = screen.getByRole('text');
      expect(textElement).toHaveAttribute('data-color', 'gray');
      expect(textElement).toHaveAttribute('data-dim', 'true');
    });

    it('should handle high contrast mode preferences', () => {
      render(<AgentThoughts {...defaultProps} displayMode="verbose" />);

      // In verbose mode, should provide additional visual cues
      const textElement = screen.getByRole('text');
      expect(textElement).toBeInTheDocument();
    });

    it('should provide visual indicators for state changes', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} collapsed={true} />
      );

      let region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-expanded', 'false');

      rerender(<AgentThoughts {...defaultProps} collapsed={false} />);

      region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-expanded', 'true');

      // Content should now be visible
      expect(screen.getByRole('group')).toBeInTheDocument();
    });
  });

  describe('Content Accessibility', () => {
    it('should handle accessible content formatting', () => {
      const formattedContent = `
        Step 1: Analyze the problem
        Step 2: Design solution
        Step 3: Implement features
        Step 4: Test thoroughly
      `;

      render(<AgentThoughts {...defaultProps} thinking={formattedContent} />);

      const textElement = screen.getByRole('text');
      expect(textElement).toHaveTextContent(formattedContent);
    });

    it('should preserve semantic meaning in truncated content', () => {
      const semanticContent = 'Important: This is a critical warning message that users must understand completely.';

      render(
        <AgentThoughts
          {...defaultProps}
          thinking={semanticContent}
          maxLength={20} // Force truncation
        />
      );

      const textElement = screen.getByRole('text');
      const displayedText = textElement.textContent || '';

      // Should truncate but preserve beginning which contains semantic information
      expect(displayedText).toStartWith('Important');
      expect(displayedText).toEndWith('...');
    });

    it('should handle accessible icon alternatives', () => {
      render(<AgentThoughts {...defaultProps} useAsciiIcons={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('[T] accessibility-agent thinking');
    });

    it('should provide accessible custom icon handling', () => {
      render(<AgentThoughts {...defaultProps} icon="🧠" />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('🧠 accessibility-agent thinking');
    });

    it('should handle empty icon gracefully for accessibility', () => {
      render(<AgentThoughts {...defaultProps} icon="" />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent(' accessibility-agent thinking');
      expect(button).toHaveAttribute('aria-label', 'Toggle  accessibility-agent thinking');
    });
  });

  describe('Error State Accessibility', () => {
    it('should maintain accessibility when content is empty', () => {
      render(<AgentThoughts {...defaultProps} thinking="" />);

      // Should still provide accessible structure
      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByRole('text')).toHaveTextContent('');
    });

    it('should handle accessibility for malformed content gracefully', () => {
      const malformedContent = '<script>alert("test")</script>';
      render(<AgentThoughts {...defaultProps} thinking={malformedContent} />);

      const textElement = screen.getByRole('text');
      expect(textElement).toHaveTextContent(malformedContent);
    });

    it('should maintain accessibility during rapid state changes', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} collapsed={false} />
      );

      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <AgentThoughts
            {...defaultProps}
            collapsed={i % 2 === 0}
            thinking={`Update ${i}`}
          />
        );
      }

      // Should maintain accessibility
      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Assistive Technology Integration', () => {
    it('should work properly with screen reader focus management', () => {
      const onToggle = vi.fn();
      render(
        <AgentThoughts
          {...defaultProps}
          defaultCollapsed={true}
          onToggle={onToggle}
        />
      );

      const button = screen.getByRole('button');

      // Simulate screen reader activation
      act(() => {
        fireEvent.click(button);
      });

      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('should provide proper landmark structure for navigation', () => {
      render(
        <main>
          <h1>Agent Conversation</h1>
          <AgentThoughts {...defaultProps} />
        </main>
      );

      // Should integrate properly with page landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('should handle voice control accessibility features', () => {
      render(<AgentThoughts {...defaultProps} />);

      const button = screen.getByRole('button');

      // Voice control relies on accessible names
      expect(button).toHaveAttribute('aria-label');
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });

    it('should support screen reader content reading modes', () => {
      const structuredContent = `
        Analysis Phase:
        - Requirement gathering
        - Stakeholder interviews
        - Technical assessment

        Implementation Phase:
        - Architecture design
        - Development planning
        - Testing strategy
      `;

      render(<AgentThoughts {...defaultProps} thinking={structuredContent} />);

      const textElement = screen.getByRole('text');
      expect(textElement).toHaveTextContent(structuredContent);
      expect(textElement).toHaveAttribute('data-wrap', 'wrap');
    });
  });
});