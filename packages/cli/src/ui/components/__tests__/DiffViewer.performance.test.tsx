import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer.js';

// Mock dependencies for performance testing
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

describe('DiffViewer Performance Tests', () => {
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

  describe('Large File Performance', () => {
    it('should handle 1000 line files efficiently', () => {
      const largeContent = Array(1000).fill(0).map((_, i) => `Line ${i + 1}: Some content here`);
      const modifiedContent = [...largeContent];
      modifiedContent[500] = 'Line 501: Modified content here';

      // Mock a realistic diff with many changes
      const mockDiff = [
        ...largeContent.slice(0, 500).map(line => ({ count: 1, value: line + '\n' })),
        { count: 1, value: largeContent[500] + '\n', removed: true },
        { count: 1, value: modifiedContent[500] + '\n', added: true },
        ...largeContent.slice(501).map(line => ({ count: 1, value: line + '\n' })),
      ];

      mockDiffLines.mockReturnValue(mockDiff);

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent={largeContent.join('\n')}
          newContent={modifiedContent.join('\n')}
          filename="large-1000-lines.txt"
          mode="unified"
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(200); // Should render in under 200ms
      expect(mockDiffLines).toHaveBeenCalledTimes(1);
    });

    it('should handle 5000 line files with maxLines constraint efficiently', () => {
      const veryLargeContent = Array(5000).fill(0).map((_, i) => `Line ${i + 1}`);

      // Mock a large diff but only return first portion
      const limitedMockDiff = Array(100).fill(0).map((_, i) => ({
        count: 1,
        value: `Line ${i + 1}\n`,
        added: i % 10 === 0,
        removed: i % 15 === 0,
      }));

      mockDiffLines.mockReturnValue(limitedMockDiff);

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent={veryLargeContent.join('\n')}
          newContent={veryLargeContent.join('\n') + '\nNew line'}
          filename="very-large-5000-lines.txt"
          mode="unified"
          maxLines={50}
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(150); // Should be even faster with maxLines
    });

    it('should handle extremely long single lines efficiently', () => {
      const hugeLine = 'x'.repeat(50000); // 50k characters
      const modifiedHugeLine = hugeLine + ' modified';

      mockDiffLines.mockReturnValue([
        { count: 1, value: hugeLine + '\n', removed: true },
        { count: 1, value: modifiedHugeLine + '\n', added: true },
      ]);

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent={hugeLine}
          newContent={modifiedHugeLine}
          filename="huge-line.txt"
          mode="unified"
          width={120}
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(300); // Even with truncation, should be reasonable
    });

    it('should handle files with many small changes efficiently', () => {
      const baseContent = Array(200).fill(0).map((_, i) => `Line ${i + 1}: Base content`);

      // Create many small changes throughout the file
      const mockDiff = [];
      for (let i = 0; i < 200; i++) {
        if (i % 5 === 0) {
          // Add a removed line every 5 lines
          mockDiff.push({ count: 1, value: `Line ${i + 1}: Base content\n`, removed: true });
          mockDiff.push({ count: 1, value: `Line ${i + 1}: Modified content\n`, added: true });
        } else {
          // Keep other lines as context
          mockDiff.push({ count: 1, value: `Line ${i + 1}: Base content\n` });
        }
      }

      mockDiffLines.mockReturnValue(mockDiff);

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent={baseContent.join('\n')}
          newContent={baseContent.map(line => line.replace('Base', 'Modified')).join('\n')}
          filename="many-changes.txt"
          mode="unified"
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(250);
    });
  });

  describe('Responsive Behavior Performance', () => {
    it('should handle rapid width changes efficiently', () => {
      const testContent = 'Test content for responsive behavior';
      const widths = [40, 60, 80, 100, 120, 140, 160, 180, 200];

      mockDiffLines.mockReturnValue([
        { count: 1, value: testContent + '\n', added: true },
      ]);

      const start = performance.now();

      widths.forEach(width => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width < 160,
          isWide: width >= 160,
          isAvailable: true,
        });

        const { container } = render(
          <DiffViewer
            oldContent=""
            newContent={testContent}
            filename={`responsive-${width}.txt`}
            mode="auto"
          />
        );

        expect(container).toBeTruthy();
      });

      const end = performance.now();

      expect(end - start).toBeLessThan(500); // All width changes should complete quickly
    });

    it('should handle mode switching under load efficiently', () => {
      const testContent = Array(50).fill(0).map((_, i) => `Line ${i + 1}`).join('\n');
      const modes = ['unified', 'split', 'inline', 'auto'] as const;

      mockDiffLines.mockReturnValue([
        { count: 50, value: testContent + '\n' },
        { count: 1, value: 'Additional line\n', added: true },
      ]);

      mockDiffChars.mockReturnValue([
        { count: testContent.length, value: testContent },
        { count: 15, value: '\nAdditional line', added: true },
      ]);

      const start = performance.now();

      modes.forEach(mode => {
        const { container } = render(
          <DiffViewer
            oldContent={testContent}
            newContent={testContent + '\nAdditional line'}
            filename={`mode-switch-${mode}.txt`}
            mode={mode}
            width={150}
          />
        );

        expect(container).toBeTruthy();
      });

      const end = performance.now();

      expect(end - start).toBeLessThan(400); // Mode switching should be efficient
    });

    it('should handle breakpoint transitions efficiently', () => {
      const content = 'Breakpoint test content with some reasonable length';

      mockDiffLines.mockReturnValue([
        { count: 1, value: content + '\n', added: true },
      ]);

      const breakpointTransitions = [
        { width: 59, breakpoint: 'narrow' as const },
        { width: 60, breakpoint: 'compact' as const },
        { width: 99, breakpoint: 'compact' as const },
        { width: 100, breakpoint: 'normal' as const },
        { width: 119, breakpoint: 'normal' as const },
        { width: 120, breakpoint: 'normal' as const },
        { width: 159, breakpoint: 'normal' as const },
        { width: 160, breakpoint: 'wide' as const },
      ];

      const start = performance.now();

      breakpointTransitions.forEach(({ width, breakpoint }) => {
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
            oldContent=""
            newContent={content}
            filename={`breakpoint-${breakpoint}-${width}.txt`}
            mode="auto"
          />
        );

        expect(container).toBeTruthy();
      });

      const end = performance.now();

      expect(end - start).toBeLessThan(300);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory with repeated renders', () => {
      const testContent = Array(100).fill(0).map((_, i) => `Memory test line ${i + 1}`).join('\n');

      mockDiffLines.mockReturnValue([
        { count: 100, value: testContent + '\n' },
        { count: 1, value: 'Memory test final line\n', added: true },
      ]);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many renders
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(
          <DiffViewer
            oldContent={testContent}
            newContent={testContent + '\nMemory test final line'}
            filename={`memory-test-${i}.txt`}
            mode="unified"
          />
        );

        // Immediately unmount to test cleanup
        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB for 20 renders)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle concurrent renders efficiently', () => {
      const content = 'Concurrent render test';

      mockDiffLines.mockReturnValue([
        { count: 1, value: content + '\n', added: true },
      ]);

      const start = performance.now();

      // Render multiple instances simultaneously
      const instances = Array(10).fill(0).map((_, i) => (
        <DiffViewer
          key={i}
          oldContent=""
          newContent={`${content} ${i}`}
          filename={`concurrent-${i}.txt`}
          mode="unified"
        />
      ));

      const { container } = render(<div>{instances}</div>);

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(container.children[0].children).toHaveLength(10);
      expect(end - start).toBeLessThan(500); // Concurrent rendering should be efficient
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle zero-width scenarios efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 30,
        breakpoint: 'narrow' as const,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      mockDiffLines.mockReturnValue([
        { count: 1, value: 'Zero width test\n', added: true },
      ]);

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent=""
          newContent="Zero width test"
          filename="zero-width.txt"
          width={0}
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(100); // Should handle edge case quickly
    });

    it('should handle maximum dimensions efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 500,
        height: 100,
        breakpoint: 'wide' as const,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      const wideContent = 'x'.repeat(400); // Very wide content
      mockDiffLines.mockReturnValue([
        { count: 1, value: wideContent + '\n', added: true },
      ]);

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent=""
          newContent={wideContent}
          filename="max-width.txt"
          width={500}
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(200);
    });

    it('should handle rapid prop changes efficiently', () => {
      const baseContent = 'Rapid change test';

      mockDiffLines.mockReturnValue([
        { count: 1, value: baseContent + '\n' },
        { count: 1, value: 'Modified\n', added: true },
      ]);

      const { rerender } = render(
        <DiffViewer
          oldContent={baseContent}
          newContent={baseContent + '\nModified'}
          filename="initial.txt"
        />
      );

      const start = performance.now();

      // Rapidly change many props
      const changes = [
        { mode: 'split' as const, width: 140, showLineNumbers: false },
        { mode: 'inline' as const, width: 100, showLineNumbers: true },
        { mode: 'unified' as const, width: 80, maxLines: 10 },
        { mode: 'auto' as const, width: 120, context: 5 },
        { mode: 'split' as const, width: 200, responsive: false },
      ];

      changes.forEach((props, i) => {
        rerender(
          <DiffViewer
            oldContent={baseContent}
            newContent={baseContent + `\nModified ${i}`}
            filename={`rapid-${i}.txt`}
            {...props}
          />
        );
      });

      const end = performance.now();

      expect(end - start).toBeLessThan(200); // Rapid prop changes should be efficient
    });
  });

  describe('Diff Algorithm Performance', () => {
    it('should call diff library efficiently for various content types', () => {
      const testCases = [
        { name: 'small', size: 10 },
        { name: 'medium', size: 100 },
        { name: 'large', size: 500 },
      ];

      testCases.forEach(({ name, size }) => {
        const content = Array(size).fill(0).map((_, i) => `Line ${i + 1}`).join('\n');

        mockDiffLines.mockClear();
        mockDiffLines.mockReturnValue([
          { count: size, value: content + '\n' },
          { count: 1, value: 'Additional line\n', added: true },
        ]);

        const start = performance.now();

        render(
          <DiffViewer
            oldContent={content}
            newContent={content + '\nAdditional line'}
            filename={`${name}-content.txt`}
            mode="unified"
          />
        );

        const end = performance.now();

        expect(mockDiffLines).toHaveBeenCalledTimes(1);
        expect(end - start).toBeLessThan(300);
      });
    });

    it('should handle character diffing performance in inline mode', () => {
      const shortText = 'Hello world';
      const mediumText = 'Hello world '.repeat(50);
      const longText = 'Hello world '.repeat(200);

      const texts = [shortText, mediumText, longText];

      texts.forEach((text, index) => {
        mockDiffChars.mockClear();
        mockDiffChars.mockReturnValue([
          { count: text.length, value: text },
          { count: 10, value: ' modified', added: true },
        ]);

        const start = performance.now();

        render(
          <DiffViewer
            oldContent={text}
            newContent={text + ' modified'}
            filename={`char-diff-${index}.txt`}
            mode="inline"
          />
        );

        const end = performance.now();

        expect(mockDiffChars).toHaveBeenCalledTimes(1);
        expect(end - start).toBeLessThan(150);
      });
    });
  });

  describe('Rendering Performance Benchmarks', () => {
    it('should meet performance benchmarks for typical use cases', () => {
      const benchmarks = [
        {
          name: 'Small diff (< 50 lines)',
          content: Array(30).fill(0).map((_, i) => `Line ${i + 1}`).join('\n'),
          expectedTime: 50,
        },
        {
          name: 'Medium diff (< 200 lines)',
          content: Array(150).fill(0).map((_, i) => `Line ${i + 1}`).join('\n'),
          expectedTime: 100,
        },
        {
          name: 'Large diff (< 500 lines, truncated)',
          content: Array(400).fill(0).map((_, i) => `Line ${i + 1}`).join('\n'),
          expectedTime: 150,
          maxLines: 50,
        },
      ];

      benchmarks.forEach(({ name, content, expectedTime, maxLines }) => {
        mockDiffLines.mockReturnValue([
          { count: content.split('\n').length, value: content + '\n' },
          { count: 1, value: 'Benchmark test line\n', added: true },
        ]);

        const start = performance.now();

        const { container } = render(
          <DiffViewer
            oldContent={content}
            newContent={content + '\nBenchmark test line'}
            filename={`benchmark-${name}.txt`}
            mode="unified"
            maxLines={maxLines}
          />
        );

        const end = performance.now();

        expect(container).toBeTruthy();
        expect(end - start).toBeLessThan(expectedTime);
      });
    });
  });
});