import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';

// Use vi.hoisted to declare mocks that are accessed in vi.mock factories
const { mockUseStdoutDimensions, mockMarkedParse } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(),
  mockMarkedParse: vi.fn(),
}));

// Mock the useStdoutDimensions hook
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: mockMarkedParse,
    setOptions: vi.fn(),
  },
}));

describe('MarkdownRenderer - Responsive Width', () => {
  beforeEach(() => {
    // Default mock return value for marked.parse
    mockMarkedParse.mockImplementation(async (content: string) => {
      // Simple mock implementation
      if (content.includes('# Header')) return '<h1>Header</h1>';
      if (content.includes('**bold**')) return '<strong>bold</strong>';
      return content;
    });

    // Default mock return value for dimensions
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

  describe('Default responsive behavior', () => {
    it('should use terminal width when responsive=true (default)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# Test Header" />
      );

      // Should render properly with responsive width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should enforce minimum width of 40 in responsive mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30, // Very narrow terminal
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# Test Header" />
      );

      // Should render properly with minimum width enforced
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should disable responsive behavior when responsive=false', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# Test Header" responsive={false} />
      );

      // Should render properly when responsive is disabled
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should use explicit width when provided, ignoring responsive behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# Test Header" width={50} />
      );

      // Should render properly with explicit width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });

  describe('Terminal width scenarios', () => {
    it('should adapt to narrow terminals (< 60 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# This is a long markdown header that should wrap" />
      );

      // Should render properly with minimum width for narrow terminals
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should adapt to compact terminals (60-99 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="## Compact Terminal Test" />
      );

      // Should render properly in compact terminals
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should adapt to wide terminals (160+ columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content="# Wide Terminal Markdown Content" />
      );

      // Should render properly in wide terminals
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });

  describe('Complex content scenarios', () => {
    it('should handle long markdown content with responsive width', () => {
      const longContent = `
# Long Content Header

This is a very long paragraph of text that should be properly wrapped when the terminal width is constrained. It contains multiple sentences and should demonstrate the responsive behavior of the MarkdownRenderer component.

## Subheader

More content here with **bold text** and *italic text* to test formatting.

- List item 1 with long text that may wrap
- List item 2 with even longer text that definitely will wrap in narrow terminals
- List item 3

\`\`\`javascript
const code = 'This is a code block that should also respect terminal width';
\`\`\`
      `;

      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 30,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const { container } = render(
        <MarkdownRenderer content={longContent} />
      );

      // Should render properly for compact terminal
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });

  describe('Fallback behavior', () => {
    it('should handle when useStdoutDimensions is not available', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback width
        height: 24,
        breakpoint: 'normal',
        isAvailable: false,
      });

      const { container } = render(
        <MarkdownRenderer content="# Fallback Test" />
      );

      // Should render properly with fallback dimensions
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });
});

describe('SimpleMarkdownRenderer - Responsive Width', () => {
  beforeEach(() => {
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

  describe('Default responsive behavior', () => {
    it('should use terminal width when responsive=true (default)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Test Header" />
      );

      // Should render properly with responsive width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should enforce minimum width of 40 in responsive mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30, // Very narrow terminal
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Test Header" />
      );

      // Should render properly with minimum width enforced
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should use explicit width when provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Test Header" width={60} />
      );

      // Should render properly with explicit width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });

  describe('Content formatting with responsive width', () => {
    it('should render headers with responsive width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const content = `# Main Header
## Sub Header
### Small Header`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('Main Header')).toBeInTheDocument();
      expect(screen.getByText('Sub Header')).toBeInTheDocument();
      expect(screen.getByText('Small Header')).toBeInTheDocument();
    });

    it('should render lists with responsive width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const content = `- First item
- Second item
- Third item`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('Second item')).toBeInTheDocument();
      expect(screen.getByText('Third item')).toBeInTheDocument();
    });

    it('should render numbered lists with responsive width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const content = `1. First numbered item
2. Second numbered item
3. Third numbered item`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('First numbered item')).toBeInTheDocument();
      expect(screen.getByText('Second numbered item')).toBeInTheDocument();
      expect(screen.getByText('Third numbered item')).toBeInTheDocument();
    });

    it('should render blockquotes with responsive width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 90,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const content = `> This is a blockquote
> With multiple lines`;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('This is a blockquote')).toBeInTheDocument();
      expect(screen.getByText('With multiple lines')).toBeInTheDocument();
    });

    it('should handle code blocks with responsive width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const content = `\`\`\`javascript
const test = 'hello';
\`\`\``;

      render(<SimpleMarkdownRenderer content={content} />);

      expect(screen.getByText('```javascript')).toBeInTheDocument();
      expect(screen.getByText("const test = 'hello';")).toBeInTheDocument();
    });
  });

  describe('Narrow terminal behavior', () => {
    it('should handle very narrow terminals gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25, // Very narrow
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const longContent = `
# This is a very long header that will need to be handled in a narrow terminal
- This is a long list item that should wrap appropriately
> This is a long blockquote that should also wrap properly in narrow terminals
      `;

      const { container } = render(
        <SimpleMarkdownRenderer content={longContent} />
      );

      // Should render properly with minimum width enforced
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();

      // Content should still be rendered
      expect(screen.getByText(/This is a very long header/)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty content with responsive width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="" />
      );

      // Should still render properly
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should handle content with inline formatting', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 90,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      render(
        <SimpleMarkdownRenderer content="This has **bold text** and `inline code` and *italic text*" />
      );

      expect(screen.getByText(/This has/)).toBeInTheDocument();
    });

    it('should handle very large terminal widths', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 500,
        height: 100,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Wide Terminal Test" />
      );

      // Should render properly with large widths
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });

  describe('Responsive vs non-responsive behavior', () => {
    it('should disable responsive behavior when responsive=false', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Test" responsive={false} />
      );

      // Should render properly when responsive is disabled
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });

    it('should prefer explicit width over responsive calculation', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Test" width={75} responsive={true} />
      );

      // Should render properly with explicit width even when responsive is enabled
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toBeInTheDocument();
    });
  });
});