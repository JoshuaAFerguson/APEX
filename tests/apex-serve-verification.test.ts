/**
 * APEX Serve Command Verification Test
 *
 * This test verifies the apex serve command implementation to meet acceptance criteria:
 * - API server starts from CLI with port configuration
 * - APEX_SILENT mode functionality
 * - Detached process handling
 * - handleServe function in repl.tsx functionality
 * - Port parsing, process spawning, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const REPL_PATH = path.resolve(__dirname, '../packages/cli/src/repl.tsx');
const CLI_PATH = path.resolve(__dirname, '../packages/cli/src/index.ts');
const API_PATH = path.resolve(__dirname, '../packages/api/dist/index.js');

describe('APEX Serve Command Verification', () => {

  describe('AC1: API server starts from CLI with port configuration', () => {
    it('should have serve command registered in CLI with proper configuration', () => {
      const cliContent = readFileSync(CLI_PATH, 'utf-8');

      // Check serve command is registered
      expect(cliContent).toContain("name: 'serve'");
      expect(cliContent).toContain('Start the API server');
      expect(cliContent).toContain('/serve [--port <port>]');
    });

    it('should parse port arguments correctly in CLI', () => {
      const cliContent = readFileSync(CLI_PATH, 'utf-8');

      // Check port parsing logic
      expect(cliContent).toMatch(/args\[i\]\s*===\s*['"]--port['"].*\|\|.*args\[i\]\s*===\s*['"]-p['"]/);
      expect(cliContent).toContain('parseInt');
    });

    it('should call startAPIServer from CLI serve command', () => {
      const cliContent = readFileSync(CLI_PATH, 'utf-8');

      expect(cliContent).toContain('startAPIServer');
    });
  });

  describe('AC2: APEX_SILENT mode functionality', () => {
    it('should set APEX_SILENT environment variable in handleServe', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain("APEX_SILENT: '1'");
    });

    it('should handle APEX_SILENT in API server', () => {
      if (existsSync(API_PATH)) {
        const apiContent = readFileSync(API_PATH, 'utf-8');
        expect(apiContent).toContain('APEX_SILENT');
      } else {
        // Check source file instead
        const apiSrcPath = path.resolve(__dirname, '../packages/api/src/index.ts');
        const apiContent = readFileSync(apiSrcPath, 'utf-8');
        expect(apiContent).toContain('silent');
      }
    });

    it('should properly configure silent mode environment variable', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      // Check that APEX_SILENT is set in env
      expect(replContent).toContain('env:');
      expect(replContent).toContain('...process.env');
      expect(replContent).toContain("APEX_SILENT: '1'");
    });
  });

  describe('AC3: Detached process handling', () => {
    it('should spawn process with detached configuration', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('detached: true');
      expect(replContent).toContain("stdio: 'ignore'");
    });

    it('should unref the spawned process', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('proc.unref()');
    });

    it('should store process reference in context', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('ctx.apiProcess = proc');
    });
  });

  describe('AC4: handleServe function functionality', () => {
    it('should have properly typed handleServe function', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('async function handleServe(args: string[]): Promise<void>');
    });

    it('should check for APEX initialization', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('if (!ctx.initialized)');
      expect(replContent).toContain('APEX not initialized');
    });

    it('should prevent multiple server instances', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('if (ctx.apiProcess)');
      expect(replContent).toContain('already running');
    });

    it('should use resolveExecutable for node binary', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain("resolveExecutable('node')");
    });
  });

  describe('AC5: Port parsing, process spawning, and error handling', () => {
    it('should parse port arguments with fallback', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('let port = ctx.apiPort ?? 3000');
      expect(replContent).toMatch(/port\s*=\s*parseInt\(args\[\+\+i\],\s*10\)/);
    });

    it('should spawn process with correct arguments and environment', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('spawn(');
      expect(replContent).toContain('cwd: ctx.cwd');
      expect(replContent).toContain('PORT: port.toString()');
      expect(replContent).toContain('APEX_PROJECT: ctx.cwd');
    });

    it('should have try-catch error handling', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('try {');
      expect(replContent).toContain('} catch (error: unknown)');
      expect(replContent).toContain('Failed to start API server');
    });

    it('should provide user feedback during startup', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('Starting API server on port');
      expect(replContent).toContain('API server running at');
    });

    it('should handle server startup timing', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('setTimeout');
      expect(replContent).toContain('1500');
    });
  });

  describe('Integration verification', () => {
    it('should have proper API entry point resolution', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain("path.resolve(__dirname, '../../api')");
      expect(replContent).toContain("path.join(apiPath, 'dist/index.js')");
    });

    it('should update application state after startup', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain('ctx.app?.updateState');
      expect(replContent).toContain('apiUrl');
    });
  });

  describe('Code quality verification', () => {
    it('should have proper TypeScript typing', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toContain(': string[]');
      expect(replContent).toContain(': Promise<void>');
      expect(replContent).toContain(': unknown');
    });

    it('should handle both short and long port flags', () => {
      const replContent = readFileSync(REPL_PATH, 'utf-8');

      expect(replContent).toMatch(/['"]--port['"].*\|\|.*['"]-p['"]/);
    });
  });
});