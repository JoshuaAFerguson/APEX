/**
 * @fileoverview Acceptance Criteria Verification Tests
 *
 * Verifies that the marketplace fixtures meet all acceptance criteria:
 * - Static fixture files exist with sample servers, packages, and configurations
 * - Fixtures cover scenarios: empty marketplace, single server, multiple servers,
 *   various package states (published, draft, deprecated), different configuration options
 */

import { describe, test, expect } from 'vitest';
import {
  // Scenario marketplaces
  emptyMarketplace,
  singleServerMarketplace,
  multiServerMarketplace,
  developmentMarketplace,
  enterpriseMarketplace,

  // Package states
  deprecatedFilesystemEntry,
  alphaBrowserEntry,
  draftDatabaseEntry,

  // Configuration variations
  httpServerEntry,
  sseServerEntry,
  complexConfigEntry,

  // Collections
  scenarioMarketplaces,
  packageStates,
  configurationVariations,
} from '../marketplace-scenarios.js';

describe('Acceptance Criteria Verification', () => {
  describe('Static fixture files with sample marketplace data', () => {
    test('fixture files exist and export marketplace data structures', () => {
      // Verify the main fixture files exist and export the expected structures
      expect(scenarioMarketplaces).toBeDefined();
      expect(packageStates).toBeDefined();
      expect(configurationVariations).toBeDefined();

      // Verify each scenario marketplace is a valid marketplace object
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        expect(marketplace.name).toBeDefined();
        expect(marketplace.servers).toBeDefined();
        expect(Array.isArray(marketplace.servers)).toBe(true);
        expect(marketplace.source).toBeDefined();
      });
    });

    test('sample servers are provided with realistic data', () => {
      // Verify we have servers with different characteristics
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      expect(allServers.length).toBeGreaterThan(5);

      // Check for diverse server types
      const serverTypes = new Set(allServers.map(s => s.serverConfig.type));
      expect(serverTypes.size).toBeGreaterThan(1);
      expect(serverTypes).toContain('stdio');
      expect(serverTypes).toContain('http');

      // Check for different verification states
      const verifiedStates = new Set(allServers.map(s => s.verified));
      expect(verifiedStates.size).toBe(2); // Should have both true and false
    });

    test('sample packages are provided with realistic metadata', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);

      allServers.forEach(server => {
        // Basic package information
        expect(server.name).toBeDefined();
        expect(typeof server.name).toBe('string');
        expect(server.name.length).toBeGreaterThan(0);

        expect(server.description).toBeDefined();
        expect(typeof server.description).toBe('string');
        expect(server.description.length).toBeGreaterThan(0);

        expect(server.version).toBeDefined();
        expect(typeof server.version).toBe('string');
        expect(server.version.length).toBeGreaterThan(0);

        // Author and repository information
        expect(server.author).toBeDefined();
        expect(typeof server.author).toBe('string');

        if (server.repository) {
          expect(typeof server.repository).toBe('string');
          expect(server.repository).toMatch(/github|gitlab|bitbucket|git/i);
        }

        // Server configuration
        expect(server.serverConfig).toBeDefined();
        expect(server.serverConfig.name).toBe(server.name);
        expect(['stdio', 'http', 'sse', 'sdk']).toContain(server.serverConfig.type);
      });
    });

    test('sample configurations are provided with realistic settings', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);

      // Check for diverse configuration patterns
      const withEnv = allServers.filter(s => s.serverConfig.env && Object.keys(s.serverConfig.env).length > 0);
      expect(withEnv.length).toBeGreaterThan(0);

      const autoStart = allServers.filter(s => s.serverConfig.autoStart);
      expect(autoStart.length).toBeGreaterThan(0);

      const httpServers = allServers.filter(s => s.serverConfig.type === 'http');
      httpServers.forEach(server => {
        expect(server.serverConfig.url).toBeDefined();
        expect(server.serverConfig.url).toMatch(/^https?:\/\//);
      });
    });
  });

  describe('Empty marketplace scenario', () => {
    test('empty marketplace exists with no servers', () => {
      expect(emptyMarketplace).toBeDefined();
      expect(emptyMarketplace.servers).toBeDefined();
      expect(Array.isArray(emptyMarketplace.servers)).toBe(true);
      expect(emptyMarketplace.servers).toHaveLength(0);

      // Should still have valid marketplace metadata
      expect(emptyMarketplace.name).toBe('Empty MCP Registry');
      expect(emptyMarketplace.description).toBeDefined();
      expect(emptyMarketplace.version).toBeDefined();
      expect(emptyMarketplace.source).toBeDefined();
    });
  });

  describe('Single server scenario', () => {
    test('single server marketplace exists with exactly one server', () => {
      expect(singleServerMarketplace).toBeDefined();
      expect(singleServerMarketplace.servers).toHaveLength(1);

      const server = singleServerMarketplace.servers[0];
      expect(server.name).toBe('filesystem-basic');
      expect(server.verified).toBe(true);
      expect(server.serverConfig.type).toBe('stdio');
    });
  });

  describe('Multiple servers scenario', () => {
    test('multiple servers marketplace exists with diverse servers', () => {
      expect(multiServerMarketplace).toBeDefined();
      expect(multiServerMarketplace.servers.length).toBeGreaterThan(3);

      // Should contain mix of verified and unverified
      const verified = multiServerMarketplace.servers.filter(s => s.verified);
      const unverified = multiServerMarketplace.servers.filter(s => !s.verified);
      expect(verified.length).toBeGreaterThan(0);
      expect(unverified.length).toBeGreaterThan(0);

      // Should contain different configuration types
      const configTypes = new Set(multiServerMarketplace.servers.map(s => s.serverConfig.type));
      expect(configTypes.size).toBeGreaterThan(1);
    });
  });

  describe('Various package states', () => {
    test('published packages (verified=true) are represented', () => {
      const publishedServers = Object.values(scenarioMarketplaces)
        .flatMap(m => m.servers)
        .filter(s => s.verified);

      expect(publishedServers.length).toBeGreaterThan(0);

      publishedServers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning
      });
    });

    test('draft packages are represented with development versions', () => {
      expect(draftDatabaseEntry).toBeDefined();
      expect(draftDatabaseEntry.version).toContain('dev');
      expect(draftDatabaseEntry.verified).toBe(false);
      expect(draftDatabaseEntry.description).toContain('development');
    });

    test('deprecated packages are represented with deprecation notices', () => {
      expect(deprecatedFilesystemEntry).toBeDefined();
      expect(deprecatedFilesystemEntry.description).toContain('[DEPRECATED]');
      expect(deprecatedFilesystemEntry.verified).toBe(true); // Can be verified but deprecated
    });

    test('alpha/beta packages are represented with pre-release versions', () => {
      expect(alphaBrowserEntry).toBeDefined();
      expect(alphaBrowserEntry.version).toContain('alpha');
      expect(alphaBrowserEntry.verified).toBe(false);
      expect(alphaBrowserEntry.description).toContain('Alpha');
    });
  });

  describe('Different configuration options', () => {
    test('stdio configuration is represented', () => {
      const stdioServers = Object.values(scenarioMarketplaces)
        .flatMap(m => m.servers)
        .filter(s => s.serverConfig.type === 'stdio');

      expect(stdioServers.length).toBeGreaterThan(0);

      stdioServers.forEach(server => {
        expect(server.serverConfig.command).toBeDefined();
        expect(Array.isArray(server.serverConfig.args)).toBe(true);
      });
    });

    test('http configuration is represented', () => {
      expect(httpServerEntry).toBeDefined();
      expect(httpServerEntry.serverConfig.type).toBe('http');
      expect(httpServerEntry.serverConfig.url).toBeDefined();
      expect(httpServerEntry.serverConfig.url).toMatch(/^https?:\/\//);
    });

    test('sse configuration is represented', () => {
      expect(sseServerEntry).toBeDefined();
      expect(sseServerEntry.serverConfig.type).toBe('sse');
      expect(sseServerEntry.serverConfig.url).toBeDefined();
      expect(sseServerEntry.serverConfig.autoStart).toBe(true);
    });

    test('environment variables configuration is represented', () => {
      expect(complexConfigEntry).toBeDefined();
      expect(complexConfigEntry.serverConfig.env).toBeDefined();

      const envKeys = Object.keys(complexConfigEntry.serverConfig.env!);
      expect(envKeys.length).toBeGreaterThan(3);
      expect(envKeys).toContain('LOG_LEVEL');
      expect(envKeys).toContain('BATCH_SIZE');
    });

    test('auto-start configuration variations are represented', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);

      const autoStartEnabled = allServers.filter(s => s.serverConfig.autoStart === true);
      const autoStartDisabled = allServers.filter(s => s.serverConfig.autoStart === false);

      expect(autoStartEnabled.length).toBeGreaterThan(0);
      expect(autoStartDisabled.length).toBeGreaterThan(0);
    });
  });

  describe('Realistic marketplace scenarios', () => {
    test('development marketplace contains experimental servers', () => {
      expect(developmentMarketplace).toBeDefined();
      expect(developmentMarketplace.servers.length).toBeGreaterThan(0);

      const unverifiedCount = developmentMarketplace.servers.filter(s => !s.verified).length;
      expect(unverifiedCount).toBeGreaterThan(0);

      // Should contain alpha/beta versions
      const preReleaseVersions = developmentMarketplace.servers.filter(
        s => s.version.includes('alpha') || s.version.includes('beta') || s.version.includes('dev')
      );
      expect(preReleaseVersions.length).toBeGreaterThan(0);
    });

    test('enterprise marketplace contains production-ready servers', () => {
      expect(enterpriseMarketplace).toBeDefined();
      expect(enterpriseMarketplace.servers.length).toBeGreaterThan(0);

      const verifiedCount = enterpriseMarketplace.servers.filter(s => s.verified).length;
      expect(verifiedCount).toBeGreaterThan(0);

      // Should contain stable versions
      const stableVersions = enterpriseMarketplace.servers.filter(
        s => s.version.match(/^\d+\.\d+\.\d+$/)
      );
      expect(stableVersions.length).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive coverage verification', () => {
    test('all required acceptance criteria scenarios are covered', () => {
      // ✅ Empty marketplace
      expect(emptyMarketplace.servers).toHaveLength(0);

      // ✅ Single server
      expect(singleServerMarketplace.servers).toHaveLength(1);

      // ✅ Multiple servers
      expect(multiServerMarketplace.servers.length).toBeGreaterThan(3);

      // ✅ Published state (verified=true)
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      const published = allServers.filter(s => s.verified);
      expect(published.length).toBeGreaterThan(0);

      // ✅ Draft state (development version, unverified)
      const draft = allServers.filter(s => s.version.includes('dev') && !s.verified);
      expect(draft.length).toBeGreaterThan(0);

      // ✅ Deprecated state (marked in description)
      const deprecated = allServers.filter(s => s.description.includes('[DEPRECATED]'));
      expect(deprecated.length).toBeGreaterThan(0);

      // ✅ Different configuration options
      const configTypes = new Set(allServers.map(s => s.serverConfig.type));
      expect(configTypes.size).toBeGreaterThan(1);
      expect(configTypes).toContain('stdio');
      expect(configTypes).toContain('http');

      const withEnv = allServers.filter(s =>
        s.serverConfig.env && Object.keys(s.serverConfig.env).length > 0
      );
      expect(withEnv.length).toBeGreaterThan(0);
    });

    test('fixtures are suitable for comprehensive testing', () => {
      // Verify we have enough variety for thorough testing
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);

      expect(allServers.length).toBeGreaterThan(8); // Sufficient variety

      // Different authors/sources
      const authors = new Set(allServers.map(s => s.author));
      expect(authors.size).toBeGreaterThan(3);

      // Different capabilities
      const allCapabilities = allServers.flatMap(s => s.capabilities || []);
      const uniqueCapabilities = new Set(allCapabilities);
      expect(uniqueCapabilities.size).toBeGreaterThan(1);
      expect(uniqueCapabilities).toContain('tools');
    });
  });
});