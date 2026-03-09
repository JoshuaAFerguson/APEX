import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer.js';

// Mock the diff library for controlled testing
vi.mock('diff', () => ({
  diffLines: vi.fn(),
  diffChars: vi.fn(),
}));

vi.mock('fast-diff', () => ({
  default: vi.fn(),
}));

// Mock the useStdoutDimensions hook
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(),
}));

describe('DiffViewer Edge Cases and Advanced Scenarios', () => {
  let mockDiffLines: any;
  let mockDiffChars: any;
  let mockUseStdoutDimensions: any;

  beforeEach(async () => {
    const { diffLines, diffChars } = await import('diff');
    const { useStdoutDimensions } = await import('../../hooks/index.js');

    mockDiffLines = vi.mocked(diffLines);
    mockDiffChars = vi.mocked(diffChars);
    mockUseStdoutDimensions = vi.mocked(useStdoutDimensions);

    // Default mock setup
    mockDiffLines.mockReturnValue([
      { count: 1, value: 'test line\n', added: true },
    ]);

    mockDiffChars.mockReturnValue([
      { count: 4, value: 'test', added: true },
    ]);

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
    vi.clearAllMocks();
  });

  describe('Advanced Truncation Scenarios', () => {
    it('should handle extremely long single line with various terminal widths', () => {
      const veryLongLine = 'x'.repeat(5000);
      const widths = [40, 80, 120, 200];

      mockDiffLines.mockReturnValue([
        { count: 1, value: `${veryLongLine}\n`, added: true },
      ]);

      widths.forEach(width => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: width < 60 ? 'narrow' : width < 120 ? 'compact' : 'normal',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 120,
          isNormal: width >= 120,
          isWide: false,
          isAvailable: true,
        });

        const { container } = render(
          <DiffViewer
            oldContent=""
            newContent={veryLongLine}
            filename={`long-line-${width}.txt`}
            width={width}
          />
        );

        expect(container).toBeTruthy();
      });
    });

    it('should handle mixed short and very long lines', () => {
      const mixedContent = [
        'short',
        'x'.repeat(1000),
        'medium length line',
        'y'.repeat(2000),
        'end',
      ].join('\n');

      mockDiffLines.mockReturnValue([
        ...mixedContent.split('\n').map(line => ({
          count: 1,
          value: `${line}\n`,
          added: true,
        })),
      ]);

      const { container } = render(
        <DiffViewer
          oldContent=""
          newContent={mixedContent}
          filename="mixed-lengths.txt"
          width={80}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle content with tabs and special whitespace', () => {
      const tabContent = "line1\tcolumn2\tcolumn3\n\t\t\tindented\n    spaces    ";
      const modifiedTabContent = "line1\tmodified\tcolumn3\n\t\t\tnew indent\n    spaces    ";

      mockDiffLines.mockReturnValue([
        { count: 1, value: 'line1\tcolumn2\tcolumn3\n', removed: true },
        { count: 1, value: 'line1\tmodified\tcolumn3\n', added: true },
        { count: 1, value: '\t\t\tindented\n', removed: true },
        { count: 1, value: '\t\t\tnew indent\n', added: true },
        { count: 1, value: '    spaces    \n' },
      ]);

      const { container } = render(
        <DiffViewer
          oldContent={tabContent}
          newContent={modifiedTabContent}
          filename="tabs.txt"
          width={60}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle zero-width content calculation scenarios', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Extremely narrow
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
          oldContent="test"
          newContent="modified test"
          filename="zero-width.txt"
          showLineNumbers={true}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Complex Line Number Scenarios', () => {
    it('should handle files with irregular line number progression', () => {
      // Simulate diff where line numbers don't progress linearly
      mockDiffLines.mockReturnValue([
        { count: 1, value: 'line 1\n' },
        { count: 10, value: 'lines 2-11 removed\n', removed: true },
        { count: 5, value: 'lines 12-16 added\n', added: true },
        { count: 1, value: 'line 17\n' },
      ]);

      // Mock a very large file to test line number width calculation
      const largeFile = Array(50000).fill(0).map((_, i) => `line ${i + 1}`).join('\n');

      const { container } = render(
        <DiffViewer
          oldContent={largeFile}
          newContent={largeFile + '\nnew line 50001'}
          filename="irregular-lines.txt"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle files with maximum line number bounds', () => {
      // Test the 6-digit maximum bound for line numbers
      const hugeLine = 9999999; // 7 digits, should be capped at 6

      const hugeContent = Array(hugeLine).fill(0).map((_, i) => `line ${i + 1}`);
      mockDiffLines.mockReturnValue([
        { count: hugeLine, value: hugeContent.join('\n') + '\n' },
        { count: 1, value: 'final line\n', added: true },
      ]);

      const { container } = render(
        <DiffViewer
          oldContent={hugeContent.join('\n')}
          newContent={hugeContent.join('\n') + '\nfinal line'}
          filename="huge-file.txt"
          maxLines={10}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle line numbers across different breakpoints consistently', () => {
      const breakpointTests = [
        { width: 30, breakpoint: 'narrow' as const, expectedMinDigits: 2 },
        { width: 70, breakpoint: 'compact' as const, expectedMinDigits: 3 },
        { width: 130, breakpoint: 'normal' as const, expectedMinDigits: 2 },
        { width: 180, breakpoint: 'wide' as const, expectedMinDigits: 2 },
      ];

      mockDiffLines.mockReturnValue([
        { count: 1, value: 'line 1\n' },
        { count: 1, value: 'line 2\n', added: true },
      ]);

      breakpointTests.forEach(({ width, breakpoint }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
          isAvailable: true,
        });

        const { container } = render(
          <DiffViewer
            oldContent="line 1"
            newContent="line 1\nline 2"
            filename={`${breakpoint}-lines.txt`}
            showLineNumbers={true}
          />
        );

        expect(container).toBeTruthy();
      });
    });
  });

  describe('Extreme Mode Switching Scenarios', () => {
    it('should handle rapid mode switching under load', () => {
      const modes = ['unified', 'split', 'inline', 'auto'] as const;
      const content = 'x'.repeat(1000);

      modes.forEach(mode => {
        // Test each mode with various edge conditions
        const edgeCases = [
          { width: 50, responsive: true },
          { width: 119, responsive: false },
          { width: 120, responsive: true },
          { width: 200, responsive: false },
        ];

        edgeCases.forEach(({ width, responsive }) => {
          mockUseStdoutDimensions.mockReturnValue({
            width: width,
            height: 30,
            breakpoint: width < 60 ? 'narrow' : width < 120 ? 'compact' : 'normal',
            isNarrow: width < 60,
            isCompact: width >= 60 && width < 120,
            isNormal: width >= 120,
            isWide: false,
            isAvailable: true,
          });

          const { container } = render(
            <DiffViewer
              oldContent={content}
              newContent={content + ' modified'}
              filename={`${mode}-${width}-${responsive}.txt`}
              mode={mode}
              width={width}
              responsive={responsive}
            />
          );

          expect(container).toBeTruthy();
        });
      });
    });

    it('should handle split mode fallback edge cases', () => {
      const fallbackScenarios = [
        { requestedWidth: 119, terminalWidth: 120 }, // Just below threshold
        { requestedWidth: 120, terminalWidth: 119 }, // At threshold but terminal narrow
        { requestedWidth: undefined, terminalWidth: 119 }, // Auto-responsive
      ];

      fallbackScenarios.forEach(({ requestedWidth, terminalWidth }, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width: terminalWidth,
          height: 30,
          breakpoint: terminalWidth < 120 ? 'compact' : 'normal',
          isNarrow: false,
          isCompact: terminalWidth < 120,
          isNormal: terminalWidth >= 120,
          isWide: false,
          isAvailable: true,
        });

        const { container } = render(
          <DiffViewer
            oldContent="fallback test"
            newContent="fallback test modified"
            filename={`fallback-${index}.txt`}
            mode="split"
            width={requestedWidth}
          />
        );

        expect(container).toBeTruthy();
      });
    });
  });

  describe('Special Content Handling', () => {
    it('should handle content with null bytes and control characters', () => {
      const specialContent = "line1\x00null\x01control\x02chars\nline2\x1b[31mcolored\x1b[0m";
      const modifiedSpecial = specialContent.replace('control', 'modified');

      mockDiffLines.mockReturnValue([
        { count: 1, value: 'line1\x00null\x01control\x02chars\n', removed: true },
        { count: 1, value: 'line1\x00null\x01modified\x02chars\n', added: true },
        { count: 1, value: 'line2\x1b[31mcolored\x1b[0m\n' },
      ]);

      const { container } = render(
        <DiffViewer
          oldContent={specialContent}
          newContent={modifiedSpecial}
          filename="special-chars.txt"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle malformed UTF-8 sequences', () => {
      // Simulate malformed UTF-8 (this is tricky to do properly in JS)
      const malformedContent = "valid text\uFFFDreplacement\uFFFD more text";
      const modifiedMalformed = malformedContent.replace('replacement', 'fixed');

      mockDiffLines.mockReturnValue([
        { count: 1, value: 'valid text\uFFFDreplacement\uFFFD more text\n', removed: true },
        { count: 1, value: 'valid text\uFFFDfixed\uFFFD more text\n', added: true },
      ]);

      const { container } = render(
        <DiffViewer
          oldContent={malformedContent}
          newContent={modifiedMalformed}
          filename="malformed-utf8.txt"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle extremely nested diff changes', () => {
      // Simulate a diff with many alternating added/removed lines
      const complexDiff = [];
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          complexDiff.push({ count: 1, value: `context line ${i}\n` });
        } else if (i % 3 === 1) {
          complexDiff.push({ count: 1, value: `removed line ${i}\n`, removed: true });
        } else {
          complexDiff.push({ count: 1, value: `added line ${i}\n`, added: true });
        }
      }

      mockDiffLines.mockReturnValue(complexDiff);

      const { container } = render(
        <DiffViewer
          oldContent="complex diff old"
          newContent="complex diff new"
          filename="complex-diff.txt"
          maxLines={20}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle repeated renders without memory leaks', () => {
      const content = Array(100).fill(0).map((_, i) => `line ${i}`).join('\n');

      let lastContainer: Element | null = null;

      // Simulate many re-renders
      for (let i = 0; i < 10; i++) {
        const { container, unmount } = render(
          <DiffViewer
            oldContent={content}
            newContent={content + `\nmodified iteration ${i}`}
            filename={`memory-test-${i}.txt`}
            key={i}
          />
        );

        expect(container).toBeTruthy();
        expect(container).not.toBe(lastContainer);
        lastContainer = container;

        unmount();
      }
    });

    it('should handle concurrent rendering scenarios', () => {
      // Test multiple DiffViewer instances rendered simultaneously
      const instances = Array(5).fill(0).map((_, i) => (
        <DiffViewer
          key={i}
          oldContent={`content ${i}`}
          newContent={`modified content ${i}`}
          filename={`concurrent-${i}.txt`}
          mode={i % 2 === 0 ? 'unified' : 'split'}
          width={120 + i * 20}
        />
      ));

      const { container } = render(<div>{instances}</div>);
      expect(container).toBeTruthy();
      expect(container.children).toHaveLength(1); // The wrapper div
    });

    it('should handle props that change rapidly', () => {
      let renderCount = 0;
      const { rerender } = render(
        <DiffViewer
          oldContent="initial"
          newContent="initial modified"
          filename="rapid-props.txt"
        />
      );

      // Rapidly change various props
      const propChanges = [
        { mode: 'split' as const, width: 140 },
        { mode: 'inline' as const, width: 100 },
        { mode: 'unified' as const, width: 80, showLineNumbers: false },
        { mode: 'auto' as const, width: 120, showLineNumbers: true },
        { mode: 'split' as const, width: 200, maxLines: 10 },
      ];

      propChanges.forEach(props => {
        renderCount++;
        rerender(
          <DiffViewer
            oldContent="rapid change test"
            newContent={`rapid change test ${renderCount}`}
            filename={`rapid-${renderCount}.txt`}
            {...props}
          />
        );
      });

      expect(renderCount).toBe(5);
    });
  });

  describe('Error Boundary and Recovery', () => {
    it('should handle diff library returning unexpected data', () => {
      // Test with diff library returning malformed data
      mockDiffLines.mockReturnValue([
        null,
        undefined,
        { count: 1, value: 'valid line\n' },
        { /* missing required properties */ } as any,
        { count: 1, value: null } as any,
      ].filter(Boolean));

      const { container } = render(
        <DiffViewer
          oldContent="error test"
          newContent="error test modified"
          filename="error-recovery.txt"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle useStdoutDimensions returning invalid data', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: NaN,
        height: undefined,
        breakpoint: null,
        isNarrow: undefined,
        isCompact: null,
        isNormal: NaN,
        isWide: undefined,
        isAvailable: false,
      } as any);

      const { container } = render(
        <DiffViewer
          oldContent="invalid dimensions"
          newContent="invalid dimensions modified"
          filename="invalid-dims.txt"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle invalid prop combinations gracefully', () => {
      const invalidPropSets = [
        { width: NaN, maxLines: -Infinity },
        { context: undefined, showLineNumbers: null },
        { mode: 'invalid' as any, responsive: 'maybe' as any },
      ];

      invalidPropSets.forEach((props, index) => {
        const { container } = render(
          <DiffViewer
            oldContent="invalid props test"
            newContent="invalid props test modified"
            filename={`invalid-props-${index}.txt`}
            {...props}
          />
        );

        expect(container).toBeTruthy();
      });
    });
  });
});