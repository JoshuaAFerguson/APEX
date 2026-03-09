/**
 * Test suite for the APEX REPL config command functionality
 * Verifies the handleConfig function in REPL mode supports:
 * - Viewing full configuration
 * - Getting nested values with dot notation
 * - Setting values with JSON parsing
 * - Helper functions getConfigValue and setConfigValue
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock saveConfig function
const mockSaveConfig = vi.fn().mockResolvedValue(undefined);

// Mock the core config functions
vi.mock('@apexcli/core', () => ({
  saveConfig: mockSaveConfig,
  ApexConfig: {},
}));

// Import types we need for testing
interface ApexConfig {
  project?: {
    name?: string;
    description?: string;
  };
  version?: string;
  autonomy?: {
    level?: string;
  };
  models?: {
    planning?: string;
    implementation?: string;
  };
  limits?: {
    maxCostPerTask?: number;
  };
  [key: string]: any;
}

interface MockApp {
  addMessage: ReturnType<typeof vi.fn>;
  updateState: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
}

interface MockContext {
  initialized: boolean;
  config: ApexConfig | null;
  app: MockApp | null;
  cwd: string;
}

// Helper functions from REPL - replicated for testing
function getConfigValue(config: ApexConfig, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function setConfigValue(config: ApexConfig, key: string, value: string): void {
  const parts = key.split('.');
  let current: Record<string, unknown> = config as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  // Try to parse as JSON, otherwise use as string
  try {
    current[parts[parts.length - 1]] = JSON.parse(value);
  } catch {
    current[parts[parts.length - 1]] = value;
  }
}

describe('APEX REPL Config Command', () => {
  let mockApp: MockApp;
  let mockContext: MockContext;
  let originalContext: MockContext;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock app instance
    mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
      getState: vi.fn(),
    };

    // Mock context
    mockContext = {
      initialized: true,
      config: {
        project: {
          name: 'test-project',
          description: 'A test project',
        },
        version: '0.6.0',
        autonomy: {
          level: 'review-before-commit',
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
        },
        limits: {
          maxCostPerTask: 10.0,
        },
      },
      app: mockApp,
      cwd: '/test/project',
    };

    // Store original context for restoration
    originalContext = JSON.parse(JSON.stringify(mockContext));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Helper Functions', () => {
    describe('getConfigValue', () => {
      it('should get top-level config values', () => {
        const config = { version: '0.6.0' };
        const result = getConfigValue(config, 'version');
        expect(result).toBe('0.6.0');
      });

      it('should get nested config values using dot notation', () => {
        const config = {
          project: {
            name: 'test-project',
            description: 'A test project',
          },
        };

        expect(getConfigValue(config, 'project.name')).toBe('test-project');
        expect(getConfigValue(config, 'project.description')).toBe('A test project');
      });

      it('should get deeply nested values', () => {
        const config = {
          models: {
            deployment: {
              production: {
                primary: 'opus',
              },
            },
          },
        };

        expect(getConfigValue(config, 'models.deployment.production.primary')).toBe('opus');
      });

      it('should return undefined for non-existent keys', () => {
        const config = { project: { name: 'test' } };

        expect(getConfigValue(config, 'nonexistent')).toBeUndefined();
        expect(getConfigValue(config, 'project.nonexistent')).toBeUndefined();
        expect(getConfigValue(config, 'nonexistent.deep.path')).toBeUndefined();
      });

      it('should handle empty config', () => {
        const config = {};
        expect(getConfigValue(config, 'any.key')).toBeUndefined();
      });

      it('should handle null/undefined values in path', () => {
        const config = {
          project: null,
          other: {
            nested: undefined,
          },
        };

        expect(getConfigValue(config, 'project.name')).toBeUndefined();
        expect(getConfigValue(config, 'other.nested.deeper')).toBeUndefined();
      });
    });

    describe('setConfigValue', () => {
      it('should set top-level string values', () => {
        const config: ApexConfig = {};
        setConfigValue(config, 'version', '1.0.0');
        expect(config.version).toBe('1.0.0');
      });

      it('should set nested values using dot notation', () => {
        const config: ApexConfig = {};
        setConfigValue(config, 'project.name', 'new-project');
        expect(config.project?.name).toBe('new-project');
      });

      it('should create intermediate objects automatically', () => {
        const config: ApexConfig = {};
        setConfigValue(config, 'deep.nested.path.value', 'test');
        expect(config.deep?.nested?.path?.value).toBe('test');
      });

      it('should parse JSON values correctly', () => {
        const config: ApexConfig = {};

        // Boolean values
        setConfigValue(config, 'boolTrue', 'true');
        setConfigValue(config, 'boolFalse', 'false');
        expect(config.boolTrue).toBe(true);
        expect(config.boolFalse).toBe(false);

        // Numeric values
        setConfigValue(config, 'intValue', '42');
        setConfigValue(config, 'floatValue', '3.14');
        expect(config.intValue).toBe(42);
        expect(config.floatValue).toBe(3.14);

        // JSON objects
        setConfigValue(config, 'objValue', '{"key": "value"}');
        expect(config.objValue).toEqual({ key: 'value' });

        // JSON arrays
        setConfigValue(config, 'arrayValue', '[1, 2, 3]');
        expect(config.arrayValue).toEqual([1, 2, 3]);
      });

      it('should fall back to string for invalid JSON', () => {
        const config: ApexConfig = {};
        setConfigValue(config, 'invalidJson', 'not-valid-json');
        expect(config.invalidJson).toBe('not-valid-json');
      });

      it('should overwrite existing values', () => {
        const config: ApexConfig = {
          project: {
            name: 'old-name',
          },
        };

        setConfigValue(config, 'project.name', 'new-name');
        expect(config.project.name).toBe('new-name');
      });

      it('should handle edge cases in JSON parsing', () => {
        const config: ApexConfig = {};

        // null value
        setConfigValue(config, 'nullValue', 'null');
        expect(config.nullValue).toBe(null);

        // undefined as string (not valid JSON)
        setConfigValue(config, 'undefinedValue', 'undefined');
        expect(config.undefinedValue).toBe('undefined');

        // empty string
        setConfigValue(config, 'emptyString', '""');
        expect(config.emptyString).toBe('');

        // string with quotes
        setConfigValue(config, 'quotedString', '"hello world"');
        expect(config.quotedString).toBe('hello world');
      });
    });
  });

  describe('REPL handleConfig Function', () => {
    // Mock implementation of handleConfig based on the actual code
    async function handleConfig(args: string[]): Promise<void> {
      if (!mockContext.initialized || !mockContext.config) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
        return;
      }

      const action = args[0];

      if (action === 'get' && args[1]) {
        const key = args[1];
        const value = getConfigValue(mockContext.config, key);
        mockContext.app?.addMessage({
          type: 'assistant',
          content: `${key} = ${JSON.stringify(value)}`,
        });
      } else if (action === 'set' && args[1] && args[2]) {
        const key = args[1];
        const value = args[2];
        setConfigValue(mockContext.config, key, value);

        // Use the hoisted mock reference
        await mockSaveConfig(mockContext.cwd, mockContext.config);

        mockContext.app?.addMessage({
          type: 'system',
          content: `Configuration updated: ${key} = ${value}`,
        });
      } else {
        // Show full config
        mockContext.app?.addMessage({
          type: 'assistant',
          content: '```yaml\n' + JSON.stringify(mockContext.config, null, 2) + '\n```',
        });
      }
    }

    describe('View Full Configuration', () => {
      it('should display full configuration when no arguments provided', async () => {
        await handleConfig([]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: expect.stringContaining('```yaml\n'),
        });

        const call = mockApp.addMessage.mock.calls[0][0];
        expect(call.content).toContain('test-project');
        expect(call.content).toContain('review-before-commit');
        expect(call.content).toContain('opus');
      });

      it('should require initialization', async () => {
        mockContext.initialized = false;

        await handleConfig([]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
      });

      it('should require config to be loaded', async () => {
        mockContext.config = null;

        await handleConfig([]);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
      });
    });

    describe('Get Configuration Values', () => {
      it('should get top-level values', async () => {
        await handleConfig(['get', 'version']);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: 'version = "0.6.0"',
        });
      });

      it('should get nested values using dot notation', async () => {
        await handleConfig(['get', 'project.name']);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: 'project.name = "test-project"',
        });
      });

      it('should get deeply nested values', async () => {
        await handleConfig(['get', 'models.planning']);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: 'models.planning = "opus"',
        });
      });

      it('should handle non-existent keys', async () => {
        await handleConfig(['get', 'nonexistent.key']);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: 'nonexistent.key = undefined',
        });
      });

      it('should handle numeric values', async () => {
        await handleConfig(['get', 'limits.maxCostPerTask']);

        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: 'limits.maxCostPerTask = 10',
        });
      });

      it('should require key parameter', async () => {
        await handleConfig(['get']);

        // Should fall back to showing full config
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: expect.stringContaining('```yaml\n'),
        });
      });
    });

    describe('Set Configuration Values', () => {
      it('should set string values', async () => {
        await handleConfig(['set', 'project.description', 'new description']);

        expect(mockContext.config?.project?.description).toBe('new description');
        expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', mockContext.config);
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Configuration updated: project.description = new description',
        });
      });

      it('should set boolean values with JSON parsing', async () => {
        await handleConfig(['set', 'testFlag', 'true']);

        expect(mockContext.config?.testFlag).toBe(true);
      });

      it('should set numeric values with JSON parsing', async () => {
        await handleConfig(['set', 'limits.maxCostPerTask', '15.5']);

        expect(mockContext.config?.limits?.maxCostPerTask).toBe(15.5);
      });

      it('should create nested objects for new paths', async () => {
        await handleConfig(['set', 'new.nested.value', 'test']);

        expect(mockContext.config?.new?.nested?.value).toBe('test');
      });

      it('should handle JSON objects', async () => {
        await handleConfig(['set', 'complexObject', '{"key": "value", "num": 42}']);

        expect(mockContext.config?.complexObject).toEqual({ key: 'value', num: 42 });
      });

      it('should handle JSON arrays', async () => {
        await handleConfig(['set', 'arrayValue', '[1, 2, "three"]']);

        expect(mockContext.config?.arrayValue).toEqual([1, 2, 'three']);
      });

      it('should fall back to string for invalid JSON', async () => {
        await handleConfig(['set', 'invalidJson', 'not-valid-json']);

        expect(mockContext.config?.invalidJson).toBe('not-valid-json');
      });

      it('should require both key and value parameters', async () => {
        // Missing value
        await handleConfig(['set', 'key']);

        // Should fall back to showing full config
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: expect.stringContaining('```yaml\n'),
        });
      });

      it('should require key parameter', async () => {
        await handleConfig(['set']);

        // Should fall back to showing full config
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'assistant',
          content: expect.stringContaining('```yaml\n'),
        });
      });

      it('should persist changes to config file', async () => {
        await handleConfig(['set', 'persistent.value', 'saved']);

        expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', mockContext.config);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle empty string values', async () => {
        await handleConfig(['set', 'emptyValue', '""']);

        expect(mockContext.config?.emptyValue).toBe('');
      });

      it('should handle null values', async () => {
        await handleConfig(['set', 'nullValue', 'null']);

        expect(mockContext.config?.nullValue).toBe(null);
      });

      it('should handle zero values', async () => {
        await handleConfig(['set', 'zeroValue', '0']);

        expect(mockContext.config?.zeroValue).toBe(0);
      });

      it('should handle false values', async () => {
        await handleConfig(['set', 'falseValue', 'false']);

        expect(mockContext.config?.falseValue).toBe(false);
      });

      it('should overwrite existing nested values', async () => {
        mockContext.config!.project!.name = 'old-name';

        await handleConfig(['set', 'project.name', 'brand-new-name']);

        expect(mockContext.config?.project?.name).toBe('brand-new-name');
      });

      it('should handle very deep nesting', async () => {
        await handleConfig(['set', 'level1.level2.level3.level4.level5.value', 'deep']);

        expect(mockContext.config?.level1?.level2?.level3?.level4?.level5?.value).toBe('deep');
      });

      it('should handle special characters in values', async () => {
        await handleConfig(['set', 'specialChars', 'value with spaces & symbols!@#$%']);

        expect(mockContext.config?.specialChars).toBe('value with spaces & symbols!@#$%');
      });

      it('should handle unicode characters', async () => {
        await handleConfig(['set', 'unicode', '🚀 Unicode test 中文']);

        expect(mockContext.config?.unicode).toBe('🚀 Unicode test 中文');
      });
    });

    describe('Integration with Core Config Functions', () => {
      it('should call saveConfig with correct parameters', async () => {
        await handleConfig(['set', 'test.key', 'test-value']);

        expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', mockContext.config);
        expect(mockSaveConfig).toHaveBeenCalledTimes(1);
      });

      it('should handle saveConfig errors gracefully', async () => {
        const error = new Error('Failed to save config');
        mockSaveConfig.mockRejectedValueOnce(error);

        // The actual implementation doesn't handle this error, so this tests the current behavior
        await expect(handleConfig(['set', 'test.key', 'test-value'])).rejects.toThrow('Failed to save config');
      });
    });
  });
});