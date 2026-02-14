/**
 * @fileoverview Comprehensive Timeout Configurations and Wait Strategies Documentation
 *
 * This file documents all timeout configurations and wait strategies implemented
 * in the APEX codebase. It serves as the authoritative reference for understanding
 * how timeouts are configured, applied, and managed across different components.
 *
 * @version 1.0.0
 * @author APEX Development Team
 */

/**
 * =============================================================================
 * TIMEOUT CONFIGURATION TYPES
 * =============================================================================
 *
 * The following interfaces document all timeout-related configurations
 * available in the APEX system, organized by component.
 */

/**
 * Browser Automation Timeout Configurations
 * Used in browser-tool.ts and related components
 */
export interface BrowserTimeoutConfig {
  /** Maximum page load timeout in milliseconds (default: varies by operation) */
  pageLoadTimeout?: number;

  /** Navigation timeout in milliseconds for page navigation operations */
  navigationTimeout?: number;

  /** Default timeout in milliseconds for general browser operations (default: 30000) */
  defaultTimeout?: number;

  /** Timeout for waitForSelector operations in milliseconds */
  selectorWaitTimeout?: number;

  /** Preview timeout for diff preview operations (default: 5000) */
  previewTimeout?: number;
}

/**
 * Tool Execution Timeout Configurations
 * Applied to various tools including custom tools, MCP tools, and system tools
 */
export interface ToolExecutionTimeoutConfig {
  /** Timeout for tool execution in milliseconds (default: 60000) */
  executionTimeoutMs?: number;

  /** Tool invocation timeout in milliseconds (default: 30000) */
  invocationTimeoutMs?: number;

  /** Hook execution timeout in milliseconds (default: 30000) */
  hookTimeoutMs?: number;

  /** Default timeout for all hooks in milliseconds */
  defaultHookTimeoutMs?: number;

  /** Linter execution timeout in milliseconds (default: 30000) */
  linterTimeoutMs?: number;

  /** Global timeout for all linters in milliseconds (default: 60000) */
  globalLinterTimeoutMs?: number;
}

/**
 * MCP Connection Timeout Configurations
 * Used for Model Context Protocol server connections
 */
export interface MCPTimeoutConfig {
  /** Connection timeout in milliseconds (default: 10000) */
  connectionTimeoutMs?: number;

  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;

  /** Idle timeout in milliseconds (default: 300000, 0 = no timeout) */
  idleTimeoutMs?: number;

  /** Health check timeout in milliseconds (default: 5000) */
  healthCheckTimeoutMs?: number;
}

/**
 * Approval Gate Timeout Configurations
 * Used in approval workflows and permission gates
 */
export interface ApprovalTimeoutConfig {
  /** Timeout in minutes before the gate auto-rejects (undefined = no timeout) */
  gateTimeoutMinutes?: number;

  /** Whether to auto-approve if timeout is reached (default: false = auto-reject) */
  autoApproveOnTimeout?: boolean;

  /** Global approval timeout in minutes */
  globalApprovalTimeoutMinutes?: number;

  /** Agent-specific approval timeout overrides */
  agentApprovalTimeouts?: Record<string, number>;
}

/**
 * Dependency Installation Timeout Configurations
 * Used during package installation and dependency management
 */
export interface DependencyTimeoutConfig {
  /** Timeout for dependency installation in milliseconds */
  installTimeoutMs?: number;

  /** Default timeout for dependency installation operations */
  defaultInstallTimeoutMs?: number;
}

/**
 * Policy Enforcement Timeout Configurations
 * Used in policy engine and security enforcement
 */
export interface PolicyTimeoutConfig {
  /** Timeout for policy evaluation in milliseconds */
  evaluationTimeoutMs?: number;
}

/**
 * =============================================================================
 * WAIT STRATEGIES AND PATTERNS
 * =============================================================================
 *
 * Documentation of different wait strategies used throughout the system
 */

/**
 * Wait Strategy Types
 * Different approaches to waiting for conditions or operations
 */
export enum WaitStrategyType {
  /** Simple timeout - fail after specified time */
  TIMEOUT = 'timeout',

  /** Polling - repeatedly check condition until timeout */
  POLLING = 'polling',

