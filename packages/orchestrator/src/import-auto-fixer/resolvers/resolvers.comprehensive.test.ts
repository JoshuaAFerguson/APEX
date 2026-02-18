/**
 * Comprehensive Resolver Tests
 *
 * Tests all resolver types with various scenarios and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalResolver } from './local-resolver';
import { AliasResolver } from './alias-resolver';
import { PackageResolver } from './package-resolver';
import type {
  ResolverContext,
  ImportResolution,
  LocalResolverConfig,
  AliasResolverConfig,
  PackageResolverConfig,
  MissingImport,
} from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('Resolver Comprehensive Tests', () => {
  const projectPath = '/test/project';
  const testFilePath = path.join(projectPath, 'src/components/Button.tsx');

  let baseContext: ResolverContext;

  beforeEach(() => {
    vi.clearAllMocks();

    baseContext = {
      filePath: testFilePath,
      projectPath,
      tsConfig: {
        configPath: path.join(projectPath, 'tsconfig.json'),
        compilerOptions: {
          baseUrl: './src',
          paths: {
            '@/*': ['*'],
            '@components/*': ['components/*'],
            '@utils/*': ['utils/*'],
            '@types/*': ['types/*'],
          },
        },
      },
      packageJson: {
        packagePath: path.join(projectPath, 'package.json'),
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
          lodash: '^4.17.0',
          'date-fns': '^2.29.0',
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          '@types/lodash': '^4.14.0',
        },
      },
      existingImports: [],
      missingImport: {
        identifier: 'test',
        line: 1,
        column: 1,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LocalResolver', () => {
    let resolver: LocalResolver;

    beforeEach(() => {
      const config: LocalResolverConfig = {
        enabled: true,
        searchPaths: ['src', 'lib'],
        excludePatterns: ['**/node_modules/**', '**/*.test.*'],
      };
      resolver = new LocalResolver(config);
    });

    describe('canResolve()', () => {
      it('should resolve local file exports', async () => {
        mockFs.readdir.mockResolvedValue([
          'Button.tsx',
          'Input.tsx',
          'utils.ts',
        ] as any);

        mockFs.readFile.mockResolvedValue(`
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export const PI = 3.14159;

export default function defaultUtil() {
  return 'default';
}
`);

        const canResolve = await resolver.canResolve('formatNumber', baseContext);
        expect(canResolve).toBe(true);
    });

      it('should not resolve non-existent exports', async () => {
        mockFs.readdir.mockResolvedValue(['Button.tsx'] as any);
        mockFs.readFile.mockResolvedValue('export const otherFunction = () => {};');

        const canResolve = await resolver.canResolve('nonExistentFunction', baseContext);
        expect(canResolve).toBe(false);
      });

      it('should handle file system errors gracefully', async () => {
        mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

        const canResolve = await resolver.canResolve('someFunction', baseContext);
        expect(canResolve).toBe(false);
      });
    });

    describe('resolve()', () => {
      it('should resolve named exports correctly', async () => {
        mockFs.readdir.mockResolvedValue(['utils.ts'] as any);
        mockFs.readFile.mockResolvedValue(`
export function formatNumber(num: number): string { return ''; }
export const PI = 3.14;
`);

        const resolution = await resolver.resolve('formatNumber', baseContext);

        expect(resolution).toMatchObject({
          source: './utils',
          importType: 'named',
          isTypeOnly: false,
          confidence: 1.0,
          resolvedBy: 'local-resolver',
        });
      });

      it('should resolve default exports', async () => {
        mockFs.readdir.mockResolvedValue(['Button.tsx'] as any);
        mockFs.readFile.mockResolvedValue(`
import React from 'react';

export default function Button() {
  return <button>Click me</button>;
}
`);

        const resolution = await resolver.resolve('Button', baseContext);

        expect(resolution).toMatchObject({
          source: '../Button',
          importType: 'default',
          isTypeOnly: false,
          confidence: 1.0,
          resolvedBy: 'local-resolver',
        });
      });

      it('should resolve TypeScript type exports', async () => {
        mockFs.readdir.mockResolvedValue(['types.ts'] as any);
        mockFs.readFile.mockResolvedValue(`
export interface User {
  id: number;
  name: string;
}

export type Status = 'active' | 'inactive';
`);

        const typeContext = {
          ...baseContext,
          missingImport: {
            ...baseContext.missingImport,
            identifier: 'User',
            isTypeOnly: true,
          },
        };

        const resolution = await resolver.resolve('User', typeContext);

        expect(resolution).toMatchObject({
          source: '../types',
          importType: 'named',
          isTypeOnly: true,
          confidence: 1.0,
          resolvedBy: 'local-resolver',
        });
      });

      it('should resolve relative paths correctly from different directories', async () => {
        const deepFilePath = path.join(projectPath, 'src/components/forms/InputField.tsx');
        const deepContext = {
          ...baseContext,
          filePath: deepFilePath,
        };

        mockFs.readdir.mockImplementation(async (dirPath: any) => {
          if (dirPath.includes('utils')) {
            return ['validation.ts'] as any;
          }
          return [] as any;
        });

        mockFs.readFile.mockResolvedValue('export const validateEmail = () => true;');

        const resolution = await resolver.resolve('validateEmail', deepContext);

        expect(resolution).toMatchObject({
          source: '../../utils/validation',
          importType: 'named',
          resolvedBy: 'local-resolver',
        });
      });

      it('should exclude test files from resolution', async () => {
        mockFs.readdir.mockResolvedValue([
          'utils.ts',
          'utils.test.ts',
          'utils.spec.ts',
        ] as any);

        mockFs.readFile.mockImplementation(async (filePath: any) => {
          if (filePath.includes('.test.') || filePath.includes('.spec.')) {
            return 'export const testFunction = () => {};';
          }
          return 'export const utilFunction = () => {};';
        });

        const resolution = await resolver.resolve('testFunction', baseContext);
        expect(resolution).toBeNull();

        const validResolution = await resolver.resolve('utilFunction', baseContext);
        expect(validResolution).not.toBeNull();
      });
    });
  });

  describe('AliasResolver', () => {
    let resolver: AliasResolver;

    beforeEach(() => {
      const config: AliasResolverConfig = {
        enabled: true,
        customMappings: {
          '@custom/*': ['custom/*'],
        },
      };
      resolver = new AliasResolver(config);
    });

    describe('canResolve()', () => {
      it('should resolve tsconfig path mappings', async () => {
        mockFs.readdir.mockResolvedValue(['Button.tsx'] as any);
        mockFs.readFile.mockResolvedValue('export default function Button() {}');

        const canResolve = await resolver.canResolve('Button', baseContext);
        expect(canResolve).toBe(true);
      });

      it('should resolve custom path mappings', async () => {
        const customContext = {
          ...baseContext,
          tsConfig: {
            ...baseContext.tsConfig!,
            compilerOptions: {
              ...baseContext.tsConfig!.compilerOptions,
              paths: {
                '@custom/*': ['custom/*'],
              },
            },
          },
        };

        mockFs.readdir.mockResolvedValue(['helpers.ts'] as any);
        mockFs.readFile.mockResolvedValue('export const helper = () => {};');

        const canResolve = await resolver.canResolve('helper', customContext);
        expect(canResolve).toBe(true);
      });

      it('should handle missing tsconfig gracefully', async () => {
        const noTsConfigContext = {
          ...baseContext,
          tsConfig: undefined,
        };

        const canResolve = await resolver.canResolve('someFunction', noTsConfigContext);
        expect(canResolve).toBe(false);
      });
    });

    describe('resolve()', () => {
      it('should generate correct alias imports', async () => {
        mockFs.readdir.mockResolvedValue(['utils.ts'] as any);
        mockFs.readFile.mockResolvedValue('export const formatDate = () => {};');

        const resolution = await resolver.resolve('formatDate', baseContext);

        expect(resolution).toMatchObject({
          source: '@/utils',
          importType: 'named',
          confidence: 0.9,
          resolvedBy: 'alias-resolver',
        });
      });

      it('should prioritize more specific alias patterns', async () => {
        mockFs.readdir.mockResolvedValue(['validation.ts'] as any);
        mockFs.readFile.mockResolvedValue('export const isValid = () => true;');

        const resolution = await resolver.resolve('isValid', baseContext);

        expect(resolution?.source).toBe('@utils/validation');
      });

      it('should handle baseUrl resolution', async () => {
        const noPathsContext = {
          ...baseContext,
          tsConfig: {
            ...baseContext.tsConfig!,
            compilerOptions: {
              baseUrl: './src',
              // No paths defined
            },
          },
        };

        mockFs.readdir.mockResolvedValue(['constants.ts'] as any);
        mockFs.readFile.mockResolvedValue('export const API_URL = "https://api.example.com";');

        const resolution = await resolver.resolve('API_URL', noPathsContext);

        expect(resolution?.source).toBe('constants');
      });
    });
  });

  describe('PackageResolver', () => {
    let resolver: PackageResolver;

    beforeEach(() => {
      const config: PackageResolverConfig = {
        enabled: true,
        preferredPackages: {
          React: 'react',
          useState: 'react',
          _: 'lodash',
          map: 'lodash',
          format: 'date-fns',
        },
        excludePackages: ['deprecated-package'],
      };
      resolver = new PackageResolver(config);
    });

    describe('canResolve()', () => {
      it('should resolve known package exports', async () => {
        const canResolve = await resolver.canResolve('React', baseContext);
        expect(canResolve).toBe(true);
      });

      it('should resolve package dependencies', async () => {
        const canResolve = await resolver.canResolve('useState', baseContext);
        expect(canResolve).toBe(true);
      });

      it('should not resolve excluded packages', async () => {
        const excludeContext = {
          ...baseContext,
          packageJson: {
            ...baseContext.packageJson!,
            dependencies: {
              'deprecated-package': '^1.0.0',
            },
          },
        };

        const canResolve = await resolver.canResolve('deprecatedFunction', excludeContext);
        expect(canResolve).toBe(false);
      });

      it('should not resolve unknown packages', async () => {
        const canResolve = await resolver.canResolve('unknownFunction', baseContext);
        expect(canResolve).toBe(false);
      });
    });

    describe('resolve()', () => {
      it('should resolve React default import', async () => {
        const resolution = await resolver.resolve('React', baseContext);

        expect(resolution).toMatchObject({
          source: 'react',
          importType: 'default',
          isTypeOnly: false,
          confidence: 0.95,
          resolvedBy: 'package-resolver',
        });
      });

      it('should resolve React named imports', async () => {
        const resolution = await resolver.resolve('useState', baseContext);

        expect(resolution).toMatchObject({
          source: 'react',
          importType: 'named',
          isTypeOnly: false,
          confidence: 0.9,
          resolvedBy: 'package-resolver',
        });
      });

      it('should resolve lodash imports', async () => {
        const defaultResolution = await resolver.resolve('_', baseContext);
        expect(defaultResolution?.source).toBe('lodash');
        expect(defaultResolution?.importType).toBe('default');

        const namedResolution = await resolver.resolve('map', baseContext);
        expect(namedResolution?.source).toBe('lodash');
        expect(namedResolution?.importType).toBe('named');
      });

      it('should resolve type imports for TypeScript', async () => {
        const typeContext = {
          ...baseContext,
          missingImport: {
            ...baseContext.missingImport,
            identifier: 'ReactNode',
            isTypeOnly: true,
          },
        };

        const resolution = await resolver.resolve('ReactNode', typeContext);

        expect(resolution).toMatchObject({
          source: 'react',
          importType: 'named',
          isTypeOnly: true,
          confidence: 0.9,
          resolvedBy: 'package-resolver',
        });
      });

      it('should handle packages not in dependencies', async () => {
        const resolution = await resolver.resolve('unknownPackageFunction', baseContext);
        expect(resolution).toBeNull();
      });

      it('should suggest common package patterns', async () => {
        // Test for common patterns that might be guessed
        const momentContext = {
          ...baseContext,
          packageJson: {
            ...baseContext.packageJson!,
            dependencies: {
              moment: '^2.29.0',
            },
          },
        };

        const resolution = await resolver.resolve('moment', momentContext);
        expect(resolution?.source).toBe('moment');
        expect(resolution?.importType).toBe('default');
      });
    });
  });

  describe('Resolver Priority and Integration', () => {
    it('should respect resolver priority ordering', () => {
      const localResolver = new LocalResolver({ enabled: true, searchPaths: [], excludePatterns: [] });
      const aliasResolver = new AliasResolver({ enabled: true });
      const packageResolver = new PackageResolver({
        enabled: true,
        preferredPackages: {},
        excludePackages: [],
      });

      expect(localResolver.priority).toBeLessThan(aliasResolver.priority);
      expect(aliasResolver.priority).toBeLessThan(packageResolver.priority);
    });

    it('should handle resolver conflicts appropriately', async () => {
      // When multiple resolvers can resolve the same identifier,
      // the one with higher priority should be preferred
      const localResolver = new LocalResolver({
        enabled: true,
        searchPaths: ['src'],
        excludePatterns: [],
      });

      const packageResolver = new PackageResolver({
        enabled: true,
        preferredPackages: { Button: 'ui-library' },
        excludePackages: [],
      });

      // Mock local file existence
      mockFs.readdir.mockResolvedValue(['Button.tsx'] as any);
      mockFs.readFile.mockResolvedValue('export default function Button() {}');

      // Both should be able to resolve, but local should have higher priority
      const localCanResolve = await localResolver.canResolve('Button', baseContext);
      const packageCanResolve = await packageResolver.canResolve('Button', baseContext);

      expect(localCanResolve).toBe(true);
      expect(packageCanResolve).toBe(true);
      expect(localResolver.priority).toBeLessThan(packageResolver.priority);
    });

    it('should handle disabled resolvers', async () => {
      const disabledResolver = new LocalResolver({
        enabled: false,
        searchPaths: [],
        excludePatterns: [],
      });

      const canResolve = await disabledResolver.canResolve('anyFunction', baseContext);
      expect(canResolve).toBe(false);
    });
  });
});