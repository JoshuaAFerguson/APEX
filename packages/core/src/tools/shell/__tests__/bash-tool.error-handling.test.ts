/**
 * @fileoverview Error handling and edge case tests for BashTool
 * Tests various error scenarios and boundary conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool Error Handling Tests', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('command execution failures', () => {
    it('should handle non-existent commands gracefully', async () => {
      const input: BashToolInput = {
        command: 'this_command_does_not_exist_12345'
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true); // Still considered success as it's a valid execution attempt
      expect(result.output).toBeDefined();
      expect(result.output!.exitCode).not.toBe(0); // Should have non-zero exit code
    });

    it('should handle commands that write to stderr', async () => {
      const input: BashToolInput = {
        command: 'echo "Error message" >&2 && exit 1'
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stderr).toContain('Error message');
      expect(result.output!.exitCode).toBe(1);
    });

    it('should handle commands that produce both stdout and stderr', async () => {
      const input: BashToolInput = {
        command: 'echo "stdout message"; echo "stderr message" >&2'
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('stdout message');
      expect(result.output!.stderr).toContain('stderr message');
    });

    it('should handle empty output commands', async () => {
      const input: BashToolInput = {
        command: 'true' // Command that produces no output but succeeds
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toBe('');
      expect(result.output!.stderr).toBe('');
      expect(result.output!.exitCode).toBe(0);
    });
  });

  describe('timeout and cancellation scenarios', () => {
    it('should handle very short timeouts', async () => {
      const input: BashToolInput = {
        command: 'sleep 2',
        timeout: 1000 // 1 second timeout for 2 second sleep
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(duration).toBeLessThan(2000); // Should timeout before the full sleep
      expect(result.output!.stderr).toContain('timed out');
    });

    it('should handle immediate cancellation', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort immediately

      const input: BashToolInput = {
        command: 'echo "This should not execute"'
      };

      const result = await bashTool.execute(input, { signal: controller.signal });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle cancellation during execution', async () => {
      const controller = new AbortController();
      const input: BashToolInput = {
        command: 'sleep 5'
      };

      // Cancel after 100ms
      setTimeout(() => controller.abort(), 100);

      const result = await bashTool.execute(input, { signal: controller.signal });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('process lifecycle edge cases', () => {
    it('should handle commands that spawn child processes', async () => {
      const input: BashToolInput = {
        command: 'bash -c "echo parent; (echo child &); wait"',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('parent');
      expect(result.output!.exitCode).toBe(0);
    });

    it('should handle commands that exit with various codes', async () => {
      const testCases = [0, 1, 42, 127, 255];

      for (const exitCode of testCases) {
        const input: BashToolInput = {
          command: `exit ${exitCode}`
        };

        const result = await bashTool.execute(input);
        expect(result.success).toBe(true);
        expect(result.output!.exitCode).toBe(exitCode);
      }
    });

    it('should handle commands with large amounts of output', async () => {
      const input: BashToolInput = {
        command: 'for i in $(seq 1 5000); do echo "Line number $i with some additional text to make it longer"; done',
        timeout: 15000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('Line number 1');
      expect(result.output!.stdout).toContain('Line number 5000');
      expect(result.output!.exitCode).toBe(0);
    });
  });

  describe('context and environment edge cases', () => {
    it('should handle missing working directory gracefully', async () => {
      const input: BashToolInput = {
        command: 'pwd'
      };

      const result = await bashTool.execute(input, {
        workingDirectory: '/non/existent/directory/12345'
      });

      // The command should still execute, but might fail or use a fallback directory
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle environment variables with special characters', async () => {
      const input: BashToolInput = {
        command: 'echo "$SPECIAL_VAR"'
      };

      const result = await bashTool.execute(input, {
        environment: {
          SPECIAL_VAR: 'Value with spaces and "quotes" and $pecial ch@rs!'
        }
      });

      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('Value with spaces and "quotes" and $pecial ch@rs!');
    });

    it('should handle very large environment variable values', async () => {
      const largeValue = 'x'.repeat(100000); // 100KB value
      const input: BashToolInput = {
        command: 'echo ${#LARGE_VAR}'
      };

      const result = await bashTool.execute(input, {
        environment: {
          LARGE_VAR: largeValue
        }
      });

      expect(result.success).toBe(true);
      expect(result.output!.stdout.trim()).toBe('100000');
    });
  });

  describe('validation edge cases', () => {
    it('should handle deeply nested validation context', () => {
      const input: BashToolInput = {
        command: 'echo test',
        timeout: 5000,
        description: 'Test command'
      };

      // Test with various context configurations
      const contexts = [
        {},
        { timeout: 10000 },
        { workingDirectory: '/tmp', timeout: 15000 },
        { environment: {}, signal: new AbortController().signal }
      ];

      contexts.forEach(context => {
        const result = bashTool.validate(input, context);
        expect(result.valid).toBe(true);
      });
    });

    it('should provide detailed error messages for multiple validation failures', () => {
      const input: BashToolInput = {
        command: '', // Empty command
        timeout: 500, // Too short timeout
        description: '   ' // Empty description
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(1);
      expect(result.warnings).toBeDefined();
    });
  });

  describe('background execution flag handling', () => {
    it('should accept background execution flag', async () => {
      const input: BashToolInput = {
        command: 'echo "background test"',
        run_in_background: true
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('background test');
      // For now, background execution is noted but executed normally
    });

    it('should handle background execution with timeout', async () => {
      const input: BashToolInput = {
        command: 'echo "background with timeout"',
        run_in_background: true,
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('background with timeout');
    });
  });
});