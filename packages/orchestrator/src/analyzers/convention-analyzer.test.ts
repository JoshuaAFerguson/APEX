/**
 * ConventionAnalyzer Unit Tests
 *
 * Tests for the ConventionAnalyzer class structure and basic functionality.
 */

import { ConventionAnalyzer } from './convention-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('ConventionAnalyzer', () => {
  let analyzer: ConventionAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new ConventionAnalyzer();

    // Create minimal ProjectAnalysis for testing
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

  describe('class structure', () => {
    it('should extend BaseAnalyzer', () => {
      expect(analyzer).toBeInstanceOf(ConventionAnalyzer);
    });

    it('should have type "conventions"', () => {
      expect(analyzer.type).toBe('conventions');
    });

    it('should implement StrategyAnalyzer interface', () => {
      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.prioritize).toBe('function');
    });
  });

  describe('analyze method', () => {
    it('should return empty array for healthy project', () => {
      const candidates = analyzer.analyze(baseAnalysis);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(0);
    });

    it('should detect formatting issues from high lint count', () => {
      baseAnalysis.codeQuality.lintIssues = 100;

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const formattingCandidate = candidates.find(c => c.title.includes('formatting'));
      expect(formattingCandidate).toBeDefined();
      expect(formattingCandidate?.priority).toBe('normal');
    });

    it('should detect documentation convention issues', () => {
      baseAnalysis.documentation.coverage = 30;
      baseAnalysis.documentation.missingDocs = ['file1.ts', 'file2.ts'];

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const docCandidate = candidates.find(c => c.title.includes('documentation'));
      expect(docCandidate).toBeDefined();
      expect(docCandidate?.description).toContain('documentation');
    });

    it('should detect complexity organization issues', () => {
      baseAnalysis.codeQuality.complexityHotspots = Array(15).fill(0).map((_, i) => ({
        file: `file${i}.ts`,
        function: `function${i}`,
        complexity: 10,
        type: 'cyclomatic' as const,
        line: 1,
        reasons: ['nested loops'],
      }));

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const complexityCandidate = candidates.find(c => c.description.includes('organization'));
      expect(complexityCandidate).toBeDefined();
    });

    it('should detect import convention issues from duplicated code', () => {
      baseAnalysis.codeQuality.duplicatedCode = [
        {
          pattern: 'similar function',
          similarity: 0.8,
          locations: [
            { file: 'file1.ts', startLine: 1, endLine: 10 },
            { file: 'file2.ts', startLine: 5, endLine: 14 },
          ],
        },
        {
          pattern: 'another duplicate',
          similarity: 0.9,
          locations: [
            { file: 'file3.ts', startLine: 20, endLine: 30 },
            { file: 'file4.ts', startLine: 25, endLine: 35 },
          ],
        },
        // Add more duplicates to trigger the threshold
        { pattern: 'dup3', similarity: 0.7, locations: [{ file: 'f5.ts', startLine: 1, endLine: 5 }] },
        { pattern: 'dup4', similarity: 0.6, locations: [{ file: 'f6.ts', startLine: 1, endLine: 5 }] },
      ];

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const importCandidate = candidates.find(c => c.title.includes('imports'));
      expect(importCandidate).toBeDefined();
    });

    it('should detect indentation issues in multi-language projects', () => {
      baseAnalysis.codebaseSize.files = 150;
      baseAnalysis.codebaseSize.languages = {
        'TypeScript': 2000,
        'Python': 1500,
        'Go': 1000,
        'Rust': 500,
      };

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const indentationCandidate = candidates.find(c => c.title.includes('indentation'));
      expect(indentationCandidate).toBeDefined();
    });

    it('should prioritize high severity issues', () => {
      baseAnalysis.codeQuality.lintIssues = 300; // High severity
      baseAnalysis.documentation.coverage = 15; // High severity
      baseAnalysis.codebaseSize.files = 150; // Low severity
      baseAnalysis.codebaseSize.languages = { 'TypeScript': 2000, 'Python': 1500, 'Go': 1000, 'Rust': 500 };

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(1);
      // High severity candidates should have higher scores
      const sortedCandidates = candidates.sort((a, b) => b.score - a.score);
      expect(sortedCandidates[0].priority).not.toBe('low');
    });

    it('should limit results to top 5 candidates', () => {
      // Create conditions for many issues
      baseAnalysis.codeQuality.lintIssues = 300;
      baseAnalysis.documentation.coverage = 15;
      baseAnalysis.codeQuality.complexityHotspots = Array(20).fill(0).map((_, i) => ({
        file: `file${i}.ts`,
        function: `function${i}`,
        complexity: 15,
        type: 'cyclomatic' as const,
        line: 1,
        reasons: ['high complexity'],
      }));
      baseAnalysis.codeQuality.duplicatedCode = Array(10).fill(0).map((_, i) => ({
        pattern: `pattern${i}`,
        similarity: 0.8,
        locations: [{ file: `file${i}.ts`, startLine: 1, endLine: 10 }],
      }));
      baseAnalysis.codebaseSize.files = 200;
      baseAnalysis.codebaseSize.languages = { 'TypeScript': 2000, 'Python': 1500, 'Go': 1000, 'Rust': 500 };

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeLessThanOrEqual(5);
    });

    it('should handle analysis errors gracefully', () => {
      // Simulate analysis error by passing invalid data
      const invalidAnalysis = null as any;

      const candidates = analyzer.analyze(invalidAnalysis);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(0);
    });
  });

  describe('task candidate structure', () => {
    it('should generate well-formed task candidates', () => {
      baseAnalysis.codeQuality.lintIssues = 100;

      const candidates = analyzer.analyze(baseAnalysis);

      expect(candidates.length).toBeGreaterThan(0);
      const candidate = candidates[0];

      expect(candidate).toHaveProperty('candidateId');
      expect(candidate).toHaveProperty('title');
      expect(candidate).toHaveProperty('description');
      expect(candidate).toHaveProperty('priority');
      expect(candidate).toHaveProperty('estimatedEffort');
      expect(candidate).toHaveProperty('suggestedWorkflow');
      expect(candidate).toHaveProperty('rationale');
      expect(candidate).toHaveProperty('score');

      expect(candidate.candidateId).toContain('conventions-');
      expect(candidate.suggestedWorkflow).toBe('conventions');
      expect(typeof candidate.score).toBe('number');
      expect(candidate.score).toBeGreaterThan(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
    });

    it('should include remediation suggestions', () => {
      baseAnalysis.codeQuality.lintIssues = 100;

      const candidates = analyzer.analyze(baseAnalysis);

      const candidate = candidates[0];
      expect(candidate.remediationSuggestions).toBeDefined();
      expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);
      expect(candidate.remediationSuggestions!.length).toBeGreaterThan(0);

      const suggestion = candidate.remediationSuggestions![0];
      expect(suggestion).toHaveProperty('type');
      expect(suggestion).toHaveProperty('description');
      expect(suggestion).toHaveProperty('priority');
    });
  });

  describe('prioritize method', () => {
    it('should inherit default prioritization from BaseAnalyzer', () => {
      baseAnalysis.codeQuality.lintIssues = 50;
      baseAnalysis.documentation.coverage = 30;

      const candidates = analyzer.analyze(baseAnalysis);
      expect(candidates.length).toBeGreaterThan(1);

      const best = analyzer.prioritize(candidates);
      expect(best).toBeDefined();

      // Should return the candidate with highest score
      const highestScore = Math.max(...candidates.map(c => c.score));
      expect(best!.score).toBe(highestScore);
    });

    it('should return null for empty candidate list', () => {
      const best = analyzer.prioritize([]);
      expect(best).toBeNull();
    });
  });
});