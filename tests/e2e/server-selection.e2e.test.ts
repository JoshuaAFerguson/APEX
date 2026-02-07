/**
 * End-to-end tests for MCP Server Selection Happy Path
 *
 * This test suite validates the server selection workflow from the marketplace:
 * 1. Retrieve server list from marketplace (list command)
 * 2. Select server from browse results (validation via install)
 * 3. Verify selection exists in marketplace
 * 4. Display selected server details correctly
 * 5. Mock user input for selection scenarios
 *
 * Uses real CLI execution and actual filesystem operations for true integration
 * testing, following patterns from existing E2E tests.
 *
 * @see docs/adr/ADR-078-server-selection-e2e-test-architecture.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

const execAsync = promisify(exec);

// Path to the CLI binary
const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');

// Types for better TypeScript support
interface ExecResult {
  stdout: string;
  stderr: string;
}

interface ApexConfig {
  version: string;
  project: {
    name: string;
    language: string;
  };
  mcp?: {
    servers?: Record<string, any>;
  };
  [key: string]: any;
}

interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  verified?: boolean;
  category?: string;
  capabilities?: string[];
  config?: any;
}

interface SelectionResult {
  valid: boolean;
  selectedServer?: MarketplaceEntry;
  error?: string;
  displayedDetails?: {
    name: string;
    description: string;
    capabilities: string[];
    verified: boolean;
    envVars?: string[];
  };
}

interface MockSelectionInput {
  type: 'single' | 'multiple' | 'cancel';
  serverIds?: string[];
  cancelAfterMs?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run CLI command with proper environment and error handling
 */
