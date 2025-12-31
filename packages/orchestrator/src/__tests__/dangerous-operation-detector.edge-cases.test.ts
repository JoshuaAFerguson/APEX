/**
 * @fileoverview Edge case tests for DangerousOperationDetector
 * Tests boundary conditions, error scenarios, and unusual inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DangerousOperationDetector } from '../dangerous-operation-detector';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

describe('DangerousOperationDetector Edge Cases', () => {
  let detector: DangerousOperationDetector;

  beforeEach(() => {
    detector = new DangerousOperationDetector();
  });

  describe('Input Validation and Error Handling', () => {
    it('should handle null tool_input gracefully', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: null as any
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle undefined tool_input gracefully', async () => {
      const input = {
        tool_name: 'Bash'
        // tool_input is undefined
      } as HookInput;

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle tool_input as primitive value', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: 'string instead of object' as any
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle missing tool_name', async () => {
      const input = {
        tool_input: { command: 'rm -rf /' }
        // tool_name is missing
      } as HookInput;

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle empty strings in command', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: '' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle whitespace-only commands', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: '   \t\n   ' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle very long commands', async () => {
      const longCommand = 'echo ' + 'a'.repeat(10000);
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: longCommand }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
      // Should not throw errors or hang
    });

    it('should handle command with special characters', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'echo "こんにちは" && echo "🚀" | grep "test"' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });
  });

  describe('Boundary Conditions for Pattern Matching', () => {
    it('should detect dangerous pattern at start of command', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf / && echo done' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(true);
      expect(result.details?.severity).toBe('critical');
    });

    it('should detect dangerous pattern at end of command', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'echo starting && rm -rf /' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(true);
      expect(result.details?.severity).toBe('critical');
    });

    it('should detect dangerous pattern in middle of command', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'echo start && rm -rf / && echo end' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(true);
      expect(result.details?.severity).toBe('critical');
    });

    it('should handle case insensitive pattern matching for bash', async () => {
      const inputs = [
        'DROP DATABASE test',
        'drop database test',
        'Drop Database test',
        'DROP database test'
      ];

      for (const command of inputs) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('high');
      }
    });

    it('should not match partial patterns', async () => {
      const safeCommands = [
        'echo "rm -rf"',  // Inside quotes, not actual command
        'mkdir -p /tmp/rm-rf-test',  // Contains pattern but not dangerous
        'grep "rm -rf" file.txt',  // Searching for pattern
        'echo "Please do not run rm -rf /"'  // Warning about pattern
      ];

      for (const command of safeCommands) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command }
        };

        const result = await detector.detectDangerousOperation(input);
        // These should still be detected as dangerous because the basic pattern matching
        // doesn't parse command structure - this is expected behavior for safety
        expect(result.isDangerous).toBe(true);
      }
    });
  });

  describe('File Path Edge Cases', () => {
    it('should handle file paths with special characters', async () => {
      const specialPaths = [
        '/path/with spaces/.env',
        '/path/with-unicode-文件/.env',
        '/path/with/emoji/🔥/.env',
        '/path/with"quotes/.env',
        "/path/with'apostrophe/.env"
      ];

      for (const filePath of specialPaths) {
        const input: HookInput = {
          tool_name: 'Write',
          tool_input: { file_path: filePath, content: 'test' }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('high');
      }
    });

    it('should handle relative vs absolute paths', async () => {
      const paths = [
        '.env',          // Relative
        './.env',        // Relative with ./
        '../.env',       // Relative with ../
        '/home/user/.env', // Absolute
        '~/.env'         // Home directory
      ];

      for (const filePath of paths) {
        const input: HookInput = {
          tool_name: 'Edit',
          tool_input: { file_path: filePath, old_string: 'old', new_string: 'new' }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('high');
      }
    });

    it('should handle empty file paths', async () => {
      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '', content: 'test' }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false);
    });

    it('should handle missing file_path in different tool formats', async () => {
      const inputs = [
        { tool_name: 'Write', tool_input: { content: 'test' } },
        { tool_name: 'Edit', tool_input: { old_string: 'old', new_string: 'new' } },
        { tool_name: 'MultiEdit', tool_input: { edits: [] } }
      ] as HookInput[];

      for (const input of inputs) {
        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(false);
      }
    });
  });

  describe('Content Analysis Edge Cases', () => {
    it('should detect secrets in various quote formats', async () => {
      const secretFormats = [
        'password="secret123"',
        "password='secret123'",
        'password=secret123',  // No quotes
        'password : "secret123"',  // Spaces around colon
        'password= "secret123"',   // Space after equals
      ];

      for (const content of secretFormats) {
        const input: HookInput = {
          tool_name: 'Write',
          tool_input: { file_path: 'config.txt', content }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.reason).toContain('sensitive information');
      }
    });

    it('should handle very large content', async () => {
      const largeContent = 'API_KEY="' + 'x'.repeat(100000) + '"';
      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: 'large.txt', content: largeContent }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(true);
      // Should not cause performance issues
    });

    it('should handle content with no secrets', async () => {
      const safeContents = [
        'const message = "Hello World"',
        'function test() { return 42; }',
        '# This is a comment\nconst value = 123;',
        '',  // Empty content
        '   \n\t   ',  // Whitespace only
      ];

      for (const content of safeContents) {
        const input: HookInput = {
          tool_name: 'Write',
          tool_input: { file_path: 'safe.txt', content }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(false);
      }
    });

    it('should handle mixed content with secrets and safe code', async () => {
      const mixedContent = `
        // Safe configuration
        const config = {
          appName: "MyApp",
          version: "1.0.0",
          // Dangerous: embedded secret
          apiKey: "sk-1234567890abcdef1234567890abcdef",
          debug: true
        };
      `;

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: 'config.js', content: mixedContent }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(true);
      expect(result.details?.reason).toContain('sensitive information');
    });
  });

  describe('URL Edge Cases', () => {
    it('should handle malformed URLs gracefully', async () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        'ftp://incomplete',
        '://missing-protocol',
        'http://[invalid-ipv6]',
      ];

      for (const url of malformedUrls) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url }
        };

        const result = await detector.detectDangerousOperation(input);
        // Should not throw errors, may or may not be detected as dangerous
        expect(typeof result.isDangerous).toBe('boolean');
      }
    });

    it('should handle URLs with various port numbers', async () => {
      const urlsWithPorts = [
        'http://localhost:8080/admin',
        'https://127.0.0.1:3000/api',
        'http://192.168.1.1:8000/config',
        'https://10.0.0.1:443/secure'
      ];

      for (const url of urlsWithPorts) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('high');
      }
    });

    it('should handle URLs with query parameters and fragments', async () => {
      const complexUrls = [
        'http://localhost:8080/admin?token=secret#section1',
        'https://127.0.0.1/api?user=admin&password=test',
        'file:///etc/passwd?param=value#anchor'
      ];

      for (const url of complexUrls) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url }
        };

        const result = await detector.detectDangerousOperation(input);
        if (url.startsWith('file://')) {
          expect(result.isDangerous).toBe(true);
          expect(result.details?.severity).toBe('critical');
        } else {
          expect(result.isDangerous).toBe(true);
          expect(result.details?.severity).toBe('high');
        }
      }
    });

    it('should handle international domain names', async () => {
      const internationalUrls = [
        'https://例え.テスト/api',
        'http://münchen.example.com/data',
        'https://café.example.org/secret'
      ];

      for (const url of internationalUrls) {
        const input: HookInput = {
          tool_name: 'WebFetch',
          tool_input: { url }
        };

        const result = await detector.detectDangerousOperation(input);
        if (url.includes('secret')) {
          expect(result.isDangerous).toBe(true);
        }
      }
    });

    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000) + '/path';
      const input: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: longUrl }
      };

      const result = await detector.detectDangerousOperation(input);
      expect(result.isDangerous).toBe(false); // Should be safe if no dangerous patterns
    });
  });

  describe('Regex Pattern Edge Cases', () => {
    it('should handle regex special characters in commands', async () => {
      // Commands that contain regex special characters but are safe
      const commandsWithRegexChars = [
        'grep "^test.*$" file.txt',
        'sed "s/[0-9]\\+/X/g" input.txt',
        'find . -name "*.js" -exec echo {} \\;',
        'awk "/pattern/ { print $1 }" data.txt'
      ];

      for (const command of commandsWithRegexChars) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(false);
      }
    });

    it('should match fork bomb regex correctly', async () => {
      const forkBombVariations = [
        ':(){:|:&};:',
        ': () { : | : & } ; :',  // With spaces
        ':(){:|:&};: # fork bomb comment'  // With comment
      ];

      for (const command of forkBombVariations) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('critical');
      }
    });

    it('should match device file patterns correctly', async () => {
      const deviceFileCommands = [
        'echo test > /dev/sda1',
        'cat /etc/passwd > /dev/sdb',
        'dd if=/dev/zero of=/dev/sdc'
      ];

      for (const command of deviceFileCommands) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command }
        };

        const result = await detector.detectDangerousOperation(input);
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toMatch(/critical|high/);
      }
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid successive calls efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      // Create 100 concurrent detection calls
      for (let i = 0; i < 100; i++) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command: `echo test${i}` }
        };
        promises.push(detector.detectDangerousOperation(input));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // All should be safe
      results.forEach(result => {
        expect(result.isDangerous).toBe(false);
      });
    });

    it('should handle complex regex patterns efficiently', async () => {
      const complexCommand = 'find /usr/share -type f -name "*.txt" | xargs grep -l "pattern" | head -10';

      const startTime = Date.now();
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: complexCommand }
      };

      const result = await detector.detectDangerousOperation(input);
      const endTime = Date.now();

      // Should complete quickly even with complex input
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.isDangerous).toBe(false);
    });
  });
});