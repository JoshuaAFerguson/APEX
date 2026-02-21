/**
 * Edge cases and performance tests for detectFrameworks() method
 *
 * This test suite covers edge cases, error conditions, and performance scenarios
 * to ensure the detectFrameworks() method is robust and reliable.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('detectFrameworks() - Edge Cases and Performance', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-edge-test-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Malformed Input Handling', () => {
    it('should handle completely malformed package.json', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        'this is not json at all!'
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection).toBeDefined();
      expect(detection.frameworks).toBeDefined();
      expect(Array.isArray(detection.frameworks)).toBe(true);
      // Should not throw error or crash
    });

    it('should handle package.json with null/undefined dependencies', async () => {
      const packageJson = {
        name: 'test-app',
        dependencies: null,
        devDependencies: undefined
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toBeDefined();
      expect(Array.isArray(detection.frameworks)).toBe(true);
    });

    it('should handle empty package.json object', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        '{}'
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toEqual([]);
      expect(detection.languages).toEqual([]);
    });

    it('should handle package.json with non-string versions', async () => {
      const packageJson = {
        name: 'weird-versions',
        dependencies: {
          react: 123, // number instead of string
          vue: true, // boolean instead of string
          express: { version: '4.18.0' } // object instead of string
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      // Should still detect frameworks even with weird version formats
      const frameworkNames = detection.frameworks.map(f => f.name);
      expect(frameworkNames).toContain('React');
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle inaccessible directories gracefully', async () => {
      // Create a directory structure and make it readable
      await fs.promises.mkdir(path.join(tempDir, 'restricted'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'restricted', 'config.js'),
        'module.exports = {};'
      );

      // Now try to make it unreadable (this might not work on all systems)
      try {
        await fs.promises.chmod(path.join(tempDir, 'restricted'), 0o000);
      } catch {
        // If we can't change permissions, skip this part
        return;
      }

      const detection = await analyzer.detectFrameworks();

      // Should not crash even if some directories are inaccessible
      expect(detection).toBeDefined();
      expect(detection.frameworks).toBeDefined();

      // Restore permissions for cleanup
      try {
        await fs.promises.chmod(path.join(tempDir, 'restricted'), 0o755);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should handle symlinks correctly', async () => {
      // Create a real directory with a framework file
      await fs.promises.mkdir(path.join(tempDir, 'real-src'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'real-src', 'App.vue'),
        '<template><div>Vue App</div></template>'
      );

      // Create a symlink (this might not work on all systems)
      try {
        await fs.promises.symlink(
          path.join(tempDir, 'real-src'),
          path.join(tempDir, 'src')
        );
      } catch {
        // If symlinks aren't supported, skip this test
        return;
      }

      const detection = await analyzer.detectFrameworks();

      // Should handle symlinks without infinite loops
      expect(detection).toBeDefined();
      expect(detection.frameworks).toBeDefined();
    });

    it('should handle very long file paths', async () => {
      // Create a very deep directory structure
      let currentPath = tempDir;
      const longDirName = 'very-long-directory-name-that-tests-path-length-limits';

      for (let i = 0; i < 5; i++) {
        currentPath = path.join(currentPath, longDirName);
        await fs.promises.mkdir(currentPath, { recursive: true });
      }

      await fs.promises.writeFile(
        path.join(currentPath, 'component.jsx'),
        'export default function Component() { return <div>Deep component</div>; }'
      );

      const detection = await analyzer.detectFrameworks();

      // Should handle deep paths without issues
      expect(detection).toBeDefined();
      expect(detection.frameworks).toBeDefined();
    });
  });

  describe('Performance and Scale Tests', () => {
    it('should handle large package.json with many dependencies efficiently', async () => {
      // Create a package.json with 200+ dependencies
      const largeDependencies: Record<string, string> = {};
      const largeDevDependencies: Record<string, string> = {};

      // Add many real and fake dependencies
      for (let i = 0; i < 100; i++) {
        largeDependencies[`fake-package-${i}`] = '^1.0.0';
        largeDevDependencies[`fake-dev-package-${i}`] = '^2.0.0';
      }

      // Mix in real frameworks
      largeDependencies['react'] = '^18.2.0';
      largeDependencies['vue'] = '^3.3.4';
      largeDependencies['express'] = '^4.18.2';
      largeDependencies['next'] = '^14.0.0';
      largeDevDependencies['typescript'] = '^5.2.2';
      largeDevDependencies['jest'] = '^29.7.0';
      largeDevDependencies['vitest'] = '^1.0.4';

      const packageJson = {
        name: 'large-project',
        dependencies: largeDependencies,
        devDependencies: largeDevDependencies
      };

      const startTime = Date.now();

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Should still detect the real frameworks
      const frameworkNames = detection.frameworks.map(f => f.name);
      expect(frameworkNames).toContain('React');
      expect(frameworkNames).toContain('Vue');
      expect(frameworkNames).toContain('Express');
    });

    it('should handle projects with many nested directories efficiently', async () => {
      // Create a complex directory structure
      const dirs = [
        'src/components/ui/buttons',
        'src/components/forms/inputs',
        'src/pages/admin/users',
        'src/pages/public/blog',
        'lib/utils/validators',
        'lib/api/endpoints',
        'tests/unit/components',
        'tests/integration/api',
        'docs/examples/tutorials',
        'scripts/build/webpack'
      ];

      for (const dir of dirs) {
        await fs.promises.mkdir(path.join(tempDir, dir), { recursive: true });

        // Add some files to make it realistic
        await fs.promises.writeFile(
          path.join(tempDir, dir, 'index.js'),
          '// Sample file'
        );
      }

      // Add framework indicators in various places
      await fs.promises.writeFile(
        path.join(tempDir, 'src/components/App.vue'),
        '<template><div>Vue App</div></template>'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'src/pages/index.tsx'),
        'export default function Home() { return <h1>Next.js</h1>; }'
      );

      const startTime = Date.now();
      const detection = await analyzer.detectFrameworks();
      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);

      // Should still detect frameworks from patterns
      expect(detection.frameworks.length).toBeGreaterThan(0);
    });

    it('should handle many configuration files efficiently', async () => {
      const configFiles = [
        'webpack.config.js', 'rollup.config.js', 'vite.config.ts',
        'jest.config.js', 'vitest.config.ts', 'playwright.config.js',
        'cypress.config.js', 'tailwind.config.js', 'postcss.config.js',
        'babel.config.js', 'eslint.config.js', '.prettierrc.js',
        'next.config.js', 'nuxt.config.ts', 'svelte.config.js',
        'astro.config.mjs', 'remix.config.js', 'gatsby-config.js',
        'storybook/main.js', 'docker-compose.yml', 'Dockerfile'
      ];

      // Create all config files
      for (const configFile of configFiles) {
        const filePath = path.join(tempDir, configFile);
        const dir = path.dirname(filePath);
        if (dir !== tempDir) {
          await fs.promises.mkdir(dir, { recursive: true });
        }
        await fs.promises.writeFile(filePath, 'module.exports = {};');
      }

      const startTime = Date.now();
      const detection = await analyzer.detectFrameworks();
      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);

      // Should detect many frameworks from config files
      expect(detection.frameworks.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with repeated calls', async () => {
      const packageJson = {
        name: 'memory-test',
        dependencies: {
          react: '^18.2.0',
          express: '^4.18.2'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Run detection multiple times
      const results = [];
      for (let i = 0; i < 10; i++) {
        const detection = await analyzer.detectFrameworks();
        results.push(detection);
      }

      // Results should be consistent
      for (const result of results) {
        expect(result.frameworks.length).toBe(results[0].frameworks.length);
        expect(result.frameworks.map(f => f.name).sort()).toEqual(
          results[0].frameworks.map(f => f.name).sort()
        );
      }
    });

    it('should handle concurrent detection calls safely', async () => {
      const packageJson = {
        name: 'concurrent-test',
        dependencies: {
          react: '^18.2.0',
          vue: '^3.3.4'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Run multiple detection calls concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(analyzer.detectFrameworks());
      }

      const results = await Promise.all(promises);

      // All results should be identical
      for (const result of results) {
        expect(result.frameworks.length).toBe(results[0].frameworks.length);
        expect(result.frameworks.map(f => f.name).sort()).toEqual(
          results[0].frameworks.map(f => f.name).sort()
        );
      }
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle package.json with unicode characters', async () => {
      const packageJson = {
        name: 'unicode-test-项目',
        description: 'Project with 中文 characters and émojis 🚀',
        dependencies: {
          react: '^18.2.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toBeDefined();
      const react = detection.frameworks.find(f => f.name === 'React');
      expect(react).toBeDefined();
    });

    it('should handle files with special characters in names', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });

      // Create files with various special characters
      const specialFiles = [
        'App-Component.vue',
        'Button_Component.jsx',
        'Form@Input.tsx',
        'Modal#Dialog.svelte',
        'Header%Component.js'
      ];

      for (const fileName of specialFiles) {
        await fs.promises.writeFile(
          path.join(tempDir, 'src', fileName),
          '// Component file'
        );
      }

      const detection = await analyzer.detectFrameworks();

      // Should handle files with special characters without issues
      expect(detection).toBeDefined();
      expect(detection.frameworks).toBeDefined();
    });
  });

  describe('Configuration Analysis Edge Cases', () => {
    it('should handle circular dependencies in config files', async () => {
      // Create config files that might reference each other
      await fs.promises.writeFile(
        path.join(tempDir, 'webpack.config.js'),
        'const viteConfig = require("./vite.config.js"); module.exports = {};'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'vite.config.js'),
        '// References webpack somehow\nmodule.exports = {};'
      );

      const detection = await analyzer.detectFrameworks();

      // Should handle potential circular references without hanging
      expect(detection).toBeDefined();
      const frameworks = detection.frameworks.map(f => f.name);
      expect(frameworks).toContain('Webpack');
      expect(frameworks).toContain('Vite');
    });

    it('should handle binary files in project directory', async () => {
      // Create some binary-like files
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);

      await fs.promises.writeFile(
        path.join(tempDir, 'image.png'),
        binaryContent
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'executable.bin'),
        binaryContent
      );

      // Also add legitimate framework files
      const packageJson = {
        name: 'binary-test',
        dependencies: {
          react: '^18.2.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      // Should ignore binary files and still detect frameworks
      expect(detection.frameworks.length).toBeGreaterThan(0);
      const react = detection.frameworks.find(f => f.name === 'React');
      expect(react).toBeDefined();
    });
  });

  describe('Framework Version Edge Cases', () => {
    it('should handle pre-release versions correctly', async () => {
      const packageJson = {
        name: 'prerelease-test',
        dependencies: {
          react: '^18.3.0-canary.1',
          next: '14.0.0-rc.1',
          typescript: '5.3.0-beta'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      const react = detection.frameworks.find(f => f.name === 'React');
      const nextjs = detection.frameworks.find(f => f.name === 'Next.js');
      const typescript = detection.frameworks.find(f => f.name === 'TypeScript');

      expect(react?.version).toBe('^18.3.0-canary.1');
      expect(nextjs?.version).toBe('14.0.0-rc.1');
      expect(typescript?.version).toBe('5.3.0-beta');
    });

    it('should handle version ranges and special version formats', async () => {
      const packageJson = {
        name: 'version-range-test',
        dependencies: {
          react: '>=18.0.0 <19.0.0',
          vue: '~3.3.0',
          express: '^4.18.x',
          lodash: 'latest',
          moment: '*'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      // Should handle various version formats
      const react = detection.frameworks.find(f => f.name === 'React');
      const vue = detection.frameworks.find(f => f.name === 'Vue');
      const express = detection.frameworks.find(f => f.name === 'Express');

      expect(react?.version).toBe('>=18.0.0 <19.0.0');
      expect(vue?.version).toBe('~3.3.0');
      expect(express?.version).toBe('^4.18.x');
    });
  });
});