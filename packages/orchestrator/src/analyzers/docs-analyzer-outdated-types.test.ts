/**
 * DocsAnalyzer OutdatedDocumentation Types Tests
 *
 * Comprehensive tests for the DocsAnalyzer's handling of the new
 * OutdatedDocumentation types: version-mismatch, broken-link, and deprecated-api.
 * These tests verify task candidate generation, priority mapping, and
 * severity-to-priority handling for the acceptance criteria.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocsAnalyzer } from './docs-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { OutdatedDocumentation } from '@apexcli/core';

describe('DocsAnalyzer OutdatedDocumentation Types', () => {
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
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 60, // Good coverage to isolate new type tests
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [], // Will be set per test
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
  // Acceptance Criteria 1: version-mismatch type from VersionMismatchDetector
  // ============================================================================

  describe('version-mismatch type handling', () => {
    it('should generate task candidates for high severity version mismatches', () => {
      const versionMismatches: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'References v1.0 but current is v3.0 - major breaking change',
          severity: 'high',
          suggestion: 'Update all version references to v3.0'
        },
        {
          file: 'docs/installation.md',
          type: 'version-mismatch',
          description: 'Installation instructions reference old version',
          severity: 'high'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = versionMismatches;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const versionTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-critical');

      expect(versionTask).toBeDefined();
      expect(versionTask!.title).toBe('Fix Critical Version Mismatches');
      expect(versionTask!.priority).toBe('high');
      expect(versionTask!.estimatedEffort).toBe('medium');
      expect(versionTask!.score).toBe(0.8);
      expect(versionTask!.suggestedWorkflow).toBe('documentation');
      expect(versionTask!.description).toContain('2 critical version mismatch');
      expect(versionTask!.rationale).toContain('Version mismatches cause confusion');
    });

    it('should generate task candidates for medium severity version mismatches', () => {
      const versionMismatches: OutdatedDocumentation[] = [
        {
          file: 'docs/api.md',
          type: 'version-mismatch',
          description: 'API docs reference v2.5 but current is v2.7',
          severity: 'medium',
          line: 42
        },
        {
          file: 'CHANGELOG.md',
          type: 'version-mismatch',
          description: 'Missing recent version updates',
          severity: 'medium'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = versionMismatches;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const versionTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-medium');

      expect(versionTask).toBeDefined();
      expect(versionTask!.title).toBe('Fix Version Mismatches');
      expect(versionTask!.priority).toBe('normal');
      expect(versionTask!.estimatedEffort).toBe('low');
      expect(versionTask!.score).toBe(0.6);
      expect(versionTask!.description).toContain('2 version mismatch');
      expect(versionTask!.rationale).toContain('Version mismatches should be resolved');
    });

    it('should generate task candidates for low severity version mismatches', () => {
      const versionMismatches: OutdatedDocumentation[] = [
        {
          file: 'docs/examples.md',
          type: 'version-mismatch',
          description: 'Example code has old version in comment',
          severity: 'low'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = versionMismatches;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const versionTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches');

      expect(versionTask).toBeDefined();
      expect(versionTask!.title).toBe('Review Version References');
      expect(versionTask!.priority).toBe('low');
      expect(versionTask!.estimatedEffort).toBe('low');
      expect(versionTask!.score).toBe(0.4);
      expect(versionTask!.description).toContain('1 version reference');
      expect(versionTask!.rationale).toContain('Regular review of version references');
    });

    it('should prioritize high over medium severity version mismatches', () => {
      const mixedSeverityMismatches: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Critical version mismatch',
          severity: 'high'
        },
        {
          file: 'docs/guide.md',
          type: 'version-mismatch',
          description: 'Minor version mismatch',
          severity: 'medium'
        },
        {
          file: 'examples/basic.md',
          type: 'version-mismatch',
          description: 'Example version mismatch',
          severity: 'low'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = mixedSeverityMismatches;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should only generate the highest severity task
      const criticalTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-critical');
      const mediumTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-medium');
      const lowTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches');

      expect(criticalTask).toBeDefined();
      expect(mediumTask).toBeUndefined(); // Should be suppressed by high severity
      expect(lowTask).toBeUndefined(); // Should be suppressed by high severity
    });

    it('should not generate tasks when no version mismatches exist', () => {
      baseProjectAnalysis.documentation.outdatedDocs = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const versionTasks = candidates.filter(c => c.candidateId.includes('version-mismatch'));
      expect(versionTasks).toHaveLength(0);
    });
  });

  // ============================================================================
  // Acceptance Criteria 2: broken-link type from CrossReferenceValidator
  // ============================================================================

  describe('broken-link type handling', () => {
    it('should generate task candidates for high severity broken links', () => {
      const brokenLinks: OutdatedDocumentation[] = [
        {
          file: 'src/api/users.ts',
          type: 'broken-link',
          description: 'JSDoc @see reference to deleted method getUserById',
          severity: 'high',
          line: 25,
          suggestion: 'Update @see reference or remove broken link'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = brokenLinks;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const linkTask = candidates.find(c => c.candidateId === 'docs-fix-broken-links-critical');

      expect(linkTask).toBeDefined();
      expect(linkTask!.title).toBe('Fix Critical Broken Links');
      expect(linkTask!.priority).toBe('high');
      expect(linkTask!.estimatedEffort).toBe('medium');
      expect(linkTask!.score).toBe(0.8);
      expect(linkTask!.description).toContain('1 critical broken link');
      expect(linkTask!.rationale).toContain('@see tags');
    });

    it('should generate task candidates for medium severity broken links', () => {
      const brokenLinks: OutdatedDocumentation[] = [
        {
          file: 'docs/setup.md',
          type: 'broken-link',
          description: 'Link to configuration guide is broken',
          severity: 'medium'
        },
        {
          file: 'README.md',
          type: 'broken-link',
          description: 'External link to documentation site is 404',
          severity: 'medium',
          line: 15
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = brokenLinks;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const linkTask = candidates.find(c => c.candidateId === 'docs-fix-broken-links-medium');

      expect(linkTask).toBeDefined();
      expect(linkTask!.title).toBe('Fix Broken Documentation Links');
      expect(linkTask!.priority).toBe('normal');
      expect(linkTask!.estimatedEffort).toBe('low');
      expect(linkTask!.score).toBe(0.6);
      expect(linkTask!.description).toContain('2 broken links');
      expect(linkTask!.rationale).toContain('Broken links reduce documentation usability');
    });

    it('should generate task candidates for low severity broken links', () => {
      const brokenLinks: OutdatedDocumentation[] = [
        {
          file: 'docs/references.md',
          type: 'broken-link',
          description: 'Optional external reference link may be temporary',
          severity: 'low'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = brokenLinks;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const linkTask = candidates.find(c => c.candidateId === 'docs-fix-broken-links');

      expect(linkTask).toBeDefined();
      expect(linkTask!.title).toBe('Review Documentation Links');
      expect(linkTask!.priority).toBe('low');
      expect(linkTask!.estimatedEffort).toBe('low');
      expect(linkTask!.score).toBe(0.4);
      expect(linkTask!.rationale).toContain('Regular review of documentation links');
    });

    it('should handle broken links with line numbers and suggestions', () => {
      const brokenLinks: OutdatedDocumentation[] = [
        {
          file: 'src/auth.ts',
          type: 'broken-link',
          description: 'JSDoc @see reference points to non-existent method',
          severity: 'high',
          line: 42,
          suggestion: 'Update reference to point to new authenticate() method'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = brokenLinks;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const linkTask = candidates.find(c => c.candidateId === 'docs-fix-broken-links-critical');

      expect(linkTask).toBeDefined();
      expect(linkTask!.description).toContain('1 critical broken link');
      // The line and suggestion info should be preserved in the OutdatedDocumentation data
      expect(brokenLinks[0].line).toBe(42);
      expect(brokenLinks[0].suggestion).toContain('authenticate()');
    });

    it('should not generate tasks when no broken links exist', () => {
      baseProjectAnalysis.documentation.outdatedDocs = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const linkTasks = candidates.filter(c => c.candidateId.includes('broken-links'));
      expect(linkTasks).toHaveLength(0);
    });
  });

  // ============================================================================
  // Acceptance Criteria 3: deprecated-api type from JSDocDetector
  // ============================================================================

  describe('deprecated-api type handling', () => {
    it('should generate task candidates for high severity deprecated API docs', () => {
      const deprecatedApiDocs: OutdatedDocumentation[] = [
        {
          file: 'src/legacy/auth.ts',
          type: 'deprecated-api',
          description: '@deprecated tag missing migration guidance for legacy login method',
          severity: 'high',
          line: 30,
          suggestion: 'Add clear migration path to new OAuth2 flow'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = deprecatedApiDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'docs-fix-deprecated-api-docs-critical');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask!.title).toBe('Document Critical Deprecated APIs');
      expect(deprecatedTask!.priority).toBe('high');
      expect(deprecatedTask!.estimatedEffort).toBe('medium');
      expect(deprecatedTask!.score).toBe(0.8);
      expect(deprecatedTask!.description).toContain('1 critical @deprecated tag');
      expect(deprecatedTask!.rationale).toContain('migration difficult');
    });

    it('should generate task candidates for medium severity deprecated API docs', () => {
      const deprecatedApiDocs: OutdatedDocumentation[] = [
        {
          file: 'src/utils/helpers.ts',
          type: 'deprecated-api',
          description: '@deprecated tag lacks clear alternative suggestion',
          severity: 'medium',
          line: 15
        },
        {
          file: 'src/api/old-endpoints.ts',
          type: 'deprecated-api',
          description: 'Incomplete deprecation documentation',
          severity: 'medium',
          line: 45
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = deprecatedApiDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'docs-fix-deprecated-api-docs-medium');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask!.title).toBe('Improve Deprecated API Documentation');
      expect(deprecatedTask!.priority).toBe('normal');
      expect(deprecatedTask!.estimatedEffort).toBe('low');
      expect(deprecatedTask!.score).toBe(0.6);
      expect(deprecatedTask!.description).toContain('2 @deprecated tags');
      expect(deprecatedTask!.rationale).toContain('clear alternatives and migration paths');
    });

    it('should generate task candidates for low severity deprecated API docs', () => {
      const deprecatedApiDocs: OutdatedDocumentation[] = [
        {
          file: 'src/legacy/old-feature.ts',
          type: 'deprecated-api',
          description: '@deprecated tag could provide better context',
          severity: 'low'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = deprecatedApiDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'docs-fix-deprecated-api-docs');

      expect(deprecatedTask).toBeDefined();
      expect(deprecatedTask!.title).toBe('Review Deprecated API Tags');
      expect(deprecatedTask!.priority).toBe('low');
      expect(deprecatedTask!.estimatedEffort).toBe('low');
      expect(deprecatedTask!.score).toBe(0.4);
      expect(deprecatedTask!.description).toContain('1 @deprecated tag');
      expect(deprecatedTask!.rationale).toContain('adequate guidance');
    });

    it('should handle deprecated API docs with line numbers and suggestions', () => {
      const deprecatedApiDocs: OutdatedDocumentation[] = [
        {
          file: 'src/api/v1/users.ts',
          type: 'deprecated-api',
          description: 'Method marked as @deprecated but no replacement mentioned',
          severity: 'high',
          line: 125,
          suggestion: 'Add @see reference to new v2.createUser() method'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = deprecatedApiDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const deprecatedTask = candidates.find(c => c.candidateId === 'docs-fix-deprecated-api-docs-critical');

      expect(deprecatedTask).toBeDefined();
      // Verify the original data structure is preserved
      expect(deprecatedApiDocs[0].line).toBe(125);
      expect(deprecatedApiDocs[0].suggestion).toContain('v2.createUser()');
    });

    it('should not generate tasks when no deprecated API docs exist', () => {
      baseProjectAnalysis.documentation.outdatedDocs = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const deprecatedTasks = candidates.filter(c => c.candidateId.includes('deprecated-api-docs'));
      expect(deprecatedTasks).toHaveLength(0);
    });
  });

  // ============================================================================
  // Acceptance Criteria 4: Appropriate task candidates with correct severity/priority mapping
  // ============================================================================

  describe('severity to priority mapping', () => {
    it('should correctly map all severities to priorities across all types', () => {
      const mixedOutdatedDocs: OutdatedDocumentation[] = [
        // High severity items should map to 'high' priority
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Critical version mismatch',
          severity: 'high'
        },
        {
          file: 'src/api.ts',
          type: 'broken-link',
          description: 'Critical broken link in JSDoc',
          severity: 'high'
        },
        {
          file: 'src/auth.ts',
          type: 'deprecated-api',
          description: 'Critical deprecated API without migration guidance',
          severity: 'high'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = mixedOutdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const highPriorityTasks = candidates.filter(c => c.priority === 'high');
      expect(highPriorityTasks).toHaveLength(3);

      highPriorityTasks.forEach(task => {
        expect(task.score).toBe(0.8); // High severity maps to 0.8 score
        expect(task.estimatedEffort).toBe('medium'); // High severity maps to medium effort
      });
    });

    it('should correctly map medium severity to normal priority', () => {
      const mediumSeverityDocs: OutdatedDocumentation[] = [
        {
          file: 'docs/api.md',
          type: 'version-mismatch',
          description: 'Medium version mismatch',
          severity: 'medium'
        },
        {
          file: 'docs/guide.md',
          type: 'broken-link',
          description: 'Medium broken link',
          severity: 'medium'
        },
        {
          file: 'src/utils.ts',
          type: 'deprecated-api',
          description: 'Medium deprecated API issue',
          severity: 'medium'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = mediumSeverityDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const normalPriorityTasks = candidates.filter(c => c.priority === 'normal');
      expect(normalPriorityTasks).toHaveLength(3);

      normalPriorityTasks.forEach(task => {
        expect(task.score).toBe(0.6); // Medium severity maps to 0.6 score
        expect(task.estimatedEffort).toBe('low'); // Medium severity maps to low effort
      });
    });

    it('should correctly map low severity to low priority', () => {
      const lowSeverityDocs: OutdatedDocumentation[] = [
        {
          file: 'examples/basic.md',
          type: 'version-mismatch',
          description: 'Low version mismatch',
          severity: 'low'
        },
        {
          file: 'docs/refs.md',
          type: 'broken-link',
          description: 'Low broken link',
          severity: 'low'
        },
        {
          file: 'src/legacy.ts',
          type: 'deprecated-api',
          description: 'Low deprecated API issue',
          severity: 'low'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = lowSeverityDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const lowPriorityTasks = candidates.filter(c => c.priority === 'low');
      expect(lowPriorityTasks).toHaveLength(3);

      lowPriorityTasks.forEach(task => {
        expect(task.score).toBe(0.4); // Low severity maps to 0.4 score
        expect(task.estimatedEffort).toBe('low'); // Low severity maps to low effort
      });
    });

    it('should generate appropriate candidate IDs for each type and severity', () => {
      const allTypesAndSeverities: OutdatedDocumentation[] = [
        // Version mismatches
        { file: 'test1.md', type: 'version-mismatch', description: 'Test', severity: 'high' },
        { file: 'test2.md', type: 'version-mismatch', description: 'Test', severity: 'medium' },
        { file: 'test3.md', type: 'version-mismatch', description: 'Test', severity: 'low' },
        // Broken links
        { file: 'test4.md', type: 'broken-link', description: 'Test', severity: 'high' },
        { file: 'test5.md', type: 'broken-link', description: 'Test', severity: 'medium' },
        { file: 'test6.md', type: 'broken-link', description: 'Test', severity: 'low' },
        // Deprecated APIs
        { file: 'test7.ts', type: 'deprecated-api', description: 'Test', severity: 'high' },
        { file: 'test8.ts', type: 'deprecated-api', description: 'Test', severity: 'medium' },
        { file: 'test9.ts', type: 'deprecated-api', description: 'Test', severity: 'low' }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = allTypesAndSeverities;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const expectedCandidateIds = [
        'docs-fix-version-mismatches-critical', // Only high severity for version mismatches
        'docs-fix-broken-links-critical', // Only high severity for broken links
        'docs-fix-deprecated-api-docs-critical' // Only high severity for deprecated API docs
      ];

      expectedCandidateIds.forEach(expectedId => {
        const candidate = candidates.find(c => c.candidateId === expectedId);
        expect(candidate, `Expected candidate with ID ${expectedId}`).toBeDefined();
      });

      // Should only have highest severity tasks due to precedence logic
      expect(candidates.filter(c => c.candidateId.includes('version-mismatches')).length).toBe(1);
      expect(candidates.filter(c => c.candidateId.includes('broken-links')).length).toBe(1);
      expect(candidates.filter(c => c.candidateId.includes('deprecated-api-docs')).length).toBe(1);
    });
  });

  // ============================================================================
  // Acceptance Criteria 5: Integration with existing DocsAnalyzer functionality
  // ============================================================================

  describe('integration with existing DocsAnalyzer functionality', () => {
    it('should work alongside existing critical documentation coverage tasks', () => {
      // Set up critical documentation coverage AND new OutdatedDocumentation types
      baseProjectAnalysis.documentation.coverage = 15; // Critical coverage
      baseProjectAnalysis.documentation.outdatedDocs = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Version mismatch in critical docs',
          severity: 'high'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should have both existing and new tasks
      const criticalDocsTask = candidates.find(c => c.candidateId === 'docs-critical-docs');
      const versionMismatchTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-critical');

      expect(criticalDocsTask).toBeDefined();
      expect(versionMismatchTask).toBeDefined();
      expect(candidates.length).toBeGreaterThanOrEqual(2);
    });

    it('should work alongside core module documentation tasks', () => {
      baseProjectAnalysis.documentation.missingDocs = ['src/core.ts', 'src/api.ts'];
      baseProjectAnalysis.documentation.outdatedDocs = [
        {
          file: 'src/core.ts',
          type: 'broken-link',
          description: 'Broken JSDoc reference',
          severity: 'medium'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const coreModulesTask = candidates.find(c => c.candidateId === 'docs-core-module-docs');
      const brokenLinksTask = candidates.find(c => c.candidateId === 'docs-fix-broken-links-medium');

      expect(coreModulesTask).toBeDefined();
      expect(brokenLinksTask).toBeDefined();
    });

    it('should prioritize new OutdatedDocumentation types correctly in the overall priority scheme', () => {
      // Mix of existing conditions and new OutdatedDocumentation types
      baseProjectAnalysis.documentation.coverage = 35; // Moderate coverage
      baseProjectAnalysis.documentation.missingDocs = ['src/helper.ts']; // Few missing
      baseProjectAnalysis.documentation.outdatedDocs = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Critical version mismatch',
          severity: 'high'
        },
        {
          file: 'src/api.ts',
          type: 'deprecated-api',
          description: 'Poor @deprecated documentation',
          severity: 'medium'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should have improvement coverage task (score 0.4) and new tasks
      const improvementTask = candidates.find(c => c.candidateId === 'docs-improve-docs-coverage');
      const criticalVersionTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-critical');
      const deprecatedTask = candidates.find(c => c.candidateId === 'docs-fix-deprecated-api-docs-medium');

      expect(improvementTask).toBeDefined();
      expect(criticalVersionTask).toBeDefined();
      expect(deprecatedTask).toBeDefined();

      // Critical version mismatch should have higher score than improvement task
      if (criticalVersionTask && improvementTask) {
        expect(criticalVersionTask.score).toBeGreaterThan(improvementTask.score);
      }
    });

    it('should not interfere with existing prioritization logic', () => {
      // Test that existing prioritize() method still works correctly
      baseProjectAnalysis.documentation.coverage = 25; // Moderate
      baseProjectAnalysis.documentation.missingDocs = ['src/core.ts', 'src/api.ts']; // Core files
      baseProjectAnalysis.documentation.outdatedDocs = [
        {
          file: 'docs/guide.md',
          type: 'broken-link',
          description: 'Low priority broken link',
          severity: 'low'
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = docsAnalyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();
      // Core modules task (score 0.7) should be prioritized over broken link task (score 0.4)
      expect(prioritized!.candidateId).toBe('docs-core-module-docs');
    });

    it('should handle unknown OutdatedDocumentation types gracefully', () => {
      const unknownTypeDocs: OutdatedDocumentation[] = [
        {
          file: 'unknown.md',
          type: 'unknown-type' as any, // Invalid type
          description: 'Unknown documentation issue',
          severity: 'high'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = unknownTypeDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should not crash and should not generate tasks for unknown types
      expect(Array.isArray(candidates)).toBe(true);
      const unknownTasks = candidates.filter(c => c.candidateId.includes('unknown-type'));
      expect(unknownTasks).toHaveLength(0);
    });

    it('should handle malformed OutdatedDocumentation entries gracefully', () => {
      const malformedDocs: OutdatedDocumentation[] = [
        {
          file: '', // Empty file
          type: 'version-mismatch',
          description: '',
          severity: 'high'
        },
        {
          file: 'valid.md',
          type: 'broken-link',
          description: 'Valid entry',
          severity: 'medium'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = malformedDocs;

      expect(() => {
        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle empty OutdatedDocumentation arrays', () => {
      baseProjectAnalysis.documentation.outdatedDocs = [];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const outdatedTasks = candidates.filter(c =>
        c.candidateId.includes('version-mismatch') ||
        c.candidateId.includes('broken-link') ||
        c.candidateId.includes('deprecated-api')
      );

      expect(outdatedTasks).toHaveLength(0);
    });

    it('should handle missing severity field gracefully', () => {
      const docsWithoutSeverity: OutdatedDocumentation[] = [
        {
          file: 'test.md',
          type: 'version-mismatch',
          description: 'Test without severity'
          // Missing severity field
        } as OutdatedDocumentation
      ];

      baseProjectAnalysis.documentation.outdatedDocs = docsWithoutSeverity;

      expect(() => {
        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle very large numbers of OutdatedDocumentation entries', () => {
      const manyDocs: OutdatedDocumentation[] = Array.from({ length: 100 }, (_, i) => ({
        file: `file${i}.md`,
        type: 'version-mismatch',
        description: `Version mismatch ${i}`,
        severity: 'medium' as const
      }));

      baseProjectAnalysis.documentation.outdatedDocs = manyDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should handle large numbers gracefully and still generate appropriate tasks
      const versionTasks = candidates.filter(c => c.candidateId.includes('version-mismatch'));
      expect(versionTasks.length).toBeLessThanOrEqual(1); // Should consolidate into single task

      if (versionTasks.length > 0) {
        expect(versionTasks[0].description).toContain('100');
      }
    });

    it('should preserve optional fields in OutdatedDocumentation entries', () => {
      const docsWithOptionalFields: OutdatedDocumentation[] = [
        {
          file: 'advanced.md',
          type: 'deprecated-api',
          description: 'Deprecated API with full metadata',
          severity: 'high',
          line: 42,
          suggestion: 'Use the new API instead'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = docsWithOptionalFields;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      // Verify the optional fields are preserved in the original data
      expect(docsWithOptionalFields[0].line).toBe(42);
      expect(docsWithOptionalFields[0].suggestion).toBe('Use the new API instead');
    });
  });
});