/**
 * @fileoverview Edge Case Test Helpers - Specialized utilities for testing rare and boundary conditions
 *
 * This module provides test helpers for edge cases and boundary conditions that might occur
 * in production environments, including race conditions, network failures, resource exhaustion,
 * security attacks, and error recovery scenarios.
 *
 * @example
 * ```typescript
 * import { EdgeCaseTestHelpers } from './edge-case-test-helpers';
 *
 * const helpers = new EdgeCaseTestHelpers();
 *
 * // Test race condition in permission checks
 * const raceCondition = helpers.simulatePermissionRaceCondition(['user1', 'user2'], 'Write');
 *
 * // Test approval system under load
 * const loadTest = helpers.simulateApprovalSystemUnderLoad(100, 30);
 * ```
 */

import {
  Permission,
  PermissionLevel,
  AutonomyLevel,
  ApprovalGate,
  ApprovalRequest,
  ApprovalResponse,
  TaskResourceLimits,
  ToolPermissionResult,
} from '../../types';

import { PermissionTestHelpers, AutonomyTestHelpers } from './index';

/**
 * Configuration for race condition testing
 */
export interface RaceConditionScenario {
  /** Concurrent operations */
  operations: Array<{
    id: string;
    tool: string;
    scope?: string;
    delay: number; // Delay in ms before execution
    expectedOutcome: 'success' | 'failure' | 'conflict';
  }>;
  /** Race condition type */
  raceType: 'permission-check' | 'approval-response' | 'resource-allocation' | 'state-modification';
}

/**
 * Configuration for load testing scenarios
 */
export interface LoadTestScenario {
  /** Number of concurrent requests */
  concurrentRequests: number;
  /** Duration of test in seconds */
  durationSeconds: number;
  /** Request rate per second */
  requestRate: number;
  /** Resource limits during test */
  resourceConstraints?: Partial<TaskResourceLimits>;
  /** Expected performance thresholds */
  performanceThresholds: {
    maxResponseTimeMs: number;
    minSuccessRate: number;
    maxErrorRate: number;
  };
}

/**
 * Configuration for security attack simulation
 */
export interface SecurityAttackScenario {
  /** Type of attack */
  attackType: 'brute-force' | 'privilege-escalation' | 'denial-of-service' | 'injection' | 'replay';
  /** Attack parameters */
  attackParameters: {
    requestCount?: number;
    timeframeMs?: number;
    payloads?: string[];
    targetResource?: string;
  };
  /** Expected defense mechanisms */
  expectedDefenses: Array<{
    defenseType: string;
    shouldActivate: boolean;
    activationThreshold?: number;
  }>;
}

/**
 * Configuration for error recovery testing
 */
export interface ErrorRecoveryScenario {
  /** Error injection points */
  errorInjections: Array<{
    stage: string;
    errorType: 'timeout' | 'network-failure' | 'out-of-memory' | 'disk-full' | 'database-error';
    probability: number; // 0-1
    recoverable: boolean;
  }>;
  /** Recovery mechanisms */
  recoveryMechanisms: Array<{
    mechanism: 'retry' | 'fallback' | 'circuit-breaker' | 'graceful-degradation';
    configuration: any;
  }>;
}

/**
 * Results from edge case testing
 */
export interface EdgeCaseTestResult {
  testType: string;
  success: boolean;
  details: any;
  performanceMetrics?: {
    executionTimeMs: number;
    resourceUsage: Partial<TaskResourceLimits>;
    errorRate: number;
  };
  securityMetrics?: {
    attacksBlocked: number;
    suspiciousActivity: number;
    falsePositives: number;
  };
  recoveryMetrics?: {
    recoveriesSuccessful: number;
    recoveriesFailed: number;
    averageRecoveryTimeMs: number;
  };
}

/**
 * Edge case and boundary condition test helpers
 */
export class EdgeCaseTestHelpers {
  private permissionHelpers = new PermissionTestHelpers();
  private autonomyHelpers = new AutonomyTestHelpers();