  /** Event-based - wait for specific events */
  EVENT_BASED = 'event_based',

  /** Race condition - first of multiple operations wins */
  RACE = 'race',

  /** Exponential backoff - increasing delays between attempts */
  EXPONENTIAL_BACKOFF = 'exponential_backoff',

  /** Linear backoff - fixed delays between attempts */
  LINEAR_BACKOFF = 'linear_backoff'
}

/**
 * Browser Wait Strategies
 * Specific to browser automation operations
 */
export interface BrowserWaitStrategy {
  /** Type of wait strategy */
  type: 'load' | 'domcontentloaded' | 'networkidle' | 'selector' | 'function';

  /** Maximum time to wait */
  timeout?: number;

  /** For selector waits - whether element must be visible */
  visible?: boolean;

  /** For function waits - custom evaluation function */
  evaluateFunction?: string;
}

/**
 * Approval Wait Strategy
 * Used in approval gate controllers
 */
export interface ApprovalWaitStrategy {
  /** Timeout in minutes */
  timeoutMinutes?: number;

  /** Action to take on timeout: 'reject' | 'approve' | 'escalate' */
  timeoutAction?: 'reject' | 'approve' | 'escalate';

  /** Urgency level affecting timeout behavior */
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * =============================================================================
 * TIMEOUT APPLICATION PATTERNS
 * =============================================================================
 *
 * Common patterns for applying timeouts in the APEX system
 */

/**
 * Pattern 1: Promise.race with timeout
 * Used when you need to race an operation against a timeout
 *
 * Example locations:
 * - packages/orchestrator/src/index.ts (lines 1783-1797)
 * - approval-gate-controller.ts (timeout handling)
 */
export class PromiseRaceTimeoutPattern {
  static async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([operation, timeoutPromise]);
  }
}

/**
 * Pattern 2: setTimeout with cleanup
 * Used in approval gates and other stateful operations
 *
 * Example location:
 * - approval-gate-controller.ts (line 161-163)
 */
export class SetTimeoutWithCleanupPattern {
  private timeoutHandle?: NodeJS.Timeout;

  setupTimeout(callback: () => void, timeoutMs: number): void {
    this.clearTimeout();
    this.timeoutHandle = setTimeout(callback, timeoutMs);
  }

  clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  isTimeoutActive(): boolean {
    return this.timeoutHandle !== undefined;
  }
}

/**
 * Pattern 3: Exponential backoff for retries
 * Used in connection management and error recovery
 *
 * Example usage in MCP connection manager
 */
export class ExponentialBackoffPattern {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts: number;
      baseDelayMs: number;
      backoffMultiplier: number;
      maxDelayMs?: number;
    }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === options.maxAttempts) {
          throw new Error(`Operation failed after ${options.maxAttempts} attempts. Last error: ${lastError.message}`);
        }

        const delay = Math.min(
          options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1),
          options.maxDelayMs || Infinity
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * Pattern 4: Wait with polling
 * Used for checking conditions repeatedly
 */
export class PollingWaitPattern {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeoutMs: number;
      intervalMs: number;
      timeoutError?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < options.timeoutMs) {
      if (await condition()) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, options.intervalMs));
    }

    throw new Error(options.timeoutError || `Condition not met within ${options.timeoutMs}ms`);
  }
}

/**
 * =============================================================================
 * SYSTEM-SPECIFIC TIMEOUT CONFIGURATIONS
 * =============================================================================
 *
 * Default timeout values used throughout the system
 */

/**
 * Default timeout values for different components
 */
export const DEFAULT_TIMEOUTS = {
  // Browser automation
  BROWSER_PAGE_LOAD: 30000,
  BROWSER_NAVIGATION: 30000,
  BROWSER_SELECTOR_WAIT: 30000,
  BROWSER_PREVIEW: 5000,

  // Tool execution
  TOOL_EXECUTION: 60000,
  TOOL_INVOCATION: 30000,
  HOOK_EXECUTION: 30000,
  LINTER_EXECUTION: 30000,
  GLOBAL_LINTER: 60000,

  // MCP connections
  MCP_CONNECTION: 10000,
  MCP_REQUEST: 30000,
  MCP_IDLE: 300000,
  MCP_HEALTH_CHECK: 5000,

  // Approval gates
  APPROVAL_GLOBAL: 60, // minutes
  APPROVAL_LOW_URGENCY: 1440, // 24 hours in minutes
  APPROVAL_NORMAL_URGENCY: 60, // 1 hour in minutes
  APPROVAL_HIGH_URGENCY: 15, // 15 minutes
  APPROVAL_CRITICAL_URGENCY: 5, // 5 minutes

  // Dependencies
  DEPENDENCY_INSTALL: 300000, // 5 minutes

  // Policy evaluation
  POLICY_EVALUATION: 5000,
} as const;

