import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectContextAnalyzer,
  ParsedConfigurationInfoSchema,
} from '../project-context-analyzer.js';
import {
  type ConfigurationInfo,
  type ParsedConfigurationInfo,
} from '../types.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('path');

const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path, true);

describe('ProjectContextAnalyzer - parseConfigurations Edge Cases', () => {
  let analyzer: ProjectContextAnalyzer;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ProjectContextAnalyzer(mockProjectPath);
    mockPath.join.mockImplementation((...segments) => segments.join('/'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Advanced JavaScript configuration parsing', () => {
    it('should handle ES6 export default syntax', async () => {
      const jsContent = `
export default {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: './dist',
    filename: '[name].bundle.js'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  }
};
`;

      const configInfo: ConfigurationInfo = {
        name: 'vite.config.js',
        path: 'vite.config.js',
        format: 'javascript',
        purpose: 'build',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(jsContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'vite.config.js',
        isValid: true,
        parsed: expect.objectContaining({
          mode: 'development',
          entry: './src/index.js'
        }),
        buildConfig: expect.objectContaining({
          mode: 'development',
          entry: './src/index.js'
        })
      });
    });

    it('should handle malformed JavaScript gracefully', async () => {
      const malformedJs = `
module.exports = {
  mode: 'development',
  entry: './src/index.js',
  // Missing closing brace
  plugins: ['webpack-plugin'
`;

      const configInfo: ConfigurationInfo = {
        name: 'broken.config.js',
        path: 'broken.config.js',
        format: 'javascript',
        purpose: 'build',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(malformedJs);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0].isValid).toBe(true);
      expect(result[0].parsed).toMatchObject({
        configType: 'javascript',
        fileName: 'broken.config.js',
        hasModuleExports: true
      });
    });
  });

  describe('Complex YAML parsing', () => {
    it('should handle nested YAML structure', async () => {
      const yamlContent = `
name: test-project
version: 1.0.0
database:
  host: localhost
  port: 5432
server:
  port: 3000
  ssl: true
features:
  authentication: true
  logging: false
`;

      const configInfo: ConfigurationInfo = {
        name: 'app.yml',
        path: 'config/app.yml',
        format: 'yaml',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(yamlContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0].isValid).toBe(true);
      expect(result[0].parsed).toMatchObject({
        name: 'test-project',
        version: '1.0.0'
      });
    });

    it('should handle YAML with special characters', async () => {
      const yamlContent = `
app_name: "My App with spaces"
version: "1.0.0-alpha.1"
description: 'Single quoted string'
boolean_true: true
boolean_false: false
number_int: 42
number_float: 3.14159
special_chars: "String with: colons and = equals"
`;

      const configInfo: ConfigurationInfo = {
        name: 'complex.yml',
        path: 'complex.yml',
        format: 'yaml',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(yamlContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0].isValid).toBe(true);
      expect(result[0].parsed).toMatchObject({
        app_name: 'My App with spaces',
        version: '1.0.0-alpha.1',
        description: 'Single quoted string',
        boolean_true: true,
        boolean_false: false,
        number_int: 42,
        number_float: 3.14159
      });
    });
  });

  describe('Environment file parsing', () => {
    it('should handle environment files with complex values', async () => {
      const envContent = `
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://localhost/prod
APP_NAME=MyApp
COMPLEX_VALUE=key1=value1,key2=value2,key3=value3
BASE64_VALUE=SGVsbG8gV29ybGQ=
`;

      const configInfo: ConfigurationInfo = {
        name: '.env.production',
        path: '.env.production',
        format: 'env',
        purpose: 'environment',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(envContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0].isValid).toBe(true);
      expect(result[0].environment).toMatchObject({
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_URL: 'postgresql://localhost/prod',
        APP_NAME: 'MyApp',
        COMPLEX_VALUE: 'key1=value1,key2=value2,key3=value3',
        BASE64_VALUE: 'SGVsbG8gV29ybGQ='
      });
    });
  });

  describe('XML configuration handling', () => {
    it('should handle XML configuration files', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <appSettings>
    <add key="Environment" value="Development" />
    <add key="Port" value="3000" />
  </appSettings>
</configuration>`;

      const configInfo: ConfigurationInfo = {
        name: 'app.config',
        path: 'app.config',
        format: 'xml',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(xmlContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'app.config',
        isValid: true,
        parsed: {
          content: xmlContent,
          format: 'xml'
        }
      });
    });
  });

  describe('Multiple configurations with mixed results', () => {
    it('should handle mixed success and failure scenarios', async () => {
      const configs: ConfigurationInfo[] = [
        {
          name: 'package.json',
          path: 'package.json',
          format: 'json',
          purpose: 'package-manager',
          isValid: true
        },
        {
          name: 'missing.json',
          path: 'missing.json',
          format: 'json',
          purpose: 'other',
          isValid: true
        },
        {
          name: 'invalid.json',
          path: 'invalid.json',
          format: 'json',
          purpose: 'other',
          isValid: true
        }
      ];

      mockFs.promises.access = vi.fn()
        .mockResolvedValueOnce(undefined) // package.json exists
        .mockRejectedValueOnce(new Error('File not found')) // missing.json doesn't exist
        .mockResolvedValueOnce(undefined); // invalid.json exists

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValueOnce('{"name": "test", "scripts": {"build": "tsc"}}') // valid package.json
        .mockResolvedValueOnce('{ invalid json }'); // invalid JSON

      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(3);

      // First config should succeed
      expect(result[0]).toMatchObject({
        name: 'package.json',
        isValid: true,
        scripts: { build: 'tsc' }
      });

      // Second config should fail (file not found)
      expect(result[1]).toMatchObject({
        name: 'missing.json',
        isValid: false,
        parseError: 'File not found: missing.json'
      });

      // Third config should fail (invalid JSON)
      expect(result[2]).toMatchObject({
        name: 'invalid.json',
        isValid: false,
        parseError: expect.stringContaining('Unexpected token')
      });
    });
  });

  describe('Advanced TOML parsing', () => {
    it('should handle complex TOML structure', async () => {
      const tomlContent = `
[package]
name = "advanced-project"
version = "2.0.0"
edition = "2021"

[dependencies]
serde = "1.0"

[dev-dependencies]
tokio-test = "0.4"

[features]
default = ["json-support"]
`;

      const configInfo: ConfigurationInfo = {
        name: 'Cargo.toml',
        path: 'Cargo.toml',
        format: 'toml',
        purpose: 'package-manager',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(tomlContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0].isValid).toBe(true);
      expect(result[0].parsed).toMatchObject({
        package: expect.objectContaining({
          name: 'advanced-project',
          version: '2.0.0',
          edition: '2021'
        })
      });
    });
  });

  describe('Prettier configuration', () => {
    it('should parse .prettierrc configuration', async () => {
      const prettierContent = JSON.stringify({
        semi: false,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        printWidth: 100,
        bracketSpacing: true,
        arrowParens: 'avoid'
      });

      const configInfo: ConfigurationInfo = {
        name: '.prettierrc',
        path: '.prettierrc',
        format: 'json',
        purpose: 'formatting',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(prettierContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: '.prettierrc',
        isValid: true,
        parsed: expect.objectContaining({
          semi: false,
          singleQuote: true,
          tabWidth: 2
        })
      });
    });
  });

  describe('Babel configuration', () => {
    it('should parse babel.config.js', async () => {
      const babelContent = `
module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react',
    '@babel/preset-typescript'
  ],
  plugins: [
    '@babel/plugin-transform-runtime'
  ],
  env: {
    test: {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
    }
  }
};
`;

      const configInfo: ConfigurationInfo = {
        name: 'babel.config.js',
        path: 'babel.config.js',
        format: 'javascript',
        purpose: 'build',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(babelContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0].isValid).toBe(true);
      expect(result[0].buildConfig).toBeDefined();
    });
  });

  describe('Schema validation comprehensive tests', () => {
    it('should validate configuration with minimal required fields', () => {
      const minimalConfig: ParsedConfigurationInfo = {
        name: 'minimal.json',
        path: 'minimal.json',
        format: 'json',
        purpose: 'other',
        isValid: false,
        parseError: 'Parsing failed'
      };

      expect(() => ParsedConfigurationInfoSchema.parse(minimalConfig)).not.toThrow();
    });

    it('should validate configuration with all fields', () => {
      const fullConfig: ParsedConfigurationInfo = {
        name: 'full.json',
        path: 'full.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
        parsed: { test: true },
        compilerOptions: { strict: true },
        buildConfig: { mode: 'production' },
        testConfig: { testMatch: ['**/*.test.ts'] },
        lintConfig: { extends: ['@eslint/recommended'] },
        scripts: { test: 'jest', build: 'tsc' },
        dependencies: {
          runtime: { react: '^18.0.0' },
          development: { jest: '^29.0.0' },
          peer: {},
          optional: {}
        },
        extends: 'base-config.json',
        environment: { NODE_ENV: 'test' },
        keySettings: { important: true },
        size: 2048,
        modifiedAt: new Date(),
        metadata: {
          lastAnalyzed: new Date()
        }
      };

      expect(() => ParsedConfigurationInfoSchema.parse(fullConfig)).not.toThrow();
    });
  });
});