/**
 * @fileoverview Comprehensive tests for DirectoryAccessValidator
 * Tests all aspects of path validation, security checks, and glob pattern matching
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { DirectoryAccessValidator, directoryAccessValidator, isPathAllowed, matchesAllowlist, matchesBlocklist } from '../directory-access-validator.js';
import type { PathValidationResult, ValidationOptions } from '../directory-access-validator.js';
import type { DirectoryAccessConfig } from '../types.js';

describe('DirectoryAccessValidator Comprehensive Tests', () => {
  describe('Class Instantiation and Singleton', () => {
    it('should create new validator instances', () => {
      const validator = new DirectoryAccessValidator();
      expect(validator).toBeInstanceOf(DirectoryAccessValidator);
    });

    it('should provide default singleton instance', () => {
      expect(directoryAccessValidator).toBeInstanceOf(DirectoryAccessValidator);
    });

    it('should have consistent behavior between instances', () => {
      const validator1 = new DirectoryAccessValidator();
      const validator2 = new DirectoryAccessValidator();

      const config: DirectoryAccessConfig = {
        allowlist: ['src/**/*.ts'],
        defaultAllow: false
      };

      const testPath = '/project/src/main.ts';
      const result1 = validator1.isPathAllowed(testPath, config);
      const result2 = validator2.isPathAllowed(testPath, config);

      expect(result1).toEqual(result2);
    });
  });

  describe('Path Normalization and Security', () => {
    it('should normalize relative paths to absolute paths', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['**/*.ts'],
        defaultAllow: false
      };

      // Test relative path normalization
      const result = validator.isPathAllowed('./src/main.ts', config, {
        baseDir: '/project'
      });

      expect(result.allowed).toBe(true);
      expect(result.matchType).toBe('allowlist');
    });

    it('should handle absolute paths directly', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['/project/src/**/*.ts'],
        defaultAllow: false
      };

      const result = validator.isPathAllowed('/project/src/main.ts', config);

      expect(result.allowed).toBe(true);
      expect(result.matchType).toBe('allowlist');
    });

    it('should reject paths with null bytes (security)', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = { defaultAllow: true };

      const maliciousPath = '/project/src/file\0hidden';
      const result = validator.isPathAllowed(maliciousPath, config);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Path validation error');
    });

    it('should reject excessively long paths', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = { defaultAllow: true };

      const longPath = '/project/' + 'a'.repeat(5000);
      const result = validator.isPathAllowed(longPath, config);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Path validation error');
    });

    it('should reject empty or invalid paths', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = { defaultAllow: true };

      const invalidPaths = ['', '   ', '\t\n'];

      invalidPaths.forEach(invalidPath => {
        const result = validator.isPathAllowed(invalidPath, config);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Path validation error');
      });
    });
  });

  describe('Glob Pattern Matching', () => {
    describe('Basic patterns', () => {
      it('should match simple file extensions', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['*.ts', '*.js'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/project/main.ts', expected: true },
          { path: '/project/script.js', expected: true },
          { path: '/project/data.json', expected: false },
          { path: '/project/readme.md', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });

      it('should match directory patterns', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['src/*', 'docs/*'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/project/src/main.ts', expected: true },
          { path: '/project/docs/readme.md', expected: true },
          { path: '/project/test/spec.ts', expected: false },
          { path: '/project/dist/output.js', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });
    });

    describe('Globstar patterns', () => {
      it('should match recursive directory patterns', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*.ts'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/project/src/main.ts', expected: true },
          { path: '/project/src/utils/helper.ts', expected: true },
          { path: '/project/src/deep/nested/path/file.ts', expected: true },
          { path: '/project/src/main.js', expected: false },
          { path: '/project/lib/util.ts', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });

      it('should handle multiple globstar patterns', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['**/src/**/*.ts', '**/test/**/*.test.js'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/any/path/src/file.ts', expected: true },
          { path: '/nested/project/src/deep/file.ts', expected: true },
          { path: '/project/test/unit/spec.test.js', expected: true },
          { path: '/app/test/integration/api.test.js', expected: true },
          { path: '/project/src/file.js', expected: false },
          { path: '/project/lib/test.ts', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });
    });

    describe('Complex pattern combinations', () => {
      it('should handle brace expansion patterns', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['*.{ts,js,json}', 'src/**/*.{tsx,jsx}'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/project/config.ts', expected: true },
          { path: '/project/script.js', expected: true },
          { path: '/project/data.json', expected: true },
          { path: '/project/src/component.tsx', expected: true },
          { path: '/project/src/widget.jsx', expected: true },
          { path: '/project/style.css', expected: false },
          { path: '/project/src/util.ts', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });

      it('should handle character class patterns', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['file[0-9].txt', 'test[abc].js'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/project/file1.txt', expected: true },
          { path: '/project/file9.txt', expected: true },
          { path: '/project/testa.js', expected: true },
          { path: '/project/testc.js', expected: true },
          { path: '/project/file10.txt', expected: false },
          { path: '/project/testd.js', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });
    });

    describe('Hidden files and dot patterns', () => {
      it('should handle hidden file patterns', () => {
        const validator = new DirectoryAccessValidator();
        const config: DirectoryAccessConfig = {
          allowlist: ['.*', '.git/**'],
          defaultAllow: false
        };

        const testCases = [
          { path: '/.env', expected: true },
          { path: '/.gitignore', expected: true },
          { path: '/.git/config', expected: true },
          { path: '/.git/objects/abc123', expected: true },
          { path: '/regular-file.txt', expected: false }
        ];

        testCases.forEach(({ path, expected }) => {
          const result = validator.isPathAllowed(path, config);
          expect(result.allowed).toBe(expected);
        });
      });
    });
  });

  describe('Allowlist and Blocklist Precedence', () => {
    it('should prioritize blocklist over allowlist', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['src/**/*.ts'],
        blocklist: ['src/secrets/**'],
        defaultAllow: false
      };

      const testCases = [
        { path: '/project/src/main.ts', expected: true, matchType: 'allowlist' },
        { path: '/project/src/utils/helper.ts', expected: true, matchType: 'allowlist' },
        { path: '/project/src/secrets/key.ts', expected: false, matchType: 'blocklist' },
        { path: '/project/src/secrets/config/api.ts', expected: false, matchType: 'blocklist' }
      ];

      testCases.forEach(({ path, expected, matchType }) => {
        const result = validator.isPathAllowed(path, config);
        expect(result.allowed).toBe(expected);
        expect(result.matchType).toBe(matchType);
      });
    });

    it('should handle overlapping allowlist and blocklist patterns', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['**/*.ts', '**/*.js'],
        blocklist: ['**/*.test.*', '**/node_modules/**'],
        defaultAllow: false
      };

      const testCases = [
        { path: '/project/src/main.ts', expected: true },
        { path: '/project/src/script.js', expected: true },
        { path: '/project/test/main.test.ts', expected: false },
        { path: '/project/src/spec.test.js', expected: false },
        { path: '/project/node_modules/lib/index.js', expected: false }
      ];

      testCases.forEach(({ path, expected }) => {
        const result = validator.isPathAllowed(path, config);
        expect(result.allowed).toBe(expected);
      });
    });
  });

  describe('Default Allow Behavior', () => {
    it('should respect explicit defaultAllow: true', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        blocklist: ['secrets/**'],
        defaultAllow: true
      };

      const testCases = [
        { path: '/project/src/main.ts', expected: true, matchType: 'default' },
        { path: '/project/docs/readme.md', expected: true, matchType: 'default' },
        { path: '/project/secrets/key.txt', expected: false, matchType: 'blocklist' }
      ];

      testCases.forEach(({ path, expected, matchType }) => {
        const result = validator.isPathAllowed(path, config);
        expect(result.allowed).toBe(expected);
        expect(result.matchType).toBe(matchType);
      });
    });

    it('should respect explicit defaultAllow: false', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['src/**'],
        defaultAllow: false
      };

      const testCases = [
        { path: '/project/src/main.ts', expected: true, matchType: 'allowlist' },
        { path: '/project/docs/readme.md', expected: false, matchType: 'default' },
        { path: '/project/lib/util.js', expected: false, matchType: 'default' }
      ];

      testCases.forEach(({ path, expected, matchType }) => {
        const result = validator.isPathAllowed(path, config);
        expect(result.allowed).toBe(expected);
        expect(result.matchType).toBe(matchType);
      });
    });

    it('should infer defaultAllow from allowlist presence', () => {
      const validator = new DirectoryAccessValidator();

      // Config with allowlist should default to deny
      const strictConfig: DirectoryAccessConfig = {
        allowlist: ['src/**']
      };

      const strictResult = validator.isPathAllowed('/project/docs/file.md', strictConfig);
      expect(strictResult.allowed).toBe(false);
      expect(strictResult.matchType).toBe('default');

      // Config without allowlist should default to allow
      const permissiveConfig: DirectoryAccessConfig = {
        blocklist: ['secrets/**']
      };

      const permissiveResult = validator.isPathAllowed('/project/docs/file.md', permissiveConfig);
      expect(permissiveResult.allowed).toBe(true);
      expect(permissiveResult.matchType).toBe('default');
    });
  });

  describe('Validation Options', () => {
    it('should handle baseDir option for relative paths', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['/custom/project/src/**'],
        defaultAllow: false
      };

      const options: ValidationOptions = {
        baseDir: '/custom/project'
      };

      const result = validator.isPathAllowed('./src/main.ts', config, options);
      expect(result.allowed).toBe(true);
    });

    it('should handle missing options gracefully', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['**/*.ts'],
        defaultAllow: false
      };

      // No options provided
      const result = validator.isPathAllowed('/project/main.ts', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    describe('matchesAllowlist', () => {
      it('should correctly identify allowlist matches', () => {
        const validator = new DirectoryAccessValidator();
        const patterns = ['src/**/*.ts', 'docs/*.md'];

        expect(validator.matchesAllowlist('/project/src/main.ts', patterns)).toBe(true);
        expect(validator.matchesAllowlist('/project/docs/readme.md', patterns)).toBe(true);
        expect(validator.matchesAllowlist('/project/test/spec.js', patterns)).toBe(false);
      });

      it('should handle empty patterns gracefully', () => {
        const validator = new DirectoryAccessValidator();
        expect(validator.matchesAllowlist('/any/path', [])).toBe(false);
        expect(validator.matchesAllowlist('/any/path', null as any)).toBe(false);
        expect(validator.matchesAllowlist('/any/path', undefined as any)).toBe(false);
      });

      it('should handle invalid paths gracefully', () => {
        const validator = new DirectoryAccessValidator();
        const patterns = ['src/**/*.ts'];

        expect(validator.matchesAllowlist('', patterns)).toBe(false);
        expect(validator.matchesAllowlist(null as any, patterns)).toBe(false);
      });
    });

    describe('matchesBlocklist', () => {
      it('should correctly identify blocklist matches', () => {
        const validator = new DirectoryAccessValidator();
        const patterns = ['secrets/**', '**/*.log'];

        expect(validator.matchesBlocklist('/project/secrets/key.txt', patterns)).toBe(true);
        expect(validator.matchesBlocklist('/project/debug.log', patterns)).toBe(true);
        expect(validator.matchesBlocklist('/project/src/main.ts', patterns)).toBe(false);
      });

      it('should handle empty patterns gracefully', () => {
        const validator = new DirectoryAccessValidator();
        expect(validator.matchesBlocklist('/any/path', [])).toBe(false);
        expect(validator.matchesBlocklist('/any/path', null as any)).toBe(false);
      });
    });
  });

  describe('Convenience Functions', () => {
    it('should provide isPathAllowed convenience function', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['src/**/*.ts'],
        defaultAllow: false
      };

      const result = isPathAllowed('/project/src/main.ts', config);
      expect(result.allowed).toBe(true);
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('matchType');
    });

    it('should provide matchesAllowlist convenience function', () => {
      const patterns = ['src/**/*.ts'];
      expect(matchesAllowlist('/project/src/main.ts', patterns)).toBe(true);
      expect(matchesAllowlist('/project/lib/util.js', patterns)).toBe(false);
    });

    it('should provide matchesBlocklist convenience function', () => {
      const patterns = ['secrets/**'];
      expect(matchesBlocklist('/project/secrets/key.txt', patterns)).toBe(true);
      expect(matchesBlocklist('/project/src/main.ts', patterns)).toBe(false);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical project structure restrictions', () => {
      const validator = new DirectoryAccessValidator();
      const projectConfig: DirectoryAccessConfig = {
        allowlist: [
          'src/**/*.{ts,tsx,js,jsx}',
          'test/**/*.{ts,tsx,js,jsx}',
          'docs/**/*.md',
          'config/*.{json,yaml,yml}',
          'package.json',
          'README.md'
        ],
        blocklist: [
          'node_modules/**',
          'dist/**',
          'build/**',
          '.git/**',
          '**/*.log',
          '**/*.env*',
          '**/secrets/**'
        ],
        defaultAllow: false
      };

      const testScenarios = [
        // Should be allowed
        { path: '/project/src/components/Button.tsx', expected: true },
        { path: '/project/test/unit/Button.test.ts', expected: true },
        { path: '/project/docs/api.md', expected: true },
        { path: '/project/config/database.json', expected: true },
        { path: '/project/package.json', expected: true },
        { path: '/project/README.md', expected: true },

        // Should be blocked
        { path: '/project/node_modules/react/index.js', expected: false },
        { path: '/project/dist/bundle.js', expected: false },
        { path: '/project/.git/config', expected: false },
        { path: '/project/error.log', expected: false },
        { path: '/project/.env.local', expected: false },
        { path: '/project/src/secrets/api-key.ts', expected: false },
        { path: '/project/random-file.txt', expected: false }
      ];

      testScenarios.forEach(({ path, expected }) => {
        const result = validator.isPathAllowed(path, projectConfig);
        expect(result.allowed).toBe(expected);
      });
    });

    it('should handle security-focused restrictions', () => {
      const validator = new DirectoryAccessValidator();
      const securityConfig: DirectoryAccessConfig = {
        allowlist: [
          'public/**',
          'src/components/**',
          'src/utils/**'
        ],
        blocklist: [
          'src/admin/**',
          'src/auth/**',
          'config/**',
          '**/*.key',
          '**/*.pem',
          '**/*.p12',
          '**/secrets/**',
          '**/private/**'
        ],
        defaultAllow: false
      };

      const securityTestCases = [
        // Safe files
        { path: '/app/public/logo.png', expected: true },
        { path: '/app/src/components/Header.tsx', expected: true },
        { path: '/app/src/utils/formatting.ts', expected: true },

        // Security-sensitive files
        { path: '/app/src/admin/users.ts', expected: false },
        { path: '/app/src/auth/jwt.ts', expected: false },
        { path: '/app/config/database.json', expected: false },
        { path: '/app/ssl/cert.key', expected: false },
        { path: '/app/ssl/cert.pem', expected: false },
        { path: '/app/secrets/api-keys.json', expected: false },
        { path: '/app/private/internal.md', expected: false }
      ];

      securityTestCases.forEach(({ path, expected }) => {
        const result = validator.isPathAllowed(path, securityConfig);
        expect(result.allowed).toBe(expected);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed patterns gracefully', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = {
        allowlist: ['[invalid-pattern', '**/*'], // First pattern is malformed
        defaultAllow: false
      };

      // Should still work with valid patterns
      const result = validator.isPathAllowed('/project/file.txt', config);
      expect(result.allowed).toBe(true);
    });

    it('should handle very long pattern lists', () => {
      const validator = new DirectoryAccessValidator();
      const manyPatterns = Array.from({ length: 1000 }, (_, i) => `pattern${i}/**`);
      const config: DirectoryAccessConfig = {
        allowlist: manyPatterns,
        defaultAllow: false
      };

      // Should complete without timeout or error
      const result = validator.isPathAllowed('/project/pattern500/file.txt', config);
      expect(result.allowed).toBe(true);
    });

    it('should provide clear error messages', () => {
      const validator = new DirectoryAccessValidator();
      const config: DirectoryAccessConfig = { defaultAllow: false };

      const errorCases = [
        { path: '', expectedReason: 'Path validation error' },
        { path: '   ', expectedReason: 'Path validation error' },
        { path: '/path/with\0null', expectedReason: 'Path validation error' }
      ];

      errorCases.forEach(({ path, expectedReason }) => {
        const result = validator.isPathAllowed(path, config);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain(expectedReason);
      });
    });
  });
});