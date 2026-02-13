/**
 * Permission Integration Test Fixtures
 *
 * Provides comprehensive test utilities for testing APEX permission system including:
 * - Permission approval workflows
 * - MCP (Model Context Protocol) permission integration
 * - User consent simulation
 * - Permission store operations
 * - Multi-agent permission scenarios
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type {
  Permission,
  PermissionLevel,
  PermissionQuery,
  AgentTool,
} from '@apexcli/core';

// ============================================================================
// Permission Workflow States
// ============================================================================

export type PermissionWorkflowState =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'revoked';

export interface PermissionRequest {
  id: string;
  tool: AgentTool;
  scope?: string;
  requestedBy: string; // Agent ID
  requestedAt: Date;
  state: PermissionWorkflowState;
  userResponse?: PermissionLevel;
  responseAt?: Date;
  expiryMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PermissionApprovalContext {
  agentId: string;
  taskId: string;
  toolName: AgentTool;
  toolArgs: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  impactDescription: string;
  suggestedPermission: PermissionLevel;
  alternativeOptions?: string[];
}

// ============================================================================
// Mock Permission Approval System
// ============================================================================

/**
 * Mock implementation of user permission approval system
 * Simulates user interaction for permission requests
 */
export class MockPermissionApprovalSystem extends EventEmitter {
  private pendingRequests = new Map<string, PermissionRequest>();
  private approvalHistory: PermissionRequest[] = [];
  private autoApprovalRules = new Map<string, PermissionLevel>();
  private defaultResponse: PermissionLevel = 'deny';

  constructor(options: {
    defaultResponse?: PermissionLevel;
    autoApprove?: Array<{ tool: AgentTool; scope?: string; level: PermissionLevel }>;
  } = {}) {
    super();
    this.defaultResponse = options.defaultResponse || 'deny';

    if (options.autoApprove) {
      for (const rule of options.autoApprove) {
        const key = `${rule.tool}:${rule.scope || '*'}`;
        this.autoApprovalRules.set(key, rule.level);
      }
    }
  }

  /**
   * Request permission for a tool operation
   */
  async requestPermission(context: PermissionApprovalContext): Promise<PermissionRequest> {
    const request: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tool: context.toolName,
      scope: context.toolArgs.scope as string,
      requestedBy: context.agentId,
      requestedAt: new Date(),
      state: 'pending',
      metadata: {
        taskId: context.taskId,
        riskLevel: context.riskLevel,
        impactDescription: context.impactDescription,
        toolArgs: context.toolArgs,
      },
    };

    this.pendingRequests.set(request.id, request);
    this.emit('permissionRequested', request, context);

    // Check auto-approval rules
    const autoApproval = this.checkAutoApproval(context.toolName, request.scope);
    if (autoApproval) {
      return this.respondToRequest(request.id, autoApproval);
    }

    // Simulate user thinking time
    setTimeout(() => {
      if (this.pendingRequests.has(request.id)) {
        this.respondToRequest(request.id, this.defaultResponse);
      }
    }, 100); // Quick response for tests

