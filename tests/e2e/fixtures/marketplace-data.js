"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECTION_VALIDATION_CASES = exports.SELECTION_TEST_CASES = exports.CATEGORY_FILTER_CASES = exports.SEARCH_TEST_CASES = exports.MALFORMED_CONFIG_SERVER = exports.MISSING_DEPS_SERVER = exports.INVALID_CONFIG_SERVER = exports.CONFLICTING_SERVER = exports.INVALID_CONFIG_NO_COMMAND = exports.INVALID_ENTRY_MISSING_NAME = exports.EXPECTED_MULTI_SERVER_CONFIG = exports.EXPECTED_FILESYSTEM_CONFIG = exports.STANDARD_CATEGORIES = exports.AUTO_START_ENTRIES = exports.ENV_REQUIRING_ENTRIES = exports.VERIFIED_ENTRIES = exports.ERROR_TEST_ENTRIES = exports.ALL_MARKETPLACE_ENTRIES = exports.HTTP_SERVER = exports.COMMUNITY_SERVER = exports.BRAVE_SEARCH_SERVER = exports.POSTGRES_SERVER = exports.GITHUB_SERVER = exports.FETCH_SERVER = exports.MEMORY_SERVER = exports.FILESYSTEM_SERVER = void 0;
exports.createTestCatalog = createTestCatalog;
exports.createMinimalCatalog = createMinimalCatalog;
exports.createVerifiedOnlyCatalog = createVerifiedOnlyCatalog;
exports.createMarketplaceEntry = createMarketplaceEntry;
exports.createServerConfig = createServerConfig;
exports.createEnvVarDefinitions = createEnvVarDefinitions;
exports.createBaseApexConfig = createBaseApexConfig;
// ============================================================================
// Static Marketplace Entries
// ============================================================================
/**
 * Filesystem server - the most basic verified server
 */
exports.FILESYSTEM_SERVER = {
    name: 'filesystem',
    description: 'Direct filesystem access for reading, writing, and managing files and directories',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    homepage: 'https://modelcontextprotocol.io/servers/filesystem',
    verified: true,
    category: 'filesystem',
    capabilities: [
        'file:read',
        'file:write',
        'file:create',
        'file:delete',
        'directory:list',
        'directory:create',
    ],
    serverConfig: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
        env: {},
        autoStart: true,
    },
};
/**
 * Memory server - verified, no auto-start
 */
exports.MEMORY_SERVER = {
    name: 'memory',
    description: 'In-memory key-value store for temporary data persistence during sessions',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    verified: true,
    category: 'database',
    capabilities: ['db:get', 'db:set', 'db:delete', 'db:list'],
    serverConfig: {
        name: 'memory',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: {},
        autoStart: false,
    },
};
/**
 * Fetch server - HTTP capabilities
 */
exports.FETCH_SERVER = {
    name: 'fetch',
    description: 'HTTP fetch capabilities for making web requests and retrieving content',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    verified: true,
    category: 'web',
    capabilities: ['http:get', 'http:post', 'http:put', 'http:delete'],
    serverConfig: {
        name: 'fetch',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        env: {},
        autoStart: false,
    },
};
/**
 * GitHub server - requires sensitive env vars
 */
exports.GITHUB_SERVER = {
    name: 'github',
    description: 'GitHub integration for repository management, issues, and pull requests',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    verified: true,
    category: 'development',
    capabilities: ['git:clone', 'git:commit', 'git:push', 'git:pull'],
    serverConfig: {
        name: 'github',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: '',
        },
        autoStart: false,
    },
};
/**
 * PostgreSQL server - requires database connection env vars
 */
exports.POSTGRES_SERVER = {
    name: 'postgres',
    description: 'PostgreSQL database access for queries, schema management, and data operations',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    verified: true,
    category: 'database',
    capabilities: ['db:query', 'db:schema', 'db:migrate'],
    serverConfig: {
        name: 'postgres',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {
            POSTGRES_CONNECTION_STRING: '',
        },
        autoStart: false,
    },
};
/**
 * Brave Search server - requires API key
 */
exports.BRAVE_SEARCH_SERVER = {
    name: 'brave-search',
    description: 'Web search capabilities using Brave Search API for current information retrieval',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    verified: true,
    category: 'search',
    capabilities: ['search:web', 'search:current_events', 'search:real_time'],
    serverConfig: {
        name: 'brave-search',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
            BRAVE_API_KEY: '',
        },
        autoStart: false,
    },
};
/**
 * Unverified community server (for testing verified filter)
 */
