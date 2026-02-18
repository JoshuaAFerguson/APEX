/**
 * @fileoverview Integration tests for BashTool
 * Tests real-world command scenarios and tool behavior in realistic conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool Integration Tests', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('real-world command scenarios', () => {
    it('should execute git status command successfully', async () => {
      const input: BashToolInput = {
        command: 'git status --porcelain',
        description: 'Check git repository status',
        timeout: 10000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.exitCode).toBeGreaterThanOrEqual(0);
      // Note: Exit code might be non-zero if not in a git repository
    }, 15000);

    it('should execute npm command to check version', async () => {
      const input: BashToolInput = {
        command: 'npm --version',
        description: 'Check npm version',
        timeout: 10000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toMatch(/^\d+\.\d+\.\d+/);
      expect(result.output!.exitCode).toBe(0);
    }, 15000);

    it('should execute node version check', async () => {
      const input: BashToolInput = {
        command: 'node --version',
        description: 'Check Node.js version',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toMatch(/^v\d+\.\d+\.\d+/);
      expect(result.output!.exitCode).toBe(0);
    }, 10000);

    it('should handle directory listing with various flags', async () => {
      const commands = [
        'ls',
        'ls -la',
        'ls -lah',
        'ls --color=never'
      ];

      for (const command of commands) {
        const input: BashToolInput = {
          command,
          description: `List directory contents with: ${command}`,
          timeout: 5000
        };

        const result = await bashTool.execute(input);
        expect(result.success).toBe(true);
        expect(result.output!.exitCode).toBe(0);
      }
    }, 20000);

    it('should execute file operations safely', async () => {
      const testFile = '/tmp/bash-tool-test.txt';
      const testContent = 'Hello from BashTool test!';

      // Create test file
      const createInput: BashToolInput = {
        command: `echo "${testContent}" > ${testFile}`,
        description: 'Create test file',
        timeout: 5000
      };

      const createResult = await bashTool.execute(createInput);
      expect(createResult.success).toBe(true);
      expect(createResult.output!.exitCode).toBe(0);

      // Read test file
      const readInput: BashToolInput = {
        command: `cat ${testFile}`,
        description: 'Read test file',
        timeout: 5000
      };

      const readResult = await bashTool.execute(readInput);
      expect(readResult.success).toBe(true);
      expect(readResult.output!.stdout.trim()).toBe(testContent);
      expect(readResult.output!.exitCode).toBe(0);

      // Clean up test file
      const cleanupInput: BashToolInput = {
        command: `rm -f ${testFile}`,
        description: 'Clean up test file',
        timeout: 5000
      };

      const cleanupResult = await bashTool.execute(cleanupInput);
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.output!.exitCode).toBe(0);
    }, 15000);
  });

  describe('complex command pipelines', () => {
    it('should handle command pipelines with multiple stages', async () => {
      const input: BashToolInput = {
        command: 'echo -e "apple\\nbanana\\ncherry" | sort | head -2',
        description: 'Sort and limit fruit list',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('apple');
      expect(result.output!.stdout).toContain('banana');
      expect(result.output!.stdout).not.toContain('cherry');
      expect(result.output!.exitCode).toBe(0);
    }, 10000);

    it('should handle grep operations', async () => {
      const input: BashToolInput = {
        command: 'echo -e "line1\\ntest line\\nline3" | grep "test"',
        description: 'Filter lines with grep',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout.trim()).toBe('test line');
      expect(result.output!.exitCode).toBe(0);
    }, 10000);

    it('should handle awk text processing', async () => {
      const input: BashToolInput = {
        command: 'echo "field1 field2 field3" | awk \'{print $2}\'',
        description: 'Extract second field with awk',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout.trim()).toBe('field2');
      expect(result.output!.exitCode).toBe(0);
    }, 10000);
  });

  describe('development workflow commands', () => {
    it('should handle typical development commands', async () => {
      const commands = [
        'whoami',
        'date',
        'uname -a',
        'which bash',
        'echo $HOME'
      ];

      for (const command of commands) {
        const input: BashToolInput = {
          command,
          description: `Execute development command: ${command}`,
          timeout: 5000
        };

        const result = await bashTool.execute(input);
        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
        expect(result.output!.exitCode).toBe(0);
      }
    }, 25000);

    it('should handle file system navigation commands', async () => {
      const commands = [
        'pwd',
        'ls /',
        'echo $PATH | head -c 100' // Limit PATH output to avoid very long lines
      ];

      for (const command of commands) {
        const input: BashToolInput = {
          command,
          description: `Execute filesystem command: ${command}`,
          timeout: 5000
        };

        const result = await bashTool.execute(input);
        expect(result.success).toBe(true);
        expect(result.output!.exitCode).toBe(0);
      }
    }, 15000);
  });

  describe('error scenarios in real commands', () => {
    it('should handle attempts to access non-existent files', async () => {
      const input: BashToolInput = {
        command: 'cat /non/existent/file/12345.txt',
        description: 'Try to read non-existent file',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true); // Command executed, even if it failed
      expect(result.output!.exitCode).not.toBe(0); // Should have non-zero exit code
      expect(result.output!.stderr).toContain('No such file');
    }, 10000);

    it('should handle permission denied scenarios', async () => {
      const input: BashToolInput = {
        command: 'cat /etc/sudoers 2>&1 || echo "Permission denied as expected"',
        description: 'Try to read protected file',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      // Should either succeed with content or show permission denied
      expect(result.output).toBeDefined();
    }, 10000);

    it('should handle network unavailable scenarios', async () => {
      const input: BashToolInput = {
        command: 'ping -c 1 -W 1 127.0.0.1 2>&1 || echo "Network command failed"',
        description: 'Test network connectivity',
        timeout: 5000
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      // Should either succeed with ping output or show failure message
    }, 10000);
  });

  describe('performance and resource tests', () => {
    it('should handle CPU-intensive commands with reasonable timeout', async () => {
      const input: BashToolInput = {
        command: 'for i in $(seq 1 1000); do echo "Processing $i" >/dev/null; done; echo "Done"',
        description: 'Execute CPU-intensive loop',
        timeout: 15000
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.stdout.trim()).toBe('Done');
      expect(duration).toBeLessThan(15000);
    }, 20000);

    it('should handle multiple rapid executions', async () => {
      const commands = Array.from({ length: 5 }, (_, i) => ({
        command: `echo "Command ${i + 1}"`,
        description: `Rapid execution test ${i + 1}`,
        timeout: 5000
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        commands.map(cmd => bashTool.execute(cmd))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.output!.stdout.trim()).toBe(`Command ${i + 1}`);
      });
      expect(duration).toBeLessThan(10000); // Should complete reasonably quickly
    }, 15000);
  });
});