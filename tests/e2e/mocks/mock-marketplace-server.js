"use strict";
/**
 * @fileoverview Mock MCP Marketplace Server for E2E Tests
 *
 * Provides configurable mock MCP servers that simulate marketplace-discovered
 * server behavior for E2E testing. These mocks support:
 * - Startup/shutdown lifecycle simulation
 * - Tool listing and invocation
 * - Configurable response behaviors (delays, errors)
 * - Request recording for assertions
 * - Health check simulation
 *
 * ## Architecture (ADR-071)
 *
 * This module builds on the existing MockMCPServer patterns from
 * `packages/orchestrator/src/__tests__/utils/mock-mcp-server.ts` while
 * adding marketplace-specific behaviors (install verification, config
 * generation, capability advertisement).
 *
 * @module tests/e2e/mocks/mock-marketplace-server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockServerManager = exports.MockMarketplaceServer = void 0;
exports.createMockMarketplaceServer = createMockMarketplaceServer;
exports.createFailingServer = createFailingServer;
exports.createSlowServer = createSlowServer;
exports.createUnreliableServer = createUnreliableServer;
exports.createDisconnectingServer = createDisconnectingServer;
exports.createFailingServer = createFailingServer;
exports.createSlowServer = createSlowServer;
exports.createCorruptedServer = createCorruptedServer;
exports.createCrashingServer = createCrashingServer;
const events_1 = require("events");
// ============================================================================
// MockMarketplaceServer Class
// ============================================================================
/**
 * A configurable mock MCP server that simulates marketplace-discovered server behavior.
 *
 * This class provides:
 * - Full lifecycle management (start, stop, restart)
 * - Tool listing and invocation simulation
 * - Request recording for assertions
 * - Configurable error injection
 * - Health check simulation
 * - Event emission for integration monitoring
 *
 * @example
 * ```typescript
 * const server = new MockMarketplaceServer(FILESYSTEM_SERVER, {
 *   startupDelayMs: 100,
 *   supportsHealthCheck: true,
 * });
 *
 * await server.start();
 * const tools = await server.listTools();
 * const result = await server.callTool('file-read', { path: '/test.txt' });
 * await server.stop();
 *
 * // Assert request was recorded
 * expect(server.getRecordedRequests()).toHaveLength(2);
 * ```
 */
