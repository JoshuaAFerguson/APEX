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
import { EventEmitter } from 'events';
import type { MarketplaceEntry, ServerConfig } from '../fixtures/marketplace-data.js';
/**
 * Configuration for mock marketplace server behavior
 */
export interface MockMarketplaceBehavior {
    /** Simulated startup delay in milliseconds */
    startupDelayMs?: number;
    /** Simulated request processing delay in milliseconds */
    requestDelayMs?: number;
    /** Whether to simulate startup failure */
    failOnStart?: boolean;
    /** Failure message when failOnStart is true */
    startupErrorMessage?: string;
    /** Error probability for random failures (0-1) */
    errorProbability?: number;
    /** Maximum concurrent tool executions */
    maxConcurrent?: number;
    /** Whether the server supports health checks */
    supportsHealthCheck?: boolean;
    /** Simulated health check response time */
    healthCheckDelayMs?: number;
    /** Whether to simulate connection drops after N requests */
    disconnectAfterRequests?: number;
    /** Simulate specific network error modes */
    networkErrorMode?: 'timeout' | 'refused' | 'reset';
    /** Delay before network error triggers */
    networkErrorAfterMs?: number;
    /** Simulate corrupted response data */
    corruptResponseMode?: 'malformed_json' | 'incomplete' | 'wrong_schema';
}
/**
 * Tool definition for mock servers
 */
export interface MockTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Recorded request for test assertions
 */
export interface RecordedRequest {
    method: string;
    params: unknown;
    timestamp: number;
    responseTime: number;
    success: boolean;
    error?: string;
}
/**
 * Mock server statistics
 */
export interface MockServerStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    isRunning: boolean;
    uptime: number;
    connectionCount: number;
}
/**
 * Server state for lifecycle tracking
 */
export type MockServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
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
export declare class MockMarketplaceServer extends EventEmitter {
    private state;
    private requestCount;
    private successCount;
    private failCount;
    private startTime?;
    private connectionCount;
    private recordedRequests;
    private responseTimes;
    /** The marketplace entry this server is based on */
    readonly entry: MarketplaceEntry;
    /** Behavior configuration */
    readonly behavior: Required<MockMarketplaceBehavior>;
    /** Tools advertised by this server */
    private tools;
    constructor(entry: MarketplaceEntry, behavior?: MockMarketplaceBehavior, tools?: MockTool[]);
    /**
     * Start the mock server
     */
    start(): Promise<void>;
    /**
     * Stop the mock server
     */
    stop(): Promise<void>;
    /**
     * Restart the mock server
     */
    restart(): Promise<void>;
    /**
     * Get current server state
     */
    getState(): MockServerState;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
    /**
     * List available tools
     */
    listTools(): Promise<MockTool[]>;
    /**
     * Call a tool with the given arguments
     */
    callTool(toolName: string, args?: Record<string, unknown>): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
        isError: boolean;
    }>;
    /**
     * Simulate an initialize handshake
     */
    initialize(): Promise<{
        protocolVersion: string;
        capabilities: Record<string, unknown>;
        serverInfo: {
            name: string;
            version: string;
        };
    }>;
    /**
     * Simulate a health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        latency: number;
    }>;
    /**
     * Add a tool to this server
     */
    addTool(tool: MockTool): void;
    /**
     * Remove a tool from this server
     */
    removeTool(name: string): boolean;
    /**
     * Get current tool count
     */
    getToolCount(): number;
    /**
     * Get server statistics
     */
    getStats(): MockServerStats;
    /**
     * Get all recorded requests
     */
    getRecordedRequests(): RecordedRequest[];
    /**
     * Get requests filtered by method
     */
    getRequestsByMethod(method: string): RecordedRequest[];
    /**
     * Clear recorded requests
     */
    clearRecords(): void;
    /**
     * Reset all server state
     */
    reset(): void;
    /**
     * Generate the expected server config that would be written to config.yaml
     */
    getExpectedConfig(): ServerConfig;
    /**
     * Generate install metadata
     */
    getInstallMetadata(): {
        name: string;
        version: string;
        installedAt: string;
        source: string;
    };
    private ensureRunning;
    private simulateRequest;
    private recordRequest;
    private generateToolResponse;
    private getToolResponseText;
    private generateDefaultTools;
    private delay;
}
/**
 * Create a mock marketplace server from a marketplace entry
 */
export declare function createMockMarketplaceServer(entry: MarketplaceEntry, behavior?: MockMarketplaceBehavior): MockMarketplaceServer;
/**
 * Create an unreliable mock server (random failures)
 */
export declare function createUnreliableServer(entry: MarketplaceEntry, errorProbability?: number): MockMarketplaceServer;
/**
 * Create a server that disconnects after N requests
 */
export declare function createDisconnectingServer(entry: MarketplaceEntry, disconnectAfter?: number): MockMarketplaceServer;
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
export declare class MockServerManager extends EventEmitter {
    private servers;
    /**
     * Add a server to the manager
     */
    addServer(entry: MarketplaceEntry, behavior?: MockMarketplaceBehavior): MockMarketplaceServer;
    /**
     * Get a server by name
     */
    getServer(name: string): MockMarketplaceServer | undefined;
    /**
     * Start all servers
     */
    startAll(): Promise<void>;
    /**
     * Stop all servers
     */
    stopAll(): Promise<void>;
    /**
     * Get all server stats
     */
    getAllStats(): Map<string, MockServerStats>;
    /**
     * Get count of running servers
     */
    getRunningCount(): number;
    /**
     * Reset all servers
     */
    resetAll(): void;
    /**
     * Remove all servers
     */
    clear(): void;
    /**
     * Get all server names
     */
    getServerNames(): string[];
    /**
     * Get total request count across all servers
     */
    getTotalRequests(): number;
}
/**
 * Creates a mock server that returns corrupted responses
 *
 * @param entry - Marketplace entry for the server
 * @param corruptMode - Type of corruption to simulate
 * @returns MockMarketplaceServer configured for corrupted responses
 */
export declare function createCorruptedServer(entry: MarketplaceEntry, corruptMode?: 'malformed_json' | 'incomplete' | 'wrong_schema'): MockMarketplaceServer;
/**
 * Creates a mock server that crashes during operation
 *
 * @param entry - Marketplace entry for the server
 * @param crashAfterRequests - Number of requests before crash (default: 3)
 * @returns MockMarketplaceServer configured to crash
 */
export declare function createCrashingServer(entry: MarketplaceEntry, crashAfterRequests?: number): MockMarketplaceServer;
//# sourceMappingURL=mock-marketplace-server.d.ts.map