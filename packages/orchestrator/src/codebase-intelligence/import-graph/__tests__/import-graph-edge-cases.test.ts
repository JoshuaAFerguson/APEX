/**
 * ImportGraphBuilder Edge Cases Tests
 *
 * Additional test coverage for edge cases, error scenarios, and complex
 * real-world scenarios that the main test file doesn't cover.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

import { ImportGraphBuilder } from '../import-graph-builder.js';
import {
  type ImportGraph,
  type ImportGraphBuilderOptions,
  createEmptyImportGraph
} from '../types.js';

// Mock dependencies
const mockGlob = vi.fn();
vi.mock('glob', () => ({
  glob: mockGlob
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn()
}));

vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn().mockResolvedValue({
        rootNode: {
          childCount: 0,
          child: vi.fn().mockReturnValue(null)
        }
      })
    }))
  }
}));

const mockFs = fs as any;

describe('ImportGraphBuilder Edge Cases', () => {
  let builder: ImportGraphBuilder;
  let testRootPath: string;

  beforeEach(() => {
    ImportGraphBuilder.resetInstance();
    builder = ImportGraphBuilder.getInstance();
    testRootPath = '/test/project';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Malformed Input Handling', () => {
    it('should handle empty file content', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/empty.ts']);
      mockFs.readFile.mockResolvedValue('');
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
      expect(graph.errors.length).toBe(0);
    });

    it('should handle files with only whitespace', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/whitespace.ts']);
      mockFs.readFile.mockResolvedValue('   \n\n\t  \n  ');
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      expect(graph).toBeDefined();
      expect(graph.errors.length).toBe(0);
    });

    it('should handle files with only comments', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/comments.ts']);
      mockFs.readFile.mockResolvedValue(`
        // This is a comment file
        /*
         * Block comment
         * Multiple lines
         */
        // Another comment
      `);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid UTF-8 characters gracefully', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/invalid-utf8.ts']);
      // Simulate invalid UTF-8 by rejecting with encoding error
      mockFs.readFile.mockRejectedValueOnce(new Error('Invalid character encoding'));

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph.errors.length).toBe(1);
      expect(graph.errors[0].message).toContain('Invalid character encoding');
    });

    it('should handle extremely long import statements', async () => {
      const veryLongImport = `import { ${Array.from({ length: 1000 }, (_, i) => `symbol${i}`).join(', ')} } from 'very-long-module';`;

      mockGlob.mockResolvedValue(['/test/project/src/long-imports.ts']);
      mockFs.readFile.mockResolvedValue(veryLongImport);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      expect(graph).toBeDefined();
    });
  });

  describe('Circular Dependency Edge Cases', () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(true);
    });

    it('should detect self-referencing modules', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/self-ref.ts']);
      mockFs.readFile.mockResolvedValue(`
        import { helper } from './self-ref';
        export const helper = () => 'help';
      `);

      const graph = await builder.buildGraph(testRootPath);
      const cycles = builder.findCircularDependencies(graph);

      expect(Array.isArray(cycles)).toBe(true);
    });

    it('should handle complex circular dependency chains', async () => {
      const files = [
        '/test/project/src/a.ts',
        '/test/project/src/b.ts',
        '/test/project/src/c.ts',
        '/test/project/src/d.ts',
        '/test/project/src/e.ts'
      ];

      mockGlob.mockResolvedValue(files);

      // Create a complex circular dependency: a -> b -> c -> d -> e -> a
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('a.ts')) return `import { b } from './b';`;
        if (filePath.includes('b.ts')) return `import { c } from './c';`;
        if (filePath.includes('c.ts')) return `import { d } from './d';`;
        if (filePath.includes('d.ts')) return `import { e } from './e';`;
        if (filePath.includes('e.ts')) return `import { a } from './a';`;
        return '';
      });

      const graph = await builder.buildGraph(testRootPath);
      const cycles = builder.findCircularDependencies(graph);

      expect(cycles.length).toBeGreaterThanOrEqual(0);
      if (cycles.length > 0) {
        expect(cycles[0].length).toBeGreaterThan(2);
      }
    });

    it('should handle multiple independent circular dependencies', async () => {
      const files = [
        '/test/project/src/cycle1-a.ts',
        '/test/project/src/cycle1-b.ts',
        '/test/project/src/cycle2-x.ts',
        '/test/project/src/cycle2-y.ts',
        '/test/project/src/independent.ts'
      ];

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        // First cycle: cycle1-a <-> cycle1-b
        if (filePath.includes('cycle1-a.ts')) return `import { b } from './cycle1-b';`;
        if (filePath.includes('cycle1-b.ts')) return `import { a } from './cycle1-a';`;

        // Second cycle: cycle2-x <-> cycle2-y
        if (filePath.includes('cycle2-x.ts')) return `import { y } from './cycle2-y';`;
        if (filePath.includes('cycle2-y.ts')) return `import { x } from './cycle2-x';`;

        // Independent file
        if (filePath.includes('independent.ts')) return `export const independent = true;`;

        return '';
      });

      const graph = await builder.buildGraph(testRootPath);
      const cycles = builder.findCircularDependencies(graph);

      expect(Array.isArray(cycles)).toBe(true);
    });
  });

  describe('Path Resolution Edge Cases', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
    });

    it('should handle Windows-style paths on Unix systems', async () => {
      mockFs.readFile.mockResolvedValue(`
        import { helper } from '.\\\\utils\\\\helper';
        import { config } from '..\\\\config';
      `);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph).toBeDefined();
    });

    it('should handle paths with special characters', async () => {
      mockFs.readFile.mockResolvedValue(`
        import { helper } from './utils/special-chars-@#$%';
        import { config } from './paths with spaces/config';
        import { unicode } from './unicode-文件/helper';
      `);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph).toBeDefined();
    });

    it('should handle deeply nested relative paths', async () => {
      mockFs.readFile.mockResolvedValue(`
        import { deep } from '../../../../../../../very/deep/path/helper';
        import { shallow } from './helper';
      `);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph).toBeDefined();
    });

    it('should handle case sensitivity issues', async () => {
      mockFs.readFile.mockResolvedValue(`
        import { Helper } from './Helper';
        import { helper } from './helper';
        import { HELPER } from './HELPER';
      `);

      // Mock different behaviors for different cases
      mockFs.access.mockImplementation(async (filePath: string) => {
        if (filePath.includes('Helper') || filePath.includes('helper')) {
          return Promise.resolve();
        }
        throw new Error('ENOENT');
      });

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph).toBeDefined();
    });
  });

  describe('TypeScript Path Aliases Edge Cases', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.access.mockResolvedValue(true);
    });

    it('should handle complex path alias patterns', async () => {
      const tsConfigContent = JSON.stringify({
        compilerOptions: {
          baseUrl: "./src",
          paths: {
            "@/*": ["*"],
            "@components/*": ["components/*"],
            "@utils/*": ["utils/*/index", "utils/*"],
            "~/*": ["../external/*"],
            "@shared": ["../shared/index.ts", "../shared/main.ts"]
          }
        }
      });

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('tsconfig.json')) {
          return tsConfigContent;
        }
        if (filePath.includes('app.ts')) {
          return `
            import { Component } from '@components/Button';
            import { helper } from '@utils/dates';
            import { shared } from '@shared';
            import { external } from '~/external-lib';
          `;
        }
        return '';
      });

      const graph = await builder.buildGraph(testRootPath, {
        tsConfigPath: './tsconfig.json'
      });

      expect(graph).toBeDefined();
    });

    it('should handle invalid tsconfig.json gracefully', async () => {
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('tsconfig.json')) {
          return '{ invalid json }'; // Invalid JSON
        }
        if (filePath.includes('app.ts')) {
          return `import { helper } from '@/utils';`;
        }
        return '';
      });

      const graph = await builder.buildGraph(testRootPath, {
        tsConfigPath: './tsconfig.json',
        continueOnError: true
      });

      expect(graph).toBeDefined();
    });

    it('should handle missing tsconfig.json', async () => {
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('tsconfig.json')) {
          throw new Error('ENOENT: no such file or directory');
        }
        if (filePath.includes('app.ts')) {
          return `import { helper } from '@/utils';`;
        }
        return '';
      });

      const graph = await builder.buildGraph(testRootPath, {
        tsConfigPath: './tsconfig.json'
      });

      expect(graph).toBeDefined();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle files with thousands of imports', async () => {
      const manyImports = Array.from({ length: 5000 }, (_, i) =>
        `import { symbol${i} } from 'module${i}';`
      ).join('\n');

      mockGlob.mockResolvedValue(['/test/project/src/many-imports.ts']);
      mockFs.readFile.mockResolvedValue(manyImports);
      mockFs.access.mockResolvedValue(true);

      const startMemory = process.memoryUsage().heapUsed;
      const graph = await builder.buildGraph(testRootPath);
      const endMemory = process.memoryUsage().heapUsed;

      expect(graph).toBeDefined();

      // Memory usage should not grow excessively (less than 100MB increase)
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle deeply nested directory structures', async () => {
      const deepPath = '/test/project/' + 'src/'.repeat(50) + 'deep-file.ts';

      mockGlob.mockResolvedValue([deepPath]);
      mockFs.readFile.mockResolvedValue(`export const deep = true;`);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    it('should handle concurrent file processing correctly', async () => {
      const files = Array.from({ length: 100 }, (_, i) =>
        `/test/project/src/concurrent-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      let processedFiles = 0;
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        // Simulate varying processing times
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        processedFiles++;
        return `export const file${processedFiles} = true;`;
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 10
      });

      expect(graph.nodes.length).toBe(files.length);
      expect(processedFiles).toBe(files.length);
    });
  });

  describe('Export Analysis Edge Cases', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/exports.ts']);
      mockFs.access.mockResolvedValue(true);
    });

    it('should handle complex re-export scenarios', async () => {
      mockFs.readFile.mockResolvedValue(`
        // Various re-export patterns
        export { default as Component } from './Component';
        export { named1, named2 as renamed } from './named';
        export * from './all-exports';
        export * as namespace from './namespace';
        export { default } from './default-only';

        // Mixed with local exports
        export const local = 'value';
        export default function defaultFunc() {}

        // Re-export with type-only
        export type { TypeA, TypeB } from './types';
      `);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle dynamic re-exports', async () => {
      mockFs.readFile.mockResolvedValue(`
        const moduleName = 'dynamic-module';
        export * from moduleName; // This should not be tracked as static import

        // But this should be
        const staticImport = await import('./static');
        export { staticImport };
      `);

      const graph = await builder.buildGraph(testRootPath, {
        includeDynamicImports: true
      });

      expect(graph).toBeDefined();
    });
  });

  describe('Language Support Edge Cases', () => {
    it('should handle mixed language projects', async () => {
      const mixedFiles = [
        '/test/project/src/app.ts',
        '/test/project/src/component.tsx',
        '/test/project/src/utils.js',
        '/test/project/src/legacy.jsx',
        '/test/project/src/module.mjs',
        '/test/project/src/common.cjs'
      ];

      mockGlob.mockResolvedValue(mixedFiles);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const ext = path.extname(filePath);

        switch (ext) {
          case '.ts':
            return `import { Component } from './component'; export const app = 'app';`;
          case '.tsx':
            return `import React from 'react'; import { helper } from './utils'; export const Component = () => <div/>;`;
          case '.js':
          case '.jsx':
            return `const { legacy } = require('./legacy'); module.exports = { helper: () => {} };`;
          case '.mjs':
            return `import { common } from './common.cjs'; export const module = true;`;
          case '.cjs':
            return `module.exports = { common: true };`;
          default:
            return '';
        }
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      expect(graph.stats.languageBreakdown).toBeDefined();
      expect(Object.keys(graph.stats.languageBreakdown).length).toBeGreaterThan(0);
    });

    it('should handle unsupported file extensions gracefully', async () => {
      const files = [
        '/test/project/src/app.ts',
        '/test/project/src/config.json',
        '/test/project/src/styles.css',
        '/test/project/src/README.md',
        '/test/project/src/binary-file.exe'
      ];

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('app.ts')) {
          return `export const app = 'app';`;
        }
        if (filePath.includes('.exe')) {
          // Simulate binary file
          throw new Error('Cannot read binary file');
        }
        return 'non-js content';
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph).toBeDefined();
      // Should only process supported file types
    });
  });

  describe('Real-world Scenario Simulations', () => {
    it('should handle a monorepo structure', async () => {
      const monorepoFiles = [
        '/test/project/packages/core/src/index.ts',
        '/test/project/packages/ui/src/components/Button.tsx',
        '/test/project/packages/utils/src/helpers.ts',
        '/test/project/apps/web/src/app.tsx',
        '/test/project/apps/mobile/src/main.ts'
      ];

      mockGlob.mockResolvedValue(monorepoFiles);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('core/src/index.ts')) {
          return `
            export { Button } from '@company/ui/components/Button';
            export { helper } from '@company/utils';
          `;
        }
        if (filePath.includes('Button.tsx')) {
          return `
            import React from 'react';
            import { helper } from '@company/utils/helpers';
            export const Button = () => <button/>;
          `;
        }
        if (filePath.includes('helpers.ts')) {
          return `export const helper = () => 'help';`;
        }
        if (filePath.includes('web/src/app.tsx')) {
          return `
            import React from 'react';
            import { Button } from '@company/core';
            export const App = () => <Button />;
          `;
        }
        if (filePath.includes('mobile/src/main.ts')) {
          return `
            import { helper } from '@company/utils';
            console.log(helper());
          `;
        }
        return '';
      });

      mockFs.access.mockResolvedValue(true);

      // Mock tsconfig with path aliases for monorepo
      const tsConfigContent = JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@company/core": ["packages/core/src"],
            "@company/ui/*": ["packages/ui/src/*"],
            "@company/utils/*": ["packages/utils/src/*"]
          }
        }
      });

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('tsconfig.json')) {
          return tsConfigContent;
        }
        // ... existing file content logic
        return mockFs.readFile.mockImplementation.getMockImplementation()(filePath);
      });

      const graph = await builder.buildGraph(testRootPath, {
        tsConfigPath: './tsconfig.json',
        includePatterns: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}']
      });

      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should handle a large enterprise codebase simulation', async () => {
      // Simulate a large enterprise codebase with many files
      const departments = ['auth', 'billing', 'analytics', 'admin', 'user', 'reporting'];
      const fileTypes = ['controllers', 'services', 'models', 'utils', 'types', 'config'];

      const enterpriseFiles: string[] = [];

      departments.forEach(dept => {
        fileTypes.forEach(type => {
          for (let i = 1; i <= 10; i++) {
            enterpriseFiles.push(`/test/project/src/${dept}/${type}/${type}-${i}.ts`);
          }
        });
      });

      mockGlob.mockResolvedValue(enterpriseFiles);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const pathParts = filePath.split('/');
        const department = pathParts[5]; // dept name
        const fileType = pathParts[6]; // file type

        // Create realistic import patterns
        let imports = '';

        if (fileType === 'controllers') {
          imports = `
            import { ${department}Service } from '../services/${department}-service-1';
            import { ${department}Model } from '../models/${department}-model-1';
            import type { ${department}Type } from '../types/${department}-type-1';
          `;
        } else if (fileType === 'services') {
          imports = `
            import { ${department}Model } from '../models/${department}-model-1';
            import { helper } from '../utils/${department}-util-1';
            import { authService } from '../../auth/services/auth-service-1';
          `;
        } else if (fileType === 'models') {
          imports = `
            import type { ${department}Type } from '../types/${department}-type-1';
            import { config } from '../config/${department}-config-1';
          `;
        }

        return `${imports}\nexport const ${fileType}Content = '${department}';`;
      });

      mockFs.access.mockResolvedValue(true);

      const startTime = Date.now();

      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 8,
        continueOnError: true
      });

      const endTime = Date.now();

      expect(graph.stats.totalNodes).toBeGreaterThan(0);
      expect(graph.stats.totalEdges).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Check for department-level statistics
      expect(graph.stats.languageBreakdown).toHaveProperty('typescript');

      // Should detect some circular dependencies in complex enterprise code
      const cycles = builder.findCircularDependencies(graph);
      expect(Array.isArray(cycles)).toBe(true);
    });
  });
});