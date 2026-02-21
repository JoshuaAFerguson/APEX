import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('path');

const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path, true);

describe('ProjectContextAnalyzer - parseConfigurations Integration', () => {
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

  describe('integration with getConfigurationInfoList', () => {
    it('should call getConfigurationInfoList when no configurations provided', async () => {
      // Mock the getConfigurationInfoList method
      const mockConfigs = [
        {
          name: 'package.json',
          path: 'package.json',
          format: 'json' as const,
          purpose: 'package-manager' as const,
          isValid: true
        },
        {
          name: 'tsconfig.json',
          path: 'tsconfig.json',
          format: 'json' as const,
          purpose: 'typescript' as const,
          isValid: true
        }
      ];

      const mockGetConfigurationInfoList = vi.spyOn(analyzer, 'getConfigurationInfoList')
        .mockResolvedValue(mockConfigs);

      // Mock file system calls for both files
      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn()
        .mockResolvedValueOnce('{"name": "test-project", "version": "1.0.0"}')
        .mockResolvedValueOnce('{"compilerOptions": {"strict": true, "target": "ES2022"}}');

      const result = await analyzer.parseConfigurations();

      expect(mockGetConfigurationInfoList).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'package.json',
        isValid: true
      });
      expect(result[1]).toMatchObject({
        name: 'tsconfig.json',
        isValid: true,
        compilerOptions: expect.objectContaining({
          strict: true,
          target: 'ES2022'
        })
      });

      mockGetConfigurationInfoList.mockRestore();
    });

    it('should handle empty configuration list from getConfigurationInfoList', async () => {
      const mockGetConfigurationInfoList = vi.spyOn(analyzer, 'getConfigurationInfoList')
        .mockResolvedValue([]);

      const result = await analyzer.parseConfigurations();

      expect(mockGetConfigurationInfoList).toHaveBeenCalledOnce();
      expect(result).toEqual([]);

      mockGetConfigurationInfoList.mockRestore();
    });
  });

  describe('error recovery and resilience', () => {
    it('should continue processing other configurations when one fails', async () => {
      const configs = [
        {
          name: 'valid.json',
          path: 'valid.json',
          format: 'json' as const,
          purpose: 'other' as const,
          isValid: true
        },
        {
          name: 'error.json',
          path: 'error.json',
          format: 'json' as const,
          purpose: 'other' as const,
          isValid: true
        },
        {
          name: 'another-valid.json',
          path: 'another-valid.json',
          format: 'json' as const,
          purpose: 'other' as const,
          isValid: true
        }
      ];

      mockFs.promises.access = vi.fn()
        .mockResolvedValueOnce(undefined) // valid.json exists
        .mockRejectedValueOnce(new Error('File not found')) // error.json fails
        .mockResolvedValueOnce(undefined); // another-valid.json exists

      mockFs.promises.readFile = vi.fn()
        .mockResolvedValueOnce('{"status": "ok"}') // valid.json
        .mockResolvedValueOnce('{"another": "ok"}'); // another-valid.json

      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        name: 'valid.json',
        isValid: true,
        parsed: { status: 'ok' }
      });
      expect(result[1]).toMatchObject({
        name: 'error.json',
        isValid: false,
        parseError: 'File not found: error.json'
      });
      expect(result[2]).toMatchObject({
        name: 'another-valid.json',
        isValid: true,
        parsed: { another: 'ok' }
      });
    });

    it('should handle unexpected exceptions during parsing gracefully', async () => {
      const configs = [
        {
          name: 'exception.json',
          path: 'exception.json',
          format: 'json' as const,
          purpose: 'other' as const,
          isValid: true
        }
      ];

      // Mock file exists but reading throws unexpected error
      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockRejectedValue(new Error('Disk full'));

      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'exception.json',
        isValid: false,
        parseError: 'Failed to read file: Disk full'
      });
    });
  });

  describe('performance and concurrency', () => {
    it('should handle large number of configurations efficiently', async () => {
      // Create 10 configuration files
      const configs = Array.from({ length: 10 }, (_, i) => ({
        name: `config-${i}.json`,
        path: `configs/config-${i}.json`,
        format: 'json' as const,
        purpose: 'other' as const,
        isValid: true
      }));

      // Mock all files exist and contain valid JSON
      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockImplementation((filePath) => {
        const index = (filePath as string).match(/config-(\d+)\.json$/)?.[1] || '0';
        return Promise.resolve(`{"config": ${index}, "value": "test-${index}"}`);
      });

      const startTime = Date.now();
      const result = await analyzer.parseConfigurations(configs);
      const endTime = Date.now();

      expect(result).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify all configurations were processed
      result.forEach((config, index) => {
        expect(config).toMatchObject({
          name: `config-${index}.json`,
          isValid: true,
          parsed: {
            config: index,
            value: `test-${index}`
          }
        });
      });
    });
  });

  describe('real-world configuration scenarios', () => {
    it('should handle a complete TypeScript project configuration set', async () => {
      const configs = [
        {
          name: 'package.json',
          path: 'package.json',
          format: 'json' as const,
          purpose: 'package-manager' as const,
          isValid: true
        },
        {
          name: 'tsconfig.json',
          path: 'tsconfig.json',
          format: 'json' as const,
          purpose: 'typescript' as const,
          isValid: true
        },
        {
          name: '.eslintrc.json',
          path: '.eslintrc.json',
          format: 'json' as const,
          purpose: 'linting' as const,
          isValid: true
        },
        {
          name: 'jest.config.json',
          path: 'jest.config.json',
          format: 'json' as const,
          purpose: 'testing' as const,
          isValid: true
        }
      ];

      const packageJsonContent = JSON.stringify({
        name: '@company/awesome-project',
        version: '2.1.0',
        scripts: {
          build: 'tsc',
          test: 'jest',
          lint: 'eslint src/',
          dev: 'ts-node src/index.ts'
        },
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.21'
        },
        devDependencies: {
          '@types/node': '^18.0.0',
          'typescript': '^5.0.0',
          'jest': '^29.0.0',
          'eslint': '^8.0.0'
        }
      });

      const tsconfigContent = JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'node',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: './dist',
          rootDir: './src'
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist', '**/*.test.ts']
      });

      const eslintContent = JSON.stringify({
        extends: ['@typescript-eslint/recommended'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        rules: {
          'no-console': 'warn',
          '@typescript-eslint/no-unused-vars': 'error',
          'prefer-const': 'error'
        }
      });

      const jestContent = JSON.stringify({
        preset: 'ts-jest',
        testEnvironment: 'node',
        testMatch: ['**/*.test.ts', '**/*.spec.ts'],
        collectCoverage: true,
        coverageDirectory: 'coverage',
        coverageReporters: ['text', 'lcov', 'html']
      });

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn()
        .mockResolvedValueOnce(packageJsonContent)
        .mockResolvedValueOnce(tsconfigContent)
        .mockResolvedValueOnce(eslintContent)
        .mockResolvedValueOnce(jestContent);

      const result = await analyzer.parseConfigurations(configs);

      expect(result).toHaveLength(4);

      // Verify package.json parsing
      expect(result[0]).toMatchObject({
        name: 'package.json',
        isValid: true,
        scripts: {
          build: 'tsc',
          test: 'jest',
          lint: 'eslint src/',
          dev: 'ts-node src/index.ts'
        },
        dependencies: expect.objectContaining({
          runtime: { 'express': '^4.18.0', 'lodash': '^4.17.21' },
          development: expect.objectContaining({
            '@types/node': '^18.0.0',
            'typescript': '^5.0.0',
            'jest': '^29.0.0',
            'eslint': '^8.0.0'
          })
        })
      });

      // Verify tsconfig.json parsing
      expect(result[1]).toMatchObject({
        name: 'tsconfig.json',
        isValid: true,
        compilerOptions: expect.objectContaining({
          target: 'ES2022',
          module: 'NodeNext',
          strict: true,
          outDir: './dist',
          rootDir: './src'
        })
      });

      // Verify eslint configuration parsing
      expect(result[2]).toMatchObject({
        name: '.eslintrc.json',
        isValid: true,
        lintConfig: expect.objectContaining({
          extends: ['@typescript-eslint/recommended'],
          parser: '@typescript-eslint/parser',
          rules: expect.objectContaining({
            'no-console': 'warn',
            '@typescript-eslint/no-unused-vars': 'error'
          })
        })
      });

      // Verify jest configuration parsing
      expect(result[3]).toMatchObject({
        name: 'jest.config.json',
        isValid: true,
        testConfig: expect.objectContaining({
          preset: 'ts-jest',
          testEnvironment: 'node',
          collectCoverage: true,
          coverageDirectory: 'coverage'
        })
      });
    });

    it('should handle configurations with complex nested structures', async () => {
      const webpackContent = JSON.stringify({
        mode: 'production',
        entry: {
          main: './src/index.js',
          admin: './src/admin.js'
        },
        output: {
          path: '/dist',
          filename: '[name].[contenthash].js',
          chunkFilename: '[name].[contenthash].chunk.js',
          publicPath: '/assets/'
        },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              use: [
                {
                  loader: 'ts-loader',
                  options: {
                    transpileOnly: true
                  }
                }
              ],
              exclude: /node_modules/
            },
            {
              test: /\.css$/,
              use: ['style-loader', 'css-loader']
            }
          ]
        },
        resolve: {
          extensions: ['.tsx', '.ts', '.js', '.jsx'],
          alias: {
            '@': './src',
            '@components': './src/components'
          }
        },
        optimization: {
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all'
              }
            }
          }
        }
      });

      const configInfo = {
        name: 'webpack.config.json',
        path: 'webpack.config.json',
        format: 'json' as const,
        purpose: 'build' as const,
        isValid: true
      };

      mockFs.promises.access = vi.fn().mockResolvedValue(undefined);
      mockFs.promises.readFile = vi.fn().mockResolvedValue(webpackContent);

      const result = await analyzer.parseConfigurations([configInfo]);

      expect(result[0]).toMatchObject({
        name: 'webpack.config.json',
        isValid: true,
        parsed: expect.objectContaining({
          mode: 'production',
          entry: expect.objectContaining({
            main: './src/index.js',
            admin: './src/admin.js'
          }),
          module: expect.objectContaining({
            rules: expect.arrayContaining([
              expect.objectContaining({
                test: {},
                use: expect.any(Array)
              })
            ])
          })
        }),
        buildConfig: expect.objectContaining({
          mode: 'production',
          entry: expect.objectContaining({
            main: './src/index.js',
            admin: './src/admin.js'
          })
        })
      });
    });
  });
});