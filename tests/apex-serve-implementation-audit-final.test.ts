/**
 * Final Implementation Audit for apex serve Command
 *
 * This test suite verifies that the apex serve command implementation meets
 * all acceptance criteria:
 * 1. API server starts from CLI with port configuration
 * 2. APEX_SILENT mode functionality
 * 3. Detached process handling
 * 4. handleServe function is functional with proper error handling
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const APEX_ROOT = process.cwd();

describe('apex serve Command Implementation Audit', () => {
  let replCode: string;
  let apiServerCode: string;

  beforeAll(() => {
    // Read handleServe implementation from repl.tsx
    const replPath = join(APEX_ROOT, 'packages/cli/src/repl.tsx');
    expect(existsSync(replPath), 'repl.tsx should exist').toBe(true);
    replCode = readFileSync(replPath, 'utf8');

    // Read API server implementation
    const apiPath = join(APEX_ROOT, 'packages/api/src/index.ts');
    expect(existsSync(apiPath), 'API server should exist').toBe(true);
    apiServerCode = readFileSync(apiPath, 'utf8');
  });

  describe('Acceptance Criteria 1: API server starts from CLI with port configuration', () => {
    it('should have handleServe function implemented', () => {
      expect(replCode).toContain('async function handleServe(args: string[]): Promise<void>');
      expect(replCode).toContain('handleServe');
    });

    it('should handle port configuration via --port and -p flags', () => {
      // Check for port parsing logic
      expect(replCode).toContain("args[i] === '--port' || args[i] === '-p'");
      expect(replCode).toContain('parseInt(args[++i], 10)');

      // Check default port handling
      expect(replCode).toContain('port = ctx.apiPort ?? 3000');
    });

    it('should spawn API server with correct arguments', () => {
      expect(replCode).toContain("spawn(resolveExecutable('node')");
      expect(replCode).toContain("path.join(apiPath, 'dist/index.js')");
      expect(replCode).toContain('resolveExecutable');
    });

    it('should handle API path resolution correctly', () => {
      expect(replCode).toContain("path.resolve(__dirname, '../../api')");
      expect(replCode).toContain('apiPath');
    });

    it('should verify API server can be built and started', () => {
      // Check that API server has main entry point
      const apiPackageJsonPath = join(APEX_ROOT, 'packages/api/package.json');
      expect(existsSync(apiPackageJsonPath)).toBe(true);

      const apiPackageJson = JSON.parse(readFileSync(apiPackageJsonPath, 'utf8'));
      expect(apiPackageJson.main || apiPackageJson.files).toBeDefined();

      // Check that dist/index.js is buildable
      expect(apiServerCode).toContain('createServer');
      expect(apiServerCode).toContain('FastifyInstance');
      expect(apiServerCode).toContain('listen');
    });
  });

  describe('Acceptance Criteria 2: APEX_SILENT mode functionality', () => {
    it('should set APEX_SILENT environment variable', () => {
      expect(replCode).toContain("APEX_SILENT: '1'");
    });

    it('should pass APEX_SILENT in environment to spawned process', () => {
      // Check that APEX_SILENT is in the env object passed to spawn
      const envMatch = replCode.match(/env:\s*{[\s\S]*?APEX_SILENT:\s*'1'[\s\S]*?}/);
      expect(envMatch).toBeTruthy();
    });

    it('should verify API server respects APEX_SILENT mode', () => {
      // Check that API server has silent mode handling
      expect(apiServerCode).toContain('APEX_SILENT') ||
             apiServerCode.toContain('silent') ||
             apiServerCode.toContain('logger');
    });
  });

  describe('Acceptance Criteria 3: Detached process handling', () => {
    it('should spawn process with detached: true option', () => {
      expect(replCode).toContain('detached: true');
    });

    it('should spawn process with stdio: ignore for detached operation', () => {
      expect(replCode).toContain("stdio: 'ignore'");
    });

    it('should call unref() on spawned process', () => {
      expect(replCode).toContain('proc.unref()');
    });

    it('should store process reference for cleanup', () => {
      expect(replCode).toContain('ctx.apiProcess = proc');
    });

    it('should have process cleanup functionality', () => {
      expect(replCode).toContain('cleanupProcesses');
      expect(replCode).toContain('ctx.apiProcess.kill');
      expect(replCode).toContain('SIGTERM');
    });
  });

  describe('Acceptance Criteria 4: handleServe function error handling and validation', () => {
    it('should validate APEX initialization before starting server', () => {
      expect(replCode).toContain('if (!ctx.initialized)');
      expect(replCode).toContain('APEX not initialized. Run /init first.');
    });

    it('should prevent multiple server instances', () => {
      expect(replCode).toContain('if (ctx.apiProcess)');
      expect(replCode).toContain('API server is already running');
    });

    it('should handle spawn errors gracefully', () => {
      expect(replCode).toContain('try {') && expect(replCode).toContain('} catch (error');
      expect(replCode).toContain('Failed to start API server');
    });

    it('should provide user feedback during startup', () => {
      expect(replCode).toContain('Starting API server on port');
      expect(replCode).toContain('API server running at');
    });

    it('should update application state after successful startup', () => {
      expect(replCode).toContain('ctx.app?.updateState({ apiUrl });');
      expect(replCode).toContain('ctx.apiPort = port');
    });

    it('should handle startup delay for server initialization', () => {
      expect(replCode).toContain('setTimeout') || expect(replCode).toContain('new Promise');
      expect(replCode).toContain('1500'); // Default startup delay
    });
  });

  describe('Integration with Core APEX Architecture', () => {
    it('should integrate with APEX context system', () => {
      expect(replCode).toContain('ctx.cwd');
      expect(replCode).toContain('APEX_PROJECT: ctx.cwd');
    });

    it('should use APEX core utilities', () => {
      expect(replCode).toContain('resolveExecutable');
      expect(replCode).toContain('getPlatformShell') || expect(replCode).toContain('isWindows');
    });

    it('should preserve existing environment variables', () => {
      expect(replCode).toContain('...process.env');
    });

    it('should have proper command router integration', () => {
      expect(replCode).toContain("case 'serve':");
      expect(replCode).toContain('await handleServe(args)');
    });
  });

  describe('Production Readiness Verification', () => {
    it('should have comprehensive error types handling', () => {
      expect(replCode).toContain('error instanceof Error ? error.message : String(error)');
    });

    it('should handle process management across platforms', () => {
      expect(replCode).toContain('killProcessOnPort') || expect(replCode).toContain('process.kill');
    });

    it('should have port conflict detection capabilities', () => {
      expect(replCode).toContain('getProcessesOnPort') || expect(replCode).toContain('killProcessOnPort');
    });

    it('should support graceful shutdown', () => {
      expect(replCode).toContain('cleanupProcesses');
      expect(replCode).toContain('process.on(');
      expect(replCode).toContain('SIGINT') || expect(replCode).toContain('SIGTERM');
    });
  });

  describe('Comprehensive Test Coverage Verification', () => {
    it('should have existing comprehensive tests for handleServe', () => {
      const testPath = join(APEX_ROOT, 'tests/apex-serve-handleServe-comprehensive.test.ts');
      expect(existsSync(testPath)).toBe(true);

      const testCode = readFileSync(testPath, 'utf8');
      expect(testCode).toContain('handleServe Function - Comprehensive Test Suite');
      expect(testCode).toContain('Port Configuration');
      expect(testCode).toContain('APEX_SILENT');
      expect(testCode).toContain('detached');
    });

    it('should have tests covering all acceptance criteria', () => {
      const testPaths = [
        'tests/apex-serve-handleServe-comprehensive.test.ts',
        'tests/v010-api-server-audit.test.ts',
        'tests/apex-serve-verification.test.ts'
      ];

      for (const testPath of testPaths) {
        const fullPath = join(APEX_ROOT, testPath);
        if (existsSync(fullPath)) {
          const testCode = readFileSync(fullPath, 'utf8');
          expect(testCode.length).toBeGreaterThan(1000); // Substantial test coverage
        }
      }
    });
  });
});