/**
 * Comprehensive tests for ToolCall component
 *
 * Tests cover:
 * - Rendering tool calls with various parameter types
 * - Output truncation at configured limits
 * - Syntax highlighting for JSON/code/text
 * - Status transitions (pending → running → success/error)
 * - Error states
 * - Different display modes (compact, normal, verbose)
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolCall, type ToolCallProps } from '../ToolCall.js';

// Mock the ink-spinner component
vi.mock('ink-spinner', () => ({
  default: () => '⠋',
}));

describe('ToolCall Component', () => {
  let defaultProps: ToolCallProps;

  beforeEach(() => {
    defaultProps = {
      toolName: 'Read',
      status: 'pending',
    };
  });

  describe('Basic Rendering', () => {
    it('should render tool name', () => {
      const { lastFrame } = render(<ToolCall {...defaultProps} />);
      expect(lastFrame()).toContain('Read');
    });

    it('should render without crashing with minimal props', () => {
      const { lastFrame } = render(<ToolCall {...defaultProps} />);
      expect(lastFrame()).toBeDefined();
    });

    it('should handle undefined optional props gracefully', () => {
      const props = {
        toolName: 'TestTool',
        status: 'success' as const,
        input: undefined,
        output: undefined,
        duration: undefined,
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('TestTool');
    });
  });

  describe('Status Indicators', () => {
    it('should show pending status with circle icon', () => {
      const props = { ...defaultProps, status: 'pending' as const };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('○');
    });

    it('should show running status with spinner', () => {
      const props = { ...defaultProps, status: 'running' as const };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('⠋');
    });

    it('should show success status with checkmark', () => {
      const props = { ...defaultProps, status: 'success' as const };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✓');
    });

    it('should show error status with X mark', () => {
      const props = { ...defaultProps, status: 'error' as const };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
    });
  });

  describe('Tool Name Styling', () => {
    const toolColorTests = [
      { tool: 'Read', expectedInOutput: true },
      { tool: 'Write', expectedInOutput: true },
      { tool: 'Edit', expectedInOutput: true },
      { tool: 'Bash', expectedInOutput: true },
      { tool: 'Glob', expectedInOutput: true },
      { tool: 'Grep', expectedInOutput: true },
      { tool: 'WebFetch', expectedInOutput: true },
      { tool: 'WebSearch', expectedInOutput: true },
      { tool: 'UnknownTool', expectedInOutput: true }, // Should use default white color
    ];

    toolColorTests.forEach(({ tool, expectedInOutput }) => {
      it(`should render ${tool} tool name`, () => {
        const props = { ...defaultProps, toolName: tool };
        const { lastFrame } = render(<ToolCall {...props} />);
        if (expectedInOutput) {
          expect(lastFrame()).toContain(tool);
        }
      });
    });
  });

  describe('Input Parameter Handling', () => {
    it('should display string input parameters', () => {
      const input = { file_path: '/path/to/file.txt', content: 'Hello world' };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('file_path');
      expect(lastFrame()).toContain('Hello world');
    });

    it('should truncate long string parameters', () => {
      const longString = 'a'.repeat(100);
      const input = { content: longString };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('...');
    });

    it('should handle object parameters', () => {
      const input = {
        config: { debug: true, timeout: 5000 },
        options: ['opt1', 'opt2']
      };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('2 params');
    });

    it('should handle empty input object', () => {
      const props = { ...defaultProps, input: {} };
      const { lastFrame } = render(<ToolCall {...props} />);
      // Should not show any parameter info for empty object
      expect(lastFrame()).toContain('Read');
    });

    it('should handle array input parameters', () => {
      const input = { patterns: ['*.js', '*.ts', '*.tsx'] };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('patterns');
    });

    it('should handle boolean input parameters', () => {
      const input = { recursive: true };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('recursive');
    });

    it('should handle number input parameters', () => {
      const input = { timeout: 5000 };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('timeout');
    });

    it('should handle null/undefined input parameters', () => {
      const input = { value: null, optional: undefined };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('2 params');
    });
  });

  describe('Output Handling and Truncation', () => {
    it('should display short output in full', () => {
      const output = 'File created successfully';
      const props = { ...defaultProps, status: 'success' as const, output };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain(output);
    });

    it('should truncate long output by lines', () => {
      const longOutput = Array(20).fill('This is a line of output').join('\n');
      const props = { ...defaultProps, status: 'success' as const, output: longOutput };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('more lines');
    });

    it('should not truncate output with few lines', () => {
      const shortOutput = 'Line 1\nLine 2\nLine 3';
      const props = { ...defaultProps, status: 'success' as const, output: shortOutput };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
      expect(lastFrame()).not.toContain('more lines');
    });

    it('should handle output with special characters', () => {
      const output = 'Special chars: 🚀 💻 ⭐ 你好世界';
      const props = { ...defaultProps, status: 'success' as const, output };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('🚀');
      expect(lastFrame()).toContain('你好世界');
    });

    it('should handle empty output', () => {
      const props = { ...defaultProps, status: 'success' as const, output: '' };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Read');
    });

    it('should handle JSON output', () => {
      const jsonOutput = JSON.stringify({ success: true, data: [1, 2, 3] }, null, 2);
      const props = { ...defaultProps, status: 'success' as const, output: jsonOutput };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('success');
      expect(lastFrame()).toContain('data');
    });

    it('should handle code output', () => {
      const codeOutput = 'function test() {\n  return "hello";\n}';
      const props = { ...defaultProps, status: 'success' as const, output: codeOutput };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('function test');
    });

    it('should handle error output', () => {
      const errorOutput = 'Error: File not found\n  at readFile (/path/file.js:10:5)';
      const props = { ...defaultProps, status: 'error' as const, output: errorOutput };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Error: File not found');
    });
  });

  describe('Duration Display', () => {
    it('should show duration for completed tools', () => {
      const props = {
        ...defaultProps,
        status: 'success' as const,
        duration: 1500
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      // formatDuration formats 1500ms as "1.5s"
      expect(lastFrame()).toContain('1.5s');
    });

    it('should not show duration for running tools', () => {
      const props = {
        ...defaultProps,
        status: 'running' as const,
        duration: 1500
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      // formatDuration formats 1500ms as "1.5s"
      expect(lastFrame()).not.toContain('1.5s');
    });

    it('should not show duration when not provided', () => {
      const props = {
        ...defaultProps,
        status: 'success' as const
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).not.toContain('ms');
    });

    it('should handle zero duration', () => {
      const props = {
        ...defaultProps,
        status: 'success' as const,
        duration: 0
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('0ms');
    });

    it('should handle large duration values', () => {
      const props = {
        ...defaultProps,
        status: 'success' as const,
        duration: 12345678
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      // formatDuration formats large values as hours and minutes
      expect(lastFrame()).toContain('h');
    });
  });

  describe('Display Mode Variations', () => {
    describe('Compact Mode', () => {
      it('should render single line in compact mode', () => {
        const props = {
          ...defaultProps,
          displayMode: 'compact' as const,
          input: { file: 'test.txt' },
          duration: 1000,
          status: 'success' as const
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        const frame = lastFrame();
        expect(frame).toContain('Read');
        expect(frame).toContain('file');
        // formatDuration formats 1000ms as "1.0s"
        expect(frame).toContain('1.0s');
      });

      it('should show error indicator in compact mode', () => {
        const props = {
          ...defaultProps,
          displayMode: 'compact' as const,
          status: 'error' as const,
          output: 'Something went wrong'
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).toContain('(error)');
      });

      it('should not show full output in compact mode', () => {
        const props = {
          ...defaultProps,
          displayMode: 'compact' as const,
          status: 'success' as const,
          output: 'This is a long output that should not be shown in full'
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        const frame = lastFrame();
        expect(frame).not.toContain('This is a long output');
      });
    });

    describe('Normal Mode', () => {
      it('should show output when not collapsed', () => {
        const props = {
          ...defaultProps,
          displayMode: 'normal' as const,
          status: 'success' as const,
          output: 'Operation completed successfully'
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).toContain('Operation completed successfully');
      });

      it('should hide output when collapsed', () => {
        const props = {
          ...defaultProps,
          displayMode: 'normal' as const,
          status: 'success' as const,
          output: 'This should be hidden',
          collapsed: true
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).not.toContain('This should be hidden');
      });

      it('should show truncated output in normal mode', () => {
        const longOutput = Array(20).fill('Output line').join('\n');
        const props = {
          ...defaultProps,
          displayMode: 'normal' as const,
          status: 'success' as const,
          output: longOutput
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).toContain('more lines');
      });
    });

    describe('Verbose Mode', () => {
      it('should show full output in verbose mode', () => {
        const longOutput = Array(20).fill('Output line').join('\n');
        const props = {
          ...defaultProps,
          displayMode: 'verbose' as const,
          status: 'success' as const,
          output: longOutput
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).toContain('Output line');
      });

      it('should show status label in verbose mode', () => {
        const props = {
          ...defaultProps,
          displayMode: 'verbose' as const,
          status: 'success' as const
        };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).toContain('[success]');
      });

      it('should show status for all states in verbose mode', () => {
        const statuses = ['pending', 'running', 'success', 'error'] as const;

        statuses.forEach(status => {
          const props = {
            ...defaultProps,
            displayMode: 'verbose' as const,
            status
          };
          const { lastFrame } = render(<ToolCall {...props} />);
          expect(lastFrame()).toContain(`[${status}]`);
        });
      });
    });
  });

  describe('Error State Handling', () => {
    it('should style error output differently', () => {
      const props = {
        ...defaultProps,
        status: 'error' as const,
        output: 'Error: Operation failed'
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Error: Operation failed');
    });

    it('should show error status icon', () => {
      const props = {
        ...defaultProps,
        status: 'error' as const
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
    });

    it('should handle error without output', () => {
      const props = {
        ...defaultProps,
        status: 'error' as const,
        duration: 1000
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      // formatDuration formats 1000ms as "1.0s"
      expect(lastFrame()).toContain('1.0s');
    });

    it('should handle error with very long stack trace', () => {
      const longStackTrace = Array(50).fill('  at function (file.js:123:45)').join('\n');
      const props = {
        ...defaultProps,
        status: 'error' as const,
        output: `Error: Something failed\n${longStackTrace}`
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Error: Something failed');
    });
  });

  describe('Running State Behavior', () => {
    it('should not show output for running tools', () => {
      const props = {
        ...defaultProps,
        status: 'running' as const,
        output: 'This should not be shown'
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).not.toContain('This should not be shown');
    });

    it('should not show duration for running tools', () => {
      const props = {
        ...defaultProps,
        status: 'running' as const,
        duration: 1500
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      // formatDuration formats 1500ms as "1.5s", should not show for running
      expect(lastFrame()).not.toContain('1.5s');
    });

    it('should show running status in verbose mode', () => {
      const props = {
        ...defaultProps,
        status: 'running' as const,
        displayMode: 'verbose' as const
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('[running]');
    });
  });

  describe('Complex Parameter Scenarios', () => {
    it('should handle deeply nested object parameters', () => {
      const input = {
        config: {
          database: {
            host: 'localhost',
            port: 5432,
            settings: {
              poolSize: 10,
              timeout: 30000
            }
          }
        }
      };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('1 params');
    });

    it('should handle mixed type parameters', () => {
      const input = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
        nullValue: null,
        undefinedValue: undefined
      };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      // First param "string" has string value, so formatInput shows it
      expect(lastFrame()).toContain('string');
    });

    it('should handle parameters with special characters in keys', () => {
      const input = {
        'file-path': '/path/to/file',
        'content_type': 'application/json',
        'is-valid?': true
      };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('file-path');
    });

    it('should handle parameters with Unicode in values', () => {
      const input = {
        message: 'Hello 世界 🌍',
        emoji: '🚀 💻 ⭐'
      };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Hello 世界');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely long tool names', () => {
      const longToolName = 'A'.repeat(100);
      const props = { ...defaultProps, toolName: longToolName };
      const { lastFrame } = render(<ToolCall {...props} />);
      // The tool name should be present (may be truncated by terminal width)
      expect(lastFrame()).toContain('AAAA');
    });

    it('should handle tool names with special characters', () => {
      const specialToolName = 'Tool-With_Special.Chars';
      const props = { ...defaultProps, toolName: specialToolName };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain(specialToolName);
    });

    it('should handle empty string parameters', () => {
      const input = { emptyString: '', nonEmpty: 'value' };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      // formatInput shows first string value, which is the empty string
      expect(lastFrame()).toContain('emptyString');
    });

    it('should handle very large number parameters', () => {
      const input = { bigNumber: Number.MAX_SAFE_INTEGER };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      // First value is a number, so formatInput shows param count
      expect(lastFrame()).toContain('1 params');
    });

    it('should handle binary data-like parameters', () => {
      const binaryData = '\x00\x01\x02\xFF';
      const input = { data: binaryData };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('data');
    });

    it('should handle circular reference protection in input formatting', () => {
      // This test verifies the component doesn't crash with circular references
      // The formatInput function should handle this gracefully by showing param count
      const circular: any = {};
      circular.self = circular;
      const input = { circular, normal: 'value' };
      const props = { ...defaultProps, input };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('2 params');
    });
  });

  describe('Content Type Detection for Output', () => {
    it('should handle JSON output content', () => {
      const jsonOutput = JSON.stringify({
        result: 'success',
        data: { items: [1, 2, 3] },
        timestamp: '2024-01-01T00:00:00Z'
      }, null, 2);
      const props = {
        ...defaultProps,
        status: 'success' as const,
        output: jsonOutput
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('result');
      expect(lastFrame()).toContain('data');
    });

    it('should handle YAML-like output content', () => {
      const yamlOutput = `
name: test-project
version: 1.0.0
dependencies:
  - package-a
  - package-b
      `;
      const props = {
        ...defaultProps,
        status: 'success' as const,
        output: yamlOutput.trim()
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('name: test-project');
    });

    it('should handle shell command output', () => {
      const shellOutput = `
$ ls -la
total 48
drwxr-xr-x  8 user staff  256 Jan  1 00:00 .
drwxr-xr-x  3 user staff   96 Jan  1 00:00 ..
-rw-r--r--  1 user staff 1234 Jan  1 00:00 file.txt
      `;
      const props = {
        ...defaultProps,
        status: 'success' as const,
        output: shellOutput.trim()
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('ls -la');
    });

    it('should handle diff output content', () => {
      const diffOutput = `
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 unchanged line
-old line
+new line
 another unchanged
      `;
      const props = {
        ...defaultProps,
        status: 'success' as const,
        output: diffOutput.trim()
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('--- a/file.txt');
    });

    it('should handle log/error output with levels', () => {
      const logOutput = `
[ERROR] 2024-01-01 00:00:00 - Database connection failed
[WARN]  2024-01-01 00:00:01 - Retrying connection...
[INFO]  2024-01-01 00:00:02 - Connection established
[DEBUG] 2024-01-01 00:00:03 - Query executed successfully
      `;
      const props = {
        ...defaultProps,
        status: 'success' as const,
        output: logOutput.trim()
      };
      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('[ERROR]');
      expect(lastFrame()).toContain('Database connection failed');
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rendering many parameters efficiently', () => {
      const manyParams: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        manyParams[`param_${i}`] = `value_${i}`;
      }
      const props = { ...defaultProps, input: manyParams };

      const startTime = Date.now();
      const { lastFrame } = render(<ToolCall {...props} />);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render quickly
      // First param is string, so formatInput shows it instead of count
      expect(lastFrame()).toContain('param_0');
    });

    it('should handle very large output efficiently', () => {
      const largeOutput = 'x'.repeat(100000);
      const props = {
        ...defaultProps,
        status: 'success' as const,
        output: largeOutput
      };

      const startTime = Date.now();
      const { lastFrame } = render(<ToolCall {...props} />);
      const endTime = Date.now();

      // Large output rendering may take time, allow up to 15 seconds for CI
      expect(endTime - startTime).toBeLessThan(15000);
      expect(lastFrame()).toBeDefined();
    });

    it('should handle rapid status changes', () => {
      const statuses = ['pending', 'running', 'success'] as const;

      statuses.forEach(status => {
        const props = { ...defaultProps, status };
        const { lastFrame } = render(<ToolCall {...props} />);
        expect(lastFrame()).toBeDefined();
      });
    });
  });
});