/**
 * @fileoverview MCP Marketplace Test Fixture Data
 *
 * Provides static and factory-generated test data for MCP marketplace E2E tests.
 * Fixtures mirror the structure of the real catalog.json and MCPMarketplaceEntry types
 * to ensure realistic test scenarios.
 *
 * ## Architecture (ADR-071)
 *
 * This module provides:
 * - Static marketplace entries representing common server types
 * - Dynamic fixture factories for generating test-specific scenarios
 * - Catalog structures matching the real MCPCatalog format
 * - Configuration fragments for config.yaml verification
 *
 * @module tests/e2e/fixtures/marketplace-data
 */
/**
 * Marketplace entry structure matching MCPMarketplaceEntry from @apex/core
 */
export interface MarketplaceEntry {
    name: string;
    description: string;
    version: string;
    author?: string;
    homepage?: string;
    repository?: string;
    installCommand?: string;
    serverConfig: ServerConfig;
    capabilities?: string[];
    verified?: boolean;
    category?: string;
    tags?: string[];
}
/**
 * Server configuration matching MCPServerConfig from @apex/core
 */
export interface ServerConfig {
    name: string;
    type?: 'stdio' | 'http' | 'sse' | 'sdk';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    autoStart?: boolean;
    capabilities?: string[];
}
/**
 * Catalog structure matching MCPCatalog from mcp-registry.ts
 */
export interface TestCatalog {
    version: string;
    updated: string;
    description: string;
    servers: MarketplaceEntry[];
    categories: Record<string, {
        name: string;
        description: string;
    }>;
}
/**
 * Environment variable definition for templates
 */
export interface EnvVarDefinition {
    name: string;
    description: string;
    required: boolean;
    sensitive: boolean;
    defaultValue?: string;
    source?: string;
}
/**
 * Filesystem server - the most basic verified server
 */
export declare const FILESYSTEM_SERVER: MarketplaceEntry;
/**
 * Memory server - verified, no auto-start
 */
export declare const MEMORY_SERVER: MarketplaceEntry;
/**
 * Fetch server - HTTP capabilities
 */
export declare const FETCH_SERVER: MarketplaceEntry;
/**
 * GitHub server - requires sensitive env vars
 */
export declare const GITHUB_SERVER: MarketplaceEntry;
/**
 * PostgreSQL server - requires database connection env vars
 */
export declare const POSTGRES_SERVER: MarketplaceEntry;
/**
 * Brave Search server - requires API key
 */
export declare const BRAVE_SEARCH_SERVER: MarketplaceEntry;
/**
 * Unverified community server (for testing verified filter)
 */
export declare const COMMUNITY_SERVER: MarketplaceEntry;
/**
 * HTTP-based server (for testing non-stdio transports)
 */
export declare const HTTP_SERVER: MarketplaceEntry;
/**
 * All static marketplace entries for use in test catalogs
 */
export declare const ALL_MARKETPLACE_ENTRIES: MarketplaceEntry[];
/**
 * Error scenario test entries for negative testing
 */
export declare const ERROR_TEST_ENTRIES: MarketplaceEntry[];
/**
 * Only verified servers
 */
export declare const VERIFIED_ENTRIES: MarketplaceEntry[];
/**
 * Servers requiring environment variables
 */
export declare const ENV_REQUIRING_ENTRIES: MarketplaceEntry[];
/**
 * Servers with auto-start enabled
 */
export declare const AUTO_START_ENTRIES: MarketplaceEntry[];
/**
 * Standard categories matching the real catalog.json
 */
export declare const STANDARD_CATEGORIES: Record<string, {
    name: string;
    description: string;
}>;
/**
 * Creates a complete test catalog with all entries
 */
export declare function createTestCatalog(overrides?: Partial<TestCatalog>): TestCatalog;
/**
 * Creates a minimal test catalog with only filesystem and memory servers
 */
export declare function createMinimalCatalog(): TestCatalog;
/**
 * Creates a catalog with only verified servers
 */
export declare function createVerifiedOnlyCatalog(): TestCatalog;
/**
 * Creates a marketplace entry with custom configuration
 */
