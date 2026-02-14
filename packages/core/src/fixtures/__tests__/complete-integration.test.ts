/**
 * @fileoverview Complete Integration Tests for All Fixture Patterns
 *
 * This test file demonstrates all fixtures and patterns working together:
 * 1. Base marketplace fixtures - Core entities (servers, configs, entries)
 * 2. Marketplace scenarios - Real-world testing scenarios (empty, single, multi-server)
 * 3. Factory functions and presets - Dynamic fixture creation utilities
 *
 * These tests verify proper setup and teardown behavior and serve as
 * documentation for future developers on how to use the fixture system.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// Import all three fixture categories
import {
  // Base marketplace fixtures
  baseMarketplace,
  baseMarketplaceEntries,
  baseServerConfigs,
  baseMarketplaceSources,
  baseMarketplaces,
  createMarketplaceEntry,
  createServerConfig,
  createMarketplace,
  getVerifiedEntries,
  getEntriesByCapability,

  // Factory functions and presets
  createMCPServerConfig,
  createMCPServer,
  createMCPMarketplaceEntry,
  MCPServerPresets,

  // Types for validation
  type MCPMarketplaceEntry,
  type MCPServerConfig,
  type MCPMarketplace,
} from '../index.js';

import {
  // Marketplace scenarios
  emptyMarketplace,
  singleServerMarketplace,
  multiServerMarketplace,
  developmentMarketplace,
  enterpriseMarketplace,
  scenarioMarketplaces,
  packageStates,
  configurationVariations,
  marketplaceSources,
  getAllVerifiedEntries,
  getAllUnverifiedEntries,
  getEntriesByConfigType,
  getEntriesWithEnvironment,
  getAutoStartEntries,
  createScenario,
} from '../marketplace-scenarios.js';

describe('Complete Fixture Integration Tests', () => {
  /**
   * Test state tracking for proper setup/teardown verification
   */
  let testState: {
    createdEntries: MCPMarketplaceEntry[];
    createdConfigs: MCPServerConfig[];
    createdMarketplaces: MCPMarketplace[];
  };

  /**
   * Setup: Initialize test state before each test
   * This demonstrates proper test setup patterns
   */
  beforeEach(() => {
    testState = {
      createdEntries: [],
      createdConfigs: [],
      createdMarketplaces: [],
    };
  });

  /**
   * Teardown: Clean up test state after each test
   * This demonstrates proper test teardown patterns
   */
  afterEach(() => {
    // Reset test state (in real scenarios, this might involve cleanup operations)
    testState = {
      createdEntries: [],
      createdConfigs: [],
      createdMarketplaces: [],
    };
  });

  describe('Pattern 1: Base Marketplace Fixtures', () => {
    /**
     * Demonstrates usage of core base fixtures
     * These provide the fundamental building blocks for testing
     */
    it('should work with all base fixtures simultaneously', () => {
      // Test base server configurations
      expect(baseServerConfigs.filesystem.name).toBe('filesystem-server');
      expect(baseServerConfigs.memory.name).toBe('memory-server');
      expect(baseServerConfigs.git.name).toBe('git-server');

      // Test base marketplace entries
      expect(baseMarketplaceEntries.filesystem.verified).toBe(true);
      expect(baseMarketplaceEntries.memory.capabilities).toContain('tools');
      expect(baseMarketplaceEntries.git.capabilities).toContain('tools');

      // Test base marketplaces
      expect(baseMarketplaces.default.servers).toHaveLength(5);
      expect(baseMarketplaces.development.source.allowUnverified).toBe(true);

      // Verify all base fixtures have consistent structure
      Object.values(baseMarketplaceEntries).forEach(entry => {
        expect(entry.name).toBeDefined();
        expect(entry.version).toBeDefined();
        expect(entry.serverConfig).toBeDefined();
        expect(entry.serverConfig.type).toBe('stdio');
      });
    });

    /**
     * Demonstrates the utility functions for filtering and querying
     */
    it('should support advanced querying of base fixtures', () => {
      // Test verification filtering
      const verifiedEntries = getVerifiedEntries();
      expect(verifiedEntries).toHaveLength(5); // All base entries are verified
      verifiedEntries.forEach(entry => {
        expect(entry.verified).toBe(true);
      });

      // Test capability-based filtering
      const toolsEntries = getEntriesByCapability('tools');
      expect(toolsEntries.length).toBeGreaterThanOrEqual(3);

      const resourcesEntries = getEntriesByCapability('resources');
      expect(resourcesEntries.length).toBeGreaterThanOrEqual(2);

      // Verify consistency
      toolsEntries.forEach(entry => {
        expect(entry.capabilities).toContain('tools');
      });
    });

    /**
     * Demonstrates customization through utility functions
     */
    it('should support customization of base fixtures', () => {
      // Create customized marketplace entry
      const customEntry = createMarketplaceEntry(baseMarketplaceEntries.filesystem, {
        name: 'custom-filesystem',
        verified: false,
        description: 'Customized filesystem server for testing',
      });
      testState.createdEntries.push(customEntry);

      expect(customEntry.name).toBe('custom-filesystem');
      expect(customEntry.verified).toBe(false);
      expect(customEntry.description).toContain('Customized');
      // Should inherit other properties
      expect(customEntry.capabilities).toEqual(baseMarketplaceEntries.filesystem.capabilities);

      // Create customized server config
      const customConfig = createServerConfig(baseServerConfigs.memory, {
        name: 'custom-memory',
        autoStart: true,
        env: { CUSTOM_SETTING: 'test' },
      });
      testState.createdConfigs.push(customConfig);

      expect(customConfig.name).toBe('custom-memory');
      expect(customConfig.autoStart).toBe(true);
      expect(customConfig.env?.CUSTOM_SETTING).toBe('test');

      // Create customized marketplace
      const customMarketplace = createMarketplace(baseMarketplace, {
        name: 'Test Registry',
        servers: [customEntry],
      });
      testState.createdMarketplaces.push(customMarketplace);

      expect(customMarketplace.name).toBe('Test Registry');
      expect(customMarketplace.servers).toHaveLength(1);
      expect(customMarketplace.servers[0]).toBe(customEntry);
    });
  });

  describe('Pattern 2: Marketplace Scenarios', () => {
    /**
     * Demonstrates usage of scenario-based testing fixtures
     * These provide real-world marketplace states for comprehensive testing
     */
    it('should work with all scenario marketplaces', () => {
      // Test empty marketplace scenario
      expect(emptyMarketplace.servers).toHaveLength(0);
      expect(emptyMarketplace.name).toBe('Empty MCP Registry');

      // Test single server scenario
      expect(singleServerMarketplace.servers).toHaveLength(1);
      expect(singleServerMarketplace.servers[0].name).toBe('filesystem-basic');

      // Test multi-server scenario
      expect(multiServerMarketplace.servers.length).toBeGreaterThan(5);
      const verifiedInMulti = multiServerMarketplace.servers.filter(s => s.verified);
      const unverifiedInMulti = multiServerMarketplace.servers.filter(s => !s.verified);
      expect(verifiedInMulti.length).toBeGreaterThan(0);
      expect(unverifiedInMulti.length).toBeGreaterThan(0);

      // Test development marketplace scenario
      expect(developmentMarketplace.source.allowUnverified).toBe(true);
      expect(developmentMarketplace.servers.some(s => !s.verified)).toBe(true);

      // Test enterprise marketplace scenario
      expect(enterpriseMarketplace.servers.some(s => s.serverConfig.type === 'http')).toBe(true);
    });

    /**
     * Demonstrates advanced scenario querying across all marketplaces
     */
    it('should support cross-scenario analysis', () => {
      // Test verification status across scenarios
      const allVerified = getAllVerifiedEntries();
      const allUnverified = getAllUnverifiedEntries();
      expect(allVerified.length).toBeGreaterThan(0);
      expect(allUnverified.length).toBeGreaterThan(0);

      // Test configuration type analysis
      const stdioEntries = getEntriesByConfigType('stdio');
      const httpEntries = getEntriesByConfigType('http');
      const sseEntries = getEntriesByConfigType('sse');

      expect(stdioEntries.length).toBeGreaterThan(0);
      expect(httpEntries.length).toBeGreaterThan(0);
      expect(sseEntries.length).toBeGreaterThan(0);

      // Verify type consistency
      stdioEntries.forEach(entry => {
        expect(entry.serverConfig.type).toBe('stdio');
      });
      httpEntries.forEach(entry => {
        expect(entry.serverConfig.type).toBe('http');
        expect(entry.serverConfig.url).toBeDefined();
      });

      // Test environment configuration analysis
      const entriesWithEnv = getEntriesWithEnvironment();
      expect(entriesWithEnv.length).toBeGreaterThan(0);
      entriesWithEnv.forEach(entry => {
        expect(entry.serverConfig.env).toBeDefined();
        expect(Object.keys(entry.serverConfig.env!).length).toBeGreaterThan(0);
      });

      // Test auto-start configuration
      const autoStartEntries = getAutoStartEntries();
      expect(autoStartEntries.length).toBeGreaterThan(0);
      autoStartEntries.forEach(entry => {
        expect(entry.serverConfig.autoStart).toBe(true);
      });
    });

    /**
     * Demonstrates dynamic scenario creation
     */
    it('should support custom scenario creation', () => {
      // Create scenario with only verified entries
      const verifiedScenario = createScenario({
        verified: true,
        name: 'Verified Only Registry',
        description: 'Only verified servers for production use',
      });
      testState.createdMarketplaces.push(verifiedScenario);

      expect(verifiedScenario.name).toBe('Verified Only Registry');
      expect(verifiedScenario.servers.every(s => s.verified)).toBe(true);

      // Create scenario with specific configuration type
      const httpScenario = createScenario({
        configType: 'http',
        name: 'HTTP Servers Only',
      });
      testState.createdMarketplaces.push(httpScenario);

      expect(httpScenario.servers.every(s => s.serverConfig.type === 'http')).toBe(true);

      // Create complex filtered scenario
      const complexScenario = createScenario({
        verified: true,
        hasEnvironment: true,
        autoStart: true,
        name: 'Production Ready Auto-Start',
        description: 'Verified servers with environment config that auto-start',
      });
      testState.createdMarketplaces.push(complexScenario);

      complexScenario.servers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.serverConfig.autoStart).toBe(true);
        expect(server.serverConfig.env).toBeDefined();
        expect(Object.keys(server.serverConfig.env!).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Pattern 3: Factory Functions and Presets', () => {
    /**
     * Demonstrates dynamic fixture creation using factory functions
     * These provide maximum flexibility for test-specific needs
     */
    it('should work with all factory functions', () => {
      // Test server config factory
      const customServerConfig = createMCPServerConfig({
        name: 'factory-test-config',
        autoStart: true,
      }, {
        type: 'http',
        includeEnv: true,
      });
      testState.createdConfigs.push(customServerConfig);

      expect(customServerConfig.name).toBe('factory-test-config');
      expect(customServerConfig.type).toBe('http');
      expect(customServerConfig.autoStart).toBe(true);
      expect(customServerConfig.env).toBeDefined();
      expect(customServerConfig.env!.NODE_ENV).toBe('test');

      // Test server factory
      const customServer = createMCPServer({
        name: 'factory-test-server',
        package: '@test/custom-package',
      }, {
        includeEnv: true,
        includeEnvVars: true,
      });

      expect(customServer.name).toBe('factory-test-server');
      expect(customServer.package).toBe('@test/custom-package');
      expect(customServer.env).toBeDefined();
      expect(customServer.envVars).toBeDefined();

      // Test marketplace entry factory
      const customMarketplaceEntry = createMCPMarketplaceEntry({
        name: 'factory-test-entry',
        description: 'Test entry from factory',
      }, {
        verified: true,
        includeCapabilities: true,
      });
      testState.createdEntries.push(customMarketplaceEntry);

      expect(customMarketplaceEntry.name).toBe('factory-test-entry');
      expect(customMarketplaceEntry.verified).toBe(true);
      expect(customMarketplaceEntry.capabilities).toBeDefined();
      expect(customMarketplaceEntry.serverConfig).toBeDefined();
    });

    /**
     * Demonstrates preset usage for common scenarios
     */
    it('should work with all preset collections', () => {
      // Test basic server presets
      const fsServer = MCPServerPresets.basic.filesystem();
      expect(fsServer.name).toBe('filesystem-server');
      expect(fsServer.package).toBe('@modelcontextprotocol/server-filesystem');

      const memoryServer = MCPServerPresets.basic.memory();
      expect(memoryServer.name).toBe('memory-server');

      const gitServer = MCPServerPresets.basic.git();
      expect(gitServer.name).toBe('git-server');

      // Test configuration presets
      const stdioConfig = MCPServerPresets.configs.stdio();
      expect(stdioConfig.type).toBe('stdio');

      const httpConfig = MCPServerPresets.configs.http();
      expect(httpConfig.type).toBe('http');

      const envConfig = MCPServerPresets.configs.withEnv();
      expect(envConfig.env).toBeDefined();

      const autoStartConfig = MCPServerPresets.configs.autoStart();
      expect(autoStartConfig.autoStart).toBe(true);

      // Test marketplace entry presets
      const verifiedEntry = MCPServerPresets.marketplace.verified();
      testState.createdEntries.push(verifiedEntry);
      expect(verifiedEntry.verified).toBe(true);

      const unverifiedEntry = MCPServerPresets.marketplace.unverified();
      testState.createdEntries.push(unverifiedEntry);
      expect(unverifiedEntry.verified).toBe(false);

      const capabilitiesEntry = MCPServerPresets.marketplace.withCapabilities();
      testState.createdEntries.push(capabilitiesEntry);
      expect(capabilitiesEntry.capabilities).toContain('tools');
      expect(capabilitiesEntry.capabilities).toContain('resources');
    });

    /**
     * Demonstrates factory uniqueness and proper test isolation
     */
    it('should create unique instances for test isolation', () => {
      // Create multiple instances
      const config1 = createMCPServerConfig();
      const config2 = createMCPServerConfig();
      testState.createdConfigs.push(config1, config2);

      // Should be different instances
      expect(config1).not.toBe(config2);
      expect(config1.name).not.toBe(config2.name);

      const server1 = createMCPServer();
      const server2 = createMCPServer();

      expect(server1).not.toBe(server2);
      expect(server1.name).not.toBe(server2.name);

      const entry1 = createMCPMarketplaceEntry();
      const entry2 = createMCPMarketplaceEntry();
      testState.createdEntries.push(entry1, entry2);

      expect(entry1).not.toBe(entry2);
      expect(entry1.name).not.toBe(entry2.name);

      // All should be properly typed and valid
      [config1, config2].forEach(config => {
        expect(typeof config.name).toBe('string');
        expect(typeof config.autoStart).toBe('boolean');
      });

      [entry1, entry2].forEach(entry => {
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.verified).toBe('boolean');
        expect(entry.serverConfig).toBeDefined();
      });
    });
  });

  describe('Cross-Pattern Integration', () => {
    /**
     * Demonstrates all three patterns working together in complex scenarios
     * This shows how to combine base fixtures, scenarios, and factories
     */
    it('should integrate all patterns in a complex workflow', () => {
      // Start with base fixtures
      const baseEntry = baseMarketplaceEntries.filesystem;

      // Customize using base utilities
      const customEntry = createMarketplaceEntry(baseEntry, {
        name: 'enhanced-filesystem',
        description: 'Enhanced filesystem with custom features',
      });
      testState.createdEntries.push(customEntry);

      // Create additional entries using factories
      const factoryEntry1 = createMCPMarketplaceEntry({
        name: 'custom-factory-server-1',
        capabilities: ['tools', 'resources'],
      }, { verified: true });

      const factoryEntry2 = createMCPMarketplaceEntry({
        name: 'custom-factory-server-2',
        capabilities: ['tools'],
      }, { verified: false });

      testState.createdEntries.push(factoryEntry1, factoryEntry2);

      // Combine with scenario entries
      const scenarioEntries = multiServerMarketplace.servers.slice(0, 2);

      // Create a complex custom marketplace
      const complexMarketplace = createMarketplace(baseMarketplace, {
        name: 'Complex Test Marketplace',
        description: 'Combining all fixture patterns for comprehensive testing',
        servers: [
          customEntry,
          factoryEntry1,
          factoryEntry2,
          ...scenarioEntries,
        ],
      });
      testState.createdMarketplaces.push(complexMarketplace);

      // Verify the integrated result
      expect(complexMarketplace.servers.length).toBeGreaterThanOrEqual(5);

      // Verify mixture of verified and unverified
      const verified = complexMarketplace.servers.filter(s => s.verified);
      const unverified = complexMarketplace.servers.filter(s => !s.verified);
      expect(verified.length).toBeGreaterThan(0);
      expect(unverified.length).toBeGreaterThan(0);

      // Verify variety of capabilities
      const toolsServers = complexMarketplace.servers.filter(s => s.capabilities?.includes('tools'));
      const resourcesServers = complexMarketplace.servers.filter(s => s.capabilities?.includes('resources'));
      expect(toolsServers.length).toBeGreaterThan(0);
      expect(resourcesServers.length).toBeGreaterThan(0);

      // Verify configuration variety
      const configTypes = new Set(complexMarketplace.servers.map(s => s.serverConfig.type));
      expect(configTypes.size).toBeGreaterThanOrEqual(2); // Should have multiple config types
    });

    /**
     * Demonstrates proper test state management across all patterns
     */
    it('should maintain proper test isolation across patterns', () => {
      const initialState = { ...testState };

      // Use each pattern and track state changes
      const baseUsage = baseMarketplaceEntries.memory;
      expect(testState.createdEntries.length).toBe(initialState.createdEntries.length);

      const scenarioUsage = emptyMarketplace;
      expect(testState.createdMarketplaces.length).toBe(initialState.createdMarketplaces.length);

      // Only factory usage should modify test state
      const factoryUsage = createMCPMarketplaceEntry();
      testState.createdEntries.push(factoryUsage);
      expect(testState.createdEntries.length).toBe(initialState.createdEntries.length + 1);

      // Verify isolation - base and scenario fixtures are immutable references
      expect(baseUsage).toBe(baseMarketplaceEntries.memory);
      expect(scenarioUsage).toBe(emptyMarketplace);

      // Factory creations are unique
      const anotherFactoryUsage = createMCPMarketplaceEntry();
      expect(anotherFactoryUsage).not.toBe(factoryUsage);
      expect(anotherFactoryUsage.name).not.toBe(factoryUsage.name);
    });
  });

  describe('Type Safety and Validation', () => {
    /**
     * Demonstrates that all fixtures maintain proper TypeScript typing
     */
    it('should maintain type safety across all fixtures', () => {
      // Base fixtures should be properly typed
      const filesystemEntry: MCPMarketplaceEntry = baseMarketplaceEntries.filesystem;
      const filesystemConfig: MCPServerConfig = baseServerConfigs.filesystem;

      expect(filesystemEntry.serverConfig).toBeDefined();
      expect(filesystemConfig.type).toBeDefined();

      // Scenario fixtures should be properly typed
      const emptyMarketplaceTyped: MCPMarketplace = emptyMarketplace;
      expect(emptyMarketplaceTyped.servers).toBeDefined();

      // Factory functions should return properly typed objects
      const factoryConfig: MCPServerConfig = createMCPServerConfig();
      const factoryEntry: MCPMarketplaceEntry = createMCPMarketplaceEntry();

      testState.createdConfigs.push(factoryConfig);
      testState.createdEntries.push(factoryEntry);

      expect(factoryConfig.type).toBeDefined();
      expect(factoryEntry.serverConfig).toBeDefined();

      // All created objects should be valid
      expect(typeof factoryConfig.name).toBe('string');
      expect(typeof factoryEntry.verified).toBe('boolean');
    });

    /**
     * Demonstrates validation of fixture data integrity
     */
    it('should validate fixture data integrity', () => {
      // All base marketplace entries should have consistent structure
      Object.values(baseMarketplaceEntries).forEach(entry => {
        expect(entry.name).toBeDefined();
        expect(entry.description).toBeDefined();
        expect(entry.version).toBeDefined();
        expect(entry.author).toBeDefined();
        expect(entry.serverConfig).toBeDefined();
        expect(entry.serverConfig.name).toBeDefined();
        expect(entry.serverConfig.type).toBeDefined();
        expect(['stdio', 'http', 'sse', 'sdk']).toContain(entry.serverConfig.type);
      });

      // All scenario marketplaces should have consistent structure
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        expect(marketplace.name).toBeDefined();
        expect(marketplace.description).toBeDefined();
        expect(marketplace.version).toBeDefined();
        expect(marketplace.servers).toBeDefined();
        expect(Array.isArray(marketplace.servers)).toBe(true);
        expect(marketplace.source).toBeDefined();
      });

      // All package state entries should be properly configured
      Object.values(packageStates).forEach(entry => {
        expect(entry.name).toBeDefined();
        expect(entry.serverConfig).toBeDefined();
        if (entry.name.includes('deprecated')) {
          expect(entry.description.toLowerCase()).toContain('deprecated');
        }
      });

      // All configuration variations should have appropriate settings
      Object.values(configurationVariations).forEach(entry => {
        expect(entry.serverConfig).toBeDefined();
        if (entry.serverConfig.type === 'http' || entry.serverConfig.type === 'sse') {
          expect(entry.serverConfig.url).toBeDefined();
        }
      });
    });
  });
});

