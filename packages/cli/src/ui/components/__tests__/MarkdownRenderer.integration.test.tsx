import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
    setOptions: vi.fn(),
  },
}));

// Replace the existing mock with our own
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('MarkdownRenderer - Integration with useStdoutDimensions', () => {
  beforeEach(() => {
    // Mock marked.parse to return simple processed content
    const { marked } = require('marked');
    marked.parse.mockImplementation(async (content: string) => {
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook integration and responsive behavior', () => {
    it('should call useStdoutDimensions hook and use returned width', () => {
      const mockDimensions = {
        width: 100,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      };

      mockUseStdoutDimensions.mockReturnValue(mockDimensions);

      const { container } = render(
        <MarkdownRenderer content="# Test Content" />
      );

      // Verify hook was called
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // Verify component uses hook's width value (minus safety margin)
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '98'); // 100 - 2
    });

    it('should react to terminal width changes', () => {
      // Start with one width
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const { container, rerender } = render(
        <MarkdownRenderer content="# Test Content" />
      );

      // Verify initial width
      let boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '78'); // 80 - 2

      // Change terminal width
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      // Re-render with new dimensions
      rerender(<MarkdownRenderer content="# Test Content" />);

      // Verify updated width
      boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '118'); // 120 - 2
    });

    it('should respect different breakpoint behaviors', () => {
      // Test narrow breakpoint
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow' as const,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { container, rerender } = render(
        <MarkdownRenderer content="# Narrow Terminal" />
      );

      let boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '48'); // 50 - 2

      // Test wide breakpoint
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<MarkdownRenderer content="# Wide Terminal" />);

      boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '178'); // 180 - 2
    });

    it('should handle isAvailable: false from hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback width
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: false, // Dimensions not actually available
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const { container } = render(
        <MarkdownRenderer content="# Fallback Test" />
      );

      // Should still use the fallback width from hook
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '78'); // 80 - 2

      // Content should render
      expect(screen.getByText(/Fallback Test/)).toBeInTheDocument();
    });
  });

  describe('Real-world terminal scenarios', () => {
    it('should handle standard terminal sizes correctly', () => {
      const standardSizes = [
        { width: 80, height: 24, expected: 78 },   // Classic terminal
        { width: 120, height: 30, expected: 118 }, // Modern wide terminal
        { width: 160, height: 50, expected: 158 }, // Ultra-wide terminal
        { width: 24, height: 80, expected: 40 },   // Rotated/narrow terminal (min width)
      ];

      standardSizes.forEach(({ width, height, expected }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
          isAvailable: true,
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width < 160,
          isWide: width >= 160,
        });

        const { container } = render(
          <MarkdownRenderer
            key={index}
            content={`# Terminal ${width}x${height}`}
          />
        );

        const boxElement = container.firstChild as HTMLElement;
        expect(boxElement).toHaveAttribute('width', expected.toString());
      });
    });

    it('should handle terminal resize scenarios', () => {
      // Simulate a terminal resize from narrow to wide
      const resizeSequence = [
        { width: 40, expected: 40 },   // Very narrow (min width enforced)
        { width: 60, expected: 58 },   // Compact
        { width: 100, expected: 98 },  // Normal
        { width: 200, expected: 198 }, // Wide
      ];

      const content = "# Resize Test Content";

      resizeSequence.forEach((step, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width: step.width,
          height: 24,
          breakpoint: step.width < 60 ? 'narrow' : step.width < 100 ? 'compact' : step.width < 160 ? 'normal' : 'wide',
          isAvailable: true,
          isNarrow: step.width < 60,
          isCompact: step.width >= 60 && step.width < 100,
          isNormal: step.width >= 100 && step.width < 160,
          isWide: step.width >= 160,
        });

        const { container } = render(
          <MarkdownRenderer
            key={index}
            content={content}
          />
        );

        const boxElement = container.firstChild as HTMLElement;
        expect(boxElement).toHaveAttribute('width', step.expected.toString());
      });
    });
  });

  describe('SimpleMarkdownRenderer integration', () => {
    it('should integrate with useStdoutDimensions the same way', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 90,
        height: 25,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const { container } = render(
        <SimpleMarkdownRenderer content="# Simple Test" />
      );

      // Should call the hook
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // Should use same calculation as MarkdownRenderer
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '88'); // 90 - 2
    });

    it('should handle complex markdown with proper width constraints', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 30,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const complexMarkdown = `# Integration Test Header

This is a paragraph with **bold** and *italic* text.

## Lists Section

- Item one with some detail
- Item two with more **formatting**
- Item three with \`inline code\`

### Code Example

\`\`\`javascript
function example() {
  return "Hello World";
}
\`\`\`

> Important note about the implementation
> that spans multiple lines

1. Numbered list item
2. Second numbered item
3. Third item for completeness`;

      const { container } = render(
        <SimpleMarkdownRenderer content={complexMarkdown} />
      );

      // Should use calculated width
      const boxElement = container.firstChild as HTMLElement;
      expect(boxElement).toHaveAttribute('width', '68'); // 70 - 2

      // All content should render properly
      expect(screen.getByText('Integration Test Header')).toBeInTheDocument();
      expect(screen.getByText('Lists Section')).toBeInTheDocument();
      expect(screen.getByText('Item one with some detail')).toBeInTheDocument();
      expect(screen.getByText('Important note about')).toBeInTheDocument();
      expect(screen.getByText('Numbered list item')).toBeInTheDocument();
    });
  });

  describe('Component lifecycle integration', () => {
    it('should re-render when terminal dimensions change', () => {
      let renderCount = 0;

      // Mock that tracks render calls
      const OriginalMarkdownRenderer = require('../MarkdownRenderer').MarkdownRenderer;
      const TrackedRenderer = (props: any) => {
        renderCount++;
        return React.createElement(OriginalMarkdownRenderer, props);
      };

      // Initial render
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(
        React.createElement(TrackedRenderer, { content: "# Test" })
      );

      const initialRenderCount = renderCount;

      // Change dimensions
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      // Trigger re-render
      rerender(React.createElement(TrackedRenderer, { content: "# Test" }));

      // Should have re-rendered with new dimensions
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should handle hook errors gracefully', () => {
      // Mock hook to throw error
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook error');
      });

      // Component should handle the error gracefully
      expect(() => {
        render(<MarkdownRenderer content="# Error Test" />);
      }).toThrow('Hook error');

      // Reset hook to normal behavior
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: false,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      // Should work normally after error is resolved
      expect(() => {
        render(<MarkdownRenderer content="# Recovery Test" />);
      }).not.toThrow();
    });
  });

  describe('Performance with dynamic dimensions', () => {
    it('should efficiently handle rapid dimension changes', () => {
      const content = "# Performance Test Content";
      const dimensionChanges = 20;

      const start = performance.now();

      // Simulate rapid dimension changes
      for (let i = 0; i < dimensionChanges; i++) {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80 + (i * 5), // Gradually increasing width
          height: 24,
          breakpoint: 'normal' as const,
          isAvailable: true,
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
        });

        const { unmount } = render(
          <MarkdownRenderer key={i} content={content} />
        );

        // Clean up to prevent memory leaks in test
        unmount();
      }

      const end = performance.now();

      // Should handle rapid changes efficiently (< 100ms total for 20 renders)
      expect(end - start).toBeLessThan(100);
    });

    it('should not cause memory leaks with dimension monitoring', () => {
      const content = "# Memory Test";

      // Create and destroy multiple instances
      const instances = [];
      for (let i = 0; i < 10; i++) {
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

        const { unmount } = render(
          <MarkdownRenderer key={i} content={content} />
        );

        instances.push({ unmount });
      }

      // Clean up all instances
      instances.forEach(({ unmount }) => unmount());

      // Hook should have been called for each instance
      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(10);
    });
  });
});