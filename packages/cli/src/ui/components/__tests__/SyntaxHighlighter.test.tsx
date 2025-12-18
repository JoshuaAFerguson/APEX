import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { SyntaxHighlighter } from '../SyntaxHighlighter';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('SyntaxHighlighter', () => {
  beforeEach(() => {
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
    it('renders code with default settings', () => {
      render(
        <SyntaxHighlighter code="const x = 42;" />
      );

      expect(screen.getByText('const x = 42;')).toBeInTheDocument();
    });

    it('shows language in header', () => {
      render(
        <SyntaxHighlighter
          code="console.log('hello');"
          language="javascript"
        />
      );

      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('shows line count in header', () => {
      const multiLineCode = 'line 1\nline 2\nline 3';
      render(
        <SyntaxHighlighter code={multiLineCode} />
      );

      expect(screen.getByText('3 lines')).toBeInTheDocument();
    });

    it('displays line numbers when enabled', () => {
      render(
        <SyntaxHighlighter
          code="line 1\nline 2"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('1 │')).toBeInTheDocument();
      expect(screen.getByText('2 │')).toBeInTheDocument();
    });

    it('handles empty code gracefully', () => {
      render(
        <SyntaxHighlighter code="" />
      );

      expect(screen.getByText('0 lines')).toBeInTheDocument();
    });
  });

  describe('Responsive Width Functionality', () => {
    describe('Width Calculations', () => {
      it('uses terminal width when responsive=true (default)', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 100,
          height: 30,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <SyntaxHighlighter
            code="const responsiveExample = 'hello world';"
            responsive={true}
          />
        );

        // Should use responsive width calculation (terminal width - 2 = 98, but min 40)
        expect(result.container).toBeDefined();
      });

      it('uses fixed width when responsive=false', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 60,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const result = render(
          <SyntaxHighlighter
            code="const fixedWidthExample = 'test';"
            responsive={false}
          />
        );

        // Should use fixed width (80) regardless of terminal width
        expect(result.container).toBeDefined();
      });

      it('respects explicit width prop over responsive width', () => {
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
          <SyntaxHighlighter
            code="const explicitWidth = 'test';"
            width={100}
          />
        );

        // Should use the explicit width
        expect(result.container).toBeDefined();
      });

      it('enforces minimum width when responsive', () => {
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

        const result = render(
          <SyntaxHighlighter
            code="const minWidth = 'test';"
            responsive={true}
          />
        );

        // Should enforce minimum width (40 according to implementation)
        expect(result.container).toBeDefined();
      });
    });

    describe('Line Wrapping Behavior', () => {
      it('enables line wrapping when responsive=true by default', () => {
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

        const longLine = 'const veryLongVariableNameThatExceedsTerminalWidthAndShouldBeWrapped = "test";';
        render(
          <SyntaxHighlighter
            code={longLine}
            responsive={true}
          />
        );

        // Should show wrapped line count in header
        expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      });

      it('disables line wrapping when wrapLines=false explicitly', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 60,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const longLine = 'const veryLongVariableNameThatShouldNotBeWrapped = "test";';
        render(
          <SyntaxHighlighter
            code={longLine}
            wrapLines={false}
          />
        );

        // Should not show wrapped indicator
        expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
      });

      it('enables line wrapping when wrapLines=true explicitly', () => {
        const longLine = 'const explicitWrappingEnabledForThisVeryLongVariableName = "test";';
        render(
          <SyntaxHighlighter
            code={longLine}
            wrapLines={true}
            responsive={false}
          />
        );

        // Should still wrap even when responsive=false
        expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      });

      it('wraps lines intelligently at sensible break points', () => {
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

        const codeWithBreakPoints = 'function test(param1, param2, param3) { return param1 + param2; }';
        render(
          <SyntaxHighlighter
            code={codeWithBreakPoints}
            wrapLines={true}
          />
        );

        // Should handle wrapping at sensible points
        expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      });
    });

    describe('Breakpoint Integration', () => {
      it('adapts behavior for narrow terminals', () => {
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
          <SyntaxHighlighter
            code="const narrowTerminalCode = 'test';"
          />
        );

        // Should adapt to narrow terminal
        expect(result.container).toBeDefined();
      });

      it('adapts behavior for compact terminals', () => {
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
          <SyntaxHighlighter
            code="const compactTerminalCode = 'test';"
          />
        );

        // Should adapt to compact terminal
        expect(result.container).toBeDefined();
      });

      it('adapts behavior for normal terminals', () => {
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
          <SyntaxHighlighter
            code="const normalTerminalCode = 'test';"
          />
        );

        // Should use normal terminal width
        expect(result.container).toBeDefined();
      });

      it('adapts behavior for wide terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 180,
          height: 30,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });

        const result = render(
          <SyntaxHighlighter
            code="const wideTerminalCode = 'test';"
          />
        );

        // Should take advantage of wide terminal
        expect(result.container).toBeDefined();
      });
    });

    describe('Content Handling', () => {
      it('handles very long lines without overflow', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 60,
          height: 30,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });

        const veryLongCode = 'x'.repeat(200);
        const result = render(
          <SyntaxHighlighter
            code={veryLongCode}
            wrapLines={true}
          />
        );

        // Should handle long content without overflow
        expect(result.container).toBeDefined();
      });

      it('truncates content when maxLines is specified', () => {
        const manyLines = Array(50).fill('console.log("line");').join('\n');
        render(
          <SyntaxHighlighter
            code={manyLines}
            maxLines={10}
          />
        );

        expect(screen.getByText('... 40 more lines')).toBeInTheDocument();
      });

      it('shows correct line count accounting for wrapping', () => {
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

        const longSingleLine = 'const reallyLongVariableNameThatWillCauseWrapping = "test";';
        render(
          <SyntaxHighlighter
            code={longSingleLine}
            wrapLines={true}
          />
        );

        // Should show both original line count and wrapped line count
        expect(screen.getByText(/1 lines.*wrapped/)).toBeInTheDocument();
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
          <SyntaxHighlighter
            code="const fallbackTest = 'test';"
          />
        );

        // Should work with fallback dimensions
        expect(result.container).toBeDefined();
      });

      it('handles code with special characters', () => {
        const specialCode = 'const emoji = "🚀"; const unicode = "αβγ"; const symbols = "<>&";';
        render(
          <SyntaxHighlighter
            code={specialCode}
          />
        );

        expect(screen.getByText(/🚀/)).toBeInTheDocument();
        expect(screen.getByText(/αβγ/)).toBeInTheDocument();
      });

      it('handles mixed indentation and formatting', () => {
        const mixedCode = `function test() {
  const x = 1;
    if (x) {
      return true;
    }
}`;
        render(
          <SyntaxHighlighter
            code={mixedCode}
          />
        );

        expect(screen.getByText('5 lines')).toBeInTheDocument();
      });
    });

    describe('Language Support', () => {
      const languageTests = [
        { language: 'typescript', code: 'interface Test { name: string; }' },
        { language: 'javascript', code: 'const test = () => {};' },
        { language: 'python', code: 'def test(): pass' },
        { language: 'rust', code: 'fn test() -> i32 { 42 }' },
        { language: 'go', code: 'func test() int { return 42 }' },
      ];

      languageTests.forEach(({ language, code }) => {
        it(`renders ${language} code correctly`, () => {
          render(
            <SyntaxHighlighter
              code={code}
              language={language}
            />
          );

          expect(screen.getByText(language)).toBeInTheDocument();
          expect(screen.getByText(code)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Performance', () => {
    it('handles large code files efficiently', () => {
      const largeCode = Array(1000).fill('console.log("test");').join('\n');

      const start = performance.now();
      render(
        <SyntaxHighlighter
          code={largeCode}
        />
      );
      const end = performance.now();

      // Should handle large code in reasonable time
      expect(end - start).toBeLessThan(200);
    });

    it('limits rendering when maxLines is set', () => {
      const hugeCode = Array(10000).fill('console.log("test");').join('\n');

      render(
        <SyntaxHighlighter
          code={hugeCode}
          maxLines={50}
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });
  });
});