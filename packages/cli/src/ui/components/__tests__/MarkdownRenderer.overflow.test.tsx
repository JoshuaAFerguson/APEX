import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
    setOptions: vi.fn(),
  },
}));

describe('MarkdownRenderer - Horizontal Overflow Prevention', () => {
  beforeEach(() => {
    // Default mock return value for marked.parse
    const { marked } = require('marked');
    marked.parse.mockImplementation(async (content: string) => {
      // Simple mock that preserves content structure for overflow testing
      return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`(.*?)`/g, '<code>$1</code>');
    });

    // Default terminal dimensions
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal',
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Narrow terminal overflow prevention', () => {
    it('should prevent horizontal overflow in 40-column terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 42, // Minimum after safety margin gives us 40
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const longContent = 'This is a very long line of text that would normally overflow in a narrow terminal but should be contained within the 40-column width limit';

      const { container } = render(
        <MarkdownRenderer content={longContent} />
      );

      // Should enforce minimum width of 40
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '40');

      // Verify content is rendered without crashing
      expect(screen.getByText(/This is a very long/)).toBeInTheDocument();
    });

    it('should handle extremely narrow terminals (< 30 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25, // Very narrow
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const longContent = 'Superlongwordthatwouldnormallyoverflow and regular words that should wrap properly';

      const { container } = render(
        <MarkdownRenderer content={longContent} />
      );

      // Should still enforce minimum width of 40
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '40');

      // Content should be rendered despite width constraints
      expect(screen.getByText(/Superlongwordthatwouldnormallyoverflow/)).toBeInTheDocument();
    });

    it('should handle long code snippets in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const codeContent = 'Here is some `very.long.code.that.might.overflow.in.narrow.terminals.if.not.handled.properly()` that should wrap';

      const { container } = render(
        <MarkdownRenderer content={codeContent} />
      );

      // Should use minimum width of 40
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '40');

      // Code should be rendered
      expect(screen.getByText(/very\.long\.code/)).toBeInTheDocument();
    });

    it('should handle markdown headers in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const headerContent = `# This Is A Very Long Header That Might Overflow In Narrow Terminal Windows
## Another Long Subheader That Should Be Handled Gracefully
### And A Third Level Header For Good Measure`;

      const { container } = render(
        <MarkdownRenderer content={headerContent} />
      );

      // Should use calculated width: Math.max(40, 45 - 2) = 43
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '43');

      // Headers should be rendered
      expect(screen.getByText(/This Is A Very Long Header/)).toBeInTheDocument();
    });
  });

  describe('Medium terminal overflow prevention', () => {
    it('should handle long content in 80-column terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const longContent = 'This is a moderately long line of text that should fit comfortably in an 80-column terminal but we want to ensure it is properly constrained and does not overflow beyond the terminal boundaries';

      const { container } = render(
        <MarkdownRenderer content={longContent} />
      );

      // Should use width - 2 for safety: 80 - 2 = 78
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '78');

      // Content should be rendered
      expect(screen.getByText(/This is a moderately long/)).toBeInTheDocument();
    });

    it('should handle complex markdown with mixed content', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const complexContent = `# Long Header That Should Wrap Nicely

This is a paragraph with **bold text that might be long** and *italic text* and \`inline.code.that.could.be.problematic\`.

- List item one with very long text that should wrap properly
- List item two with more **bold formatting** and details
- List item three with \`more.code.examples.that.are.long\`

> This is a blockquote with very long text that demonstrates how the component handles overflow in blockquotes specifically when they contain extensive content`;

      const { container } = render(
        <MarkdownRenderer content={complexContent} />
      );

      // Should use appropriate width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '78');

      // All content types should be rendered
      expect(screen.getByText(/Long Header That Should Wrap/)).toBeInTheDocument();
      expect(screen.getByText(/bold text that might be long/)).toBeInTheDocument();
      expect(screen.getByText(/List item one with very long/)).toBeInTheDocument();
      expect(screen.getByText(/This is a blockquote/)).toBeInTheDocument();
    });
  });

  describe('Wide terminal behavior', () => {
    it('should handle very wide terminals without overflow', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const wideContent = 'This content is designed for very wide terminals and should take advantage of the available space while still preventing any potential horizontal overflow issues that might occur';

      const { container } = render(
        <MarkdownRenderer content={wideContent} />
      );

      // Should use width - 2 for safety: 200 - 2 = 198
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '198');

      // Content should be rendered
      expect(screen.getByText(/This content is designed/)).toBeInTheDocument();
    });

    it('should handle extremely wide terminals gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 500,
        height: 100,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const content = 'Testing extreme width scenarios to ensure the component handles unusual terminal sizes without issues';

      const { container } = render(
        <MarkdownRenderer content={content} />
      );

      // Should handle extreme widths: 500 - 2 = 498
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '498');

      // Content should be rendered normally
      expect(screen.getByText(/Testing extreme width/)).toBeInTheDocument();
    });
  });

  describe('Edge cases and error conditions', () => {
    it('should handle missing terminal dimensions gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isAvailable: false, // Dimensions not available
      });

      const content = 'Content when terminal dimensions are not available';

      const { container } = render(
        <MarkdownRenderer content={content} />
      );

      // Should use fallback width - 2: 80 - 2 = 78
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '78');

      // Content should be rendered
      expect(screen.getByText(/Content when terminal/)).toBeInTheDocument();
    });

    it('should handle zero or negative terminal widths', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const content = 'Content with invalid terminal width';

      const { container } = render(
        <MarkdownRenderer content={content} />
      );

      // Should enforce minimum width of 40
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '40');

      // Content should be rendered
      expect(screen.getByText(/Content with invalid/)).toBeInTheDocument();
    });

    it('should handle content with no spaces (unbreakable)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const unbreakableContent = 'Thisissuperlongtextwithnospacesorbreakingcharactersthatcouldpotentiallycauseoverflowissuesinnarrowterminals';

      const { container } = render(
        <MarkdownRenderer content={unbreakableContent} />
      );

      // Should still enforce width constraints: Math.max(40, 40 - 2) = 40
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '40');

      // Content should be rendered (terminal will handle the overflow internally)
      expect(screen.getByText(/Thisissuperlongtextwithnospaces/)).toBeInTheDocument();
    });

    it('should handle responsive=false with explicit width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const content = 'Content with responsive disabled and explicit width';

      const { container } = render(
        <MarkdownRenderer content={content} width={60} responsive={false} />
      );

      // Should use explicit width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '60');

      // Content should be rendered
      expect(screen.getByText(/Content with responsive/)).toBeInTheDocument();
    });
  });

  describe('SimpleMarkdownRenderer overflow prevention', () => {
    it('should prevent overflow in lists with long content', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const listContent = `- This is a very long list item that might overflow in smaller terminals if not handled properly by the responsive width system
- Another item with **bold text** and additional content that should wrap
- Third item with \`long.code.snippets.that.could.cause.overflow\``;

      const { container } = render(
        <SimpleMarkdownRenderer content={listContent} />
      );

      // Should use width - 2: 60 - 2 = 58
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '58');

      // All list items should be rendered
      expect(screen.getByText(/This is a very long list/)).toBeInTheDocument();
      expect(screen.getByText(/Another item with/)).toBeInTheDocument();
      expect(screen.getByText(/Third item with/)).toBeInTheDocument();
    });

    it('should handle blockquotes with overflow protection', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const blockquoteContent = '> This is a very long blockquote that should demonstrate how the component handles text that might overflow in narrow terminal environments and ensures it stays within bounds';

      const { container } = render(
        <SimpleMarkdownRenderer content={blockquoteContent} />
      );

      // Should use minimum width: Math.max(40, 50 - 2) = 48
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '48');

      // Blockquote should be rendered
      expect(screen.getByText(/This is a very long blockquote/)).toBeInTheDocument();
    });

    it('should handle numbered lists with overflow protection', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const numberedContent = `1. First numbered item with lots of text that could potentially overflow if not handled properly by the responsive width system
2. Second item with more content and **formatting**
10. Tenth item to test double-digit numbering with long content`;

      const { container } = render(
        <SimpleMarkdownRenderer content={numberedContent} />
      );

      // Should use calculated width: Math.max(40, 45 - 2) = 43
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '43');

      // Numbered items should be rendered
      expect(screen.getByText(/First numbered item/)).toBeInTheDocument();
      expect(screen.getByText(/Second item with more/)).toBeInTheDocument();
      expect(screen.getByText(/Tenth item to test/)).toBeInTheDocument();
    });
  });

  describe('Performance under overflow conditions', () => {
    it('should render large content efficiently with overflow protection', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      // Generate large content that would overflow
      const largeContent = Array.from({ length: 50 }, (_, i) =>
        `## Section ${i} with very long header text that might overflow\n\nParagraph ${i} with extensive content that should be properly wrapped and contained within the terminal width limits to prevent horizontal scrolling.`
      ).join('\n\n');

      const start = performance.now();
      const { container } = render(
        <MarkdownRenderer content={largeContent} />
      );
      const end = performance.now();

      // Should render efficiently (< 200ms for large content)
      expect(end - start).toBeLessThan(200);

      // Should enforce minimum width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '40');

      // First section should be rendered
      expect(screen.getByText(/Section 0 with very long/)).toBeInTheDocument();
    });

    it('should handle many lines of content without performance degradation', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 30,
        breakpoint: 'compact',
        isAvailable: true,
      });

      // Generate content with many lines that could cause overflow
      const manyLines = Array.from({ length: 100 }, (_, i) =>
        `Line ${i}: This is line content that could potentially overflow if the terminal is too narrow but should be handled gracefully by the responsive width system`
      ).join('\n');

      const start = performance.now();
      render(<SimpleMarkdownRenderer content={manyLines} />);
      const end = performance.now();

      // Should handle many lines efficiently (< 150ms)
      expect(end - start).toBeLessThan(150);

      // Should find the first line
      expect(screen.getByText(/Line 0: This is line/)).toBeInTheDocument();
    });
  });
});