/**
 * @fileoverview Integration tests for DirectoryAccessValidator with PermissionManager
 *
 * This test suite focuses on testing the integration between DirectoryAccessValidator
 * and the permission system, ensuring that directory access validation works correctly
 * within the broader permission management context.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DirectoryAccessValidator,
  directoryAccessValidator,
  isPathAllowed,
  type PathValidationResult,
  type ValidationOptions
} from '../directory-access-validator.js';
import type {
  DirectoryAccessConfig,
  ToolPermissionConfig,
  FilesystemToolConfig,
  SearchToolConfig
} from '../types.js';

describe('DirectoryAccessValidator Integration', () => {
  let validator: DirectoryAccessValidator;

  beforeEach(() => {
    validator = new DirectoryAccessValidator();
  });

  describe('integration with PermissionManager types', () => {
    it('should work with FilesystemToolConfig directory access', () => {
      const filesystemConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['src/**/*', 'docs/**/*.md'],
          blocklist: ['src/private/**/*', 'node_modules/**/*'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 10,
        },
        maxFileSize: 1048576,
        allowedExtensions: ['.ts', '.js', '.json', '.md'],
        blockedExtensions: ['.exe', '.bat', '.dll'],
      };

      const directoryConfig = filesystemConfig.directoryAccess!;

      // Test allowed paths
      const srcResult = validator.isPathAllowed('/project/src/components/Button.tsx', directoryConfig);
      expect(srcResult.allowed).toBe(true);
      expect(srcResult.matchType).toBe('allowlist');

      const docsResult = validator.isPathAllowed('/project/docs/api.md', directoryConfig);
      expect(docsResult.allowed).toBe(true);
      expect(docsResult.matchType).toBe('allowlist');

      // Test blocked paths
      const privateResult = validator.isPathAllowed('/project/src/private/secret.ts', directoryConfig);
      expect(privateResult.allowed).toBe(false);
      expect(privateResult.matchType).toBe('blocklist');

      const nodeModulesResult = validator.isPathAllowed('/project/node_modules/lib/index.js', directoryConfig);
      expect(nodeModulesResult.allowed).toBe(false);
      expect(nodeModulesResult.matchType).toBe('blocklist');

      // Test default deny
      const otherResult = validator.isPathAllowed('/project/other/file.txt', directoryConfig);
      expect(otherResult.allowed).toBe(false);
      expect(otherResult.matchType).toBe('default');
    });

    it('should work with SearchToolConfig directory access', () => {
      const searchConfig: SearchToolConfig = {
        enabled: true,
        timeout: 8000,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['src/**/*', 'tests/**/*', 'docs/**/*'],
          blocklist: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 5,
        },
        maxResults: 1000,
        includePatterns: ['*.ts', '*.js', '*.md'],
        excludePatterns: ['*.test.*', '*.spec.*'],
      };

      const directoryConfig = searchConfig.directoryAccess!;

      // Test search in allowed directories
      const srcSearchResult = validator.isPathAllowed('/workspace/src/utils/helper.ts', directoryConfig);
      expect(srcSearchResult.allowed).toBe(true);
      expect(srcSearchResult.matchType).toBe('allowlist');

      const testsSearchResult = validator.isPathAllowed('/workspace/tests/integration/api.test.ts', directoryConfig);
      expect(testsSearchResult.allowed).toBe(true);
      expect(testsSearchResult.matchType).toBe('allowlist');

      // Test search in blocked directories
      const gitSearchResult = validator.isPathAllowed('/workspace/.git/hooks/pre-commit', directoryConfig);
      expect(gitSearchResult.allowed).toBe(false);
      expect(gitSearchResult.matchType).toBe('blocklist');

      const distSearchResult = validator.isPathAllowed('/workspace/dist/main.js', directoryConfig);
      expect(distSearchResult.allowed).toBe(false);
      expect(distSearchResult.matchType).toBe('blocklist');
    });

    it('should handle complex directory access patterns', () => {
      const complexConfig: DirectoryAccessConfig = {
        allowlist: [
          'src/**/*.{ts,js}',
          'docs/**/*.md',
          'tests/**/*.test.ts',
          'configs/*.{json,yaml,yml}',
          'scripts/*.{sh,bat}',
        ],
        blocklist: [
          'src/**/private/**',
          'src/**/*.{exe,dll,so}',
          'tests/**/fixtures/**/*.{key,pem,p12}',
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/*.log',
          '**/tmp/**',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 20,
      };

      // Test complex allowlist patterns
      const tsFileResult = validator.isPathAllowed('/project/src/components/ui/Button.ts', complexConfig);
      expect(tsFileResult.allowed).toBe(true);

      const jsFileResult = validator.isPathAllowed('/project/src/utils/helpers.js', complexConfig);
      expect(jsFileResult.allowed).toBe(true);

      const testFileResult = validator.isPathAllowed('/project/tests/unit/utils.test.ts', complexConfig);
      expect(testFileResult.allowed).toBe(true);

      const configJsonResult = validator.isPathAllowed('/project/configs/database.json', complexConfig);
      expect(configJsonResult.allowed).toBe(true);

      const scriptResult = validator.isPathAllowed('/project/scripts/deploy.sh', complexConfig);
      expect(scriptResult.allowed).toBe(true);

      // Test complex blocklist patterns
      const privateFileResult = validator.isPathAllowed('/project/src/components/private/secret.ts', complexConfig);
      expect(privateFileResult.allowed).toBe(false);

      const executableResult = validator.isPathAllowed('/project/src/malware.exe', complexConfig);
      expect(executableResult.allowed).toBe(false);

      const keyFileResult = validator.isPathAllowed('/project/tests/fixtures/certs/private.key', complexConfig);
      expect(keyFileResult.allowed).toBe(false);

      const logFileResult = validator.isPathAllowed('/project/debug.log', complexConfig);
      expect(logFileResult.allowed).toBe(false);

      // Test files that don't match allowlist
      const randomFileResult = validator.isPathAllowed('/project/random/file.txt', complexConfig);
      expect(randomFileResult.allowed).toBe(false);
      expect(randomFileResult.matchType).toBe('default');
    });

    it('should handle development vs production directory configs', () => {
      const developmentConfig: DirectoryAccessConfig = {
        allowlist: [
          'src/**/*',
          'tests/**/*',
          'docs/**/*',
          'scripts/**/*',
          'configs/**/*',
          '.github/**/*',
        ],
        blocklist: [
          'node_modules/**/*',
          '.git/**/*',
          'dist/**/*',
          'build/**/*',
          'coverage/**/*',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 15,
      };

      const productionConfig: DirectoryAccessConfig = {
        allowlist: [
          'dist/**/*',
          'configs/production/**/*',
          'public/**/*',
        ],
        blocklist: [
          'src/**/*',
          'tests/**/*',
          '.git/**/*',
          'node_modules/**/*',
          'scripts/**/*',
          'docs/**/*',
          '**/*.log',
          '**/*.tmp',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      // Development environment should allow source access
      const devSrcResult = validator.isPathAllowed('/app/src/main.ts', developmentConfig);
      expect(devSrcResult.allowed).toBe(true);

      const devTestResult = validator.isPathAllowed('/app/tests/unit.test.ts', developmentConfig);
      expect(devTestResult.allowed).toBe(true);

      const devDistResult = validator.isPathAllowed('/app/dist/main.js', developmentConfig);
      expect(devDistResult.allowed).toBe(false);

      // Production environment should allow only dist access
      const prodSrcResult = validator.isPathAllowed('/app/src/main.ts', productionConfig);
      expect(prodSrcResult.allowed).toBe(false);

      const prodTestResult = validator.isPathAllowed('/app/tests/unit.test.ts', productionConfig);
      expect(prodTestResult.allowed).toBe(false);

      const prodDistResult = validator.isPathAllowed('/app/dist/main.js', productionConfig);
      expect(prodDistResult.allowed).toBe(true);

      const prodConfigResult = validator.isPathAllowed('/app/configs/production/database.json', productionConfig);
      expect(prodConfigResult.allowed).toBe(true);
    });
  });

  describe('platform-specific path handling', () => {
    it('should handle Windows paths correctly', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['C:\\\\Users\\\\**\\\\Documents\\\\**'],
        blocklist: ['C:\\\\Windows\\\\**', 'C:\\\\Program Files\\\\**'],
        defaultAllow: false,
      };

      // Test Windows allowed path
      const allowedResult = validator.isPathAllowed('C:\\Users\\John\\Documents\\project\\file.txt', config);
      expect(allowedResult.allowed).toBe(true);

      // Test Windows blocked path
      const blockedResult = validator.isPathAllowed('C:\\Windows\\System32\\kernel32.dll', config);
      expect(blockedResult.allowed).toBe(false);
    });

    it('should handle Unix paths correctly', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['/home/**/workspace/**', '/opt/app/**'],
        blocklist: ['/etc/**', '/var/log/**', '/tmp/**'],
        defaultAllow: false,
      };

      // Test Unix allowed path
      const allowedResult = validator.isPathAllowed('/home/user/workspace/project/src/main.ts', config);
      expect(allowedResult.allowed).toBe(true);

      const appResult = validator.isPathAllowed('/opt/app/bin/server', config);
      expect(appResult.allowed).toBe(true);

      // Test Unix blocked path
      const etcResult = validator.isPathAllowed('/etc/passwd', config);
      expect(etcResult.allowed).toBe(false);

      const logResult = validator.isPathAllowed('/var/log/system.log', config);
      expect(logResult.allowed).toBe(false);
    });
  });

  describe('security-focused patterns', () => {
    it('should handle security-sensitive directory patterns', () => {
      const securityConfig: DirectoryAccessConfig = {
        allowlist: [
          'src/**/*.{ts,js}',
          'docs/**/*.md',
          'tests/**/*.test.ts',
          'public/**/*.{html,css,js,png,jpg,svg}',
        ],
        blocklist: [
          '**/.env*',
          '**/secrets/**',
          '**/private/**',
          '**/credentials/**',
          '**/*.{key,pem,p12,pfx}',
          '**/*.{exe,dll,so,dylib}',
          '**/node_modules/**',
          '**/.git/**',
          '**/backup/**',
          '**/dumps/**',
          '**/*.{log,tmp,cache}',
          '**/config/production/**',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      // Test allowed secure files
      const sourceResult = validator.isPathAllowed('/app/src/components/Header.ts', securityConfig);
      expect(sourceResult.allowed).toBe(true);

      const publicResult = validator.isPathAllowed('/app/public/assets/logo.png', securityConfig);
      expect(publicResult.allowed).toBe(true);

      // Test blocked sensitive files
      const envResult = validator.isPathAllowed('/app/.env', securityConfig);
      expect(envResult.allowed).toBe(false);

      const envProdResult = validator.isPathAllowed('/app/.env.production', securityConfig);
      expect(envProdResult.allowed).toBe(false);

      const secretsResult = validator.isPathAllowed('/app/secrets/api-key.txt', securityConfig);
      expect(secretsResult.allowed).toBe(false);

      const privateKeyResult = validator.isPathAllowed('/app/certs/private.key', securityConfig);
      expect(privateKeyResult.allowed).toBe(false);

      const executableResult = validator.isPathAllowed('/app/tools/binary.exe', securityConfig);
      expect(executableResult.allowed).toBe(false);

      const prodConfigResult = validator.isPathAllowed('/app/config/production/secrets.json', securityConfig);
      expect(prodConfigResult.allowed).toBe(false);

      const backupResult = validator.isPathAllowed('/app/backup/database.sql', securityConfig);
      expect(backupResult.allowed).toBe(false);
    });

    it('should handle common vulnerability patterns', () => {
      const vulnConfig: DirectoryAccessConfig = {
        allowlist: ['src/**/*.{ts,js}'],
        blocklist: [
          '**/../**',  // Path traversal attempts
          '**/..\\\\**',  // Windows path traversal
          '**/..**',
          '**/\\\\**',  // Various escape attempts
          '**/proc/**',  // Linux proc filesystem
          '**/dev/**',   // Device files
          '**/sys/**',   // System files
          '**/etc/**',   // System configs
        ],
        defaultAllow: false,
      };

      // Test normal allowed file
      const normalResult = validator.isPathAllowed('/app/src/main.ts', vulnConfig);
      expect(normalResult.allowed).toBe(true);

      // Test path traversal attempts
      const traversalResult1 = validator.isPathAllowed('/app/../../../etc/passwd', vulnConfig);
      expect(traversalResult1.allowed).toBe(false);

      const traversalResult2 = validator.isPathAllowed('/app/src/../../../sensitive.txt', vulnConfig);
      expect(traversalResult2.allowed).toBe(false);

      // Test system file access attempts
      const procResult = validator.isPathAllowed('/proc/self/cmdline', vulnConfig);
      expect(procResult.allowed).toBe(false);

      const devResult = validator.isPathAllowed('/dev/random', vulnConfig);
      expect(devResult.allowed).toBe(false);

      const etcResult = validator.isPathAllowed('/etc/shadow', vulnConfig);
      expect(etcResult.allowed).toBe(false);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large pattern lists efficiently', () => {
      const largeAllowlist = Array.from({ length: 100 }, (_, i) => `pattern${i}/**/*`);
      const largeBlocklist = Array.from({ length: 100 }, (_, i) => `block${i}/**/*`);

      const config: DirectoryAccessConfig = {
        allowlist: largeAllowlist,
        blocklist: largeBlocklist,
        defaultAllow: false,
      };

      const startTime = Date.now();

      // Test multiple path validations
      for (let i = 0; i < 50; i++) {
        validator.isPathAllowed(`/test/pattern${i}/file.txt`, config);
        validator.isPathAllowed(`/test/block${i}/file.txt`, config);
        validator.isPathAllowed(`/test/other${i}/file.txt`, config);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (under 100ms for 150 validations)
      expect(duration).toBeLessThan(100);
    });

    it('should handle deeply nested paths', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['**/very/deep/nested/structure/**'],
        blocklist: [],
        defaultAllow: false,
      };

      const deepPath = '/root/very/deep/nested/structure/folder1/folder2/folder3/folder4/file.txt';
      const result = validator.isPathAllowed(deepPath, config);

      expect(result.allowed).toBe(true);
      expect(result.matchType).toBe('allowlist');
    });

    it('should handle paths with special characters', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['special/**/*'],
        blocklist: [],
        defaultAllow: false,
      };

      // Test various special characters
      const specialPaths = [
        '/special/file with spaces.txt',
        '/special/file-with-dashes.txt',
        '/special/file_with_underscores.txt',
        '/special/file.with.dots.txt',
        '/special/file@symbol.txt',
        '/special/file#hash.txt',
        '/special/file%percent.txt',
      ];

      specialPaths.forEach(path => {
        const result = validator.isPathAllowed(path, config);
        expect(result.allowed).toBe(true);
      });
    });

    it('should handle empty and null pattern arrays gracefully', () => {
      const emptyConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: [],
        defaultAllow: true,
      };

      const nullConfig: DirectoryAccessConfig = {
        allowlist: undefined,
        blocklist: undefined,
        defaultAllow: true,
      };

      const result1 = validator.isPathAllowed('/any/path/file.txt', emptyConfig);
      expect(result1.allowed).toBe(true);

      const result2 = validator.isPathAllowed('/any/path/file.txt', nullConfig);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('convenience function integration', () => {
    it('should work with exported convenience functions', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['**/*.ts'],
        blocklist: ['**/private/**'],
        defaultAllow: false,
      };

      // Test isPathAllowed function
      const result1 = isPathAllowed('/src/main.ts', config);
      expect(result1.allowed).toBe(true);

      const result2 = isPathAllowed('/src/private/secret.ts', config);
      expect(result2.allowed).toBe(false);

      // Test with validation options
      const options: ValidationOptions = {
        baseDir: '/project',
      };

      const result3 = isPathAllowed('src/main.ts', config, options);
      expect(result3.allowed).toBe(true);
    });

    it('should work with default validator instance', () => {
      const config: DirectoryAccessConfig = {
        allowlist: ['src/**/*'],
        blocklist: [],
        defaultAllow: false,
      };

      // Using default instance
      const result1 = directoryAccessValidator.isPathAllowed('/src/component.tsx', config);
      expect(result1.allowed).toBe(true);

      // Using new instance - should give same result
      const newValidator = new DirectoryAccessValidator();
      const result2 = newValidator.isPathAllowed('/src/component.tsx', config);
      expect(result2).toEqual(result1);
    });
  });
});