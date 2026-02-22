/**
 * Dependencies Verification Tests
 *
 * This test suite verifies that all required tree-sitter dependencies
 * are properly installed and can be imported without errors.
 */

import { describe, it, expect } from 'vitest';

describe('Tree-sitter Dependencies Verification', () => {
  describe('Core Dependencies', () => {
    it('should be able to import tree-sitter core', async () => {
      const TreeSitter = await import('tree-sitter');
      expect(TreeSitter).toBeDefined();
      expect(TreeSitter.default).toBeDefined();
      expect(typeof TreeSitter.default).toBe('function');
    });
  });

  describe('Language Grammar Dependencies', () => {
    const languages = [
      { name: 'JavaScript', module: 'tree-sitter-javascript' },
      { name: 'TypeScript', module: 'tree-sitter-typescript' },
      { name: 'Python', module: 'tree-sitter-python' },
      { name: 'Go', module: 'tree-sitter-go' },
      { name: 'Rust', module: 'tree-sitter-rust' },
      { name: 'Java', module: 'tree-sitter-java' }
    ];

    languages.forEach(({ name, module }) => {
      it(`should be able to import ${name} parser (${module})`, async () => {
        const languageModule = await import(module);
        expect(languageModule).toBeDefined();

        if (module === 'tree-sitter-typescript') {
          // TypeScript module has both typescript and tsx exports
          expect(languageModule.typescript).toBeDefined();
          expect(languageModule.tsx).toBeDefined();
          expect(typeof languageModule.typescript).toBe('function');
          expect(typeof languageModule.tsx).toBe('function');
        } else {
          // Other modules have a default export
          expect(languageModule.default).toBeDefined();
          expect(typeof languageModule.default).toBe('function');
        }
      });
    });
  });

  describe('Parser Initialization', () => {
    it('should be able to create and initialize all language parsers', async () => {
      const TreeSitter = (await import('tree-sitter')).default;

      const parsers = [
        {
          name: 'JavaScript',
          language: (await import('tree-sitter-javascript')).default
        },
        {
          name: 'TypeScript',
          language: (await import('tree-sitter-typescript')).typescript
        },
        {
          name: 'TSX',
          language: (await import('tree-sitter-typescript')).tsx
        },
        {
          name: 'Python',
          language: (await import('tree-sitter-python')).default
        },
        {
          name: 'Go',
          language: (await import('tree-sitter-go')).default
        },
        {
          name: 'Rust',
          language: (await import('tree-sitter-rust')).default
        },
        {
          name: 'Java',
          language: (await import('tree-sitter-java')).default
        }
      ];

      for (const { name, language } of parsers) {
        const parser = new TreeSitter();
        expect(() => {
          parser.setLanguage(language);
        }).not.toThrow();

        // Test basic parsing
        const tree = parser.parse('');
        expect(tree).toBeDefined();
        expect(tree.rootNode).toBeDefined();
      }
    });
  });

  describe('Package.json Verification', () => {
    it('should have all tree-sitter dependencies in package.json', async () => {
      const packageJsonPath = require.resolve('../../package.json');
      const packageJson = JSON.parse(
        await require('fs').promises.readFile(packageJsonPath, 'utf-8')
      );

      const expectedDependencies = [
        'tree-sitter',
        'tree-sitter-javascript',
        'tree-sitter-typescript',
        'tree-sitter-python',
        'tree-sitter-go',
        'tree-sitter-rust',
        'tree-sitter-java'
      ];

      for (const dep of expectedDependencies) {
        expect(packageJson.dependencies).toHaveProperty(dep);
        expect(typeof packageJson.dependencies[dep]).toBe('string');
        expect(packageJson.dependencies[dep]).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });

    it('should have consistent version patterns for tree-sitter packages', async () => {
      const packageJsonPath = require.resolve('../../package.json');
      const packageJson = JSON.parse(
        await require('fs').promises.readFile(packageJsonPath, 'utf-8')
      );

      const treeSitterPackages = Object.entries(packageJson.dependencies)
        .filter(([name]) => name.startsWith('tree-sitter'))
        .map(([name, version]) => ({ name, version: version as string }));

      expect(treeSitterPackages.length).toBeGreaterThan(0);

      // All tree-sitter packages should follow semantic versioning
      for (const { name, version } of treeSitterPackages) {
        expect(version).toMatch(/^\^?\d+\.\d+\.\d+$/);
      }
    });
  });

  describe('Module Resolution', () => {
    it('should resolve tree-sitter modules from node_modules', () => {
      const treeSitterPath = require.resolve('tree-sitter');
      expect(treeSitterPath).toContain('tree-sitter');

      const jsParserPath = require.resolve('tree-sitter-javascript');
      expect(jsParserPath).toContain('tree-sitter-javascript');

      const tsParserPath = require.resolve('tree-sitter-typescript');
      expect(tsParserPath).toContain('tree-sitter-typescript');
    });

    it('should have tree-sitter native bindings available', async () => {
      // This tests that the native bindings compiled successfully
      const TreeSitter = (await import('tree-sitter')).default;
      const parser = new TreeSitter();

      expect(parser).toBeDefined();
      expect(typeof parser.parse).toBe('function');
      expect(typeof parser.setLanguage).toBe('function');
    });
  });

  describe('Runtime Functionality', () => {
    it('should successfully parse sample code with each language', async () => {
      const TreeSitter = (await import('tree-sitter')).default;

      const testCases = [
        {
          name: 'JavaScript',
          language: (await import('tree-sitter-javascript')).default,
          code: 'function test() { return true; }'
        },
        {
          name: 'TypeScript',
          language: (await import('tree-sitter-typescript')).typescript,
          code: 'function test(): boolean { return true; }'
        },
        {
          name: 'Python',
          language: (await import('tree-sitter-python')).default,
          code: 'def test():\n    return True'
        },
        {
          name: 'Go',
          language: (await import('tree-sitter-go')).default,
          code: 'package main\nfunc test() bool { return true }'
        },
        {
          name: 'Rust',
          language: (await import('tree-sitter-rust')).default,
          code: 'fn test() -> bool { true }'
        },
        {
          name: 'Java',
          language: (await import('tree-sitter-java')).default,
          code: 'class Test { boolean test() { return true; } }'
        }
      ];

      for (const { name, language, code } of testCases) {
        const parser = new TreeSitter();
        parser.setLanguage(language);

        const tree = parser.parse(code);
        expect(tree, `Failed to parse ${name} code`).toBeDefined();
        expect(tree.rootNode, `No root node for ${name}`).toBeDefined();
        expect(tree.rootNode.childCount, `No children in ${name} AST`).toBeGreaterThan(0);
      }
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory when creating multiple parsers', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many parsers to test for memory leaks
      for (let i = 0; i < 100; i++) {
        const parser = new (require('tree-sitter').default)();
        parser.setLanguage(require('tree-sitter-javascript').default);
        parser.parse('const x = 1;');
        // Parsers should be garbage collected
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});