exports.COMMUNITY_SERVER = {
    name: 'community-tools',
    description: 'Community-maintained collection of utility tools',
    version: '0.3.0',
    author: 'community-contributor',
    verified: false,
    category: 'system',
    capabilities: ['shell:exec', 'process:list'],
    serverConfig: {
        name: 'community-tools',
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'community-mcp-tools'],
        env: {},
        autoStart: false,
    },
};
/**
 * HTTP-based server (for testing non-stdio transports)
 */
exports.HTTP_SERVER = {
    name: 'remote-api',
    description: 'Remote API server accessible via HTTP transport',
    version: '2.0.0',
    author: 'apex-team',
    verified: true,
    category: 'web',
    capabilities: ['http:proxy', 'http:cache'],
    serverConfig: {
        name: 'remote-api',
        type: 'http',
        url: 'http://localhost:3100/mcp',
        headers: {
            Authorization: 'Bearer ${API_TOKEN}',
        },
        autoStart: false,
    },
};
// ============================================================================
// Predefined Collections
// ============================================================================
/**
 * All static marketplace entries for use in test catalogs
 */
exports.ALL_MARKETPLACE_ENTRIES = [
    exports.FILESYSTEM_SERVER,
    exports.MEMORY_SERVER,
    exports.FETCH_SERVER,
    exports.GITHUB_SERVER,
    exports.POSTGRES_SERVER,
    exports.BRAVE_SEARCH_SERVER,
    exports.COMMUNITY_SERVER,
    exports.HTTP_SERVER,
    exports.INVALID_CONFIG_SERVER,
    exports.MISSING_DEPS_SERVER,
    exports.MALFORMED_CONFIG_SERVER,
];
/**
 * Error scenario test entries for negative testing
 */
exports.ERROR_TEST_ENTRIES = [
    exports.INVALID_CONFIG_SERVER,
    exports.MISSING_DEPS_SERVER,
    exports.MALFORMED_CONFIG_SERVER,
    exports.CONFLICTING_SERVER,
];
/**
 * Only verified servers
 */
exports.VERIFIED_ENTRIES = exports.ALL_MARKETPLACE_ENTRIES.filter((e) => e.verified === true);
/**
 * Servers requiring environment variables
 */
exports.ENV_REQUIRING_ENTRIES = [
    exports.GITHUB_SERVER,
    exports.POSTGRES_SERVER,
    exports.BRAVE_SEARCH_SERVER,
];
/**
 * Servers with auto-start enabled
 */
exports.AUTO_START_ENTRIES = exports.ALL_MARKETPLACE_ENTRIES.filter((e) => e.serverConfig.autoStart === true);
// ============================================================================
// Category Definitions
// ============================================================================
/**
 * Standard categories matching the real catalog.json
 */
exports.STANDARD_CATEGORIES = {
    filesystem: {
        name: 'File System',
        description: 'Servers for file and directory operations',
    },
    web: {
        name: 'Web & HTTP',
        description: 'Servers for web browsing, HTTP requests, and API interactions',
    },
    development: {
        name: 'Development Tools',
        description: 'Servers for software development workflows and version control',
    },
    database: {
        name: 'Database',
        description: 'Servers for database operations and data management',
    },
    search: {
        name: 'Search & Information',
        description: 'Servers for searching and retrieving information',
    },
    system: {
        name: 'System & Infrastructure',
        description: 'Servers for system administration and infrastructure management',
    },
};
// ============================================================================
// Test Catalog Factories
// ============================================================================
/**
 * Creates a complete test catalog with all entries
 */
function createTestCatalog(overrides) {
    return {
        version: '1.0.0',
        updated: new Date().toISOString(),
        description: 'Test MCP Server Catalog for E2E tests',
        servers: [...exports.ALL_MARKETPLACE_ENTRIES],
        categories: { ...exports.STANDARD_CATEGORIES },
        ...overrides,
    };
}
/**
 * Creates a minimal test catalog with only filesystem and memory servers
 */
function createMinimalCatalog() {
    return createTestCatalog({
        servers: [exports.FILESYSTEM_SERVER, exports.MEMORY_SERVER],
        description: 'Minimal test catalog',
    });
}
/**
 * Creates a catalog with only verified servers
 */
function createVerifiedOnlyCatalog() {
    return createTestCatalog({
        servers: exports.VERIFIED_ENTRIES,
        description: 'Verified-only test catalog',
    });
}
// ============================================================================
// Dynamic Fixture Factories
// ============================================================================
/**
 * Creates a marketplace entry with custom configuration
 */
