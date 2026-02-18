/**
 * @fileoverview MockBehaviorEngine - Configurable Behavior Simulation
 *
 * Executes configurable behaviors including response delays, error injection,
 * state machine transitions, and notification triggers. Consumes configuration
 * types from @apex/core/mcp/mock-types.
 *
 * @module orchestrator/mcp/mock-server/mock-behavior-engine
 */

import type {
  MockBehaviorConfig,
  MockResponseDelay,
  MockErrorInjection,
  MockToolHandler,
  MockDynamicHandler,
  MockDynamicHandlerFunction,
  MockResponseSequence,
  MockNotificationTrigger,
  MockStatefulBehaviorConfig,
  MockStateTransition,
  MockStateBehavior,
} from '@apexcli/core';
import type { JSONRPCRequest } from '../types.js';
import type {
  RecordedRequest,
  ErrorInjectionResult,
  ComputedDelay,
} from './types.js';

// ============================================================================
// MockBehaviorEngine
// ============================================================================

/**
 * Executes configurable mock server behaviors.
 *
 * The behavior engine is responsible for:
 * - Computing response delays (fixed, range, per-method, jitter)
 * - Determining whether to inject errors (probability, count, method-based)
 * - Managing state machine transitions
 * - Checking notification trigger conditions
 * - Finding matching tool handlers for requests
 * - Recording requests for later assertion
 *
 * @example
 * ```typescript
 * const engine = new MockBehaviorEngine({
 *   responseDelay: { fixedMs: 100, jitter: true },
 *   errorInjection: { enabled: true, probability: 0.1 },
 *   toolHandlers: [
 *     { toolName: 'read_file', response: { content: [{ type: 'text', text: 'hi' }] } }
 *   ],
 * });
 *
 * // Apply delay before responding
 * await engine.applyDelay('tools/call');
 *
 * // Check if we should inject an error
 * const errorResult = engine.checkErrorInjection('tools/call');
 * if (errorResult.shouldInject) {
 *   return createErrorResponse(errorResult);
 * }
 *
 * // Find a tool handler
 * const handler = engine.findToolHandler('read_file', { path: '/test' });
 * ```
 */
export class MockBehaviorEngine {
  private config: MockBehaviorConfig;
  private currentState: string;
  private requestCount = 0;
  private errorCount = 0;
  private recordedRequests: RecordedRequest[] = [];
  private toolInvocationCounts: Map<string, number> = new Map();
  private dynamicHandlerInvocationCounts: Map<string, number> = new Map();
  private responseSequenceInvocationCounts: Map<string, number> = new Map();
  private firedTriggers: Set<string> = new Set();
  private startTime: number;

  constructor(config: MockBehaviorConfig) {
    this.config = config;
    this.currentState = config.statefulBehavior?.initialState ?? 'default';
    this.startTime = Date.now();
  }

  // ==========================================================================
  // Response Delay
  // ==========================================================================

  /**
   * Compute the delay for a given method.
   * Considers fixed delay, range, per-method overrides, and jitter.
   */
  computeDelay(method: string): ComputedDelay {
    const delayConfig = this.getActiveDelayConfig();
    if (!delayConfig) {
      return { delayMs: 0, jitterApplied: false, source: 'none' };
    }

    // Check per-method override first
    if (delayConfig.perMethod && method in delayConfig.perMethod) {
      const baseDelay = delayConfig.perMethod[method];
      const jitter = delayConfig.jitter ? this.computeJitter(baseDelay) : 0;
      return {
        delayMs: baseDelay + jitter,
        jitterApplied: delayConfig.jitter,
        source: 'per-method',
      };
    }

    // Then check range (minMs/maxMs)
    if (delayConfig.minMs !== undefined && delayConfig.maxMs !== undefined) {
      const range = delayConfig.maxMs - delayConfig.minMs;
      const baseDelay = delayConfig.minMs + Math.random() * range;
      const jitter = delayConfig.jitter ? this.computeJitter(baseDelay) : 0;
      return {
        delayMs: Math.round(baseDelay + jitter),
        jitterApplied: delayConfig.jitter,
        source: 'range',
      };
    }

    // Fall back to fixed delay
    const baseDelay = delayConfig.fixedMs;
    const jitter = delayConfig.jitter ? this.computeJitter(baseDelay) : 0;
    return {
      delayMs: baseDelay + jitter,
      jitterApplied: delayConfig.jitter,
      source: 'fixed',
    };
  }

