/**
 * Technical Debt Analyzer Unit Tests
 *
 * Core unit tests for TechnicalDebtAnalyzer focusing on:
 * - Basic functionality and initialization
 * - Individual detection type analysis
 * - Priority and score calculations
 * - Remediation suggestion generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from './technical-debt-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis
} from '@apexcli/core';
import type {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage
} from '../idle-processor';

describe('TechnicalDebtAnalyzer', () => {
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

  describe('Constructor and basic functionality', () => {
    it('should initialize with correct type', () => {
      expect(analyzer.type).toBe('technical-debt');
    });

    it('should extend BaseAnalyzer', () => {
      expect(analyzer.analyze).toBeDefined();
      expect(analyzer.prioritize).toBeDefined();
      expect(analyzer.createCandidate).toBeDefined();
    });

    it('should have createTechnicalDebtAnalysis method', () => {
      expect(analyzer.createTechnicalDebtAnalysis).toBeDefined();
      expect(typeof analyzer.createTechnicalDebtAnalysis).toBe('function');
    });
  });

  describe('analyze() method', () => {
    it('should return empty array for clean codebase', () => {
      const candidates = analyzer.analyze(baseAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(0);
    });

    it('should return candidates with consistent structure', () => {
      const analysisWithIssues = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 50,
          uncoveredFiles: ['test1.ts', 'test2.ts']
        }
      };

      const candidates = analyzer.analyze(analysisWithIssues);
      expect(candidates.length).toBeGreaterThan(0);

      candidates.forEach(candidate => {
        expect(candidate).toHaveProperty('candidateId');
        expect(candidate).toHaveProperty('title');
        expect(candidate).toHaveProperty('description');
        expect(candidate).toHaveProperty('priority');
        expect(candidate).toHaveProperty('estimatedEffort');
        expect(candidate).toHaveProperty('suggestedWorkflow');
        expect(candidate).toHaveProperty('rationale');
        expect(candidate).toHaveProperty('score');
        expect(candidate.candidateId).toMatch(/^technical-debt-/);
      });
    });

    it('should handle null/undefined analysis properties gracefully', () => {
      const incompleteAnalysis = {
        ...baseAnalysis,
        testCoverage: null,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: undefined,
          securityIssues: undefined
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: undefined as any,
          complexityHotspots: undefined as any,
          codeSmells: undefined as any
        }
      };

      expect(() => analyzer.analyze(incompleteAnalysis)).not.toThrow();
      const candidates = analyzer.analyze(incompleteAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  describe('Complexity hotspot detection', () => {
    it('should detect critical complexity hotspots', () => {
      const analysisWithCriticalComplexity = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 75,
              cognitiveComplexity: 85,
              lineCount: 1000,
              functionName: 'superComplexFunction'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithCriticalComplexity);
      const complexityCandidate = candidates.find(c => c.candidateId === 'technical-debt-critical-complexity');

      expect(complexityCandidate).toBeDefined();
      expect(complexityCandidate?.priority).toBe('critical');
      expect(complexityCandidate?.suggestedWorkflow).toBe('refactoring');
      expect(complexityCandidate?.remediationSuggestions).toBeDefined();
      expect(complexityCandidate?.remediationSuggestions?.length).toBeGreaterThan(0);
    });

    it('should detect high complexity hotspots', () => {
      const analysisWithHighComplexity = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'moderately-complex.ts',
              cyclomaticComplexity: 35,
              cognitiveComplexity: 40,
              lineCount: 500,
              functionName: 'complexFunction'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithHighComplexity);
      const complexityCandidate = candidates.find(c => c.candidateId === 'technical-debt-high-complexity');

      expect(complexityCandidate).toBeDefined();
      expect(complexityCandidate?.priority).toBe('normal');
      expect(complexityCandidate?.suggestedWorkflow).toBe('refactoring');
    });

    it('should not generate candidates for low complexity', () => {
      const analysisWithLowComplexity = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'simple.ts',
              cyclomaticComplexity: 5,
              cognitiveComplexity: 8,
              lineCount: 100,
              functionName: 'simpleFunction'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithLowComplexity);
      const complexityCandidates = candidates.filter(c => c.candidateId.includes('complexity'));

      expect(complexityCandidates.length).toBe(0);
    });
  });

  describe('Code smell detection', () => {
    it('should detect critical code smells', () => {
      const analysisWithCriticalSmells = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'critical' as const,
              line: 1,
              description: 'Class with too many responsibilities',
              suggestion: 'Break into smaller classes'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithCriticalSmells);
      const smellCandidate = candidates.find(c => c.candidateId === 'technical-debt-critical-code-smells');

      expect(smellCandidate).toBeDefined();
      expect(smellCandidate?.priority).toBe('critical');
      expect(smellCandidate?.suggestedWorkflow).toBe('refactoring');
    });

    it('should not generate candidates for non-critical smells only', () => {
      const analysisWithMildSmells = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'mildly-smelly.ts',
              type: 'naming',
              severity: 'low' as const,
              line: 10,
              description: 'Poor variable naming',
              suggestion: 'Use descriptive names'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMildSmells);
      const smellCandidates = candidates.filter(c => c.candidateId.includes('code-smells'));

      expect(smellCandidates.length).toBe(0);
    });
  });

  describe('Code duplication detection', () => {
    it('should detect code duplication', () => {
      const analysisWithDuplication = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: [
            {
              pattern: 'exact-match validation logic',
              locations: ['user.ts', 'admin.ts', 'guest.ts'],
              similarity: 0.95
            },
            {
              pattern: 'similar error handling',
              locations: ['api.ts', 'service.ts'],
              similarity: 0.85
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithDuplication);
      const duplicationCandidate = candidates.find(c => c.candidateId === 'technical-debt-code-duplication');

      expect(duplicationCandidate).toBeDefined();
      expect(duplicationCandidate?.priority).toBe('normal');
      expect(duplicationCandidate?.suggestedWorkflow).toBe('refactoring');
      expect(duplicationCandidate?.description).toContain('2 duplicate code patterns');
    });

    it('should assign higher priority for many duplicates', () => {
      const analysisWithManyDuplicates = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          duplicatedCode: Array(15).fill({
            pattern: 'duplicate pattern',
            locations: ['file1.ts', 'file2.ts'],
            similarity: 0.9
          })
        }
      };

      const candidates = analyzer.analyze(analysisWithManyDuplicates);
      const duplicationCandidate = candidates.find(c => c.candidateId === 'technical-debt-code-duplication');

      expect(duplicationCandidate).toBeDefined();
      expect(duplicationCandidate?.priority).toBe('high');
    });
  });

  describe('Test coverage detection', () => {
    it('should detect low test coverage', () => {
      const analysisWithLowCoverage = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 45,
          uncoveredFiles: ['uncovered1.ts', 'uncovered2.ts', 'uncovered3.ts']
        }
      };

      const candidates = analyzer.analyze(analysisWithLowCoverage);
      const coverageCandidate = candidates.find(c => c.candidateId === 'technical-debt-test-coverage');

      expect(coverageCandidate).toBeDefined();
      expect(coverageCandidate?.priority).toBe('high');
      expect(coverageCandidate?.suggestedWorkflow).toBe('testing');
      expect(coverageCandidate?.description).toContain('45%');
      expect(coverageCandidate?.description).toContain('3 files');
    });

    it('should assign normal priority for moderate coverage', () => {
      const analysisWithModerateCoverage = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 65,
          uncoveredFiles: ['uncovered.ts']
        }
      };

      const candidates = analyzer.analyze(analysisWithModerateCoverage);
      const coverageCandidate = candidates.find(c => c.candidateId === 'technical-debt-test-coverage');

      expect(coverageCandidate).toBeDefined();
      expect(coverageCandidate?.priority).toBe('normal');
    });

    it('should not generate candidates for good coverage', () => {
      const analysisWithGoodCoverage = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 85,
          uncoveredFiles: []
        }
      };

      const candidates = analyzer.analyze(analysisWithGoodCoverage);
      const coverageCandidates = candidates.filter(c => c.candidateId.includes('test-coverage'));

      expect(coverageCandidates.length).toBe(0);
    });
  });

  describe('Security vulnerability detection', () => {
    it('should detect security vulnerabilities', () => {
      const analysisWithSecurity = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'vulnerable-package',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<2.0.0',
              description: 'Remote code execution vulnerability'
            },
            {
              name: 'another-vuln',
              cveId: 'CVE-2023-67890',
              severity: 'critical' as const,
              affectedVersions: '<1.5.0',
              description: 'Authentication bypass'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithSecurity);
      const securityCandidate = candidates.find(c => c.candidateId === 'technical-debt-security-vulnerabilities');

      expect(securityCandidate).toBeDefined();
      expect(securityCandidate?.priority).toBe('critical'); // Has critical vulnerabilities
      expect(securityCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(securityCandidate?.description).toContain('2 security vulnerabilities');
      expect(securityCandidate?.description).toContain('1 critical');
    });

    it('should assign high priority for non-critical vulnerabilities', () => {
      const analysisWithHighSecurity = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'vulnerable-package',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<2.0.0',
              description: 'Security issue'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithHighSecurity);
      const securityCandidate = candidates.find(c => c.candidateId === 'technical-debt-security-vulnerabilities');

      expect(securityCandidate).toBeDefined();
      expect(securityCandidate?.priority).toBe('high');
    });
  });

  describe('Deprecated package detection', () => {
    it('should detect deprecated packages', () => {
      const analysisWithDeprecated = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'Project is in maintenance mode',
              replacement: 'dayjs'
            },
            {
              name: 'request',
              currentVersion: '2.88.2',
              reason: 'Deprecated',
              replacement: 'axios'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      expect(deprecatedCandidate?.priority).toBe('normal');
      expect(deprecatedCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(deprecatedCandidate?.description).toContain('2 deprecated packages');
      expect(deprecatedCandidate?.remediationSuggestions?.length).toBe(2);
    });

    it('should assign higher priority for many deprecated packages', () => {
      const analysisWithManyDeprecated = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          deprecatedPackages: Array(8).fill({
            name: 'deprecated-package',
            currentVersion: '1.0.0',
            reason: 'Deprecated',
            replacement: 'new-package'
          })
        }
      };

      const candidates = analyzer.analyze(analysisWithManyDeprecated);
      const deprecatedCandidate = candidates.find(c => c.candidateId === 'technical-debt-deprecated-dependencies');

      expect(deprecatedCandidate).toBeDefined();
      expect(deprecatedCandidate?.priority).toBe('high');
    });
  });

  describe('Outdated dependency detection', () => {
    it('should detect major version updates', () => {
      const analysisWithMajorUpdates = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '16.14.0',
              latestVersion: '18.2.0',
              updateType: 'major' as const
            },
            {
              name: 'typescript',
              currentVersion: '4.9.5',
              latestVersion: '5.3.0',
              updateType: 'major' as const
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMajorUpdates);
      const majorCandidate = candidates.find(c => c.candidateId === 'technical-debt-major-version-updates');

      expect(majorCandidate).toBeDefined();
      expect(majorCandidate?.priority).toBe('normal');
      expect(majorCandidate?.estimatedEffort).toBe('high');
      expect(majorCandidate?.description).toContain('2 dependencies with major version updates');
    });

    it('should detect minor version updates', () => {
      const analysisWithMinorUpdates = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          outdatedPackages: [
            {
              name: 'lodash',
              currentVersion: '4.17.20',
              latestVersion: '4.17.21',
              updateType: 'patch' as const
            },
            {
              name: 'axios',
              currentVersion: '1.4.0',
              latestVersion: '1.6.0',
              updateType: 'minor' as const
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMinorUpdates);
      const minorCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-dependencies');

      expect(minorCandidate).toBeDefined();
      expect(minorCandidate?.priority).toBe('low');
      expect(minorCandidate?.estimatedEffort).toBe('low');
      expect(minorCandidate?.description).toContain('2 dependencies with minor/patch updates');
    });
  });

  describe('Lint issues detection', () => {
    it('should detect many lint issues', () => {
      const analysisWithManyLintIssues = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 50
        }
      };

      const candidates = analyzer.analyze(analysisWithManyLintIssues);
      const lintCandidate = candidates.find(c => c.candidateId === 'technical-debt-todo-comments');

      expect(lintCandidate).toBeDefined();
      expect(lintCandidate?.priority).toBe('low');
      expect(lintCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(lintCandidate?.description).toContain('50 lint issues');
    });

    it('should not generate candidates for few lint issues', () => {
      const analysisWithFewLintIssues = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 5
        }
      };

      const candidates = analyzer.analyze(analysisWithFewLintIssues);
      const lintCandidates = candidates.filter(c => c.candidateId.includes('todo-comments'));

      expect(lintCandidates.length).toBe(0);
    });
  });

  describe('createTechnicalDebtAnalysis() method', () => {
    it('should create valid analysis structure', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);

      expect(analysis).toHaveProperty('totalScore');
      expect(analysis).toHaveProperty('categories');
      expect(analysis).toHaveProperty('hotspots');
      expect(analysis).toHaveProperty('metrics');
      expect(analysis).toHaveProperty('trends');

      expect(typeof analysis.totalScore).toBe('number');
      expect(analysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(analysis.totalScore).toBeLessThanOrEqual(100);

      expect(Array.isArray(analysis.categories)).toBe(true);
      expect(Array.isArray(analysis.hotspots)).toBe(true);
    });

    it('should calculate appropriate total score for clean codebase', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      expect(analysis.totalScore).toBeLessThan(20); // Should be very low for clean codebase
    });

    it('should calculate high score for problematic codebase', () => {
      const problematicAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 20,
          uncoveredFiles: ['file1.ts', 'file2.ts']
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<2.0.0',
              description: 'Critical vulnerability'
            }
          ]
        },
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: Array(10).fill({
            pattern: 'duplicate',
            locations: ['a.ts', 'b.ts'],
            similarity: 0.9
          }),
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 80,
              cognitiveComplexity: 90,
              lineCount: 1500,
              functionName: 'veryComplexFunction'
            }
          ],
          codeSmells: Array(20).fill({
            file: 'smelly.ts',
            type: 'god-class',
            severity: 'critical' as const,
            line: 1,
            description: 'Critical smell',
            suggestion: 'Refactor'
          })
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(problematicAnalysis);
      expect(analysis.totalScore).toBeGreaterThan(70);
    });

    it('should build appropriate categories', () => {
      const analysisWithIssues = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'high' as const,
              line: 1,
              description: 'Too many responsibilities',
              suggestion: 'Break apart'
            }
          ],
          duplicatedCode: [
            {
              pattern: 'validation logic',
              locations: ['user.ts', 'admin.ts'],
              similarity: 0.95
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithIssues);
      expect(analysis.categories.length).toBeGreaterThan(0);

      const smellCategory = analysis.categories.find(c => c.category === 'code-smell');
      expect(smellCategory).toBeDefined();
      expect(smellCategory?.count).toBe(1);
      expect(smellCategory?.severity).toBe('high');

      const duplicateCategory = analysis.categories.find(c => c.category === 'duplication');
      expect(duplicateCategory).toBeDefined();
      expect(duplicateCategory?.count).toBe(1);
    });

    it('should build hotspots from complexity and smells', () => {
      const analysisWithHotspots = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 800,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'critical' as const,
              line: 1,
              description: 'Too many responsibilities',
              suggestion: 'Break apart'
            },
            {
              file: 'smelly.ts',
              type: 'long-method',
              severity: 'high' as const,
              line: 50,
              description: 'Method too long',
              suggestion: 'Extract methods'
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithHotspots);
      expect(analysis.hotspots.length).toBeGreaterThan(0);

      const complexityHotspot = analysis.hotspots.find(h => h.path === 'complex.ts');
      expect(complexityHotspot).toBeDefined();
      expect(complexityHotspot?.score).toBeGreaterThan(0);
      expect(complexityHotspot?.issues.length).toBeGreaterThan(0);

      const smellHotspot = analysis.hotspots.find(h => h.path === 'smelly.ts');
      expect(smellHotspot).toBeDefined();
      expect(smellHotspot?.issues.length).toBe(2); // Two smells in same file
    });

    it('should calculate metrics correctly', () => {
      const analysisWithMetrics = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 65,
          uncoveredFiles: []
        },
        codeQuality: {
          ...baseAnalysis.codeQuality,
          complexityHotspots: [
            {
              file: 'complex1.ts',
              cyclomaticComplexity: 30,
              cognitiveComplexity: 35,
              lineCount: 400,
              functionName: 'function1'
            },
            {
              file: 'complex2.ts',
              cyclomaticComplexity: 40,
              cognitiveComplexity: 45,
              lineCount: 600,
              functionName: 'function2'
            }
          ],
          duplicatedCode: [
            {
              pattern: 'duplicate pattern',
              locations: ['a.ts', 'b.ts'],
              similarity: 0.9
            }
          ]
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithMetrics);
      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics?.testCoverage).toBe(65);
      expect(analysis.metrics?.codeComplexity).toBe(35); // Average of 30 and 40
      expect(analysis.metrics?.duplicatedLinesPercent).toBeGreaterThan(0);
      expect(analysis.metrics?.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(analysis.metrics?.maintainabilityIndex).toBeLessThanOrEqual(100);
    });

    it('should generate trends', () => {
      const analysis = analyzer.createTechnicalDebtAnalysis(baseAnalysis);
      expect(analysis.trends).toBeDefined();
      expect(typeof analysis.trends?.improving).toBe('boolean');
      expect(typeof analysis.trends?.changeRate).toBe('number');
      expect(analysis.trends?.timeframe).toBe('last 30 days');
    });
  });

  describe('Remediation suggestions', () => {
    it('should provide appropriate remediation suggestions for each debt type', () => {
      const comprehensiveAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 50,
          uncoveredFiles: ['uncovered.ts']
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'vulnerable-package',
              cveId: 'CVE-2023-12345',
              severity: 'high' as const,
              affectedVersions: '<2.0.0',
              description: 'Security vulnerability'
            }
          ],
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.4',
              reason: 'Maintenance mode',
              replacement: 'dayjs'
            }
          ],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '17.0.0',
              latestVersion: '18.2.0',
              updateType: 'major' as const
            }
          ]
        },
        codeQuality: {
          lintIssues: 30,
          duplicatedCode: [
            {
              pattern: 'validation logic',
              locations: ['user.ts', 'admin.ts'],
              similarity: 0.9
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 60,
              cognitiveComplexity: 70,
              lineCount: 1000,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smelly.ts',
              type: 'god-class',
              severity: 'critical' as const,
              line: 1,
              description: 'Too many responsibilities',
              suggestion: 'Break into smaller classes'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(comprehensiveAnalysis);

      // Every candidate should have remediation suggestions
      candidates.forEach(candidate => {
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);
        expect(candidate.remediationSuggestions!.length).toBeGreaterThan(0);

        // Check structure of remediation suggestions
        candidate.remediationSuggestions!.forEach(suggestion => {
          expect(suggestion).toHaveProperty('type');
          expect(suggestion).toHaveProperty('description');
          expect(suggestion).toHaveProperty('priority');
          expect(suggestion).toHaveProperty('expectedOutcome');

          expect(['npm_install', 'yarn_add', 'npm_update', 'yarn_upgrade', 'migration_guide', 'security_advisory', 'package_replacement', 'manual_review', 'documentation', 'testing', 'command']).toContain(suggestion.type);
          expect(['critical', 'high', 'medium', 'low']).toContain(suggestion.priority);
        });
      });

      // Verify specific remediation types
      const securityCandidate = candidates.find(c => c.candidateId.includes('security'));
      if (securityCandidate) {
        const hasSecurityAction = securityCandidate.remediationSuggestions!.some(s =>
          s.type === 'npm_update' || s.type === 'security_advisory'
        );
        expect(hasSecurityAction).toBe(true);
      }

      const testingCandidate = candidates.find(c => c.candidateId.includes('test-coverage'));
      if (testingCandidate) {
        const hasTestingAction = testingCandidate.remediationSuggestions!.some(s =>
          s.type === 'testing'
        );
        expect(hasTestingAction).toBe(true);
      }

      const deprecatedCandidate = candidates.find(c => c.candidateId.includes('deprecated'));
      if (deprecatedCandidate) {
        const hasReplacementAction = deprecatedCandidate.remediationSuggestions!.some(s =>
          s.type === 'package_replacement'
        );
        expect(hasReplacementAction).toBe(true);
      }
    });
  });

  describe('Scoring and prioritization', () => {
    it('should assign higher scores to more severe issues', () => {
      const criticalAnalysis = {
        ...baseAnalysis,
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Critical security issue'
            }
          ]
        }
      };

      const normalAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          ...baseAnalysis.codeQuality,
          lintIssues: 25
        }
      };

      const criticalCandidates = analyzer.analyze(criticalAnalysis);
      const normalCandidates = analyzer.analyze(normalAnalysis);

      if (criticalCandidates.length > 0 && normalCandidates.length > 0) {
        const criticalScore = Math.max(...criticalCandidates.map(c => c.score));
        const normalScore = Math.max(...normalCandidates.map(c => c.score));

        expect(criticalScore).toBeGreaterThan(normalScore);
      }
    });

    it('should respect priority hierarchy', () => {
      const candidates = analyzer.analyze({
        ...baseAnalysis,
        testCoverage: {
          percentage: 30,
          uncoveredFiles: ['test.ts']
        },
        dependencies: {
          ...baseAnalysis.dependencies,
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-12345',
              severity: 'critical' as const,
              affectedVersions: '<1.0.0',
              description: 'Critical issue'
            }
          ]
        },
        codeQuality: {
          lintIssues: 30,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 80,
              cognitiveComplexity: 90,
              lineCount: 1200,
              functionName: 'megaComplexFunction'
            }
          ],
          codeSmells: []
        }
      });

      const priorityOrder = ['critical', 'high', 'normal', 'low'];
      const candidatesByPriority = candidates.reduce((acc, candidate) => {
        if (!acc[candidate.priority]) acc[candidate.priority] = [];
        acc[candidate.priority].push(candidate);
        return acc;
      }, {} as Record<string, typeof candidates>);

      // Security vulnerabilities should be critical/high priority
      const securityCandidate = candidates.find(c => c.candidateId.includes('security'));
      if (securityCandidate) {
        expect(['critical', 'high']).toContain(securityCandidate.priority);
      }

      // Critical complexity should be critical priority
      const complexityCandidate = candidates.find(c => c.candidateId.includes('critical-complexity'));
      if (complexityCandidate) {
        expect(complexityCandidate.priority).toBe('critical');
      }

      // Low test coverage should be high priority
      const testCandidate = candidates.find(c => c.candidateId.includes('test-coverage'));
      if (testCandidate) {
        expect(testCandidate.priority).toBe('high');
      }
    });
  });

  describe('Outdated documentation detection', () => {
    it('should detect critical outdated documentation', () => {
      const analysisWithCriticalOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          coveragePercentage: 85,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch' as const,
              description: 'Documentation references outdated API v1.0, current is v2.0',
              line: 25,
              suggestion: 'Update API version references to v2.0',
              severity: 'high' as const
            },
            {
              file: 'API.md',
              type: 'deprecated-api' as const,
              description: 'References deprecated authenticate() method',
              line: 105,
              suggestion: 'Replace with new login() method',
              severity: 'high' as const
            }
          ],
          missingReadmeSections: [],
          apiCompleteness: {
            totalEndpoints: 10,
            documentedEndpoints: 8,
            completenessPercentage: 80
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithCriticalOutdatedDocs);
      const criticalDocsCandidate = candidates.find(c => c.candidateId === 'technical-debt-critical-outdated-docs');

      expect(criticalDocsCandidate).toBeDefined();
      expect(criticalDocsCandidate?.priority).toBe('critical');
      expect(criticalDocsCandidate?.estimatedEffort).toBe('medium');
      expect(criticalDocsCandidate?.description).toContain('2 critical outdated documentation issues');
      expect(criticalDocsCandidate?.remediationSuggestions?.length).toBe(2);
      expect(criticalDocsCandidate?.remediationSuggestions?.[0].type).toBe('documentation_update');
    });

    it('should detect medium/low outdated documentation', () => {
      const analysisWithMixedOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          coveragePercentage: 85,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [
            {
              file: 'docs/guide.md',
              type: 'stale-reference' as const,
              description: 'References old package name',
              severity: 'medium' as const
            },
            {
              file: 'docs/examples.md',
              type: 'outdated-example' as const,
              description: 'Example uses old syntax',
              severity: 'low' as const
            },
            {
              file: 'CHANGELOG.md',
              type: 'broken-link' as const,
              description: 'Link to old documentation site',
              severity: 'medium' as const
            }
          ],
          missingReadmeSections: [],
          apiCompleteness: {
            totalEndpoints: 10,
            documentedEndpoints: 8,
            completenessPercentage: 80
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithMixedOutdatedDocs);
      const outdatedDocsCandidate = candidates.find(c => c.candidateId === 'technical-debt-outdated-documentation');

      expect(outdatedDocsCandidate).toBeDefined();
      expect(outdatedDocsCandidate?.priority).toBe('high'); // Due to medium docs > 2
      expect(outdatedDocsCandidate?.estimatedEffort).toBe('medium');
      expect(outdatedDocsCandidate?.description).toContain('3 outdated documentation issues (2 medium, 1 low severity)');
    });

    it('should include documentation category in debt analysis', () => {
      const analysisWithOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          coveragePercentage: 85,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch' as const,
              description: 'Version mismatch',
              severity: 'high' as const
            }
          ],
          missingReadmeSections: [],
          apiCompleteness: {
            totalEndpoints: 10,
            documentedEndpoints: 8,
            completenessPercentage: 80
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithOutdatedDocs);
      const docCategory = analysis.categories.find(c => c.category === 'documentation');

      expect(docCategory).toBeDefined();
      expect(docCategory?.count).toBe(1);
      expect(docCategory?.severity).toBe('critical'); // High severity outdated doc
      expect(docCategory?.examples).toContain('version-mismatch in README.md');
    });

    it('should create documentation hotspots', () => {
      const analysisWithDocHotspots = {
        ...baseAnalysis,
        documentation: {
          coveragePercentage: 85,
          missingDocs: [],
          undocumentedExports: [],
          outdatedDocs: [
            {
              file: 'docs/api.md',
              type: 'deprecated-api' as const,
              description: 'Multiple deprecated API references',
              severity: 'high' as const
            },
            {
              file: 'docs/api.md',
              type: 'broken-link' as const,
              description: 'Broken external links',
              severity: 'medium' as const
            },
            {
              file: 'README.md',
              type: 'version-mismatch' as const,
              description: 'Version references outdated',
              severity: 'high' as const
            }
          ],
          missingReadmeSections: [],
          apiCompleteness: {
            totalEndpoints: 10,
            documentedEndpoints: 8,
            completenessPercentage: 80
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithDocHotspots);

      const apiHotspot = analysis.hotspots.find(h => h.path === 'docs/api.md');
      expect(apiHotspot).toBeDefined();
      expect(apiHotspot?.score).toBeGreaterThan(20); // Should be a significant hotspot
      expect(apiHotspot?.issues).toContain('2 critical outdated documentation issues');

      const readmeHotspot = analysis.hotspots.find(h => h.path === 'README.md');
      expect(readmeHotspot).toBeDefined();
      expect(readmeHotspot?.issues).toContain('1 critical outdated documentation issues');
    });
  });
});