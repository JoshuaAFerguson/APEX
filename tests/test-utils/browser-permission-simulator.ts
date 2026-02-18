/**
 * @fileoverview Browser Permission Simulation Utilities
 *
 * Advanced utilities for simulating browser automation permission scenarios including:
 * - Browser permission request/response simulation
 * - Permission state management for testing different access levels
 * - Integration with browser automation contexts
 * - Permission denial scenario simulation with different error types
 * - Cross-browser permission behavior simulation
 *
 * @module tests/test-utils/browser-permission-simulator
 */

import { vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  PermissionLevel,
  ToolPermissionResult
} from '../../packages/core/src/types.js';
import {
  BrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext,
  type BrowserResourceState,
  type BrowserLifecycleState
} from '../../packages/core/src/tools/browser/browser-permission-denied-error.js';
import type { MockBrowserContext } from './browser-automation-mocks.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Browser permission simulation configuration
 */
export interface BrowserPermissionSimulatorConfig {
  /** Default permission level for operations */
  defaultPermissionLevel: PermissionLevel;
  /** Operations to explicitly deny */
  denyOperations: string[];
  /** Domains with restricted access */
  restrictedDomains: string[];
  /** Whether to simulate network permission failures */
  simulateNetworkFailures: boolean;
  /** Whether to simulate timeout-based permission failures */
  simulateTimeouts: boolean;
  /** Custom permission rules */
  customRules: BrowserPermissionRule[];
  /** Default response delay in milliseconds */
  responseDelay: number;
}

/**
 * Custom browser permission rule
 */
export interface BrowserPermissionRule {
  /** Operation pattern to match */
  operation: string | RegExp;
  /** Domain pattern to match (optional) */
  domain?: string | RegExp;
  /** Permission level to grant */
  permissionLevel: PermissionLevel | 'deny';
  /** Reason for denial (if denying) */
  denialReason?: string;
  /** Custom delay for this rule */
  delay?: number;
}

/**
 * Permission request context for browser automation
 */
export interface BrowserPermissionRequestContext {
  /** The browser automation operation being requested */
  operation: string;
  /** Target domain or URL */
  domain?: string;
  /** Additional operation parameters */
  params?: Record<string, any>;
  /** Current browser context state */
  browserState?: BrowserResourceState;
  /** Request timestamp */
  timestamp: number;
}

/**
 * Permission response for browser automation
 */
export interface BrowserPermissionResponse {
  /** Whether permission was granted */
  granted: boolean;
  /** Permission level granted (if any) */
  level?: PermissionLevel;
  /** Reason for denial (if denied) */
  reason?: string;
  /** Additional metadata */
  metadata?: {
    /** Response time in milliseconds */
    responseTime: number;
    /** Rule that matched this request */
    matchedRule?: string;
    /** Browser context information */
    browserContext?: any;
  };
}

/**
 * Browser permission state manager
 */
export interface BrowserPermissionState {
  /** Currently granted permissions */
  grantedPermissions: Map<string, PermissionLevel>;
  /** Permission request history */
  requestHistory: BrowserPermissionRequestContext[];
  /** Active permission denials */
  activeDenials: Set<string>;
  /** Permission cache */
  permissionCache: Map<string, BrowserPermissionResponse>;
}

// ============================================================================
// Browser Permission Simulator Class
// ============================================================================

/**
 * Comprehensive browser permission simulator for testing
 */
export class BrowserPermissionSimulator extends EventEmitter {
  private config: BrowserPermissionSimulatorConfig;
  private state: BrowserPermissionState;
  private browserContext?: MockBrowserContext;

  constructor(config: Partial<BrowserPermissionSimulatorConfig> = {}) {
    super();

    this.config = {
      defaultPermissionLevel: 'read',
      denyOperations: [],
      restrictedDomains: [],
      simulateNetworkFailures: false,
      simulateTimeouts: false,
      customRules: [],
      responseDelay: 0,
      ...config,
    };

    this.state = {
      grantedPermissions: new Map(),
      requestHistory: [],
      activeDenials: new Set(),
      permissionCache: new Map(),
    };
  }

  /**
   * Set browser context for permission simulation
   */
  setBrowserContext(context: MockBrowserContext): void {
    this.browserContext = context;
    this.emit('context:set', { context });
  }