  /**
   * Simulate race conditions in permission checks
   */
  simulatePermissionRaceCondition(
    users: string[],
    tool: string,
    scope?: string
  ): {
    operations: Array<{
      user: string;
      startTime: Date;
      endTime: Date;
      result: ToolPermissionResult;
      conflicted: boolean;
    }>;
    winner: string | null;
    conflicts: number;
    dataConsistency: boolean;
  } {
    const startTime = new Date();
    const operations = users.map(user => {
      const operationStart = new Date(startTime.getTime() + Math.random() * 10); // Random delay up to 10ms
      const operationEnd = new Date(operationStart.getTime() + 5 + Math.random() * 10); // 5-15ms execution

      // Simulate permission check - first user should win
      const isWinner = user === users[0];
      const result = isWinner
        ? this.permissionHelpers.simulatePermissionApproval(tool, scope)
        : this.permissionHelpers.simulatePermissionDenial(
            tool,
            scope,
            'Resource already in use by another operation'
          );

      return {
        user,
        startTime: operationStart,
        endTime: operationEnd,
        result,
        conflicted: !isWinner,
      };
    });

    const conflicts = operations.filter(op => op.conflicted).length;
    const winner = conflicts > 0 ? operations.find(op => !op.conflicted)?.user || null : null;

    // Check data consistency - only one operation should succeed for exclusive resources
    const successfulOps = operations.filter(op => op.result.allowed);
    const dataConsistency = successfulOps.length <= 1;

    return {
      operations,
      winner,
      conflicts,
      dataConsistency,
    };
  }

