import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  MCPRegistry,
  MCPCatalogLoadError,
  MCPCatalogValidationError,
  MCPCatalogErrorCode,
  DEFAULT_EMPTY_CATALOG,
  type ValidationErrorDetail,
  type MCPCatalog,
  type MCPRegistryOptions,
} from '../mcp/mcp-registry.js';

// Mock fs to control file system operations
vi.mock('fs', () => {
  const readFileSyncMock = vi.fn();
  return {
    readFileSync: readFileSyncMock,
    default: { readFileSync: readFileSyncMock },
  };
});
const mockReadFileSync = vi.mocked(readFileSync);

describe('MCPRegistry Enhanced Error Handling', () => {
  beforeEach(() => {
    // Reset singleton before each test
    MCPRegistry.resetInstance();
    vi.clearAllMocks();

    // Reset console.warn mock
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    MCPRegistry.resetInstance();
    vi.restoreAllMocks();
  });

  describe('MCPCatalogLoadError Enhanced Features', () => {
    it('should include error codes and suggestions for file not found', () => {
      const notFoundError = new Error('ENOENT: no such file or directory');
      mockReadFileSync.mockImplementation(() => {
        throw notFoundError;
      });

      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/nonexistent/catalog.json' });
      }).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance({ catalogPath: '/nonexistent/catalog.json' });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_NOT_FOUND);
        expect(loadError.catalogPath).toBe('/nonexistent/catalog.json');
        expect(loadError.cause).toBe(notFoundError);
        expect(loadError.suggestions).toContain('Verify the catalog file exists at the specified path');
        expect(loadError.suggestions).toContain('Check file permissions (requires read access)');
        expect(loadError.suggestions).toContain("Run 'npm run build' to ensure catalog.json is copied to dist/");
      }
    });

    it('should include error codes and suggestions for JSON parse errors', () => {
      mockReadFileSync.mockReturnValue('{"invalid": json,}'); // Invalid JSON

      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      }).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
        expect(loadError.suggestions).toContain('Validate JSON syntax using a JSON validator (e.g., jsonlint.com)');
        expect(loadError.suggestions).toContain('Check for trailing commas after the last item in arrays/objects');
      }
    });

    it('should include error codes and suggestions for file read errors', () => {
      const readError = new Error('Permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw readError;
      });

      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      }).toThrow(MCPCatalogLoadError);

      try {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        expect(loadError.suggestions).toContain('Check file permissions (requires read access)');
        expect(loadError.suggestions).toContain('Verify the file is not corrupted or in use by another process');
      }
    });
  });

  describe('MCPCatalogValidationError Enhanced Features', () => {
    it('should provide detailed validation errors with server context', () => {
      const invalidCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            // Missing name and description
            serverConfig: { command: 'node' }
          },
          {
            name: 'valid-server',
            description: 'Valid server',
            serverConfig: { command: 'node' }
          },
          {
            name: '', // Empty name
            description: 'Server with empty name',
            // Missing serverConfig
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      }).toThrow(MCPCatalogValidationError);

      try {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;

        expect(validationError.validServers).toBe(1);
        expect(validationError.invalidServers).toBeGreaterThan(0);
        expect(validationError.details).toBeInstanceOf(Array);

        // Check for specific validation errors
        const errorFields = validationError.details.map(d => d.field);
        expect(errorFields).toContain('servers[0].name');
        expect(errorFields).toContain('servers[0].description');
        expect(errorFields).toContain('servers[2].name');
        expect(errorFields).toContain('servers[2].serverConfig');

        // Check for suggestions
        const nameError = validationError.details.find(d => d.field === 'servers[0].name');
        expect(nameError?.suggestion).toBe('Add a unique "name" field to identify the server');
      }
    });

    it('should format validation errors in a readable way', () => {
      const invalidCatalog = {
        servers: [
          {
            name: 'test',
            description: 'Test server',
            capabilities: 'should-be-array' // Wrong type
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

      try {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;
        const message = validationError.message;

        expect(message).toContain('validation failed');
        expect(message).toContain('[ERROR]');
        expect(message).toContain('Suggestion:');
      }
    });
  });

  describe('Fallback Mechanism', () => {
    it('should use empty catalog when fallbackOnError is true and file not found', () => {
      const notFoundError = new Error('ENOENT: no such file or directory');
      mockReadFileSync.mockImplementation(() => {
        throw notFoundError;
      });

      const onErrorSpy = vi.fn();
      const registry = MCPRegistry.getInstance({
        catalogPath: '/nonexistent/catalog.json',
        fallbackOnError: true,
        onError: onErrorSpy
      });

      expect(registry).toBeInstanceOf(MCPRegistry);
      expect(registry.size).toBe(0);
      expect(registry.getCatalogInfo().description).toContain('Default empty catalog');
      expect(onErrorSpy).toHaveBeenCalledWith(expect.any(MCPCatalogLoadError));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to empty catalog'));
    });

    it('should use empty catalog when fallbackOnError is true and JSON is invalid', () => {
      mockReadFileSync.mockReturnValue('invalid json');

      const registry = MCPRegistry.getInstance({
        catalogPath: '/test/catalog.json',
        fallbackOnError: true
      });

      expect(registry).toBeInstanceOf(MCPRegistry);
      expect(registry.size).toBe(0);
      expect(registry.getCatalogInfo().version).toBe('0.0.0');
    });

    it('should still throw when fallbackOnError is false (default)', () => {
      const notFoundError = new Error('ENOENT: no such file or directory');
      mockReadFileSync.mockImplementation(() => {
        throw notFoundError;
      });

      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/nonexistent/catalog.json' });
      }).toThrow(MCPCatalogLoadError);
    });
  });

  describe('Partial Server Loading', () => {
    it('should skip invalid servers when skipInvalidServers is true', () => {
      const mixedCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            name: 'valid-server',
            description: 'Valid server',
            serverConfig: { command: 'node' }
          },
          {
            // Invalid server - missing name
            description: 'Invalid server',
            serverConfig: { command: 'node' }
          },
          {
            name: 'another-valid',
            description: 'Another valid server',
            serverConfig: { command: 'python' }
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(mixedCatalog));

      const registry = MCPRegistry.getInstance({
        catalogPath: '/test/catalog.json',
        skipInvalidServers: true,
        warnOnValidationErrors: true
      });

      expect(registry.size).toBe(2); // Only valid servers
      expect(registry.hasServer('valid-server')).toBe(true);
      expect(registry.hasServer('another-valid')).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        '[MCPRegistry] Validation warnings:',
        expect.stringContaining('validation failed')
      );
    });

    it('should throw when skipInvalidServers is false and servers are invalid', () => {
      const mixedCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            name: 'valid-server',
            description: 'Valid server',
            serverConfig: { command: 'node' }
          },
          {
            // Invalid server - missing name
            description: 'Invalid server',
            serverConfig: { command: 'node' }
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(mixedCatalog));

      expect(() => {
        MCPRegistry.getInstance({
          catalogPath: '/test/catalog.json',
          skipInvalidServers: false // default
        });
      }).toThrow(MCPCatalogValidationError);
    });
  });

  describe('Async Loading Support', () => {
    it('should create registry asynchronously with createAsync', async () => {
      const validCatalog = {
        version: '1.0.0',
        categories: {},
        servers: []
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validCatalog));

      const registry = await MCPRegistry.createAsync({
        catalogPath: '/test/catalog.json'
      });

      expect(registry).toBeInstanceOf(MCPRegistry);
      expect(registry.getCatalogInfo().version).toBe('1.0.0');
    });

    it('should reject createAsync promise on error', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(MCPRegistry.createAsync({
        catalogPath: '/nonexistent/catalog.json'
      })).rejects.toThrow(MCPCatalogLoadError);
    });

    it('should return null from tryGetInstance on error', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const registry = MCPRegistry.tryGetInstance({
        catalogPath: '/nonexistent/catalog.json'
      });

      expect(registry).toBe(null);
    });

    it('should return registry from tryGetInstance on success', () => {
      const validCatalog = {
        version: '1.0.0',
        categories: {},
        servers: []
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validCatalog));

      const registry = MCPRegistry.tryGetInstance({
        catalogPath: '/test/catalog.json'
      });

      expect(registry).toBeInstanceOf(MCPRegistry);
    });
  });

  describe('DEFAULT_EMPTY_CATALOG', () => {
    it('should be frozen to prevent modification', () => {
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG.categories)).toBe(true);
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG.servers)).toBe(true);
    });

    it('should have sensible defaults', () => {
      expect(DEFAULT_EMPTY_CATALOG.version).toBe('0.0.0');
      expect(DEFAULT_EMPTY_CATALOG.description).toContain('Default empty catalog');
      expect(DEFAULT_EMPTY_CATALOG.servers).toHaveLength(0);
      expect(Object.keys(DEFAULT_EMPTY_CATALOG.categories)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty catalog file', () => {
      mockReadFileSync.mockReturnValue('{}');

      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      }).toThrow(MCPCatalogValidationError);

      // Should work with fallback
      const registry = MCPRegistry.getInstance({
        catalogPath: '/test/catalog.json',
        fallbackOnError: true
      });
      expect(registry.size).toBe(0);
    });

    it('should handle catalog with only invalid servers', () => {
      const invalidOnlyCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            // Missing everything
          },
          {
            name: '', // Empty name
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(invalidOnlyCatalog));

      // Should throw without skipInvalidServers
      expect(() => {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      }).toThrow(MCPCatalogValidationError);

      // Should work with skipInvalidServers
      const registry = MCPRegistry.getInstance({
        catalogPath: '/test/catalog.json',
        skipInvalidServers: true
      });
      expect(registry.size).toBe(0);
    });

    it('should handle deeply nested validation errors', () => {
      const complexInvalidCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            name: 'complex-server',
            description: 'Server with complex config issues',
            serverConfig: {
              // Missing command
              args: ['--arg1', '--arg2'],
              env: { NODE_ENV: 'test' }
            },
            capabilities: 'should-be-array'
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(complexInvalidCatalog));

      try {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;
        const errorFields = validationError.details.map(d => d.field);

        expect(errorFields).toContain('servers[0].serverConfig.command');
        expect(errorFields).toContain('servers[0].capabilities');

        const commandError = validationError.details.find(
          d => d.field === 'servers[0].serverConfig.command'
        );
        expect(commandError?.serverName).toBe('complex-server');
      }
    });

    it('should handle Unicode characters in error messages', () => {
      const unicodeCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            name: 'тест-сервер', // Cyrillic name
            description: 'Server with émojis 🚀 and spëcial chars',
            // Missing serverConfig
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(unicodeCatalog));

      try {
        MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;
        const serverConfigError = validationError.details.find(
          d => d.field === 'servers[0].serverConfig'
        );

        expect(serverConfigError?.serverName).toBe('тест-сервер');
        expect(serverConfigError?.suggestion).toContain('тест-сервер');
      }
    });
  });
});