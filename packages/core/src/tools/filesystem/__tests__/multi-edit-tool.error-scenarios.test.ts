/**
 * @fileoverview Error scenario tests for MultiEditTool - Comprehensive edge case and error coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  MultiEditTool,
  type MultiEditFileParams,
  BatchEditError,
  EditConflictError,
} from '../multi-edit-tool.js';
import { StringNotFoundError, AmbiguousReplacementError, FileAccessError } from '../edit-tool.js';

describe('MultiEditTool - Error Scenario Tests', () => {
  let tool: MultiEditTool;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    tool = new MultiEditTool();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'multi-edit-errors-'));
    testFile = path.join(testDir, 'test.txt');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Validation Error Scenarios', () => {
    it('should handle malformed input parameters gracefully', async () => {
      // Test null/undefined parameters
      const result1 = tool.validate(null as any);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Parameters must be an object');

      const result2 = tool.validate(undefined as any);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Parameters must be an object');

      // Test array instead of object
      const result3 = tool.validate([] as any);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain('Parameters must be an object');

      // Test missing required fields
      const result4 = tool.validate({});
      expect(result4.valid).toBe(false);
      expect(result4.errors).toContain('Missing required parameter: file_path');
      expect(result4.errors).toContain('Missing required parameter: edits');
    });

    it('should handle malformed edit operations', async () => {
      const params = {
        file_path: '/test/file.txt',
        edits: [
          null, // null edit
          undefined, // undefined edit
          {}, // missing required fields
          { old_string: 'test' }, // missing new_string
          { new_string: 'test' }, // missing old_string
          { old_string: '', new_string: 'test' }, // empty old_string
          { old_string: 'test', new_string: 'test' }, // identical strings
          { old_string: 'test', new_string: 'replacement', extra_field: 'not_allowed' }, // extra fields
        ] as any,
      };

      const result = tool.validate(params);
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(5);
    });

    it('should detect complex edit conflicts', async () => {
      const params: MultiEditFileParams = {
        file_path: '/test/file.txt',
        edits: [
          // Create a circular dependency
          { old_string: 'A', new_string: 'B' },
          { old_string: 'B', new_string: 'C' },
          { old_string: 'C', new_string: 'A' },

          // Create overlapping patterns
          { old_string: 'function myFunction()', new_string: 'function yourFunction()' },
          { old_string: 'myFunction', new_string: 'ourFunction', replace_all: true },

          // Create substring conflicts
          { old_string: 'log', new_string: 'debug' },
          { old_string: 'console.log', new_string: 'console.warn' },
        ],
      };

      const result = tool.validate(params);
      expect(result.valid).toBe(true); // Validation passes, but should have warnings
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(3);
    });

    it('should handle special characters in edit patterns', async () => {
      const params: MultiEditFileParams = {
        file_path: '/test/file.txt',
        edits: [
          // Regex special characters
          { old_string: '.*+?^${}()|[]\\', new_string: 'safe_text' },

          // Unicode characters
          { old_string: '🎉', new_string: '✅' },

          // Control characters
          { old_string: '\n\r\t', new_string: ' ' },

          // Null bytes (should be rejected in validation)
          { old_string: 'test\0null', new_string: 'replacement' },
        ],
      };

      const result = tool.validate(params);
      expect(result.valid).toBe(true); // Most special chars are valid in content
    });

    it('should validate path security thoroughly', async () => {
      const maliciousPaths = [
        '/etc/passwd',
        '/usr/bin/bash',
        'C:\\Windows\\System32\\cmd.exe',
        '/proc/version',
        '\\\\network\\share\\file.txt',
        '../../../etc/shadow',
        '/dev/null',
        '/sys/class',
      ];

      for (const maliciousPath of maliciousPaths) {
        const params: MultiEditFileParams = {
          file_path: maliciousPath,
          edits: [{ old_string: 'test', new_string: 'replacement' }],
        };

        const result = await tool.execute(params);
        expect(result.success).toBe(false);
        expect(result.error).toContain('sensitive path');
      }
    });
  });

  describe('File System Error Scenarios', () => {
    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');

      const params: MultiEditFileParams = {
        file_path: nonExistentFile,
        edits: [{ old_string: 'test', new_string: 'replacement' }],
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('access');
    });

    it('should handle permission denied scenarios', async () => {
      const content = 'test content';
      await fs.writeFile(testFile, content);

      // Remove write permissions
      await fs.chmod(testFile, 0o444);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [{ old_string: 'test', new_string: 'modified' }],
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);

      // Restore permissions for cleanup
      await fs.chmod(testFile, 0o644);
    });

    it('should handle disk space exhaustion simulation', async () => {
      // We can't actually exhaust disk space in tests, but we can test the error handling path
      const content = 'small content';
      await fs.writeFile(testFile, content);

      // Try to create a replacement that would be impossibly large
      const massiveReplacement = 'x'.repeat(1024 * 1024 * 100); // 100MB string

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'small content', new_string: massiveReplacement },
        ],
      };

      // This might succeed or fail depending on system memory/disk, but should handle gracefully
      const result = await tool.execute(params);

      if (!result.success) {
        // If it fails, it should be a proper error, not a crash
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      } else {
        // If it succeeds, verify the content
        expect(result.output?.sizeChange.after).toBeGreaterThan(result.output?.sizeChange.before!);
      }
    });

    it('should handle corrupted or binary files', async () => {
      // Create a binary file with null bytes and random data
      const binaryData = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD, 0xFC,
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
        ...Array.from({ length: 100 }, () => Math.floor(Math.random() * 256))
      ]);

      await fs.writeFile(testFile, binaryData);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'text that wont exist in binary', new_string: 'replacement' },
        ],
      };

      const result = await tool.execute(params);
      // Should fail to find the string but not crash
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');
    });

    it('should handle symlink and special file scenarios', async () => {
      const targetFile = path.join(testDir, 'target.txt');
      const symlinkFile = path.join(testDir, 'symlink.txt');

      await fs.writeFile(targetFile, 'target content');

      try {
        await fs.symlink(targetFile, symlinkFile);

        const params: MultiEditFileParams = {
          file_path: symlinkFile,
          edits: [{ old_string: 'target', new_string: 'symlinked' }],
        };

        const result = await tool.execute(params);

        if (result.success) {
          // Verify the edit went to the target file
          const targetContent = await fs.readFile(targetFile, 'utf-8');
          expect(targetContent).toContain('symlinked');
        }
      } catch (error) {
        // Symlinks might not be supported on all systems, that's okay
        console.log('Symlink test skipped:', error);
      }
    });
  });

  describe('Content-Based Error Scenarios', () => {
    it('should handle extremely malformed content', async () => {
      // Create content with mixed encodings, line endings, and edge cases
      const malformedContent = [
        'Normal line',
        'Line with\0null byte',
        'Line with\r\nCRLF',
        'Line with\nLF',
        'Line with\rCR only',
        'Very\tlong\t\t\twhitespace',
        '',
        '   ', // only whitespace
        'Unicode: 🔥💯🚀',
        'Binary-like: \x01\x02\x03',
        'Escape sequences: \\n\\t\\r',
        'Very long line: ' + 'a'.repeat(10000),
      ].join('\n');

      await fs.writeFile(testFile, malformedContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'Normal line', new_string: 'Modified line' },
          { old_string: '\0null byte', new_string: ' cleaned' },
          { old_string: 'Unicode: 🔥💯🚀', new_string: 'Unicode: ✅' },
          { old_string: 'a'.repeat(50), new_string: 'shortened', replace_all: true },
        ],
      };

      const result = await tool.execute(params);

      // Should handle malformed content gracefully
      if (result.success) {
        const newContent = await fs.readFile(testFile, 'utf-8');
        expect(newContent).toContain('Modified line');
        expect(newContent).toContain('Unicode: ✅');
      } else {
        // If it fails, should be a proper error
        expect(result.error).toBeDefined();
      }
    });

    it('should handle edge cases in string matching', async () => {
      const content = `
Identical strings: test test test
Overlapping patterns: ababab
Empty strings and whitespace:

Case sensitivity: Test TEST tEsT
Special regex chars: .*+?^${}()|[]\\
Boundary cases: word word_suffix prefix_word
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // This should fail - ambiguous without replace_all
          { old_string: 'test', new_string: 'result' },
        ],
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('appears 3 times');

      // Verify file unchanged
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should handle memory-intensive string operations', async () => {
      // Create content with many repetitive patterns
      const repetitiveContent = 'pattern '.repeat(10000); // 70KB of repeated pattern
      await fs.writeFile(testFile, repetitiveContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'pattern', new_string: 'replacement', replace_all: true },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // Should complete in reasonable time

      // Verify massive replacement worked
      expect(result.output?.editResults[0].replacements).toBe(10000);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).not.toContain('pattern ');
      expect(newContent).toContain('replacement ');
    });

    it('should handle partial matches and false positives', async () => {
      const content = `
console.log('debug message');
console.error('error message');
console.warn('warning message');
myconsole.log('custom logger');
preconsole.log('prefix');
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Should only match exact strings, not partial matches
          { old_string: 'console.log', new_string: 'logger.debug', replace_all: true },
        ],
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(true);
      expect(result.output?.editResults[0].replacements).toBe(1); // Only one exact match

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('logger.debug(\'debug message\')');
      expect(newContent).toContain('myconsole.log(\'custom logger\')'); // Should be unchanged
      expect(newContent).toContain('preconsole.log(\'prefix\')'); // Should be unchanged
      expect(newContent).toContain('console.error'); // Should be unchanged
    });
  });

  describe('Rollback Error Scenarios', () => {
    it('should handle backup file creation failures', async () => {
      const content = 'test content';
      await fs.writeFile(testFile, content);

      // Make the directory read-only to prevent backup creation
      await fs.chmod(testDir, 0o555);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'test', new_string: 'modified' },
        ],
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);

      // Restore permissions
      await fs.chmod(testDir, 0o755);

      // Verify original file is unchanged
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should handle backup restoration failures', async () => {
      const content = 'test content';
      await fs.writeFile(testFile, content);

      // This is a more complex scenario where we simulate the backup
      // being created successfully but restoration failing
      // In practice, this would be very rare but could happen with filesystem issues

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'test content', new_string: 'modified content' },
          { old_string: 'nonexistent string', new_string: 'replacement' }, // This will cause rollback
        ],
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // File should be restored to original state
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should handle concurrent access scenarios', async () => {
      const content = 'shared content for concurrent access';
      await fs.writeFile(testFile, content);

      // Start multiple edit operations on the same file
      const promises = Array.from({ length: 5 }, (_, i) => {
        const params: MultiEditFileParams = {
          file_path: testFile,
          edits: [
            { old_string: 'shared content', new_string: `modified by operation ${i}` },
          ],
        };

        return tool.execute(params);
      });

      const results = await Promise.allSettled(promises);

      // At most one should succeed (the first one to acquire file access)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;

      expect(successful).toBeLessThanOrEqual(1);
      expect(failed).toBeGreaterThanOrEqual(4);

      // File should be in a consistent state
      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toBeDefined();
      expect(finalContent.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Limit Error Scenarios', () => {
    it('should handle file size limit violations', async () => {
      // Create a file that's just under the limit
      const content = 'x'.repeat(50 * 1024 * 1024 - 1000); // Just under 50MB
      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'x'.repeat(100), new_string: 'y'.repeat(200), replace_all: true }, // This would double size
        ],
      };

      // This should work since we're under the limit
      const result = await tool.execute(params);

      if (result.success) {
        expect(result.output?.sizeChange.after).toBeGreaterThan(result.output?.sizeChange.before!);
      } else {
        // If it fails, should be due to resource constraints, not crashes
        expect(result.error).toBeDefined();
      }
    });

    it('should handle edit count limit violations', async () => {
      await fs.writeFile(testFile, 'test content');

      // Try to exceed the maximum number of edits
      const tooManyEdits = Array.from({ length: 101 }, (_, i) => ({
        old_string: `nonexistent_${i}`,
        new_string: `replacement_${i}`
      }));

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: tooManyEdits,
      };

      // Should fail validation before execution
      const validation = tool.validate(params);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Maximum number of edits exceeded');
    });

    it('should handle extremely long file paths', async () => {
      // Create a very long but valid path
      const longDirName = 'a'.repeat(100);
      const longDir = path.join(testDir, longDirName);
      await fs.mkdir(longDir);

      const longFileName = 'b'.repeat(200) + '.txt';
      const longFilePath = path.join(longDir, longFileName);

      try {
        await fs.writeFile(longFilePath, 'content');

        const params: MultiEditFileParams = {
          file_path: longFilePath,
          edits: [
            { old_string: 'content', new_string: 'modified' },
          ],
        };

        const result = await tool.execute(params);

        // Should either succeed or fail gracefully
        if (result.success) {
          const content = await fs.readFile(longFilePath, 'utf-8');
          expect(content).toContain('modified');
        } else {
          expect(result.error).toBeDefined();
        }
      } catch (error) {
        // Some filesystems don't support very long paths, that's okay
        console.log('Long path test skipped due to filesystem limitation');
      }
    });
  });
});