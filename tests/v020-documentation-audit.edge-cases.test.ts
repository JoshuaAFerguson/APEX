/**
 * Edge Case Tests for v0.2.0 Documentation Audit
 *
 * Tests edge cases, error conditions, boundary values, and exceptional scenarios
 * to ensure robust handling of unexpected situations.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import {
  V020DocumentationAuditor,
  auditV020Documentation,
  type DocumentationAuditorConfig
} from '../packages/core/src/audits/v020-documentation-auditor';

// Mock filesystem functions
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn()
}));

vi.mock('yaml', () => ({
  parse: vi.fn()
}));

vi.mock('fs', () => ({
  constants: {
    F_OK: 0
  }
}));

const mockReadFile = readFile as Mock;
const mockAccess = access as Mock;
const mockParse = parse as Mock;

describe('v0.2.0 Documentation Audit Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Boundary Value Testing', () => {
    it('should handle exactly minimum line threshold', async () => {
      const auditor = new V020DocumentationAuditor({
        minimumLineThreshold: 50
      });

      mockAccess.mockResolvedValue(undefined);
      // Create content with exactly 50 lines
      mockReadFile.mockResolvedValue('line\n'.repeat(50));

      const result = await auditor.performAudit();

      expect(result.apiReference.lineCount).toBe(50);
      expect(result.apiReference.hasSubstantiveContent).toBe(false); // Should be > threshold, not >=
    });

    it('should handle one line above minimum threshold', async () => {
      const auditor = new V020DocumentationAuditor({
        minimumLineThreshold: 50
      });

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('line\n'.repeat(51));

      const result = await auditor.performAudit();

      expect(result.apiReference.lineCount).toBe(51);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
    });

    it('should handle zero line threshold', async () => {
      const auditor = new V020DocumentationAuditor({
        minimumLineThreshold: 0
      });

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('');

      const result = await auditor.performAudit();

      expect(result.apiReference.lineCount).toBe(1); // Empty file has 1 line
      expect(result.apiReference.hasSubstantiveContent).toBe(true); // > 0
    });

    it('should handle negative line threshold', async () => {
      const auditor = new V020DocumentationAuditor({
        minimumLineThreshold: -10
      });

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('test');

      const result = await auditor.performAudit();

      expect(result.apiReference.hasSubstantiveContent).toBe(true);
    });

    it('should handle extremely large line threshold', async () => {
      const auditor = new V020DocumentationAuditor({
        minimumLineThreshold: 1000000
      });

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('line\n'.repeat(100));

      const result = await auditor.performAudit();

      expect(result.apiReference.hasSubstantiveContent).toBe(false);
    });
  });

  describe('File System Error Handling', () => {
    it('should handle permission denied errors', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      expect(result.apiReference.exists).toBe(false);
      expect(result.apiReference.details).toContain('❌ File not found');
    });

    it('should handle file system corruption errors', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('EIO: i/o error'));

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(false);
      expect(result.apiReference.details).toContain('❌ File not found');
    });

    it('should handle network file system timeouts', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ETIMEDOUT: timeout')), 10)
        )
      );

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(false);
    });

    it('should handle file being deleted between access and read', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(false);
      expect(result.apiReference.details).toContain('❌ File not found');
    });

    it('should handle disk space errors during file read', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(false);
    });
  });

  describe('File Content Edge Cases', () => {
    it('should handle completely empty files', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('');

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.lineCount).toBe(1); // split('\\n') of empty string gives ['']
      expect(result.apiReference.hasSubstantiveContent).toBe(false);
    });

    it('should handle files with only whitespace', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('   \n\t\n   \n'.repeat(60));

      const result = await auditor.performAudit();

      expect(result.apiReference.hasSubstantiveContent).toBe(true); // Line count > 50
    });

    it('should handle files with extremely long lines', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      // Create a file with one extremely long line
      const longLine = 'a'.repeat(1000000);
      mockReadFile.mockResolvedValue(longLine + '\n'.repeat(60));

      const result = await auditor.performAudit();

      expect(result.apiReference.lineCount).toBe(61);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
    });

    it('should handle files with mixed line endings', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      // Mix of \\n, \\r\\n, and \\r line endings
      const mixedContent = 'line1\nline2\r\nline3\rline4\n'.repeat(20);
      mockReadFile.mockResolvedValue(mixedContent);

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
    });

    it('should handle binary files read as text', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      // Simulate binary content that might be read as garbled text
      const binaryContent = String.fromCharCode(...Array(1000).fill(0).map((_, i) => i % 256));
      mockReadFile.mockResolvedValue(binaryContent + '\n'.repeat(60));

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
    });

    it('should handle files with Unicode and special characters', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      const unicodeContent = `
# Documentation with Unicode 🚀

## API Endpoints 📡

API specs with emojis and special characters:
- Health check: ✅ /health
- Tasks: 📋 /tasks
- Agents: 🤖 /agents

Special characters: àáâãäåæçèéêë
Mathematical symbols: ∑∏∆√∞
Currency: €£¥₹

中文字符支持
العربية support
русский язык
`.repeat(5);

      mockReadFile.mockResolvedValue(unicodeContent);
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: { title: 'Unicode API' },
        paths: { '/health': {} }
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
    });
  });

  describe('YAML Parsing Edge Cases', () => {
    it('should handle malformed YAML with unclosed brackets', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(`
openapi: 3.0.3
info: {
  title: "Unclosed bracket API"
  version: "1.0.0"
paths: [
  "/test": {
`.repeat(20));

      mockParse.mockImplementation(() => {
        throw new SyntaxError('Unexpected end of input');
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.accuracy).toBe('outdated');
      expect(result.apiReference.details).toContain('❌ Invalid YAML format');
    });

    it('should handle YAML with circular references', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(`
openapi: 3.0.3
info:
  title: Circular API
  version: "1.0.0"
`.repeat(20));

      mockParse.mockImplementation(() => {
        throw new Error('Converting circular structure to JSON');
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.accuracy).toBe('outdated');
    });

    it('should handle YAML with null values', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(`
openapi: 3.0.3
info: null
paths: null
components: null
`.repeat(20));

      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: null,
        paths: null,
        components: null
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.accuracy).toBe('outdated');
      expect(result.apiReference.details.some(d => d.includes('❌ Missing'))).toBe(true);
    });

    it('should handle YAML with undefined values', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(`
openapi: 3.0.3
info:
  title: Test API
`.repeat(20));

      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: { title: 'Test API' },
        paths: undefined,
        components: undefined
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.accuracy).toBe('outdated');
    });

    it('should handle YAML parsing throwing unexpected error types', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('openapi: 3.0.3\n'.repeat(60));

      // Throw a non-standard error
      mockParse.mockImplementation(() => {
        throw 'String error instead of Error object';
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.accuracy).toBe('outdated');
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle null configuration', async () => {
      expect(() => new V020DocumentationAuditor(null as any)).not.toThrow();
    });

    it('should handle undefined configuration values', async () => {
      const config = {
        docsDirectory: undefined,
        minimumLineThreshold: undefined,
        detailedAnalysis: undefined
      };

      expect(() => new V020DocumentationAuditor(config)).not.toThrow();
    });

    it('should handle empty string directory path', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: ''
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
    });

    it('should handle directory path with special characters', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: 'docs with spaces & special chars!@#$%'
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
    });

    it('should handle very long directory paths', async () => {
      const longPath = 'very-long-directory-name-'.repeat(20);
      const auditor = new V020DocumentationAuditor({
        docsDirectory: longPath
      });

      mockAccess.mockRejectedValue(new Error('ENAMETOOLONG'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
    });
  });

  describe('Concurrent Access Edge Cases', () => {
    it('should handle multiple concurrent audits', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Test content\n'.repeat(60));
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: {},
        paths: {},
        components: { schemas: {} }
      });

      // Run multiple audits concurrently
      const promises = Array(5).fill(0).map(() =>
        auditV020Documentation()
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.overallStatus).toBe('passing');
        expect(result.auditDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });

    it('should handle audit during file system changes', async () => {
      const auditor = new V020DocumentationAuditor();

      // Simulate file being modified during audit
      mockAccess.mockResolvedValue(undefined);

      let callCount = 0;
      mockReadFile.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve('# Initial content\n'.repeat(60));
        } else {
          return Promise.resolve('# Modified content\n'.repeat(80));
        }
      });

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('passing');
      // Should handle different content for different files gracefully
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large files without memory issues', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);

      // Simulate very large file content
      const largeContent = 'Large line of content '.repeat(1000) + '\n';
      const veryLargeContent = largeContent.repeat(10000); // ~200MB of text

      mockReadFile.mockResolvedValue(veryLargeContent);

      const startMemory = process.memoryUsage().heapUsed;
      const result = await auditor.performAudit();
      const endMemory = process.memoryUsage().heapUsed;

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);

      // Memory usage should not grow excessively (allow 50MB increase)
      expect(endMemory - startMemory).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle audit timeout scenarios gracefully', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);

      // Simulate very slow file reads
      mockReadFile.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve('# Slow content\n'.repeat(60)), 100)
        )
      );

      const startTime = Date.now();
      const result = await auditor.performAudit();
      const endTime = Date.now();

      expect(result.overallStatus).toBe('passing');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10s
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    it('should handle Windows path separators in file paths', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: 'C:\\Users\\Test\\Documents\\docs'
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      // Should handle path correctly regardless of platform
    });

    it('should handle Unix hidden files and permissions', async () => {
      const auditor = new V020DocumentationAuditor({
        docsDirectory: '.hidden-docs'
      });

      mockAccess.mockRejectedValue(new Error('EACCES'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
    });
  });

  describe('Summary Generation Edge Cases', () => {
    it('should handle summary generation with all edge case results', async () => {
      const auditor = new V020DocumentationAuditor();

      // Mix of edge case scenarios
      mockAccess.mockImplementation((path) => {
        if (path.includes('openapi.yaml')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockReadFile.mockImplementation((path) => {
        if (path.includes('openapi.yaml')) {
          return Promise.resolve('openapi: invalid\n'.repeat(60));
        }
        return Promise.reject(new Error('EACCES'));
      });

      mockParse.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const result = await auditor.performAudit();

      expect(result.summary).toContain('FAILING ❌');
      expect(result.summary).toContain('Documents found: 1/5');
      expect(result.summary).toContain('Invalid YAML format');
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('should handle summary with mixed accuracy levels', async () => {
      const auditor = new V020DocumentationAuditor();

      mockAccess.mockResolvedValue(undefined);

      let fileIndex = 0;
      mockReadFile.mockImplementation(() => {
        const contents = [
          'openapi: 3.0.3\ninfo: {}\npaths: {}\n'.repeat(20), // Accurate OpenAPI
          '# Agent basics\n'.repeat(60), // Minimal agent docs
          '# Workflow basics\n'.repeat(60), // Minimal workflow docs
          '# Best practices\n'.repeat(60), // Minimal best practices
          '# Quick diagnostic\n'.repeat(60) // Minimal troubleshooting
        ];
        return Promise.resolve(contents[fileIndex++] || '');
      });

      // Mock varying levels of completeness
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: {},
        paths: {}
        // Missing components - will be mostly-accurate
      });

      const result = await auditor.performAudit();

      expect(result.summary).toContain('Implementation accuracy:');
      expect(typeof result.summary).toBe('string');
      expect(result.summary.split('\n').length).toBeGreaterThan(5);
    });
  });
});