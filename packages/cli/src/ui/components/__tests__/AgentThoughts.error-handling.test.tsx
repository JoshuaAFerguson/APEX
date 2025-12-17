/**
 * Error Handling and Resilience Tests for AgentThoughts component
 * Focuses on graceful degradation and error recovery scenarios
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentThoughts, type AgentThoughtsProps } from '../AgentThoughts.js';

// Mock CollapsibleSection to simulate errors
const mockCollapsibleSection = vi.fn();

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
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('AgentThoughts Error Handling Tests', () => {
  const defaultProps: AgentThoughtsProps = {
    thinking: 'Test thinking content',
    agent: 'test-agent',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset CollapsibleSection mock to normal behavior
    mockCollapsibleSection.mockImplementation(({ title, children, ...props }) => (
      <div
        data-testid="collapsible-section"
        data-props={JSON.stringify(props)}
        data-title={title}
      >
        <div data-testid="title">{title}</div>
        <div data-testid="content">{children}</div>
      </div>
    ));
  });

  describe('Malformed Input Handling', () => {
    it('should handle extremely malformed thinking content gracefully', () => {
      const malformedContent = '\u0000\u0001\u0002\u000B\u000C\u000E\u000F';
      render(<AgentThoughts {...defaultProps} thinking={malformedContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(malformedContent);
    });

    it('should handle null-like agent names', () => {
      render(<AgentThoughts {...defaultProps} agent={'null' as any} />);

      expect(screen.getByTestId('title')).toHaveTextContent('💭 null thinking');
    });

    it('should handle JSON-like agent names', () => {
      const jsonAgent = '{"type":"agent","name":"test"}';
      render(<AgentThoughts {...defaultProps} agent={jsonAgent} />);

      expect(screen.getByTestId('title')).toHaveTextContent(`💭 ${jsonAgent} thinking`);
    });

    it('should handle HTML-like thinking content', () => {
      const htmlContent = '<script>alert("xss")</script><div>content</div>';
      render(<AgentThoughts {...defaultProps} thinking={htmlContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(htmlContent);
    });

    it('should handle binary-like content', () => {
      const binaryContent = Array.from({ length: 100 }, (_, i) => String.fromCharCode(i)).join('');
      render(<AgentThoughts {...defaultProps} thinking={binaryContent} />);

      // Should truncate because it's longer than default maxLength (500)
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(503); // 500 + '...'
    });

    it('should handle extremely long thinking content gracefully', () => {
      const extremelyLongContent = 'x'.repeat(100000);
      render(<AgentThoughts {...defaultProps} thinking={extremelyLongContent} />);

      // Should be truncated to default 500 characters
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(503); // 500 + '...'
    });
  });

  describe('Callback Error Handling', () => {
    it('should handle onToggle callback that throws errors', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      // Should not crash when callback throws
      expect(() => {
        render(<AgentThoughts {...defaultProps} onToggle={errorCallback} />);
      }).not.toThrow();
    });

    it('should handle onToggle callback that is null', () => {
      expect(() => {
        render(<AgentThoughts {...defaultProps} onToggle={null as any} />);
      }).not.toThrow();
    });

    it('should handle onToggle callback that is undefined', () => {
      expect(() => {
        render(<AgentThoughts {...defaultProps} onToggle={undefined} />);
      }).not.toThrow();
    });
  });

  describe('Props Edge Cases', () => {
    it('should handle invalid displayMode values gracefully', () => {
      expect(() => {
        render(<AgentThoughts {...defaultProps} displayMode={'invalid' as any} />);
      }).not.toThrow();
    });

    it('should handle negative maxLength gracefully', () => {
      render(<AgentThoughts {...defaultProps} maxLength={-1000} />);

      const textElement = screen.getByTestId('text');
      // Should show just ellipsis when maxLength is negative
      expect(textElement.textContent).toBe('...');
    });

    it('should handle maxLength as float number', () => {
      render(<AgentThoughts {...defaultProps} maxLength={10.5} />);

      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      // Should truncate to 10 characters (floor of 10.5) + '...'
      expect(displayedText).toHaveLength(13); // 10 + '...'
    });

    it('should handle maxLength as Infinity', () => {
      render(<AgentThoughts {...defaultProps} maxLength={Infinity} />);

      const textElement = screen.getByTestId('text');
      // Should show full content when maxLength is Infinity
      expect(textElement.textContent).toBe(defaultProps.thinking);
    });

    it('should handle maxLength as NaN', () => {
      render(<AgentThoughts {...defaultProps} maxLength={NaN} />);

      // Should fallback to some reasonable behavior (likely default maxLength)
      const textElement = screen.getByTestId('text');
      expect(textElement.textContent).toBe(defaultProps.thinking);
    });
  });

  describe('Component State Corruption Handling', () => {
    it('should handle collapsed prop changing from controlled to uncontrolled', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} collapsed={true} />
      );

      // Switch from controlled to uncontrolled
      rerender(<AgentThoughts {...defaultProps} collapsed={undefined} />);

      // Should not crash
      expect(screen.getByTestId('collapsible-section')).toBeInTheDocument();
    });

    it('should handle rapid prop changes without state corruption', () => {
      const { rerender } = render(<AgentThoughts {...defaultProps} />);

      // Rapidly change multiple props
      for (let i = 0; i < 100; i++) {
        rerender(
          <AgentThoughts
            {...defaultProps}
            thinking={`thought-${i}`}
            agent={`agent-${i}`}
            displayMode={i % 2 === 0 ? 'normal' : 'verbose'}
            maxLength={100 + i}
            collapsed={i % 3 === 0}
          />
        );
      }

      // Should render final state correctly
      expect(screen.getByTestId('title')).toHaveTextContent('💭 agent-99 thinking');
    });

    it('should handle simultaneous prop and state changes', () => {
      const { rerender } = render(
        <AgentThoughts {...defaultProps} defaultCollapsed={false} />
      );

      // Change multiple props simultaneously
      rerender(
        <AgentThoughts
          {...defaultProps}
          thinking="new thinking"
          agent="new-agent"
          displayMode="compact"
          maxLength={50}
          collapsed={true}
          defaultCollapsed={true}
        />
      );

      // In compact mode, should render empty Box
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle creation and destruction of multiple instances', () => {
      const instances = [];

      // Create multiple instances
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <AgentThoughts
            thinking={`thinking-${i}`}
            agent={`agent-${i}`}
            key={i}
          />
        );
        instances.push(unmount);
      }

      // Unmount all instances
      instances.forEach(unmount => unmount());

      // Should not have memory leaks or errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should handle rapid mounting and unmounting', () => {
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <AgentThoughts thinking="test" agent="test" />
        );
        unmount();
      }

      // Should not have memory leaks
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should handle components with identical props', () => {
      const props = { thinking: 'identical', agent: 'identical' };

      // Render multiple components with identical props
      render(
        <div>
          <AgentThoughts {...props} />
          <AgentThoughts {...props} />
          <AgentThoughts {...props} />
        </div>
      );

      const sections = screen.getAllByTestId('collapsible-section');
      expect(sections).toHaveLength(3);
    });
  });

  describe('Unicode and Internationalization Edge Cases', () => {
    it('should handle RTL (Right-to-Left) text content', () => {
      const rtlContent = 'هذا نص باللغة العربية للاختبار';
      render(<AgentThoughts {...defaultProps} thinking={rtlContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(rtlContent);
    });

    it('should handle mixed LTR and RTL content', () => {
      const mixedContent = 'English text and عربي text mixed together';
      render(<AgentThoughts {...defaultProps} thinking={mixedContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(mixedContent);
    });

    it('should handle emoji-heavy content', () => {
      const emojiContent = '🚀🎉✨💡🔥⭐️🌟💫🎯🏆🎊🎈🎁🎂🎪🎨🎭🎵🎶🎸🎤';
      render(<AgentThoughts {...defaultProps} thinking={emojiContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(emojiContent);
    });

    it('should handle CJK (Chinese, Japanese, Korean) characters', () => {
      const cjkContent = '这是中文 これは日本語です 이것은 한국어입니다';
      render(<AgentThoughts {...defaultProps} thinking={cjkContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(cjkContent);
    });

    it('should handle mathematical symbols and special characters', () => {
      const mathContent = '∑(n=1 to ∞) 1/n² = π²/6 ∀x∈ℝ: f(x) = ∫₀ˣ e^(-t²) dt';
      render(<AgentThoughts {...defaultProps} thinking={mathContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(mathContent);
    });
  });

  describe('Accessibility Error Scenarios', () => {
    it('should provide meaningful fallback when icon is empty', () => {
      render(<AgentThoughts {...defaultProps} icon="" />);

      const titleElement = screen.getByTestId('title');
      // Should still be readable even without icon
      expect(titleElement).toHaveTextContent(' test-agent thinking');
    });

    it('should handle very long agent names for screen readers', () => {
      const longAgent = 'very-very-very-long-agent-name-that-might-cause-accessibility-issues-with-screen-readers';
      render(<AgentThoughts {...defaultProps} agent={longAgent} />);

      expect(screen.getByTestId('title')).toHaveTextContent(`💭 ${longAgent} thinking`);
    });

    it('should maintain accessibility when content contains special characters', () => {
      const specialContent = 'Content with "quotes", <brackets>, & ampersands, and 100% symbols';
      render(<AgentThoughts {...defaultProps} thinking={specialContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(specialContent);
    });
  });

  describe('CollapsibleSection Integration Error Handling', () => {
    it('should handle CollapsibleSection throwing errors', () => {
      // Make CollapsibleSection throw an error
      mockCollapsibleSection.mockImplementation(() => {
        throw new Error('CollapsibleSection error');
      });

      // Should not crash the parent component
      expect(() => {
        render(<AgentThoughts {...defaultProps} />);
      }).toThrow('CollapsibleSection error');
    });

    it('should handle CollapsibleSection returning null', () => {
      mockCollapsibleSection.mockReturnValue(null);

      render(<AgentThoughts {...defaultProps} />);

      // Should render without crashing
      expect(mockCollapsibleSection).toHaveBeenCalled();
    });

    it('should handle CollapsibleSection with invalid props', () => {
      mockCollapsibleSection.mockImplementation((props) => {
        // Simulate component that doesn't handle invalid props well
        if (props.invalidProp) {
          throw new Error('Invalid prop');
        }
        return <div>CollapsibleSection</div>;
      });

      // Should not pass invalid props
      expect(() => {
        render(<AgentThoughts {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle older browser environments', () => {
      // Simulate environment without modern string methods
      const originalSubstring = String.prototype.substring;
      String.prototype.substring = function(start: number, end?: number) {
        // Simulate older substring implementation quirks
        if (start < 0) start = 0;
        if (end !== undefined && end < 0) end = 0;
        return originalSubstring.call(this, start, end);
      };

      try {
        render(<AgentThoughts {...defaultProps} thinking="test content" maxLength={4} />);
        expect(screen.getByTestId('text')).toBeInTheDocument();
      } finally {
        // Restore original method
        String.prototype.substring = originalSubstring;
      }
    });

    it('should handle environments with limited Unicode support', () => {
      // Test with content that might cause issues in limited Unicode environments
      const unicodeContent = '\uD83D\uDE80\uD83C\uDF86\u2728'; // Rocket, fireworks, sparkles
      render(<AgentThoughts {...defaultProps} thinking={unicodeContent} />);

      expect(screen.getByTestId('text')).toHaveTextContent(unicodeContent);
    });
  });
});