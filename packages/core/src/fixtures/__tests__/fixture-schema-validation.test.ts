/**
 * @fileoverview Schema Validation Tests for Marketplace Fixtures
 *
 * Validates that all fixture data strictly conforms to the defined Zod schemas
 * and type definitions. This ensures fixture data can be safely used in production.
 */

import { describe, test, expect } from 'vitest';
import {
  MCPMarketplaceSchema,
  MCPMarketplaceEntrySchema,
  MCPMarketplaceSourceSchema,
  MCPServerConfigSchema,
  MCPServerSchema,
} from '../../types.js';
import {
  // All scenario marketplaces
  emptyMarketplace,
  singleServerMarketplace,
  multiServerMarketplace,
  developmentMarketplace,
  enterpriseMarketplace,

  // Individual entries and sources
  deprecatedFilesystemEntry,
  alphaBrowserEntry,
  draftDatabaseEntry,
  httpServerEntry,
  sseServerEntry,
  complexConfigEntry,
  testingMarketplaceSource,
  enterpriseMarketplaceSource,
  disabledMarketplaceSource,

  // Collections
  scenarioMarketplaces,
  packageStates,
  configurationVariations,
  marketplaceSources,
} from '../marketplace-scenarios.js';

describe('Fixture Schema Validation', () => {
  describe('Individual Marketplace Entry Validation', () => {
    test('deprecated filesystem entry conforms to schema', () => {
      expect(() => MCPMarketplaceEntrySchema.parse(deprecatedFilesystemEntry))
        .not.toThrow();

      // Validate specific deprecated entry characteristics
      expect(deprecatedFilesystemEntry.description).toContain('[DEPRECATED]');
      expect(deprecatedFilesystemEntry.verified).toBe(true);
      expect(deprecatedFilesystemEntry.serverConfig.type).toBe('stdio');
    });

    test('alpha browser entry conforms to schema', () => {
      expect(() => MCPMarketplaceEntrySchema.parse(alphaBrowserEntry))
        .not.toThrow();

      // Validate alpha entry characteristics
      expect(alphaBrowserEntry.version).toMatch(/alpha/);
      expect(alphaBrowserEntry.verified).toBe(false);
      expect(alphaBrowserEntry.serverConfig.env).toBeDefined();
    });

    test('draft database entry conforms to schema', () => {
      expect(() => MCPMarketplaceEntrySchema.parse(draftDatabaseEntry))
        .not.toThrow();

      // Validate draft entry characteristics
      expect(draftDatabaseEntry.version).toContain('dev');
      expect(draftDatabaseEntry.verified).toBe(false);
      expect(draftDatabaseEntry.serverConfig.env).toBeDefined();
    });

    test('HTTP server entry conforms to schema', () => {
      expect(() => MCPMarketplaceEntrySchema.parse(httpServerEntry))
        .not.toThrow();

      // Validate HTTP configuration
      expect(httpServerEntry.serverConfig.type).toBe('http');
      expect(httpServerEntry.serverConfig.url).toMatch(/^https?:\/\//);
      expect(httpServerEntry.verified).toBe(true);
    });

    test('SSE server entry conforms to schema', () => {
      expect(() => MCPMarketplaceEntrySchema.parse(sseServerEntry))
        .not.toThrow();

      // Validate SSE configuration
      expect(sseServerEntry.serverConfig.type).toBe('sse');
      expect(sseServerEntry.serverConfig.url).toMatch(/^https?:\/\//);
      expect(sseServerEntry.serverConfig.autoStart).toBe(true);
    });

    test('complex config entry conforms to schema', () => {
      expect(() => MCPMarketplaceEntrySchema.parse(complexConfigEntry))
        .not.toThrow();

      // Validate complex configuration
      expect(complexConfigEntry.serverConfig.type).toBe('stdio');
      expect(complexConfigEntry.serverConfig.env).toBeDefined();
      expect(Object.keys(complexConfigEntry.serverConfig.env!).length).toBeGreaterThan(4);
    });
  });

  describe('Server Configuration Validation', () => {
    test('all server configs in package states conform to schema', () => {
      Object.values(packageStates).forEach(entry => {
        expect(() => MCPServerConfigSchema.parse(entry.serverConfig))
          .not.toThrow();
      });
    });

    test('all server configs in configuration variations conform to schema', () => {
      Object.values(configurationVariations).forEach(entry => {
        expect(() => MCPServerConfigSchema.parse(entry.serverConfig))
          .not.toThrow();
      });
    });

    test('stdio server configs have required fields', () => {
      const stdioEntries = Object.values(packageStates).concat(Object.values(configurationVariations))
        .filter(entry => entry.serverConfig.type === 'stdio');

      stdioEntries.forEach(entry => {
        const config = entry.serverConfig;
        expect(config.command).toBeDefined();
        expect(Array.isArray(config.args)).toBe(true);
        expect(config.name).toBeDefined();
        expect(typeof config.autoStart).toBe('boolean');
      });
    });

    test('HTTP/SSE server configs have required URLs', () => {
      const httpSseEntries = Object.values(packageStates).concat(Object.values(configurationVariations))
        .filter(entry => entry.serverConfig.type === 'http' || entry.serverConfig.type === 'sse');

      httpSseEntries.forEach(entry => {
        const config = entry.serverConfig;
        expect(config.url).toBeDefined();
        expect(config.url).toMatch(/^https?:\/\//);
        expect(config.name).toBeDefined();
        expect(typeof config.autoStart).toBe('boolean');
      });
    });
  });

  describe('Marketplace Source Validation', () => {
    test('testing marketplace source conforms to schema', () => {
      expect(() => MCPMarketplaceSourceSchema.parse(testingMarketplaceSource))
        .not.toThrow();

      expect(testingMarketplaceSource.enabled).toBe(true);
      expect(testingMarketplaceSource.allowUnverified).toBe(true);
      expect(testingMarketplaceSource.refreshIntervalMinutes).toBe(5);
    });

    test('enterprise marketplace source conforms to schema', () => {
      expect(() => MCPMarketplaceSourceSchema.parse(enterpriseMarketplaceSource))
        .not.toThrow();

      expect(enterpriseMarketplaceSource.enabled).toBe(true);
      expect(enterpriseMarketplaceSource.allowUnverified).toBe(false);
      expect(enterpriseMarketplaceSource.refreshIntervalMinutes).toBe(120);
    });

    test('disabled marketplace source conforms to schema', () => {
      expect(() => MCPMarketplaceSourceSchema.parse(disabledMarketplaceSource))
        .not.toThrow();

      expect(disabledMarketplaceSource.enabled).toBe(false);
      expect(disabledMarketplaceSource.refreshIntervalMinutes).toBe(1440);
    });

    test('all marketplace sources have valid URLs', () => {
      Object.values(marketplaceSources).forEach(source => {
        expect(source.url).toMatch(/^https?:\/\//);
        expect(typeof source.refreshIntervalMinutes).toBe('number');
        expect(source.refreshIntervalMinutes).toBeGreaterThan(0);
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.allowUnverified).toBe('boolean');
      });
    });
  });

  describe('Complete Marketplace Validation', () => {
    test('empty marketplace conforms to schema', () => {
      expect(() => MCPMarketplaceSchema.parse(emptyMarketplace))
        .not.toThrow();

      expect(emptyMarketplace.servers).toHaveLength(0);
      expect(emptyMarketplace.source).toBe(testingMarketplaceSource);
    });

    test('single server marketplace conforms to schema', () => {
      expect(() => MCPMarketplaceSchema.parse(singleServerMarketplace))
        .not.toThrow();

      expect(singleServerMarketplace.servers).toHaveLength(1);

      // Validate the single server
      const server = singleServerMarketplace.servers[0];
      expect(() => MCPMarketplaceEntrySchema.parse(server)).not.toThrow();
    });

    test('multi-server marketplace conforms to schema', () => {
      expect(() => MCPMarketplaceSchema.parse(multiServerMarketplace))
        .not.toThrow();

      expect(multiServerMarketplace.servers.length).toBeGreaterThan(1);

      // Validate each server individually
      multiServerMarketplace.servers.forEach(server => {
        expect(() => MCPMarketplaceEntrySchema.parse(server)).not.toThrow();
      });
    });

    test('development marketplace conforms to schema', () => {
      expect(() => MCPMarketplaceSchema.parse(developmentMarketplace))
        .not.toThrow();

      // Validate all servers
      developmentMarketplace.servers.forEach(server => {
        expect(() => MCPMarketplaceEntrySchema.parse(server)).not.toThrow();
      });
    });

    test('enterprise marketplace conforms to schema', () => {
      expect(() => MCPMarketplaceSchema.parse(enterpriseMarketplace))
        .not.toThrow();

      // Validate all servers
      enterpriseMarketplace.servers.forEach(server => {
        expect(() => MCPMarketplaceEntrySchema.parse(server)).not.toThrow();
      });
    });

    test('all scenario marketplaces conform to schema', () => {
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        expect(() => MCPMarketplaceSchema.parse(marketplace)).not.toThrow();

        // Validate structure
        expect(marketplace.name).toBeDefined();
        expect(marketplace.description).toBeDefined();
        expect(marketplace.version).toBeDefined();
        expect(marketplace.lastUpdated).toBeDefined();
        expect(Array.isArray(marketplace.servers)).toBe(true);
        expect(marketplace.source).toBeDefined();

        // Validate lastUpdated is a valid ISO string
        const date = new Date(marketplace.lastUpdated);
        expect(isNaN(date.getTime())).toBe(false);

        // Validate each server
        marketplace.servers.forEach(server => {
          expect(() => MCPMarketplaceEntrySchema.parse(server)).not.toThrow();
        });

        // Validate source
        expect(() => MCPMarketplaceSourceSchema.parse(marketplace.source)).not.toThrow();
      });
    });
  });

  describe('Type-Specific Validation Rules', () => {
    test('stdio configurations have valid commands and arguments', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const stdioServers = allMarketplaces.flatMap(m => m.servers)
        .filter(s => s.serverConfig.type === 'stdio');

      expect(stdioServers.length).toBeGreaterThan(0);

      stdioServers.forEach(server => {
        expect(server.serverConfig.command).toBeDefined();
        expect(typeof server.serverConfig.command).toBe('string');
        expect(server.serverConfig.command.length).toBeGreaterThan(0);

        expect(Array.isArray(server.serverConfig.args)).toBe(true);

        if (server.serverConfig.args) {
          server.serverConfig.args.forEach(arg => {
            expect(typeof arg).toBe('string');
          });
        }
      });
    });

    test('HTTP/SSE configurations have valid URLs and no conflicting fields', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const httpSseServers = allMarketplaces.flatMap(m => m.servers)
        .filter(s => s.serverConfig.type === 'http' || s.serverConfig.type === 'sse');

      expect(httpSseServers.length).toBeGreaterThan(0);

      httpSseServers.forEach(server => {
        const config = server.serverConfig;

        // Should have URL
        expect(config.url).toBeDefined();
        expect(config.url).toMatch(/^https?:\/\/[^\s]+$/);

        // Should not have stdio-specific fields
        expect(config.command).toBeUndefined();
        expect(config.args).toBeUndefined();
      });
    });

    test('environment variables are properly structured', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const serversWithEnv = allMarketplaces.flatMap(m => m.servers)
        .filter(s => s.serverConfig.env);

      expect(serversWithEnv.length).toBeGreaterThan(0);

      serversWithEnv.forEach(server => {
        const env = server.serverConfig.env!;

        expect(typeof env).toBe('object');
        expect(Array.isArray(env)).toBe(false);
        expect(env).not.toBe(null);

        // All environment variable values should be strings
        Object.entries(env).forEach(([key, value]) => {
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });

    test('capabilities arrays contain only valid values', () => {
      const validCapabilities = ['tools', 'resources', 'prompts'];
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const allServers = allMarketplaces.flatMap(m => m.servers);

      allServers.forEach(server => {
        expect(Array.isArray(server.capabilities)).toBe(true);
        expect(server.capabilities.length).toBeGreaterThan(0);

        server.capabilities.forEach(capability => {
          expect(validCapabilities).toContain(capability);
        });

        // Should not have duplicate capabilities
        const uniqueCapabilities = [...new Set(server.capabilities)];
        expect(uniqueCapabilities.length).toBe(server.capabilities.length);
      });
    });

    test('version strings follow expected patterns', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const allServers = allMarketplaces.flatMap(m => m.servers);

      allServers.forEach(server => {
        expect(server.version).toBeDefined();
        expect(typeof server.version).toBe('string');
        expect(server.version.length).toBeGreaterThan(0);

        // Should be a valid version string (semantic versioning or pre-release)
        expect(server.version).toMatch(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9\-.]+)?$/);
      });
    });
  });

  describe('Cross-Validation and Consistency Tests', () => {
    test('server config names match marketplace entry names', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const allServers = allMarketplaces.flatMap(m => m.servers);

      allServers.forEach(server => {
        expect(server.serverConfig.name).toBe(server.name);
      });
    });

    test('verified servers have stable version numbers', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const verifiedServers = allMarketplaces.flatMap(m => m.servers)
        .filter(s => s.verified && !s.description.includes('[DEPRECATED]'));

      verifiedServers.forEach(server => {
        // Verified non-deprecated servers should have stable versions
        expect(server.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(server.version).not.toMatch(/alpha|beta|rc|dev/);
      });
    });

    test('unverified servers have pre-release indicators', () => {
      const allMarketplaces = Object.values(scenarioMarketplaces);
      const unverifiedServers = allMarketplaces.flatMap(m => m.servers)
        .filter(s => !s.verified);

      unverifiedServers.forEach(server => {
        // Should have some indicator of pre-release or development status
        const hasPreReleaseVersion = /alpha|beta|rc|dev/.test(server.version);
        const hasDevDescription = /alpha|beta|development|experimental|draft/i.test(server.description);

        expect(hasPreReleaseVersion || hasDevDescription).toBe(true);
      });
    });

    test('marketplace timestamps are chronologically consistent', () => {
      const marketplaces = Object.values(scenarioMarketplaces);
      const timestamps = marketplaces.map(m => new Date(m.lastUpdated).getTime());

      // All timestamps should be valid and not in the future
      const now = Date.now();
      timestamps.forEach(timestamp => {
        expect(timestamp).toBeLessThanOrEqual(now);
        expect(timestamp).toBeGreaterThan(new Date('2020-01-01').getTime()); // Reasonable lower bound
      });
    });

    test('marketplace sources have appropriate refresh intervals', () => {
      Object.values(marketplaceSources).forEach(source => {
        // Refresh intervals should be reasonable (between 1 minute and 1 week)
        expect(source.refreshIntervalMinutes).toBeGreaterThanOrEqual(1);
        expect(source.refreshIntervalMinutes).toBeLessThanOrEqual(10080); // 1 week

        // Disabled sources can have longer refresh intervals
        if (!source.enabled) {
          expect(source.refreshIntervalMinutes).toBeGreaterThanOrEqual(60); // At least 1 hour
        }
      });
    });
  });
});