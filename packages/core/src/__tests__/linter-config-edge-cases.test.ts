import { describe, it, expect } from 'vitest';
import {
  LinterConfigSchema,
  LinterGlobalConfigSchema,
  CustomLinterConfigSchema,
  ApexConfigSchema,
} from '../types.js';

describe('Linter Configuration Edge Cases and Error Paths', () => {
  describe('CustomLinterConfigSchema Edge Cases', () => {
    it('should reject missing required fields', () => {
      // Missing name
      expect(() => {
        CustomLinterConfigSchema.parse({
          enabled: true,
          command: 'test',
        });
      }).toThrow();

      // Missing enabled
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          command: 'test',
        });
      }).toThrow();

      // Missing command
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
        });
      }).toThrow();
    });

    it('should reject invalid field types', () => {
      // Invalid name type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 123,
          enabled: true,
          command: 'test',
        });
      }).toThrow();

      // Invalid enabled type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: 'true',
          command: 'test',
        });
      }).toThrow();

      // Invalid command type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: null,
        });
      }).toThrow();

      // Invalid args type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          args: 'not-an-array',
        });
      }).toThrow();

      // Invalid include type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          include: 'not-an-array',
        });
      }).toThrow();

      // Invalid exclude type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          exclude: { invalid: 'object' },
        });
      }).toThrow();

      // Invalid autoFix type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          autoFix: 'false',
        });
      }).toThrow();

      // Invalid timeoutMs type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          timeoutMs: 'not-a-number',
        });
      }).toThrow();

      // Invalid environment type
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          environment: 'not-an-object',
        });
      }).toThrow();
    });

    it('should handle edge values for numeric fields', () => {
      // Zero timeout should be valid
      const zeroTimeoutConfig = CustomLinterConfigSchema.parse({
        name: 'test',
        enabled: true,
        command: 'test',
        timeoutMs: 0,
      });
      expect(zeroTimeoutConfig.timeoutMs).toBe(0);

      // Very large timeout should be valid
      const largeTimeoutConfig = CustomLinterConfigSchema.parse({
        name: 'test',
        enabled: true,
        command: 'test',
        timeoutMs: Number.MAX_SAFE_INTEGER,
      });
      expect(largeTimeoutConfig.timeoutMs).toBe(Number.MAX_SAFE_INTEGER);

      // Negative timeout should be invalid
      expect(() => {
        CustomLinterConfigSchema.parse({
          name: 'test',
          enabled: true,
          command: 'test',
          timeoutMs: -1,
        });
      }).toThrow();
    });

    it('should handle empty arrays and strings', () => {
      const config = CustomLinterConfigSchema.parse({
        name: '',
        enabled: true,
        command: '',
        args: [],
        include: [],
        exclude: [],
        workingDirectory: '',
        description: '',
      });

      expect(config.name).toBe('');
      expect(config.command).toBe('');
      expect(config.args).toEqual([]);
      expect(config.include).toEqual([]);
      expect(config.exclude).toEqual([]);
      expect(config.workingDirectory).toBe('');
      expect(config.description).toBe('');
    });

    it('should handle environment with special characters', () => {
      const config = CustomLinterConfigSchema.parse({
        name: 'test',
        enabled: true,
        command: 'test',
        environment: {
          'VAR_WITH_UNDERSCORE': 'value',
          'VAR-WITH-DASH': 'value',
          'VAR123': 'value',
          'VAR_WITH_SPECIAL_CHARS': 'value!@#$%^&*()',
          'EMPTY': '',
          'WHITESPACE': '   ',
          'UNICODE': '你好世界',
        },
      });

      expect(config.environment).toBeDefined();
      expect(config.environment!['VAR_WITH_UNDERSCORE']).toBe('value');
      expect(config.environment!['UNICODE']).toBe('你好世界');
    });

    it('should reject invalid severity values beyond enum', () => {
      const invalidSeverities = ['debug', 'critical', 'fatal', 'notice', ''];

      for (const severity of invalidSeverities) {
        expect(() => {
          CustomLinterConfigSchema.parse({
            name: 'test',
            enabled: true,
            command: 'test',
            severity,
          });
        }).toThrow();
      }
    });

    it('should handle complex include/exclude patterns', () => {
      const config = CustomLinterConfigSchema.parse({
        name: 'complex-patterns',
        enabled: true,
        command: 'test',
        include: [
          '**/*.{ts,tsx,js,jsx}',
          'src/**/[!test]*.ts',
          'lib/**/*.js',
          '*.config.{js,ts}',
          '{src,lib,test}/**/*.ts',
        ],
        exclude: [
          '**/node_modules/**',
          '**/*.min.{js,css}',
          'dist/**',
          'build/**',
          '**/*.{test,spec}.{ts,js}',
          'coverage/**',
        ],
      });

      expect(config.include).toHaveLength(5);
      expect(config.exclude).toHaveLength(6);
      expect(config.include).toContain('**/*.{ts,tsx,js,jsx}');
      expect(config.exclude).toContain('**/node_modules/**');
    });
  });

  describe('LinterGlobalConfigSchema Edge Cases', () => {
    it('should handle boundary values for maxConcurrency', () => {
      // Minimum valid value
      const minConfig = LinterGlobalConfigSchema.parse({
        maxConcurrency: 1,
      });
      expect(minConfig.maxConcurrency).toBe(1);

      // Large value
      const largeConfig = LinterGlobalConfigSchema.parse({
        maxConcurrency: 100,
      });
      expect(largeConfig.maxConcurrency).toBe(100);

      // Invalid values
      expect(() => {
        LinterGlobalConfigSchema.parse({ maxConcurrency: 0 });
      }).toThrow();

      expect(() => {
        LinterGlobalConfigSchema.parse({ maxConcurrency: -5 });
      }).toThrow();

      expect(() => {
        LinterGlobalConfigSchema.parse({ maxConcurrency: 1.5 });
      }).toThrow();
    });

    it('should handle boundary values for timeoutMs', () => {
      // Minimum valid value
      const minConfig = LinterGlobalConfigSchema.parse({
        timeoutMs: 1,
      });
      expect(minConfig.timeoutMs).toBe(1);

      // Large value
      const largeConfig = LinterGlobalConfigSchema.parse({
        timeoutMs: 3600000, // 1 hour
      });
      expect(largeConfig.timeoutMs).toBe(3600000);

      // Invalid values
      expect(() => {
        LinterGlobalConfigSchema.parse({ timeoutMs: 0 });
      }).toThrow();

      expect(() => {
        LinterGlobalConfigSchema.parse({ timeoutMs: -1000 });
      }).toThrow();
    });

    it('should reject invalid boolean types', () => {
      const booleanFields = ['enabled', 'runOnCommit', 'runOnPush', 'runOnSave', 'parallel', 'failFast', 'cache'];

      for (const field of booleanFields) {
        expect(() => {
          LinterGlobalConfigSchema.parse({
            [field]: 'true',
          });
        }).toThrow();

        expect(() => {
          LinterGlobalConfigSchema.parse({
            [field]: 1,
          });
        }).toThrow();

        expect(() => {
          LinterGlobalConfigSchema.parse({
            [field]: null,
          });
        }).toThrow();
      }
    });

    it('should handle path edge cases', () => {
      const config = LinterGlobalConfigSchema.parse({
        cacheDirectory: '',
        workingDirectory: '',
      });

      expect(config.cacheDirectory).toBe('');
      expect(config.workingDirectory).toBe('');

      // Test with special path characters
      const specialPathConfig = LinterGlobalConfigSchema.parse({
        cacheDirectory: '/path/with spaces/cache',
        workingDirectory: '/path/with-dashes/and_underscores',
      });

      expect(specialPathConfig.cacheDirectory).toBe('/path/with spaces/cache');
      expect(specialPathConfig.workingDirectory).toBe('/path/with-dashes/and_underscores');
    });
  });

  describe('LinterConfigSchema Edge Cases', () => {
    it('should handle empty and null configurations gracefully', () => {
      // Empty object should parse with defaults
      const emptyConfig = LinterConfigSchema.parse({});
      expect(emptyConfig.eslint?.enabled).toBe(true);
      expect(emptyConfig.prettier?.enabled).toBe(true);
      expect(emptyConfig.custom).toEqual([]);

      // Null/undefined values should be rejected or use defaults
      const nullConfig = LinterConfigSchema.parse({
        eslint: undefined,
        prettier: undefined,
        custom: undefined,
      });
      expect(nullConfig.eslint?.enabled).toBe(true);
      expect(nullConfig.prettier?.enabled).toBe(true);
      expect(nullConfig.custom).toEqual([]);
    });

    it('should validate ESLint parserOptions edge cases', () => {
      const validConfig = LinterConfigSchema.parse({
        eslint: {
          enabled: true,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            ecmaFeatures: {
              jsx: false,
              globalReturn: true,
              impliedStrict: false,
            },
          },
        },
      });

      expect(validConfig.eslint?.parserOptions?.ecmaVersion).toBe('latest');
      expect(validConfig.eslint?.parserOptions?.sourceType).toBe('script');
      expect(validConfig.eslint?.parserOptions?.ecmaFeatures?.jsx).toBe(false);

      // Invalid parserOptions should be rejected
      expect(() => {
        LinterConfigSchema.parse({
          eslint: {
            enabled: true,
            parserOptions: {
              ecmaVersion: 'invalid',
            },
          },
        });
      }).toThrow();

      expect(() => {
        LinterConfigSchema.parse({
          eslint: {
            enabled: true,
            parserOptions: {
              sourceType: 'invalid',
            },
          },
        });
      }).toThrow();
    });

    it('should handle Prettier options with various types', () => {
      const config = LinterConfigSchema.parse({
        prettier: {
          enabled: true,
          options: {
            // String options
            semi: false,
            singleQuote: true,
            quoteProps: 'preserve',
            trailingComma: 'none',
            bracketSpacing: false,
            arrowParens: 'always',
            // Numeric options
            tabWidth: 8,
            printWidth: 120,
            // Boolean options
            useTabs: true,
            // Additional options
            endOfLine: 'crlf',
            embeddedLanguageFormatting: 'off',
          },
        },
      });

      expect(config.prettier?.options?.tabWidth).toBe(8);
      expect(config.prettier?.options?.printWidth).toBe(120);
      expect(config.prettier?.options?.endOfLine).toBe('crlf');
      expect(config.prettier?.options?.embeddedLanguageFormatting).toBe('off');
    });

    it('should validate integration linters array edge cases', () => {
      const config = LinterConfigSchema.parse({
        integrations: {
          preCommit: {
            enabled: true,
            linters: [],
          },
          ci: {
            enabled: true,
            linters: ['linter-with-dashes', 'linter_with_underscores', 'linter123'],
          },
        },
      });

      expect(config.integrations?.preCommit?.linters).toEqual([]);
      expect(config.integrations?.ci?.linters).toEqual([
        'linter-with-dashes',
        'linter_with_underscores',
        'linter123',
      ]);

      // Test with duplicate linters
      const duplicateConfig = LinterConfigSchema.parse({
        integrations: {
          ci: {
            enabled: true,
            linters: ['eslint', 'prettier', 'eslint'],
          },
        },
      });

      expect(duplicateConfig.integrations?.ci?.linters).toEqual(['eslint', 'prettier', 'eslint']);
    });

    it('should handle order array edge cases', () => {
      // Empty order array
      const emptyOrderConfig = LinterConfigSchema.parse({
        order: [],
      });
      expect(emptyOrderConfig.order).toEqual([]);

      // Order with duplicates
      const duplicateOrderConfig = LinterConfigSchema.parse({
        order: ['eslint', 'prettier', 'eslint'],
      });
      expect(duplicateOrderConfig.order).toEqual(['eslint', 'prettier', 'eslint']);

      // Order with non-standard linter names
      const customOrderConfig = LinterConfigSchema.parse({
        order: ['custom-linter-1', 'linter_with_underscores', '123numeric'],
      });
      expect(customOrderConfig.order).toEqual(['custom-linter-1', 'linter_with_underscores', '123numeric']);
    });

    it('should validate large configuration objects', () => {
      // Create a configuration with many custom linters
      const manyCustomLinters = Array.from({ length: 50 }, (_, i) => ({
        name: `custom-linter-${i}`,
        enabled: i % 2 === 0,
        command: `linter-${i}`,
        args: [`--arg${i}`, `--value=${i}`],
        include: [`src/**/*.type${i}`],
        exclude: [`**/*.exclude${i}`],
        severity: i % 3 === 0 ? 'error' as const : i % 3 === 1 ? 'warn' as const : 'info' as const,
      }));

      const largeConfig = LinterConfigSchema.parse({
        custom: manyCustomLinters,
        order: manyCustomLinters.map(l => l.name),
      });

      expect(largeConfig.custom).toHaveLength(50);
      expect(largeConfig.order).toHaveLength(50);
      expect(largeConfig.custom![0].name).toBe('custom-linter-0');
      expect(largeConfig.custom![49].name).toBe('custom-linter-49');
    });
  });

  describe('ApexConfigSchema Integration Edge Cases', () => {
    it('should handle malformed linter section in ApexConfig', () => {
      // Valid project with invalid linter section should be rejected
      expect(() => {
        ApexConfigSchema.parse({
          version: '1.0',
          project: {
            name: 'test-project',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          linter: 'invalid-linter-config',
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          version: '1.0',
          project: {
            name: 'test-project',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          linter: {
            global: 'invalid-global-config',
          },
        });
      }).toThrow();
    });

    it('should validate complex nested structures', () => {
      const complexConfig = {
        version: '1.0',
        project: {
          name: 'complex-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          global: {
            enabled: true,
            runOnCommit: true,
            maxConcurrency: 8,
          },
          eslint: {
            enabled: true,
            include: Array.from({ length: 20 }, (_, i) => `pattern${i}/**/*.ts`),
            exclude: Array.from({ length: 15 }, (_, i) => `exclude${i}/**`),
            cliOptions: Array.from({ length: 10 }, (_, i) => `--option${i}`),
            environments: Array.from({ length: 5 }, (_, i) => `env${i}`),
            parserOptions: {
              ecmaVersion: 2023,
              sourceType: 'module',
              ecmaFeatures: {
                jsx: true,
                globalReturn: false,
                impliedStrict: true,
              },
            },
          },
          custom: Array.from({ length: 10 }, (_, i) => ({
            name: `linter-${i}`,
            enabled: true,
            command: `cmd-${i}`,
            environment: Object.fromEntries(
              Array.from({ length: 5 }, (_, j) => [`ENV_${i}_${j}`, `value-${i}-${j}`])
            ),
          })),
        },
      };

      const result = ApexConfigSchema.parse(complexConfig);
      expect(result.linter?.custom).toHaveLength(10);
      expect(result.linter?.eslint?.include).toHaveLength(20);
      expect(result.linter?.eslint?.exclude).toHaveLength(15);
      expect(result.linter?.eslint?.cliOptions).toHaveLength(10);
    });

    it('should reject circular references and invalid nested objects', () => {
      // Test with null values in required nested fields
      expect(() => {
        ApexConfigSchema.parse({
          version: '1.0',
          project: null,
          linter: {
            global: {
              enabled: true,
            },
          },
        });
      }).toThrow();

      // Test with undefined in custom linter required fields
      expect(() => {
        ApexConfigSchema.parse({
          version: '1.0',
          project: {
            name: 'test-project',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          linter: {
            custom: [
              {
                name: undefined,
                enabled: true,
                command: 'test',
              },
            ],
          },
        });
      }).toThrow();
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle very long strings in configuration', () => {
      const longString = 'a'.repeat(10000);

      const config = CustomLinterConfigSchema.parse({
        name: longString,
        enabled: true,
        command: longString,
        args: [longString, longString],
        include: [longString],
        exclude: [longString],
        workingDirectory: longString,
        description: longString,
        environment: {
          [longString]: longString,
        },
      });

      expect(config.name).toHaveLength(10000);
      expect(config.command).toHaveLength(10000);
      expect(config.description).toHaveLength(10000);
      expect(Object.keys(config.environment!)[0]).toHaveLength(10000);
    });

    it('should handle arrays with many elements', () => {
      const manyPatterns = Array.from({ length: 1000 }, (_, i) => `pattern-${i}/**/*.ts`);
      const manyArgs = Array.from({ length: 100 }, (_, i) => `--arg-${i}`);

      const config = CustomLinterConfigSchema.parse({
        name: 'test-many-elements',
        enabled: true,
        command: 'test',
        args: manyArgs,
        include: manyPatterns,
        exclude: manyPatterns.slice(500),
      });

      expect(config.args).toHaveLength(100);
      expect(config.include).toHaveLength(1000);
      expect(config.exclude).toHaveLength(500);
    });
  });
});