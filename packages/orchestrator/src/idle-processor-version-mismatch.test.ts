/**
 * Tests for Version Mismatch Integration in IdleProcessor
 *
 * Verifies that VersionMismatchDetector is properly integrated into
 * IdleProcessor.findOutdatedDocumentation() method.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdleProcessor } from './idle-processor.js';
import type { DaemonConfig } from '@apexcli/core';
import { TaskStore } from './store.js';

describe('IdleProcessor - Version Mismatch Integration', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;

  beforeEach(() => {
    // Mock TaskStore
    mockTaskStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([])
    } as any;

    // Create minimal daemon config
    const config: DaemonConfig = {
      enabled: true,
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3
      }
    };

    idleProcessor = new IdleProcessor('/test/project', config, mockTaskStore);
  });

  describe('findVersionMismatches method', () => {
    it('should import VersionMismatchDetector and return OutdatedDocumentation[]', async () => {
      // Create mock VersionMismatchDetector
      const mockDetector = {
        detectMismatches: vi.fn().mockResolvedValue([
          {
            file: 'README.md',
            line: 5,
            foundVersion: '1.0.0',
            expectedVersion: '2.0.0',
            lineContent: '## Version 1.0.0'
          }
        ])
      };

      // Mock the dynamic import
      vi.doMock('./analyzers/version-mismatch-detector.js', () => ({
        VersionMismatchDetector: vi.fn(() => mockDetector)
      }));

      const processor = idleProcessor as any;
      const result = await processor.findVersionMismatches();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        file: 'README.md',
        type: 'version-mismatch',
        description: 'Found version 1.0.0 but expected 2.0.0',
        line: 5,
        suggestion: 'Update version reference from 1.0.0 to 2.0.0',
        severity: 'high' // Major version difference
      });
    });

    it('should handle detector failures gracefully', async () => {
      // Mock the dynamic import to throw an error
      vi.doMock('./analyzers/version-mismatch-detector.js', () => {
        throw new Error('Module not found');
      });

      const processor = idleProcessor as any;
      const result = await processor.findVersionMismatches();

      expect(result).toEqual([]);
    });
  });

  describe('convertVersionMismatchesToOutdatedDocs method', () => {
    it('should properly convert VersionMismatch to OutdatedDocumentation', () => {
      const mismatches = [
        {
          file: 'docs/api.md',
          line: 10,
          foundVersion: '1.5.0',
          expectedVersion: '2.0.0',
          lineContent: 'API version: 1.5.0'
        },
        {
          file: 'docs/install.md',
          line: 3,
          foundVersion: '2.0.1',
          expectedVersion: '2.0.2',
          lineContent: 'Install version 2.0.1'
        }
      ];

      const processor = idleProcessor as any;
      const result = processor.convertVersionMismatchesToOutdatedDocs(mismatches);

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        file: 'docs/api.md',
        type: 'version-mismatch',
        description: 'Found version 1.5.0 but expected 2.0.0',
        line: 10,
        suggestion: 'Update version reference from 1.5.0 to 2.0.0',
        severity: 'high' // Major version difference
      });

      expect(result[1]).toEqual({
        file: 'docs/install.md',
        type: 'version-mismatch',
        description: 'Found version 2.0.1 but expected 2.0.2',
        line: 3,
        suggestion: 'Update version reference from 2.0.1 to 2.0.2',
        severity: 'low' // Only patch difference
      });
    });
  });

  describe('calculateMismatchSeverity method', () => {
    let processor: any;

    beforeEach(() => {
      processor = idleProcessor as any;
    });

    it('should return high severity for major version differences', () => {
      expect(processor.calculateMismatchSeverity('1.0.0', '2.0.0')).toBe('high');
      expect(processor.calculateMismatchSeverity('2.5.1', '1.0.0')).toBe('high');
    });

    it('should return medium severity for minor version differences', () => {
      expect(processor.calculateMismatchSeverity('1.0.0', '1.1.0')).toBe('medium');
      expect(processor.calculateMismatchSeverity('2.3.1', '2.1.0')).toBe('medium');
    });

    it('should return low severity for patch version differences', () => {
      expect(processor.calculateMismatchSeverity('1.0.0', '1.0.1')).toBe('low');
      expect(processor.calculateMismatchSeverity('2.1.5', '2.1.2')).toBe('low');
    });

    it('should return medium severity for unparseable versions', () => {
      expect(processor.calculateMismatchSeverity('invalid', '1.0.0')).toBe('medium');
      expect(processor.calculateMismatchSeverity('1.0.0', 'invalid')).toBe('medium');
      expect(processor.calculateMismatchSeverity('v1.0', '1.0.0')).toBe('medium');
    });

    it('should handle edge cases gracefully', () => {
      expect(processor.calculateMismatchSeverity('', '')).toBe('medium');
      expect(processor.calculateMismatchSeverity(null as any, '1.0.0')).toBe('medium');
      expect(processor.calculateMismatchSeverity('1.0.0', null as any)).toBe('medium');
    });
  });

  describe('Integration with analyzeDocumentation', () => {
    it('should include version mismatches in outdatedDocs array', async () => {
      // Mock file system and exec operations
      const mockExec = vi.fn();
      mockExec
        .mockResolvedValueOnce({ stdout: 'file1.ts\nfile2.js' }) // analyzeCodebaseSize
        .mockResolvedValueOnce({ stdout: '5' }) // analyzeTestCoverage
        .mockResolvedValueOnce({ stdout: '[]' }) // ESLint
        .mockResolvedValueOnce({ stdout: 'file1.ts 100\nfile2.js 200' }) // complexity hotspots
        .mockResolvedValueOnce({ stdout: 'file1.ts\nfile2.ts' }) // deep nesting
        .mockResolvedValueOnce({ stdout: '0' }) // doc files
        .mockResolvedValueOnce({ stdout: 'file1.ts\nfile2.ts' }) // source files
        .mockResolvedValueOnce({ stdout: 'README.md' }) // findOutdatedDocumentation
        .mockResolvedValueOnce({ stdout: 'README.md' }) // findMissingReadmeSections
        .mockResolvedValueOnce({ stdout: 'file1.ts\nfile2.ts' }) // analyzeAPICompleteness
        .mockResolvedValueOnce({ stdout: '' }) // findStaleComments fallback
        .mockResolvedValueOnce({ stdout: 'file1.ts\nfile2.ts' }) // detectDuplicateCodePatterns
        .mockResolvedValueOnce({ stdout: '' }) // performance analysis
        .mockResolvedValueOnce({ stdout: '' }); // performance analysis 2

      const processor = idleProcessor as any;
      processor.execAsync = mockExec;

      // Mock file read operations
      vi.spyOn(require('fs/promises'), 'readFile')
        .mockResolvedValue('{"name": "test-project", "version": "2.0.0"}') // package.json
        .mockResolvedValueOnce('console.log("test");') // file content for codebase analysis
        .mockResolvedValueOnce('function test() {}') // file content for codebase analysis
        .mockResolvedValueOnce('# Test\nVersion 1.0.0 docs') // README.md for outdated docs
        .mockResolvedValueOnce('# Test Project'); // README.md for missing sections

      // Mock the VersionMismatchDetector
      const mockDetector = {
        detectMismatches: vi.fn().mockResolvedValue([
          {
            file: 'README.md',
            line: 2,
            foundVersion: '1.0.0',
            expectedVersion: '2.0.0',
            lineContent: 'Version 1.0.0 docs'
          }
        ])
      };

      vi.doMock('./analyzers/version-mismatch-detector.js', () => ({
        VersionMismatchDetector: vi.fn(() => mockDetector)
      }));

      const analysis = await processor.analyzeDocumentation();

      // Check that version mismatches are included in outdatedDocs
      expect(analysis.outdatedDocs).toEqual(
        expect.arrayContaining([
          expect.objectMatching({
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Found version 1.0.0 but expected 2.0.0',
            line: 2,
            severity: 'high'
          })
        ])
      );
    });
  });
});