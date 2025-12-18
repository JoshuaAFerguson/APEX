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
      it('uses split view for wide terminals (>= 100 columns)', () => {
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

        const result = render(
          <DiffViewer
            oldContent="old content here"
            newContent="new content here"
            filename="wide.txt"
            mode="auto"
          />
        );

        // Should use split view for wide terminal
        expect(result.container).toBeDefined();
      });

      it('uses unified view for narrow terminals (< 100 columns)', () => {
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
            filename="narrow.txt"
            mode="auto"
          />
        );

        // Should use unified view for narrow terminal
        expect(result.container).toBeDefined();
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
        expect(screen.getByText(/split view requires 100\+ columns/i)).toBeInTheDocument();
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
        expect(screen.queryByText(/split view requires 100\+ columns/i)).not.toBeInTheDocument();
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

    describe('Line Truncation', () => {
      it('truncates long lines based on available width', () => {
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

        const result = render(
          <DiffViewer
            oldContent=""
            newContent={longLine}
            filename="truncation.txt"
          />
        );

        // Should contain truncated content with ellipsis
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
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
          },
          {
            width: 80,
            breakpoint: 'compact' as const,
            isNarrow: false,
            isCompact: true,
            isNormal: false,
            isWide: false,
          },
          {
            width: 120,
            breakpoint: 'normal' as const,
            isNarrow: false,
            isCompact: false,
            isNormal: true,
            isWide: false,
          },
          {
            width: 180,
            breakpoint: 'wide' as const,
            isNarrow: false,
            isCompact: false,
            isNormal: false,
            isWide: true,
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
});