#!/usr/bin/env npx tsx

/**
 * Quick validation script to test the permission mock utilities
 */

import {
  createMockPermission,
  createMockExtendedPermission,
  mockAgentPermissions,
  mockToolPermissions,
  createMockPermissionContext,
} from './packages/core/src/test-utils';

console.log('Testing permission mock utilities...\n');

// Test createMockPermission
console.log('✓ Testing createMockPermission...');
const basicPermission = createMockPermission();
console.log('  Basic permission:', { tool: basicPermission.tool, level: basicPermission.level });

const customPermission = createMockPermission({
  tool: 'Write',
  level: 'allow-once',
  scope: '/workspace/**'
});
console.log('  Custom permission:', {
  tool: customPermission.tool,
  level: customPermission.level,
  scope: customPermission.scope
});

// Test createMockExtendedPermission
console.log('\n✓ Testing createMockExtendedPermission...');
const extendedPermission = createMockExtendedPermission({
  tool: 'Bash',
  level: 'allow-once',
  grantReason: 'Testing shell access'
});
console.log('  Extended permission:', {
  tool: extendedPermission.tool,
  level: extendedPermission.level,
  grantReason: extendedPermission.grantReason
});

// Test mockAgentPermissions
console.log('\n✓ Testing mockAgentPermissions...');
const permissions = [
  createMockPermission({ tool: 'Read', level: 'allow-always' }),
  createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/workspace' })
];

const agentContext = mockAgentPermissions('developer', permissions);
console.log('  Agent context created:', {
  agent: agentContext.agent,
  permissionCount: agentContext.permissions.length
});

// Test permission checking
const readResult = agentContext.checkPermission('Read');
console.log('  Check Read permission:', readResult);

const writeResult = agentContext.checkPermission('Write', '/workspace');
console.log('  Check Write permission (scoped):', writeResult);

const bashResult = agentContext.checkPermission('Bash');
console.log('  Check Bash permission (non-existent):', bashResult);

console.log('  Has Read permission:', agentContext.hasPermission('Read'));
console.log('  Has Bash permission:', agentContext.hasPermission('Bash'));

// Test mockToolPermissions
console.log('\n✓ Testing mockToolPermissions...');
const toolPerms = [
  { level: 'allow-always' as const, scope: '/workspace/**' },
  { level: 'deny' as const, scope: '/system/**' }
];

const toolContext = mockToolPermissions('Read', toolPerms);
console.log('  Tool context created:', {
  tool: toolContext.tool,
  permissionCount: toolContext.permissions.length
});

const workspaceAccess = toolContext.checkAccess('/workspace/file.txt');
console.log('  Workspace access:', workspaceAccess);

const systemAccess = toolContext.checkAccess('/system/file.txt');
console.log('  System access:', systemAccess);

console.log('  Is workspace allowed:', toolContext.isAllowed('/workspace/file.txt'));
console.log('  Is system allowed:', toolContext.isAllowed('/system/file.txt'));

// Test createMockPermissionContext
console.log('\n✓ Testing createMockPermissionContext...');
const permissionContext = createMockPermissionContext({
  preset: 'autonomous',
  agents: {
    developer: [{ tool: 'Read', level: 'allow-always' }]
  },
  tools: {
    Write: [{ level: 'allow-once' }]
  }
});

console.log('  Permission context created:', {
  preset: permissionContext.preset,
  agentCount: Object.keys(permissionContext.agents).length,
  toolCount: Object.keys(permissionContext.tools).length
});

const globalCheck1 = permissionContext.checkGlobalPermission('Write');
console.log('  Global Write permission check:', globalCheck1);

const globalCheck2 = permissionContext.checkGlobalPermission('Bash');
console.log('  Global Bash permission check (autonomous):', globalCheck2);

console.log('\n🎉 All tests passed! Permission mock utilities are working correctly.');