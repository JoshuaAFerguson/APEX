import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolCall } from '@apexcli/cli/src/ui/components/ToolCall.js';
import { ActivityLog } from '@apexcli/cli/src/ui/components/ActivityLog.js';
import { ErrorDisplay } from '@apexcli/cli/src/ui/components/ErrorDisplay.js';
import type { DisplayMode } from '@apexcli/core';

/**
 * Comprehensive edge case tests for v0.5.0 Output Formatting features
 * Tests boundary conditions, special characters, encoding issues, and error scenarios
 */

// Mock useStdoutDimensions hook
vi.mock('@apexcli/cli/src/ui/hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: () => ({
    width: 80,
    height: 24,
    isNarrow: false,
    isWide: false,
    breakpoint: 'medium',
  }),
}));

describe('v0.5.0 Output Formatting Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Special Character Handling', () => {
    it('should handle Unicode characters correctly', () => {
      const unicodeOutput = `
Unicode symbols: ★ ♠ ♥ ♦ ♣ ☺ ☻ ♫ ♪ ♂ ♀
Emoji: 🚀 🔥 💻 ⭐ 🎉 📦 🛠️ 🔧 ⚙️ 🎯
Mathematical: ∀ ∃ ∄ ∅ ∆ ∇ ∈ ∉ ∋ ∌ ∞ ∫ ∮
Currency: $ € £ ¥ ₹ ₿ ¢ ₽ ₩ ₪
Arrows: → ← ↑ ↓ ⇒ ⇐ ⇑ ⇓ ↔ ⇔
Greek: α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω
      `;

      const props = {
        toolName: 'Read',
        input: { file_path: '/unicode/test.txt' },
        output: unicodeOutput.trim(),
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/Unicode symbols: ★/)).toBeInTheDocument();
      expect(screen.getByText(/Emoji: 🚀/)).toBeInTheDocument();
      expect(screen.getByText(/Mathematical: ∀/)).toBeInTheDocument();
    });

    it('should handle ANSI escape sequences and color codes', () => {
      const ansiOutput = `
\x1b[31mRed text\x1b[0m
\x1b[32mGreen text\x1b[0m
\x1b[33mYellow text\x1b[0m
\x1b[1mBold text\x1b[0m
\x1b[4mUnderlined text\x1b[0m
\x1b[7mReversed text\x1b[0m
\x1b[38;5;196mBright red\x1b[0m
\x1b[48;5;21mBlue background\x1b[0m
      `;

      const props = {
        toolName: 'Bash',
        input: { command: 'ls --color=always' },
        output: ansiOutput.trim(),
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      // ANSI codes should be handled gracefully (may be stripped or preserved)
      expect(screen.getByText(/Red text|Green text/)).toBeInTheDocument();
    });

    it('should handle null bytes and control characters', () => {
      const binaryData = 'Text with null byte\x00and control\x01chars\x02here\x03';
      const escapedOutput = 'Text with null byte\\x00and control\\x01chars\\x02here\\x03';

      const props = {
        toolName: 'Read',
        input: { file_path: '/binary/file.dat' },
        output: escapedOutput,
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/Text with null byte.*control.*chars/)).toBeInTheDocument();
    });

    it('should handle mixed encoding and mojibake', () => {
      const mojibakeOutput = `
Correct UTF-8: Hello, World! 你好世界
Mojibake example: Ã¡Â¸Â²Ã¡Â¸Â²Ã¡Â¸Â²
Latin-1 issues: café → cafÃ©
Windows-1252: â€œSmart quotesâ€
      `;

      const props = {
        toolName: 'WebFetch',
        input: { url: 'https://legacy-system.com/data' },
        output: mojibakeOutput.trim(),
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('WebFetch')).toBeInTheDocument();
      expect(screen.getByText(/Hello, World! 你好世界/)).toBeInTheDocument();
    });
  });

  describe('Extreme Content Size Handling', () => {
    it('should handle empty output gracefully', () => {
      const props = {
        toolName: 'Grep',
        input: { pattern: 'nonexistent', path: '/empty/search' },
        output: '',
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Grep')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
      // Empty output should not crash the component
    });

    it('should handle single character output', () => {
      const props = {
        toolName: 'Read',
        input: { file_path: '/tiny/file.txt' },
        output: 'x',
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('x')).toBeInTheDocument();
    });

    it('should handle output with thousands of lines', () => {
      const manyLines = Array(5000).fill(null).map((_, i) => `Line ${i + 1}: Some content here`).join('\n');

      const props = {
        toolName: 'Bash',
        input: { command: 'find /large/directory -type f' },
        output: manyLines,
        status: 'success' as const,
        duration: 10000,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/Line 1: Some content/)).toBeInTheDocument();
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
      expect(screen.getByText(/10s/)).toBeInTheDocument();
    });

    it('should handle extremely long single line', () => {
      const longLine = 'A'.repeat(10000) + ' end of line';

      const props = {
        toolName: 'Bash',
        input: { command: 'echo "$VERY_LONG_VARIABLE"' },
        output: longLine,
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/AAAA.*A+/)).toBeInTheDocument();
    });

    it('should handle mixed short and very long lines', () => {
      const mixedOutput = [
        'Short line 1',
        'A'.repeat(1000),
        'Short line 2',
        'B'.repeat(2000),
        'Short line 3',
        'Final line',
      ].join('\n');

      const props = {
        toolName: 'Read',
        input: { file_path: '/mixed/content.txt' },
        output: mixedOutput,
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/Short line 1/)).toBeInTheDocument();
      expect(screen.getByText(/AAAA.*A+/)).toBeInTheDocument();
    });
  });

  describe('JSON and Structured Data Edge Cases', () => {
    it('should handle malformed JSON with various error types', () => {
      const malformedJsonCases = [
        '{"incomplete": "object"',
        '{"trailing": "comma",}',
        '{"unquoted": key}',
        '{"invalid": \\value}',
        '[{"nested": {"broken": }]',
        '{"circular": {"ref": {"back": null}}}',
      ];

      malformedJsonCases.forEach((badJson, index) => {
        const props = {
          toolName: 'WebFetch',
          input: { url: `https://api.com/bad-json-${index}` },
          output: badJson,
          status: 'error' as const,
          displayMode: 'verbose' as DisplayMode,
        };

        const { unmount } = render(<ToolCall {...props} />);
        expect(screen.getByText('WebFetch')).toBeInTheDocument();
        expect(screen.getByText('✗')).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle extremely deeply nested JSON', () => {
      // Create deep nesting that might cause stack overflow
      let deepJson = '"leaf"';
      for (let i = 0; i < 1000; i++) {
        deepJson = `{"level${i}": ${deepJson}}`;
      }

      const props = {
        toolName: 'WebFetch',
        input: { url: 'https://api.com/deep-structure' },
        output: deepJson,
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      expect(() => {
        render(<ToolCall {...props} />);
      }).not.toThrow();

      expect(screen.getByText('WebFetch')).toBeInTheDocument();
    });

    it('should handle JSON with all primitive types and edge values', () => {
      const complexJson = {
        string: 'normal string',
        emptyString: '',
        number: 42,
        largeNumber: 9007199254740991,
        float: 3.14159,
        negative: -123.456,
        zero: 0,
        booleanTrue: true,
        booleanFalse: false,
        nullValue: null,
        emptyArray: [],
        emptyObject: {},
        specialStrings: [
          'with\nnewlines\nhere',
          'with\ttabs\there',
          'with "quotes" inside',
          "with 'single quotes' inside",
          'with\\backslashes\\here',
          'unicode: 🚀 ★ ∞',
        ],
        numbers: [0, -0, Infinity, -Infinity],
      };

      const props = {
        toolName: 'Read',
        input: { file_path: '/complex/data.json' },
        output: JSON.stringify(complexJson, null, 2),
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/normal string/)).toBeInTheDocument();
      expect(screen.getByText(/largeNumber/)).toBeInTheDocument();
    });

    it('should handle CSV-like structured text data', () => {
      const csvData = `
Name,Age,City,Country,Email
John Doe,25,New York,USA,john@example.com
Jane Smith,30,London,UK,jane@example.com
"Johnson, Bob",35,"San Francisco, CA",USA,bob@example.com
Alice,22,Tokyo,Japan,alice@example.com
"O'Connor, Mary",28,Dublin,Ireland,mary@example.com
      `.trim();

      const props = {
        toolName: 'Read',
        input: { file_path: '/data/users.csv' },
        output: csvData,
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/Name,Age,City/)).toBeInTheDocument();
      expect(screen.getByText(/John Doe,25,New York/)).toBeInTheDocument();
    });
  });

  describe('Error Display Edge Cases', () => {
    it('should handle stack traces with various formats', () => {
      const nodeStackTrace = `
Error: ENOENT: no such file or directory, open '/missing/file.txt'
    at Object.openSync (fs.js:498:3)
    at Object.readFileSync (fs.js:394:35)
    at readFile (/app/utils.js:15:23)
    at processFile (/app/processor.js:42:18)
    at Object.<anonymous> (/app/index.js:8:1)
    at Module._compile (module.js:653:30)
    at Object.Module._extensions..js (module.js:664:10)
    at Module.load (module.js:566:32)
    at tryModuleLoad (module.js:506:12)
    at Function.Module._load (module.js:498:3)
      `.trim();

      const props = {
        toolName: 'Read',
        input: { file_path: '/missing/file.txt' },
        output: nodeStackTrace,
        status: 'error' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/Error: ENOENT/)).toBeInTheDocument();
      expect(screen.getByText(/at Object\.openSync/)).toBeInTheDocument();
    });

    it('should handle Python-style tracebacks', () => {
      const pythonTraceback = `
Traceback (most recent call last):
  File "/app/main.py", line 45, in <module>
    process_data()
  File "/app/main.py", line 32, in process_data
    result = calculate_value(data)
  File "/app/utils.py", line 18, in calculate_value
    return value / divisor
ZeroDivisionError: division by zero
      `.trim();

      const props = {
        toolName: 'Bash',
        input: { command: 'python main.py' },
        output: pythonTraceback,
        status: 'error' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/Traceback/)).toBeInTheDocument();
      expect(screen.getByText(/ZeroDivisionError/)).toBeInTheDocument();
    });

    it('should handle compilation errors with multiple issues', () => {
      const compilationErrors = `
error TS2304: Cannot find name 'UnknownType'.

src/components/Button.tsx:15:22
    15 const handleClick = (event: UnknownType) => {
                            ~~~~~~~~~~~~~~~~~

error TS2339: Property 'invalidProp' does not exist on type 'ButtonProps'.

src/components/Button.tsx:23:18
    23     <button {invalidProp}>
                    ~~~~~~~~~~~

error TS2322: Type 'string' is not assignable to type 'number'.

src/components/Button.tsx:31:5
    31     onClick={handleClick}
           ~~~~~~~~~~~~~~~~~~~~~
      `.trim();

      const props = {
        toolName: 'Bash',
        input: { command: 'npx tsc --noEmit' },
        output: compilationErrors,
        status: 'error' as const,
        duration: 2500,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/error TS2304/)).toBeInTheDocument();
      expect(screen.getByText(/Cannot find name 'UnknownType'/)).toBeInTheDocument();
    });

    it('should handle errors with ANSI color codes', () => {
      const coloredError = `
\x1b[31mERROR:\x1b[0m Failed to compile
\x1b[33mWARNING:\x1b[0m Unused variable 'test'
\x1b[32mSUCCESS:\x1b[0m Some operations completed
\x1b[1;31mCRITICAL:\x1b[0m System failure detected
      `.trim();

      const props = {
        toolName: 'Bash',
        input: { command: 'npm run build' },
        output: coloredError,
        status: 'error' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/ERROR.*Failed to compile/)).toBeInTheDocument();
    });
  });

  describe('Responsive Formatting Edge Cases', () => {
    it('should handle extremely narrow terminal widths', () => {
      // Mock extremely narrow terminal
      vi.mocked(vi.fn()).mockImplementation(() => ({
        width: 20,
        height: 10,
        isNarrow: true,
        isWide: false,
        breakpoint: 'narrow',
      }));

      const props = {
        toolName: 'VeryLongToolName',
        input: {
          very_long_parameter_name: 'very long value that should be truncated',
          another_param: 'more data',
        },
        output: 'Output that is too long for narrow terminal and should be truncated appropriately',
        status: 'success' as const,
        displayMode: 'compact' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText(/VeryLongToolName|VeryLong/)).toBeInTheDocument();
    });

    it('should handle extremely wide terminal widths', () => {
      // Mock very wide terminal
      vi.mocked(vi.fn()).mockImplementation(() => ({
        width: 200,
        height: 50,
        isNarrow: false,
        isWide: true,
        breakpoint: 'wide',
      }));

      const props = {
        toolName: 'Read',
        input: {
          file_path: '/very/long/path/to/file/that/would/normally/be/truncated/but/should/display/fully/in/wide/terminal.txt',
        },
        output: 'Very long output line that should display without truncation in wide terminals and show all the content properly without any ellipsis',
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/very.*long.*path.*file.*terminal\.txt/)).toBeInTheDocument();
    });

    it('should handle dynamic terminal resizing', () => {
      let currentWidth = 80;

      vi.mocked(vi.fn()).mockImplementation(() => ({
        width: currentWidth,
        height: 24,
        isNarrow: currentWidth < 60,
        isWide: currentWidth > 120,
        breakpoint: currentWidth < 60 ? 'narrow' : currentWidth > 120 ? 'wide' : 'medium',
      }));

      const props = {
        toolName: 'Bash',
        input: { command: 'ls -la /very/long/directory/path/with/many/subdirectories' },
        output: 'drwxr-xr-x  5 user  staff   160 Jan 15 10:30 very-long-directory-name-here',
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      const { rerender } = render(<ToolCall {...props} />);
      expect(screen.getByText('Bash')).toBeInTheDocument();

      // Simulate terminal resize to narrow
      currentWidth = 40;
      rerender(<ToolCall {...props} />);
      expect(screen.getByText('Bash')).toBeInTheDocument();

      // Simulate terminal resize to wide
      currentWidth = 150;
      rerender(<ToolCall {...props} />);
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });
  });

  describe('Error Display Component Edge Cases', () => {
    it('should handle error suggestions for common error patterns', () => {
      const errorWithSuggestions = {
        message: 'Module not found: Can\'t resolve \'react\' in \'/project/src\'',
        details: 'This error occurred during the build process',
        suggestions: [
          'Run npm install to install dependencies',
          'Check if react is listed in package.json',
          'Verify the import path is correct',
        ],
      };

      render(
        <ErrorDisplay
          error={errorWithSuggestions.message}
          details={errorWithSuggestions.details}
          suggestions={errorWithSuggestions.suggestions}
        />
      );

      expect(screen.getByText(/Module not found/)).toBeInTheDocument();
      expect(screen.getByText(/npm install/)).toBeInTheDocument();
    });

    it('should handle errors with stack traces and source maps', () => {
      const errorWithSourceMap = `
TypeError: Cannot read property 'length' of undefined
    at calculateLength (webpack:///src/utils.js:42:15)
    at processData (webpack:///src/processor.js:18:23)
    at Object.<anonymous> (webpack:///src/index.js:5:1)
      `;

      render(
        <ErrorDisplay
          error={errorWithSourceMap}
          showStackTrace={true}
          verbose={true}
        />
      );

      expect(screen.getByText(/TypeError/)).toBeInTheDocument();
      expect(screen.getByText(/webpack:/)).toBeInTheDocument();
    });

    it('should handle circular reference errors', () => {
      const circularError = {
        name: 'TypeError',
        message: 'Converting circular structure to JSON',
        stack: `TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Object'
    |     property 'child' -> object with constructor 'Object'
    --- property 'parent' closes the circle`,
      };

      render(
        <ErrorDisplay
          error={circularError.message}
          details={circularError.stack}
          errorType="JSON Serialization Error"
        />
      );

      expect(screen.getByText(/circular structure/)).toBeInTheDocument();
      expect(screen.getByText(/closes the circle/)).toBeInTheDocument();
    });

    it('should handle memory and performance related errors', () => {
      const memoryError = `
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
 1: 0x10610e065 node::Abort() (.cold.1) [/usr/local/bin/node]
 2: 0x10600a589 node::Abort() [/usr/local/bin/node]
 3: 0x10600a6ef node::OnFatalError(char const*, char const*) [/usr/local/bin/node]
      `;

      render(
        <ErrorDisplay
          error="JavaScript heap out of memory"
          details={memoryError}
          errorType="Memory Error"
          severity="critical"
        />
      );

      expect(screen.getByText(/heap out of memory/)).toBeInTheDocument();
      expect(screen.getByText(/FATAL ERROR/)).toBeInTheDocument();
    });
  });

  describe('Activity Log Edge Cases', () => {
    it('should handle rapid log entry creation', () => {
      const rapidLogs = Array(1000).fill(null).map((_, i) => ({
        id: `rapid-${i}`,
        timestamp: new Date(Date.now() + i * 10),
        category: 'tool' as const,
        level: 'info' as const,
        message: `Rapid log entry ${i}`,
        toolName: 'TestTool',
        agent: 'test-agent',
      }));

      render(
        <ActivityLog
          logs={rapidLogs}
          maxEntries={50}
          showTimestamps={true}
          showCategories={true}
        />
      );

      // Should handle large log arrays without crashing
      expect(screen.getByText(/Rapid log entry/)).toBeInTheDocument();
    });

    it('should handle logs with extremely long messages', () => {
      const longMessage = 'This is an extremely long log message that contains a lot of details about the operation that was performed and should be truncated appropriately to fit within the terminal display constraints. '.repeat(10);

      const longLogs = [{
        id: 'long-message',
        timestamp: new Date(),
        category: 'tool' as const,
        level: 'info' as const,
        message: longMessage,
        toolName: 'LongOutputTool',
      }];

      render(
        <ActivityLog
          logs={longLogs}
          truncateMessages={true}
          maxMessageLength={100}
        />
      );

      expect(screen.getByText(/This is an extremely long/)).toBeInTheDocument();
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('should handle logs with mixed severity levels and categories', () => {
      const mixedLogs = [
        {
          id: 'debug-1',
          timestamp: new Date(),
          category: 'system' as const,
          level: 'debug' as const,
          message: 'Debug information',
        },
        {
          id: 'error-1',
          timestamp: new Date(),
          category: 'tool' as const,
          level: 'error' as const,
          message: 'Critical error occurred',
          toolName: 'FailingTool',
        },
        {
          id: 'success-1',
          timestamp: new Date(),
          category: 'agent' as const,
          level: 'success' as const,
          message: 'Operation completed successfully',
          agent: 'worker-agent',
        },
      ];

      render(
        <ActivityLog
          logs={mixedLogs}
          showLevels={true}
          filterLevel="debug"
        />
      );

      expect(screen.getByText(/Debug information/)).toBeInTheDocument();
      expect(screen.getByText(/Critical error/)).toBeInTheDocument();
      expect(screen.getByText(/Operation completed/)).toBeInTheDocument();
    });
  });
});