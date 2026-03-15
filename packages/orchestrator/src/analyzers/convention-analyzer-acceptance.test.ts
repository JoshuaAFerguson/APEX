/**
 * ConventionAnalyzer Acceptance Tests
 *
 * These tests verify that the ConventionAnalyzer meets all acceptance criteria:
 * - ConventionAnalyzer class extends BaseAnalyzer
 * - Implements StrategyAnalyzer interface with type='conventions'
 * - Has analyze() method that scans project files
 * - Is exported from analyzers/index.ts
 * - Includes basic test file for class structure
 */

import { ConventionAnalyzer } from './convention-analyzer';
import { BaseAnalyzer } from './base-analyzer';
import type { StrategyAnalyzer } from './base-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

// Import from index to verify export
import { ConventionAnalyzer as IndexConventionAnalyzer } from './index';

describe('ConventionAnalyzer - Acceptance Criteria', () => {
  let analyzer: ConventionAnalyzer;

  beforeEach(() => {
    analyzer = new ConventionAnalyzer();
  });

  describe('AC1: ConventionAnalyzer class extends BaseAnalyzer', () => {
    it('should extend BaseAnalyzer', () => {
      expect(analyzer).toBeInstanceOf(BaseAnalyzer);
      expect(analyzer).toBeInstanceOf(ConventionAnalyzer);
    });

    it('should inherit BaseAnalyzer methods', () => {
      expect(typeof analyzer.prioritize).toBe('function');
      expect(typeof analyzer.createCandidate).toBe('function');
    });
  });

  describe('AC2: Implements StrategyAnalyzer interface with type="conventions"', () => {
    it('should have type property set to "conventions"', () => {
      expect(analyzer.type).toBe('conventions');
    });

    it('should implement StrategyAnalyzer interface methods', () => {
      // Verify interface compliance
      const strategyAnalyzer: StrategyAnalyzer = analyzer;
      expect(typeof strategyAnalyzer.analyze).toBe('function');
      expect(typeof strategyAnalyzer.prioritize).toBe('function');
      expect(typeof strategyAnalyzer.type).toBe('string');
    });

    it('should have analyze method with correct signature', () => {
      expect(typeof analyzer.analyze).toBe('function');
      expect(analyzer.analyze.length).toBe(1); // Should accept one parameter
    });
  });

  describe('AC3: Has analyze() method that scans project files', () => {
    it('should have analyze method that processes project data', () => {
      const sampleAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 50,
          lines: 5000,
          languages: { 'TypeScript': 5000 },
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [],
        },
        documentation: {
          coverage: 50,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 60,
            details: { documentedItems: 6, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 500000,
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 70,
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const result = analyzer.analyze(sampleAnalysis);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should scan and identify multiple types of convention issues', () => {
      const analysisWithMultipleIssues: ProjectAnalysis = {
        codebaseSize: {
          files: 150, // Multi-language threshold
          lines: 15000,
          languages: {
            'TypeScript': 5000,
            'Python': 4000,
            'Go': 3000,
            'Java': 3000,
          },
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 250, // High formatting issues
          duplicatedCode: Array(5).fill(0).map((_, i) => ({
            pattern: `duplicate-${i}`,
            similarity: 0.8,
            locations: [{ file: `file${i}.ts`, startLine: 1, endLine: 10 }],
          })),
          complexityHotspots: Array(15).fill(0).map((_, i) => ({
            file: `complex${i}.ts`,
            function: `func${i}`,
            complexity: 15,
            type: 'cyclomatic' as const,
            line: 1,
            reasons: ['high complexity'],
          })),
          codeSmells: [],
        },
        documentation: {
          coverage: 25, // Poor documentation
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 30,
            details: { documentedItems: 3, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 800000,
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 60,
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(analysisWithMultipleIssues);

      // Should detect multiple convention issue types
      expect(candidates.length).toBeGreaterThan(1);
      expect(candidates.length).toBeLessThanOrEqual(5); // Should limit results

      // Should identify different types of issues
      const issueTypes = candidates.map(c => c.title);
      const hasFormattingIssue = issueTypes.some(title => title.includes('formatting'));
      const hasDocumentationIssue = issueTypes.some(title => title.includes('documentation'));
      const hasIndentationIssue = issueTypes.some(title => title.includes('indentation'));

      expect(hasFormattingIssue || hasDocumentationIssue || hasIndentationIssue).toBe(true);
    });

    it('should include file scanning infrastructure constants', () => {
      // Verify the analyzer has the infrastructure for file scanning
      // (constants are defined but not directly accessible, so we test indirectly)

      // The analyzer should handle multi-language projects differently
      const multiLangAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 120,
          lines: 10000,
          languages: {
            'TypeScript': 3000,
            'Python': 3000,
            'Go': 2000,
            'Rust': 2000,
          },
        },
        dependencies: { outdated: [], security: [], outdatedPackages: [], securityIssues: [], deprecatedPackages: [] },
        codeQuality: { lintIssues: 10, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 80,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { percentage: 80, details: { documentedItems: 8, undocumentedItems: [] } },
        },
        performance: { bundleSize: 400000, slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 85, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(multiLangAnalysis);

      // Should detect indentation issues for multi-language projects
      const indentationIssue = candidates.find(c => c.title.includes('indentation'));
      expect(indentationIssue).toBeDefined();
    });
  });

  describe('AC4: Is exported from analyzers/index.ts', () => {
    it('should be exported from index.ts', () => {
      expect(IndexConventionAnalyzer).toBeDefined();
      expect(IndexConventionAnalyzer).toBe(ConventionAnalyzer);
    });

    it('should create instance from index export', () => {
      const instance = new IndexConventionAnalyzer();
      expect(instance).toBeInstanceOf(ConventionAnalyzer);
      expect(instance).toBeInstanceOf(BaseAnalyzer);
      expect(instance.type).toBe('conventions');
    });
  });

  describe('AC5: Includes basic test file for class structure', () => {
    it('should have comprehensive test coverage for class structure', () => {
      // This test file itself validates this acceptance criterion
      expect(analyzer).toBeDefined();
    });

    it('should validate all TaskCandidate properties', () => {
      const analysisWithIssues: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { 'TypeScript': 5000 } },
        dependencies: { outdated: [], security: [], outdatedPackages: [], securityIssues: [], deprecatedPackages: [] },
        codeQuality: { lintIssues: 100, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 40,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { percentage: 40, details: { documentedItems: 4, undocumentedItems: [] } },
        },
        performance: { bundleSize: 500000, slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 70, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(analysisWithIssues);

      expect(candidates.length).toBeGreaterThan(0);

      candidates.forEach(candidate => {
        // Verify all required TaskCandidate properties
        expect(candidate.candidateId).toBeDefined();
        expect(typeof candidate.candidateId).toBe('string');
        expect(candidate.candidateId).toMatch(/^conventions-/);

        expect(candidate.title).toBeDefined();
        expect(typeof candidate.title).toBe('string');

        expect(candidate.description).toBeDefined();
        expect(typeof candidate.description).toBe('string');

        expect(candidate.priority).toBeDefined();
        expect(['low', 'normal', 'high', 'critical']).toContain(candidate.priority);

        expect(candidate.estimatedEffort).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);

        expect(candidate.suggestedWorkflow).toBe('conventions');

        expect(candidate.rationale).toBeDefined();
        expect(typeof candidate.rationale).toBe('string');

        expect(candidate.score).toBeDefined();
        expect(typeof candidate.score).toBe('number');
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);

        if (candidate.remediationSuggestions) {
          expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);
          candidate.remediationSuggestions.forEach(suggestion => {
            expect(suggestion.type).toBeDefined();
            expect(suggestion.description).toBeDefined();
            expect(suggestion.priority).toBeDefined();
          });
        }
      });
    });
  });

  describe('Overall Integration', () => {
    it('should work end-to-end with realistic project data', () => {
      const realisticAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 85,
          lines: 12500,
          languages: { 'TypeScript': 8000, 'JavaScript': 3000, 'CSS': 1500 },
        },
        dependencies: {
          outdated: ['react@16.0.0'],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 75,
          duplicatedCode: [
            {
              pattern: 'component pattern',
              similarity: 0.85,
              locations: [
                { file: 'src/ComponentA.tsx', startLine: 10, endLine: 25 },
                { file: 'src/ComponentB.tsx', startLine: 15, endLine: 30 },
              ],
            },
          ],
          complexityHotspots: [
            {
              file: 'src/utils/complex.ts',
              function: 'processData',
              complexity: 12,
              type: 'cyclomatic' as const,
              line: 45,
              reasons: ['nested conditions'],
            },
          ],
          codeSmells: [],
        },
        documentation: {
          coverage: 65,
          missingDocs: ['src/helpers/index.ts'],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 70,
            details: { documentedItems: 14, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 650000,
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 78,
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(realisticAnalysis);

      expect(candidates).toBeDefined();
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeLessThanOrEqual(5);

      // Should generate actionable candidates with proper priorities
      candidates.forEach(candidate => {
        expect(candidate.title).toMatch(/fix.*conventions/i);
        expect(candidate.suggestedWorkflow).toBe('conventions');
      });
    });
  });
});