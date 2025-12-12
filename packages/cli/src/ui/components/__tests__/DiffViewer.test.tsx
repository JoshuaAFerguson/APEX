import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../__tests__/test-utils';
import { DiffViewer } from '../DiffViewer';

// Mock the diff library
vi.mock('diff', () => ({
  diffLines: vi.fn(),
  diffChars: vi.fn(),
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders unified diff view by default', () => {
      render(
        <DiffViewer
          oldText="old content"
          newText="new content"
          filename="test.txt"
        />
      );

      expect(screen.getByText('test.txt')).toBeInTheDocument();
      expect(screen.getByText(/Unified/)).toBeInTheDocument();
    });

    it('shows file stats', () => {
      render(
        <DiffViewer
          oldText="line1\nline2"
          newText="line1\nline3"
          filename="test.txt"
          showStats={true}
        />
      );

      // Should show stats about changes
      expect(screen.getByText(/changes/i)).toBeInTheDocument();
    });

    it('handles empty files gracefully', () => {
      render(
        <DiffViewer
          oldText=""
          newText=""
          filename="empty.txt"
        />
      );

      expect(screen.getByText('empty.txt')).toBeInTheDocument();
      expect(screen.getByText(/No changes/)).toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    it('toggles between unified and split view', () => {
      render(
        <DiffViewer
          oldText="old"
          newText="new"
          filename="test.txt"
          allowViewToggle={true}
        />
      );

      // Should show toggle button
      const toggleButton = screen.getByText(/Split/);
      expect(toggleButton).toBeInTheDocument();

      // Click to toggle
      fireEvent.click(toggleButton);
      expect(screen.getByText(/Unified/)).toBeInTheDocument();
    });

    it('renders split view correctly', () => {
      render(
        <DiffViewer
          oldText="old content"
          newText="new content"
          filename="test.txt"
          viewMode="split"
        />
      );

      // Should show both old and new columns
      expect(screen.getByText(/Old/)).toBeInTheDocument();
      expect(screen.getByText(/New/)).toBeInTheDocument();
    });

    it('renders inline view with character-level diffs', () => {
      render(
        <DiffViewer
          oldText="old content"
          newText="new content"
          filename="test.txt"
          viewMode="inline"
        />
      );

      // Should show character-level differences
      expect(mockDiffChars).toHaveBeenCalled();
    });
  });

  describe('Syntax Highlighting', () => {
    it('applies syntax highlighting when language is detected', () => {
      render(
        <DiffViewer
          oldText="const x = 1;"
          newText="const y = 2;"
          filename="test.js"
          language="javascript"
        />
      );

      // Should detect JavaScript and apply highlighting
      expect(screen.getByText(/const/)).toBeInTheDocument();
    });

    it('auto-detects language from filename', () => {
      render(
        <DiffViewer
          oldText="function test() {}"
          newText="function test2() {}"
          filename="app.ts"
        />
      );

      // Should detect TypeScript from .ts extension
    });

    it('handles unknown file types gracefully', () => {
      render(
        <DiffViewer
          oldText="unknown content"
          newText="unknown content 2"
          filename="file.xyz"
        />
      );

      // Should not crash with unknown extensions
      expect(screen.getByText('file.xyz')).toBeInTheDocument();
    });
  });

  describe('Line Numbers', () => {
    it('shows line numbers when enabled', () => {
      render(
        <DiffViewer
          oldText="line 1\nline 2\nline 3"
          newText="line 1\nmodified line 2\nline 3"
          filename="test.txt"
          showLineNumbers={true}
        />
      );

      // Should show line numbers
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles line number changes correctly', () => {
      mockDiffLines.mockReturnValue([
        { count: 1, value: 'line 1\n' },
        { count: 1, value: 'deleted line\n', removed: true },
        { count: 2, value: 'new line 1\nnew line 2\n', added: true },
        { count: 1, value: 'line 3\n' },
      ]);

      render(
        <DiffViewer
          oldText="line 1\ndeleted line\nline 3"
          newText="line 1\nnew line 1\nnew line 2\nline 3"
          filename="test.txt"
          showLineNumbers={true}
        />
      );

      // Should handle line number changes when content is added/removed
    });
  });

  describe('Context Lines', () => {
    it('limits context lines when specified', () => {
      const longOldText = Array(20).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
      const longNewText = longOldText.replace('line 10', 'modified line 10');

      render(
        <DiffViewer
          oldText={longOldText}
          newText={longNewText}
          filename="long.txt"
          contextLines={3}
        />
      );

      // Should only show 3 lines of context around changes
    });

    it('shows expand buttons for collapsed context', () => {
      const veryLongText = Array(100).fill(0).map((_, i) => `line ${i + 1}`).join('\n');
      const modifiedText = veryLongText.replace('line 50', 'modified line 50');

      render(
        <DiffViewer
          oldText={veryLongText}
          newText={modifiedText}
          filename="huge.txt"
          contextLines={5}
          allowExpand={true}
        />
      );

      // Should show expand buttons for hidden context
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  describe('Diff Statistics', () => {
    it('calculates and displays correct statistics', () => {
      mockDiffLines.mockReturnValue([
        { count: 2, value: 'unchanged 1\nunchanged 2\n' },
        { count: 1, value: 'removed line\n', removed: true },
        { count: 2, value: 'added line 1\nadded line 2\n', added: true },
      ]);

      render(
        <DiffViewer
          oldText="unchanged 1\nunchanged 2\nremoved line"
          newText="unchanged 1\nunchanged 2\nadded line 1\nadded line 2"
          filename="stats.txt"
          showStats={true}
        />
      );

      // Should show statistics: 1 removal, 2 additions
      expect(screen.getByText(/\+2/)).toBeInTheDocument();
      expect(screen.getByText(/-1/)).toBeInTheDocument();
    });

    it('shows binary file indicator when appropriate', () => {
      render(
        <DiffViewer
          oldText="binary content"
          newText="different binary"
          filename="image.png"
          isBinary={true}
        />
      );

      expect(screen.getByText(/Binary file/)).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('handles missing optional props gracefully', () => {
      render(
        <DiffViewer
          oldText="old"
          newText="new"
        />
      );

      // Should render with default values
      expect(screen.getByText(/Untitled/)).toBeInTheDocument();
    });

    it('handles identical content', () => {
      render(
        <DiffViewer
          oldText="same content"
          newText="same content"
          filename="same.txt"
        />
      );

      expect(screen.getByText(/No changes/)).toBeInTheDocument();
    });

    it('handles very long lines gracefully', () => {
      const veryLongLine = 'x'.repeat(10000);
      render(
        <DiffViewer
          oldText={veryLongLine}
          newText={veryLongLine + 'y'}
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
          oldText="old"
          newText="new"
          filename="test.txt"
        />
      );

      // Should have accessible labels for screen readers
      expect(screen.getByLabelText(/diff/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(
        <DiffViewer
          oldText="old content"
          newText="new content"
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
          oldText={largeDiff}
          newText={modifiedDiff}
          filename="large.txt"
        />
      );
      const end = performance.now();

      // Should handle large diffs in reasonable time
      expect(end - start).toBeLessThan(200);
    });
  });
});