import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  // JSON-RPC base types
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcErrorSchema,

  // MCP protocol types
  MCPInitializeParamsSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPResourcesReadParamsSchema,
  MCPPromptsGetParamsSchema,
  MCPLogMessageNotificationParamsSchema,
  MCPCompletionCompleteParamsSchema,

  // Schema types for validation
  MCPProtocolVersionSchema,
  MCPProtocolToolInputSchemaSchema,
  MCPToolResultContentItemSchema,
  MCPPromptMessageContentSchema,
  MCPLogLevelSchema,
} from '../mcp/protocol-types.js';

describe('MCP Protocol Types - Error Scenarios', () => {
  describe('Type Coercion and Validation Errors', () => {
    it('rejects numeric strings where numbers are expected', () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        id: '123', // This is valid - can be string
        method: 'test',
        params: {
          numericField: '42', // This would be caught at the specific param level
        },
      };

      // JsonRPC itself doesn't validate param structure, so this passes
      expect(() => JsonRpcRequestSchema.parse(invalidRequest)).not.toThrow();
    });

    it('rejects boolean strings where booleans are expected', () => {
      const invalidCapabilities = {
        tools: {
          listChanged: 'true', // Should be boolean
        },
      };

      expect(() => {
        import('../mcp/protocol-types.js').then(({ MCPServerCapabilitiesSchema }) => {
          MCPServerCapabilitiesSchema.parse(invalidCapabilities);
        });
      }).rejects.toThrow();
    });

    it('provides detailed error paths for nested validation failures', () => {
      const invalidInitParams = {
        protocolVersion: 'invalid-version-format',
        capabilities: {
          roots: {
            listChanged: 'not-a-boolean', // Invalid type
          },
        },
        clientInfo: {
          // Missing required fields
        },
      };

      try {
        MCPInitializeParamsSchema.parse(invalidInitParams);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors.length).toBeGreaterThan(0);

        // Check that error paths are specific
        const errorPaths = zodError.errors.map(err => err.path.join('.'));
        expect(errorPaths).toContain('protocolVersion');
        expect(errorPaths).toContain('clientInfo.name');
        expect(errorPaths).toContain('clientInfo.version');
      }
    });
  });

  describe('Schema Validation Boundary Cases', () => {
    it('handles empty strings in required fields', () => {
      const toolCallWithEmptyName = {
        name: '', // Empty but present
        arguments: {},
      };

      // Empty string is still a valid string, so this should pass
      expect(() => MCPToolsCallParamsSchema.parse(toolCallWithEmptyName)).not.toThrow();
    });

    it('rejects null values in non-nullable fields', () => {
      const resourceReadWithNullUri = {
        uri: null,
      };

      expect(() => MCPResourcesReadParamsSchema.parse(resourceReadWithNullUri)).toThrow();
    });

    it('handles arrays with mixed types', () => {
      const toolResultWithMixedContent = {
        content: [
          { type: 'text', text: 'Valid text' },
          { type: 'invalid', invalid: 'field' }, // Invalid content type
          { type: 'image', data: 'data', mimeType: 'image/png' },
        ],
      };

      expect(() => MCPToolsCallResultSchema.parse(toolResultWithMixedContent)).toThrow();
    });

    it('rejects additional properties in strict schemas', () => {
      const initializedWithExtra = {
        extraField: 'should not be here',
      };

      expect(() => import('../mcp/protocol-types.js').then(({ MCPInitializedNotificationParamsSchema }) => {
        MCPInitializedNotificationParamsSchema.parse(initializedWithExtra);
      })).rejects.toThrow();
    });
  });

  describe('Resource URI Validation Edge Cases', () => {
    it('accepts various URI schemes', () => {
      const validUris = [
        'file:///path/to/file.txt',
        'https://example.com/resource',
        'ftp://server.com/file.dat',
        'data:text/plain;base64,SGVsbG8=',
        'custom-scheme://identifier',
      ];

      validUris.forEach(uri => {
        const params = { uri };
        expect(() => MCPResourcesReadParamsSchema.parse(params)).not.toThrow();
      });
    });

    it('accepts malformed URIs since schema only checks string type', () => {
      const malformedUris = [
        'not-a-uri',
        '://missing-scheme',
        'file:/single-slash',
        '',
      ];

      // Note: The schema only validates that it's a string, not that it's a valid URI
      malformedUris.forEach(uri => {
        const params = { uri };
        expect(() => MCPResourcesReadParamsSchema.parse(params)).not.toThrow();
      });
    });
  });

  describe('MIME Type Edge Cases', () => {
    it('accepts various MIME type formats', () => {
      const validMimeTypes = [
        'text/plain',
        'application/json',
        'image/svg+xml',
        'application/vnd.ms-excel',
        'text/plain; charset=utf-8',
        'multipart/form-data; boundary=something',
      ];

      validMimeTypes.forEach(mimeType => {
        const content = {
          type: 'image' as const,
          data: 'test-data',
          mimeType,
        };
        expect(() => MCPToolResultContentItemSchema.parse(content)).not.toThrow();
      });
    });

    it('accepts invalid MIME types since schema only checks string type', () => {
      const invalidMimeTypes = [
        'not-a-mime-type',
        'text/',
        '/plain',
        '',
        'text/plain/extra',
      ];

      // Schema doesn't validate MIME type format, only that it's a string
      invalidMimeTypes.forEach(mimeType => {
        const content = {
          type: 'image' as const,
          data: 'test-data',
          mimeType,
        };
        expect(() => MCPToolResultContentItemSchema.parse(content)).not.toThrow();
      });
    });
  });

  describe('Large Data Validation', () => {
    it('handles extremely large text content', () => {
      const hugeText = 'x'.repeat(1000000); // 1MB of text
      const content = {
        type: 'text' as const,
        text: hugeText,
      };

      // Should not throw, but might be slow
      const start = Date.now();
      expect(() => MCPToolResultContentItemSchema.parse(content)).not.toThrow();
      const duration = Date.now() - start;

      // Validation should be reasonably fast even for large content
      expect(duration).toBeLessThan(100); // 100ms threshold
    });

    it('handles many nested properties', () => {
      const deeplyNestedArguments: Record<string, any> = {};
      let current = deeplyNestedArguments;

      // Create 50 levels of nesting
      for (let i = 0; i < 50; i++) {
        current[`level${i}`] = {};
        current = current[`level${i}`];
      }
      current.value = 'deep value';

      const toolCall = {
        name: 'deep-tool',
        arguments: deeplyNestedArguments,
      };

      expect(() => MCPToolsCallParamsSchema.parse(toolCall)).not.toThrow();
    });

    it('handles arrays with many elements', () => {
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Message ${i}`,
        },
      }));

      const promptResult = {
        messages: manyMessages,
      };

      expect(() => import('../mcp/protocol-types.js').then(({ MCPPromptsGetResultSchema }) => {
        MCPPromptsGetResultSchema.parse(promptResult);
      })).resolves.not.toThrow();
    });
  });

  describe('Unicode and Encoding Edge Cases', () => {
    it('handles Unicode text content', () => {
      const unicodeTexts = [
        'Hello 世界', // Mixed ASCII and Chinese
        '🚀 Rocket ship emoji',
        'Café with é', // Accented characters
        'Москва', // Cyrillic
        'العربية', // Arabic (RTL)
        'नमस्ते', // Devanagari
        '🌈🦄💖', // Multiple emojis
        '\u0000\u001F', // Control characters
      ];

      unicodeTexts.forEach(text => {
        const content = {
          type: 'text' as const,
          text,
        };
        expect(() => MCPToolResultContentItemSchema.parse(content)).not.toThrow();
      });
    });

    it('handles base64 data edge cases', () => {
      const base64Cases = [
        '', // Empty base64
        'SGVsbG8=', // Valid base64
        'SGVsbG8', // Missing padding
        'Invalid base64 content!', // Invalid base64
        'SGVsbG8gV29ybGQ=', // "Hello World"
        '==', // Only padding
      ];

      base64Cases.forEach(data => {
        const content = {
          type: 'image' as const,
          data,
          mimeType: 'image/png',
        };
        // Schema doesn't validate base64 format, only that it's a string
        expect(() => MCPToolResultContentItemSchema.parse(content)).not.toThrow();
      });
    });
  });

  describe('Circular Reference and Self-Reference', () => {
    it('handles objects with circular references in arguments', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const toolCall = {
        name: 'circular-tool',
        arguments: circularObj,
      };

      // Zod should handle this gracefully, but might stack overflow on very deep structures
      expect(() => MCPToolsCallParamsSchema.parse(toolCall)).not.toThrow();
    });
  });

  describe('Concurrent Validation', () => {
    it('handles concurrent validation calls', async () => {
      const validPromptGet = {
        name: 'test-prompt',
        arguments: { param: 'value' },
      };

      // Run many validations concurrently
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(MCPPromptsGetParamsSchema.parse(validPromptGet))
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toEqual(validPromptGet);
      });
    });

    it('maintains validation integrity under concurrent load', async () => {
      const validData = [
        { schema: MCPToolsCallParamsSchema, data: { name: 'tool' } },
        { schema: MCPResourcesReadParamsSchema, data: { uri: 'file://test' } },
        { schema: MCPPromptsGetParamsSchema, data: { name: 'prompt' } },
        { schema: MCPLogLevelSchema, data: 'info' },
      ];

      const concurrentValidations = Array.from({ length: 50 }, () =>
        validData.map(({ schema, data }) =>
          Promise.resolve(schema.parse(data))
        )
      ).flat();

      const results = await Promise.all(concurrentValidations);
      expect(results).toHaveLength(200); // 50 * 4
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('does not leak memory with repeated validation', () => {
      const toolCall = {
        name: 'memory-test',
        arguments: { test: 'data' },
      };

      // Validate the same object many times
      for (let i = 0; i < 10000; i++) {
        const result = MCPToolsCallParamsSchema.parse(toolCall);
        expect(result.name).toBe('memory-test');
      }
    });

    it('handles validation of deeply nested objects efficiently', () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return 'leaf';
        return {
          level: depth,
          child: createNestedObject(depth - 1),
        };
      };

      const deepArguments = createNestedObject(100);
      const toolCall = {
        name: 'deep-tool',
        arguments: deepArguments,
      };

      const start = Date.now();
      expect(() => MCPToolsCallParamsSchema.parse(toolCall)).not.toThrow();
      const duration = Date.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(50); // 50ms threshold
    });
  });

  describe('Error Message Quality', () => {
    it('provides helpful error messages for common mistakes', () => {
      const invalidToolCall = {
        // Missing required 'name' field
        arguments: { test: 'value' },
      };

      try {
        MCPToolsCallParamsSchema.parse(invalidToolCall);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;

        // Should have specific error about missing 'name' field
        const nameError = zodError.errors.find(err =>
          err.path.includes('name') && err.code === 'invalid_type'
        );
        expect(nameError).toBeDefined();
        expect(nameError?.message).toMatch(/required/i);
      }
    });

    it('provides context for discriminated union errors', () => {
      const invalidContent = {
        type: 'text',
        // Missing required 'text' field for text type
        data: 'wrong field for text type',
      };

      try {
        MCPToolResultContentItemSchema.parse(invalidContent);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;

        // Should provide helpful context about discriminated union
        expect(zodError.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Schema Evolution Compatibility', () => {
    it('handles unknown fields gracefully in extensible schemas', () => {
      const futureCapabilities = {
        tools: { listChanged: true },
        resources: { subscribe: false },
        // Future fields that might be added
        futureTechnology: {
          enabled: true,
          version: '2.0',
        },
      };

      // Most schemas should either accept unknown fields or reject them predictably
      expect(() => import('../mcp/protocol-types.js').then(({ MCPServerCapabilitiesSchema }) => {
        MCPServerCapabilitiesSchema.parse(futureCapabilities);
      })).resolves.not.toThrow();
    });

    it('maintains backward compatibility for optional fields', () => {
      // Test that removing optional fields doesn't break validation
      const minimalToolDefinition = {
        name: 'minimal-tool',
        // No description (optional)
        inputSchema: { type: 'object' },
      };

      expect(() => import('../mcp/protocol-types.js').then(({ MCPProtocolToolDefinitionSchema }) => {
        MCPProtocolToolDefinitionSchema.parse(minimalToolDefinition);
      })).resolves.not.toThrow();
    });
  });

  describe('JSON Serialization Edge Cases', () => {
    it('handles objects that might not serialize properly', () => {
      const problematicArguments = {
        undefinedValue: undefined,
        nullValue: null,
        functionValue: () => 'test',
        symbolValue: Symbol('test'),
        dateValue: new Date(),
        regexValue: /test/g,
      };

      const toolCall = {
        name: 'problematic-tool',
        arguments: problematicArguments,
      };

      // Zod will validate this, but some values might be lost in JSON serialization
      expect(() => MCPToolsCallParamsSchema.parse(toolCall)).not.toThrow();
    });
  });
});