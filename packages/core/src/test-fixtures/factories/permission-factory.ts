/**
 * @fileoverview Permission level fixture factories
 *
 * Provides factory functions for creating permission-related fixtures with various
 * permission levels, tool permissions, and scope-based restrictions.
 */

import type {
  PermissionLevel,
  Permission,
  ToolPermissionResult,
  AgentTool,
} from '../../types.js';
import type { FixtureFactory } from '../types.js';

// ============================================================================
// Configuration Options Types
// ============================================================================

/**
 * Configuration options for permission factory
 */
export interface PermissionFactoryOptions {
  /** Include tool-specific permissions */
  includeToolPermissions?: boolean;
  /** Include scope-based permissions */
  includeScopePermissions?: boolean;
  /** Default permission level */
  defaultLevel?: PermissionLevel;
  /** Tools to include in permissions */
  tools?: AgentTool[];
  /** Scopes to include in permissions */
  scopes?: string[];
  /** Whether to include expiry dates */
  includeExpiry?: boolean;
}

// ============================================================================
// Core Factory Functions
// ============================================================================

/**
 * Creates a ToolPermission fixture with sensible defaults
 *
 * @param overrides - Partial ToolPermission properties to override defaults
 * @returns A fully-typed ToolPermission object
 */
export const createToolPermission: FixtureFactory<Permission> = (overrides = {}) => ({
  tool: 'Read',
  scope: undefined,
  level: 'allow-always',
  expiry: undefined,
  createdAt: new Date(),
  ...overrides,
});

/**
 * Creates a ToolPermissionResult fixture
 */
export const createToolPermissionResult: FixtureFactory<ToolPermissionResult> = (overrides = {}) => ({
  allowed: true,
  level: 'allow-always',
  requiresConfirmation: false,
  ...overrides,
});

// ============================================================================
// Permission Level Specific Factories
// ============================================================================

/**
 * Creates an allow-always permission
 */
export const createAlwaysAllowPermission: FixtureFactory<Permission> = (overrides = {}) =>
  createToolPermission({
    level: 'allow-always',
    ...overrides,
  });

/**
 * Creates an allow-once permission
 */
export const createAllowOncePermission: FixtureFactory<Permission> = (overrides = {}) =>
  createToolPermission({
    level: 'allow-once',
    expiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    ...overrides,
  });

/**
 * Creates a deny permission
 */
export const createDenyPermission: FixtureFactory<Permission> = (overrides = {}) =>
  createToolPermission({
    level: 'deny',
    ...overrides,
  });

// ============================================================================
// Tool-Specific Permission Factories
// ============================================================================

/**
 * Creates file system tool permissions
 */
export const createFileSystemPermissions = () => ({
  readOnly: {
    Read: createAlwaysAllowPermission({ tool: 'Read' }),
    Write: createDenyPermission({ tool: 'Write' }),
    Edit: createDenyPermission({ tool: 'Edit' }),
    MultiEdit: createDenyPermission({ tool: 'MultiEdit' }),
  },

  fullAccess: {
    Read: createAlwaysAllowPermission({ tool: 'Read' }),
    Write: createAlwaysAllowPermission({ tool: 'Write' }),
    Edit: createAlwaysAllowPermission({ tool: 'Edit' }),
    MultiEdit: createAlwaysAllowPermission({ tool: 'MultiEdit' }),
  },

  cautious: {
    Read: createAlwaysAllowPermission({ tool: 'Read' }),
    Write: createAllowOncePermission({ tool: 'Write' }),
    Edit: createAllowOncePermission({ tool: 'Edit' }),
    MultiEdit: createDenyPermission({ tool: 'MultiEdit' }),
  },
});

/**
 * Creates network tool permissions
 */
