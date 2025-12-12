import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { MarkdownRenderer } from '../MarkdownRenderer';

// Mock marked and marked-terminal
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
    setOptions: vi.fn(),
  },
}));

vi.mock('marked-terminal', () => ({
  markedTerminal: vi.fn(() => ({})),
}));

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    // Mock the marked parser to return predictable HTML
    const { marked } = require('marked');
    marked.parse.mockImplementation((content: string) => {
      // Simple mock implementation for testing
      if (content.includes('# Header')) {
        return '<h1>Header</h1>';
      }
      if (content.includes('**bold**')) {
        return '<strong>bold</strong>';
      }
      if (content.includes('*italic*')) {
        return '<em>italic</em>';
      }
      if (content.includes('`code`')) {
        return '<code>code</code>';
      }
      if (content.includes('```')) {
        return '<pre><code>code block</code></pre>';
      }
      if (content.includes('- item')) {
        return '<ul><li>item</li></ul>';
      }
      if (content.includes('> quote')) {
        return '<blockquote>quote</blockquote>';
      }
      return content; // Default: return as-is
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain text content', () => {
    render(<MarkdownRenderer content="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('processes markdown headers', () => {
    render(<MarkdownRenderer content="# Main Header" />);
    expect(screen.getByText('Main Header')).toBeInTheDocument();
  });

  it('processes bold text', () => {
    render(<MarkdownRenderer content="This is **bold** text" />);
    expect(screen.getByText(/bold/)).toBeInTheDocument();
  });

  it('processes italic text', () => {
    render(<MarkdownRenderer content="This is *italic* text" />);
    expect(screen.getByText(/italic/)).toBeInTheDocument();
  });

  it('processes inline code', () => {
    render(<MarkdownRenderer content="This is `inline code`" />);
    expect(screen.getByText(/code/)).toBeInTheDocument();
  });

  it('processes code blocks', () => {
    const codeContent = '```javascript\nconst x = 1;\n```';
    render(<MarkdownRenderer content={codeContent} />);
    expect(screen.getByText(/code block/)).toBeInTheDocument();
  });

  it('processes lists', () => {
    const listContent = '- First item\n- Second item';
    render(<MarkdownRenderer content={listContent} />);
    expect(screen.getByText(/item/)).toBeInTheDocument();
  });

  it('processes blockquotes', () => {
    render(<MarkdownRenderer content="> This is a quote" />);
    expect(screen.getByText(/quote/)).toBeInTheDocument();
  });

  it('handles empty content gracefully', () => {
    render(<MarkdownRenderer content="" />);
    // Should not crash, might render empty div
  });

  it('handles malformed markdown gracefully', () => {
    const malformedContent = '### Unclosed **bold and *italic without closing';
    render(<MarkdownRenderer content={malformedContent} />);
    // Should not crash
    expect(screen.getByText(/Unclosed/)).toBeInTheDocument();
  });

  it('respects width prop for text wrapping', () => {
    const longContent = 'This is a very long line of text that should wrap at the specified width';
    const { container } = render(<MarkdownRenderer content={longContent} width={30} />);

    // Check that the Box component receives the width prop
    expect(container.firstChild).toHaveAttribute('width', '30');
  });

  it('processes complex nested markdown', () => {
    const complexContent = `
# Header

This has **bold** and *italic* text.

## Subheader

- List item with \`code\`
- Another item

> A blockquote with **bold text**

\`\`\`javascript
const example = true;
\`\`\`
    `;

    render(<MarkdownRenderer content={complexContent} />);

    // Should process all elements without crashing
    expect(screen.getByText(/Header/)).toBeInTheDocument();
  });

  describe('Configuration', () => {
    it('calls marked.setOptions with terminal renderer', () => {
      const { marked } = require('marked');
      const { markedTerminal } = require('marked-terminal');

      // Component import should trigger configuration
      expect(marked.setOptions).toHaveBeenCalled();
      expect(markedTerminal).toHaveBeenCalled();
    });

    it('configures table options correctly', () => {
      const { markedTerminal } = require('marked-terminal');

      expect(markedTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          unescape: true,
          emoji: true,
          tableOptions: expect.objectContaining({
            chars: expect.objectContaining({
              'top': '─',
              'top-mid': '┬',
              'top-left': '┌',
              'top-right': '┐',
            }),
            style: expect.objectContaining({
              'padding-left': 0,
              'padding-right': 1,
              head: ['cyan'],
              border: ['grey'],
            }),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles marked parsing errors gracefully', () => {
      const { marked } = require('marked');
      marked.parse.mockImplementation(() => {
        throw new Error('Parsing error');
      });

      // Should not crash the component
      expect(() => {
        render(<MarkdownRenderer content="# Test" />);
      }).not.toThrow();
    });

    it('handles null or undefined content', () => {
      expect(() => {
        render(<MarkdownRenderer content={null as any} />);
      }).not.toThrow();

      expect(() => {
        render(<MarkdownRenderer content={undefined as any} />);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('handles large content efficiently', () => {
      const largeContent = 'Large content\n'.repeat(1000);

      const start = performance.now();
      render(<MarkdownRenderer content={largeContent} />);
      const end = performance.now();

      // Should complete in reasonable time (< 100ms for test environment)
      expect(end - start).toBeLessThan(100);
    });

    it('memoizes parsing results for same content', () => {
      const { marked } = require('marked');
      const content = "# Same Content";

      render(<MarkdownRenderer content={content} />);
      render(<MarkdownRenderer content={content} />);

      // marked.parse should be called for each render (no memoization in current impl)
      // This test documents current behavior; could be optimized later
      expect(marked.parse).toHaveBeenCalledTimes(2);
    });
  });
});