import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { type ConfigurationInfo } from '../types.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('path');

const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path, true);

describe('ProjectContextAnalyzer - parseConfigurations Coverage Tests', () => {
  let analyzer: ProjectContextAnalyzer;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ProjectContextAnalyzer(mockProjectPath);

    // Mock path.join to return predictable paths
    mockPath.join.mockImplementation((...segments) => segments.join('/'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseIndividualConfiguration coverage', () => {
    it('should handle file existence check failure', async () => {
      const config: ConfigurationInfo = {
        name: 'nonexistent.json',
        path: 'nonexistent.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      // Mock file existence check to fail
      mockFs.promises.access = vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await analyzer.parseConfigurations([config]);

      expect(result[0]).toMatchObject({
        name: 'nonexistent.json',
        isValid: false,
        parseError: 'File not found: nonexistent.json'
      });
    });

    it('should handle all configuration formats', async () => {
      const formats = ['json', 'yaml', 'toml', 'javascript', 'ini', 'env', 'xml', 'other'] as const;

      const configs = formats.map(format => ({
        name: `test.${format}`,
        path: `test.${format}`,
        format,
        purpose: 'other' as const,
        isValid: true
      }));

      const contents = {
        json: '{"test": true}',
        yaml: 'test: true\nvalue: 123',
        toml: 'test = true\nvalue = 123',
        javascript: 'module.exports = { test: true };',
        ini: '[section]\ntest=true\nvalue=123',
        env: 'TEST=true\nVALUE=123',
        xml: '<?xml version="1.0"?><root><test>true</test></root>',
        other: 'unknown format content'
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockImplementation((filePath) => {
        const format = Object.keys(contents).find(f => (filePath as string).endsWith(`.${f}`));
        return Promise.resolve(contents[format as keyof typeof contents] || 'default');
      });

      const results = await analyzer.parseConfigurations(configs);

      expect(results).toHaveLength(formats.length);
      results.forEach((result, index) => {
        expect(result.isValid).toBe(true);
        expect(result.name).toBe(`test.${formats[index]}`);
        expect(result.parsed).toBeDefined();
      });
    });

    it('should handle all purpose-specific extractions', async () => {
      const purposes = ['typescript', 'package-manager', 'build', 'testing', 'linting', 'environment'] as const;

      const configs = purposes.map(purpose => ({
        name: `${purpose}.json`,
        path: `${purpose}.json`,
        format: 'json' as const,
        purpose,
        isValid: true
      }));

      const contents = {
        typescript: JSON.stringify({
          compilerOptions: { strict: true, target: 'ES2022' },
          extends: './base.json'
        }),
        'package-manager': JSON.stringify({
          scripts: { build: 'tsc', test: 'jest' },
          dependencies: { lodash: '^4.0.0' },
          devDependencies: { typescript: '^5.0.0' }
        }),
        build: JSON.stringify({
          mode: 'production',
          entry: './src/index.js',
          output: { path: './dist' }
        }),
        testing: JSON.stringify({
          testMatch: ['**/*.test.js'],
          collectCoverage: true,
          testEnvironment: 'node'
        }),
        linting: JSON.stringify({
          extends: ['eslint:recommended'],
          rules: { 'no-console': 'error' },
          parser: '@typescript-eslint/parser'
        }),
        environment: JSON.stringify({
          NODE_ENV: 'development',
          PORT: '3000'
        })
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockImplementation((filePath) => {
        const purpose = purposes.find(p => (filePath as string).includes(p));
        return Promise.resolve(contents[purpose as keyof typeof contents] || '{}');
      });

      const results = await analyzer.parseConfigurations(configs);

      expect(results).toHaveLength(purposes.length);

      // Verify TypeScript configuration
      const tsConfig = results.find(r => r.purpose === 'typescript');
      expect(tsConfig?.compilerOptions).toEqual({ strict: true, target: 'ES2022' });
      expect(tsConfig?.extends).toBe('./base.json');

      // Verify package manager configuration
      const pkgConfig = results.find(r => r.purpose === 'package-manager');
      expect(pkgConfig?.scripts).toEqual({ build: 'tsc', test: 'jest' });
      expect(pkgConfig?.dependencies).toEqual({
        runtime: { lodash: '^4.0.0' },
        development: { typescript: '^5.0.0' },
        peer: {},
        optional: {}
      });

      // Verify build configuration
      const buildConfig = results.find(r => r.purpose === 'build');
      expect(buildConfig?.buildConfig).toBeDefined();

      // Verify test configuration
      const testConfig = results.find(r => r.purpose === 'testing');
      expect(testConfig?.testConfig).toBeDefined();

      // Verify lint configuration
      const lintConfig = results.find(r => r.purpose === 'linting');
      expect(lintConfig?.lintConfig).toBeDefined();

      // Verify environment configuration
      const envConfig = results.find(r => r.purpose === 'environment');
      expect(envConfig?.environment).toEqual({
        NODE_ENV: 'development',
        PORT: '3000'
      });
    });

    it('should handle parsing errors gracefully for all formats', async () => {
      const formats = ['json', 'yaml', 'toml', 'javascript', 'ini'] as const;

      const configs = formats.map(format => ({
        name: `invalid.${format}`,
        path: `invalid.${format}`,
        format,
        purpose: 'other' as const,
        isValid: true
      }));

      // Provide invalid content for each format that will cause parsing errors
      const invalidContents = {
        json: '{ invalid json }',
        yaml: 'invalid:\n  - yaml\n  - content:\n     missing value',
        toml: '[invalid toml\nsection = missing bracket',
        javascript: 'invalid javascript syntax {{{',
        ini: '[invalid ini\nsection missing bracket'
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockImplementation((filePath) => {
        const format = formats.find(f => (filePath as string).endsWith(`.${f}`));
        return Promise.resolve(invalidContents[format as keyof typeof invalidContents] || 'invalid');
      });

      const results = await analyzer.parseConfigurations(configs);

      expect(results).toHaveLength(formats.length);
      results.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.parseError).toBeDefined();
        expect(result.parseError).not.toBe('');
      });
    });

    it('should handle edge case with empty configurations array', async () => {
      const result = await analyzer.parseConfigurations([]);
      expect(result).toEqual([]);
    });

    it('should handle configurations with missing optional fields', async () => {
      const config: ConfigurationInfo = {
        name: 'minimal.json',
        path: 'minimal.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      const content = '{"minimal": true}';

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(content);

      const result = await analyzer.parseConfigurations([config]);

      expect(result[0]).toMatchObject({
        name: 'minimal.json',
        isValid: true,
        parsed: { minimal: true }
      });
    });

    it('should handle non-Error exceptions', async () => {
      const config: ConfigurationInfo = {
        name: 'error.json',
        path: 'error.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      // Throw a non-Error object
      mockFs.promises.readFile = vi.fn().mockRejectedValue('string error');

      const result = await analyzer.parseConfigurations([config]);

      expect(result[0]).toMatchObject({
        name: 'error.json',
        isValid: false,
        parseError: 'Failed to read file: string error'
      });
    });
  });

  describe('method interaction coverage', () => {
    it('should call parseIndividualConfiguration for each configuration', async () => {
      const configs: ConfigurationInfo[] = [
        { name: 'test1.json', path: 'test1.json', format: 'json', purpose: 'other', isValid: true },
        { name: 'test2.json', path: 'test2.json', format: 'json', purpose: 'other', isValid: true }
      ];

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue('{"test": true}');

      // Spy on the private method indirectly by checking its effects
      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(2);
      expect(mockFs.promises.access).toHaveBeenCalledTimes(2);
      expect(mockFs.promises.readFile).toHaveBeenCalledTimes(2);
    });

    it('should preserve configuration metadata throughout parsing', async () => {
      const config: ConfigurationInfo = {
        name: 'meta.json',
        path: 'configs/meta.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
        size: 1024,
        modifiedAt: new Date('2024-01-01'),
        metadata: { custom: 'field' }
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue('{"compilerOptions": {"strict": true}}');

      const result = await analyzer.parseConfigurations([config]);

      expect(result[0]).toMatchObject({
        name: 'meta.json',
        path: 'configs/meta.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
        size: 1024,
        modifiedAt: config.modifiedAt,
        metadata: { custom: 'field' },
        compilerOptions: { strict: true }
      });
    });
  });

  describe('error path coverage', () => {
    it('should handle configuration content parsing throwing non-Error', async () => {
      const config: ConfigurationInfo = {
        name: 'weird.json',
        path: 'weird.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);

      // Mock readFile to return content that will cause JSON.parse to throw
      mockFs.promises.readFile = vi.fn().mockResolvedValue('undefined');

      const result = await analyzer.parseConfigurations([config]);

      expect(result[0]).toMatchObject({
        name: 'weird.json',
        isValid: false,
        parseError: expect.stringContaining('Unexpected token')
      });
    });
  });
});