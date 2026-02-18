/**
 * @fileoverview Permission-Aware Test Scenarios for Browser Integration Testing
 *
 * This file provides comprehensive test scenarios that specifically test browser automation
 * functionality under various permission constraints and denial conditions.
 *
 * Features:
 * - Permission denial scenarios for all major browser operations
 * - Graceful degradation test patterns
 * - Edge case permission testing
 * - Recovery and retry scenarios
 * - Error handling validation scenarios
 * - Permission escalation testing
 */

import { Page, BrowserContext } from 'playwright';
import type {
  BrowserAutomationContext,
  BrowserOperationResult,
  BrowserTestScenario,
} from '../utils/browser-automation-test-helpers.js';
import {
  BrowserPermissionMockManager,
  createPermissionMockManager,
  type BrowserPermissionMockConfig,
} from '../utils/browser-permission-mocks.js';

// ============================================================================
// Permission Test Scenario Types
// ============================================================================

/**
 * Permission-specific test scenario configuration
 */
export interface PermissionTestScenario extends BrowserTestScenario {
  // Permission-specific properties
  permissionConfig: BrowserPermissionMockConfig | 'strict' | 'permissive' | 'partial';
  expectedDenials: string[];
  gracefulDegradation: {
    enabled: boolean;
    fallbackOperations?: string[];
    expectedFallbackResults?: any[];
  };
  retryBehavior: {
    shouldRetry: boolean;
    maxRetries?: number;
    backoffStrategy?: 'linear' | 'exponential' | 'fixed';
  };
}

/**
 * Permission test result with detailed analysis
 */
export interface PermissionTestResult {
  scenario: string;
  success: boolean;
  permissionsChecked: number;
  permissionsDenied: number;
  permissionsGranted: number;
  operationsAttempted: number;
  operationsSuccessful: number;
  operationsFailed: number;
  gracefulDegradationTriggered: boolean;
  retryAttempts: number;
  errorDetails: Array<{
    operation: string;
    error: string;
    permissionRelated: boolean;
    recoverable: boolean;
  }>;
  performanceMetrics: {
    totalDuration: number;
    permissionCheckDuration: number;
    operationExecutionDuration: number;
    memoryUsage?: number;
  };
  mockManagerReport: any;
}

// ============================================================================
// Core Permission Denial Scenarios
// ============================================================================

/**
 * Navigation permission denial scenarios
 */
