/**
 * @fileoverview Tests for DirectoryAccessValidator
 *
 * This test suite provides comprehensive coverage for the DirectoryAccessValidator class,
 * including all methods and edge cases. It ensures >90% coverage as required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import {
  DirectoryAccessValidator,
  directoryAccessValidator,
  isPathAllowed,
  matchesAllowlist,
  matchesBlocklist,
  type PathValidationResult,
  type ValidationOptions
} from './directory-access-validator.js';
import type { DirectoryAccessConfig } from './types.js';

describe('DirectoryAccessValidator', () => {
  let validator: DirectoryAccessValidator;

  beforeEach(() => {
    validator = new DirectoryAccessValidator();
  });

  describe('constructor', () => {
    it('should create a new instance', () => {
      expect(validator).toBeInstanceOf(DirectoryAccessValidator);
    });
  });

  describe('isPathAllowed', () => {
    describe('basic functionality', () => {
      it('should allow path when no allowlist or blocklist is specified and defaultAllow is true', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: [],
          defaultAllow: true
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('default policy');
        expect(result.matchType).toBe('default');
      });

      it('should deny path when no allowlist or blocklist is specified and defaultAllow is false', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: [],
          defaultAllow: false
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('default policy');
        expect(result.matchType).toBe('default');
      });

      it('should infer defaultAllow as true when no allowlist is present', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: []
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('no patterns matched');
      });

      it('should infer defaultAllow as false when allowlist is present but no match', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*'],
          blocklist: []
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('allowlist present but no match');
      });
    });

    describe('allowlist matching', () => {
      it('should allow path that matches allowlist pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*', 'docs/*.md'],
          blocklist: [],
          defaultAllow: false
        };

        const result = validator.isPathAllowed('/project/src/main.ts', config);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('matches allowlist pattern');
        expect(result.matchType).toBe('allowlist');
      });

      it('should allow path that matches any allowlist pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*', 'docs/*.md'],
          blocklist: [],
          defaultAllow: false
        };

        const result = validator.isPathAllowed('/project/docs/readme.md', config);

        expect(result.allowed).toBe(true);
        expect(result.matchType).toBe('allowlist');
      });

      it('should handle glob patterns with braces', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.{js,ts,tsx}'],
          blocklist: [],
          defaultAllow: false
        };

        const jsResult = validator.isPathAllowed('/src/main.js', config);
        const tsResult = validator.isPathAllowed('/src/main.ts', config);
        const tsxResult = validator.isPathAllowed('/src/component.tsx', config);
        const pyResult = validator.isPathAllowed('/src/script.py', config);

        expect(jsResult.allowed).toBe(true);
        expect(tsResult.allowed).toBe(true);
        expect(tsxResult.allowed).toBe(true);
        expect(pyResult.allowed).toBe(false);
      });

      it('should handle glob patterns with brackets', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['file[0-9].txt'],
          blocklist: [],
          defaultAllow: false
        };

        const file1Result = validator.isPathAllowed('/test/file1.txt', config);
        const file9Result = validator.isPathAllowed('/test/file9.txt', config);
        const fileAResult = validator.isPathAllowed('/test/filea.txt', config);

        expect(file1Result.allowed).toBe(true);
        expect(file9Result.allowed).toBe(true);
        expect(fileAResult.allowed).toBe(false);
      });
    });

    describe('blocklist matching', () => {
      it('should deny path that matches blocklist pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: ['**/secrets/*', '**/*.log'],
          defaultAllow: false
        };

        const result = validator.isPathAllowed('/project/src/secrets/key.txt', config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('matches blocklist pattern');
        expect(result.matchType).toBe('blocklist');
      });

      it('should prioritize blocklist over allowlist', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*'],
          blocklist: ['src/secrets/*'],
          defaultAllow: false
        };

        // This path matches both allowlist and blocklist
        const result = validator.isPathAllowed('/project/src/secrets/key.txt', config);

        expect(result.allowed).toBe(false);
        expect(result.matchType).toBe('blocklist');
      });

      it('should handle multiple blocklist patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: ['**/*.log', '**/*.tmp', '**/node_modules/**'],
          defaultAllow: false
        };

        const logResult = validator.isPathAllowed('/app/debug.log', config);
        const tmpResult = validator.isPathAllowed('/temp/cache.tmp', config);
        const nodeModulesResult = validator.isPathAllowed('/project/node_modules/lib/index.js', config);
        const normalResult = validator.isPathAllowed('/src/main.ts', config);

        expect(logResult.allowed).toBe(false);
        expect(tmpResult.allowed).toBe(false);
        expect(nodeModulesResult.allowed).toBe(false);
        expect(normalResult.allowed).toBe(true);
      });
    });

    describe('path normalization', () => {
      it('should handle relative paths when baseDir is provided', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*'],
          blocklist: [],
          defaultAllow: false
        };

        const options: ValidationOptions = {
          baseDir: '/project'
        };

        const result = validator.isPathAllowed('src/main.ts', config, options);

        expect(result.allowed).toBe(true);
      });

      it('should handle relative paths with default baseDir (cwd)', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: [],
          defaultAllow: false
        };

        const result = validator.isPathAllowed('main.ts', config);

        expect(result.allowed).toBe(true);
      });

      it('should normalize path separators across platforms', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*'],
          blocklist: [],
          defaultAllow: false
        };

        // Test both forward and backward slashes
        const forwardResult = validator.isPathAllowed('/project/src/main.ts', config);
        const backwardResult = validator.isPathAllowed('\\project\\src\\main.ts', config);

        expect(forwardResult.allowed).toBe(true);
        expect(backwardResult.allowed).toBe(true);
      });

      it('should handle paths with .. components', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*'],
          blocklist: [],
          defaultAllow: false
        };

        const result = validator.isPathAllowed('/project/src/../src/main.ts', config);

        expect(result.allowed).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle empty path string', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true
        };

        const result = validator.isPathAllowed('', config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('validation error');
      });

      it('should handle whitespace-only path string', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true
        };

        const result = validator.isPathAllowed('   ', config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('validation error');
      });

      it('should handle non-string path', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true
        };

        const result = validator.isPathAllowed(null as any, config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('validation error');
      });

      it('should handle path with null bytes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true
        };

        const result = validator.isPathAllowed('/path/with\0null', config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('null bytes');
      });

      it('should handle excessively long path', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true
        };

        const longPath = '/path/' + 'a'.repeat(5000);
        const result = validator.isPathAllowed(longPath, config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('exceeds maximum length');
      });

      it('should handle invalid glob patterns gracefully', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['[invalid'],
          blocklist: [],
          defaultAllow: false
        };

        // Should not throw, should fall back to default behavior
        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(false);
        expect(result.matchType).toBe('default');
      });
    });

    describe('edge cases', () => {
      it('should handle undefined allowlist', () => {
        const config: DirectoryAccessConfig = {
          blocklist: [],
          defaultAllow: true
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(true);
      });

      it('should handle undefined blocklist', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*']
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(true);
      });

      it('should handle empty pattern arrays', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: []
        };

        const result = validator.isPathAllowed('/test/file.txt', config);

        expect(result.allowed).toBe(true);
      });

      it('should handle hidden files with dot patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: ['**/.*'],
          defaultAllow: false
        };

        const hiddenResult = validator.isPathAllowed('/project/.env', config);
        const normalResult = validator.isPathAllowed('/project/env.txt', config);

        expect(hiddenResult.allowed).toBe(false);
        expect(normalResult.allowed).toBe(true);
      });

      it('should handle globstar patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/test/**/*'],
          blocklist: [],
          defaultAllow: false
        };

        const deepResult = validator.isPathAllowed('/project/deep/test/nested/file.txt', config);
        const shallowResult = validator.isPathAllowed('/project/test/file.txt', config);
        const nonTestResult = validator.isPathAllowed('/project/src/file.txt', config);

        expect(deepResult.allowed).toBe(true);
        expect(shallowResult.allowed).toBe(true);
        expect(nonTestResult.allowed).toBe(false);
      });
    });
  });

  describe('matchesAllowlist', () => {
    it('should return true when path matches allowlist pattern', () => {
      const result = validator.matchesAllowlist('/src/main.ts', ['src/**/*']);
      expect(result).toBe(true);
    });

    it('should return false when path does not match allowlist pattern', () => {
      const result = validator.matchesAllowlist('/docs/readme.md', ['src/**/*']);
      expect(result).toBe(false);
    });

    it('should return true when path matches any pattern in allowlist', () => {
      const patterns = ['src/**/*', 'docs/*.md', '**/*.test.js'];

      expect(validator.matchesAllowlist('/src/main.ts', patterns)).toBe(true);
      expect(validator.matchesAllowlist('/docs/readme.md', patterns)).toBe(true);
      expect(validator.matchesAllowlist('/test/unit.test.js', patterns)).toBe(true);
      expect(validator.matchesAllowlist('/other/file.txt', patterns)).toBe(false);
    });

    it('should return false when patterns array is empty', () => {
      const result = validator.matchesAllowlist('/src/main.ts', []);
      expect(result).toBe(false);
    });

    it('should return false when patterns array is null/undefined', () => {
      expect(validator.matchesAllowlist('/src/main.ts', null as any)).toBe(false);
      expect(validator.matchesAllowlist('/src/main.ts', undefined as any)).toBe(false);
    });

    it('should handle errors gracefully and return false', () => {
      // Test with invalid path
      const result = validator.matchesAllowlist(null as any, ['**/*']);
      expect(result).toBe(false);
    });
  });

  describe('matchesBlocklist', () => {
    it('should return true when path matches blocklist pattern', () => {
      const result = validator.matchesBlocklist('/src/secrets/key.txt', ['**/secrets/*']);
      expect(result).toBe(true);
    });

    it('should return false when path does not match blocklist pattern', () => {
      const result = validator.matchesBlocklist('/src/main.ts', ['**/secrets/*']);
      expect(result).toBe(false);
    });

    it('should return true when path matches any pattern in blocklist', () => {
      const patterns = ['**/secrets/*', '**/*.log', '**/node_modules/**'];

      expect(validator.matchesBlocklist('/secrets/key.txt', patterns)).toBe(true);
      expect(validator.matchesBlocklist('/debug.log', patterns)).toBe(true);
      expect(validator.matchesBlocklist('/node_modules/lib/index.js', patterns)).toBe(true);
      expect(validator.matchesBlocklist('/src/main.ts', patterns)).toBe(false);
    });

    it('should return false when patterns array is empty', () => {
      const result = validator.matchesBlocklist('/src/main.ts', []);
      expect(result).toBe(false);
    });

    it('should return false when patterns array is null/undefined', () => {
      expect(validator.matchesBlocklist('/src/main.ts', null as any)).toBe(false);
      expect(validator.matchesBlocklist('/src/main.ts', undefined as any)).toBe(false);
    });

    it('should handle errors gracefully and return false', () => {
      // Test with invalid path
      const result = validator.matchesBlocklist(null as any, ['**/*']);
      expect(result).toBe(false);
    });
  });

  describe('private method coverage', () => {
    // Testing private methods through public API to ensure full coverage

    it('should validate path security through isPathAllowed', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['**/*'],
        blocklist: [],
        defaultAllow: true
      };

      // Test null byte validation
      const nullByteResult = validator.isPathAllowed('/path\0null', config);
      expect(nullByteResult.allowed).toBe(false);

      // Test long path validation
      const longPath = '/' + 'a'.repeat(5000);
      const longPathResult = validator.isPathAllowed(longPath, config);
      expect(longPathResult.allowed).toBe(false);
    });

    it('should handle pattern matching edge cases', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['', '   ', null as any, undefined as any],
        blocklist: [],
        defaultAllow: false
      };

      // These should not crash and should fall back to default behavior
      const result = validator.isPathAllowed('/test/file.txt', config);
      expect(result.matchType).toBe('default');
    });
  });
});

