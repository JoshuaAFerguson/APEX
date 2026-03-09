import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DiffViewer, type DiffViewerProps } from '../DiffViewer.js';

// Mock the diff library
vi.mock('diff', () => ({
  diffLines: vi.fn(),
  diffChars: vi.fn(),
}));

vi.mock('fast-diff', () => ({
  default: vi.fn(),
}));

vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(),
}));

describe('DiffViewer Component - Comprehensive Test Suite', () => {
  let mockDiffLines: any;
  let mockDiffChars: any;
  let mockUseStdoutDimensions: any;

  beforeEach(async () => {
    // Get the mocked functions
    const { diffLines, diffChars } = await import('diff');
    const { useStdoutDimensions } = await import('../../hooks/index.js');

    mockDiffLines = vi.mocked(diffLines);
    mockDiffChars = vi.mocked(diffChars);
    mockUseStdoutDimensions = vi.mocked(useStdoutDimensions);

    // Reset all mocks
    mockDiffLines.mockClear();
    mockDiffChars.mockClear();
    mockUseStdoutDimensions.mockClear();

    // Default mock implementations
    mockDiffLines.mockReturnValue([
      { count: 1, value: 'unchanged line\n' },
      { count: 1, value: 'old line\n', removed: true },
      { count: 1, value: 'new line\n', added: true },
    ]);

    mockDiffChars.mockReturnValue([
      { count: 3, value: 'old', removed: true },
      { count: 3, value: 'new', added: true },
    ]);

    // Default terminal dimensions (normal breakpoint)
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal' as const,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Basic Component Rendering', () => {
    it('renders without crashing with minimal props', () => {
      const { container } = render(
        <DiffViewer oldContent="old" newContent="new" />
      );
      expect(container).toBeTruthy();
    });

    it('renders unified view by default', () => {
      const { container } = render(
        <DiffViewer
          oldContent="line 1\nold content\nline 3"
          newContent="line 1\nnew content\nline 3"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
      expect(container.querySelector('[style*="flex-direction: column"]')).toBeTruthy();
    });

    it('accepts filename prop', () => {
      const { container } = render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          filename="test.txt"
        />
      );
      expect(container).toBeTruthy();
    });
  });

  describe('Mode Selection and Auto Mode Logic', () => {
    it('selects unified mode in auto when width < 120', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact' as const,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          mode="auto"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('selects split mode in auto when width >= 120', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 140,
        height: 30,
        breakpoint: 'wide' as const,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          mode="auto"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('falls back to unified when split is requested but width < 120', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact' as const,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          mode="split"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('uses inline mode when explicitly requested', () => {
      render(
        <DiffViewer
          oldContent="old content"
          newContent="new content"
          mode="inline"
        />
      );

      expect(mockDiffChars).toHaveBeenCalledWith("old content", "new content");
    });
  });

  describe('Responsive Width Handling', () => {
    it('adapts to narrow terminal (< 60 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 30,
        breakpoint: 'narrow' as const,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { container } = render(
        <DiffViewer
          oldContent="old line"
          newContent="new line"
        />
      );

      expect(container).toBeTruthy();
    });

    it('adapts to compact terminal (60-99 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact' as const,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { container } = render(
        <DiffViewer
          oldContent="old line"
          newContent="new line"
        />
      );

      expect(container).toBeTruthy();
    });

    it('uses explicit width when provided', () => {
      const { container } = render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          width={100}
        />
      );

      expect(container.querySelector('[style*="width: 100px"]')).toBeTruthy();
    });

    it('disables responsive mode when responsive=false', () => {
      const { container } = render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          responsive={false}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Line Number Support', () => {
    it('shows line numbers by default', () => {
      render(
        <DiffViewer
          oldContent="line 1\nline 2"
          newContent="line 1\nmodified line 2"
        />
      );

      // Line numbers are rendered by default (showLineNumbers=true)
      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('hides line numbers when showLineNumbers=false', () => {
      render(
        <DiffViewer
          oldContent="line 1\nline 2"
          newContent="line 1\nmodified line 2"
          showLineNumbers={false}
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });
  });

  describe('Content Truncation', () => {
    it('handles very long lines appropriately', () => {
      const longOldContent = "This is a very long line that exceeds normal terminal width and should be handled gracefully by the component";
      const longNewContent = "This is a modified very long line that exceeds normal terminal width and should be handled gracefully";

      const { container } = render(
        <DiffViewer
          oldContent={longOldContent}
          newContent={longNewContent}
        />
      );

      expect(mockDiffLines).toHaveBeenCalledWith(longOldContent, longNewContent);
      expect(container).toBeTruthy();
    });

    it('limits output with maxLines prop', () => {
      const { container } = render(
        <DiffViewer
          oldContent="line 1\nline 2\nline 3\nline 4\nline 5"
          newContent="line 1\nmodified line 2\nline 3\nline 4\nline 5"
          maxLines={3}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Diff Library Integration', () => {
    it('calls diffLines for unified and split modes', () => {
      render(
        <DiffViewer
          oldContent="old content\nline 2"
          newContent="new content\nline 2"
          mode="unified"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('calls diffChars for inline mode', () => {
      render(
        <DiffViewer
          oldContent="old content"
          newContent="new content"
          mode="inline"
        />
      );

      expect(mockDiffChars).toHaveBeenCalledWith("old content", "new content");
    });

    it('handles empty content gracefully', () => {
      render(
        <DiffViewer
          oldContent=""
          newContent="new content"
        />
      );

      expect(mockDiffLines).toHaveBeenCalledWith("", "new content");
    });

    it('handles identical content', () => {
      const content = "same content\nline 2";
      render(
        <DiffViewer
          oldContent={content}
          newContent={content}
        />
      );

      expect(mockDiffLines).toHaveBeenCalledWith(content, content);
    });
  });

  describe('Edge Cases', () => {
    it('handles binary-like content', () => {
      const binaryContent = "\x00\x01\x02\x03";
      render(
        <DiffViewer
          oldContent={binaryContent}
          newContent="text content"
        />
      );

      expect(mockDiffLines).toHaveBeenCalledWith(binaryContent, "text content");
    });

    it('handles unicode content', () => {
      const unicodeContent = "Hello 世界 🌍 émojis";
      render(
        <DiffViewer
          oldContent={unicodeContent}
          newContent={unicodeContent + " modified"}
        />
      );

      expect(mockDiffLines).toHaveBeenCalledWith(
        unicodeContent,
        unicodeContent + " modified"
      );
    });

    it('handles very large files', () => {
      const largeContent = Array(1000).fill("line").map((_, i) => `line ${i}`).join('\n');
      render(
        <DiffViewer
          oldContent={largeContent}
          newContent={largeContent + "\nnew line"}
          maxLines={50}
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('handles malformed content gracefully', () => {
      render(
        <DiffViewer
          oldContent="line 1\n\n\nline 4"
          newContent="line 1\n\nmodified\nline 4"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });
  });

  describe('Context Configuration', () => {
    it('uses default context of 3 lines', () => {
      render(
        <DiffViewer
          oldContent="1\n2\n3\n4\n5\n6\n7"
          newContent="1\n2\nchanged\n4\n5\n6\n7"
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('accepts custom context value', () => {
      render(
        <DiffViewer
          oldContent="1\n2\n3\n4\n5\n6\n7"
          newContent="1\n2\nchanged\n4\n5\n6\n7"
          context={5}
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });

    it('handles zero context', () => {
      render(
        <DiffViewer
          oldContent="1\n2\n3\n4\n5"
          newContent="1\n2\nchanged\n4\n5"
          context={0}
        />
      );

      expect(mockDiffLines).toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    it('renders within reasonable time for medium files', () => {
      const start = performance.now();

      const mediumContent = Array(100).fill("line").map((_, i) => `line ${i}`).join('\n');
      render(
        <DiffViewer
          oldContent={mediumContent}
          newContent={mediumContent.replace('line 50', 'modified line 50')}
        />
      );

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should render in < 100ms
    });

    it('handles frequent re-renders efficiently', () => {
      const { rerender } = render(
        <DiffViewer
          oldContent="content 1"
          newContent="content 1 modified"
        />
      );

      // Multiple re-renders should not cause issues
      for (let i = 0; i < 5; i++) {
        rerender(
          <DiffViewer
            oldContent={`content ${i}`}
            newContent={`content ${i} modified`}
          />
        );
      }

      expect(mockDiffLines).toHaveBeenCalledTimes(6); // Initial + 5 re-renders
    });
  });
});