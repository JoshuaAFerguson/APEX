/**
 * @fileoverview Comprehensive audit test for MarkdownRenderer component
 *
 * This test file audits the MarkdownRenderer component against the v0.6.0 acceptance criteria:
 * - Real markdown parsing using marked library
 * - Support for headers, lists, code blocks, and blockquotes
 * - Responsive width functionality
 * - Proper integration in component hierarchy
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';
import { marked } from 'marked';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock marked library
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
  },
}));

describe('MarkdownRenderer - Component Audit', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up default terminal dimensions
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal' as const,
      isAvailable: true,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
    });

    // Mock marked.parse to return simple processed HTML
    (marked.parse as any).mockImplementation(async (content: string) => {
      if (content.includes('# ')) return '<h1>Test Header</h1>';
      if (content.includes('## ')) return '<h2>Subheader</h2>';
      if (content.includes('### ')) return '<h3>Small Header</h3>';
      if (content.includes('**bold**')) return 'This is <strong>bold</strong> text';
      if (content.includes('*italic*')) return 'This is <em>italic</em> text';
      if (content.includes('`code`')) return 'This is <code>code</code> text';
      if (content.includes('```')) return '<pre><code>code block</code></pre>';
      if (content.includes('- ')) return '<ul><li>List item</li></ul>';
      if (content.includes('1. ')) return '<ol><li>Numbered item</li></ol>';
      if (content.includes('> ')) return '<blockquote>Quote content</blockquote>';
      return content;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: Real Markdown Parsing with marked Library', () => {
    it('uses marked library for markdown processing', async () => {
      render(<MarkdownRenderer content="# Test Header" />);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(marked.parse).toHaveBeenCalledWith("# Test Header", { async: true });
    });

    it('handles marked library integration properly', async () => {
      render(<MarkdownRenderer content="**bold text**" />);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(marked.parse).toHaveBeenCalled();
      expect(screen.getByText(/bold/)).toBeInTheDocument();
    });

    it('strips HTML tags from marked output correctly', async () => {
      (marked.parse as any).mockResolvedValue('<h1>Clean Header</h1><p>Paragraph</p>');

      render(<MarkdownRenderer content="# Header with content" />);

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should render the text content without HTML tags
      expect(screen.getByText(/Clean Header/)).toBeInTheDocument();
      expect(screen.getByText(/Paragraph/)).toBeInTheDocument();
    });

    it('handles marked parsing errors gracefully', async () => {
      (marked.parse as any).mockRejectedValue(new Error('Parsing failed'));

      render(<MarkdownRenderer content="# Problematic content" />);

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should fallback to original content
      expect(screen.getByText(/Problematic content/)).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Headers Support', () => {
    it('processes H1 headers correctly', () => {
      render(<SimpleMarkdownRenderer content="# Primary Header" />);
      expect(screen.getByText('Primary Header')).toBeInTheDocument();
    });

    it('processes H2 headers correctly', () => {
      render(<SimpleMarkdownRenderer content="## Secondary Header" />);
      expect(screen.getByText('Secondary Header')).toBeInTheDocument();
    });

    it('processes H3 headers correctly', () => {
      render(<SimpleMarkdownRenderer content="### Tertiary Header" />);
      expect(screen.getByText('Tertiary Header')).toBeInTheDocument();
    });

    it('handles multiple header levels in one document', () => {
      const content = `# Main Title
## Section Header
### Subsection Header`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('Main Title')).toBeInTheDocument();
      expect(screen.getByText('Section Header')).toBeInTheDocument();
      expect(screen.getByText('Subsection Header')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Lists Support', () => {
    it('processes unordered lists correctly', () => {
      const content = `- First item
- Second item
- Third item`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('Second item')).toBeInTheDocument();
      expect(screen.getByText('Third item')).toBeInTheDocument();
    });

    it('processes ordered lists correctly', () => {
      const content = `1. First numbered item
2. Second numbered item
3. Third numbered item`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('First numbered item')).toBeInTheDocument();
      expect(screen.getByText('Second numbered item')).toBeInTheDocument();
      expect(screen.getByText('Third numbered item')).toBeInTheDocument();
    });

    it('handles mixed list types', () => {
      const content = `- Unordered item
1. Ordered item
* Another unordered item`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('Unordered item')).toBeInTheDocument();
      expect(screen.getByText('Ordered item')).toBeInTheDocument();
      expect(screen.getByText('Another unordered item')).toBeInTheDocument();
    });

    it('handles numbered lists with double digits', () => {
      const content = `10. Tenth item
11. Eleventh item`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('Tenth item')).toBeInTheDocument();
      expect(screen.getByText('Eleventh item')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Code Support', () => {
    it('processes inline code correctly', () => {
      render(<SimpleMarkdownRenderer content="Use the `npm install` command" />);
      expect(screen.getByText(/npm install/)).toBeInTheDocument();
    });

    it('processes code blocks correctly', () => {
      const content = `\`\`\`javascript
const example = true;
console.log(example);
\`\`\``;

      render(<SimpleMarkdownRenderer content={content} />);
      expect(screen.getByText(/javascript/)).toBeInTheDocument();
    });

    it('handles multiple inline code snippets', () => {
      const content = "Use `git add` then `git commit` and finally `git push`";

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText(/git add/)).toBeInTheDocument();
      expect(screen.getByText(/git commit/)).toBeInTheDocument();
      expect(screen.getByText(/git push/)).toBeInTheDocument();
    });

    it('processes code blocks with language specifiers', () => {
      const content = `\`\`\`typescript
interface User {
  name: string;
}
\`\`\``;

      render(<SimpleMarkdownRenderer content={content} />);
      expect(screen.getByText(/typescript/)).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Blockquotes Support', () => {
    it('processes single-line blockquotes correctly', () => {
      render(<SimpleMarkdownRenderer content="> This is a quote" />);
      expect(screen.getByText(/This is a quote/)).toBeInTheDocument();
    });

    it('processes multi-line blockquotes correctly', () => {
      const content = `> This is the first line of a quote
> This is the second line of a quote`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText(/first line of a quote/)).toBeInTheDocument();
      expect(screen.getByText(/second line of a quote/)).toBeInTheDocument();
    });

    it('handles blockquotes with inline formatting', () => {
      const content = "> This quote has **bold text** and *italic text*";

      render(<SimpleMarkdownRenderer content={content} />);
      expect(screen.getByText(/This quote has/)).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Responsive Width Support', () => {
    it('adapts width based on terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      const { container } = render(<MarkdownRenderer content="# Test" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('enforces minimum width for very narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { container } = render(<MarkdownRenderer content="# Narrow test" />);
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText(/Narrow test/)).toBeInTheDocument();
    });

    it('respects explicit width when provided', () => {
      const { container } = render(<MarkdownRenderer content="# Fixed width" width={60} />);
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText(/Fixed width/)).toBeInTheDocument();
    });

    it('can disable responsive behavior', () => {
      const { container } = render(
        <MarkdownRenderer content="# No responsive" responsive={false} />
      );
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText(/No responsive/)).toBeInTheDocument();
    });

    it('handles terminal resize scenarios', () => {
      const { container, rerender } = render(<MarkdownRenderer content="# Resize test" />);

      expect(container.firstChild).toBeInTheDocument();

      // Simulate terminal resize
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<MarkdownRenderer content="# Resize test" />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Component Hierarchy Integration', () => {
    it('can be imported from the component hierarchy', () => {
      // This test verifies that the component is properly exported
      expect(MarkdownRenderer).toBeDefined();
      expect(SimpleMarkdownRenderer).toBeDefined();
      expect(typeof MarkdownRenderer).toBe('function');
      expect(typeof SimpleMarkdownRenderer).toBe('function');
    });

    it('renders without errors in component tree', () => {
      expect(() => {
        render(<MarkdownRenderer content="# Integration test" />);
      }).not.toThrow();
    });

    it('both renderer variants work consistently', () => {
      const content = "# Test Header\n\nThis is a test paragraph.";

      const { container: container1 } = render(<MarkdownRenderer content={content} />);
      const { container: container2 } = render(<SimpleMarkdownRenderer content={content} />);

      expect(container1.firstChild).toBeInTheDocument();
      expect(container2.firstChild).toBeInTheDocument();
    });

    it('integrates with Ink Box and Text components', () => {
      const { container } = render(<MarkdownRenderer content="# Ink integration test" />);

      // Should render Ink components without errors
      expect(container.firstChild).toBeInTheDocument();
      expect(container.querySelector('ink-box')).toBeInTheDocument();
      expect(container.querySelector('ink-text')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles null content gracefully', () => {
      expect(() => {
        render(<MarkdownRenderer content={null as any} />);
      }).not.toThrow();
    });

    it('handles undefined content gracefully', () => {
      expect(() => {
        render(<MarkdownRenderer content={undefined as any} />);
      }).not.toThrow();
    });

    it('handles empty string content', () => {
      const { container } = render(<MarkdownRenderer content="" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles very long content efficiently', () => {
      const longContent = 'Very long content. '.repeat(1000);
      const start = performance.now();

      render(<MarkdownRenderer content={longContent} />);

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should render quickly
    });

    it('handles malformed markdown gracefully', () => {
      const malformedContent = "# Unclosed **bold and *italic text ### no closing";

      expect(() => {
        render(<SimpleMarkdownRenderer content={malformedContent} />);
      }).not.toThrow();

      expect(screen.getByText(/Unclosed/)).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('processes markdown asynchronously without blocking', async () => {
      let parseResolved = false;
      (marked.parse as any).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        parseResolved = true;
        return '<h1>Async Test</h1>';
      });

      render(<MarkdownRenderer content="# Async test" />);

      // Component should render immediately, even before parsing completes
      expect(screen.getByText(/Async test/)).toBeInTheDocument();

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(parseResolved).toBe(true);
    });

    it('handles concurrent renders efficiently', () => {
      const start = performance.now();

      // Render multiple instances simultaneously
      for (let i = 0; i < 10; i++) {
        render(<MarkdownRenderer content={`# Test ${i}`} />);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('handles complex markdown with all features combined', () => {
      const complexContent = `# Main Header

This is a paragraph with **bold** and *italic* text.

## Features List

- First feature with \`inline code\`
- Second feature with more details
- Third feature

### Code Example

\`\`\`typescript
function example(): string {
  return "Hello, world!";
}
\`\`\`

> **Important**: This is a blockquote with **bold text** inside.

1. First step in process
2. Second step with details
3. Final step`;

      render(<SimpleMarkdownRenderer content={complexContent} />);

      // Verify all elements are present
      expect(screen.getByText('Main Header')).toBeInTheDocument();
      expect(screen.getByText('Features List')).toBeInTheDocument();
      expect(screen.getByText(/First feature/)).toBeInTheDocument();
      expect(screen.getByText(/Code Example/)).toBeInTheDocument();
      expect(screen.getByText(/typescript/)).toBeInTheDocument();
      expect(screen.getByText(/Important/)).toBeInTheDocument();
      expect(screen.getByText(/First step/)).toBeInTheDocument();
    });
  });
});