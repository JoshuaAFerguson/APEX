import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThoughtDisplay } from '../ThoughtDisplay.js';
import { stripAnsi, assertNoOverflow } from '../../__tests__/responsive-test-utils.js';

// Mock ink
vi.mock('ink', () => ({
  Box: ({ children, marginTop, marginLeft, paddingX, borderStyle, borderColor, borderDimColor, flexDirection, ...props }: any) => (
    <div
      data-testid="box"
      data-margin-top={marginTop}
      data-margin-left={marginLeft}
      data-padding-x={paddingX}
      data-border-style={borderStyle}
      data-border-color={borderColor}
      data-border-dim={borderDimColor}
      data-flex-direction={flexDirection}
      {...props}
    >
      {children}
    </div>
  ),
  Text: ({ children, wrap, color, dimColor, ...props }: any) => (
    <span
      data-testid="text"
      data-wrap={wrap}
      data-color={color}
      data-dim={dimColor}
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('ThoughtDisplay Responsive Behavior', () => {
  // Test wrap attribute
  describe('Text Wrap Attribute', () => {
    it('applies wrap="wrap" for content text', () => {
      render(
        <ThoughtDisplay
          thinking="Long thought content that should wrap"
          agent="developer"
          displayMode="normal"
        />
      );

      const contentText = screen.getAllByTestId('text').find(el =>
        el.textContent === 'Long thought content that should wrap'
      );
      expect(contentText).toHaveAttribute('data-wrap', 'wrap');
    });

    it('ensures wrap attribute is present for very long content', () => {
      const veryLongContent = 'This is an extremely long thought that goes on and on without any line breaks and should definitely wrap properly to prevent horizontal overflow in any terminal configuration. '.repeat(5);

      render(
        <ThoughtDisplay
          thinking={veryLongContent}
          agent="developer"
          displayMode="normal"
        />
      );

      const contentText = screen.getAllByTestId('text').find(el =>
        el.textContent?.includes('extremely long thought')
      );
      expect(contentText).toHaveAttribute('data-wrap', 'wrap');
    });
  });

  // Test hidden in compact
  describe('Hidden in Compact Mode', () => {
    it('returns empty box when compact=true', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Hidden content"
          agent="developer"
          compact={true}
        />
      );

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
      // Should render an empty box
      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes).toHaveLength(1);
      expect(boxes[0]).toBeEmptyDOMElement();
    });

    it('returns empty box when displayMode="compact"', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Hidden content"
          agent="developer"
          displayMode="compact"
        />
      );

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes).toHaveLength(1);
      expect(boxes[0]).toBeEmptyDOMElement();
    });

    it('prioritizes compact prop over displayMode', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Hidden content"
          agent="developer"
          displayMode="verbose"
          compact={true}
        />
      );

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes).toHaveLength(1);
      expect(boxes[0]).toBeEmptyDOMElement();
    });
  });

  // Test truncation
  describe('Truncation by Display Mode', () => {
    it('truncates at 300 chars in normal mode', () => {
      const longThinking = 'X'.repeat(400);

      render(
        <ThoughtDisplay
          thinking={longThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/truncated from 400 chars/)).toBeInTheDocument();

      // Content should be 300 chars + "..."
      const truncatedContent = screen.getAllByTestId('text').find(el =>
        el.textContent?.startsWith('X')
      );
      expect(truncatedContent?.textContent?.length).toBe(303); // 300 + "..."
    });

    it('truncates at 1000 chars in verbose mode', () => {
      const veryLongThinking = 'Y'.repeat(1200);

      render(
        <ThoughtDisplay
          thinking={veryLongThinking}
          agent="developer"
          displayMode="verbose"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/truncated from 1200 chars/)).toBeInTheDocument();

      // Content should be 1000 chars + "..."
      const truncatedContent = screen.getAllByTestId('text').find(el =>
        el.textContent?.startsWith('Y')
      );
      expect(truncatedContent?.textContent?.length).toBe(1003); // 1000 + "..."
    });

    it('does not truncate content under the limit', () => {
      const shortThinking = 'Short content';

      render(
        <ThoughtDisplay
          thinking={shortThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
      expect(screen.getByText('Short content')).toBeInTheDocument();
    });

    it('handles exactly at truncation boundary', () => {
      const exactLengthThinking = 'Z'.repeat(300); // Exactly 300 chars

      render(
        <ThoughtDisplay
          thinking={exactLengthThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should not truncate at exactly the limit
      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
      expect(screen.getByText(exactLengthThinking)).toBeInTheDocument();
    });
  });

  // Test proper styling
  describe('Styling Attributes', () => {
    it('applies gray color and dimColor for secondary appearance', () => {
      render(
        <ThoughtDisplay
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      const textElements = screen.getAllByTestId('text');

      // Header should be gray and dimmed
      const header = textElements.find(el => el.textContent?.includes('thinking'));
      expect(header).toHaveAttribute('data-color', 'gray');
      expect(header).toHaveAttribute('data-dim', 'true');

      // Content should be gray and dimmed
      const content = textElements.find(el => el.textContent === 'Test thought');
      expect(content).toHaveAttribute('data-color', 'gray');
      expect(content).toHaveAttribute('data-dim', 'true');
    });

    it('maintains consistent styling across display modes', () => {
      ['normal', 'verbose'].forEach(displayMode => {
        const { unmount } = render(
          <ThoughtDisplay
            thinking="Test thought content"
            agent="developer"
            displayMode={displayMode as any}
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

  // Test layout structure
  describe('Layout Structure', () => {
    it('creates proper box hierarchy', () => {
      render(
        <ThoughtDisplay
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      const boxes = screen.getAllByTestId('box');

      // Should have main container and content box
      expect(boxes).toHaveLength(3); // Main box, header box, content box

      // Main container should have column direction
      expect(boxes[0]).toHaveAttribute('data-flex-direction', 'column');

      // Content box should have proper styling attributes
      const contentBox = boxes[2]; // Last box is content
      expect(contentBox).toHaveAttribute('data-margin-left', '3');
      expect(contentBox).toHaveAttribute('data-margin-top', '1');
      expect(contentBox).toHaveAttribute('data-padding-x', '1');
      expect(contentBox).toHaveAttribute('data-border-style', 'round');
      expect(contentBox).toHaveAttribute('data-border-color', 'gray');
      expect(contentBox).toHaveAttribute('data-border-dim', 'true');
    });

    it('displays thinking emoji and agent name correctly', () => {
      render(
        <ThoughtDisplay
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
    });
  });

  // Test edge cases
  describe('Edge Cases', () => {
    it('handles empty thinking content', () => {
      render(
        <ThoughtDisplay
          thinking=""
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();
      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
    });

    it('handles very long agent names', () => {
      const longAgentName = 'very-very-long-agent-name-that-might-cause-layout-issues';

      render(
        <ThoughtDisplay
          thinking="Test thought"
          agent={longAgentName}
          displayMode="normal"
        />
      );

      expect(screen.getByText(`💭 ${longAgentName} thinking`)).toBeInTheDocument();
    });

    it('handles special characters in thinking content', () => {
      const specialContent = 'Thinking with special chars: @#$%^&*()[]{}|\\:";\'<>?,./`~';

      render(
        <ThoughtDisplay
          thinking={specialContent}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByText(specialContent)).toBeInTheDocument();
    });

    it('handles newlines and formatting in thinking content', () => {
      const multilineContent = 'Line 1\nLine 2\n\nLine 4 with extra spacing';

      render(
        <ThoughtDisplay
          thinking={multilineContent}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByText(multilineContent)).toBeInTheDocument();
    });

    it('handles unicode and emoji in thinking content', () => {
      const unicodeContent = '🚀 Unicode content with émojis and spëcial characters: 你好 世界! 🌟';

      render(
        <ThoughtDisplay
          thinking={unicodeContent}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByText(unicodeContent)).toBeInTheDocument();
    });
  });

  // Test truncation boundary cases
  describe('Truncation Boundary Cases', () => {
    it('handles truncation at various lengths correctly', () => {
      [299, 300, 301, 999, 1000, 1001].forEach(length => {
        const content = 'A'.repeat(length);

        ['normal', 'verbose'].forEach(displayMode => {
          const expectedLimit = displayMode === 'verbose' ? 1000 : 300;

          const { unmount } = render(
            <ThoughtDisplay
              thinking={content}
              agent="developer"
              displayMode={displayMode as any}
            />
          );

          if (length > expectedLimit) {
            expect(screen.getByText(/truncated from/)).toBeInTheDocument();
            const truncatedContent = screen.getAllByTestId('text').find(el =>
              el.textContent?.startsWith('A')
            );
            expect(truncatedContent?.textContent?.length).toBe(expectedLimit + 3); // limit + "..."
          } else {
            expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
            expect(screen.getByText(content)).toBeInTheDocument();
          }

          unmount();
        });
      });
    });
  });

  // Test responsive behavior integration
  describe('Responsive Behavior Integration', () => {
    it('functions correctly across different display modes', () => {
      const testContent = 'Test thought content for responsive behavior';

      ['normal', 'verbose'].forEach(displayMode => {
        const { unmount } = render(
          <ThoughtDisplay
            thinking={testContent}
            agent="developer"
            displayMode={displayMode as any}
          />
        );

        // Should render properly in all modes
        expect(screen.getByText(testContent)).toBeInTheDocument();
        expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();

        // Content should have wrap attribute
        const contentText = screen.getAllByTestId('text').find(el =>
          el.textContent === testContent
        );
        expect(contentText).toHaveAttribute('data-wrap', 'wrap');

        unmount();
      });
    });

    it('maintains consistent appearance regardless of content length', () => {
      ['Short', 'Medium length content here', 'Very long content that goes on for quite a while and should be handled consistently'].forEach(content => {
        const { unmount } = render(
          <ThoughtDisplay
            thinking={content}
            agent="developer"
            displayMode="normal"
          />
        );

        // Basic structure should be consistent
        expect(screen.getByText(/💭 developer thinking/)).toBeInTheDocument();

        const textElements = screen.getAllByTestId('text');
        textElements.forEach(element => {
          expect(element).toHaveAttribute('data-color', 'gray');
          expect(element).toHaveAttribute('data-dim', 'true');
        });

        unmount();
      });
    });
  });
});