/**
 * RefactoringAnalyzer Integration Tests - Complexity Hotspots
 *
 * Tests specific to the acceptance criteria:
 * - Analyzer processes complexityHotspots and codeSmells from codeQuality section
 * - Maps to 'complexity' and 'code-smell' categories
 * - Calculates weighted severity scores
 *
 * This file validates the integration between RefactoringAnalyzer and
 * TechnicalDebtAnalyzer, ensuring proper processing of complexity data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, CodeSmell, DuplicatePattern } from '@apexcli/core';

describe('RefactoringAnalyzer - Complexity Integration Tests', () => {
  let analyzer: RefactoringAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 12000,
        languages: { 'ts': 80, 'js': 20 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 75,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 80,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 16,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 85,
          uncoveredBranches: []
        },
        untestedExports: [],
        testAntiPatterns: [],
        missedAssertions: []
      }
    };
  });

  describe('Acceptance Criteria: Process complexityHotspots from codeQuality section', () => {
    it('should process ComplexityHotspot objects with all complexity dimensions', () => {
      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/services/PaymentService.ts',
          functionName: 'processPayment',
          cyclomaticComplexity: 45,
          cognitiveComplexity: 52,
          lineCount: 1200
        },
        {
          file: 'src/utils/DataProcessor.ts',
          functionName: 'processLargeDataset',
          cyclomaticComplexity: 28,
          cognitiveComplexity: 35,
          lineCount: 800
        },
        {
          file: 'src/models/UserModel.ts',
          functionName: 'validateUserData',
          cyclomaticComplexity: 15,
          cognitiveComplexity: 18,
          lineCount: 450
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      // Should create individual tasks for each hotspot
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(3);

      // Verify each task contains complexity metrics
      hotspotTasks.forEach((task, index) => {
        const hotspot = complexityHotspots[index];

        expect(task.description).toContain(`Cyclomatic Complexity: ${hotspot.cyclomaticComplexity}`);
        expect(task.description).toContain(`Cognitive Complexity: ${hotspot.cognitiveComplexity}`);
        expect(task.description).toContain(`Lines: ${hotspot.lineCount}`);

        expect(task.rationale).toContain('Complexity Analysis:');
        expect(task.rationale).toContain(`- Cyclomatic: ${hotspot.cyclomaticComplexity}`);
        expect(task.rationale).toContain(`- Cognitive: ${hotspot.cognitiveComplexity}`);
        expect(task.rationale).toContain(`- Lines: ${hotspot.lineCount}`);
      });
    });

    it('should handle legacy string format hotspots with default complexity values', () => {
      // Legacy format where hotspots are just file paths
      baseAnalysis.codeQuality.complexityHotspots = [
        'src/legacy/OldService.ts',
        'src/legacy/AnotherOldFile.ts'
      ] as any;

      const candidates = analyzer.analyze(baseAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(2);

      // Should assign default complexity values
      hotspotTasks.forEach(task => {
        expect(task.description).toContain('Cyclomatic Complexity: 15 (medium)');
        expect(task.description).toContain('Cognitive Complexity: 20 (medium)');
        expect(task.description).toContain('Lines: 300 (medium)');
      });
    });

    it('should handle mixed legacy and modern complexity data formats', () => {
      const mixedData = [
        'src/legacy.ts', // Legacy string format
        {
          file: 'src/modern.ts',
          functionName: 'complexModernFunction',
          cyclomaticComplexity: 55,
          cognitiveComplexity: 62,
          lineCount: 1500
        }
      ] as any;

      baseAnalysis.codeQuality.complexityHotspots = mixedData;

      const candidates = analyzer.analyze(baseAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      expect(hotspotTasks).toHaveLength(2);

      // Modern format should be prioritized higher due to higher complexity
      const modernTask = hotspotTasks.find(task => task.description.includes('modern.ts'));
      const legacyTask = hotspotTasks.find(task => task.description.includes('legacy.ts'));

      expect(modernTask).toBeDefined();
      expect(legacyTask).toBeDefined();
      expect(modernTask!.score).toBeGreaterThan(legacyTask!.score);
    });
  });

  describe('Acceptance Criteria: Process codeSmells from codeQuality section', () => {
    it('should process all code smell types from codeQuality section', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/auth/AuthService.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Method authenticate has 85 lines and complex branching logic'
        },
        {
          file: 'src/models/UserManager.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Class has 650 lines and handles multiple responsibilities'
        },
        {
          file: 'src/utils/Validator.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'Validation logic has 6 levels of nested conditionals'
        },
        {
          file: 'src/helpers/Utilities.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Similar validation patterns found in 4 different methods'
        },
        {
          file: 'src/legacy/DeprecatedFeatures.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Unused functions from old authentication system'
        },
        {
          file: 'src/config/Constants.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Hardcoded timeout values 30000, 60000 without explanation'
        },
        {
          file: 'src/services/NotificationService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method accesses more User properties than its own'
        },
        {
          file: 'src/api/UserController.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters firstName, lastName, email always passed together'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = codeSmells;

      const candidates = analyzer.analyze(baseAnalysis);

      // Should create one task per code smell type
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));
      expect(codeSmellTasks).toHaveLength(8);

      // Verify each code smell type is represented
      const expectedTypes = [
        'long-method', 'large-class', 'deep-nesting', 'duplicate-code',
        'dead-code', 'magic-numbers', 'feature-envy', 'data-clumps'
      ];

      expectedTypes.forEach(type => {
        const task = candidates.find(c => c.candidateId === `refactoring-code-smell-${type}`);
        expect(task).toBeDefined();
        expect(task?.suggestedWorkflow).toBe('refactoring');
      });
    });

    it('should group multiple code smells of the same type correctly', () => {
      const multipleSmellsSameType: CodeSmell[] = [
        {
          file: 'src/service1.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Method processOrder has 90 lines'
        },
        {
          file: 'src/service2.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Method calculateTax has 70 lines'
        },
        {
          file: 'src/service3.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Method processPayment has 150 lines and handles critical business logic'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = multipleSmellsSameType;

      const candidates = analyzer.analyze(baseAnalysis);

      // Should create single task for the long-method type
      const longMethodTasks = candidates.filter(c => c.candidateId === 'refactoring-code-smell-long-method');
      expect(longMethodTasks).toHaveLength(1);

      const task = longMethodTasks[0];
      expect(task.description).toContain('3 long methods');
      expect(task.description).toContain('service1.ts, service2.ts, service3.ts');

      // Priority should be urgent due to critical severity smell
      expect(task.priority).toBe('urgent');
      expect(task.estimatedEffort).toBe('high');

      // Should include details from all smells in rationale
      expect(task.rationale).toContain('processOrder has 90 lines');
      expect(task.rationale).toContain('calculateTax has 70 lines');
      expect(task.rationale).toContain('processPayment has 150 lines');
    });
  });

  describe('Acceptance Criteria: Map to complexity and code-smell categories', () => {
    it('should categorize complexity hotspots under complexity category', () => {
      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/complex.ts',
          functionName: 'complexFunction',
          cyclomaticComplexity: 40,
          cognitiveComplexity: 45,
          lineCount: 900
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      const complexityTasks = candidates.filter(c => c.candidateId.includes('complexity-'));
      expect(complexityTasks.length).toBeGreaterThan(0);

      complexityTasks.forEach(task => {
        // All complexity-related tasks should use refactoring workflow
        expect(task.suggestedWorkflow).toBe('refactoring');
        expect(task.candidateId).toMatch(/^refactoring-complexity-/);
        expect(task.rationale).toContain('Complexity Analysis:');
      });
    });

    it('should categorize code smells under code-smell category', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/smell1.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Long method detected'
        },
        {
          file: 'src/smell2.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Large class detected'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = codeSmells;

      const candidates = analyzer.analyze(baseAnalysis);

      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));
      expect(codeSmellTasks.length).toBeGreaterThan(0);

      codeSmellTasks.forEach(task => {
        // All code smell tasks should use refactoring workflow
        expect(task.suggestedWorkflow).toBe('refactoring');
        expect(task.candidateId).toMatch(/^refactoring-code-smell-/);
      });
    });

    it('should handle both complexity and code smell data simultaneously', () => {
      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/complex.ts',
          functionName: 'complexFunction',
          cyclomaticComplexity: 35,
          cognitiveComplexity: 40,
          lineCount: 800
        }
      ];

      const codeSmells: CodeSmell[] = [
        {
          file: 'src/smell.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Long method detected'
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = complexityHotspots;
      baseAnalysis.codeQuality.codeSmells = codeSmells;

      const candidates = analyzer.analyze(baseAnalysis);

      const complexityTasks = candidates.filter(c => c.candidateId.includes('complexity-'));
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(complexityTasks.length).toBeGreaterThan(0);
      expect(codeSmellTasks.length).toBeGreaterThan(0);

      // Both categories should be properly represented
      expect(candidates.length).toBe(complexityTasks.length + codeSmellTasks.length);
    });
  });

  describe('Acceptance Criteria: Calculate weighted severity scores', () => {
    it('should calculate weighted scores for complexity hotspots using sophisticated algorithm', () => {
      const hotspots: ComplexityHotspot[] = [
        {
          file: 'src/low-complexity.ts',
          functionName: 'simpleFunction',
          cyclomaticComplexity: 8,   // Low
          cognitiveComplexity: 12,   // Low
          lineCount: 150            // Low
        },
        {
          file: 'src/medium-complexity.ts',
          functionName: 'mediumFunction',
          cyclomaticComplexity: 18,  // Medium
          cognitiveComplexity: 22,   // Medium
          lineCount: 400            // Medium
        },
        {
          file: 'src/high-complexity.ts',
          functionName: 'complexFunction',
          cyclomaticComplexity: 35,  // High
          cognitiveComplexity: 45,   // High
          lineCount: 1200           // High
        },
        {
          file: 'src/critical-complexity.ts',
          functionName: 'criticalFunction',
          cyclomaticComplexity: 65,  // Critical
          cognitiveComplexity: 75,   // Critical
          lineCount: 2500           // Critical
        }
      ];

      baseAnalysis.codeQuality.complexityHotspots = hotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

      // Tasks should be sorted by score (highest first)
      expect(hotspotTasks).toHaveLength(4);

      // Critical complexity should have highest score
      const criticalTask = hotspotTasks.find(t => t.description.includes('critical-complexity.ts'));
      const highTask = hotspotTasks.find(t => t.description.includes('high-complexity.ts'));
      const mediumTask = hotspotTasks.find(t => t.description.includes('medium-complexity.ts'));
      const lowTask = hotspotTasks.find(t => t.description.includes('low-complexity.ts'));

      expect(criticalTask?.score).toBeGreaterThan(highTask?.score || 0);
      expect(highTask?.score).toBeGreaterThan(mediumTask?.score || 0);
      expect(mediumTask?.score).toBeGreaterThan(lowTask?.score || 0);

      // Verify weighted scoring algorithm considerations
      expect(criticalTask?.priority).toBe('urgent');
      expect(highTask?.priority).toBe('high');
      expect(mediumTask?.priority).toBe('normal');
      expect(lowTask?.priority).toBe('low');
    });

    it('should apply bonus scoring for combined high complexity dimensions', () => {
      const combinedHighComplexity: ComplexityHotspot = {
        file: 'src/combined-high.ts',
        functionName: 'combinedComplexFunction',
        cyclomaticComplexity: 40, // High
        cognitiveComplexity: 50,  // High
        lineCount: 800           // Medium
      };

      const singleHighComplexity: ComplexityHotspot = {
        file: 'src/single-high.ts',
        functionName: 'singleComplexFunction',
        cyclomaticComplexity: 40, // High
        cognitiveComplexity: 20,  // Medium
        lineCount: 800           // Medium
      };

      baseAnalysis.codeQuality.complexityHotspots = [combinedHighComplexity, singleHighComplexity];

      const candidates = analyzer.analyze(baseAnalysis);

      const combinedTask = candidates.find(c => c.description.includes('combined-high.ts'));
      const singleTask = candidates.find(c => c.description.includes('single-high.ts'));

      expect(combinedTask).toBeDefined();
      expect(singleTask).toBeDefined();

      // Combined high complexity should get bonus and score higher
      expect(combinedTask!.score).toBeGreaterThan(singleTask!.score);
      expect(combinedTask!.description).toContain('combination of high cyclomatic and cognitive complexity');
      expect(combinedTask!.rationale).toContain('major refactoring with design patterns');
    });

    it('should calculate appropriate scores for code smells based on severity', () => {
      const codeSmells: CodeSmell[] = [
        {
          file: 'src/critical-smell.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical code smell'
        },
        {
          file: 'src/high-smell.ts',
          type: 'large-class',
          severity: 'high',
          details: 'High severity code smell'
        },
        {
          file: 'src/medium-smell.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Medium severity code smell'
        },
        {
          file: 'src/low-smell.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Low severity code smell'
        }
      ];

      baseAnalysis.codeQuality.codeSmells = codeSmells;

      const candidates = analyzer.analyze(baseAnalysis);

      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const mediumTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      const lowTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      // Verify scores are appropriately ordered
      expect(criticalTask?.score).toBeGreaterThan(highTask?.score || 0);
      expect(highTask?.score).toBeGreaterThan(mediumTask?.score || 0);
      expect(mediumTask?.score).toBeGreaterThan(lowTask?.score || 0);

      // Verify expected score ranges for each severity
      expect(criticalTask?.score).toBeGreaterThan(0.8);
      expect(highTask?.score).toBeGreaterThan(0.7);
      expect(mediumTask?.score).toBeGreaterThan(0.5);
      expect(lowTask?.score).toBeGreaterThan(0.3);
    });

    it('should adjust scores based on code smell count for same type', () => {
      const fewSmells: CodeSmell[] = [
        {
          file: 'src/smell1.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Medium smell 1'
        },
        {
          file: 'src/smell2.ts',
          type: 'long-method',
          severity: 'medium',
          details: 'Medium smell 2'
        }
      ];

      const manySmells: CodeSmell[] = Array.from({ length: 12 }, (_, i) => ({
        file: `src/smell${i}.ts`,
        type: 'long-method' as const,
        severity: 'medium' as const,
        details: `Medium smell ${i}`
      }));

      // Test with few smells
      baseAnalysis.codeQuality.codeSmells = fewSmells;
      const fewCandidates = analyzer.analyze(baseAnalysis);
      const fewTask = fewCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Test with many smells
      baseAnalysis.codeQuality.codeSmells = manySmells;
      const manyCandidates = analyzer.analyze(baseAnalysis);
      const manyTask = manyCandidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(fewTask).toBeDefined();
      expect(manyTask).toBeDefined();

      // Many smells should have higher score due to count adjustment
      expect(manyTask!.score).toBeGreaterThan(fewTask!.score);
    });
  });

  describe('Integration with TechnicalDebtAnalyzer patterns', () => {
    it('should process duplicate patterns with enhanced similarity scoring', () => {
      const duplicatePatterns: DuplicatePattern[] = [
        {
          pattern: 'validateUserInput(data)',
          locations: ['src/auth.ts', 'src/user.ts', 'src/api.ts'],
          similarity: 0.95 // Very high similarity
        },
        {
          pattern: 'formatDate(timestamp)',
          locations: ['src/utils.ts', 'src/helpers.ts'],
          similarity: 0.75 // Medium similarity
        }
      ];

      baseAnalysis.codeQuality.duplicatedCode = duplicatePatterns as any;

      const candidates = analyzer.analyze(baseAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');
      expect(duplicateTask).toBeDefined();

      // High similarity should result in high priority and score
      expect(duplicateTask?.priority).toBe('high');
      expect(duplicateTask?.score).toBe(0.9); // Expected test value for high similarity
      expect(duplicateTask?.description).toContain('95% average similarity');
      expect(duplicateTask?.rationale).toContain('High-similarity patterns (>80%)');
    });

    it('should create aggregate complexity tasks for many hotspots', () => {
      const manyHotspots: ComplexityHotspot[] = Array.from({ length: 8 }, (_, i) => ({
        file: `src/complex${i}.ts`,
        functionName: `complexFunction${i}`,
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 600
      }));

      // Add some critical hotspots
      manyHotspots[0].cyclomaticComplexity = 65;
      manyHotspots[0].cognitiveComplexity = 70;
      manyHotspots[0].lineCount = 2200;

      manyHotspots[1].cyclomaticComplexity = 60;
      manyHotspots[1].cognitiveComplexity = 65;
      manyHotspots[1].lineCount = 2000;

      baseAnalysis.codeQuality.complexityHotspots = manyHotspots;

      const candidates = analyzer.analyze(baseAnalysis);

      // Should create 3 individual tasks + 1 aggregate task
      const individualTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const aggregateTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(individualTasks).toHaveLength(3);
      expect(aggregateTask).toBeDefined();

      expect(aggregateTask?.title).toContain('Address Codebase Complexity');
      expect(aggregateTask?.description).toContain('8 complexity hotspots (2 critical)');
      expect(aggregateTask?.priority).toBe('high'); // Due to critical hotspots
      expect(aggregateTask?.estimatedEffort).toBe('high');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle undefined or null codeQuality data gracefully', () => {
      const malformedAnalysis = {
        ...baseAnalysis,
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: undefined as any,
          codeSmells: null as any
        }
      };

      expect(() => {
        const candidates = analyzer.analyze(malformedAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle malformed complexity data gracefully', () => {
      const malformedHotspots = [
        {
          file: 'src/malformed.ts',
          functionName: 'malformedFunction',
          cyclomaticComplexity: undefined,
          cognitiveComplexity: null,
          lineCount: 'invalid'
        },
        {
          file: 'src/negative.ts',
          functionName: 'negativeFunction',
          cyclomaticComplexity: -5,
          cognitiveComplexity: -10,
          lineCount: -100
        }
      ] as any;

      baseAnalysis.codeQuality.complexityHotspots = malformedHotspots;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(candidates.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });

    it('should handle malformed code smell data gracefully', () => {
      const malformedSmells = [
        {
          file: 'src/malformed.ts',
          type: undefined,
          severity: null,
          details: ''
        },
        {
          // Missing required fields
          type: 'long-method'
        }
      ] as any;

      baseAnalysis.codeQuality.codeSmells = malformedSmells;

      expect(() => {
        const candidates = analyzer.analyze(baseAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle empty data arrays correctly', () => {
      baseAnalysis.codeQuality = {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      };

      const candidates = analyzer.analyze(baseAnalysis);

      // Should not generate any refactoring tasks
      expect(candidates).toHaveLength(0);
    });
  });
});