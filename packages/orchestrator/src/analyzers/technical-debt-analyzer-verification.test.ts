/**
 * Technical Debt Analyzer Verification Test
 *
 * This test verifies the TechnicalDebtAnalyzer is properly implemented
 * and all acceptance criteria are met.
 */

import { describe, it, expect } from 'vitest';
import { TechnicalDebtAnalyzer } from './technical-debt-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('TechnicalDebtAnalyzer - Verification', () => {
  it('should instantiate correctly and have correct type', () => {
    const analyzer = new TechnicalDebtAnalyzer();

    expect(analyzer).toBeInstanceOf(TechnicalDebtAnalyzer);
    expect(analyzer.type).toBe('technical-debt');
    expect(analyzer.analyze).toBeDefined();
    expect(analyzer.createTechnicalDebtAnalysis).toBeDefined();
  });

  it('should handle empty analysis without throwing', () => {
    const analyzer = new TechnicalDebtAnalyzer();

    const emptyAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 0, lines: 0, languages: {} },
      testCoverage: null,
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 0,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 0,
          total: 0,
          coveragePercentage: 0
        }
      },
      performance: {
        bundleSize: 0,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: null,
        antiPatterns: [],
        untestedExports: []
      }
    };

    expect(() => analyzer.analyze(emptyAnalysis)).not.toThrow();
    expect(() => analyzer.createTechnicalDebtAnalysis(emptyAnalysis)).not.toThrow();

    const candidates = analyzer.analyze(emptyAnalysis);
    const analysis = analyzer.createTechnicalDebtAnalysis(emptyAnalysis);

    expect(Array.isArray(candidates)).toBe(true);
    expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
    expect(analysis.totalScore).toBeLessThanOrEqual(100);
  });

  it('should create valid analysis structure with all required fields', () => {
    const analyzer = new TechnicalDebtAnalyzer();

    const testAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { typescript: 5000 } },
      testCoverage: { percentage: 80, uncoveredFiles: [] },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 85,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 85,
          total: 100,
          coveragePercentage: 85
        }
      },
      performance: {
        bundleSize: 2048,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: { percentage: 75, uncoveredBranches: [] },
        antiPatterns: [],
        untestedExports: []
      }
    };

    const analysis = analyzer.createTechnicalDebtAnalysis(testAnalysis);

    // Verify all required fields are present
    expect(analysis).toHaveProperty('totalScore');
    expect(analysis).toHaveProperty('categories');
    expect(analysis).toHaveProperty('hotspots');
    expect(analysis).toHaveProperty('metrics');
    expect(analysis).toHaveProperty('trends');

    // Verify data types and constraints
    expect(typeof analysis.totalScore).toBe('number');
    expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
    expect(analysis.totalScore).toBeLessThanOrEqual(100);

    expect(Array.isArray(analysis.categories)).toBe(true);
    expect(Array.isArray(analysis.hotspots)).toBe(true);
    expect(typeof analysis.metrics).toBe('object');
    expect(typeof analysis.trends).toBe('object');
  });

  it('should generate task candidates with proper structure', () => {
    const analyzer = new TechnicalDebtAnalyzer();

    const testAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 100, lines: 10000, languages: { typescript: 10000 } },
      testCoverage: { percentage: 40, uncoveredFiles: ['test1.ts', 'test2.ts'] }, // Low coverage
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [{
          name: 'test-vuln',
          cveId: 'CVE-2023-12345',
          severity: 'high',
          affectedVersions: '<2.0.0',
          description: 'Test vulnerability'
        }],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 25,
        duplicatedCode: [],
        complexityHotspots: [{
          file: 'complex.ts',
          cyclomaticComplexity: 60, // High complexity
          cognitiveComplexity: 70,
          lineCount: 1000,
          functionName: 'complexFunction'
        }],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 50,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 50,
          total: 100,
          coveragePercentage: 50
        }
      },
      performance: {
        bundleSize: 4096,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: { percentage: 45, uncoveredBranches: [] },
        antiPatterns: [],
        untestedExports: []
      }
    };

    const candidates = analyzer.analyze(testAnalysis);

    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0); // Should detect multiple issues

    // Verify each candidate has the required structure
    candidates.forEach(candidate => {
      expect(candidate).toHaveProperty('candidateId');
      expect(candidate).toHaveProperty('title');
      expect(candidate).toHaveProperty('description');
      expect(candidate).toHaveProperty('priority');
      expect(candidate).toHaveProperty('estimatedEffort');
      expect(candidate).toHaveProperty('suggestedWorkflow');
      expect(candidate).toHaveProperty('rationale');
      expect(candidate).toHaveProperty('score');

      // Verify candidate ID format
      expect(candidate.candidateId).toMatch(/^technical-debt-/);

      // Verify priority is valid
      expect(['critical', 'high', 'normal', 'low']).toContain(candidate.priority);

      // Verify effort is valid
      expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);

      // Verify score is numeric and within reasonable bounds
      expect(typeof candidate.score).toBe('number');
      expect(candidate.score).toBeGreaterThan(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
    });
  });
});