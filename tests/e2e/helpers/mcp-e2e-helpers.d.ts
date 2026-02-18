/**
 * @fileoverview MCP Marketplace E2E Test Helpers
 *
 * High-level workflow helpers that compose the lower-level utilities, fixtures,
 * and mocks into reusable patterns for MCP marketplace E2E tests.
 *
 * ## Architecture (ADR-071)
 *
 * This is the top layer of the MCP E2E test infrastructure:
 * - Composes base utilities from `utils/mcp-test-utils.ts`
 * - Uses fixtures from `fixtures/marketplace-data.ts`
 * - Manages mocks from `mocks/mock-marketplace-server.ts`
 * - Integrates with existing E2E setup from `tests/e2e/setup.ts`
 *
 * ## Usage
 *
 * ```typescript
 * import { createMCPTestContext, mcpHelpers } from '../helpers/mcp-e2e-helpers';
 *
 * describe('MCP Marketplace', () => {
 *   let ctx: MCPTestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createMCPTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should list marketplace servers', async () => {
 *     const result = await mcpHelpers.listServers(ctx);
 *     expect(result.success).toBe(true);
 *   });
 * });
 * ```
 *
 * @module tests/e2e/helpers/mcp-e2e-helpers
 */
import { execCli, execMCPCommand, execMCPCommandJson, readApexConfig, writeApexConfig, readMCPConfig, isServerInConfig, assertServerInstalled, assertOutputContains, assertOutputNotContains, isCliBinaryAvailable, retry, waitForCondition, type CLIResult, type MCPServerEntry, type ApexConfig, type MCPConfigSection, type MarketplaceOutputExpectations } from '../utils/mcp-test-utils.js';
import { type MarketplaceEntry, type ServerConfig, type TestCatalog, FILESYSTEM_SERVER, MEMORY_SERVER, ALL_MARKETPLACE_ENTRIES } from '../fixtures/marketplace-data.js';
import { MockMarketplaceServer, MockServerManager, createMockMarketplaceServer, createFailingServer, createSlowServer, type MockMarketplaceBehavior, type MockServerStats } from '../mocks/mock-marketplace-server.js';
/**
 * MCP test context containing all state for a test scenario
 */
export interface MCPTestContext {
    /** Path to the temporary test project directory */
    projectDir: string;
    /** Path to .apex/config.yaml */
    configPath: string;
    /** Mock server manager for this test */
    serverManager: MockServerManager;
    /** List of servers installed during the test */
    installedServers: string[];
    /** Whether the CLI binary is available */
    cliBinaryAvailable: boolean;
    /** Cleanup function to tear down all resources */
    cleanup: () => Promise<void>;
}
/**
 * Options for creating an MCP test context
 */
export interface MCPTestContextOptions {
    /** Pre-installed servers in the config */
    preInstalledServers?: Record<string, MCPServerEntry>;
    /** Mock servers to start automatically */
    autoStartMocks?: MarketplaceEntry[];
    /** Custom APEX config overrides */
    configOverrides?: Partial<ApexConfig>;
    /** Test directory prefix */
    prefix?: string;
}
/**
 * Result of a marketplace workflow step
 */
export interface WorkflowStepResult {
    /** Step name */
    step: string;
    /** Whether the step succeeded */
    success: boolean;
    /** CLI output if applicable */
    output?: CLIResult;
    /** Error message if failed */
    error?: string;
    /** Duration in milliseconds */
    duration: number;
}
/**
 * Flow step result for full E2E scenarios
 */
export interface FlowStep {
    /** Step name */
    name: string;
    /** Whether the step succeeded */
    success: boolean;
    /** Duration in milliseconds */
    duration: number;
    /** Error details if failed */
    error?: string;
}
/**
 * Full flow scenario result
 */
export interface FullFlowResult {
    /** Whether the entire flow succeeded */
    success: boolean;
    /** Individual flow steps */
    steps: FlowStep[];
    /** Total duration in milliseconds */
    totalDuration: number;
}
/**
 * Complete marketplace workflow result
 */
export interface MarketplaceWorkflowResult {
    /** Whether all steps completed successfully */
    success: boolean;
    /** Individual step results */
    steps: WorkflowStepResult[];
    /** Total duration */
    totalDuration: number;
    /** First error encountered */
    firstError?: string;
}
/**
 * Create a new MCP test context with isolated project directory
 *
 * @example
 * ```typescript
 * const ctx = await createMCPTestContext();
 * // ... run tests ...
 * await ctx.cleanup();
 * ```
 */
export declare function createMCPTestContext(options?: MCPTestContextOptions): Promise<MCPTestContext>;
/**
 * High-level MCP E2E helper functions
 */
