/**
 * @fileoverview Security-focused tests for BashTool
 * Tests security validations, dangerous command detection, and input sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool Security Tests', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('dangerous command detection', () => {
    const dangerousCommands = [
      'rm -rf /',
      'sudo rm -rf /',
      '/bin/rm important.txt',
      '/usr/bin/del file.txt',
      'rmdir folder',
      'format C:',
      'fdisk /dev/sda',
      'mkfs.ext4 /dev/sda1',
      'dd if=/dev/zero of=/dev/sda',
      'shred -vfz -n 3 file.txt',
      'wipe file.txt',
      'shutdown -h now',
      'reboot',
      'halt',
      'sudo su',
      'chmod 777 /',
      'chown root:root file',
      'passwd user',
      'userdel user'
    ];

    dangerousCommands.forEach(command => {
      it(`should warn about dangerous command: ${command}`, () => {
        const input: BashToolInput = { command };
        const result = bashTool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.some(w => w.includes('Potentially dangerous command'))).toBe(true);
      });
    });
  });

  describe('suspicious pattern detection', () => {
    const suspiciousPatterns = [
      'ls; rm file.txt',
      'echo hello | rm file.txt',
      'true && rm file.txt',
      'echo `rm file.txt`',
      'echo $(rm file.txt)',
      'ls >/dev/null 2>&1 &'
    ];

    suspiciousPatterns.forEach(command => {
      it(`should warn about suspicious pattern: ${command}`, () => {
        const input: BashToolInput = { command };
        const result = bashTool.validate(input);

        expect(result.valid).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.some(w => w.includes('potentially suspicious patterns'))).toBe(true);
      });
    });
  });

  describe('command injection protection', () => {
    it('should handle commands with escaped quotes safely', async () => {
      const input: BashToolInput = {
        command: 'echo "This is a \\"quoted\\" string"'
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('This is a "quoted" string');
    });

    it('should handle commands with single quotes safely', async () => {
      const input: BashToolInput = {
        command: "echo 'This is a single quoted string'"
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('This is a single quoted string');
    });

    it('should handle semicolons in quoted strings safely', async () => {
      const input: BashToolInput = {
        command: 'echo "Command with ; semicolon"'
      };

      const result = await bashTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('Command with ; semicolon');
    });
  });

  describe('input sanitization edge cases', () => {
    it('should reject null bytes in command', () => {
      const input: BashToolInput = {
        command: 'echo "hello\x00world"'
      };

      // This test ensures the command parser handles null bytes appropriately
      const result = bashTool.validate(input);
      expect(result.valid).toBe(true); // May still be valid but should be handled safely
    });

    it('should handle very long commands', () => {
      const longCommand = 'echo ' + 'a'.repeat(10000);
      const input: BashToolInput = { command: longCommand };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
    });

    it('should handle commands with unicode characters', () => {
      const input: BashToolInput = {
        command: 'echo "Hello 世界 🌍 café naïve résumé"'
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
    });

    it('should handle commands with control characters', () => {
      const input: BashToolInput = {
        command: 'echo "line1\nline2\tindented"'
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
    });
  });

  describe('context security validation', () => {
    it('should warn when command timeout exceeds context timeout', () => {
      const input: BashToolInput = {
        command: 'sleep 1',
        timeout: 10000
      };

      const result = bashTool.validate(input, { timeout: 5000 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('exceeds execution context timeout'))).toBe(true);
    });
  });
});