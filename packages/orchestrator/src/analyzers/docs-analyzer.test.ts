/**
 * DocsAnalyzer Tests
 *
 * Tests for the DocsAnalyzer class, including integration with enhanced
 * documentation analysis features and validation of task candidate generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocsAnalyzer } from './docs-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type {
  EnhancedDocumentationAnalysis,
  UndocumentedExport,
  OutdatedDocumentation,
  MissingReadmeSection,
  APICompleteness
} from '@apexcli/core';

describe('DocsAnalyzer', () => {
  let docsAnalyzer: DocsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    docsAnalyzer = new DocsAnalyzer();

    // Base project analysis structure
    baseProjectAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { 'ts': 40, 'js': 10 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 14,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      }
    };
  });

  describe('type property', () => {
    it('should have docs type', () => {
      expect(docsAnalyzer.type).toBe('docs');
    });
  });

  // ============================================================================
  // Critical Documentation Coverage Tests
  // ============================================================================

  describe('critical documentation coverage', () => {
    it('should generate high priority task for coverage < 20%', () => {
      baseProjectAnalysis.documentation.coverage = 15;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const criticalTask = candidates.find(c => c.title.includes('Critical'));
      expect(criticalTask).toBeDefined();
      expect(criticalTask?.priority).toBe('high');
      expect(criticalTask?.estimatedEffort).toBe('high');
      expect(criticalTask?.score).toBe(0.9);
      expect(criticalTask?.candidateId).toBe('docs-critical-docs');
    });

    it('should not generate critical task for coverage >= 20%', () => {
      baseProjectAnalysis.documentation.coverage = 25;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const criticalTask = candidates.find(c => c.title.includes('Critical'));
      expect(criticalTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Core Module Documentation Tests
  // ============================================================================

  describe('core module documentation', () => {
    it('should prioritize core modules for documentation', () => {
      baseProjectAnalysis.documentation.missingDocs = [
        'src/index.ts',
        'src/core/main.ts',
        'src/api/endpoints.ts',
        'src/utils/helper.ts',
        'src/service/auth.ts'
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coreTask = candidates.find(c => c.title.includes('Core Modules'));
      expect(coreTask).toBeDefined();
      expect(coreTask?.priority).toBe('normal');
      expect(coreTask?.estimatedEffort).toBe('medium');
      expect(coreTask?.score).toBe(0.7);

      // Should mention core files in description
      expect(coreTask?.description).toContain('index.ts');
      expect(coreTask?.description).toContain('main.ts');
      expect(coreTask?.description).toContain('endpoints.ts');
    });

    it('should handle case with only one core file', () => {
      baseProjectAnalysis.documentation.missingDocs = [
        'src/index.ts',
        'src/random/other.ts'
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coreTask = candidates.find(c => c.title.includes('Core Modules'));
      expect(coreTask).toBeDefined();
      expect(coreTask?.description).toContain('1 core module');
      expect(coreTask?.description).toContain('index.ts');
    });

    it('should limit core files in description to 3', () => {
      baseProjectAnalysis.documentation.missingDocs = [
        'src/index.ts',
        'src/core/module1.ts',
        'src/core/module2.ts',
        'src/core/module3.ts',
        'src/core/module4.ts'
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coreTask = candidates.find(c => c.title.includes('Core Modules'));
      expect(coreTask).toBeDefined();
      expect(coreTask?.description).toMatch(/.*\.\.\.$/); // Should end with ...
    });

    it('should not generate core task if no core files missing docs', () => {
      baseProjectAnalysis.documentation.missingDocs = [
        'src/random/file1.ts',
        'src/utilities/file2.ts'
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coreTask = candidates.find(c => c.title.includes('Core Modules'));
      expect(coreTask).toBeUndefined();
    });
  });

  // ============================================================================
  // General Missing Documentation Tests
  // ============================================================================

  describe('general missing documentation', () => {
    it('should generate task for many missing docs (> 5)', () => {
      const missingFiles = Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`);
      baseProjectAnalysis.documentation.missingDocs = missingFiles;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const generalTask = candidates.find(c => c.title.includes('Missing Documentation'));
      expect(generalTask).toBeDefined();
      expect(generalTask?.priority).toBe('low');
      expect(generalTask?.estimatedEffort).toBe('medium');
      expect(generalTask?.score).toBe(0.5);
      expect(generalTask?.description).toContain('8 undocumented files');
    });

    it('should set high effort for many missing docs (> 10)', () => {
      const missingFiles = Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`);
      baseProjectAnalysis.documentation.missingDocs = missingFiles;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const generalTask = candidates.find(c => c.title.includes('Missing Documentation'));
      expect(generalTask).toBeDefined();
      expect(generalTask?.estimatedEffort).toBe('high');
    });

    it('should not generate task for few missing docs (<= 5)', () => {
      baseProjectAnalysis.documentation.missingDocs = ['file1.ts', 'file2.ts'];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const generalTask = candidates.find(c => c.title.includes('Missing Documentation'));
      expect(generalTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Documentation Coverage Improvement Tests
  // ============================================================================

  describe('documentation coverage improvement', () => {
    it('should generate task for moderate coverage (20-50%)', () => {
      baseProjectAnalysis.documentation.coverage = 35.7;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coverageTask = candidates.find(c => c.title.includes('Coverage'));
      expect(coverageTask).toBeDefined();
      expect(coverageTask?.priority).toBe('low');
      expect(coverageTask?.estimatedEffort).toBe('medium');
      expect(coverageTask?.score).toBe(0.4);
      expect(coverageTask?.description).toContain('35.7%');
      expect(coverageTask?.description).toContain('50%');
    });

    it('should not generate coverage task for high coverage (>= 50%)', () => {
      baseProjectAnalysis.documentation.coverage = 65;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coverageTask = candidates.find(c => c.title.includes('Coverage'));
      expect(coverageTask).toBeUndefined();
    });

    it('should not generate coverage task for critical coverage (< 20%)', () => {
      // Critical coverage is handled by a different, higher-priority task
      baseProjectAnalysis.documentation.coverage = 15;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coverageTask = candidates.find(c => c.title.includes('Improve Documentation Coverage'));
      expect(coverageTask).toBeUndefined();
    });
  });

  // ============================================================================
  // README Improvement Tests
  // ============================================================================

  describe('README improvements', () => {
    it('should generate README task when coverage < 30% and README missing', () => {
      baseProjectAnalysis.documentation.coverage = 25;
      baseProjectAnalysis.documentation.missingDocs = ['readme.md', 'src/file1.ts'];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const readmeTask = candidates.find(c => c.title.includes('README'));
      expect(readmeTask).toBeDefined();
      expect(readmeTask?.priority).toBe('normal');
      expect(readmeTask?.estimatedEffort).toBe('low');
      expect(readmeTask?.score).toBe(0.6);
      expect(readmeTask?.description).toContain('installation');
      expect(readmeTask?.description).toContain('usage');
      expect(readmeTask?.description).toContain('contribution');
    });

    it('should not generate README task when coverage >= 30%', () => {
      baseProjectAnalysis.documentation.coverage = 35;
      baseProjectAnalysis.documentation.missingDocs = ['readme.md'];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const readmeTask = candidates.find(c => c.title.includes('README'));
      expect(readmeTask).toBeUndefined();
    });

    it('should not generate README task when README not missing', () => {
      baseProjectAnalysis.documentation.coverage = 25;
      baseProjectAnalysis.documentation.missingDocs = ['src/file1.ts'];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const readmeTask = candidates.find(c => c.title.includes('README'));
      expect(readmeTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Enhanced Documentation Analysis Integration
  // ============================================================================

  describe('enhanced documentation analysis integration', () => {
    it('should work with enhanced undocumentedExports data', () => {
      baseProjectAnalysis.documentation.coverage = 15; // Trigger critical task
      baseProjectAnalysis.documentation.undocumentedExports = [
        {
          file: 'src/api.ts',
          name: 'criticalFunction',
          type: 'function',
          line: 42,
          isPublic: true
        },
        {
          file: 'src/core.ts',
          name: 'CoreClass',
          type: 'class',
          line: 10,
          isPublic: true
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should still generate appropriate tasks
      expect(candidates.length).toBeGreaterThan(0);

      // Critical task should be present
      const criticalTask = candidates.find(c => c.title.includes('Critical'));
      expect(criticalTask).toBeDefined();
    });

    it('should work with enhanced outdatedDocs data', () => {
      baseProjectAnalysis.documentation.coverage = 35; // Moderate coverage
      baseProjectAnalysis.documentation.outdatedDocs = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'References v1.0 but current is v2.0',
          severity: 'high'
        },
        {
          file: 'docs/api.md',
          type: 'deprecated-api',
          description: 'Contains deprecated API references',
          severity: 'medium'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate improvement task based on coverage
      const improvementTask = candidates.find(c => c.title.includes('Coverage'));
      expect(improvementTask).toBeDefined();
    });

    it('should work with enhanced missingReadmeSections data', () => {
      baseProjectAnalysis.documentation.coverage = 25; // Low enough for README task
      baseProjectAnalysis.documentation.missingDocs = ['README.md'];
      baseProjectAnalysis.documentation.missingReadmeSections = [
        {
          section: 'installation',
          priority: 'required',
          description: 'How to install the project'
        },
        {
          section: 'usage',
          priority: 'required',
          description: 'How to use the project'
        },
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'How to contribute'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const readmeTask = candidates.find(c => c.title.includes('README'));
      expect(readmeTask).toBeDefined();
    });

    it('should work with enhanced apiCompleteness data', () => {
      baseProjectAnalysis.documentation.coverage = 40; // Moderate
      baseProjectAnalysis.documentation.apiCompleteness = {
        percentage: 30, // Low API documentation
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 6,
          undocumentedItems: [
            { name: 'getUserData', file: 'src/api.ts', type: 'function', line: 42 },
            { name: 'UserService', file: 'src/services.ts', type: 'class', line: 10 }
          ],
          wellDocumentedExamples: ['src/auth.ts:login'],
          commonIssues: ['Missing JSDoc comments', 'No parameter descriptions']
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const improvementTask = candidates.find(c => c.title.includes('Coverage'));
      expect(improvementTask).toBeDefined();
    });
  });

  // ============================================================================
  // Task Prioritization Tests
  // ============================================================================

  describe('task prioritization', () => {
    it('should prioritize critical coverage over other tasks', () => {
      baseProjectAnalysis.documentation = {
        coverage: 15, // Critical
        missingDocs: Array.from({ length: 10 }, (_, i) => `file${i}.ts`), // Many missing
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 50,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 5,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const prioritized = docsAnalyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.title).toContain('Critical');
    });

    it('should return highest scoring candidate', () => {
      baseProjectAnalysis.documentation.coverage = 35; // Triggers improvement task (score 0.4)
      baseProjectAnalysis.documentation.missingDocs = [
        'src/core.ts', 'src/api.ts', 'src/main.ts' // Triggers core modules task (score 0.7)
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const prioritized = docsAnalyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.title).toContain('Core Modules'); // Higher score
    });

    it('should return null when no candidates', () => {
      baseProjectAnalysis.documentation.coverage = 80; // High coverage
      baseProjectAnalysis.documentation.missingDocs = []; // No missing docs

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = docsAnalyzer.prioritize(candidates);

      expect(candidates).toHaveLength(0);
      expect(prioritized).toBeNull();
    });
  });

  // ============================================================================
  // Complex Scenarios Tests
  // ============================================================================

  describe('complex scenarios', () => {
    it('should handle project with multiple documentation issues', () => {
      baseProjectAnalysis.documentation = {
        coverage: 22, // Just above critical threshold
        missingDocs: [
          'src/index.ts', // Core file
          'src/api/core.ts', // Core file
          'src/util1.ts', 'src/util2.ts', 'src/util3.ts', 'src/util4.ts', 'src/util5.ts', 'src/util6.ts' // Many files
        ],
        undocumentedExports: [
          { file: 'src/api.ts', name: 'apiMethod', type: 'function', line: 10, isPublic: true }
        ],
        outdatedDocs: [
          { file: 'README.md', type: 'version-mismatch', description: 'Old version', severity: 'low' }
        ],
        missingReadmeSections: [
          { section: 'installation', priority: 'required', description: 'How to install' }
        ],
        apiCompleteness: {
          percentage: 45,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 9,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(2);

      // Should generate core modules task
      const coreTask = candidates.find(c => c.title.includes('Core Modules'));
      expect(coreTask).toBeDefined();

      // Should generate missing docs task
      const missingTask = candidates.find(c => c.title.includes('Missing Documentation'));
      expect(missingTask).toBeDefined();

      // Should NOT generate critical task (coverage is 22% >= 20%)
      const criticalTask = candidates.find(c => c.title.includes('Critical'));
      expect(criticalTask).toBeUndefined();

      // All candidates should have valid structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^docs-/);
        expect(candidate.suggestedWorkflow).toBe('documentation');
        expect(['low', 'normal', 'high']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle well-documented project', () => {
      baseProjectAnalysis.documentation = {
        coverage: 85, // High coverage
        missingDocs: ['src/test-helper.ts'], // Only test files
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 90,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 18,
            undocumentedItems: [],
            wellDocumentedExamples: ['api.ts:getUser', 'auth.ts:login'],
            commonIssues: []
          }
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate no or very few candidates for well-documented project
      expect(candidates.length).toBe(0);
    });
  });

  // ============================================================================
  // Workflow and Structure Tests
  // ============================================================================

  describe('workflow and structure validation', () => {
    it('should always suggest documentation workflow', () => {
      baseProjectAnalysis.documentation.coverage = 10; // Will generate tasks

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      candidates.forEach(candidate => {
        expect(candidate.suggestedWorkflow).toBe('documentation');
      });
    });

    it('should generate valid candidate IDs for deduplication', () => {
      baseProjectAnalysis.documentation.coverage = 15;
      baseProjectAnalysis.documentation.missingDocs = ['src/core.ts', 'src/api.ts'];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      const candidateIds = candidates.map(c => c.candidateId);
      const uniqueIds = new Set(candidateIds);

      // All IDs should be unique
      expect(candidateIds.length).toBe(uniqueIds.size);

      // All IDs should start with 'docs-'
      candidateIds.forEach(id => {
        expect(id).toMatch(/^docs-/);
      });
    });

    it('should provide meaningful rationales', () => {
      baseProjectAnalysis.documentation.coverage = 15;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      candidates.forEach(candidate => {
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.rationale.length).toBeGreaterThan(20);
      });
    });
  });
});