class MockMarketplaceServer extends events_1.EventEmitter {
    state = 'stopped';
    requestCount = 0;
    successCount = 0;
    failCount = 0;
    startTime;
    connectionCount = 0;
    recordedRequests = [];
    responseTimes = [];
    /** The marketplace entry this server is based on */
    entry;
    /** Behavior configuration */
    behavior;
    /** Tools advertised by this server */
    tools;
    constructor(entry, behavior, tools) {
        super();
        this.entry = entry;
        this.behavior = {
            startupDelayMs: behavior?.startupDelayMs ?? 50,
            requestDelayMs: behavior?.requestDelayMs ?? 10,
            failOnStart: behavior?.failOnStart ?? false,
            startupErrorMessage: behavior?.startupErrorMessage ?? 'Mock startup failure',
            errorProbability: behavior?.errorProbability ?? 0,
            maxConcurrent: behavior?.maxConcurrent ?? 10,
            supportsHealthCheck: behavior?.supportsHealthCheck ?? true,
            healthCheckDelayMs: behavior?.healthCheckDelayMs ?? 5,
            disconnectAfterRequests: behavior?.disconnectAfterRequests ?? 0,
            networkErrorMode: behavior?.networkErrorMode,
            networkErrorAfterMs: behavior?.networkErrorAfterMs ?? 0,
            corruptResponseMode: behavior?.corruptResponseMode,
        };
        this.tools = tools ?? this.generateDefaultTools();
    }
    // ==========================================================================
    // Lifecycle Management
    // ==========================================================================
    /**
     * Start the mock server
     */
    async start() {
        if (this.state === 'running') {
            return;
        }
        this.state = 'starting';
        this.emit('state:change', 'starting');
        await this.delay(this.behavior.startupDelayMs);
        if (this.behavior.failOnStart) {
            this.state = 'error';
            this.emit('state:change', 'error');
            this.emit('error', new Error(this.behavior.startupErrorMessage));
            throw new Error(this.behavior.startupErrorMessage);
        }
        this.state = 'running';
        this.startTime = Date.now();
        this.connectionCount++;
        this.emit('state:change', 'running');
        this.emit('started');
    }
    /**
     * Stop the mock server
     */
    async stop() {
        if (this.state === 'stopped') {
            return;
        }
        this.state = 'stopping';
        this.emit('state:change', 'stopping');
        await this.delay(10);
        this.state = 'stopped';
        this.startTime = undefined;
        this.emit('state:change', 'stopped');
        this.emit('stopped');
    }
    /**
     * Restart the mock server
     */
    async restart() {
        await this.stop();
        await this.start();
    }
    /**
     * Get current server state
     */
    getState() {
        return this.state;
    }
    /**
     * Check if server is running
     */
    isRunning() {
        return this.state === 'running';
    }
    // ==========================================================================
    // Tool Operations
    // ==========================================================================
    /**
     * List available tools
     */
    async listTools() {
        this.ensureRunning();
        await this.simulateRequest('tools/list', {});
        return [...this.tools];
    }
    /**
     * Call a tool with the given arguments
     */
    async callTool(toolName, args = {}) {
        this.ensureRunning();
        const startTime = Date.now();
        // Check disconnect threshold
        if (this.behavior.disconnectAfterRequests > 0 &&
            this.requestCount >= this.behavior.disconnectAfterRequests) {
            this.state = 'error';
            this.emit('disconnected', 'Request limit reached');
            throw new Error('Connection lost: request limit reached');
        }
        // Simulate random errors
        if (this.behavior.errorProbability > 0 && Math.random() < this.behavior.errorProbability) {
            const error = new Error(`Random error on tool call: ${toolName}`);
            this.recordRequest('tools/call', { name: toolName, args }, startTime, false, error.message);
            throw error;
        }
        await this.delay(this.behavior.requestDelayMs);
        const tool = this.tools.find((t) => t.name === toolName);
        if (!tool) {
            const error = `Tool not found: ${toolName}`;
            this.recordRequest('tools/call', { name: toolName, args }, startTime, false, error);
            throw new Error(error);
        }
        const result = this.generateToolResponse(toolName, args);
        this.recordRequest('tools/call', { name: toolName, args }, startTime, true);
        return result;
    }
    /**
     * Simulate an initialize handshake
     */
    async initialize() {
        this.ensureRunning();
        await this.simulateRequest('initialize', {});
        return {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: false },
            },
            serverInfo: {
                name: this.entry.name,
                version: this.entry.version,
            },
        };
    }
    /**
     * Simulate a health check
     */
    async healthCheck() {
        if (!this.behavior.supportsHealthCheck) {
            throw new Error('Health check not supported');
        }
        const start = Date.now();
        await this.delay(this.behavior.healthCheckDelayMs);
        return {
            status: this.state === 'running' ? 'healthy' : 'unhealthy',
            latency: Date.now() - start,
        };
    }
    // ==========================================================================
    // Tool Management
    // ==========================================================================
    /**
     * Add a tool to this server
     */
    addTool(tool) {
        this.tools.push(tool);
        this.emit('tools:changed', this.tools);
    }
    /**
     * Remove a tool from this server
     */
    removeTool(name) {
        const index = this.tools.findIndex((t) => t.name === name);
        if (index >= 0) {
            this.tools.splice(index, 1);
            this.emit('tools:changed', this.tools);
            return true;
        }
        return false;
    }
    /**
     * Get current tool count
     */
    getToolCount() {
        return this.tools.length;
    }
    // ==========================================================================
    // Statistics and Recording
    // ==========================================================================
    /**
     * Get server statistics
     */
    getStats() {
        return {
            totalRequests: this.requestCount,
            successfulRequests: this.successCount,
            failedRequests: this.failCount,
            averageResponseTime: this.responseTimes.length > 0
                ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
                : 0,
            isRunning: this.state === 'running',
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            connectionCount: this.connectionCount,
        };
    }
    /**
     * Get all recorded requests
     */
    getRecordedRequests() {
        return [...this.recordedRequests];
    }
    /**
     * Get requests filtered by method
     */
    getRequestsByMethod(method) {
        return this.recordedRequests.filter((r) => r.method === method);
    }
    /**
     * Clear recorded requests
     */
    clearRecords() {
        this.recordedRequests = [];
        this.responseTimes = [];
    }
    /**
     * Reset all server state
     */
    reset() {
        this.state = 'stopped';
        this.requestCount = 0;
        this.successCount = 0;
        this.failCount = 0;
        this.startTime = undefined;
        this.connectionCount = 0;
        this.recordedRequests = [];
        this.responseTimes = [];
    }
    // ==========================================================================
    // Config Generation (for testing install workflows)
    // ==========================================================================
    /**
     * Generate the expected server config that would be written to config.yaml
     */
    getExpectedConfig() {
        return { ...this.entry.serverConfig };
    }
    /**
     * Generate install metadata
     */
    getInstallMetadata() {
        return {
            name: this.entry.name,
            version: this.entry.version,
            installedAt: new Date().toISOString(),
            source: 'marketplace',
        };
    }
    // ==========================================================================
    // Private Methods
    // ==========================================================================
    ensureRunning() {
        if (this.state !== 'running') {
            throw new Error(`Server ${this.entry.name} is not running (state: ${this.state})`);
        }
    }
    async simulateRequest(method, params) {
        const startTime = Date.now();
        this.requestCount++;
        await this.delay(this.behavior.requestDelayMs);
        this.recordRequest(method, params, startTime, true);
    }
    recordRequest(method, params, startTime, success, error) {
        const responseTime = Date.now() - startTime;
        this.responseTimes.push(responseTime);
        if (success) {
            this.successCount++;
        }
        else {
            this.failCount++;
        }
        this.recordedRequests.push({
            method,
            params,
            timestamp: startTime,
            responseTime,
            success,
            error,
        });
        this.requestCount++;
    }
    generateToolResponse(toolName, args) {
        // Generate contextual responses based on tool name patterns
        const responseText = this.getToolResponseText(toolName, args);
        return {
            content: [{ type: 'text', text: responseText }],
            isError: false,
        };
    }
    getToolResponseText(toolName, args) {
        // Provide realistic mock responses based on tool patterns
        if (toolName.includes('read') || toolName.includes('get')) {
            return JSON.stringify({
                content: `Mock content for ${args.path || args.key || 'unknown'}`,
                size: 42,
            });
        }
        if (toolName.includes('write') || toolName.includes('set')) {
            return JSON.stringify({
                success: true,
                path: args.path || args.key || 'unknown',
            });
        }
        if (toolName.includes('list') || toolName.includes('search')) {
            return JSON.stringify({
                results: [
                    { name: 'item-1', type: 'file' },
                    { name: 'item-2', type: 'directory' },
                ],
                count: 2,
            });
        }
        if (toolName.includes('delete') || toolName.includes('remove')) {
            return JSON.stringify({ deleted: true });
        }
        return JSON.stringify({
            result: `Mock execution of ${toolName}`,
            args,
            timestamp: new Date().toISOString(),
        });
    }
    generateDefaultTools() {
        // Generate tools based on server capabilities
        const capabilities = this.entry.capabilities || [];
        const tools = [];
        for (const cap of capabilities) {
            const [domain, action] = cap.split(':');
            if (domain && action) {
                tools.push({
                    name: `${domain}-${action}`,
                    description: `${action} operation for ${domain}`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            target: { type: 'string', description: `Target for ${action}` },
                        },
                        required: ['target'],
                    },
                });
            }
        }
        // Ensure at least one tool exists
        if (tools.length === 0) {
            tools.push({
                name: `${this.entry.name}-default`,
                description: `Default tool for ${this.entry.name}`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        input: { type: 'string', description: 'Input parameter' },
                    },
                },
            });
        }
        return tools;
    }
    delay(ms) {
        if (ms <= 0)
            return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.MockMarketplaceServer = MockMarketplaceServer;
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create a mock marketplace server from a marketplace entry
 */
function createMockMarketplaceServer(entry, behavior) {
    return new MockMarketplaceServer(entry, behavior);
}
/**
 * Create a mock server that simulates startup failure
 */
function createFailingServer(entry, errorMessage = 'Server failed to start') {
    return new MockMarketplaceServer(entry, {
        failOnStart: true,
        startupErrorMessage: errorMessage,
    });
}
/**
 * Create a slow mock server (for timeout testing)
 */
function createSlowServer(entry, delayMs = 2000) {
    return new MockMarketplaceServer(entry, {
        startupDelayMs: delayMs,
        requestDelayMs: delayMs / 2,
    });
}
/**
 * Create an unreliable mock server (random failures)
 */
function createUnreliableServer(entry, errorProbability = 0.3) {
    return new MockMarketplaceServer(entry, {
        errorProbability,
    });
}
/**
 * Create a server that disconnects after N requests
 */
function createDisconnectingServer(entry, disconnectAfter = 5) {
    return new MockMarketplaceServer(entry, {
        disconnectAfterRequests: disconnectAfter,
    });
}
// ============================================================================
// Mock Server Manager (for managing multiple servers in a test)
// ============================================================================
/**
 * Manages multiple mock marketplace servers for complex E2E test scenarios.
 *
 * @example
 * ```typescript
 * const manager = new MockServerManager();
 * manager.addServer(FILESYSTEM_SERVER);
 * manager.addServer(MEMORY_SERVER);
 *
 * await manager.startAll();
 * // ... run tests ...
 * await manager.stopAll();
 * ```
 */
class MockServerManager extends events_1.EventEmitter {
    servers = new Map();
    /**
     * Add a server to the manager
     */
    addServer(entry, behavior) {
        const server = createMockMarketplaceServer(entry, behavior);
        this.servers.set(entry.name, server);
        // Forward events
        server.on('started', () => this.emit('server:started', entry.name));
        server.on('stopped', () => this.emit('server:stopped', entry.name));
        server.on('error', (err) => this.emit('server:error', entry.name, err));
        return server;
    }
    /**
     * Get a server by name
     */
    getServer(name) {
        return this.servers.get(name);
    }
    /**
     * Start all servers
     */
    async startAll() {
        const startPromises = Array.from(this.servers.values()).map((s) => s.start().catch((err) => {
            this.emit('server:error', s.entry.name, err);
        }));
        await Promise.all(startPromises);
    }
    /**
     * Stop all servers
     */
    async stopAll() {
        const stopPromises = Array.from(this.servers.values()).map((s) => s.stop());
        await Promise.all(stopPromises);
    }
    /**
     * Get all server stats
     */
    getAllStats() {
        const stats = new Map();
        for (const [name, server] of this.servers) {
            stats.set(name, server.getStats());
        }
        return stats;
    }
    /**
     * Get count of running servers
     */
    getRunningCount() {
        return Array.from(this.servers.values()).filter((s) => s.isRunning()).length;
    }
    /**
     * Reset all servers
     */
    resetAll() {
        for (const server of this.servers.values()) {
            server.reset();
        }
    }
    /**
     * Remove all servers
     */
    clear() {
        this.servers.clear();
    }
    /**
     * Get all server names
     */
    getServerNames() {
        return Array.from(this.servers.keys());
    }
    /**
     * Get total request count across all servers
     */
    getTotalRequests() {
        let total = 0;
        for (const server of this.servers.values()) {
            total += server.getStats().totalRequests;
        }
        return total;
    }
}
exports.MockServerManager = MockServerManager;
// ============================================================================
// Error Scenario Factory Functions (ADR-076)
// ============================================================================
/**
 * Creates a mock server that simulates network failures
 *
 * @param entry - Marketplace entry for the server
 * @param errorMode - Type of network error to simulate
 * @returns MockMarketplaceServer configured for network failures
 */
function createFailingServer(entry, errorMode = 'refused') {
    return createMockMarketplaceServer(entry, {
        failOnStart: true,
        startupErrorMessage: `Network error: ${errorMode}`,
        networkErrorMode: errorMode,
        networkErrorAfterMs: 100,
        errorProbability: 1.0, // Always fail
    });
}
/**
 * Creates a mock server that simulates slow responses and timeouts
 *
 * @param entry - Marketplace entry for the server
 * @param delayMs - Delay in milliseconds (default: 30000 for timeout)
 * @returns MockMarketplaceServer configured for slow responses
 */
function createSlowServer(entry, delayMs = 30000) {
    return createMockMarketplaceServer(entry, {
        startupDelayMs: delayMs,
        requestDelayMs: delayMs / 2,
        healthCheckDelayMs: delayMs / 4,
        networkErrorAfterMs: delayMs,
    });
}
/**
 * Creates a mock server that returns corrupted responses
 *
 * @param entry - Marketplace entry for the server
 * @param corruptMode - Type of corruption to simulate
 * @returns MockMarketplaceServer configured for corrupted responses
 */
function createCorruptedServer(entry, corruptMode = 'malformed_json') {
    return createMockMarketplaceServer(entry, {
        corruptResponseMode: corruptMode,
        errorProbability: 0.8, // High chance of corruption
    });
}
/**
 * Creates a mock server that crashes during operation
 *
 * @param entry - Marketplace entry for the server
 * @param crashAfterRequests - Number of requests before crash (default: 3)
 * @returns MockMarketplaceServer configured to crash
 */
function createCrashingServer(entry, crashAfterRequests = 3) {
    return createMockMarketplaceServer(entry, {
        disconnectAfterRequests: crashAfterRequests,
        errorProbability: 0.5,
        startupErrorMessage: 'Server crashed during operation',
    });
}
//# sourceMappingURL=mock-marketplace-server.js.map