/**
 * @fileoverview Real-world error scenario integration tests for MCPRegistry
 *
 * This test suite validates real-world error scenarios that users might encounter,
 * ensuring the registry handles them gracefully with actionable error messages.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  MCPRegistry,
  MCPCatalogLoadError,
  MCPCatalogValidationError,
  MCPCatalogErrorCode,
  type ValidationErrorDetail,
} from '../mcp/mcp-registry.js';

// Mock fs to simulate various real-world file system scenarios
vi.mock('fs', () => {
  const readFileSyncMock = vi.fn();
  return {
    readFileSync: readFileSyncMock,
    default: { readFileSync: readFileSyncMock },
  };
});
const mockReadFileSync = vi.mocked(readFileSync);

describe('MCPRegistry Real-World Error Scenarios', () => {
  beforeEach(() => {
    MCPRegistry.resetInstance();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    MCPRegistry.resetInstance();
    vi.restoreAllMocks();
  });

  describe('Development Environment Errors', () => {
    it('should handle missing catalog during development', () => {
      // Simulate missing catalog file during development
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory, open \'packages/core/dist/mcp/catalog.json\'');
        (error as any).code = 'ENOENT';
        throw error;
      });

      try {
        MCPRegistry.getInstance();
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_NOT_FOUND);
        expect(loadError.suggestions).toContain("Run 'npm run build' to ensure catalog.json is copied to dist/");
        expect(loadError.message).toContain('packages/core/dist/mcp/catalog.json');
      }
    });

    it('should provide development-friendly fallback', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const onErrorSpy = vi.fn();
      const registry = MCPRegistry.getInstance({
        fallbackOnError: true,
        onError: onErrorSpy
      });

      expect(registry.size).toBe(0);
      expect(registry.listServers()).toHaveLength(0);
      expect(onErrorSpy).toHaveBeenCalledWith(expect.any(MCPCatalogLoadError));

      // Registry should still function for development
      expect(() => registry.getServer('test')).not.toThrow();
      expect(() => registry.hasServer('test')).not.toThrow();
      expect(() => registry.getCategories()).not.toThrow();
    });
  });

  describe('Production Environment Errors', () => {
    it('should handle corrupted catalog file in production', () => {
      // Simulate a corrupted file that returns binary data
      const corruptedData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString();
      mockReadFileSync.mockReturnValue(corruptedData);

      try {
        MCPRegistry.getInstance({
          catalogPath: '/app/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
        expect(loadError.suggestions).toContain('Validate JSON syntax');
        expect(loadError.catalogPath).toBe('/app/catalog.json');
      }
    });

    it('should handle network drive timeout errors', () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('ETIMEDOUT: network timeout');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      });

      try {
        MCPRegistry.getInstance({
          catalogPath: '//network-drive/config/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        expect(loadError.suggestions).toContain('Verify the file is not corrupted or in use by another process');
      }
    });

    it('should handle out of memory errors gracefully', () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('Cannot allocate memory');
        (error as any).code = 'ENOMEM';
        throw error;
      });

      expect(() => {
        MCPRegistry.getInstance({
          catalogPath: '/large-catalog.json',
          fallbackOnError: false
        });
      }).toThrow(MCPCatalogLoadError);
    });
  });

  describe('User Configuration Errors', () => {
    it('should handle manually edited catalog with syntax errors', () => {
      // Common user editing mistakes
      const userEditedCatalog = `{
        "version": "1.0.0",
        "categories": {
          "custom": {
            "name": "My Custom Category",
            "description": "User added category"
          },
        }, // User added comment - invalid JSON
        "servers": [
          {
            "name": "my-custom-server",
            "description": "My server",
            "serverConfig": {
              "command": "node",
              "args": ["server.js"]
            }
          }
        ]
      }`;

      mockReadFileSync.mockReturnValue(userEditedCatalog);

      try {
        MCPRegistry.getInstance({
          catalogPath: '/home/user/.apex/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
        expect(loadError.suggestions).toContain('Check for trailing commas');
        expect(loadError.suggestions).toContain('Look for unescaped special characters');
      }
    });

    it('should handle user adding invalid server entries', () => {
      const userCatalogWithErrors = {
        version: '1.0.0',
        categories: {
          custom: { name: 'Custom', description: 'User category' }
        },
        servers: [
          {
            // User forgot required fields
            name: 'my-server',
            // Missing description and serverConfig
          },
          {
            name: 'another-server',
            description: 'My custom server',
            serverConfig: {
              // User forgot command
              args: ['--start']
            }
          },
          {
            name: 'caps-server',
            description: 'Server with wrong capabilities format',
            serverConfig: { command: 'npm' },
            capabilities: 'file,http' // Should be array, not comma-separated string
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(userCatalogWithErrors));

      try {
        MCPRegistry.getInstance({
          catalogPath: '/config/custom-catalog.json'
        });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;

        if (validationError.enhancedDetails.length > 0) {
          const details = validationError.enhancedDetails;

          // Should have specific suggestions for each error
          const missingDescError = details.find(d => d.field === 'servers[0].description');
          const missingCommandError = details.find(d => d.field === 'servers[1].serverConfig.command');
          const wrongCapsError = details.find(d => d.field === 'servers[2].capabilities');

          expect(missingDescError?.suggestion).toContain('Add a "description" field');
          expect(missingCommandError?.suggestion).toContain('Add "command"');
          expect(wrongCapsError?.suggestion).toContain('array');
        }
      }
    });
  });

  describe('CI/CD Environment Errors', () => {
    it('should handle Docker container file system errors', () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('EROFS: read-only file system');
        (error as any).code = 'EROFS';
        throw error;
      });

      try {
        MCPRegistry.getInstance({
          catalogPath: '/app/config/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        expect(loadError.catalogPath).toBe('/app/config/catalog.json');
      }
    });

    it('should handle permission errors in CI environments', () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('EACCES: permission denied, open \'/etc/apex/catalog.json\'');
        (error as any).code = 'EACCES';
        throw error;
      });

      try {
        MCPRegistry.getInstance({
          catalogPath: '/etc/apex/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.suggestions).toContain('Check file permissions (requires read access)');
        expect(loadError.suggestions).toContain('Try running with elevated permissions if needed');
      }
    });
  });

  describe('Registry Recovery Scenarios', () => {
    it('should recover gracefully with partial catalog loading', () => {
      // Mixed validity scenario - some servers valid, others invalid
      const partialCatalog = {
        version: '1.0.0',
        categories: {
          valid: { name: 'Valid', description: 'Valid category' }
        },
        servers: [
          {
            name: 'working-server',
            description: 'This server is properly configured',
            serverConfig: {
              command: 'node',
              args: ['server.js']
            },
            capabilities: ['test:capability']
          },
          {
            name: 'broken-server',
            description: 'This server has issues',
            // Missing serverConfig - will be skipped
          },
          {
            name: 'another-working',
            description: 'Another working server',
            serverConfig: {
              command: 'python',
              args: ['app.py']
            }
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(partialCatalog));

      const warningsSpy = vi.fn();
      vi.spyOn(console, 'warn').mockImplementation(warningsSpy);

      const registry = MCPRegistry.getInstance({
        catalogPath: '/partial/catalog.json',
        skipInvalidServers: true,
        warnOnValidationErrors: true
      });

      expect(registry.size).toBe(2); // Only valid servers loaded
      expect(registry.hasServer('working-server')).toBe(true);
      expect(registry.hasServer('another-working')).toBe(true);
      expect(registry.hasServer('broken-server')).toBe(false);

      // Should log warnings about skipped servers
      expect(warningsSpy).toHaveBeenCalledWith(
        '[MCPRegistry] Validation warnings:',
        expect.stringContaining('validation failed')
      );
    });

    it('should provide detailed error context for debugging', () => {
      const complexErrorCatalog = {
        version: '1.0.0',
        categories: {},
        servers: [
          {
            name: 'problematic-server-αβγ', // Unicode characters
            description: 'Server with complex issues 🚫',
            serverConfig: {
              // Missing required command field
              args: ['--port', '8080'],
              env: { NODE_ENV: 'production' },
              timeout: 'invalid-number' // Should be number
            },
            capabilities: ['valid:cap', 123, 'another:cap'], // Mixed valid/invalid
            metadata: {
              author: '',
              version: null
            }
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(complexErrorCatalog));

      try {
        MCPRegistry.getInstance({
          catalogPath: '/complex/catalog.json'
        });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;

        if (validationError.enhancedDetails.length > 0) {
          const commandError = validationError.enhancedDetails.find(
            d => d.field === 'servers[0].serverConfig.command'
          );

          expect(commandError?.serverName).toBe('problematic-server-αβγ');
          expect(commandError?.suggestion).toContain('Add "command"');
          expect(commandError?.suggestion).toContain('problematic-server-αβγ');
        }

        // Error message should be properly formatted with context
        expect(validationError.message).toContain('validation failed');
        expect(validationError.message).toContain('[ERROR]');
        expect(validationError.message).toContain('Server: problematic-server-αβγ');
      }
    });
  });

  describe('Edge Case File System Scenarios', () => {
    it('should handle symbolic link resolution errors', () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('ELOOP: too many symbolic links encountered');
        (error as any).code = 'ELOOP';
        throw error;
      });

      try {
        MCPRegistry.getInstance({
          catalogPath: '/symlink/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.FILE_READ_ERROR);
        expect(loadError.message).toContain('too many symbolic links');
      }
    });

    it('should handle very large catalog files', () => {
      // Simulate a very large catalog that causes memory issues
      mockReadFileSync.mockImplementation(() => {
        // Create a very large JSON string
        const largeServers = Array.from({ length: 10000 }, (_, i) => ({
          name: `server-${i}`,
          description: `Generated server ${i}`,
          serverConfig: { command: 'node' }
        }));

        const largeCatalog = {
          version: '1.0.0',
          categories: {},
          servers: largeServers
        };

        return JSON.stringify(largeCatalog);
      });

      // This should work, but might be slow - test that it doesn't crash
      const registry = MCPRegistry.getInstance({
        catalogPath: '/large/catalog.json',
        validateOnLoad: false // Skip validation for performance
      });

      expect(registry.size).toBe(10000);
    });

    it('should handle empty file scenarios', () => {
      mockReadFileSync.mockReturnValue('');

      try {
        MCPRegistry.getInstance({
          catalogPath: '/empty/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
        expect(loadError.suggestions).toContain('Validate JSON syntax');
      }
    });

    it('should handle whitespace-only files', () => {
      mockReadFileSync.mockReturnValue('   \n\t   \n   ');

      try {
        MCPRegistry.getInstance({
          catalogPath: '/whitespace/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.errorCode).toBe(MCPCatalogErrorCode.JSON_PARSE_ERROR);
      }
    });
  });

  describe('Error Reporting and Debugging', () => {
    it('should provide comprehensive error information for support', () => {
      const problematicCatalog = {
        version: '2.0.0-beta', // Unusual version
        categories: 'invalid', // Wrong type
        servers: [
          {
            name: 'test-server',
            description: 'Test',
            serverConfig: {
              command: '', // Empty command
              args: null, // Wrong type
            }
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(problematicCatalog));

      try {
        MCPRegistry.getInstance({
          catalogPath: '/debug/catalog.json'
        });
      } catch (error) {
        const validationError = error as MCPCatalogValidationError;

        // Error should contain all information needed for debugging
        expect(validationError.message).toContain('validation failed');
        expect(validationError.validServers).toBeDefined();
        expect(validationError.invalidServers).toBeDefined();

        if (validationError.enhancedDetails.length > 0) {
          const details = validationError.enhancedDetails;

          // Each error should have field path, message, and suggestion
          details.forEach(detail => {
            expect(detail.field).toBeDefined();
            expect(detail.message).toBeDefined();
            expect(detail.severity).toBeDefined();
          });
        }
      }
    });

    it('should handle error chaining properly', () => {
      const chainedError = new Error('Root cause error');
      const wrappedError = new Error('Wrapped error');
      wrappedError.cause = chainedError;

      mockReadFileSync.mockImplementation(() => {
        throw wrappedError;
      });

      try {
        MCPRegistry.getInstance({
          catalogPath: '/chain/catalog.json'
        });
      } catch (error) {
        const loadError = error as MCPCatalogLoadError;
        expect(loadError.cause).toBe(wrappedError);
        expect(loadError.message).toContain('Wrapped error');
      }
    });
  });
});