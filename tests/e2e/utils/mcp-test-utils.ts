/**
 * @fileoverview Base Test Utilities for MCP Marketplace E2E Tests
 *
 * Provides low-level utilities for:
 * - CLI execution with MCP-specific defaults
 * - Config file manipulation (read/write YAML)
 * - File system assertions
 * - Output parsing and validation
 * - Test environment configuration
 *
 * ## Architecture (ADR-071)
 *
 * This is the lowest layer of the MCP E2E test infrastructure, providing
 * primitive operations that higher-level helpers compose into workflows.
 *
 * @module tests/e2e/utils/mcp-test-utils
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a CLI command execution
 */
export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  /** Parsed JSON output (if --json flag was used) */
  json?: unknown;
  /** Execution time in milliseconds */
  duration: number;
}

/**
 * Options for CLI execution
 */
export interface CLIExecOptions {
  /** Working directory for the command */
  cwd: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Command timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to parse stdout as JSON */
  parseJson?: boolean;
  /** Whether to suppress NO_COLOR (default: true) */
  noColor?: boolean;
}

/**
 * MCP config section from .apex/config.yaml
 */
export interface MCPConfigSection {
  servers?: Record<string, MCPServerEntry>;
  marketplace?: {
    sources?: Array<{
      url: string;
      enabled?: boolean;
    }>;
  };
}

/**
 * Individual server entry in MCP config
 */
export interface MCPServerEntry {
  name: string;
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  autoStart?: boolean;
  capabilities?: string[];
}

/**
 * Full APEX config structure
 */
export interface ApexConfig {
  project?: {
    name?: string;
    language?: string;
  };
  autonomy?: {
    default?: string;
  };
  models?: Record<string, string>;
  limits?: Record<string, number>;
  mcp?: MCPConfigSection;
  [key: string]: unknown;
}

/**
 * Marketplace output expectations for assertions
 */
export interface MarketplaceOutputExpectations {
  /** Expected server names in output */
  containsServers?: string[];
  /** Expected strings not in output */
  doesNotContain?: string[];
  /** Minimum number of entries */
  minEntries?: number;
  /** Maximum number of entries */
  maxEntries?: number;
  /** Expected categories */
  containsCategories?: string[];
}

// ============================================================================
// CLI Execution Utilities
// ============================================================================

/**
 * Path to the built CLI binary
 */
export function getCliPath(): string {
  return path.resolve(__dirname, '../../../packages/cli/dist/index.js');
}

/**
 * Execute a CLI command and return structured result
 */
export async function execCli(
  args: string,
  options: CLIExecOptions
): Promise<CLIResult> {
  const cliPath = getCliPath();
  const startTime = Date.now();
  const timeout = options.timeout ?? 30000;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    NODE_ENV: 'test',
    APEX_TEST_MODE: 'e2e',
    ...(options.noColor !== false ? { NO_COLOR: '1' } : {}),
    ...(options.env ?? {}),
  };

  try {
    const { stdout, stderr } = await execAsync(`node ${cliPath} ${args}`, {
      cwd: options.cwd,
      env,
      timeout,
    });

    const duration = Date.now() - startTime;
    let json: unknown = undefined;

    if (options.parseJson && stdout.trim()) {
      try {
        json = JSON.parse(stdout.trim());
      } catch {
        // Not valid JSON, leave as undefined
      }
    }

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: 0,
      success: true,
      json,
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };

    return {
      stdout: execError.stdout?.toString() || '',
      stderr: execError.stderr?.toString() || execError.message || '',
      exitCode: execError.code ?? 1,
      success: false,
      duration,
    };
  }
}

/**
 * Execute an MCP subcommand
 */
export async function execMCPCommand(
  subcommand: string,
  options: CLIExecOptions
): Promise<CLIResult> {
  return execCli(`mcp ${subcommand}`, options);
}

/**
 * Execute an MCP command with --json flag for structured output
 */
export async function execMCPCommandJson(
  subcommand: string,
  options: Omit<CLIExecOptions, 'parseJson'>
): Promise<CLIResult> {
  return execCli(`mcp ${subcommand} --json`, {
    ...options,
    parseJson: true,
  });
}

// ============================================================================
// Config File Utilities
// ============================================================================

/**
 * Read and parse the APEX config file
 *
 * Note: Uses simple YAML parsing suitable for test verification.
 * For production YAML parsing, use the 'yaml' package.
 */
export async function readApexConfig(projectDir: string): Promise<ApexConfig> {
  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const content = await fs.readFile(configPath, 'utf-8');
  return parseSimpleYaml(content) as ApexConfig;
}