export const createNetworkPermissions = () => ({
  offline: {
    WebFetch: createDenyPermission({ tool: 'WebFetch' }),
    WebSearch: createDenyPermission({ tool: 'WebSearch' }),
  },

  limited: {
    WebFetch: createAllowOncePermission({ tool: 'WebFetch' }),
    WebSearch: createDenyPermission({ tool: 'WebSearch' }),
  },

  full: {
    WebFetch: createAlwaysAllowPermission({ tool: 'WebFetch' }),
    WebSearch: createAlwaysAllowPermission({ tool: 'WebSearch' }),
  },
});

/**
 * Creates system tool permissions
 */
export const createSystemPermissions = () => ({
  restricted: {
    Bash: createDenyPermission({ tool: 'Bash' }),
  },

  limited: {
    Bash: createAllowOncePermission({ tool: 'Bash' }),
  },

  full: {
    Bash: createAlwaysAllowPermission({ tool: 'Bash' }),
  },
});

/**
 * Creates search tool permissions
 */
export const createSearchPermissions = () => ({
  noSearch: {
    Grep: createDenyPermission({ tool: 'Grep' }),
    Glob: createDenyPermission({ tool: 'Glob' }),
  },

  basic: {
    Grep: createAlwaysAllowPermission({ tool: 'Grep' }),
    Glob: createAlwaysAllowPermission({ tool: 'Glob' }),
  },
});

// ============================================================================
// Scope-Based Permission Factories
// ============================================================================

/**
 * Creates scope-based permissions for sensitive directories
 */
export const createScopeBasedPermissions = () => ({
  restrictSensitive: [
    createDenyPermission({
      tool: 'Read',
      scope: '/.env',
    }),
    createDenyPermission({
      tool: 'Read',
      scope: '/secrets/',
    }),
    createDenyPermission({
      tool: 'Write',
      scope: '/.git/',
    }),
  ],

  allowDevelopment: [
    createAlwaysAllowPermission({
      tool: 'Read',
      scope: '/src/',
    }),
    createAlwaysAllowPermission({
      tool: 'Write',
      scope: '/src/',
    }),
    createAlwaysAllowPermission({
      tool: 'Read',
      scope: '/tests/',
    }),
  ],

  restrictProduction: [
    createDenyPermission({
      tool: 'Write',
      scope: '/prod/',
    }),
    createDenyPermission({
      tool: 'Edit',
      scope: '/production/',
    }),
    createDenyPermission({
      tool: 'Bash',
      scope: '/deploy/',
    }),
  ],
});

// ============================================================================
// Permission Result Factories
// ============================================================================

/**
 * Creates various permission result scenarios
 */
export const createPermissionResults = () => ({
  allowed: createToolPermissionResult({
    allowed: true,
    level: 'allow-always',
    requiresConfirmation: false,
  }),

  allowedWithConfirmation: createToolPermissionResult({
    allowed: true,
    level: 'allow-once',
    requiresConfirmation: true,
  }),

  denied: createToolPermissionResult({
    allowed: false,
    level: null,
    requiresConfirmation: false,
    denialReason: 'Tool access denied by policy',
  }),

  deniedScope: createToolPermissionResult({
    allowed: false,
    level: null,
    requiresConfirmation: false,
    denialReason: 'Access to this scope is not permitted',
  }),

  deniedTool: createToolPermissionResult({
    allowed: false,
    level: null,
    requiresConfirmation: false,
    denialReason: 'This tool is not permitted',
  }),
});

// ============================================================================
// Complex Permission Scenarios
// ============================================================================

/**
 * Creates permission configurations for different security levels
 */
