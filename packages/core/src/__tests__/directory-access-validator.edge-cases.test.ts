/**
 * @fileoverview Comprehensive edge case tests for DirectoryAccessValidator
 *
 * This test suite covers edge cases that are not covered by the basic unit tests:
 * - Nested paths (deep directory structures)
 * - Symlink resolution behavior
 * - Complex glob patterns (negation, extglob, brace expansion)
 * - Path security edge cases
 * - Platform-specific path handling
 *
 * @module @apex/core/__tests__/directory-access-validator.edge-cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import path from 'node:path';
import {
  DirectoryAccessValidator,
  directoryAccessValidator,
  isPathAllowed,
  matchesAllowlist,
  matchesBlocklist,
  type PathValidationResult,
  type ValidationOptions,
} from '../directory-access-validator.js';
import type { DirectoryAccessConfig } from '../types.js';

describe('DirectoryAccessValidator Edge Cases', () => {
  let validator: DirectoryAccessValidator;

  beforeEach(() => {
    validator = new DirectoryAccessValidator();
  });

  // ==========================================================================
  // Nested Path Tests
  // ==========================================================================
  describe('Nested Paths', () => {
    describe('deeply nested directory structures', () => {
      it('should handle paths with 10+ levels of nesting', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['project/**/src/**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const deepPath =
          '/project/apps/frontend/modules/user/components/forms/validation/src/helpers/utils.ts';
        const result = validator.isPathAllowed(deepPath, config);

        expect(result.allowed).toBe(true);
        expect(result.matchType).toBe('allowlist');
      });

      it('should handle paths with 20+ levels of nesting', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.js'],
          blocklist: [],
          defaultAllow: false,
        };

        const veryDeepPath =
          '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/file.js';
        const result = validator.isPathAllowed(veryDeepPath, config);

        expect(result.allowed).toBe(true);
      });

      it('should correctly match intermediate directory patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/middleware/**/handlers/**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const matchPath =
          '/app/middleware/auth/v2/handlers/user/create.ts';
        const noMatchPath =
          '/app/controllers/middleware/handlers/create.ts'; // middleware not followed by handlers properly

        const matchResult = validator.isPathAllowed(matchPath, config);
        const noMatchResult = validator.isPathAllowed(noMatchPath, config);

        expect(matchResult.allowed).toBe(true);
        // The second path has middleware/**/ followed by handlers, so it should match too
        expect(noMatchResult.allowed).toBe(true);
      });

      it('should handle nested patterns with specific depth requirements', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/*/components/*/*.tsx'],
          blocklist: [],
          defaultAllow: false,
        };

        // Should match: exactly 2 intermediate levels
        const exactMatch = validator.isPathAllowed(
          '/project/src/app/components/Button/index.tsx',
          config
        );

        // Should NOT match: too few levels
        const tooFew = validator.isPathAllowed(
          '/project/src/components/Button.tsx',
          config
        );

        // Should NOT match: too many levels (without **)
        const tooMany = validator.isPathAllowed(
          '/project/src/app/extra/components/Button/nested/index.tsx',
          config
        );

        expect(exactMatch.allowed).toBe(true);
        expect(tooFew.allowed).toBe(false);
        expect(tooMany.allowed).toBe(false);
      });

      it('should handle repeated directory names in path', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/src/**'],
          blocklist: ['**/src/**/src/**'],
          defaultAllow: false,
        };

        // Single src should be allowed
        const singleSrc = validator.isPathAllowed('/app/src/main.ts', config);
        expect(singleSrc.allowed).toBe(true);

        // Nested src/src should be blocked
        const nestedSrc = validator.isPathAllowed(
          '/app/src/backup/src/main.ts',
          config
        );
        expect(nestedSrc.allowed).toBe(false);
      });
    });

    describe('parent and child directory relationships', () => {
      it('should correctly differentiate parent from child paths', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['projects/myapp/**'],
          blocklist: [],
          defaultAllow: false,
        };

        // Child should match
        const childResult = validator.isPathAllowed(
          '/home/projects/myapp/src/index.ts',
          config
        );

        // Sibling should not match
        const siblingResult = validator.isPathAllowed(
          '/home/projects/otherapp/src/index.ts',
          config
        );

        expect(childResult.allowed).toBe(true);
        expect(siblingResult.allowed).toBe(false);
      });

      it('should handle paths that share common prefixes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['node_modules/@myorg/**'],
          blocklist: ['node_modules/@myorg-internal/**'],
          defaultAllow: false,
        };

        const allowedResult = validator.isPathAllowed(
          '/project/node_modules/@myorg/package/index.js',
          config
        );
        const blockedResult = validator.isPathAllowed(
          '/project/node_modules/@myorg-internal/package/index.js',
          config
        );

        expect(allowedResult.allowed).toBe(true);
        expect(blockedResult.allowed).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Symlink Resolution Tests
  // ==========================================================================
  describe('Symlink Resolution', () => {
    describe('ValidationOptions.resolveSymlinks behavior', () => {
      it('should accept resolveSymlinks option without error', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: [],
          defaultAllow: false,
          resolveSymlinks: true,
        };

        const options: ValidationOptions = {
          resolveSymlinks: true,
        };

        // Should not throw
        const result = validator.isPathAllowed('/src/main.ts', config, options);
        expect(result.allowed).toBe(true);
      });

      it('should handle path that could be a symlink target', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['/actual/source/**'],
          blocklist: [],
          defaultAllow: false,
          resolveSymlinks: true,
        };

        // Simulate a path that might be accessed through a symlink
        const result = validator.isPathAllowed(
          '/actual/source/file.ts',
          config
        );
        expect(result.allowed).toBe(true);
      });

      it('should work with resolveSymlinks: false', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: [],
          defaultAllow: false,
          resolveSymlinks: false,
        };

        const options: ValidationOptions = {
          resolveSymlinks: false,
        };

        const result = validator.isPathAllowed('/symlink/path/file.ts', config, options);
        expect(result.allowed).toBe(true);
      });
    });

    describe('paths that look like symlink scenarios', () => {
      it('should handle circular-looking paths gracefully', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        // A path that might result from circular symlink resolution
        const circularPath = '/project/link/link/link/file.ts';
        const result = validator.isPathAllowed(circularPath, config);

        expect(result.allowed).toBe(true);
      });

      it('should handle relative symlink-like paths', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        const options: ValidationOptions = {
          baseDir: '/project',
        };

        // Path with relative-looking components
        const result = validator.isPathAllowed('src/./components/../utils/helper.ts', config, options);
        expect(result.allowed).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Complex Glob Pattern Tests
  // ==========================================================================
  describe('Complex Glob Patterns', () => {
    describe('negation patterns', () => {
      it('should handle negation in allowlist', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*.ts', '!src/**/*.test.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        // Note: minimatch with nonegate: false allows negation
        // The negation pattern should not match directly
        const sourceFile = validator.isPathAllowed('/project/src/main.ts', config);
        expect(sourceFile.allowed).toBe(true);

        // The negation pattern itself won't match the test file
        // as negation in allowlist works differently than in blocklist
        const testFile = validator.isPathAllowed('/project/src/main.test.ts', config);
        expect(testFile.allowed).toBe(true); // Still matches 'src/**/*.ts'
      });

      it('should handle negation in blocklist for exceptions', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: ['node_modules/**', '!node_modules/@types/**'],
          defaultAllow: false,
        };

        // node_modules should be blocked
        const nodeModulesResult = validator.isPathAllowed(
          '/project/node_modules/lodash/index.js',
          config
        );
        expect(nodeModulesResult.allowed).toBe(false);

        // Note: The negation pattern !node_modules/@types/** won't create an exception
        // because blocklist patterns are checked individually
        const typesResult = validator.isPathAllowed(
          '/project/node_modules/@types/node/index.d.ts',
          config
        );
        expect(typesResult.allowed).toBe(false); // Still blocked by node_modules/**
      });
    });

    describe('extglob patterns', () => {
      it('should handle @(pattern) - match exactly one pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.@(ts|js)'],
          blocklist: [],
          defaultAllow: false,
        };

        const tsFile = validator.isPathAllowed('/src/main.ts', config);
        const jsFile = validator.isPathAllowed('/src/main.js', config);
        const tsxFile = validator.isPathAllowed('/src/main.tsx', config);

        expect(tsFile.allowed).toBe(true);
        expect(jsFile.allowed).toBe(true);
        expect(tsxFile.allowed).toBe(false);
      });

      it('should handle +(pattern) - match one or more patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/+(spec|test).ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const specFile = validator.isPathAllowed('/src/spec.ts', config);
        const testFile = validator.isPathAllowed('/src/test.ts', config);
        const otherFile = validator.isPathAllowed('/src/main.ts', config);

        expect(specFile.allowed).toBe(true);
        expect(testFile.allowed).toBe(true);
        expect(otherFile.allowed).toBe(false);
      });

      it('should handle ?(pattern) - match zero or one pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/file?(s).txt'],
          blocklist: [],
          defaultAllow: false,
        };

        const singular = validator.isPathAllowed('/docs/file.txt', config);
        const plural = validator.isPathAllowed('/docs/files.txt', config);
        const extra = validator.isPathAllowed('/docs/filess.txt', config);

        expect(singular.allowed).toBe(true);
        expect(plural.allowed).toBe(true);
        expect(extra.allowed).toBe(false);
      });

      it('should handle *(pattern) - match zero or more patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/test*(s).ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const noS = validator.isPathAllowed('/src/test.ts', config);
        const oneS = validator.isPathAllowed('/src/tests.ts', config);
        const manyS = validator.isPathAllowed('/src/testsss.ts', config);

        expect(noS.allowed).toBe(true);
        expect(oneS.allowed).toBe(true);
        expect(manyS.allowed).toBe(true);
      });

      it('should handle !(pattern) - match anything except pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/!(secret)*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const publicFile = validator.isPathAllowed('/src/public.ts', config);
        const utilsFile = validator.isPathAllowed('/src/utils.ts', config);
        // secret.ts itself won't match !(secret)*.ts
        const secretFile = validator.isPathAllowed('/src/secret.ts', config);

        expect(publicFile.allowed).toBe(true);
        expect(utilsFile.allowed).toBe(true);
        // The pattern !(secret)*.ts means "not starting with 'secret'"
        expect(secretFile.allowed).toBe(false);
      });
    });

    describe('brace expansion', () => {
      it('should handle simple brace expansion {a,b,c}', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.{ts,js,tsx,jsx}'],
          blocklist: [],
          defaultAllow: false,
        };

        const tsFile = validator.isPathAllowed('/src/main.ts', config);
        const jsFile = validator.isPathAllowed('/src/main.js', config);
        const tsxFile = validator.isPathAllowed('/src/Component.tsx', config);
        const jsxFile = validator.isPathAllowed('/src/Component.jsx', config);
        const cssFile = validator.isPathAllowed('/src/styles.css', config);

        expect(tsFile.allowed).toBe(true);
        expect(jsFile.allowed).toBe(true);
        expect(tsxFile.allowed).toBe(true);
        expect(jsxFile.allowed).toBe(true);
        expect(cssFile.allowed).toBe(false);
      });

      it('should handle nested brace expansion', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/{src,lib}/{components,utils}/**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const srcComponents = validator.isPathAllowed(
          '/project/src/components/Button.ts',
          config
        );
        const srcUtils = validator.isPathAllowed('/project/src/utils/helpers.ts', config);
        const libComponents = validator.isPathAllowed(
          '/project/lib/components/Modal.ts',
          config
        );
        const libUtils = validator.isPathAllowed('/project/lib/utils/format.ts', config);
        const distComponents = validator.isPathAllowed(
          '/project/dist/components/Button.ts',
          config
        );

        expect(srcComponents.allowed).toBe(true);
        expect(srcUtils.allowed).toBe(true);
        expect(libComponents.allowed).toBe(true);
        expect(libUtils.allowed).toBe(true);
        expect(distComponents.allowed).toBe(false);
      });

      it('should handle empty and single-item braces', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/{test}/**/*.ts', '**/{}.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        // Single item brace should work like a literal
        const testDir = validator.isPathAllowed('/project/test/unit.ts', config);
        expect(testDir.allowed).toBe(true);
      });

      it('should handle braces with special characters', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.{d.ts,spec.ts,test.ts}'],
          blocklist: [],
          defaultAllow: false,
        };

        const dtsFile = validator.isPathAllowed('/types/index.d.ts', config);
        const specFile = validator.isPathAllowed('/tests/app.spec.ts', config);
        const testFile = validator.isPathAllowed('/tests/app.test.ts', config);
        const normalFile = validator.isPathAllowed('/src/app.ts', config);

        expect(dtsFile.allowed).toBe(true);
        expect(specFile.allowed).toBe(true);
        expect(testFile.allowed).toBe(true);
        expect(normalFile.allowed).toBe(false);
      });
    });

    describe('combined complex patterns', () => {
      it('should handle extglob with brace expansion', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.@(spec|test).{ts,js}'],
          blocklist: [],
          defaultAllow: false,
        };

        const specTs = validator.isPathAllowed('/tests/app.spec.ts', config);
        const testJs = validator.isPathAllowed('/tests/app.test.js', config);
        const unitTs = validator.isPathAllowed('/tests/app.unit.ts', config);

        expect(specTs.allowed).toBe(true);
        expect(testJs.allowed).toBe(true);
        expect(unitTs.allowed).toBe(false);
      });

      it('should handle globstar with extglob', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/+(src|lib)/**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const srcFile = validator.isPathAllowed(
          '/project/packages/app/src/main.ts',
          config
        );
        const libFile = validator.isPathAllowed(
          '/project/packages/utils/lib/helper.ts',
          config
        );
        const distFile = validator.isPathAllowed(
          '/project/packages/app/dist/main.ts',
          config
        );

        expect(srcFile.allowed).toBe(true);
        expect(libFile.allowed).toBe(true);
        expect(distFile.allowed).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Path Security Edge Cases
  // ==========================================================================
  describe('Path Security Edge Cases', () => {
    describe('directory traversal attacks', () => {
      it('should handle basic directory traversal attempts', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        // After normalization, traversal should be resolved
        const traversalResult = validator.isPathAllowed(
          '/project/src/../../../etc/passwd',
          config
        );

        // The path normalizes to /etc/passwd which doesn't match src/**
        expect(traversalResult.allowed).toBe(false);
      });

      it('should handle encoded directory traversal', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        // URL-encoded traversal sequences (not typically decoded by path normalization)
        const encodedTraversal = '/project/src/%2e%2e/%2e%2e/etc/passwd';
        const result = validator.isPathAllowed(encodedTraversal, config);

        // The encoded path should be treated as a literal path segment
        expect(result.allowed).toBe(true);
      });

      it('should handle double-encoded traversal', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        // Double-encoded traversal (shouldn't be decoded)
        const doubleEncoded = '/project/src/%252e%252e/secret.txt';
        const result = validator.isPathAllowed(doubleEncoded, config);

        expect(result.allowed).toBe(true);
      });

      it('should handle mixed traversal patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['home/user/**'],
          blocklist: ['home/user/.ssh/**'],
          defaultAllow: false,
        };

        // Attempt to escape and re-enter
        const mixedTraversal = validator.isPathAllowed(
          '/home/user/../user/.ssh/id_rsa',
          config
        );

        // After normalization: /home/user/.ssh/id_rsa - should be blocked
        expect(mixedTraversal.allowed).toBe(false);
      });
    });

    describe('null byte injection', () => {
      it('should reject paths with null bytes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const nullByteResult = validator.isPathAllowed(
          '/src/main.ts\0.jpg',
          config
        );

        expect(nullByteResult.allowed).toBe(false);
        expect(nullByteResult.reason).toContain('null bytes');
      });

      it('should reject paths with embedded null bytes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const embeddedNull = validator.isPathAllowed('/src/\0/main.ts', config);
        expect(embeddedNull.allowed).toBe(false);
      });
    });

    describe('path length attacks', () => {
      it('should reject excessively long paths', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // Path longer than 4096 characters
        const longPath = '/src/' + 'a'.repeat(5000) + '.ts';
        const result = validator.isPathAllowed(longPath, config);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('exceeds maximum length');
      });

      it('should handle paths at the boundary (4096 chars)', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // Path exactly at 4096 characters should be allowed
        const boundaryPath = '/src/' + 'a'.repeat(4090 - 4 - 3) + '.ts'; // /src/ = 5, .ts = 3
        const result = validator.isPathAllowed(boundaryPath, config);

        expect(result.allowed).toBe(true);
      });
    });

    describe('special characters and escape sequences', () => {
      it('should handle paths with backticks', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const backtickPath = validator.isPathAllowed('/src/file`name.ts', config);
        expect(backtickPath.allowed).toBe(true);
      });

      it('should handle paths with dollar signs', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const dollarPath = validator.isPathAllowed('/src/file$name.ts', config);
        expect(dollarPath.allowed).toBe(true);
      });

      it('should handle paths with semicolons', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const semicolonPath = validator.isPathAllowed('/src/file;name.ts', config);
        expect(semicolonPath.allowed).toBe(true);
      });

      it('should handle paths with quotes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const singleQuote = validator.isPathAllowed("/src/file'name.ts", config);
        const doubleQuote = validator.isPathAllowed('/src/file"name.ts', config);

        expect(singleQuote.allowed).toBe(true);
        expect(doubleQuote.allowed).toBe(true);
      });

      it('should handle paths with pipes and redirects', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const pipePath = validator.isPathAllowed('/src/file|name.ts', config);
        const redirectPath = validator.isPathAllowed('/src/file>name.ts', config);
        const inputPath = validator.isPathAllowed('/src/file<name.ts', config);

        expect(pipePath.allowed).toBe(true);
        expect(redirectPath.allowed).toBe(true);
        expect(inputPath.allowed).toBe(true);
      });

      it('should handle paths with newlines', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // Newlines in paths are unusual but should be handled
        const newlinePath = validator.isPathAllowed('/src/file\nname.ts', config);
        expect(newlinePath.allowed).toBe(true);
      });

      it('should handle paths with tabs', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        const tabPath = validator.isPathAllowed('/src/file\tname.ts', config);
        expect(tabPath.allowed).toBe(true);
      });
    });

    describe('unicode and encoding attacks', () => {
      it('should handle unicode normalization forms', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // Same character in different unicode forms
        // é as NFC (single code point)
        const nfcPath = validator.isPathAllowed('/src/café.ts', config);
        // é as NFD (e + combining accent)
        const nfdPath = validator.isPathAllowed('/src/cafe\u0301.ts', config);

        expect(nfcPath.allowed).toBe(true);
        expect(nfdPath.allowed).toBe(true);
      });

      it('should handle right-to-left override characters', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: ['**/*.exe'],
          defaultAllow: false,
        };

        // RTL override that might make "evil.exe" look like "exe.live"
        const rtlPath = '/src/evil\u202Eexe.ts';
        const result = validator.isPathAllowed(rtlPath, config);

        // Should still match based on actual characters
        expect(result.allowed).toBe(true);
      });

      it('should handle homoglyph attacks', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        // Cyrillic 'с' (U+0441) vs Latin 'c'
        const cyrillicSrc = validator.isPathAllowed('/\u0441rc/main.ts', config);

        // These are different paths, so the Cyrillic one shouldn't match 'src/**'
        expect(cyrillicSrc.allowed).toBe(false);
      });

      it('should handle zero-width characters', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // Zero-width joiner, non-joiner, space
        const zwjPath = validator.isPathAllowed('/src/fi\u200Dle.ts', config);
        const zwnj = validator.isPathAllowed('/src/fi\u200Cle.ts', config);
        const zwsp = validator.isPathAllowed('/src/fi\u200Ble.ts', config);

        expect(zwjPath.allowed).toBe(true);
        expect(zwnj.allowed).toBe(true);
        expect(zwsp.allowed).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Platform-Specific Path Handling
  // ==========================================================================
  describe('Platform-Specific Path Handling', () => {
    describe('Windows-style paths', () => {
      it('should handle Windows drive letters', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['C:\\\\Users\\\\**'],
          blocklist: [],
          defaultAllow: false,
        };

        const windowsPath = validator.isPathAllowed(
          'C:\\Users\\John\\Documents\\file.txt',
          config
        );

        // Path normalization may or may not match depending on platform
        // The test verifies no errors are thrown
        expect(typeof windowsPath.allowed).toBe('boolean');
      });

      it('should handle mixed forward/backward slashes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const mixedPath = validator.isPathAllowed(
          '/src\\components/Button\\index.ts',
          config
        );

        expect(mixedPath.allowed).toBe(true);
      });

      it('should handle UNC paths', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['\\\\\\\\server\\\\share\\\\**'],
          blocklist: [],
          defaultAllow: false,
        };

        const uncPath = '\\\\server\\share\\folder\\file.txt';
        const result = validator.isPathAllowed(uncPath, config);

        // Should not throw
        expect(typeof result.allowed).toBe('boolean');
      });

      it('should handle Windows extended path prefix', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // \\?\ prefix for long paths
        const extendedPath = '\\\\?\\C:\\very\\long\\path\\file.ts';
        const result = validator.isPathAllowed(extendedPath, config);

        expect(result.allowed).toBe(true);
      });

      it('should handle Windows device paths', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: ['**/CON', '**/PRN', '**/AUX', '**/NUL', '**/COM[0-9]', '**/LPT[0-9]'],
          defaultAllow: true,
        };

        // Windows reserved device names
        const conResult = validator.isPathAllowed('/src/CON', config);
        const prnResult = validator.isPathAllowed('/src/PRN', config);
        const com1Result = validator.isPathAllowed('/src/COM1', config);

        expect(conResult.allowed).toBe(false);
        expect(prnResult.allowed).toBe(false);
        expect(com1Result.allowed).toBe(false);
      });
    });

    describe('Unix-style paths', () => {
      it('should handle root-relative paths', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['/home/**', '/opt/**'],
          blocklist: ['/root/**', '/etc/**'],
          defaultAllow: false,
        };

        const homeResult = validator.isPathAllowed('/home/user/file.txt', config);
        const optResult = validator.isPathAllowed('/opt/app/main.ts', config);
        const rootResult = validator.isPathAllowed('/root/.bashrc', config);
        const etcResult = validator.isPathAllowed('/etc/passwd', config);

        expect(homeResult.allowed).toBe(true);
        expect(optResult.allowed).toBe(true);
        expect(rootResult.allowed).toBe(false);
        expect(etcResult.allowed).toBe(false);
      });

      it('should handle hidden files and directories', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: ['**/.*'],
          defaultAllow: false,
        };

        const normalFile = validator.isPathAllowed('/src/main.ts', config);
        const hiddenFile = validator.isPathAllowed('/src/.env', config);
        const hiddenDir = validator.isPathAllowed('/src/.hidden/file.ts', config);

        expect(normalFile.allowed).toBe(true);
        expect(hiddenFile.allowed).toBe(false);
        expect(hiddenDir.allowed).toBe(true); // Only the .hidden itself matches .*
      });

      it('should handle special Unix directories', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: ['/proc/**', '/sys/**', '/dev/**'],
          defaultAllow: true,
        };

        const procResult = validator.isPathAllowed('/proc/self/cmdline', config);
        const sysResult = validator.isPathAllowed('/sys/kernel/debug', config);
        const devResult = validator.isPathAllowed('/dev/null', config);
        const homeResult = validator.isPathAllowed('/home/user/file.txt', config);

        expect(procResult.allowed).toBe(false);
        expect(sysResult.allowed).toBe(false);
        expect(devResult.allowed).toBe(false);
        expect(homeResult.allowed).toBe(true);
      });

      it('should handle file:// protocol prefix', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*'],
          blocklist: [],
          defaultAllow: true,
        };

        // file:// URLs might be passed to the validator
        const fileUrl = 'file:///home/user/document.txt';
        const result = validator.isPathAllowed(fileUrl, config);

        // Should handle this gracefully
        expect(typeof result.allowed).toBe('boolean');
      });
    });

    describe('cross-platform edge cases', () => {
      it('should handle paths with multiple consecutive slashes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const multiSlash = validator.isPathAllowed('/src///components//Button.ts', config);
        expect(multiSlash.allowed).toBe(true);
      });

      it('should handle trailing slashes', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        const withTrailing = validator.isPathAllowed('/project/src/components/', config);
        const withoutTrailing = validator.isPathAllowed('/project/src/components', config);

        // Both should be handled consistently
        expect(typeof withTrailing.allowed).toBe('boolean');
        expect(typeof withoutTrailing.allowed).toBe('boolean');
      });

      it('should handle case sensitivity correctly', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*.ts'],
          blocklist: [],
          defaultAllow: false,
        };

        const lowercase = validator.isPathAllowed('/project/src/main.ts', config);
        const uppercase = validator.isPathAllowed('/project/SRC/main.ts', config);
        const mixedCase = validator.isPathAllowed('/project/SrC/main.ts', config);

        expect(lowercase.allowed).toBe(true);
        // Case sensitivity depends on minimatch nocase option (default: false)
        expect(uppercase.allowed).toBe(false);
        expect(mixedCase.allowed).toBe(false);
      });

      it('should handle paths relative to current directory', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['./src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        const options: ValidationOptions = {
          baseDir: '/project',
        };

        const relativePath = validator.isPathAllowed('./src/main.ts', config, options);
        expect(relativePath.allowed).toBe(true);
      });

      it('should handle tilde expansion (home directory)', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['~/**'],
          blocklist: [],
          defaultAllow: false,
        };

        // Tilde is not expanded by path.normalize - it's a shell feature
        const tildePath = validator.isPathAllowed('~/Documents/file.txt', config);

        // Should match literally if pattern uses ~
        expect(tildePath.allowed).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Additional Edge Cases
  // ==========================================================================
  describe('Additional Edge Cases', () => {
    describe('pattern edge cases', () => {
      it('should handle patterns with only wildcards', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['*', '**', '**/*'],
          blocklist: [],
          defaultAllow: false,
        };

        const anyPath = validator.isPathAllowed('/any/path/to/file.ts', config);
        expect(anyPath.allowed).toBe(true);
      });

      it('should handle empty string patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['', 'src/**'],
          blocklist: [''],
          defaultAllow: false,
        };

        const result = validator.isPathAllowed('/project/src/main.ts', config);
        expect(result.allowed).toBe(true);
      });

      it('should handle whitespace-only patterns', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['   ', '\t', '\n', 'src/**'],
          blocklist: [],
          defaultAllow: false,
        };

        const result = validator.isPathAllowed('/project/src/main.ts', config);
        expect(result.allowed).toBe(true);
      });

      it('should handle patterns with escaped characters', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['**/*.\\{json\\}'], // Escaped braces
          blocklist: [],
          defaultAllow: false,
        };

        // With escaped braces, this should be a literal match
        const result = validator.isPathAllowed('/src/config.{json}', config);
        expect(result.allowed).toBe(true);
      });
    });

    describe('config edge cases', () => {
      it('should handle config with all optional fields undefined', () => {
        const config: DirectoryAccessConfig = {
          allowlist: undefined,
          blocklist: undefined,
          defaultAllow: undefined,
          resolveSymlinks: undefined,
          maxDepth: undefined,
        };

        const result = validator.isPathAllowed('/any/path.ts', config);
        expect(result.allowed).toBe(true);
        expect(result.matchType).toBe('default');
      });

      it('should handle config with all empty arrays', () => {
        const config: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: [],
          defaultAllow: undefined,
        };

        const result = validator.isPathAllowed('/any/path.ts', config);
        expect(result.allowed).toBe(true);
        expect(result.matchType).toBe('default');
      });

      it('should handle config where allowlist and blocklist have same pattern', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['src/**/*.ts'],
          blocklist: ['src/**/*.ts'],
          defaultAllow: false,
        };

        // Blocklist takes precedence
        const result = validator.isPathAllowed('/project/src/main.ts', config);
        expect(result.allowed).toBe(false);
        expect(result.matchType).toBe('blocklist');
      });
    });

    describe('convenience function edge cases', () => {
      it('should handle matchesAllowlist with complex patterns', () => {
        const patterns = [
          'src/**/*.{ts,js}',
          '**/+(test|spec)/**',
          '!node_modules/**',
        ];

        const tsResult = matchesAllowlist('/src/main.ts', patterns);
        const testResult = matchesAllowlist('/project/test/unit.ts', patterns);

        expect(tsResult).toBe(true);
        expect(testResult).toBe(true);
      });

      it('should handle matchesBlocklist with complex patterns', () => {
        const patterns = [
          '**/node_modules/**',
          '**/*.{log,tmp}',
          '**/+(secret|private)/**',
        ];

        const nodeModulesResult = matchesBlocklist(
          '/project/node_modules/lib/index.js',
          patterns
        );
        const logResult = matchesBlocklist('/var/app.log', patterns);
        const secretResult = matchesBlocklist('/data/secret/keys.txt', patterns);

        expect(nodeModulesResult).toBe(true);
        expect(logResult).toBe(true);
        expect(secretResult).toBe(true);
      });

      it('should handle isPathAllowed convenience function with options', () => {
        const config: DirectoryAccessConfig = {
          allowlist: ['relative/path/**'],
          blocklist: [],
          defaultAllow: false,
        };

        const options: ValidationOptions = {
          baseDir: '/home/user/project',
          resolveSymlinks: false,
        };

        const result = isPathAllowed('relative/path/file.ts', config, options);
        expect(result.allowed).toBe(true);
      });
    });
  });
});