function createMarketplaceEntry(name, overrides) {
    return {
        name,
        description: `Test MCP server: ${name}`,
        version: '1.0.0',
        author: 'test-author',
        verified: true,
        category: 'system',
        capabilities: [],
        serverConfig: {
            name,
            type: 'stdio',
            command: 'npx',
            args: ['-y', `@test/${name}-server`],
            env: {},
            autoStart: false,
        },
        ...overrides,
    };
}
/**
 * Creates a server config for testing installation
 */
function createServerConfig(name, overrides) {
    return {
        name,
        type: 'stdio',
        command: 'npx',
        args: ['-y', `@test/${name}-server`],
        env: {},
        autoStart: false,
        ...overrides,
    };
}
/**
 * Creates environment variable definitions for a server
 */
function createEnvVarDefinitions(vars) {
    return vars.map((v) => ({
        name: v.name,
        description: `Environment variable: ${v.name}`,
        required: v.required ?? false,
        sensitive: v.sensitive ?? false,
        defaultValue: v.defaultValue,
        source: 'config',
    }));
}
// ============================================================================
// Config Fragment Fixtures (for .apex/config.yaml verification)
// ============================================================================
/**
 * Expected config structure after installing filesystem server
 */
exports.EXPECTED_FILESYSTEM_CONFIG = {
    mcp: {
        servers: {
            filesystem: {
                name: 'filesystem',
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
                autoStart: true,
            },
        },
    },
};
/**
 * Expected config structure after installing multiple servers
 */
exports.EXPECTED_MULTI_SERVER_CONFIG = {
    mcp: {
        servers: {
            filesystem: exports.EXPECTED_FILESYSTEM_CONFIG.mcp.servers.filesystem,
            memory: {
                name: 'memory',
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-memory'],
                autoStart: false,
            },
        },
    },
};
/**
 * Base APEX config structure with MCP section
 */
