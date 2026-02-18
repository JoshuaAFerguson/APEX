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
/**
 * Path to the built CLI binary
 */
export declare function getCliPath(): string;
/**
 * Execute a CLI command and return structured result
 */
export declare function execCli(args: string, options: CLIExecOptions): Promise<CLIResult>;
/**
 * Execute an MCP subcommand
 */
export declare function execMCPCommand(subcommand: string, options: CLIExecOptions): Promise<CLIResult>;
/**
 * Execute an MCP command with --json flag for structured output
 */
export declare function execMCPCommandJson(subcommand: string, options: Omit<CLIExecOptions, 'parseJson'>): Promise<CLIResult>;
/**
 * Read and parse the APEX config file
 *
 * Note: Uses simple YAML parsing suitable for test verification.
 * For production YAML parsing, use the 'yaml' package.
 */
export declare function readApexConfig(projectDir: string): Promise<ApexConfig>;
/**
 * Write an APEX config file
 */
export declare function writeApexConfig(projectDir: string, config: ApexConfig): Promise<void>;
/**
 * Read only the MCP section from config
 */
export declare function readMCPConfig(projectDir: string): Promise<MCPConfigSection>;
/**
 * Check if a server exists in the config
 */
export declare function isServerInConfig(projectDir: string, serverName: string): Promise<boolean>;
/**
 * Get a specific server's config from the APEX config
 */
export declare function getServerFromConfig(projectDir: string, serverName: string): Promise<MCPServerEntry | null>;
/**
 * Create a temporary test project directory with .apex structure
 */
export declare function createTestProject(prefix?: string): Promise<string>;
/**
 * Create a test project with pre-installed MCP servers
 */
export declare function createTestProjectWithServers(servers: Record<string, MCPServerEntry>, prefix?: string): Promise<string>;
/**
 * Clean up a test project directory
 */
export declare function cleanupTestProject(testDir: string): Promise<void>;
/**
 * Assert a file exists at the given path
 */
export declare function assertFileExists(filePath: string): Promise<void>;
/**
 * Assert a directory exists at the given path
 */
export declare function assertDirectoryExists(dirPath: string): Promise<void>;
/**
 * Assert CLI output contains expected strings
 */
export declare function assertOutputContains(result: CLIResult, expected: string | string[]): void;
/**
 * Assert CLI output does not contain specific strings
 */
export declare function assertOutputNotContains(result: CLIResult, unexpected: string | string[]): void;
/**
 * Assert a server is properly configured in the project
 */
export declare function assertServerInstalled(projectDir: string, serverName: string, expectedConfig?: Partial<MCPServerEntry>): Promise<void>;
/**
 * Assert marketplace output matches expectations
 */
export declare function assertMarketplaceOutput(output: string, expectations: MarketplaceOutputExpectations): void;
/**
 * Simple YAML parser for test config files.
 * Handles basic key-value pairs, nested objects, and arrays.
 * Not a full YAML parser - suitable for APEX config format only.
 */
export declare function parseSimpleYaml(content: string): Record<string, unknown>;
/**
 * Simple YAML serializer for test config files.
 * Handles basic structures for APEX config format.
 */
export declare function serializeSimpleYaml(obj: Record<string, unknown>, indent?: number): string;
/**
 * Check if running in E2E test mode
 */
export declare function isE2EMode(): boolean;
/**
 * Check if running in CI environment
 */
export declare function isCI(): boolean;
/**
 * Get the test timeout based on environment
 */
export declare function getTestTimeout(): number;
/**
 * Check if the CLI binary is built and available
 */
export declare function isCliBinaryAvailable(): Promise<boolean>;
/**
 * Retry an async operation with configurable attempts
 */
export declare function retry<T>(operation: () => Promise<T>, options?: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: boolean;
}): Promise<T>;
/**
 * Wait for a condition to become true
 */
export declare function waitForCondition(condition: () => boolean | Promise<boolean>, options?: {
    timeout?: number;
    interval?: number;
    message?: string;
}): Promise<void>;
//# sourceMappingURL=mcp-test-utils.d.ts.map