/**
 * DocsAnalyzer Edge Cases and Integration Tests
 *
 * Tests for complex scenarios, edge cases, error handling, and integration
 * between different analysis features in the enhanced DocsAnalyzer.
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

describe('DocsAnalyzer Edge Cases and Integration', () => {
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
  // Complex Integration Scenarios
  // ============================================================================

  describe('complex integration scenarios', () => {
    it('should handle projects with all types of documentation issues', () => {
      // Setup comprehensive documentation issues
      baseProjectAnalysis.documentation = {
        coverage: 15, // Critical coverage
        missingDocs: ['src/core.ts', 'src/api.ts', 'src/main.ts'], // Core files missing
        undocumentedExports: [
          {
            file: 'src/api.ts',
            name: 'PublicAPI',
            type: 'class',
            line: 10,
            isPublic: true
          },
          {
            file: 'src/types.ts',
            name: 'Config',
            type: 'interface',
            line: 5,
            isPublic: false
          }
        ],
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'References v1.0.0 but current is v3.0.0',
            severity: 'high'
          },
          {
            file: 'src/legacy.ts',
            type: 'stale-reference',
            description: 'TODO from 120 days ago',
            severity: 'high'
          },
          {
            file: 'docs/api.md',
            type: 'broken-link',
            description: 'Link to moved endpoint',
            severity: 'medium'
          }
        ],
        missingReadmeSections: [
          {
            section: 'installation',
            priority: 'required',
            description: 'Installation instructions'
          },
          {
            section: 'usage',
            priority: 'required',
            description: 'Basic usage'
          }
        ],
        apiCompleteness: {
          percentage: 25,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 5,
            undocumentedItems: [
              { name: 'criticalAPI', file: 'src/critical.ts', type: 'function' },
              { name: 'UserService', file: 'src/user.ts', type: 'class' }
            ],
            wellDocumentedExamples: [],
            commonIssues: ['Missing JSDoc', 'No parameter descriptions']
          }
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate multiple high-priority tasks
      const highPriorityTasks = candidates.filter(c => c.priority === 'high');
      expect(highPriorityTasks.length).toBeGreaterThanOrEqual(4);

      // Verify specific task types are generated
      const taskTypes = candidates.map(c => c.candidateId);
      expect(taskTypes).toContain('docs-critical-docs'); // Critical coverage
      expect(taskTypes).toContain('docs-undocumented-public-exports'); // Public exports
      expect(taskTypes).toContain('docs-fix-version-mismatches-critical'); // Version mismatch
      expect(taskTypes).toContain('docs-resolve-stale-comments-critical'); // Stale comments
      expect(taskTypes).toContain('docs-readme-required-sections'); // Required README
      expect(taskTypes).toContain('docs-api-docs-critical'); // API coverage

      // Verify scoring reflects priority
      const criticalCoverageTask = candidates.find(c => c.candidateId === 'docs-critical-docs');
      expect(criticalCoverageTask?.score).toBe(0.9);

      const publicExportsTask = candidates.find(c => c.candidateId === 'docs-undocumented-public-exports');
      expect(publicExportsTask?.score).toBe(0.85);
    });

    it('should prioritize tasks correctly when multiple issues exist', () => {
      baseProjectAnalysis.documentation = {
        coverage: 5, // Extremely critical
        missingDocs: [],
        undocumentedExports: [
          {
            file: 'src/api.ts',
            name: 'lowPriorityHelper',
            type: 'function',
            line: 1,
            isPublic: false
          }
        ],
        outdatedDocs: [
          {
            file: 'docs/minor.md',
            type: 'broken-link',
            description: 'Minor broken link',
            severity: 'low'
          }
        ],
        missingReadmeSections: [
          {
            section: 'faq',
            priority: 'optional',
            description: 'FAQ section'
          }
        ],
        apiCompleteness: {
          percentage: 15,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 1,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Sort by score to verify prioritization
      const sortedCandidates = candidates.sort((a, b) => b.score - a.score);

      // Critical coverage should be top priority
      expect(sortedCandidates[0].candidateId).toBe('docs-critical-docs');
      expect(sortedCandidates[0].score).toBe(0.9);

      // Critical API coverage should be high priority
      const apiTask = sortedCandidates.find(c => c.candidateId === 'docs-api-docs-critical');
      expect(apiTask?.score).toBe(0.75);

      // Lower priority items should have lower scores
      const lowPriorityTasks = candidates.filter(c =>
        c.score < 0.5 && c.priority === 'low'
      );
      expect(lowPriorityTasks.length).toBeGreaterThan(0);
    });

    it('should handle overlapping file references across different issue types', () => {
      baseProjectAnalysis.documentation = {
        coverage: 50,
        missingDocs: ['src/api.ts'], // File missing docs
        undocumentedExports: [
          {
            file: 'src/api.ts', // Same file has undocumented exports
            name: 'exportedFunction',
            type: 'function',
            line: 10,
            isPublic: true
          }
        ],
        outdatedDocs: [
          {
            file: 'src/api.ts', // Same file has outdated docs
            type: 'stale-reference',
            description: 'Old TODO comment',
            severity: 'medium'
          }
        ],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 7,
            undocumentedItems: [
              { name: 'undocumentedAPI', file: 'src/api.ts', type: 'function' } // Same file
            ],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate multiple tasks for the same file
      const apiRelatedTasks = candidates.filter(c =>
        c.description.toLowerCase().includes('api') ||
        c.description.includes('src/api.ts') ||
        c.candidateId.includes('undocumented') ||
        c.candidateId.includes('stale')
      );

      expect(apiRelatedTasks.length).toBeGreaterThan(1);

      // Each task should have unique candidate IDs
      const candidateIds = apiRelatedTasks.map(c => c.candidateId);
      const uniqueIds = new Set(candidateIds);
      expect(candidateIds.length).toBe(uniqueIds.size);
    });
  });

  // ============================================================================
  // Edge Cases for Specific Functionality
  // ============================================================================

  describe('edge cases for specific functionality', () => {
    it('should handle mixed export types with complex prioritization', () => {
      const undocumentedExports: UndocumentedExport[] = [
        // Public API exports (highest priority)
        { file: 'src/public-api.ts', name: 'createUser', type: 'function', line: 1, isPublic: true },
        { file: 'src/public-api.ts', name: 'UserAPI', type: 'class', line: 10, isPublic: true },

        // Critical internal types (should not generate task due to public exports)
        { file: 'src/internal.ts', name: 'ConfigInterface', type: 'interface', line: 5, isPublic: false },
        { file: 'src/internal.ts', name: 'ServiceClass', type: 'class', line: 15, isPublic: false },

        // Other exports (should not generate task due to higher priority exports)
        { file: 'src/utils.ts', name: 'helper1', type: 'function', line: 1, isPublic: false },
        { file: 'src/utils.ts', name: 'helper2', type: 'function', line: 2, isPublic: false },
        { file: 'src/utils.ts', name: 'helper3', type: 'function', line: 3, isPublic: false },
        { file: 'src/utils.ts', name: 'helper4', type: 'function', line: 4, isPublic: false },
        { file: 'src/utils.ts', name: 'helper5', type: 'function', line: 5, isPublic: false },
        { file: 'src/utils.ts', name: 'helper6', type: 'function', line: 6, isPublic: false }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should only generate public exports task
      const publicTask = candidates.find(c => c.candidateId === 'docs-undocumented-public-exports');
      const criticalTask = candidates.find(c => c.candidateId === 'docs-undocumented-critical-types');
      const otherTask = candidates.find(c => c.candidateId === 'docs-undocumented-exports');

      expect(publicTask).toBeDefined();
      expect(publicTask?.description).toContain('2 public API exports');
      expect(publicTask?.description).toContain('createUser (function), UserAPI (class)');

      expect(criticalTask).toBeUndefined();
      expect(otherTask).toBeUndefined();
    });

    it('should handle boundary cases for effort estimation', () => {
      const testCases = [
        { type: 'exports', counts: [5, 6, 15, 16] },
        { type: 'sections', counts: [2, 3, 4, 5] },
        { type: 'apiItems', counts: [10, 11, 25, 26] }
      ];

      testCases.forEach(({ type, counts }) => {
        counts.forEach(count => {
          if (type === 'exports') {
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

            if (count <= 5) {
              expect(task?.estimatedEffort).toBe('low');
            } else if (count <= 15) {
              expect(task?.estimatedEffort).toBe('medium');
            } else {
              expect(task?.estimatedEffort).toBe('high');
            }
          }
        });
      });
    });

    it('should handle very large datasets gracefully', () => {
      // Create large datasets
      const largeUndocumentedExports: UndocumentedExport[] = Array(50).fill(null).map((_, i) => ({
        file: `src/large/file${i}.ts`,
        name: `export${i}`,
        type: 'function' as const,
        line: i + 1,
        isPublic: true
      }));

      const largeOutdatedDocs: OutdatedDocumentation[] = Array(30).fill(null).map((_, i) => ({
        file: `docs/file${i}.md`,
        type: 'version-mismatch' as const,
        description: `Mismatch ${i}`,
        severity: 'medium' as const
      }));

      baseProjectAnalysis.documentation.undocumentedExports = largeUndocumentedExports;
      baseProjectAnalysis.documentation.outdatedDocs = largeOutdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should handle large datasets without crashing
      expect(candidates).toBeDefined();
      expect(Array.isArray(candidates)).toBe(true);

      // Should limit description length appropriately
      const exportTask = candidates.find(c => c.candidateId === 'docs-undocumented-public-exports');
      expect(exportTask?.description).toBeDefined();
      expect(exportTask?.description.length).toBeLessThan(300); // Reasonable description length

      // Should have high effort for large datasets
      expect(exportTask?.estimatedEffort).toBe('high');
    });

    it('should handle malformed or incomplete data gracefully', () => {
      // Test with potentially problematic data
      const problematicExports: any[] = [
        { file: 'src/test.ts', name: 'validExport', type: 'function', line: 1, isPublic: true },
        { file: '', name: 'emptyFile', type: 'function', line: 1, isPublic: true }, // Empty file
        { file: 'src/test.ts', name: '', type: 'function', line: 1, isPublic: true }, // Empty name
        { file: 'src/test.ts', name: 'invalidLine', type: 'function', line: -1, isPublic: true }, // Invalid line
      ];

      baseProjectAnalysis.documentation.undocumentedExports = problematicExports as UndocumentedExport[];

      // Should not crash with problematic data
      expect(() => {
        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Performance and Scale Testing
  // ============================================================================

  describe('performance and scale testing', () => {
    it('should handle empty analysis efficiently', () => {
      const emptyAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 0,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 0,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      baseProjectAnalysis.documentation = emptyAnalysis;

      const startTime = Date.now();
      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
      expect(candidates).toBeDefined();
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should maintain consistent behavior across multiple calls', () => {
      baseProjectAnalysis.documentation.undocumentedExports = [
        {
          file: 'src/consistent.ts',
          name: 'testFunction',
          type: 'function',
          line: 1,
          isPublic: true
        }
      ];

      const results1 = docsAnalyzer.analyze(baseProjectAnalysis);
      const results2 = docsAnalyzer.analyze(baseProjectAnalysis);
      const results3 = docsAnalyzer.analyze(baseProjectAnalysis);

      // Results should be identical across calls
      expect(results1).toEqual(results2);
      expect(results2).toEqual(results3);

      // Should have same number of candidates
      expect(results1.length).toBe(results2.length);
      expect(results2.length).toBe(results3.length);

      // Should have same candidate IDs
      const ids1 = results1.map(c => c.candidateId).sort();
      const ids2 = results2.map(c => c.candidateId).sort();
      expect(ids1).toEqual(ids2);
    });
  });

  // ============================================================================
  // Backward Compatibility Testing
  // ============================================================================

  describe('backward compatibility', () => {
    it('should work with minimal enhanced documentation analysis', () => {
      // Test with minimal required fields
      const minimalAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 30,
        missingDocs: ['src/file.ts'],
        // All new fields are empty arrays/default values
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 0,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      baseProjectAnalysis.documentation = minimalAnalysis;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should still generate basic documentation tasks
      expect(candidates).toBeDefined();
      expect(candidates.length).toBeGreaterThan(0);

      // Should include existing functionality (missing docs)
      const missingDocsTask = candidates.find(c =>
        c.title.includes('Missing') || c.title.includes('Documentation')
      );
      expect(missingDocsTask).toBeDefined();
    });

    it('should handle legacy analysis structure', () => {
      // Simulate what might happen with older analysis data
      const legacyAnalysis = {
        coverage: 40,
        missingDocs: ['legacy.ts'],
        // Missing new fields - should handle gracefully
      } as any;

      baseProjectAnalysis.documentation = legacyAnalysis;

      expect(() => {
        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Validation and Data Integrity
  // ============================================================================

  describe('validation and data integrity', () => {
    it('should validate candidate structure and required fields', () => {
      baseProjectAnalysis.documentation.undocumentedExports = [
        {
          file: 'src/test.ts',
          name: 'testExport',
          type: 'function',
          line: 1,
          isPublic: true
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      candidates.forEach(candidate => {
        // Validate required TaskCandidate fields
        expect(candidate.candidateId).toBeDefined();
        expect(typeof candidate.candidateId).toBe('string');
        expect(candidate.candidateId.length).toBeGreaterThan(0);

        expect(candidate.title).toBeDefined();
        expect(typeof candidate.title).toBe('string');
        expect(candidate.title.length).toBeGreaterThan(0);

        expect(candidate.description).toBeDefined();
        expect(typeof candidate.description).toBe('string');
        expect(candidate.description.length).toBeGreaterThan(0);

        expect(candidate.priority).toBeDefined();
        expect(['high', 'normal', 'low']).toContain(candidate.priority);

        expect(candidate.estimatedEffort).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);

        expect(candidate.suggestedWorkflow).toBeDefined();
        expect(candidate.suggestedWorkflow).toBe('documentation');

        expect(candidate.rationale).toBeDefined();
        expect(typeof candidate.rationale).toBe('string');
        expect(candidate.rationale.length).toBeGreaterThan(0);

        expect(candidate.score).toBeDefined();
        expect(typeof candidate.score).toBe('number');
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });
    });

    it('should maintain score consistency with priority levels', () => {
      baseProjectAnalysis.documentation = {
        coverage: 10, // High priority critical task
        missingDocs: [],
        undocumentedExports: [
          {
            file: 'src/api.ts',
            name: 'publicAPI',
            type: 'function',
            line: 1,
            isPublic: true
          }
        ], // High priority public exports
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Minor version diff',
            severity: 'low'
          }
        ], // Low priority version issue
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 7,
            undocumentedItems: [
              { name: 'someAPI', file: 'src/api.ts', type: 'function' }
            ],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        } // Low priority completion task
      };

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      const highPriorityTasks = candidates.filter(c => c.priority === 'high');
      const lowPriorityTasks = candidates.filter(c => c.priority === 'low');

      if (highPriorityTasks.length > 0 && lowPriorityTasks.length > 0) {
        const minHighScore = Math.min(...highPriorityTasks.map(c => c.score));
        const maxLowScore = Math.max(...lowPriorityTasks.map(c => c.score));

        expect(minHighScore).toBeGreaterThan(maxLowScore);
      }
    });
  });
});