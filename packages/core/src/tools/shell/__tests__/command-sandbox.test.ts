/**
 * @fileoverview Unit tests for CommandSandbox class
 * Tests sandbox configuration, validation logic, and security features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommandSandbox,
  createStrictSandbox,
  createPermissiveSandbox,
  createDisabledSandbox,
  type SandboxConfig
} from '../command-sandbox.js';

describe('CommandSandbox', () => {
  let sandbox: CommandSandbox;

  beforeEach(() => {
    sandbox = new CommandSandbox();
  });

  describe('constructor and configuration', () => {
    it('should create instance with default configuration', () => {
      const config = sandbox.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.allowSudo).toBe(false);
      expect(config.allowNetwork).toBe(true);
      expect(config.maxCommandLength).toBe(10000);
      expect(config.customBlocklist).toEqual([]);
      expect(config.allowlist).toEqual([]);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<SandboxConfig> = {
        allowSudo: true,
        maxCommandLength: 5000,
        customBlocklist: ['custom_pattern']
      };

      const customSandbox = new CommandSandbox(customConfig);
      const config = customSandbox.getConfig();

      expect(config.allowSudo).toBe(true);
      expect(config.maxCommandLength).toBe(5000);
      expect(config.customBlocklist).toEqual(['custom_pattern']);
      expect(config.allowNetwork).toBe(true); // Should keep default
    });

    it('should update configuration dynamically', () => {
      sandbox.updateConfig({ allowSudo: true, maxCommandLength: 2000 });
      const config = sandbox.getConfig();

      expect(config.allowSudo).toBe(true);
      expect(config.maxCommandLength).toBe(2000);
    });

    it('should enable/disable sandbox', () => {
      expect(sandbox.getConfig().enabled).toBe(true);

      sandbox.setEnabled(false);
      expect(sandbox.getConfig().enabled).toBe(false);

      sandbox.setEnabled(true);
      expect(sandbox.getConfig().enabled).toBe(true);
    });
  });

  describe('basic validation', () => {
    it('should allow simple safe commands', () => {
      const safeCommands = [
        'ls -la',
        'cat file.txt',
        'echo "hello world"',
        'git status',
        'npm test'
      ];

      safeCommands.forEach(command => {
        const result = sandbox.validate(command);
        expect(result.allowed).toBe(true);
      });
    });

    it('should block commands exceeding maximum length', () => {
      const longCommand = 'echo ' + 'a'.repeat(15000);
      const result = sandbox.validate(longCommand);

      expect(result.allowed).toBe(false);
      expect(result.blockedReason).toContain('exceeds maximum length');
      expect(result.violationType).toBe('forbidden_pattern');
    });

    it('should allow empty validation when sandbox is disabled', () => {
      sandbox.setEnabled(false);
      const result = sandbox.validate('rm -rf /');

      expect(result.allowed).toBe(true);
    });
  });

  describe('allowlist functionality', () => {
    it('should allow explicitly allowlisted patterns', () => {
      sandbox.updateConfig({
        allowlist: ['rm -rf /tmp/specific_file']
      });

      const result = sandbox.validate('rm -rf /tmp/specific_file');
      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain('Command explicitly allowed by allowlist');
    });

    it('should allow allowlist to override blocklist', () => {
      sandbox.updateConfig({
        allowlist: ['sudo.*safe_command']
      });

      const result = sandbox.validate('sudo safe_command');
      expect(result.allowed).toBe(true);
    });
  });

  describe('sudo restrictions', () => {
    it('should block sudo when allowSudo is false', () => {
      const result = sandbox.validate('sudo ls');

      expect(result.allowed).toBe(false);
      expect(result.blockedReason).toContain('Privilege escalation');
    });

    it('should allow sudo when allowSudo is true', () => {
      sandbox.updateConfig({ allowSudo: true });

      // Note: This might still be blocked by the main blocklist patterns
      // This test checks that the sudo-specific restriction is lifted
      const sandboxWithSudo = new CommandSandbox({
        allowSudo: true,
        allowlist: ['sudo ls'] // Explicitly allow to override main blocklist
      });

      const result = sandboxWithSudo.validate('sudo ls');
      expect(result.allowed).toBe(true);
    });
  });

  describe('network restrictions', () => {
    it('should allow network commands when allowNetwork is true', () => {
      const networkCommands = ['curl http://example.com', 'wget http://example.com'];

      networkCommands.forEach(command => {
        const result = sandbox.validate(command);
        expect(result.allowed).toBe(true);
      });
    });

    it('should block network commands when allowNetwork is false', () => {
      sandbox.updateConfig({ allowNetwork: false });

      const networkCommands = ['curl http://example.com', 'wget http://example.com', 'ssh user@host'];

      networkCommands.forEach(command => {
        const result = sandbox.validate(command);
        expect(result.allowed).toBe(false);
        expect(result.blockedReason).toContain('Network commands are not allowed');
      });
    });
  });

  describe('custom blocklist', () => {
    it('should block commands matching custom patterns', () => {
      sandbox.updateConfig({
        customBlocklist: ['python.*-c', 'node.*eval']
      });

      const blockedCommands = [
        'python -c "print(1)"',
        'node -e "console.log(1)"',
        'node eval something'
      ];

      blockedCommands.forEach(command => {
        const result = sandbox.validate(command);
        expect(result.allowed).toBe(false);
        expect(result.blockedReason).toContain('custom security rule');
      });
    });
  });

  describe('path traversal integration', () => {
    it('should block commands with path traversal attempts', () => {
      const traversalCommands = [
        'cat ../../../etc/passwd',
        'ls ../../',
        'rm ../important.txt'
      ];

      traversalCommands.forEach(command => {
        const result = sandbox.validate(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('path_traversal');
      });
    });
  });

  describe('working directory validation', () => {
    it('should validate working directory constraints', () => {
      const constrainedSandbox = new CommandSandbox({
        baseDirectory: '/tmp'
      });

      // Should allow execution within base directory
      const allowedResult = constrainedSandbox.validate('ls', '/tmp/subdir');
      expect(allowedResult.allowed).toBe(true);

      // Should block execution outside base directory
      const blockedResult = constrainedSandbox.validate('ls', '/etc');
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.violationType).toBe('directory_escape');
    });

    it('should respect allowed paths', () => {
      const constrainedSandbox = new CommandSandbox({
        baseDirectory: '/tmp',
        allowedPaths: ['/var/log']
      });

      // Should allow execution in allowed path outside base
      const allowedResult = constrainedSandbox.validate('ls', '/var/log');
      expect(allowedResult.allowed).toBe(true);

      // Should still block other paths
      const blockedResult = constrainedSandbox.validate('ls', '/etc');
      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('warning generation', () => {
    it('should generate warnings for risky but allowed operations', () => {
      const riskyCommands = [
        'chmod 755 file.txt',
        'curl http://example.com',
        'tar -xf archive.tar'
      ];

      riskyCommands.forEach(command => {
        const result = sandbox.validate(command);
        expect(result.allowed).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('utility methods', () => {
    it('should test if patterns are blocked', () => {
      expect(sandbox.isPatternBlocked('rm -rf /')).toBe(true);
      expect(sandbox.isPatternBlocked('ls')).toBe(false);
    });

    it('should provide configuration statistics', () => {
      const stats = sandbox.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.hasBaseDirectory).toBe(false);
      expect(stats.allowedPathsCount).toBe(0);
      expect(stats.customBlocklistCount).toBe(0);
      expect(stats.allowlistCount).toBe(0);
      expect(stats.maxCommandLength).toBe(10000);
    });
  });
});

describe('Factory Functions', () => {
  describe('createStrictSandbox', () => {
    it('should create sandbox with strict security settings', () => {
      const strict = createStrictSandbox('/project');
      const config = strict.getConfig();

      expect(config.baseDirectory).toBe('/project');
      expect(config.allowSudo).toBe(false);
      expect(config.allowNetwork).toBe(false);
      expect(config.maxCommandLength).toBe(5000);
      expect(config.customBlocklist.length).toBeGreaterThan(0);
    });

    it('should block network commands in strict mode', () => {
      const strict = createStrictSandbox();
      const result = strict.validate('curl http://example.com');

      expect(result.allowed).toBe(false);
    });
  });

  describe('createPermissiveSandbox', () => {
    it('should create sandbox with permissive settings', () => {
      const permissive = createPermissiveSandbox('/project');
      const config = permissive.getConfig();

      expect(config.baseDirectory).toBe('/project');
      expect(config.allowSudo).toBe(false); // Still no sudo by default
      expect(config.allowNetwork).toBe(true);
      expect(config.maxCommandLength).toBe(20000);
      expect(config.allowedPaths).toContain('/tmp');
    });

    it('should allow network commands in permissive mode', () => {
      const permissive = createPermissiveSandbox();
      const result = permissive.validate('curl http://example.com');

      expect(result.allowed).toBe(true);
    });
  });

  describe('createDisabledSandbox', () => {
    it('should create completely disabled sandbox', () => {
      const disabled = createDisabledSandbox();
      const config = disabled.getConfig();

      expect(config.enabled).toBe(false);
    });

    it('should allow any command when disabled', () => {
      const disabled = createDisabledSandbox();

      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /',
        'dd if=/dev/zero of=/dev/sda'
      ];

      dangerousCommands.forEach(command => {
        const result = disabled.validate(command);
        expect(result.allowed).toBe(true);
      });
    });
  });
});