/**
 * Write an APEX config file
 */
export async function writeApexConfig(
  projectDir: string,
  config: ApexConfig
): Promise<void> {
  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const content = serializeSimpleYaml(config);
  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Read only the MCP section from config
 */
export async function readMCPConfig(projectDir: string): Promise<MCPConfigSection> {
  const config = await readApexConfig(projectDir);
  return config.mcp ?? {};
}

/**
 * Check if a server exists in the config
 */
export async function isServerInConfig(
  projectDir: string,
  serverName: string
): Promise<boolean> {
  const mcpConfig = await readMCPConfig(projectDir);
  return !!(mcpConfig.servers && serverName in mcpConfig.servers);
}

/**
 * Get a specific server's config from the APEX config
 */
export async function getServerFromConfig(
  projectDir: string,
  serverName: string
): Promise<MCPServerEntry | null> {
  const mcpConfig = await readMCPConfig(projectDir);
  return mcpConfig.servers?.[serverName] ?? null;
}

// ============================================================================
// Project Setup Utilities
// ============================================================================

/**
 * Create a temporary test project directory with .apex structure
 */
export async function createTestProject(
  prefix = 'apex-e2e-mcp-'
): Promise<string> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

  // Create .apex directory structure
  const apexDir = path.join(testDir, '.apex');
  await fs.mkdir(apexDir, { recursive: true });
  await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
  await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

  // Write default config
  const defaultConfig: ApexConfig = {
    project: {
      name: 'e2e-mcp-test',
      language: 'typescript',
    },
    autonomy: {
      default: 'supervised',
    },
    models: {
      planning: 'sonnet',
      implementation: 'sonnet',
    },
    limits: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 10,
    },
  };

  await writeApexConfig(testDir, defaultConfig);

  return testDir;
}

/**
 * Create a test project with pre-installed MCP servers
 */
export async function createTestProjectWithServers(
  servers: Record<string, MCPServerEntry>,
  prefix = 'apex-e2e-mcp-'
): Promise<string> {
  const testDir = await createTestProject(prefix);

  const config = await readApexConfig(testDir);
  config.mcp = {
    servers,
  };
  await writeApexConfig(testDir, config);

  return testDir;
}

/**
 * Clean up a test project directory
 */