/**
 * =============================================================================
 * TIMEOUT HIERARCHY AND PRECEDENCE
 * =============================================================================
 *
 * How different timeout configurations interact and take precedence
 */

/**
 * Timeout precedence rules:
 * 1. Operation-specific timeouts (highest precedence)
 * 2. Component-specific configurations
 * 3. Global default timeouts
 * 4. System fallback values (lowest precedence)
 *
 * Example: For browser operations
 * - waitForSelector({ timeout: 5000 }) - operation-specific
 * - BrowserConfig.defaultTimeout - component configuration
 * - DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT - global default
 * - 30000 - system fallback
 */

/**
 * =============================================================================
 * TESTING PATTERNS
 * =============================================================================
 *
 * Common patterns used in timeout-related tests
 */

/**
 * Test patterns for timeout behavior
 */
export class TimeoutTestPatterns {
  /**
   * Pattern for testing timeout with vi.useFakeTimers()
   * Used in timeout-integration-comprehensive.test.ts
   */
  static async testTimeoutWithFakeTimers(
    operation: () => Promise<any>,
    timeoutMs: number,
    expectedError: string
  ): Promise<void> {
    // This would be used in a test context with vitest
    // vi.useFakeTimers();

    const promise = operation();

    // Fast forward past timeout
    // vi.advanceTimersByTime(timeoutMs + 100);

    // await expect(promise).rejects.toThrow(expectedError);
  }

  /**
   * Pattern for testing timeout cancellation
   */
  static async testTimeoutCancellation(
    operation: () => Promise<any>,
    cancelAfterMs: number
  ): Promise<void> {
    // Test that timeouts are properly cleaned up when operations complete early
  }

  /**
   * Pattern for testing concurrent timeouts
   */
  static async testConcurrentTimeouts(
    operations: Array<() => Promise<any>>,
    timeouts: number[]
  ): Promise<void> {
    // Test multiple operations with different timeouts running concurrently
  }
}

/**
 * =============================================================================
 * CONFIGURATION EXAMPLES
 * =============================================================================
 *
 * Example configurations showing how to properly set up timeouts
 */

/**
 * Example: Complete timeout configuration for a production environment
 */
export const PRODUCTION_TIMEOUT_CONFIG = {
  browser: {
    pageLoadTimeout: 45000, // 45 seconds for slow networks
    navigationTimeout: 60000, // 1 minute for complex pages
    defaultTimeout: 30000,
    previewTimeout: 10000, // 10 seconds for diff previews
  },
  tools: {
    executionTimeoutMs: 120000, // 2 minutes for complex tools
    invocationTimeoutMs: 45000, // 45 seconds for tool startup
    hookTimeoutMs: 60000, // 1 minute for hooks
    linterTimeoutMs: 45000, // 45 seconds for linting
  },
  mcp: {
    connectionTimeoutMs: 15000, // 15 seconds for connections
    requestTimeoutMs: 60000, // 1 minute for complex requests
    idleTimeoutMs: 600000, // 10 minutes idle timeout
    healthCheckTimeoutMs: 10000, // 10 seconds for health checks
  },
  approval: {
    globalApprovalTimeoutMinutes: 120, // 2 hours default
    autoApproveOnTimeout: false, // Require explicit approval
  },
  dependencies: {
    installTimeoutMs: 600000, // 10 minutes for large dependencies
  },
} as const;

/**
 * Example: Development timeout configuration (faster timeouts for quick feedback)
 */
