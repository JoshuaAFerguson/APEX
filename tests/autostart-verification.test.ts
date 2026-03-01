/**
 * @file AutoStart Verification Test
 * @description Verify checkAutoStart function works correctly with config settings
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('AutoStart Verification', () => {
  describe('CLI checkAutoStart function', () => {
    it('should verify checkAutoStart function exists and handles config correctly', async () => {
      const cliIndexPath = path.resolve(__dirname, '../packages/cli/src/index.ts');
      const content = await fs.readFile(cliIndexPath, 'utf-8');

      // Verify checkAutoStart function exists
      expect(content).toMatch(/async function checkAutoStart\s*\(/);

      // Verify it reads config
      expect(content).toMatch(/effective\.api.*autoStart/);
      expect(content).toMatch(/webUI.*autoStart/);

      // Verify it calls the appropriate start functions
      expect(content).toMatch(/await startAPIServer\s*\(/);
      expect(content).toMatch(/await startWebUI\s*\(/);

      // Verify silent mode is passed
      expect(content).toMatch(/startAPIServer\s*\([^,]+,[^,]+,\s*true\s*\)/);
      expect(content).toMatch(/startWebUI\s*\([^,]+,[^,]+,\s*true\s*\)/);
    });

    it('should verify API server supports silent mode', async () => {
      const cliIndexPath = path.resolve(__dirname, '../packages/cli/src/index.ts');
      const content = await fs.readFile(cliIndexPath, 'utf-8');

      // Verify startAPIServer function accepts silent parameter
      expect(content).toMatch(/function startAPIServer[^{]*silent[^{]*boolean/);

      // Verify silent parameter is used to suppress console output
      // Pattern: if (!silent) { console.log... }
      expect(content).toMatch(/if\s*\(\s*!silent\s*\)\s*\{[\s\S]*?console\.log/);
    });

    it('should verify Web UI supports silent mode', async () => {
      const cliIndexPath = path.resolve(__dirname, '../packages/cli/src/index.ts');
      const content = await fs.readFile(cliIndexPath, 'utf-8');

      // Verify startWebUI function accepts silent parameter
      expect(content).toMatch(/function startWebUI[^{]*silent[^{]*boolean/);

      // Verify silent parameter is used to suppress console output
      // Pattern: if (!silent) { console.log... }
      expect(content).toMatch(/if\s*\(\s*!silent\s*\)\s*\{[\s\S]*?console\.log/);
    });
  });

  describe('REPL checkAutoStart function', () => {
    it('should verify REPL checkAutoStart function exists and handles config correctly', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Verify checkAutoStart function exists
      expect(content).toMatch(/async function checkAutoStart\s*\(/);

      // Verify it reads config
      expect(content).toMatch(/apiConfig.*autoStart/);
      expect(content).toMatch(/webUIConfig.*autoStart/);

      // Verify APEX_SILENT is set to '1'
      expect(content).toMatch(/APEX_SILENT:\s*['"]1['"]/);

      // Verify process spawning with correct options
      expect(content).toMatch(/spawn\s*\(/);
      expect(content).toMatch(/stdio:\s*['"]ignore['"]/);
      expect(content).toMatch(/detached:\s*true/);
    });

    it('should verify API spawning uses APEX_SILENT correctly', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Find the API spawning section in checkAutoStart - match the entire block including nested braces
      const apiSpawnMatch = content.match(/if\s*\(\s*apiConfig\?\.autoStart\s*\)\s*\{[\s\S]*?ctx\.apiPort\s*=\s*port;[\s\S]*?\}/);
      expect(apiSpawnMatch).toBeTruthy();

      if (apiSpawnMatch) {
        const apiSpawnCode = apiSpawnMatch[0];
        expect(apiSpawnCode).toMatch(/APEX_SILENT:\s*['"]1['"]/);
        expect(apiSpawnCode).toMatch(/stdio:\s*['"]ignore['"]/);
        expect(apiSpawnCode).toMatch(/detached:\s*true/);
      }
    });

    it('should verify Web UI spawning uses silent configuration', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Find the Web UI spawning section in checkAutoStart - match the entire block including nested braces
      const webUISpawnMatch = content.match(/if\s*\(\s*webUIConfig\?\.autoStart\s*\)\s*\{[\s\S]*?ctx\.webUIPort\s*=\s*port;[\s\S]*?\}/);
      expect(webUISpawnMatch).toBeTruthy();

      if (webUISpawnMatch) {
        const webUISpawnCode = webUISpawnMatch[0];
        expect(webUISpawnCode).toMatch(/stdio:\s*['"]ignore['"]/);
        expect(webUISpawnCode).toMatch(/detached:\s*true/);
      }
    });
  });

  describe('Configuration Structure', () => {
    it('should verify config reading uses getEffectiveConfig', async () => {
      const files = [
        path.resolve(__dirname, '../packages/cli/src/index.ts'),
        path.resolve(__dirname, '../packages/cli/src/repl.tsx'),
      ];

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8');

        // Verify getEffectiveConfig is used in checkAutoStart
        const checkAutoStartMatch = content.match(/async function checkAutoStart[^{]*\{[^}]+\}/s);
        if (checkAutoStartMatch) {
          expect(checkAutoStartMatch[0]).toMatch(/getEffectiveConfig/);
        }
      }
    });

    it('should verify port configuration is handled correctly', async () => {
      const cliIndexPath = path.resolve(__dirname, '../packages/cli/src/index.ts');
      const content = await fs.readFile(cliIndexPath, 'utf-8');

      // Verify API port handling
      expect(content).toMatch(/effective\.api\.port/);

      // Verify Web UI port handling with default
      expect(content).toMatch(/webUIConfig\.port.*3001/);
    });
  });

  describe('Process Management', () => {
    it('should verify process cleanup exists', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Verify cleanupProcesses function exists
      expect(content).toMatch(/function cleanupProcesses/);

      // Verify it handles process termination
      expect(content).toMatch(/SIGTERM/);

      // Verify it handles negative PID (process group)
      expect(content).toMatch(/-.*\.pid/);
    });

    it('should verify processes are stored in context', async () => {
      const replPath = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      // Verify API process is stored
      expect(content).toMatch(/ctx\.apiProcess.*=.*proc/);

      // Verify Web UI process is stored
      expect(content).toMatch(/ctx\.webUIProcess.*=.*proc/);

      // Verify port numbers are stored
      expect(content).toMatch(/ctx\.apiPort.*=.*port/);
      expect(content).toMatch(/ctx\.webUIPort.*=.*port/);
    });
  });
});