export declare function createMarketplaceEntry(name: string, overrides?: Partial<MarketplaceEntry>): MarketplaceEntry;
/**
 * Creates a server config for testing installation
 */
export declare function createServerConfig(name: string, overrides?: Partial<ServerConfig>): ServerConfig;
/**
 * Creates environment variable definitions for a server
 */
export declare function createEnvVarDefinitions(vars: Array<{
    name: string;
    required?: boolean;
    sensitive?: boolean;
    defaultValue?: string;
}>): EnvVarDefinition[];
/**
 * Expected config structure after installing filesystem server
 */
export declare const EXPECTED_FILESYSTEM_CONFIG: {
    mcp: {
        servers: {
            filesystem: {
                name: string;
                type: string;
                command: string;
                args: string[];
                autoStart: boolean;
            };
        };
    };
};
/**
 * Expected config structure after installing multiple servers
 */
export declare const EXPECTED_MULTI_SERVER_CONFIG: {
    mcp: {
        servers: {
            filesystem: {
                name: string;
                type: string;
                command: string;
                args: string[];
                autoStart: boolean;
            };
            memory: {
                name: string;
                type: string;
                command: string;
                args: string[];
                autoStart: boolean;
            };
        };
    };
};
/**
 * Base APEX config structure with MCP section
 */
export declare function createBaseApexConfig(mcpServers?: Record<string, ServerConfig>): object;
/**
 * Invalid marketplace entry (missing required fields)
 */
export declare const INVALID_ENTRY_MISSING_NAME: Partial<MarketplaceEntry>;
/**
 * Invalid server config (missing command for stdio type)
 */
export declare const INVALID_CONFIG_NO_COMMAND: ServerConfig;
/**
 * Server with conflicting configuration
 */
export declare const CONFLICTING_SERVER: MarketplaceEntry;
/**
 * Server with intentionally invalid config (empty name)
 */
export declare const INVALID_CONFIG_SERVER: MarketplaceEntry;
/**
 * Server requiring unavailable dependencies
 */
export declare const MISSING_DEPS_SERVER: MarketplaceEntry;
/**
 * Server with malformed configuration (for corrupt YAML testing)
 */
export declare const MALFORMED_CONFIG_SERVER: MarketplaceEntry;
/**
 * Search queries and expected results for testing marketplace search
 */
export declare const SEARCH_TEST_CASES: readonly [{
    readonly query: "filesystem";
    readonly description: "Search by exact name";
    readonly expectedMinResults: 1;
    readonly expectedContains: readonly ["filesystem"];
}, {
    readonly query: "file";
    readonly description: "Search by partial name";
    readonly expectedMinResults: 1;
    readonly expectedContains: readonly ["filesystem"];
}, {
    readonly query: "database";
    readonly description: "Search by category keyword";
    readonly expectedMinResults: 1;
    readonly expectedContains: readonly ["postgres"];
}, {
    readonly query: "search";
    readonly description: "Search for search-related servers";
    readonly expectedMinResults: 1;
    readonly expectedContains: readonly ["brave-search"];
}, {
    readonly query: "nonexistent-server-xyz";
    readonly description: "Search with no results";
    readonly expectedMinResults: 0;
    readonly expectedContains: readonly [];
}, {
    readonly query: "http";
    readonly description: "Search by capability keyword";
    readonly expectedMinResults: 1;
    readonly expectedContains: readonly ["fetch"];
}];
/**
 * Category filter test cases
 */
export declare const CATEGORY_FILTER_CASES: readonly [{
    readonly category: "filesystem";
    readonly expectedMinCount: 1;
    readonly expectedServers: readonly ["filesystem"];
}, {
    readonly category: "database";
    readonly expectedMinCount: 1;
    readonly expectedServers: readonly ["memory", "postgres"];
}, {
    readonly category: "web";
    readonly expectedMinCount: 1;
    readonly expectedServers: readonly ["fetch"];
}, {
    readonly category: "nonexistent";
    readonly expectedMinCount: 0;
    readonly expectedServers: readonly [];
}];
//# sourceMappingURL=marketplace-data.d.ts.map