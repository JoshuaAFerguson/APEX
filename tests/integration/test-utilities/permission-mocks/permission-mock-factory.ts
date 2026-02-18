/**
 * @fileoverview Permission Mock Factory
 *
 * This file provides comprehensive mock implementations for the APEX permission
 * system, including permission checking, storage, and user interaction flows.
 */

import { vi, type MockedFunction } from 'vitest';
import type { Permission, PermissionLevel, PermissionQuery } from '@apex/core/types';
import type { PermissionFixtureConfig, PermissionTestScenario } from '../types.js';

// ============================================================================
// Permission Mock Types
// ============================================================================

/**
 * Mock permission store interface
 */
export interface MockPermissionStore {
  permissions: Map<string, Permission>;
  hasPermission: MockedFunction<(tool: string, scope?: string) => boolean>;
  getPermission: MockedFunction<(query: PermissionQuery) => Permission | null>;
  setPermission: MockedFunction<(permission: Permission) => void>;
  removePermission: MockedFunction<(tool: string, scope?: string) => boolean>;
  clearAllPermissions: MockedFunction<() => void>;
  getallPermissions: MockedFunction<() => Permission[]>;
}

/**
 * Mock permission manager interface
 */
export interface MockPermissionManager {
  checkPermission: MockedFunction<(tool: string, scope?: string) => Promise<boolean>>;
  requestPermission: MockedFunction<(tool: string, scope?: string) => Promise<PermissionLevel>>;
  hasStoredPermission: MockedFunction<(tool: string, scope?: string) => boolean>;
  denyPermission: MockedFunction<(tool: string, scope?: string) => void>;
  grantPermission: MockedFunction<(tool: string, scope?: string, level?: PermissionLevel) => void>;
  clearPermissions: MockedFunction<() => void>;
  getPermissionHistory: MockedFunction<() => Array<{ tool: string; scope?: string; level: PermissionLevel; timestamp: Date }>>;
}

// ============================================================================
// Permission Store Mock
// ============================================================================

/**
 * Create a mock permission store with configurable behavior
 */
export function createPermissionStoreMock(
  initialPermissions: PermissionFixtureConfig[] = []
): MockPermissionStore {
  const permissions = new Map<string, Permission>();

  // Set up initial permissions
  for (const config of initialPermissions) {
    const permission = createPermissionFromConfig(config);
    const key = generatePermissionKey(permission.tool, permission.scope);
    permissions.set(key, permission);
  }

  const hasPermission = vi.fn().mockImplementation((tool: string, scope?: string): boolean => {
    const key = generatePermissionKey(tool, scope);
    const permission = permissions.get(key);

    if (!permission) {
      return false;
    }

    // Check if permission is expired
    if (permission.expiry && permission.expiry < new Date()) {
      permissions.delete(key);
      return false;
    }

    return permission.level === 'allow-always' || permission.level === 'allow-once';
  });

  const getPermission = vi.fn().mockImplementation((query: PermissionQuery): Permission | null => {
    const key = generatePermissionKey(query.tool, query.scope);
    const permission = permissions.get(key);

    if (!permission) {
      return null;
    }

    // Check if permission is expired
    if (permission.expiry && permission.expiry < new Date()) {
      permissions.delete(key);
      return null;
    }

    return permission;
  });

  const setPermission = vi.fn().mockImplementation((permission: Permission): void => {
    const key = generatePermissionKey(permission.tool, permission.scope);
    permissions.set(key, { ...permission });
  });

  const removePermission = vi.fn().mockImplementation((tool: string, scope?: string): boolean => {
    const key = generatePermissionKey(tool, scope);
    return permissions.delete(key);
  });

  const clearAllPermissions = vi.fn().mockImplementation((): void => {
    permissions.clear();
  });

  const getAllPermissions = vi.fn().mockImplementation((): Permission[] => {
    const now = new Date();
    const validPermissions: Permission[] = [];

    for (const [key, permission] of permissions.entries()) {
      // Remove expired permissions
      if (permission.expiry && permission.expiry < now) {
        permissions.delete(key);
        continue;
      }

      validPermissions.push(permission);
    }

    return validPermissions;
  });

  return {
    permissions,
    hasPermission,
    getPermission,
    setPermission,
    removePermission,
    clearAllPermissions,
    getallPermissions: getAllPermissions,
  };
}

// ============================================================================
// Permission Manager Mock
// ============================================================================

/**
 * Create a mock permission manager with user interaction simulation
 */
