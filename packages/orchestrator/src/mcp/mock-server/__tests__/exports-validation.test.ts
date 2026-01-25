/**
 * @fileoverview Export validation tests for MockMCP Server module
 *
 * These tests verify that all expected exports are available and properly
 * typed, ensuring the public API surface is complete and accessible.
 */

import { describe, it, expect } from 'vitest';

describe('MockMCP Server Module Exports', () => {
  it('should export MockMCPServerBuilder class', async () => {
    const { MockMCPServerBuilder } = await import('../mock-mcp-server-builder.js');
    expect(MockMCPServerBuilder).toBeDefined();
    expect(typeof MockMCPServerBuilder).toBe('function');

    // Should be constructable
    const builder = new MockMCPServerBuilder();
    expect(builder).toBeInstanceOf(MockMCPServerBuilder);
  });

  it('should export createMockServerBuilder factory function', async () => {
    const { createMockServerBuilder } = await import('../mock-mcp-server-builder.js');
    expect(createMockServerBuilder).toBeDefined();
    expect(typeof createMockServerBuilder).toBe('function');

    // Should return a MockMCPServerBuilder instance
    const builder = createMockServerBuilder();
    const { MockMCPServerBuilder } = await import('../mock-mcp-server-builder.js');
    expect(builder).toBeInstanceOf(MockMCPServerBuilder);
  });

  it('should export MockMCPServerBuilder from main index', async () => {
    const { MockMCPServerBuilder } = await import('../index.js');
    expect(MockMCPServerBuilder).toBeDefined();
    expect(typeof MockMCPServerBuilder).toBe('function');
  });

  it('should export createMockServerBuilder from main index', async () => {
    const { createMockServerBuilder } = await import('../index.js');
    expect(createMockServerBuilder).toBeDefined();
    expect(typeof createMockServerBuilder).toBe('function');
  });

  it('should export all usage example functions', async () => {
    const {
      createBuilderWithStaticResponses,
      createBuilderWithDynamicHandlers,
      createBuilderWithResponseSequences,
      createComprehensiveBuilderExample,
      createQuickTestSetup,
    } = await import('../usage-examples.js');

    expect(createBuilderWithStaticResponses).toBeDefined();
    expect(typeof createBuilderWithStaticResponses).toBe('function');

    expect(createBuilderWithDynamicHandlers).toBeDefined();
    expect(typeof createBuilderWithDynamicHandlers).toBe('function');

    expect(createBuilderWithResponseSequences).toBeDefined();
    expect(typeof createBuilderWithResponseSequences).toBe('function');

    expect(createComprehensiveBuilderExample).toBeDefined();
    expect(typeof createComprehensiveBuilderExample).toBe('function');

    expect(createQuickTestSetup).toBeDefined();
    expect(typeof createQuickTestSetup).toBe('function');
  });

  it('should have all required facade and server exports', async () => {
    const {
      MockMCPServerFacade,
      MockMCPServer,
      createSimpleMockServer,
      createErrorMockServer,
      createSlowMockServer,
    } = await import('../index.js');

    expect(MockMCPServerFacade).toBeDefined();
    expect(MockMCPServer).toBeDefined();
    expect(createSimpleMockServer).toBeDefined();
    expect(createErrorMockServer).toBeDefined();
    expect(createSlowMockServer).toBeDefined();
  });

  it('should have all required type exports', async () => {
    // Import to ensure types are accessible
    const module = await import('../index.js');

    // The module should be importable without errors
    expect(module).toBeDefined();

    // Test type exports through dynamic import for runtime verification
    const typesModule = await import('../types.js');
    expect(typesModule.MockAssertionError).toBeDefined();
  });
});