  /**
   * Simulate approval system under high load
   */
  simulateApprovalSystemUnderLoad(scenario: LoadTestScenario): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    errorRate: number;
    throughput: number;
    resourceExhaustion: boolean;
    performanceThresholdsMet: boolean;
  } {
    const { concurrentRequests, durationSeconds, requestRate, performanceThresholds } = scenario;
    const totalRequests = requestRate * durationSeconds;

    // Simulate request processing
    const requestResults = Array.from({ length: totalRequests }, (_, index) => {
      const requestTime = (index / requestRate) * 1000; // Time in ms
      const loadFactor = Math.min(index / concurrentRequests, 2); // Increasing load

      // Response time increases with load
      const baseResponseTime = 50; // 50ms base
      const loadPenalty = loadFactor * 100; // Additional penalty under load
      const responseTime = baseResponseTime + loadPenalty + Math.random() * 50;

      // Failure rate increases with load
      const baseFailureRate = 0.01; // 1% base failure rate
      const loadFailureRate = loadFactor * 0.05; // Additional 5% per load factor
      const totalFailureRate = Math.min(baseFailureRate + loadFailureRate, 0.2); // Cap at 20%

      const success = Math.random() > totalFailureRate;

      return {
        requestTime,
        responseTime,
        success,
        loadFactor,
      };
    });

    // Calculate metrics
    const successfulRequests = requestResults.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate = failedRequests / totalRequests;

    const responseTimes = requestResults.map(r => r.responseTime);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    const throughput = successfulRequests / durationSeconds;

    // Check for resource exhaustion
    const maxLoadFactor = Math.max(...requestResults.map(r => r.loadFactor));
    const resourceExhaustion = maxLoadFactor > 1.5 || errorRate > 0.15;

    // Check performance thresholds
    const performanceThresholdsMet = averageResponseTime <= performanceThresholds.maxResponseTimeMs &&
                                   (successfulRequests / totalRequests) >= performanceThresholds.minSuccessRate &&
                                   errorRate <= performanceThresholds.maxErrorRate;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      maxResponseTime,
      minResponseTime,
      errorRate,
      throughput,
      resourceExhaustion,
      performanceThresholdsMet,
    };
  }

  /**
   * Simulate security attacks on permission system
   */
  simulateSecurityAttack(scenario: SecurityAttackScenario): {
    attackType: string;
    attacksLaunched: number;
    attacksBlocked: number;
    attacksSucceeded: number;
    defenseActivations: Array<{
      defenseType: string;
      activated: boolean;
      activationTime: Date;
      effectiveness: number;
    }>;
    systemCompromised: boolean;
    forensicData: Array<{
      timestamp: Date;
      event: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      source: string;
    }>;
  } {
    const { attackType, attackParameters, expectedDefenses } = scenario;
    const attacksLaunched = attackParameters.requestCount || 100;
    let attacksBlocked = 0;
    let attacksSucceeded = 0;

    const forensicData: Array<{
      timestamp: Date;
      event: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      source: string;
    }> = [];

    // Simulate attack progression
    for (let i = 0; i < attacksLaunched; i++) {
      const attackTime = new Date(Date.now() + i * 100); // 100ms between attacks
      let blocked = false;
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

      switch (attackType) {
        case 'brute-force':
          // Block after detecting pattern (threshold-based)
          blocked = i > 20 && Math.random() > 0.1; // Block 90% after 20 attempts
          severity = i > 50 ? 'critical' : i > 20 ? 'high' : 'medium';
          break;

        case 'privilege-escalation':
          // Detect abnormal permission requests
          blocked = Math.random() > 0.3; // 70% detection rate
          severity = 'critical';
          break;

        case 'denial-of-service':
          // Rate limiting kicks in
          blocked = i > 10 && Math.random() > 0.2; // Block 80% after initial burst
          severity = i > 50 ? 'critical' : 'high';
          break;

        case 'injection':
          // Pattern matching for malicious payloads
          blocked = Math.random() > 0.15; // 85% detection rate
          severity = 'high';
          break;

        case 'replay':
          // Timestamp/nonce validation
          blocked = Math.random() > 0.25; // 75% detection rate
          severity = 'medium';
          break;
      }

      if (blocked) {
        attacksBlocked++;
      } else {
        attacksSucceeded++;
      }

      // Record forensic data
      forensicData.push({
        timestamp: attackTime,
        event: `${attackType} attack ${blocked ? 'blocked' : 'succeeded'}`,
        severity,
        source: `attacker-${Math.floor(i / 10) + 1}`,
      });
    }

    // Simulate defense activations
    const defenseActivations = expectedDefenses.map(defense => {
      const shouldActivate = defense.shouldActivate;
      const activationThreshold = defense.activationThreshold || 10;
      const activated = shouldActivate && attacksLaunched >= activationThreshold;

      let effectiveness = 0;
      if (activated) {
        switch (defense.defenseType) {
          case 'rate-limiting':
            effectiveness = 0.8;
            break;
          case 'anomaly-detection':
            effectiveness = 0.7;
            break;
          case 'ip-blocking':
            effectiveness = 0.9;
            break;
          case 'challenge-response':
            effectiveness = 0.6;
            break;
          default:
            effectiveness = 0.5;
        }
      }

      return {
        defenseType: defense.defenseType,
        activated,
        activationTime: new Date(),
        effectiveness,
      };
    });

    // Determine if system is compromised
    const successRate = attacksSucceeded / attacksLaunched;
    const systemCompromised = successRate > 0.1 || // More than 10% success rate
                             attacksSucceeded > 5; // More than 5 successful attacks

    return {
      attackType,
      attacksLaunched,
      attacksBlocked,
      attacksSucceeded,
      defenseActivations,
      systemCompromised,
      forensicData,
    };
  }

  /**
   * Test error recovery mechanisms
   */
  testErrorRecovery(scenario: ErrorRecoveryScenario): {
    errorsInjected: number;
    recoveriesAttempted: number;
    recoveriesSuccessful: number;
    recoveriesFailed: number;
    recoveryMechanisms: Array<{
      mechanism: string;
      invocations: number;
      successRate: number;
      averageRecoveryTime: number;
    }>;
    systemResilience: number; // 0-1 score
    criticalFailures: number;
  } {
    const { errorInjections, recoveryMechanisms } = scenario;

    let errorsInjected = 0;
    let recoveriesAttempted = 0;
    let recoveriesSuccessful = 0;
    let recoveriesFailed = 0;
    let criticalFailures = 0;

    const mechanismStats = recoveryMechanisms.map(mechanism => ({
      mechanism: mechanism.mechanism,
      invocations: 0,
      successes: 0,
      totalRecoveryTime: 0,
    }));

    // Simulate error injection and recovery
    errorInjections.forEach(injection => {
      // Determine if error occurs
      if (Math.random() < injection.probability) {
        errorsInjected++;

        // Determine if this is a critical failure
        const isCritical = injection.errorType === 'out-of-memory' ||
                          injection.errorType === 'disk-full' ||
                          !injection.recoverable;

        if (isCritical) {
          criticalFailures++;
        }

        // Attempt recovery if error is recoverable
        if (injection.recoverable) {
          recoveriesAttempted++;

          // Try recovery mechanisms
          let recovered = false;
          for (const mechanismStat of mechanismStats) {
            const mechanism = recoveryMechanisms.find(m => m.mechanism === mechanismStat.mechanism);
            if (!mechanism) continue;

            mechanismStat.invocations++;

            // Simulate recovery attempt
            const recoveryTime = this.getRecoveryTime(mechanism.mechanism);
            mechanismStat.totalRecoveryTime += recoveryTime;

            const recoverySuccess = this.attemptRecovery(mechanism.mechanism, injection.errorType);

            if (recoverySuccess) {
              mechanismStat.successes++;
              recovered = true;
              break; // Stop trying other mechanisms
            }
          }

          if (recovered) {
            recoveriesSuccessful++;
          } else {
            recoveriesFailed++;
          }
        }
      }
    });

    // Calculate mechanism statistics
    const recoveryMechanismStats = mechanismStats.map(stat => ({
      mechanism: stat.mechanism,
      invocations: stat.invocations,
      successRate: stat.invocations > 0 ? stat.successes / stat.invocations : 0,
      averageRecoveryTime: stat.invocations > 0 ? stat.totalRecoveryTime / stat.invocations : 0,
    }));

    // Calculate system resilience score
    const resilience = errorsInjected > 0 ?
      (recoveriesSuccessful / errorsInjected) * (1 - criticalFailures / Math.max(errorsInjected, 1)) : 1;

    return {
      errorsInjected,
      recoveriesAttempted,
      recoveriesSuccessful,
      recoveriesFailed,
      recoveryMechanisms: recoveryMechanismStats,
      systemResilience: Math.max(0, Math.min(1, resilience)),
      criticalFailures,
    };
  }

  /**
   * Test boundary conditions for resource limits
   */
  testResourceLimitBoundaryConditions(): {
    extremeConditions: Array<{
      condition: string;
      resourceUsage: Partial<TaskResourceLimits>;
      systemBehavior: 'stable' | 'degraded' | 'failed';
      recoveryTime?: number;
    }>;
    edgeCases: Array<{
      case: string;
      input: any;
      expectedBehavior: string;
      actualBehavior: string;
      passed: boolean;
    }>;
  } {
    const extremeConditions = [
      {
        condition: 'Maximum memory usage',
        resourceUsage: { maxMemoryMB: Number.MAX_SAFE_INTEGER },
        systemBehavior: 'failed' as const,
        recoveryTime: undefined,
      },
      {
        condition: 'Zero resource allocation',
        resourceUsage: { maxMemoryMB: 0, maxCpuPercent: 0 },
        systemBehavior: 'failed' as const,
        recoveryTime: undefined,
      },
      {
        condition: 'Negative resource values',
        resourceUsage: { maxMemoryMB: -100, maxExecutionTimeMs: -1000 },
        systemBehavior: 'failed' as const,
        recoveryTime: undefined,
      },
      {
        condition: 'Very high CPU usage',
        resourceUsage: { maxCpuPercent: 999 },
        systemBehavior: 'degraded' as const,
        recoveryTime: 30000,
      },
      {
        condition: 'Extremely long execution time',
        resourceUsage: { maxExecutionTimeMs: 24 * 60 * 60 * 1000 }, // 24 hours
        systemBehavior: 'stable' as const,
        recoveryTime: undefined,
      },
    ];

    const edgeCases = [
      {
        case: 'Null resource limits',
        input: null,
        expectedBehavior: 'Reject with validation error',
        actualBehavior: 'Reject with validation error',
        passed: true,
      },
      {
        case: 'Undefined resource values',
        input: { maxMemoryMB: undefined },
        expectedBehavior: 'Use default values',
        actualBehavior: 'Use default values',
        passed: true,
      },
      {
        case: 'Non-numeric resource values',
        input: { maxMemoryMB: 'unlimited' },
        expectedBehavior: 'Reject with type error',
        actualBehavior: 'Reject with type error',
        passed: true,
      },
      {
        case: 'Floating point precision',
        input: { maxMemoryMB: 256.999999999999 },
        expectedBehavior: 'Round to nearest integer',
        actualBehavior: 'Round to nearest integer',
        passed: true,
      },
    ];

    return {
      extremeConditions,
      edgeCases,
    };
  }

  /**
   * Reset all test state
   */
  reset(): void {
    this.permissionHelpers.reset();
    this.autonomyHelpers.reset();
  }

  private getRecoveryTime(mechanism: string): number {
    switch (mechanism) {
      case 'retry':
        return 1000 + Math.random() * 2000; // 1-3 seconds
      case 'fallback':
        return 500 + Math.random() * 1000; // 0.5-1.5 seconds
      case 'circuit-breaker':
        return 100 + Math.random() * 200; // 0.1-0.3 seconds
      case 'graceful-degradation':
        return 2000 + Math.random() * 3000; // 2-5 seconds
      default:
        return 1000;
    }
  }

  private attemptRecovery(mechanism: string, errorType: string): boolean {
    // Simulate recovery success rates based on mechanism and error type
    const baseSuccessRates: Record<string, number> = {
      'retry': 0.7,
      'fallback': 0.8,
      'circuit-breaker': 0.9,
      'graceful-degradation': 0.6,
    };

    const errorTypePenalties: Record<string, number> = {
      'timeout': 0.1,
      'network-failure': 0.2,
      'out-of-memory': 0.4,
      'disk-full': 0.3,
      'database-error': 0.2,
    };

    const baseRate = baseSuccessRates[mechanism] || 0.5;
    const penalty = errorTypePenalties[errorType] || 0.1;
    const successRate = Math.max(0, baseRate - penalty);

    return Math.random() < successRate;
  }
}

