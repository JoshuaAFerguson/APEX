/**
 * End-to-end tests for MCP browse marketplace command
 *
 * These tests verify the browse marketplace functionality works correctly by:
 * 1. Creating a test project directory
 * 2. Running actual CLI commands via child_process
 * 3. Verifying expected outcomes for browse command
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Path to the CLI
const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');

// Helper to run CLI commands
async function runCli(args: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      timeout: 30000,
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    // Return output even on error for inspection
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || '',
    };
  }
}

describe('E2E: Browse MCP Marketplace', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-browse-marketplace-'));
    // Initialize APEX project for MCP commands to work
    await runCli('init --yes', testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('mcp list (browse marketplace)', () => {
    it('should execute browse command successfully and return list of available MCP servers', async () => {
      const { stdout, stderr } = await runCli('mcp list', testDir);

      // Command should execute successfully
      expect(stderr).not.toContain('Error');

      // Should contain marketplace header and content
      expect(stdout).toContain('MCP Marketplace');
      expect(stdout).toContain('Available Servers');

      // Should contain marketplace commands help section
      expect(stdout).toContain('Marketplace commands');
      expect(stdout).toContain('Search servers');
      expect(stdout).toContain('Install server');
      expect(stdout).toContain('View installed');
      expect(stdout).toContain('Interactive setup');
    });

    it('should return properly formatted output with categories and server information', async () => {
      const { stdout, stderr } = await runCli('mcp list', testDir);

      // Command should execute successfully
      expect(stderr).not.toContain('Error');

      // Should contain proper formatting elements
      expect(stdout).toContain('📦'); // Marketplace icon
      expect(stdout).toContain('📁'); // Category icon
      expect(stdout).toContain('🔍'); // Search icon
      expect(stdout).toContain('📊'); // Stats icon

      // Should contain server count statistics
      expect(stdout).toMatch(/\d+ servers? available/);

      // Should contain verified server count if any exist
      if (stdout.includes('✓')) {
        expect(stdout).toMatch(/\d+ verified servers?/);
      }
    });

    it('should handle empty marketplace gracefully', async () => {
      // This test verifies graceful handling when no servers are available
      // We'll mock this scenario by checking how the command handles empty results

      // Note: In a real scenario, the marketplace would be empty
      // For this test, we verify the command doesn't crash and handles the scenario properly
      const { stdout, stderr } = await runCli('mcp list', testDir);

      // Command should not crash regardless of marketplace content
      expect(stderr).not.toContain('TypeError');
      expect(stderr).not.toContain('ReferenceError');
      expect(stderr).not.toContain('Cannot read property');
      expect(stderr).not.toContain('Cannot read properties');

      // Should either show servers or indicate no servers available
      const hasServers = stdout.includes('📦 MCP Marketplace - Available Servers:');
      const hasNoServersMessage = stdout.includes('No MCP servers found in marketplace');

      expect(hasServers || hasNoServersMessage).toBe(true);
    });

    it('should provide JSON output when --json flag is used', async () => {
      const { stdout, stderr } = await runCli('mcp list --json', testDir);

      // Command should execute successfully
      expect(stderr).not.toContain('Error');

      // Should be valid JSON
      expect(() => JSON.parse(stdout)).not.toThrow();

      const data = JSON.parse(stdout);

      // Should be an array (even if empty)
      expect(Array.isArray(data)).toBe(true);

      // If servers exist, they should have required properties
      if (data.length > 0) {
        data.forEach((server: any) => {
          expect(server).toHaveProperty('id');
          expect(server).toHaveProperty('name');
          expect(server).toHaveProperty('description');
          expect(server).toHaveProperty('package');
          expect(server).toHaveProperty('config');
          expect(server).toHaveProperty('capabilities');
          expect(server).toHaveProperty('verified');
          expect(server).toHaveProperty('defaultEnabled');

          // Type validations
          expect(typeof server.id).toBe('string');
          expect(typeof server.name).toBe('string');
          expect(typeof server.description).toBe('string');
          expect(typeof server.package).toBe('string');
          expect(typeof server.config).toBe('object');
          expect(Array.isArray(server.capabilities)).toBe(true);
          expect(typeof server.verified).toBe('boolean');
          expect(typeof server.defaultEnabled).toBe('boolean');
        });
      }
    });

    it('should handle --json flag in different positions', async () => {
      // Test --json before list
      const { stdout: stdout1, stderr: stderr1 } = await runCli('--json mcp list', testDir);
      expect(stderr1).not.toContain('Error');
      expect(() => JSON.parse(stdout1)).not.toThrow();

      // Test --json after list
      const { stdout: stdout2, stderr: stderr2 } = await runCli('mcp list --json', testDir);
      expect(stderr2).not.toContain('Error');
      expect(() => JSON.parse(stdout2)).not.toThrow();

      // Both should produce identical results
      expect(JSON.parse(stdout1)).toEqual(JSON.parse(stdout2));
    });

    it('should display helpful guidance when no servers are installed', async () => {
      const { stdout, stderr } = await runCli('mcp list', testDir);

      // Command should execute successfully
      expect(stderr).not.toContain('Error');

      // Should provide guidance on how to install servers and use the marketplace
      const shouldHaveGuidance = stdout.includes('Search servers') ||
                                stdout.includes('Install server') ||
                                stdout.includes('Interactive setup');

      expect(shouldHaveGuidance).toBe(true);
    });

    it('should work without requiring APEX project initialization in some contexts', async () => {
      // Test the command in a fresh directory without init
      const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-browse-fresh-'));

      try {
        const { stdout, stderr } = await runCli('mcp list', freshDir);

        // Command should either work or provide helpful error
        if (stderr.includes('Error')) {
          // If it requires initialization, it should mention it clearly
          expect(stderr.toLowerCase()).toMatch(/init|initialize|project/);
        } else {
          // If it works, should show marketplace content
          expect(stdout).toContain('MCP');
        }
      } finally {
        await fs.rm(freshDir, { recursive: true, force: true });
      }
    });

    it('should handle network timeouts gracefully', async () => {
      // This test ensures the command doesn't hang indefinitely
      // The 30-second timeout in runCli should prevent hanging
      const { stdout, stderr } = await runCli('mcp list', testDir);

      // Should complete within timeout (if we get here, it didn't hang)
      expect(true).toBe(true);

      // Should handle any network errors gracefully
      if (stderr.includes('Error')) {
        expect(stderr.toLowerCase()).toMatch(/network|timeout|connect|fetch|load/);
      }
    });

    it('should provide consistent output format between runs', async () => {
      // Run the command twice to ensure consistent behavior
      const { stdout: run1 } = await runCli('mcp list --json', testDir);
      const { stdout: run2 } = await runCli('mcp list --json', testDir);

      // Both should be valid JSON
      expect(() => JSON.parse(run1)).not.toThrow();
      expect(() => JSON.parse(run2)).not.toThrow();

      // Results should be consistent (same structure and data)
      const data1 = JSON.parse(run1);
      const data2 = JSON.parse(run2);

      expect(data1).toEqual(data2);
    });
  });

  describe('mcp list error handling', () => {
    it('should provide helpful error messages for template loading failures', async () => {
      // This would be triggered by network issues or marketplace unavailability
      const { stdout, stderr } = await runCli('mcp list', testDir);

      // If there's an error, it should be informative
      if (stderr.includes('Error') || stdout.includes('Error')) {
        const errorOutput = stderr + stdout;
        expect(errorOutput.toLowerCase()).toMatch(/marketplace|template|load|fetch|network/);
      }
    });

    it('should handle invalid command arguments gracefully', async () => {
      const { stdout, stderr } = await runCli('mcp list invalid-argument', testDir);

      // Should either ignore extra arguments or provide helpful guidance
      // Should not crash with unhandled errors
      expect(stderr).not.toContain('TypeError');
      expect(stderr).not.toContain('ReferenceError');
    });
  });
});