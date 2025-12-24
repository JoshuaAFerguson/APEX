/**
 * README Section Analysis Tests
 * Tests the getMissingReadmeSections functionality in the orchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ApexOrchestrator } from '../index.js';
import { IdleProcessor } from '../idle-processor.js';
import { MissingReadmeSection, ReadmeSection } from '@apexcli/core';

// Mock dependencies
vi.mock('../idle-processor.js');
vi.mock('fs/promises');

describe('README Section Analysis', () => {
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

  describe('getMissingReadmeSections', () => {
    it('should return empty array when no analysis available', async () => {
      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(null);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
      expect(mockIdleProcessor.start).toHaveBeenCalled();
      expect(mockIdleProcessor.processIdleTime).toHaveBeenCalled();
      expect(mockIdleProcessor.getLastAnalysis).toHaveBeenCalled();
    });

    it('should return empty array when documentation analysis has no missing sections', async () => {
      const mockAnalysis = {
        documentation: {
          missingReadmeSections: [],
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
    });

    it('should return missing README sections from analysis', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Instructions for installing the package'
        },
        {
          section: 'usage',
          priority: 'required',
          description: 'Basic usage examples and API overview'
        },
        {
          section: 'api',
          priority: 'recommended',
          description: 'Detailed API documentation'
        }
      ];

      const mockAnalysis = {
        documentation: {
          missingReadmeSections: missingSections,
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual(missingSections);
      expect(result).toHaveLength(3);
      expect(result[0].section).toBe('installation');
      expect(result[0].priority).toBe('required');
      expect(result[1].section).toBe('usage');
      expect(result[2].section).toBe('api');
    });

    it('should handle analysis with all priority levels', async () => {
      const missingSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'How to install'
        },
        {
          section: 'api',
          priority: 'recommended',
          description: 'API documentation'
        },
        {
          section: 'faq',
          priority: 'optional',
          description: 'Frequently asked questions'
        }
      ];

      const mockAnalysis = {
        documentation: {
          missingReadmeSections: missingSections,
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual(missingSections);

      // Check that all priority levels are represented
      const priorities = result.map(section => section.priority);
      expect(priorities).toContain('required');
      expect(priorities).toContain('recommended');
      expect(priorities).toContain('optional');
    });

    it('should handle all standard README section types', async () => {
      const allSections: ReadmeSection[] = [
        'title', 'description', 'installation', 'usage', 'api',
        'examples', 'contributing', 'license', 'changelog',
        'troubleshooting', 'faq', 'dependencies'
      ];

      const missingSections: MissingReadmeSection[] = allSections.map(section => ({
        section,
        priority: 'required',
        description: `Description for ${section} section`
      }));

      const mockAnalysis = {
        documentation: {
          missingReadmeSections: missingSections,
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toHaveLength(12);

      // Verify all section types are handled
      const sectionNames = result.map(section => section.section);
      allSections.forEach(expectedSection => {
        expect(sectionNames).toContain(expectedSection);
      });
    });

    it('should throw error when orchestrator is not initialized', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      await expect(uninitializedOrchestrator.getMissingReadmeSections()).rejects.toThrow(
        'Orchestrator must be initialized first'
      );
    });

    it('should handle errors gracefully and return empty array', async () => {
      const error = new Error('IdleProcessor failed');
      mockIdleProcessor.start = vi.fn().mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get missing README sections analysis:', error);

      consoleSpy.mockRestore();
    });

    it('should handle IdleProcessor processIdleTime failure', async () => {
      const error = new Error('ProcessIdleTime failed');
      mockIdleProcessor.processIdleTime = vi.fn().mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get missing README sections analysis:', error);

      consoleSpy.mockRestore();
    });

    it('should handle missing documentation object in analysis', async () => {
      const mockAnalysis = {
        // Missing documentation object
        someOtherData: 'test'
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
    });

    it('should handle null missingReadmeSections in documentation analysis', async () => {
      const mockAnalysis = {
        documentation: {
          missingReadmeSections: null, // Explicitly null
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
    });

    it('should handle undefined missingReadmeSections in documentation analysis', async () => {
      const mockAnalysis = {
        documentation: {
          // missingReadmeSections is undefined
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const result = await orchestrator.getMissingReadmeSections();

      expect(result).toEqual([]);
    });

    it('should create new IdleProcessor instance for each call', async () => {
      const MockIdleProcessor = IdleProcessor as any;

      await orchestrator.getMissingReadmeSections();
      await orchestrator.getMissingReadmeSections();

      expect(MockIdleProcessor).toHaveBeenCalledTimes(2);
    });

    it('should call IdleProcessor methods in correct order', async () => {
      const callOrder: string[] = [];

      mockIdleProcessor.start = vi.fn().mockImplementation(async () => {
        callOrder.push('start');
      });

      mockIdleProcessor.processIdleTime = vi.fn().mockImplementation(async () => {
        callOrder.push('processIdleTime');
      });

      mockIdleProcessor.getLastAnalysis = vi.fn().mockImplementation(() => {
        callOrder.push('getLastAnalysis');
        return null;
      });

      await orchestrator.getMissingReadmeSections();

      expect(callOrder).toEqual(['start', 'processIdleTime', 'getLastAnalysis']);
    });
  });

  describe('Integration with getDocumentationAnalysis', () => {
    it('should work independently of getDocumentationAnalysis', async () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation instructions'
        }
      ];

      const outdatedDocs = [
        {
          file: 'README.md',
          type: 'version-mismatch' as const,
          description: 'Version mismatch',
          severity: 'high' as const
        }
      ];

      const mockAnalysis = {
        documentation: {
          missingReadmeSections,
          outdatedDocs
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const [missingResults, outdatedResults] = await Promise.all([
        orchestrator.getMissingReadmeSections(),
        orchestrator.getDocumentationAnalysis()
      ]);

      expect(missingResults).toEqual(missingReadmeSections);
      expect(outdatedResults).toEqual(outdatedDocs);
    });

    it('should handle concurrent calls correctly', async () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'usage',
          priority: 'required',
          description: 'Usage examples'
        }
      ];

      const mockAnalysis = {
        documentation: {
          missingReadmeSections,
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      // Make multiple concurrent calls
      const promises = Array.from({ length: 5 }, () =>
        orchestrator.getMissingReadmeSections()
      );

      const results = await Promise.all(promises);

      // All results should be identical
      results.forEach(result => {
        expect(result).toEqual(missingReadmeSections);
      });
    });
  });

  describe('Performance tests', () => {
    it('should handle large numbers of missing sections efficiently', async () => {
      const largeSectionsList: MissingReadmeSection[] = Array.from({ length: 100 }, (_, i) => ({
        section: 'api' as ReadmeSection,
        priority: 'recommended' as const,
        description: `Section ${i} description that is quite long to test memory handling`
      }));

      const mockAnalysis = {
        documentation: {
          missingReadmeSections: largeSectionsList,
          outdatedDocs: []
        }
      };

      mockIdleProcessor.getLastAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const startTime = Date.now();
      const result = await orchestrator.getMissingReadmeSections();
      const endTime = Date.now();

      expect(result).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});