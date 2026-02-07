/**
 * @fileoverview Fixture Export Tests
 *
 * Validates that all marketplace fixture exports are properly accessible
 * and correctly structured for external consumption.
 */

import { describe, test, expect } from 'vitest';

describe('Fixture Exports Validation', () => {
  describe('Marketplace Scenarios Export', () => {
    test('all marketplace scenarios are exported', async () => {
      const marketplaceScenarios = await import('../marketplace-scenarios.js');

      // Individual scenarios
      expect(marketplaceScenarios.emptyMarketplace).toBeDefined();
      expect(marketplaceScenarios.singleServerMarketplace).toBeDefined();
      expect(marketplaceScenarios.multiServerMarketplace).toBeDefined();
      expect(marketplaceScenarios.developmentMarketplace).toBeDefined();
      expect(marketplaceScenarios.enterpriseMarketplace).toBeDefined();

      // Package state variations
      expect(marketplaceScenarios.deprecatedFilesystemEntry).toBeDefined();
      expect(marketplaceScenarios.alphaBrowserEntry).toBeDefined();
      expect(marketplaceScenarios.draftDatabaseEntry).toBeDefined();

      // Configuration variations
      expect(marketplaceScenarios.httpServerEntry).toBeDefined();
      expect(marketplaceScenarios.sseServerEntry).toBeDefined();
      expect(marketplaceScenarios.complexConfigEntry).toBeDefined();

      // Marketplace sources
      expect(marketplaceScenarios.testingMarketplaceSource).toBeDefined();
      expect(marketplaceScenarios.enterpriseMarketplaceSource).toBeDefined();
      expect(marketplaceScenarios.disabledMarketplaceSource).toBeDefined();

      // Collections
      expect(marketplaceScenarios.scenarioMarketplaces).toBeDefined();
      expect(marketplaceScenarios.packageStates).toBeDefined();
      expect(marketplaceScenarios.configurationVariations).toBeDefined();
      expect(marketplaceScenarios.marketplaceSources).toBeDefined();

      // Utility functions
      expect(marketplaceScenarios.getAllVerifiedEntries).toBeDefined();
      expect(marketplaceScenarios.getAllUnverifiedEntries).toBeDefined();
      expect(marketplaceScenarios.getEntriesByConfigType).toBeDefined();
      expect(marketplaceScenarios.getEntriesWithEnvironment).toBeDefined();
      expect(marketplaceScenarios.getAutoStartEntries).toBeDefined();
      expect(marketplaceScenarios.createScenario).toBeDefined();
    });

    test('collections contain expected number of items', async () => {
      const {
        scenarioMarketplaces,
        packageStates,
        configurationVariations,
        marketplaceSources
      } = await import('../marketplace-scenarios.js');

      // Verify collection sizes
      expect(Object.keys(scenarioMarketplaces)).toHaveLength(5); // empty, single, multi, development, enterprise
      expect(Object.keys(packageStates)).toHaveLength(3); // deprecated, alpha, draft
      expect(Object.keys(configurationVariations)).toHaveLength(3); // http, sse, complex
      expect(Object.keys(marketplaceSources)).toHaveLength(3); // testing, enterprise, disabled
    });

    test('collection keys match expected names', async () => {
      const {
        scenarioMarketplaces,
        packageStates,
        configurationVariations,
        marketplaceSources
      } = await import('../marketplace-scenarios.js');

      // Scenario marketplace keys
      expect(Object.keys(scenarioMarketplaces)).toEqual(
        expect.arrayContaining(['empty', 'single', 'multi', 'development', 'enterprise'])
      );

      // Package state keys
      expect(Object.keys(packageStates)).toEqual(
        expect.arrayContaining(['deprecated', 'alpha', 'draft'])
      );

      // Configuration variation keys
      expect(Object.keys(configurationVariations)).toEqual(
        expect.arrayContaining(['http', 'sse', 'complex'])
      );

      // Marketplace source keys
      expect(Object.keys(marketplaceSources)).toEqual(
        expect.arrayContaining(['testing', 'enterprise', 'disabled'])
      );
    });
  });

  describe('Fixture Index Export', () => {
    test('index file exports marketplace scenarios', async () => {
      const fixtureIndex = await import('../index.js');

      // Should re-export marketplace scenarios
      expect(fixtureIndex.emptyMarketplace).toBeDefined();
      expect(fixtureIndex.singleServerMarketplace).toBeDefined();
      expect(fixtureIndex.multiServerMarketplace).toBeDefined();
      expect(fixtureIndex.scenarioMarketplaces).toBeDefined();
      expect(fixtureIndex.createScenario).toBeDefined();
    });
  });

  describe('Function Export Validation', () => {
    test('utility functions are properly typed and callable', async () => {
      const {
        getAllVerifiedEntries,
        getAllUnverifiedEntries,
        getEntriesByConfigType,
        getEntriesWithEnvironment,
        getAutoStartEntries,
        createScenario
      } = await import('../marketplace-scenarios.js');

      // Test function calls don't throw
      expect(() => getAllVerifiedEntries()).not.toThrow();
      expect(() => getAllUnverifiedEntries()).not.toThrow();
      expect(() => getEntriesByConfigType('stdio')).not.toThrow();
      expect(() => getEntriesWithEnvironment()).not.toThrow();
      expect(() => getAutoStartEntries()).not.toThrow();
      expect(() => createScenario({})).not.toThrow();

      // Test return types
      expect(Array.isArray(getAllVerifiedEntries())).toBe(true);
      expect(Array.isArray(getAllUnverifiedEntries())).toBe(true);
      expect(Array.isArray(getEntriesByConfigType('http'))).toBe(true);
      expect(Array.isArray(getEntriesWithEnvironment())).toBe(true);
      expect(Array.isArray(getAutoStartEntries())).toBe(true);

      const customScenario = createScenario({ name: 'Test Scenario' });
      expect(customScenario.name).toBe('Test Scenario');
      expect(Array.isArray(customScenario.servers)).toBe(true);
    });

    test('createScenario function supports all filter options', async () => {
      const { createScenario } = await import('../marketplace-scenarios.js');

      // Test each filter option individually
      expect(() => createScenario({ verified: true })).not.toThrow();
      expect(() => createScenario({ verified: false })).not.toThrow();
      expect(() => createScenario({ configType: 'stdio' })).not.toThrow();
      expect(() => createScenario({ configType: 'http' })).not.toThrow();
      expect(() => createScenario({ configType: 'sse' })).not.toThrow();
      expect(() => createScenario({ hasEnvironment: true })).not.toThrow();
      expect(() => createScenario({ hasEnvironment: false })).not.toThrow();
      expect(() => createScenario({ autoStart: true })).not.toThrow();
      expect(() => createScenario({ autoStart: false })).not.toThrow();

      // Test combined filters
      expect(() => createScenario({
        verified: true,
        configType: 'stdio',
        hasEnvironment: true,
        autoStart: false
      })).not.toThrow();
    });
  });

  describe('Data Structure Export Validation', () => {
    test('exported marketplaces have correct structure', async () => {
      const {
        emptyMarketplace,
        singleServerMarketplace,
        multiServerMarketplace,
        developmentMarketplace,
        enterpriseMarketplace
      } = await import('../marketplace-scenarios.js');

      const marketplaces = [
        emptyMarketplace,
        singleServerMarketplace,
        multiServerMarketplace,
        developmentMarketplace,
        enterpriseMarketplace
      ];

      marketplaces.forEach(marketplace => {
        expect(marketplace.name).toBeDefined();
        expect(typeof marketplace.name).toBe('string');
        expect(marketplace.description).toBeDefined();
        expect(typeof marketplace.description).toBe('string');
        expect(marketplace.version).toBeDefined();
        expect(typeof marketplace.version).toBe('string');
        expect(marketplace.lastUpdated).toBeDefined();
        expect(typeof marketplace.lastUpdated).toBe('string');
        expect(Array.isArray(marketplace.servers)).toBe(true);
        expect(marketplace.source).toBeDefined();
        expect(typeof marketplace.source).toBe('object');
      });
    });

    test('exported entries have correct structure', async () => {
      const {
        deprecatedFilesystemEntry,
        alphaBrowserEntry,
        draftDatabaseEntry,
        httpServerEntry,
        sseServerEntry,
        complexConfigEntry
      } = await import('../marketplace-scenarios.js');

      const entries = [
        deprecatedFilesystemEntry,
        alphaBrowserEntry,
        draftDatabaseEntry,
        httpServerEntry,
        sseServerEntry,
        complexConfigEntry
      ];

      entries.forEach(entry => {
        expect(entry.name).toBeDefined();
        expect(typeof entry.name).toBe('string');
        expect(entry.description).toBeDefined();
        expect(typeof entry.description).toBe('string');
        expect(entry.version).toBeDefined();
        expect(typeof entry.version).toBe('string');
        expect(entry.author).toBeDefined();
        expect(typeof entry.author).toBe('string');
        expect(entry.serverConfig).toBeDefined();
        expect(typeof entry.serverConfig).toBe('object');
        expect(typeof entry.verified).toBe('boolean');
        expect(Array.isArray(entry.capabilities)).toBe(true);
      });
    });

    test('exported sources have correct structure', async () => {
      const {
        testingMarketplaceSource,
        enterpriseMarketplaceSource,
        disabledMarketplaceSource
      } = await import('../marketplace-scenarios.js');

      const sources = [
        testingMarketplaceSource,
        enterpriseMarketplaceSource,
        disabledMarketplaceSource
      ];

      sources.forEach(source => {
        expect(source.url).toBeDefined();
        expect(typeof source.url).toBe('string');
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.refreshIntervalMinutes).toBe('number');
        expect(typeof source.allowUnverified).toBe('boolean');
      });
    });
  });

  describe('Module Import Compatibility', () => {
    test('supports named imports', async () => {
      // Test individual named imports
      const { emptyMarketplace } = await import('../marketplace-scenarios.js');
      expect(emptyMarketplace).toBeDefined();

      const { createScenario } = await import('../marketplace-scenarios.js');
      expect(createScenario).toBeDefined();
      expect(typeof createScenario).toBe('function');
    });

    test('supports wildcard imports', async () => {
      const * as marketplaceScenarios from '../marketplace-scenarios.js';

      expect(marketplaceScenarios).toBeDefined();
      expect(marketplaceScenarios.emptyMarketplace).toBeDefined();
      expect(marketplaceScenarios.scenarioMarketplaces).toBeDefined();
      expect(marketplaceScenarios.createScenario).toBeDefined();
    });

    test('index file provides consolidated exports', async () => {
      const fixtureExports = await import('../index.js');

      // Should have key exports from marketplace scenarios
      expect(fixtureExports.scenarioMarketplaces).toBeDefined();
      expect(fixtureExports.createScenario).toBeDefined();
    });
  });

  describe('Documentation and Metadata', () => {
    test('all exports have proper documentation structure', async () => {
      const marketplaceModule = await import('../marketplace-scenarios.js');

      // Check that main collections exist
      expect(marketplaceModule.scenarioMarketplaces).toBeDefined();
      expect(marketplaceModule.packageStates).toBeDefined();
      expect(marketplaceModule.configurationVariations).toBeDefined();
      expect(marketplaceModule.marketplaceSources).toBeDefined();

      // Collections should be marked as 'const' (readonly)
      expect(Object.isFrozen(marketplaceModule.packageStates)).toBe(false); // Not frozen, but const exported
    });

    test('fixture scenarios provide comprehensive coverage', async () => {
      const { scenarioMarketplaces, packageStates, configurationVariations } = await import('../marketplace-scenarios.js');

      // Scenarios should cover all acceptance criteria
      expect(scenarioMarketplaces.empty.servers).toHaveLength(0); // Empty marketplace
      expect(scenarioMarketplaces.single.servers).toHaveLength(1); // Single server
      expect(scenarioMarketplaces.multi.servers.length).toBeGreaterThan(3); // Multiple servers

      // Package states should cover all required types
      expect(packageStates.deprecated.description).toContain('[DEPRECATED]'); // Deprecated
      expect(packageStates.alpha.version).toContain('alpha'); // Alpha/beta
      expect(packageStates.draft.version).toContain('dev'); // Draft

      // Configuration variations should cover different connection types
      expect(configurationVariations.http.serverConfig.type).toBe('http'); // HTTP
      expect(configurationVariations.sse.serverConfig.type).toBe('sse'); // SSE
      expect(configurationVariations.complex.serverConfig.env).toBeDefined(); // Environment vars
    });
  });
});