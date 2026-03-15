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

    it('should parse pyproject.toml for Python projects', async () => {
      const pyprojectContent = `
[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "my-python-project"
version = "0.1.0"
description = "A sample Python project"
authors = [
    {name = "Jane Doe", email = "jane@example.com"}
]
dependencies = [
    "requests>=2.20.0",
    "click>=8.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "black>=22.0.0",
    "mypy>=1.0.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]

[tool.mypy]
python_version = "3.9"
warn_return_any = true
strict_optional = true

[tool.black]
line-length = 88
target-version = ['py39']
`;

      const configInfo: ConfigurationInfo = {
        name: 'pyproject.toml',
        path: 'pyproject.toml',
        format: 'toml',
        purpose: 'package-manager',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(pyprojectContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'pyproject.toml',
        isValid: true,
        parsed: expect.objectContaining({
          project: expect.objectContaining({
            name: 'my-python-project',
            version: '0.1.0',
            description: 'A sample Python project'
          }),
          'build-system': expect.objectContaining({
            requires: expect.arrayContaining(['setuptools>=45', 'wheel'])
          })
        })
        // Note: Python dependencies from pyproject.toml have different structure than npm,
        // so they won't be automatically parsed into the dependencies format
      });
    });

    it('should parse docker-compose.yml configuration', async () => {
      const dockerComposeContent = `
version: '3.8'
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://user:pass@db:5432/myapp
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
`;

      const configInfo: ConfigurationInfo = {
        name: 'docker-compose.yml',
        path: 'docker-compose.yml',
        format: 'yaml',
        purpose: 'containerization',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(dockerComposeContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'docker-compose.yml',
        isValid: true,
        parsed: expect.objectContaining({
          version: '3.8',
          services: expect.objectContaining({
            web: expect.objectContaining({
              build: expect.objectContaining({
                context: '.',
                dockerfile: 'Dockerfile'
              }),
              ports: expect.arrayContaining(['3000:3000'])
            }),
            db: expect.objectContaining({
              image: 'postgres:13'
            })
          })
        })
      });
    });

    it('should parse .prettierrc configuration', async () => {
      const prettierContent = JSON.stringify({
        semi: false,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        printWidth: 100,
        bracketSpacing: true,
        arrowParens: 'avoid',
        endOfLine: 'lf',
        overrides: [
          {
            files: '*.md',
            options: {
              printWidth: 80
            }
          }
        ]
      });

      const configInfo: ConfigurationInfo = {
        name: '.prettierrc',
        path: '.prettierrc',
        format: 'json',
        purpose: 'linting',
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
          tabWidth: 2,
          trailingComma: 'es5',
          printWidth: 100,
          bracketSpacing: true,
          arrowParens: 'avoid'
        }),
        lintConfig: expect.objectContaining({
          semi: false,
          singleQuote: true,
          tabWidth: 2,
          printWidth: 100
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

    it('should handle mixed success and error configurations', async () => {
      const configs: ConfigurationInfo[] = [
        {
          name: 'valid.json',
          path: 'valid.json',
          format: 'json',
          purpose: 'other',
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
        .mockResolvedValueOnce(undefined) // valid.json exists
        .mockRejectedValueOnce(new Error('File not found')) // missing.json
        .mockResolvedValueOnce(undefined); // invalid.json exists

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValueOnce('{"valid": true}') // valid.json
        .mockResolvedValueOnce('{ invalid json }'); // invalid.json

      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        name: 'valid.json',
        isValid: true,
        parsed: { valid: true }
      });
      expect(result[1]).toMatchObject({
        name: 'missing.json',
        isValid: false,
        parseError: 'File not found: missing.json'
      });
      expect(result[2]).toMatchObject({
        name: 'invalid.json',
        isValid: false,
        parseError: expect.stringContaining('Unexpected token')
      });
    });

    it('should handle XML format configurations', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <property name="debug" value="true"/>
  <property name="port" value="8080"/>
</configuration>`;

      const configInfo: ConfigurationInfo = {
        name: 'config.xml',
        path: 'config.xml',
        format: 'xml',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(xmlContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'config.xml',
        isValid: true,
        parsed: expect.objectContaining({
          content: xmlContent,
          format: 'xml'
        })
      });
    });

    it('should handle unsupported format configurations', async () => {
      const unknownContent = 'some unknown format content';

      const configInfo: ConfigurationInfo = {
        name: 'config.unknown',
        path: 'config.unknown',
        format: 'other',
        purpose: 'other',
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(unknownContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'config.unknown',
        isValid: true,
        parsed: expect.objectContaining({
          content: unknownContent,
          format: 'other'
        })
      });
    });

    it('should handle environment files with sensitive data filtering', async () => {
      const envContent = `
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://localhost/prod
API_KEY=sensitive-key-123
SECRET_TOKEN=very-secret-token
PASSWORD=supersecret
PRIVATE_KEY=rsa-private-key-data
WEBHOOK_SECRET=webhook-secret-123
DB_PASSWORD=db-secret
EMAIL_PASS=email-password
JWT_SECRET=jwt-signing-secret
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

      expect(result[0]).toMatchObject({
        name: '.env.production',
        isValid: true,
        environment: expect.objectContaining({
          NODE_ENV: 'production',
          PORT: '3000',
          DATABASE_URL: 'postgresql://localhost/prod'
        })
      });

      // Should filter out sensitive variables
      const sensitiveKeys = ['API_KEY', 'SECRET_TOKEN', 'PASSWORD', 'PRIVATE_KEY', 'WEBHOOK_SECRET', 'DB_PASSWORD', 'EMAIL_PASS', 'JWT_SECRET'];
      sensitiveKeys.forEach(key => {
        expect(result[0].environment).not.toHaveProperty(key);
      });
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