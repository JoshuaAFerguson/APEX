/**
 * Validation test for permission mock utilities
 * This file tests the basic functionality of the new permission mock functions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMockPermission,
  createMockExtendedPermission,
  createMockPermissionQuery,
  createMockToolPermissionResult,
  mockAgentPermissions,
  mockToolPermissions,
  createMockPermissionContext,
} from '../test-utils.js';

describe('Permission Mock Utilities Validation', () => {
  it('should create valid permission objects', () => {
    const permission = createMockPermission({
      tool: 'filesystem',
      level: 'allow-always',
      scope: '/test/**'
    });

    expect(permission.tool).toBe('filesystem');
    expect(permission.level).toBe('allow-always');
    expect(permission.scope).toBe('/test/**');
    expect(typeof permission.createdAt).toBe('number');
  });

  it('should create valid extended permission objects', () => {
    const permission = createMockExtendedPermission({
      tool: 'shell',
      description: 'Test description'
    });

    expect(permission.tool).toBe('shell');
    expect(permission.description).toBe('Test description');
    expect(Array.isArray(permission.tags)).toBe(true);
  });

  it('should create valid permission query objects', () => {
    const query = createMockPermissionQuery({
      tool: 'browser',
      scope: 'https://example.com'
    });

    expect(query.tool).toBe('browser');
    expect(query.scope).toBe('https://example.com');
  });

  it('should create valid tool permission results', () => {
    const result = createMockToolPermissionResult({
      allowed: true,
      level: 'allow-once',
      reason: 'Test permission granted'
    });

    expect(result.allowed).toBe(true);
    expect(result.level).toBe('allow-once');
    expect(result.reason).toBe('Test permission granted');
  });

  it('should create functional agent permission contexts', () => {
    const permissions = [
      createMockPermission({ tool: 'filesystem', level: 'allow-always' })
    ];

    const context = mockAgentPermissions('test-agent', permissions);

    expect(context.agent).toBe('test-agent');
    expect(context.permissions).toEqual(permissions);
    expect(typeof context.checkPermission).toBe('function');
    expect(typeof context.hasPermission).toBe('function');
    expect(vi.isMockFunction(context.grantPermission)).toBe(true);

    // Test functionality
    const result = context.checkPermission('filesystem');
    expect(result.allowed).toBe(true);
    expect(result.level).toBe('allow-always');

    expect(context.hasPermission('filesystem')).toBe(true);
    expect(context.hasPermission('nonexistent')).toBe(false);
  });

  it('should create functional tool permission contexts', () => {
    const permissions = [
      { level: 'allow-always' as const, scope: '/allowed/**' },
      { level: 'deny' as const, scope: '/denied/**' }
    ];

    const context = mockToolPermissions('filesystem', permissions);

    expect(context.tool).toBe('filesystem');
    expect(context.permissions).toHaveLength(2);
    expect(typeof context.checkAccess).toBe('function');
    expect(typeof context.isAllowed).toBe('function');
    expect(typeof context.requiresConfirmation).toBe('function');

    // Test functionality
    const allowedResult = context.checkAccess('/allowed/file.txt');
    expect(allowedResult.allowed).toBe(true);
    expect(allowedResult.level).toBe('allow-always');

    const deniedResult = context.checkAccess('/denied/file.txt');
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.level).toBe('deny');

    expect(context.isAllowed('/allowed/file.txt')).toBe(true);
    expect(context.isAllowed('/denied/file.txt')).toBe(false);
  });

  it('should create comprehensive permission contexts', () => {
    const context = createMockPermissionContext({
      preset: 'autonomous',
      agents: {
        developer: [
          { tool: 'filesystem', level: 'allow-always', scope: '/workspace/**' }
        ]
      },
      tools: {
        shell: [{ level: 'allow-once' }]
      },
      defaultBehavior: 'allow'
    });

    expect(context.preset).toBe('autonomous');
    expect(context.defaultBehavior).toBe('allow');
    expect(context.agents.developer).toBeDefined();
    expect(context.tools.shell).toBeDefined();
    expect(typeof context.checkGlobalPermission).toBe('function');
    expect(vi.isMockFunction(context.grantPermission)).toBe(true);

    // Test global permission checking
    const result = context.checkGlobalPermission('unknown-tool');
    expect(result.allowed).toBe(true); // autonomous preset
    expect(result.level).toBe('allow-once');
  });

  it('should handle different permission presets correctly', () => {
    const autonomousContext = createMockPermissionContext({ preset: 'autonomous' });
    const reviewAllContext = createMockPermissionContext({ preset: 'review-all' });

    const autonomousResult = autonomousContext.checkGlobalPermission('any-tool');
    expect(autonomousResult.allowed).toBe(true);

    const reviewResult = reviewAllContext.checkGlobalPermission('any-tool');
    expect(reviewResult.allowed).toBe(false);
  });
});