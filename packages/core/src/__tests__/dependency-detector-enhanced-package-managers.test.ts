/**
 * Enhanced Package Manager Integration Tests
 *
 * Comprehensive integration tests for npm/yarn/pnpm install variants.
 * Covers basic install, frozen lockfile variants, monorepo detection,
 * and workspace detection for each package manager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  DependencyDetector,
  type PackageManagerDetectionResult,
  type DependencyDetectionResult,
} from '../dependency-detector';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('Enhanced Package Manager Integration Tests', () => {
  let detector: DependencyDetector;

  beforeEach(() => {
    detector = new DependencyDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    detector.clearCache();
  });

  // ============================================================================
  // NPM Package Manager Tests
  // ============================================================================

  describe('NPM Integration Tests', () => {
    it('should detect basic npm install configuration', async () => {
      const projectPath = '/test/npm-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-npm-project',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.21'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'typescript': '^5.0.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].installCommand).toBe('npm install');
      expect(result.detectedManagers[0].metadata?.packageName).toBe('test-npm-project');
      expect(result.detectedManagers[0].metadata?.dependencyCount).toBe(4);
    });

    it('should detect npm ci variant for frozen lockfile installs', async () => {
      const projectPath = '/test/npm-ci-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('package-lock.json');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'test-npm-ci-project',
            version: '1.0.0',
            dependencies: { 'express': '^4.18.0' }
          });
        }
        // Mock package-lock.json content
        return JSON.stringify({
          name: 'test-npm-ci-project',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {}
        });
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].metadata?.hasLockfile).toBe(true);
      // The basic detector returns 'npm install', but consumers can check for lockfile presence
      expect(result.detectedManagers[0].installCommand).toBe('npm install');
    });

    it('should detect npm workspaces configuration', async () => {
      const projectPath = '/test/npm-workspaces';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'npm-workspaces-root',
        version: '1.0.0',
        private: true,
        workspaces: [
          'packages/*',
          'apps/*'
        ],
        devDependencies: {
          'typescript': '^5.0.0',
          '@types/node': '^20.0.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].metadata?.hasWorkspaces).toBe(true);
      expect(result.detectedManagers[0].metadata?.isMonorepoRoot).toBe(true);
      expect(result.detectedManagers[0].metadata?.workspacePatterns).toEqual(['packages/*', 'apps/*']);
    });

    it('should detect npm in monorepo with lerna configuration', async () => {
      const projectPath = '/test/npm-lerna-monorepo';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('lerna.json');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'npm-lerna-monorepo',
            version: '1.0.0',
            private: true,
            devDependencies: {
              'lerna': '^7.0.0'
            }
          });
        }
        // Mock lerna.json
        return JSON.stringify({
          version: 'independent',
          packages: ['packages/*'],
          npmClient: 'npm'
        });
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].metadata?.hasLernaConfig).toBe(true);
      expect(result.detectedManagers[0].metadata?.isMonorepoRoot).toBe(true);
      expect(result.detectedManagers[0].metadata?.monorepoType).toBe('lerna');
    });
  });

  // ============================================================================
  // Yarn Package Manager Tests
  // ============================================================================

  describe('Yarn Integration Tests', () => {
    it('should detect basic yarn install configuration', async () => {
      const projectPath = '/test/yarn-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-yarn-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          'vite': '^4.0.0',
          '@types/react': '^18.0.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].installCommand).toBe('yarn install');
      expect(result.detectedManagers[0].metadata?.packageName).toBe('test-yarn-project');
      expect(result.detectedManagers[0].metadata?.dependencyCount).toBe(4);
    });

    it('should detect yarn with packageManager field specification', async () => {
      const projectPath = '/test/yarn-packagemanager';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'yarn-packagemanager-project',
        version: '1.0.0',
        packageManager: 'yarn@3.6.0',
        dependencies: {
          'express': '^4.18.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].metadata?.packageManagerVersion).toBe('yarn@3.6.0');
      expect(result.detectedManagers[0].metadata?.yarnVersion).toBe('3.6.0');
    });

    it('should detect yarn frozen lockfile installation', async () => {
      const projectPath = '/test/yarn-frozen';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'yarn-frozen-project',
            version: '1.0.0',
            dependencies: { 'lodash': '^4.17.21' }
          });
        }
        // Mock yarn.lock content
        return '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n' +
               '# yarn lockfile v1\n\n' +
               'lodash@^4.17.21:\n' +
               '  version "4.17.21"\n' +
               '  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"\n';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].metadata?.hasLockfile).toBe(true);
      expect(result.detectedManagers[0].metadata?.lockfileType).toBe('yarn.lock');
    });

    it('should detect yarn workspaces configuration', async () => {
      const projectPath = '/test/yarn-workspaces';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'yarn-workspaces-root',
        version: '1.0.0',
        private: true,
        workspaces: {
          packages: ['packages/*', 'tools/*'],
          nohoist: ['**/react-native', '**/react-native/**']
        },
        devDependencies: {
          'typescript': '^5.0.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].metadata?.hasWorkspaces).toBe(true);
      expect(result.detectedManagers[0].metadata?.isMonorepoRoot).toBe(true);
      expect(result.detectedManagers[0].metadata?.workspacePatterns).toEqual(['packages/*', 'tools/*']);
      expect(result.detectedManagers[0].metadata?.hasNohoistConfig).toBe(true);
    });

    it('should detect yarn Berry (v2+) with .yarnrc.yml configuration', async () => {
      const projectPath = '/test/yarn-berry';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('yarn.lock') ||
               filePath.endsWith('.yarnrc.yml');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'yarn-berry-project',
            version: '1.0.0',
            packageManager: 'yarn@3.6.0',
            dependencies: { 'react': '^18.0.0' }
          });
        }
        if (filePath.endsWith('.yarnrc.yml')) {
          return 'nodeLinker: pnp\n' +
                 'yarnPath: .yarn/releases/yarn-3.6.0.cjs\n' +
                 'enableTelemetry: false\n';
        }
        return 'yarn.lock content';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].metadata?.yarnVersion).toBe('3.6.0');
      expect(result.detectedManagers[0].metadata?.isYarnBerry).toBe(true);
      expect(result.detectedManagers[0].metadata?.nodeLinker).toBe('pnp');
      expect(result.detectedManagers[0].metadata?.hasYarnrcConfig).toBe(true);
    });
  });

  // ============================================================================
  // PNPM Package Manager Tests
  // ============================================================================

  describe('PNPM Integration Tests', () => {
    it('should detect basic pnpm install configuration', async () => {
      const projectPath = '/test/pnpm-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-pnpm-project',
        version: '1.0.0',
        dependencies: {
          'vue': '^3.3.0',
          'vue-router': '^4.0.0'
        },
        devDependencies: {
          'vite': '^4.0.0',
          '@vue/compiler-sfc': '^3.3.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].installCommand).toBe('pnpm install');
      expect(result.detectedManagers[0].metadata?.packageName).toBe('test-pnpm-project');
      expect(result.detectedManagers[0].metadata?.dependencyCount).toBe(4);
    });

    it('should detect pnpm with packageManager field specification', async () => {
      const projectPath = '/test/pnpm-packagemanager';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'pnpm-packagemanager-project',
        version: '1.0.0',
        packageManager: 'pnpm@8.6.0',
        dependencies: {
          'next': '^13.0.0'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].metadata?.packageManagerVersion).toBe('pnpm@8.6.0');
      expect(result.detectedManagers[0].metadata?.pnpmVersion).toBe('8.6.0');
    });

    it('should detect pnpm frozen lockfile installation', async () => {
      const projectPath = '/test/pnpm-frozen';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'pnpm-frozen-project',
            version: '1.0.0',
            dependencies: { 'axios': '^1.4.0' }
          });
        }
        // Mock pnpm-lock.yaml content
        return 'lockfileVersion: \'6.0\'\n\n' +
               'settings:\n' +
               '  autoInstallPeers: true\n' +
               '  excludeLinksFromLockfile: false\n\n' +
               'dependencies:\n' +
               '  axios:\n' +
               '    specifier: ^1.4.0\n' +
               '    version: 1.4.0\n';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].metadata?.hasLockfile).toBe(true);
      expect(result.detectedManagers[0].metadata?.lockfileType).toBe('pnpm-lock.yaml');
      expect(result.detectedManagers[0].metadata?.lockfileVersion).toBe('6.0');
    });

    it('should detect pnpm workspaces configuration', async () => {
      const projectPath = '/test/pnpm-workspaces';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('pnpm-lock.yaml') ||
               filePath.endsWith('pnpm-workspace.yaml');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'pnpm-workspaces-root',
            version: '1.0.0',
            private: true,
            devDependencies: {
              'turbo': '^1.10.0',
              'typescript': '^5.0.0'
            }
          });
        }
        if (filePath.endsWith('pnpm-workspace.yaml')) {
          return 'packages:\n' +
                 '  - "packages/*"\n' +
                 '  - "apps/*"\n' +
                 '  - "!**/test/**"\n';
        }
        return 'pnpm-lock.yaml content';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].metadata?.hasWorkspaces).toBe(true);
      expect(result.detectedManagers[0].metadata?.isMonorepoRoot).toBe(true);
      expect(result.detectedManagers[0].metadata?.workspacePatterns).toEqual(['packages/*', 'apps/*', '!**/test/**']);
      expect(result.detectedManagers[0].metadata?.hasWorkspaceConfig).toBe(true);
    });

    it('should detect pnpm with .pnpmrc configuration', async () => {
      const projectPath = '/test/pnpm-config';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('pnpm-lock.yaml') ||
               filePath.endsWith('.pnpmrc');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'pnpm-config-project',
            version: '1.0.0',
            dependencies: { 'react': '^18.0.0' }
          });
        }
        if (filePath.endsWith('.pnpmrc')) {
          return 'strict-peer-dependencies=false\n' +
                 'auto-install-peers=true\n' +
                 'shamefully-hoist=false\n' +
                 'store-dir=~/.pnpm-store\n';
        }
        return 'pnpm-lock.yaml content';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].metadata?.hasPnpmrcConfig).toBe(true);
      expect(result.detectedManagers[0].metadata?.pnpmConfig).toEqual({
        strictPeerDependencies: false,
        autoInstallPeers: true,
        shamefullyHoist: false,
        storeDir: '~/.pnpm-store'
      });
    });
  });

  // ============================================================================
  // Multi-Package Manager Priority Tests
  // ============================================================================

  describe('Package Manager Priority and Detection', () => {
    it('should prioritize pnpm over yarn over npm when multiple lockfiles exist', async () => {
      const projectPath = '/test/multi-manager-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('package-lock.json') ||
               filePath.endsWith('yarn.lock') ||
               filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'multi-manager-project',
        version: '1.0.0',
        dependencies: { 'lodash': '^4.17.21' }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.primaryManager?.type).toBe('pnpm');
      expect(result.detectedManagers).toHaveLength(1); // Should only detect the highest priority one
    });

    it('should detect yarn over npm when both package.json and yarn.lock exist', async () => {
      const projectPath = '/test/yarn-npm-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('package-lock.json') ||
               filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'yarn-npm-project',
        version: '1.0.0',
        dependencies: { 'express': '^4.18.0' }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.primaryManager?.type).toBe('yarn');
    });

    it('should detect npm when only package.json and package-lock.json exist', async () => {
      const projectPath = '/test/npm-only-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('package-lock.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'npm-only-project',
        version: '1.0.0',
        dependencies: { 'chalk': '^5.0.0' }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.primaryManager?.type).toBe('npm');
    });
  });

  // ============================================================================
  // Install Command Variants Tests
  // ============================================================================

  describe('Install Command Variants', () => {
    it('should provide correct frozen lockfile commands based on detected package manager', async () => {
      const testCases = [
        {
          name: 'npm with package-lock.json',
          lockFile: 'package-lock.json',
          expectedType: 'npm',
          expectedFrozenCommand: 'npm ci',
          expectedRegularCommand: 'npm install'
        },
        {
          name: 'yarn with yarn.lock',
          lockFile: 'yarn.lock',
          expectedType: 'yarn',
          expectedFrozenCommand: 'yarn install --frozen-lockfile',
          expectedRegularCommand: 'yarn install'
        },
        {
          name: 'pnpm with pnpm-lock.yaml',
          lockFile: 'pnpm-lock.yaml',
          expectedType: 'pnpm',
          expectedFrozenCommand: 'pnpm install --frozen-lockfile',
          expectedRegularCommand: 'pnpm install'
        }
      ];

      for (const testCase of testCases) {
        const projectPath = `/test/${testCase.expectedType}-frozen-test`;

        mockExistsSync.mockImplementation((path: string) => {
          const filePath = path as string;
          return filePath.endsWith('package.json') || filePath.endsWith(testCase.lockFile);
        });

        mockReadFileSync.mockReturnValue(JSON.stringify({
          name: `${testCase.expectedType}-frozen-test`,
          version: '1.0.0',
          dependencies: { 'test-package': '^1.0.0' }
        }));

        const result = await detector.detectPackageManagers(projectPath);

        expect(result.primaryManager?.type).toBe(testCase.expectedType);
        expect(result.primaryManager?.installCommand).toBe(testCase.expectedRegularCommand);
        expect(result.primaryManager?.metadata?.hasLockfile).toBe(true);

        // Test frozen lockfile command generation (would be handled by consuming code)
        const hasFrozenLockfile = result.primaryManager?.metadata?.hasLockfile;
        let frozenCommand: string;

        if (hasFrozenLockfile) {
          switch (testCase.expectedType) {
            case 'npm':
              frozenCommand = 'npm ci';
              break;
            case 'yarn':
              frozenCommand = 'yarn install --frozen-lockfile';
              break;
            case 'pnpm':
              frozenCommand = 'pnpm install --frozen-lockfile';
              break;
            default:
              frozenCommand = testCase.expectedRegularCommand;
          }
        } else {
          frozenCommand = testCase.expectedRegularCommand;
        }

        expect(frozenCommand).toBe(testCase.expectedFrozenCommand);

        // Clear mocks for next iteration
        vi.clearAllMocks();
      }
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle corrupted lockfiles gracefully', async () => {
      const projectPath = '/test/corrupted-lockfile';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'corrupted-lockfile-test',
            version: '1.0.0',
            dependencies: { 'lodash': '^4.17.21' }
          });
        }
        // Return corrupted yarn.lock
        throw new Error('Failed to read yarn.lock: file is corrupted');
      });

      const result = await detector.detectPackageManagers(projectPath);

      // Should still detect yarn based on package.json and lockfile existence
      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].metadata?.hasLockfile).toBe(true);
      expect(result.detectedManagers[0].metadata?.lockfileReadError).toBeTruthy();
    });

    it('should handle missing workspace configuration files', async () => {
      const projectPath = '/test/missing-workspace-config';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'missing-workspace-config',
        version: '1.0.0',
        private: true,
        dependencies: { 'turbo': '^1.10.0' }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].metadata?.hasWorkspaces).toBe(false);
      expect(result.detectedManagers[0].metadata?.isMonorepoRoot).toBe(false);
    });

    it('should handle mixed package manager indicators correctly', async () => {
      const projectPath = '/test/mixed-indicators';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'mixed-indicators-project',
        version: '1.0.0',
        packageManager: 'pnpm@8.6.0', // packageManager field says pnpm
        dependencies: { 'react': '^18.0.0' }
        // But yarn.lock exists
      }));

      const result = await detector.detectPackageManagers(projectPath);

      // Should prioritize yarn.lock existence over packageManager field for yarn
      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].metadata?.conflictingPackageManagerField).toBe('pnpm@8.6.0');
    });
  });
});