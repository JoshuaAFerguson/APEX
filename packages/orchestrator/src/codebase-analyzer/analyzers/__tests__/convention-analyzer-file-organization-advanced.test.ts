/**
 * ConventionAnalyzer File Organization Pattern Detection - Advanced Tests
 *
 * Tests advanced file organization patterns, edge cases, and complex project structures
 * to ensure comprehensive coverage of the organization analysis feature.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Advanced File Organization Patterns', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-org-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complex Test Location Patterns', () => {
    it('should handle nested __tests__ directories at multiple levels', async () => {
      const srcDir = join(testDir, 'src');
      const componentDir = join(srcDir, 'components');
      const utilsDir = join(srcDir, 'utils');
      const componentTestsDir = join(componentDir, '__tests__');
      const utilsTestsDir = join(utilsDir, '__tests__');

      await fs.mkdir(componentTestsDir, { recursive: true });
      await fs.mkdir(utilsTestsDir, { recursive: true });

      // Source files
      await fs.writeFile(join(componentDir, 'Button.jsx'), 'export const Button = () => {};');
      await fs.writeFile(join(componentDir, 'Modal.tsx'), 'export const Modal = () => {};');
      await fs.writeFile(join(utilsDir, 'helpers.js'), 'export function helper() {}');
      await fs.writeFile(join(utilsDir, 'constants.ts'), 'export const API_URL = "test";');

      // Test files in nested __tests__ directories
      await fs.writeFile(join(componentTestsDir, 'Button.test.jsx'), 'test("Button", () => {});');
      await fs.writeFile(join(componentTestsDir, 'Modal.test.tsx'), 'test("Modal", () => {});');
      await fs.writeFile(join(utilsTestsDir, 'helpers.test.js'), 'test("helpers", () => {});');
      await fs.writeFile(join(utilsTestsDir, 'constants.test.ts'), 'test("constants", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-__tests__');
      expect(result.organization?.sourceStructure).toBe('src');
    });

    it('should detect parallel test directory structures', async () => {
      const srcDir = join(testDir, 'src');
      const testDir2 = join(testDir, 'test');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testDir2, { recursive: true });

      // Mirror the src structure in test directory
      await fs.writeFile(join(srcDir, 'auth.js'), 'export class Auth {}');
      await fs.writeFile(join(srcDir, 'user.js'), 'export class User {}');
      await fs.writeFile(join(srcDir, 'api.js'), 'export class API {}');

      // Parallel test structure
      await fs.writeFile(join(testDir2, 'auth.test.js'), 'test("Auth", () => {});');
      await fs.writeFile(join(testDir2, 'user.test.js'), 'test("User", () => {});');
      await fs.writeFile(join(testDir2, 'api.test.js'), 'test("API", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-tests');
    });

    it('should handle test files in subdirectories of __tests__', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(srcDir, '__tests__');
      const unitTestsDir = join(testsDir, 'unit');
      const integrationTestsDir = join(testsDir, 'integration');

      await fs.mkdir(unitTestsDir, { recursive: true });
      await fs.mkdir(integrationTestsDir, { recursive: true });

      // Source files
      await fs.writeFile(join(srcDir, 'service.js'), 'export class Service {}');
      await fs.writeFile(join(srcDir, 'model.js'), 'export class Model {}');

      // Test files in subcategories
      await fs.writeFile(join(unitTestsDir, 'service.test.js'), 'test("Service unit", () => {});');
      await fs.writeFile(join(unitTestsDir, 'model.test.js'), 'test("Model unit", () => {});');
      await fs.writeFile(join(integrationTestsDir, 'service-integration.test.js'), 'test("Service integration", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-__tests__');
    });

    it('should handle complex mixed patterns with different conventions per module', async () => {
      const moduleADir = join(testDir, 'moduleA');
      const moduleBDir = join(testDir, 'moduleB');
      const moduleCDir = join(testDir, 'moduleC');

      await fs.mkdir(moduleADir, { recursive: true });
      await fs.mkdir(moduleBDir, { recursive: true });
      await fs.mkdir(moduleCDir, { recursive: true });

      // Module A: colocated tests
      await fs.writeFile(join(moduleADir, 'feature.js'), 'export function feature() {}');
      await fs.writeFile(join(moduleADir, 'feature.test.js'), 'test("feature", () => {});');

      // Module B: __tests__ directory
      const testsBDir = join(moduleBDir, '__tests__');
      await fs.mkdir(testsBDir, { recursive: true });
      await fs.writeFile(join(moduleBDir, 'service.js'), 'export class Service {}');
      await fs.writeFile(join(testsBDir, 'service.test.js'), 'test("service", () => {});');

      // Module C: separate tests directory
      const testsCDir = join(testDir, 'tests', 'moduleC');
      await fs.mkdir(testsCDir, { recursive: true });
      await fs.writeFile(join(moduleCDir, 'util.js'), 'export function util() {}');
      await fs.writeFile(join(testsCDir, 'util.test.js'), 'test("util", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
    });
  });

  describe('Advanced Test Naming Patterns', () => {
    it('should detect language-specific test naming conventions', async () => {
      const javaDir = join(testDir, 'java');
      const pythonDir = join(testDir, 'python');
      const goDir = join(testDir, 'go');

      await fs.mkdir(javaDir, { recursive: true });
      await fs.mkdir(pythonDir, { recursive: true });
      await fs.mkdir(goDir, { recursive: true });

      // Java Test suffix convention
      await fs.writeFile(join(javaDir, 'UserServiceTest.java'), 'public class UserServiceTest {}');
      await fs.writeFile(join(javaDir, 'AuthServiceTest.java'), 'public class AuthServiceTest {}');
      await fs.writeFile(join(javaDir, 'PaymentServiceTest.java'), 'public class PaymentServiceTest {}');

      // Python test_ prefix convention
      await fs.writeFile(join(pythonDir, 'test_user_service.py'), 'def test_user_creation(): pass');
      await fs.writeFile(join(pythonDir, 'test_auth_service.py'), 'def test_login(): pass');

      // Go _test.go suffix convention
      await fs.writeFile(join(goDir, 'user_service_test.go'), 'func TestUserService(t *testing.T) {}');
      await fs.writeFile(join(goDir, 'auth_service_test.go'), 'func TestAuth(t *testing.T) {}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should detect mixed since we have different conventions across languages
      expect(['mixed', 'suffix-Test', 'prefix-test-', 'suffix-.test']).toContain(result.organization?.testNaming);
    });

    it('should handle test files with multiple extensions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Various test file extensions
      await fs.writeFile(join(srcDir, 'component.spec.js'), 'describe("component", () => {});');
      await fs.writeFile(join(srcDir, 'service.spec.ts'), 'describe("service", () => {});');
      await fs.writeFile(join(srcDir, 'utils.spec.jsx'), 'describe("utils", () => {});');
      await fs.writeFile(join(srcDir, 'api.spec.tsx'), 'describe("api", () => {});');
      await fs.writeFile(join(srcDir, 'auth.spec.vue'), 'describe("auth", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testNaming).toBe('suffix-.spec');
    });

    it('should detect custom test naming patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Mixed but consistent pattern within each type
      await fs.writeFile(join(srcDir, 'component.test.js'), 'test("component", () => {});');
      await fs.writeFile(join(srcDir, 'service.test.ts'), 'test("service", () => {});');
      await fs.writeFile(join(srcDir, 'utils.test.jsx'), 'test("utils", () => {});');
      await fs.writeFile(join(srcDir, 'UserControllerTest.java'), 'public class UserControllerTest {}');
      await fs.writeFile(join(srcDir, 'AuthControllerTest.java'), 'public class AuthControllerTest {}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testNaming).toBe('mixed');
    });
  });

  describe('Advanced Source Structure Patterns', () => {
    it('should handle monorepo structures with multiple source directories', async () => {
      const packagesDir = join(testDir, 'packages');
      const appsDir = join(testDir, 'apps');

      // Package with src structure
      const package1Dir = join(packagesDir, 'package1', 'src');
      await fs.mkdir(package1Dir, { recursive: true });
      await fs.writeFile(join(package1Dir, 'index.ts'), 'export * from "./lib";');
      await fs.writeFile(join(package1Dir, 'lib.ts'), 'export function lib() {}');

      // Package with lib structure
      const package2Dir = join(packagesDir, 'package2', 'lib');
      await fs.mkdir(package2Dir, { recursive: true });
      await fs.writeFile(join(package2Dir, 'index.js'), 'module.exports = {};');
      await fs.writeFile(join(package2Dir, 'utils.js'), 'exports.util = () => {};');

      // App with app structure
      const app1Dir = join(appsDir, 'app1', 'app');
      await fs.mkdir(app1Dir, { recursive: true });
      await fs.writeFile(join(app1Dir, 'page.tsx'), 'export default function Page() {}');
      await fs.writeFile(join(app1Dir, 'layout.tsx'), 'export default function Layout() {}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.sourceStructure).toBe('mixed');
    });

    it('should detect nested source directory patterns', async () => {
      const clientSrcDir = join(testDir, 'client', 'src');
      const serverSrcDir = join(testDir, 'server', 'src');
      const sharedLibDir = join(testDir, 'shared', 'lib');

      await fs.mkdir(clientSrcDir, { recursive: true });
      await fs.mkdir(serverSrcDir, { recursive: true });
      await fs.mkdir(sharedLibDir, { recursive: true });

      // Client source files
      await fs.writeFile(join(clientSrcDir, 'components', 'App.tsx'), 'export const App = () => {};');
      await fs.writeFile(join(clientSrcDir, 'hooks', 'useAuth.ts'), 'export const useAuth = () => {};');
      await fs.mkdir(join(clientSrcDir, 'components'), { recursive: true });
      await fs.mkdir(join(clientSrcDir, 'hooks'), { recursive: true });
      await fs.writeFile(join(clientSrcDir, 'components', 'App.tsx'), 'export const App = () => {};');
      await fs.writeFile(join(clientSrcDir, 'hooks', 'useAuth.ts'), 'export const useAuth = () => {};');

      // Server source files
      await fs.writeFile(join(serverSrcDir, 'routes', 'api.ts'), 'export const router = {};');
      await fs.writeFile(join(serverSrcDir, 'middleware', 'auth.ts'), 'export const auth = {};');
      await fs.mkdir(join(serverSrcDir, 'routes'), { recursive: true });
      await fs.mkdir(join(serverSrcDir, 'middleware'), { recursive: true });
      await fs.writeFile(join(serverSrcDir, 'routes', 'api.ts'), 'export const router = {};');
      await fs.writeFile(join(serverSrcDir, 'middleware', 'auth.ts'), 'export const auth = {};');

      // Shared lib files
      await fs.writeFile(join(sharedLibDir, 'types.ts'), 'export interface User {}');
      await fs.writeFile(join(sharedLibDir, 'utils.ts'), 'export function utils() {}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['src', 'mixed']).toContain(result.organization?.sourceStructure);
    });

    it('should handle unconventional source directory names', async () => {
      const sourceDir = join(testDir, 'source');
      const sourcesDir = join(testDir, 'sources');
      const libsDir = join(testDir, 'libs');
      const appsDir = join(testDir, 'apps');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(sourcesDir, { recursive: true });
      await fs.mkdir(libsDir, { recursive: true });
      await fs.mkdir(appsDir, { recursive: true });

      await fs.writeFile(join(sourceDir, 'main.cpp'), 'int main() { return 0; }');
      await fs.writeFile(join(sourcesDir, 'helper.c'), 'void helper() {}');
      await fs.writeFile(join(libsDir, 'lib1.js'), 'module.exports = {};');
      await fs.writeFile(join(appsDir, 'app1.py'), 'def main(): pass');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'source', 'lib', 'app']).toContain(result.organization?.sourceStructure);
    });
  });

  describe('Configuration File Organization Edge Cases', () => {
    it('should handle configuration files in hidden directories', async () => {
      const configDir = join(testDir, '.config');
      const githubDir = join(testDir, '.github');
      const vscodeDir = join(testDir, '.vscode');

      await fs.mkdir(configDir, { recursive: true });
      await fs.mkdir(githubDir, { recursive: true });
      await fs.mkdir(vscodeDir, { recursive: true });

      // Config directory
      await fs.writeFile(join(configDir, 'jest.config.js'), 'module.exports = {};');
      await fs.writeFile(join(configDir, 'webpack.config.js'), 'module.exports = {};');

      // GitHub workflows (still config files)
      await fs.writeFile(join(githubDir, 'workflows', 'ci.yml'), 'name: CI');
      await fs.mkdir(join(githubDir, 'workflows'), { recursive: true });
      await fs.writeFile(join(githubDir, 'workflows', 'ci.yml'), 'name: CI');

      // VSCode settings
      await fs.writeFile(join(vscodeDir, 'settings.json'), '{}');

      // Root configs
      await fs.writeFile(join(testDir, 'package.json'), '{"name": "test"}');
      await fs.writeFile(join(testDir, 'tsconfig.json'), '{}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'config-dir', 'root']).toContain(result.organization?.configLocation);
    });

    it('should detect configuration files with various naming patterns', async () => {
      const rootConfigs = [
        'babel.config.js',
        'babel.config.json',
        '.babelrc',
        '.babelrc.js',
        'rollup.config.js',
        'rollup.config.ts',
        'vite.config.js',
        'vite.config.ts',
        'vitest.config.js',
        'jest.config.js',
        'jest.config.json',
        'webpack.config.js',
        'webpack.prod.config.js',
        'webpack.dev.config.js',
        '.eslintrc.js',
        '.eslintrc.json',
        '.prettierrc',
        '.prettierrc.json',
        'tailwind.config.js',
        'postcss.config.js'
      ];

      for (const config of rootConfigs) {
        await fs.writeFile(join(testDir, config), 'module.exports = {};');
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.configLocation).toBe('root');
    });

    it('should handle projects with only source files and no config files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'index.js'), 'console.log("hello");');
      await fs.writeFile(join(srcDir, 'utils.js'), 'export function util() {}');
      await fs.writeFile(join(srcDir, 'components.jsx'), 'export const Component = () => {};');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.configLocation).toBeUndefined();
      expect(result.organization?.sourceStructure).toBe('src');
    });
  });

  describe('Language-Specific Organization Patterns', () => {
    it('should handle Python project structures', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(testDir, 'tests');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      // Python source files
      await fs.writeFile(join(srcDir, '__init__.py'), '');
      await fs.writeFile(join(srcDir, 'main.py'), 'def main(): pass');
      await fs.writeFile(join(srcDir, 'utils.py'), 'def helper(): pass');
      await fs.writeFile(join(srcDir, 'models', '__init__.py'), '');
      await fs.writeFile(join(srcDir, 'models', 'user.py'), 'class User: pass');
      await fs.mkdir(join(srcDir, 'models'), { recursive: true });
      await fs.writeFile(join(srcDir, 'models', '__init__.py'), '');
      await fs.writeFile(join(srcDir, 'models', 'user.py'), 'class User: pass');

      // Python test files
      await fs.writeFile(join(testsDir, '__init__.py'), '');
      await fs.writeFile(join(testsDir, 'test_main.py'), 'def test_main(): pass');
      await fs.writeFile(join(testsDir, 'test_utils.py'), 'def test_helper(): pass');
      await fs.writeFile(join(testsDir, 'test_models', '__init__.py'), '');
      await fs.writeFile(join(testsDir, 'test_models', 'test_user.py'), 'def test_user(): pass');
      await fs.mkdir(join(testsDir, 'test_models'), { recursive: true });
      await fs.writeFile(join(testsDir, 'test_models', '__init__.py'), '');
      await fs.writeFile(join(testsDir, 'test_models', 'test_user.py'), 'def test_user(): pass');

      // Python config files
      await fs.writeFile(join(testDir, 'setup.py'), 'from setuptools import setup');
      await fs.writeFile(join(testDir, 'requirements.txt'), 'flask==2.0.0');
      await fs.writeFile(join(testDir, 'pyproject.toml'), '[tool.poetry]');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.testNaming).toBe('prefix-test-');
      expect(result.organization?.configLocation).toBe('root');
    });

    it('should handle Rust project structures', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(testDir, 'tests');
      const benchesDir = join(testDir, 'benches');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(benchesDir, { recursive: true });

      // Rust source files
      await fs.writeFile(join(srcDir, 'main.rs'), 'fn main() {}');
      await fs.writeFile(join(srcDir, 'lib.rs'), 'pub mod utils;');
      await fs.writeFile(join(srcDir, 'utils.rs'), 'pub fn helper() {}');

      // Rust test files
      await fs.writeFile(join(testsDir, 'integration_test.rs'), '#[test] fn test_integration() {}');
      await fs.writeFile(join(testsDir, 'common', 'mod.rs'), 'pub fn setup() {}');
      await fs.mkdir(join(testsDir, 'common'), { recursive: true });
      await fs.writeFile(join(testsDir, 'common', 'mod.rs'), 'pub fn setup() {}');

      // Rust benchmark files
      await fs.writeFile(join(benchesDir, 'bench.rs'), 'fn bench_function() {}');

      // Rust config files
      await fs.writeFile(join(testDir, 'Cargo.toml'), '[package]');
      await fs.writeFile(join(testDir, 'Cargo.lock'), '# Lock file');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.configLocation).toBe('root');
    });

    it('should handle Go project structures', async () => {
      const cmdDir = join(testDir, 'cmd', 'myapp');
      const pkgDir = join(testDir, 'pkg', 'utils');
      const internalDir = join(testDir, 'internal', 'server');

      await fs.mkdir(cmdDir, { recursive: true });
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.mkdir(internalDir, { recursive: true });

      // Go source files
      await fs.writeFile(join(cmdDir, 'main.go'), 'package main\nfunc main() {}');
      await fs.writeFile(join(pkgDir, 'utils.go'), 'package utils\nfunc Helper() {}');
      await fs.writeFile(join(pkgDir, 'utils_test.go'), 'package utils\nfunc TestHelper(t *testing.T) {}');
      await fs.writeFile(join(internalDir, 'server.go'), 'package server\ntype Server struct{}');
      await fs.writeFile(join(internalDir, 'server_test.go'), 'package server\nfunc TestServer(t *testing.T) {}');

      // Go config files
      await fs.writeFile(join(testDir, 'go.mod'), 'module myapp');
      await fs.writeFile(join(testDir, 'go.sum'), '');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test'); // Go uses _test.go
      expect(result.organization?.sourceStructure).toBe('mixed'); // Go has its own structure
      expect(result.organization?.configLocation).toBe('root');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle symlinked directories gracefully', async () => {
      const srcDir = join(testDir, 'src');
      const realTestDir = join(testDir, 'real-tests');
      const symlinkTestDir = join(testDir, 'tests');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(realTestDir, { recursive: true });

      // Create source files
      await fs.writeFile(join(srcDir, 'utils.js'), 'export function util() {}');

      // Create test files in real directory
      await fs.writeFile(join(realTestDir, 'utils.test.js'), 'test("utils", () => {});');

      // Create symlink to test directory
      try {
        await fs.symlink(realTestDir, symlinkTestDir, 'dir');
      } catch (error) {
        // Skip test if symlinks are not supported on this system
        return;
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-tests');
    });

    it('should handle very deep directory structures', async () => {
      let currentDir = testDir;
      const deepPath = ['very', 'deep', 'nested', 'directory', 'structure', 'with', 'many', 'levels'];

      for (const segment of deepPath) {
        currentDir = join(currentDir, segment);
        await fs.mkdir(currentDir, { recursive: true });
      }

      const srcDir = join(currentDir, 'src');
      const testsDir = join(currentDir, '__tests__');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'deep-component.js'), 'export const Component = () => {};');
      await fs.writeFile(join(testsDir, 'deep-component.test.js'), 'test("deep", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-__tests__');
    });

    it('should handle empty directories gracefully', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(testDir, 'tests');
      const configDir = join(testDir, 'config');

      // Create empty directories
      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
      expect(result.organization?.testNaming).toBe('mixed');
      expect(result.organization?.sourceStructure).toBe('mixed');
      expect(result.organization?.configLocation).toBeUndefined();
    });

    it('should handle files with unusual permissions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'normal.js'), 'export const normal = true;');
      await fs.writeFile(join(srcDir, 'normal.test.js'), 'test("normal", () => {});');

      // Create a file with restricted permissions (if possible on this system)
      const restrictedFile = join(srcDir, 'restricted.js');
      await fs.writeFile(restrictedFile, 'export const restricted = true;');

      try {
        await fs.chmod(restrictedFile, 0o000); // No permissions
      } catch (error) {
        // Skip if chmod is not supported
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');

      // Cleanup: restore permissions for deletion
      try {
        await fs.chmod(restrictedFile, 0o644);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle projects with many files efficiently', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(testDir, '__tests__');
      const componentsDir = join(srcDir, 'components');
      const utilsDir = join(srcDir, 'utils');
      const servicesDir = join(srcDir, 'services');

      await fs.mkdir(componentsDir, { recursive: true });
      await fs.mkdir(utilsDir, { recursive: true });
      await fs.mkdir(servicesDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      // Create many source files
      const fileTypes = ['components', 'utils', 'services'];
      const fileCount = 50;

      for (const type of fileTypes) {
        const typeDir = join(srcDir, type);
        for (let i = 0; i < fileCount; i++) {
          await fs.writeFile(
            join(typeDir, `${type}-${i}.ts`),
            `export const ${type}${i} = () => {};`
          );
        }
      }

      // Create corresponding test files
      for (const type of fileTypes) {
        for (let i = 0; i < fileCount; i++) {
          await fs.writeFile(
            join(testsDir, `${type}-${i}.test.ts`),
            `import { ${type}${i} } from "../${type}/${type}-${i}"; test("${type}${i}", () => {});`
          );
        }
      }

      // Add config files
      await fs.writeFile(join(testDir, 'package.json'), '{"name": "large-project"}');
      await fs.writeFile(join(testDir, 'tsconfig.json'), '{}');

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const duration = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-__tests__');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');

      // Should complete within reasonable time (5 seconds max)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle projects with deeply nested file structures', async () => {
      let currentSrcDir = join(testDir, 'src');
      let currentTestDir = join(testDir, '__tests__');

      // Create nested structure (10 levels deep)
      for (let level = 0; level < 10; level++) {
        const levelDir = `level-${level}`;
        currentSrcDir = join(currentSrcDir, levelDir);
        currentTestDir = join(currentTestDir, levelDir);

        await fs.mkdir(currentSrcDir, { recursive: true });
        await fs.mkdir(currentTestDir, { recursive: true });

        // Add files at each level
        await fs.writeFile(
          join(currentSrcDir, `module-${level}.js`),
          `export const module${level} = ${level};`
        );
        await fs.writeFile(
          join(currentTestDir, `module-${level}.test.js`),
          `test("module${level}", () => { expect(${level}).toBe(${level}); });`
        );
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-__tests__');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
    });
  });

  describe('Integration with Other Convention Analysis', () => {
    it('should maintain organization analysis quality when combined with other convention types', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(srcDir, '__tests__');

      await fs.mkdir(testsDir, { recursive: true });

      // Create a file with multiple convention aspects
      const complexCode = `
/**
 * Complex module demonstrating multiple conventions
 * @author Test Developer
 * @since 1.0.0
 */
