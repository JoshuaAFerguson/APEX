/**
 * RefactoringAnalyzer Acceptance Criteria Tests
 *
 * Validates that the RefactoringAnalyzer.analyze() implementation meets
 * all acceptance criteria for generating TaskCandidate objects for each
 * code smell type with appropriate priority, effort estimates, actionable
 * suggestions, and descriptive rationale.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { CodeSmell } from '@apexcli/core';

describe('RefactoringAnalyzer Acceptance Criteria', () => {
  let analyzer: RefactoringAnalyzer;
  let projectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();

    projectAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 15000,
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
        coverage: 60,
        missingDocs: [],
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
  });

  describe('Acceptance Criteria: TaskCandidate Generation', () => {
    it('should generate TaskCandidate objects for all three primary code smell types', () => {
      const primaryCodeSmells: CodeSmell[] = [
        {
          file: 'src/services/UserService.ts',
          type: 'long-method',
          severity: 'high',
          details: "Method 'validateUserData' has 95 lines (starting at line 42) and high complexity"
        },
        {
          file: 'src/models/OrderManager.ts',
          type: 'large-class',
          severity: 'medium',
          details: 'Class has 750 lines, 22 methods, and handles multiple responsibilities'
        },
        {
          file: 'src/utils/DataProcessor.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'Found 7 levels of nesting in method processNestedData at line 128'
        }
      ];

      projectAnalysis.codeQuality.codeSmells = primaryCodeSmells;

      const candidates = analyzer.analyze(projectAnalysis);

      // Verify TaskCandidate objects are created for each type
      expect(candidates).toHaveLength(3);

      const longMethodCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const largeClassCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const deepNestingCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');

      expect(longMethodCandidate).toBeDefined();
      expect(largeClassCandidate).toBeDefined();
      expect(deepNestingCandidate).toBeDefined();
    });

    it('should generate TaskCandidate objects for all five additional code smell types', () => {
      const additionalCodeSmells: CodeSmell[] = [
        {
          file: 'src/auth/AuthValidator.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Duplicate validation logic found in validateEmail, validatePassword, and validateUsername methods'
        },
        {
          file: 'src/legacy/OldFeatures.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Functions calculateLegacyScore, formatOldDate, and validateDeprecatedInput are never called'
        },
        {
          file: 'src/constants/AppConfig.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Magic numbers 42, 100, and 500 used without explanation in configuration methods'
        },
        {
          file: 'src/services/NotificationService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method sendNotification uses 8 properties from User class but only 2 from its own'
        },
        {
          file: 'src/api/UserController.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters userId, userName, userEmail are consistently passed together across 5 methods'
        }
      ];

      projectAnalysis.codeQuality.codeSmells = additionalCodeSmells;

      const candidates = analyzer.analyze(projectAnalysis);

      // Verify TaskCandidate objects are created for each additional type
      expect(candidates).toHaveLength(5);

      const duplicateCodeCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      const deadCodeCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      const magicNumbersCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
      const featureEnvyCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      const dataClumpsCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');

      expect(duplicateCodeCandidate).toBeDefined();
      expect(deadCodeCandidate).toBeDefined();
      expect(magicNumbersCandidate).toBeDefined();
      expect(featureEnvyCandidate).toBeDefined();
      expect(dataClumpsCandidate).toBeDefined();
    });
  });

  describe('Acceptance Criteria: Appropriate Priority Based on Severity', () => {
    it('should assign urgent priority for critical severity code smells', () => {
      const criticalSmell: CodeSmell = {
        file: 'src/core/CriticalProcessor.ts',
        type: 'long-method',
        severity: 'critical',
        details: 'Method processPayment has 500+ lines and handles payment logic - critical for business operations'
      };

      projectAnalysis.codeQuality.codeSmells = [criticalSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      expect(candidate?.priority).toBe('urgent');
    });

    it('should assign high priority for high severity code smells', () => {
      const highSmell: CodeSmell = {
        file: 'src/services/HighComplexity.ts',
        type: 'deep-nesting',
        severity: 'high',
        details: 'Deep nesting makes this critical business logic very difficult to maintain'
      };

      projectAnalysis.codeQuality.codeSmells = [highSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      expect(candidate?.priority).toBe('high');
    });

    it('should assign normal priority for medium severity code smells', () => {
      const mediumSmell: CodeSmell = {
        file: 'src/utils/HelperFunctions.ts',
        type: 'large-class',
        severity: 'medium',
        details: 'Class is moderately large but manageable'
      };

      projectAnalysis.codeQuality.codeSmells = [mediumSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(candidate?.priority).toBe('normal');
    });

    it('should assign low priority for low severity code smells', () => {
      const lowSmell: CodeSmell = {
        file: 'src/utils/MinorIssues.ts',
        type: 'dead-code',
        severity: 'low',
        details: 'Some unused helper functions that can be cleaned up when convenient'
      };

      projectAnalysis.codeQuality.codeSmells = [lowSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      expect(candidate?.priority).toBe('low');
    });
  });

  describe('Acceptance Criteria: Effort Estimates', () => {
    it('should provide appropriate effort estimates based on severity and smell type', () => {
      const codeSmells: CodeSmell[] = [
        { file: 'src/critical.ts', type: 'long-method', severity: 'critical', details: 'Critical method' },
        { file: 'src/high.ts', type: 'large-class', severity: 'high', details: 'High severity class' },
        { file: 'src/medium.ts', type: 'duplicate-code', severity: 'medium', details: 'Medium duplication' },
        { file: 'src/low.ts', type: 'dead-code', severity: 'low', details: 'Low dead code' }
      ];

      projectAnalysis.codeQuality.codeSmells = codeSmells;
      const candidates = analyzer.analyze(projectAnalysis);

      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const mediumTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      const lowTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      expect(criticalTask?.estimatedEffort).toBe('high');
      expect(highTask?.estimatedEffort).toBe('high');
      expect(mediumTask?.estimatedEffort).toBe('medium');
      expect(lowTask?.estimatedEffort).toBe('low');
    });
  });

  describe('Acceptance Criteria: Actionable Refactoring Suggestions', () => {
    it('should provide actionable refactoring suggestions for long-method code smells', () => {
      const longMethodSmell: CodeSmell = {
        file: 'src/services/ComplexService.ts',
        type: 'long-method',
        severity: 'high',
        details: "Method 'processComplexWorkflow' has 120 lines and handles multiple responsibilities"
      };

      projectAnalysis.codeQuality.codeSmells = [longMethodSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      expect(candidate?.rationale).toContain('Break long methods into smaller, focused functions');
      expect(candidate?.rationale).toContain('Extract common logic into utility methods');
      expect(candidate?.rationale).toContain('Single Responsibility Principle');
      expect(candidate?.rationale).toContain('method objects for complex algorithms');
    });

    it('should provide actionable refactoring suggestions for large-class code smells', () => {
      const largeClassSmell: CodeSmell = {
        file: 'src/models/MonolithicManager.ts',
        type: 'large-class',
        severity: 'high',
        details: 'Class has 800+ lines, 25+ methods, and manages users, orders, and notifications'
      };

      projectAnalysis.codeQuality.codeSmells = [largeClassSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');

      expect(candidate?.rationale).toContain('Apply Single Responsibility Principle to split classes');
      expect(candidate?.rationale).toContain('Extract related functionality into separate modules');
      expect(candidate?.rationale).toContain('composition over inheritance');
      expect(candidate?.rationale).toContain('facade pattern');
    });

    it('should provide actionable refactoring suggestions for deep-nesting code smells', () => {
      const deepNestingSmell: CodeSmell = {
        file: 'src/parsers/DataParser.ts',
        type: 'deep-nesting',
        severity: 'high',
        details: 'Found 8 levels of nesting in parseComplexData method at line 67'
      };

      projectAnalysis.codeQuality.codeSmells = [deepNestingSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');

      expect(candidate?.rationale).toContain('Use early returns to reduce nesting levels');
      expect(candidate?.rationale).toContain('Extract nested logic into separate methods');
      expect(candidate?.rationale).toContain('Replace complex conditionals with polymorphism');
      expect(candidate?.rationale).toContain('guard clauses');
    });

    it('should provide actionable suggestions for all additional code smell types', () => {
      const additionalSmells: CodeSmell[] = [
        { file: 'src/dup.ts', type: 'duplicate-code', severity: 'medium', details: 'Duplicate validation logic' },
        { file: 'src/dead.ts', type: 'dead-code', severity: 'low', details: 'Unused functions' },
        { file: 'src/magic.ts', type: 'magic-numbers', severity: 'medium', details: 'Unexplained numbers' },
        { file: 'src/envy.ts', type: 'feature-envy', severity: 'medium', details: 'Method envies other class' },
        { file: 'src/clumps.ts', type: 'data-clumps', severity: 'medium', details: 'Parameters always together' }
      ];

      projectAnalysis.codeQuality.codeSmells = additionalSmells;
      const candidates = analyzer.analyze(projectAnalysis);

      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      expect(duplicateTask?.rationale).toContain('Extract common code into reusable functions');
      expect(duplicateTask?.rationale).toContain("Don't Repeat Yourself");

      const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      expect(deadCodeTask?.rationale).toContain('Remove unused functions, variables, and imports');
      expect(deadCodeTask?.rationale).toContain('static analysis tools');

      const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
      expect(magicNumbersTask?.rationale).toContain('Replace numbers with named constants');
      expect(magicNumbersTask?.rationale).toContain('Use enums for related constant values');

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data they use');
      expect(featureEnvyTask?.rationale).toContain('delegation pattern');

      const dataClumpsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');
      expect(dataClumpsTask?.rationale).toContain('Create parameter objects for grouped data');
      expect(dataClumpsTask?.rationale).toContain('value objects');
    });
  });

  describe('Acceptance Criteria: Descriptive Rationale', () => {
    it('should provide descriptive rationales that include the original code smell details', () => {
      const detailedSmell: CodeSmell = {
        file: 'src/analytics/ReportGenerator.ts',
        type: 'long-method',
        severity: 'high',
        details: "Method 'generateCompleteReport' spans 175 lines (lines 45-220), has cyclomatic complexity of 28, and handles data fetching, processing, formatting, and export logic"
      };

      projectAnalysis.codeQuality.codeSmells = [detailedSmell];
      const candidates = analyzer.analyze(projectAnalysis);

      const candidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Should include original details
      expect(candidate?.rationale).toContain("Method 'generateCompleteReport' spans 175 lines");
      expect(candidate?.rationale).toContain('cyclomatic complexity of 28');

      // Should explain why it's a problem
      expect(candidate?.rationale).toContain('Long methods reduce readability and maintainability');

      // Should provide actionable recommendations
      expect(candidate?.rationale).toContain('Recommended actions:');
      expect(candidate?.rationale).toContain('Break long methods into smaller');
    });

    it('should provide contextual explanations for why each code smell type is problematic', () => {
      const representativeSmells: CodeSmell[] = [
        { file: 'src/method.ts', type: 'long-method', severity: 'medium', details: 'Long method details' },
        { file: 'src/class.ts', type: 'large-class', severity: 'medium', details: 'Large class details' },
        { file: 'src/nested.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting details' },
        { file: 'src/dup.ts', type: 'duplicate-code', severity: 'medium', details: 'Duplicate code details' }
      ];

      projectAnalysis.codeQuality.codeSmells = representativeSmells;
      const candidates = analyzer.analyze(projectAnalysis);

      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      expect(longMethodTask?.rationale).toContain('Long methods reduce readability and maintainability');

      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(largeClassTask?.rationale).toContain('Large classes violate Single Responsibility Principle');

      const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      expect(deepNestingTask?.rationale).toContain('Deep nesting makes code difficult to understand and test');

      const duplicateCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      expect(duplicateCodeTask?.rationale).toContain('Duplicate code increases maintenance burden and bug risk');
    });
  });

  describe('Complete Acceptance Criteria Validation', () => {
    it('should fully satisfy all acceptance criteria for a comprehensive code smell scenario', () => {
      const comprehensiveCodeSmells: CodeSmell[] = [
        {
          file: 'src/services/PaymentProcessor.ts',
          type: 'long-method',
          severity: 'critical',
          details: "Method 'processPayment' has 300+ lines, handles validation, calculation, external API calls, logging, and error handling"
        },
        {
          file: 'src/models/UserManager.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class manages users, profiles, permissions, notifications, and audit logs across 950 lines'
        },
        {
          file: 'src/utils/ValidationEngine.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'Validation logic has 9 levels of nested if-else statements starting at line 78'
        },
        {
          file: 'src/auth/AuthService.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Token validation logic duplicated across validateJWT, refreshToken, and validateSession methods'
        },
        {
          file: 'src/legacy/DeprecatedFeatures.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Functions for old authentication system (legacyLogin, oldHashPassword) no longer used'
        },
        {
          file: 'src/config/AppSettings.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Timeout values 30000, 60000, 300000 used without explanation in network configuration'
        },
        {
          file: 'src/notifications/EmailService.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'sendEmail method accesses 12 properties from User object but only 3 from its own class'
        },
        {
          file: 'src/api/ContactController.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'firstName, lastName, email, phone consistently passed together across 7 different endpoints'
        }
      ];

      projectAnalysis.codeQuality.codeSmells = comprehensiveCodeSmells;
      const candidates = analyzer.analyze(projectAnalysis);

      // VALIDATION 1: TaskCandidate objects generated for all code smell types
      expect(candidates).toHaveLength(8);

      const expectedTypes = [
        'long-method', 'large-class', 'deep-nesting', 'duplicate-code',
        'dead-code', 'magic-numbers', 'feature-envy', 'data-clumps'
      ];

      expectedTypes.forEach(type => {
        const candidate = candidates.find(c => c.candidateId === `refactoring-code-smell-${type}`);
        expect(candidate).toBeDefined();
      });

      // VALIDATION 2: Appropriate priority based on severity
      const criticalCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      const highCandidates = candidates.filter(c =>
        c.candidateId === 'refactoring-code-smell-large-class' ||
        c.candidateId === 'refactoring-code-smell-deep-nesting'
      );
      const mediumCandidates = candidates.filter(c =>
        ['duplicate-code', 'magic-numbers', 'feature-envy', 'data-clumps']
          .some(type => c.candidateId === `refactoring-code-smell-${type}`)
      );
      const lowCandidate = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      expect(criticalCandidate?.priority).toBe('urgent');
      highCandidates.forEach(candidate => {
        expect(candidate?.priority).toBe('high');
      });
      mediumCandidates.forEach(candidate => {
        expect(candidate?.priority).toBe('normal');
      });
      expect(lowCandidate?.priority).toBe('low');

      // VALIDATION 3: Effort estimates
      expect(criticalCandidate?.estimatedEffort).toBe('high');
      highCandidates.forEach(candidate => {
        expect(candidate?.estimatedEffort).toBe('high');
      });
      mediumCandidates.forEach(candidate => {
        expect(candidate?.estimatedEffort).toBe('medium');
      });
      expect(lowCandidate?.estimatedEffort).toBe('low');

      // VALIDATION 4: Actionable refactoring suggestions
      candidates.forEach(candidate => {
        expect(candidate?.rationale).toContain('Recommended actions:');
        expect(candidate?.rationale.split('•').length).toBeGreaterThan(2); // At least 2 recommendations
      });

      // VALIDATION 5: Descriptive rationale with original details
      candidates.forEach((candidate, index) => {
        const originalSmell = comprehensiveCodeSmells[index];
        expect(candidate?.rationale).toContain(originalSmell.details.split(' ')[0]); // First word of details
        expect(candidate?.rationale.length).toBeGreaterThan(100); // Substantial rationale
      });

      // VALIDATION 6: All TaskCandidates have proper structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^refactoring-code-smell-/);
        expect(candidate.suggestedWorkflow).toBe('refactoring');
        expect(candidate.title).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });

      // ✅ ALL ACCEPTANCE CRITERIA SATISFIED
    });
  });
});