/**
 * Simple validation script to ensure test files compile correctly
 * This helps validate imports and basic TypeScript syntax
 */

// Import all the test modules to verify they compile
import './permission-store-extended.test';
import './permission-store-migration.test';
import './permission-store-extended-integration.test';

// Import the main PermissionStore to verify it compiles with new functionality
import { PermissionStore } from '../permission-store';

// Import types to verify they're available
import {
  ExtendedPermission,
  PermissionQuery,
  ToolPermissionConfig,
  DirectoryAccessConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  SearchToolConfig,
} from '@apexcli/core';

// Basic type checking
const validateTypes = (): void => {
  // Test that ExtendedPermission type includes all required fields
  const extendedPermission: ExtendedPermission = {
    tool: 'Read',
    level: 'allow-always',
    createdAt: new Date(),
    tags: [], // Required by schema
  };

  // Test that we can create tool configs
  const filesystemConfig: FilesystemToolConfig = {
    enabled: true,
    directoryAccess: {
      allowlist: ['/test/**'],
      defaultAllow: false,
    },
  };

  const shellConfig: ShellToolConfig = {
    enabled: true,
    blockedCommands: ['rm -rf'],
    allowElevatedPrivileges: false,
  };

  const webConfig: WebToolConfig = {
    enabled: true,
    allowedDomains: ['example.com'],
  };

  const searchConfig: SearchToolConfig = {
    enabled: true,
    maxResults: 100,
  };

  // Test that PermissionStore has new methods
  const store = new PermissionStore('/test/path');

  // These should be available at compile time
  const methods = [
    store.saveExtendedPermission,
    store.getExtendedPermission,
    store.listExtendedPermissions,
    store.getDirectoryAccess,
    store.updateDirectoryAccess,
  ];

  // Verify all methods exist
  methods.forEach(method => {
    if (typeof method !== 'function') {
      throw new Error('Expected method to be a function');
    }
  });

  console.log('✅ All types and methods validated successfully');
};

// Export validation function for potential use
export { validateTypes };

// Run validation if this file is executed directly
if (require.main === module) {
  validateTypes();
}