export const DEVELOPMENT_TIMEOUT_CONFIG = {
  browser: {
    pageLoadTimeout: 15000,
    navigationTimeout: 20000,
    defaultTimeout: 10000,
    previewTimeout: 3000,
  },
  tools: {
    executionTimeoutMs: 30000,
    invocationTimeoutMs: 15000,
    hookTimeoutMs: 20000,
    linterTimeoutMs: 15000,
  },
  mcp: {
    connectionTimeoutMs: 5000,
    requestTimeoutMs: 20000,
    idleTimeoutMs: 120000, // 2 minutes
    healthCheckTimeoutMs: 3000,
  },
  approval: {
    globalApprovalTimeoutMinutes: 30, // 30 minutes
    autoApproveOnTimeout: true, // Auto-approve in dev for convenience
  },
  dependencies: {
    installTimeoutMs: 180000, // 3 minutes
  },
} as const;

/**
 * =============================================================================
 * TIMEOUT UTILITIES
 * =============================================================================
 *
 * Utility functions for working with timeouts consistently
 */

/**
 * Utility for creating timeout promises
 */
export class TimeoutUtils {
  /**
   * Create a timeout promise that rejects after specified time
   */
  static createTimeout(ms: number, message?: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Wrap a promise with a timeout
   */
  static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    return Promise.race([
      promise,
      this.createTimeout(timeoutMs, timeoutMessage)
    ]);
  }

  /**
   * Convert minutes to milliseconds (for approval timeouts)
   */
  static minutesToMs(minutes: number): number {
    return minutes * 60 * 1000;
  }

  /**
   * Convert milliseconds to minutes (for display)
   */
  static msToMinutes(ms: number): number {
    return ms / (60 * 1000);
  }

  /**
   * Format timeout for display
   */
  static formatTimeout(ms: number): string {
    if (ms === 0) {
      return 'No timeout';
    } else if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}m`;
    } else {
      return `${(ms / 3600000).toFixed(1)}h`;
    }
  }
}

/**
 * =============================================================================
 * DEBUGGING AND MONITORING
 * =============================================================================
 *
 * Utilities for debugging timeout issues
 */

/**
 * Timeout monitoring and debugging utilities
 */
export class TimeoutDebugUtils {
  private static activeTimeouts = new Map<string, {
    id: string;
    startTime: number;
    timeoutMs: number;
    operation: string;
    handle?: NodeJS.Timeout;
  }>();

  /**
   * Register a timeout for monitoring
   */
  static registerTimeout(
    id: string,
    timeoutMs: number,
    operation: string
  ): void {
    this.activeTimeouts.set(id, {
      id,
      startTime: Date.now(),
      timeoutMs,
      operation,
    });
  }

  /**
   * Unregister a timeout (when operation completes)
   */
  static unregisterTimeout(id: string): void {
    this.activeTimeouts.delete(id);
  }

  /**
   * Clear all registered timeouts
   */
  static clearAll(): void {
    this.activeTimeouts.clear();
  }

  /**
   * Get all currently active timeouts
   */
  static getActiveTimeouts(): Array<{
    id: string;
    operation: string;
    elapsedMs: number;
    remainingMs: number;
    timeoutMs: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeTimeouts.values()).map(timeout => ({
      id: timeout.id,
      operation: timeout.operation,
      elapsedMs: now - timeout.startTime,
      remainingMs: Math.max(0, timeout.timeoutMs - (now - timeout.startTime)),
      timeoutMs: timeout.timeoutMs,
    }));
  }

  /**
   * Log timeout statistics
   */
  static logTimeoutStats(): void {
    const active = this.getActiveTimeouts();
    console.log(`Active timeouts: ${active.length}`);
    active.forEach(timeout => {
      console.log(
        `  ${timeout.id}: ${timeout.operation} - ` +
        `${timeout.elapsedMs}ms elapsed, ${timeout.remainingMs}ms remaining`
      );
    });
  }
}

export default {
  DEFAULT_TIMEOUTS,
  PRODUCTION_TIMEOUT_CONFIG,
  DEVELOPMENT_TIMEOUT_CONFIG,
  TimeoutUtils,
  TimeoutDebugUtils,
  PromiseRaceTimeoutPattern,
  SetTimeoutWithCleanupPattern,
  ExponentialBackoffPattern,
  PollingWaitPattern,
  TimeoutTestPatterns,
};