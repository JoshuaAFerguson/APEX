/**
 * @fileoverview Permission Test Scenarios
 *
 * This file provides predefined permission test scenarios for common
 * testing patterns and edge cases in the APEX permission system.
 */

import type { PermissionTestScenario, PermissionFixtureConfig } from '../types.js';

// ============================================================================
// Common Permission Scenarios
// ============================================================================

/**
 * Scenario: All tools allowed with permanent permissions
 */
export const AllToolsAllowedScenario: PermissionTestScenario = {
  name: 'All Tools Allowed',
  description: 'All tools are permanently allowed for testing tool functionality',
  permissions: [
    { tool: 'Read', level: 'allow-always' },
    { tool: 'Write', level: 'allow-always' },
    { tool: 'Edit', level: 'allow-always' },
    { tool: 'Bash', level: 'allow-always' },
    { tool: 'Glob', level: 'allow-always' },
    { tool: 'Grep', level: 'allow-always' },
    { tool: 'WebFetch', level: 'allow-always' },
    { tool: 'WebSearch', level: 'allow-always' },
    { tool: 'Browser', level: 'allow-always' },
    { tool: 'TodoWrite', level: 'allow-always' },
  ],
  expectedBehavior: {
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Browser', 'TodoWrite'],
    deniedTools: [],
    promptTools: [],
  },
};

/**
 * Scenario: All tools denied
 */
export const AllToolsDeniedScenario: PermissionTestScenario = {
  name: 'All Tools Denied',
  description: 'All tools are denied to test permission denial handling',
  permissions: [
    { tool: 'Read', level: 'deny' },
    { tool: 'Write', level: 'deny' },
    { tool: 'Edit', level: 'deny' },
    { tool: 'Bash', level: 'deny' },
    { tool: 'Glob', level: 'deny' },
    { tool: 'Grep', level: 'deny' },
    { tool: 'WebFetch', level: 'deny' },
    { tool: 'WebSearch', level: 'deny' },
    { tool: 'Browser', level: 'deny' },
    { tool: 'TodoWrite', level: 'deny' },
  ],
  expectedBehavior: {
    allowedTools: [],
    deniedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Browser', 'TodoWrite'],
    promptTools: [],
  },
};

/**
 * Scenario: Read-only permissions
 */
export const ReadOnlyScenario: PermissionTestScenario = {
  name: 'Read-Only Permissions',
  description: 'Only read-related tools are allowed, write operations are denied',
  permissions: [
    { tool: 'Read', level: 'allow-always' },
    { tool: 'Glob', level: 'allow-always' },
    { tool: 'Grep', level: 'allow-always' },
    { tool: 'WebFetch', level: 'allow-always' },
    { tool: 'WebSearch', level: 'allow-always' },
    { tool: 'Write', level: 'deny' },
    { tool: 'Edit', level: 'deny' },
    { tool: 'Bash', level: 'deny' },
  ],
  expectedBehavior: {
    allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
    deniedTools: ['Write', 'Edit', 'Bash'],
    promptTools: ['Browser', 'TodoWrite'],
  },
};

/**
 * Scenario: Mixed single-use permissions
 */
export const SingleUsePermissionsScenario: PermissionTestScenario = {
  name: 'Single-Use Permissions',
  description: 'Tools are allowed once, then require re-authorization',
  permissions: [
    { tool: 'Read', level: 'allow-once' },
    { tool: 'Write', level: 'allow-once' },
    { tool: 'Bash', level: 'allow-once' },
    { tool: 'WebFetch', level: 'allow-once' },
  ],
  expectedBehavior: {
    allowedTools: ['Read', 'Write', 'Bash', 'WebFetch'],
    deniedTools: [],
    promptTools: ['Edit', 'Glob', 'Grep', 'WebSearch', 'Browser', 'TodoWrite'],
  },
};

/**
 * Scenario: Expired permissions
 */