export function createPermissionManagerMock(
  store: MockPermissionStore,
  options: {
    autoApprove?: boolean;
    autoApproveTools?: string[];
    autoDenyTools?: string[];
    defaultPermissionLevel?: PermissionLevel;
    simulateUserDelay?: boolean;
    userDelayMs?: number;
  } = {}
): MockPermissionManager {
  const {
    autoApprove = false,
    autoApproveTools = [],
    autoDenyTools = [],
    defaultPermissionLevel = 'allow-once',
    simulateUserDelay = true,
    userDelayMs = 1000,
  } = options;

  const permissionHistory: Array<{
    tool: string;
    scope?: string;
    level: PermissionLevel;
    timestamp: Date;
  }> = [];

  const checkPermission = vi.fn().mockImplementation(async (tool: string, scope?: string): Promise<boolean> => {
    // First check if we have a stored permission
    if (store.hasPermission(tool, scope)) {
      const permission = store.getPermission({ tool, scope });
      if (permission?.level === 'allow-once') {
        // Remove allow-once permissions after use
        store.removePermission(tool, scope);
      }
      return true;
    }

    // If not stored, request permission
    const level = await requestPermission.mockImplementation()(tool, scope);
    return level === 'allow-always' || level === 'allow-once';
  });

  const requestPermission = vi.fn().mockImplementation(
    async (tool: string, scope?: string): Promise<PermissionLevel> => {
      // Simulate user interaction delay
      if (simulateUserDelay) {
        await new Promise((resolve) => setTimeout(resolve, userDelayMs));
      }

      let level: PermissionLevel;

      // Check auto-deny list first
      if (autoDenyTools.includes(tool)) {
        level = 'deny';
      }
      // Check auto-approve list
      else if (autoApprove || autoApproveTools.includes(tool)) {
        level = defaultPermissionLevel;
      }
      // Default behavior (can be overridden in tests)
      else {
        level = defaultPermissionLevel;
      }

      // Store the permission decision
      const permission = createPermissionFromConfig({
        tool,
        scope,
        level,
        createdAt: new Date(),
      });

      store.setPermission(permission);

      // Record in history
      permissionHistory.push({
        tool,
        scope,
        level,
        timestamp: new Date(),
      });

      return level;
    }
  );

  const hasStoredPermission = vi.fn().mockImplementation((tool: string, scope?: string): boolean => {
    return store.hasPermission(tool, scope);
  });

  const denyPermission = vi.fn().mockImplementation((tool: string, scope?: string): void => {
    const permission = createPermissionFromConfig({
      tool,
      scope,
      level: 'deny',
      createdAt: new Date(),
    });

    store.setPermission(permission);

    permissionHistory.push({
      tool,
      scope,
      level: 'deny',
      timestamp: new Date(),
    });
  });

  const grantPermission = vi.fn().mockImplementation(
    (tool: string, scope?: string, level: PermissionLevel = 'allow-once'): void => {
      const permission = createPermissionFromConfig({
        tool,
        scope,
        level,
        createdAt: new Date(),
      });

      store.setPermission(permission);

      permissionHistory.push({
        tool,
        scope,
        level,
        timestamp: new Date(),
      });
    }
  );

  const clearPermissions = vi.fn().mockImplementation((): void => {
    store.clearAllPermissions();
    permissionHistory.length = 0;
  });

  const getPermissionHistory = vi.fn().mockImplementation(() => [...permissionHistory]);

  return {
    checkPermission,
    requestPermission,
    hasStoredPermission,
    denyPermission,
    grantPermission,
    clearPermissions,
    getPermissionHistory,
  };
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a complete permission system mock suite
 */
export function createPermissionSystemMock(
  initialPermissions: PermissionFixtureConfig[] = [],
  managerOptions: Parameters<typeof createPermissionManagerMock>[1] = {}
): {
  store: MockPermissionStore;
  manager: MockPermissionManager;
  setupScenario: (scenario: PermissionTestScenario) => void;
  resetToScenario: (scenario: PermissionTestScenario) => void;
} {
  const store = createPermissionStoreMock(initialPermissions);
  const manager = createPermissionManagerMock(store, managerOptions);

  const setupScenario = (scenario: PermissionTestScenario) => {
    store.clearAllPermissions();

    for (const permissionConfig of scenario.permissions) {
      const permission = createPermissionFromConfig(permissionConfig);
      store.setPermission(permission);
    }
  };

  const resetToScenario = (scenario: PermissionTestScenario) => {
    manager.clearPermissions();
    setupScenario(scenario);
  };

  return {
    store,
    manager,
    setupScenario,
    resetToScenario,
  };
}

/**
 * Create a permission system that denies everything
 */
export function createDenyAllPermissionMock(): {
  store: MockPermissionStore;
  manager: MockPermissionManager;
} {
  const store = createPermissionStoreMock([]);
  const manager = createPermissionManagerMock(store, {
    autoApprove: false,
    defaultPermissionLevel: 'deny',
    simulateUserDelay: false,
  });

  return { store, manager };
}

/**
 * Create a permission system that approves everything
 */
export function createApproveAllPermissionMock(): {
  store: MockPermissionStore;
  manager: MockPermissionManager;
} {
  const store = createPermissionStoreMock([]);
  const manager = createPermissionManagerMock(store, {
    autoApprove: true,
    defaultPermissionLevel: 'allow-always',
    simulateUserDelay: false,
  });

  return { store, manager };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique key for permission storage
 */
function generatePermissionKey(tool: string, scope?: string): string {
  return scope ? `${tool}:${scope}` : tool;
}

/**
 * Create a Permission object from configuration
 */
export function createPermissionFromConfig(config: PermissionFixtureConfig): Permission {
  const now = new Date();

  let expiryDate: Date | undefined;
  if (config.expired) {
    expiryDate = new Date(now.getTime() - 1000); // 1 second ago
  } else if (config.expiresAt) {
    expiryDate = config.expiresAt;
  }

  return {
    tool: config.tool,
    scope: config.scope,
    level: config.level,
    expiry: expiryDate,
    createdAt: config.createdAt || now,
  };
}