export const NAVIGATION_PERMISSION_SCENARIOS: PermissionTestScenario[] = [
  {
    name: 'Navigation - Complete Domain Block',
    description: 'Test navigation when all domains are blocked',
    permissionConfig: {
      permissions: {} as any,
      advancedControls: {
        blockNetworkRequests: true,
        blockedDomains: ['*'],
        allowedDomains: [],
        simulateNetworkFailures: false,
        blockJavaScriptExecution: false,
        blockedScripts: [],
        simulateScriptErrors: false,
        blockFileAccess: false,
        blockedPaths: [],
        blockConsoleAccess: false,
        simulateConsoleErrors: false,
        blockFormSubmissions: false,
        blockInputEvents: false,
      },
      failureSimulation: {
        randomFailureRate: 0,
        failOperations: [],
        simulateTimeouts: false,
        simulateMemoryErrors: false,
      },
      responseBehavior: {
        responseDelay: 0,
        unclearErrors: true,
        inconsistentBehavior: false,
      },
    },
    expectedDenials: ['navigate'],
    gracefulDegradation: {
      enabled: true,
      fallbackOperations: ['setContent'],
      expectedFallbackResults: [{ success: true }],
    },
    retryBehavior: {
      shouldRetry: true,
      maxRetries: 2,
      backoffStrategy: 'exponential',
    },
    expectedPermissions: [],
    shouldFail: true,
    retries: 2,

    async setup(context: BrowserAutomationContext): Promise<void> {
      // No special setup required
    },

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      // Attempt to navigate to a test URL
      const manager = context as any; // Type assertion for access
      return await manager.executeOperation(context, 'navigate', {
        url: 'https://example.com'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      // Should fail due to domain blocking
      if (result.success) {
        throw new Error('Navigation should have been blocked');
      }

      // Should be permission-related
      if (!result.error?.includes('blocked') && !result.permissionDenied) {
        throw new Error('Expected permission-related error');
      }
    }
  },

  {
    name: 'Navigation - Selective Domain Block',
    description: 'Test navigation with specific domains blocked',
    permissionConfig: 'partial',
    expectedDenials: ['navigate:malicious.com'],
    gracefulDegradation: {
      enabled: false,
    },
    retryBehavior: {
      shouldRetry: false,
    },
    expectedPermissions: [],
    shouldFail: true,

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;
      return await manager.executeOperation(context, 'navigate', {
        url: 'https://malicious.com'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      if (result.success) {
        throw new Error('Navigation to blocked domain should have failed');
      }
    }
  },
];

/**
 * JavaScript execution permission scenarios
 */
export const JAVASCRIPT_PERMISSION_SCENARIOS: PermissionTestScenario[] = [
  {
    name: 'JavaScript - Complete Execution Block',
    description: 'Test JavaScript execution when completely blocked',
    permissionConfig: 'strict',
    expectedDenials: ['evaluate'],
    gracefulDegradation: {
      enabled: true,
      fallbackOperations: ['getText', 'getAttribute'],
    },
    retryBehavior: {
      shouldRetry: false,
    },
    expectedPermissions: [],
    shouldFail: true,

    async setup(context: BrowserAutomationContext): Promise<void> {
      // Create a test page with JavaScript
      if (context.page) {
        await context.page.setContent(`
          <html>
            <body>
              <div id="test" data-value="static-value">Test Content</div>
              <script>
                document.getElementById('test').setAttribute('data-dynamic', 'dynamic-value');
              </script>
            </body>
          </html>
        `);
      }
    },

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;
      return await manager.executeOperation(context, 'evaluate', {
        script: 'document.getElementById("test").textContent'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      if (result.success) {
        throw new Error('JavaScript execution should have been blocked');
      }

      // Test fallback to non-JavaScript methods
      const manager = context as any;
      const fallbackResult = await manager.executeOperation(context, 'getText', {
        selector: '#test'
      });

      if (!fallbackResult.success) {
        throw new Error('Fallback getText operation should have succeeded');
      }
    }
  },

  {
    name: 'JavaScript - Selective Script Blocking',
    description: 'Test blocking of specific JavaScript patterns',
    permissionConfig: 'partial',
    expectedDenials: ['evaluate:eval'],
    gracefulDegradation: {
      enabled: true,
    },
    retryBehavior: {
      shouldRetry: true,
      maxRetries: 1,
    },
    expectedPermissions: [],
    shouldFail: true,

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;
      return await manager.executeOperation(context, 'evaluate', {
        script: 'eval("1 + 1")'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      if (result.success) {
        throw new Error('eval() should have been blocked');
      }

      // Test that normal JavaScript works
      const manager = context as any;
      const normalResult = await manager.executeOperation(context, 'evaluate', {
        script: '1 + 1'
      });

      if (!normalResult.success) {
        throw new Error('Normal JavaScript should work');
      }
    }
  },
];

/**
 * Form interaction permission scenarios
 */
export const FORM_PERMISSION_SCENARIOS: PermissionTestScenario[] = [
  {
    name: 'Forms - Complete Form Submission Block',
    description: 'Test form interactions when submissions are blocked',
    permissionConfig: {
      permissions: {} as any,
      advancedControls: {
        blockNetworkRequests: false,
        blockedDomains: [],
        allowedDomains: ['*'],
        simulateNetworkFailures: false,
        blockJavaScriptExecution: false,
        blockedScripts: [],
        simulateScriptErrors: false,
        blockFileAccess: false,
        blockedPaths: [],
        blockConsoleAccess: false,
        simulateConsoleErrors: false,
        blockFormSubmissions: true,
        blockInputEvents: false,
      },
      failureSimulation: {
        randomFailureRate: 0,
        failOperations: [],
        simulateTimeouts: false,
        simulateMemoryErrors: false,
      },
      responseBehavior: {
        responseDelay: 0,
        unclearErrors: false,
        inconsistentBehavior: false,
      },
    },
    expectedDenials: ['submit'],
    gracefulDegradation: {
      enabled: true,
      fallbackOperations: ['type', 'click'],
    },
    retryBehavior: {
      shouldRetry: false,
    },
    expectedPermissions: [],
    shouldFail: true,

    async setup(context: BrowserAutomationContext): Promise<void> {
      if (context.page) {
        await context.page.setContent(`
          <html>
            <body>
              <form id="testForm">
                <input type="text" name="username" id="username" />
                <input type="password" name="password" id="password" />
                <button type="submit" id="submitBtn">Submit</button>
              </form>
            </body>
          </html>
        `);
      }
    },

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;

      // First fill the form
      await manager.executeOperation(context, 'type', {
        selector: '#username',
        text: 'testuser'
      });

      await manager.executeOperation(context, 'type', {
        selector: '#password',
        text: 'testpass'
      });

      // Then try to submit (should be blocked)
      return await manager.executeOperation(context, 'click', {
        selector: '#submitBtn'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      // The click might succeed, but form submission should be prevented
      // We need to check for JavaScript errors or prevented events
      if (context.consoleLogs) {
        const hasSubmissionError = context.consoleLogs.some(log =>
          log.text.includes('Form submission blocked')
        );
        if (!hasSubmissionError) {
          console.warn('Expected form submission blocking error in console logs');
        }
      }
    }
  },

  {
    name: 'Forms - Input Event Blocking',
    description: 'Test form filling when input events are blocked',
    permissionConfig: {
      permissions: {} as any,
      advancedControls: {
        blockNetworkRequests: false,
        blockedDomains: [],
        allowedDomains: ['*'],
        simulateNetworkFailures: false,
        blockJavaScriptExecution: false,
        blockedScripts: [],
        simulateScriptErrors: false,
        blockFileAccess: false,
        blockedPaths: [],
        blockConsoleAccess: false,
        simulateConsoleErrors: false,
        blockFormSubmissions: false,
        blockInputEvents: true,
      },
      failureSimulation: {
        randomFailureRate: 0,
        failOperations: [],
        simulateTimeouts: false,
        simulateMemoryErrors: false,
      },
      responseBehavior: {
        responseDelay: 0,
        unclearErrors: false,
        inconsistentBehavior: false,
      },
    },
    expectedDenials: ['type', 'click'],
    gracefulDegradation: {
      enabled: true,
      fallbackOperations: ['evaluate'],
    },
    retryBehavior: {
      shouldRetry: true,
      maxRetries: 1,
    },
    expectedPermissions: [],
    shouldFail: true,

    async setup(context: BrowserAutomationContext): Promise<void> {
      if (context.page) {
        await context.page.setContent(`
          <html>
            <body>
              <input type="text" id="blockedInput" />
            </body>
          </html>
        `);
      }
    },

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;
      return await manager.executeOperation(context, 'type', {
        selector: '#blockedInput',
        text: 'should not work'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      // Input events should be blocked, so this might appear to succeed
      // but the value shouldn't be set. We'd need to check the actual input value.
      const manager = context as any;
      const getValue = await manager.executeOperation(context, 'evaluate', {
        script: 'document.getElementById("blockedInput").value'
      });

      if (getValue.success && getValue.data?.result === 'should not work') {
        throw new Error('Input should have been blocked');
      }
    }
  },
];

/**
 * Screenshot permission scenarios
 */
export const SCREENSHOT_PERMISSION_SCENARIOS: PermissionTestScenario[] = [
  {
    name: 'Screenshot - Complete Block',
    description: 'Test screenshot capture when completely blocked',
    permissionConfig: {
      permissions: {
        'display-capture': 'denied',
      } as any,
      advancedControls: {
        blockNetworkRequests: false,
        blockedDomains: [],
        allowedDomains: ['*'],
        simulateNetworkFailures: false,
        blockJavaScriptExecution: false,
        blockedScripts: [],
        simulateScriptErrors: false,
        blockFileAccess: false,
        blockedPaths: [],
        blockConsoleAccess: false,
        simulateConsoleErrors: false,
        blockFormSubmissions: false,
        blockInputEvents: false,
      },
      failureSimulation: {
        randomFailureRate: 0,
        failOperations: ['screenshot'],
        simulateTimeouts: false,
        simulateMemoryErrors: false,
      },
      responseBehavior: {
        responseDelay: 0,
        unclearErrors: false,
        inconsistentBehavior: false,
      },
    },
    expectedDenials: ['screenshot'],
    gracefulDegradation: {
      enabled: true,
      fallbackOperations: ['getText'],
    },
    retryBehavior: {
      shouldRetry: true,
      maxRetries: 2,
      backoffStrategy: 'linear',
    },
    expectedPermissions: [],
    shouldFail: true,

    async setup(context: BrowserAutomationContext): Promise<void> {
      if (context.page) {
        await context.page.setContent(`
          <html>
            <body>
              <h1>Screenshot Test Page</h1>
              <p>This page should not be screenshotted</p>
            </body>
          </html>
        `);
      }
    },

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;
      return await manager.executeOperation(context, 'screenshot', {
        name: 'blocked-screenshot'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      if (result.success) {
        throw new Error('Screenshot should have been blocked');
      }

      // Test fallback to text extraction
      const manager = context as any;
      const textResult = await manager.executeOperation(context, 'getText', {
        selector: 'h1'
      });

      if (!textResult.success) {
        throw new Error('Fallback text extraction should work');
      }
    }
  },
];

/**
 * Console access permission scenarios
 */
export const CONSOLE_PERMISSION_SCENARIOS: PermissionTestScenario[] = [
  {
    name: 'Console - Complete Access Block',
    description: 'Test console interaction when access is blocked',
    permissionConfig: 'strict',
    expectedDenials: ['console'],
    gracefulDegradation: {
      enabled: true,
      fallbackOperations: ['evaluate'],
    },
    retryBehavior: {
      shouldRetry: false,
    },
    expectedPermissions: [],
    shouldFail: true,

    async setup(context: BrowserAutomationContext): Promise<void> {
      if (context.page) {
        await context.page.setContent(`
          <html>
            <body>
              <div id="test">Console Test</div>
            </body>
          </html>
        `);
      }
    },

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;
      return await manager.executeOperation(context, 'evaluate', {
        script: 'console.log("This should be blocked"); "test result"'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      // The console.log should throw an error, preventing the script from completing
      if (result.success) {
        console.warn('Console access blocking may not be working properly');
      }
    }
  },
];

// ============================================================================
// Edge Case and Recovery Scenarios
// ============================================================================

/**
 * Edge case permission scenarios
 */
export const EDGE_CASE_PERMISSION_SCENARIOS: PermissionTestScenario[] = [
  {
    name: 'Edge Case - Inconsistent Permission Behavior',
    description: 'Test behavior when permissions change inconsistently',
    permissionConfig: {
      permissions: {} as any,
      advancedControls: {
        blockNetworkRequests: false,
        blockedDomains: [],
        allowedDomains: ['*'],
        simulateNetworkFailures: false,
        blockJavaScriptExecution: false,
        blockedScripts: [],
        simulateScriptErrors: false,
        blockFileAccess: false,
        blockedPaths: [],
        blockConsoleAccess: false,
        simulateConsoleErrors: false,
        blockFormSubmissions: false,
        blockInputEvents: false,
      },
      failureSimulation: {
        randomFailureRate: 0.3,
        failOperations: [],
        simulateTimeouts: true,
        simulateMemoryErrors: false,
      },
      responseBehavior: {
        responseDelay: 1000,
        unclearErrors: true,
        inconsistentBehavior: true,
      },
    },
    expectedDenials: [],
    gracefulDegradation: {
      enabled: true,
    },
    retryBehavior: {
      shouldRetry: true,
      maxRetries: 3,
      backoffStrategy: 'exponential',
    },
    expectedPermissions: [],
    shouldFail: false,

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      const manager = context as any;

      // Try multiple operations to test inconsistent behavior
      const operations = ['navigate', 'screenshot', 'evaluate', 'getText'];
      let successCount = 0;
      let lastResult: BrowserOperationResult = {} as any;

      for (const operation of operations) {
        try {
          const result = await manager.executeOperation(context, operation, {
            url: 'data:text/html,<h1>Test</h1>',
            script: '1 + 1',
            selector: 'h1',
            name: 'test'
          });

          if (result.success) {
            successCount++;
          }
          lastResult = result;
        } catch (error) {
          // Expected due to inconsistent behavior
        }
      }

      return {
        success: successCount > 0,
        operation: 'multiple-operations',
        data: { successCount, totalOperations: operations.length },
        metadata: lastResult.metadata || {
          timestamp: new Date(),
          duration: 0,
          resourceState: {},
          permissionChecked: false,
        },
      };
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      // With inconsistent behavior, we expect some operations to succeed and some to fail
      const successCount = result.data?.successCount || 0;
      if (successCount === 0) {
        throw new Error('Expected at least some operations to succeed with inconsistent behavior');
      }

      if (successCount === 4) {
        console.warn('All operations succeeded - inconsistent behavior may not be working');
      }
    }
  },

  {
    name: 'Edge Case - Permission System Failure',
    description: 'Test behavior when permission system itself fails',
    permissionConfig: {
      permissions: {} as any,
      advancedControls: {
        blockNetworkRequests: false,
        blockedDomains: [],
        allowedDomains: ['*'],
        simulateNetworkFailures: false,
        blockJavaScriptExecution: false,
        blockedScripts: [],
        simulateScriptErrors: false,
        blockFileAccess: false,
        blockedPaths: [],
        blockConsoleAccess: false,
        simulateConsoleErrors: false,
        blockFormSubmissions: false,
        blockInputEvents: false,
      },
      failureSimulation: {
        randomFailureRate: 0,
        failOperations: [],
        simulateTimeouts: false,
        simulateMemoryErrors: true,
      },
      responseBehavior: {
        responseDelay: 0,
        unclearErrors: true,
        inconsistentBehavior: false,
      },
    },
    expectedDenials: [],
    gracefulDegradation: {
      enabled: true,
    },
    retryBehavior: {
      shouldRetry: true,
      maxRetries: 2,
    },
    expectedPermissions: [],
    shouldFail: false, // Should handle gracefully

    async execute(context: BrowserAutomationContext): Promise<BrowserOperationResult> {
      // Simulate permission system failure by corrupting the permission manager
      if (context.permissions?.manager) {
        context.permissions.manager.checkToolPermission = vi.fn().mockRejectedValue(
          new Error('Permission database connection lost')
        );
      }

      const manager = context as any;
      return await manager.executeOperation(context, 'navigate', {
        url: 'data:text/html,<h1>Test</h1>'
      });
    },

    async validate(context: BrowserAutomationContext, result: BrowserOperationResult): Promise<void> {
      // Should handle permission system failure gracefully
      if (result.success) {
        // Good - operation succeeded despite permission system failure
      } else if (result.error?.includes('Permission')) {
        // Also acceptable - clear error about permission system
      } else {
        throw new Error('Unexpected error handling for permission system failure');
      }
    }
  },
];

// ============================================================================
// Comprehensive Permission Test Suite
// ============================================================================

/**
 * All permission test scenarios organized by category
 */
export const ALL_PERMISSION_SCENARIOS: Record<string, PermissionTestScenario[]> = {
  navigation: NAVIGATION_PERMISSION_SCENARIOS,
  javascript: JAVASCRIPT_PERMISSION_SCENARIOS,
  forms: FORM_PERMISSION_SCENARIOS,
  screenshots: SCREENSHOT_PERMISSION_SCENARIOS,
  console: CONSOLE_PERMISSION_SCENARIOS,
  edgeCases: EDGE_CASE_PERMISSION_SCENARIOS,
};

/**
 * Flattened list of all permission scenarios
 */
export const FLAT_PERMISSION_SCENARIOS: PermissionTestScenario[] = Object.values(ALL_PERMISSION_SCENARIOS).flat();

/**
 * Run a specific category of permission tests
 */
export async function runPermissionTestCategory(
  category: keyof typeof ALL_PERMISSION_SCENARIOS,
  context: BrowserAutomationContext
): Promise<PermissionTestResult[]> {
  const scenarios = ALL_PERMISSION_SCENARIOS[category];
  const results: PermissionTestResult[] = [];

  for (const scenario of scenarios) {
    const result = await runPermissionScenario(scenario, context);
    results.push(result);
  }

  return results;
}

/**
 * Run a single permission scenario with comprehensive reporting
 */
export async function runPermissionScenario(
  scenario: PermissionTestScenario,
  context: BrowserAutomationContext
): Promise<PermissionTestResult> {
  const startTime = Date.now();
  let mockManager: BrowserPermissionMockManager;

  // Create mock manager with scenario configuration
  if (typeof scenario.permissionConfig === 'string') {
    mockManager = createPermissionMockManager(scenario.permissionConfig);
  } else {
    mockManager = new BrowserPermissionMockManager(scenario.permissionConfig);
  }

  // Apply mocks to page
  if (context.page) {
    await mockManager.applyMocks(context.page);
  }

  const result: PermissionTestResult = {
    scenario: scenario.name,
    success: false,
    permissionsChecked: 0,
    permissionsDenied: 0,
    permissionsGranted: 0,
    operationsAttempted: 0,
    operationsSuccessful: 0,
    operationsFailed: 0,
    gracefulDegradationTriggered: false,
    retryAttempts: 0,
    errorDetails: [],
    performanceMetrics: {
      totalDuration: 0,
      permissionCheckDuration: 0,
      operationExecutionDuration: 0,
    },
    mockManagerReport: {},
  };

  try {
    // Run the scenario
    const manager = context as any;
    if (manager && manager.runScenario) {
      const scenarioResult = await manager.runScenario(context, scenario);
      result.success = scenarioResult.success;

      if (scenarioResult.result) {
        result.operationsAttempted = 1;
        if (scenarioResult.result.success) {
          result.operationsSuccessful = 1;
        } else {
          result.operationsFailed = 1;
          result.errorDetails.push({
            operation: scenarioResult.result.operation,
            error: scenarioResult.result.error || 'Unknown error',
            permissionRelated: !!scenarioResult.result.permissionDenied,
            recoverable: !scenarioResult.result.permissionDenied,
          });
        }
      }
    }

    // Get mock manager report
    result.mockManagerReport = mockManager.generateReport();

    // Extract permission statistics
    const mockState = mockManager.getMockState();
    result.permissionsChecked = mockState.permissionRequests.length;
    result.permissionsDenied = mockState.permissionRequests.filter(r => r.result === 'denied').length;
    result.permissionsGranted = mockState.permissionRequests.filter(r => r.result === 'granted').length;

  } catch (error) {
    result.success = false;
    result.errorDetails.push({
      operation: scenario.name,
      error: `${error}`,
      permissionRelated: false,
      recoverable: false,
    });
  } finally {
    // Calculate performance metrics
    result.performanceMetrics.totalDuration = Date.now() - startTime;

    // Deactivate mocks
    mockManager.deactivate();
  }

  return result;
}

/**
 * Generate a comprehensive permission test report
 */
export function generatePermissionTestReport(results: PermissionTestResult[]): any {
  const totalScenarios = results.length;
  const successfulScenarios = results.filter(r => r.success).length;
  const failedScenarios = totalScenarios - successfulScenarios;

  const totalPermissionsChecked = results.reduce((sum, r) => sum + r.permissionsChecked, 0);
  const totalPermissionsDenied = results.reduce((sum, r) => sum + r.permissionsDenied, 0);
  const totalPermissionsGranted = results.reduce((sum, r) => sum + r.permissionsGranted, 0);

  const totalOperationsAttempted = results.reduce((sum, r) => sum + r.operationsAttempted, 0);
  const totalOperationsSuccessful = results.reduce((sum, r) => sum + r.operationsSuccessful, 0);
  const totalOperationsFailed = results.reduce((sum, r) => sum + r.operationsFailed, 0);

  const averageDuration = results.reduce((sum, r) => sum + r.performanceMetrics.totalDuration, 0) / totalScenarios;

  return {
    summary: {
      totalScenarios,
      successfulScenarios,
      failedScenarios,
      successRate: (successfulScenarios / totalScenarios) * 100,
    },
    permissions: {
      totalChecked: totalPermissionsChecked,
      totalDenied: totalPermissionsDenied,
      totalGranted: totalPermissionsGranted,
      denialRate: totalPermissionsChecked > 0 ? (totalPermissionsDenied / totalPermissionsChecked) * 100 : 0,
    },
    operations: {
      totalAttempted: totalOperationsAttempted,
      totalSuccessful: totalOperationsSuccessful,
      totalFailed: totalOperationsFailed,
      successRate: totalOperationsAttempted > 0 ? (totalOperationsSuccessful / totalOperationsAttempted) * 100 : 0,
    },
    performance: {
      averageDuration,
      totalDuration: results.reduce((sum, r) => sum + r.performanceMetrics.totalDuration, 0),
    },
    scenarios: results,
    detailedErrors: results.flatMap(r =>
      r.errorDetails.map(error => ({
        scenario: r.scenario,
        ...error,
      }))
    ),
  };
}

// Export scenario lists and utility functions
export {
  PermissionTestScenario,
  PermissionTestResult,
  runPermissionTestCategory,
  runPermissionScenario,
  generatePermissionTestReport,
};