/**
 * Build Verification Test for WorkspaceManager Cross-Platform Implementation
 *
 * This test verifies that the workspace-manager implementation compiles correctly
 * and that all cross-platform utilities are properly imported and used.
 */

import { describe, it, expect } from 'vitest';
import { WorkspaceManager } from './workspace-manager';
import * as core from '@apexcli/core';

describe('WorkspaceManager Build Verification', () => {
  describe('TypeScript Compilation', () => {
    it('should import WorkspaceManager class successfully', () => {
      expect(WorkspaceManager).toBeDefined();
      expect(typeof WorkspaceManager).toBe('function');
    });

    it('should import core utilities successfully', () => {
      expect(core.getPlatformShell).toBeDefined();
      expect(core.resolveExecutable).toBeDefined();
      expect(core.isWindows).toBeDefined();
    });

    it('should create WorkspaceManager instance without errors', () => {
      expect(() => {
        new WorkspaceManager({
          projectPath: '/test/path',
          defaultStrategy: 'none'
        });
      }).not.toThrow();
    });

    it('should have resolvePackageManagerCommand method', () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      const resolveMethod = (manager as any).resolvePackageManagerCommand;
      expect(resolveMethod).toBeDefined();
      expect(typeof resolveMethod).toBe('function');
    });

    it('should have all required cross-platform methods', () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      const workspace = manager as any;

      // Verify cross-platform methods exist
      expect(workspace.resolvePackageManagerCommand).toBeDefined();
      expect(workspace.applyRecoveryStrategy).toBeDefined();
      expect(workspace.getRecoveryStrategyName).toBeDefined();
      expect(workspace.getErrorSuggestion).toBeDefined();

      // Verify these are functions
      expect(typeof workspace.resolvePackageManagerCommand).toBe('function');
      expect(typeof workspace.applyRecoveryStrategy).toBe('function');
      expect(typeof workspace.getRecoveryStrategyName).toBe('function');
      expect(typeof workspace.getErrorSuggestion).toBe('function');
    });
  });

  describe('Type Definitions', () => {
    it('should have proper WorkspaceManagerOptions interface', () => {
      const options = {
        projectPath: '/test/path',
        defaultStrategy: 'none' as const,
        containerDefaults: {
          image: 'node:20-alpine',
          autoRemove: true
        }
      };

      expect(() => {
        new WorkspaceManager(options);
      }).not.toThrow();
    });

    it('should have proper WorkspaceInfo interface', () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      // Verify WorkspaceInfo structure by checking return type of getWorkspace
      const workspace = manager.getWorkspace('non-existent');
      expect(workspace).toBeNull();
    });

    it('should support all workspace strategies', () => {
      const strategies = ['none', 'worktree', 'container', 'directory'] as const;

      strategies.forEach(strategy => {
        expect(() => {
          new WorkspaceManager({
            projectPath: '/test/path',
            defaultStrategy: strategy
          });
        }).not.toThrow();
      });
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should integrate with core platform utilities', () => {
      // Test that the utilities can be called without error
      expect(() => core.getPlatformShell()).not.toThrow();
      expect(() => core.resolveExecutable('npm')).not.toThrow();
      expect(() => core.isWindows()).not.toThrow();
    });

    it('should handle platform-specific configurations', () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      // Should be able to call platform-dependent methods
      expect(() => manager.supportsContainerWorkspaces()).not.toThrow();
      expect(() => manager.getContainerRuntime()).not.toThrow();
    });
  });

  describe('API Completeness', () => {
    it('should expose all required public methods', () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      // Public API methods
      const publicMethods = [
        'initialize',
        'createWorkspace',
        'createWorkspaceWithIsolation',
        'getWorkspace',
        'accessWorkspace',
        'cleanupWorkspace',
        'cleanupOldWorkspaces',
        'getContainerRuntime',
        'supportsContainerWorkspaces',
        'getHealthMonitor',
        'getContainerManager',
        'getContainerIdForTask',
        'getContainerHealth',
        'getWorkspaceStats',
        'cleanup'
      ];

      publicMethods.forEach(method => {
        expect(manager[method as keyof WorkspaceManager]).toBeDefined();
        expect(typeof manager[method as keyof WorkspaceManager]).toBe('function');
      });
    });

    it('should support event emission', () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      // Should be an EventEmitter
      expect(manager.on).toBeDefined();
      expect(manager.emit).toBeDefined();
      expect(manager.off).toBeDefined();
    });

    it('should handle async operations correctly', async () => {
      const manager = new WorkspaceManager({
        projectPath: '/test/path',
        defaultStrategy: 'none'
      });

      // Test that async methods return promises
      const initPromise = manager.initialize();
      expect(initPromise).toBeInstanceOf(Promise);

      const statsPromise = manager.getWorkspaceStats();
      expect(statsPromise).toBeInstanceOf(Promise);

      const cleanupPromise = manager.cleanup();
      expect(cleanupPromise).toBeInstanceOf(Promise);

      // Clean up
      try {
        await initPromise;
        await statsPromise;
        await cleanupPromise;
      } catch {
        // Expected to fail in test environment without full setup
      }
    });
  });

  describe('Cross-Platform Constants', () => {
    it('should have access to shell constants', () => {
      const shellConfig = core.getPlatformShell();
      expect(shellConfig).toBeDefined();
      expect(shellConfig.shell).toBeDefined();
      expect(shellConfig.shellArgs).toBeDefined();
      expect(Array.isArray(shellConfig.shellArgs)).toBe(true);
    });

    it('should handle executable resolution', () => {
      const npm = core.resolveExecutable('npm');
      expect(npm).toBeDefined();
      expect(typeof npm).toBe('string');

      const yarn = core.resolveExecutable('yarn');
      expect(yarn).toBeDefined();
      expect(typeof yarn).toBe('string');
    });

    it('should detect platform correctly', () => {
      const isWin = core.isWindows();
      expect(typeof isWin).toBe('boolean');
    });
  });
});

// Export a verification function that can be used in CI/CD
export function verifyBuild(): boolean {
  try {
    // Verify core imports
    const manager = new WorkspaceManager({
      projectPath: '/test/path',
      defaultStrategy: 'none'
    });

    // Verify platform utilities
    core.getPlatformShell();
    core.resolveExecutable('npm');
    core.isWindows();

    // Verify method existence
    const workspace = manager as any;
    if (!workspace.resolvePackageManagerCommand ||
        !workspace.applyRecoveryStrategy ||
        !workspace.getRecoveryStrategyName ||
        !workspace.getErrorSuggestion) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Build verification failed:', error);
    return false;
  }
}