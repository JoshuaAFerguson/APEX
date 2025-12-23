/**
 * Documentation Analysis Engine Tests
 * Tests the core documentation analysis functionality in the orchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ApexOrchestrator } from '../index.js';
import { IdleProcessor } from '../idle-processor.js';
import { OutdatedDocumentation } from '@apexcli/core';

// Mock dependencies
vi.mock('../idle-processor.js');
vi.mock('fs/promises');

describe('Documentation Analysis Engine', () => {
  let orchestrator: ApexOrchestrator;
  let mockIdleProcessor: Partial<IdleProcessor>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = '/mock/project/path';

    mockIdleProcessor = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      processIdleTime: vi.fn().mockResolvedValue(undefined),
      getLastAnalysis: vi.fn().mockReturnValue(null),
    };

    // Mock IdleProcessor constructor
    const MockIdleProcessor = IdleProcessor as any;
    MockIdleProcessor.mockImplementation(() => mockIdleProcessor);

    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
    await orchestrator.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDocumentationAnalysis', () => {
    it('should return empty array when no analysis available', async () => {
      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(null);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toEqual([]);
      expect(mockIdleProcessor.start).toHaveBeenCalled();
      expect(mockIdleProcessor.processIdleTime).toHaveBeenCalled();
      expect(mockIdleProcessor.getLastAnalysis).toHaveBeenCalled();
    });

    it('should return documentation analysis when available', async () => {
      const mockAnalysis = {
        documentation: {
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch' as const,
              description: 'Version mismatch detected',
              severity: 'high' as const,
              line: 1,
              suggestion: 'Update version number',
            },
            {
              file: 'docs/api.md',
              type: 'deprecated-api' as const,
              description: 'Deprecated API referenced',
              severity: 'medium' as const,
              line: 10,
            },
          ],
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        file: 'README.md',
        type: 'version-mismatch',
        description: 'Version mismatch detected',
        severity: 'high',
        line: 1,
        suggestion: 'Update version number',
      });
      expect(result[1]).toEqual({
        file: 'docs/api.md',
        type: 'deprecated-api',
        description: 'Deprecated API referenced',
        severity: 'medium',
        line: 10,
      });
    });

    it('should handle analysis with empty outdatedDocs array', async () => {
      const mockAnalysis = {
        documentation: {
          outdatedDocs: [],
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toEqual([]);
    });

    it('should handle analysis with missing documentation property', async () => {
      const mockAnalysis = {
        // Missing documentation property
        otherData: 'some data',
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toEqual([]);
    });

    it('should handle analysis with missing outdatedDocs property', async () => {
      const mockAnalysis = {
        documentation: {
          // Missing outdatedDocs property
          otherDocData: 'some data',
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toEqual([]);
    });

    it('should create and initialize IdleProcessor correctly', async () => {
      const mockConfig = {
        daemon: {
          enabled: true,
          pollInterval: 5000,
        },
      };

      orchestrator = new ApexOrchestrator({
        projectPath: tempDir,
        config: mockConfig,
      });
      await orchestrator.initialize();

      await orchestrator.getDocumentationAnalysis();

      // Verify IdleProcessor was created with correct parameters
      expect(IdleProcessor).toHaveBeenCalledWith(
        tempDir,
        mockConfig.daemon,
        expect.any(Object) // store
      );
    });

    it('should handle IdleProcessor start failure gracefully', async () => {
      const startError = new Error('Failed to start idle processor');
      mockIdleProcessor.start = vi.fn().mockRejectedValue(startError);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to get documentation analysis:',
        startError
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle IdleProcessor processIdleTime failure gracefully', async () => {
      const processError = new Error('Failed to process idle time');
      mockIdleProcessor.processIdleTime = vi.fn().mockRejectedValue(processError);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to get documentation analysis:',
        processError
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle invalid analysis data types gracefully', async () => {
      const invalidAnalyses = [
        null,
        undefined,
        'string instead of object',
        123,
        [],
        { documentation: null },
        { documentation: 'invalid' },
        { documentation: { outdatedDocs: 'not array' } },
        {
          documentation: {
            outdatedDocs: [
              'invalid item',
              123,
              null,
              { /* missing required fields */ },
            ],
          },
        },
      ];

      for (const invalidAnalysis of invalidAnalyses) {
        mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(invalidAnalysis);

        const result = await orchestrator.getDocumentationAnalysis();
        expect(result).toEqual([]);
      }
    });

    it('should throw error when orchestrator not initialized', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: tempDir });
      // Don't call initialize()

      await expect(uninitializedOrchestrator.getDocumentationAnalysis()).rejects.toThrow(
        'Orchestrator must be initialized first'
      );
    });
  });

  describe('IdleProcessor Integration', () => {
    it('should use existing IdleProcessor if available', async () => {
      // Simulate existing IdleProcessor
      const existingProcessor = { ...mockIdleProcessor };
      (orchestrator as any).idleProcessor = existingProcessor;

      await orchestrator.getDocumentationAnalysis();

      // Should use existing processor, not create new one
      expect(IdleProcessor).not.toHaveBeenCalled();
      expect(existingProcessor.start).toHaveBeenCalled();
    });

    it('should handle complex analysis results with all documentation types', async () => {
      const complexAnalysis = {
        documentation: {
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch',
              description: 'Package version in README (1.0.0) differs from package.json (2.0.0)',
              severity: 'high',
              line: 5,
              suggestion: 'Update README version to match package.json',
            },
            {
              file: 'docs/api.md',
              type: 'deprecated-api',
              description: 'References deprecated /api/v1/auth endpoint',
              severity: 'high',
              line: 25,
              suggestion: 'Update to use /api/v2/auth endpoint',
            },
            {
              file: 'docs/installation.md',
              type: 'broken-link',
              description: 'Link to https://old-site.com returns 404',
              severity: 'medium',
              line: 10,
              suggestion: 'Update link to current website',
            },
            {
              file: 'examples/basic.md',
              type: 'outdated-example',
              description: 'Code example uses deprecated syntax',
              severity: 'medium',
              line: 15,
              suggestion: 'Update example to use current syntax',
            },
            {
              file: 'CHANGELOG.md',
              type: 'stale-reference',
              description: 'No entries for last 6 months',
              severity: 'low',
              suggestion: 'Add recent changes to changelog',
            },
          ],
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(complexAnalysis);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toHaveLength(5);
      expect(result.map(item => item.type)).toEqual([
        'version-mismatch',
        'deprecated-api',
        'broken-link',
        'outdated-example',
        'stale-reference',
      ]);
      expect(result.map(item => item.severity)).toEqual([
        'high',
        'high',
        'medium',
        'medium',
        'low',
      ]);
    });

    it('should handle partial documentation analysis results', async () => {
      const partialAnalysis = {
        documentation: {
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch',
              description: 'Version mismatch',
              severity: 'high',
              // Missing line and suggestion - should work fine
            },
            {
              file: 'docs/guide.md',
              type: 'broken-link',
              description: 'Broken link detected',
              severity: 'medium',
              line: 20,
              // Missing suggestion - should work fine
            },
          ],
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(partialAnalysis);

      const result = await orchestrator.getDocumentationAnalysis();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        file: 'README.md',
        type: 'version-mismatch',
        description: 'Version mismatch',
        severity: 'high',
      });
      expect(result[1]).toEqual({
        file: 'docs/guide.md',
        type: 'broken-link',
        description: 'Broken link detected',
        severity: 'medium',
        line: 20,
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent calls to getDocumentationAnalysis', async () => {
      const mockAnalysis = {
        documentation: {
          outdatedDocs: [
            {
              file: 'test.md',
              type: 'version-mismatch',
              description: 'Test issue',
              severity: 'medium',
            },
          ],
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      // Make multiple concurrent calls
      const promises = Array.from({ length: 5 }, () =>
        orchestrator.getDocumentationAnalysis()
      );

      const results = await Promise.all(promises);

      // All should succeed and return same result
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          file: 'test.md',
          type: 'version-mismatch',
          description: 'Test issue',
          severity: 'medium',
        });
      });
    });

    it('should handle very large documentation analysis results', async () => {
      const largeAnalysis = {
        documentation: {
          outdatedDocs: Array.from({ length: 10000 }, (_, i) => ({
            file: `file-${i}.md`,
            type: 'stale-reference' as const,
            description: `Stale reference in file ${i}`,
            severity: 'low' as const,
            line: i % 100,
          })),
        },
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(largeAnalysis);

      const startTime = Date.now();
      const result = await orchestrator.getDocumentationAnalysis();
      const endTime = Date.now();

      expect(result).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should handle large results quickly
    });

    it('should handle malformed analysis data without crashing', async () => {
      const malformedAnalyses = [
        {
          documentation: {
            outdatedDocs: [
              { file: 'test.md' }, // Missing required fields
              {
                file: 'test2.md',
                type: 'invalid-type',
                description: 'Test',
                severity: 'invalid-severity',
              },
              {
                file: null, // Invalid file
                type: 'version-mismatch',
                description: 'Test',
                severity: 'high',
              },
            ],
          },
        },
      ];

      for (const malformedAnalysis of malformedAnalyses) {
        mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(malformedAnalysis);

        // Should not throw error, should return empty array or filtered results
        const result = await orchestrator.getDocumentationAnalysis();
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });
});