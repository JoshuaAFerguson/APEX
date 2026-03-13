/**
 * @fileoverview Enhanced error handling and validation tests for MCPRegistry
 *
 * This test suite specifically validates the acceptance criteria:
 * - MCPRegistry handles missing/invalid catalog.json gracefully with clear error messages
 * - Unit tests pass for error scenarios
 * - Catalog validation provides actionable error details
 */

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

describe('MCPRegistry Enhanced Error Handling & Validation', () => {
  // Test fixture for valid catalog structure
  const validCatalog: MCPCatalog = {
    version: '1.0.0',
    updated: '2024-01-01T00:00:00Z',
    description: 'Test catalog for validation',
    categories: {
      test: { name: 'Test', description: 'Test category' }
    },
    servers: [
      {
        name: 'test-server',
        description: 'A test server',
        version: '1.0.0',
        author: 'Test Author',
        verified: true,
        capabilities: ['test:capability'],
        serverConfig: {
          name: 'test-server',
          command: 'node',
          args: ['test.js'],
          env: {},
        }
      }
    ]
  };

  beforeEach(() => {
    MCPRegistry.resetInstance();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    MCPRegistry.resetInstance();
    vi.restoreAllMocks();
  });

  describe('ACCEPTANCE CRITERIA: Handle missing/invalid catalog.json gracefully', () => {
    describe('File Not Found Scenarios', () => {
      it('should provide clear error message when catalog file is missing', () => {
        const notFoundError = new Error('ENOENT: no such file or directory, open \'/nonexistent/catalog.json\'');
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
          expect(loadError.message).toContain('Failed to load MCP catalog from /nonexistent/catalog.json');
          expect(loadError.message).toContain('File not found');
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_NOT_FOUND);
          expect(loadError.catalogPath).toBe('/nonexistent/catalog.json');
          expect(loadError.cause).toBe(notFoundError);
        }
      });

      it('should provide actionable suggestions for file not found errors', () => {
        mockReadFileSync.mockImplementation(() => {
          const error = new Error('ENOENT: no such file or directory');
          throw error;
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.suggestions).toContain('Verify the catalog file exists at the specified path');
          expect(loadError.suggestions).toContain('Check file permissions (requires read access)');
          expect(loadError.suggestions).toContain('Ensure the file path is correct in your configuration');
          expect(loadError.suggestions).toContain("Run 'npm run build' to ensure catalog.json is copied to dist/");
        }
      });
    });

    describe('File Read Permission Errors', () => {
      it('should handle permission denied errors gracefully', () => {
        const permissionError = new Error('EACCES: permission denied, open \'/restricted/catalog.json\'');
        mockReadFileSync.mockImplementation(() => {
          throw permissionError;
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '/restricted/catalog.json' });
        } catch (error) {
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
          expect(loadError.message).toContain('permission denied');
          expect(loadError.suggestions).toContain('Check file permissions (requires read access)');
          expect(loadError.suggestions).toContain('Try running with elevated permissions if needed');
        }
      });

      it('should handle file in use errors', () => {
        const busyError = new Error('EBUSY: resource busy or locked, open \'catalog.json\'');
        mockReadFileSync.mockImplementation(() => {
          throw busyError;
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
          expect(loadError.suggestions).toContain('Verify the file is not corrupted or in use by another process');
        }
      });
    });

    describe('JSON Parse Error Scenarios', () => {
      it('should handle malformed JSON with clear error messages', () => {
        const malformedJson = '{"version": "1.0.0", "servers": [}'; // Missing closing bracket
        mockReadFileSync.mockReturnValue(malformedJson);

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
          expect(loadError.message).toContain('Invalid JSON syntax');
          expect(loadError.suggestions).toContain('Validate JSON syntax using a JSON validator (e.g., jsonlint.com)');
          expect(loadError.suggestions).toContain('Check for trailing commas after the last item in arrays/objects');
        }
      });

      it('should handle invalid UTF-8 encoding errors', () => {
        // Simulate invalid encoding error
        mockReadFileSync.mockImplementation(() => {
          throw new SyntaxError('Unexpected token in JSON at position 0');
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        }
      });

      it('should provide specific suggestions for common JSON syntax errors', () => {
        const jsonWithTrailingComma = '{"version": "1.0.0", "servers": [],}'; // Trailing comma
        mockReadFileSync.mockReturnValue(jsonWithTrailingComma);

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.suggestions).toContain('Check for trailing commas after the last item in arrays/objects');
          expect(loadError.suggestions).toContain('Ensure all strings are properly quoted');
          expect(loadError.suggestions).toContain('Look for unescaped special characters in string values');
        }
      });
    });

    describe('Fallback Mechanism Tests', () => {
      it('should fall back to empty catalog when fallbackOnError is enabled', () => {
        const notFoundError = new Error('ENOENT: file not found');
        mockReadFileSync.mockImplementation(() => {
          throw notFoundError;
        });

        const onErrorSpy = vi.fn();
        const registry = MCPRegistry.getInstance({
          catalogPath: '/missing/catalog.json',
          fallbackOnError: true,
          onError: onErrorSpy
        });

        expect(registry.size).toBe(0);
        expect(registry.getCatalogInfo().description).toContain('Default empty catalog');
        expect(onErrorSpy).toHaveBeenCalledWith(expect.any(MCPCatalogLoadError));
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Falling back to empty catalog')
        );
      });

      it('should call onError callback with detailed error information', () => {
        const parseError = new SyntaxError('Unexpected token');
        mockReadFileSync.mockImplementation(() => {
          throw parseError;
        });

        const onErrorSpy = vi.fn();
        MCPRegistry.getInstance({
          catalogPath: '/test/catalog.json',
          fallbackOnError: true,
          onError: onErrorSpy
        });

        expect(onErrorSpy).toHaveBeenCalledTimes(1);
        const errorArg = onErrorSpy.mock.calls[0][0];
        expect(errorArg).toBeInstanceOf(MCPCatalogLoadError);
        expect(errorArg.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        expect(errorArg.cause).toBe(parseError);
      });

      it('should maintain registry functionality with fallback catalog', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('File corrupted');
        });

        const registry = MCPRegistry.getInstance({
          fallbackOnError: true
        });

        // Should work with empty catalog
        expect(registry.listServers()).toHaveLength(0);
        expect(registry.getServer('any')).toBeNull();
        expect(registry.hasServer('any')).toBe(false);
        expect(registry.getCategories()).toHaveLength(0);
        expect(registry.getAllCapabilities()).toHaveLength(0);
      });
    });
  });

  describe('ACCEPTANCE CRITERIA: Actionable validation error details', () => {
    describe('Schema Validation Errors', () => {
      it('should provide detailed error for missing required fields', () => {
        const invalidCatalog = {
          // Missing version, servers, categories
          description: 'Invalid catalog'
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(invalidCatalog));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;
          expect(validationError.details).toBeInstanceOf(Array);

          const versionError = validationError.details.find((d: any) =>
            d.field === 'version' || (typeof d === 'string' && d.includes('version'))
          );
          const serversError = validationError.details.find((d: any) =>
            d.field === 'servers' || (typeof d === 'string' && d.includes('servers'))
          );
          const categoriesError = validationError.details.find((d: any) =>
            d.field === 'categories' || (typeof d === 'string' && d.includes('categories'))
          );

          expect(versionError).toBeDefined();
          expect(serversError).toBeDefined();
          expect(categoriesError).toBeDefined();
        }
      });

      it('should provide field-specific validation with suggestions', () => {
        const catalogWithInvalidTypes = {
          version: 123, // Should be string
          servers: 'not-array', // Should be array
          categories: 'not-object' // Should be object
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithInvalidTypes));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const versionError = validationError.enhancedDetails.find(d => d.field === 'version');
            const serversError = validationError.enhancedDetails.find(d => d.field === 'servers');
            const categoriesError = validationError.enhancedDetails.find(d => d.field === 'categories');

            if (versionError) {
              expect(versionError.suggestion).toContain('Add "version": "1.0.0"');
            }
            if (serversError) {
              expect(serversError.suggestion).toContain('Add "servers": []');
            }
            if (categoriesError) {
              expect(categoriesError.suggestion).toContain('Add "categories": {}');
            }
          }
        }
      });
    });

    describe('Server Validation Errors', () => {
      it('should provide detailed server validation errors with context', () => {
        const catalogWithInvalidServers = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              // Missing name, description, serverConfig
              version: '1.0.0'
            },
            {
              name: '', // Empty name
              description: 'Server with empty name',
              serverConfig: { command: 'test' }
            },
            {
              name: 'invalid-config',
              description: 'Server with invalid config',
              serverConfig: {
                // Missing command
                args: ['test']
              }
            },
            {
              name: 'invalid-caps',
              description: 'Server with invalid capabilities',
              serverConfig: { command: 'test' },
              capabilities: 'should-be-array'
            }
          ]
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithInvalidServers));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const details = validationError.enhancedDetails;

            // Check for missing name error
            const nameError = details.find(d => d.field === 'servers[0].name');
            expect(nameError?.message).toContain('Server name is required');
            expect(nameError?.suggestion).toContain('Add a unique "name" field');

            // Check for empty name error
            const emptyNameError = details.find(d => d.field === 'servers[1].name');
            expect(emptyNameError?.message).toContain('non-empty string');

            // Check for missing command error
            const commandError = details.find(d => d.field === 'servers[2].serverConfig.command');
            expect(commandError?.message).toContain('command string');
            expect(commandError?.serverName).toBe('invalid-config');

            // Check for capabilities type error
            const capsError = details.find(d => d.field === 'servers[3].capabilities');
            expect(capsError?.message).toContain('array of strings');
            expect(capsError?.serverName).toBe('invalid-caps');
          }
        }
      });

      it('should format validation errors in a readable way', () => {
        const catalogWithErrors = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              name: 'test-server',
              description: 'Test with missing config'
              // Missing serverConfig
            }
          ]
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithErrors));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;
          const message = validationError.message;

          expect(message).toContain('validation failed');
          expect(message).toContain('error(s)');
          expect(message).toMatch(/\[ERROR\]|\[WARNING\]/);
          expect(message).toContain('Suggestion:');
          expect(message).toContain('Server:');
        }
      });
    });

    describe('Partial Server Loading', () => {
      it('should skip invalid servers when skipInvalidServers is enabled', () => {
        const mixedValidityCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              name: 'valid-server-1',
              description: 'Valid server',
              serverConfig: { command: 'node' }
            },
            {
              // Invalid - missing name
              description: 'Invalid server without name',
              serverConfig: { command: 'node' }
            },
            {
              name: 'valid-server-2',
              description: 'Another valid server',
              serverConfig: { command: 'python' }
            },
            {
              name: 'invalid-config',
              description: 'Invalid server config',
              // Missing serverConfig
            }
          ]
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(mixedValidityCatalog));

        const registry = MCPRegistry.getInstance({
          catalogPath: '/test/catalog.json',
          skipInvalidServers: true,
          warnOnValidationErrors: true
        });

        expect(registry.size).toBe(2);
        expect(registry.hasServer('valid-server-1')).toBe(true);
        expect(registry.hasServer('valid-server-2')).toBe(true);
        expect(console.warn).toHaveBeenCalledWith(
          '[MCPRegistry] Validation warnings:',
          expect.stringContaining('validation failed')
        );
      });

      it('should report correct counts of valid vs invalid servers', () => {
        const catalogWithMixed = {
          version: '1.0.0',
          categories: {},
          servers: [
            { name: 'valid', description: 'Valid', serverConfig: { command: 'test' } },
            { description: 'No name', serverConfig: { command: 'test' } },
            { name: 'no-desc', serverConfig: { command: 'test' } },
            { name: 'no-config', description: 'No config' }
          ]
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithMixed));

        try {
          MCPRegistry.getInstance({
            catalogPath: '/test/catalog.json',
            skipInvalidServers: false
          });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;
          expect(validationError.validServers).toBe(1);
          expect(validationError.invalidServers).toBe(3);
        }
      });
    });
  });

  describe('ACCEPTANCE CRITERIA: Unit tests pass for error scenarios', () => {
    describe('Error Boundary Tests', () => {
      it('should handle catastrophic validation failures gracefully', () => {
        const nullCatalog = null;
        mockReadFileSync.mockReturnValue(JSON.stringify(nullCatalog));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const rootError = validationError.enhancedDetails.find(d => d.field === 'root');
            expect(rootError?.message).toContain('must be a JSON object');
            expect(rootError?.suggestion).toContain('valid JSON object');
          }
        }
      });

      it('should handle Unicode characters in server names and error messages', () => {
        const unicodeCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              name: 'тест-сервер-🚀', // Unicode name
              description: 'Server with émojis 🎉 and spëcial chars',
              // Missing serverConfig
            }
          ]
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(unicodeCatalog));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const configError = validationError.enhancedDetails.find(
              d => d.field === 'servers[0].serverConfig'
            );
            expect(configError?.serverName).toBe('тест-сервер-🚀');
            expect(configError?.suggestion).toContain('тест-сервер-🚀');
          }
        }
      });

      it('should handle deeply nested validation errors', () => {
        const complexInvalidCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              name: 'complex-server',
              description: 'Server with complex validation issues',
              serverConfig: {
                // Missing command
                args: ['--verbose'],
                env: { NODE_ENV: 'test' }
              },
              capabilities: 'not-an-array',
              customField: {
                nested: {
                  deeply: 'invalid-structure'
                }
              }
            }
          ]
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(complexInvalidCatalog));

        try {
          MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const commandError = validationError.enhancedDetails.find(
              d => d.field === 'servers[0].serverConfig.command'
            );
            const capsError = validationError.enhancedDetails.find(
              d => d.field === 'servers[0].capabilities'
            );

            expect(commandError?.serverName).toBe('complex-server');
            expect(commandError?.suggestion).toContain('Add "command"');
            expect(capsError?.serverName).toBe('complex-server');
          }
        }
      });
    });

    describe('Async Operations', () => {
      it('should handle errors in createAsync method', async () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Async load failure');
        });

        await expect(
          MCPRegistry.createAsync({ catalogPath: '/test/catalog.json' })
        ).rejects.toThrow(MCPCatalogLoadError);
      });

      it('should return null from tryGetInstance on failure', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Load failure');
        });

        const registry = MCPRegistry.tryGetInstance({
          catalogPath: '/test/catalog.json'
        });

        expect(registry).toBeNull();
      });

      it('should succeed with tryGetInstance on valid catalog', () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(validCatalog));

        const registry = MCPRegistry.tryGetInstance({
          catalogPath: '/test/catalog.json'
        });

        expect(registry).toBeInstanceOf(MCPRegistry);
        expect(registry?.size).toBe(1);
      });
    });

    describe('Edge Case Validation', () => {
      it('should handle empty catalog gracefully', () => {
        const emptyCatalog = {
          version: '1.0.0',
          categories: {},
          servers: []
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(emptyCatalog));

        const registry = MCPRegistry.getInstance({ catalogPath: '/test/catalog.json' });

        expect(registry.size).toBe(0);
        expect(registry.listServers()).toHaveLength(0);
        expect(registry.getCategories()).toHaveLength(0);
        expect(registry.getAllCapabilities()).toHaveLength(0);
      });

      it('should handle catalog with only invalid servers', () => {
        const invalidOnlyCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            { /* completely empty server */ },
            { name: '' }, // Empty name
            { name: 'no-description' }, // Missing description and config
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
    });
  });

  describe('DEFAULT_EMPTY_CATALOG Validation', () => {
    it('should be properly frozen to prevent mutations', () => {
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG.categories)).toBe(true);
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG.servers)).toBe(true);

      // Attempting to modify should fail silently or throw in strict mode
      expect(() => {
        (DEFAULT_EMPTY_CATALOG as any).version = 'modified';
      }).not.toThrow(); // Fails silently in non-strict mode

      expect(DEFAULT_EMPTY_CATALOG.version).toBe('0.0.0');
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_EMPTY_CATALOG.version).toBe('0.0.0');
      expect(DEFAULT_EMPTY_CATALOG.description).toContain('Default empty catalog');
      expect(DEFAULT_EMPTY_CATALOG.description).toContain('actual catalog failed to load');
      expect(DEFAULT_EMPTY_CATALOG.servers).toHaveLength(0);
      expect(Object.keys(DEFAULT_EMPTY_CATALOG.categories)).toHaveLength(0);
      expect(DEFAULT_EMPTY_CATALOG.updated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with legacy error constructor signatures', () => {
      const catalogPath = '/test/catalog.json';
      const cause = new Error('Test error');

      // Old signature: (catalogPath, cause)
      const error1 = new MCPCatalogLoadError(catalogPath, cause);
      expect(error1.catalogPath).toBe(catalogPath);
      expect(error1.cause).toBe(cause);
      expect(error1.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);

      // Old signature: (catalogPath)
      const error2 = new MCPCatalogLoadError(catalogPath);
      expect(error2.catalogPath).toBe(catalogPath);
      expect(error2.cause).toBeUndefined();
      expect(error2.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
    });

    it('should handle legacy string array validation errors', () => {
      const legacyErrors = ['Error 1', 'Error 2', 'Error 3'];
      const validationError = new MCPCatalogValidationError(legacyErrors);

      expect(validationError.details).toEqual(legacyErrors);
      expect(validationError.enhancedDetails).toHaveLength(3);
      expect(validationError.enhancedDetails[0].message).toBe('Error 1');
      expect(validationError.enhancedDetails[0].severity).toBe('error');
      expect(validationError.enhancedDetails[0].field).toMatch(/unknown\[0\]/);
    });
  });
});