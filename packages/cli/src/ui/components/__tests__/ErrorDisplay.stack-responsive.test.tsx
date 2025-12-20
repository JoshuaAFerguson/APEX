import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorDisplay } from '../ErrorDisplay';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('ErrorDisplay Stack Trace Responsive Behavior Matrix', () => {
  // Create a realistic stack trace for testing
  const stackError = new Error('Test error for stack trace responsiveness');
  stackError.stack = `Error: Test error for stack trace responsiveness
    at TestFunction (file:///Users/test/src/components/TestComponent.tsx:42:15)
    at handleClick (file:///Users/test/src/components/Button.tsx:87:20)
    at onClick (file:///Users/test/src/pages/HomePage.tsx:156:10)
    at callHandler (file:///Users/test/node_modules/react/lib/ReactDOMComponent.js:255:12)
    at Object.ReactDOMComponent.handleClick (file:///Users/test/node_modules/react/lib/ReactDOMComponent.js:274:8)
    at processNextTick (node:internal/process/task_queues.js:61:5)
    at process.processImmediate (node:internal/timers.js:437:3)
    at Object.exports.runInThisContext (vm.js:74:17)
    at Module._compile (module.js:460:26)
    at Object.Module._extensions..js (module.js:478:10)
    at Module.load (module.js:355:32)
    at Function.Module._load (module.js:310:12)
    at Function.Module.runMain (module.js:501:10)
    at startup (node:internal/bootstrap/node.js:283:19)
    at node:internal/main/run_main_module.js:17:47`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: Stack trace responsive behavior matrix', () => {
    describe('Narrow terminal (<60 chars) - breakpoint: narrow', () => {
      beforeEach(() => {
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
      });

      it('should NOT show stack trace in non-verbose mode (normal: 0)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={false} />);

        expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
        expect(screen.queryByText(/at TestFunction/)).not.toBeInTheDocument();
        expect(screen.queryByText(/at handleClick/)).not.toBeInTheDocument();
      });

      it('should show exactly 3 lines in verbose mode (verbose: 3)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);

        // Should show header with line count
        expect(screen.getByText(/Stack Trace \(3 lines\):/)).toBeInTheDocument();

        // Should show first 3 stack trace lines
        expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
        expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
        expect(screen.getByText(/at onClick/)).toBeInTheDocument();

        // Should NOT show 4th line and beyond
        expect(screen.queryByText(/at callHandler/)).not.toBeInTheDocument();
        expect(screen.queryByText(/at Object.ReactDOMComponent/)).not.toBeInTheDocument();

        // Should show "more lines" indicator
        const stackLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
        expect(screen.getByText(new RegExp(`... ${stackLines - 3} more lines \\(use verbose mode to see full trace\\)`))).toBeInTheDocument();
      });

      it('should truncate long stack trace lines to fit narrow width', () => {
        const longLineError = new Error('Test');
        longLineError.stack = `Error: Test
    at veryLongFunctionNameThatExceedsAvailableTerminalWidth (file:///very/long/path/to/file/with/very/long/filename.js:100:25)
    at anotherVeryLongFunctionName (file:///another/very/long/path/to/another/file.js:200:15)`;

        render(<ErrorDisplay error={longLineError} showStack={true} verbose={true} />);

        // Stack trace lines should be truncated for narrow terminals (width - 4 = 41 chars)
        const stackLines = screen.getAllByText(/at veryLongFunctionNameThatExceedsAvailableTerminalWidth/);
        expect(stackLines.some(line => line.textContent?.includes('...'))).toBe(true);
      });
    });

    describe('Compact terminal (60-100 chars) - breakpoint: compact', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 24,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });
      });

      it('should NOT show stack trace in non-verbose mode (normal: 0)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={false} />);

        expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
        expect(screen.queryByText(/at TestFunction/)).not.toBeInTheDocument();
      });

      it('should show exactly 5 lines in verbose mode (verbose: 5)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);

        // Should show header with line count
        expect(screen.getByText(/Stack Trace \(5 lines\):/)).toBeInTheDocument();

        // Should show first 5 stack trace lines
        expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
        expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
        expect(screen.getByText(/at onClick/)).toBeInTheDocument();
        expect(screen.getByText(/at callHandler/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.ReactDOMComponent/)).toBeInTheDocument();

        // Should NOT show 6th line and beyond
        expect(screen.queryByText(/at processNextTick/)).not.toBeInTheDocument();
        expect(screen.queryByText(/at process.processImmediate/)).not.toBeInTheDocument();

        // Should show "more lines" indicator
        const stackLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
        expect(screen.getByText(new RegExp(`... ${stackLines - 5} more lines \\(use verbose mode to see full trace\\)`))).toBeInTheDocument();
      });
    });

    describe('Normal terminal (100-160 chars) - breakpoint: normal', () => {
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

      it('should show exactly 5 lines in non-verbose mode (normal: 5)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={false} />);

        // Should show header with line count
        expect(screen.getByText(/Stack Trace \(5 lines\):/)).toBeInTheDocument();

        // Should show first 5 stack trace lines
        expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
        expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
        expect(screen.getByText(/at onClick/)).toBeInTheDocument();
        expect(screen.getByText(/at callHandler/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.ReactDOMComponent/)).toBeInTheDocument();

        // Should NOT show 6th line and beyond
        expect(screen.queryByText(/at processNextTick/)).not.toBeInTheDocument();

        // Should show "more lines" indicator
        const stackLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
        expect(screen.getByText(new RegExp(`... ${stackLines - 5} more lines \\(use verbose mode to see full trace\\)`))).toBeInTheDocument();
      });

      it('should show exactly 10 lines in verbose mode (verbose: 10)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);

        // Should show header with line count
        expect(screen.getByText(/Stack Trace \(10 lines\):/)).toBeInTheDocument();

        // Should show first 10 stack trace lines
        expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
        expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
        expect(screen.getByText(/at onClick/)).toBeInTheDocument();
        expect(screen.getByText(/at callHandler/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.ReactDOMComponent/)).toBeInTheDocument();
        expect(screen.getByText(/at processNextTick/)).toBeInTheDocument();
        expect(screen.getByText(/at process.processImmediate/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.exports.runInThisContext/)).toBeInTheDocument();
        expect(screen.getByText(/at Module._compile/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.Module._extensions/)).toBeInTheDocument();

        // Should NOT show 11th line and beyond
        expect(screen.queryByText(/at Module.load/)).not.toBeInTheDocument();

        // Should show "more lines" indicator for remaining lines
        const stackLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
        expect(screen.getByText(new RegExp(`... ${stackLines - 10} more lines \\(use verbose mode to see full trace\\)`))).toBeInTheDocument();
      });
    });

    describe('Wide terminal (≥160 chars) - breakpoint: wide', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 180,
          height: 40,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });
      });

      it('should show exactly 8 lines in non-verbose mode (normal: 8)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={false} />);

        // Should show header with line count
        expect(screen.getByText(/Stack Trace \(8 lines\):/)).toBeInTheDocument();

        // Should show first 8 stack trace lines
        expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
        expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
        expect(screen.getByText(/at onClick/)).toBeInTheDocument();
        expect(screen.getByText(/at callHandler/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.ReactDOMComponent/)).toBeInTheDocument();
        expect(screen.getByText(/at processNextTick/)).toBeInTheDocument();
        expect(screen.getByText(/at process.processImmediate/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.exports.runInThisContext/)).toBeInTheDocument();

        // Should NOT show 9th line and beyond
        expect(screen.queryByText(/at Module._compile/)).not.toBeInTheDocument();

        // Should show "more lines" indicator for remaining lines
        const stackLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
        expect(screen.getByText(new RegExp(`... ${stackLines - 8} more lines \\(use verbose mode to see full trace\\)`))).toBeInTheDocument();
      });

      it('should show ALL lines in verbose mode (verbose: Infinity)', () => {
        render(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);

        // Should show header WITHOUT line count for full trace
        expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
        expect(screen.queryByText(/Stack Trace \(\d+ lines\):/)).not.toBeInTheDocument();

        // Should show ALL stack trace lines
        expect(screen.getByText(/at TestFunction/)).toBeInTheDocument();
        expect(screen.getByText(/at handleClick/)).toBeInTheDocument();
        expect(screen.getByText(/at onClick/)).toBeInTheDocument();
        expect(screen.getByText(/at callHandler/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.ReactDOMComponent/)).toBeInTheDocument();
        expect(screen.getByText(/at processNextTick/)).toBeInTheDocument();
        expect(screen.getByText(/at process.processImmediate/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.exports.runInThisContext/)).toBeInTheDocument();
        expect(screen.getByText(/at Module._compile/)).toBeInTheDocument();
        expect(screen.getByText(/at Object.Module._extensions/)).toBeInTheDocument();
        expect(screen.getByText(/at Module.load/)).toBeInTheDocument();
        expect(screen.getByText(/at Function.Module._load/)).toBeInTheDocument();
        expect(screen.getByText(/at Function.Module.runMain/)).toBeInTheDocument();
        expect(screen.getByText(/at startup/)).toBeInTheDocument();
        expect(screen.getByText(/at node:internal\/main\/run_main_module.js/)).toBeInTheDocument();

        // Should NOT show "more lines" indicator since all lines are shown
        expect(screen.queryByText(/... \d+ more lines/)).not.toBeInTheDocument();
      });

      it('should not truncate stack trace lines in wide terminal', () => {
        const longLineError = new Error('Test');
        longLineError.stack = `Error: Test
    at veryLongFunctionNameThatShouldNotBeTruncatedInWideTerminals (file:///very/long/path/to/file/that/should/be/visible/in/full/detail.js:100:25)`;

        render(<ErrorDisplay error={longLineError} showStack={true} verbose={true} />);

        // Long lines should NOT be truncated in wide terminals
        expect(screen.getByText(/veryLongFunctionNameThatShouldNotBeTruncatedInWideTerminals/)).toBeInTheDocument();
        expect(screen.getByText(/file:\/\/\/very\/long\/path\/to\/file\/that\/should\/be\/visible\/in\/full\/detail\.js/)).toBeInTheDocument();
      });
    });

    describe('Stack trace configuration matrix validation', () => {
      const testCases = [
        // [breakpoint, verbose, expectedLines]
        ['narrow', false, 0],
        ['narrow', true, 3],
        ['compact', false, 0],
        ['compact', true, 5],
        ['normal', false, 5],
        ['normal', true, 10],
        ['wide', false, 8],
        ['wide', true, Infinity],
      ] as const;

      testCases.forEach(([breakpoint, verbose, expectedLines]) => {
        it(`should show ${expectedLines === Infinity ? 'all' : expectedLines} lines for ${breakpoint} + verbose=${verbose}`, () => {
          const width = {
            narrow: 45,
            compact: 80,
            normal: 120,
            wide: 180
          }[breakpoint];

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

          render(<ErrorDisplay error={stackError} showStack={true} verbose={verbose} />);

          if (expectedLines === 0) {
            expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
          } else if (expectedLines === Infinity) {
            expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
            expect(screen.queryByText(/... \d+ more lines/)).not.toBeInTheDocument();
          } else {
            expect(screen.getByText(new RegExp(`Stack Trace \\(${expectedLines} lines\\):`))).toBeInTheDocument();
            const totalLines = stackError.stack!.split('\n').filter(line => line.trim()).length;
            if (totalLines > expectedLines) {
              expect(screen.getByText(new RegExp(`... ${totalLines - expectedLines} more lines`))).toBeInTheDocument();
            }
          }
        });
      });
    });

    describe('Edge cases and error handling', () => {
      it('should handle string errors (no stack trace) gracefully', () => {
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

        render(<ErrorDisplay error="String error with no stack" showStack={true} verbose={true} />);

        expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
        expect(screen.getByText('String error with no stack')).toBeInTheDocument();
      });

      it('should handle Error objects with no stack property', () => {
        const errorWithoutStack = new Error('Error without stack');
        delete errorWithoutStack.stack;

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

        render(<ErrorDisplay error={errorWithoutStack} showStack={true} verbose={true} />);

        expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
        expect(screen.getByText('Error without stack')).toBeInTheDocument();
      });

      it('should handle empty stack traces', () => {
        const errorWithEmptyStack = new Error('Error with empty stack');
        errorWithEmptyStack.stack = '';

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

        render(<ErrorDisplay error={errorWithEmptyStack} showStack={true} verbose={true} />);

        expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
        expect(screen.getByText('Error with empty stack')).toBeInTheDocument();
      });

      it('should handle single-line stack traces', () => {
        const singleLineError = new Error('Single line error');
        singleLineError.stack = 'Error: Single line error';

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

        render(<ErrorDisplay error={singleLineError} showStack={true} verbose={true} />);

        expect(screen.getByText(/Stack Trace \(5 lines\):/)).toBeInTheDocument();
        expect(screen.getByText('Error: Single line error')).toBeInTheDocument();
        expect(screen.queryByText(/... \d+ more lines/)).not.toBeInTheDocument();
      });

      it('should respect showStack=false regardless of terminal width or verbose mode', () => {
        const widthTests = [45, 80, 120, 180];
        const verboseTests = [true, false];

        widthTests.forEach(width => {
          verboseTests.forEach(verbose => {
            const breakpoint = width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide';

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

            const { unmount } = render(
              <ErrorDisplay error={stackError} showStack={false} verbose={verbose} />
            );

            expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
            expect(screen.queryByText(/at TestFunction/)).not.toBeInTheDocument();

            unmount();
          });
        });
      });
    });

    describe('Integration with useStdoutDimensions hook', () => {
      it('should respond to breakpoint changes correctly', () => {
        let currentWidth = 45;

        // Mock that updates based on current width
        mockUseStdoutDimensions.mockImplementation(() => {
          const breakpoint = currentWidth < 60 ? 'narrow' : currentWidth < 100 ? 'compact' : currentWidth < 160 ? 'normal' : 'wide';
          return {
            width: currentWidth,
            height: 24,
            breakpoint,
            isNarrow: breakpoint === 'narrow',
            isCompact: breakpoint === 'compact',
            isNormal: breakpoint === 'normal',
            isWide: breakpoint === 'wide',
            isAvailable: true,
          };
        });

        const { rerender } = render(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);

        // Start narrow (3 lines)
        expect(screen.getByText(/Stack Trace \(3 lines\):/)).toBeInTheDocument();

        // Change to wide (all lines)
        currentWidth = 180;
        rerender(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);
        expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
        expect(screen.queryByText(/Stack Trace \(\d+ lines\):/)).not.toBeInTheDocument();

        // Change to normal (10 lines)
        currentWidth = 120;
        rerender(<ErrorDisplay error={stackError} showStack={true} verbose={true} />);
        expect(screen.getByText(/Stack Trace \(10 lines\):/)).toBeInTheDocument();
      });

      it('should handle explicit width override', () => {
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

        // But provide explicit width for normal breakpoint
        render(<ErrorDisplay error={stackError} showStack={true} verbose={true} width={120} />);

        // Should still use breakpoint from hook (not derived from width prop)
        expect(screen.getByText(/Stack Trace \(3 lines\):/)).toBeInTheDocument();
      });
    });
  });
});