export const createSecurityLevelPermissions = () => ({
  minimal: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createDenyPermission({ tool: 'Write' }),
      createDenyPermission({ tool: 'Edit' }),
      createDenyPermission({ tool: 'Bash' }),
      createDenyPermission({ tool: 'WebFetch' }),
    ],
    description: 'Read-only access with no system or network tools',
  },

  development: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAlwaysAllowPermission({ tool: 'Write' }),
      createAlwaysAllowPermission({ tool: 'Edit' }),
      createAlwaysAllowPermission({ tool: 'Grep' }),
      createAlwaysAllowPermission({ tool: 'Glob' }),
      createAllowOncePermission({ tool: 'Bash' }),
      createDenyPermission({ tool: 'WebFetch' }),
    ],
    description: 'Development access with limited system commands',
  },

  testing: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAlwaysAllowPermission({ tool: 'Write' }),
      createAlwaysAllowPermission({ tool: 'Bash' }),
      createAlwaysAllowPermission({ tool: 'Grep' }),
      createAllowOncePermission({ tool: 'WebFetch' }),
      createDenyPermission({ tool: 'Edit', scope: '/prod/' }),
    ],
    description: 'Testing environment with system access but production restrictions',
  },

  production: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAllowOncePermission({ tool: 'Write' }),
      createDenyPermission({ tool: 'Edit' }),
      createDenyPermission({ tool: 'Bash' }),
      createDenyPermission({ tool: 'WebFetch' }),
    ],
    description: 'Production access with strict limitations',
  },

  unrestricted: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAlwaysAllowPermission({ tool: 'Write' }),
      createAlwaysAllowPermission({ tool: 'Edit' }),
      createAlwaysAllowPermission({ tool: 'MultiEdit' }),
      createAlwaysAllowPermission({ tool: 'Bash' }),
      createAlwaysAllowPermission({ tool: 'Grep' }),
      createAlwaysAllowPermission({ tool: 'Glob' }),
      createAlwaysAllowPermission({ tool: 'WebFetch' }),
      createAlwaysAllowPermission({ tool: 'WebSearch' }),
      createAlwaysAllowPermission({ tool: 'TodoWrite' }),
      createAlwaysAllowPermission({ tool: 'Browser' }),
    ],
    description: 'Full unrestricted access to all tools',
  },
});

/**
 * Creates permission configurations for different workflow stages
 */
export const createStageBasedPermissions = () => ({
  planning: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAlwaysAllowPermission({ tool: 'Grep' }),
      createAlwaysAllowPermission({ tool: 'Glob' }),
      createAlwaysAllowPermission({ tool: 'TodoWrite' }),
      createAllowOncePermission({ tool: 'WebFetch' }),
      createDenyPermission({ tool: 'Write' }),
      createDenyPermission({ tool: 'Edit' }),
      createDenyPermission({ tool: 'Bash' }),
    ],
    description: 'Planning stage - research and documentation only',
  },

  implementation: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAlwaysAllowPermission({ tool: 'Write' }),
      createAlwaysAllowPermission({ tool: 'Edit' }),
      createAlwaysAllowPermission({ tool: 'MultiEdit' }),
      createAlwaysAllowPermission({ tool: 'Grep' }),
      createAlwaysAllowPermission({ tool: 'Glob' }),
      createAllowOncePermission({ tool: 'Bash' }),
      createDenyPermission({ tool: 'WebFetch' }),
    ],
    description: 'Implementation stage - full development tools',
  },

  testing: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAlwaysAllowPermission({ tool: 'Write' }),
      createAlwaysAllowPermission({ tool: 'Bash' }),
      createAlwaysAllowPermission({ tool: 'Grep' }),
      createAllowOncePermission({ tool: 'Edit' }),
      createDenyPermission({ tool: 'MultiEdit' }),
      createDenyPermission({ tool: 'WebFetch' }),
    ],
    description: 'Testing stage - execute tests and verify results',
  },

  deployment: {
    permissions: [
      createAlwaysAllowPermission({ tool: 'Read' }),
      createAllowOncePermission({ tool: 'Bash' }),
      createDenyPermission({ tool: 'Write' }),
      createDenyPermission({ tool: 'Edit' }),
      createDenyPermission({ tool: 'WebFetch' }),
    ],
    description: 'Deployment stage - minimal permissions for deployment only',
  },
});

// ============================================================================
// Permission Preset Collections
// ============================================================================

/**
 * Permission preset collections for common testing scenarios
 */
