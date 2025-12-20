import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorDisplay } from '../ErrorDisplay';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('ErrorDisplay Stack Trace Coverage Tests', () => {
  const createStackError = (lines: number = 15): Error => {
    const error = new Error('Stack trace coverage test error');
    const stackLines = [
      'Error: Stack trace coverage test error',
      '    at TestFunction (file:///src/test.ts:42:15)',
      '    at handleClick (file:///src/button.ts:87:20)',
      '    at onClick (file:///src/page.ts:156:10)',
      '    at processEvent (file:///src/utils.ts:25:5)',
      '    at EventHandler (file:///src/events.ts:89:12)',
      '    at processQueue (node:internal/process.js:61:5)',
      '    at runNextTick (node:internal/timers.js:437:3)',
      '    at runInThisContext (vm.js:74:17)',
      '    at Module.compile (module.js:460:26)',
      '    at Object.extensions.js (module.js:478:10)',
      '    at Module.load (module.js:355:32)',
      '    at Function.load (module.js:310:12)',
      '    at Function.runMain (module.js:501:10)',
      '    at startup (bootstrap.js:283:19)',
      '    at main_module.js:17:47',
    ];

    error.stack = stackLines.slice(0, Math.min(lines, stackLines.length)).join('\n');
    return error;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stack trace responsive configuration matrix', () => {
    const testMatrix = [
      // [breakpoint, width, verbose, expectedBehavior]
      ['narrow', 45, false, { shouldShow: false, maxLines: 0 }],
      ['narrow', 45, true, { shouldShow: true, maxLines: 3 }],
      ['compact', 70, false, { shouldShow: false, maxLines: 0 }],
      ['compact', 70, true, { shouldShow: true, maxLines: 5 }],
      ['normal', 100, false, { shouldShow: true, maxLines: 5 }],
      ['normal', 100, true, { shouldShow: true, maxLines: 10 }],
      ['wide', 160, false, { shouldShow: true, maxLines: 8 }],
      ['wide', 160, true, { shouldShow: true, maxLines: Infinity }],
    ] as const;

    testMatrix.forEach(([breakpoint, width, verbose, expected]) => {
      describe(`${breakpoint} breakpoint (${width}px, verbose: ${verbose})`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 24,
            breakpoint,
            isNarrow: breakpoint === 'narrow',
            isCompact: breakpoint === 'compact',
            isNormal: breakpoint === 'normal',
            isWide: breakpoint === 'wide',
            isAvailable: true,
          });
        });

        it(`should ${expected.shouldShow ? 'show' : 'hide'} stack trace with max ${expected.maxLines} lines`, () => {
          const stackError = createStackError(15);

          render(
            <ErrorDisplay
              error={stackError}
              showStack={true}
              verbose={verbose}
            />
          );

          if (!expected.shouldShow) {
            expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
            return;
          }

          if (expected.maxLines === Infinity) {
            // Should show full stack without line count
            expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
            expect(screen.queryByText(/Stack Trace \(\d+ lines\):/)).not.toBeInTheDocument();
            expect(screen.queryByText(/... \d+ more lines/)).not.toBeInTheDocument();
          } else {
            // Should show limited stack with line count
            expect(screen.getByText(`Stack Trace (${expected.maxLines} lines):`)).toBeInTheDocument();
            const totalLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
            if (totalLines > expected.maxLines) {
              expect(screen.getByText(`... ${totalLines - expected.maxLines} more lines (use verbose mode to see full trace)`)).toBeInTheDocument();
            }
          }

          // Verify correct number of stack lines are shown
          const stackLineElements = screen.getAllByText(/at \w+/);
          if (expected.maxLines === Infinity) {
            expect(stackLineElements.length).toBe(14); // 15 total - 1 error line
          } else {
            expect(stackLineElements.length).toBeLessThanOrEqual(expected.maxLines);
          }
        });

        it('should handle line truncation based on terminal width', () => {
          const longLineError = new Error('Test');
          longLineError.stack = `Error: Test
    at veryLongFunctionNameThatShouldBeTruncatedBasedOnTerminalWidth (file:///very/long/path/to/file/that/might/exceed/available/space.js:100:25)
    at anotherVeryLongFunctionName (file:///another/very/long/path/name.js:200:15)`;

          render(
            <ErrorDisplay
              error={longLineError}
              showStack={true}
              verbose={verbose}
            />
          );

          if (expected.shouldShow) {
            const stackLines = screen.getAllByText(/at veryLongFunctionNameThatShouldBeTruncated/);
            if (width < 100) {
              // Should be truncated in smaller terminals
              expect(stackLines.some(line => line.textContent?.includes('...'))).toBe(true);
            }
          }
        });
      });
    });
  });

  describe('Stack trace content verification', () => {
    beforeEach(() => {
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

    it('should display stack trace lines in correct order', () => {
      const stackError = createStackError(10);

      render(
        <ErrorDisplay error={stackError} showStack={true} verbose={true} />
      );

      // Should show first few lines in order
      expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
      expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
      expect(screen.getByText(/at onClick/)).toBeInTheDocument();
      expect(screen.getByText(/at processEvent/)).toBeInTheDocument();
      expect(screen.getByText(/at EventHandler/)).toBeInTheDocument();
    });

    it('should handle stack traces with varying line lengths', () => {
      const mixedLengthError = new Error('Mixed length test');
      mixedLengthError.stack = `Error: Mixed length test
    at short (a.js:1:1)
    at veryLongFunctionNameWithManyCharactersThatExceedsNormalLineLengthAndShouldBeTruncated (very/long/file/path/that/exceeds/normal/terminal/width.js:999:999)
    at medium (file.js:10:5)`;

      render(
        <ErrorDisplay error={mixedLengthError} showStack={true} verbose={false} />
      );

      expect(screen.getByText(/at short/)).toBeInTheDocument();
      expect(screen.getByText(/at veryLongFunctionNameWithManyCharacters/)).toBeInTheDocument();
      expect(screen.getByText(/at medium/)).toBeInTheDocument();
    });
  });

  describe('Stack trace with showStack prop variations', () => {
    beforeEach(() => {
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

    it('should not show stack trace when showStack=false', () => {
      const stackError = createStackError(10);

      render(
        <ErrorDisplay error={stackError} showStack={false} verbose={true} />
      );

      expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
      expect(screen.queryByText(/at TestFunction/)).not.toBeInTheDocument();
    });

    it('should show error message even when stack trace is hidden', () => {
      const stackError = createStackError(10);

      render(
        <ErrorDisplay error={stackError} showStack={false} verbose={true} />
      );

      expect(screen.getByText('Stack trace coverage test error')).toBeInTheDocument();
    });
  });

  describe('Edge cases for stack trace display', () => {
    beforeEach(() => {
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

    it('should handle errors with no stack property', () => {
      const errorWithoutStack = new Error('No stack error');
      delete (errorWithoutStack as any).stack;

      render(
        <ErrorDisplay error={errorWithoutStack} showStack={true} verbose={true} />
      );

      expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
      expect(screen.getByText('No stack error')).toBeInTheDocument();
    });

    it('should handle errors with empty stack', () => {
      const errorWithEmptyStack = new Error('Empty stack error');
      errorWithEmptyStack.stack = '';

      render(
        <ErrorDisplay error={errorWithEmptyStack} showStack={true} verbose={true} />
      );

      expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
      expect(screen.getByText('Empty stack error')).toBeInTheDocument();
    });

    it('should handle stack with only error message line', () => {
      const singleLineError = new Error('Single line error');
      singleLineError.stack = 'Error: Single line error';

      render(
        <ErrorDisplay error={singleLineError} showStack={true} verbose={true} />
      );

      expect(screen.getByText(/Stack Trace \(5 lines\):/)).toBeInTheDocument();
      expect(screen.getByText('Error: Single line error')).toBeInTheDocument();
      expect(screen.queryByText(/... \d+ more lines/)).not.toBeInTheDocument();
    });

    it('should handle very short stacks gracefully', () => {
      const shortStackError = createStackError(3);

      render(
        <ErrorDisplay error={shortStackError} showStack={true} verbose={true} />
      );

      expect(screen.getByText(/Stack Trace \(5 lines\):/)).toBeInTheDocument();
      expect(screen.queryByText(/... \d+ more lines/)).not.toBeInTheDocument();
    });
  });

  describe('Integration with explicit width prop', () => {
    it('should use breakpoint from hook even with explicit width', () => {
      // Mock narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const stackError = createStackError(10);

      render(
        <ErrorDisplay
          error={stackError}
          showStack={true}
          verbose={true}
          width={120} // Explicit width for component sizing
        />
      );

      // Should still use narrow breakpoint behavior (3 lines)
      expect(screen.getByText(/Stack Trace \(3 lines\):/)).toBeInTheDocument();
    });
  });

  describe('Stack trace performance', () => {
    beforeEach(() => {
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

    it('should handle very large stack traces efficiently', () => {
      // Create a large stack trace (50 lines)
      const largeStackError = new Error('Large stack error');
      const lines = ['Error: Large stack error'];
      for (let i = 1; i <= 50; i++) {
        lines.push(`    at function${i} (file${i}.js:${i}:${i})`);
      }
      largeStackError.stack = lines.join('\n');

      const startTime = performance.now();

      render(
        <ErrorDisplay error={largeStackError} showStack={true} verbose={true} />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render efficiently (less than 50ms for large stack)
      expect(renderTime).toBeLessThan(50);

      // Should still limit display appropriately
      expect(screen.getByText(/Stack Trace \(10 lines\):/)).toBeInTheDocument();
      expect(screen.getByText(/... 40 more lines/)).toBeInTheDocument();
    });
  });
});