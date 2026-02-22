/**
 * TechnicalDebtAnalyzer Integration Tests
 *
 * This test file focuses on integration scenarios with other system components,
 * workflow integration, and end-to-end testing of the analyzer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis,
  TechnicalDebtAnalysisSchema
} from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Integration Tests', () => {
  let analyzer: TechnicalDebtAnalyzer;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();
  });

  describe('ProjectAnalysis integration', () => {
    it('should integrate with complete ProjectAnalysis data structure', () => {
      const completeAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 150,
          lines: 25000,
          languages: {
            typescript: 15000,
            javascript: 8000,
            json: 1500,
            markdown: 500
          }
        },
        testCoverage: {
          percentage: 68,
          uncoveredFiles: [
            'src/utils/legacy-helper.ts',
            'src/services/old-api.ts',
            'src/components/deprecated-ui.tsx'
          ]
        },
        dependencies: {
          outdated: [
            'react', 'lodash', 'moment', 'axios', 'webpack'
          ],
          security: [
            'lodash', 'moment'
          ],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '16.14.0',
              latestVersion: '18.2.0',
              updateType: 'major'
            },
            {
              name: 'lodash',
              currentVersion: '4.17.20',
              latestVersion: '4.17.21',
              updateType: 'patch'
            },
            {
              name: 'webpack',
              currentVersion: '4.46.0',
              latestVersion: '5.75.0',
              updateType: 'major'
            }
          ],
          securityIssues: [
            {
              name: 'lodash',
              cveId: 'CVE-2021-23337',
              severity: 'high',
              affectedVersions: '<4.17.21',
              description: 'Prototype pollution vulnerability in lodash'
            },
            {
              name: 'moment',
              cveId: 'CVE-2022-31129',
              severity: 'medium',
              affectedVersions: '<2.29.4',
              description: 'Path traversal vulnerability'
            }
          ],
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.3',
              reason: 'Project is in maintenance mode',
              replacement: 'dayjs'
            },
            {
              name: 'request',
              currentVersion: '2.88.2',
              reason: 'Deprecated and no longer maintained',
              replacement: 'axios'
            }
          ]
        },
        codeQuality: {
          lintIssues: 127,
          duplicatedCode: [
            {
              pattern: 'API error handling boilerplate',
              locations: [
                'src/services/user-api.ts',
                'src/services/order-api.ts',
                'src/services/product-api.ts',
                'src/services/payment-api.ts'
              ],
              similarity: 0.94
            },
            {
              pattern: 'Form validation logic',
              locations: [
                'src/components/UserForm.tsx',
                'src/components/ProductForm.tsx',
                'src/components/OrderForm.tsx'
              ],
              similarity: 0.87
            }
          ],
          complexityHotspots: [
            {
              file: 'src/services/legacy-processor.ts',
              cyclomaticComplexity: 82,
              cognitiveComplexity: 95,
              lineCount: 1847,
              functionName: 'processLegacyData'
            },
            {
              file: 'src/utils/data-transformer.ts',
              cyclomaticComplexity: 47,
              cognitiveComplexity: 58,
              lineCount: 923,
              functionName: 'transformComplexData'
            },
            {
              file: 'src/components/DataVisualization.tsx',
              cyclomaticComplexity: 38,
              cognitiveComplexity: 45,
              lineCount: 654,
              functionName: 'renderComplexChart'
            }
          ],
          codeSmells: [
            {
              file: 'src/services/god-service.ts',
              type: 'god-class',
              severity: 'critical',
              line: 1,
              description: 'Service class with 47 methods and multiple responsibilities',
              suggestion: 'Break into smaller, focused services'
            },
            {
              file: 'src/utils/helper.ts',
              type: 'long-method',
              severity: 'high',
              line: 156,
              description: 'Method with 89 lines and complex nested conditions',
              suggestion: 'Extract smaller methods'
            },
            {
              file: 'src/components/UserProfile.tsx',
              type: 'feature-envy',
              severity: 'medium',
              line: 34,
              description: 'Component accessing too many properties of external objects',
              suggestion: 'Move logic closer to data or use composition'
            }
          ]
        },
        documentation: {
          coveragePercentage: 43,
          undocumentedExports: [
            'src/utils/crypto.ts:encrypt',
            'src/services/cache.ts:CacheManager',
            'src/types/api.ts:ApiResponse'
          ],
          outdatedDocumentation: [
            'docs/api-guide.md',
            'README.md'
          ],
          missingReadmeSections: [
            'installation',
            'configuration',
            'troubleshooting'
          ],
          apiCompleteness: {
            documented: 65,
            total: 150,
            coveragePercentage: 43
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 8388608, // 8MB
          slowTests: [
            'integration/api.test.ts',
            'e2e/user-flow.test.ts'
          ],
          bottlenecks: [
            'src/services/heavy-computation.ts',
            'src/utils/large-data-processor.ts'
          ]
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 52,
            uncoveredBranches: [
              'src/services/error-handler.ts:42',
              'src/utils/validator.ts:78'
            ]
          },
          antiPatterns: [
            'src/tests/unit/god-test.spec.ts',
            'src/tests/integration/coupling-test.spec.ts'
          ],
          untestedExports: [
            'src/utils/emergency-fallback.ts:handleCriticalFailure',
            'src/services/backup.ts:createEmergencyBackup'
          ]
        }
      };

      // Test that analyzer handles complete real-world data
      expect(() => analyzer.analyze(completeAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(completeAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(completeAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(completeAnalysis);

      // Should generate multiple candidates for this complex scenario
      expect(candidates.length).toBeGreaterThan(5);

      // Should have high debt score due to multiple issues
      expect(debtAnalysis.totalScore).toBeGreaterThan(50);

      // Should have multiple debt categories
      expect(debtAnalysis.categories.length).toBeGreaterThan(3);

      // Should identify hotspots
      expect(debtAnalysis.hotspots.length).toBeGreaterThan(0);

      // Should have metrics
      expect(debtAnalysis.metrics).toBeDefined();
      expect(debtAnalysis.metrics?.testCoverage).toBe(68);

      // Should have trends
      expect(debtAnalysis.trends).toBeDefined();
      expect(typeof debtAnalysis.trends?.improving).toBe('boolean');
    });

    it('should generate candidates compatible with workflow system', () => {
      const workflowAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 75,
          lines: 12000,
          languages: { typescript: 8000, javascript: 4000 }
        },
        testCoverage: {
          percentage: 45,
          uncoveredFiles: ['critical-service.ts', 'payment-handler.ts']
        },
        dependencies: {
          outdated: ['express'],
          security: [],
          outdatedPackages: [
            {
              name: 'express',
              currentVersion: '4.17.1',
              latestVersion: '4.18.2',
              updateType: 'minor'
            }
          ],
          securityIssues: [
            {
              name: 'critical-auth-lib',
              cveId: 'CVE-2023-99999',
              severity: 'critical',
              affectedVersions: '<3.0.0',
              description: 'Authentication bypass vulnerability'
            }
          ],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 38,
          duplicatedCode: [
            {
              pattern: 'Authentication middleware',
              locations: ['auth-api.ts', 'user-api.ts'],
              similarity: 0.91
            }
          ],
          complexityHotspots: [
            {
              file: 'payment-processor.ts',
              cyclomaticComplexity: 67,
              cognitiveComplexity: 78,
              lineCount: 1240,
              functionName: 'processComplexPayment'
            }
          ],
          codeSmells: [
            {
              file: 'data-manager.ts',
              type: 'god-class',
              severity: 'critical',
              line: 1,
              description: 'Massive class handling all data operations',
              suggestion: 'Split into domain-specific managers'
            }
          ]
        },
        documentation: {
          coveragePercentage: 60,
          undocumentedExports: ['api-types.ts:PaymentData'],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 60,
            total: 100,
            coveragePercentage: 60
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 4194304,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 40,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const candidates = analyzer.analyze(workflowAnalysis);

      // Verify candidate structure for workflow compatibility
      candidates.forEach(candidate => {
        // Should have proper ID format for deduplication
        expect(candidate.candidateId).toMatch(/^technical-debt-/);

        // Should have valid workflow assignment
        expect(typeof candidate.suggestedWorkflow).toBe('string');
        expect(candidate.suggestedWorkflow.length).toBeGreaterThan(0);

        // Should have proper priority levels
        expect(['critical', 'high', 'normal', 'low']).toContain(candidate.priority);

        // Should have effort estimation
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);

        // Should have actionable description
        expect(candidate.description.length).toBeGreaterThan(20);

        // Should have rationale for prioritization
        expect(candidate.rationale.length).toBeGreaterThan(10);

        // Should have score for ranking
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(1);

        // Should have remediation suggestions
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);

        if (candidate.remediationSuggestions!.length > 0) {
          candidate.remediationSuggestions!.forEach(suggestion => {
            expect(suggestion.type).toBeDefined();
            expect(suggestion.description).toBeDefined();
            expect(suggestion.priority).toBeDefined();
            expect(suggestion.expectedOutcome).toBeDefined();
          });
        }
      });

      // Should prioritize security issues highest
      const securityCandidate = candidates.find(c =>
        c.candidateId.includes('security') ||
        c.description.toLowerCase().includes('security')
      );
      expect(securityCandidate).toBeDefined();
      expect(['critical', 'high']).toContain(securityCandidate?.priority);
    });

    it('should provide proper remediation suggestions for workflow execution', () => {
      const remediationAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 50,
          lines: 8000,
          languages: { typescript: 8000 }
        },
        testCoverage: {
          percentage: 35,
          uncoveredFiles: ['service.ts', 'utils.ts']
        },
        dependencies: {
          outdated: ['axios', 'moment'],
          security: ['lodash'],
          outdatedPackages: [
            {
              name: 'axios',
              currentVersion: '0.21.4',
              latestVersion: '1.6.0',
              updateType: 'major'
            }
          ],
          securityIssues: [
            {
              name: 'lodash',
              cveId: 'CVE-2021-23337',
              severity: 'high',
              affectedVersions: '<4.17.21',
              description: 'Prototype pollution'
            }
          ],
          deprecatedPackages: [
            {
              name: 'moment',
              currentVersion: '2.29.1',
              reason: 'Legacy project',
              replacement: 'dayjs'
            }
          ]
        },
        codeQuality: {
          lintIssues: 45,
          duplicatedCode: [
            {
              pattern: 'Error handling pattern',
              locations: ['api.ts', 'service.ts'],
              similarity: 0.88
            }
          ],
          complexityHotspots: [
            {
              file: 'processor.ts',
              cyclomaticComplexity: 55,
              cognitiveComplexity: 65,
              lineCount: 890,
              functionName: 'complexProcessor'
            }
          ],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 70,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 70,
            total: 100,
            coveragePercentage: 70
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 2048,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 30,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const candidates = analyzer.analyze(remediationAnalysis);

      // Check security remediation
      const securityCandidate = candidates.find(c => c.candidateId.includes('security'));
      if (securityCandidate) {
        const npmUpdateSuggestion = securityCandidate.remediationSuggestions!.find(s =>
          s.type === 'npm_update'
        );
        expect(npmUpdateSuggestion).toBeDefined();
        expect(npmUpdateSuggestion?.command).toBe('npm audit fix');
      }

      // Check deprecated package remediation
      const deprecatedCandidate = candidates.find(c => c.candidateId.includes('deprecated'));
      if (deprecatedCandidate) {
        const replacementSuggestion = deprecatedCandidate.remediationSuggestions!.find(s =>
          s.type === 'package_replacement'
        );
        expect(replacementSuggestion).toBeDefined();
        expect(replacementSuggestion?.link).toContain('dayjs');
      }

      // Check test coverage remediation
      const testCandidate = candidates.find(c => c.candidateId.includes('test-coverage'));
      if (testCandidate) {
        const testingSuggestion = testCandidate.remediationSuggestions!.find(s =>
          s.type === 'testing'
        );
        expect(testingSuggestion).toBeDefined();
        expect(testingSuggestion?.expectedOutcome).toContain('coverage');
      }

      // Check complexity remediation
      const complexityCandidate = candidates.find(c => c.candidateId.includes('complexity'));
      if (complexityCandidate) {
        const refactorSuggestion = complexityCandidate.remediationSuggestions!.find(s =>
          s.type === 'manual_review'
        );
        expect(refactorSuggestion).toBeDefined();
        expect(refactorSuggestion?.description).toContain('complex');
      }
    });
  });

  describe('Schema compliance and validation', () => {
    it('should produce TechnicalDebtAnalysis that validates against schema', async () => {
      const { TechnicalDebtAnalysisSchema } = await import('@apexcli/core');

      const testAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 15000,
          languages: { typescript: 10000, javascript: 5000 }
        },
        testCoverage: {
          percentage: 72,
          uncoveredFiles: ['legacy.ts']
        },
        dependencies: {
          outdated: ['package1'],
          security: [],
          outdatedPackages: [
            {
              name: 'package1',
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateType: 'major'
            }
          ],
          securityIssues: [
            {
              name: 'vuln-package',
              cveId: 'CVE-2023-12345',
              severity: 'medium',
              affectedVersions: '<1.5.0',
              description: 'Medium severity issue'
            }
          ],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 20,
          duplicatedCode: [
            {
              pattern: 'common utils',
              locations: ['utils1.ts', 'utils2.ts'],
              similarity: 0.9
            }
          ],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 30,
              cognitiveComplexity: 35,
              lineCount: 500,
              functionName: 'complexFunction'
            }
          ],
          codeSmells: [
            {
              file: 'smell.ts',
              type: 'code-smell',
              severity: 'medium',
              line: 10,
              description: 'Code smell detected',
              suggestion: 'Refactor this code'
            }
          ]
        },
        documentation: {
          coveragePercentage: 65,
          undocumentedExports: ['export1'],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 65,
            total: 100,
            coveragePercentage: 65
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 3072,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 68,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(testAnalysis);

      // Should validate against schema without throwing
      expect(() => TechnicalDebtAnalysisSchema.parse(debtAnalysis)).not.toThrow();

      // Verify the parsed result matches original
      const validatedAnalysis = TechnicalDebtAnalysisSchema.parse(debtAnalysis);
      expect(validatedAnalysis).toEqual(debtAnalysis);

      // Verify specific schema requirements
      expect(validatedAnalysis.totalScore).toBeGreaterThanOrEqual(0);
      expect(validatedAnalysis.totalScore).toBeLessThanOrEqual(100);

      validatedAnalysis.categories.forEach(category => {
        expect(['code-smell', 'duplication', 'complexity', 'outdated-dependency',
                'security-vulnerability', 'performance', 'maintainability',
                'testability', 'documentation', 'dead-code', 'technical-design',
                'other']).toContain(category.category);
        expect(['low', 'medium', 'high', 'critical']).toContain(category.severity);
        expect(category.count).toBeGreaterThanOrEqual(0);
      });

      validatedAnalysis.hotspots.forEach(hotspot => {
        expect(hotspot.score).toBeGreaterThanOrEqual(0);
        expect(hotspot.score).toBeLessThanOrEqual(100);
        expect(Array.isArray(hotspot.issues)).toBe(true);
        expect(hotspot.path.length).toBeGreaterThan(0);
      });

      if (validatedAnalysis.metrics) {
        if (validatedAnalysis.metrics.testCoverage !== undefined) {
          expect(validatedAnalysis.metrics.testCoverage).toBeGreaterThanOrEqual(0);
          expect(validatedAnalysis.metrics.testCoverage).toBeLessThanOrEqual(100);
        }
        if (validatedAnalysis.metrics.duplicatedLinesPercent !== undefined) {
          expect(validatedAnalysis.metrics.duplicatedLinesPercent).toBeGreaterThanOrEqual(0);
          expect(validatedAnalysis.metrics.duplicatedLinesPercent).toBeLessThanOrEqual(100);
        }
        if (validatedAnalysis.metrics.maintainabilityIndex !== undefined) {
          expect(validatedAnalysis.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
          expect(validatedAnalysis.metrics.maintainabilityIndex).toBeLessThanOrEqual(100);
        }
      }

      if (validatedAnalysis.trends) {
        expect(typeof validatedAnalysis.trends.improving).toBe('boolean');
        expect(typeof validatedAnalysis.trends.changeRate).toBe('number');
        expect(validatedAnalysis.trends.timeframe).toBe('last 30 days');
      }
    });

    it('should handle schema validation with minimal data', async () => {
      const { TechnicalDebtAnalysisSchema } = await import('@apexcli/core');

      const minimalAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 1,
          lines: 100,
          languages: { typescript: 100 }
        },
        testCoverage: {
          percentage: 100,
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
          bundleSize: 1024,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 100,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(minimalAnalysis);

      // Should validate minimal data
      expect(() => TechnicalDebtAnalysisSchema.parse(debtAnalysis)).not.toThrow();

      const validated = TechnicalDebtAnalysisSchema.parse(debtAnalysis);

      // Clean codebase should have low debt
      expect(validated.totalScore).toBeLessThan(10);
      expect(validated.categories).toEqual([]);
      expect(validated.hotspots).toEqual([]);
    });
  });

  describe('Prioritization and ranking integration', () => {
    it('should integrate with BaseAnalyzer prioritize method', () => {
      const prioritizationAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 80,
          lines: 12000,
          languages: { typescript: 8000, javascript: 4000 }
        },
        testCoverage: {
          percentage: 50, // Medium priority
          uncoveredFiles: ['test1.ts', 'test2.ts']
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [
            {
              name: 'critical-vuln',
              cveId: 'CVE-2023-99999',
              severity: 'critical', // Highest priority
              affectedVersions: '<1.0.0',
              description: 'Critical security vulnerability'
            }
          ],
          deprecatedPackages: [
            {
              name: 'old-package',
              currentVersion: '1.0.0',
              reason: 'Deprecated', // Lower priority
              replacement: 'new-package'
            }
          ]
        },
        codeQuality: {
          lintIssues: 25, // Low priority
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'complex.ts',
              cyclomaticComplexity: 85, // Critical priority
              cognitiveComplexity: 100,
              lineCount: 1500,
              functionName: 'criticallyComplexFunction'
            }
          ],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 80,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 80,
            total: 100,
            coveragePercentage: 80
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 4096,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const candidates = analyzer.analyze(prioritizationAnalysis);

      // Should have multiple candidates
      expect(candidates.length).toBeGreaterThan(3);

      // Test prioritize method
      const topCandidate = analyzer.prioritize(candidates);
      expect(topCandidate).not.toBeNull();

      // Top candidate should be highest priority/score
      if (topCandidate) {
        const allScores = candidates.map(c => c.score);
        const maxScore = Math.max(...allScores);
        expect(topCandidate.score).toBe(maxScore);

        // Should likely be security or critical complexity
        expect(
          topCandidate.candidateId.includes('security') ||
          topCandidate.candidateId.includes('critical-complexity')
        ).toBe(true);
      }

      // Test prioritize with empty array
      expect(analyzer.prioritize([])).toBeNull();

      // Test prioritize with single candidate
      const singleCandidate = candidates.slice(0, 1);
      expect(analyzer.prioritize(singleCandidate)).toBe(singleCandidate[0]);
    });
  });

  describe('End-to-end workflow simulation', () => {
    it('should simulate complete workflow from analysis to task generation', () => {
      // Simulate a typical project analysis result
      const e2eAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 200,
          lines: 35000,
          languages: {
            typescript: 25000,
            javascript: 8000,
            css: 1500,
            json: 500
          }
        },
        testCoverage: {
          percentage: 58,
          uncoveredFiles: [
            'src/legacy/old-system.ts',
            'src/utils/deprecated-helpers.ts',
            'src/services/legacy-api.ts'
          ]
        },
        dependencies: {
          outdated: ['react', 'webpack', 'babel-core', 'eslint'],
          security: ['lodash', 'minimist'],
          outdatedPackages: [
            {
              name: 'react',
              currentVersion: '17.0.2',
              latestVersion: '18.2.0',
              updateType: 'major'
            },
            {
              name: 'webpack',
              currentVersion: '4.46.0',
              latestVersion: '5.75.0',
              updateType: 'major'
            },
            {
              name: 'eslint',
              currentVersion: '7.32.0',
              latestVersion: '8.45.0',
              updateType: 'major'
            }
          ],
          securityIssues: [
            {
              name: 'lodash',
              cveId: 'CVE-2021-23337',
              severity: 'high',
              affectedVersions: '<4.17.21',
              description: 'Prototype pollution vulnerability'
            },
            {
              name: 'minimist',
              cveId: 'CVE-2021-44906',
              severity: 'critical',
              affectedVersions: '<1.2.6',
              description: 'Prototype pollution leading to RCE'
            }
          ],
          deprecatedPackages: [
            {
              name: 'babel-core',
              currentVersion: '6.26.3',
              reason: 'Legacy Babel version, use @babel/core',
              replacement: '@babel/core'
            }
          ]
        },
        codeQuality: {
          lintIssues: 184,
          duplicatedCode: [
            {
              pattern: 'React component boilerplate',
              locations: [
                'src/components/UserCard.tsx',
                'src/components/ProductCard.tsx',
                'src/components/OrderCard.tsx',
                'src/components/CategoryCard.tsx'
              ],
              similarity: 0.89
            },
            {
              pattern: 'API request error handling',
              locations: [
                'src/services/user-service.ts',
                'src/services/product-service.ts',
                'src/services/order-service.ts'
              ],
              similarity: 0.93
            }
          ],
          complexityHotspots: [
            {
              file: 'src/components/Dashboard.tsx',
              cyclomaticComplexity: 73,
              cognitiveComplexity: 89,
              lineCount: 1456,
              functionName: 'DashboardComponent'
            },
            {
              file: 'src/services/data-processor.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 58,
              lineCount: 891,
              functionName: 'processComplexData'
            }
          ],
          codeSmells: [
            {
              file: 'src/utils/mega-helper.ts',
              type: 'god-class',
              severity: 'critical',
              line: 1,
              description: 'Utility file with 63 different helper functions',
              suggestion: 'Split into focused utility modules'
            },
            {
              file: 'src/components/Form.tsx',
              type: 'long-method',
              severity: 'high',
              line: 89,
              description: 'Render method with 156 lines and complex logic',
              suggestion: 'Extract smaller components and hooks'
            }
          ]
        },
        documentation: {
          coveragePercentage: 34,
          undocumentedExports: [
            'src/types/api.ts:UserResponse',
            'src/utils/crypto.ts:hashPassword',
            'src/services/auth.ts:AuthService'
          ],
          outdatedDocumentation: [
            'docs/setup.md',
            'docs/deployment.md'
          ],
          missingReadmeSections: [
            'installation',
            'configuration',
            'api-reference',
            'troubleshooting'
          ],
          apiCompleteness: {
            documented: 51,
            total: 150,
            coveragePercentage: 34
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 12582912, // 12MB
          slowTests: [
            'src/tests/integration/heavy-load.test.ts',
            'src/tests/e2e/full-workflow.test.ts'
          ],
          bottlenecks: [
            'src/services/heavy-computation.ts',
            'src/utils/large-data-transformer.ts'
          ]
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 41,
            uncoveredBranches: [
              'src/services/error-handler.ts:56',
              'src/utils/fallback.ts:23'
            ]
          },
          antiPatterns: [
            'src/tests/unit/monolithic-test.spec.ts',
            'src/tests/integration/tight-coupling.spec.ts'
          ],
          untestedExports: [
            'src/utils/emergency.ts:criticalFailureHandler',
            'src/services/backup.ts:emergencyBackup'
          ]
        }
      };

      // Step 1: Analyze and generate candidates
      const candidates = analyzer.analyze(e2eAnalysis);

      expect(candidates.length).toBeGreaterThan(5);
      expect(candidates.length).toBeLessThan(15); // Should be reasonable number

      // Step 2: Verify all candidates are properly formed
      candidates.forEach((candidate, index) => {
        expect(candidate.candidateId).toMatch(/^technical-debt-/);
        expect(candidate.title.length).toBeGreaterThan(5);
        expect(candidate.description.length).toBeGreaterThan(20);
        expect(candidate.rationale.length).toBeGreaterThan(10);
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(['critical', 'high', 'normal', 'low']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);
      });

      // Step 3: Test prioritization
      const topCandidate = analyzer.prioritize(candidates);
      expect(topCandidate).not.toBeNull();
      expect(['critical', 'high']).toContain(topCandidate!.priority);

      // Step 4: Create comprehensive debt analysis
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(e2eAnalysis);

      // Should have high debt score for this problematic codebase
      expect(debtAnalysis.totalScore).toBeGreaterThan(60);

      // Should have multiple categories
      expect(debtAnalysis.categories.length).toBeGreaterThan(4);

      // Should identify critical issues
      const criticalCategories = debtAnalysis.categories.filter(c => c.severity === 'critical');
      expect(criticalCategories.length).toBeGreaterThan(0);

      // Should have hotspots
      expect(debtAnalysis.hotspots.length).toBeGreaterThan(2);

      // Should have reasonable metrics
      expect(debtAnalysis.metrics?.testCoverage).toBe(58);
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeLessThan(50);

      // Should indicate debt is not improving (high score)
      expect(debtAnalysis.trends?.improving).toBe(false);
      expect(debtAnalysis.trends?.changeRate).toBeGreaterThan(0);

      // Step 5: Verify schema compliance for final output
      expect(() => {
        const { TechnicalDebtAnalysisSchema } = require('@apexcli/core');
        TechnicalDebtAnalysisSchema.parse(debtAnalysis);
      }).not.toThrow();
    });
  });
});