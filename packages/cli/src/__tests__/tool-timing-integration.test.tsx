import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolCall } from '../ui/components/ToolCall.js';

/**
 * Integration tests for tool timing display in CLI
 *
 * Tests verify:
 * - Tool execution duration is displayed in human-readable format
 * - Timing appears inline with tool output
 * - Different display modes show timing appropriately
 * - Various duration ranges are handled correctly
 */
describe('Tool Timing Integration Tests', () => {
  // Mock the ink-spinner component
  beforeEach(() => {
    vi.mock('ink-spinner', () => ({
      default: () => '⠋',
    }));
  });

  describe('Duration Display in Different Modes', () => {
    it('should display timing in compact mode inline with tool info', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Read"
          status="success"
          duration={1500}
          displayMode="compact"
          input={{ file_path: '/test/file.txt' }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Read');
      expect(output).toContain('1.5s');
      expect(output).toContain('file_path');
    });

    it('should display timing in normal mode with parentheses', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Write"
          status="success"
          duration={250}
          displayMode="normal"
          input={{ content: 'test content' }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Write');
      expect(output).toContain('(250ms)');
      expect(output).toContain('content');
    });

    it('should display timing in verbose mode with status and timing', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Bash"
          status="success"
          duration={3200}
          displayMode="verbose"
          input={{ command: 'npm test' }}
          output="All tests passed"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Bash');
      expect(output).toContain('(3.2s)');
      expect(output).toContain('[success]');
      expect(output).toContain('All tests passed');
    });

    it('should not show timing for running tools', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Grep"
          status="running"
          duration={1000}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Grep');
      expect(output).not.toContain('1000ms');
      expect(output).not.toContain('1.0s');
      expect(output).toContain('⠋'); // Spinner
    });
  });

  describe('Timing Display for Different Tool Types', () => {
    const toolTypes = [
      { name: 'Read', color: 'cyan' },
      { name: 'Write', color: 'green' },
      { name: 'Edit', color: 'yellow' },
      { name: 'Bash', color: 'magenta' },
      { name: 'Glob', color: 'blue' },
      { name: 'Grep', color: 'blue' },
      { name: 'WebFetch', color: 'cyan' },
      { name: 'WebSearch', color: 'cyan' },
    ];

    toolTypes.forEach(({ name }) => {
      it(`should display timing for ${name} tool`, () => {
        const { lastFrame } = render(
          <ToolCall
            toolName={name}
            status="success"
            duration={800}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(output).toContain(name);
        expect(output).toContain('(800ms)');
      });
    });
  });

  describe('Duration Range Testing', () => {
    const testCases = [
      // Fast operations (sub-second)
      { duration: 10, expected: '10ms', scenario: 'Very fast file read' },
      { duration: 50, expected: '50ms', scenario: 'Quick glob search' },
      { duration: 150, expected: '150ms', scenario: 'File write operation' },
      { duration: 500, expected: '500ms', scenario: 'Medium file operation' },
      { duration: 999, expected: '999ms', scenario: 'Almost 1 second' },

      // Second-range operations
      { duration: 1000, expected: '1.0s', scenario: 'Exactly 1 second' },
      { duration: 1500, expected: '1.5s', scenario: 'Quick command' },
      { duration: 2300, expected: '2.3s', scenario: 'Build step' },
      { duration: 10000, expected: '10.0s', scenario: 'Slow operation' },
      { duration: 59999, expected: '60.0s', scenario: 'Almost 1 minute' },

      // Minute-range operations
      { duration: 60000, expected: '1m 0s', scenario: 'Exactly 1 minute' },
      { duration: 90000, expected: '1m 30s', scenario: 'Long running task' },
      { duration: 300000, expected: '5m 0s', scenario: 'Build process' },

      // Hour-range operations (rare but possible)
      { duration: 3600000, expected: '1h 0m', scenario: 'Very long process' },
    ];

    testCases.forEach(({ duration, expected, scenario }) => {
      it(`should format ${duration}ms as '${expected}' for ${scenario}`, () => {
        const { lastFrame } = render(
          <ToolCall
            toolName="TestTool"
            status="success"
            duration={duration}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(output).toContain(`(${expected})`);
      });
    });
  });

  describe('Error State with Timing', () => {
    it('should show timing for failed tools in compact mode', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Write"
          status="error"
          duration={1200}
          displayMode="compact"
          output="Permission denied"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Write');
      expect(output).toContain('1.2s');
      expect(output).toContain('(error)');
    });

    it('should show timing for failed tools in normal mode', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Bash"
          status="error"
          duration={5000}
          displayMode="normal"
          output="Command failed with exit code 1"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Bash');
      expect(output).toContain('(5.0s)');
      expect(output).toContain('Command failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Read"
          status="success"
          duration={0}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('(0ms)');
    });

    it('should handle undefined duration gracefully', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Write"
          status="success"
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Write');
      // Should not contain any timing information
      expect(output).not.toMatch(/\(\d+(?:\.\d+)?[smh]+\)/);
    });

    it('should handle very large durations', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="LongTask"
          status="success"
          duration={7200000} // 2 hours
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('(2h 0m)');
    });
  });

  describe('Input Parameter and Timing Combination', () => {
    it('should show both parameters and timing in compact mode', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Edit"
          status="success"
          duration={800}
          displayMode="compact"
          input={{
            file_path: '/long/path/to/file.txt',
            old_string: 'const x = 1;',
            new_string: 'const x = 2;'
          }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Edit');
      expect(output).toContain('file_path');
      expect(output).toContain('800ms');
    });

    it('should show parameters and timing with long file paths', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Read"
          status="success"
          duration={150}
          displayMode="normal"
          input={{
            file_path: '/very/long/path/to/some/deeply/nested/directory/with/a/really/long/filename.typescript'
          }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Read');
      expect(output).toContain('(150ms)');
      expect(output).toContain('file_path');
    });
  });

  describe('Output Display with Timing', () => {
    it('should show timing with short output', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Glob"
          status="success"
          duration={200}
          displayMode="normal"
          input={{ pattern: '*.ts' }}
          output="file1.ts\nfile2.ts\nfile3.ts"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Glob');
      expect(output).toContain('(200ms)');
      expect(output).toContain('file1.ts');
    });

    it('should show timing with truncated output', () => {
      const longOutput = Array(10).fill('This is a line of output').join('\n');
      const { lastFrame } = render(
        <ToolCall
          toolName="Bash"
          status="success"
          duration={3500}
          displayMode="normal"
          input={{ command: 'find . -name "*.ts"' }}
          output={longOutput}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Bash');
      expect(output).toContain('(3.5s)');
      expect(output).toContain('more lines');
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should display timing for typical file operations workflow', () => {
      const operations = [
        { tool: 'Glob', duration: 50, status: 'success' as const },
        { tool: 'Read', duration: 120, status: 'success' as const },
        { tool: 'Edit', duration: 300, status: 'success' as const },
        { tool: 'Write', duration: 80, status: 'success' as const },
      ];

      operations.forEach(({ tool, duration, status }) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={tool}
            status={status}
            duration={duration}
            displayMode="compact"
          />
        );

        const output = lastFrame();
        expect(output).toContain(tool);
        expect(output).toMatch(/\d+ms/);
      });
    });

    it('should display timing for build and deploy workflow', () => {
      const workflow = [
        { tool: 'Bash', duration: 15000, status: 'success' as const, task: 'npm run build' },
        { tool: 'Bash', duration: 5000, status: 'success' as const, task: 'npm test' },
        { tool: 'Bash', duration: 30000, status: 'success' as const, task: 'docker build' },
      ];

      workflow.forEach(({ tool, duration, status, task }) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={tool}
            status={status}
            duration={duration}
            displayMode="normal"
            input={{ command: task }}
          />
        );

        const output = lastFrame();
        expect(output).toContain(tool);
        if (duration < 60000) {
          expect(output).toMatch(/\(\d+\.\d+s\)/);
        } else {
          expect(output).toMatch(/\(\d+m \d+s\)/);
        }
      });
    });

    it('should handle mixed success and error states with timing', () => {
      const mixedOperations = [
        { tool: 'Read', duration: 100, status: 'success' as const },
        { tool: 'Write', duration: 200, status: 'error' as const },
        { tool: 'Bash', duration: 1500, status: 'success' as const },
      ];

      mixedOperations.forEach(({ tool, duration, status }) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={tool}
            status={status}
            duration={duration}
            displayMode="verbose"
          />
        );

        const output = lastFrame();
        expect(output).toContain(tool);
        expect(output).toContain(`[${status}]`);
        if (duration < 1000) {
          expect(output).toContain(`(${duration}ms)`);
        } else {
          expect(output).toContain('(1.5s)');
        }
      });
    });
  });

  describe('Accessibility and Readability', () => {
    it('should maintain readability with timing information', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="WebFetch"
          status="success"
          duration={2800}
          displayMode="normal"
          input={{
            url: 'https://api.example.com/data',
            prompt: 'Extract the user count'
          }}
          output="User count: 1,234 active users"
        />
      );

      const output = lastFrame();

      // Should be easily readable
      expect(output).toContain('WebFetch');
      expect(output).toContain('(2.8s)');
      expect(output).toContain('User count: 1,234');

      // Timing should not interfere with main content
      const lines = output.split('\n');
      const headerLine = lines.find(line => line.includes('WebFetch'));
      expect(headerLine).toContain('(2.8s)');
    });

    it('should format timing consistently across different tools', () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash'];
      const results: string[] = [];

      tools.forEach(toolName => {
        const { lastFrame } = render(
          <ToolCall
            toolName={toolName}
            status="success"
            duration={1234}
            displayMode="compact"
          />
        );
        results.push(lastFrame());
      });

      // All should contain consistent timing format
      results.forEach(result => {
        expect(result).toContain('1.2s');
      });
    });
  });
});