/**
 * Test Summary and Usage Documentation:
 *
 * This integration test file demonstrates three primary fixture patterns:
 *
 * 1. **Base Marketplace Fixtures** (`marketplace.ts`):
 *    - Core entities: servers, configs, marketplace entries
 *    - Utility functions for customization and querying
 *    - Collections for organized access
 *    - Use these for standard, consistent test data
 *
 * 2. **Marketplace Scenarios** (`marketplace-scenarios.ts`):
 *    - Real-world marketplace states (empty, single, multi-server)
 *    - Package states (deprecated, alpha, stable)
 *    - Configuration variations (HTTP, SSE, complex env)
 *    - Use these for testing specific marketplace scenarios
 *
 * 3. **Factory Functions and Presets**:
 *    - Dynamic fixture creation with customization options
 *    - Preset collections for common scenarios
 *    - Unique instance generation for test isolation
 *    - Use these when you need custom test data
 *
 * **Setup and Teardown Patterns**:
 * - `beforeEach`: Initialize test state for isolation
 * - `afterEach`: Clean up created resources
 * - Track created fixtures to ensure proper cleanup
 *
 * **Best Practices Demonstrated**:
 * - Test isolation through unique fixture generation
 * - Type safety across all fixture types
 * - Comprehensive validation of fixture data
 * - Cross-pattern integration for complex scenarios
 * - Proper state management and cleanup
 */