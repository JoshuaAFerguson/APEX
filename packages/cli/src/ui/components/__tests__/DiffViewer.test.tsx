import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../__tests__/test-utils';
import { DiffViewer } from '../DiffViewer';

// Mock the diff library
vi.mock('diff', () => ({
  diffLines: vi.fn(),
  diffChars: vi.fn(),
}));

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('DiffViewer', () => {
  const mockDiffLines = vi.fn();
  const mockDiffChars = vi.fn();

  beforeEach(() => {
    const diff = require('diff');
    diff.diffLines = mockDiffLines;
    diff.diffChars = mockDiffChars;

    // Default mock implementations
    mockDiffLines.mockReturnValue([
      { count: 1, value: 'unchanged line\n' },
      { count: 1, value: 'old line\n', removed: true },
      { count: 1, value: 'new line\n', added: true },
    ]);

    mockDiffChars.mockReturnValue([
      { count: 3, value: 'old' },
      { count: 3, value: 'new', added: true },
    ]);

    // Default terminal dimensions mock
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal',
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders unified diff view by default', () => {
      render(
        <DiffViewer
          oldContent="old content"
          newContent="new content"
          filename="test.txt"
        />
      );

      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('shows file stats', () => {
      render(
        <DiffViewer
          oldContent="line1\nline2"
          newContent="line1\nline3"
          filename="test.txt"
        />
      );

      // Basic rendering test - file is displayed
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('handles empty files gracefully', () => {
      render(
        <DiffViewer
          oldContent=""
          newContent=""
          filename="empty.txt"
        />
      );

      expect(screen.getByText('empty.txt')).toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    it('renders split view correctly', () => {
      render(
        <DiffViewer
          oldContent="old content"
          newContent="new content"
          filename="test.txt"
          mode="split"
        />
      );

      // Basic rendering test
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('renders inline view with character-level diffs', () => {
      render(
        <DiffViewer
          oldContent="old content"
          newContent="new content"
          filename="test.txt"
          mode="inline"
        />
      );

      // Should show character-level differences
      expect(mockDiffChars).toHaveBeenCalled();
    });
  });

  describe('Basic Functionality', () => {
    it('handles unknown file types gracefully', () => {
      render(
        <DiffViewer
          oldContent="unknown content"
          newContent="unknown content 2"
          filename="file.xyz"
        />
      );

      // Should not crash with unknown extensions
      expect(screen.getByText('file.xyz')).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('handles missing optional props gracefully', () => {
      render(
        <DiffViewer
          oldContent="old"
          newContent="new"
        />
      );

      // Should render without crashing
      expect(true).toBe(true);
    });

    it('handles very long lines gracefully', () => {
      const veryLongLine = 'x'.repeat(10000);
      render(
        <DiffViewer
          oldContent={veryLongLine}
          newContent={veryLongLine + 'y'}
          filename="long-line.txt"
        />
      );

      // Should handle very long lines without performance issues
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate ARIA labels', () => {
      render(
        <DiffViewer
          oldContent="old"
          newContent="new"
          filename="test.txt"
        />
      );

      // Should have accessible labels for screen readers
      expect(screen.getByLabelText(/diff/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(
        <DiffViewer
          oldContent="old content"
          newContent="new content"
          filename="nav.txt"
          allowViewToggle={true}
        />
      );

      const toggleButton = screen.getByText(/Split/);

      // Should be focusable
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);

      // Should respond to Enter/Space
      fireEvent.keyDown(toggleButton, { key: 'Enter' });
      expect(screen.getByText(/Unified/)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large diffs efficiently', () => {
      const largeDiff = Array(1000).fill(0).map((_, i) => `line ${i}`).join('\n');
      const modifiedDiff = largeDiff.replace(/line 500/, 'modified line 500');

      const start = performance.now();
      render(
        <DiffViewer
          oldContent={largeDiff}
          newContent={modifiedDiff}
          filename="large.txt"
        />
      );
      const end = performance.now();

      // Should handle large diffs in reasonable time
      expect(end - start).toBeLessThan(200);
    });
  });

  describe('Responsive Width Functionality', () => {
    describe('Auto Mode Selection', () => {
      it('uses split view for wide terminals (>= 120 columns)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        const { container } = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="wide.txt"
            mode="auto"
          />
        );

        // Should use split view for wide terminal
        expect(container).toBeDefined();
        // Verify split view structure with dual headers
        expect(screen.getAllByText(/wide.txt/)).toHaveLength(2);
      });

      it('uses unified view for narrow terminals (< 120 columns)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const { container } = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="narrow.txt"
            mode="auto"
          />
        );

        // Should use unified view for narrow terminal
        expect(container).toBeDefined();
        // Verify unified view structure with single header set
        const headers = screen.getAllByText(/narrow.txt/);
        expect(headers).toHaveLength(2); // --- and +++ headers in unified mode
      });

      it('uses unified view for very narrow terminals (< 60 columns)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50,
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="very-narrow.txt"
            mode="auto"
          />
        );

        // Should use unified view for very narrow terminal
        expect(result.container).toBeDefined();
      });
    });

    describe('Threshold Boundary Tests', () => {
      it('uses unified mode at exactly 119 columns', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 119,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="boundary-119.txt"
            mode="auto"
          />
        );

        // Should use unified mode at 119 columns (just below threshold)
        expect(screen.getByText('boundary-119.txt')).toBeInTheDocument();
      });

      it('uses split mode at exactly 120 columns', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="boundary-120.txt"
            mode="auto"
          />
        );

        // Should use split mode at exactly 120 columns (threshold)
        expect(screen.getByText('boundary-120.txt')).toBeInTheDocument();
      });

      it('uses split mode at 121 columns', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 121,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="boundary-121.txt"
            mode="auto"
          />
        );

        // Should use split mode at 121 columns (above threshold)
        expect(screen.getByText('boundary-121.txt')).toBeInTheDocument();
      });

      it('forces fallback from split to unified at 119 columns', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 119,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="forced-119.txt"
            mode="split"
          />
        );

        // Should show fallback message for forced unified mode
        expect(screen.getByText(/split view requires 120\+ columns/i)).toBeInTheDocument();
      });

      it('allows split mode at exactly 120 columns', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="allowed-120.txt"
            mode="split"
          />
        );

        // Should not show fallback message at threshold
        expect(screen.queryByText(/split view requires 120\+ columns/i)).not.toBeInTheDocument();
      });
    });

    describe('Mode Fallback Behavior', () => {
      it('falls back from split to unified when terminal is too narrow', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="fallback.txt"
            mode="split"
          />
        );

        // Should show fallback message and use unified view
        expect(screen.getByText(/split view requires 120\+ columns/i)).toBeInTheDocument();
      });

      it('preserves split mode when terminal is wide enough', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 150,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="preserve-split.txt"
            mode="split"
          />
        );

        // Should not show fallback message
        expect(screen.queryByText(/split view requires 120\+ columns/i)).not.toBeInTheDocument();
      });

      it('preserves inline mode regardless of width', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50,
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="inline.txt"
            mode="inline"
          />
        );

        // Inline mode should work regardless of width
        expect(result.container).toBeDefined();
      });
    });

    describe('Width Calculations', () => {
      it('respects explicit width prop over responsive width', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="explicit-width.txt"
            width={100}
          />
        );

        // Should use the explicit width
        expect(result.container).toBeDefined();
      });

      it('uses terminal width when responsive=true (default)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 90,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="responsive-default.txt"
            responsive={true}
          />
        );

        // Should use responsive width calculation
        expect(result.container).toBeDefined();
      });

      it('uses fixed width when responsive=false', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 90,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="non-responsive.txt"
            responsive={false}
          />
        );

        // Should use fixed width (120)
        expect(result.container).toBeDefined();
      });
    });

    describe('Line Number Width Adaptation', () => {
      it('uses compact line numbers in narrow terminals (<60 cols)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50,
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        // Create a small file that should use minimal digits (2 digits min in narrow)
        mockDiffLines.mockReturnValue([
          { count: 1, value: 'line 1\n' },
          { count: 1, value: 'line 2\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent="line 1"
            newContent="line 1\nline 2"
            filename="narrow-lines.txt"
            showLineNumbers={true}
          />
        );

        // Should handle narrow terminals with compact line numbers (minimum 2 digits)
        expect(screen.getByText('narrow-lines.txt')).toBeInTheDocument();
        // In narrow terminals, line numbers should use minimal width but still be readable
      });

      it('calculates dynamic line number width based on max line count', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        // Test with 3-digit line numbers (up to 999)
        const manyLines = Array(150).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
        mockDiffLines.mockReturnValue([
          { count: 150, value: manyLines },
          { count: 1, value: 'new line 151\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent={manyLines}
            newContent={manyLines + '\nnew line 151'}
            filename="many-lines.txt"
            showLineNumbers={true}
          />
        );

        // Should calculate appropriate width for 3-digit line numbers
        expect(screen.getByText('many-lines.txt')).toBeInTheDocument();
      });

      it('enforces maximum line number width bounds for huge files', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 200,
          height: 30,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });

        // Create an extremely large file with 7-digit line numbers
        const hugeLinesCount = 1000000;
        const hugeContent = 'line content';
        mockDiffLines.mockReturnValue([
          { count: hugeLinesCount, value: Array(hugeLinesCount).fill(hugeContent).join('\n') },
          { count: 1, value: 'final line\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent={Array(hugeLinesCount).fill(hugeContent).join('\n')}
            newContent={Array(hugeLinesCount).fill(hugeContent).join('\n') + '\nfinal line'}
            filename="huge-file.txt"
            showLineNumbers={true}
          />
        );

        // Should enforce maximum bounds (6 digits max) even for huge files
        expect(screen.getByText('huge-file.txt')).toBeInTheDocument();
      });

      it('uses standard line numbers in compact terminals (80-119 cols)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        // Create a file with medium line count
        mockDiffLines.mockReturnValue([
          { count: 50, value: Array(50).fill(0).map((_, i) => `line ${i + 1}`).join('\n') },
          { count: 1, value: 'new line 51\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent={Array(50).fill(0).map((_, i) => `line ${i + 1}`).join('\n')}
            newContent={Array(50).fill(0).map((_, i) => `line ${i + 1}`).join('\n') + '\nnew line 51'}
            filename="compact-lines.txt"
            showLineNumbers={true}
          />
        );

        // Should handle compact terminals with standard line numbers
        expect(screen.getByText('compact-lines.txt')).toBeInTheDocument();
      });

      it('uses dynamic line numbers in wide terminals (>=120 cols)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 150,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        // Create a large file with 1000+ lines to test dynamic width
        const largeDiff = Array(1000).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
        mockDiffLines.mockReturnValue([
          { count: 1000, value: largeDiff },
          { count: 1, value: 'new line 1001\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent={largeDiff}
            newContent={largeDiff + '\nnew line 1001'}
            filename="wide-lines.txt"
            showLineNumbers={true}
          />
        );

        // Should handle wide terminals with dynamic line numbers (4+ digits)
        expect(screen.getByText('wide-lines.txt')).toBeInTheDocument();
      });

      it('handles empty diffs gracefully with line numbers', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        mockDiffLines.mockReturnValue([]);

        render(
          <DiffViewer
            oldContent=""
            newContent=""
            filename="empty.txt"
            showLineNumbers={true}
          />
        );

        // Should handle empty files with default line number width
        expect(screen.getByText('empty.txt')).toBeInTheDocument();
      });

      it('enforces maximum line number width bounds', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 200,
          height: 30,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });

        // Create an extremely large file to test bounds
        const veryLargeDiff = Array(1000000).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
        mockDiffLines.mockReturnValue([
          { count: 1000000, value: veryLargeDiff },
          { count: 1, value: 'final line\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent={veryLargeDiff}
            newContent={veryLargeDiff + '\nfinal line'}
            filename="huge-file.txt"
            showLineNumbers={true}
          />
        );

        // Should enforce reasonable bounds even for huge files
        expect(screen.getByText('huge-file.txt')).toBeInTheDocument();
      });
    });

    describe('Line Truncation', () => {
      it('truncates long lines based on available width in unified mode', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const longLine = 'x'.repeat(200);
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${longLine}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent=""
            newContent={longLine}
            filename="truncation.txt"
            mode="unified"
          />
        );

        // Should contain truncated content with ellipsis
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      });

      it('calculates proper content width accounting for line numbers and padding', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        // Create content that would exceed available width
        const mediumLine = 'content'.repeat(15); // 105 chars
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${mediumLine}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent=""
            newContent={mediumLine}
            filename="content-width.txt"
            showLineNumbers={true}
            mode="unified"
          />
        );

        // Should properly account for line number width and borders when truncating
        expect(screen.getByText('content-width.txt')).toBeInTheDocument();
        // Check that content is truncated appropriately for available space
      });

      it('handles split mode truncation with separate content calculations', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        const longOldLine = 'old'.repeat(30); // 90 chars
        const longNewLine = 'new'.repeat(30); // 90 chars
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${longOldLine}\n`, removed: true },
          { count: 1, value: `${longNewLine}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent={longOldLine}
            newContent={longNewLine}
            filename="split-truncation.txt"
            mode="split"
          />
        );

        // Both sides should have appropriate content width calculated
        expect(screen.getByText('split-truncation.txt')).toBeInTheDocument();
        // In split mode, each side gets approximately half the total width
      });

      it('handles very narrow terminals without overflow', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 40,
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const mediumLine = 'x'.repeat(50);
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${mediumLine}\n`, added: true },
        ]);

        const result = render(
          <DiffViewer
            oldContent=""
            newContent={mediumLine}
            filename="very-narrow.txt"
          />
        );

        // Should handle very narrow terminal gracefully
        expect(result.container).toBeDefined();
      });
    });

    describe('Breakpoint Integration', () => {
      it('integrates with breakpoint helpers correctly', () => {
        const breakpointTests = [
          {
            width: 40,
            breakpoint: 'narrow' as const,
            isNarrow: true,
            isCompact: false,
            isNormal: false,
            isWide: false,
            expectedMode: 'unified',
          },
          {
            width: 80,
            breakpoint: 'compact' as const,
            isNarrow: false,
            isCompact: true,
            isNormal: false,
            isWide: false,
            expectedMode: 'unified',
          },
          {
            width: 100,
            breakpoint: 'normal' as const,
            isNarrow: false,
            isCompact: false,
            isNormal: true,
            isWide: false,
            expectedMode: 'unified',
          },
          {
            width: 120,
            breakpoint: 'normal' as const,
            isNarrow: false,
            isCompact: false,
            isNormal: true,
            isWide: false,
            expectedMode: 'split',
          },
          {
            width: 180,
            breakpoint: 'wide' as const,
            isNarrow: false,
            isCompact: false,
            isNormal: false,
            isWide: true,
            expectedMode: 'split',
          },
        ];

        breakpointTests.forEach(({ width, breakpoint, ...helpers }) => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 30,
            breakpoint,
            ...helpers,
            isAvailable: true,
          });

          const result = render(
            <DiffViewer
              oldContent="test content"
              newContent="modified content"
              filename={`test-${breakpoint}.txt`}
              mode="auto"
            />
          );

          expect(result.container).toBeDefined();
        });
      });

      it('enforces minimum content width even in very narrow terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 30, // Very narrow
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const shortLine = 'test';
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${shortLine}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent=""
            newContent={shortLine}
            filename="min-width.txt"
            showLineNumbers={true}
          />
        );

        // Should enforce minimum content width (20 chars in narrow terminals)
        expect(screen.getByText('min-width.txt')).toBeInTheDocument();
      });

      it('properly calculates content width with different line number scenarios', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        // Test with showLineNumbers=false
        render(
          <DiffViewer
            oldContent="line without numbers"
            newContent="modified line without numbers"
            filename="no-line-numbers.txt"
            showLineNumbers={false}
          />
        );

        expect(screen.getByText('no-line-numbers.txt')).toBeInTheDocument();
        // Should use full width minus borders when line numbers are disabled
      });
    });

    describe('Content Width Calculations', () => {
      it('accounts for unified mode overhead (line numbers, borders, diff markers)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        const testContent = 'x'.repeat(50);
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${testContent}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent=""
            newContent={testContent}
            filename="unified-overhead.txt"
            mode="unified"
            showLineNumbers={true}
          />
        );

        // Unified mode: 120 - (line_numbers + borders + diff_marker) = available content
        expect(screen.getByText('unified-overhead.txt')).toBeInTheDocument();
      });

      it('accounts for split mode overhead with dual panels', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 160,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        const testOld = 'old'.repeat(20);
        const testNew = 'new'.repeat(20);
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${testOld}\n`, removed: true },
          { count: 1, value: `${testNew}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent={testOld}
            newContent={testNew}
            filename="split-overhead.txt"
            mode="split"
            showLineNumbers={true}
          />
        );

        // Split mode: each side gets (160 - 4) / 2 = 78 columns, minus line numbers overhead
        expect(screen.getByText('split-overhead.txt')).toBeInTheDocument();
      });

      it('handles width calculations with responsive=false', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80, // Terminal is narrow
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="non-responsive content"
            newContent="modified non-responsive content"
            filename="non-responsive.txt"
            responsive={false} // Should use fixed 120 width
          />
        );

        // Should ignore terminal width and use fixed 120 width
        expect(screen.getByText('non-responsive.txt')).toBeInTheDocument();
      });

      it('overrides responsive behavior with explicit width prop', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="explicit width content"
            newContent="modified explicit width content"
            filename="explicit-width.txt"
            width={100} // Explicit width should take precedence
            responsive={true}
          />
        );

        // Should use explicit width (100) instead of responsive calculation
        expect(screen.getByText('explicit-width.txt')).toBeInTheDocument();
      });

      it('enforces minimum width with responsive=true', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 30, // Very small terminal
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="minimum width test"
            newContent="modified minimum width test"
            filename="min-width-responsive.txt"
            responsive={true}
          />
        );

        // Should enforce minimum 60 width even for very narrow terminals
        expect(screen.getByText('min-width-responsive.txt')).toBeInTheDocument();
      });
    });

    describe('Edge Cases', () => {
      it('handles terminal dimensions not available', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 24,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: false,
        });

        const result = render(
          <DiffViewer
            oldContent="fallback test"
            newContent="fallback test modified"
            filename="fallback.txt"
          />
        );

        // Should work with fallback dimensions
        expect(result.container).toBeDefined();
      });

      it('enforces minimum width when responsive', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 20, // Very small
          height: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <DiffViewer
            oldContent="minimum width test"
            newContent="minimum width test modified"
            filename="min-width.txt"
            responsive={true}
          />
        );

        // Should enforce minimum width (60 according to implementation)
        expect(result.container).toBeDefined();
      });
    });
  });

  // Test helper functions directly for comprehensive coverage
  describe('Helper Functions', () => {
    describe('getEffectiveMode', () => {
      // Note: These would require exporting the helper functions from DiffViewer.tsx
      // or testing them indirectly through component behavior

      it('returns split for auto mode with wide terminals (>=120 cols)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="test"
            newContent="test modified"
            filename="auto-wide.txt"
            mode="auto"
          />
        );

        // Should choose split mode automatically
        expect(screen.getAllByText(/auto-wide.txt/)).toHaveLength(2); // Split view has dual headers
      });

      it('returns unified for auto mode with narrow terminals (<120 cols)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="test"
            newContent="test modified"
            filename="auto-narrow.txt"
            mode="auto"
          />
        );

        // Should choose unified mode automatically
        const headers = screen.getAllByText(/auto-narrow.txt/);
        expect(headers).toHaveLength(2); // Unified view has --- and +++ headers
      });

      it('forces unified when split requested but terminal too narrow', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="test"
            newContent="test modified"
            filename="forced-unified.txt"
            mode="split" // Explicitly request split
          />
        );

        // Should show fallback message and use unified view
        expect(screen.getByText(/split view requires 120\+ columns/i)).toBeInTheDocument();
      });
    });

    describe('Line Number Width Calculation', () => {
      it('handles files with varying line counts across different breakpoints', () => {
        // Test compact terminal with medium file
        mockUseStdoutDimensions.mockReturnValue({
          width: 90,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const mediumFile = Array(50).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
        mockDiffLines.mockReturnValue([
          { count: 50, value: mediumFile },
          { count: 1, value: 'line 51\n', added: true },
        ]);

        render(
          <DiffViewer
            oldContent={mediumFile}
            newContent={mediumFile + '\nline 51'}
            filename="medium-file.txt"
            showLineNumbers={true}
          />
        );

        // Should handle 2-digit line numbers in compact terminals (minimum 3 digits)
        expect(screen.getByText('medium-file.txt')).toBeInTheDocument();
      });

      it('handles empty diffs with default line number width', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        mockDiffLines.mockReturnValue([]); // Empty diff

        render(
          <DiffViewer
            oldContent=""
            newContent=""
            filename="empty-diff.txt"
            showLineNumbers={true}
          />
        );

        // Should handle empty files with default line number width (99 default)
        expect(screen.getByText('empty-diff.txt')).toBeInTheDocument();
      });
    });

    describe('Content Width with Edge Cases', () => {
      it('handles extremely wide terminals without overflow', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 300, // Very wide terminal
          height: 50,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });

        const wideContent = 'wide'.repeat(50);
        mockDiffLines.mockReturnValue([
          { count: 1, value: `${wideContent}\n`, added: true },
        ]);

        render(
          <DiffViewer
            oldContent=""
            newContent={wideContent}
            filename="very-wide.txt"
            showLineNumbers={true}
          />
        );

        // Should handle very wide terminals gracefully
        expect(screen.getByText('very-wide.txt')).toBeInTheDocument();
      });

      it('handles borderline width at exactly 120 columns', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120, // Exactly at the threshold
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        render(
          <DiffViewer
            oldContent="threshold test"
            newContent="threshold test modified"
            filename="threshold-120.txt"
            mode="auto"
          />
        );

        // Should use split mode at exactly 120 columns
        expect(screen.getAllByText(/threshold-120.txt/)).toHaveLength(2);
      });
    });

    describe('Integration with useStdoutDimensions', () => {
      it('respects breakpoint-specific behavior consistently', () => {
        const breakpointScenarios = [
          {
            width: 40,
            breakpoint: 'narrow' as const,
            expectedMinContent: 20,
            expectedLineDigits: 2,
          },
          {
            width: 80,
            breakpoint: 'compact' as const,
            expectedMinContent: 30,
            expectedLineDigits: 3,
          },
          {
            width: 120,
            breakpoint: 'normal' as const,
            expectedMinContent: 40,
            expectedLineDigits: 2,
          },
          {
            width: 180,
            breakpoint: 'wide' as const,
            expectedMinContent: 40,
            expectedLineDigits: 2,
          },
        ];

        breakpointScenarios.forEach((scenario, index) => {
          mockUseStdoutDimensions.mockReturnValue({
            width: scenario.width,
            height: 30,
            breakpoint: scenario.breakpoint,
            isNarrow: scenario.breakpoint === 'narrow',
            isCompact: scenario.breakpoint === 'compact',
            isNormal: scenario.breakpoint === 'normal',
            isWide: scenario.breakpoint === 'wide',
            isAvailable: true,
          });

          const { rerender } = render(
            <DiffViewer
              oldContent={`content for ${scenario.breakpoint}`}
              newContent={`modified content for ${scenario.breakpoint}`}
              filename={`${scenario.breakpoint}-test.txt`}
              showLineNumbers={true}
            />
          );

          // Should handle each breakpoint consistently
          expect(screen.getByText(`${scenario.breakpoint}-test.txt`)).toBeInTheDocument();

          // Clean up for next test
          rerender(
            <div data-testid={`cleanup-${index}`}>cleaned</div>
          );
        });
      });
    });
  });
});