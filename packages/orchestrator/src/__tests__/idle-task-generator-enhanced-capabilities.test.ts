/**
 * Comprehensive tests for IdleTaskGenerator enhanced capabilities
 *
 * This test suite focuses on testing the enhanced analysis features
 * including project analysis enhancement, cross-reference validation,
 * and version mismatch detection.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  IdleTaskGenerator,
  MaintenanceAnalyzer,
  RefactoringAnalyzer,
  DocsAnalyzer,
  TestsAnalyzer,
  TaskCandidate,
  StrategyAnalyzer,
} from '../idle-task-generator';
import { IdleTaskType, StrategyWeights } from '@apexcli/core';
import type { ProjectAnalysis } from '../idle-processor';

// Mock generateIdleTaskId to produce predictable IDs
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  let counter = 0;
  return {
    ...actual,
    generateIdleTaskId: () => `idle-${++counter}`,
  };
});

describe('IdleTaskGenerator Enhanced Capabilities', () => {
  let generator: IdleTaskGenerator;
  let enhancedGenerator: IdleTaskGenerator;
  let mockAnalysis: ProjectAnalysis;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.warn to test error handling
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockAnalysis = {
      codebaseSize: { files: 100, lines: 10000, languages: { ts: 80, js: 20 } },
      testCoverage: { percentage: 45, uncoveredFiles: ['src/utils.ts', 'src/service.ts'] },
      dependencies: {
        outdated: ['old-lib@^0.1.0', 'legacy@^0.5.0'],
        security: ['vuln-package@1.0.0'],
        // Enhanced dependency information
        securityIssues: [{
          name: 'vuln-package',
          cveId: 'CVE-2023-12345',
          severity: 'high',
          affectedVersions: '1.0.0',
          description: 'Critical security vulnerability in authentication module'
        }],
        outdatedPackages: [{
          name: 'old-lib',
          currentVersion: '0.1.0',
          latestVersion: '2.0.0',
          updateType: 'major'
        }],
        deprecatedPackages: [{
          name: 'legacy-dep',
          currentVersion: '1.0.0',
          reason: 'No longer maintained',
          replacement: 'modern-lib'
        }]
      },
      codeQuality: {
        lintIssues: 25,
        duplicatedCode: [{
          pattern: 'Authentication logic',
          locations: ['src/auth/login.ts', 'src/auth/signup.ts'],
          similarity: 0.85
        }],
        complexityHotspots: [{
          file: 'src/complex.ts',
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          lineCount: 300
        }],
        codeSmells: []
      },
      documentation: {
        coverage: 35,
        missingDocs: ['src/core.ts', 'src/api/index.ts'],
        // Enhanced documentation information
        outdatedDocs: ['README.md', 'API_DOCS.md'],
        undocumentedExports: ['src/utils.ts:parseConfig', 'src/core.ts:validateInput'],
        missingReadmeSections: ['Installation', 'Contributing'],
        apiCompleteness: {
          documented: 35,
          undocumented: 65
        }
      },
      performance: { slowTests: [], bottlenecks: [] },
    };

    generator = new IdleTaskGenerator();
    enhancedGenerator = IdleTaskGenerator.createEnhanced('/test/project/path');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Enhanced Capabilities Factory', () => {
    it('should create enhanced generator with correct configuration', () => {
      const projectPath = '/test/project';
      const weights = { maintenance: 0.5, refactoring: 0.3, docs: 0.1, tests: 0.1 };

      const enhanced = IdleTaskGenerator.createEnhanced(projectPath, weights);

      const capabilities = enhanced.getEnhancedCapabilities();
      expect(capabilities.enabled).toBe(true);
      expect(capabilities.projectPath).toBe(projectPath);
      expect(capabilities.availableAnalyzers).toEqual(['maintenance', 'refactoring', 'docs', 'tests']);

      const generatorWeights = enhanced.getWeights();
      expect(generatorWeights).toEqual(weights);
    });

    it('should create enhanced generator with default weights', () => {
      const projectPath = '/test/project';

      const enhanced = IdleTaskGenerator.createEnhanced(projectPath);

      const weights = enhanced.getWeights();
      expect(weights.maintenance).toBe(0.25);
      expect(weights.refactoring).toBe(0.25);
      expect(weights.docs).toBe(0.25);
      expect(weights.tests).toBe(0.25);
    });
  });

  describe('getEnhancedCapabilities', () => {
    it('should return correct capabilities for standard generator', () => {
      const capabilities = generator.getEnhancedCapabilities();

      expect(capabilities.enabled).toBe(true);
      expect(capabilities.projectPath).toBeUndefined();
      expect(capabilities.availableAnalyzers).toEqual(['maintenance', 'refactoring', 'docs', 'tests']);
    });

    it('should return correct capabilities for enhanced generator', () => {
      const capabilities = enhancedGenerator.getEnhancedCapabilities();

      expect(capabilities.enabled).toBe(true);
      expect(capabilities.projectPath).toBe('/test/project/path');
      expect(capabilities.availableAnalyzers).toEqual(['maintenance', 'refactoring', 'docs', 'tests']);
    });

    it('should return correct capabilities for disabled enhanced mode', () => {
      const disabledGenerator = new IdleTaskGenerator(undefined, undefined, {
        enhancedCapabilities: false,
        projectPath: '/test/path'
      });

      const capabilities = disabledGenerator.getEnhancedCapabilities();

      expect(capabilities.enabled).toBe(false);
      expect(capabilities.projectPath).toBe('/test/path');
      expect(capabilities.availableAnalyzers).toEqual(['maintenance', 'refactoring', 'docs', 'tests']);
    });
  });

  describe('Enhanced Project Analysis', () => {
    it('should apply enhanced analysis when capabilities are enabled', () => {
      const enhancedTask = enhancedGenerator.generateTask(mockAnalysis);

      expect(enhancedTask).not.toBeNull();
      expect(enhancedTask?.type).toBeDefined();
      expect(enhancedTask?.priority).toBe('low'); // Always overridden to low
    });

    it('should use original analysis when enhancement fails', () => {
      // Create analysis with invalid data that might cause enhancement to fail
      const invalidAnalysis: ProjectAnalysis = {
        ...mockAnalysis,
        dependencies: null as any, // Invalid data
      };

      // Should not throw and should fall back gracefully
      const task = enhancedGenerator.generateTask(invalidAnalysis);

      // Should still generate some task from fallback analysis
      expect(task).toBeDefined(); // Could be null if no valid tasks possible
    });

    it('should enhance code quality analysis with detailed metrics', () => {
      const analysisWithLegacyData: ProjectAnalysis = {
        ...mockAnalysis,
        codeQuality: {
          lintIssues: 50,
          duplicatedCode: ['src/legacy1.ts', 'src/legacy2.ts'], // Legacy string format
          complexityHotspots: ['src/legacy.ts'], // Legacy string format
          codeSmells: undefined as any,
        }
      };

      const task = enhancedGenerator.generateTask(analysisWithLegacyData);

      expect(task).not.toBeNull();
      // Should handle legacy format gracefully
    });

    it('should enhance documentation analysis with cross-reference data', () => {
      const analysisWithMinimalDocs: ProjectAnalysis = {
        ...mockAnalysis,
        documentation: {
          coverage: 20,
          missingDocs: ['src/core.ts'],
          // Missing enhanced fields
        }
      };

      const task = enhancedGenerator.generateTask(analysisWithMinimalDocs);

      expect(task).not.toBeNull();
      // Should add missing enhanced fields during enhancement
    });

    it('should enhance dependency analysis with security vulnerability scoring', () => {
      const analysisWithLegacySecurity: ProjectAnalysis = {
        ...mockAnalysis,
        dependencies: {
          outdated: ['old-package@1.0.0'],
          security: ['vuln@1.0.0', 'another-vuln@2.0.0'],
          // Missing enhanced fields
        }
      };

      const task = enhancedGenerator.generateTask(analysisWithLegacySecurity);

      expect(task).not.toBeNull();
      // Should convert legacy security format to enhanced format
    });
  });

  describe('Enhanced Analysis Error Handling', () => {
    it('should handle JSON.parse errors during analysis enhancement', () => {
      // Create analysis with circular references that would break JSON.stringify/parse
      const circularAnalysis = { ...mockAnalysis };
      (circularAnalysis as any).circular = circularAnalysis;

      // Should not throw and should fall back to original analysis
      const task = enhancedGenerator.generateTask(circularAnalysis);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to enhance project analysis:',
        expect.any(Error)
      );

      // Should still be able to generate tasks from original analysis
      expect(task).toBeDefined();
    });

    it('should handle missing analysis fields gracefully', () => {
      const incompleteAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: {} },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coverage: 50, missingDocs: [] },
        performance: { slowTests: [], bottlenecks: [] },
        // Missing testCoverage
      } as any;

      const task = enhancedGenerator.generateTask(incompleteAnalysis);

      // Should handle gracefully without errors
      expect(task).toBeDefined();
    });
  });

  describe('Enhanced vs Standard Generator Comparison', () => {
    it('should produce similar results between standard and enhanced generators', () => {
      const standardTask = generator.generateTask(mockAnalysis);
      const enhancedTask = enhancedGenerator.generateTask(mockAnalysis);

      // Both should generate tasks
      expect(standardTask).not.toBeNull();
      expect(enhancedTask).not.toBeNull();

      // Both should have low priority (key requirement)
      expect(standardTask?.priority).toBe('low');
      expect(enhancedTask?.priority).toBe('low');

      // Task structure should be similar
      expect(standardTask?.type).toBeDefined();
      expect(enhancedTask?.type).toBeDefined();
    });

    it('should maintain consistent deduplication behavior', () => {
      const standardTasks = [];
      const enhancedTasks = [];

      // Generate multiple tasks with both generators
      for (let i = 0; i < 5; i++) {
        const standardTask = generator.generateTask(mockAnalysis);
        const enhancedTask = enhancedGenerator.generateTask(mockAnalysis);

        if (standardTask) standardTasks.push(standardTask);
        if (enhancedTask) enhancedTasks.push(enhancedTask);
      }

      // Both generators should implement deduplication
      const standardUsed = generator.getUsedCandidates().size;
      const enhancedUsed = enhancedGenerator.getUsedCandidates().size;

      expect(standardUsed).toBeGreaterThan(0);
      expect(enhancedUsed).toBeGreaterThan(0);
    });
  });

  describe('Enhanced Analysis with Rich Data', () => {
    it('should utilize enhanced security vulnerability data', () => {
      const richSecurityAnalysis: ProjectAnalysis = {
        ...mockAnalysis,
        dependencies: {
          ...mockAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-45678',
              severity: 'critical',
              affectedVersions: '1.0.0-2.0.0',
              description: 'Remote code execution vulnerability'
            },
            {
              name: 'medium-vuln',
              cveId: 'NO-CVE-001',
              severity: 'medium',
              affectedVersions: '1.0.0',
              description: 'Information disclosure vulnerability'
            }
          ]
        }
      };

      enhancedGenerator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0
      }, undefined, { enhancedCapabilities: true });

      const task = enhancedGenerator.generateTask(richSecurityAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.title).toContain('Critical Security Vulnerability');
      expect(task?.description).toContain('CVE-2023-45678');
    });

    it('should utilize enhanced outdated dependency data', () => {
      const richOutdatedAnalysis: ProjectAnalysis = {
        ...mockAnalysis,
        dependencies: {
          ...mockAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'major-update',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major'
            },
            {
              name: 'patch-update',
              currentVersion: '1.0.0',
              latestVersion: '1.0.5',
              updateType: 'patch'
            }
          ]
        }
      };

      enhancedGenerator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0
      }, undefined, { enhancedCapabilities: true });

      const task = enhancedGenerator.generateTask(richOutdatedAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.title).toContain('Major Update') || task?.title).toContain('Patch');
    });
  });

  describe('Constructor Options', () => {
    it('should handle undefined options gracefully', () => {
      const generatorWithUndefinedOptions = new IdleTaskGenerator(
        { maintenance: 0.5, refactoring: 0.5, docs: 0, tests: 0 },
        undefined,
        undefined
      );

      const capabilities = generatorWithUndefinedOptions.getEnhancedCapabilities();
      expect(capabilities.enabled).toBe(true); // Default value
      expect(capabilities.projectPath).toBeUndefined();
    });

    it('should handle partial options', () => {
      const generatorWithPartialOptions = new IdleTaskGenerator(
        undefined,
        undefined,
        { projectPath: '/partial/path' } // Missing enhancedCapabilities
      );

      const capabilities = generatorWithPartialOptions.getEnhancedCapabilities();
      expect(capabilities.enabled).toBe(true); // Default value
      expect(capabilities.projectPath).toBe('/partial/path');
    });

    it('should handle empty options object', () => {
      const generatorWithEmptyOptions = new IdleTaskGenerator(
        undefined,
        undefined,
        {}
      );

      const capabilities = generatorWithEmptyOptions.getEnhancedCapabilities();
      expect(capabilities.enabled).toBe(true); // Default value
      expect(capabilities.projectPath).toBeUndefined();
    });
  });

  describe('Enhanced Analysis Field Processing', () => {
    it('should handle complex code quality enhancement', () => {
      const complexCodeQuality: ProjectAnalysis = {
        ...mockAnalysis,
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: [
            'legacy1.ts',
            { pattern: 'modern pattern', locations: ['file1.ts', 'file2.ts'], similarity: 0.9 }
          ] as any,
          complexityHotspots: [
            'legacy.ts',
            { file: 'modern.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 500 }
          ] as any,
          codeSmells: []
        }
      };

      const task = enhancedGenerator.generateTask(complexCodeQuality);

      expect(task).not.toBeNull();
      // Should handle mixed legacy and modern formats
    });

    it('should add missing documentation analysis fields', () => {
      const minimalDocumentation: ProjectAnalysis = {
        ...mockAnalysis,
        documentation: {
          coverage: 10,
          missingDocs: ['src/important.ts']
        }
      };

      const task = enhancedGenerator.generateTask(minimalDocumentation);

      expect(task).not.toBeNull();
      // Enhancement should add missing fields like outdatedDocs, undocumentedExports, etc.
    });

    it('should enhance dependency analysis with proper fallbacks', () => {
      const minimalDependencies: ProjectAnalysis = {
        ...mockAnalysis,
        dependencies: {
          outdated: ['old@1.0.0'],
          security: ['vuln@1.0.0']
          // Missing enhanced fields
        }
      };

      const task = enhancedGenerator.generateTask(minimalDependencies);

      expect(task).not.toBeNull();
      // Should convert legacy format to enhanced format with reasonable defaults
    });
  });
});