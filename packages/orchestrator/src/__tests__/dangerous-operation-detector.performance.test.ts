/**
 * @fileoverview Performance tests for DangerousOperationDetector
 * Ensures the detector performs efficiently under various load conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DangerousOperationDetector } from '../dangerous-operation-detector';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

describe('DangerousOperationDetector Performance', () => {
  let detector: DangerousOperationDetector;

  beforeEach(() => {
    detector = new DangerousOperationDetector();
  });

  describe('Single Operation Performance', () => {
    it('should detect simple safe commands quickly', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' }
      };

      const startTime = performance.now();
      const result = await detector.detectDangerousOperation(input);
      const endTime = performance.now();

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(10); // Should complete in under 10ms
    });

    it('should detect simple dangerous commands quickly', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' }
      };

      const startTime = performance.now();
      const result = await detector.detectDangerousOperation(input);
      const endTime = performance.now();

      expect(result.isDangerous).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should complete in under 10ms
    });

    it('should handle long commands efficiently', async () => {
      const longCommand = 'echo ' + '"' + 'a'.repeat(10000) + '"';
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: longCommand }
      };

      const startTime = performance.now();
      const result = await detector.detectDangerousOperation(input);
      const endTime = performance.now();

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(50); // Should handle large inputs efficiently
    });

    it('should handle complex file content analysis efficiently', async () => {
      const complexContent = `
        // Large configuration file with many properties
        const config = {
          ${Array.from({ length: 1000 }, (_, i) => `prop${i}: "value${i}"`).join(',\n')}
        };
        // This should not contain secrets
      `;

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: 'large-config.js', content: complexContent }
      };

      const startTime = performance.now();
      const result = await detector.detectDangerousOperation(input);
      const endTime = performance.now();

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(100); // Should handle large content efficiently
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple concurrent safe operations efficiently', async () => {
      const inputs = Array.from({ length: 100 }, (_, i) => ({
        tool_name: 'Bash',
        tool_input: { command: `echo "test ${i}"` }
      } as HookInput));

      const startTime = performance.now();
      const promises = inputs.map(input => detector.detectDangerousOperation(input));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      // All should be safe
      results.forEach(result => expect(result.isDangerous).toBe(false));

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(500); // 100 operations in under 500ms
      expect((endTime - startTime) / 100).toBeLessThan(5); // Average under 5ms per operation
    });

    it('should handle mixed safe and dangerous operations concurrently', async () => {
      const inputs: HookInput[] = [
        // Safe operations
        ...Array.from({ length: 50 }, (_, i) => ({
          tool_name: 'Bash',
          tool_input: { command: `echo "safe ${i}"` }
        })),
        // Dangerous operations
        ...Array.from({ length: 50 }, (_, i) => ({
          tool_name: 'Bash',
          tool_input: { command: i % 2 === 0 ? 'rm -rf /' : 'sudo rm -rf /' }
        }))
      ];

      const startTime = performance.now();
      const promises = inputs.map(input => detector.detectDangerousOperation(input));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      // Check results
      const safeResults = results.slice(0, 50);
      const dangerousResults = results.slice(50);

      safeResults.forEach(result => expect(result.isDangerous).toBe(false));
      dangerousResults.forEach(result => expect(result.isDangerous).toBe(true));

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent file operations with different patterns', async () => {
      const fileInputs: HookInput[] = [
        // Safe files
        ...Array.from({ length: 20 }, (_, i) => ({
          tool_name: 'Write',
          tool_input: { file_path: `safe-file-${i}.txt`, content: 'safe content' }
        })),
        // Environment files (dangerous)
        ...Array.from({ length: 20 }, (_, i) => ({
          tool_name: 'Write',
          tool_input: { file_path: `.env.${i}`, content: 'API_KEY=value' }
        })),
        // System files (critical)
        ...Array.from({ length: 10 }, (_, i) => ({
          tool_name: 'Edit',
          tool_input: { file_path: `/etc/passwd.${i}`, old_string: 'old', new_string: 'new' }
        }))
      ];

      const startTime = performance.now();
      const promises = fileInputs.map(input => detector.detectDangerousOperation(input));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const safeResults = results.slice(0, 20);
      const envResults = results.slice(20, 40);
      const systemResults = results.slice(40);

      safeResults.forEach(result => expect(result.isDangerous).toBe(false));
      envResults.forEach(result => {
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('high');
      });
      systemResults.forEach(result => {
        expect(result.isDangerous).toBe(true);
        expect(result.details?.severity).toBe('critical');
      });

      expect(endTime - startTime).toBeLessThan(800); // Should complete efficiently
    });
  });

  describe('Pattern Matching Performance', () => {
    it('should efficiently match against all bash patterns', async () => {
      const commands = [
        'ls -la',
        'rm -rf /',
        'sudo apt install',
        'git status',
        'DROP DATABASE test',
        'chmod 755 file',
        'mkfs.ext4 /dev/sda1',
        ':(){:|:&};:',
        'echo hello',
        'npm install'
      ];

      const inputs = commands.map(command => ({
        tool_name: 'Bash',
        tool_input: { command }
      } as HookInput));

      const startTime = performance.now();

      // Run each input multiple times to test pattern matching efficiency
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(...inputs.map(input => detector.detectDangerousOperation(input)));
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // Should complete pattern matching efficiently
      expect(endTime - startTime).toBeLessThan(1000); // 100 operations in under 1 second
      expect(results.length).toBe(100);

      // Verify dangerous commands are detected
      const dangerousIndices = [1, 4, 6, 7]; // rm -rf /, DROP DATABASE, mkfs, fork bomb
      for (let i = 0; i < 10; i++) {
        for (const idx of dangerousIndices) {
          const resultIndex = i * 10 + idx;
          expect(results[resultIndex].isDangerous).toBe(true);
        }
      }
    });

    it('should handle regex patterns efficiently with edge case inputs', async () => {
      const regexTestInputs = [
        // Test fork bomb regex with variations
        ':(){:|:&};:',
        ': () { : | : & } ; :',
        ':(){:&:;};:',

        // Test device file regex
        'echo test > /dev/sda1',
        'cat file > /dev/sdb',
        'dd if=/dev/zero of=/dev/sdc1',

        // Test pipe to shell regex
        'curl script.sh | sh',
        'wget script.sh | bash',
        'echo code | sh',

        // Safe commands that shouldn't match
        'echo "no danger here"',
        'ls /dev/null',
        'grep "pattern" file'
      ];

      const inputs = regexTestInputs.map(command => ({
        tool_name: 'Bash',
        tool_input: { command }
      } as HookInput));

      const startTime = performance.now();
      const promises = inputs.map(input => detector.detectDangerousOperation(input));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200); // Should be very fast for regex matching

      // First 9 should be dangerous, last 3 should be safe
      results.slice(0, 9).forEach((result, i) => {
        expect(result.isDangerous).toBe(true);
      });

      results.slice(9).forEach((result, i) => {
        expect(result.isDangerous).toBe(false);
      });
    });
  });

  describe('Sensitive Content Detection Performance', () => {
    it('should efficiently detect secrets in various content sizes', async () => {
      const contentSizes = [100, 1000, 10000, 50000]; // Different content sizes

      for (const size of contentSizes) {
        const content = 'const data = "' + 'x'.repeat(size - 50) + '"; API_KEY="sk-secret123456789"';

        const input: HookInput = {
          tool_name: 'Write',
          tool_input: { file_path: `test-${size}.js`, content }
        };

        const startTime = performance.now();
        const result = await detector.detectDangerousOperation(input);
        const endTime = performance.now();

        expect(result.isDangerous).toBe(true);
        expect(result.details?.reason).toContain('sensitive information');

        // Performance should scale reasonably with content size
        expect(endTime - startTime).toBeLessThan(size / 100); // Rough performance expectation
      }
    });

    it('should efficiently handle content with many false positives', async () => {
      // Content with many words that could look like secrets but aren't
      const falsePositiveContent = `
        const config = {
          password_field: "password",
          api_endpoint: "/api/key",
          secret_sauce: "recipe",
          token_type: "bearer",
          credential_check: false,
          password_validation: true,
          api_key_field: "X-API-Key",
          secret_key_name: "secretKey"
        };
        // No actual secrets here, just field names
      `;

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: 'config.js', content: falsePositiveContent }
      };

      const startTime = performance.now();
      const result = await detector.detectDangerousOperation(input);
      const endTime = performance.now();

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(50); // Should quickly determine no real secrets
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory with repeated operations', async () => {
      // Measure initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command: `echo "iteration ${i}"` }
        };
        await detector.detectDangerousOperation(input);

        // Force garbage collection every 100 operations if available
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large content without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create large content (1MB)
      const largeContent = 'x'.repeat(1024 * 1024);

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: 'large.txt', content: largeContent }
      };

      const startTime = performance.now();
      const result = await detector.detectDangerousOperation(input);
      const endTime = performance.now();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(100); // Should process quickly

      // Memory usage should not be excessive (less than 5x the content size)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Initialization Performance', () => {
    it('should initialize detector instances quickly', () => {
      const startTime = performance.now();

      // Create multiple detector instances
      const detectors = Array.from({ length: 100 }, () => new DangerousOperationDetector());

      const endTime = performance.now();

      expect(detectors.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(100); // Should initialize quickly
    });

    it('should have minimal startup overhead', () => {
      const startTime = performance.now();
      const detector = new DangerousOperationDetector();
      const initTime = performance.now();

      // First operation should be fast (patterns should be pre-compiled)
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'echo test' }
      };

      detector.detectDangerousOperation(input);
      const firstOpTime = performance.now();

      expect(initTime - startTime).toBeLessThan(10); // Fast initialization
      expect(firstOpTime - initTime).toBeLessThan(10); // Fast first operation
    });
  });
});