export async function cleanupTestProject(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Assert a file exists at the given path
 */
export async function assertFileExists(filePath: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
}

/**
 * Assert a directory exists at the given path
 */
export async function assertDirectoryExists(dirPath: string): Promise<void> {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`Expected directory, got file: ${dirPath}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Expected directory')) {
      throw err;
    }
    throw new Error(`Expected directory to exist: ${dirPath}`);
  }
}

/**
 * Assert CLI output contains expected strings
 */
export function assertOutputContains(
  result: CLIResult,
  expected: string | string[]
): void {
  const expectations = Array.isArray(expected) ? expected : [expected];
  const combined = result.stdout + result.stderr;

  for (const exp of expectations) {
    if (!combined.includes(exp)) {
      throw new Error(
        `Expected output to contain "${exp}".\nStdout: ${result.stdout}\nStderr: ${result.stderr}`
      );
    }
  }
}

/**
 * Assert CLI output does not contain specific strings
 */
export function assertOutputNotContains(
  result: CLIResult,
  unexpected: string | string[]
): void {
  const expectations = Array.isArray(unexpected) ? unexpected : [unexpected];
  const combined = result.stdout + result.stderr;

  for (const exp of expectations) {
    if (combined.includes(exp)) {
      throw new Error(
        `Expected output NOT to contain "${exp}".\nStdout: ${result.stdout}\nStderr: ${result.stderr}`
      );
    }
  }
}

/**
 * Assert a server is properly configured in the project
 */
export async function assertServerInstalled(
  projectDir: string,
  serverName: string,
  expectedConfig?: Partial<MCPServerEntry>
): Promise<void> {
  const server = await getServerFromConfig(projectDir, serverName);

  if (!server) {
    throw new Error(
      `Expected server "${serverName}" to be installed in config at ${projectDir}`
    );
  }

  if (expectedConfig) {
    for (const [key, value] of Object.entries(expectedConfig)) {
      const actual = (server as Record<string, unknown>)[key];
      if (JSON.stringify(actual) !== JSON.stringify(value)) {
        throw new Error(
          `Server "${serverName}" config mismatch for "${key}":\n` +
            `  Expected: ${JSON.stringify(value)}\n` +
            `  Actual: ${JSON.stringify(actual)}`
        );
      }
    }
  }
}

/**
 * Assert marketplace output matches expectations
 */
export function assertMarketplaceOutput(
  output: string,
  expectations: MarketplaceOutputExpectations
): void {
  if (expectations.containsServers) {
    for (const server of expectations.containsServers) {
      if (!output.includes(server)) {
        throw new Error(`Expected marketplace output to contain server "${server}"`);
      }
    }
  }

  if (expectations.doesNotContain) {
    for (const text of expectations.doesNotContain) {
      if (output.includes(text)) {
        throw new Error(`Expected marketplace output NOT to contain "${text}"`);
      }
    }
  }
}

// ============================================================================
// YAML Utilities (Simple parser for test purposes)
// ============================================================================

/**
 * Simple YAML parser for test config files.
 * Handles basic key-value pairs, nested objects, and arrays.
 * Not a full YAML parser - suitable for APEX config format only.
 */
export function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: result },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');

    // Skip empty lines and comments
    if (!trimmed || trimmed.trim().startsWith('#')) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const keyValueMatch = trimmed.trim().match(/^([^:]+):\s*(.*)$/);

    if (!keyValueMatch) {
      // Handle array items
      const arrayMatch = trimmed.trim().match(/^-\s*(.+)$/);
      if (arrayMatch) {
        // Find parent and append to its last key's array
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }
        const parent = stack[stack.length - 1].obj;
        const lastKey = Object.keys(parent).pop();
        if (lastKey) {
          if (!Array.isArray(parent[lastKey])) {
            parent[lastKey] = [];
          }
          const value = parseYamlValue(arrayMatch[1]);
          (parent[lastKey] as unknown[]).push(value);
        }
      }
      continue;
    }

    const key = keyValueMatch[1].trim();
    const value = keyValueMatch[2].trim();

    // Pop stack to find correct parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const currentObj = stack[stack.length - 1].obj;

    if (value === '' || value === undefined) {
      // Nested object
      const newObj: Record<string, unknown> = {};
      currentObj[key] = newObj;
      stack.push({ indent, obj: newObj });
    } else {
      // Simple value
      currentObj[key] = parseYamlValue(value);
    }
  }

  return result;
}

/**
 * Parse a YAML value string into appropriate type
 */
function parseYamlValue(value: string): unknown {
  // Handle quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Handle booleans
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Handle null
  if (value === 'null' || value === '~') return null;

  // Handle numbers
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;

  // Handle inline arrays
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => parseYamlValue(v.trim()));
  }

  return value;
}

/**
 * Simple YAML serializer for test config files.
 * Handles basic structures for APEX config format.
 */
export function serializeSimpleYaml(
  obj: Record<string, unknown>,
  indent = 0
): string {
  let result = '';
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      result += `${prefix}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          result += `${prefix}  - ${serializeSimpleYaml(item as Record<string, unknown>, indent + 2).trimStart()}`;
        } else {
          result += `${prefix}  - ${serializeYamlValue(item)}\n`;
        }
      }
    } else if (typeof value === 'object') {
      result += `${prefix}${key}:\n`;
      result += serializeSimpleYaml(value as Record<string, unknown>, indent + 1);
    } else {
      result += `${prefix}${key}: ${serializeYamlValue(value)}\n`;
    }
  }

  return result;
}

/**
 * Serialize a scalar YAML value
 */
function serializeYamlValue(value: unknown): string {
  if (typeof value === 'string') {
    // Quote strings that could be confused with other types
    if (
      value === '' ||
      value === 'true' ||
      value === 'false' ||
      value === 'null' ||
      !isNaN(Number(value))
    ) {
      return `"${value}"`;
    }
    // Quote strings with special characters
    if (/[:{}\[\],&*?|>!%@`]/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (value === null) return 'null';
  return String(value);
}

// ============================================================================
// Test Environment Detection
// ============================================================================

/**
 * Check if running in E2E test mode
 */
export function isE2EMode(): boolean {
  return process.env.APEX_TEST_MODE === 'e2e';
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1';
}

/**
 * Get the test timeout based on environment
 */
export function getTestTimeout(): number {
  if (isCI()) return 60000;
  return 30000;
}

/**
 * Check if the CLI binary is built and available
 */
export async function isCliBinaryAvailable(): Promise<boolean> {
  try {
    await fs.stat(getCliPath());
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Retry an async operation with configurable attempts
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number; backoff?: boolean } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = true } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts) {
        const wait = backoff ? delayMs * attempt : delayMs;
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  throw lastError!;
}

/**
 * Wait for a condition to become true
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}
