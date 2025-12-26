import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  DependencyDetector,
  dependencyDetector,
  detectDependencies,
  getProjectInstallCommand,
  hasProjectPackageManager,
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

describe('DependencyDetector', () => {
  let detector: DependencyDetector;

  beforeEach(() => {
    detector = new DependencyDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    detector.clearCache();
  });

  // ============================================================================
  // Core Detection Tests
  // ============================================================================

  describe('Package Manager Detection', () => {
    it('should detect npm when only package.json exists', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: { lodash: '^4.0.0' }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('npm');
      expect(result.detectedManagers[0].installCommand).toBe('npm install');
      expect(result.primaryManager?.type).toBe('npm');
    });

    it('should detect yarn when yarn.lock exists', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('yarn');
      expect(result.detectedManagers[0].installCommand).toBe('yarn install');
    });

    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('pnpm');
      expect(result.detectedManagers[0].installCommand).toBe('pnpm install');
    });

    it('should detect pip when requirements.txt exists', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('requirements.txt');
      });

      mockReadFileSync.mockReturnValue('requests==2.28.0\nflask>=2.0.0');

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('pip');
      expect(result.detectedManagers[0].installCommand).toBe('pip install -r requirements.txt');
      expect(result.detectedManagers[0].language).toBe('python');
    });

    it('should detect poetry when pyproject.toml with [tool.poetry] exists', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('pyproject.toml');
      });

      mockReadFileSync.mockReturnValue(`
[tool.poetry]
name = "test-project"
version = "1.0.0"

[tool.poetry.dependencies]
python = "^3.8"
requests = "^2.28.0"
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('poetry');
      expect(result.detectedManagers[0].installCommand).toBe('poetry install');
      expect(result.detectedManagers[0].language).toBe('python');
    });

    it('should detect cargo when Cargo.toml exists', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('Cargo.toml');
      });

      mockReadFileSync.mockReturnValue(`
[package]
name = "test-project"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('cargo');
      expect(result.detectedManagers[0].installCommand).toBe('cargo build');
      expect(result.detectedManagers[0].language).toBe('rust');
    });
  });

  // ============================================================================
  // Multi-Package Manager Tests
  // ============================================================================

  describe('Multiple Package Manager Detection', () => {
    it('should detect multiple package managers in same project', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('requirements.txt') ||
               filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'test-project', version: '1.0.0' });
        }
        if (filePath.endsWith('requirements.txt')) {
          return 'requests==2.28.0';
        }
        return '';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(2);

      const managerTypes = result.detectedManagers.map(m => m.type);
      expect(managerTypes).toContain('yarn');
      expect(managerTypes).toContain('pip');

      expect(result.installCommands).toHaveLength(2);
      expect(result.installCommands).toContain('yarn install');
      expect(result.installCommands).toContain('pip install -r requirements.txt');
    });

    it('should prioritize pnpm over yarn over npm', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.primaryManager?.type).toBe('pnpm');
    });
  });

  // ============================================================================
  // Metadata Extraction Tests
  // ============================================================================

  describe('Metadata Extraction', () => {
    it('should extract npm package metadata', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-package',
        version: '2.1.0',
        dependencies: { lodash: '^4.0.0', express: '^4.18.0' },
        devDependencies: { jest: '^29.0.0' }
      }));

      const result = await detector.detectPackageManagers(projectPath);
      const npmManager = result.detectedManagers.find(m => m.type === 'npm');

      expect(npmManager?.metadata?.packageName).toBe('test-package');
      expect(npmManager?.metadata?.version).toBe('2.1.0');
      expect(npmManager?.metadata?.dependencyCount).toBe(3);
    });

    it('should extract pip requirements metadata', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('requirements.txt');
      });

      mockReadFileSync.mockReturnValue(`# This is a comment
requests==2.28.0
flask>=2.0.0

# Another comment
numpy>=1.20.0
pandas>=1.5.0`);

      const result = await detector.detectPackageManagers(projectPath);
      const pipManager = result.detectedManagers.find(m => m.type === 'pip');

      expect(pipManager?.metadata?.requirementLines).toBe(4); // Non-comment, non-empty lines
    });

    it('should extract cargo metadata', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('Cargo.toml')) return true;
        if (filePath.endsWith('Cargo.lock')) return true;
        return false;
      });

      mockReadFileSync.mockReturnValue(`
[package]
name = "test-crate"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = "1.0"
      `);

      const result = await detector.detectPackageManagers(projectPath);
      const cargoManager = result.detectedManagers.find(m => m.type === 'cargo');

      expect(cargoManager?.metadata?.hasCargoConfig).toBe(true);
      expect(cargoManager?.metadata?.hasLockFile).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle missing config files', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(false);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(false);
      expect(result.detectedManagers).toHaveLength(0);
      expect(result.primaryManager).toBeUndefined();
      expect(result.installCommands).toHaveLength(0);
    });

    it('should handle invalid JSON in package.json', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue('{ invalid json }');

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(false);
      expect(result.detectedManagers).toHaveLength(0);
    });

    it('should handle read file errors', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(false);
    });

    it('should handle pyproject.toml without poetry configuration', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('pyproject.toml');
      });

      mockReadFileSync.mockReturnValue(`
[build-system]
requires = ["setuptools", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "test-project"
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(false); // Should not detect as poetry
    });
  });

  // ============================================================================
  // Convenience Functions Tests
  // ============================================================================

  describe('Convenience Functions', () => {
    it('should get install command via convenience function', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      const command = await detector.getInstallCommand(projectPath);

      expect(command).toBe('npm install');
    });

    it('should check package manager existence via convenience function', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('requirements.txt');
      });

      mockReadFileSync.mockReturnValue('requests==2.28.0');

      const hasPip = await detector.hasPackageManager(projectPath, 'pip');
      const hasNpm = await detector.hasPackageManager(projectPath, 'npm');

      expect(hasPip).toBe(true);
      expect(hasNpm).toBe(false);
    });

    it('should get all install commands', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('requirements.txt') ||
               filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'test-project' });
        }
        return 'requests==2.28.0';
      });

      const commands = await detector.getAllInstallCommands(projectPath);

      expect(commands).toHaveLength(2);
      expect(commands).toContain('yarn install');
      expect(commands).toContain('pip install -r requirements.txt');
    });
  });

  // ============================================================================
  // Package Manager Specific Verification Tests
  // ============================================================================

  describe('Package Manager Verification', () => {
    it('should detect yarn via packageManager field', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        packageManager: 'yarn@3.6.0'
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('yarn');
    });

    it('should detect pnpm via packageManager field', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        packageManager: 'pnpm@8.6.0'
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toHaveLength(1);
      expect(result.detectedManagers[0].type).toBe('pnpm');
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('Caching', () => {
    it('should use cached results on subsequent calls', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      // First call
      const result1 = await detector.detectPackageManagers(projectPath);

      // Clear mocks to verify caching
      vi.clearAllMocks();

      // Second call should use cache
      const result2 = await detector.detectPackageManagers(projectPath);

      expect(mockExistsSync).not.toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(result1).toEqual(result2);
    });

    it('should bypass cache when useCache is false', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      // First call
      await detector.detectPackageManagers(projectPath);

      // Clear mocks
      vi.clearAllMocks();

      // Second call with cache disabled
      await detector.detectPackageManagers(projectPath, false);

      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).toHaveBeenCalled();
    });

    it('should clear cache properly', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // Populate cache
      await detector.detectPackageManagers(projectPath);

      // Clear cache
      detector.clearCache();

      // Clear mocks
      vi.clearAllMocks();

      // Should make new detection calls
      await detector.detectPackageManagers(projectPath);

      expect(mockExistsSync).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Global Instance Tests
  // ============================================================================

  describe('Global Convenience Functions', () => {
    it('should work with global detectDependencies function', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('requests==2.28.0');

      const result = await detectDependencies(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('pip');
    });

    it('should work with global getProjectInstallCommand function', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test' }));

      const command = await getProjectInstallCommand(projectPath);

      expect(command).toBe('npm install');
    });

    it('should work with global hasProjectPackageManager function', async () => {
      const projectPath = '/test/project';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('Cargo.toml');
      });

      mockReadFileSync.mockReturnValue(`
[package]
name = "test"
      `);

      const hasCargo = await hasProjectPackageManager(projectPath, 'cargo');
      const hasNpm = await hasProjectPackageManager(projectPath, 'npm');

      expect(hasCargo).toBe(true);
      expect(hasNpm).toBe(false);
    });
  });
});