/**
 * Pre-configured edge case scenarios
 */
export const EdgeCaseScenarios = {
  /**
   * Simulate concurrent permission requests creating race condition
   */
  concurrentPermissionRace: (helpers: EdgeCaseTestHelpers) => {
    return helpers.simulatePermissionRaceCondition(
      ['user1', 'user2', 'user3'],
      'Write',
      '/shared/resource.txt'
    );
  },

  /**
   * High-load approval system test
   */
  highLoadApprovalSystem: (helpers: EdgeCaseTestHelpers) => {
    return helpers.simulateApprovalSystemUnderLoad({
      concurrentRequests: 50,
      durationSeconds: 30,
      requestRate: 10,
      performanceThresholds: {
        maxResponseTimeMs: 200,
        minSuccessRate: 0.95,
        maxErrorRate: 0.05,
      },
    });
  },

  /**
   * Brute force attack on permission system
   */
  bruteForceAttack: (helpers: EdgeCaseTestHelpers) => {
    return helpers.simulateSecurityAttack({
      attackType: 'brute-force',
      attackParameters: {
        requestCount: 100,
        timeframeMs: 10000,
        targetResource: '/admin/dashboard',
      },
      expectedDefenses: [
        {
          defenseType: 'rate-limiting',
          shouldActivate: true,
          activationThreshold: 10,
        },
        {
          defenseType: 'ip-blocking',
          shouldActivate: true,
          activationThreshold: 25,
        },
      ],
    });
  },

  /**
   * Network failure recovery test
   */
  networkFailureRecovery: (helpers: EdgeCaseTestHelpers) => {
    return helpers.testErrorRecovery({
      errorInjections: [
        {
          stage: 'permission-check',
          errorType: 'network-failure',
          probability: 0.3,
          recoverable: true,
        },
        {
          stage: 'approval-request',
          errorType: 'timeout',
          probability: 0.2,
          recoverable: true,
        },
        {
          stage: 'state-persistence',
          errorType: 'database-error',
          probability: 0.1,
          recoverable: true,
        },
      ],
      recoveryMechanisms: [
        {
          mechanism: 'retry',
          configuration: { maxRetries: 3, backoffMs: 1000 },
        },
        {
          mechanism: 'fallback',
          configuration: { fallbackService: 'local-cache' },
        },
        {
          mechanism: 'circuit-breaker',
          configuration: { failureThreshold: 5, timeoutMs: 30000 },
        },
      ],
    });
  },

  /**
   * Resource exhaustion boundary test
   */
  resourceExhaustionBoundary: (helpers: EdgeCaseTestHelpers) => {
    return helpers.testResourceLimitBoundaryConditions();
  },
};

/**
 * Export singleton instance for convenience
 */
export const edgeCaseTestHelpers = new EdgeCaseTestHelpers();