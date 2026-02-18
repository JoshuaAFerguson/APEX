/**
 * @fileoverview Edge Cases Tests for Preset-Based Mock MCP Server Factory
 *
 * Comprehensive test suite for edge cases and boundary conditions
 * in the createMockMCPServer() factory function.
 *
 * Tests ADR-080: Preset-Based Mock MCP Server Factory - Edge Cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockMCPServer,
  type CreateMockServerOptions,
} from '../preset-factory.js';
import {
  type MockServerPreset,
} from '../server-presets.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockToolHandler } from '@apexcli/core';

describe('createMockMCPServer Edge Cases', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('input validation edge cases', () => {
    it('should handle empty string preset name gracefully', () => {
      expect(() => createMockMCPServer('' as MockServerPreset)).toThrow();
    });

    it('should handle null preset', () => {
      expect(() => createMockMCPServer(null as any)).toThrow();
    });

    it('should handle undefined preset', () => {
      expect(() => createMockMCPServer(undefined as any)).toThrow();
    });

    it('should handle empty array preset', () => {
      expect(() => createMockMCPServer([])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });

    it('should handle array with only behavior modifiers', () => {
      expect(() => createMockMCPServer(['error-prone', 'slow'])).toThrow(
        'At least one base preset (filesystem, database, api, minimal) must be provided'
      );
    });

    it('should handle duplicate presets in array', () => {
      server = createMockMCPServer(['filesystem', 'slow', 'slow']);
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle case-sensitive preset names', () => {
      expect(() => createMockMCPServer('FILESYSTEM' as MockServerPreset)).toThrow();
      expect(() => createMockMCPServer('Filesystem' as MockServerPreset)).toThrow();
    });
  });

  describe('configuration edge cases', () => {
    it('should handle empty options object', () => {
      server = createMockMCPServer('minimal', {});
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle null options', () => {
      server = createMockMCPServer('minimal', null as any);
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle undefined options', () => {
      server = createMockMCPServer('minimal', undefined);
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle empty string name override', () => {
      server = createMockMCPServer('minimal', { name: '' });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle very long name override', () => {
      const longName = 'a'.repeat(1000);
      server = createMockMCPServer('minimal', { name: longName });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle special characters in name', () => {
      server = createMockMCPServer('minimal', { name: 'test-server_123.special!@#$%' });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle empty description', () => {
      server = createMockMCPServer('minimal', { description: '' });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle very long description', () => {
      const longDescription = 'This is a very long description. '.repeat(100);
      server = createMockMCPServer('minimal', { description: longDescription });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('tool handler edge cases', () => {
    it('should handle empty additionalTools array', () => {
      server = createMockMCPServer('minimal', { additionalTools: [] });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle null additionalTools', () => {
      server = createMockMCPServer('minimal', { additionalTools: null as any });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle tool handlers with empty names', () => {
      const toolWithEmptyName: MockToolHandler = {
        toolName: '',
        response: {
          content: [{ type: 'text', text: 'test' }],
          isError: false,
        },
        priority: 50,
      };

      server = createMockMCPServer('minimal', {
        additionalTools: [toolWithEmptyName]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle tool handlers with very long names', () => {
      const toolWithLongName: MockToolHandler = {
        toolName: 'a'.repeat(500),
        response: {
          content: [{ type: 'text', text: 'test' }],
          isError: false,
        },
        priority: 50,
      };

      server = createMockMCPServer('minimal', {
        additionalTools: [toolWithLongName]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle duplicate tool names in additionalTools', () => {
      const duplicateTools: MockToolHandler[] = [
        {
          toolName: 'duplicate_tool',
          response: { content: [{ type: 'text', text: 'first' }], isError: false },
          priority: 50,
        },
        {
          toolName: 'duplicate_tool',
          response: { content: [{ type: 'text', text: 'second' }], isError: false },
          priority: 60,
        },
      ];

      server = createMockMCPServer('minimal', {
        additionalTools: duplicateTools
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle tools with special characters in names', () => {
      const specialTool: MockToolHandler = {
        toolName: 'tool-with_special.chars!@#$%',
        response: {
          content: [{ type: 'text', text: 'special tool' }],
          isError: false,
        },
        priority: 50,
      };

      server = createMockMCPServer('minimal', {
        additionalTools: [specialTool]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle empty toolOverrides object', () => {
      server = createMockMCPServer('filesystem', { toolOverrides: {} });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle toolOverrides for non-existent tools', () => {
      server = createMockMCPServer('filesystem', {
        toolOverrides: {
          'non_existent_tool': {
            response: { content: [{ type: 'text', text: 'override' }], isError: false }
          }
        }
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('delay configuration edge cases', () => {
    it('should handle zero delay', () => {
      server = createMockMCPServer('minimal', { delay: 0 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle negative delay', () => {
      server = createMockMCPServer('minimal', { delay: -100 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle very large delay', () => {
      server = createMockMCPServer('minimal', { delay: 999999999 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle delay range with min > max', () => {
      server = createMockMCPServer('minimal', { delay: { min: 1000, max: 100 } });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle delay range with negative values', () => {
      server = createMockMCPServer('minimal', { delay: { min: -100, max: -50 } });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle delay range with zero values', () => {
      server = createMockMCPServer('minimal', { delay: { min: 0, max: 0 } });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('capabilities edge cases', () => {
    it('should handle empty capabilities object', () => {
      server = createMockMCPServer('minimal', { capabilities: {} });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle capabilities with null values', () => {
      server = createMockMCPServer('minimal', {
        capabilities: {
          tools: null as any,
          resources: null as any
        }
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle capabilities with undefined values', () => {
      server = createMockMCPServer('minimal', {
        capabilities: {
          tools: undefined,
          resources: undefined
        }
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle deeply nested capabilities', () => {
      server = createMockMCPServer('minimal', {
        capabilities: {
          tools: {
            listChanged: true,
            customProperty: {
              nestedProperty: true
            } as any
          }
        }
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('error simulation edge cases', () => {
    it('should handle empty error simulation object', () => {
      server = createMockMCPServer('minimal', { errorSimulation: {} as any });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle error simulation with null values', () => {
      server = createMockMCPServer('minimal', {
        errorSimulation: {
          mode: null as any,
          category: null as any,
          customError: null as any,
        }
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle error simulation with invalid mode', () => {
      server = createMockMCPServer('minimal', {
        errorSimulation: {
          mode: 'invalid_mode' as any,
          category: 'jsonrpc',
          affectedClients: 'all',
        }
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('scenarios edge cases', () => {
    it('should handle empty scenarios array', () => {
      server = createMockMCPServer('minimal', { scenarios: [] });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle scenarios with empty names', () => {
      server = createMockMCPServer('minimal', {
        scenarios: [{
          name: '',
          behaviorPreset: 'slow'
        }]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle scenarios with duplicate names', () => {
      server = createMockMCPServer('minimal', {
        scenarios: [
          { name: 'duplicate', behaviorPreset: 'slow' },
          { name: 'duplicate', behaviorPreset: 'error-prone' }
        ]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle scenarios with special characters in names', () => {
      server = createMockMCPServer('minimal', {
        scenarios: [{
          name: 'scenario-with_special.chars!@#$%',
          behaviorPreset: 'slow'
        }]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle scenarios with null behavior preset', () => {
      server = createMockMCPServer('minimal', {
        scenarios: [{
          name: 'null-behavior',
          behaviorPreset: null as any
        }]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('transport and connection edge cases', () => {
    it('should handle invalid transport type', () => {
      server = createMockMCPServer('minimal', { transport: 'invalid' as any });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle zero maxConnections', () => {
      server = createMockMCPServer('minimal', { maxConnections: 0 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle negative maxConnections', () => {
      server = createMockMCPServer('minimal', { maxConnections: -5 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle very large maxConnections', () => {
      server = createMockMCPServer('minimal', { maxConnections: 999999999 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle zero shutdown timeout', () => {
      server = createMockMCPServer('minimal', { shutdownTimeoutMs: 0 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle negative shutdown timeout', () => {
      server = createMockMCPServer('minimal', { shutdownTimeoutMs: -1000 });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle false autoStart', () => {
      server = createMockMCPServer('minimal', { autoStart: false });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('complex edge case combinations', () => {
    it('should handle all edge case options together', () => {
      const edgeCaseOptions: CreateMockServerOptions = {
        name: '',
        description: '',
        additionalTools: [],
        toolOverrides: {},
        delay: 0,
        capabilities: {},
        scenarios: [],
        transport: 'stdio',
        autoStart: false,
        maxConnections: 0,
        shutdownTimeoutMs: 0,
      };

      server = createMockMCPServer('minimal', edgeCaseOptions);
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle mixed valid and invalid configurations', () => {
      const mixedOptions: CreateMockServerOptions = {
        name: 'valid-name',
        delay: -100, // Invalid
        additionalTools: [
          {
            toolName: '', // Edge case
            response: { content: [{ type: 'text', text: 'test' }], isError: false },
            priority: 50,
          }
        ],
        capabilities: { tools: null as any }, // Invalid
        maxConnections: -1, // Invalid
      };

      server = createMockMCPServer('filesystem', mixedOptions);
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle preset combinations with edge case overrides', () => {
      server = createMockMCPServer(['database', 'slow', 'error-prone'], {
        name: '',
        delay: { min: 1000, max: 100 }, // min > max
        additionalTools: [
          {
            toolName: 'query', // Duplicate of preset tool
            response: { content: [{ type: 'text', text: 'override' }], isError: false },
            priority: 50,
          }
        ],
        toolOverrides: {
          'non_existent': { priority: 100 }
        },
        scenarios: [
          { name: '', behaviorPreset: 'slow' }
        ]
      });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle creation of many tools without memory issues', () => {
      const manyTools: MockToolHandler[] = [];
      for (let i = 0; i < 1000; i++) {
        manyTools.push({
          toolName: `tool_${i}`,
          response: { content: [{ type: 'text', text: `Tool ${i} response` }], isError: false },
          priority: 50,
        });
      }

      server = createMockMCPServer('minimal', { additionalTools: manyTools });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle very large response content', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const largeResponseTool: MockToolHandler = {
        toolName: 'large_response',
        response: { content: [{ type: 'text', text: largeContent }], isError: false },
        priority: 50,
      };

      server = createMockMCPServer('minimal', { additionalTools: [largeResponseTool] });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle many scenarios without issues', () => {
      const manyScenarios = [];
      for (let i = 0; i < 100; i++) {
        manyScenarios.push({
          name: `scenario_${i}`,
          behaviorPreset: i % 2 === 0 ? 'slow' as const : 'error-prone' as const
        });
      }

      server = createMockMCPServer('minimal', { scenarios: manyScenarios });
      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });
  });
});