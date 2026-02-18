import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { SecretScanner } from '../scanner';
import type { SecretPattern } from '@apexcli/core';

// Mock fs module for testing file operations
vi.mock('fs');
const mockedFs = vi.mocked(fs);

/**
 * File operation tests for SecretScanner (orchestrator package)
 * Tests file scanning, error handling, and edge cases for file operations
 */
describe('SecretScanner - File Operations and Edge Cases', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
    vi.clearAllMocks();
  });

  describe('File Reading Edge Cases', () => {
    it('should handle non-existent files gracefully', async () => {
      mockedFs.readFileSync.mockImplementation(() => {
        const error = new Error('File not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      });

      const result = scanner.scanFile('non-existent-file.txt');
      expect(result.detections).toHaveLength(0);
      expect(result.filePath).toBe('non-existent-file.txt');
      expect(result.scannedAt).toBeInstanceOf(Date);
    });

    it('should handle permission denied errors', async () => {
      mockedFs.readFileSync.mockImplementation(() => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      });

      const result = scanner.scanFile('permission-denied-file.txt');
      expect(result.detections).toHaveLength(0);
      expect(result.filePath).toBe('permission-denied-file.txt');
    });

    it('should handle empty files', async () => {
      mockedFs.readFileSync.mockReturnValue('');

      const result = scanner.scanFile('empty-file.txt');
      expect(result.detections).toHaveLength(0);
      expect(result.filePath).toBe('empty-file.txt');
    });

    it('should handle files with only whitespace', async () => {
      mockedFs.readFileSync.mockReturnValue('   \n\t\n   ');

      const result = scanner.scanFile('whitespace-file.txt');
      expect(result.detections).toHaveLength(0);
    });

    it('should handle binary file content gracefully', async () => {
      // Simulate binary content with null bytes and control characters
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]).toString();
      mockedFs.readFileSync.mockReturnValue(binaryContent);

      expect(() => {
        const result = scanner.scanFile('binary-file.bin');
        expect(Array.isArray(result.detections)).toBe(true);
      }).not.toThrow();
    });

    it('should handle very large files', async () => {
      // Simulate a large file (5MB of content)
      const largeContent = 'safe content line\n'.repeat(500_000);
      mockedFs.readFileSync.mockReturnValue(largeContent);

      const startTime = Date.now();
      const result = scanner.scanFile('large-file.txt');
      const endTime = Date.now();

      expect(result.detections).toHaveLength(0);
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('Batch File Operations', () => {
    it('should handle empty file list', () => {
      const results = scanner.scanFiles([]);
      expect(results).toHaveLength(0);
    });

    it('should handle mix of existing and non-existing files', () => {
      mockedFs.readFileSync.mockImplementation((filePath) => {
        if (filePath === 'existing-file.txt') {
          return 'safe content';
        } else {
          const error = new Error('File not found') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
      });

      const filePaths = ['existing-file.txt', 'missing-file.txt'];
      const results = scanner.scanFiles(filePaths);

      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe('existing-file.txt');
      expect(results[1].filePath).toBe('missing-file.txt');
    });

    it('should handle files with different encodings', () => {
      mockedFs.readFileSync.mockImplementation((filePath) => {
        if (filePath === 'utf8-file.txt') {
          return 'UTF-8 content with émojis 🚀';
        } else if (filePath === 'ascii-file.txt') {
          return 'ASCII content only';
        }
        return 'default content';
      });

      const filePaths = ['utf8-file.txt', 'ascii-file.txt'];
      const results = scanner.scanFiles(filePaths);

      expect(results).toHaveLength(2);
      expect(results[0].detections).toHaveLength(0);
      expect(results[1].detections).toHaveLength(0);
    });
  });

  describe('Pattern Conversion and Management', () => {
    it('should handle custom patterns with file operations', () => {
      const customPattern: SecretPattern = {
        name: 'Test File Pattern',
        pattern: 'FILETEST[0-9]{8}',
        severity: 'medium'
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false
      });

      mockedFs.readFileSync.mockReturnValue('content with FILETEST12345678 pattern');

      const result = testScanner.scanFile('test-file.txt');
      expect(result.detections).toHaveLength(1);
      expect(result.detections[0].patternName).toBe('Test File Pattern');
    });

    it('should handle patterns with special characters in file context', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      testScanner.addPattern({
        name: 'Special Char Pattern',
        pattern: 'SPECIAL[!@#$%]{5}',
        severity: 'low'
      });

      mockedFs.readFileSync.mockReturnValue('content SPECIAL!@#$% more content');

      const result = testScanner.scanFile('special-file.txt');
      expect(result.detections).toHaveLength(1);
    });
  });

  describe('Result Generation Edge Cases', () => {
    it('should generate consistent scan results for same content', () => {
      mockedFs.readFileSync.mockReturnValue('consistent content');

      const result1 = scanner.scanFile('same-file.txt');
      const result2 = scanner.scanFile('same-file.txt');

      expect(result1.detections).toHaveLength(result2.detections.length);
      expect(result1.filePath).toBe(result2.filePath);
    });

    it('should handle createScanResult with various detection counts', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      // Add multiple test patterns
      testScanner.addPattern({
        name: 'Pattern 1',
        pattern: 'MULTI1[0-9]{4}',
        severity: 'low'
      });

      testScanner.addPattern({
        name: 'Pattern 2',
        pattern: 'MULTI2[A-Z]{4}',
        severity: 'high'
      });

      mockedFs.readFileSync.mockReturnValue('MULTI11234 and MULTI2ABCD in same file');

      const result = testScanner.scanFile('multi-pattern-file.txt');
      expect(result.detections).toHaveLength(2);
      expect(result.detections[0].severity).toBe('low');
      expect(result.detections[1].severity).toBe('high');
    });

    it('should handle scan method with file path parameter', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      testScanner.addPattern({
        name: 'Test Pattern',
        pattern: 'SCANTEST[0-9]{6}',
        severity: 'medium'
      });

      const content = 'content with SCANTEST123456 pattern';
      const detections = testScanner.scan(content, 'test-context.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Test Pattern');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue processing after file read errors', () => {
      mockedFs.readFileSync.mockImplementation((filePath) => {
        if (filePath === 'error-file.txt') {
          throw new Error('Unexpected file error');
        }
        return 'safe content';
      });

      const filePaths = ['safe-file.txt', 'error-file.txt', 'another-safe-file.txt'];
      const results = scanner.scanFiles(filePaths);

      expect(results).toHaveLength(3);
      expect(results[0].detections).toHaveLength(0); // Safe file
      expect(results[1].detections).toHaveLength(0); // Error file (handled gracefully)
      expect(results[2].detections).toHaveLength(0); // Safe file
    });

    it('should handle concurrent file access gracefully', () => {
      // Simulate file being accessed by another process
      mockedFs.readFileSync.mockImplementation(() => {
        const error = new Error('Resource busy') as NodeJS.ErrnoException;
        error.code = 'EBUSY';
        throw error;
      });

      expect(() => {
        const result = scanner.scanFile('busy-file.txt');
        expect(result.detections).toHaveLength(0);
      }).not.toThrow();
    });
  });

  describe('Memory and Performance', () => {
    it('should handle multiple large files without memory issues', () => {
      const largeContent = 'line of safe content\n'.repeat(100_000); // ~2MB per file
      mockedFs.readFileSync.mockReturnValue(largeContent);

      const filePaths = Array(10).fill(0).map((_, i) => `large-file-${i}.txt`);

      const startTime = Date.now();
      const results = scanner.scanFiles(filePaths);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete in reasonable time
    });

    it('should handle files with many lines efficiently', () => {
      const manyLinesContent = Array(50_000).fill('safe line content').join('\n');
      mockedFs.readFileSync.mockReturnValue(manyLinesContent);

      const startTime = Date.now();
      const result = scanner.scanFile('many-lines-file.txt');
      const endTime = Date.now();

      expect(result.detections).toHaveLength(0);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});