export const ExpiredPermissionsScenario: PermissionTestScenario = {
  name: 'Expired Permissions',
  description: 'Previously granted permissions have expired and should be re-prompted',
  permissions: [
    { tool: 'Read', level: 'allow-always', expired: true },
    { tool: 'Write', level: 'allow-once', expired: true },
    { tool: 'Bash', level: 'allow-always', expired: true },
  ],
  expectedBehavior: {
    allowedTools: [],
    deniedTools: [],
    promptTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Browser', 'TodoWrite'],
  },
};

// ============================================================================
// Scoped Permission Scenarios
// ============================================================================

/**
 * Scenario: File system scoped permissions
 */
export const FilesystemScopedScenario: PermissionTestScenario = {
  name: 'Filesystem Scoped Permissions',
  description: 'Different permissions for different file paths and operations',
  permissions: [
    { tool: 'Read', scope: '/src/**', level: 'allow-always' },
    { tool: 'Write', scope: '/src/**', level: 'allow-once' },
    { tool: 'Edit', scope: '/src/**', level: 'allow-always' },
    { tool: 'Read', scope: '/config/**', level: 'deny' },
    { tool: 'Write', scope: '/config/**', level: 'deny' },
    { tool: 'Bash', scope: 'npm install', level: 'allow-always' },
    { tool: 'Bash', scope: 'rm -rf', level: 'deny' },
  ],
  expectedBehavior: {
    allowedTools: [], // Depends on scope
    deniedTools: [], // Depends on scope
    promptTools: [], // Depends on scope
  },
};

/**
 * Scenario: Web domain scoped permissions
 */
export const WebScopedScenario: PermissionTestScenario = {
  name: 'Web Domain Scoped Permissions',
  description: 'Different permissions for different web domains',
  permissions: [
    { tool: 'WebFetch', scope: 'https://api.github.com/**', level: 'allow-always' },
    { tool: 'WebFetch', scope: 'https://docs.python.org/**', level: 'allow-always' },
    { tool: 'WebFetch', scope: 'https://malicious-site.com/**', level: 'deny' },
    { tool: 'WebSearch', scope: '*', level: 'allow-once' },
    { tool: 'Browser', scope: 'https://trusted-site.com/**', level: 'allow-always' },
  ],
  expectedBehavior: {
    allowedTools: [], // Depends on URL/domain scope
    deniedTools: [], // Depends on URL/domain scope
    promptTools: [], // Depends on URL/domain scope
  },
};

// ============================================================================
// Security-Focused Scenarios
// ============================================================================

/**
 * Scenario: High security environment
 */
export const HighSecurityScenario: PermissionTestScenario = {
  name: 'High Security Environment',
  description: 'Restrictive permissions for security-sensitive environments',
  permissions: [
    { tool: 'Read', level: 'allow-once' }, // Allow reading but ask each time
    { tool: 'Glob', level: 'allow-once' }, // Allow file listing but ask each time
    { tool: 'Grep', level: 'allow-once' }, // Allow searching but ask each time
    { tool: 'Write', level: 'deny' }, // No writing allowed
    { tool: 'Edit', level: 'deny' }, // No editing allowed
    { tool: 'Bash', level: 'deny' }, // No shell access
    { tool: 'WebFetch', level: 'deny' }, // No web access
    { tool: 'WebSearch', level: 'deny' }, // No web search
    { tool: 'Browser', level: 'deny' }, // No browser automation
  ],
  expectedBehavior: {
    allowedTools: [],
    deniedTools: ['Write', 'Edit', 'Bash', 'WebFetch', 'WebSearch', 'Browser'],
    promptTools: ['Read', 'Glob', 'Grep', 'TodoWrite'],
  },
};

/**
 * Scenario: Developer-friendly permissions
 */
