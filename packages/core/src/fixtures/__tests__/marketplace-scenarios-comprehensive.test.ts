/**
 * @fileoverview Comprehensive Integration Tests for Marketplace Scenarios
 *
 * This test suite provides end-to-end validation of marketplace scenario fixtures
 * with a focus on real-world usage patterns and comprehensive validation.
 */

import { describe, test, expect, beforeEach } from 'vitest';
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

  // Marketplace sources
  testingMarketplaceSource,
  enterpriseMarketplaceSource,
  disabledMarketplaceSource,

  // Collections and utilities
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
import type { MCPMarketplace, MCPMarketplaceEntry } from '../../types.js';

describe('Marketplace Scenarios - Comprehensive Integration Tests', () => {
  describe('Complete Acceptance Criteria Validation', () => {
    test('all required fixture files exist and are properly exported', () => {
      // Verify all main exports are available
      expect(scenarioMarketplaces).toBeDefined();
      expect(packageStates).toBeDefined();
      expect(configurationVariations).toBeDefined();
      expect(marketplaceSources).toBeDefined();

      // Verify all scenario marketplaces exist
      expect(emptyMarketplace).toBeDefined();
      expect(singleServerMarketplace).toBeDefined();
      expect(multiServerMarketplace).toBeDefined();
      expect(developmentMarketplace).toBeDefined();
      expect(enterpriseMarketplace).toBeDefined();

      // Verify all package states exist
      expect(deprecatedFilesystemEntry).toBeDefined();
      expect(alphaBrowserEntry).toBeDefined();
      expect(draftDatabaseEntry).toBeDefined();

      // Verify all configuration variations exist
      expect(httpServerEntry).toBeDefined();
      expect(sseServerEntry).toBeDefined();
      expect(complexConfigEntry).toBeDefined();

      // Verify all utility functions exist
      expect(getAllVerifiedEntries).toBeDefined();
      expect(getAllUnverifiedEntries).toBeDefined();
      expect(getEntriesByConfigType).toBeDefined();
      expect(getEntriesWithEnvironment).toBeDefined();
      expect(getAutoStartEntries).toBeDefined();
      expect(createScenario).toBeDefined();
    });

    test('empty marketplace scenario meets acceptance criteria', () => {
      expect(emptyMarketplace.servers).toHaveLength(0);
      expect(emptyMarketplace.name).toBe('Empty MCP Registry');
      expect(emptyMarketplace.description).toContain('no available servers');
      expect(emptyMarketplace.source).toBe(testingMarketplaceSource);

      // Should still have valid marketplace structure
      expect(emptyMarketplace.version).toBeDefined();
      expect(emptyMarketplace.lastUpdated).toBeDefined();
      expect(new Date(emptyMarketplace.lastUpdated)).toBeInstanceOf(Date);
    });

    test('single server marketplace scenario meets acceptance criteria', () => {
      expect(singleServerMarketplace.servers).toHaveLength(1);
      const server = singleServerMarketplace.servers[0];

      expect(server.name).toBe('filesystem-basic');
      expect(server.description).toContain('filesystem operations');
      expect(server.verified).toBe(true);
      expect(server.serverConfig.type).toBe('stdio');
      expect(server.capabilities).toContain('resources');
      expect(server.capabilities).toContain('tools');
    });

    test('multiple servers marketplace scenario meets acceptance criteria', () => {
      expect(multiServerMarketplace.servers.length).toBeGreaterThan(5);

      // Should contain mix of verified and unverified servers
      const verified = multiServerMarketplace.servers.filter(s => s.verified);
      const unverified = multiServerMarketplace.servers.filter(s => !s.verified);
      expect(verified.length).toBeGreaterThan(0);
      expect(unverified.length).toBeGreaterThan(0);

      // Should contain different configuration types
      const configTypes = new Set(multiServerMarketplace.servers.map(s => s.serverConfig.type));
      expect(configTypes.size).toBeGreaterThan(2);
      expect(configTypes).toContain('stdio');
      expect(configTypes).toContain('http');
      expect(configTypes).toContain('sse');

      // Should contain deprecated entries
      const deprecated = multiServerMarketplace.servers.find(s =>
        s.description.includes('[DEPRECATED]')
      );
      expect(deprecated).toBeDefined();
    });

    test('various package states are properly represented', () => {
      // Published packages (verified)
      const publishedServers = getAllVerifiedEntries();
      expect(publishedServers.length).toBeGreaterThan(3);
      publishedServers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.version).toMatch(/^\d+\.\d+\.\d+/);
      });

      // Draft packages
      expect(draftDatabaseEntry.verified).toBe(false);
      expect(draftDatabaseEntry.version).toContain('dev');
      expect(draftDatabaseEntry.description).toContain('development');

      // Deprecated packages
      expect(deprecatedFilesystemEntry.description).toContain('[DEPRECATED]');
      expect(deprecatedFilesystemEntry.description).toContain('Use filesystem-server-v2 instead');

      // Alpha/beta packages
      expect(alphaBrowserEntry.version).toMatch(/alpha|beta|rc/);
      expect(alphaBrowserEntry.verified).toBe(false);
      expect(alphaBrowserEntry.description).toContain('Alpha');
    });

    test('different configuration options are properly represented', () => {
      // STDIO configuration
      const stdioServers = getEntriesByConfigType('stdio');
      expect(stdioServers.length).toBeGreaterThan(3);
      stdioServers.forEach(server => {
        expect(server.serverConfig.command).toBeDefined();
        expect(Array.isArray(server.serverConfig.args)).toBe(true);
      });

      // HTTP configuration
      const httpServers = getEntriesByConfigType('http');
      expect(httpServers.length).toBeGreaterThan(0);
      httpServers.forEach(server => {
        expect(server.serverConfig.url).toBeDefined();
        expect(server.serverConfig.url).toMatch(/^https?:\/\//);
      });

      // SSE configuration
      const sseServers = getEntriesByConfigType('sse');
      expect(sseServers.length).toBeGreaterThan(0);
      sseServers.forEach(server => {
        expect(server.serverConfig.url).toBeDefined();
        expect(server.serverConfig.url).toMatch(/^https?:\/\//);
      });

      // Environment variables
      const serversWithEnv = getEntriesWithEnvironment();
      expect(serversWithEnv.length).toBeGreaterThan(2);
      serversWithEnv.forEach(server => {
        expect(server.serverConfig.env).toBeDefined();
        expect(Object.keys(server.serverConfig.env!).length).toBeGreaterThan(0);
      });

      // Auto-start variations
      const autoStartServers = getAutoStartEntries();
      const manualStartServers = getAllVerifiedEntries().concat(getAllUnverifiedEntries())
        .filter(s => !s.serverConfig.autoStart);
      expect(autoStartServers.length).toBeGreaterThan(0);
      expect(manualStartServers.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Marketplace Usage Scenarios', () => {
    test('development team workflow scenario', () => {
      // A development team testing unverified packages
      const devScenario = createScenario({
        verified: false,
        name: 'Development Team Testing',
        description: 'Unverified packages for development testing'
      });

      expect(devScenario.servers.length).toBeGreaterThan(0);
      devScenario.servers.forEach(server => {
        expect(server.verified).toBe(false);
      });

      // Should contain alpha/beta versions
      const preReleaseCount = devScenario.servers.filter(s =>
        s.version.includes('alpha') || s.version.includes('beta') || s.version.includes('dev')
      ).length;
      expect(preReleaseCount).toBeGreaterThan(0);
    });

    test('production deployment scenario', () => {
      // Production environment using only verified, stable packages
      const prodScenario = createScenario({
        verified: true,
        hasEnvironment: false, // Minimal configuration for security
        name: 'Production Environment',
        description: 'Verified packages for production use'
      });

      expect(prodScenario.servers.length).toBeGreaterThan(0);
      prodScenario.servers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.version).toMatch(/^\d+\.\d+\.\d+$/); // Stable semantic version
      });
    });

    test('enterprise integration scenario', () => {
      // Enterprise using HTTP-based servers with authentication
      const enterpriseScenario = createScenario({
        verified: true,
        configType: 'http',
        hasEnvironment: true, // Authentication and config required
      });

      enterpriseScenario.servers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.serverConfig.type).toBe('http');
        expect(server.serverConfig.url).toMatch(/^https?:\/\//);
        expect(server.serverConfig.env).toBeDefined();
      });
    });

    test('development environment with mixed configurations', () => {
      // Development setup with both local (stdio) and remote (http) servers
      const mixedScenario = multiServerMarketplace;

      const stdioCount = mixedScenario.servers.filter(s => s.serverConfig.type === 'stdio').length;
      const httpCount = mixedScenario.servers.filter(s => s.serverConfig.type === 'http').length;
      const sseCount = mixedScenario.servers.filter(s => s.serverConfig.type === 'sse').length;

      expect(stdioCount).toBeGreaterThan(0);
      expect(httpCount).toBeGreaterThan(0);
      expect(sseCount).toBeGreaterThan(0);
    });
  });

  describe('Data Quality and Consistency Tests', () => {
    test('all marketplace data follows consistent naming conventions', () => {
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        // Marketplace names should be descriptive
        expect(marketplace.name).toMatch(/MCP Registry/);
        expect(marketplace.description.length).toBeGreaterThan(20);

        // Servers should have consistent naming
        marketplace.servers.forEach(server => {
          expect(server.name).toMatch(/^[a-z0-9-]+$/); // kebab-case
          expect(server.serverConfig.name).toBe(server.name);
          expect(server.description.length).toBeGreaterThan(10);
        });
      });
    });

    test('version numbers follow semantic versioning', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);

      allServers.forEach(server => {
        if (server.verified && !server.description.includes('[DEPRECATED]')) {
          // Production servers should follow semantic versioning
          expect(server.version).toMatch(/^\d+\.\d+\.\d+/);
        }

        // All versions should be valid version strings
        expect(server.version).toBeDefined();
        expect(server.version.length).toBeGreaterThan(0);
      });
    });

    test('server configurations are complete and valid', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);

      allServers.forEach(server => {
        // Basic configuration requirements
        expect(server.serverConfig.name).toBe(server.name);
        expect(['stdio', 'http', 'sse', 'sdk']).toContain(server.serverConfig.type);
        expect(typeof server.serverConfig.autoStart).toBe('boolean');

        // Type-specific requirements
        if (server.serverConfig.type === 'stdio') {
          expect(server.serverConfig.command).toBeDefined();
          expect(Array.isArray(server.serverConfig.args)).toBe(true);
        } else if (server.serverConfig.type === 'http' || server.serverConfig.type === 'sse') {
          expect(server.serverConfig.url).toBeDefined();
          expect(server.serverConfig.url).toMatch(/^https?:\/\//);
        }

        // Environment variables should be proper objects
        if (server.serverConfig.env) {
          expect(typeof server.serverConfig.env).toBe('object');
          expect(Array.isArray(server.serverConfig.env)).toBe(false);
        }
      });
    });

    test('marketplace sources have valid URLs and configurations', () => {
      Object.values(marketplaceSources).forEach(source => {
        expect(source.url).toMatch(/^https?:\/\//);
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.refreshIntervalMinutes).toBe('number');
        expect(source.refreshIntervalMinutes).toBeGreaterThan(0);
        expect(typeof source.allowUnverified).toBe('boolean');
      });
    });

    test('capabilities are properly defined and realistic', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      const validCapabilities = ['tools', 'resources', 'prompts'];

      allServers.forEach(server => {
        expect(Array.isArray(server.capabilities)).toBe(true);
        expect(server.capabilities.length).toBeGreaterThan(0);

        server.capabilities.forEach(capability => {
          expect(validCapabilities).toContain(capability);
        });
      });
    });
  });

  describe('Utility Function Integration Tests', () => {
    test('utility functions provide consistent and complete results', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      const verifiedEntries = getAllVerifiedEntries();
      const unverifiedEntries = getAllUnverifiedEntries();

      // All servers should be either verified or unverified
      expect(verifiedEntries.length + unverifiedEntries.length).toBe(allServers.length);

      // No overlap between verified and unverified
      const verifiedNames = new Set(verifiedEntries.map(s => s.name));
      const unverifiedNames = new Set(unverifiedEntries.map(s => s.name));
      const intersection = new Set([...verifiedNames].filter(x => unverifiedNames.has(x)));
      expect(intersection.size).toBe(0);
    });

    test('configuration type filtering is accurate', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      const configTypes = ['stdio', 'http', 'sse'] as const;

      configTypes.forEach(type => {
        const filtered = getEntriesByConfigType(type);
        const manual = allServers.filter(s => s.serverConfig.type === type);

        expect(filtered.length).toBe(manual.length);
        expect(filtered.every(s => s.serverConfig.type === type)).toBe(true);
      });
    });

    test('environment variable filtering works correctly', () => {
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      const withEnv = getEntriesWithEnvironment();

      withEnv.forEach(server => {
        expect(server.serverConfig.env).toBeDefined();
        expect(Object.keys(server.serverConfig.env!).length).toBeGreaterThan(0);
      });

      // Manual verification
      const manualWithEnv = allServers.filter(s =>
        s.serverConfig.env && Object.keys(s.serverConfig.env).length > 0
      );
      expect(withEnv.length).toBe(manualWithEnv.length);
    });

    test('auto-start filtering is accurate', () => {
      const autoStartEntries = getAutoStartEntries();

      autoStartEntries.forEach(server => {
        expect(server.serverConfig.autoStart).toBe(true);
      });

      // Verify some servers have auto-start disabled
      const allServers = Object.values(scenarioMarketplaces).flatMap(m => m.servers);
      const manualStart = allServers.filter(s => !s.serverConfig.autoStart);
      expect(manualStart.length).toBeGreaterThan(0);
    });

    test('custom scenario creation supports complex filtering', () => {
      // Test multiple filter combinations
      const complexScenario = createScenario({
        verified: true,
        configType: 'stdio',
        hasEnvironment: true,
        autoStart: false,
        name: 'Complex Filter Test',
        description: 'Testing multiple filters'
      });

      complexScenario.servers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.serverConfig.type).toBe('stdio');
        expect(server.serverConfig.env).toBeDefined();
        expect(Object.keys(server.serverConfig.env!).length).toBeGreaterThan(0);
        expect(server.serverConfig.autoStart).toBe(false);
      });

      // Verify the custom marketplace metadata
      expect(complexScenario.name).toBe('Complex Filter Test');
      expect(complexScenario.description).toBe('Testing multiple filters');
      expect(complexScenario.source).toBe(testingMarketplaceSource);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('empty scenarios handle gracefully', () => {
      const emptyScenario = createScenario({
        verified: true,
        configType: 'sdk', // Type that doesn't exist in fixtures
      });

      expect(emptyScenario.servers).toHaveLength(0);
      expect(emptyScenario.name).toBe('Custom Test Scenario');
      expect(emptyScenario.source).toBe(testingMarketplaceSource);
    });

    test('disabled marketplace source is properly configured', () => {
      expect(disabledMarketplaceSource.enabled).toBe(false);
      expect(disabledMarketplaceSource.url).toMatch(/^https?:\/\//);
      expect(disabledMarketplaceSource.refreshIntervalMinutes).toBeGreaterThan(0);
    });

    test('marketplace timestamps are valid dates', () => {
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        expect(marketplace.lastUpdated).toBeDefined();
        const date = new Date(marketplace.lastUpdated);
        expect(date).toBeInstanceOf(Date);
        expect(isNaN(date.getTime())).toBe(false);
      });
    });
  });

  describe('Performance and Scalability Validation', () => {
    test('utility functions perform efficiently with all data', () => {
      const startTime = Date.now();

      // Run all utility functions
      getAllVerifiedEntries();
      getAllUnverifiedEntries();
      getEntriesByConfigType('stdio');
      getEntriesByConfigType('http');
      getEntriesWithEnvironment();
      getAutoStartEntries();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(100); // 100ms threshold
    });

    test('custom scenario creation scales with complex filters', () => {
      const startTime = Date.now();

      // Create multiple complex scenarios
      for (let i = 0; i < 10; i++) {
        createScenario({
          verified: i % 2 === 0,
          configType: i % 3 === 0 ? 'stdio' : 'http',
          hasEnvironment: i % 4 === 0,
          autoStart: i % 5 === 0,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // 50ms threshold
    });
  });
});