"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForCondition = exports.retry = exports.isCliBinaryAvailable = exports.assertOutputNotContains = exports.assertOutputContains = exports.assertServerInstalled = exports.isServerInConfig = exports.readMCPConfig = exports.writeApexConfig = exports.readApexConfig = exports.execMCPCommandJson = exports.execMCPCommand = exports.execCli = exports.createSlowServer = exports.createFailingServer = exports.createMockMarketplaceServer = exports.MockServerManager = exports.MockMarketplaceServer = exports.ALL_MARKETPLACE_ENTRIES = exports.MEMORY_SERVER = exports.FILESYSTEM_SERVER = exports.mcpHelpers = void 0;
exports.createMCPTestContext = createMCPTestContext;
exports.startMockServer = startMockServer;
exports.startMockServers = startMockServers;
exports.getAggregateStats = getAggregateStats;
exports.writeTestCatalog = writeTestCatalog;
exports.writeDefaultTestCatalog = writeDefaultTestCatalog;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const mcp_test_utils_js_1 = require("../utils/mcp-test-utils.js");
Object.defineProperty(exports, "execCli", { enumerable: true, get: function () { return mcp_test_utils_js_1.execCli; } });
Object.defineProperty(exports, "execMCPCommand", { enumerable: true, get: function () { return mcp_test_utils_js_1.execMCPCommand; } });
Object.defineProperty(exports, "execMCPCommandJson", { enumerable: true, get: function () { return mcp_test_utils_js_1.execMCPCommandJson; } });
Object.defineProperty(exports, "readApexConfig", { enumerable: true, get: function () { return mcp_test_utils_js_1.readApexConfig; } });
Object.defineProperty(exports, "writeApexConfig", { enumerable: true, get: function () { return mcp_test_utils_js_1.writeApexConfig; } });
Object.defineProperty(exports, "readMCPConfig", { enumerable: true, get: function () { return mcp_test_utils_js_1.readMCPConfig; } });
Object.defineProperty(exports, "isServerInConfig", { enumerable: true, get: function () { return mcp_test_utils_js_1.isServerInConfig; } });
Object.defineProperty(exports, "assertServerInstalled", { enumerable: true, get: function () { return mcp_test_utils_js_1.assertServerInstalled; } });
Object.defineProperty(exports, "assertOutputContains", { enumerable: true, get: function () { return mcp_test_utils_js_1.assertOutputContains; } });
Object.defineProperty(exports, "assertOutputNotContains", { enumerable: true, get: function () { return mcp_test_utils_js_1.assertOutputNotContains; } });
Object.defineProperty(exports, "isCliBinaryAvailable", { enumerable: true, get: function () { return mcp_test_utils_js_1.isCliBinaryAvailable; } });
Object.defineProperty(exports, "retry", { enumerable: true, get: function () { return mcp_test_utils_js_1.retry; } });
Object.defineProperty(exports, "waitForCondition", { enumerable: true, get: function () { return mcp_test_utils_js_1.waitForCondition; } });
const marketplace_data_js_1 = require("../fixtures/marketplace-data.js");
Object.defineProperty(exports, "FILESYSTEM_SERVER", { enumerable: true, get: function () { return marketplace_data_js_1.FILESYSTEM_SERVER; } });
Object.defineProperty(exports, "MEMORY_SERVER", { enumerable: true, get: function () { return marketplace_data_js_1.MEMORY_SERVER; } });
Object.defineProperty(exports, "ALL_MARKETPLACE_ENTRIES", { enumerable: true, get: function () { return marketplace_data_js_1.ALL_MARKETPLACE_ENTRIES; } });
const mock_marketplace_server_js_1 = require("../mocks/mock-marketplace-server.js");
Object.defineProperty(exports, "MockMarketplaceServer", { enumerable: true, get: function () { return mock_marketplace_server_js_1.MockMarketplaceServer; } });
Object.defineProperty(exports, "MockServerManager", { enumerable: true, get: function () { return mock_marketplace_server_js_1.MockServerManager; } });
Object.defineProperty(exports, "createMockMarketplaceServer", { enumerable: true, get: function () { return mock_marketplace_server_js_1.createMockMarketplaceServer; } });
Object.defineProperty(exports, "createFailingServer", { enumerable: true, get: function () { return mock_marketplace_server_js_1.createFailingServer; } });
Object.defineProperty(exports, "createSlowServer", { enumerable: true, get: function () { return mock_marketplace_server_js_1.createSlowServer; } });
// ============================================================================
// Context Management
// ============================================================================
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
async function createMCPTestContext(options = {}) {
    const prefix = options.prefix ?? 'apex-e2e-mcp-';
    // Create project directory
    let projectDir;
    if (options.preInstalledServers) {
        projectDir = await (0, mcp_test_utils_js_1.createTestProjectWithServers)(options.preInstalledServers, prefix);
    }
    else {
        projectDir = await (0, mcp_test_utils_js_1.createTestProject)(prefix);
    }
    // Apply config overrides if any
    if (options.configOverrides) {
        const config = await (0, mcp_test_utils_js_1.readApexConfig)(projectDir);
        const merged = { ...config, ...options.configOverrides };
        await (0, mcp_test_utils_js_1.writeApexConfig)(projectDir, merged);
    }
    // Set up mock server manager
    const serverManager = new mock_marketplace_server_js_1.MockServerManager();
    // Auto-start mock servers if specified
    if (options.autoStartMocks) {
        for (const entry of options.autoStartMocks) {
            serverManager.addServer(entry);
        }
        await serverManager.startAll();
    }
    const configPath = path.join(projectDir, '.apex', 'config.yaml');
    const cliBinaryAvailable = await (0, mcp_test_utils_js_1.isCliBinaryAvailable)();
    const cleanup = async () => {
        await serverManager.stopAll();
        serverManager.clear();
        await (0, mcp_test_utils_js_1.cleanupTestProject)(projectDir);
    };
    // Register cleanup with global E2E helpers if available
    if (typeof globalThis !== 'undefined' && globalThis.apexE2EHelpers) {
        globalThis.apexE2EHelpers.registerTempDir(projectDir);
    }
    return {
        projectDir,
        configPath,
        serverManager,
        installedServers: [],
        cliBinaryAvailable,
        cleanup,
    };
}
// ============================================================================
// CLI Workflow Helpers
// ============================================================================
/**
 * High-level MCP E2E helper functions
 */
