/**
 * Comprehensive Tests for DocsAnalyzer Task Candidate Generation
 *
 * Tests the enhanced DocsAnalyzer functionality for generating specific task candidates
 * from analysis data including undocumented exports, outdated docs, missing README sections,
 * and incomplete API documentation with proper scoring and prioritization.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocsAnalyzer } from './docs-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type {
  EnhancedDocumentationAnalysis,
  UndocumentedExport,
  OutdatedDocumentation,
  MissingReadmeSection,
  APICompleteness,
  TaskCandidate
} from '@apexcli/core';

describe('DocsAnalyzer Task Candidate Generation', () => {
  let docsAnalyzer: DocsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    docsAnalyzer = new DocsAnalyzer();

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

  // ============================================================================
  // Undocumented Exports Tests
  // ============================================================================

  describe('undocumented exports task generation', () => {
    it('should generate high-priority task for public API exports', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/api/public.ts',
          name: 'createUser',
          type: 'function',
          line: 15,
          isPublic: true
        },
        {
          file: 'src/api/public.ts',
          name: 'UserService',
          type: 'class',
          line: 25,
          isPublic: true
        },
        {
          file: 'src/types/public.ts',
          name: 'UserInterface',
          type: 'interface',
          line: 5,
          isPublic: true
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );

      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.priority).toBe('high');
      expect(publicExportsTask?.title).toBe('Document Public API Exports');
      expect(publicExportsTask?.description).toContain('3 public API export');
      expect(publicExportsTask?.description).toContain('createUser (function), UserService (class), UserInterface (interface)');
      expect(publicExportsTask?.estimatedEffort).toBe('low'); // <= 5 exports
      expect(publicExportsTask?.score).toBe(0.85);
      expect(publicExportsTask?.rationale).toContain('Public APIs are user-facing');
    });

    it('should generate normal priority task for critical type exports', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/core/types.ts',
          name: 'ConfigInterface',
          type: 'interface',
          line: 10,
          isPublic: false
        },
        {
          file: 'src/core/service.ts',
          name: 'CoreService',
          type: 'class',
          line: 20,
          isPublic: false
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const criticalTypesTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-critical-types'
      );

      expect(criticalTypesTask).toBeDefined();
      expect(criticalTypesTask?.priority).toBe('normal');
      expect(criticalTypesTask?.title).toBe('Document Core Type Exports');
      expect(criticalTypesTask?.description).toContain('2 core type export');
      expect(criticalTypesTask?.description).toContain('ConfigInterface (interface), CoreService (class)');
      expect(criticalTypesTask?.score).toBe(0.65);
      expect(criticalTypesTask?.rationale).toContain('Classes and interfaces define contracts');
    });

    it('should generate low priority task for many other exports', () => {
      const undocumentedExports: UndocumentedExport[] = Array(8).fill(null).map((_, i) => ({
        file: `src/utils/helper${i}.ts`,
        name: `helper${i}`,
        type: 'function' as const,
        line: 1,
        isPublic: false
      }));

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const otherExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-exports'
      );

      expect(otherExportsTask).toBeDefined();
      expect(otherExportsTask?.priority).toBe('low');
      expect(otherExportsTask?.title).toBe('Add JSDoc to Undocumented Exports');
      expect(otherExportsTask?.description).toContain('8 undocumented exports');
      expect(otherExportsTask?.score).toBe(0.45);
      expect(otherExportsTask?.estimatedEffort).toBe('medium'); // 8 exports > 5 but <= 15
    });

    it('should prioritize public exports over critical types', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/api.ts',
          name: 'publicAPI',
          type: 'function',
          line: 1,
          isPublic: true
        },
        {
          file: 'src/types.ts',
          name: 'InternalInterface',
          type: 'interface',
          line: 1,
          isPublic: false
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const publicTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );
      const criticalTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-critical-types'
      );

      expect(publicTask).toBeDefined();
      expect(criticalTask).toBeUndefined(); // Should not generate because public exports take priority
    });

    it('should estimate effort correctly based on export count', () => {
      const testCases = [
        { count: 3, expectedEffort: 'low' },
        { count: 8, expectedEffort: 'medium' },
        { count: 20, expectedEffort: 'high' }
      ];

      testCases.forEach(({ count, expectedEffort }) => {
        const undocumentedExports: UndocumentedExport[] = Array(count).fill(null).map((_, i) => ({
          file: `src/test${i}.ts`,
          name: `export${i}`,
          type: 'function' as const,
          line: 1,
          isPublic: true
        }));

        baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        const task = candidates.find(c => c.candidateId === 'docs-undocumented-public-exports');

        expect(task?.estimatedEffort).toBe(expectedEffort);
      });
    });

    it('should not generate task for fewer than 5 other exports', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/utils.ts',
          name: 'helper1',
          type: 'function',
          line: 1,
          isPublic: false
        },
        {
          file: 'src/utils.ts',
          name: 'helper2',
          type: 'function',
          line: 2,
          isPublic: false
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const otherExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-exports'
      );

      expect(otherExportsTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Missing README Sections Tests
  // ============================================================================

  describe('missing README sections task generation', () => {
    it('should generate high priority task for required sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation and setup instructions'
        },
        {
          section: 'usage',
          priority: 'required',
          description: 'Basic usage examples'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const requiredTask = candidates.find(c =>
        c.candidateId === 'docs-readme-required-sections'
      );

      expect(requiredTask).toBeDefined();
      expect(requiredTask?.priority).toBe('high');
      expect(requiredTask?.title).toBe('Add Required README Sections');
      expect(requiredTask?.description).toContain('2 required README sections');
      expect(requiredTask?.description).toContain('installation, usage');
      expect(requiredTask?.estimatedEffort).toBe('low'); // <= 2 sections
      expect(requiredTask?.score).toBe(0.8);
      expect(requiredTask?.rationale).toContain('Required README sections are essential');
    });

    it('should generate normal priority task for recommended sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'Guidelines for contributing'
        },
        {
          section: 'troubleshooting',
          priority: 'recommended',
          description: 'Common issues and solutions'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const recommendedTask = candidates.find(c =>
        c.candidateId === 'docs-readme-recommended-sections'
      );

      expect(recommendedTask).toBeDefined();
      expect(recommendedTask?.priority).toBe('normal');
      expect(recommendedTask?.title).toBe('Add Recommended README Sections');
      expect(recommendedTask?.description).toContain('2 recommended README sections');
      expect(recommendedTask?.score).toBe(0.55);
    });

    it('should generate low priority task for many optional sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'faq',
          priority: 'optional',
          description: 'Frequently asked questions'
        },
        {
          section: 'changelog',
          priority: 'optional',
          description: 'Version history'
        },
        {
          section: 'deployment',
          priority: 'optional',
          description: 'Deployment instructions'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const optionalTask = candidates.find(c =>
        c.candidateId === 'docs-readme-optional-sections'
      );

      expect(optionalTask).toBeDefined();
      expect(optionalTask?.priority).toBe('low');
      expect(optionalTask?.title).toBe('Enhance README with Additional Sections');
      expect(optionalTask?.description).toContain('3 optional README sections');
      expect(optionalTask?.score).toBe(0.35);
    });

    it('should prioritize required over recommended sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation instructions'
        },
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'Contributing guidelines'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const requiredTask = candidates.find(c =>
        c.candidateId === 'docs-readme-required-sections'
      );
      const recommendedTask = candidates.find(c =>
        c.candidateId === 'docs-readme-recommended-sections'
      );

      expect(requiredTask).toBeDefined();
      expect(recommendedTask).toBeUndefined(); // Should not generate because required takes priority
    });

    it('should estimate effort correctly for section count', () => {
      const testCases = [
        { count: 2, expectedEffort: 'low' },
        { count: 3, expectedEffort: 'medium' },
        { count: 5, expectedEffort: 'high' }
      ];

      testCases.forEach(({ count, expectedEffort }) => {
        const missingReadmeSections: MissingReadmeSection[] = Array(count).fill(null).map((_, i) => ({
          section: 'usage' as any,
          priority: 'required' as const,
          description: `Section ${i}`
        }));

        baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        const task = candidates.find(c => c.candidateId === 'docs-readme-required-sections');

        expect(task?.estimatedEffort).toBe(expectedEffort);
      });
    });

    it('should not generate task for few optional sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'faq',
          priority: 'optional',
          description: 'FAQ section'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const optionalTask = candidates.find(c =>
        c.candidateId === 'docs-readme-optional-sections'
      );

      expect(optionalTask).toBeUndefined(); // Should not generate for <= 2 optional sections
    });
  });

  // ============================================================================
  // API Completeness Tests
  // ============================================================================

  describe('API completeness task generation', () => {
    it('should generate high priority task for critical API coverage', () => {
      const apiCompleteness: APICompleteness = {
        percentage: 25,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 5,
          undocumentedItems: [
            { name: 'criticalAPI', file: 'src/api.ts', type: 'function' },
            { name: 'UserService', file: 'src/services.ts', type: 'class' }
          ],
          wellDocumentedExamples: [],
          commonIssues: ['Missing JSDoc comments']
        }
      };

      baseProjectAnalysis.documentation.apiCompleteness = apiCompleteness;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const criticalTask = candidates.find(c =>
        c.candidateId === 'docs-api-docs-critical'
      );

      expect(criticalTask).toBeDefined();
      expect(criticalTask?.priority).toBe('high');
      expect(criticalTask?.title).toBe('Document Critical API Surface');
      expect(criticalTask?.description).toContain('25.0%');
      expect(criticalTask?.description).toContain('2 API items');
      expect(criticalTask?.score).toBe(0.75);
      expect(criticalTask?.rationale).toContain('Low API coverage indicates major gaps');
    });

    it('should generate normal priority task for medium API coverage', () => {
      const apiCompleteness: APICompleteness = {
        percentage: 45,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 9,
          undocumentedItems: [
            { name: 'helper', file: 'src/utils.ts', type: 'function' }
          ],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      };

      baseProjectAnalysis.documentation.apiCompleteness = apiCompleteness;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const improvementTask = candidates.find(c =>
        c.candidateId === 'docs-api-docs-improvement'
      );

      expect(improvementTask).toBeDefined();
      expect(improvementTask?.priority).toBe('normal');
      expect(improvementTask?.title).toBe('Improve API Documentation Coverage');
      expect(improvementTask?.description).toContain('45.0%');
      expect(improvementTask?.score).toBe(0.55);
    });

    it('should generate low priority task for good coverage completion', () => {
      const apiCompleteness: APICompleteness = {
        percentage: 70,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 14,
          undocumentedItems: [
            { name: 'edge', file: 'src/edge.ts', type: 'function' }
          ],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      };

      baseProjectAnalysis.documentation.apiCompleteness = apiCompleteness;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const completionTask = candidates.find(c =>
        c.candidateId === 'docs-api-docs-completion'
      );

      expect(completionTask).toBeDefined();
      expect(completionTask?.priority).toBe('low');
      expect(completionTask?.title).toBe('Complete API Documentation');
      expect(completionTask?.score).toBe(0.4);
    });

    it('should generate quality improvement task for high coverage with issues', () => {
      const apiCompleteness: APICompleteness = {
        percentage: 85,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 17,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: ['Missing parameter descriptions', 'No return value docs']
        }
      };

      baseProjectAnalysis.documentation.apiCompleteness = apiCompleteness;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const qualityTask = candidates.find(c =>
        c.candidateId === 'docs-api-docs-quality'
      );

      expect(qualityTask).toBeDefined();
      expect(qualityTask?.priority).toBe('low');
      expect(qualityTask?.title).toBe('Address API Documentation Quality Issues');
      expect(qualityTask?.description).toContain('2 common API documentation issues');
      expect(qualityTask?.description).toContain('Missing parameter descriptions, No return value docs');
      expect(qualityTask?.score).toBe(0.3);
    });

    it('should estimate effort correctly for API items', () => {
      const testCases = [
        { count: 8, expectedEffort: 'low' },
        { count: 20, expectedEffort: 'medium' },
        { count: 30, expectedEffort: 'high' }
      ];

      testCases.forEach(({ count, expectedEffort }) => {
        const apiCompleteness: APICompleteness = {
          percentage: 25,
          details: {
            totalEndpoints: count,
            documentedEndpoints: 0,
            undocumentedItems: Array(count).fill(null).map((_, i) => ({
              name: `api${i}`,
              file: `src/api${i}.ts`,
              type: 'function' as const
            })),
            wellDocumentedExamples: [],
            commonIssues: []
          }
        };

        baseProjectAnalysis.documentation.apiCompleteness = apiCompleteness;

        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        const task = candidates.find(c => c.candidateId === 'docs-api-docs-critical');

        expect(task?.estimatedEffort).toBe(expectedEffort);
      });
    });
  });

  // ============================================================================
  // Outdated Documentation Tests
  // ============================================================================

  describe('outdated documentation task generation', () => {
    it('should generate high priority tasks for critical version mismatches', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'References v1.0.0 but current is v3.0.0',
          severity: 'high',
          line: 10,
          suggestion: 'Update to v3.0.0'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const versionTask = candidates.find(c =>
        c.candidateId === 'docs-fix-version-mismatches-critical'
      );

      expect(versionTask).toBeDefined();
      expect(versionTask?.priority).toBe('high');
      expect(versionTask?.title).toBe('Fix Critical Version Mismatches');
      expect(versionTask?.score).toBe(0.8);
    });

    it('should generate high priority tasks for critical stale comments', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'src/legacy.ts',
          type: 'stale-reference',
          description: 'TODO comment from 6 months ago',
          severity: 'high',
          line: 42
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const staleTask = candidates.find(c =>
        c.candidateId === 'docs-resolve-stale-comments-critical'
      );

      expect(staleTask).toBeDefined();
      expect(staleTask?.priority).toBe('high');
      expect(staleTask?.title).toBe('Resolve Critical Stale Comments');
      expect(staleTask?.description).toContain('90 days');
      expect(staleTask?.score).toBe(0.8);
    });

    it('should generate high priority tasks for critical broken links', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'docs/api.md',
          type: 'broken-link',
          description: 'Link to non-existent API endpoint',
          severity: 'high',
          line: 25
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const linksTask = candidates.find(c =>
        c.candidateId === 'docs-fix-broken-links-critical'
      );

      expect(linksTask).toBeDefined();
      expect(linksTask?.priority).toBe('high');
      expect(linksTask?.title).toBe('Fix Critical Broken Links');
      expect(linksTask?.score).toBe(0.8);
    });

    it('should generate high priority tasks for critical deprecated API docs', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'src/api.ts',
          type: 'deprecated-api',
          description: '@deprecated tag without migration guidance',
          severity: 'high',
          line: 15
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const deprecatedTask = candidates.find(c =>
        c.candidateId === 'docs-fix-deprecated-api-docs-critical'
      );

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask?.priority).toBe('high');
      expect(deprecatedTask?.title).toBe('Document Critical Deprecated APIs');
      expect(deprecatedTask?.score).toBe(0.8);
    });

    it('should handle multiple outdated documentation types with different severities', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Minor version mismatch',
          severity: 'medium'
        },
        {
          file: 'src/utils.ts',
          type: 'stale-reference',
          description: 'Old TODO comment',
          severity: 'low'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate medium priority version task
      const versionTask = candidates.find(c =>
        c.candidateId === 'docs-fix-version-mismatches-medium'
      );

      // Should generate low priority stale comment task
      const staleTask = candidates.find(c =>
        c.candidateId === 'docs-resolve-stale-comments'
      );

      expect(versionTask).toBeDefined();
      expect(versionTask?.priority).toBe('normal');

      expect(staleTask).toBeDefined();
      expect(staleTask?.priority).toBe('low');
    });
  });

  // ============================================================================
  // Integration and Priority Tests
  // ============================================================================

  describe('task prioritization and scoring', () => {
    it('should score tasks appropriately by priority and impact', () => {
      baseProjectAnalysis.documentation = {
        coverage: 15, // Critical (score: 0.9)
        missingDocs: [],
        undocumentedExports: [
          {
            file: 'src/api.ts',
            name: 'publicAPI',
            type: 'function',
            line: 1,
            isPublic: true
          }
        ], // Public exports (score: 0.85)
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Critical version mismatch',
            severity: 'high'
          }
        ], // Critical version mismatch (score: 0.8)
        missingReadmeSections: [
          {
            section: 'installation',
            priority: 'required',
            description: 'Installation section'
          }
        ], // Required README (score: 0.8)
        apiCompleteness: {
          percentage: 25,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 2,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        } // Critical API coverage (score: 0.75)
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Sort by score to verify prioritization
      const sortedCandidates = candidates.sort((a, b) => b.score - a.score);

      expect(sortedCandidates[0].score).toBe(0.9); // Critical coverage
      expect(sortedCandidates[1].score).toBe(0.85); // Public exports
      expect(sortedCandidates.find(c => c.score === 0.8)).toBeDefined(); // Version/README
      expect(sortedCandidates.find(c => c.score === 0.75)).toBeDefined(); // API coverage
    });

    it('should generate unique candidate IDs for deduplication', () => {
      baseProjectAnalysis.documentation.undocumentedExports = [
        {
          file: 'src/api.ts',
          name: 'func1',
          type: 'function',
          line: 1,
          isPublic: true
        }
      ];
      baseProjectAnalysis.documentation.missingReadmeSections = [
        {
          section: 'usage',
          priority: 'required',
          description: 'Usage section'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const candidateIds = candidates.map(c => c.candidateId);
      const uniqueIds = new Set(candidateIds);

      expect(candidateIds.length).toBe(uniqueIds.size);

      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^docs-/);
        expect(candidate.candidateId).toBeTruthy();
      });
    });

    it('should set appropriate workflow for all documentation tasks', () => {
      baseProjectAnalysis.documentation.coverage = 10;
      baseProjectAnalysis.documentation.undocumentedExports = [
        {
          file: 'src/test.ts',
          name: 'test',
          type: 'function',
          line: 1,
          isPublic: true
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      candidates.forEach(candidate => {
        expect(candidate.suggestedWorkflow).toBe('documentation');
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle empty undocumented exports gracefully', () => {
      baseProjectAnalysis.documentation.undocumentedExports = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const exportTasks = candidates.filter(c =>
        c.candidateId.includes('undocumented')
      );

      expect(exportTasks).toHaveLength(0);
    });

    it('should handle empty missing README sections gracefully', () => {
      baseProjectAnalysis.documentation.missingReadmeSections = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const readmeTasks = candidates.filter(c =>
        c.candidateId.includes('readme')
      );

      // May include existing README tasks based on coverage logic, but not new ones
      expect(readmeTasks.length).toBeLessThanOrEqual(1);
    });

    it('should handle perfect API completeness', () => {
      baseProjectAnalysis.documentation.apiCompleteness = {
        percentage: 100,
        details: {
          totalEndpoints: 10,
          documentedEndpoints: 10,
          undocumentedItems: [],
          wellDocumentedExamples: ['src/api.ts:example'],
          commonIssues: []
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const apiTasks = candidates.filter(c =>
        c.candidateId.includes('api-docs')
      );

      expect(apiTasks).toHaveLength(0);
    });

    it('should handle empty outdated documentation', () => {
      baseProjectAnalysis.documentation.outdatedDocs = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const outdatedTasks = candidates.filter(c =>
        c.candidateId.includes('version-mismatch') ||
        c.candidateId.includes('stale-comments') ||
        c.candidateId.includes('broken-links') ||
        c.candidateId.includes('deprecated-api')
      );

      expect(outdatedTasks).toHaveLength(0);
    });

    it('should handle mixed priority missing README sections correctly', () => {
      baseProjectAnalysis.documentation.missingReadmeSections = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Required section'
        },
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'Recommended section'
        },
        {
          section: 'faq',
          priority: 'optional',
          description: 'Optional section'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should only generate required task, not recommended or optional
      const requiredTask = candidates.find(c =>
        c.candidateId === 'docs-readme-required-sections'
      );
      const recommendedTask = candidates.find(c =>
        c.candidateId === 'docs-readme-recommended-sections'
      );
      const optionalTask = candidates.find(c =>
        c.candidateId === 'docs-readme-optional-sections'
      );

      expect(requiredTask).toBeDefined();
      expect(recommendedTask).toBeUndefined();
      expect(optionalTask).toBeUndefined();
    });
  });
});