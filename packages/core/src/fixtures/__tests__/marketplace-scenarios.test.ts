/**
 * @fileoverview Tests for Marketplace Scenario Fixtures
 *
 * Validates that all scenario fixtures meet acceptance criteria and function correctly.
 */

import { describe, test, expect } from 'vitest';
import {
  emptyMarketplace,
  singleServerMarketplace,
  multiServerMarketplace,
  developmentMarketplace,
  enterpriseMarketplace,
  packageStates,
  configurationVariations,
  scenarioMarketplaces,
  getAllVerifiedEntries,
  getAllUnverifiedEntries,
  getEntriesByConfigType,
  getEntriesWithEnvironment,
  getAutoStartEntries,
  createScenario,
} from '../marketplace-scenarios.js';

describe('Marketplace Scenario Fixtures', () => {
  describe('Acceptance Criteria Coverage', () => {
    test('empty marketplace scenario exists', () => {
      expect(emptyMarketplace).toBeDefined();
      expect(emptyMarketplace.servers).toHaveLength(0);
      expect(emptyMarketplace.name).toBe('Empty MCP Registry');
    });

    test('single server marketplace scenario exists', () => {
      expect(singleServerMarketplace).toBeDefined();
      expect(singleServerMarketplace.servers).toHaveLength(1);
      expect(singleServerMarketplace.servers[0].name).toBe('filesystem-basic');
    });

    test('multiple servers marketplace scenario exists', () => {
      expect(multiServerMarketplace).toBeDefined();
      expect(multiServerMarketplace.servers.length).toBeGreaterThan(1);
      expect(multiServerMarketplace.name).toBe('Comprehensive MCP Registry');
    });

    test('various package states are covered', () => {
      // Deprecated package
      expect(packageStates.deprecated).toBeDefined();
      expect(packageStates.deprecated.description).toContain('[DEPRECATED]');

      // Alpha/beta package
      expect(packageStates.alpha).toBeDefined();
      expect(packageStates.alpha.version).toContain('alpha');
      expect(packageStates.alpha.verified).toBe(false);

      // Draft package
      expect(packageStates.draft).toBeDefined();
      expect(packageStates.draft.version).toContain('dev');
      expect(packageStates.draft.verified).toBe(false);
    });

    test('different configuration options are covered', () => {
      // HTTP configuration
      expect(configurationVariations.http).toBeDefined();
      expect(configurationVariations.http.serverConfig.type).toBe('http');
      expect(configurationVariations.http.serverConfig.url).toBeDefined();

      // SSE configuration
      expect(configurationVariations.sse).toBeDefined();
      expect(configurationVariations.sse.serverConfig.type).toBe('sse');
      expect(configurationVariations.sse.serverConfig.url).toBeDefined();

      // Complex configuration with environment variables
      expect(configurationVariations.complex).toBeDefined();
      expect(configurationVariations.complex.serverConfig.env).toBeDefined();
      expect(Object.keys(configurationVariations.complex.serverConfig.env!)).toContain('LOG_LEVEL');
    });
  });

  describe('Data Structure Validation', () => {
    test('all marketplaces have required fields', () => {
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        expect(marketplace.name).toBeDefined();
        expect(marketplace.description).toBeDefined();
        expect(marketplace.version).toBeDefined();
        expect(marketplace.lastUpdated).toBeDefined();
        expect(marketplace.servers).toBeDefined();
        expect(Array.isArray(marketplace.servers)).toBe(true);
        expect(marketplace.source).toBeDefined();
      });
    });

    test('all marketplace entries have required fields', () => {
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        marketplace.servers.forEach(server => {
          expect(server.name).toBeDefined();
          expect(server.description).toBeDefined();
          expect(server.version).toBeDefined();
          expect(server.serverConfig).toBeDefined();
          expect(server.serverConfig.name).toBeDefined();
          expect(server.serverConfig.type).toBeDefined();
          expect(server.serverConfig.command).toBeDefined();
          expect(Array.isArray(server.serverConfig.args)).toBe(true);
          expect(typeof server.serverConfig.autoStart).toBe('boolean');
          expect(typeof server.verified).toBe('boolean');
        });
      });
    });

    test('server configurations have valid types', () => {
      const validTypes = ['stdio', 'http', 'sse', 'sdk'];
      Object.values(scenarioMarketplaces).forEach(marketplace => {
        marketplace.servers.forEach(server => {
          expect(validTypes).toContain(server.serverConfig.type);
        });
      });
    });
  });

  describe('Utility Functions', () => {
    test('getAllVerifiedEntries returns only verified entries', () => {
      const verifiedEntries = getAllVerifiedEntries();
      expect(verifiedEntries.length).toBeGreaterThan(0);
      verifiedEntries.forEach(entry => {
        expect(entry.verified).toBe(true);
      });
    });

    test('getAllUnverifiedEntries returns only unverified entries', () => {
      const unverifiedEntries = getAllUnverifiedEntries();
      expect(unverifiedEntries.length).toBeGreaterThan(0);
      unverifiedEntries.forEach(entry => {
        expect(entry.verified).toBe(false);
      });
    });

    test('getEntriesByConfigType filters correctly', () => {
      const stdioEntries = getEntriesByConfigType('stdio');
      expect(stdioEntries.length).toBeGreaterThan(0);
      stdioEntries.forEach(entry => {
        expect(entry.serverConfig.type).toBe('stdio');
      });

      const httpEntries = getEntriesByConfigType('http');
      expect(httpEntries.length).toBeGreaterThan(0);
      httpEntries.forEach(entry => {
        expect(entry.serverConfig.type).toBe('http');
      });
    });

    test('getEntriesWithEnvironment returns entries with env vars', () => {
      const entriesWithEnv = getEntriesWithEnvironment();
      expect(entriesWithEnv.length).toBeGreaterThan(0);
      entriesWithEnv.forEach(entry => {
        expect(entry.serverConfig.env).toBeDefined();
        expect(Object.keys(entry.serverConfig.env!).length).toBeGreaterThan(0);
      });
    });

    test('getAutoStartEntries returns entries with autoStart true', () => {
      const autoStartEntries = getAutoStartEntries();
      expect(autoStartEntries.length).toBeGreaterThan(0);
      autoStartEntries.forEach(entry => {
        expect(entry.serverConfig.autoStart).toBe(true);
      });
    });

    test('createScenario can filter by verified status', () => {
      const verifiedScenario = createScenario({ verified: true });
      expect(verifiedScenario.servers.length).toBeGreaterThan(0);
      verifiedScenario.servers.forEach(server => {
        expect(server.verified).toBe(true);
      });

      const unverifiedScenario = createScenario({ verified: false });
      expect(unverifiedScenario.servers.length).toBeGreaterThan(0);
      unverifiedScenario.servers.forEach(server => {
        expect(server.verified).toBe(false);
      });
    });

    test('createScenario can filter by config type', () => {
      const httpScenario = createScenario({ configType: 'http' });
      expect(httpScenario.servers.length).toBeGreaterThan(0);
      httpScenario.servers.forEach(server => {
        expect(server.serverConfig.type).toBe('http');
      });
    });

    test('createScenario can combine multiple filters', () => {
      const filteredScenario = createScenario({
        verified: true,
        configType: 'stdio',
        hasEnvironment: true,
      });

      filteredScenario.servers.forEach(server => {
        expect(server.verified).toBe(true);
        expect(server.serverConfig.type).toBe('stdio');
        expect(server.serverConfig.env).toBeDefined();
        expect(Object.keys(server.serverConfig.env!).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Development vs Production Scenarios', () => {
    test('development marketplace contains unverified servers', () => {
      const unverifiedCount = developmentMarketplace.servers.filter(s => !s.verified).length;
      expect(unverifiedCount).toBeGreaterThan(0);
    });

    test('enterprise marketplace contains verified servers', () => {
      const verifiedCount = enterpriseMarketplace.servers.filter(s => s.verified).length;
      expect(verifiedCount).toBeGreaterThan(0);
    });

    test('multi-server marketplace contains mix of verified and unverified', () => {
      const verified = multiServerMarketplace.servers.filter(s => s.verified).length;
      const unverified = multiServerMarketplace.servers.filter(s => !s.verified).length;
      expect(verified).toBeGreaterThan(0);
      expect(unverified).toBeGreaterThan(0);
    });
  });

  describe('Version and State Variations', () => {
    test('deprecated entry is marked as deprecated in description', () => {
      expect(packageStates.deprecated.description).toContain('[DEPRECATED]');
      expect(packageStates.deprecated.verified).toBe(true); // Can be verified but deprecated
    });

    test('alpha entry has pre-release version', () => {
      expect(packageStates.alpha.version).toMatch(/alpha|beta|rc/);
      expect(packageStates.alpha.verified).toBe(false);
    });

    test('draft entry has development version', () => {
      expect(packageStates.draft.version).toContain('dev');
      expect(packageStates.draft.verified).toBe(false);
    });
  });
});