exports.mcpHelpers = {
    // ==========================================================================
    // Marketplace Browsing
    // ==========================================================================
    /**
     * List all available MCP servers from the marketplace
     */
    async listServers(ctx, jsonOutput = false) {
        const options = { cwd: ctx.projectDir };
        if (jsonOutput) {
            return (0, mcp_test_utils_js_1.execMCPCommandJson)('list', options);
        }
        return (0, mcp_test_utils_js_1.execMCPCommand)('list', options);
    },
    /**
     * Search for MCP servers by query string
     */
    async searchServers(ctx, query, jsonOutput = false) {
        const options = { cwd: ctx.projectDir };
        if (jsonOutput) {
            return (0, mcp_test_utils_js_1.execMCPCommandJson)(`search ${query}`, options);
        }
        return (0, mcp_test_utils_js_1.execMCPCommand)(`search ${query}`, options);
    },
    /**
     * Search servers by category
     */
    async searchByCategory(ctx, category, jsonOutput = false) {
        const options = { cwd: ctx.projectDir };
        const cmd = `list --category ${category}`;
        if (jsonOutput) {
            return (0, mcp_test_utils_js_1.execMCPCommandJson)(cmd, options);
        }
        return (0, mcp_test_utils_js_1.execMCPCommand)(cmd, options);
    },
    // ==========================================================================
    // Server Installation
    // ==========================================================================
    /**
     * Install an MCP server from the marketplace
     */
    async installServer(ctx, serverName) {
        const result = await (0, mcp_test_utils_js_1.execMCPCommand)(`install ${serverName}`, {
            cwd: ctx.projectDir,
        });
        if (result.success) {
            ctx.installedServers.push(serverName);
        }
        return result;
    },
    /**
     * Install multiple servers sequentially
     */
    async installServers(ctx, serverNames) {
        const results = new Map();
        for (const name of serverNames) {
            const result = await exports.mcpHelpers.installServer(ctx, name);
            results.set(name, result);
        }
        return results;
    },
    // ==========================================================================
    // Server Verification
    // ==========================================================================
    /**
     * List installed servers
     */
    async listInstalled(ctx, jsonOutput = false) {
        const options = { cwd: ctx.projectDir };
        if (jsonOutput) {
            return (0, mcp_test_utils_js_1.execMCPCommandJson)('installed', options);
        }
        return (0, mcp_test_utils_js_1.execMCPCommand)('installed', options);
    },
    /**
     * Validate MCP server configuration
     */
    async validate(ctx) {
        return (0, mcp_test_utils_js_1.execMCPCommand)('validate', { cwd: ctx.projectDir });
    },
    /**
     * Get MCP server status
     */
    async status(ctx) {
        return (0, mcp_test_utils_js_1.execMCPCommand)('status', { cwd: ctx.projectDir });
    },
    /**
     * Verify a server was properly installed
     */
    async verifyInstallation(ctx, serverName, expectedConfig) {
        await (0, mcp_test_utils_js_1.assertServerInstalled)(ctx.projectDir, serverName, expectedConfig);
    },
    // ==========================================================================
    // Config Manipulation
    // ==========================================================================
    /**
     * Read the current MCP config
     */
    async getConfig(ctx) {
        return (0, mcp_test_utils_js_1.readMCPConfig)(ctx.projectDir);
    },
    /**
     * Update the MCP config section
     */
    async setConfig(ctx, mcpConfig) {
        const config = await (0, mcp_test_utils_js_1.readApexConfig)(ctx.projectDir);
        config.mcp = mcpConfig;
        await (0, mcp_test_utils_js_1.writeApexConfig)(ctx.projectDir, config);
    },
    /**
     * Add a server directly to the config (bypassing CLI)
     */
    async addServerToConfig(ctx, name, serverConfig) {
        const config = await (0, mcp_test_utils_js_1.readApexConfig)(ctx.projectDir);
        if (!config.mcp) {
            config.mcp = {};
        }
        if (!config.mcp.servers) {
            config.mcp.servers = {};
        }
        config.mcp.servers[name] = serverConfig;
        await (0, mcp_test_utils_js_1.writeApexConfig)(ctx.projectDir, config);
    },
    /**
     * Remove a server from the config (bypassing CLI)
     */
    async removeServerFromConfig(ctx, name) {
        const config = await (0, mcp_test_utils_js_1.readApexConfig)(ctx.projectDir);
        if (config.mcp?.servers && name in config.mcp.servers) {
            delete config.mcp.servers[name];
            await (0, mcp_test_utils_js_1.writeApexConfig)(ctx.projectDir, config);
        }
    },
    // ==========================================================================
    // Assertion Helpers
    // ==========================================================================
    /**
     * Assert that the list command output contains expected servers
     */
    assertListContains(result, expectedServers) {
        (0, mcp_test_utils_js_1.assertOutputContains)(result, expectedServers);
    },
    /**
     * Assert that the list command output does NOT contain specific servers
     */
    assertListNotContains(result, unexpectedServers) {
        (0, mcp_test_utils_js_1.assertOutputNotContains)(result, unexpectedServers);
    },
    /**
     * Assert marketplace output matches expectations
     */
    assertMarketplace(result, expectations) {
        (0, mcp_test_utils_js_1.assertMarketplaceOutput)(result.stdout, expectations);
    },
    /**
     * Assert a command succeeded
     */
    assertSuccess(result, errorMessage) {
        if (!result.success) {
            throw new Error(errorMessage ||
                `Expected command to succeed.\nStderr: ${result.stderr}\nStdout: ${result.stdout}`);
        }
    },
    /**
     * Assert a command failed
     */
    assertFailure(result, errorMessage) {
        if (result.success) {
            throw new Error(errorMessage ||
                `Expected command to fail.\nStdout: ${result.stdout}`);
        }
    },
    // ==========================================================================
    // Complete Workflow Helpers
    // ==========================================================================
    /**
     * Run the complete happy path workflow:
     * list → search → install → installed → validate → status
     */
    async runHappyPathWorkflow(ctx, serverName) {
        const steps = [];
        const workflowStart = Date.now();
        let success = true;
        let firstError;
        const runStep = async (stepName, action) => {
            const stepStart = Date.now();
            try {
                const result = await action();
                steps.push({
                    step: stepName,
                    success: result.success,
                    output: result,
                    duration: Date.now() - stepStart,
                });
                if (!result.success && !firstError) {
                    firstError = `Step "${stepName}" failed: ${result.stderr}`;
                    success = false;
                }
                return result;
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                steps.push({
                    step: stepName,
                    success: false,
                    error: errorMsg,
                    duration: Date.now() - stepStart,
                });
                if (!firstError) {
                    firstError = `Step "${stepName}" threw: ${errorMsg}`;
                    success = false;
                }
                return null;
            }
        };
        // Step 1: List available servers
        await runStep('list', () => exports.mcpHelpers.listServers(ctx));
        // Step 2: Search for the target server
        await runStep('search', () => exports.mcpHelpers.searchServers(ctx, serverName));
        // Step 3: Install the server
        await runStep('install', () => exports.mcpHelpers.installServer(ctx, serverName));
        // Step 4: List installed servers
        await runStep('installed', () => exports.mcpHelpers.listInstalled(ctx));
        // Step 5: Validate configuration
        await runStep('validate', () => exports.mcpHelpers.validate(ctx));
        // Step 6: Check status
        await runStep('status', () => exports.mcpHelpers.status(ctx));
        return {
            success,
            steps,
            totalDuration: Date.now() - workflowStart,
            firstError,
        };
    },
    /**
     * Run a multi-server installation workflow
     */
    async runMultiInstallWorkflow(ctx, serverNames) {
        const steps = [];
        const workflowStart = Date.now();
        let success = true;
        let firstError;
        // Install each server
        for (const name of serverNames) {
            const stepStart = Date.now();
            try {
                const result = await exports.mcpHelpers.installServer(ctx, name);
                steps.push({
                    step: `install-${name}`,
                    success: result.success,
                    output: result,
                    duration: Date.now() - stepStart,
                });
                if (!result.success && !firstError) {
                    firstError = `Install "${name}" failed: ${result.stderr}`;
                    success = false;
                }
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                steps.push({
                    step: `install-${name}`,
                    success: false,
                    error: errorMsg,
                    duration: Date.now() - stepStart,
                });
                if (!firstError) {
                    firstError = errorMsg;
                    success = false;
                }
            }
        }
        // Verify all installed
        const verifyStart = Date.now();
        try {
            const result = await exports.mcpHelpers.listInstalled(ctx);
            steps.push({
                step: 'verify-installed',
                success: result.success,
                output: result,
                duration: Date.now() - verifyStart,
            });
        }
        catch (err) {
            steps.push({
                step: 'verify-installed',
                success: false,
                error: err instanceof Error ? err.message : String(err),
                duration: Date.now() - verifyStart,
            });
        }
        return {
            success,
            steps,
            totalDuration: Date.now() - workflowStart,
            firstError,
        };
    },
    // ==========================================================================
    // Server Health Verification Helpers
    // ==========================================================================
    /**
     * Verify server health status after installation
     */
    async verifyServerHealth(ctx, serverName) {
        const validateResult = await exports.mcpHelpers.validate(ctx);
        const statusResult = await exports.mcpHelpers.status(ctx);
        const healthy = validateResult.success &&
            statusResult.stdout.includes(serverName);
        return {
            healthy,
            details: healthy
                ? `Server ${serverName} is healthy`
                : `Server ${serverName} health check failed: ${validateResult.stderr || statusResult.stderr}`,
        };
    },
    /**
     * Run the complete E2E flow as a single scenario
     * browse → select → install → configure → verify
     */
    async runFullFlowScenario(ctx, serverName) {
        const steps = [];
        const flowStart = Date.now();
        const runStep = async (name, action) => {
            const stepStart = Date.now();
            try {
                const result = await action();
                return {
                    name,
                    success: result.success,
                    duration: Date.now() - stepStart,
                    error: result.success ? undefined : result.stderr,
                };
            }
            catch (err) {
                return {
                    name,
                    success: false,
                    duration: Date.now() - stepStart,
                    error: err instanceof Error ? err.message : String(err),
                };
            }
        };
        // Step 1: Browse marketplace
        steps.push(await runStep('browse', () => exports.mcpHelpers.listServers(ctx)));
        // Step 2: Select (search for server)
        steps.push(await runStep('select', () => exports.mcpHelpers.searchServers(ctx, serverName)));
        // Step 3: Install server
        steps.push(await runStep('install', () => exports.mcpHelpers.installServer(ctx, serverName)));
        // Step 4: Configure (verify config was applied)
        const configStepStart = Date.now();
        try {
            const config = await exports.mcpHelpers.getConfig(ctx);
            const serverConfigured = !!config.servers?.[serverName];
            steps.push({
                name: 'configure',
                success: serverConfigured,
                duration: Date.now() - configStepStart,
                error: serverConfigured ? undefined : `Server ${serverName} not found in config`,
            });
        }
        catch (err) {
            steps.push({
                name: 'configure',
                success: false,
                duration: Date.now() - configStepStart,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        // Step 5: Verify - health check
        steps.push(await runStep('verify-health', () => exports.mcpHelpers.validate(ctx)));
        // Step 6: Verify - server responds correctly
        steps.push(await runStep('verify-response', () => exports.mcpHelpers.status(ctx)));
        return {
            success: steps.every(s => s.success),
            steps,
            totalDuration: Date.now() - flowStart,
        };
    },
};
// ============================================================================
// Mock Server Integration Helpers
// ============================================================================
/**
 * Create and start a mock marketplace server for a specific entry
 */
async function startMockServer(ctx, entry, behavior) {
    const server = ctx.serverManager.addServer(entry, behavior);
    await server.start();
    return server;
}
/**
 * Create multiple mock servers for testing
 */
async function startMockServers(ctx, entries, behavior) {
    const servers = new Map();
    for (const entry of entries) {
        const server = ctx.serverManager.addServer(entry, behavior);
        servers.set(entry.name, server);
    }
    await ctx.serverManager.startAll();
    return servers;
}
/**
 * Get aggregate stats from all mock servers in context
 */
function getAggregateStats(ctx) {
    const stats = ctx.serverManager.getAllStats();
    let totalRequests = 0;
    let runningServers = 0;
    for (const serverStats of stats.values()) {
        totalRequests += serverStats.totalRequests;
        if (serverStats.isRunning)
            runningServers++;
    }
    return {
        totalRequests,
        runningServers,
        totalServers: stats.size,
    };
}
// ============================================================================
// Test Catalog Helpers
// ============================================================================
/**
 * Write a custom test catalog to the project's .apex directory
 */
async function writeTestCatalog(ctx, catalog) {
    const catalogPath = path.join(ctx.projectDir, '.apex', 'catalog.json');
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
    return catalogPath;
}
/**
 * Write the default test catalog with all entries
 */
async function writeDefaultTestCatalog(ctx) {
    return writeTestCatalog(ctx, (0, marketplace_data_js_1.createTestCatalog)());
}
//# sourceMappingURL=mcp-e2e-helpers.js.map