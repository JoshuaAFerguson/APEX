/**
 * @fileoverview Tester Agent Verification Tests
 *
 * Quick verification tests to ensure MockMCPServerBuilder functionality
 * is working correctly before running full test suite.
 */

import { describe, it, expect } from 'vitest';
import { MockMCPServerBuilder, createMockServerBuilder } from '../mock-mcp-server-builder.js';

describe('Tester Agent - MockMCPServerBuilder Verification', () => {
  describe('Basic Builder Functionality', () => {
    it('should create a builder instance', () => {
      const builder = new MockMCPServerBuilder();
      expect(builder).toBeInstanceOf(MockMCPServerBuilder);
    });

    it('should create builder via factory function', () => {
      const builder = createMockServerBuilder();
      expect(builder).toBeInstanceOf(MockMCPServerBuilder);
    });

    it('should configure server name', () => {
      const definition = new MockMCPServerBuilder()
        .withName('test-server')
        .buildDefinition();

      expect(definition.serverConfig.name).toBe('test-server');
    });

    it('should configure tool with static response', () => {
      const definition = new MockMCPServerBuilder()
        .withName('test-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }])
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe('ping');
      expect(definition.defaultBehavior.toolHandlers[0].response.content[0].text).toBe('pong');
    });

    it('should configure dynamic handler', () => {
      const handler = async (toolName: string) => ({
        content: [{ type: 'text', text: `Dynamic response for ${toolName}` }],
        isError: false,
      });

      const definition = new MockMCPServerBuilder()
        .withName('test-server')
        .withTool('dynamic-tool')
        .withDynamicHandler(handler)
        .buildDefinition();

      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.dynamicHandlers[0].toolName).toBe('dynamic-tool');
      expect(typeof definition.defaultBehavior.dynamicHandlers[0].handler).toBe('function');
    });

    it('should configure response delays', () => {
      const definition = new MockMCPServerBuilder()
        .withName('test-server')
        .withDelay(100, 200)
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay?.minMs).toBe(100);
      expect(definition.defaultBehavior.responseDelay?.maxMs).toBe(200);
    });

    it('should build working facade', () => {
      const facade = new MockMCPServerBuilder()
        .withName('test-facade')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test response' }])
        .build();

      expect(facade).toBeDefined();
      expect(typeof facade.start).toBe('function');
      expect(typeof facade.stop).toBe('function');
      expect(typeof facade.getTransport).toBe('function');
    });

    it('should build working server', () => {
      const server = new MockMCPServerBuilder()
        .withName('test-server')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test response' }])
        .buildServer();

      expect(server).toBeDefined();
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });
  });

  describe('Method Chaining', () => {
    it('should support fluent API method chaining', () => {
      const result = new MockMCPServerBuilder()
        .withName('chain-test')
        .withTransport('stdio')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'response1' }])
        .withTool('tool2')
        .withStaticResponse([{ type: 'text', text: 'response2' }])
        .withDelay(50);

      expect(result).toBeInstanceOf(MockMCPServerBuilder);
    });

    it('should finalize all tool configurations', () => {
      const definition = new MockMCPServerBuilder()
        .withName('multi-tool')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'response1' }])
        .withTool('tool2')
        .withDynamicHandler(async () => ({ content: [{ type: 'text', text: 'dynamic' }], isError: false }))
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should require server name', () => {
      expect(() => {
        new MockMCPServerBuilder().buildDefinition();
      }).toThrow('Server name is required');
    });

    it('should require handler configuration after withTool', () => {
      expect(() => {
        new MockMCPServerBuilder()
          .withName('incomplete')
          .withTool('incomplete-tool')
          .buildDefinition();
      }).toThrow(/no handler was configured/);
    });

    it('should require withTool before response configuration', () => {
      expect(() => {
        new MockMCPServerBuilder()
          .withName('invalid')
          .withStaticResponse([{ type: 'text', text: 'invalid' }]);
      }).toThrow('withStaticResponse() must be called after withTool()');

      expect(() => {
        new MockMCPServerBuilder()
          .withName('invalid')
          .withDynamicHandler(async () => ({ content: [], isError: false }));
      }).toThrow('withDynamicHandler() must be called after withTool()');
    });
  });
});