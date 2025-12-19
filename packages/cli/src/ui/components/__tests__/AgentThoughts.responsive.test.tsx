import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgentThoughts } from '../AgentThoughts.js';
import { BREAKPOINT_CONFIGS, assertNoOverflow } from '../../__tests__/responsive-test-utils.js';

// Mock ink and CollapsibleSection
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, wrap, color, dimColor, bold, ...props }: any) => (
    <span
      data-testid="text"
      data-wrap={wrap}
      data-color={color}
      data-dim={dimColor}
      data-bold={bold}
      {...props}
    >
      {children}
    </span>
  ),
}));

vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: ({ children, title, collapsed, onToggle, headerExtra, ...props }: any) => (
    <div data-testid="collapsible" data-collapsed={collapsed} {...props}>
      <div data-testid="title" onClick={() => onToggle && onToggle(!collapsed)}>
        {title}
        {headerExtra && <span data-testid="header-extra">{headerExtra}</span>}
      </div>
      {!collapsed && <div data-testid="content">{children}</div>}
    </div>
  ),
}));

describe('AgentThoughts Responsive Behavior', () => {
  // Test wrap behavior
  describe('Text Wrap Behavior', () => {
    it('applies wrap="wrap" attribute for proper text wrapping', () => {
      render(
        <AgentThoughts
          thinking="This is a long thought that needs to wrap properly"
          agent="developer"
          displayMode="normal"
        />
      );

      const textElements = screen.getAllByTestId('text');
      const contentText = textElements.find(el =>
        el.textContent?.includes('long thought')
      );
      expect(contentText).toHaveAttribute('data-wrap', 'wrap');
    });

    it('ensures content wraps even with very long thoughts', () => {
      const veryLongThought = 'This is an extremely long thought that goes on and on without any line breaks and should be properly wrapped by the Text component to prevent horizontal overflow in terminal displays no matter how narrow the terminal width becomes. '.repeat(3);

      render(
        <AgentThoughts
          thinking={veryLongThought}
          agent="developer"
          displayMode="verbose"
        />
      );

      const textElements = screen.getAllByTestId('text');
      const contentText = textElements.find(el =>
        el.textContent?.includes('extremely long thought')
      );
      expect(contentText).toHaveAttribute('data-wrap', 'wrap');
    });
  });

  // Test hidden in compact mode
  describe('Hidden in Compact Mode', () => {
    it('returns empty Box in compact displayMode', () => {
      const { container } = render(
        <AgentThoughts
          thinking="Should not be visible"
          agent="developer"
          displayMode="compact"
        />
      );

      expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
      // Should render an empty box instead
      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes).toHaveLength(1);
      expect(boxes[0]).toBeEmptyDOMElement();
    });

    it('properly hides even with very important thinking content', () => {
      const importantThinking = 'CRITICAL: This is very important debugging information that the user should see but will be hidden in compact mode';

      render(
        <AgentThoughts
          thinking={importantThinking}
          agent="developer"
          displayMode="compact"
        />
      );

      expect(screen.queryByText(/CRITICAL/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('collapsible')).not.toBeInTheDocument();
    });
  });

  // Test truncation limits
  describe('Truncation Limits by Display Mode', () => {
    it('truncates at 500 chars in normal mode', () => {
      const longThinking = 'A'.repeat(600);

      render(
        <AgentThoughts
          thinking={longThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/600 chars/)).toBeInTheDocument();

      // Content should be truncated
      const contentText = screen.getAllByTestId('text').find(el =>
        el.textContent?.startsWith('A')
      );
      expect(contentText?.textContent?.length).toBe(503); // 500 + "..."
    });

    it('uses custom maxLength when provided', () => {
      const longThinking = 'B'.repeat(300);

      render(
        <AgentThoughts
          thinking={longThinking}
          agent="developer"
          displayMode="normal"
          maxLength={100}
        />
      );

      // Should show truncation indicator for 300 chars
      expect(screen.getByText(/300 chars/)).toBeInTheDocument();

      // Content should be truncated to 100 chars + "..."
      const contentText = screen.getAllByTestId('text').find(el =>
        el.textContent?.startsWith('B')
      );
      expect(contentText?.textContent?.length).toBe(103); // 100 + "..."
    });

    it('truncates at 1000 chars in verbose mode', () => {
      const veryLongThinking = 'C'.repeat(1200);

      render(
        <AgentThoughts
          thinking={veryLongThinking}
          agent="developer"
          displayMode="verbose"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/1200 chars/)).toBeInTheDocument();

      // Content should be truncated to 1000 chars + "..."
      const contentText = screen.getAllByTestId('text').find(el =>
        el.textContent?.startsWith('C')
      );
      expect(contentText?.textContent?.length).toBe(1003); // 1000 + "..."
    });

    it('does not truncate short thoughts', () => {
      const shortThinking = 'Short thought';

      render(
        <AgentThoughts
          thinking={shortThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.queryByText(/chars\)/)).not.toBeInTheDocument();
      expect(screen.getByText('Short thought')).toBeInTheDocument();
    });
  });

  // Test icon display
  describe('Icon Display', () => {
    it('uses thought emoji by default', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByTestId('title').textContent).toContain('💭');
      expect(screen.getByTestId('title').textContent).toContain('developer thinking');
    });

    it('uses ASCII icon when specified', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
          useAsciiIcons={true}
        />
      );

      expect(screen.getByTestId('title').textContent).toContain('[T]');
      expect(screen.getByTestId('title').textContent).not.toContain('💭');
    });

    it('uses custom icon when provided', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
          icon="🤔"
        />
      );

      expect(screen.getByTestId('title').textContent).toContain('🤔');
      expect(screen.getByTestId('title').textContent).not.toContain('💭');
    });
  });

  // Test collapsible behavior
  describe('Collapsible Behavior', () => {
    it('defaults to collapsed state', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible).toHaveAttribute('data-collapsed', 'true');
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('can be controlled with collapsed prop', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
          collapsed={false}
        />
      );

      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible).toHaveAttribute('data-collapsed', 'false');
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('respects defaultCollapsed=false', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
          defaultCollapsed={false}
        />
      );

      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible).toHaveAttribute('data-collapsed', 'false');
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  // Test styling consistency
  describe('Styling Consistency', () => {
    it('applies consistent dimmed styling', () => {
      render(
        <AgentThoughts
          thinking="Test thought content"
          agent="developer"
          displayMode="normal"
          collapsed={false}
        />
      );

      // All text should be dimmed and gray
      const textElements = screen.getAllByTestId('text');
      textElements.forEach(element => {
        expect(element).toHaveAttribute('data-color', 'gray');
        expect(element).toHaveAttribute('data-dim', 'true');
      });
    });

    it('maintains styling across different display modes', () => {
      ['normal', 'verbose'].forEach(displayMode => {
        const { unmount } = render(
          <AgentThoughts
            thinking="Test thought content"
            agent="developer"
            displayMode={displayMode as any}
            collapsed={false}
          />
        );

        const textElements = screen.getAllByTestId('text');
        expect(textElements.length).toBeGreaterThan(0);

        textElements.forEach(element => {
          expect(element).toHaveAttribute('data-color', 'gray');
          expect(element).toHaveAttribute('data-dim', 'true');
        });

        unmount();
      });
    });
  });

  // Test edge cases
  describe('Edge Cases', () => {
    it('handles empty thinking content', () => {
      render(
        <AgentThoughts
          thinking=""
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByTestId('title')).toBeInTheDocument();
      expect(screen.queryByText(/chars\)/)).not.toBeInTheDocument();
    });

    it('handles very long agent names', () => {
      const longAgentName = 'very-very-long-agent-name-that-might-cause-layout-issues';

      render(
        <AgentThoughts
          thinking="Test thought"
          agent={longAgentName}
          displayMode="normal"
        />
      );

      expect(screen.getByTestId('title')).toHaveTextContent(longAgentName);
    });

    it('handles special characters in thinking content', () => {
      const specialContent = 'Thinking with special chars: @#$%^&*()[]{}|\\:";\'<>?,./`~';

      render(
        <AgentThoughts
          thinking={specialContent}
          agent="developer"
          displayMode="normal"
          collapsed={false}
        />
      );

      expect(screen.getByText(specialContent)).toBeInTheDocument();
    });

    it('handles newlines and formatting in thinking content', () => {
      const multilineContent = 'Line 1\nLine 2\n\nLine 4 with extra spacing';

      render(
        <AgentThoughts
          thinking={multilineContent}
          agent="developer"
          displayMode="normal"
          collapsed={false}
        />
      );

      expect(screen.getByText(multilineContent)).toBeInTheDocument();
    });
  });
});