import { logger } from './utils/logger.js';
import type { User, Config } from './types.js';

const MAX_USERS = 1000;
let currentUserCount = 0;

/**
 * User management service
 * @class UserService
 * @public
 */
export class UserService {
  private readonly configData: Config;

  constructor(config: Config) {
    this.configData = config;
  }

  /**
   * Creates a new user
   * @param userData - User creation data
   * @returns Promise resolving to created user
   * @throws {Error} When user limit exceeded
   */
  async createUser(userData: Partial<User>): Promise<User> {
    if (currentUserCount >= MAX_USERS) {
      throw new Error('User limit exceeded');
    }

    const newUser: User = {
      id: this.generateUserId(),
      name: userData.name || 'Anonymous',
      email: userData.email || '',
      createdAt: new Date(),
      isActive: true
    };

    currentUserCount++;
    logger.info(\`Created user: \${newUser.id}\`);

    return newUser;
  }

  /**
   * Generates unique user ID
   * @private
   */
  private generateUserId(): string {
    return \`user-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  // Helper method for validation
  private validateUserData(data: Partial<User>): boolean {
    return data.name !== undefined && data.name.length > 0;
  }
}

interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
}

type UserRole = 'admin' | 'user' | 'guest';

export const defaultConfig: Config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
`;

      const testCode = `
/**
 * Comprehensive tests for UserService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserService } from '../UserService.js';
import type { Config, User } from '../types.js';

describe('UserService', () => {
  let userService: UserService;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      apiUrl: 'https://test-api.example.com',
      timeout: 1000,
      retries: 1
    };
    userService = new UserService(mockConfig);
  });

  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const result = await userService.createUser(userData);

      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.id).toMatch(/^user-\\d+-[a-z0-9]{9}$/);
      expect(result.isActive).toBe(true);
    });

    it('should handle invalid user data gracefully', async () => {
      const invalidUserData = {};

      const result = await userService.createUser(invalidUserData);

      expect(result.name).toBe('Anonymous');
      expect(result.email).toBe('');
    });
  });
});
`;

      await fs.writeFile(join(srcDir, 'UserService.ts'), complexCode);
      await fs.writeFile(join(testsDir, 'UserService.test.ts'), testCode);
      await fs.writeFile(join(testDir, 'package.json'), '{"name": "complex-project"}');
      await fs.writeFile(join(testDir, 'jest.config.js'), 'module.exports = {};');
      await fs.writeFile(join(testDir, 'tsconfig.json'), '{"compilerOptions": {"target": "ES2020"}}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify organization analysis
      expect(result.organization?.testLocation).toBe('separate-__tests__');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');

      // Verify other convention types are also analyzed
      expect(result.fileNaming).toBeDefined();
      expect(result.functionNaming).toBeDefined();
      expect(result.variableNaming).toBeDefined();
      expect(result.classNaming).toBeDefined();
      expect(result.indentation).toBeDefined();
      expect(result.imports).toBeDefined();
      expect(result.documentation).toBeDefined();
      expect(result.formatting).toBeDefined();

      // Verify the analysis is coherent
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(70);
    });
  });
});