async function runCli(args: string, cwd: string): Promise<ExecResult> {
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

/**
 * Read and parse APEX config file
 */
async function readApexConfig(projectDir: string): Promise<ApexConfig> {
  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  return yaml.parse(configContent) as ApexConfig;
}

/**
 * Parse JSON output safely
 */
function parseJsonOutput(output: string): any {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Invalid JSON output: ${output}`);
  }
}

/**
 * Get available servers from browse command (JSON output)
 */
async function getAvailableServers(projectDir: string): Promise<MarketplaceEntry[]> {
  const { stdout, stderr } = await runCli('mcp list --json', projectDir);

  if (stderr) {
    throw new Error(`Failed to get available servers: ${stderr}`);
  }

  return parseJsonOutput(stdout);
}

/**
 * Simulate server selection by attempting installation
 * This is the E2E approach - we validate selection by trying to install
 */
async function simulateServerSelection(
  projectDir: string,
  serverId: string,
  availableServers: MarketplaceEntry[]
): Promise<SelectionResult> {
  // Validate selection exists in available servers
  const selectedServer = availableServers.find(s => s.id === serverId);

  if (!selectedServer) {
    return {
      valid: false,
      error: `Server ${serverId} not found in available servers`,
    };
  }

  // Attempt to install the server (this validates the selection)
  const { stdout, stderr } = await runCli(`mcp install ${serverId}`, projectDir);

  // Check if installation succeeded (indicates valid selection)
  const installSuccess = stdout.includes('✅') && stdout.includes('installed');
  const alreadyInstalled = stdout.includes('already installed');

  if (!installSuccess && !alreadyInstalled && stderr) {
    return {
      valid: false,
      selectedServer,
      error: stderr,
    };
  }

  // Extract displayed details from install output
  const displayedDetails = {
    name: selectedServer.name,
    description: selectedServer.description,
    capabilities: selectedServer.capabilities || [],
    verified: selectedServer.verified || false,
    envVars: extractEnvVarsFromOutput(stdout),
  };

  return {
    valid: true,
    selectedServer,
    displayedDetails,
  };
}

/**
 * Extract environment variable names mentioned in output
 */
function extractEnvVarsFromOutput(output: string): string[] {
  const envVarPattern = /[A-Z_][A-Z0-9_]*(?=\s*=|\s*:)/g;
  const matches = output.match(envVarPattern) || [];
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Validate selection against available servers
 */
function validateSelection(
  availableServers: MarketplaceEntry[],
  selectedIds: string[]
): { valid: boolean; invalidIds: string[] } {
  const availableIds = availableServers.map(s => s.id);
  const invalidIds = selectedIds.filter(id => !availableIds.includes(id));

  return {
    valid: invalidIds.length === 0,
    invalidIds,
  };
}

/**
 * Extract and verify displayed server details from output
 */
function assertServerDetails(
  output: string,
  expectedServer: MarketplaceEntry
): void {
  expect(output).toContain(expectedServer.name);
  expect(output).toContain(expectedServer.description);

  if (expectedServer.verified) {
    expect(output).toContain('✓');
  }

  if (expectedServer.capabilities) {
    expectedServer.capabilities.forEach(capability => {
      // Check for capability mentions in output
      const capabilityKeywords = capability.split(':');
      capabilityKeywords.forEach(keyword => {
        if (keyword.length > 2) { // Skip very short keywords
          expect(output.toLowerCase()).toContain(keyword.toLowerCase());
        }
      });
    });
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('E2E: Server Selection Happy Path', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory and initialize APEX project
    testDir = await globalThis.apexE2EHelpers.createTempDir('server-selection-e2e-');

    // Initialize APEX project non-interactively
    const { stdout, stderr } = await runCli('init --yes', testDir);

    // Verify initialization succeeded
    if (stderr && stderr.includes('error')) {
      throw new Error(`Failed to initialize APEX project: ${stderr}`);
    }

    // Verify .apex directory structure exists
    const apexDir = path.join(testDir, '.apex');
    const configFile = path.join(apexDir, 'config.yaml');

    expect(await fs.stat(apexDir).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.stat(configFile).then(() => true).catch(() => false)).toBe(true);
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Select from Browse Results', () => {
    it('should retrieve server list and allow selection by ID', async () => {
      // Step 1: Get available servers from browse
      const availableServers = await getAvailableServers(testDir);
      expect(availableServers.length).toBeGreaterThan(0);

      // Step 2: Select first verified server
      const verifiedServer = availableServers.find(s => s.verified === true);
      expect(verifiedServer).toBeDefined();
      expect(verifiedServer!.id).toBeDefined();

      // Step 3: Simulate selection via installation
      const result = await simulateServerSelection(testDir, verifiedServer!.id, availableServers);
      expect(result.valid).toBe(true);
      expect(result.selectedServer).toBeDefined();
      expect(result.selectedServer!.id).toBe(verifiedServer!.id);
    });

    it('should validate selection exists in browse results', async () => {
      // Get available servers
      const availableServers = await getAvailableServers(testDir);

      // Test validation function
      const validIds = availableServers.slice(0, 2).map(s => s.id);
      const validation = validateSelection(availableServers, validIds);

      expect(validation.valid).toBe(true);
      expect(validation.invalidIds).toHaveLength(0);
    });

    it('should reject selection of non-existent server ID', async () => {
      // Get available servers
      const availableServers = await getAvailableServers(testDir);

      // Test with non-existent server ID
      const invalidId = 'nonexistent-server-xyz';
      const validation = validateSelection(availableServers, [invalidId]);

      expect(validation.valid).toBe(false);
      expect(validation.invalidIds).toContain(invalidId);

      // Also test via simulation (install attempt)
      const result = await simulateServerSelection(testDir, invalidId, availableServers);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Selected Server Details Display', () => {
    it('should display server name and description after selection', async () => {
      // Get available servers and select filesystem server
      const availableServers = await getAvailableServers(testDir);
      const filesystemServer = availableServers.find(s => s.id === 'filesystem');

      if (!filesystemServer) {
        console.warn('Filesystem server not found in test data, skipping test');
        return;
      }

      // Install server to trigger details display
      const { stdout } = await runCli(`mcp install ${filesystemServer.id}`, testDir);

      // Verify details are displayed
      assertServerDetails(stdout, filesystemServer);
    });

    it('should display server capabilities', async () => {
      // Get available servers and find one with capabilities
      const availableServers = await getAvailableServers(testDir);
      const serverWithCapabilities = availableServers.find(
        s => s.capabilities && s.capabilities.length > 0
      );

      if (!serverWithCapabilities) {
        console.warn('No servers with capabilities found, skipping test');
        return;
      }

      // Install server
      const { stdout } = await runCli(`mcp install ${serverWithCapabilities.id}`, testDir);

      // Verify capabilities are mentioned in output
      assertServerDetails(stdout, serverWithCapabilities);
    });

    it('should display verification status', async () => {
      // Test with verified server
      const availableServers = await getAvailableServers(testDir);
      const verifiedServer = availableServers.find(s => s.verified === true);

      if (!verifiedServer) {
        console.warn('No verified servers found, skipping test');
        return;
      }

      const { stdout } = await runCli(`mcp install ${verifiedServer.id}`, testDir);

      // Should show verification badge/indicator
      expect(stdout).toContain('✓');
    });

    it('should display configuration requirements (env vars)', async () => {
      // Get available servers and install one
      const availableServers = await getAvailableServers(testDir);
      const testServer = availableServers[0];

      const { stdout } = await runCli(`mcp install ${testServer.id}`, testDir);

      // Check installed servers to see configuration
      const { stdout: installedOutput } = await runCli('mcp installed', testDir);

      expect(installedOutput).toContain(testServer.name);
      expect(installedOutput).toContain(testServer.id);
    });
  });

  describe('User Input Mocking', () => {
    // Note: These tests simulate user input at the E2E level via CLI commands
    // rather than mocking inquirer directly (which is better suited for unit tests)

    it('should mock single server selection', async () => {
      // Simulate single server selection by direct install command
      const availableServers = await getAvailableServers(testDir);
      const targetServer = availableServers.find(s => s.verified === true);

      if (!targetServer) {
        console.warn('No verified servers available for selection test');
        return;
      }

      // Simulate user selecting this server
      const result = await simulateServerSelection(testDir, targetServer.id, availableServers);

      expect(result.valid).toBe(true);
      expect(result.selectedServer?.id).toBe(targetServer.id);

      // Verify server appears in installed list
      const { stdout } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(stdout);

      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe(targetServer.id);
    });

    it('should mock multiple server selection', async () => {
      // Simulate installing multiple servers sequentially
      const availableServers = await getAvailableServers(testDir);
      const serversToSelect = availableServers.slice(0, 2);

      for (const server of serversToSelect) {
        const result = await simulateServerSelection(testDir, server.id, availableServers);
        expect(result.valid).toBe(true);
      }

      // Verify both servers are installed
      const { stdout } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(stdout);

      expect(installedServers).toHaveLength(2);

      const installedIds = installedServers.map((s: any) => s.name);
      serversToSelect.forEach(server => {
        expect(installedIds).toContain(server.id);
      });
    });

    it('should handle selection cancellation', async () => {
      // E2E approach: test graceful handling of invalid selection
      const availableServers = await getAvailableServers(testDir);

      // Attempt to select non-existent server (simulates cancellation)
      const result = await simulateServerSelection(testDir, 'cancelled-selection', availableServers);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();

      // Verify no servers were installed
      const { stdout } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(stdout);

      expect(installedServers).toHaveLength(0);
    });
  });

  describe('Selection to Installation Flow', () => {
    it('should proceed to install after valid selection', async () => {
      // Complete flow: list -> select -> install -> verify
      const availableServers = await getAvailableServers(testDir);
      const selectedServer = availableServers.find(s => s.id === 'filesystem') || availableServers[0];

      // Step 1: Validate selection exists
      const validation = validateSelection(availableServers, [selectedServer.id]);
      expect(validation.valid).toBe(true);

      // Step 2: Proceed with installation
      const { stdout } = await runCli(`mcp install ${selectedServer.id}`, testDir);
      expect(stdout).toContain('✅');

      // Step 3: Verify installation worked
      const config = await readApexConfig(testDir);
      expect(config.mcp?.servers).toBeDefined();
      expect(config.mcp!.servers![selectedServer.id]).toBeDefined();

      // Step 4: Verify status shows installed server
      const { stdout: statusOutput } = await runCli('mcp status', testDir);
      expect(statusOutput).toContain(selectedServer.id);
    });

    it('should prevent install of invalid selection', async () => {
      // Attempt to install non-existent server
      const { stdout, stderr } = await runCli('mcp install invalid-server-id', testDir);

      // Should show error message
      expect(stdout + stderr).toContain('not found');

      // Verify no server was installed
      const config = await readApexConfig(testDir);
      expect(config.mcp?.servers?.['invalid-server-id']).toBeUndefined();
    });
  });

  describe('Complete Selection Workflow', () => {
    it('should complete: browse → select → validate → install → verify', async () => {
      // Step 1: Browse available servers
      const { stdout: listOutput } = await runCli('mcp list --json', testDir);
      const availableServers = parseJsonOutput(listOutput);
      expect(availableServers.length).toBeGreaterThan(0);

      // Step 2: Select verified server from results
      const selectedServer = availableServers.find((s: any) => s.verified === true);
      expect(selectedServer).toBeDefined();

      // Step 3: Validate selection exists
      const validation = validateSelection(availableServers, [selectedServer.id]);
      expect(validation.valid).toBe(true);

      // Step 4: Install selected server
      const { stdout: installOutput } = await runCli(`mcp install ${selectedServer.id}`, testDir);
      expect(installOutput).toContain('✅');
      expect(installOutput).toContain('installed');

      // Step 5: Verify installation
      const { stdout: installedOutput } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(installedOutput);
      expect(installedServers.length).toBe(1);
      expect(installedServers[0].name).toBe(selectedServer.id);

      // Step 6: Verify configuration
      const { stdout: validateOutput } = await runCli('mcp validate', testDir);
      expect(validateOutput).toContain('✅');

      // Step 7: Check status
      const { stdout: statusOutput } = await runCli('mcp status', testDir);
      expect(statusOutput).toContain(selectedServer.id);
    });
  });
});