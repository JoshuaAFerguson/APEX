/**
 * Additional edge cases and integration tests for DependencyDetector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import {
  DependencyDetector,
  type PackageManagerType,
  type DependencyDetectionResult,
} from '../dependency-detector';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('DependencyDetector Edge Cases', () => {
  let detector: DependencyDetector;

  beforeEach(() => {
    detector = new DependencyDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    detector.clearCache();
  });

  // ============================================================================
  // Complex Package Manager Scenarios
  // ============================================================================

  describe('Complex Package Manager Scenarios', () => {
    it('should handle monorepo with multiple JS package managers', async () => {
      const projectPath = '/test/monorepo';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('yarn.lock') ||
               filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'monorepo-project',
        version: '1.0.0',
        workspaces: ['packages/*']
      }));

      const result = await detector.detectPackageManagers(projectPath);

      // Should prioritize pnpm over yarn when both lock files exist
      expect(result.primaryManager?.type).toBe('pnpm');
      expect(result.detectedManagers).toHaveLength(1);
    });

    it('should handle project with both Python package managers', async () => {
      const projectPath = '/test/python-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('requirements.txt') || filePath.endsWith('pyproject.toml');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('requirements.txt')) {
          return 'requests==2.28.0\nflask>=2.0.0';
        }
        if (filePath.endsWith('pyproject.toml')) {
          return `
[tool.poetry]
name = "test-project"
version = "1.0.0"

[tool.poetry.dependencies]
python = "^3.8"
          `;
        }
        return '';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toHaveLength(2);
      const managerTypes = result.detectedManagers.map(m => m.type);
      expect(managerTypes).toContain('pip');
      expect(managerTypes).toContain('poetry');

      // Should prioritize poetry over pip
      expect(result.primaryManager?.type).toBe('poetry');
    });

    it('should handle mixed-language project', async () => {
      const projectPath = '/test/mixed-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('Cargo.toml') ||
               filePath.endsWith('requirements.txt') ||
               filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'mixed-project', version: '1.0.0' });
        }
        if (filePath.endsWith('Cargo.toml')) {
          return `
[package]
name = "mixed-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
          `;
        }
        if (filePath.endsWith('requirements.txt')) {
          return 'numpy>=1.20.0';
        }
        return '';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toHaveLength(3);
      const languages = result.detectedManagers.map(m => m.language);
      expect(languages).toContain('javascript');
      expect(languages).toContain('rust');
      expect(languages).toContain('python');

      expect(result.installCommands).toHaveLength(3);
      expect(result.installCommands).toContain('yarn install');
      expect(result.installCommands).toContain('cargo build');
      expect(result.installCommands).toContain('pip install -r requirements.txt');
    });
  });

  // ============================================================================
  // File System Edge Cases
  // ============================================================================

  describe('File System Edge Cases', () => {
    it('should handle empty package.json files', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue('{}');

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].metadata?.packageName).toBeUndefined();
    });

    it('should handle very large package.json files', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      const largeDependencies = Array.from({ length: 1000 }, (_, i) => [`dep${i}`, `^${i}.0.0`]);
      const packageJson = {
        name: 'large-project',
        version: '1.0.0',
        dependencies: Object.fromEntries(largeDependencies.slice(0, 500)),
        devDependencies: Object.fromEntries(largeDependencies.slice(500))
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].metadata?.dependencyCount).toBe(1000);
    });

    it('should handle missing read permissions gracefully', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(false);
      expect(result.detectedManagers).toHaveLength(0);
    });

    it('should handle symbolic links and unusual file paths', async () => {
      const projectPath = '/test/project with spaces/sub-dir';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.includes('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'symlink-project',
        version: '1.0.0'
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.projectPath).toBe('/test/project with spaces/sub-dir');
    });
  });

  // ============================================================================
  // Content Validation Edge Cases
  // ============================================================================

  describe('Content Validation Edge Cases', () => {
    it('should handle package.json with exotic fields', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: '@scope/exotic-package',
        version: '1.0.0-beta.1+build.123',
        packageManager: 'npm@10.0.0',
        workspaces: {
          packages: ['packages/*'],
          nohoist: ['**/react-native', '**/react-native/**']
        },
        engines: {
          node: '>=18.0.0',
          npm: '>=8.0.0'
        },
        os: ['linux', 'darwin'],
        cpu: ['x64', 'arm64'],
        private: true,
        dependencies: {
          '@types/node': 'latest',
          'react': 'npm:@react/experimental',
          'lodash': 'file:../lodash'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].metadata?.packageName).toBe('@scope/exotic-package');
      expect(result.detectedManagers[0].metadata?.hasWorkspaces).toBe(true);
    });

    it('should handle pyproject.toml with multiple build systems', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('pyproject.toml');
      });

      mockReadFileSync.mockReturnValue(`
[build-system]
requires = ["setuptools>=45", "wheel", "setuptools_scm[toml]>=6.2"]
build-backend = "setuptools.build_meta"

[tool.poetry]
name = "test-project"
version = "1.0.0"

[tool.setuptools_scm]
write_to = "src/_version.py"

[tool.black]
line-length = 88
target-version = ['py38']

[tool.isort]
profile = "black"
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('poetry');
      expect(result.detectedManagers[0].metadata?.hasPoetryConfig).toBe(true);
    });

    it('should handle Cargo.toml with workspace configuration', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('Cargo.toml')) return true;
        if (filePath.endsWith('Cargo.lock')) return false; // No lock file
        return false;
      });

      mockReadFileSync.mockReturnValue(`
[workspace]
members = ["crate1", "crate2", "tools/*"]
exclude = ["old-crate"]

[workspace.dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }

[package]
name = "workspace-root"
version = "0.1.0"
edition = "2021"

[dependencies]
workspace-crate1 = { path = "crate1" }
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('cargo');
      expect(result.detectedManagers[0].metadata?.hasCargoConfig).toBe(true);
      expect(result.detectedManagers[0].metadata?.hasLockFile).toBe(false);
    });

    it('should handle requirements.txt with complex pip syntax', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('requirements.txt');
      });

      mockReadFileSync.mockReturnValue(`
# Base dependencies
requests==2.28.0
numpy>=1.20.0,<2.0.0

# Development dependencies
-r dev-requirements.txt

# Git dependencies
-e git+https://github.com/user/repo.git#egg=package
-e git+ssh://git@github.com/private/repo.git@v1.0#egg=private-package

# Local editable dependencies
-e .
-e ./local-package

# Index and extra index
--index-url https://pypi.org/simple/
--extra-index-url https://test.pypi.org/simple/

# Constraints and hashes
django==4.2.0 \
    --hash=sha256:abcd1234
flask>=2.0.0 ; python_version >= "3.8"

# Comments and empty lines

pytest ; extra == "test"
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('pip');
      // Should count non-comment, non-empty, non-option lines
      expect(result.detectedManagers[0].metadata?.requirementLines).toBeGreaterThan(5);
    });
  });

  // ============================================================================
  // Cache Behavior Edge Cases
  // ============================================================================

  describe('Cache Behavior Edge Cases', () => {
    it('should handle cache expiry correctly', async () => {
      // Create a detector with very short cache expiry for testing
      const shortCacheDetector = new class extends DependencyDetector {
        constructor() {
          super();
          // Override cache expiry to 1ms for testing
          (this as any).cacheExpiry = 1;
        }
      }();

      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // First call
      await shortCacheDetector.detectPackageManagers(projectPath);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 2));

      // Clear mocks to verify cache miss
      vi.clearAllMocks();

      // Second call should hit file system due to expired cache
      await shortCacheDetector.detectPackageManagers(projectPath);

      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).toHaveBeenCalled();

      shortCacheDetector.clearCache();
    });

    it('should normalize paths consistently for caching', async () => {
      const projectPath1 = '/test/project/';
      const projectPath2 = '/test/project';
      const projectPath3 = '/test\\project'; // Windows-style path

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // First call
      await detector.detectPackageManagers(projectPath1);

      // Clear mocks to verify caching
      vi.clearAllMocks();

      // These calls should use cache due to path normalization
      await detector.detectPackageManagers(projectPath2);
      await detector.detectPackageManagers(projectPath3);

      expect(mockExistsSync).not.toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Integration-Style Tests
  // ============================================================================

  describe('Integration-Style Tests', () => {
    it('should handle complete workflow for mixed project', async () => {
      const projectPath = '/test/full-stack-project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('requirements.txt') ||
               filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'full-stack-app',
            version: '1.0.0',
            scripts: {
              start: 'node server.js',
              build: 'webpack --mode=production'
            },
            dependencies: {
              express: '^4.18.0',
              react: '^18.2.0'
            },
            devDependencies: {
              webpack: '^5.74.0',
              '@types/node': '^18.0.0'
            }
          });
        }
        if (filePath.endsWith('requirements.txt')) {
          return 'django>=4.0.0\ndjango-rest-framework>=3.14.0';
        }
        return '';
      });

      // Test full workflow
      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(2);

      // Test specific methods
      const installCommand = await detector.getInstallCommand(projectPath);
      expect(installCommand).toBeTruthy();

      const hasYarn = await detector.hasPackageManager(projectPath, 'yarn');
      expect(hasYarn).toBe(true);

      const hasCargo = await detector.hasPackageManager(projectPath, 'cargo');
      expect(hasCargo).toBe(false);

      const allCommands = await detector.getAllInstallCommands(projectPath);
      expect(allCommands).toHaveLength(2);
    });

    it('should handle error recovery and partial detection', async () => {
      const projectPath = '/test/problematic-project';

      let callCount = 0;
      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('requirements.txt');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        callCount++;
        const filePath = path as string;

        if (filePath.endsWith('package.json')) {
          // First package.json read fails
          if (callCount === 1) {
            throw new Error('Temporary read failure');
          }
          return JSON.stringify({ name: 'test', version: '1.0.0' });
        }

        if (filePath.endsWith('requirements.txt')) {
          return 'requests==2.28.0';
        }

        return '';
      });

      const result = await detector.detectPackageManagers(projectPath);

      // Should successfully detect pip even though npm detection failed
      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('pip');
    });
  });

  // ============================================================================
  // Performance Edge Cases
  // ============================================================================

  describe('Performance Edge Cases', () => {
    it('should handle many simultaneous detection calls', async () => {
      const projectPath = '/test/concurrent-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'concurrent' }));

      // Make many concurrent calls
      const promises = Array.from({ length: 100 }, () =>
        detector.detectPackageManagers(projectPath)
      );

      const results = await Promise.all(promises);

      // All results should be identical due to caching
      expect(results.every(r => r.hasPackageManagers)).toBe(true);
      expect(new Set(results.map(r => JSON.stringify(r))).size).toBe(1);
    });

    it('should handle detection with cache disabled under load', async () => {
      const projectPath = '/test/no-cache-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // Make multiple calls with cache disabled
      const promises = Array.from({ length: 10 }, () =>
        detector.detectPackageManagers(projectPath, false)
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.hasPackageManagers)).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledTimes(10); // Should call file system each time
    });
  });
});