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

describe('ProjectContextAnalyzer - parseConfigurations', () => {
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

  describe('parseConfigurations method', () => {
    it('should parse empty configuration list', async () => {
      const result = await analyzer.parseConfigurations([]);
      expect(result).toEqual([]);
    });

    it('should parse TypeScript configuration successfully', async () => {
      const tsconfigContent = JSON.stringify({
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'node',
          allowSyntheticDefaultImports: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      });

      const configInfo: ConfigurationInfo = {
        name: 'tsconfig.json',
        path: 'tsconfig.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true
      };

      // Mock file system calls
      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(tsconfigContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'tsconfig.json',
        path: 'tsconfig.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
        parsed: expect.objectContaining({
          compilerOptions: expect.objectContaining({
            strict: true,
            target: 'ES2022',
            module: 'NodeNext'
          })
        }),
        compilerOptions: expect.objectContaining({
          strict: true,
          target: 'ES2022',
          module: 'NodeNext'
        })
      });

      // Validate against schema
      expect(() => ParsedConfigurationInfoSchema.parse(result[0])).not.toThrow();
    });

    it('should parse package.json with dependencies and scripts', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          build: 'tsc',
          test: 'vitest',
          dev: 'vite dev'
        },
        dependencies: {
          react: '^18.0.0',
          typescript: '^5.0.0'
        },
        devDependencies: {
          vitest: '^1.0.0',
          '@types/node': '^20.0.0'
        },
        peerDependencies: {
          'react-dom': '^18.0.0'
        },
        optionalDependencies: {
          'optional-package': '^1.0.0'
        }
      });

      const configInfo: ConfigurationInfo = {
        name: 'package.json',
        path: 'package.json',
        format: 'json',
        purpose: 'package-manager',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(packageJsonContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'package.json',
        isValid: true,
        scripts: {
          build: 'tsc',
          test: 'vitest',
          dev: 'vite dev'
        },
        dependencies: {
          runtime: { react: '^18.0.0', typescript: '^5.0.0' },
          development: { vitest: '^1.0.0', '@types/node': '^20.0.0' },
          peer: { 'react-dom': '^18.0.0' },
          optional: { 'optional-package': '^1.0.0' }
        }
      });
    });

    it('should parse ESLint configuration', async () => {
      const eslintContent = JSON.stringify({
        extends: ['@eslint/recommended', '@typescript-eslint/recommended'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        rules: {
          'no-console': 'warn',
          '@typescript-eslint/no-unused-vars': 'error'
        },
        env: {
          node: true,
          browser: true
        }
      });

      const configInfo: ConfigurationInfo = {
        name: '.eslintrc.json',
        path: '.eslintrc.json',
        format: 'json',
        purpose: 'linting',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(eslintContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: '.eslintrc.json',
        isValid: true,
        lintConfig: expect.objectContaining({
          extends: ['@eslint/recommended', '@typescript-eslint/recommended'],
          parser: '@typescript-eslint/parser',
          plugins: ['@typescript-eslint'],
          rules: expect.objectContaining({
            'no-console': 'warn'
          })
        })
      });
    });

    it('should parse Jest test configuration', async () => {
      const jestContent = JSON.stringify({
        testMatch: ['**/*.test.js', '**/*.spec.js'],
        collectCoverage: true,
        coverageDirectory: 'coverage',
        testEnvironment: 'node',
        setupFiles: ['<rootDir>/jest.setup.js']
      });

      const configInfo: ConfigurationInfo = {
        name: 'jest.config.json',
        path: 'jest.config.json',
        format: 'json',
        purpose: 'testing',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(jestContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'jest.config.json',
        isValid: true,
        testConfig: expect.objectContaining({
          testMatch: ['**/*.test.js', '**/*.spec.js'],
          collectCoverage: true,
          coverageDirectory: 'coverage',
          testEnvironment: 'node'
        })
      });
    });

    it('should parse webpack build configuration', async () => {
      const webpackContent = JSON.stringify({
        mode: 'production',
        entry: './src/index.js',
        output: {
          path: '/dist',
          filename: 'bundle.js'
        },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              use: 'ts-loader'
            }
          ]
        },
        resolve: {
          extensions: ['.tsx', '.ts', '.js']
        }
      });

      const configInfo: ConfigurationInfo = {
        name: 'webpack.config.json',
        path: 'webpack.config.json',
        format: 'json',
        purpose: 'build',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(webpackContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'webpack.config.json',
        isValid: true,
        buildConfig: expect.objectContaining({
          mode: 'production',
          entry: './src/index.js',
          output: expect.objectContaining({
            path: '/dist',
            filename: 'bundle.js'
          })
        })
      });
    });

    it('should parse environment variables file', async () => {
      const envContent = `
# Development environment
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost/testdb
API_ENDPOINT=https://api.example.com
DEBUG=true
# Secrets (should be filtered out)
API_SECRET=secret123
PASSWORD=mysecret
`;

      const configInfo: ConfigurationInfo = {
        name: '.env',
        path: '.env',
        format: 'env',
        purpose: 'environment',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(envContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: '.env',
        isValid: true,
        environment: expect.objectContaining({
          NODE_ENV: 'development',
          PORT: '3000',
          DATABASE_URL: 'postgresql://localhost/testdb',
          API_ENDPOINT: 'https://api.example.com',
          DEBUG: 'true'
        })
      });

      // Should not contain sensitive variables
      expect(result[0].environment).not.toHaveProperty('API_SECRET');
      expect(result[0].environment).not.toHaveProperty('PASSWORD');
    });

    it('should parse simple YAML configuration', async () => {
      const yamlContent = `
name: test-project
version: 1.0.0
debug: true
port: 3000
database:
  host: localhost
  port: 5432
`;

      const configInfo: ConfigurationInfo = {
        name: 'config.yml',
        path: 'config.yml',
        format: 'yaml',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(yamlContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'config.yml',
        isValid: true,
        parsed: expect.objectContaining({
          name: 'test-project',
          version: '1.0.0',
          debug: true,
          port: 3000
        })
      });
    });

    it('should parse JavaScript config files', async () => {
      const jsContent = `
module.exports = {
  mode: 'development',
  entry: './src/index.js',
  devServer: {
    port: 3000,
    hot: true
  },
  plugins: ['html-webpack-plugin']
};
`;

      const configInfo: ConfigurationInfo = {
        name: 'webpack.config.js',
        path: 'webpack.config.js',
        format: 'javascript',
        purpose: 'build',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(jsContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'webpack.config.js',
        isValid: true,
        parsed: expect.objectContaining({
          mode: 'development',
          entry: './src/index.js'
        })
      });
    });

    it('should handle file not found errors', async () => {
      const configInfo: ConfigurationInfo = {
        name: 'missing.json',
        path: 'missing.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockRejectedValue(new Error('File not found'));

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'missing.json',
        isValid: false,
        parseError: 'File not found: missing.json'
      });
    });

    it('should handle file read errors', async () => {
      const configInfo: ConfigurationInfo = {
        name: 'unreadable.json',
        path: 'unreadable.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'unreadable.json',
        isValid: false,
        parseError: 'Failed to read file: Permission denied'
      });
    });

    it('should handle JSON parsing errors', async () => {
      const invalidJson = '{ "key": invalid json }';

      const configInfo: ConfigurationInfo = {
        name: 'invalid.json',
        path: 'invalid.json',
        format: 'json',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(invalidJson);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'invalid.json',
        isValid: false,
        parseError: expect.stringContaining('Unexpected token')
      });
    });

    it('should parse INI configuration files', async () => {
      const iniContent = `
[database]
host=localhost
port=5432
name=testdb

[server]
port=3000
debug=true
`;

      const configInfo: ConfigurationInfo = {
        name: 'config.ini',
        path: 'config.ini',
        format: 'ini',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(iniContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'config.ini',
        isValid: true,
        parsed: expect.objectContaining({
          database: expect.objectContaining({
            host: 'localhost',
            port: '5432',
            name: 'testdb'
          }),
          server: expect.objectContaining({
            port: '3000',
            debug: 'true'
          })
        })
      });
    });

    it('should parse TOML configuration files', async () => {
      const tomlContent = `
[package]
name = "test-project"
version = "1.0.0"
edition = "2021"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }
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

      expect(result[0]).toMatchObject({
        name: 'Cargo.toml',
        isValid: true,
        parsed: expect.objectContaining({
          package: expect.objectContaining({
            name: 'test-project',
            version: '1.0.0',
            edition: '2021'
          })
        })
      });
    });

    it('should use getConfigurationInfoList when no configurations provided', async () => {
      const mockGetConfigurationInfoList = vi.spyOn(analyzer, 'getConfigurationInfoList')
        .mockResolvedValue([{
          name: 'package.json',
          path: 'package.json',
          format: 'json',
          purpose: 'package-manager',
          isValid: true
        }]);

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue('{"name": "test"}');

      await analyzer.parseConfigurations();

      expect(mockGetConfigurationInfoList).toHaveBeenCalled();

      mockGetConfigurationInfoList.mockRestore();
    });

    it('should handle multiple configurations at once', async () => {
      const configs: ConfigurationInfo[] = [
        {
          name: 'package.json',
          path: 'package.json',
          format: 'json',
          purpose: 'package-manager',
          isValid: true
        },
        {
          name: 'tsconfig.json',
          path: 'tsconfig.json',
          format: 'json',
          purpose: 'typescript',
          isValid: true
        }
      ];

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn()
        .mockResolvedValueOnce('{"name": "test", "scripts": {"build": "tsc"}}')
        .mockResolvedValueOnce('{"compilerOptions": {"strict": true}}');

      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('package.json');
      expect(result[1].name).toBe('tsconfig.json');
      expect(result[0].scripts).toEqual({ build: 'tsc' });
      expect(result[1].compilerOptions).toEqual({ strict: true });
    });
  });

  describe('schema validation', () => {
    it('should validate ParsedConfigurationInfo schema with all fields', () => {
      const parsedConfig: ParsedConfigurationInfo = {
        name: 'complete-config.json',
        path: 'configs/complete-config.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
        parsed: {
          compilerOptions: {
            strict: true,
            target: 'ES2022'
          }
        },
        compilerOptions: {
          strict: true,
          target: 'ES2022'
        },
        buildConfig: {
          mode: 'production'
        },
        testConfig: {
          testMatch: ['**/*.test.js']
        },
        lintConfig: {
          extends: ['@eslint/recommended']
        },
        scripts: {
          build: 'tsc'
        },
        dependencies: {
          runtime: { react: '^18.0.0' },
          development: { vitest: '^1.0.0' },
          peer: {},
          optional: {}
        },
        extends: 'base-tsconfig.json',
        environment: {
          NODE_ENV: 'development'
        },
        keySettings: {
          strict: true
        },
        size: 1024,
        modifiedAt: new Date(),
        metadata: {
          lastAnalyzed: new Date()
        }
      };

      expect(() => ParsedConfigurationInfoSchema.parse(parsedConfig)).not.toThrow();
    });

    it('should validate ParsedConfigurationInfo schema with minimal fields', () => {
      const parsedConfig: ParsedConfigurationInfo = {
        name: 'minimal-config.json',
        path: 'minimal-config.json',
        format: 'json',
        purpose: 'other',
        isValid: false,
        parseError: 'File not found'
      };

      expect(() => ParsedConfigurationInfoSchema.parse(parsedConfig)).not.toThrow();
    });
  });
});