describe('convenience functions', () => {
  describe('isPathAllowed', () => {
    it('should use the default validator instance', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['**/*.ts'],
        blocklist: [],
        defaultAllow: false
      };

      const result = isPathAllowed('/src/main.ts', config);

      expect(result.allowed).toBe(true);
      expect(result.matchType).toBe('allowlist');
    });

    it('should accept validation options', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['src/**/*'],
        blocklist: [],
        defaultAllow: false
      };

      const options: ValidationOptions = {
        baseDir: '/project'
      };

      const result = isPathAllowed('src/main.ts', config, options);

      expect(result.allowed).toBe(true);
    });
  });

  describe('matchesAllowlist', () => {
    it('should use the default validator instance', () => {
      const result = matchesAllowlist('/src/main.ts', ['src/**/*']);
      expect(result).toBe(true);
    });
  });

  describe('matchesBlocklist', () => {
    it('should use the default validator instance', () => {
      const result = matchesBlocklist('/secrets/key.txt', ['**/secrets/*']);
      expect(result).toBe(true);
    });
  });
});

describe('default instance', () => {
  it('should export a default validator instance', () => {
    expect(directoryAccessValidator).toBeInstanceOf(DirectoryAccessValidator);
  });

  it('should work the same as a new instance', () => {
    const newValidator = new DirectoryAccessValidator();
    const config: DirectoryAccessConfig = {
      allowlist: ['**/*.ts'],
      blocklist: [],
      defaultAllow: false
    };

    const defaultResult = directoryAccessValidator.isPathAllowed('/src/main.ts', config);
    const newResult = newValidator.isPathAllowed('/src/main.ts', config);

    expect(defaultResult).toEqual(newResult);
  });
});

describe('integration with DirectoryAccessConfig types', () => {
  it('should work with all DirectoryAccessConfig properties', () => {
    const config: DirectoryAccessConfig = {
      allowlist: ['src/**/*', 'docs/*.md'],
      blocklist: ['**/secrets/*', '**/*.log'],
      defaultAllow: false,
      resolveSymlinks: true,
      maxDepth: 10
    };

    const allowedResult = validator.isPathAllowed('/src/main.ts', config);
    const blockedResult = validator.isPathAllowed('/src/secrets/key.txt', config);
    const deniedResult = validator.isPathAllowed('/other/file.txt', config);

    expect(allowedResult.allowed).toBe(true);
    expect(allowedResult.matchType).toBe('allowlist');

    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.matchType).toBe('blocklist');

    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.matchType).toBe('default');
  });

  it('should handle optional properties correctly', () => {
    // Minimal config with only required properties
    const minimalConfig: DirectoryAccessConfig = {};

    const result = validator.isPathAllowed('/any/file.txt', minimalConfig);

    // Should allow by default when no patterns are specified
    expect(result.allowed).toBe(true);
    expect(result.matchType).toBe('default');
  });
});