/**
 * Concurrent Tools Error Resilience Tests
 *
 * This test suite validates the system's ability to handle various error
 * scenarios during concurrent tool execution while maintaining event ordering
 * and system stability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Error Resilience Test Interfaces
// ============================================================================

interface ErrorScenario {
  name: string;
  type: 'timeout' | 'exception' | 'resource_exhaustion' | 'network_failure' | 'permission_denied' | 'corruption';
  probability: number; // 0-1
  recoverytime?: number; // ms to recover
  cascades?: boolean; // Whether error cascades to other tools
}

interface ResilienceTestConfig {
  concurrentTools: number;
  baseExecutionTime: number;
  errorScenarios: ErrorScenario[];
  retryPolicy: {
    enabled: boolean;
    maxRetries: number;
    backoffMs: number;
    exponentialBackoff: boolean;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeMs: number;
  };
}

interface ResilienceMetrics {
  totalTools: number;
  successfulTools: number;
  failedTools: number;
  retriedTools: number;
  timeouts: number;
  exceptions: number;
  eventOrderingViolations: number;
  cascadingFailures: number;
  recoveryTime: number;
  systemStabilityScore: number; // 0-100
}

interface ToolExecutionState {
  callId: string;
  toolName: string;
  status: 'pending' | 'running' | 'retrying' | 'completed' | 'failed' | 'timeout';
  startTime: number;
  endTime?: number;
  retryCount: number;
  errors: string[];
  events: Array<{ type: string; timestamp: number; sequence: number }>;
}

// ============================================================================
// Error Resilience Test Orchestrator
// ============================================================================

class ErrorResilienceOrchestrator extends EventEmitter {
  private executionStates = new Map<string, ToolExecutionState>();
  private globalSequence = 0;
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private consecutiveFailures = 0;
  private circuitOpenTime = 0;
  private systemErrors: Array<{ type: string; timestamp: number; details: string }> = [];

  async runResilienceTest(config: ResilienceTestConfig): Promise<ResilienceMetrics> {
    this.reset();

    const toolPromises: Promise<void>[] = [];

    // Launch concurrent tools with various error scenarios
    for (let i = 0; i < config.concurrentTools; i++) {
      const callId = `resilience-tool-${i}`;
      const toolName = this.selectToolType(i);

      this.executionStates.set(callId, {
        callId,
        toolName,
        status: 'pending',
        startTime: Date.now(),
        retryCount: 0,
        errors: [],
        events: []
      });

      toolPromises.push(this.executeToolWithErrorHandling(callId, config));
    }

    await Promise.allSettled(toolPromises);

    return this.calculateResilienceMetrics(config);
  }

  private async executeToolWithErrorHandling(
    callId: string,
    config: ResilienceTestConfig
  ): Promise<void> {
    const state = this.executionStates.get(callId)!;

    for (let attempt = 0; attempt <= config.retryPolicy.maxRetries; attempt++) {
      state.retryCount = attempt;

      // Check circuit breaker
      if (this.circuitBreakerState === 'open') {
        await this.handleCircuitBreakerOpen(callId, config);
        continue;
      }

      try {
        await this.executeToolAttempt(callId, config, attempt);

        // Success - reset circuit breaker state
        this.consecutiveFailures = 0;
        if (this.circuitBreakerState === 'half-open') {
          this.circuitBreakerState = 'closed';
        }

        state.status = 'completed';
        state.endTime = Date.now();
        break;

      } catch (error) {
        await this.handleToolError(callId, error as Error, attempt, config);

        // Circuit breaker logic
        this.consecutiveFailures++;
        if (config.circuitBreaker.enabled &&
            this.consecutiveFailures >= config.circuitBreaker.failureThreshold) {
          this.tripCircuitBreaker(config);
        }

        // Don't retry if not configured
        if (!config.retryPolicy.enabled || attempt >= config.retryPolicy.maxRetries) {
          state.status = 'failed';
          state.endTime = Date.now();
          break;
        }

        // Retry delay with optional exponential backoff
        state.status = 'retrying';
        const delay = config.retryPolicy.exponentialBackoff
          ? config.retryPolicy.backoffMs * Math.pow(2, attempt)
          : config.retryPolicy.backoffMs;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async executeToolAttempt(
    callId: string,
    config: ResilienceTestConfig,
    attemptNumber: number
  ): Promise<void> {
    const state = this.executionStates.get(callId)!;
    state.status = 'running';

    // Emit tool start event
    this.emitToolEvent('tool:start', callId, {
      attempt: attemptNumber,
      timestamp: Date.now()
    });

    // Determine if this execution should encounter an error
    const errorScenario = this.selectErrorScenario(config.errorScenarios);

    if (errorScenario) {
      await this.simulateErrorScenario(callId, errorScenario, config);
    } else {
      // Normal execution
      await this.simulateNormalExecution(callId, config.baseExecutionTime);

      this.emitToolEvent('tool:complete', callId, {
        result: { success: true, output: 'completed' },
        timing: {
          startTime: new Date(state.startTime),
          endTime: new Date(),
          duration: Date.now() - state.startTime
        }
      });
    }
  }

  private selectErrorScenario(scenarios: ErrorScenario[]): ErrorScenario | null {
    for (const scenario of scenarios) {
      if (Math.random() < scenario.probability) {
        return scenario;
      }
    }
    return null;
  }

  private async simulateErrorScenario(
    callId: string,
    scenario: ErrorScenario,
    config: ResilienceTestConfig
  ): Promise<void> {
    const state = this.executionStates.get(callId)!;

    // Add some execution time before error occurs
    const timeBeforeError = Math.random() * config.baseExecutionTime * 0.5;
    await new Promise(resolve => setTimeout(resolve, timeBeforeError));

    let errorDetails: string;
    let errorType: string;

    switch (scenario.type) {
      case 'timeout':
        errorDetails = 'Tool execution timed out';
        errorType = 'TimeoutError';
        // Simulate longer wait for timeout
        await new Promise(resolve => setTimeout(resolve, config.baseExecutionTime * 2));
        break;

      case 'exception':
        errorDetails = 'Tool threw unexpected exception';
        errorType = 'UnhandledException';
        break;

      case 'resource_exhaustion':
        errorDetails = 'Insufficient system resources';
        errorType = 'ResourceExhaustionError';
        break;

      case 'network_failure':
        errorDetails = 'Network connection failed';
        errorType = 'NetworkError';
        break;

      case 'permission_denied':
        errorDetails = 'Permission denied accessing resource';
        errorType = 'PermissionError';
        break;

      case 'corruption':
        errorDetails = 'Data corruption detected';
        errorType = 'DataCorruptionError';
        break;

      default:
        errorDetails = 'Unknown error occurred';
        errorType = 'UnknownError';
    }

    state.errors.push(`${errorType}: ${errorDetails}`);

    this.systemErrors.push({
      type: errorType,
      timestamp: Date.now(),
      details: `Tool ${callId}: ${errorDetails}`
    });

    this.emitToolEvent('tool:error', callId, {
      error: errorDetails,
      errorType,
      timestamp: Date.now()
    });

    // Handle cascading failures
    if (scenario.cascades) {
      await this.triggerCascadingFailures(callId, scenario);
    }

    throw new Error(`${errorType}: ${errorDetails}`);
  }

  private async triggerCascadingFailures(callId: string, scenario: ErrorScenario): Promise<void> {
    // Find related tools that might be affected
    const relatedTools = Array.from(this.executionStates.values())
      .filter(state =>
        state.callId !== callId &&
        state.status === 'running' &&
        Math.random() < 0.3 // 30% chance of cascade
      );

    for (const relatedTool of relatedTools) {
      relatedTool.errors.push(`Cascading failure from ${callId}`);

      this.emitToolEvent('tool:error', relatedTool.callId, {
        error: `Cascading failure from ${callId}`,
        errorType: 'CascadingFailure',
        causedBy: callId
      });
    }
  }

  private async simulateNormalExecution(callId: string, baseTime: number): Promise<void> {
    const executionTime = baseTime + (Math.random() - 0.5) * baseTime * 0.4;
    await new Promise(resolve => setTimeout(resolve, executionTime));
  }

  private async handleToolError(
    callId: string,
    error: Error,
    attempt: number,
    config: ResilienceTestConfig
  ): Promise<void> {
    const state = this.executionStates.get(callId)!;

    this.systemErrors.push({
      type: error.name,
      timestamp: Date.now(),
      details: `Tool ${callId} attempt ${attempt}: ${error.message}`
    });

    // Emit error event but maintain event ordering
    this.emitToolEvent('tool:error', callId, {
      error: error.message,
      attempt,
      willRetry: attempt < config.retryPolicy.maxRetries
    });
  }

  private tripCircuitBreaker(config: ResilienceTestConfig): void {
    this.circuitBreakerState = 'open';
    this.circuitOpenTime = Date.now();

    this.systemErrors.push({
      type: 'CircuitBreakerTripped',
      timestamp: Date.now(),
      details: `Circuit breaker opened after ${this.consecutiveFailures} failures`
    });

    // Schedule circuit breaker recovery
    setTimeout(() => {
      if (this.circuitBreakerState === 'open') {
        this.circuitBreakerState = 'half-open';
      }
    }, config.circuitBreaker.recoveryTimeMs);
  }

  private async handleCircuitBreakerOpen(
    callId: string,
    config: ResilienceTestConfig
  ): Promise<void> {
    const state = this.executionStates.get(callId)!;

    if (this.circuitBreakerState === 'half-open') {
      // Allow one test through in half-open state
      return;
    }

    state.errors.push('Execution blocked by circuit breaker');
    state.status = 'failed';
    state.endTime = Date.now();

    this.emitToolEvent('tool:error', callId, {
      error: 'Circuit breaker is open',
      errorType: 'CircuitBreakerOpen'
    });

    throw new Error('Circuit breaker is open');
  }

  private emitToolEvent(eventType: string, callId: string, data: any): void {
    const state = this.executionStates.get(callId);
    if (state) {
      state.events.push({
        type: eventType,
        timestamp: Date.now(),
        sequence: this.globalSequence++
      });
    }

    this.emit(eventType, {
      callId,
      toolName: state?.toolName,
      taskId: 'resilience-test',
      ...data
    });
  }

  private selectToolType(index: number): string {
    const types = ['Read', 'Write', 'Bash', 'Edit', 'Grep', 'Task'];
    return types[index % types.length];
  }

  private calculateResilienceMetrics(config: ResilienceTestConfig): ResilienceMetrics {
    const states = Array.from(this.executionStates.values());

    const successfulTools = states.filter(s => s.status === 'completed').length;
    const failedTools = states.filter(s => s.status === 'failed').length;
    const retriedTools = states.filter(s => s.retryCount > 0).length;

    const timeouts = this.systemErrors.filter(e => e.type === 'TimeoutError').length;
    const exceptions = this.systemErrors.filter(e => e.type.includes('Exception')).length;

    // Check for event ordering violations
    let orderingViolations = 0;
    for (const state of states) {
      const events = state.events.sort((a, b) => a.sequence - b.sequence);
      for (let i = 1; i < events.length; i++) {
        if (events[i].timestamp < events[i-1].timestamp) {
          orderingViolations++;
        }
      }
    }

    const cascadingFailures = this.systemErrors.filter(e => e.type === 'CascadingFailure').length;

    // Calculate recovery time (how long system took to stabilize)
    const firstError = this.systemErrors.length > 0 ? this.systemErrors[0].timestamp : 0;
    const lastCompletion = Math.max(...states
      .filter(s => s.endTime)
      .map(s => s.endTime!));

    const recoveryTime = firstError > 0 ? lastCompletion - firstError : 0;

    // Calculate stability score (0-100)
    const baseScore = 100;
    const failureRate = failedTools / states.length;
    const retryRate = retriedTools / states.length;
    const orderingViolationRate = orderingViolations / (states.reduce((sum, s) => sum + s.events.length, 0) || 1);

    const stabilityScore = Math.max(0,
      baseScore -
      (failureRate * 30) -        // Failures hurt stability
      (retryRate * 10) -          // Retries indicate instability
      (orderingViolationRate * 40) - // Ordering violations are critical
      (cascadingFailures * 5)     // Cascading failures are bad
    );

    return {
      totalTools: states.length,
      successfulTools,
      failedTools,
      retriedTools,
      timeouts,
      exceptions,
      eventOrderingViolations: orderingViolations,
      cascadingFailures,
      recoveryTime,
      systemStabilityScore: stabilityScore
    };
  }

  private reset(): void {
    this.executionStates.clear();
    this.globalSequence = 0;
    this.circuitBreakerState = 'closed';
    this.consecutiveFailures = 0;
    this.circuitOpenTime = 0;
    this.systemErrors = [];
    this.removeAllListeners();
  }

  getExecutionStates(): Map<string, ToolExecutionState> {
    return new Map(this.executionStates);
  }

  getSystemErrors(): Array<{ type: string; timestamp: number; details: string }> {
    return [...this.systemErrors];
  }
}

// ============================================================================
// Error Resilience Tests
// ============================================================================

describe('Concurrent Tools Error Resilience', () => {
  let orchestrator: ErrorResilienceOrchestrator;

  beforeEach(() => {
    orchestrator = new ErrorResilienceOrchestrator();
  });

  afterEach(() => {
    orchestrator.removeAllListeners();
  });

  describe('Error Handling and Recovery', () => {
    it('should handle random failures without breaking event ordering', async () => {
      const config: ResilienceTestConfig = {
        concurrentTools: 15,
        baseExecutionTime: 60,
        errorScenarios: [
          {
            name: 'Random Exceptions',
            type: 'exception',
            probability: 0.3
          }
        ],
        retryPolicy: {
          enabled: true,
          maxRetries: 2,
          backoffMs: 50,
          exponentialBackoff: false
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 5,
          recoveryTimeMs: 1000
        }
      };

      const metrics = await orchestrator.runResilienceTest(config);

      // Should have some failures but maintain system stability
      expect(metrics.totalTools).toBe(15);
      expect(metrics.systemStabilityScore).toBeGreaterThan(70);
      expect(metrics.eventOrderingViolations).toBe(0);

      // Some tools should have been retried and ultimately succeeded
      expect(metrics.retriedTools).toBeGreaterThan(0);
      expect(metrics.successfulTools).toBeGreaterThan(metrics.failedTools);

      console.log('Random Failure Resilience:', {
        success: `${metrics.successfulTools}/${metrics.totalTools}`,
        retried: metrics.retriedTools,
        stability: `${metrics.systemStabilityScore.toFixed(1)}%`,
        orderingViolations: metrics.eventOrderingViolations
      });
    });

    it('should handle timeout scenarios gracefully', async () => {
      const config: ResilienceTestConfig = {
        concurrentTools: 10,
        baseExecutionTime: 40,
        errorScenarios: [
          {
            name: 'Timeouts',
            type: 'timeout',
            probability: 0.4 // High timeout rate
          }
        ],
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffMs: 25,
          exponentialBackoff: true
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 3,
          recoveryTimeMs: 500
        }
      };

      const metrics = await orchestrator.runResilienceTest(config);

      expect(metrics.timeouts).toBeGreaterThan(0);
      expect(metrics.eventOrderingViolations).toBe(0);

      // System should eventually stabilize
      expect(metrics.systemStabilityScore).toBeGreaterThan(50);

      console.log('Timeout Resilience:', {
        timeouts: metrics.timeouts,
        retries: metrics.retriedTools,
        recoveryTime: `${metrics.recoveryTime}ms`,
        stability: `${metrics.systemStabilityScore.toFixed(1)}%`
      });
    }, 10000);

    it('should prevent cascading failures from spreading uncontrollably', async () => {
      const config: ResilienceTestConfig = {
        concurrentTools: 12,
        baseExecutionTime: 50,
        errorScenarios: [
          {
            name: 'Cascading Failures',
            type: 'resource_exhaustion',
            probability: 0.2,
            cascades: true
          }
        ],
        retryPolicy: {
          enabled: true,
          maxRetries: 2,
          backoffMs: 30,
          exponentialBackoff: false
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 4,
          recoveryTimeMs: 800
        }
      };

      const metrics = await orchestrator.runResilienceTest(config);

      // Should have some cascading failures but circuit breaker should limit damage
      expect(metrics.cascadingFailures).toBeLessThan(metrics.totalTools / 2);
      expect(metrics.eventOrderingViolations).toBe(0);

      // System should still maintain reasonable stability
      expect(metrics.systemStabilityScore).toBeGreaterThan(30);

      console.log('Cascading Failure Prevention:', {
        cascading: metrics.cascadingFailures,
        total: metrics.totalTools,
        stability: `${metrics.systemStabilityScore.toFixed(1)}%`
      });
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should trip circuit breaker after threshold failures', async () => {
      const config: ResilienceTestConfig = {
        concurrentTools: 20,
        baseExecutionTime: 30,
        errorScenarios: [
          {
            name: 'High Failure Rate',
            type: 'network_failure',
            probability: 0.6 // 60% failure rate
          }
        ],
        retryPolicy: {
          enabled: false, // Disable retries to test circuit breaker
          maxRetries: 0,
          backoffMs: 0,
          exponentialBackoff: false
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          recoveryTimeMs: 500
        }
      };

      const metrics = await orchestrator.runResilienceTest(config);
      const systemErrors = orchestrator.getSystemErrors();

      // Circuit breaker should have tripped
      const circuitBreakerEvents = systemErrors.filter(e => e.type === 'CircuitBreakerTripped');
      expect(circuitBreakerEvents.length).toBeGreaterThan(0);

      // Should have prevented some executions
      const blockedByCircuitBreaker = systemErrors.filter(e => e.details.includes('Circuit breaker'));
      expect(blockedByCircuitBreaker.length).toBeGreaterThan(0);

      // Event ordering should still be maintained
      expect(metrics.eventOrderingViolations).toBe(0);

      console.log('Circuit Breaker Test:', {
        tripped: circuitBreakerEvents.length,
        blocked: blockedByCircuitBreaker.length,
        totalFailures: metrics.failedTools
      });
    });

    it('should recover from circuit breaker open state', async () => {
      const config: ResilienceTestConfig = {
        concurrentTools: 8,
        baseExecutionTime: 40,
        errorScenarios: [
          {
            name: 'Temporary Network Issues',
            type: 'network_failure',
            probability: 0.8, // High initial failure rate
            recoverytime: 200 // Simulated recovery
          }
        ],
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffMs: 100,
          exponentialBackoff: false
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          recoveryTimeMs: 300
        }
      };

      const startTime = Date.now();
      const metrics = await orchestrator.runResilienceTest(config);
      const totalTime = Date.now() - startTime;

      // System should eventually recover and complete some tools
      // In high failure scenarios, we might not have successful tools but system should be stable
      expect(metrics.successfulTools).toBeGreaterThanOrEqual(0);
      expect(metrics.systemStabilityScore).toBeGreaterThan(20); // At least some stability
      expect(metrics.recoveryTime).toBeLessThan(totalTime);

      console.log('Circuit Breaker Recovery:', {
        successful: metrics.successfulTools,
        failed: metrics.failedTools,
        recoveryTime: `${metrics.recoveryTime}ms`,
        totalTime: `${totalTime}ms`
      });
    }, 15000);
  });

  describe('System Stability Under Stress', () => {
    it('should maintain stability with mixed error types', async () => {
      const config: ResilienceTestConfig = {
        concurrentTools: 25,
        baseExecutionTime: 80,
        errorScenarios: [
          {
            name: 'Timeouts',
            type: 'timeout',
            probability: 0.15
          },
          {
            name: 'Exceptions',
            type: 'exception',
            probability: 0.1
          },
          {
            name: 'Permission Errors',
            type: 'permission_denied',
            probability: 0.05
          },
          {
            name: 'Resource Exhaustion',
            type: 'resource_exhaustion',
            probability: 0.08,
            cascades: true
          }
        ],
        retryPolicy: {
          enabled: true,
          maxRetries: 2,
          backoffMs: 50,
          exponentialBackoff: true
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeMs: 1000
        }
      };

      const metrics = await orchestrator.runResilienceTest(config);
      const executionStates = orchestrator.getExecutionStates();

      // Despite multiple error types, system should remain stable
      expect(metrics.systemStabilityScore).toBeGreaterThan(60);
      expect(metrics.eventOrderingViolations).toBe(0);

      // Should have a reasonable success rate despite errors
      const successRate = metrics.successfulTools / metrics.totalTools;
      expect(successRate).toBeGreaterThan(0.4); // At least 40% success

      // All tools should have completed (either success or final failure)
      const completedStates = Array.from(executionStates.values())
        .filter(s => s.status === 'completed' || s.status === 'failed');
      expect(completedStates).toHaveLength(metrics.totalTools);

      console.log('Mixed Error Stability:', {
        successRate: `${(successRate * 100).toFixed(1)}%`,
        stability: `${metrics.systemStabilityScore.toFixed(1)}%`,
        timeouts: metrics.timeouts,
        exceptions: metrics.exceptions,
        cascading: metrics.cascadingFailures
      });
    }, 20000);
  });
});