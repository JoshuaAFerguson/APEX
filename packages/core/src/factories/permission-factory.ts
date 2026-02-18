/**
 * Permission Factory - Mock factories for Permission and related domain types
 */

import type {
  Permission,
  PermissionLevel,
  PermissionQuery,
  ExtendedPermission,
  ToolPermission,
  ToolCategory,
  PermissionDetails,
  PermissionChangeEvent,
  PermissionChangeType,
} from '../types.js';

// ============================================================================
// Permission Factory
// ============================================================================

export interface PermissionOverrides {
  tool?: string;
  scope?: string;
  level?: PermissionLevel;
  expiry?: Date;
  createdAt?: Date;
}

/**
 * Creates a mock Permission with realistic default values
 *
 * @param overrides - Partial permission properties to override defaults
 * @returns Complete Permission object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create permission with defaults
 * const permission = createPermission();
 *
 * // Create custom permission
 * const customPermission = createPermission({
 *   tool: 'Write',
 *   scope: '/src/**',
 *   level: 'allow-always'
 * });
 * ```
 */
export function createPermission(overrides: PermissionOverrides = {}): Permission {
  const defaults: Permission = {
    tool: 'Read',
    scope: '/src/**/*.ts',
    level: 'allow-always',
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Permission Query Factory
// ============================================================================

export interface PermissionQueryOverrides {
  tool?: string;
  scope?: string;
}

/**
 * Creates a mock PermissionQuery for testing permission lookups
 */
export function createPermissionQuery(overrides: PermissionQueryOverrides = {}): PermissionQuery {
  const defaults: PermissionQuery = {
    tool: 'Write',
    scope: '/src/components/Login.tsx',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Extended Permission Factory
// ============================================================================

export interface ExtendedPermissionOverrides {
  tool?: string;
  scope?: string;
  level?: PermissionLevel;
  expiry?: Date;
  createdAt?: Date;
  grantedBy?: string;
  reason?: string;
  context?: Record<string, unknown>;
  usageCount?: number;
  lastUsed?: Date;
}

/**
 * Creates a mock ExtendedPermission with additional metadata
 */
export function createExtendedPermission(overrides: ExtendedPermissionOverrides = {}): ExtendedPermission {
  const defaults: ExtendedPermission = {
    tool: 'Edit',
    scope: '/src/**/*.tsx',
    level: 'allow-always',
    createdAt: new Date(),
    grantedBy: 'user@example.com',
    reason: 'Development work on React components',
    context: {
      project: 'APEX',
      environment: 'development',
      riskLevel: 'low',
    },
    usageCount: 15,
    lastUsed: new Date(Date.now() - 3600000), // 1 hour ago
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Permission Details Factory
// ============================================================================

export interface PermissionDetailsOverrides {
  category?: ToolCategory;
  permission?: ToolPermission;
  previousLevel?: PermissionLevel | null;
  newLevel?: PermissionLevel | null;
  reason?: string;
  agentName?: string;
  taskId?: string;
}

/**
 * Creates mock PermissionDetails for permission change tracking
 */
export function createPermissionDetails(overrides: PermissionDetailsOverrides = {}): PermissionDetails {
  const defaults: PermissionDetails = {
    category: 'filesystem',
    permission: 'write',
    previousLevel: null,
    newLevel: 'allow-always',
    reason: 'Agent needs write access to implement feature',
    agentName: 'developer',
    taskId: 'task_123456',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Permission Change Event Factory
// ============================================================================

export interface PermissionChangeEventOverrides {
  changeType?: PermissionChangeType;
  permission?: PermissionDetails;
  timestamp?: Date;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a mock PermissionChangeEvent for testing permission change notifications
 */
export function createPermissionChangeEvent(overrides: PermissionChangeEventOverrides = {}): PermissionChangeEvent {
  const defaults: PermissionChangeEvent = {
    changeType: 'granted',
    permission: createPermissionDetails(),
    timestamp: new Date(),
    message: 'Filesystem write permission granted to developer agent for task execution',
    metadata: {
      source: 'user-interaction',
      autoGranted: false,
      riskAssessment: {
        level: 'low',
        factors: ['development-environment', 'trusted-agent'],
      },
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Specialized Permission Factories
// ============================================================================

/**
 * Creates filesystem permissions for common development scenarios
 */
export function createFilesystemPermissions(): {
  readSource: Permission;
  writeSource: Permission;
  readTests: Permission;
  writeTests: Permission;
  readConfig: Permission;
} {
  return {
    readSource: createPermission({
      tool: 'Read',
      scope: '/src/**/*',
      level: 'allow-always',
    }),
    writeSource: createPermission({
      tool: 'Write',
      scope: '/src/**/*.{ts,tsx,js,jsx}',
      level: 'allow-always',
    }),
    readTests: createPermission({
      tool: 'Read',
      scope: '**/*.{test,spec}.{ts,tsx,js,jsx}',
      level: 'allow-always',
    }),
    writeTests: createPermission({
      tool: 'Write',
      scope: '**/*.{test,spec}.{ts,tsx,js,jsx}',
      level: 'allow-always',
    }),
    readConfig: createPermission({
      tool: 'Read',
      scope: '{package.json,tsconfig.json,*.config.{js,ts}}',
      level: 'allow-always',
    }),
  };
}

/**
 * Creates shell execution permissions with different security levels
 */
export function createShellPermissions(): {
  basicCommands: Permission;
  packageManager: Permission;
  buildCommands: Permission;
  dangerousCommands: Permission;
} {
  return {
    basicCommands: createPermission({
      tool: 'Bash',
      scope: 'ls|cat|grep|find|pwd',
      level: 'allow-always',
    }),
    packageManager: createPermission({
      tool: 'Bash',
      scope: 'npm|yarn|pnpm',
      level: 'allow-once',
    }),
    buildCommands: createPermission({
      tool: 'Bash',
      scope: 'npm run|yarn|tsc|webpack',
      level: 'allow-once',
    }),
    dangerousCommands: createPermission({
      tool: 'Bash',
      scope: 'rm|sudo|chmod|mv',
      level: 'deny',
    }),
  };
}

/**
 * Creates web access permissions for API and content fetching
 */
export function createWebPermissions(): {
  apiAccess: Permission;
  documentation: Permission;
  packageRegistry: Permission;
  socialMedia: Permission;
} {
  return {
    apiAccess: createPermission({
      tool: 'WebFetch',
      scope: 'api.github.com|api.openai.com',
      level: 'allow-always',
    }),
    documentation: createPermission({
      tool: 'WebSearch',
      scope: 'developer.mozilla.org|stackoverflow.com|docs.npmjs.com',
      level: 'allow-always',
    }),
    packageRegistry: createPermission({
      tool: 'WebFetch',
      scope: 'registry.npmjs.org|api.github.com/repos',
      level: 'allow-always',
    }),
    socialMedia: createPermission({
      tool: 'WebFetch',
      scope: 'twitter.com|facebook.com|instagram.com',
      level: 'deny',
    }),
  };
}

// ============================================================================
// Permission Collections
// ============================================================================

/**
 * Creates a comprehensive permission set for a typical development agent
 */
export function createDeveloperPermissions(): Permission[] {
  return [
    // Filesystem permissions
    ...Object.values(createFilesystemPermissions()),
    // Basic shell commands
    createPermission({
      tool: 'Bash',
      scope: 'ls|pwd|cd|cat|grep|find',
      level: 'allow-always',
    }),
    // Package management
    createPermission({
      tool: 'Bash',
      scope: 'npm install|npm run|npm test',
      level: 'allow-once',
    }),
    // Git operations
    createPermission({
      tool: 'Bash',
      scope: 'git status|git diff|git add|git commit|git push',
      level: 'allow-once',
    }),
    // Web access for docs
    createPermission({
      tool: 'WebSearch',
      scope: 'developer.mozilla.org|typescript.org',
      level: 'allow-always',
    }),
  ];
}

/**
 * Creates restricted permissions for a security-sensitive environment
 */
export function createRestrictedPermissions(): Permission[] {
  return [
    // Read-only filesystem access
    createPermission({
      tool: 'Read',
      scope: '/src/**/*',
      level: 'allow-always',
    }),
    // Very limited shell access
    createPermission({
      tool: 'Bash',
      scope: 'ls|pwd|cat',
      level: 'allow-once',
    }),
    // No write permissions
    createPermission({
      tool: 'Write',
      scope: '**/*',
      level: 'deny',
    }),
    // No web access
    createPermission({
      tool: 'WebFetch',
      scope: '*',
      level: 'deny',
    }),
  ];
}

/**
 * Creates multiple permissions with different expiry times
 */
export function createTemporaryPermissions(count: number): Permission[] {
  const now = new Date();
  const durations = [
    60 * 1000,       // 1 minute
    5 * 60 * 1000,   // 5 minutes
    60 * 60 * 1000,  // 1 hour
    24 * 60 * 60 * 1000, // 1 day
  ];

  return Array.from({ length: count }, (_, index) => {
    const duration = durations[index % durations.length];
    return createPermission({
      tool: `Tool${index + 1}`,
      scope: `/path/${index + 1}/**/*`,
      level: 'allow-always',
      expiry: new Date(now.getTime() + duration),
    });
  });
}

/**
 * Creates a permission change history for testing
 */
export function createPermissionChangeHistory(count: number): PermissionChangeEvent[] {
  const changeTypes: PermissionChangeType[] = ['granted', 'revoked', 'modified'];
  const tools = ['Read', 'Write', 'Edit', 'Bash', 'WebFetch'];
  const agents = ['developer', 'tester', 'reviewer', 'planner'];

  return Array.from({ length: count }, (_, index) => {
    const changeType = changeTypes[index % changeTypes.length];
    const tool = tools[index % tools.length];
    const agent = agents[index % agents.length];

    return createPermissionChangeEvent({
      changeType,
      permission: createPermissionDetails({
        category: 'filesystem',
        permission: 'write',
        previousLevel: changeType === 'granted' ? null : 'allow-always',
        newLevel: changeType === 'revoked' ? null : 'allow-always',
        agentName: agent,
        reason: `${changeType} ${tool.toLowerCase()} permission for ${agent} agent`,
      }),
      timestamp: new Date(Date.now() - (count - index) * 60000), // Spread over time
      message: `Permission ${changeType}: ${tool} access for ${agent} agent`,
    });
  });
}

/**
 * Creates permission test scenarios for comprehensive testing
 */
export function createPermissionTestScenarios(): {
  grantNew: PermissionChangeEvent;
  revokeExisting: PermissionChangeEvent;
  modifyExisting: PermissionChangeEvent;
  expiredPermission: Permission;
  validPermission: Permission;
} {
  const now = new Date();

  return {
    grantNew: createPermissionChangeEvent({
      changeType: 'granted',
      permission: createPermissionDetails({
        previousLevel: null,
        newLevel: 'allow-always',
        reason: 'Initial permission grant for new task',
      }),
    }),
    revokeExisting: createPermissionChangeEvent({
      changeType: 'revoked',
      permission: createPermissionDetails({
        previousLevel: 'allow-always',
        newLevel: null,
        reason: 'Task completed, revoking temporary permissions',
      }),
    }),
    modifyExisting: createPermissionChangeEvent({
      changeType: 'modified',
      permission: createPermissionDetails({
        previousLevel: 'allow-once',
        newLevel: 'allow-always',
        reason: 'Upgrading permission level for complex task',
      }),
    }),
    expiredPermission: createPermission({
      tool: 'TemporaryTool',
      level: 'allow-always',
      expiry: new Date(now.getTime() - 3600000), // Expired 1 hour ago
    }),
    validPermission: createPermission({
      tool: 'PersistentTool',
      level: 'allow-always',
      expiry: new Date(now.getTime() + 3600000), // Expires in 1 hour
    }),
  };
}