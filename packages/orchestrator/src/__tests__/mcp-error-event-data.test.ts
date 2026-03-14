import { describe, it, expect } from 'vitest';
import { MCPErrorEventData } from '../index.js';

describe('MCPErrorEventData Interface Validation', () => {
  describe('structure compliance', () => {
    it('validates complete MCPErrorEventData structure matches acceptance criteria', () => {
      const completeErrorData: MCPErrorEventData = {
        // Core server identification
        serverId: 'test-server-123',
        serverName: 'Test MCP Server',

        // Error information
        error: 'Connection failed to MCP server',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        code: 'CONNECTION_FAILED',

        // Error categorization (acceptance criteria requirement)
        category: 'connection',

        // Recovery information (acceptance criteria requirement)
        recoverable: true,

        // Optional stack trace
        stack: 'Error: Connection failed\n    at MCPConnection.connect (mcp.js:45:10)',

        // Recovery guidance (acceptance criteria requirement)
        recovery: {
          canRetry: true,
          retryDelayMs: 5000,
          attempt: 1,
          maxAttempts: 3,
          suggestions: [
            'Check network connectivity',
            'Verify server configuration',
            'Restart MCP server if needed'
          ]
        },

        // Additional metadata for debugging
        metadata: {
          connectionType: 'stdio',
          protocolVersion: '2024-11-05',
          lastSuccessfulConnection: new Date('2024-01-15T10:25:00Z'),
          capabilities: ['logging', 'prompts', 'resources'],
          errorCount: 1
        }
      };

      // Verify all required properties exist and have correct types
      expect(typeof completeErrorData.serverId).toBe('string');
      expect(typeof completeErrorData.serverName).toBe('string');
      expect(typeof completeErrorData.error).toBe('string');
      expect(completeErrorData.timestamp).toBeInstanceOf(Date);

      // Optional properties
      expect(typeof completeErrorData.code).toBe('string');
      expect(typeof completeErrorData.stack).toBe('string');

      // Error categorization (acceptance criteria)
      expect(['connection', 'protocol', 'transport', 'timeout', 'auth', 'unknown']).toContain(
        completeErrorData.category
      );
      expect(typeof completeErrorData.recoverable).toBe('boolean');

      // Recovery information structure (acceptance criteria)
      expect(typeof completeErrorData.recovery).toBe('object');
      expect(typeof completeErrorData.recovery.canRetry).toBe('boolean');
      expect(Array.isArray(completeErrorData.recovery.suggestions)).toBe(true);

      // Metadata should be optional but if present, should be an object
      expect(typeof completeErrorData.metadata).toBe('object');
      expect(completeErrorData.metadata).not.toBeNull();
    });

    it('validates minimal required MCPErrorEventData structure', () => {
      const minimalErrorData: MCPErrorEventData = {
        serverId: 'minimal-server',
        serverName: 'Minimal Server',
        error: 'Basic error message',
        timestamp: new Date(),
        category: 'unknown',
        recoverable: false,
        recovery: {
          canRetry: false,
          suggestions: []
        }
      };

      // All properties should be valid even in minimal case
      expect(minimalErrorData.serverId).toBe('minimal-server');
      expect(minimalErrorData.serverName).toBe('Minimal Server');
      expect(minimalErrorData.error).toBe('Basic error message');
      expect(minimalErrorData.timestamp).toBeInstanceOf(Date);
      expect(minimalErrorData.category).toBe('unknown');
      expect(minimalErrorData.recoverable).toBe(false);
      expect(minimalErrorData.recovery.canRetry).toBe(false);
      expect(Array.isArray(minimalErrorData.recovery.suggestions)).toBe(true);
    });
  });

  describe('category validation', () => {
    it('supports all required error categories', () => {
      const validCategories: MCPErrorEventData['category'][] = [
        'connection',
        'protocol',
        'transport',
        'timeout',
        'auth',
        'unknown'
      ];

      validCategories.forEach(category => {
        const errorData: MCPErrorEventData = {
          serverId: 'category-test',
          serverName: 'Category Test Server',
          error: `Error of category ${category}`,
          timestamp: new Date(),
          category: category,
          recoverable: true,
          recovery: {
            canRetry: true,
            suggestions: [`Suggestion for ${category} error`]
          }
        };

        expect(errorData.category).toBe(category);
      });
    });
  });

  describe('recovery information validation', () => {
    it('validates recovery structure with all optional fields', () => {
      const errorDataWithFullRecovery: MCPErrorEventData = {
        serverId: 'recovery-test',
        serverName: 'Recovery Test Server',
        error: 'Error with complete recovery info',
        timestamp: new Date(),
        category: 'connection',
        recoverable: true,
        recovery: {
          canRetry: true,
          retryDelayMs: 10000,
          attempt: 2,
          maxAttempts: 5,
          suggestions: [
            'Check server status',
            'Verify network connection',
            'Update server configuration',
            'Contact system administrator'
          ]
        }
      };

      const recovery = errorDataWithFullRecovery.recovery;

      expect(typeof recovery.canRetry).toBe('boolean');
      expect(typeof recovery.retryDelayMs).toBe('number');
      expect(typeof recovery.attempt).toBe('number');
      expect(typeof recovery.maxAttempts).toBe('number');
      expect(Array.isArray(recovery.suggestions)).toBe(true);

      // Validate numeric values are reasonable
      expect(recovery.retryDelayMs).toBeGreaterThan(0);
      expect(recovery.attempt).toBeGreaterThan(0);
      expect(recovery.maxAttempts).toBeGreaterThan(0);
      expect(recovery.attempt).toBeLessThanOrEqual(recovery.maxAttempts!);
    });

    it('validates minimal recovery structure', () => {
      const errorDataWithMinimalRecovery: MCPErrorEventData = {
        serverId: 'minimal-recovery-test',
        serverName: 'Minimal Recovery Test',
        error: 'Error with minimal recovery info',
        timestamp: new Date(),
        category: 'unknown',
        recoverable: false,
        recovery: {
          canRetry: false,
          suggestions: []
        }
      };

      const recovery = errorDataWithMinimalRecovery.recovery;

      expect(recovery.canRetry).toBe(false);
      expect(Array.isArray(recovery.suggestions)).toBe(true);
      expect(recovery.suggestions).toHaveLength(0);
    });

    it('validates recovery suggestions are properly formatted', () => {
      const errorDataWithSuggestions: MCPErrorEventData = {
        serverId: 'suggestions-test',
        serverName: 'Suggestions Test Server',
        error: 'Error with formatted suggestions',
        timestamp: new Date(),
        category: 'protocol',
        recoverable: true,
        recovery: {
          canRetry: true,
          retryDelayMs: 5000,
          suggestions: [
            'Check MCP protocol version compatibility',
            'Verify server capabilities match client expectations',
            'Review server logs for protocol errors',
            'Update MCP client to latest version'
          ]
        }
      };

      const suggestions = errorDataWithSuggestions.recovery.suggestions;

      // All suggestions should be non-empty strings
      suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
        expect(suggestion.trim()).toBe(suggestion); // No leading/trailing whitespace
      });

      // Should have reasonable number of suggestions
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(10); // Reasonable upper limit
    });
  });

  describe('metadata validation', () => {
    it('supports various metadata types', () => {
      const errorDataWithMetadata: MCPErrorEventData = {
        serverId: 'metadata-test',
        serverName: 'Metadata Test Server',
        error: 'Error with rich metadata',
        timestamp: new Date(),
        category: 'transport',
        recoverable: true,
        recovery: {
          canRetry: true,
          suggestions: ['Check transport layer']
        },
        metadata: {
          // String metadata
          connectionType: 'stdio',
          protocolVersion: '2024-11-05',
          serverVersion: '1.2.3',

          // Number metadata
          errorCount: 5,
          connectionAttempts: 3,
          lastResponseTime: 1500,

          // Boolean metadata
          isRetryable: true,
          isTransient: false,

          // Date metadata
          lastSuccessfulConnection: new Date('2024-01-15T10:25:00Z'),
          firstErrorTime: new Date('2024-01-15T10:29:00Z'),

          // Array metadata
          capabilities: ['logging', 'prompts', 'resources'],
          previousErrors: ['TIMEOUT', 'CONNECTION_FAILED'],

          // Object metadata
          serverInfo: {
            name: 'Example MCP Server',
            vendor: 'Test Corp',
            environment: 'production'
          },

          // Nested structures
          diagnostics: {
            network: {
              latency: 250,
              bandwidth: '100Mbps'
            },
            system: {
              memory: '2GB',
              cpu: '45%'
            }
          }
        }
      };

      const metadata = errorDataWithMetadata.metadata!;

      // Verify different data types in metadata
      expect(typeof metadata.connectionType).toBe('string');
      expect(typeof metadata.errorCount).toBe('number');
      expect(typeof metadata.isRetryable).toBe('boolean');
      expect(metadata.lastSuccessfulConnection).toBeInstanceOf(Date);
      expect(Array.isArray(metadata.capabilities)).toBe(true);
      expect(typeof metadata.serverInfo).toBe('object');
    });

    it('handles undefined metadata gracefully', () => {
      const errorDataWithoutMetadata: MCPErrorEventData = {
        serverId: 'no-metadata-test',
        serverName: 'No Metadata Test Server',
        error: 'Error without metadata',
        timestamp: new Date(),
        category: 'unknown',
        recoverable: false,
        recovery: {
          canRetry: false,
          suggestions: []
        }
        // metadata is optional and not provided
      };

      // Should work fine without metadata
      expect(errorDataWithoutMetadata.serverId).toBe('no-metadata-test');
      expect(errorDataWithoutMetadata.metadata).toBeUndefined();
    });
  });

  describe('timestamp validation', () => {
    it('accepts valid Date objects', () => {
      const now = new Date();
      const pastDate = new Date('2024-01-15T10:30:00Z');
      const futureDate = new Date('2025-12-31T23:59:59Z');

      [now, pastDate, futureDate].forEach(timestamp => {
        const errorData: MCPErrorEventData = {
          serverId: 'timestamp-test',
          serverName: 'Timestamp Test',
          error: 'Timestamp validation test',
          timestamp: timestamp,
          category: 'unknown',
          recoverable: false,
          recovery: {
            canRetry: false,
            suggestions: []
          }
        };

        expect(errorData.timestamp).toBeInstanceOf(Date);
        expect(errorData.timestamp.getTime()).toBe(timestamp.getTime());
      });
    });
  });

  describe('string field validation', () => {
    it('handles various string lengths and characters', () => {
      const testCases = [
        {
          serverId: 'short',
          serverName: 'S',
          error: 'E'
        },
        {
          serverId: 'normal-length-server-id-123',
          serverName: 'Normal Length Server Name',
          error: 'This is a normal length error message that provides adequate detail'
        },
        {
          serverId: 'very-long-server-identifier-with-lots-of-characters-and-numbers-12345',
          serverName: 'Very Long Server Name That Includes Many Words And Details About The Server',
          error: 'This is an extremely long error message that contains a lot of detail about what went wrong during the MCP server operation and includes specific technical information that might be useful for debugging purposes'
        },
        {
          serverId: 'special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?',
          serverName: 'Server with "quotes" and \'apostrophes\'',
          error: 'Error with special characters: àáâãäå çèéêë ñ øùúûü'
        }
      ];

      testCases.forEach((testCase, index) => {
        const errorData: MCPErrorEventData = {
          ...testCase,
          timestamp: new Date(),
          category: 'unknown',
          recoverable: false,
          recovery: {
            canRetry: false,
            suggestions: []
          }
        };

        expect(typeof errorData.serverId).toBe('string');
        expect(typeof errorData.serverName).toBe('string');
        expect(typeof errorData.error).toBe('string');
        expect(errorData.serverId.length).toBeGreaterThan(0);
        expect(errorData.serverName.length).toBeGreaterThan(0);
        expect(errorData.error.length).toBeGreaterThan(0);
      });
    });
  });
});