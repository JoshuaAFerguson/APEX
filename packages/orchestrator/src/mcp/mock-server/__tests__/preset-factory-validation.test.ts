/**
 * @fileoverview Basic Validation Tests for Preset Factory
 *
 * Quick validation tests to ensure the preset factory is working correctly.
 * These tests focus on basic functionality without complex async operations.
 */

import { describe, it, expect } from 'vitest';
import {
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  createMinimalMockServer,
} from '../preset-factory.js';
import { getAvailablePresets, isBehaviorModifier } from '../server-presets.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';

describe('Preset Factory Basic Validation', () => {
  describe('Factory Function Exports', () => {
    it('should export createMockMCPServer function', () => {
      expect(typeof createMockMCPServer).toBe('function');
      expect(createMockMCPServer.name).toBe('createMockMCPServer');
    });

    it('should export convenience functions', () => {
      expect(typeof createFileSystemMockServer).toBe('function');
      expect(typeof createDatabaseMockServer).toBe('function');
      expect(typeof createApiMockServer).toBe('function');
      expect(typeof createMinimalMockServer).toBe('function');
    });
  });

  describe('Preset System Validation', () => {
    it('should have all required presets available', () => {
      const presets = getAvailablePresets();

      // Should have 6 total presets (4 base + 2 behavior modifiers)
      expect(presets).toHaveLength(6);

      // Base presets
      expect(presets).toContain('filesystem');
      expect(presets).toContain('database');
      expect(presets).toContain('api');
      expect(presets).toContain('minimal');

      // Behavior modifiers
      expect(presets).toContain('error-prone');
      expect(presets).toContain('slow');
    });

    it('should correctly identify behavior modifiers', () => {
      // Base presets should not be behavior modifiers
      expect(isBehaviorModifier('filesystem')).toBe(false);
      expect(isBehaviorModifier('database')).toBe(false);
      expect(isBehaviorModifier('api')).toBe(false);
      expect(isBehaviorModifier('minimal')).toBe(false);

      // Behavior modifiers should be identified correctly
      expect(isBehaviorModifier('error-prone')).toBe(true);
      expect(isBehaviorModifier('slow')).toBe(true);
    });
  });

  describe('Basic Server Creation', () => {
    it('should create server instances for all base presets', () => {
      const filesystemServer = createMockMCPServer('filesystem');
      expect(filesystemServer).toBeInstanceOf(MockMCPServerFacade);

      const databaseServer = createMockMCPServer('database');
      expect(databaseServer).toBeInstanceOf(MockMCPServerFacade);

      const apiServer = createMockMCPServer('api');
      expect(apiServer).toBeInstanceOf(MockMCPServerFacade);

      const minimalServer = createMockMCPServer('minimal');
      expect(minimalServer).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should create server instances with behavior modifiers', () => {
      const slowServer = createMockMCPServer(['minimal', 'slow']);
      expect(slowServer).toBeInstanceOf(MockMCPServerFacade);

      const errorProneServer = createMockMCPServer(['minimal', 'error-prone']);
      expect(errorProneServer).toBeInstanceOf(MockMCPServerFacade);

      const combinedServer = createMockMCPServer(['minimal', 'slow', 'error-prone']);
      expect(combinedServer).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should create server instances with convenience functions', () => {
      const fsServer = createFileSystemMockServer();
      expect(fsServer).toBeInstanceOf(MockMCPServerFacade);

      const dbServer = createDatabaseMockServer();
      expect(dbServer).toBeInstanceOf(MockMCPServerFacade);

      const apiServer = createApiMockServer();
      expect(apiServer).toBeInstanceOf(MockMCPServerFacade);

      const minServer = createMinimalMockServer();
      expect(minServer).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('Configuration Override Validation', () => {
    it('should accept custom name override', () => {
      const server = createMockMCPServer('minimal', { name: 'custom-test-server' });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should accept additional tools', () => {
      const additionalTools = [
        {
          toolName: 'test_tool',
          response: {
            content: [{ type: 'text', text: 'test response' }],
            isError: false,
          },
          priority: 50,
        },
      ];

      const server = createMockMCPServer('minimal', { additionalTools });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should accept tool overrides', () => {
      const toolOverrides = {
        read_file: {
          response: {
            content: [{ type: 'text', text: 'overridden content' }],
            isError: false,
          },
        },
      };

      const server = createMockMCPServer('filesystem', { toolOverrides });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should accept delay configuration', () => {
      const server1 = createMockMCPServer('minimal', { delay: 100 });
      expect(server1).toBeInstanceOf(MockMCPServerFacade);

      const server2 = createMockMCPServer('minimal', { delay: { min: 50, max: 150 } });
      expect(server2).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should accept capabilities override', () => {
      const capabilities = {
        tools: { listChanged: true },
        resources: { subscribe: false },
      };

      const server = createMockMCPServer('minimal', { capabilities });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('Error Handling Validation', () => {
    it('should throw error for unknown preset', () => {
      expect(() => createMockMCPServer('unknown-preset' as any)).toThrow(
        'Unknown server preset: unknown-preset'
      );
    });

    it('should throw error for empty preset array', () => {
      expect(() => createMockMCPServer([])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });

    it('should throw error for multiple base presets', () => {
      expect(() => createMockMCPServer(['filesystem', 'database'])).toThrow(
        'Only one base preset can be specified'
      );
    });

    it('should throw error for behavior modifiers without base preset', () => {
      expect(() => createMockMCPServer(['error-prone', 'slow'])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });
  });
});