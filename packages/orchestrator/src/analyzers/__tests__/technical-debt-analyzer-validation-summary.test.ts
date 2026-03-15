/**
 * Technical Debt Analyzer Validation Summary Test
 *
 * This test file provides a comprehensive summary test that validates all
 * acceptance criteria and key functionality of the TechnicalDebtAnalyzer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import { TechnicalDebtAnalysisSchema } from '@apexcli/core';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TechnicalDebtAnalyzer - Final Validation', () => {
  let analyzer: TechnicalDebtAnalyzer;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();
  });

  it('should satisfy all acceptance criteria for typical enterprise codebase', () => {
    // Create a realistic enterprise codebase scenario
    const enterpriseAnalysis: ProjectAnalysis = {
      codebaseSize: {
        files: 500,
        lines: 50000,
        languages: {
          typescript: 30000,
          javascript: 15000,
          css: 3000,
          html: 2000
        }
      },
      testCoverage: {
        percentage: 68,
        uncoveredFiles: [
          'legacy/old-module.js',
          'utils/deprecated-helper.ts',
          'components/unused-component.tsx'
        ]
      },
      dependencies: {
        outdated: ['react', 'lodash', 'moment'],
        security: ['vulnerable-package'],
        outdatedPackages: [
          {
            name: 'react',
            currentVersion: '16.14.0',
            latestVersion: '18.2.0',
            updateType: 'major'
          },
          {
            name: 'lodash',
            currentVersion: '4.17.15',
            latestVersion: '4.17.21',
            updateType: 'patch'
          }
        ],
        securityIssues: [
          {
            name: 'vulnerable-package',
            cveId: 'CVE-2023-12345',
            severity: 'high',
            affectedVersions: '<2.0.0',
            description: 'Cross-site scripting vulnerability'
          }
        ],
        deprecatedPackages: [
          {
            name: 'moment',
            currentVersion: '2.29.4',
            reason: 'Project is in maintenance mode',
            replacement: 'dayjs'
          }
        ]
      },
      codeQuality: {
        lintIssues: 127,
        duplicatedCode: [
          {
            pattern: 'validation utility functions',
            locations: [
              'src/user/validation.ts',
              'src/admin/validation.ts',
              'src/guest/validation.ts',
              'src/api/validation.ts'
            ],
            similarity: 0.87
          },
          {
            pattern: 'error handling patterns',
            locations: [
              'src/services/api.ts',
              'src/services/auth.ts'
            ],
            similarity: 0.92
          }
        ],
        complexityHotspots: [
          {
            file: 'src/legacy/data-processor.js',
            cyclomaticComplexity: 78,
            cognitiveComplexity: 95,
            lineCount: 1200,
            functionName: 'processLegacyData'
          },
          {
            file: 'src/components/DataTable.tsx',
            cyclomaticComplexity: 42,
            cognitiveComplexity: 58,
            lineCount: 650,
            functionName: 'renderDataTable'
          },
          {
            file: 'src/utils/form-validator.ts',
            cyclomaticComplexity: 35,
            cognitiveComplexity: 41,
            lineCount: 480,
            functionName: 'validateFormData'
          }
        ],
        codeSmells: [
          {
            file: 'src/legacy/god-class.js',
            type: 'god-class',
            severity: 'critical',
            line: 1,
            description: 'Class with 45+ methods handling multiple responsibilities',
            suggestion: 'Break into smaller, focused classes'
          },
          {
            file: 'src/components/MegaComponent.tsx',
            type: 'long-method',
            severity: 'high',
            line: 156,
            description: 'Render method is 200+ lines long',
            suggestion: 'Extract smaller components'
          },
          {
            file: 'src/utils/helper.ts',
            type: 'duplicate-code',
            severity: 'medium',
            line: 89,
            description: 'Similar logic exists in multiple files',
            suggestion: 'Extract common utility function'
          }
        ]
      },
      documentation: {
        coveragePercentage: 45,
        undocumentedExports: [
          'exportedFunction',
          'HelperClass',
          'ConfigInterface'
        ],
        outdatedDocumentation: [
          'README.md',
          'API.md'
        ],
        missingReadmeSections: [
          'installation',
          'examples'
        ],
        apiCompleteness: {
          documented: 45,
          total: 100,
          coveragePercentage: 45
        }
      } as any,
      performance: {
        bundleSize: 5242880, // 5MB
        slowTests: [
          'integration/api.test.ts',
          'e2e/user-flow.test.ts'
        ],
        bottlenecks: [
          'src/heavy-computation.ts',
          'src/inefficient-query.ts'
        ]
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 62,
          uncoveredBranches: [
            'error-handling-branch',
            'edge-case-branch'
          ]
        },
        antiPatterns: [
          'test-without-assertions',
          'overly-complex-test'
        ],
        untestedExports: [
          'criticalFunction',
          'ImportantClass'
        ]
      }
    };

    // Run the analysis
    const debtAnalysis = analyzer.createTechnicalDebtAnalysis(enterpriseAnalysis);

    // ✅ ACCEPTANCE CRITERION 1: Total Score (0-100) based on weighted category severities
    expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
    expect(debtAnalysis.totalScore).toBeLessThanOrEqual(100);
    expect(typeof debtAnalysis.totalScore).toBe('number');

    // For this realistic enterprise scenario, expect moderate to high debt
    expect(debtAnalysis.totalScore).toBeGreaterThan(40);
    expect(debtAnalysis.totalScore).toBeLessThan(90);

    // ✅ ACCEPTANCE CRITERION 2: Populated metrics object
    expect(debtAnalysis.metrics).toBeDefined();
    expect(debtAnalysis.metrics).toHaveProperty('codeComplexity');
    expect(debtAnalysis.metrics).toHaveProperty('testCoverage');
    expect(debtAnalysis.metrics).toHaveProperty('duplicatedLinesPercent');
    expect(debtAnalysis.metrics).toHaveProperty('maintainabilityIndex');

    // Validate specific metric values for this scenario
    expect(debtAnalysis.metrics?.testCoverage).toBe(68);
    expect(debtAnalysis.metrics?.codeComplexity).toBe((78 + 42 + 35) / 3); // Average complexity
    expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBeGreaterThan(0);
    expect(debtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);
    expect(debtAnalysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);

    // ✅ ACCEPTANCE CRITERION 3: Valid TechnicalDebtAnalysis schema
    expect(() => TechnicalDebtAnalysisSchema.parse(debtAnalysis)).not.toThrow();

    const validatedAnalysis = TechnicalDebtAnalysisSchema.parse(debtAnalysis);
    expect(validatedAnalysis).toEqual(debtAnalysis);

    // Additional validations for enterprise scenario
    expect(debtAnalysis.categories.length).toBeGreaterThan(4); // Multiple debt categories
    expect(debtAnalysis.hotspots.length).toBeGreaterThan(0); // Should identify hotspots
    expect(debtAnalysis.trends).toBeDefined();

    // Validate category structure
    debtAnalysis.categories.forEach(category => {
      expect(category.count).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(category.severity);
      expect(Array.isArray(category.examples)).toBe(true);
      if (category.estimatedEffort) {
        expect(typeof category.estimatedEffort).toBe('string');
      }
    });

    // Validate hotspots structure
    debtAnalysis.hotspots.forEach(hotspot => {
      expect(typeof hotspot.path).toBe('string');
      expect(hotspot.score).toBeGreaterThanOrEqual(0);
      expect(hotspot.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(hotspot.issues)).toBe(true);
      expect(hotspot.issues.length).toBeGreaterThan(0);
    });

    // Validate trends
    expect(typeof debtAnalysis.trends?.improving).toBe('boolean');
    expect(typeof debtAnalysis.trends?.changeRate).toBe('number');
    expect(typeof debtAnalysis.trends?.timeframe).toBe('string');
  });

  it('should handle minimal codebase correctly', () => {
    const minimalAnalysis: ProjectAnalysis = {
      codebaseSize: {
        files: 5,
        lines: 200,
        languages: { typescript: 200 }
      },
      testCoverage: {
        percentage: 90,
        uncoveredFiles: []
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 2,
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
      } as any,
      performance: {
        bundleSize: 512,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 88,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };

    const debtAnalysis = analyzer.createTechnicalDebtAnalysis(minimalAnalysis);

    // Should have very low debt score for clean, minimal codebase
    expect(debtAnalysis.totalScore).toBeLessThan(15);

    // Should still validate against schema
    expect(() => TechnicalDebtAnalysisSchema.parse(debtAnalysis)).not.toThrow();

    // Should have valid metrics
    expect(debtAnalysis.metrics?.testCoverage).toBe(90);
    expect(debtAnalysis.metrics?.codeComplexity).toBe(0); // No hotspots
    expect(debtAnalysis.metrics?.duplicatedLinesPercent).toBe(0); // No duplication
  });

  it('should demonstrate weighted scoring behavior', () => {
    // Test with high-weight security issues
    const securityFocusedAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: { typescript: 1000 } },
      testCoverage: { percentage: 80, uncoveredFiles: [] },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [
          {
            name: 'critical-vuln',
            cveId: 'CVE-2023-99999',
            severity: 'critical',
            affectedVersions: '<1.0.0',
            description: 'Critical security vulnerability'
          }
        ],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: null as any,
      performance: null as any,
      testAnalysis: null as any
    };

    // Test with only complexity issues (lower weight)
    const complexityFocusedAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: { typescript: 1000 } },
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
        complexityHotspots: [
          {
            file: 'complex.ts',
            cyclomaticComplexity: 80, // Critical complexity
            cognitiveComplexity: 95,
            lineCount: 1000,
            functionName: 'complexFunction'
          }
        ],
        codeSmells: []
      },
      documentation: null as any,
      performance: null as any,
      testAnalysis: null as any
    };

    const securityScore = analyzer.createTechnicalDebtAnalysis(securityFocusedAnalysis).totalScore;
    const complexityScore = analyzer.createTechnicalDebtAnalysis(complexityFocusedAnalysis).totalScore;

    // Security issues should have higher impact due to higher weight (0.25 vs 0.15)
    expect(securityScore).toBeGreaterThan(complexityScore);
  });

  it('should maintain consistency across multiple invocations', () => {
    const testAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 20, lines: 2000, languages: { typescript: 2000 } },
      testCoverage: { percentage: 75, uncoveredFiles: ['test.ts'] },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 15,
        duplicatedCode: [
          {
            pattern: 'utility pattern',
            locations: ['util1.ts', 'util2.ts'],
            similarity: 0.85
          }
        ],
        complexityHotspots: [
          {
            file: 'moderate.ts',
            cyclomaticComplexity: 25,
            cognitiveComplexity: 30,
            lineCount: 400,
            functionName: 'moderateFunction'
          }
        ],
        codeSmells: []
      },
      documentation: null as any,
      performance: null as any,
      testAnalysis: null as any
    };

    // Run analysis multiple times
    const results = Array.from({ length: 5 }, () =>
      analyzer.createTechnicalDebtAnalysis(testAnalysis)
    );

    // All results should be identical
    const firstResult = results[0];
    results.forEach((result, index) => {
      expect(result.totalScore).toBe(firstResult.totalScore);
      expect(result.categories).toEqual(firstResult.categories);
      expect(result.hotspots).toEqual(firstResult.hotspots);
      expect(result.metrics).toEqual(firstResult.metrics);
      expect(result.trends).toEqual(firstResult.trends);
    });
  });

  it('should pass comprehensive edge case validation', () => {
    const edgeCases = [
      // Null analysis
      {
        codebaseSize: null,
        testCoverage: null,
        dependencies: null,
        codeQuality: null,
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any,
      // Empty analysis
      {
        codebaseSize: { files: 0, lines: 0, languages: {} },
        testCoverage: { percentage: 0, uncoveredFiles: [] },
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
        documentation: null as any,
        performance: null as any,
        testAnalysis: null as any
      }
    ];

    edgeCases.forEach((testCase, index) => {
      expect(() => {
        const result = analyzer.createTechnicalDebtAnalysis(testCase);
        TechnicalDebtAnalysisSchema.parse(result);
      }).not.toThrow(`Edge case ${index + 1} should not throw`);
    });
  });
});