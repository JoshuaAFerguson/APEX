import { describe, it, expect } from 'vitest';
import {
  MCPToolsConfigSchema,
  MCPToolsConfig,
  MCPConfigSchema,
} from '../types.js';

/**
 * Comprehensive test suite for MCPToolsConfig schema (v0.5.0)
 * Tests validation, edge cases, and TypeScript type inference for MCP tools configuration
 *
 * MCPToolsConfig provides configuration for managing MCP tool discovery, caching,
 * access control, concurrency management, timeout handling, validation, and logging.
 */
describe('MCPToolsConfig Schema Tests', () => {
  describe('Valid configurations', () => {
    it('should accept minimal configuration with all defaults', () => {
      const minimalConfig = {};

      const result = MCPToolsConfigSchema.parse(minimalConfig);

      expect(result.autoDiscovery).toBe(true); // Default value
      expect(result.enableCaching).toBe(true); // Default value
      expect(result.maxConcurrentTools).toBe(10); // Default value
      expect(result.timeoutMs).toBe(30000); // Default value
      expect(result.enableValidation).toBe(true); // Default value
      expect(result.allowedTools).toEqual([]); // Default empty array
      expect(result.deniedTools).toEqual([]); // Default empty array
      expect(result.enableLogging).toBe(false); // Default value
    });

    it('should accept complete configuration with all fields', () => {
      const fullConfig = {
        autoDiscovery: false,
        enableCaching: false,
        maxConcurrentTools: 5,
        timeoutMs: 15000,
        enableValidation: false,
        allowedTools: ['filesystem', 'network', 'database'],
        deniedTools: ['dangerous-tool', 'deprecated-tool'],
        enableLogging: true,
      };

      const result = MCPToolsConfigSchema.parse(fullConfig);

      expect(result.autoDiscovery).toBe(false);
      expect(result.enableCaching).toBe(false);
      expect(result.maxConcurrentTools).toBe(5);
      expect(result.timeoutMs).toBe(15000);
      expect(result.enableValidation).toBe(false);
      expect(result.allowedTools).toEqual(['filesystem', 'network', 'database']);
      expect(result.deniedTools).toEqual(['dangerous-tool', 'deprecated-tool']);
      expect(result.enableLogging).toBe(true);
    });

    it('should handle autoDiscovery variations', () => {
      const autoDiscoveryVariations = [true, false];

      autoDiscoveryVariations.forEach(autoDiscovery => {
        const config = { autoDiscovery };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.autoDiscovery).toBe(autoDiscovery);
      });
    });

    it('should handle enableCaching variations', () => {
      const cachingVariations = [true, false];

      cachingVariations.forEach(enableCaching => {
        const config = { enableCaching };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.enableCaching).toBe(enableCaching);
      });
    });

    it('should handle maxConcurrentTools boundary values', () => {
      const concurrencyValues = [1, 5, 10, 50, 100];

      concurrencyValues.forEach(maxConcurrentTools => {
        const config = { maxConcurrentTools };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.maxConcurrentTools).toBe(maxConcurrentTools);
      });
    });

    it('should handle timeoutMs boundary values', () => {
      const timeoutValues = [1000, 5000, 30000, 60000, 300000];

      timeoutValues.forEach(timeoutMs => {
        const config = { timeoutMs };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.timeoutMs).toBe(timeoutMs);
      });
    });

    it('should handle enableValidation variations', () => {
      const validationVariations = [true, false];

      validationVariations.forEach(enableValidation => {
        const config = { enableValidation };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.enableValidation).toBe(enableValidation);
      });
    });

    it('should handle various allowedTools configurations', () => {
      const allowedToolsConfigs = [
        [],
        ['filesystem'],
        ['filesystem', 'network'],
        ['filesystem', 'network', 'database', 'api', 'storage'],
        ['tool-with-dashes', 'tool_with_underscores', 'toolWithCamelCase'],
        ['very-long-tool-name-that-might-be-used-in-some-scenarios'],
      ];

      allowedToolsConfigs.forEach(allowedTools => {
        const config = { allowedTools };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.allowedTools).toEqual(allowedTools);
      });
    });

    it('should handle various deniedTools configurations', () => {
      const deniedToolsConfigs = [
        [],
        ['deprecated-tool'],
        ['dangerous-tool', 'experimental-tool'],
        ['security-risk', 'performance-issue', 'unstable-feature'],
        ['tool-1', 'tool-2', 'tool-3', 'tool-4', 'tool-5'],
      ];

      deniedToolsConfigs.forEach(deniedTools => {
        const config = { deniedTools };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.deniedTools).toEqual(deniedTools);
      });
    });

    it('should handle enableLogging variations', () => {
      const loggingVariations = [true, false];

      loggingVariations.forEach(enableLogging => {
        const config = { enableLogging };
        const result = MCPToolsConfigSchema.parse(config);
        expect(result.enableLogging).toBe(enableLogging);
      });
    });

    it('should allow allowedTools and deniedTools to overlap (validation happens at runtime)', () => {
      const config = {
        allowedTools: ['filesystem', 'network', 'common-tool'],
        deniedTools: ['network', 'common-tool', 'deprecated-tool'],
      };

      const result = MCPToolsConfigSchema.parse(config);
      expect(result.allowedTools).toEqual(['filesystem', 'network', 'common-tool']);
      expect(result.deniedTools).toEqual(['network', 'common-tool', 'deprecated-tool']);
    });

    it('should handle mixed field configurations', () => {
      const mixedConfig = {
        autoDiscovery: true,
        enableCaching: false,
        maxConcurrentTools: 25,
        enableValidation: true,
        allowedTools: ['custom-tool-1', 'custom-tool-2'],
        enableLogging: true,
      };

      const result = MCPToolsConfigSchema.parse(mixedConfig);
      expect(result.autoDiscovery).toBe(true);
      expect(result.enableCaching).toBe(false);
      expect(result.maxConcurrentTools).toBe(25);
      expect(result.timeoutMs).toBe(30000); // Default value
      expect(result.enableValidation).toBe(true);
      expect(result.allowedTools).toEqual(['custom-tool-1', 'custom-tool-2']);
      expect(result.deniedTools).toEqual([]); // Default empty array
      expect(result.enableLogging).toBe(true);
    });
  });

  describe('Validation errors', () => {
    it('should reject invalid autoDiscovery values', () => {
      const invalidAutoDiscoveryValues = [
        'true',
        'false',
        1,
        0,
        {},
        [],
        null,
        undefined,
      ];

      invalidAutoDiscoveryValues.forEach(autoDiscovery => {
        const config = { autoDiscovery };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid enableCaching values', () => {
      const invalidCachingValues = [
        'true',
        'false',
        1,
        0,
        {},
        [],
        null,
        undefined,
      ];

      invalidCachingValues.forEach(enableCaching => {
        const config = { enableCaching };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid maxConcurrentTools values', () => {
      const invalidConcurrencyValues = [
        0, // Should be >= 1
        -1,
        -10,
        101, // Should be <= 100
        150,
        'ten',
        '10',
        3.14,
        {},
        [],
        null,
        undefined,
        true,
        false,
      ];

      invalidConcurrencyValues.forEach(maxConcurrentTools => {
        const config = { maxConcurrentTools };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid timeoutMs values', () => {
      const invalidTimeoutValues = [
        -1, // Should be >= 0
        -1000,
        -5000,
        600001, // Should be <= 600000 (10 minutes)
        700000,
        1000000,
        'thirty-thousand',
        '30000',
        30.5,
        {},
        [],
        null,
        undefined,
        true,
        false,
      ];

      invalidTimeoutValues.forEach(timeoutMs => {
        const config = { timeoutMs };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid enableValidation values', () => {
      const invalidValidationValues = [
        'true',
        'false',
        1,
        0,
        {},
        [],
        null,
        undefined,
      ];

      invalidValidationValues.forEach(enableValidation => {
        const config = { enableValidation };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid allowedTools values', () => {
      const invalidAllowedToolsValues = [
        'string-not-array',
        123,
        {},
        null,
        true,
        false,
        ['valid-tool', 123, 'invalid'], // Mixed types
        [{}], // Objects in array
        [null], // Null in array
        [true], // Boolean in array
        [''], // Empty string in array
        ['   '], // Whitespace-only string in array
      ];

      invalidAllowedToolsValues.forEach(allowedTools => {
        const config = { allowedTools };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid deniedTools values', () => {
      const invalidDeniedToolsValues = [
        'string-not-array',
        123,
        {},
        null,
        true,
        false,
        ['valid-tool', 123, 'invalid'], // Mixed types
        [{}], // Objects in array
        [null], // Null in array
        [false], // Boolean in array
        [''], // Empty string in array
        ['   '], // Whitespace-only string in array
      ];

      invalidDeniedToolsValues.forEach(deniedTools => {
        const config = { deniedTools };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid enableLogging values', () => {
      const invalidLoggingValues = [
        'true',
        'false',
        1,
        0,
        {},
        [],
        null,
        undefined,
      ];

      invalidLoggingValues.forEach(enableLogging => {
        const config = { enableLogging };
        expect(() => MCPToolsConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should provide correct TypeScript types', () => {
      const config = MCPToolsConfigSchema.parse({
        autoDiscovery: false,
        enableCaching: true,
        maxConcurrentTools: 15,
        timeoutMs: 45000,
        enableValidation: false,
        allowedTools: ['test-tool-1', 'test-tool-2'],
        deniedTools: ['forbidden-tool'],
        enableLogging: true,
      });

      // Type assertions to ensure TypeScript compilation
      const autoDiscovery: boolean = config.autoDiscovery;
      const enableCaching: boolean = config.enableCaching;
      const maxConcurrentTools: number = config.maxConcurrentTools;
      const timeoutMs: number = config.timeoutMs;
      const enableValidation: boolean = config.enableValidation;
      const allowedTools: string[] = config.allowedTools;
      const deniedTools: string[] = config.deniedTools;
      const enableLogging: boolean = config.enableLogging;

      expect(typeof autoDiscovery).toBe('boolean');
      expect(typeof enableCaching).toBe('boolean');
      expect(typeof maxConcurrentTools).toBe('number');
      expect(typeof timeoutMs).toBe('number');
      expect(typeof enableValidation).toBe('boolean');
      expect(Array.isArray(allowedTools)).toBe(true);
      expect(Array.isArray(deniedTools)).toBe(true);
      expect(typeof enableLogging).toBe('boolean');

      expect(autoDiscovery).toBe(false);
      expect(enableCaching).toBe(true);
      expect(maxConcurrentTools).toBe(15);
      expect(timeoutMs).toBe(45000);
      expect(enableValidation).toBe(false);
      expect(allowedTools).toEqual(['test-tool-1', 'test-tool-2']);
      expect(deniedTools).toEqual(['forbidden-tool']);
      expect(enableLogging).toBe(true);
    });

    it('should handle optional fields correctly in TypeScript', () => {
      const config: MCPToolsConfig = {
        autoDiscovery: true,
        enableCaching: false,
        maxConcurrentTools: 5,
        timeoutMs: 20000,
        enableValidation: true,
        allowedTools: [],
        deniedTools: [],
        enableLogging: false,
      };

      expect(config.autoDiscovery).toBe(true);
      expect(config.enableCaching).toBe(false);
      expect(config.maxConcurrentTools).toBe(5);
      expect(config.timeoutMs).toBe(20000);
      expect(config.enableValidation).toBe(true);
      expect(config.allowedTools).toEqual([]);
      expect(config.deniedTools).toEqual([]);
      expect(config.enableLogging).toBe(false);
    });
  });

  describe('Real-world configuration scenarios', () => {
    it('should handle development environment configuration', () => {
      const devConfig = {
        autoDiscovery: true,
        enableCaching: false, // Disable cache in development for fresh tool discovery
        maxConcurrentTools: 20, // Higher concurrency for development
        timeoutMs: 10000, // Shorter timeout for faster feedback
        enableValidation: false, // Disable validation for faster development
        allowedTools: [], // Allow all tools in development
        deniedTools: ['production-only-tool', 'sensitive-operation'],
        enableLogging: true, // Enable logging for debugging
      };

      const result = MCPToolsConfigSchema.parse(devConfig);

      expect(result.autoDiscovery).toBe(true);
      expect(result.enableCaching).toBe(false);
      expect(result.maxConcurrentTools).toBe(20);
      expect(result.timeoutMs).toBe(10000);
      expect(result.enableValidation).toBe(false);
      expect(result.allowedTools).toEqual([]);
      expect(result.deniedTools).toEqual(['production-only-tool', 'sensitive-operation']);
      expect(result.enableLogging).toBe(true);
    });

    it('should handle production environment configuration', () => {
      const prodConfig = {
        autoDiscovery: false, // Disable auto-discovery for security
        enableCaching: true, // Enable caching for performance
        maxConcurrentTools: 5, // Lower concurrency for stability
        timeoutMs: 60000, // Longer timeout for reliability
        enableValidation: true, // Enable validation for safety
        allowedTools: [
          'filesystem-read',
          'database-query',
          'api-call',
          'log-writer',
          'email-sender',
        ],
        deniedTools: [
          'filesystem-write',
          'filesystem-delete',
          'database-write',
          'system-command',
          'network-admin',
          'debug-tools',
        ],
        enableLogging: false, // Disable logging for performance
      };

      const result = MCPToolsConfigSchema.parse(prodConfig);

      expect(result.autoDiscovery).toBe(false);
      expect(result.enableCaching).toBe(true);
      expect(result.maxConcurrentTools).toBe(5);
      expect(result.timeoutMs).toBe(60000);
      expect(result.enableValidation).toBe(true);
      expect(result.allowedTools).toHaveLength(5);
      expect(result.allowedTools).toContain('filesystem-read');
      expect(result.deniedTools).toHaveLength(6);
      expect(result.deniedTools).toContain('filesystem-delete');
      expect(result.enableLogging).toBe(false);
    });

    it('should handle testing environment configuration', () => {
      const testConfig = {
        autoDiscovery: true, // Enable auto-discovery for comprehensive testing
        enableCaching: false, // Disable cache to ensure fresh tool state
        maxConcurrentTools: 1, // Single-threaded for deterministic testing
        timeoutMs: 5000, // Short timeout for fast test execution
        enableValidation: true, // Enable validation to catch issues
        allowedTools: [
          'test-filesystem',
          'test-database',
          'test-api',
          'mock-service',
        ],
        deniedTools: [
          'production-api',
          'real-email-sender',
          'external-service',
        ],
        enableLogging: true, // Enable logging for test debugging
      };

      const result = MCPToolsConfigSchema.parse(testConfig);

      expect(result.autoDiscovery).toBe(true);
      expect(result.enableCaching).toBe(false);
      expect(result.maxConcurrentTools).toBe(1);
      expect(result.timeoutMs).toBe(5000);
      expect(result.enableValidation).toBe(true);
      expect(result.allowedTools).toEqual([
        'test-filesystem',
        'test-database',
        'test-api',
        'mock-service',
      ]);
      expect(result.deniedTools).toEqual([
        'production-api',
        'real-email-sender',
        'external-service',
      ]);
      expect(result.enableLogging).toBe(true);
    });

    it('should handle high-performance scenario configuration', () => {
      const highPerfConfig = {
        autoDiscovery: false, // Disable auto-discovery to reduce overhead
        enableCaching: true, // Enable aggressive caching
        maxConcurrentTools: 50, // High concurrency for throughput
        timeoutMs: 120000, // Longer timeout for complex operations
        enableValidation: false, // Disable validation for speed
        allowedTools: [
          'high-perf-processor',
          'batch-operation',
          'parallel-task',
          'stream-processor',
          'bulk-data-handler',
        ],
        deniedTools: [
          'slow-operation',
          'debug-tool',
          'interactive-prompt',
        ],
        enableLogging: false, // Disable logging to reduce I/O overhead
      };

      const result = MCPToolsConfigSchema.parse(highPerfConfig);

      expect(result.autoDiscovery).toBe(false);
      expect(result.enableCaching).toBe(true);
      expect(result.maxConcurrentTools).toBe(50);
      expect(result.timeoutMs).toBe(120000);
      expect(result.enableValidation).toBe(false);
      expect(result.allowedTools).toContain('high-perf-processor');
      expect(result.deniedTools).toContain('slow-operation');
      expect(result.enableLogging).toBe(false);
    });

    it('should handle security-focused configuration', () => {
      const securityConfig = {
        autoDiscovery: false, // Disable auto-discovery for security
        enableCaching: false, // Disable caching to prevent data leakage
        maxConcurrentTools: 3, // Limit concurrency to reduce attack surface
        timeoutMs: 15000, // Shorter timeout to prevent resource exhaustion
        enableValidation: true, // Enable strict validation
        allowedTools: [
          'secure-reader',
          'audit-logger',
          'permission-checker',
        ],
        deniedTools: [
          'file-writer',
          'network-client',
          'system-command',
          'database-admin',
          'config-modifier',
          'user-impersonator',
        ],
        enableLogging: true, // Enable logging for security auditing
      };

      const result = MCPToolsConfigSchema.parse(securityConfig);

      expect(result.autoDiscovery).toBe(false);
      expect(result.enableCaching).toBe(false);
      expect(result.maxConcurrentTools).toBe(3);
      expect(result.timeoutMs).toBe(15000);
      expect(result.enableValidation).toBe(true);
      expect(result.allowedTools).toEqual([
        'secure-reader',
        'audit-logger',
        'permission-checker',
      ]);
      expect(result.deniedTools).toHaveLength(6);
      expect(result.deniedTools).toContain('system-command');
      expect(result.enableLogging).toBe(true);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle minimum valid values', () => {
      const minimalValidConfig = {
        maxConcurrentTools: 1, // Minimum
        timeoutMs: 0, // Minimum
      };

      const result = MCPToolsConfigSchema.parse(minimalValidConfig);
      expect(result.maxConcurrentTools).toBe(1);
      expect(result.timeoutMs).toBe(0);
    });

    it('should handle maximum valid values', () => {
      const maximalValidConfig = {
        maxConcurrentTools: 100, // Maximum
        timeoutMs: 600000, // Maximum (10 minutes)
      };

      const result = MCPToolsConfigSchema.parse(maximalValidConfig);
      expect(result.maxConcurrentTools).toBe(100);
      expect(result.timeoutMs).toBe(600000);
    });

    it('should handle special characters in tool names', () => {
      const specialCharsConfig = {
        allowedTools: [
          'tool-with-dashes',
          'tool_with_underscores',
          'tool.with.dots',
          'tool:with:colons',
          'tool/with/slashes',
          'tool@with@symbols',
          'tool#with#hashes',
        ],
        deniedTools: [
          'forbidden-tool!',
          'dangerous$tool',
          'risky%tool',
          'unsafe&tool',
        ],
      };

      const result = MCPToolsConfigSchema.parse(specialCharsConfig);
      expect(result.allowedTools).toContain('tool-with-dashes');
      expect(result.allowedTools).toContain('tool:with:colons');
      expect(result.deniedTools).toContain('forbidden-tool!');
      expect(result.deniedTools).toContain('dangerous$tool');
    });

    it('should handle Unicode characters in tool names', () => {
      const unicodeConfig = {
        allowedTools: [
          'инструмент-тест', // Russian
          '도구-테스트', // Korean
          '工具-测试', // Chinese
          'ツール-テスト', // Japanese
          'outil-émojis-🔧-⚙️', // French with emojis
        ],
        deniedTools: [
          'запрещённый-инструмент',
          '금지된-도구',
          '禁止的-工具',
        ],
      };

      const result = MCPToolsConfigSchema.parse(unicodeConfig);
      expect(result.allowedTools).toContain('инструмент-тест');
      expect(result.allowedTools).toContain('outil-émojis-🔧-⚙️');
      expect(result.deniedTools).toContain('запрещённый-инструмент');
    });

    it('should handle very long tool names', () => {
      const longToolName = 'very-long-tool-name-that-might-be-generated-programmatically-'.repeat(5);

      const longNamesConfig = {
        allowedTools: [longToolName],
        deniedTools: [`denied-${longToolName}`],
      };

      const result = MCPToolsConfigSchema.parse(longNamesConfig);
      expect(result.allowedTools[0]).toBe(longToolName);
      expect(result.deniedTools[0]).toBe(`denied-${longToolName}`);
    });

    it('should handle large numbers of tools', () => {
      const largeAllowedTools = Array.from({ length: 100 }, (_, i) => `allowed-tool-${i}`);
      const largeDeniedTools = Array.from({ length: 50 }, (_, i) => `denied-tool-${i}`);

      const largeConfig = {
        allowedTools: largeAllowedTools,
        deniedTools: largeDeniedTools,
      };

      const result = MCPToolsConfigSchema.parse(largeConfig);
      expect(result.allowedTools).toHaveLength(100);
      expect(result.deniedTools).toHaveLength(50);
      expect(result.allowedTools[99]).toBe('allowed-tool-99');
      expect(result.deniedTools[49]).toBe('denied-tool-49');
    });

    it('should handle empty arrays correctly', () => {
      const emptyArraysConfig = {
        allowedTools: [],
        deniedTools: [],
      };

      const result = MCPToolsConfigSchema.parse(emptyArraysConfig);
      expect(result.allowedTools).toEqual([]);
      expect(result.deniedTools).toEqual([]);
      expect(Array.isArray(result.allowedTools)).toBe(true);
      expect(Array.isArray(result.deniedTools)).toBe(true);
    });
  });

  describe('Integration with MCPConfig', () => {
    it('should work correctly as part of MCPConfig schema', () => {
      const mcpConfig = {
        enabled: true,
        servers: {
          'test-server': {
            name: 'Test Server',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
        },
        tools: {
          autoDiscovery: false,
          enableCaching: true,
          maxConcurrentTools: 15,
          timeoutMs: 45000,
          enableValidation: true,
          allowedTools: ['filesystem', 'api'],
          deniedTools: ['dangerous-operation'],
          enableLogging: false,
        },
      };

      const result = MCPConfigSchema.parse(mcpConfig);

      expect(result.tools?.autoDiscovery).toBe(false);
      expect(result.tools?.enableCaching).toBe(true);
      expect(result.tools?.maxConcurrentTools).toBe(15);
      expect(result.tools?.timeoutMs).toBe(45000);
      expect(result.tools?.enableValidation).toBe(true);
      expect(result.tools?.allowedTools).toEqual(['filesystem', 'api']);
      expect(result.tools?.deniedTools).toEqual(['dangerous-operation']);
      expect(result.tools?.enableLogging).toBe(false);
    });

    it('should be optional in MCPConfig', () => {
      const mcpConfigWithoutTools = {
        enabled: true,
        servers: {
          'test-server': {
            name: 'Test Server',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
        },
      };

      const result = MCPConfigSchema.parse(mcpConfigWithoutTools);
      expect(result.tools).toBeUndefined();
    });

    it('should maintain consistency across multiple parsing cycles', () => {
      const originalToolsConfig = {
        autoDiscovery: true,
        enableCaching: false,
        maxConcurrentTools: 7,
        timeoutMs: 25000,
        enableValidation: true,
        allowedTools: ['consistency-tool-1', 'consistency-tool-2'],
        deniedTools: ['inconsistent-tool'],
        enableLogging: true,
      };

      // Parse multiple times to ensure consistency
      let currentConfig = originalToolsConfig;
      for (let i = 0; i < 5; i++) {
        const parsed = MCPToolsConfigSchema.parse(currentConfig);
        expect(parsed.autoDiscovery).toBe(originalToolsConfig.autoDiscovery);
        expect(parsed.enableCaching).toBe(originalToolsConfig.enableCaching);
        expect(parsed.maxConcurrentTools).toBe(originalToolsConfig.maxConcurrentTools);
        expect(parsed.timeoutMs).toBe(originalToolsConfig.timeoutMs);
        expect(parsed.enableValidation).toBe(originalToolsConfig.enableValidation);
        expect(parsed.allowedTools).toEqual(originalToolsConfig.allowedTools);
        expect(parsed.deniedTools).toEqual(originalToolsConfig.deniedTools);
        expect(parsed.enableLogging).toBe(originalToolsConfig.enableLogging);
        currentConfig = parsed;
      }
    });
  });

  describe('Field interaction scenarios', () => {
    it('should handle disabled auto-discovery with allowed tools', () => {
      // When auto-discovery is disabled, allowed tools should still be respected
      const config = {
        autoDiscovery: false,
        allowedTools: ['manual-tool-1', 'manual-tool-2'],
      };

      const result = MCPToolsConfigSchema.parse(config);
      expect(result.autoDiscovery).toBe(false);
      expect(result.allowedTools).toEqual(['manual-tool-1', 'manual-tool-2']);
    });

    it('should handle enabled caching with validation disabled', () => {
      // Caching and validation are independent features
      const config = {
        enableCaching: true,
        enableValidation: false,
      };

      const result = MCPToolsConfigSchema.parse(config);
      expect(result.enableCaching).toBe(true);
      expect(result.enableValidation).toBe(false);
    });

    it('should handle high concurrency with short timeout', () => {
      // High concurrency with short timeout for fast-failing scenarios
      const config = {
        maxConcurrentTools: 100,
        timeoutMs: 1000,
      };

      const result = MCPToolsConfigSchema.parse(config);
      expect(result.maxConcurrentTools).toBe(100);
      expect(result.timeoutMs).toBe(1000);
    });

    it('should handle logging enabled with caching disabled', () => {
      // Logging enabled for debugging while caching disabled for fresh state
      const config = {
        enableCaching: false,
        enableLogging: true,
      };

      const result = MCPToolsConfigSchema.parse(config);
      expect(result.enableCaching).toBe(false);
      expect(result.enableLogging).toBe(true);
    });
  });
});