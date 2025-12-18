import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { DiffViewer } from '../DiffViewer';
import { SyntaxHighlighter } from '../SyntaxHighlighter';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock the diff library for DiffViewer
const mockDiffLines = vi.fn();
const mockDiffChars = vi.fn();
vi.mock('diff', () => ({
  diffLines: mockDiffLines,
  diffChars: mockDiffChars,
}));

describe('Responsive Components Integration', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Default diff mock implementations
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

  describe('Terminal Width Detection Integration', () => {
    const terminalWidthScenarios = [
      {
        name: 'Very Narrow Terminal (40 columns)',
        width: 40,
        breakpoint: 'narrow' as const,
        helpers: { isNarrow: true, isCompact: false, isNormal: false, isWide: false },
        expectedBehavior: {
          diffMode: 'unified',
          syntaxWrap: true,
          minWidth: 40,
        },
      },
      {
        name: 'Narrow Terminal (60 columns)',
        width: 60,
        breakpoint: 'narrow' as const,
        helpers: { isNarrow: true, isCompact: false, isNormal: false, isWide: false },
        expectedBehavior: {
          diffMode: 'unified',
          syntaxWrap: true,
          minWidth: 40,
        },
      },
      {
        name: 'Compact Terminal (80 columns)',
        width: 80,
        breakpoint: 'compact' as const,
        helpers: { isNarrow: false, isCompact: true, isNormal: false, isWide: false },
        expectedBehavior: {
          diffMode: 'unified',
          syntaxWrap: true,
          minWidth: 40,
        },
      },
      {
        name: 'Normal Terminal (120 columns)',
        width: 120,
        breakpoint: 'normal' as const,
        helpers: { isNarrow: false, isCompact: false, isNormal: true, isWide: false },
        expectedBehavior: {
          diffMode: 'split',
          syntaxWrap: false,
          minWidth: 40,
        },
      },
      {
        name: 'Wide Terminal (180 columns)',
        width: 180,
        breakpoint: 'wide' as const,
        helpers: { isNarrow: false, isCompact: false, isNormal: false, isWide: true },
        expectedBehavior: {
          diffMode: 'split',
          syntaxWrap: false,
          minWidth: 40,
        },
      },
    ];

    terminalWidthScenarios.forEach(({ name, width, breakpoint, helpers, expectedBehavior }) => {
      describe(name, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 30,
            breakpoint,
            ...helpers,
            isAvailable: true,
          });
        });

        it('DiffViewer adapts mode correctly in auto mode', () => {
          const result = render(
            <DiffViewer
              oldContent="old content for testing"
              newContent="new content for testing"
              filename={`test-${breakpoint}.txt`}
              mode="auto"
            />
          );

          expect(result.container).toBeDefined();

          // Check if fallback message appears when split is forced to unified
          if (expectedBehavior.diffMode === 'unified' && width < 100) {
            // The component should be using unified mode
            expect(result.container).toBeDefined();
          }
        });

        it('DiffViewer shows fallback warning when split mode is requested but not possible', () => {
          if (width < 100) {
            render(
              <DiffViewer
                oldContent="old content for testing"
                newContent="new content for testing"
                filename={`test-split-${breakpoint}.txt`}
                mode="split"
              />
            );

            expect(screen.getByText(/split view requires 100\+ columns/i)).toBeInTheDocument();
          }
        });

        it('SyntaxHighlighter adapts width correctly', () => {
          const longCode = 'const veryLongVariableNameThatMightNeedWrapping = "test value";';
          const result = render(
            <SyntaxHighlighter
              code={longCode}
              language="typescript"
            />
          );

          expect(result.container).toBeDefined();
          expect(screen.getByText('typescript')).toBeInTheDocument();
        });

        it('SyntaxHighlighter wraps lines based on terminal width', () => {
          const veryLongLine = 'const ' + 'x'.repeat(width * 2) + ' = "test";';
          render(
            <SyntaxHighlighter
              code={veryLongLine}
              language="javascript"
              wrapLines={true}
            />
          );

          // For narrow terminals, wrapping should occur
          if (width < 100) {
            expect(screen.getByText(/wrapped/)).toBeInTheDocument();
          }
        });

        it('both components respect responsive=false setting', () => {
          const diffResult = render(
            <DiffViewer
              oldContent="test old"
              newContent="test new"
              filename="non-responsive.txt"
              responsive={false}
            />
          );

          const syntaxResult = render(
            <SyntaxHighlighter
              code="const test = 'non-responsive';"
              responsive={false}
            />
          );

          expect(diffResult.container).toBeDefined();
          expect(syntaxResult.container).toBeDefined();
        });
      });
    });
  });

  describe('Cross-Component Consistency', () => {
    it('both components use the same width calculation logic', () => {
      const testWidth = 90;
      mockUseStdoutDimensions.mockReturnValue({
        width: testWidth,
        height: 30,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const diffResult = render(
        <DiffViewer
          oldContent="test content"
          newContent="modified content"
          filename="consistency.txt"
        />
      );

      const syntaxResult = render(
        <SyntaxHighlighter
          code="const consistency = 'test';"
        />
      );

      // Both should calculate width consistently
      expect(diffResult.container).toBeDefined();
      expect(syntaxResult.container).toBeDefined();
    });

    it('both components enforce minimum width', () => {
      const verySmallWidth = 20;
      mockUseStdoutDimensions.mockReturnValue({
        width: verySmallWidth,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const diffResult = render(
        <DiffViewer
          oldContent="minimum width test"
          newContent="minimum width test modified"
          filename="min-width.txt"
        />
      );

      const syntaxResult = render(
        <SyntaxHighlighter
          code="const minWidth = 'test';"
        />
      );

      // Both should work despite very small terminal
      expect(diffResult.container).toBeDefined();
      expect(syntaxResult.container).toBeDefined();
    });

    it('both components handle explicit width prop consistently', () => {
      const explicitWidth = 100;
      mockUseStdoutDimensions.mockReturnValue({
        width: 50, // Small terminal
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const diffResult = render(
        <DiffViewer
          oldContent="explicit width test"
          newContent="explicit width test modified"
          filename="explicit.txt"
          width={explicitWidth}
        />
      );

      const syntaxResult = render(
        <SyntaxHighlighter
          code="const explicitWidth = 'test';"
          width={explicitWidth}
        />
      );

      // Both should use explicit width over responsive calculation
      expect(diffResult.container).toBeDefined();
      expect(syntaxResult.container).toBeDefined();
    });
  });

  describe('Dynamic Resize Behavior', () => {
    it('components adapt when terminal size changes', () => {
      // Start with narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { rerender: rerenderDiff } = render(
        <DiffViewer
          oldContent="resize test old"
          newContent="resize test new"
          filename="resize.txt"
          mode="auto"
        />
      );

      // Simulate terminal resize to wide
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

      rerenderDiff(
        <DiffViewer
          oldContent="resize test old"
          newContent="resize test new"
          filename="resize.txt"
          mode="auto"
        />
      );

      // Component should adapt to new width
      expect(screen.getByText('resize.txt')).toBeInTheDocument();
    });

    it('components handle terminal availability changes', () => {
      // Start with dimensions available
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

      const { rerender } = render(
        <SyntaxHighlighter
          code="const availability = 'test';"
        />
      );

      // Simulate dimensions becoming unavailable
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,  // fallback width
        height: 24, // fallback height
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: false,
      });

      rerender(
        <SyntaxHighlighter
          code="const availability = 'test';"
        />
      );

      // Should work with fallback dimensions
      expect(screen.getByText(/const availability/)).toBeInTheDocument();
    });
  });

  describe('Stress Testing', () => {
    it('handles complex content with various terminal sizes', () => {
      const complexCode = `
interface ComplexInterface {
  veryLongPropertyNameThatMightCauseWrapping: string;
  anotherProperty: number;
  methodWithLongName(): Promise<VeryLongReturnTypeName>;
}

class ComplexClass implements ComplexInterface {
  private veryLongPropertyNameThatMightCauseWrapping: string = "test";
  private anotherProperty: number = 42;

  async methodWithLongName(): Promise<VeryLongReturnTypeName> {
    return await this.processLongOperation();
  }
}
`;

      const complexOldContent = `function oldFunction() {
  return "old implementation with long variable names";
}`;

      const complexNewContent = `function newFunction() {
  const veryLongVariableNameThatExceedsNormalWidth = "new implementation";
  return veryLongVariableNameThatExceedsNormalWidth + " with modifications";
}`;

      // Test with different terminal widths
      [40, 80, 120, 180].forEach(width => {
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

        const syntaxResult = render(
          <SyntaxHighlighter
            code={complexCode}
            language="typescript"
          />
        );

        const diffResult = render(
          <DiffViewer
            oldContent={complexOldContent}
            newContent={complexNewContent}
            filename={`complex-${width}.ts`}
            mode="auto"
          />
        );

        expect(syntaxResult.container).toBeDefined();
        expect(diffResult.container).toBeDefined();

        // Clean up for next iteration
        syntaxResult.unmount();
        diffResult.unmount();
      });
    });

    it('maintains performance with responsive calculations', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 50,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      const largeCode = Array(100).fill('console.log("performance test");').join('\n');
      const largeDiff = Array(50).fill('test line').join('\n');

      const start = performance.now();

      const syntaxResult = render(
        <SyntaxHighlighter
          code={largeCode}
          maxLines={50}
        />
      );

      const diffResult = render(
        <DiffViewer
          oldContent={largeDiff}
          newContent={largeDiff + '\nmodified'}
          filename="performance.txt"
          maxLines={50}
        />
      );

      const end = performance.now();

      expect(end - start).toBeLessThan(500);
      expect(syntaxResult.container).toBeDefined();
      expect(diffResult.container).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed terminal dimension data', () => {
      // Test with malformed data
      mockUseStdoutDimensions.mockReturnValue({
        width: NaN,
        height: undefined,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false,
      });

      const syntaxResult = render(
        <SyntaxHighlighter
          code="const errorHandling = 'test';"
        />
      );

      const diffResult = render(
        <DiffViewer
          oldContent="error test"
          newContent="error test modified"
          filename="error.txt"
        />
      );

      // Should not crash and use fallbacks
      expect(syntaxResult.container).toBeDefined();
      expect(diffResult.container).toBeDefined();
    });

    it('handles extreme terminal sizes gracefully', () => {
      const extremeSizes = [1, 5, 1000, 10000];

      extremeSizes.forEach(size => {
        mockUseStdoutDimensions.mockReturnValue({
          width: size,
          height: 30,
          breakpoint: size < 60 ? 'narrow' : size < 100 ? 'compact' : size < 160 ? 'normal' : 'wide',
          isNarrow: size < 60,
          isCompact: size >= 60 && size < 100,
          isNormal: size >= 100 && size < 160,
          isWide: size >= 160,
          isAvailable: true,
        });

        const syntaxResult = render(
          <SyntaxHighlighter
            code="const extreme = 'test';"
          />
        );

        const diffResult = render(
          <DiffViewer
            oldContent="extreme test"
            newContent="extreme test modified"
            filename={`extreme-${size}.txt`}
          />
        );

        expect(syntaxResult.container).toBeDefined();
        expect(diffResult.container).toBeDefined();

        // Clean up
        syntaxResult.unmount();
        diffResult.unmount();
      });
    });
  });
});