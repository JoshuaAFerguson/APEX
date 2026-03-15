/**
 * Technical Debt Analyzer Schema Validation Test
 *
 * This test file validates that the TechnicalDebtAnalyzer produces output
 * that conforms to the TechnicalDebtAnalysis Zod schema defined in core/types.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis,
  TechnicalDebtAnalysis
} from '@apexcli/core';
import { TechnicalDebtAnalysisSchema } from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Schema Validation', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { typescript: 4000, javascript: 1000 }
      },
      testCoverage: {
        percentage: 85,
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
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 90,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 90,
          total: 100,
          coveragePercentage: 90
        }
      } as EnhancedDocumentationAnalysis,
      performance: {
        bundleSize: 2048,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 80,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('Schema compliance for clean codebase', () => {
    it('should produce valid TechnicalDebtAnalysis for clean codebase', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      // Validate against schema
      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);

      if (!validationResult.success) {
        console.error('Schema validation failed:', validationResult.error.errors);
      }

      expect(validationResult.success).toBe(true);
      expect(analysis).toMatchObject({
        totalScore: expect.any(Number),
        categories: expect.any(Array),
        hotspots: expect.any(Array),
        metrics: expect.objectContaining({
          codeComplexity: expect.any(Number),
          testCoverage: expect.any(Number),
          duplicatedLinesPercent: expect.any(Number),
          maintainabilityIndex: expect.any(Number)
        }),
        trends: expect.objectContaining({
          improving: expect.any(Boolean),
          changeRate: expect.any(Number),
          timeframe: expect.any(String)
        })
      });
    });

    it('should produce totalScore within valid range (0-100)', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
      expect(typeof analysis.totalScore).toBe('number');
      expect(isFinite(analysis.totalScore)).toBe(true);
    });

    it('should produce valid categories array', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(Array.isArray(analysis.categories)).toBe(true);

      analysis.categories.forEach(category => {
        expect(category).toMatchObject({
          category: expect.stringMatching(/^(code-smell|duplication|complexity|security-vulnerability|outdated-dependency|documentation|testability|maintainability|performance|dead-code)$/),
          count: expect.any(Number),
          severity: expect.stringMatching(/^(low|medium|high|critical)$/),
          examples: expect.arrayContaining([expect.any(String)]),
          estimatedEffort: expect.any(String)
        });

        expect(category.count).toBeGreaterThanOrEqual(0);
        expect(category.examples.length).toBeLessThanOrEqual(10); // Reasonable limit
      });
    });

    it('should produce valid hotspots array', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(Array.isArray(analysis.hotspots)).toBe(true);
      expect(analysis.hotspots.length).toBeLessThanOrEqual(10); // Should be limited to top 10

      analysis.hotspots.forEach(hotspot => {
        expect(hotspot).toMatchObject({
          path: expect.any(String),
          score: expect.any(Number),
          issues: expect.arrayContaining([expect.any(String)])
        });

        expect(hotspot.score).toBeGreaterThanOrEqual(0);
        expect(hotspot.score).toBeLessThanOrEqual(100);
        expect(hotspot.path.length).toBeGreaterThan(0);
        expect(hotspot.issues.length).toBeGreaterThan(0);

        if (hotspot.loc !== undefined) {
          expect(hotspot.loc).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should produce valid metrics object', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(analysis.metrics).toBeDefined();

      // codeComplexity should be non-negative number
      expect(typeof analysis.metrics!.codeComplexity).toBe('number');
      expect(analysis.metrics!.codeComplexity).toBeGreaterThanOrEqual(0);
      expect(isFinite(analysis.metrics!.codeComplexity)).toBe(true);

      // testCoverage should be percentage or undefined
      if (analysis.metrics!.testCoverage !== undefined) {
        expect(typeof analysis.metrics!.testCoverage).toBe('number');
        expect(analysis.metrics!.testCoverage).toBeGreaterThanOrEqual(0);
        expect(analysis.metrics!.testCoverage).toBeLessThanOrEqual(100);
      }

      // duplicatedLinesPercent should be percentage
      expect(typeof analysis.metrics!.duplicatedLinesPercent).toBe('number');
      expect(analysis.metrics!.duplicatedLinesPercent).toBeGreaterThanOrEqual(0);
      expect(analysis.metrics!.duplicatedLinesPercent).toBeLessThanOrEqual(100);

      // maintainabilityIndex should be 0-100
      expect(typeof analysis.metrics!.maintainabilityIndex).toBe('number');
      expect(analysis.metrics!.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(analysis.metrics!.maintainabilityIndex).toBeLessThanOrEqual(100);
    });

    it('should produce valid trends object', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(analysis.trends).toBeDefined();
      expect(typeof analysis.trends!.improving).toBe('boolean');
      expect(typeof analysis.trends!.changeRate).toBe('number');
      expect(isFinite(analysis.trends!.changeRate)).toBe(true);
      expect(analysis.trends!.timeframe).toBe('last 30 days');
    });
  });

  describe('Schema compliance for problematic codebase', () => {
    it('should produce valid TechnicalDebtAnalysis for codebase with all issue types', () => {
      const problematicAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 25,
          uncoveredFiles: ['uncovered1.ts', 'uncovered2.ts']
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Critical security vulnerability'
            },
            {
              name: 'high-vuln',
              cveId: 'CVE-2023-67890',
              severity: 'high' as const,
              affectedVersions: '<2.0.0',
              description: 'High severity vulnerability'
            }
          ],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '16.14.0',
              latestVersion: '18.2.0',
              updateType: 'major' as const
            },
            {
              name: 'lodash',
              currentVersion: '4.17.20',
              latestVersion: '4.17.21',
              updateType: 'patch' as const
            }
          ],
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'Maintenance mode',
              replacement: 'dayjs'
            }
          ]
        },
        codeQuality: {
          lintIssues: 150,
          duplicatedCode: [
            {
              pattern: 'validation logic',
              locations: ['user.ts', 'admin.ts', 'guest.ts'],
              similarity: 0.95
            },
            {
              pattern: 'error handling',
              locations: ['api.ts', 'service.ts'],
              similarity: 0.85
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 80,
              cognitiveComplexity: 100,
              lineCount: 1500,
              functionName: 'veryComplexFunction'
            },
            {
              file: 'another-complex.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 800,
              functionName: 'anotherComplexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'critical' as const,
              line: 1,
              description: 'Class with too many responsibilities',
              suggestion: 'Break into smaller classes'
            },
            {
              file: 'smelly.ts',
              type: 'long-method',
              severity: 'high' as const,
              line: 50,
              description: 'Method too long',
              suggestion: 'Extract methods'
            },
            {
              file: 'another-smelly.ts',
              type: 'duplicate-code',
              severity: 'medium' as const,
              line: 25,
              description: 'Duplicate validation logic',
              suggestion: 'Extract to utility'
            }
          ]
        },
        documentation: {
          coveragePercentage: 45,
          undocumentedExports: ['export1', 'export2'],
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch' as const,
              description: 'Documentation references outdated API version',
              line: 25,
              suggestion: 'Update API version references',
              severity: 'high' as const
            },
            {
              file: 'API.md',
              type: 'deprecated-api' as const,
              description: 'References deprecated authenticate() method',
              line: 105,
              suggestion: 'Replace with new login() method',
              severity: 'high' as const
            },
            {
              file: 'guide.md',
              type: 'stale-reference' as const,
              description: 'TODO: Update this section (added 6 months ago)',
              severity: 'medium' as const
            }
          ],
          missingReadmeSections: ['Installation', 'Contributing'],
          apiCompleteness: {
            totalEndpoints: 20,
            documentedEndpoints: 12,
            completenessPercentage: 60
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 8192,
          slowTests: ['slow-test-1', 'slow-test-2'],
          bottlenecks: [
            { file: 'slow.ts', line: 10, type: 'cpu', description: 'CPU intensive operation' },
            { file: 'memory-hog.ts', line: 25, type: 'memory', description: 'Memory leak' }
          ]
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 35,
            uncoveredBranches: [
              { file: 'auth.ts', line: 20, type: 'if' as const, description: 'Auth check' },
              { file: 'payment.ts', line: 15, type: 'catch' as const, description: 'Error handling' },
              { file: 'validation.ts', line: 30, type: 'else' as const, description: 'Fallback' }
            ]
          },
          antiPatterns: [
            { file: 'test.spec.ts', line: 50, type: 'long-test', description: 'Test too long' }
          ],
          untestedExports: [
            {
              name: 'criticalFunction',
              file: 'src/api/critical.ts',
              line: 10,
              isPublic: true,
              type: 'function',
              complexity: 'high'
            },
            {
              name: 'utilityHelper',
              file: 'src/utils/helpers.ts',
              line: 25,
              isPublic: true,
              type: 'function',
              complexity: 'medium'
            },
            {
              name: 'internalMethod',
              file: 'src/internal/private.ts',
              line: 15,
              isPublic: false,
              type: 'function',
              complexity: 'low'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(problematicAnalysis);

      // Validate against schema
      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);

      if (!validationResult.success) {
        console.error('Schema validation failed for problematic codebase:', validationResult.error.errors);
      }

      expect(validationResult.success).toBe(true);
    });

    it('should produce high total score for problematic codebase', () => {
      const problematicAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 15, uncoveredFiles: Array(20).fill('uncovered.ts') },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: Array(5).fill({
            name: 'vuln',
            cveId: 'CVE-2023-12345',
            severity: 'critical' as const,
            affectedVersions: '<1.0.0',
            description: 'Critical vulnerability'
          })
        },
        codeQuality: {
          lintIssues: 500,
          duplicatedCode: Array(20).fill({
            pattern: 'duplicate',
            locations: ['a.ts', 'b.ts', 'c.ts'],
            similarity: 0.9
          }),
          complexityHotspots: Array(10).fill({
            file: 'complex.ts',
            cyclomaticComplexity: 100,
            cognitiveComplexity: 150,
            lineCount: 2000,
            functionName: 'extremeFunction'
          }),
          codeSmells: Array(50).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Critical code smell',
            suggestion: 'Rewrite'
          })
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(problematicAnalysis);

      // Validate against schema
      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);
      expect(validationResult.success).toBe(true);

      expect(analysis.totalScore).toBeGreaterThan(70);
      expect(analysis.categories.length).toBeGreaterThan(0);
      expect(analysis.hotspots.length).toBeGreaterThan(0);
    });

    it('should produce multiple categories for multi-faceted problems', () => {
      const multiFacetedAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 40, uncoveredFiles: ['test.ts'] },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: Array(5).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'high' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          }),
          duplicatedCode: Array(3).fill({
            pattern: 'duplicate',
            locations: ['a.ts', 'b.ts'],
            similarity: 0.85
          }),
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 35,
              cognitiveComplexity: 42,
              lineCount: 500,
              functionName: 'complexFunction'
            }
          ]
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'security-issue',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<1.0.0',
              description: 'Security vulnerability'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(multiFacetedAnalysis);

      // Validate against schema
      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);
      expect(validationResult.success).toBe(true);

      // Should have multiple categories
      const categoryTypes = analysis.categories.map(c => c.category);
      expect(categoryTypes).toContain('testability');
      expect(categoryTypes).toContain('code-smell');
      expect(categoryTypes).toContain('duplication');
      expect(categoryTypes).toContain('complexity');
      expect(categoryTypes).toContain('security-vulnerability');
    });
  });

  describe('Edge cases schema compliance', () => {
    it('should produce valid schema for minimal data', () => {
      const minimalAnalysis = {
        codebaseSize: { files: 1, lines: 100, languages: { typescript: 100 } },
        testCoverage: { percentage: 100, uncoveredFiles: [] },
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
          coveragePercentage: 100,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 100,
            total: 100,
            coveragePercentage: 100
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 512,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: { percentage: 100, uncoveredBranches: [] },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(minimalAnalysis);

      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);
      expect(validationResult.success).toBe(true);

      expect(analysis.totalScore).toBeLessThan(10); // Should be very low
      expect(analysis.categories.length).toBeGreaterThanOrEqual(0);
      expect(analysis.hotspots.length).toBe(0); // No hotspots for clean code
    });

    it('should produce valid schema for null/undefined inputs', () => {
      const nullInputAnalysis = {
        codebaseSize: null,
        testCoverage: null,
        dependencies: null,
        codeQuality: null,
        documentation: null,
        performance: null,
        testAnalysis: null
      } as any;

      const analysis = analyzer.createTechnicalDebtAnalysis(nullInputAnalysis);

      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);
      expect(validationResult.success).toBe(true);

      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);
    });

    it('should validate all required fields are present', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      // Check all required fields according to schema
      expect(analysis).toHaveProperty('totalScore');
      expect(analysis).toHaveProperty('categories');
      expect(analysis).toHaveProperty('hotspots');
      expect(analysis).toHaveProperty('metrics');
      expect(analysis).toHaveProperty('trends');

      // Validate field types match schema expectations
      expect(typeof analysis.totalScore).toBe('number');
      expect(Array.isArray(analysis.categories)).toBe(true);
      expect(Array.isArray(analysis.hotspots)).toBe(true);
      expect(typeof analysis.metrics).toBe('object');
      expect(typeof analysis.trends).toBe('object');
    });

    it('should validate category enum values are correct', () => {
      const validCategories = [
        'code-smell',
        'duplication',
        'complexity',
        'security-vulnerability',
        'outdated-dependency',
        'documentation',
        'testability',
        'maintainability',
        'performance',
        'dead-code'
      ];

      const validSeverities = ['low', 'medium', 'high', 'critical'];

      const comprehensiveAnalysis = {
        ...baseAnalysis,
        testCoverage: { percentage: 30, uncoveredFiles: ['test.ts'] },
        codeQuality: {
          lintIssues: 50,
          duplicatedCode: Array(5).fill({
            pattern: 'duplicate',
            locations: ['a.ts', 'b.ts'],
            similarity: 0.9
          }),
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 60,
              cognitiveComplexity: 70,
              lineCount: 1000,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: Array(3).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Code smell',
            suggestion: 'Fix it'
          })
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'vuln',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<1.0.0',
              description: 'Vulnerability'
            }
          ],
          outdatedPackages: [
            {
              name: 'old-pkg',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major' as const
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      const validationResult = TechnicalDebtAnalysisSchema.safeParse(analysis);
      expect(validationResult.success).toBe(true);

      analysis.categories.forEach(category => {
        expect(validCategories).toContain(category.category);
        expect(validSeverities).toContain(category.severity);
      });
    });
  });
});