  /**
   * Apply the computed delay (actually wait).
   */
  async applyDelay(method: string): Promise<ComputedDelay> {
    const computed = this.computeDelay(method);
    if (computed.delayMs > 0) {
      await this.sleep(computed.delayMs);
    }
    return computed;
  }

  // ==========================================================================
  // Error Injection
  // ==========================================================================

  /**
   * Check whether an error should be injected for the given method.
   */
  checkErrorInjection(method: string): ErrorInjectionResult {
    const errorConfig = this.getActiveErrorConfig();

    if (!errorConfig || !errorConfig.enabled) {
      return { shouldInject: false };
    }

    // Check if method is in the allowed list (empty = all methods)
    if (errorConfig.methods.length > 0 && !errorConfig.methods.includes(method)) {
      return { shouldInject: false };
    }

    // Check afterRequestCount threshold
    if (errorConfig.afterRequestCount > 0 && this.requestCount < errorConfig.afterRequestCount) {
      return { shouldInject: false };
    }

    // Check maxErrors limit
    if (errorConfig.maxErrors > 0 && this.errorCount >= errorConfig.maxErrors) {
      return { shouldInject: false };
    }

    // Apply probability
    if (Math.random() >= errorConfig.probability) {
      return { shouldInject: false };
    }

    // Error should be injected
    this.errorCount++;
    return {
      shouldInject: true,
      errorCode: errorConfig.errorCode,
      errorMessage: errorConfig.errorMessage,
      errorData: errorConfig.errorData,
      delayMs: errorConfig.errorDelayMs,
    };
  }

  /**
   * Check if a connection-level failure should be simulated.
   */
  shouldSimulateConnectionFailure(): boolean {
    const errorConfig = this.getActiveErrorConfig();
    return errorConfig?.simulateConnectionFailure ?? false;
  }

  // ==========================================================================
  // Tool Handlers
  // ==========================================================================

  /**
   * Find a matching tool handler for the given tool name and arguments.
   * Considers matchArgs for conditional matching and maxInvocations limits.
   */
  findToolHandler(
    toolName: string,
    args?: Record<string, unknown>
  ): MockToolHandler | undefined {
    const handlers = this.getActiveToolHandlers();

    for (const handler of handlers) {
      if (handler.toolName !== toolName) {
        continue;
      }

      // Check maxInvocations
      if (handler.maxInvocations > 0) {
        const count = this.toolInvocationCounts.get(toolName) ?? 0;
        if (count >= handler.maxInvocations) {
          continue;
        }
      }

      // Check argument matching
      if (handler.matchArgs && args) {
        const matches = this.matchArgs(handler.matchArgs, args);
        if (!matches) {
          continue;
        }
      } else if (handler.matchArgs && !args) {
        continue; // Handler requires args but none provided
      }

      // Track invocation
      const count = this.toolInvocationCounts.get(toolName) ?? 0;
      this.toolInvocationCounts.set(toolName, count + 1);

      return handler;
    }

    return undefined;
  }

  /**
   * Find a static tool handler without incrementing the invocation count.
   * Used internally for priority comparison.
   */
  private findStaticToolHandler(
    toolName: string,
    args?: Record<string, unknown>
  ): MockToolHandler | undefined {
    const handlers = this.getActiveToolHandlers();

    for (const handler of handlers) {
      if (handler.toolName !== toolName) {
        continue;
      }

      // Check maxInvocations
      if (handler.maxInvocations > 0) {
        const count = this.toolInvocationCounts.get(toolName) ?? 0;
        if (count >= handler.maxInvocations) {
          continue;
        }
      }

      // Check argument matching
      if (handler.matchArgs && args) {
        const matches = this.matchArgs(handler.matchArgs, args);
        if (!matches) {
          continue;
        }
      } else if (handler.matchArgs && !args) {
        continue; // Handler requires args but none provided
      }

      return handler;
    }

    return undefined;
  }