function createBaseApexConfig(mcpServers) {
    return {
        project: {
            name: 'e2e-mcp-test-project',
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
        ...(mcpServers
            ? {
                mcp: {
                    servers: mcpServers,
                },
            }
            : {}),
    };
}
// ============================================================================
// Error Scenario Fixtures
// ============================================================================
/**
 * Invalid marketplace entry (missing required fields)
 */
exports.INVALID_ENTRY_MISSING_NAME = {
    description: 'Server with missing name',
    version: '1.0.0',
    serverConfig: {
        name: 'no-name',
        type: 'stdio',
        command: 'npx',
        args: [],
    },
};
/**
 * Invalid server config (missing command for stdio type)
 */
exports.INVALID_CONFIG_NO_COMMAND = {
    name: 'broken-server',
    type: 'stdio',
    // command intentionally missing
    args: [],
    env: {},
};
/**
 * Server with conflicting configuration
 */
exports.CONFLICTING_SERVER = {
    name: 'conflicting',
    description: 'Server with conflicting type and config',
    version: '1.0.0',
    verified: false,
    serverConfig: {
        name: 'conflicting',
        type: 'http',
        command: 'should-not-be-here-for-http', // Conflict: command with http type
        url: 'http://localhost:3000',
        autoStart: false,
    },
};
/**
 * Server with intentionally invalid config (empty name)
 */
exports.INVALID_CONFIG_SERVER = {
    name: 'invalid-config',
    description: 'Server with intentionally invalid config',
    version: '0.0.1',
    verified: false,
    category: 'test',
    serverConfig: { name: '', type: 'stdio' }, // Empty name = invalid
};
/**
 * Server requiring unavailable dependencies
 */
exports.MISSING_DEPS_SERVER = {
    name: 'missing-deps',
    description: 'Server requiring unavailable dependencies',
    version: '1.0.0',
    verified: false,
    category: 'test',
    serverConfig: {
        name: 'missing-deps',
        type: 'stdio',
        command: '/nonexistent/binary',
        args: ['--nonexistent-option'],
        env: {},
        autoStart: false,
    },
};
/**
 * Server with malformed configuration (for corrupt YAML testing)
 */
exports.MALFORMED_CONFIG_SERVER = {
    name: 'malformed-config',
    description: 'Server designed to create malformed config',
    version: '1.0.0',
    verified: false,
    category: 'test',
    serverConfig: {
        name: 'malformed\nconfig\ttab', // Invalid characters that will break YAML
        type: 'stdio',
        command: 'echo',
        args: ['test'],
        env: {},
        autoStart: false,
    },
};
// ============================================================================
// Search Test Data
// ============================================================================
/**
 * Search queries and expected results for testing marketplace search
 */
exports.SEARCH_TEST_CASES = [
    {
        query: 'filesystem',
        description: 'Search by exact name',
        expectedMinResults: 1,
        expectedContains: ['filesystem'],
    },
    {
        query: 'file',
        description: 'Search by partial name',
        expectedMinResults: 1,
        expectedContains: ['filesystem'],
    },
    {
        query: 'database',
        description: 'Search by category keyword',
        expectedMinResults: 1,
        expectedContains: ['postgres'],
    },
    {
        query: 'search',
        description: 'Search for search-related servers',
        expectedMinResults: 1,
        expectedContains: ['brave-search'],
    },
    {
        query: 'nonexistent-server-xyz',
        description: 'Search with no results',
        expectedMinResults: 0,
        expectedContains: [],
    },
    {
        query: 'http',
        description: 'Search by capability keyword',
        expectedMinResults: 1,
        expectedContains: ['fetch'],
    },
];
/**
 * Category filter test cases
 */
exports.CATEGORY_FILTER_CASES = [
    {
        category: 'filesystem',
        expectedMinCount: 1,
        expectedServers: ['filesystem'],
    },
    {
        category: 'database',
        expectedMinCount: 1,
        expectedServers: ['memory', 'postgres'],
    },
    {
        category: 'web',
        expectedMinCount: 1,
        expectedServers: ['fetch'],
    },
    {
        category: 'nonexistent',
        expectedMinCount: 0,
        expectedServers: [],
    },
];
// ============================================================================
// Server Selection Test Cases
// ============================================================================
/**
 * Server selection test scenarios for E2E testing
 * Based on ADR-078: Server Selection E2E Test Architecture
 */
exports.SELECTION_TEST_CASES = [
    {
        scenario: 'single verified server',
        selectServerIds: ['filesystem'],
        expectedValid: true,
        expectedDetails: {
            name: 'Filesystem Server',
            verified: true,
            category: 'filesystem',
        },
    },
    {
        scenario: 'multiple servers',
        selectServerIds: ['filesystem', 'memory'],
        expectedValid: true,
        expectedDetails: {
            totalSelected: 2,
            allVerified: true,
        },
    },
    {
        scenario: 'non-existent server',
        selectServerIds: ['nonexistent-server-xyz'],
        expectedValid: false,
        expectedError: 'not found',
    },
    {
        scenario: 'empty selection',
        selectServerIds: [],
        expectedValid: false,
        expectedError: 'No servers selected',
    },
    {
        scenario: 'mixed valid and invalid',
        selectServerIds: ['filesystem', 'invalid-server'],
        expectedValid: false,
        expectedError: 'not found',
        partiallyValid: true,
        validIds: ['filesystem'],
        invalidIds: ['invalid-server'],
    },
    {
        scenario: 'unverified server selection',
        selectServerIds: ['community-tools'],
        expectedValid: true,
        expectedDetails: {
            verified: false,
            category: 'system',
        },
    },
    {
        scenario: 'server with environment variables',
        selectServerIds: ['github'],
        expectedValid: true,
        expectedDetails: {
            requiresEnvVars: true,
            envVars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
        },
    },
    {
        scenario: 'http-based server',
        selectServerIds: ['remote-api'],
        expectedValid: true,
        expectedDetails: {
            type: 'http',
            requiresUrl: true,
        },
    },
];
/**
 * Selection validation test cases
 */
exports.SELECTION_VALIDATION_CASES = [
    {
        description: 'valid single selection',
        availableServers: ['filesystem', 'memory', 'fetch'],
        selectedIds: ['filesystem'],
        expectedValid: true,
        expectedInvalidIds: [],
    },
    {
        description: 'valid multiple selection',
        availableServers: ['filesystem', 'memory', 'fetch'],
        selectedIds: ['filesystem', 'memory'],
        expectedValid: true,
        expectedInvalidIds: [],
    },
    {
        description: 'invalid single selection',
        availableServers: ['filesystem', 'memory'],
        selectedIds: ['nonexistent'],
        expectedValid: false,
        expectedInvalidIds: ['nonexistent'],
    },
    {
        description: 'partially valid selection',
        availableServers: ['filesystem', 'memory'],
        selectedIds: ['filesystem', 'invalid1', 'memory', 'invalid2'],
        expectedValid: false,
        expectedInvalidIds: ['invalid1', 'invalid2'],
    },
    {
        description: 'empty selection',
        availableServers: ['filesystem', 'memory'],
        selectedIds: [],
        expectedValid: true, // Empty selection is technically valid
        expectedInvalidIds: [],
    },
    {
        description: 'duplicate selection',
        availableServers: ['filesystem', 'memory'],
        selectedIds: ['filesystem', 'filesystem'],
        expectedValid: true, // Duplicates should be handled gracefully
        expectedInvalidIds: [],
    },
];
//# sourceMappingURL=marketplace-data.js.map