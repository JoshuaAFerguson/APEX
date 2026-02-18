/**
 * Integration tests for ToolCall component
 *
 * Tests cover real-world usage scenarios and integration with other components:
 * - Real tool execution scenarios
 * - Status transition workflows
 * - Display mode switching
 * - Complex parameter combinations
 * - Error recovery scenarios
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ToolCall, type ToolCallProps } from '../ToolCall.js';

// Mock the ink-spinner component
vi.mock('ink-spinner', () => ({
  default: () => '⠋',
}));

describe('ToolCall Integration Tests', () => {
  describe('Real Tool Scenarios', () => {
    it('should render Read tool execution', () => {
      const props: ToolCallProps = {
        toolName: 'Read',
        input: { file_path: '/src/components/ToolCall.tsx' },
        output: 'import React from \'react\';\nimport { Box, Text } from \'ink\';\n\nexport function ToolCall() {\n  return <Text>Tool</Text>;\n}',
        status: 'success',
        duration: 45
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Read');
      expect(lastFrame()).toContain('file_path');
      expect(lastFrame()).toContain('ToolCall.tsx');
      expect(lastFrame()).toContain('45ms');
      expect(lastFrame()).toContain('import React');
    });

    it('should render Write tool execution', () => {
      const props: ToolCallProps = {
        toolName: 'Write',
        input: {
          file_path: '/src/new-component.tsx',
          content: 'export function NewComponent() {\n  return <div>Hello</div>;\n}'
        },
        output: 'File created successfully',
        status: 'success',
        duration: 123
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Write');
      expect(lastFrame()).toContain('file_path');
      expect(lastFrame()).toContain('new-component.tsx');
      expect(lastFrame()).toContain('123ms');
      expect(lastFrame()).toContain('File created successfully');
    });

    it('should render Bash tool execution', () => {
      const props: ToolCallProps = {
        toolName: 'Bash',
        input: { command: 'npm run build' },
        output: '> npm run build\n> tsc\n\nBuild completed successfully\nFiles: 45\nTime: 2.3s',
        status: 'success',
        duration: 2300
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Bash');
      expect(lastFrame()).toContain('npm run build');
      expect(lastFrame()).toContain('2300ms');
      expect(lastFrame()).toContain('Build completed');
    });

    it('should render Grep tool execution', () => {
      const props: ToolCallProps = {
        toolName: 'Grep',
        input: {
          pattern: 'function.*test',
          path: '/src',
          output_mode: 'content'
        },
        output: 'src/utils.test.ts:15:function testUtils() {\nsrc/components.test.tsx:23:function testComponent() {\nsrc/hooks.test.ts:8:function testHook() {',
        status: 'success',
        duration: 89
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Grep');
      expect(lastFrame()).toContain('function.*test');
      expect(lastFrame()).toContain('89ms');
      expect(lastFrame()).toContain('testUtils');
    });

    it('should render WebFetch tool execution', () => {
      const props: ToolCallProps = {
        toolName: 'WebFetch',
        input: {
          url: 'https://api.github.com/repos/user/repo',
          prompt: 'Get repository information'
        },
        output: '{\n  "name": "repo",\n  "full_name": "user/repo",\n  "description": "A test repository",\n  "stargazers_count": 42,\n  "language": "TypeScript"\n}',
        status: 'success',
        duration: 456
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('WebFetch');
      expect(lastFrame()).toContain('api.github.com');
      expect(lastFrame()).toContain('456ms');
      expect(lastFrame()).toContain('stargazers_count');
    });
  });

  describe('Status Transition Workflows', () => {
    it('should handle pending to running to success workflow', () => {
      let props: ToolCallProps = {
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        status: 'pending'
      };

      // Pending state
      let { lastFrame, rerender } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('○');
      expect(lastFrame()).not.toContain('ms');

      // Running state
      props = { ...props, status: 'running' };
      rerender(<ToolCall {...props} />);
      expect(lastFrame()).toContain('⠋');
      expect(lastFrame()).not.toContain('ms');

      // Success state
      props = {
        ...props,
        status: 'success',
        output: 'File content here',
        duration: 250
      };
      rerender(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✓');
      expect(lastFrame()).toContain('250ms');
      expect(lastFrame()).toContain('File content here');
    });

    it('should handle pending to running to error workflow', () => {
      let props: ToolCallProps = {
        toolName: 'Read',
        input: { file_path: '/nonexistent.txt' },
        status: 'pending'
      };

      // Pending state
      let { lastFrame, rerender } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('○');

      // Running state
      props = { ...props, status: 'running' };
      rerender(<ToolCall {...props} />);
      expect(lastFrame()).toContain('⠋');

      // Error state
      props = {
        ...props,
        status: 'error',
        output: 'Error: ENOENT: no such file or directory, open \'/nonexistent.txt\'',
        duration: 15
      };
      rerender(<ToolCall {...props} />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('15ms');
      expect(lastFrame()).toContain('ENOENT');
    });
  });

  describe('Display Mode Transitions', () => {
    it('should transition between display modes correctly', () => {
      const baseProps: ToolCallProps = {
        toolName: 'Bash',
        input: { command: 'ls -la' },
        output: 'total 48\ndrwxr-xr-x  8 user staff  256 Jan  1 00:00 .\ndrwxr-xr-x  3 user staff   96 Jan  1 00:00 ..\n-rw-r--r--  1 user staff 1234 Jan  1 00:00 file.txt',
        status: 'success',
        duration: 67
      };

      // Compact mode
      let props = { ...baseProps, displayMode: 'compact' as const };
      let { lastFrame, rerender } = render(<ToolCall {...props} />);
      let compactFrame = lastFrame();
      expect(compactFrame).toContain('Bash');
      expect(compactFrame).toContain('67ms');
      expect(compactFrame).not.toContain('total 48'); // No output in compact

      // Normal mode
      props = { ...baseProps, displayMode: 'normal' as const };
      rerender(<ToolCall {...props} />);
      let normalFrame = lastFrame();
      expect(normalFrame).toContain('Bash');
      expect(normalFrame).toContain('67ms');
      expect(normalFrame).toContain('total 48'); // Output shown

      // Verbose mode
      props = { ...baseProps, displayMode: 'verbose' as const };
      rerender(<ToolCall {...props} />);
      let verboseFrame = lastFrame();
      expect(verboseFrame).toContain('Bash');
      expect(verboseFrame).toContain('67ms');
      expect(verboseFrame).toContain('[success]'); // Status label
      expect(verboseFrame).toContain('total 48'); // Full output
    });
  });

  describe('Complex Parameter Scenarios', () => {
    it('should handle Edit tool with complex parameters', () => {
      const props: ToolCallProps = {
        toolName: 'Edit',
        input: {
          file_path: '/src/complex-component.tsx',
          old_string: 'const handleClick = () => {\n  console.log("old implementation");\n};',
          new_string: 'const handleClick = useCallback(() => {\n  dispatch(updateAction());\n  analytics.track("button_clicked");\n}, [dispatch]);',
          replace_all: false
        },
        output: 'Edit completed successfully. 1 replacement made.',
        status: 'success',
        duration: 78
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Edit');
      expect(lastFrame()).toContain('file_path');
      expect(lastFrame()).toContain('complex-component.tsx');
      expect(lastFrame()).toContain('78ms');
      expect(lastFrame()).toContain('replacement made');
    });

    it('should handle Glob tool with complex patterns', () => {
      const props: ToolCallProps = {
        toolName: 'Glob',
        input: {
          pattern: '**/*.{ts,tsx,js,jsx}',
          path: '/src',
          exclude: ['**/*.test.*', '**/node_modules/**']
        },
        output: 'src/components/ToolCall.tsx\nsrc/components/AgentPanel.tsx\nsrc/hooks/useElapsedTime.ts\nsrc/utils/formatters.ts\nsrc/types/index.ts',
        status: 'success',
        duration: 234
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Glob');
      expect(lastFrame()).toContain('**/*.{ts,tsx,js,jsx}');
      expect(lastFrame()).toContain('234ms');
      expect(lastFrame()).toContain('ToolCall.tsx');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle timeout errors gracefully', () => {
      const props: ToolCallProps = {
        toolName: 'Bash',
        input: { command: 'sleep 300', timeout: 5000 },
        output: 'Error: Command timed out after 5000ms\nProcess killed with SIGTERM',
        status: 'error',
        duration: 5000
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Bash');
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('5000ms');
      expect(lastFrame()).toContain('timed out');
    });

    it('should handle permission errors', () => {
      const props: ToolCallProps = {
        toolName: 'Write',
        input: {
          file_path: '/etc/system-config.conf',
          content: 'new config'
        },
        output: 'Error: EACCES: permission denied, open \'/etc/system-config.conf\'\nOperation failed: Insufficient permissions',
        status: 'error',
        duration: 12
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Write');
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('EACCES');
      expect(lastFrame()).toContain('permission denied');
    });

    it('should handle network errors', () => {
      const props: ToolCallProps = {
        toolName: 'WebFetch',
        input: {
          url: 'https://invalid-domain-that-does-not-exist.com/api',
          prompt: 'Fetch data'
        },
        output: 'Error: getaddrinfo ENOTFOUND invalid-domain-that-does-not-exist.com\nNetwork request failed: DNS resolution failed',
        status: 'error',
        duration: 3000
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('WebFetch');
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('ENOTFOUND');
      expect(lastFrame()).toContain('DNS resolution failed');
    });
  });

  describe('Performance with Real Data', () => {
    it('should handle large file read operation', () => {
      const largeFileContent = Array(500).fill(
        'import { Component } from "react";\nimport { Utils } from "./utils";\n\nfunction process() { return data; }'
      ).join('\n');

      const props: ToolCallProps = {
        toolName: 'Read',
        input: { file_path: '/src/large-file.ts' },
        output: largeFileContent,
        status: 'success',
        duration: 156
      };

      const startTime = Date.now();
      const { lastFrame } = render(<ToolCall {...props} />);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(lastFrame()).toContain('Read');
      expect(lastFrame()).toContain('large-file.ts');
    });

    it('should handle complex grep results efficiently', () => {
      const grepResults = Array(100).fill(null).map((_, i) =>
        `src/file${i}.ts:${i * 10 + 5}:function processData${i}() { return result${i}; }`
      ).join('\n');

      const props: ToolCallProps = {
        toolName: 'Grep',
        input: {
          pattern: 'function.*process',
          path: '/src',
          output_mode: 'content'
        },
        output: grepResults,
        status: 'success',
        duration: 445
      };

      const startTime = Date.now();
      const { lastFrame } = render(<ToolCall {...props} />);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(300);
      expect(lastFrame()).toContain('Grep');
      expect(lastFrame()).toContain('function.*process');
    });
  });

  describe('Edge Case Combinations', () => {
    it('should handle tool with no output but success status', () => {
      const props: ToolCallProps = {
        toolName: 'Write',
        input: { file_path: '/empty.txt', content: '' },
        output: '',
        status: 'success',
        duration: 5
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Write');
      expect(lastFrame()).toContain('✓');
      expect(lastFrame()).toContain('5ms');
    });

    it('should handle tool with very fast execution', () => {
      const props: ToolCallProps = {
        toolName: 'Glob',
        input: { pattern: '*.txt' },
        output: 'file1.txt\nfile2.txt',
        status: 'success',
        duration: 0
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Glob');
      expect(lastFrame()).toContain('0ms');
      expect(lastFrame()).toContain('file1.txt');
    });

    it('should handle tool with extremely long execution time', () => {
      const props: ToolCallProps = {
        toolName: 'Bash',
        input: { command: 'npm run build:all' },
        output: 'Build completed with 0 errors and 0 warnings',
        status: 'success',
        duration: 123456
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Bash');
      expect(lastFrame()).toContain('123456ms');
      expect(lastFrame()).toContain('Build completed');
    });

    it('should handle collapsed state with error', () => {
      const props: ToolCallProps = {
        toolName: 'Read',
        input: { file_path: '/missing.txt' },
        output: 'File not found error',
        status: 'error',
        duration: 25,
        collapsed: true
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Read');
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).not.toContain('File not found error');
    });
  });
});