  /**
   * Find the best matching handler across all handler types (static, dynamic, sequence).
   * Handlers are prioritized by their priority value (higher = preferred).
   * Returns an object indicating the type and handler found.
   */
  findBestToolHandler(
    toolName: string,
    args?: Record<string, unknown>
  ): {
    type: 'static' | 'dynamic' | 'sequence';
    handler: MockToolHandler | MockDynamicHandler | MockResponseSequence;
  } | undefined {
    const candidates: Array<{
      type: 'static' | 'dynamic' | 'sequence';
      handler: MockToolHandler | MockDynamicHandler | MockResponseSequence;
      priority: number;
    }> = [];

    // Check static handlers (without incrementing count)
    const staticHandler = this.findStaticToolHandler(toolName, args);
    if (staticHandler) {
      candidates.push({
        type: 'static',
        handler: staticHandler,
        priority: staticHandler.priority || 50
      });
    }

    // Check dynamic handlers
    const dynamicHandler = this.findDynamicHandler(toolName, args);
    if (dynamicHandler) {
      candidates.push({
        type: 'dynamic',
        handler: dynamicHandler,
        priority: dynamicHandler.priority || 50
      });
    }

    // Check response sequences
    const responseSequence = this.findResponseSequence(toolName, args);
    if (responseSequence) {
      candidates.push({
        type: 'sequence',
        handler: responseSequence,
        priority: responseSequence.priority || 50
      });
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // Sort by priority (highest first) and return the best match
    candidates.sort((a, b) => b.priority - a.priority);
    const best = candidates[0];

    return {
      type: best.type,
      handler: best.handler
    };
  }

  /**
   * Find a matching dynamic handler for the given tool name and arguments.
   * Dynamic handlers can generate responses programmatically.
   */
  findDynamicHandler(
    toolName: string,
    args?: Record<string, unknown>
  ): MockDynamicHandler | undefined {
    const handlers = this.getActiveDynamicHandlers();

    for (const handler of handlers) {
      if (handler.toolName !== toolName) {
        continue;
      }

      // Check maxInvocations
      if (handler.maxInvocations > 0) {
        const count = this.dynamicHandlerInvocationCounts.get(toolName) ?? 0;
        if (count >= handler.maxInvocations) {
          continue;
        }
      }

      // Check argument matching
      if (handler.matchArgs && args) {
        const matches = this.matchArgs(handler.matchArgs, args);
        if (!matches) {
          continue;
        }
      } else if (handler.matchArgs && !args) {
        continue; // Handler requires args but none provided
      }

      return handler;
    }

    return undefined;
  }

  /**
   * Execute a dynamic handler and return the response.
   */
  async executeDynamicHandler(
    handler: MockDynamicHandler,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{ content: any[], isError: boolean }> {
    // Track invocation before execution
    const currentCount = this.dynamicHandlerInvocationCounts.get(toolName) ?? 0;
    this.dynamicHandlerInvocationCounts.set(toolName, currentCount + 1);

    // Apply delay if specified
    if (handler.delayMs && handler.delayMs > 0) {
      await this.sleep(handler.delayMs);
    }

    // Get invocation context
    const context = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invocationCount: currentCount + 1,
      timestamp: new Date()
    };

    // Execute the handler
    return await handler.handler(toolName, args, context);
  }

  /**
   * Find a matching response sequence for the given tool name and arguments.
   * Response sequences return different responses on successive calls.
   */
  findResponseSequence(
    toolName: string,
    args?: Record<string, unknown>
  ): MockResponseSequence | undefined {
    const sequences = this.getActiveResponseSequences();

    for (const sequence of sequences) {
      if (sequence.toolName !== toolName) {
        continue;
      }

      // Check argument matching
      if (sequence.matchArgs && args) {
        const matches = this.matchArgs(sequence.matchArgs, args);
        if (!matches) {
          continue;
        }
      } else if (sequence.matchArgs && !args) {
        continue; // Sequence requires args but none provided
      }

      return sequence;
    }

    return undefined;
  }

  /**
   * Execute a response sequence and return the appropriate response based on call count.
   */
  async executeResponseSequence(
    sequence: MockResponseSequence,
    toolName: string
  ): Promise<{ content: any[], isError: boolean } | undefined> {
    // Get current call count for this specific tool
    const callCount = this.responseSequenceInvocationCounts.get(toolName) ?? 0;
    this.responseSequenceInvocationCounts.set(toolName, callCount + 1);

    // Determine which response to use
    let responseIndex: number;

    if (callCount < sequence.responses.length) {
      // Still within the initial sequence
      responseIndex = callCount;
    } else {
      // Handle cycle mode for calls beyond the sequence length
      switch (sequence.cycleMode) {
        case 'cycle':
          responseIndex = callCount % sequence.responses.length;
          break;
        case 'repeat_last':
          responseIndex = sequence.responses.length - 1;
          break;
        case 'stop_at_end':
          return undefined; // Let other handlers take over
        default:
          responseIndex = callCount % sequence.responses.length;
      }
    }

    const response = sequence.responses[responseIndex];

    // Apply response-specific delay if specified
    if (response.delayMs && response.delayMs > 0) {
      await this.sleep(response.delayMs);
    }

    return {
      content: response.content,
      isError: response.isError
    };
  }

  /**
   * Execute the best matching handler for a tool call.
   * This is the main entry point for executing tool handlers with priority support.
   */
  async executeToolHandler(
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<{ content: any[], isError: boolean } | undefined> {
    const bestHandler = this.findBestToolHandler(toolName, args);

    if (!bestHandler) {
      return undefined;
    }

    switch (bestHandler.type) {
      case 'static': {
        const handler = bestHandler.handler as MockToolHandler;

        // Track invocation for static handler
        const count = this.toolInvocationCounts.get(toolName) ?? 0;
        this.toolInvocationCounts.set(toolName, count + 1);

        // Apply delay if specified
        if (handler.delayMs && handler.delayMs > 0) {
          await this.sleep(handler.delayMs);
        }

        return {
          content: handler.response.content,
          isError: handler.response.isError
        };
      }

      case 'dynamic': {
        const handler = bestHandler.handler as MockDynamicHandler;
        return await this.executeDynamicHandler(handler, toolName, args || {});
      }

      case 'sequence': {
        const handler = bestHandler.handler as MockResponseSequence;
        return await this.executeResponseSequence(handler, toolName);
      }

      default:
        return undefined;
    }
  }

  // ==========================================================================
  // State Machine
  // ==========================================================================

  /**
   * Attempt a state transition based on the current method and arguments.
   * Returns the new state if a transition occurred, or undefined.
   */
  transition(
    method: string,
    args?: Record<string, unknown>
  ): { from: string; to: string; transition: MockStateTransition } | undefined {
    const statefulConfig = this.config.statefulBehavior;
    if (!statefulConfig) {
      return undefined;
    }

    for (const t of statefulConfig.transitions) {
      if (t.from !== this.currentState) {
        continue;
      }
      if (t.onMethod !== method) {
        continue;
      }
      if (t.whenArgs && args) {
        if (!this.matchArgs(t.whenArgs as Record<string, unknown>, args)) {
          continue;
        }
      } else if (t.whenArgs && !args) {
        continue;
      }

      // Perform transition
      const from = this.currentState;
      this.currentState = t.to;
      return { from, to: t.to, transition: t };
    }

    return undefined;
  }

  /**
   * Get the current state machine state.
   */
  getCurrentState(): string {
    return this.currentState;
  }

  /**
   * Get the behavior overrides for the current state.
   */
  getCurrentStateBehavior(): MockStateBehavior | undefined {
    const statefulConfig = this.config.statefulBehavior;
    if (!statefulConfig) {
      return undefined;
    }
    return statefulConfig.stateBehaviors.find(b => b.state === this.currentState);
  }

  // ==========================================================================
  // Notification Triggers
  // ==========================================================================

  /**
   * Check which notification triggers should fire based on current conditions.
   */
  checkNotificationTriggers(
    method: string
  ): MockNotificationTrigger[] {
    const triggers: MockNotificationTrigger[] = [];

    for (const trigger of this.config.notificationTriggers) {
      const triggerKey = `${trigger.condition}:${trigger.conditionValue}:${trigger.method}`;

      // Skip if already fired and once-only
      if (trigger.once && this.firedTriggers.has(triggerKey)) {
        continue;
      }

      let shouldFire = false;

      switch (trigger.condition) {
        case 'after_request_count':
          shouldFire = this.requestCount >= Number(trigger.conditionValue);
          break;

        case 'after_method':
          shouldFire = method === String(trigger.conditionValue);
          break;

        case 'after_delay': {
          const elapsed = Date.now() - this.startTime;
          shouldFire = elapsed >= Number(trigger.conditionValue);
          break;
        }

        case 'periodic':
          shouldFire = this.requestCount > 0 &&
            this.requestCount % Number(trigger.conditionValue) === 0;
          break;
      }

      if (shouldFire) {
        triggers.push(trigger);
        if (trigger.once) {
          this.firedTriggers.add(triggerKey);
        }
      }
    }

    return triggers;
  }

  // ==========================================================================
  // Request Recording
  // ==========================================================================

  /**
   * Record a request for later assertion.
   */
  recordRequest(entry: RecordedRequest): void {
    if (!this.config.recordRequests) {
      return;
    }

    this.recordedRequests.push(entry);

    // Trim if over limit
    if (this.recordedRequests.length > this.config.maxRecordedRequests) {
      this.recordedRequests.shift();
    }

    this.requestCount++;
  }

  /**
   * Get all recorded requests.
   */
  getRecordedRequests(): RecordedRequest[] {
    return [...this.recordedRequests];
  }

  /**
   * Get the total number of requests processed.
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Get the total number of errors injected.
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  // ==========================================================================
  // Default Tool Response
  // ==========================================================================

  /**
   * Get the default tool response for unhandled tools.
   */
  getDefaultToolResponse(): MockBehaviorConfig['defaultToolResponse'] {
    return this.config.defaultToolResponse;
  }

  /**
   * Check if request validation is enabled.
   */
  shouldValidateRequests(): boolean {
    return this.config.validateRequests;
  }

  /**
   * Check if debug logging is enabled.
   */
  isDebugLoggingEnabled(): boolean {
    return this.config.enableDebugLogging;
  }

  // ==========================================================================
  // Configuration Updates
  // ==========================================================================

  /**
   * Update the behavior configuration (e.g., when switching scenarios).
   */
  updateConfig(config: MockBehaviorConfig): void {
    this.config = config;
  }

  /**
   * Reset the engine state (counters, recorded requests, state machine).
   */
  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.recordedRequests = [];
    this.toolInvocationCounts.clear();
    this.dynamicHandlerInvocationCounts.clear();
    this.responseSequenceInvocationCounts.clear();
    this.firedTriggers.clear();
    this.currentState = this.config.statefulBehavior?.initialState ?? 'default';
    this.startTime = Date.now();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get the active delay config considering state-specific overrides.
   */
  private getActiveDelayConfig(): MockResponseDelay | undefined {
    const stateBehavior = this.getCurrentStateBehavior();
    return stateBehavior?.responseDelay ?? this.config.responseDelay;
  }

  /**
   * Get the active error injection config considering state-specific overrides.
   */
  private getActiveErrorConfig(): MockErrorInjection | undefined {
    const stateBehavior = this.getCurrentStateBehavior();
    return stateBehavior?.errorInjection ?? this.config.errorInjection;
  }

  /**
   * Get the active tool handlers considering state-specific overrides.
   * State-specific handlers take priority over base handlers.
   */
  private getActiveToolHandlers(): MockToolHandler[] {
    const stateBehavior = this.getCurrentStateBehavior();
    if (stateBehavior && stateBehavior.toolHandlers.length > 0) {
      // State-specific handlers override base handlers
      return stateBehavior.toolHandlers;
    }
    return this.config.toolHandlers;
  }

  /**
   * Get the active dynamic handlers considering state-specific overrides.
   * State-specific handlers take priority over base handlers.
   */
  private getActiveDynamicHandlers(): MockDynamicHandler[] {
    const stateBehavior = this.getCurrentStateBehavior();
    if (stateBehavior && stateBehavior.dynamicHandlers.length > 0) {
      // State-specific handlers override base handlers
      return stateBehavior.dynamicHandlers;
    }
    return this.config.dynamicHandlers || [];
  }

  /**
   * Get the active response sequences considering state-specific overrides.
   * State-specific sequences take priority over base sequences.
   */
  private getActiveResponseSequences(): MockResponseSequence[] {
    const stateBehavior = this.getCurrentStateBehavior();
    if (stateBehavior && stateBehavior.responseSequences.length > 0) {
      // State-specific sequences override base sequences
      return stateBehavior.responseSequences;
    }
    return this.config.responseSequences || [];
  }

  /**
   * Compute jitter value (±10% of base delay).
   */
  private computeJitter(baseDelay: number): number {
    const jitterRange = baseDelay * 0.1;
    return (Math.random() * 2 - 1) * jitterRange;
  }

  /**
   * Check if actual args match expected args (partial match by default).
   */
  private matchArgs(
    expected: Record<string, unknown>,
    actual: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (!(key in actual)) {
        return false;
      }
      // Deep equality check for primitives and simple objects
      if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sleep for the specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
