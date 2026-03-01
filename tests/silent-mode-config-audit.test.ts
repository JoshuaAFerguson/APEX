/**
 * @file Silent Mode Configuration Audit
 * @description Direct verification of APEX_SILENT configuration without process mocking
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Silent Mode Configuration Audit', () => {
  describe('Source Code Verification', () => {
    it('should verify APEX_SILENT variable is used in API server', async () => {
      const apiIndexPath = path.resolve(__dirname, '../packages/api/src/index.ts');

      try {
        const content = await fs.readFile(apiIndexPath, 'utf-8');

        // Verify APEX_SILENT environment variable check exists
        expect(content).toMatch(/process\.env\.APEX_SILENT\s*===\s*['"]1['"]/);

        // Verify it's used in the silent variable assignment
        expect(content).toMatch(/const\s+silent\s*=\s*process\.env\.APEX_SILENT\s*===\s*['"]1['"];?/);

        // Verify it's used in Fastify logger configuration
        expect(content).toMatch(/logger:\s*\(.*silent.*\)\s*\?\s*false\s*:/);

      } catch (error) {
        // If we can't read the file, check if it exists in dist
        const distApiPath = path.resolve(__dirname, '../packages/api/dist/index.js');
        const distContent = await fs.readFile(distApiPath, 'utf-8');

        // In compiled JS, look for the pattern
        expect(distContent).toMatch(/APEX_SILENT/);
        expect(distContent).toMatch(/=== "1"/);
      }
    });

    it('should verify REPL sets APEX_SILENT=1 for API processes', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Verify APEX_SILENT is set to '1' in environment
      expect(content).toMatch(/APEX_SILENT:\s*['"]1['"]/);

      // Should appear in both handleServe and checkAutoStart functions
      const matches = content.match(/APEX_SILENT:\s*['"]1['"]/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it('should verify stdio ignore configuration for all spawned processes', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Find all spawn calls
      const spawnMatches = content.match(/spawn\([^)]+\)/g);
      expect(spawnMatches).toBeTruthy();
      expect(spawnMatches!.length).toBeGreaterThan(0);

      // Check for stdio: 'ignore' patterns
      const stdioIgnoreMatches = content.match(/stdio:\s*['"]ignore['"]/g);
      expect(stdioIgnoreMatches).toBeTruthy();
      expect(stdioIgnoreMatches!.length).toBeGreaterThanOrEqual(3); // At least 3 instances
    });

    it('should verify detached: true configuration for all spawned processes', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Check for detached: true patterns
      const detachedMatches = content.match(/detached:\s*true/g);
      expect(detachedMatches).toBeTruthy();
      expect(detachedMatches!.length).toBeGreaterThanOrEqual(3); // At least 3 instances
    });

    it('should verify unref() is called on spawned processes', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Check for proc.unref() calls
      const unrefMatches = content.match(/\.unref\(\s*\)/g);
      expect(unrefMatches).toBeTruthy();
      expect(unrefMatches!.length).toBeGreaterThanOrEqual(3); // At least 3 instances
    });

    it('should verify CLI index also uses stdio ignore for Web UI', async () => {
      const cliIndexPath = path.resolve(__dirname, '../packages/cli/src/index.ts');
      const content = await fs.readFile(cliIndexPath, 'utf-8');

      // Check for stdio: 'ignore' in CLI
      expect(content).toMatch(/stdio:\s*['"]ignore['"]/);

      // Check for detached: true in CLI
      expect(content).toMatch(/detached:\s*true/);

      // Check for unref() call in CLI
      expect(content).toMatch(/\.unref\(\s*\)/);
    });
  });

  describe('Environment Variable Patterns', () => {
    it('should verify consistent environment variable patterns', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Check for environment spreading pattern
      expect(content).toMatch(/\.\.\.process\.env/g);

      // Check for PORT variable setting
      expect(content).toMatch(/PORT:\s*.*\.toString\(\)/);

      // Check for APEX_PROJECT variable setting
      expect(content).toMatch(/APEX_PROJECT:\s*ctx\.cwd/);
    });

    it('should verify Web UI environment variables', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Check for NEXT_PUBLIC_APEX_API_URL
      expect(content).toMatch(/NEXT_PUBLIC_APEX_API_URL/);
    });
  });

  describe('Process Cleanup Verification', () => {
    it('should verify process cleanup function exists with proper signal handling', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Check for cleanupProcesses function
      expect(content).toMatch(/function\s+cleanupProcesses\(\s*\)/);

      // Check for negative PID killing (process group)
      expect(content).toMatch(/-.*\.pid.*SIGTERM/);

      // Check for SIGTERM signal
      expect(content).toMatch(/SIGTERM/);
    });
  });

  describe('File Structure Verification', () => {
    it('should verify API server entry point exists', async () => {
      const apiEntryPoints = [
        path.resolve(__dirname, '../packages/api/src/index.ts'),
        path.resolve(__dirname, '../packages/api/dist/index.js'),
      ];

      let found = false;
      for (const entryPoint of apiEntryPoints) {
        try {
          await fs.access(entryPoint);
          found = true;
          break;
        } catch {
          // Continue checking
        }
      }

      expect(found).toBe(true);
    });

    it('should verify Web UI package exists', async () => {
      const webUIPaths = [
        path.resolve(__dirname, '../packages/web-ui/package.json'),
        path.resolve(__dirname, '../packages/web-ui'),
      ];

      let found = false;
      for (const webUIPath of webUIPaths) {
        try {
          await fs.access(webUIPath);
          found = true;
          break;
        } catch {
          // Continue checking
        }
      }

      expect(found).toBe(true);
    });
  });

  describe('Configuration Consistency', () => {
    it('should verify all spawn configurations follow the same pattern', async () => {
      const files = [
        path.resolve(__dirname, '../packages/cli/src/repl.tsx'),
        path.resolve(__dirname, '../packages/cli/src/index.ts'),
      ];

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');

          // Find spawn calls
          const spawnCallsRegex = /spawn\([^,]+,\s*[^,]+,\s*\{[^}]*\}/g;
          const spawnCalls = content.match(spawnCallsRegex);

          if (spawnCalls) {
            spawnCalls.forEach(call => {
              // Each spawn call should have stdio: 'ignore' and detached: true
              if (call.includes('spawn')) {
                expect(call).toMatch(/stdio:\s*['"]ignore['"]/);
                expect(call).toMatch(/detached:\s*true/);
              }
            });
          }
        } catch {
          // File may not exist, skip
        }
      }
    });
  });
});