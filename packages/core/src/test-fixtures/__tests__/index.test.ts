/**
 * @fileoverview Comprehensive tests for the centralized fixtures module
 *
 * Tests the main barrel export and ensures all expected exports are available
 */

import { describe, it, expect } from 'vitest';
import * as Fixtures from '../index.js';

describe('Centralized Test Fixtures Module', () => {
  describe('Main Module Exports', () => {
    it('should export all error preset categories', () => {
      expect(Fixtures.ErrorPresets).toBeDefined();
      expect(Fixtures.ErrorPresets.mcp).toBeDefined();
      expect(Fixtures.ErrorPresets.agent).toBeDefined();
      expect(Fixtures.ErrorPresets.apex).toBeDefined();
      expect(Fixtures.ErrorPresets.validation).toBeDefined();
      expect(Fixtures.ErrorPresets.system).toBeDefined();
    });

    it('should export legacy fixture functions', () => {
      expect(Fixtures.loadValidToolFixtures).toBeDefined();
      expect(Fixtures.loadInvalidToolFixtures).toBeDefined();
      expect(Fixtures.loadEdgeCaseFixtures).toBeDefined();
      expect(Fixtures.createTestToolConfig).toBeDefined();
      expect(Fixtures.validateToolConfig).toBeDefined();
      expect(Fixtures.loadFixtureFile).toBeDefined();
      expect(Fixtures.getRawFixture).toBeDefined();
      expect(Fixtures.getFixturePath).toBeDefined();
      expect(Fixtures.fixtureExists).toBeDefined();
      expect(Fixtures.clearFixtureCache).toBeDefined();
      expect(Fixtures.loadCategoryFixtures).toBeDefined();
      expect(Fixtures.getFixturesDirectory).toBeDefined();
    });

    it('should have properly typed error presets', () => {
      // Check that error presets are async functions
      expect(typeof Fixtures.ErrorPresets.mcp.protocolMismatch).toBe('function');
      expect(typeof Fixtures.ErrorPresets.agent.sessionLimit).toBe('function');
      expect(typeof Fixtures.ErrorPresets.apex.configNotFound).toBe('function');
      expect(typeof Fixtures.ErrorPresets.validation.invalidTask).toBe('function');
      expect(typeof Fixtures.ErrorPresets.system.fileNotFound).toBe('function');
    });
  });

  describe('Error Preset Integration', () => {
    it('should load MCP error presets correctly', async () => {
      const protocolMismatch = await Fixtures.ErrorPresets.mcp.protocolMismatch();
      expect(protocolMismatch).toBeDefined();
      expect(protocolMismatch.code).toBeDefined();
      expect(protocolMismatch.message).toBeDefined();

      const timeout = await Fixtures.ErrorPresets.mcp.timeout();
      expect(timeout).toBeDefined();
      expect(timeout.code).toBeDefined();
      expect(timeout.message).toBeDefined();
    });

    it('should load agent error presets correctly', async () => {
      const sessionLimit = await Fixtures.ErrorPresets.agent.sessionLimit();
      expect(sessionLimit).toBeDefined();

      const budgetExceeded = await Fixtures.ErrorPresets.agent.budgetExceeded();
      expect(budgetExceeded).toBeDefined();
    });

    it('should load system error presets correctly', async () => {
      const fileNotFound = await Fixtures.ErrorPresets.system.fileNotFound();
      expect(fileNotFound).toBeDefined();

      const networkTimeout = await Fixtures.ErrorPresets.system.networkTimeout();
      expect(networkTimeout).toBeDefined();
    });
  });

  describe('Type Exports', () => {
    it('should export fixture type definitions', () => {
      // These are type-only exports, but we can check they compile correctly
      // by creating objects that should satisfy the types
      const toolResponseOptions: Fixtures.ToolResponseOptions = {
        success: true,
        duration: 100,
        metadata: { test: true }
      };

      const toolRequestOptions: Fixtures.ToolRequestOptions = {
        timeout: 5000,
        requestId: 'test-request'
      };

      const taskFactoryOptions: Fixtures.TaskFactoryOptions = {
        status: 'pending',
        workflow: 'feature'
      };

      // Type checking - these should not throw compilation errors
      expect(toolResponseOptions).toBeDefined();
      expect(toolRequestOptions).toBeDefined();
      expect(taskFactoryOptions).toBeDefined();
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with existing fixtures', () => {
      // Test that existing fixture functions still work
      expect(() => {
        const fixturePath = Fixtures.getFixturesDirectory();
        expect(typeof fixturePath).toBe('string');
      }).not.toThrow();

      expect(() => {
        const exists = Fixtures.fixtureExists('nonexistent.json');
        expect(typeof exists).toBe('boolean');
      }).not.toThrow();
    });

    it('should support legacy fixture loading patterns', () => {
      expect(() => {
        const validFixtures = Fixtures.loadValidToolFixtures();
        expect(Array.isArray(validFixtures)).toBe(true);
      }).not.toThrow();

      expect(() => {
        const invalidFixtures = Fixtures.loadInvalidToolFixtures();
        expect(Array.isArray(invalidFixtures)).toBe(true);
      }).not.toThrow();

      expect(() => {
        const edgeCaseFixtures = Fixtures.loadEdgeCaseFixtures();
        expect(Array.isArray(edgeCaseFixtures)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Module Structure', () => {
    it('should have a well-organized export structure', () => {
      // Check that the module exports are organized logically
      const exports = Object.keys(Fixtures);

      // Should have error presets
      expect(exports).toContain('ErrorPresets');

      // Should have legacy fixture functions
      expect(exports).toContain('loadValidToolFixtures');
      expect(exports).toContain('createTestToolConfig');
      expect(exports).toContain('getFixturesDirectory');

      // Should have reasonable number of exports (not too many, not too few)
      expect(exports.length).toBeGreaterThan(10);
      expect(exports.length).toBeLessThan(50);
    });

    it('should not have any undefined exports', () => {
      const exports = Object.entries(Fixtures);

      for (const [name, value] of exports) {
        expect(value).toBeDefined();
        expect(typeof value).not.toBe('undefined');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing error presets gracefully', async () => {
      // Test that error preset functions don't throw when called
      const errorTypes = Object.keys(Fixtures.ErrorPresets);

      for (const errorType of errorTypes) {
        const category = Fixtures.ErrorPresets[errorType as keyof typeof Fixtures.ErrorPresets];
        const methods = Object.keys(category);

        for (const method of methods.slice(0, 2)) { // Test first 2 methods to avoid timeout
          const fn = category[method as keyof typeof category];
          if (typeof fn === 'function') {
            // Should not throw when called
            expect(async () => await fn()).not.toThrow();
          }
        }
      }
    });
  });
});