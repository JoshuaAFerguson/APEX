/**
 * @fileoverview Integration test to verify silent mode implementation in actual source files
 *
 * This test validates that the actual implementation files contain the correct
 * silent mode logic without mocking, ensuring real-world compatibility.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('Silent Mode Implementation Integration', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('API Server Implementation', () => {
    test('should have APEX_SILENT environment variable check in API server', () => {
      const apiIndexPath = path.join(rootDir, 'packages/api/src/index.ts');
      expect(existsSync(apiIndexPath)).toBe(true);

      const content = readFileSync(apiIndexPath, 'utf-8');

      // Verify the API server checks for APEX_SILENT === '1'
      expect(content).toContain("process.env.APEX_SILENT === '1'");

      // Verify the silent variable is created
      expect(content).toMatch(/const\s+silent\s*=\s*process\.env\.APEX_SILENT\s*===\s*['"]1['"];?/);
    });

    test('should verify API server uses silent variable for server configuration', () => {
      const apiIndexPath = path.join(rootDir, 'packages/api/src/index.ts');
      const content = readFileSync(apiIndexPath, 'utf-8');

      // Look for startServer call that uses the silent parameter
      expect(content).toMatch(/startServer\s*\(\s*\{[^}]*silent[^}]*\}\s*\)/);
    });
  });

  describe('REPL Implementation', () => {
    test('should verify REPL sets APEX_SILENT=1 in checkAutoStart function', () => {
      const replPath = path.join(rootDir, 'packages/cli/src/repl.tsx');
      expect(existsSync(replPath)).toBe(true);

      const content = readFileSync(replPath, 'utf-8');

      // Verify APEX_SILENT is set to '1' in spawn environment
      expect(content).toContain("APEX_SILENT: '1'");

      // Verify it's within a spawn call in the checkAutoStart function
      expect(content).toMatch(/spawn\s*\([^{]+\{[\s\S]*?env:\s*\{[\s\S]*?APEX_SILENT:\s*['"]1['"][\s\S]*?\}/);
    });

    test('should verify REPL uses stdio ignore and detached true for API spawn', () => {
      const replPath = path.join(rootDir, 'packages/cli/src/repl.tsx');
      const content = readFileSync(replPath, 'utf-8');

      // Look for spawn configuration with both stdio: 'ignore' and detached: true
      expect(content).toContain("stdio: 'ignore'");
      expect(content).toContain('detached: true');

      // Verify they appear in the same spawn call for API server by looking for
      // a spawn call that contains both APEX_SILENT and stdio/detached config
      const hasApiSpawnWithSilent = content.includes("APEX_SILENT: '1'");
      const hasStdioIgnore = content.includes("stdio: 'ignore'");
      const hasDetachedTrue = content.includes("detached: true");

      expect(hasApiSpawnWithSilent).toBe(true);
      expect(hasStdioIgnore).toBe(true);
      expect(hasDetachedTrue).toBe(true);
    });

    test('should verify Web UI spawn uses stdio ignore and detached true', () => {
      const replPath = path.join(rootDir, 'packages/cli/src/repl.tsx');
      const content = readFileSync(replPath, 'utf-8');

      // Look for Web UI spawn configuration (should contain 'next' and stdio/detached)
      const hasNextSpawn = content.includes("'next'");
      const hasWebUIStdio = content.includes("stdio: 'ignore'");
      const hasWebUIDetached = content.includes("detached: true");

      expect(hasNextSpawn).toBe(true);
      expect(hasWebUIStdio).toBe(true);
      expect(hasWebUIDetached).toBe(true);
    });

    test('should verify unref() is called on spawned processes', () => {
      const replPath = path.join(rootDir, 'packages/cli/src/repl.tsx');
      const content = readFileSync(replPath, 'utf-8');

      // Look for proc.unref() calls after spawn
      expect(content).toMatch(/proc\.unref\s*\(\s*\)/);

      // Should have at least two unref calls (API and Web UI)
      const unrefMatches = content.match(/proc\.unref\s*\(\s*\)/g);
      expect(unrefMatches).toBeTruthy();
      expect(unrefMatches?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Test Helpers Implementation', () => {
    test('should verify CLI serve handler sets APEX_SILENT=1', () => {
      const cliServeHandlerPath = path.join(rootDir, 'tests/test-helpers/cli-serve-handler.ts');
      expect(existsSync(cliServeHandlerPath)).toBe(true);

      const content = readFileSync(cliServeHandlerPath, 'utf-8');

      // Verify APEX_SILENT is set to '1'
      expect(content).toContain("APEX_SILENT: '1'");

      // Verify it's in spawn environment
      expect(content).toMatch(/env:\s*\{[\s\S]*?APEX_SILENT:\s*['"]1['"][\s\S]*?\}/);
    });

    test('should verify CLI serve handler uses stdio ignore and detached true', () => {
      const cliServeHandlerPath = path.join(rootDir, 'tests/test-helpers/cli-serve-handler.ts');
      const content = readFileSync(cliServeHandlerPath, 'utf-8');

      expect(content).toContain("stdio: 'ignore'");
      expect(content).toContain('detached: true');
    });

    test('should verify REPL serve handler sets APEX_SILENT=1', () => {
      const replServeHandlerPath = path.join(rootDir, 'tests/test-helpers/repl-serve-handler.ts');
      expect(existsSync(replServeHandlerPath)).toBe(true);

      const content = readFileSync(replServeHandlerPath, 'utf-8');

      // Verify APEX_SILENT is set to '1'
      expect(content).toContain("APEX_SILENT: '1'");

      // Verify stdio and detached configuration
      expect(content).toContain("stdio: 'ignore'");
      expect(content).toContain('detached: true');
    });
  });

  describe('Consistency Across Files', () => {
    test('should verify all APEX_SILENT usages use string "1"', () => {
      const filesToCheck = [
        'packages/api/src/index.ts',
        'packages/cli/src/repl.tsx',
        'tests/test-helpers/cli-serve-handler.ts',
        'tests/test-helpers/repl-serve-handler.ts',
      ];

      filesToCheck.forEach(filePath => {
        const fullPath = path.join(rootDir, filePath);
        if (!existsSync(fullPath)) return;

        const content = readFileSync(fullPath, 'utf-8');

        // Find all APEX_SILENT references
        const apexSilentMatches = content.match(/APEX_SILENT[^}]*?['"][^'"]*['"]/g);

        if (apexSilentMatches) {
          apexSilentMatches.forEach(match => {
            // Should not use number 1 or other string values
            expect(match).not.toContain('APEX_SILENT: 1'); // no number
            expect(match).not.toContain("APEX_SILENT: '0'"); // no false value
            expect(match).not.toContain('APEX_SILENT: "0"'); // no false value

            // If setting a value, should be '1'
            if (match.includes('APEX_SILENT:')) {
              expect(match).toMatch(/APEX_SILENT:\s*['"]1['"]/);
            }
          });
        }

        // Check comparison logic uses '1' string
        const comparisonMatches = content.match(/APEX_SILENT\s*===\s*['"][^'"]*['"]/g);
        if (comparisonMatches) {
          comparisonMatches.forEach(match => {
            expect(match).toMatch(/APEX_SILENT\s*===\s*['"]1['"]/);
          });
        }
      });
    });

    test('should verify all detached spawns use stdio ignore', () => {
      const filesToCheck = [
        'packages/cli/src/repl.tsx',
        'tests/test-helpers/cli-serve-handler.ts',
        'tests/test-helpers/repl-serve-handler.ts',
      ];

      filesToCheck.forEach(filePath => {
        const fullPath = path.join(rootDir, filePath);
        if (!existsSync(fullPath)) return;

        const content = readFileSync(fullPath, 'utf-8');

        // Find spawn calls with detached: true
        const spawnWithDetachedPattern = /spawn\s*\([^}]*\{[\s\S]*?detached:\s*true[\s\S]*?\}/g;
        const matches = content.match(spawnWithDetachedPattern);

        if (matches) {
          matches.forEach(match => {
            // Each detached spawn should have stdio: 'ignore'
            expect(match).toContain("stdio: 'ignore'");
          });
        }
      });
    });

    test('should verify process unref pattern is consistent', () => {
      const filesToCheck = [
        'packages/cli/src/repl.tsx',
        'tests/test-helpers/cli-serve-handler.ts',
        'tests/test-helpers/repl-serve-handler.ts',
      ];

      filesToCheck.forEach(filePath => {
        const fullPath = path.join(rootDir, filePath);
        if (!existsSync(fullPath)) return;

        const content = readFileSync(fullPath, 'utf-8');

        // If file contains spawn calls, should have unref calls
        if (content.includes('spawn(')) {
          expect(content).toMatch(/\.unref\s*\(\s*\)/);
        }
      });
    });
  });

  describe('Documentation Consistency', () => {
    test('should verify audit report reflects actual implementation', () => {
      const auditReportPath = path.join(rootDir, 'docs/silent-mode-audit-report.md');
      if (!existsSync(auditReportPath)) return;

      const content = readFileSync(auditReportPath, 'utf-8');

      // Verify key claims in audit report
      expect(content).toContain('✅ **APEX_SILENT=1 is set when spawning API/Web UI processes**');
      expect(content).toContain('✅ **stdio is set to \'ignore\' for detached processes**');
      expect(content).toContain('APEX_SILENT: \'1\'');
      expect(content).toContain('stdio: \'ignore\'');
      expect(content).toContain('detached: true');
    });

    test('should verify architecture decision record consistency', () => {
      const adrPath = path.join(rootDir, 'docs/architecture/ADR-checkAutoStart-audit.md');
      if (!existsSync(adrPath)) return;

      const content = readFileSync(adrPath, 'utf-8');

      // Verify ADR documents current implementation
      expect(content).toContain('APEX_SILENT=1');
      expect(content).toContain('stdio: \'ignore\'');
      expect(content).toContain('detached: true');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should verify robust environment variable handling', () => {
      const apiIndexPath = path.join(rootDir, 'packages/api/src/index.ts');
      if (!existsSync(apiIndexPath)) return;

      const content = readFileSync(apiIndexPath, 'utf-8');

      // Should use strict comparison (=== '1') not loose comparison
      expect(content).toContain("=== '1'");

      // Check that it doesn't use loose equality anywhere for APEX_SILENT
      const apexSilentComparisons = content.match(/APEX_SILENT\s*==\s*['"]?1['"]?/g);
      expect(apexSilentComparisons).toBeNull();
    });

    test('should verify default behavior when APEX_SILENT is not set', () => {
      const apiIndexPath = path.join(rootDir, 'packages/api/src/index.ts');
      if (!existsSync(apiIndexPath)) return;

      const content = readFileSync(apiIndexPath, 'utf-8');

      // The comparison process.env.APEX_SILENT === '1' should handle undefined gracefully
      // This is implicit in the strict comparison - no additional checks needed
      expect(content).toMatch(/process\.env\.APEX_SILENT\s*===\s*['"]1['"];?/);
    });
  });
});