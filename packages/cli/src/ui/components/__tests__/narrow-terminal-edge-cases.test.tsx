import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse } from '../StreamingText';
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

describe('Narrow Terminal Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock marked.parse
    const { marked } = require('marked');
    marked.parse.mockImplementation((content: string) => content);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Extreme narrow terminal scenarios', () => {
    it('should handle terminal width of 1 character', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 1,
        height: 10,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container } = render(
        <StreamingText text="Test" isComplete={true} />
      );

      // Should enforce minimum width of 40 even for impossible terminal sizes
      expect(container.firstChild).toHaveAttribute('width', '40');
    });

    it('should handle zero terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 10,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# Test Header" />
      );

      // Should enforce minimum width of 40
      expect(container.firstChild).toHaveAttribute('width', '40');
    });

    it('should handle negative terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: -5,
        height: 10,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="Test content" />
      );

      // Should enforce minimum width of 40
      expect(container.firstChild).toHaveAttribute('width', '40');
    });
  });

  describe('Narrow terminal content handling', () => {
    it('should handle very long single words in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const longWord = 'supercalifragilisticexpialidocious';

      render(
        <StreamingText text={longWord} isComplete={true} />
      );

      // Should render the word (wrapping behavior depends on implementation)
      expect(screen.getByText(longWord)).toBeInTheDocument();
    });

    it('should handle URLs and file paths in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const content = 'Visit https://github.com/JoshuaAFerguson/apex/packages/cli/src/ui/components/MarkdownRenderer.tsx for more info';

      render(
        <MarkdownRenderer content={content} />
      );

      // Should handle long URLs gracefully
      expect(screen.getByText(/Visit https:\/\/github/)).toBeInTheDocument();
    });

    it('should handle code snippets in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const codeSnippet = `
\`\`\`javascript
const veryLongVariableNameThatExceedsTerminalWidth = 'This is a very long string literal';
function anotherVeryLongFunctionNameThatIsQuiteLong() {
  return 'some result';
}
\`\`\`
      `;

      render(
        <SimpleMarkdownRenderer content={codeSnippet} />
      );

      // Should render code block content
      expect(screen.getByText(/const veryLongVariableNameThatExceedsTerminalWidth/)).toBeInTheDocument();
    });

    it('should handle tables and structured content in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 25,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const tableContent = `
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Very long data entry | Another long entry | Even longer data entry |
| Short | Med | Extremely long data that will overflow |
      `;

      render(
        <MarkdownRenderer content={tableContent} />
      );

      // Should handle table content (specific rendering depends on markdown processor)
      expect(screen.getByText(/Column 1/)).toBeInTheDocument();
    });
  });

  describe('Multiple component interaction in narrow terminals', () => {
    it('should handle StreamingResponse with long agent names in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="Short response"
          agent="very-long-agent-name-that-exceeds-narrow-terminal-width"
          isComplete={true}
        />
      );

      // Should render agent name and content
      expect(screen.getByText(/very-long-agent-name/)).toBeInTheDocument();
      expect(screen.getByText('Short response')).toBeInTheDocument();
    });

    it('should handle nested markdown lists in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 25,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const nestedList = `
# Main Header That Is Longer Than Terminal Width

- First level item with text that is longer than the terminal width can accommodate
  - Nested item with even more text that definitely exceeds narrow terminal limitations
    - Deeply nested item with extremely long text that tests the limits of narrow terminal rendering
- Second first-level item
- Third item with `inline code that is also very long`
      `;

      render(
        <SimpleMarkdownRenderer content={nestedList} />
      );

      // Should render list structure
      expect(screen.getByText(/Main Header/)).toBeInTheDocument();
      expect(screen.getByText(/First level item/)).toBeInTheDocument();
    });

    it('should handle blockquotes with long content in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const longQuote = `
> This is an extremely long blockquote that contains multiple sentences and should test how the component handles text wrapping and formatting in very narrow terminal environments where space is severely limited.

> Another blockquote with different content to test multiple quote handling.
      `;

      render(
        <SimpleMarkdownRenderer content={longQuote} />
      );

      // Should render blockquote content
      expect(screen.getByText(/This is an extremely long/)).toBeInTheDocument();
      expect(screen.getByText(/Another blockquote/)).toBeInTheDocument();
    });
  });

  describe('Performance in narrow terminals', () => {
    it('should handle rapid terminal size changes efficiently', () => {
      const content = 'Test content for performance testing';

      // Start with narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { rerender } = render(
        <StreamingText text={content} isComplete={true} />
      );

      const startTime = performance.now();

      // Simulate rapid size changes
      for (let i = 20; i <= 150; i += 10) {
        mockUseStdoutDimensions.mockReturnValue({
          width: i,
          height: 20,
          breakpoint: i < 60 ? 'narrow' : i < 100 ? 'compact' : 'normal',
          isAvailable: true,
        });

        rerender(<StreamingText text={content} isComplete={true} />);
      }

      const endTime = performance.now();

      // Should complete in reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(100);

      // Content should still be rendered correctly
      expect(screen.getByText(content)).toBeInTheDocument();
    });

    it('should handle large content volumes in narrow terminals efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      // Generate large content
      const largeContent = 'Line with moderate length that will wrap in narrow terminals.\n'.repeat(100);

      const startTime = performance.now();

      render(
        <MarkdownRenderer content={largeContent} />
      );

      const endTime = performance.now();

      // Should handle large content efficiently
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('Accessibility and usability in narrow terminals', () => {
    it('should maintain readability of essential information in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 15,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="Error: File not found"
          agent="system"
          isComplete={true}
        />
      );

      // Essential information should be readable
      expect(screen.getByText('Error: File not found')).toBeInTheDocument();
      expect(screen.getByText('system')).toBeInTheDocument();
      expect(screen.getByText('✓ Complete')).toBeInTheDocument();
    });

    it('should handle mixed content types consistently in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 25,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const mixedContent = `
# Important Notice

Please review the following:

- Configuration file: /very/long/path/to/config/file.yaml
- Error message: "Connection timeout after 30 seconds"
- Recommended action: Restart the service

\`\`\`bash
sudo systemctl restart very-long-service-name
\`\`\`

> Note: This may take several minutes to complete.
      `;

      render(
        <SimpleMarkdownRenderer content={mixedContent} />
      );

      // All content types should be handled
      expect(screen.getByText(/Important Notice/)).toBeInTheDocument();
      expect(screen.getByText(/Configuration file/)).toBeInTheDocument();
      expect(screen.getByText(/sudo systemctl/)).toBeInTheDocument();
      expect(screen.getByText(/Note: This may take/)).toBeInTheDocument();
    });
  });

  describe('Edge case combinations', () => {
    it('should handle minimum width with maximum content length', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Forces minimum width of 40
        height: 5,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const maxContent = 'A'.repeat(1000); // Very long content

      const { container } = render(
        <StreamingText text={maxContent} isComplete={true} />
      );

      // Should enforce minimum width
      expect(container.firstChild).toHaveAttribute('width', '40');

      // Should render content without crashing
      expect(screen.getByText(/A+/)).toBeInTheDocument();
    });

    it('should handle explicit width smaller than minimum in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20,
        height: 10,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      // Explicit width smaller than minimum responsive width
      const { container } = render(
        <StreamingText text="Test" width={20} isComplete={true} />
      );

      // Should use explicit width even if it's smaller than minimum responsive width
      expect(container.firstChild).toHaveAttribute('width', '20');
    });

    it('should handle responsive=false with narrow terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 15,
        height: 8,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container: streamingContainer } = render(
        <StreamingText text="Test" responsive={false} isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="Test" responsive={false} />
      );

      // StreamingText should not have width when responsive=false
      expect(streamingContainer.firstChild).not.toHaveAttribute('width');

      // MarkdownRenderer should use default width of 80
      expect(markdownContainer.firstChild).toHaveAttribute('width', '80');
    });
  });
});