  /**
   * Simulate a browser automation permission request
   */
  async requestPermission(
    operation: string,
    options: {
      domain?: string;
      params?: Record<string, any>;
      bypassCache?: boolean;
    } = {}
  ): Promise<BrowserPermissionResponse> {
    const startTime = Date.now();

    // Create request context
    const requestContext: BrowserPermissionRequestContext = {
      operation,
      domain: options.domain,
      params: options.params,
      browserState: this.getCurrentBrowserState(),
      timestamp: startTime,
    };

    // Add to request history
    this.state.requestHistory.push(requestContext);

    this.emit('permission:requested', requestContext);

    // Check cache if not bypassing
    if (!options.bypassCache && this.state.permissionCache.has(operation)) {
      const cachedResponse = this.state.permissionCache.get(operation)!;
      this.emit('permission:cache-hit', { operation, response: cachedResponse });
      return cachedResponse;
    }

    // Simulate response delay
    if (this.config.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.responseDelay));
    }

    // Evaluate permission rules
    const response = await this.evaluatePermissionRules(requestContext);

    // Update state
    if (response.granted && response.level) {
      this.state.grantedPermissions.set(operation, response.level);
    } else {
      this.state.activeDenials.add(operation);
    }

    // Cache response
    this.state.permissionCache.set(operation, response);

    // Add response metadata
    response.metadata = {
      ...response.metadata,
      responseTime: Date.now() - startTime,
      browserContext: this.browserContext?.state,
    };

    this.emit('permission:responded', { request: requestContext, response });

    return response;
  }

  /**
   * Evaluate permission rules to determine response
   */
  private async evaluatePermissionRules(
    context: BrowserPermissionRequestContext
  ): Promise<BrowserPermissionResponse> {
    const { operation, domain } = context;

    // Simulate network failures
    if (this.config.simulateNetworkFailures) {
      if (Math.random() < 0.1) { // 10% chance of network failure
        throw new Error('Simulated network failure during permission check');
      }
    }

    // Simulate timeouts
    if (this.config.simulateTimeouts) {
      if (Math.random() < 0.05) { // 5% chance of timeout
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error('Permission request timeout');
      }
    }

    // Check custom rules first
    for (const rule of this.config.customRules) {
      if (this.matchesRule(rule, context)) {
        if (rule.delay) {
          await new Promise(resolve => setTimeout(resolve, rule.delay));
        }

        if (rule.permissionLevel === 'deny') {
          return {
            granted: false,
            reason: rule.denialReason || `Permission denied by custom rule for operation: ${operation}`,
            metadata: { matchedRule: 'custom' },
          };
        } else {
          return {
            granted: true,
            level: rule.permissionLevel as PermissionLevel,
            metadata: { matchedRule: 'custom' },
          };
        }
      }
    }

    // Check explicit denials
    if (this.config.denyOperations.includes(operation)) {
      return {
        granted: false,
        reason: `Operation ${operation} is explicitly denied by configuration`,
        metadata: { matchedRule: 'explicit-deny' },
      };
    }

    // Check domain restrictions
    if (domain && this.isDomainRestricted(domain)) {
      return {
        granted: false,
        reason: `Domain ${domain} is restricted`,
        metadata: { matchedRule: 'domain-restriction' },
      };
    }

    // Default grant with configured permission level
    return {
      granted: true,
      level: this.config.defaultPermissionLevel,
      metadata: { matchedRule: 'default' },
    };
  }

  /**
   * Check if a rule matches the request context
   */
  private matchesRule(rule: BrowserPermissionRule, context: BrowserPermissionRequestContext): boolean {
    // Match operation
    if (rule.operation instanceof RegExp) {
      if (!rule.operation.test(context.operation)) {
        return false;
      }
    } else if (rule.operation !== context.operation) {
      return false;
    }

    // Match domain if specified
    if (rule.domain && context.domain) {
      if (rule.domain instanceof RegExp) {
        if (!rule.domain.test(context.domain)) {
          return false;
        }
      } else if (rule.domain !== context.domain) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a domain is restricted
   */
  private isDomainRestricted(domain: string): boolean {
    return this.config.restrictedDomains.some(restricted => {
      if (typeof restricted === 'string') {
        return domain.includes(restricted);
      }
      return false;
    });
  }

  /**
   * Get current browser state from context
   */
  private getCurrentBrowserState(): BrowserResourceState | undefined {
    if (!this.browserContext) {
      return undefined;
    }

    return {
      browser: {
        isConnected: true,
        version: 'mock-version',
        contexts: 1,
      },
      context: {
        pages: 1,
        isIncognito: false,
      },
      page: {
        url: this.browserContext.page._mockState.currentUrl,
        title: this.browserContext.page._mockState.currentTitle,
        isLoading: this.browserContext.page._mockState.isNavigating,
      },
      lifecycle: 'ready' as BrowserLifecycleState,
      timestamp: Date.now(),
    };
  }

  /**
   * Grant permission for specific operation
   */
  grantPermission(operation: string, level: PermissionLevel = 'full'): void {
    this.state.grantedPermissions.set(operation, level);
    this.state.activeDenials.delete(operation);
    this.state.permissionCache.delete(operation); // Clear cache

    this.emit('permission:granted', { operation, level });
  }

  /**
   * Deny permission for specific operation
   */
  denyPermission(operation: string, reason?: string): void {
    this.state.grantedPermissions.delete(operation);
    this.state.activeDenials.add(operation);

    // Cache denial response
    this.state.permissionCache.set(operation, {
      granted: false,
      reason: reason || `Permission denied for operation: ${operation}`,
    });

    this.emit('permission:denied', { operation, reason });
  }

  /**
   * Clear all permissions and state
   */
  clearPermissions(): void {
    this.state.grantedPermissions.clear();
    this.state.activeDenials.clear();
    this.state.permissionCache.clear();
    this.state.requestHistory = [];

    this.emit('permissions:cleared');
  }

  /**
   * Get current permission state
   */
  getPermissionState(): BrowserPermissionState {
    return { ...this.state };
  }

  /**
   * Simulate browser permission denied error
   */
  createPermissionDeniedError(
    operation: string,
    context: Partial<BrowserPermissionDeniedContext> = {}
  ): BrowserPermissionDeniedError {
    const fullContext: BrowserPermissionDeniedContext = {
      operation,
      timestamp: Date.now(),
      requestId: `mock-request-${Date.now()}`,
      browserState: this.getCurrentBrowserState(),
      permissionLevel: 'none',
      ...context,
    };

    return new BrowserPermissionDeniedError(
      `Browser permission denied for operation: ${operation}`,
      fullContext
    );
  }

  /**
   * Generate permission test scenarios for comprehensive testing
   */
  static generateTestScenarios(): BrowserPermissionRule[] {
    return [
      // Navigation scenarios
      {
        operation: /^navigate/,
        permissionLevel: 'read',
        delay: 100,
      },
      {
        operation: 'navigate',
        domain: /localhost/,
        permissionLevel: 'full',
      },
      {
        operation: 'navigate',
        domain: /malicious-site\.com/,
        permissionLevel: 'deny',
        denialReason: 'Navigation to malicious domain blocked',
      },

      // Screenshot scenarios
      {
        operation: 'screenshot',
        permissionLevel: 'read',
      },
      {
        operation: 'screenshot',
        domain: /sensitive-data/,
        permissionLevel: 'deny',
        denialReason: 'Screenshot of sensitive content blocked',
      },

      // Interaction scenarios
      {
        operation: /^(click|type|evaluate)$/,
        permissionLevel: 'write',
      },
      {
        operation: 'evaluate',
        domain: /untrusted/,
        permissionLevel: 'deny',
        denialReason: 'Script execution on untrusted domain blocked',
      },

      // File system scenarios
      {
        operation: /^(download|upload)$/,
        permissionLevel: 'deny',
        denialReason: 'File system operations not allowed in test environment',
      },
    ];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create browser permission simulator with default test configuration
 */
export function createBrowserPermissionSimulator(
  config?: Partial<BrowserPermissionSimulatorConfig>
): BrowserPermissionSimulator {
  return new BrowserPermissionSimulator(config);
}

/**
 * Create test-specific permission simulator with common scenarios
 */
export function createTestPermissionSimulator(): BrowserPermissionSimulator {
  return new BrowserPermissionSimulator({
    defaultPermissionLevel: 'read',
    denyOperations: ['dangerous-operation', 'restricted-action'],
    restrictedDomains: ['blocked.com', 'malicious.site'],
    customRules: BrowserPermissionSimulator.generateTestScenarios(),
    responseDelay: 10, // Small delay for realistic testing
  });
}

/**
 * Mock browser permission manager for unit testing
 */
export function mockBrowserPermissionManager(): {
  simulator: BrowserPermissionSimulator;
  checkPermission: MockedFunction<(operation: string, options?: any) => Promise<ToolPermissionResult>>;
  grantPermission: MockedFunction<(operation: string, level?: PermissionLevel) => Promise<void>>;
  denyPermission: MockedFunction<(operation: string, reason?: string) => Promise<void>>;
} {
  const simulator = createTestPermissionSimulator();

  const checkPermission = vi.fn().mockImplementation(async (operation: string, options: any = {}) => {
    const response = await simulator.requestPermission(operation, options);

    return {
      granted: response.granted,
      level: response.level || 'none',
      reason: response.reason,
      metadata: response.metadata,
    } as ToolPermissionResult;
  });

  const grantPermission = vi.fn().mockImplementation(async (operation: string, level: PermissionLevel = 'full') => {
    simulator.grantPermission(operation, level);
  });

  const denyPermission = vi.fn().mockImplementation(async (operation: string, reason?: string) => {
    simulator.denyPermission(operation, reason);
  });

  return {
    simulator,
    checkPermission,
    grantPermission,
    denyPermission,
  };
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Browser permission test context for integration testing
 */
export interface BrowserPermissionTestContext {
  simulator: BrowserPermissionSimulator;
  browserContext?: MockBrowserContext;
  permissions: {
    granted: string[];
    denied: string[];
  };
  scenarios: BrowserPermissionRule[];
}

/**
 * Create comprehensive browser permission test context
 */
export function createBrowserPermissionTestContext(
  config?: Partial<BrowserPermissionSimulatorConfig>
): BrowserPermissionTestContext {
  const simulator = createBrowserPermissionSimulator(config);
  const scenarios = BrowserPermissionSimulator.generateTestScenarios();

  return {
    simulator,
    permissions: {
      granted: [],
      denied: [],
    },
    scenarios,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  BrowserPermissionSimulatorConfig,
  BrowserPermissionRule,
  BrowserPermissionRequestContext,
  BrowserPermissionResponse,
  BrowserPermissionState,
  BrowserPermissionTestContext,
};