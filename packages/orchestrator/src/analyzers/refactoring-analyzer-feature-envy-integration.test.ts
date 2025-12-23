/**
 * RefactoringAnalyzer Feature Envy Integration Tests
 *
 * Integration tests for feature envy pattern detection with:
 * - Complex project scenarios combining feature envy with other issues
 * - Real-world use cases and patterns
 * - Performance with large numbers of code smells
 * - Prioritization against complexity hotspots and other refactoring issues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { CodeSmell, ComplexityHotspot } from '@apexcli/core';

describe('RefactoringAnalyzer - Feature Envy Integration Tests', () => {
  let refactoringAnalyzer: RefactoringAnalyzer;
  let complexProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    refactoringAnalyzer = new RefactoringAnalyzer();

    // Complex project analysis with multiple quality issues
    complexProjectAnalysis = {
      codebaseSize: {
        files: 150,
        lines: 25000,
        languages: { 'ts': 100, 'js': 30, 'vue': 20 }
      },
      dependencies: {
        outdated: ['lodash@4.17.15', 'react@17.0.2'],
        security: []
      },
      codeQuality: {
        lintIssues: 45,
        duplicatedCode: ['src/auth/validation.ts', 'src/api/auth-helpers.ts'],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 40,
        missingDocs: ['src/services/', 'src/utils/'],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: ['Contributing', 'Testing'],
        apiCompleteness: {
          percentage: 55,
          details: {
            totalEndpoints: 40,
            documentedEndpoints: 22,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: ['integration/auth.test.ts'],
        bottlenecks: ['src/data/heavy-processor.ts']
      }
    };
  });

  describe('Feature Envy in Large Codebase Scenarios', () => {
    it('should handle enterprise-scale feature envy detection', () => {
      // Simulate a large enterprise codebase with many feature envy issues
      const enterpriseFeatureEnvySmells: CodeSmell[] = [
        {
          file: 'src/services/user/UserNotificationService.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'sendWelcomeEmail method uses 18 User properties and 12 EmailTemplate properties but only 3 from UserNotificationService'
        },
        {
          file: 'src/controllers/order/OrderValidationController.ts',
          type: 'feature-envy',
          severity: 'critical',
          details: 'validateOrderData method extensively uses Product (25 props), Customer (20 props), and Inventory (15 props) data with minimal local usage (2 props)'
        },
        {
          file: 'src/utils/payment/PaymentCalculator.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'calculateTax method heavily depends on Customer address and Product category information rather than its own calculation logic'
        },
        {
          file: 'src/services/inventory/StockUpdater.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'updateStockLevel method primarily manipulates Product and Warehouse data instead of focusing on stock operations'
        },
        {
          file: 'src/api/analytics/ReportGenerator.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'generateSalesReport method uses extensive Order, Customer, and Product data while having minimal report-specific logic'
        }
      ];

      // Add complexity hotspots to test prioritization
      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/services/user/UserNotificationService.ts',
          cyclomaticComplexity: 45,
          cognitiveComplexity: 55,
          lineCount: 1200
        },
        {
          file: 'src/controllers/order/OrderValidationController.ts',
          cyclomaticComplexity: 60,
          cognitiveComplexity: 75,
          lineCount: 1800
        }
      ];

      complexProjectAnalysis.codeQuality.codeSmells = enterpriseFeatureEnvySmells;
      complexProjectAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      // Should generate multiple candidates including feature envy, complexity hotspots, and duplicated code
      expect(candidates.length).toBeGreaterThan(4);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.title).toBe('Fix Feature Envy');
      expect(featureEnvyTask?.description).toContain('5 misplaced methods');
      expect(featureEnvyTask?.priority).toBe('urgent'); // Due to critical severity
      expect(featureEnvyTask?.estimatedEffort).toBe('high');

      // Should include files in description (truncated to first 3)
      expect(featureEnvyTask?.description).toContain('UserNotificationService.ts');
      expect(featureEnvyTask?.description).toContain('OrderValidationController.ts');
      expect(featureEnvyTask?.description).toContain('PaymentCalculator.ts');
      expect(featureEnvyTask?.description).toContain('and 2 more');

      // Should have high score due to critical severity and multiple instances
      expect(featureEnvyTask?.score).toBeGreaterThan(0.85);
    });

    it('should prioritize feature envy appropriately against complexity hotspots', () => {
      const criticalFeatureEnvy: CodeSmell = {
        file: 'src/core/PaymentProcessor.ts',
        type: 'feature-envy',
        severity: 'critical',
        details: 'processPayment method violates architectural boundaries by directly accessing CreditCard, Bank, Merchant, and Fraud detection systems'
      };

      const highComplexityHotspot: ComplexityHotspot = {
        file: 'src/utils/DataProcessor.ts',
        cyclomaticComplexity: 35,
        cognitiveComplexity: 45,
        lineCount: 800
      };

      complexProjectAnalysis.codeQuality.codeSmells = [criticalFeatureEnvy];
      complexProjectAnalysis.codeQuality.complexityHotspots = [highComplexityHotspot];

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');
      const duplicateCodeTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');

      // Critical feature envy should score higher than high complexity hotspot
      expect(featureEnvyTask?.score).toBeGreaterThan(complexityTask?.score || 0);

      // But duplicated code (architectural issue) should still have highest priority
      expect(duplicateCodeTask?.score).toBeGreaterThan(featureEnvyTask?.score || 0);
    });
  });

  describe('Feature Envy with Mixed Code Quality Issues', () => {
    it('should handle feature envy alongside all other code smell types', () => {
      const comprehensiveCodeSmells: CodeSmell[] = [
        {
          file: 'src/services/LongProcessingService.ts',
          type: 'long-method',
          severity: 'high',
          details: 'processComplexData method has 150 lines with nested loops and conditionals'
        },
        {
          file: 'src/models/MegaUserModel.ts',
          type: 'large-class',
          severity: 'critical',
          details: 'UserModel class has 2000+ lines with 50+ methods handling authentication, profile, preferences, billing, and notifications'
        },
        {
          file: 'src/parsers/NestedDataParser.ts',
          type: 'deep-nesting',
          severity: 'high',
          details: 'parseComplexStructure method has 8 levels of nesting making it extremely difficult to follow'
        },
        {
          file: 'src/validation/SharedValidation.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Email validation logic duplicated in UserValidator, OrderValidator, and ContactValidator'
        },
        {
          file: 'src/legacy/UnusedHelpers.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Functions formatLegacyDate, convertOldFormat, and validateDeprecatedInput are no longer used'
        },
        {
          file: 'src/config/AppConstants.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Timeout values 30000, 60000, 300000 used throughout configuration without named constants'
        },
        {
          file: 'src/billing/InvoiceGenerator.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'generateInvoice method extensively uses Customer billing address, Product pricing, and Tax calculation data instead of focusing on invoice generation logic'
        },
        {
          file: 'src/api/UserEndpoints.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters userId, userName, userEmail, userPhone are consistently passed together across 8 different methods'
        }
      ];

      complexProjectAnalysis.codeQuality.codeSmells = comprehensiveCodeSmells;

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      // Should create 8 code smell tasks + 1 duplicated code task + linting task
      expect(candidates.length).toBeGreaterThan(8);

      // Verify feature envy task exists and is properly configured
      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.title).toBe('Fix Feature Envy');
      expect(featureEnvyTask?.priority).toBe('high');
      expect(featureEnvyTask?.estimatedEffort).toBe('high');
      expect(featureEnvyTask?.description).toContain('InvoiceGenerator.ts');

      // Verify all expected code smell tasks exist
      const expectedSmellTypes = [
        'long-method', 'large-class', 'deep-nesting', 'duplicate-code',
        'dead-code', 'magic-numbers', 'feature-envy', 'data-clumps'
      ];

      expectedSmellTypes.forEach(smellType => {
        const task = candidates.find(c => c.candidateId === `refactoring-code-smell-${smellType}`);
        expect(task).toBeDefined();
        expect(task?.suggestedWorkflow).toBe('refactoring');
      });

      // Verify proper prioritization
      const criticalTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      const highTasks = candidates.filter(c =>
        c.candidateId === 'refactoring-code-smell-long-method' ||
        c.candidateId === 'refactoring-code-smell-deep-nesting' ||
        c.candidateId === 'refactoring-code-smell-feature-envy'
      );

      expect(criticalTask?.priority).toBe('urgent');
      highTasks.forEach(task => {
        expect(task?.priority).toBe('high');
      });
    });

    it('should handle performance implications of large feature envy analysis', () => {
      // Simulate a very large number of feature envy instances
      const manyFeatureEnvySmells: CodeSmell[] = Array.from({ length: 50 }, (_, i) => ({
        file: `src/modules/module${i}/Service${i}.ts`,
        type: 'feature-envy',
        severity: i % 4 === 0 ? 'critical' : i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
        details: `Service${i} method accesses extensive external class data instead of its own properties`
      }));

      complexProjectAnalysis.codeQuality.codeSmells = manyFeatureEnvySmells;

      const startTime = performance.now();
      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);
      const endTime = performance.now();

      // Should complete analysis in reasonable time (< 100ms for 50 smells)
      expect(endTime - startTime).toBeLessThan(100);

      // Should still generate proper task
      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.description).toContain('50 misplaced methods');

      // Should prioritize based on highest severity (critical)
      expect(featureEnvyTask?.priority).toBe('urgent');
      expect(featureEnvyTask?.score).toBeGreaterThan(0.9);
    });
  });

  describe('Real-World Feature Envy Scenarios', () => {
    it('should handle microservices architecture feature envy patterns', () => {
      const microservicesFeatureEnvy: CodeSmell[] = [
        {
          file: 'src/services/user-service/UserController.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'getUserPreferences method makes extensive calls to ProfileService, SettingsService, and NotificationService APIs instead of using local user data'
        },
        {
          file: 'src/services/order-service/OrderProcessor.ts',
          type: 'feature-envy',
          severity: 'critical',
          details: 'processOrder method directly accesses inventory-service, payment-service, and shipping-service internals violating service boundaries'
        },
        {
          file: 'src/services/notification-service/EmailSender.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'composeEmail method uses extensive User and Order data that should be provided as parameters or messages'
        }
      ];

      complexProjectAnalysis.codeQuality.codeSmells = microservicesFeatureEnvy;

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.priority).toBe('urgent'); // Due to critical severity
      expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data they use');
      expect(featureEnvyTask?.rationale).toContain('Consider creating new classes for complex interactions');

      // Should recommend microservice-appropriate solutions
      expect(featureEnvyTask?.rationale).toContain('delegation pattern');
    });

    it('should handle domain-driven design feature envy patterns', () => {
      const dddFeatureEnvy: CodeSmell[] = [
        {
          file: 'src/domain/billing/BillingService.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'calculateBilling method extensively uses Customer address, Product pricing, and Tax rules instead of working with domain objects'
        },
        {
          file: 'src/domain/inventory/StockManager.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'updateStock method directly manipulates Product and Warehouse entities instead of using domain services'
        },
        {
          file: 'src/application/UserRegistrationService.ts',
          type: 'feature-envy',
          severity: 'critical',
          details: 'registerUser method bypasses domain layer and directly accesses User aggregate internals, violating DDD principles'
        }
      ];

      complexProjectAnalysis.codeQuality.codeSmells = dddFeatureEnvy;

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.priority).toBe('urgent'); // Critical DDD violation
      expect(featureEnvyTask?.rationale).toContain('Extract methods into the appropriate classes');
      expect(featureEnvyTask?.rationale).toContain('registerUser method bypasses domain layer'); // Should include specific details
    });

    it('should handle frontend component feature envy patterns', () => {
      const frontendFeatureEnvy: CodeSmell[] = [
        {
          file: 'src/components/UserProfile.vue',
          type: 'feature-envy',
          severity: 'medium',
          details: 'UserProfile component directly accesses UserStore, SettingsStore, and NotificationStore instead of using props or computed properties'
        },
        {
          file: 'src/components/OrderForm.tsx',
          type: 'feature-envy',
          severity: 'high',
          details: 'OrderForm component extensively manipulates Product and Inventory state that should be handled by parent components or services'
        },
        {
          file: 'src/utils/FormValidation.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'validateOrderForm function directly accesses component state and props instead of receiving data as parameters'
        }
      ];

      complexProjectAnalysis.codeQuality.codeSmells = frontendFeatureEnvy;

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();
      expect(featureEnvyTask?.priority).toBe('high'); // Frontend architecture violation
      expect(featureEnvyTask?.description).toContain('UserProfile.vue, OrderForm.tsx, FormValidation.ts');
      expect(featureEnvyTask?.rationale).toContain('Move methods closer to the data they use');
    });
  });

  describe('Feature Envy Impact Analysis', () => {
    it('should consider feature envy impact on maintainability metrics', () => {
      // Feature envy in critical business logic
      const businessCriticalFeatureEnvy: CodeSmell[] = [
        {
          file: 'src/core/PaymentProcessor.ts',
          type: 'feature-envy',
          severity: 'critical',
          details: 'processPayment method creates tight coupling with 5 external payment systems making changes extremely risky'
        },
        {
          file: 'src/core/SecurityValidator.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'validateAccess method extensively uses User roles, Permissions, and Resource data creating security maintenance complexity'
        }
      ];

      // Also add complexity to show combined impact
      const criticalComplexity: ComplexityHotspot = {
        file: 'src/core/PaymentProcessor.ts',
        cyclomaticComplexity: 60,
        cognitiveComplexity: 75,
        lineCount: 1500
      };

      complexProjectAnalysis.codeQuality.codeSmells = businessCriticalFeatureEnvy;
      complexProjectAnalysis.codeQuality.complexityHotspots = [criticalComplexity];

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      const complexityTask = candidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

      // Both should be urgent priority
      expect(featureEnvyTask?.priority).toBe('urgent');
      expect(complexityTask?.priority).toBe('urgent');

      // High scores due to business criticality
      expect(featureEnvyTask?.score).toBeGreaterThan(0.85);
      expect(complexityTask?.score).toBeGreaterThan(0.85);

      // Should highlight business impact
      expect(featureEnvyTask?.rationale).toContain('tight coupling with 5 external payment systems');
    });

    it('should handle feature envy in test code appropriately', () => {
      const testFeatureEnvy: CodeSmell[] = [
        {
          file: 'src/__tests__/UserService.test.ts',
          type: 'feature-envy',
          severity: 'low',
          details: 'Test setup extensively accesses User, Database, and MockService internals which is common in testing'
        },
        {
          file: 'src/core/UserService.ts',
          type: 'feature-envy',
          severity: 'high',
          details: 'getUserData method extensively uses Database and Cache internals instead of service interfaces'
        }
      ];

      complexProjectAnalysis.codeQuality.codeSmells = testFeatureEnvy;

      const candidates = refactoringAnalyzer.analyze(complexProjectAnalysis);

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask).toBeDefined();

      // Should prioritize production code issues over test code
      expect(featureEnvyTask?.priority).toBe('high'); // Driven by high severity production code
      expect(featureEnvyTask?.description).toContain('UserService.test.ts, UserService.ts');
    });
  });
});