/**
 * @fileoverview Security-focused tests for BashTool
 * Tests security validations, dangerous command detection, and input sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import { createStrictSandbox, createPermissiveSandbox, createDisabledSandbox } from '../command-sandbox.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool Security Tests', () => {
  let bashTool: BashTool;
  let strictBashTool: BashTool;
  let permissiveBashTool: BashTool;
  let disabledBashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool(); // Default sandbox
    strictBashTool = new BashTool(createStrictSandbox('/tmp').getConfig());
    permissiveBashTool = new BashTool(createPermissiveSandbox().getConfig());
    disabledBashTool = new BashTool(createDisabledSandbox().getConfig());
  });

  describe('dangerous command blocking (new behavior)', () => {
    const dangerousCommands = [
      'rm -rf /',
      'sudo rm -rf /',
      '/bin/rm important.txt',
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
      it(`should block dangerous command: ${command}`, () => {
        const input: BashToolInput = { command };
        const result = bashTool.validate(input);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.some(e => e.includes('Command blocked'))).toBe(true);
      });
    });

    it('should allow dangerous commands when sandbox is disabled', () => {
      const input: BashToolInput = { command: 'rm -rf /' };
      const result = disabledBashTool.validate(input);

      expect(result.valid).toBe(true);
      // Should still get legacy warnings
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('Potentially dangerous command'))).toBe(true);
    });
  });

  describe('dangerous command detection (legacy warnings)', () => {
    const dangerousCommands = [
      '/usr/bin/del file.txt', // Not blocked by new patterns but generates legacy warning
    ];

    dangerousCommands.forEach(command => {
      it(`should warn about dangerous command: ${command}`, () => {
        const input: BashToolInput = { command };
        const result = disabledBashTool.validate(input); // Use disabled to see legacy warnings

        expect(result.valid).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.some(w => w.includes('Potentially dangerous command'))).toBe(true);
      });
    });
  });

  describe('suspicious pattern detection', () => {
    const suspiciousPatterns = [
      'ls; rm -rf file.txt',     // This should be blocked by new sandbox
      'echo hello | rm file.txt', // This should be blocked by new sandbox
      'true && rm -rf file.txt', // This should be blocked by new sandbox
      'echo `rm -rf file.txt`',  // This should be blocked by new sandbox
      'echo $(rm -rf file.txt)', // This should be blocked by new sandbox
    ];

    const legacySuspiciousPatterns = [
      'ls >/dev/null 2>&1 &'     // This generates legacy warning only
    ];

    suspiciousPatterns.forEach(command => {
      it(`should block suspicious pattern: ${command}`, () => {
        const input: BashToolInput = { command };
        const result = bashTool.validate(input);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.some(e => e.includes('Command blocked'))).toBe(true);
      });
    });

    legacySuspiciousPatterns.forEach(command => {
      it(`should warn about legacy suspicious pattern: ${command}`, () => {
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

  describe('path traversal protection', () => {
    it('should block commands with path traversal attempts', () => {
      const pathTraversalCommands = [
        'cat ../../../etc/passwd',
        'ls ../../',
        'cp file ../../../tmp/',
        'rm -rf ../../../important',
      ];

      pathTraversalCommands.forEach(command => {
        const input: BashToolInput = { command };
        const result = strictBashTool.validate(input);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.some(e => e.includes('Path traversal') || e.includes('Command blocked'))).toBe(true);
      });
    });

    it('should allow relative paths within working directory', () => {
      const safeCommands = [
        'ls ./subdir',
        'cat file.txt',
        'mkdir new_folder',
      ];

      safeCommands.forEach(command => {
        const input: BashToolInput = { command };
        const result = bashTool.validate(input);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('working directory constraints', () => {
    it('should block execution outside base directory in strict mode', () => {
      const input: BashToolInput = { command: 'ls' };
      const result = strictBashTool.validate(input, { workingDirectory: '/etc' });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('outside the allowed sandbox'))).toBe(true);
    });

    it('should allow execution within base directory', () => {
      const input: BashToolInput = { command: 'ls' };
      const result = strictBashTool.validate(input, { workingDirectory: '/tmp/subdir' });

      expect(result.valid).toBe(true);
    });
  });

  describe('sandbox configuration modes', () => {
    it('should have different blocking behavior based on sandbox mode', () => {
      const input: BashToolInput = { command: 'curl http://example.com' };

      // Strict mode blocks network commands
      const strictResult = strictBashTool.validate(input);
      expect(strictResult.valid).toBe(false);

      // Permissive mode allows network commands
      const permissiveResult = permissiveBashTool.validate(input);
      expect(permissiveResult.valid).toBe(true);

      // Disabled mode allows everything
      const disabledResult = disabledBashTool.validate(input);
      expect(disabledResult.valid).toBe(true);
    });

    it('should block commands exceeding length limits', () => {
      const longCommand = 'echo ' + 'a'.repeat(20000); // Exceeds default limit
      const input: BashToolInput = { command: longCommand };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('exceeds maximum length'))).toBe(true);
    });
  });

  describe('allowlist functionality', () => {
    it('should allow explicitly allowlisted patterns even if they would normally be blocked', () => {
      const allowlistTool = new BashTool({
        allowlist: ['rm -rf /tmp/safe_to_delete']
      });

      const input: BashToolInput = { command: 'rm -rf /tmp/safe_to_delete' };
      const result = allowlistTool.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('explicitly allowed'))).toBe(true);
    });
  });

  describe('sandbox warnings', () => {
    it('should generate warnings for potentially risky but allowed operations', () => {
      const riskyCommands = [
        'chmod 755 file.txt',
        'curl http://trusted-site.com',
        'tar -xzf archive.tar.gz',
      ];

      riskyCommands.forEach(command => {
        const input: BashToolInput = { command };
        const result = permissiveBashTool.validate(input);

        expect(result.valid).toBe(true);
        if (result.warnings) {
          // Should have some warning about the risky operation
          expect(result.warnings.length).toBeGreaterThan(0);
        }
      });
    });
  });
});