export const PermissionPresets = {
  /** Basic permission levels */
  levels: {
    alwaysAllow: () => createAlwaysAllowPermission(),
    allowOnce: () => createAllowOncePermission(),
    deny: () => createDenyPermission(),
  },

  /** Tool-specific permissions */
  tools: {
    fileSystem: createFileSystemPermissions,
    network: createNetworkPermissions,
    system: createSystemPermissions,
    search: createSearchPermissions,
  },

  /** Scope-based permissions */
  scopes: createScopeBasedPermissions,

  /** Permission results */
  results: createPermissionResults,

  /** Security level configurations */
  security: createSecurityLevelPermissions,

  /** Stage-based configurations */
  stages: createStageBasedPermissions,

  /** Testing scenarios */
  testing: {
    noPermissions: () => ({
      permissions: [
        createDenyPermission({ tool: 'Read' }),
        createDenyPermission({ tool: 'Write' }),
        createDenyPermission({ tool: 'Edit' }),
        createDenyPermission({ tool: 'Bash' }),
      ],
      description: 'No permissions granted',
    }),

    readOnlyTest: () => ({
      permissions: [
        createAlwaysAllowPermission({ tool: 'Read' }),
        createAlwaysAllowPermission({ tool: 'Grep' }),
        createAlwaysAllowPermission({ tool: 'Glob' }),
        createDenyPermission({ tool: 'Write' }),
        createDenyPermission({ tool: 'Edit' }),
        createDenyPermission({ tool: 'Bash' }),
      ],
      description: 'Read-only test configuration',
    }),

    temporaryAccess: () => ({
      permissions: [
        createAllowOncePermission({ tool: 'Read' }),
        createAllowOncePermission({ tool: 'Write' }),
        createAllowOncePermission({ tool: 'Bash' }),
        createDenyPermission({ tool: 'Edit' }),
      ],
      description: 'Temporary access test configuration',
    }),
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a collection of permissions for all tools with a specific level
 */
export function createUniformPermissions(level: PermissionLevel): Permission[] {
  const tools: AgentTool[] = [
    'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
    'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
    'TodoWrite', 'Browser'
  ];

  return tools.map(tool => createToolPermission({
    tool,
    level,
    createdAt: new Date(),
  }));
}

/**
 * Creates permission sets for A/B testing different permission strategies
 */
export function createPermissionVariants(): {
  restrictive: Permission[];
  moderate: Permission[];
  permissive: Permission[];
} {
  return {
    restrictive: createUniformPermissions('deny'),
    moderate: createUniformPermissions('allow-once'),
    permissive: createUniformPermissions('allow-always'),
  };
}

/**
 * Validates that a permission has the expected structure
 */
export function validateToolPermission(permission: Permission): boolean {
  return !!(
    permission.tool &&
    permission.level &&
    permission.createdAt &&
    ['allow-always', 'allow-once', 'deny'].includes(permission.level)
  );
}

/**
 * Creates time-based permission scenarios for testing expiry behavior
 */
export function createTimeBasedPermissions(): {
  expired: Permission;
  expiringSoon: Permission;
  longTerm: Permission;
  permanent: Permission;
} {
  const now = new Date();

  return {
    expired: createToolPermission({
      tool: 'Write',
      level: 'allow-once',
      expiry: new Date(now.getTime() - 60 * 1000), // 1 minute ago
      createdAt: new Date(now.getTime() - 120 * 1000), // 2 minutes ago
    }),

    expiringSoon: createToolPermission({
      tool: 'Edit',
      level: 'allow-once',
      expiry: new Date(now.getTime() + 60 * 1000), // 1 minute from now
      createdAt: now,
    }),

    longTerm: createToolPermission({
      tool: 'Bash',
      level: 'allow-once',
      expiry: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdAt: now,
    }),

    permanent: createToolPermission({
      tool: 'Read',
      level: 'allow-always',
      expiry: undefined, // No expiry
      createdAt: now,
    }),
  };
}