export declare const mcpHelpers: {
    /**
     * List all available MCP servers from the marketplace
     */
    listServers(ctx: MCPTestContext, jsonOutput?: boolean): Promise<CLIResult>;
    /**
     * Search for MCP servers by query string
     */
    searchServers(ctx: MCPTestContext, query: string, jsonOutput?: boolean): Promise<CLIResult>;
    /**
     * Search servers by category
     */
    searchByCategory(ctx: MCPTestContext, category: string, jsonOutput?: boolean): Promise<CLIResult>;
    /**
     * Install an MCP server from the marketplace
     */
    installServer(ctx: MCPTestContext, serverName: string): Promise<CLIResult>;
    /**
     * Install multiple servers sequentially
     */
    installServers(ctx: MCPTestContext, serverNames: string[]): Promise<Map<string, CLIResult>>;
    /**
     * List installed servers
     */
    listInstalled(ctx: MCPTestContext, jsonOutput?: boolean): Promise<CLIResult>;
    /**
     * Validate MCP server configuration
     */
    validate(ctx: MCPTestContext): Promise<CLIResult>;
    /**
     * Get MCP server status
     */
    status(ctx: MCPTestContext): Promise<CLIResult>;
    /**
     * Verify a server was properly installed
     */
    verifyInstallation(ctx: MCPTestContext, serverName: string, expectedConfig?: Partial<MCPServerEntry>): Promise<void>;
    /**
     * Read the current MCP config
     */
    getConfig(ctx: MCPTestContext): Promise<MCPConfigSection>;
    /**
     * Update the MCP config section
     */
    setConfig(ctx: MCPTestContext, mcpConfig: MCPConfigSection): Promise<void>;
    /**
     * Add a server directly to the config (bypassing CLI)
     */
    addServerToConfig(ctx: MCPTestContext, name: string, serverConfig: MCPServerEntry): Promise<void>;
    /**
     * Remove a server from the config (bypassing CLI)
     */
    removeServerFromConfig(ctx: MCPTestContext, name: string): Promise<void>;
    /**
     * Assert that the list command output contains expected servers
     */
    assertListContains(result: CLIResult, expectedServers: string[]): void;
    /**
     * Assert that the list command output does NOT contain specific servers
     */
    assertListNotContains(result: CLIResult, unexpectedServers: string[]): void;
    /**
     * Assert marketplace output matches expectations
     */
    assertMarketplace(result: CLIResult, expectations: MarketplaceOutputExpectations): void;
    /**
     * Assert a command succeeded
     */
    assertSuccess(result: CLIResult, errorMessage?: string): void;
    /**
     * Assert a command failed
     */
    assertFailure(result: CLIResult, errorMessage?: string): void;
    /**
     * Run the complete happy path workflow:
     * list → search → install → installed → validate → status
     */
    runHappyPathWorkflow(ctx: MCPTestContext, serverName: string): Promise<MarketplaceWorkflowResult>;
    /**
     * Run a multi-server installation workflow
     */
    runMultiInstallWorkflow(ctx: MCPTestContext, serverNames: string[]): Promise<MarketplaceWorkflowResult>;
    /**
     * Verify server health status after installation
     */
    verifyServerHealth(ctx: MCPTestContext, serverName: string): Promise<{
        healthy: boolean;
        details: string;
    }>;
    /**
     * Run the complete E2E flow as a single scenario
     * browse → select → install → configure → verify
     */
    runFullFlowScenario(ctx: MCPTestContext, serverName: string): Promise<FullFlowResult>;
};
/**
 * Create and start a mock marketplace server for a specific entry
 */
export declare function startMockServer(ctx: MCPTestContext, entry: MarketplaceEntry, behavior?: MockMarketplaceBehavior): Promise<MockMarketplaceServer>;
/**
 * Create multiple mock servers for testing
 */
export declare function startMockServers(ctx: MCPTestContext, entries: MarketplaceEntry[], behavior?: MockMarketplaceBehavior): Promise<Map<string, MockMarketplaceServer>>;
/**
 * Get aggregate stats from all mock servers in context
 */
export declare function getAggregateStats(ctx: MCPTestContext): {
    totalRequests: number;
    runningServers: number;
    totalServers: number;
};
/**
 * Write a custom test catalog to the project's .apex directory
 */
export declare function writeTestCatalog(ctx: MCPTestContext, catalog: TestCatalog): Promise<string>;
/**
 * Write the default test catalog with all entries
 */
export declare function writeDefaultTestCatalog(ctx: MCPTestContext): Promise<string>;
export { type CLIResult, type MCPServerEntry, type ApexConfig, type MCPConfigSection, type MarketplaceOutputExpectations, type FlowStep, type FullFlowResult, type MarketplaceEntry, type ServerConfig, FILESYSTEM_SERVER, MEMORY_SERVER, ALL_MARKETPLACE_ENTRIES, MockMarketplaceServer, MockServerManager, createMockMarketplaceServer, createFailingServer, createSlowServer, type MockMarketplaceBehavior, type MockServerStats, execCli, execMCPCommand, execMCPCommandJson, readApexConfig, writeApexConfig, readMCPConfig, isServerInConfig, assertServerInstalled, assertOutputContains, assertOutputNotContains, isCliBinaryAvailable, retry, waitForCondition, };
//# sourceMappingURL=mcp-e2e-helpers.d.ts.map