    return request;
  }

  /**
   * Simulate user response to permission request
   */
  async respondToRequest(
    requestId: string,
    response: PermissionLevel,
    expiryMs?: number
  ): Promise<PermissionRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Permission request ${requestId} not found`);
    }

    request.userResponse = response;
    request.responseAt = new Date();
    request.state = response === 'deny' ? 'denied' : 'approved';
    request.expiryMs = expiryMs;

    this.pendingRequests.delete(requestId);
    this.approvalHistory.push(request);

    this.emit('permissionResponded', request, response);

    return request;
  }

  /**
   * Check if there's an auto-approval rule for this tool/scope
   */
  private checkAutoApproval(tool: AgentTool, scope?: string): PermissionLevel | null {
    // Check exact match first
    const exactKey = `${tool}:${scope || '*'}`;
    if (this.autoApprovalRules.has(exactKey)) {
      return this.autoApprovalRules.get(exactKey)!;
    }

    // Check wildcard match
    const wildcardKey = `${tool}:*`;
    if (this.autoApprovalRules.has(wildcardKey)) {
      return this.autoApprovalRules.get(wildcardKey)!;
    }

    return null;
  }

  /**
   * Add auto-approval rule
   */
  addAutoApprovalRule(tool: AgentTool, scope: string | undefined, level: PermissionLevel) {
    const key = `${tool}:${scope || '*'}`;
    this.autoApprovalRules.set(key, level);
  }

  /**
   * Remove auto-approval rule
   */
  removeAutoApprovalRule(tool: AgentTool, scope?: string) {
    const key = `${tool}:${scope || '*'}`;
    return this.autoApprovalRules.delete(key);
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Get approval history
   */
  getApprovalHistory(): PermissionRequest[] {
    return [...this.approvalHistory];
  }

  /**
   * Clear all state - useful for test cleanup
   */
  reset() {
    this.pendingRequests.clear();
    this.approvalHistory = [];
    this.removeAllListeners();
  }

  /**
   * Simulate bulk approval for testing
   */
  async approveAllPending(level: PermissionLevel = 'allow-always') {
    const pendingIds = Array.from(this.pendingRequests.keys());
    for (const id of pendingIds) {
      await this.respondToRequest(id, level);
    }
  }

  /**
   * Simulate bulk denial for testing
   */
  async denyAllPending() {
    await this.approveAllPending('deny');
  }
}

// ============================================================================
// MCP Permission Integration Mocks
// ============================================================================

/**
 * Mock MCP (Model Context Protocol) server for permission testing
 * Simulates the Claude Agent SDK permission integration
 */
export class MockMCPPermissionServer extends EventEmitter {
  private permissionStore: Map<string, Permission> = new Map();
  private callLog: Array<{
    method: string;
    args: unknown[];
    timestamp: Date;
    result?: unknown;
    error?: Error;
  }> = [];

  constructor() {
    super();
  }

  /**
   * Mock MCP method to check if permission exists
   */
  async hasPermission(query: PermissionQuery): Promise<boolean> {
    this.logCall('hasPermission', [query]);

    const key = this.getPermissionKey(query.tool, query.scope);
    const permission = this.permissionStore.get(key);

    if (!permission) return false;
    if (permission.level === 'deny') return false;
    if (permission.expiry && permission.expiry < new Date()) {
      // Remove expired permission
      this.permissionStore.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Mock MCP method to request permission
   */
  async requestPermission(
    tool: string,
    scope?: string,
    context?: Record<string, unknown>
  ): Promise<Permission> {
    this.logCall('requestPermission', [tool, scope, context]);

    // Simulate permission request workflow
    const permission: Permission = {
      tool,
      scope,
      level: 'allow-once', // Default for new requests
      createdAt: new Date(),
    };

    const key = this.getPermissionKey(tool, scope);
    this.permissionStore.set(key, permission);

    this.emit('permissionGranted', permission);
    return permission;
  }

  /**
   * Mock MCP method to store permission
   */
  async storePermission(permission: Permission): Promise<void> {
    this.logCall('storePermission', [permission]);

    const key = this.getPermissionKey(permission.tool, permission.scope);
    this.permissionStore.set(key, { ...permission });

    this.emit('permissionStored', permission);
  }

  /**
   * Mock MCP method to revoke permission
   */
  async revokePermission(tool: string, scope?: string): Promise<boolean> {
    this.logCall('revokePermission', [tool, scope]);

    const key = this.getPermissionKey(tool, scope);
    const existed = this.permissionStore.has(key);

    if (existed) {
      const permission = this.permissionStore.get(key)!;
      this.permissionStore.delete(key);
      this.emit('permissionRevoked', permission);
    }

    return existed;
  }

  /**
   * Mock MCP method to list all permissions
   */
  async listPermissions(): Promise<Permission[]> {
    this.logCall('listPermissions', []);
    return Array.from(this.permissionStore.values());
  }

  /**
   * Mock MCP method to clear expired permissions
   */
  async clearExpiredPermissions(): Promise<number> {
    this.logCall('clearExpiredPermissions', []);

    const now = new Date();
    let cleared = 0;

    for (const [key, permission] of this.permissionStore.entries()) {
      if (permission.expiry && permission.expiry < now) {
        this.permissionStore.delete(key);
        cleared++;
        this.emit('permissionExpired', permission);
      }
    }

    return cleared;
  }

  private getPermissionKey(tool: string, scope?: string): string {
    return `${tool}:${scope || '*'}`;
  }

  private logCall(method: string, args: unknown[], result?: unknown, error?: Error) {
    this.callLog.push({
      method,
      args,
      timestamp: new Date(),
      result,
      error,
    });
  }

  /**
   * Get call history for testing
   */
  getCallHistory(): typeof this.callLog {
    return [...this.callLog];
  }

  /**
   * Reset all state
   */
  reset() {
    this.permissionStore.clear();
    this.callLog = [];
    this.removeAllListeners();
  }

  /**
   * Get current permission count
   */
  getPermissionCount(): number {
    return this.permissionStore.size;
  }

  /**
   * Directly add permission for testing
   */
  addTestPermission(permission: Permission) {
    const key = this.getPermissionKey(permission.tool, permission.scope);
    this.permissionStore.set(key, permission);
  }
}

// ============================================================================
// Permission Test Scenarios
// ============================================================================

/**
 * Common permission testing scenarios
 */
export const permissionScenarios = {
  /**
   * First-time tool access - should require approval
   */
  firstTimeAccess: {
    tool: 'Read' as AgentTool,
    scope: '/project/sensitive.txt',
    expectsPermissionRequest: true,
    suggestedResponse: 'allow-once' as PermissionLevel,
    context: {
      riskLevel: 'medium' as const,
      impactDescription: 'Reading sensitive configuration file',
    },
  },

  /**
   * Previously approved tool - should use cached permission
   */
  cachedPermission: {
    tool: 'Write' as AgentTool,
    scope: '/project/output/',
    existingPermission: {
      tool: 'Write' as AgentTool,
      scope: '/project/output/',
      level: 'allow-always' as PermissionLevel,
      createdAt: new Date(),
    },
    expectsPermissionRequest: false,
  },

  /**
   * Dangerous operation - should be denied by default
   */
  dangerousOperation: {
    tool: 'Bash' as AgentTool,
    scope: 'rm -rf /*',
    expectsPermissionRequest: true,
    suggestedResponse: 'deny' as PermissionLevel,
    context: {
      riskLevel: 'high' as const,
      impactDescription: 'Attempting to delete all system files',
    },
  },

  /**
   * Expired permission - should require re-approval
   */
  expiredPermission: {
    tool: 'WebFetch' as AgentTool,
    scope: 'https://api.example.com/*',
    existingPermission: {
      tool: 'WebFetch' as AgentTool,
      scope: 'https://api.example.com/*',
      level: 'allow-always' as PermissionLevel,
      expiry: new Date(Date.now() - 1000), // Expired 1 second ago
      createdAt: new Date(Date.now() - 60000), // Created 1 minute ago
    },
    expectsPermissionRequest: true,
    suggestedResponse: 'allow-always' as PermissionLevel,
  },

  /**
   * Multi-agent permission conflict
   */
  multiAgentConflict: {
    agents: [
      { id: 'agent1', tool: 'Edit' as AgentTool, scope: '/project/src/main.ts' },
      { id: 'agent2', tool: 'Edit' as AgentTool, scope: '/project/src/main.ts' },
    ],
    expectsCoordination: true,
    resolution: 'sequential', // or 'deny-conflict'
  },
};

// ============================================================================
// Permission Integration Test Helpers
// ============================================================================

/**
 * Create a complete permission testing environment
 */
export async function createPermissionTestEnvironment(options: {
  initialPermissions?: Permission[];
  autoApprovalRules?: Array<{ tool: AgentTool; scope?: string; level: PermissionLevel }>;
  defaultResponse?: PermissionLevel;
  enableMCP?: boolean;
} = {}) {
  const {
    initialPermissions = [],
    autoApprovalRules = [],
    defaultResponse = 'deny',
    enableMCP = true,
  } = options;

  const approvalSystem = new MockPermissionApprovalSystem({
    defaultResponse,
    autoApprove: autoApprovalRules,
  });

  const mcpServer = enableMCP ? new MockMCPPermissionServer() : null;

  // Add initial permissions to MCP server
  if (mcpServer) {
    for (const permission of initialPermissions) {
      mcpServer.addTestPermission(permission);
    }
  }

  return {
    approvalSystem,
    mcpServer,

    /**
     * Simulate a permission workflow
     */
    async simulatePermissionWorkflow(
      tool: AgentTool,
      scope: string | undefined,
      agentId: string = 'test-agent',
      taskId: string = 'test-task'
    ) {
      const context: PermissionApprovalContext = {
        agentId,
        taskId,
        toolName: tool,
        toolArgs: { scope },
        riskLevel: 'medium',
        impactDescription: `Testing ${tool} access`,
        suggestedPermission: 'allow-once',
      };

      const request = await approvalSystem.requestPermission(context);

      if (mcpServer) {
        const hasExisting = await mcpServer.hasPermission({ tool, scope });
        if (!hasExisting && request.userResponse && request.userResponse !== 'deny') {
          await mcpServer.storePermission({
            tool,
            scope,
            level: request.userResponse,
            createdAt: new Date(),
          });
        }
      }

      return { request, hadExistingPermission: false };
    },

    /**
     * Test permission expiry handling
     */
    async testPermissionExpiry(tool: AgentTool, scope?: string, expiryMs: number = 1000) {
      if (!mcpServer) throw new Error('MCP server required for expiry testing');

      // Add permission with short expiry
      const permission: Permission = {
        tool,
        scope,
        level: 'allow-always',
        expiry: new Date(Date.now() + expiryMs),
        createdAt: new Date(),
      };

      await mcpServer.storePermission(permission);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, expiryMs + 100));

      // Should now be expired
      const hasPermission = await mcpServer.hasPermission({ tool, scope });
      return { hasPermission, permission };
    },

    /**
     * Test concurrent permission requests
     */
    async testConcurrentRequests(requests: Array<{ tool: AgentTool; scope?: string; agentId: string }>) {
      const results = await Promise.all(
        requests.map(({ tool, scope, agentId }) =>
          this.simulatePermissionWorkflow(tool, scope, agentId)
        )
      );

      return {
        requests: results.map(r => r.request),
        conflicts: results.filter(r => r.request.state === 'pending').length > 1,
      };
    },

    /**
     * Clean up test environment
     */
    cleanup() {
      approvalSystem.reset();
      if (mcpServer) {
        mcpServer.reset();
      }
    },
  };
}

/**
 * Permission testing assertion helpers
 */
export const permissionAssertions = {
  /**
   * Assert permission was requested
   */
  wasRequested: (approvalSystem: MockPermissionApprovalSystem, tool: AgentTool, scope?: string) => {
    const history = approvalSystem.getApprovalHistory();
    const pending = approvalSystem.getPendingRequests();

    const found = [...history, ...pending].some(req =>
      req.tool === tool && req.scope === scope
    );

    if (!found) {
      throw new Error(`Permission for ${tool}${scope ? `:${scope}` : ''} was not requested`);
    }
  },

  /**
   * Assert permission was approved
   */
  wasApproved: (approvalSystem: MockPermissionApprovalSystem, tool: AgentTool, scope?: string) => {
    const history = approvalSystem.getApprovalHistory();

    const found = history.find(req =>
      req.tool === tool &&
      req.scope === scope &&
      req.state === 'approved'
    );

    if (!found) {
      throw new Error(`Permission for ${tool}${scope ? `:${scope}` : ''} was not approved`);
    }

    return found;
  },

  /**
   * Assert permission was denied
   */
  wasDenied: (approvalSystem: MockPermissionApprovalSystem, tool: AgentTool, scope?: string) => {
    const history = approvalSystem.getApprovalHistory();

    const found = history.find(req =>
      req.tool === tool &&
      req.scope === scope &&
      req.state === 'denied'
    );

    if (!found) {
      throw new Error(`Permission for ${tool}${scope ? `:${scope}` : ''} was not denied`);
    }

    return found;
  },

  /**
   * Assert permission is cached
   */
  isCached: async (mcpServer: MockMCPPermissionServer, tool: string, scope?: string) => {
    const hasPermission = await mcpServer.hasPermission({ tool, scope });
    if (!hasPermission) {
      throw new Error(`Permission for ${tool}${scope ? `:${scope}` : ''} is not cached`);
    }
  },

  /**
   * Assert permission has expired
   */
  hasExpired: async (mcpServer: MockMCPPermissionServer, tool: string, scope?: string) => {
    const hasPermission = await mcpServer.hasPermission({ tool, scope });
    if (hasPermission) {
      throw new Error(`Permission for ${tool}${scope ? `:${scope}` : ''} has not expired`);
    }
  },
};

// ============================================================================
// Permission Test Factory Functions
// ============================================================================

/**
 * Factory for creating common permission test scenarios
 */
export const permissionTestFactory = {
  /**
   * Create a basic read permission scenario
   */
  readFileScenario: (filePath: string = '/project/test.txt') => ({
    tool: 'Read' as AgentTool,
    scope: filePath,
    permission: {
      tool: 'Read' as AgentTool,
      scope: filePath,
      level: 'allow-always' as PermissionLevel,
      createdAt: new Date(),
    },
  }),

  /**
   * Create a dangerous shell command scenario
   */
  dangerousShellScenario: (command: string = 'rm -rf /') => ({
    tool: 'Bash' as AgentTool,
    scope: command,
    expectDenial: true,
    riskLevel: 'high' as const,
  }),

  /**
   * Create a network access scenario
   */
  networkAccessScenario: (domain: string = 'api.example.com') => ({
    tool: 'WebFetch' as AgentTool,
    scope: `https://${domain}/*`,
    permission: {
      tool: 'WebFetch' as AgentTool,
      scope: `https://${domain}/*`,
      level: 'allow-once' as PermissionLevel,
      createdAt: new Date(),
    },
  }),

  /**
   * Create a temporary permission scenario
   */
  temporaryPermissionScenario: (tool: AgentTool, expiryMs: number = 5000) => ({
    tool,
    permission: {
      tool,
      level: 'allow-always' as PermissionLevel,
      expiry: new Date(Date.now() + expiryMs),
      createdAt: new Date(),
    },
  }),

  /**
   * Create a multi-agent conflict scenario
   */
  conflictScenario: (tool: AgentTool, scope: string, agentCount: number = 2) => ({
    agents: Array.from({ length: agentCount }, (_, i) => ({
      id: `agent-${i + 1}`,
      tool,
      scope,
    })),
    tool,
    scope,
  }),
};