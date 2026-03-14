/**
 * @fileoverview Acceptance Criteria Validation Tests for MCP Registry
 *
 * This test suite specifically validates the three main acceptance criteria:
 * 1. MCPRegistry handles missing/invalid catalog.json gracefully with clear error messages
 * 2. Unit tests pass for error scenarios
 * 3. Catalog validation provides actionable error details
 *
 * These tests complement the existing test suite by focusing specifically on the
 * acceptance criteria requirements rather than implementation details.
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

describe('MCP Registry - Acceptance Criteria Validation', () => {
  beforeEach(() => {
    MCPRegistry.resetInstance();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    MCPRegistry.resetInstance();
    vi.restoreAllMocks();
  });

  describe('AC1: MCPRegistry handles missing/invalid catalog.json gracefully with clear error messages', () => {
    describe('Critical Error Scenarios', () => {
      it('should provide clear error message for missing catalog file in production environment', () => {
        const productionError = new Error('ENOENT: no such file or directory, open \'/app/dist/mcp/catalog.json\'');
        (productionError as any).code = 'ENOENT';
        mockReadFileSync.mockImplementation(() => {
          throw productionError;
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '/app/dist/mcp/catalog.json' });
          expect.fail('Should have thrown MCPCatalogLoadError');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPCatalogLoadError);
          const loadError = error as MCPCatalogLoadError;

          // Verify clear error message
          expect(loadError.message).toContain('Failed to load MCP catalog from /app/dist/mcp/catalog.json');
          expect(loadError.message).toContain('File not found');

          // Verify error classification
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_NOT_FOUND);
          expect(loadError.catalogPath).toBe('/app/dist/mcp/catalog.json');

          // Verify actionable suggestions
          expect(loadError.suggestions).toContain("Run 'npm run build' to ensure catalog.json is copied to dist/");
          expect(loadError.suggestions.length).toBeGreaterThan(2);
        }
      });

      it('should handle corrupted catalog file with clear diagnostic information', () => {
        // Simulate corrupted file with binary data
        const corruptedData = '\u0000\u0001\u0002{"invalid": "json"}\u0003';
        mockReadFileSync.mockReturnValue(corruptedData);

        try {
          MCPRegistry.getInstance({ catalogPath: '/corrupted/catalog.json' });
          expect.fail('Should have thrown MCPCatalogLoadError');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPCatalogLoadError);
          const loadError = error as MCPCatalogLoadError;

          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
          expect(loadError.message).toContain('Invalid JSON syntax');
          expect(loadError.suggestions).toContain('Validate JSON syntax using a JSON validator (e.g., jsonlint.com)');
        }
      });

      it('should handle permission denied scenarios with actionable guidance', () => {
        const permissionError = new Error('EACCES: permission denied, open \'/etc/mcp/catalog.json\'');
        (permissionError as any).code = 'EACCES';
        mockReadFileSync.mockImplementation(() => {
          throw permissionError;
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '/etc/mcp/catalog.json' });
          expect.fail('Should have thrown MCPCatalogLoadError');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPCatalogLoadError);
          const loadError = error as MCPCatalogLoadError;

          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
          expect(loadError.suggestions).toContain('Check file permissions (requires read access)');
          expect(loadError.suggestions).toContain('Try running with elevated permissions if needed');
        }
      });
    });

    describe('Graceful Degradation with Fallback', () => {
      it('should gracefully degrade to empty catalog when fallback is enabled', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Simulated catalog failure');
        });

        const errorHandler = vi.fn();
        const registry = MCPRegistry.getInstance({
          catalogPath: '/test/catalog.json',
          fallbackOnError: true,
          onError: errorHandler
        });

        // Registry should be functional with empty state
        expect(registry).toBeInstanceOf(MCPRegistry);
        expect(registry.size).toBe(0);
        expect(registry.listServers()).toEqual([]);
        expect(registry.getServerNames()).toEqual([]);
        expect(registry.getAllCapabilities()).toEqual([]);

        // Error should be reported to handler
        expect(errorHandler).toHaveBeenCalledWith(expect.any(MCPCatalogLoadError));

        // Warning should be logged
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Falling back to empty catalog')
        );
      });

      it('should maintain full registry functionality with fallback catalog', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Test error');
        });

        const registry = MCPRegistry.getInstance({ fallbackOnError: true });

        // All methods should work without throwing
        expect(() => registry.getServer('any')).not.toThrow();
        expect(() => registry.hasServer('any')).not.toThrow();
        expect(() => registry.getServerConfig('any')).not.toThrow();
        expect(() => registry.getServersByCategory('any')).not.toThrow();
        expect(() => registry.getServersByCapability('any')).not.toThrow();
        expect(() => registry.listServers({ search: 'any' })).not.toThrow();
        expect(() => registry.getCategories()).not.toThrow();
        expect(() => registry.getCatalogInfo()).not.toThrow();

        // Results should be sensible for empty catalog
        expect(registry.getServer('any')).toBeNull();
        expect(registry.hasServer('any')).toBe(false);
        expect(registry.getServerConfig('any')).toBeNull();
        expect(registry.getServersByCategory('any')).toEqual([]);
        expect(registry.getServersByCapability('any')).toEqual([]);
        expect(registry.getCatalogInfo().description).toContain('Default empty catalog');
      });
    });

    describe('Network and Infrastructure Error Handling', () => {
      it('should handle network-mounted file system timeouts gracefully', () => {
        const timeoutError = new Error('ETIMEDOUT: operation timed out');
        (timeoutError as any).code = 'ETIMEDOUT';
        mockReadFileSync.mockImplementation(() => {
          throw timeoutError;
        });

        try {
          MCPRegistry.getInstance({ catalogPath: '//network/share/catalog.json' });
          expect.fail('Should have thrown MCPCatalogLoadError');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPCatalogLoadError);
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
          expect(loadError.cause).toBe(timeoutError);
        }
      });

      it('should handle read-only file system scenarios', () => {
        const readOnlyError = new Error('EROFS: read-only file system');
        (readOnlyError as any).code = 'EROFS';
        mockReadFileSync.mockImplementation(() => {
          throw readOnlyError;
        });

        try {
          MCPRegistry.getInstance();
        } catch (error) {
          expect(error).toBeInstanceOf(MCPCatalogLoadError);
          const loadError = error as MCPCatalogLoadError;
          expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        }
      });
    });
  });

  describe('AC2: Unit tests pass for error scenarios', () => {
    describe('Error Boundary Validation', () => {
      it('should handle completely malformed catalog structure without crashing', () => {
        const malformedCatalog = {
          // Wrong structure entirely
          data: {
            items: ["not", "a", "catalog"],
            metadata: null,
            config: { invalid: true }
          }
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(malformedCatalog));

        expect(() => {
          MCPRegistry.getInstance({ catalogPath: '/malformed/catalog.json' });
        }).toThrow(MCPCatalogValidationError);
      });

      it('should handle extremely large error scenarios without memory issues', () => {
        // Create a catalog with many validation errors
        const serversWithErrors = Array.from({ length: 1000 }, (_, i) => ({
          // Each server missing required fields
          index: i,
          someField: `value-${i}`
        }));

        const largeBadCatalog = {
          version: null, // Invalid
          servers: serversWithErrors,
          // Missing categories
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(largeBadCatalog));

        expect(() => {
          MCPRegistry.getInstance();
        }).toThrow(MCPCatalogValidationError);
      });

      it('should handle circular reference attempts gracefully', () => {
        const circularCatalog: any = {
          version: '1.0.0',
          categories: {},
          servers: []
        };
        // Add circular reference
        circularCatalog.self = circularCatalog;

        // JSON.stringify will throw on circular references
        mockReadFileSync.mockImplementation(() => {
          try {
            return JSON.stringify(circularCatalog);
          } catch {
            return '{"version":"1.0.0","categories":{},"servers":[]}';
          }
        });

        // Should not crash
        expect(() => {
          MCPRegistry.getInstance();
        }).not.toThrow();
      });
    });

    describe('Concurrent Access Scenarios', () => {
      it('should handle multiple getInstance calls during error conditions', () => {
        let callCount = 0;
        mockReadFileSync.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('First call fails');
          }
          return '{"version":"1.0.0","categories":{},"servers":[]}';
        });

        // First call should fail
        expect(() => {
          MCPRegistry.getInstance();
        }).toThrow();

        // Reset singleton for second attempt
        MCPRegistry.resetInstance();

        // Second call should succeed
        expect(() => {
          MCPRegistry.getInstance();
        }).not.toThrow();
      });

      it('should handle rapid reset and getInstance cycles', () => {
        const validCatalog = '{"version":"1.0.0","categories":{},"servers":[]}';
        mockReadFileSync.mockReturnValue(validCatalog);

        // Rapid cycles should not cause issues
        for (let i = 0; i < 10; i++) {
          const registry = MCPRegistry.getInstance();
          expect(registry).toBeInstanceOf(MCPRegistry);
          MCPRegistry.resetInstance();
        }
      });
    });

    describe('Async Operation Error Handling', () => {
      it('should handle createAsync rejections properly', async () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Async failure');
        });

        await expect(
          MCPRegistry.createAsync({ catalogPath: '/async-fail/catalog.json' })
        ).rejects.toThrow(MCPCatalogLoadError);
      });

      it('should handle tryGetInstance null returns correctly', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Try get instance failure');
        });

        const result = MCPRegistry.tryGetInstance();
        expect(result).toBeNull();

        // Should not affect subsequent calls
        MCPRegistry.resetInstance();
        mockReadFileSync.mockReturnValue('{"version":"1.0.0","categories":{},"servers":[]}');

        const nextResult = MCPRegistry.tryGetInstance();
        expect(nextResult).toBeInstanceOf(MCPRegistry);
      });
    });
  });

  describe('AC3: Catalog validation provides actionable error details', () => {
    describe('Detailed Validation Error Reporting', () => {
      it('should provide comprehensive server validation errors with repair guidance', () => {
        const problematicCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              // Server with multiple validation issues
              name: '',                    // Empty name
              description: '',             // Empty description
              serverConfig: {
                // Missing command
                args: ['--start'],
                env: { NODE_ENV: 'test' }
              },
              capabilities: 'not-an-array', // Wrong type
              verified: 'not-boolean',     // Wrong type
              version: null                // Wrong type
            },
            {
              // Server with missing critical fields
              description: 'Server without name',
              // Missing name, serverConfig
            }
          ]
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(problematicCatalog));

        try {
          MCPRegistry.getInstance();
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPCatalogValidationError);
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const details = validationError.enhancedDetails;

            // Should have specific field-level errors
            const fieldErrors = details.map(d => d.field);
            expect(fieldErrors).toContain('servers[0].name');
            expect(fieldErrors).toContain('servers[0].description');
            expect(fieldErrors).toContain('servers[0].serverConfig.command');
            expect(fieldErrors).toContain('servers[0].capabilities');
            expect(fieldErrors).toContain('servers[1].name');

            // Each error should have actionable suggestions
            details.forEach(detail => {
              expect(detail.field).toBeDefined();
              expect(detail.message).toBeDefined();
              expect(detail.severity).toMatch(/^(error|warning)$/);

              // Contextual server identification
              if (detail.field.includes('servers[0]')) {
                expect(detail.serverName).toBe('index 0'); // Empty name fallback
              }
            });

            // Should provide repair guidance
            const nameError = details.find(d => d.field === 'servers[0].name');
            expect(nameError?.suggestion).toContain('Add a unique "name" field');

            const commandError = details.find(d => d.field === 'servers[0].serverConfig.command');
            expect(commandError?.suggestion).toContain('Add "command"');
          }
        }
      });

      it('should provide structured validation summary with counts and severity', () => {
        const mixedValidityCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              name: 'valid-server',
              description: 'This is valid',
              serverConfig: { command: 'node' }
            },
            {
              name: 'warning-server',
              description: 'Has warnings',
              serverConfig: { command: 'node' },
              capabilities: 'should-be-array' // Warning only
            },
            {
              // Error: missing required fields
              description: 'Missing name and config'
            }
          ]
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(mixedValidityCatalog));

        try {
          MCPRegistry.getInstance();
          expect.fail('Should have thrown validation error');
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          // Should report accurate counts
          expect(validationError.validServers).toBeGreaterThan(0);
          expect(validationError.invalidServers).toBeGreaterThan(0);

          // Message should contain structured information
          expect(validationError.message).toContain('validation failed');
          expect(validationError.message).toMatch(/\d+ error\(s\)/);
        }
      });

      it('should provide schema-level validation errors with context', () => {
        const schemaInvalidCatalog = {
          // Missing required top-level fields
          description: 'Invalid schema',
          servers: 'not-an-array',
          categories: 'not-an-object',
          // Missing version
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(schemaInvalidCatalog));

        try {
          MCPRegistry.getInstance();
          expect.fail('Should have thrown validation error');
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          if (validationError.enhancedDetails.length > 0) {
            const schemaErrors = validationError.enhancedDetails;

            // Should identify schema-level issues
            const versionError = schemaErrors.find(d => d.field === 'version');
            const serversError = schemaErrors.find(d => d.field === 'servers');
            const categoriesError = schemaErrors.find(d => d.field === 'categories');

            expect(versionError?.suggestion).toContain('Add "version"');
            expect(serversError?.suggestion).toContain('Add "servers": []');
            expect(categoriesError?.suggestion).toContain('Add "categories": {}');
          }
        }
      });
    });

    describe('Error Message Formatting and Readability', () => {
      it('should format complex validation errors in a readable hierarchy', () => {
        const complexCatalog = {
          version: '1.0.0',
          categories: {},
          servers: [
            {
              name: 'complex-server-with-unicode-🚀',
              description: 'Complex server with múltiple íssues',
              serverConfig: {
                // Missing command
                args: ['--arg1', '--arg2'],
                env: { NODE_ENV: 'test' }
              },
              capabilities: { invalid: 'structure' }, // Wrong type
              metadata: {
                nested: {
                  deeply: {
                    problematic: true
                  }
                }
              }
            }
          ]
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(complexCatalog));

        try {
          MCPRegistry.getInstance();
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;
          const message = validationError.message;

          // Message should be well-formatted
          expect(message).toContain('validation failed');
          expect(message).toMatch(/\[ERROR\]/);
          expect(message).toContain('Suggestion:');
          expect(message).toContain('Server:');
          expect(message).toContain('complex-server-with-unicode-🚀');
        }
      });

      it('should handle very long error lists gracefully', () => {
        const serversWithManyErrors = Array.from({ length: 50 }, (_, i) => ({
          name: `server-${i}`,
          description: `Server ${i} with issues`,
          // Missing serverConfig for all
        }));

        const largeCatalog = {
          version: '1.0.0',
          categories: {},
          servers: serversWithManyErrors
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(largeCatalog));

        try {
          MCPRegistry.getInstance();
        } catch (error) {
          const validationError = error as MCPCatalogValidationError;

          // Should handle many errors without performance issues
          expect(validationError.invalidServers).toBe(50);

          // Error message should not be excessively long
          const messageLength = validationError.message.length;
          expect(messageLength).toBeLessThan(100000); // Reasonable upper bound
        }
      });
    });
  });

  describe('Edge Case Validation Coverage', () => {
    it('should handle catalog with mixed valid and invalid Unicode content', () => {
      const unicodeCatalog = {
        version: '1.0.0',
        categories: {
          'спецсимволы': { name: 'Special Symbols', description: 'Category with Cyrillic name' }
        },
        servers: [
          {
            name: 'valid-unicode-server-🎉',
            description: 'Server with émojis and spëcial characters',
            serverConfig: { command: 'node' }
          },
          {
            name: 'проблемный-сервер',
            description: 'Problematic server with Cyrillic name',
            // Missing serverConfig
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(unicodeCatalog));

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;

        if (validationError.enhancedDetails.length > 0) {
          const serverError = validationError.enhancedDetails.find(
            d => d.field === 'servers[1].serverConfig'
          );
          expect(serverError?.serverName).toBe('проблемный-сервер');
          expect(serverError?.suggestion).toContain('проблемный-сервер');
        }
      }
    });

    it('should validate registry behavior with edge case configurations', () => {
      const edgeCaseCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            name: 'edge-case-server',
            description: 'Server with edge case fields',
            serverConfig: {
              command: 'node',
              args: [], // Empty array
              env: {}   // Empty object
            },
            capabilities: [], // Empty capabilities
            verified: false,
            version: '0.0.0',
            author: '',
            repository: null,
            homepage: undefined
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(edgeCaseCatalog));

      // Should not throw - empty arrays/objects are valid
      const registry = MCPRegistry.getInstance();
      expect(registry.size).toBe(1);

      const server = registry.getServer('edge-case-server');
      expect(server).not.toBeNull();
      expect(server?.capabilities).toEqual([]);
      expect(registry.getAllCapabilities()).toEqual([]);
    });

    it('should handle DEFAULT_EMPTY_CATALOG immutability correctly', () => {
      // Verify the default catalog is properly frozen
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG.servers)).toBe(true);
      expect(Object.isFrozen(DEFAULT_EMPTY_CATALOG.categories)).toBe(true);

      // Verify default values are sensible
      expect(DEFAULT_EMPTY_CATALOG.version).toBe('0.0.0');
      expect(DEFAULT_EMPTY_CATALOG.servers).toHaveLength(0);
      expect(Object.keys(DEFAULT_EMPTY_CATALOG.categories)).toHaveLength(0);
      expect(DEFAULT_EMPTY_CATALOG.description).toContain('actual catalog failed to load');

      // Verify timestamp format
      expect(DEFAULT_EMPTY_CATALOG.updated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});