export const DeveloperFriendlyScenario: PermissionTestScenario = {
  name: 'Developer-Friendly Environment',
  description: 'Permissive settings for development work',
  permissions: [
    { tool: 'Read', level: 'allow-always' },
    { tool: 'Write', level: 'allow-always' },
    { tool: 'Edit', level: 'allow-always' },
    { tool: 'Glob', level: 'allow-always' },
    { tool: 'Grep', level: 'allow-always' },
    { tool: 'TodoWrite', level: 'allow-always' },
    { tool: 'Bash', scope: 'npm *', level: 'allow-always' },
    { tool: 'Bash', scope: 'git *', level: 'allow-always' },
    { tool: 'Bash', scope: 'echo *', level: 'allow-always' },
    { tool: 'WebFetch', scope: 'https://docs.*/**', level: 'allow-always' },
    { tool: 'WebSearch', level: 'allow-once' },
  ],
  expectedBehavior: {
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite'],
    deniedTools: [],
    promptTools: ['Browser'], // Browser still requires explicit permission
  },
};

// ============================================================================
// Edge Case Scenarios
// ============================================================================

/**
 * Scenario: Conflicting permissions
 */
export const ConflictingPermissionsScenario: PermissionTestScenario = {
  name: 'Conflicting Permissions',
  description: 'Test behavior with conflicting permission rules',
  permissions: [
    { tool: 'Read', scope: '/src/**', level: 'allow-always' },
    { tool: 'Read', scope: '/src/secrets/**', level: 'deny' }, // More specific denial
    { tool: 'Write', level: 'deny' },
    { tool: 'Write', scope: '/tmp/**', level: 'allow-once' }, // Exception for tmp
  ],
  expectedBehavior: {
    allowedTools: [], // Depends on specific scope
    deniedTools: [], // Depends on specific scope
    promptTools: [], // Depends on specific scope
  },
};

/**
 * Scenario: Time-limited permissions
 */
export const TimeLimitedPermissionsScenario: PermissionTestScenario = {
  name: 'Time-Limited Permissions',
  description: 'Permissions that expire after a certain time',
  permissions: [
    {
      tool: 'Write',
      level: 'allow-always',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    },
    {
      tool: 'Bash',
      level: 'allow-always',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    },
    {
      tool: 'WebFetch',
      level: 'allow-once',
      expiresAt: new Date(Date.now() + 1 * 60 * 1000), // 1 minute from now
    },
  ],
  expectedBehavior: {
    allowedTools: ['Write', 'Bash', 'WebFetch'], // Initially allowed
    deniedTools: [],
    promptTools: ['Read', 'Edit', 'Glob', 'Grep', 'WebSearch', 'Browser', 'TodoWrite'],
  },
};

// ============================================================================
// Scenario Collections
// ============================================================================

/**
 * All predefined scenarios for easy access
 */
export const AllPermissionScenarios: PermissionTestScenario[] = [
  AllToolsAllowedScenario,
  AllToolsDeniedScenario,
  ReadOnlyScenario,
  SingleUsePermissionsScenario,
  ExpiredPermissionsScenario,
  FilesystemScopedScenario,
  WebScopedScenario,
  HighSecurityScenario,
  DeveloperFriendlyScenario,
  ConflictingPermissionsScenario,
  TimeLimitedPermissionsScenario,
];

/**
 * Get a scenario by name
 */
export function getScenarioByName(name: string): PermissionTestScenario | undefined {
  return AllPermissionScenarios.find((scenario) => scenario.name === name);
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: 'security' | 'development' | 'basic' | 'advanced'): PermissionTestScenario[] {
  const categories = {
    security: [HighSecurityScenario, AllToolsDeniedScenario, ConflictingPermissionsScenario],
    development: [DeveloperFriendlyScenario, AllToolsAllowedScenario, ReadOnlyScenario],
    basic: [AllToolsAllowedScenario, AllToolsDeniedScenario, ReadOnlyScenario],
    advanced: [
      FilesystemScopedScenario,
      WebScopedScenario,
      ConflictingPermissionsScenario,
      TimeLimitedPermissionsScenario,
      ExpiredPermissionsScenario,
    ],
  };

  return categories[category] || [];
}