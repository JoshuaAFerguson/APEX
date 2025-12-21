/**
 * RefactoringAnalyzer Integration Tests
 *
 * End-to-end integration tests that validate the complete workflow of the
 * enhanced RefactoringAnalyzer with real-world scenarios and complex data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot } from '@apexcli/core';

describe('RefactoringAnalyzer Integration Tests', () => {
  let analyzer: RefactoringAnalyzer;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();
  });

  describe('real-world project analysis', () => {
    it('should handle large enterprise project with mixed complexity issues', () => {
      // Simulate a large enterprise project with various complexity issues
      const enterpriseProject: ProjectAnalysis = {
        codebaseSize: {
          files: 500,
          lines: 75000,
          languages: { 'ts': 300, 'js': 150, 'jsx': 50 }
        },
        dependencies: {
          outdated: ['react@16.14.0', 'lodash@4.17.15'],
          security: []
        },
        codeQuality: {
          lintIssues: 247, // High number
          duplicatedCode: [
            'src/utils/validation.ts',
            'src/components/forms/UserForm.tsx',
            'src/components/forms/AdminForm.tsx',
            'src/api/validators.ts'
          ],
          complexityHotspots: [
            {
              file: 'src/core/business-logic/OrderProcessor.ts',
              cyclomaticComplexity: 72, // Critical
              cognitiveComplexity: 95, // Critical
              lineCount: 3200 // Critical
            },
            {
              file: 'src/components/dashboard/Analytics.tsx',
              cyclomaticComplexity: 45, // High
              cognitiveComplexity: 38, // Medium-High
              lineCount: 1800 // High
            },
            {
              file: 'src/utils/data-processing.ts',
              cyclomaticComplexity: 35, // High
              cognitiveComplexity: 52, // High
              lineCount: 950 // Medium
            },
            {
              file: 'src/api/legacy-endpoints.ts',
              cyclomaticComplexity: 28, // Medium
              cognitiveComplexity: 41, // High
              lineCount: 1200 // High
            },
            {
              file: 'src/services/NotificationService.ts',
              cyclomaticComplexity: 22, // Medium
              cognitiveComplexity: 30, // High
              lineCount: 650 // Medium
            }
          ],
          codeSmells: []
        },
        documentation: {
          coverage: 42,
          missingDocs: ['src/core/business-logic/OrderProcessor.ts'],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 35,
            details: {
              totalEndpoints: 50,
              documentedEndpoints: 18,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: []
            }
          }
        },
        performance: {
          slowTests: ['OrderProcessor.test.ts'],
          bottlenecks: ['data-processing.ts']
        }
      };

      const candidates = analyzer.analyze(enterpriseProject);

      // Should generate multiple candidates
      expect(candidates.length).toBeGreaterThanOrEqual(6);

      // Should have duplicated code task (highest priority)
      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.score).toBe(0.9);

      // Should have individual complexity hotspot tasks (top 3)
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(3);

      // First hotspot should be the most critical (OrderProcessor)
      expect(hotspotTasks[0].description).toContain('OrderProcessor.ts');
      expect(hotspotTasks[0].priority).toBe('urgent');

      // Should have aggregate complexity sweep task
      const sweepTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');
      expect(sweepTask).toBeDefined();
      expect(sweepTask?.description).toContain('5 complexity hotspots (1 critical)');
      expect(sweepTask?.priority).toBe('high'); // Due to critical hotspot

      // Should have linting task
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.priority).toBe('high');

      // Test prioritization
      const prioritized = analyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();
      expect(prioritized?.title).toContain('Duplicated Code'); // Highest score
    });

    it('should handle legacy codebase with string format hotspots', () => {
      const legacyProject: ProjectAnalysis = {
        codebaseSize: {
          files: 200,
          lines: 25000,
          languages: { 'js': 150, 'ts': 50 }
        },
        dependencies: {
          outdated: [],
          security: []
        },
        codeQuality: {
          lintIssues: 89,
          duplicatedCode: [],
          // Legacy string format
          complexityHotspots: [
            'src/legacy/old-controller.js',
            'src/legacy/data-mapper.js',
            'src/legacy/validation.js'
          ] as any,
          codeSmells: []
        },
        documentation: {
          coverage: 15,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 20,
            details: {
              totalEndpoints: 15,
              documentedEndpoints: 3,
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

      const candidates = analyzer.analyze(legacyProject);

      // Should handle legacy format gracefully
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(3);

      // All legacy hotspots should get default complexity values
      hotspotTasks.forEach(task => {
        expect(task.description).toContain('Cyclomatic Complexity: 15 (medium)');
        expect(task.description).toContain('Cognitive Complexity: 20 (medium)');
        expect(task.description).toContain('Lines: 300 (medium)');
        expect(task.priority).toBe('normal');
      });

      // Should also have lint task
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');
      expect(lintTask).toBeDefined();
      expect(lintTask?.priority).toBe('normal');
    });

    it('should handle well-maintained project correctly', () => {
      const wellMaintainedProject: ProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 15000,
          languages: { 'ts': 90, 'tsx': 10 }
        },
        dependencies: {
          outdated: [],
          security: []
        },
        codeQuality: {
          lintIssues: 2, // Very low
          duplicatedCode: [], // None
          complexityHotspots: [
            // Only low complexity files
            {
              file: 'src/utils/helpers.ts',
              cyclomaticComplexity: 8,
              cognitiveComplexity: 12,
              lineCount: 150
            }
          ],
          codeSmells: []
        },
        documentation: {
          coverage: 85,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 90,
            details: {
              totalEndpoints: 20,
              documentedEndpoints: 18,
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

      const candidates = analyzer.analyze(wellMaintainedProject);

      // Should generate minimal candidates
      expect(candidates.length).toBeLessThanOrEqual(2);

      // If any candidates, should be low priority
      candidates.forEach(candidate => {
        expect(['low', 'normal']).toContain(candidate.priority);
        expect(candidate.score).toBeLessThan(0.6);
      });
    });
  });

  describe('complexity analysis accuracy', () => {
    it('should accurately calculate weighted scores for diverse hotspots', () => {
      const diverseHotspots: ComplexityHotspot[] = [
        {
          file: 'src/high-cyclomatic.ts',
          cyclomaticComplexity: 45, // High (0.9 normalized)
          cognitiveComplexity: 15, // Low (0.25 normalized)
          lineCount: 300 // Low (0.15 normalized)
        },
        {
          file: 'src/high-cognitive.ts',
          cyclomaticComplexity: 12, // Low (0.24 normalized)
          cognitiveComplexity: 50, // High (0.83 normalized)
          lineCount: 400 // Low (0.2 normalized)
        },
        {
          file: 'src/large-file.ts',
          cyclomaticComplexity: 15, // Low (0.3 normalized)
          cognitiveComplexity: 20, // Low (0.33 normalized)
          lineCount: 1800 // High (0.9 normalized)
        },
        {
          file: 'src/balanced.ts',
          cyclomaticComplexity: 25, // Medium (0.5 normalized)
          cognitiveComplexity: 30, // High (0.5 normalized)
          lineCount: 1000 // High (0.5 normalized)
        }
      ];

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { 'ts': 50 } },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: diverseHotspots,
          codeSmells: []
        },
        documentation: {
          coverage: 50,
          missingDocs: [],
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
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const candidates = analyzer.analyze(analysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(4);

      // Calculate expected scores manually and verify ordering
      // Weights: cyclomatic: 0.40, cognitive: 0.35, lineCount: 0.25

      // high-cyclomatic: 0.40 * 0.9 + 0.35 * 0.25 + 0.25 * 0.15 = 0.36 + 0.0875 + 0.0375 = 0.485
      // high-cognitive: 0.40 * 0.24 + 0.35 * 0.83 + 0.25 * 0.2 = 0.096 + 0.2905 + 0.05 = 0.4365
      // large-file: 0.40 * 0.3 + 0.35 * 0.33 + 0.25 * 0.9 = 0.12 + 0.1155 + 0.225 = 0.4605
      // balanced: 0.40 * 0.5 + 0.35 * 0.5 + 0.25 * 0.5 = 0.2 + 0.175 + 0.125 = 0.5

      // Order should be: balanced > high-cyclomatic > large-file > high-cognitive
      expect(hotspotTasks[0].description).toContain('balanced.ts');
      expect(hotspotTasks[1].description).toContain('high-cyclomatic.ts');
      expect(hotspotTasks[2].description).toContain('large-file.ts');
      expect(hotspotTasks[3].description).toContain('high-cognitive.ts');

      // Verify score ordering
      expect(hotspotTasks[0].score).toBeGreaterThan(hotspotTasks[1].score);
      expect(hotspotTasks[1].score).toBeGreaterThan(hotspotTasks[2].score);
      expect(hotspotTasks[2].score).toBeGreaterThan(hotspotTasks[3].score);
    });

    it('should apply combined high complexity bonus correctly', () => {
      const combinedHighHotspot: ComplexityHotspot = {
        file: 'src/nightmare.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 45, // High
        lineCount: 500 // Medium
      };

      const regularHotspot: ComplexityHotspot = {
        file: 'src/regular.ts',
        cyclomaticComplexity: 35, // High
        cognitiveComplexity: 20, // Low
        lineCount: 1500 // High
      };

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { 'ts': 50 } },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [combinedHighHotspot, regularHotspot],
          codeSmells: []
        },
        documentation: {
          coverage: 50,
          missingDocs: [],
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
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const candidates = analyzer.analyze(analysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(2);

      // Combined high complexity should get bonus and be first
      expect(hotspotTasks[0].description).toContain('nightmare.ts');
      expect(hotspotTasks[0].description).toContain('combination of high cyclomatic and cognitive complexity');

      // Regular hotspot should not mention combined complexity
      expect(hotspotTasks[1].description).toContain('regular.ts');
      expect(hotspotTasks[1].description).not.toContain('combination of high');
    });
  });

  describe('comprehensive refactoring recommendations', () => {
    it('should provide contextual recommendations based on complexity profile', () => {
      const complexityProfiles: ComplexityHotspot[] = [
        {
          file: 'src/branchy.ts',
          cyclomaticComplexity: 40, // High - many branches
          cognitiveComplexity: 15, // Low - simple logic
          lineCount: 200 // Low - reasonable size
        },
        {
          file: 'src/confusing.ts',
          cyclomaticComplexity: 12, // Low - few branches
          cognitiveComplexity: 50, // High - hard to follow
          lineCount: 300 // Low - reasonable size
        },
        {
          file: 'src/monolith.ts',
          cyclomaticComplexity: 15, // Low - simple branches
          cognitiveComplexity: 20, // Low - easy to follow
          lineCount: 1800 // High - huge file
        }
      ];

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { 'ts': 50 } },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: complexityProfiles,
          codeSmells: []
        },
        documentation: {
          coverage: 50,
          missingDocs: [],
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
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const candidates = analyzer.analyze(analysis);
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      expect(hotspotTasks).toHaveLength(3);

      // Find each task and verify recommendations
      const branchyTask = hotspotTasks.find(t => t.description.includes('branchy.ts'));
      const confusingTask = hotspotTasks.find(t => t.description.includes('confusing.ts'));
      const monolithTask = hotspotTasks.find(t => t.description.includes('monolith.ts'));

      expect(branchyTask).toBeDefined();
      expect(confusingTask).toBeDefined();
      expect(monolithTask).toBeDefined();

      // Branchy task should have cyclomatic complexity recommendations
      expect(branchyTask!.rationale).toContain('Extract methods to reduce branching complexity');
      expect(branchyTask!.rationale).toContain('Replace complex conditionals with polymorphism');

      // Confusing task should have cognitive complexity recommendations
      expect(confusingTask!.rationale).toContain('Flatten control flow to improve readability');
      expect(confusingTask!.rationale).toContain('Extract helper methods for complex logic blocks');

      // Monolith task should have line count recommendations
      expect(monolithTask!.rationale).toContain('Split into multiple modules applying Single Responsibility');
      expect(monolithTask!.rationale).toContain('Extract related functionality into separate classes');
    });
  });

  describe('end-to-end workflow validation', () => {
    it('should demonstrate complete analysis to task generation workflow', () => {
      // Complete realistic project analysis
      const projectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 150,
          lines: 25000,
          languages: { 'ts': 100, 'tsx': 30, 'js': 20 }
        },
        dependencies: {
          outdated: ['lodash@4.17.15'],
          security: []
        },
        codeQuality: {
          lintIssues: 42,
          duplicatedCode: ['src/utils/validation.ts', 'src/forms/validators.ts'],
          complexityHotspots: [
            {
              file: 'src/core/StateMachine.ts',
              cyclomaticComplexity: 48,
              cognitiveComplexity: 55,
              lineCount: 1400
            }
          ],
          codeSmells: []
        },
        documentation: {
          coverage: 65,
          missingDocs: ['src/core/StateMachine.ts'],
          undocumentedExports: [],
          outdatedDocs: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 70,
            details: {
              totalEndpoints: 25,
              documentedEndpoints: 18,
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

      // Step 1: Analyze project
      const candidates = analyzer.analyze(projectAnalysis);

      // Should generate multiple candidates
      expect(candidates.length).toBe(3); // Duplicate code + complexity hotspot + lint issues

      // Step 2: Verify candidate structure
      candidates.forEach(candidate => {
        expect(candidate).toHaveProperty('candidateId');
        expect(candidate).toHaveProperty('title');
        expect(candidate).toHaveProperty('description');
        expect(candidate).toHaveProperty('priority');
        expect(candidate).toHaveProperty('estimatedEffort');
        expect(candidate).toHaveProperty('suggestedWorkflow');
        expect(candidate).toHaveProperty('rationale');
        expect(candidate).toHaveProperty('score');

        // Validate ID format
        expect(candidate.candidateId).toMatch(/^refactoring-/);
        expect(candidate.suggestedWorkflow).toBe('refactoring');

        // Validate score range
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });

      // Step 3: Test prioritization
      const prioritized = analyzer.prioritize(candidates);
      expect(prioritized).toBeDefined();

      // Should prioritize duplicated code (highest score)
      expect(prioritized!.candidateId).toBe('refactoring-duplicated-code');

      // Step 4: Verify all candidates have meaningful content
      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      const lintTask = candidates.find(c => c.candidateId === 'refactoring-lint-issues');

      expect(duplicateTask?.description).toContain('2 instances');
      expect(complexityTask?.description).toContain('StateMachine.ts');
      expect(lintTask?.description).toContain('42 linting issues');

      // Step 5: Verify recommendations quality
      expect(complexityTask?.rationale).toContain('major refactoring with design patterns');
      expect(duplicateTask?.rationale).toContain('maintenance burden');
      expect(lintTask?.rationale).toContain('code quality problems');

      // Complete workflow validated ✓
    });
  });
});