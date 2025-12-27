/**
 * Extended Package Manager Support Tests
 *
 * Tests coverage gaps for Poetry, Pipenv, Yarn Workspaces, PNPM workspaces
 * Addresses AC2 and AC3 partial coverage gaps from gap analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DependencyDetector } from '../dependency-detector';
import fs from 'fs/promises';

// Mock filesystem operations
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

describe('Extended Package Manager Support', () => {
  let detector: DependencyDetector;
  const projectPath = '/test/project';
  let mockFs: any;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new DependencyDetector();
    mockFs = vi.mocked(fs);
  });

  describe('Python Ecosystem Extended Support', () => {
    it('should detect Poetry projects with pyproject.toml', async () => {
      // Mock pyproject.toml exists
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('pyproject.toml')) return Promise.resolve();
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockResolvedValue(`
[tool.poetry]
name = "test-project"
version = "0.1.0"
description = ""

[tool.poetry.dependencies]
python = "^3.8"
requests = "^2.28.0"
`);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual({
        type: 'poetry',
        language: 'python',
        installCommand: 'poetry install',
        detected: true,
        configFile: 'pyproject.toml'
      });
      expect(result.installCommands).toContain('poetry install');
    });

    it('should detect Pipenv projects with Pipfile', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('Pipfile')) return Promise.resolve();
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockResolvedValue(`
[[source]]
url = "https://pypi.org/simple"
verify_ssl = true
name = "pypi"

[packages]
requests = "*"
django = "*"

[dev-packages]
pytest = "*"
`);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual({
        type: 'pipenv',
        language: 'python',
        installCommand: 'pipenv install',
        detected: true,
        configFile: 'Pipfile'
      });
    });

    it('should prioritize Poetry over pip when both exist', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('pyproject.toml') || path.includes('requirements.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('pyproject.toml')) {
          return Promise.resolve('[tool.poetry]\nname = "test"');
        }
        if (path.includes('requirements.txt')) {
          return Promise.resolve('requests==2.28.0');
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.primaryManager?.type).toBe('poetry');
      expect(result.detectedManagers).toHaveLength(2);
    });

    it('should handle requirements-dev.txt alongside requirements.txt', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('requirements.txt') || path.includes('requirements-dev.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockResolvedValue('pytest>=6.0.0');

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers.some(m =>
        m.type === 'pip' && m.installCommand.includes('requirements-dev.txt')
      )).toBe(true);
    });
  });

  describe('Node.js Ecosystem Extended Support', () => {
    it('should detect Yarn workspace configuration', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('package.json') || path.includes('yarn.lock')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'workspace-root',
            workspaces: ['packages/*'],
            devDependencies: { typescript: '^4.0.0' }
          }));
        }
        return Promise.resolve('');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual(
        expect.objectContaining({
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true,
          isWorkspace: true
        })
      );
    });

    it('should detect PNPM workspace configuration', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('package.json') || path.includes('pnpm-lock.yaml') || path.includes('pnpm-workspace.yaml')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('pnpm-workspace.yaml')) {
          return Promise.resolve('packages:\n  - "packages/*"');
        }
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ name: 'test' }));
        }
        return Promise.resolve('');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual(
        expect.objectContaining({
          type: 'pnpm',
          language: 'javascript',
          installCommand: 'pnpm install',
          detected: true,
          isWorkspace: true
        })
      );
    });

    it('should detect Yarn Berry (.yarnrc.yml) configuration', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('package.json') || path.includes('.yarnrc.yml')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('.yarnrc.yml')) {
          return Promise.resolve('yarnPath: .yarn/releases/yarn-4.0.0.cjs\nnodeLinker: pnp');
        }
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ name: 'test' }));
        }
        return Promise.resolve('');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual(
        expect.objectContaining({
          type: 'yarn',
          language: 'javascript',
          installCommand: 'yarn install',
          detected: true,
          version: 'berry'
        })
      );
    });
  });

  describe('Rust Ecosystem Extended Support', () => {
    it('should detect Cargo workspace configuration', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('Cargo.toml')) return Promise.resolve();
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockResolvedValue(`
[workspace]
members = [
    "crate1",
    "crate2",
    "shared/*"
]
resolver = "2"

[workspace.dependencies]
serde = "1.0"
`);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual(
        expect.objectContaining({
          type: 'cargo',
          language: 'rust',
          installCommand: 'cargo build',
          detected: true,
          isWorkspace: true
        })
      );
    });

    it('should distinguish between cargo check and cargo build', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('Cargo.toml')) return Promise.resolve();
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockResolvedValue(`
[package]
name = "test-crate"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"
`);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual(
        expect.objectContaining({
          type: 'cargo',
          language: 'rust',
          installCommand: 'cargo build',
          detected: true,
          alternativeCommands: ['cargo check']
        })
      );
    });

    it('should handle Cargo.lock presence', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('Cargo.toml') || path.includes('Cargo.lock')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockResolvedValue(`
[package]
name = "test-crate"
version = "0.1.0"
`);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers[0]).toEqual(
        expect.objectContaining({
          type: 'cargo',
          hasLockFile: true
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle corrupted package.json gracefully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return Promise.resolve('{ invalid json content }');
        }
        return Promise.resolve('');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toEqual([]);
      expect(result.hasPackageManagers).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          file: 'package.json',
          error: expect.stringContaining('JSON')
        })
      );
    });

    it('should handle missing file permissions', async () => {
      mockFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toEqual([]);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          error: expect.stringContaining('permission denied')
        })
      );
    });

    it('should handle mixed project types (Node.js + Python)', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('package.json') || path.includes('requirements.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ name: 'test', dependencies: { express: '^4.0.0' } }));
        }
        if (path.includes('requirements.txt')) {
          return Promise.resolve('django>=3.0.0');
        }
        return Promise.resolve('');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toHaveLength(2);
      expect(result.detectedManagers.some(m => m.type === 'npm')).toBe(true);
      expect(result.detectedManagers.some(m => m.type === 'pip')).toBe(true);
      expect(result.primaryManager?.type).toBe('npm'); // Node.js takes priority
    });

    it('should handle symlinked dependency files', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          // Simulate symlink resolution
          return Promise.resolve(JSON.stringify({ name: 'symlinked-project' }));
        }
        return Promise.resolve('');
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.detectedManagers).toContainEqual(
        expect.objectContaining({
          type: 'npm',
          detected: true
        })
      );
    });
  });
});