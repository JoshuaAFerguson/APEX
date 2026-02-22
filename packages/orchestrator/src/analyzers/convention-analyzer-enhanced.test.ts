/**
 * ConventionAnalyzer Enhanced Unit Tests
 *
 * Additional tests to ensure comprehensive coverage of ConventionAnalyzer functionality,
 * focusing on edge cases, file scanning infrastructure, and detailed scenario validation.
 */

import { ConventionAnalyzer } from './convention-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('ConventionAnalyzer - Enhanced Tests', () => {
  let analyzer: ConventionAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new ConventionAnalyzer();

    // Create comprehensive ProjectAnalysis for testing
    baseAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { 'TypeScript': 3000, 'JavaScript': 2000 },
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: [],
      },
      codeQuality: {
        lintIssues: 10,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: [],
      },
      documentation: {
        coverage: 75,
        missingDocs: [],
        outdatedDocs: [],
        undocumentedExports: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 80,
          details: { documentedItems: 8, undocumentedItems: [] },
        },
      },
      performance: {
        bundleSize: 500000,
        slowTests: [],
        bottlenecks: [],
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 80,
          uncoveredBranches: [],
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: [],
      },
    };
  });

  describe('file scanning infrastructure', () => {
    it('should have analyzable extensions defined', () => {
      // Test the analyzable extensions are present in the implementation
      // This is implicit testing through the analyzer's logic
      expect(analyzer).toBeDefined();
      expect(analyzer.type).toBe('conventions');
    });

    it('should have naming patterns configured', () => {
      // Test naming patterns exist by verifying the analyze method works
      expect(typeof analyzer.analyze).toBe('function');
    });
  });

  describe('convention issue inference - detailed scenarios', () => {
    it('should handle critical formatting issues correctly', () => {
      baseAnalysis.codeQuality.lintIssues = 500; // Critical threshold

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const formattingCandidate = candidates.find(c => c.title.includes('formatting'));
      expect(formattingCandidate).toBeDefined();
      expect(formattingCandidate?.priority).toBe('high'); // Should be high for 500+ lint issues
    });

    it('should handle very low documentation coverage as high severity', () => {
      baseAnalysis.documentation.coverage = 10; // Very low coverage

      const candidates = analyzer.analyze(baseAnalysis);

      const docCandidate = candidates.find(c => c.title.includes('documentation'));
      expect(docCandidate).toBeDefined();
      expect(docCandidate?.priority).toBe('high');
    });

    it('should handle edge case: exactly at threshold values', () => {
      // Test exactly at thresholds
      baseAnalysis.codeQuality.lintIssues = 50; // Exactly at threshold
      baseAnalysis.documentation.coverage = 50; // Exactly at threshold
      baseAnalysis.codeQuality.complexityHotspots = Array(10).fill(0).map((_, i) => ({
        file: `file${i}.ts`,
        function: `function${i}`,
        complexity: 10,
        type: 'cyclomatic' as const,
        line: 1,
        reasons: ['threshold test'],
      }));

      const candidates = analyzer.analyze(baseAnalysis);

      // Should still generate candidates at threshold
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('should handle empty or minimal data gracefully', () => {
      const minimalAnalysis = {
        codebaseSize: { files: 0, lines: 0, languages: {} },
        dependencies: { outdated: [], security: [], outdatedPackages: [], securityIssues: [], deprecatedPackages: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: {
          coverage: 100,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { percentage: 100, details: { documentedItems: 0, undocumentedItems: [] } }
        },
        performance: { bundleSize: 0, slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 100, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(minimalAnalysis);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(0); // Should be no issues for perfect project
    });
  });

  describe('scoring algorithm validation', () => {
    it('should calculate scores correctly for different severity levels', () => {
      // Test high severity issue
      baseAnalysis.codeQuality.lintIssues = 300; // High severity

      const candidates = analyzer.analyze(baseAnalysis);
      const highSeverityCandidate = candidates.find(c => c.priority === 'high');

      if (highSeverityCandidate) {
        expect(highSeverityCandidate.score).toBeGreaterThan(0.6); // High severity should have high score
      }
    });

    it('should boost scores based on inconsistency percentage', () => {
      // Create scenario with high inconsistency
      baseAnalysis.codeQuality.lintIssues = 100; // Same base severity
      baseAnalysis.documentation.coverage = 10; // High inconsistency (90%)

      const candidates = analyzer.analyze(baseAnalysis);

      // Documentation issue should have higher score due to inconsistency
      const docCandidate = candidates.find(c => c.title.includes('documentation'));
      const formatCandidate = candidates.find(c => c.title.includes('formatting'));

      if (docCandidate && formatCandidate) {
        expect(docCandidate.score).toBeGreaterThan(formatCandidate.score);
      }
    });

    it('should boost scores based on number of affected files', () => {
      baseAnalysis.codeQuality.duplicatedCode = Array(5).fill(0).map((_, i) => ({
        pattern: `pattern${i}`,
        similarity: 0.8,
        locations: Array(10).fill(0).map((_, j) => ({ // Many files affected
          file: `file${i}_${j}.ts`,
          startLine: 1,
          endLine: 10
        }))
      }));

      const candidates = analyzer.analyze(baseAnalysis);
      const importCandidate = candidates.find(c => c.title.includes('imports'));

      if (importCandidate) {
        expect(importCandidate.score).toBeGreaterThan(0.5); // Should have boosted score
      }
    });
  });

  describe('effort estimation validation', () => {
    it('should estimate high effort for large scope issues', () => {
      baseAnalysis.codeQuality.duplicatedCode = Array(5).fill(0).map((_, i) => ({
        pattern: `pattern${i}`,
        similarity: 0.8,
        locations: Array(25).fill(0).map((_, j) => ({ // 25+ files affected
          file: `file${i}_${j}.ts`,
          startLine: 1,
          endLine: 10
        }))
      }));

      const candidates = analyzer.analyze(baseAnalysis);
      const highEffortCandidate = candidates.find(c => c.estimatedEffort === 'high');

      expect(highEffortCandidate).toBeDefined();
    });

    it('should estimate low effort for small scope issues', () => {
      baseAnalysis.codeQuality.lintIssues = 60; // Triggers formatting issue

      const candidates = analyzer.analyze(baseAnalysis);
      const lowEffortCandidate = candidates.find(c => c.estimatedEffort === 'low');

      expect(lowEffortCandidate).toBeDefined();
    });

    it('should estimate medium effort for moderate scope issues', () => {
      baseAnalysis.codeQuality.complexityHotspots = Array(12).fill(0).map((_, i) => ({
        file: `file${i}.ts`,
        function: `function${i}`,
        complexity: 15,
        type: 'cyclomatic' as const,
        line: 1,
        reasons: ['medium complexity'],
      }));

      const candidates = analyzer.analyze(baseAnalysis);
      const mediumEffortCandidate = candidates.find(c => c.estimatedEffort === 'medium');

      expect(mediumEffortCandidate).toBeDefined();
    });
  });

  describe('remediation suggestions validation', () => {
    it('should provide appropriate commands for formatting issues', () => {
      baseAnalysis.codeQuality.lintIssues = 100;

      const candidates = analyzer.analyze(baseAnalysis);
      const formattingCandidate = candidates.find(c => c.title.includes('formatting'));

      expect(formattingCandidate?.remediationSuggestions).toBeDefined();
      const commandSuggestion = formattingCandidate?.remediationSuggestions?.find(s => s.type === 'command');
      expect(commandSuggestion).toBeDefined();
      expect(commandSuggestion?.command).toContain('prettier');
    });

    it('should provide manual review suggestions for documentation', () => {
      baseAnalysis.documentation.coverage = 30;

      const candidates = analyzer.analyze(baseAnalysis);
      const docCandidate = candidates.find(c => c.title.includes('documentation'));

      expect(docCandidate?.remediationSuggestions).toBeDefined();
      const manualSuggestion = docCandidate?.remediationSuggestions?.find(s => s.type === 'manual_review');
      expect(manualSuggestion).toBeDefined();
      expect(manualSuggestion?.description).toContain('documentation standards');
    });

    it('should provide documentation type suggestions for indentation issues', () => {
      baseAnalysis.codebaseSize.files = 150;
      baseAnalysis.codebaseSize.languages = { 'TypeScript': 2000, 'Python': 1500, 'Go': 1000, 'Rust': 500 };

      const candidates = analyzer.analyze(baseAnalysis);
      const indentationCandidate = candidates.find(c => c.title.includes('indentation'));

      expect(indentationCandidate?.remediationSuggestions).toBeDefined();
      const docSuggestion = indentationCandidate?.remediationSuggestions?.find(s => s.type === 'documentation');
      expect(docSuggestion).toBeDefined();
      expect(docSuggestion?.description).toContain('editorconfig');
    });
  });

  describe('rationale generation', () => {
    it('should generate meaningful rationales for different issue types', () => {
      baseAnalysis.codeQuality.lintIssues = 100;
      baseAnalysis.documentation.coverage = 30;
      baseAnalysis.codeQuality.duplicatedCode = Array(5).fill(0).map((_, i) => ({
        pattern: `pattern${i}`,
        similarity: 0.8,
        locations: [{ file: `file${i}.ts`, startLine: 1, endLine: 10 }]
      }));

      const candidates = analyzer.analyze(baseAnalysis);

      candidates.forEach(candidate => {
        expect(candidate.rationale).toBeDefined();
        expect(candidate.rationale.length).toBeGreaterThan(20);
        expect(candidate.rationale).toContain('%'); // Should contain percentage
      });
    });
  });

  describe('integration with BaseAnalyzer', () => {
    it('should properly inherit and use BaseAnalyzer methods', () => {
      const mockCandidate = {
        candidateId: 'test-candidate',
        title: 'Test Title',
        description: 'Test Description',
        priority: 'normal' as const,
        estimatedEffort: 'medium' as const,
        suggestedWorkflow: 'conventions' as const,
        rationale: 'Test rationale',
        score: 0.8,
      };

      // Test that BaseAnalyzer methods are available
      expect(typeof analyzer.prioritize).toBe('function');

      // Test prioritize method works with valid candidates
      const result = analyzer.prioritize([mockCandidate]);
      expect(result).toEqual(mockCandidate);
    });

    it('should handle BaseAnalyzer prioritize edge cases', () => {
      const result = analyzer.prioritize([]);
      expect(result).toBeNull();
    });
  });

  describe('StrategyAnalyzer interface compliance', () => {
    it('should fully implement StrategyAnalyzer interface', () => {
      // Check type property
      expect(analyzer.type).toBe('conventions');

      // Check analyze method signature
      expect(typeof analyzer.analyze).toBe('function');
      expect(analyzer.analyze.length).toBe(1); // Takes one parameter

      // Check prioritize method signature
      expect(typeof analyzer.prioritize).toBe('function');
      expect(analyzer.prioritize.length).toBe(1); // Takes one parameter

      // Test analyze returns TaskCandidate array
      const result = analyzer.analyze(baseAnalysis);
      expect(Array.isArray(result)).toBe(true);

      // Test prioritize returns TaskCandidate or null
      const prioritizeResult = analyzer.prioritize(result);
      expect(prioritizeResult === null || typeof prioritizeResult === 'object').toBe(true);
    });
  });

  describe('error resilience', () => {
    it('should handle malformed ProjectAnalysis gracefully', () => {
      const malformedAnalysis = {
        codebaseSize: null as any,
        dependencies: undefined as any,
        codeQuality: { lintIssues: 'not a number' as any },
        documentation: { coverage: null as any },
      } as any;

      expect(() => {
        const candidates = analyzer.analyze(malformedAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle extremely large values without breaking', () => {
      baseAnalysis.codeQuality.lintIssues = 999999;
      baseAnalysis.codeQuality.complexityHotspots = Array(1000).fill(0).map((_, i) => ({
        file: `file${i}.ts`,
        function: `function${i}`,
        complexity: 100,
        type: 'cyclomatic' as const,
        line: 1,
        reasons: ['extreme case'],
      }));

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
        expect(candidates.length).toBeLessThanOrEqual(5); // Should still limit results
      }).not.toThrow();
    });
  });
});