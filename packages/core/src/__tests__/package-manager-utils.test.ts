/**
 * Package Manager Utilities Tests
 *
 * Tests for package manager utility functions including install command generation,
 * frozen lockfile handling, workspace detection, and CI optimization.
 */

import { describe, it, expect } from 'vitest';
import {
  getInstallCommand,
  getCIInstallCommand,
  supportsFrozenLockfile,
  isMonorepoProject,
  getWorkspaceInstallRecommendations,
  getOptimizedInstallCommand,
  getAllInstallCommands,
  validateInstallCommand,
  getPackageManagerEnvVars,
  PACKAGE_MANAGER_COMMANDS,
  type InstallCommandOptions,
} from '../package-manager-utils';
import type { PackageManagerDetectionResult } from '../dependency-detector';

describe('Package Manager Utilities', () => {
  // ============================================================================
  // Test Data
  // ============================================================================

  const mockNpmBasic: PackageManagerDetectionResult = {
    type: 'npm',
    detected: true,
    language: 'javascript',
    installCommand: 'npm install',
    metadata: {
      packageName: 'test-npm',
      hasLockfile: false,
      dependencyCount: 3
    }
  };

  const mockNpmWithLock: PackageManagerDetectionResult = {
    type: 'npm',
    detected: true,
    language: 'javascript',
    installCommand: 'npm install',
    metadata: {
      packageName: 'test-npm-lock',
      hasLockfile: true,
      lockfileType: 'package-lock.json',
      dependencyCount: 5
    }
  };

  const mockYarnWorkspaces: PackageManagerDetectionResult = {
    type: 'yarn',
    detected: true,
    language: 'javascript',
    installCommand: 'yarn install',
    metadata: {
      packageName: 'yarn-workspaces-root',
      hasLockfile: true,
      hasWorkspaces: true,
      isMonorepoRoot: true,
      workspacePatterns: ['packages/*'],
      dependencyCount: 2
    }
  };

  const mockPnpmMonorepo: PackageManagerDetectionResult = {
    type: 'pnpm',
    detected: true,
    language: 'javascript',
    installCommand: 'pnpm install',
    metadata: {
      packageName: 'pnpm-monorepo',
      hasLockfile: true,
      hasWorkspaceConfig: true,
      isMonorepoRoot: true,
      workspacePatterns: ['packages/*', 'apps/*'],
      dependencyCount: 4
    }
  };

  const mockYarnBerry: PackageManagerDetectionResult = {
    type: 'yarn',
    detected: true,
    language: 'javascript',
    installCommand: 'yarn install',
    metadata: {
      packageName: 'yarn-berry-project',
      hasLockfile: true,
      isYarnBerry: true,
      nodeLinker: 'pnp',
      yarnVersion: '3.6.0',
      dependencyCount: 3
    }
  };

  // ============================================================================
  // Install Command Generation Tests
  // ============================================================================

  describe('getInstallCommand', () => {
    it('should return basic install command for package manager without lockfile', () => {
      const command = getInstallCommand(mockNpmBasic);
      expect(command).toBe('npm install');
    });

    it('should return basic install command when useFrozenLockfile is false', () => {
      const command = getInstallCommand(mockNpmWithLock, { useFrozenLockfile: false });
      expect(command).toBe('npm install');
    });

    it('should return frozen lockfile command when useFrozenLockfile is true and lockfile exists', () => {
      const command = getInstallCommand(mockNpmWithLock, { useFrozenLockfile: true });
      expect(command).toBe('npm ci');
    });

    it('should handle yarn frozen lockfile command', () => {
      const yarnWithLock: PackageManagerDetectionResult = {
        ...mockYarnWorkspaces,
        metadata: { ...mockYarnWorkspaces.metadata, hasLockfile: true }
      };
      const command = getInstallCommand(yarnWithLock, { useFrozenLockfile: true });
      expect(command).toBe('yarn install --frozen-lockfile');
    });

    it('should handle pnpm frozen lockfile command', () => {
      const command = getInstallCommand(mockPnpmMonorepo, { useFrozenLockfile: true });
      expect(command).toBe('pnpm install --frozen-lockfile');
    });

    it('should include production only flag when specified', () => {
      const command = getInstallCommand(mockNpmWithLock, { productionOnly: true });
      expect(command).toBe('npm ci --only=production');
    });

    it('should include registry when specified', () => {
      const command = getInstallCommand(mockNpmBasic, {
        registry: 'https://custom-registry.com'
      });
      expect(command).toBe('npm install --registry=https://custom-registry.com');
    });

    it('should include additional flags', () => {
      const command = getInstallCommand(mockNpmBasic, {
        additionalFlags: ['--no-audit', '--prefer-offline']
      });
      expect(command).toBe('npm install --no-audit --prefer-offline');
    });

    it('should combine multiple options', () => {
      const command = getInstallCommand(mockNpmWithLock, {
        useFrozenLockfile: true,
        registry: 'https://custom-registry.com',
        additionalFlags: ['--no-audit']
      });
      expect(command).toBe('npm ci --registry=https://custom-registry.com --no-audit');
    });

    it('should handle unknown package manager type', () => {
      const unknownManager: PackageManagerDetectionResult = {
        type: 'unknown',
        detected: true,
        installCommand: 'custom-install'
      };
      const command = getInstallCommand(unknownManager);
      expect(command).toBe('custom-install');
    });
  });

  // ============================================================================
  // CI Install Command Tests
  // ============================================================================

  describe('getCIInstallCommand', () => {
    it('should return CI-optimized command for npm with lockfile', () => {
      const command = getCIInstallCommand(mockNpmWithLock);
      expect(command).toBe('npm ci');
    });

    it('should return regular command for npm without lockfile', () => {
      const command = getCIInstallCommand(mockNpmBasic);
      expect(command).toBe('npm install');
    });

    it('should handle production only in CI', () => {
      const command = getCIInstallCommand(mockNpmWithLock, { productionOnly: true });
      expect(command).toBe('npm ci --only=production');
    });

    it('should include additional flags in CI command', () => {
      const command = getCIInstallCommand(mockNpmWithLock, {
        additionalFlags: ['--silent', '--no-progress']
      });
      expect(command).toBe('npm ci --silent --no-progress');
    });
  });

  // ============================================================================
  // Frozen Lockfile Support Tests
  // ============================================================================

  describe('supportsFrozenLockfile', () => {
    it('should return true for npm with lockfile', () => {
      expect(supportsFrozenLockfile(mockNpmWithLock)).toBe(true);
    });

    it('should return false for npm without lockfile', () => {
      expect(supportsFrozenLockfile(mockNpmBasic)).toBe(false);
    });

    it('should return true for yarn with lockfile', () => {
      expect(supportsFrozenLockfile(mockYarnWorkspaces)).toBe(true);
    });

    it('should return true for pnpm with lockfile', () => {
      expect(supportsFrozenLockfile(mockPnpmMonorepo)).toBe(true);
    });

    it('should return false for pip (not supported)', () => {
      const pipManager: PackageManagerDetectionResult = {
        type: 'pip',
        detected: true,
        language: 'python',
        installCommand: 'pip install -r requirements.txt',
        metadata: { hasLockfile: false }
      };
      expect(supportsFrozenLockfile(pipManager)).toBe(false);
    });
  });

  // ============================================================================
  // Monorepo Detection Tests
  // ============================================================================

  describe('isMonorepoProject', () => {
    it('should return true for yarn workspaces', () => {
      expect(isMonorepoProject(mockYarnWorkspaces)).toBe(true);
    });

    it('should return true for pnpm workspaces', () => {
      expect(isMonorepoProject(mockPnpmMonorepo)).toBe(true);
    });

    it('should return false for single package project', () => {
      expect(isMonorepoProject(mockNpmBasic)).toBe(false);
    });

    it('should return true for lerna project', () => {
      const lernaProject: PackageManagerDetectionResult = {
        ...mockNpmBasic,
        metadata: {
          ...mockNpmBasic.metadata,
          hasLernaConfig: true,
          isMonorepoRoot: true
        }
      };
      expect(isMonorepoProject(lernaProject)).toBe(true);
    });
  });

  // ============================================================================
  // Workspace Recommendations Tests
  // ============================================================================

  describe('getWorkspaceInstallRecommendations', () => {
    it('should provide single-package recommendations for non-monorepo', () => {
      const result = getWorkspaceInstallRecommendations(mockNpmBasic);

      expect(result.command).toBe('npm install');
      expect(result.recommendations).toContain('This appears to be a single-package project');
      expect(result.warnings).toHaveLength(0);
    });

    it('should provide npm workspace recommendations', () => {
      const npmWorkspaces = {
        ...mockNpmBasic,
        metadata: { ...mockNpmBasic.metadata, hasWorkspaces: true, isMonorepoRoot: true }
      };
      const result = getWorkspaceInstallRecommendations(npmWorkspaces);

      expect(result.command).toBe('npm install');
      expect(result.recommendations).toContain('Use npm install to install all workspace dependencies');
      expect(result.recommendations).toContain('Consider using npm workspaces for better dependency management');
    });

    it('should provide yarn workspace recommendations', () => {
      const result = getWorkspaceInstallRecommendations(mockYarnWorkspaces);

      expect(result.command).toBe('yarn install');
      expect(result.recommendations).toContain('Use yarn install to install all workspace dependencies');
    });

    it('should provide yarn berry specific recommendations', () => {
      const result = getWorkspaceInstallRecommendations(mockYarnBerry);

      expect(result.recommendations).toContain('Yarn Berry detected - ensure .yarnrc.yml is properly configured');
      expect(result.warnings).toContain('PnP mode may require additional configuration for some tools');
    });

    it('should provide pnpm workspace recommendations', () => {
      const result = getWorkspaceInstallRecommendations(mockPnpmMonorepo);

      expect(result.command).toBe('pnpm install');
      expect(result.recommendations).toContain('Use pnpm install to install all workspace dependencies');
      expect(result.recommendations).toContain('PNPM provides excellent monorepo support with efficient storage');
    });

    it('should handle lerna configuration', () => {
      const lernaProject = {
        ...mockNpmBasic,
        metadata: {
          ...mockNpmBasic.metadata,
          hasLernaConfig: true,
          isMonorepoRoot: true
        }
      };
      const result = getWorkspaceInstallRecommendations(lernaProject);

      expect(result.recommendations).toContain('Lerna detected - consider migrating to npm workspaces');
    });
  });

  // ============================================================================
  // Optimized Install Command Tests
  // ============================================================================

  describe('getOptimizedInstallCommand', () => {
    it('should add CI optimization flags for npm', () => {
      const command = getOptimizedInstallCommand(mockNpmWithLock, true);
      expect(command).toContain('npm ci');
      expect(command).toContain('--prefer-offline');
      expect(command).toContain('--no-audit');
    });

    it('should add CI optimization flags for yarn', () => {
      const command = getOptimizedInstallCommand(mockYarnWorkspaces, true);
      expect(command).toContain('yarn install --frozen-lockfile');
      expect(command).toContain('--prefer-offline');
      expect(command).toContain('--silent');
    });

    it('should add yarn berry immutable flag', () => {
      const command = getOptimizedInstallCommand(mockYarnBerry, true);
      expect(command).toContain('--immutable');
    });

    it('should add CI optimization flags for pnpm', () => {
      const command = getOptimizedInstallCommand(mockPnpmMonorepo, true);
      expect(command).toContain('pnpm install --frozen-lockfile');
      expect(command).toContain('--prefer-offline');
    });

    it('should not add CI flags when not in CI mode', () => {
      const command = getOptimizedInstallCommand(mockNpmWithLock, false);
      expect(command).toBe('npm install');
    });
  });

  // ============================================================================
  // Command Validation Tests
  // ============================================================================

  describe('validateInstallCommand', () => {
    it('should validate correct npm command', () => {
      const result = validateInstallCommand(mockNpmBasic, 'npm install');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should invalidate incorrect package manager prefix', () => {
      const result = validateInstallCommand(mockNpmBasic, 'yarn install');

      expect(result.isValid).toBe(false);
      expect(result.suggestions).toContain("Command should start with 'npm'");
      expect(result.warnings[0]).toMatch(/doesn't match detected package manager/);
    });

    it('should suggest frozen lockfile for projects with lockfiles', () => {
      const result = validateInstallCommand(mockNpmWithLock, 'npm install');

      expect(result.isValid).toBe(true);
      expect(result.suggestions).toContain('Consider using frozen lockfile command for deterministic installs');
    });

    it('should provide monorepo suggestions', () => {
      const result = validateInstallCommand(mockYarnWorkspaces, 'yarn install');

      expect(result.isValid).toBe(true);
      expect(result.suggestions).toContain('This appears to be a monorepo - ensure workspace dependencies are handled correctly');
    });

    it('should handle unknown package manager', () => {
      const unknownManager: PackageManagerDetectionResult = {
        type: 'unknown',
        detected: true,
        installCommand: 'custom-install'
      };
      const result = validateInstallCommand(unknownManager, 'custom-install');

      expect(result.isValid).toBe(true);
    });
  });

  // ============================================================================
  // Environment Variables Tests
  // ============================================================================

  describe('getPackageManagerEnvVars', () => {
    it('should return npm environment variables', () => {
      const envVars = getPackageManagerEnvVars(mockNpmBasic);

      expect(envVars.NPM_CONFIG_PROGRESS).toBe('false');
      expect(envVars.NPM_CONFIG_LOGLEVEL).toBe('error');
    });

    it('should return yarn environment variables', () => {
      const envVars = getPackageManagerEnvVars(mockYarnWorkspaces);

      expect(envVars.YARN_ENABLE_TELEMETRY).toBe('false');
    });

    it('should return yarn berry specific environment variables', () => {
      const envVars = getPackageManagerEnvVars(mockYarnBerry);

      expect(envVars.YARN_ENABLE_TELEMETRY).toBe('false');
      expect(envVars.YARN_ENABLE_GLOBAL_CACHE).toBe('true');
    });

    it('should return pnpm environment variables', () => {
      const envVars = getPackageManagerEnvVars(mockPnpmMonorepo);

      expect(envVars.PNPM_CONFIG_REPORTER).toBe('silent');
      expect(envVars.PNPM_CONFIG_PROGRESS).toBe('false');
    });

    it('should return empty object for unknown package manager', () => {
      const unknownManager: PackageManagerDetectionResult = {
        type: 'unknown',
        detected: true
      };
      const envVars = getPackageManagerEnvVars(unknownManager);

      expect(Object.keys(envVars)).toHaveLength(0);
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('getAllInstallCommands', () => {
    it('should return all npm commands', () => {
      const commands = getAllInstallCommands(mockNpmBasic);

      expect(commands.install).toBe('npm install');
      expect(commands.installFrozen).toBe('npm ci');
      expect(commands.installProduction).toBe('npm ci --only=production');
      expect(commands.installClean).toBe('npm ci --no-cache');
    });

    it('should return all yarn commands', () => {
      const commands = getAllInstallCommands(mockYarnWorkspaces);

      expect(commands.install).toBe('yarn install');
      expect(commands.installFrozen).toBe('yarn install --frozen-lockfile');
      expect(commands.installProduction).toBe('yarn install --frozen-lockfile --production');
    });

    it('should return all pnpm commands', () => {
      const commands = getAllInstallCommands(mockPnpmMonorepo);

      expect(commands.install).toBe('pnpm install');
      expect(commands.installFrozen).toBe('pnpm install --frozen-lockfile');
      expect(commands.installProduction).toBe('pnpm install --frozen-lockfile --prod');
    });

    it('should return empty commands for unknown package manager', () => {
      const unknownManager: PackageManagerDetectionResult = {
        type: 'unknown',
        detected: true
      };
      const commands = getAllInstallCommands(unknownManager);

      expect(commands.install).toBe('');
      expect(commands.installFrozen).toBe('');
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('PACKAGE_MANAGER_COMMANDS', () => {
    it('should have commands for all supported package managers', () => {
      const supportedManagers = ['npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'unknown'];

      supportedManagers.forEach(manager => {
        expect(PACKAGE_MANAGER_COMMANDS).toHaveProperty(manager);
        expect(PACKAGE_MANAGER_COMMANDS[manager as keyof typeof PACKAGE_MANAGER_COMMANDS]).toBeDefined();
      });
    });

    it('should have all required command types for each manager', () => {
      const requiredCommands = ['install', 'installFrozen', 'installProduction', 'installClean'];

      Object.keys(PACKAGE_MANAGER_COMMANDS).forEach(manager => {
        const commands = PACKAGE_MANAGER_COMMANDS[manager as keyof typeof PACKAGE_MANAGER_COMMANDS];
        requiredCommands.forEach(cmdType => {
          expect(commands).toHaveProperty(cmdType);
        });
      });
    });
  });
});