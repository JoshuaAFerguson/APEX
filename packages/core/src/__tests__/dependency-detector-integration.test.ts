/**
 * Integration tests for DependencyDetector that simulate real-world usage scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import {
  DependencyDetector,
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

describe('DependencyDetector Integration Tests', () => {
  let detector: DependencyDetector;

  beforeEach(() => {
    detector = new DependencyDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    detector.clearCache();
  });

  // ============================================================================
  // Real-World Project Scenarios
  // ============================================================================

  describe('Real-World Project Scenarios', () => {
    it('should handle typical Next.js project', async () => {
      const projectPath = '/projects/nextjs-app';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'my-nextjs-app',
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint'
        },
        dependencies: {
          next: '14.0.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          '@types/node': '^20.5.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          eslint: '^8.45.0',
          'eslint-config-next': '14.0.0',
          typescript: '^5.1.6'
        }
      }));

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.primaryManager?.type).toBe('yarn');
      expect(result.primaryManager?.installCommand).toBe('yarn install');
      expect(result.detectedManagers[0].metadata?.hasWorkspaces).toBe(false);
      expect(result.detectedManagers[0].metadata?.dependencyCount).toBe(10);
    });

    it('should handle Python Django project with Poetry', async () => {
      const projectPath = '/projects/django-api';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('pyproject.toml');
      });

      mockReadFileSync.mockReturnValue(`
[tool.poetry]
name = "django-api"
version = "0.1.0"
description = "REST API with Django"
authors = ["Developer <dev@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
django = "^4.2.0"
djangorestframework = "^3.14.0"
psycopg2-binary = "^2.9.7"
celery = "^5.3.0"
redis = "^4.6.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
pytest-django = "^4.5.2"
black = "^23.7.0"
flake8 = "^6.0.0"
mypy = "^1.5.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.black]
line-length = 88
target-version = ['py311']

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.primaryManager?.type).toBe('poetry');
      expect(result.primaryManager?.language).toBe('python');
      expect(result.detectedManagers[0].metadata?.hasPoetryConfig).toBe(true);

      // Test convenience functions
      const installCommand = await getProjectInstallCommand(projectPath);
      expect(installCommand).toBe('poetry install');

      const hasPoetry = await hasProjectPackageManager(projectPath, 'poetry');
      expect(hasPoetry).toBe(true);
    });

    it('should handle Rust workspace project', async () => {
      const projectPath = '/projects/rust-workspace';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('Cargo.toml')) return true;
        if (filePath.endsWith('Cargo.lock')) return true;
        return false;
      });

      mockReadFileSync.mockReturnValue(`
[workspace]
members = [
    "apps/cli",
    "apps/server",
    "libs/core",
    "libs/database",
]
exclude = ["examples"]

[workspace.dependencies]
tokio = { version = "1.32.0", features = ["full"] }
serde = { version = "1.0.0", features = ["derive"] }
clap = { version = "4.4.0", features = ["derive"] }

[package]
name = "rust-workspace"
version = "0.1.0"
edition = "2021"

[dependencies]
# Workspace dependencies
tokio = { workspace = true }
serde = { workspace = true }

# Local crates
core = { path = "libs/core" }
database = { path = "libs/database" }
      `);

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.primaryManager?.type).toBe('cargo');
      expect(result.primaryManager?.language).toBe('rust');
      expect(result.detectedManagers[0].metadata?.hasCargoConfig).toBe(true);
      expect(result.detectedManagers[0].metadata?.hasLockFile).toBe(true);
    });

    it('should handle monorepo with multiple ecosystems', async () => {
      const projectPath = '/projects/full-stack-monorepo';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('requirements.txt') ||
               filePath.endsWith('Cargo.toml') ||
               filePath.endsWith('pnpm-lock.yaml');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;

        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'full-stack-monorepo',
            version: '1.0.0',
            private: true,
            packageManager: 'pnpm@8.6.0',
            workspaces: ['apps/*', 'packages/*'],
            scripts: {
              build: 'turbo run build',
              dev: 'turbo run dev',
              test: 'turbo run test'
            },
            devDependencies: {
              turbo: '^1.10.0',
              prettier: '^3.0.0',
              eslint: '^8.45.0'
            }
          });
        }

        if (filePath.endsWith('requirements.txt')) {
          return `
# AI/ML Backend
fastapi>=0.103.0
uvicorn[standard]>=0.23.0
pydantic>=2.0.0
sqlalchemy>=2.0.0
alembic>=1.12.0
redis>=4.6.0

# Machine Learning
torch>=2.0.0
transformers>=4.33.0
scikit-learn>=1.3.0
numpy>=1.24.0
pandas>=2.0.0
          `;
        }

        if (filePath.endsWith('Cargo.toml')) {
          return `
[package]
name = "performance-workers"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1.32.0", features = ["full"] }
serde = { version = "1.0.0", features = ["derive"] }
serde_json = "1.0.0"
reqwest = { version = "0.11.0", features = ["json"] }
uuid = { version = "1.4.0", features = ["v4"] }
anyhow = "1.0.0"
          `;
        }

        return '';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(3);

      const managerTypes = result.detectedManagers.map(m => m.type);
      expect(managerTypes).toContain('pnpm');
      expect(managerTypes).toContain('pip');
      expect(managerTypes).toContain('cargo');

      const languages = result.detectedManagers.map(m => m.language);
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('rust');

      // Should prioritize pnpm as primary for this mixed repo
      expect(result.primaryManager?.type).toBe('pnpm');

      expect(result.installCommands).toHaveLength(3);
      expect(result.installCommands).toContain('pnpm install');
      expect(result.installCommands).toContain('pip install -r requirements.txt');
      expect(result.installCommands).toContain('cargo build');
    });

    it('should handle legacy PHP/Composer project migration to Node.js', async () => {
      const projectPath = '/projects/php-to-node-migration';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('composer.json');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;

        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'migrating-app',
            version: '0.1.0',
            description: 'Migrating from PHP to Node.js',
            scripts: {
              start: 'node server.js',
              migrate: 'node scripts/migrate-from-php.js'
            },
            dependencies: {
              express: '^4.18.0',
              mysql2: '^3.6.0',
              'express-session': '^1.17.0'
            }
          });
        }

        // Note: composer.json won't be detected by our detector since we only handle
        // npm/yarn/pnpm, pip/poetry, and cargo. This simulates a real migration scenario.
        return '{}';
      });

      const result = await detector.detectPackageManagers(projectPath);

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(1);
      expect(result.primaryManager?.type).toBe('npm');

      // Should only detect Node.js package manager during migration
      const installCommand = await getProjectInstallCommand(projectPath);
      expect(installCommand).toBe('npm install');
    });
  });

  // ============================================================================
  // CI/CD Pipeline Scenarios
  // ============================================================================

  describe('CI/CD Pipeline Scenarios', () => {
    it('should provide reliable detection for automated builds', async () => {
      const projects = [
        { path: '/ci/frontend-app', type: 'yarn' as PackageManagerType },
        { path: '/ci/backend-service', type: 'poetry' as PackageManagerType },
        { path: '/ci/rust-cli', type: 'cargo' as PackageManagerType },
        { path: '/ci/npm-package', type: 'npm' as PackageManagerType },
        { path: '/ci/monorepo', type: 'pnpm' as PackageManagerType }
      ];

      // Setup different project types
      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;

        if (filePath.includes('frontend-app')) {
          return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
        }
        if (filePath.includes('backend-service')) {
          return filePath.endsWith('pyproject.toml');
        }
        if (filePath.includes('rust-cli')) {
          return filePath.endsWith('Cargo.toml');
        }
        if (filePath.includes('npm-package')) {
          return filePath.endsWith('package.json');
        }
        if (filePath.includes('monorepo')) {
          return filePath.endsWith('package.json') || filePath.endsWith('pnpm-lock.yaml');
        }

        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;

        if (filePath.includes('frontend-app') && filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'frontend-app', version: '1.0.0' });
        }
        if (filePath.includes('backend-service')) {
          return '[tool.poetry]\nname = "backend-service"\nversion = "1.0.0"';
        }
        if (filePath.includes('rust-cli')) {
          return '[package]\nname = "rust-cli"\nversion = "0.1.0"';
        }
        if (filePath.includes('npm-package') && filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'npm-package', version: '1.0.0' });
        }
        if (filePath.includes('monorepo') && filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'monorepo', version: '1.0.0' });
        }

        return '';
      });

      // Test parallel detection (simulating CI/CD parallel builds)
      const results = await Promise.all(
        projects.map(async project => ({
          ...project,
          result: await detector.detectPackageManagers(project.path)
        }))
      );

      // Verify all detections are correct
      for (const { type, result } of results) {
        expect(result.hasPackageManagers).toBe(true);
        expect(result.primaryManager?.type).toBe(type);
      }

      // Verify install commands are appropriate for CI/CD
      const commands = await Promise.all(
        projects.map(p => getProjectInstallCommand(p.path))
      );

      expect(commands).toEqual([
        'yarn install',
        'poetry install',
        'cargo build',
        'npm install',
        'pnpm install'
      ]);
    });

    it('should handle build environment variations', async () => {
      const projectPath = '/ci/environment-test';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'ci-test-app',
        version: '1.0.0',
        engines: {
          node: '>=18.0.0',
          npm: '>=8.0.0'
        },
        scripts: {
          'ci': 'npm ci',
          'build': 'npm run build:prod',
          'test:ci': 'jest --ci --coverage'
        }
      }));

      // Test multiple detection calls (simulating different CI jobs)
      const results = await Promise.all([
        detector.detectPackageManagers(projectPath),
        detector.detectPackageManagers(projectPath),
        detector.detectPackageManagers(projectPath)
      ]);

      // All results should be identical and stable
      expect(results.every(r => r.hasPackageManagers)).toBe(true);
      expect(results.every(r => r.primaryManager?.type === 'yarn')).toBe(true);

      // Results should be deep equal (caching working correctly)
      expect(JSON.stringify(results[0])).toBe(JSON.stringify(results[1]));
      expect(JSON.stringify(results[1])).toBe(JSON.stringify(results[2]));
    });
  });

  // ============================================================================
  // Error Recovery Scenarios
  // ============================================================================

  describe('Error Recovery Scenarios', () => {
    it('should gracefully handle partial project detection failures', async () => {
      const projectPath = '/projects/problematic';

      let attemptCount = 0;
      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') ||
               filePath.endsWith('requirements.txt') ||
               filePath.endsWith('Cargo.toml');
      });

      mockReadFileSync.mockImplementation((path: string) => {
        attemptCount++;
        const filePath = path as string;

        // Simulate package.json read failure
        if (filePath.endsWith('package.json')) {
          throw new Error('Package.json read failed');
        }

        // Simulate requirements.txt success
        if (filePath.endsWith('requirements.txt')) {
          return 'requests>=2.28.0\ndjango>=4.0.0';
        }

        // Simulate Cargo.toml success
        if (filePath.endsWith('Cargo.toml')) {
          return '[package]\nname = "test"\nversion = "0.1.0"';
        }

        return '';
      });

      const result = await detector.detectPackageManagers(projectPath);

      // Should detect the working package managers despite one failure
      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers).toHaveLength(2);

      const types = result.detectedManagers.map(m => m.type);
      expect(types).toContain('pip');
      expect(types).toContain('cargo');
      expect(types).not.toContain('npm');
    });

    it('should handle filesystem race conditions gracefully', async () => {
      const projectPath = '/projects/race-condition';

      let callCount = 0;
      mockExistsSync.mockImplementation((path: string) => {
        callCount++;
        // Simulate file appearing/disappearing
        return callCount % 2 === 1;
      });

      mockReadFileSync.mockImplementation(() => {
        // Simulate file being deleted between existsSync and readFileSync
        throw new Error('ENOENT: no such file or directory');
      });

      const result = await detector.detectPackageManagers(projectPath);

      // Should handle the race condition gracefully
      expect(result.hasPackageManagers).toBe(false);
      expect(result.detectedManagers).toHaveLength(0);
    });

    it('should maintain performance during error conditions', async () => {
      const projectPaths = Array.from(
        { length: 50 },
        (_, i) => `/projects/error-prone-${i}`
      );

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        // Simulate 50% error rate
        if (Math.random() < 0.5) {
          throw new Error('Random IO error');
        }
        return '{}';
      });

      const startTime = performance.now();

      const results = await Promise.allSettled(
        projectPaths.map(path => detector.detectPackageManagers(path))
      );

      const totalTime = performance.now() - startTime;

      // Should complete in reasonable time even with errors
      expect(totalTime).toBeLessThan(100);

      // Should have a mix of successful and failed results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(0);
      expect(failed).toBeGreaterThan(0);
      expect(successful + failed).toBe(50);
    });
  });

  // ============================================================================
  // Global Convenience Functions Integration
  // ============================================================================

  describe('Global Convenience Functions Integration', () => {
    it('should provide consistent results across all API surfaces', async () => {
      const projectPath = '/projects/api-consistency';

      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        return filePath.endsWith('package.json') || filePath.endsWith('yarn.lock');
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'api-test',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' }
      }));

      // Test all API surfaces
      const [
        detectionResult,
        globalDetectionResult,
        installCommand,
        globalInstallCommand,
        hasYarn,
        globalHasYarn,
        hasNpm,
        globalHasNpm,
        allCommands,
        globalAllCommands
      ] = await Promise.all([
        detector.detectPackageManagers(projectPath),
        detectDependencies(projectPath),
        detector.getInstallCommand(projectPath),
        getProjectInstallCommand(projectPath),
        detector.hasPackageManager(projectPath, 'yarn'),
        hasProjectPackageManager(projectPath, 'yarn'),
        detector.hasPackageManager(projectPath, 'npm'),
        hasProjectPackageManager(projectPath, 'npm'),
        detector.getAllInstallCommands(projectPath),
        // Global function doesn't exist, use instance
        detector.getAllInstallCommands(projectPath)
      ]);

      // All results should be consistent
      expect(detectionResult).toEqual(globalDetectionResult);
      expect(installCommand).toBe(globalInstallCommand);
      expect(hasYarn).toBe(globalHasYarn);
      expect(hasNpm).toBe(globalHasNpm);
      expect(allCommands).toEqual(globalAllCommands);

      // Specific expectations
      expect(installCommand).toBe('yarn install');
      expect(hasYarn).toBe(true);
      expect(hasNpm).toBe(false); // Should not detect npm when yarn.lock exists
    });
  });
});