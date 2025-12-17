/**
 * Test runner validation script for new ThoughtDisplay integration tests
 * This script validates our test files can be parsed and imports work correctly
 */

import { describe, it, expect } from 'vitest';

describe('ThoughtDisplay Integration Test Validation', () => {
  it('should be able to import AgentPanel component', async () => {
    const { AgentPanel } = await import('../AgentPanel');
    expect(AgentPanel).toBeDefined();
    expect(typeof AgentPanel).toBe('function');
  });

  it('should be able to import ThoughtDisplay component', async () => {
    const { ThoughtDisplay } = await import('../../ThoughtDisplay');
    expect(ThoughtDisplay).toBeDefined();
    expect(typeof ThoughtDisplay).toBe('function');
  });

  it('should be able to import AgentThoughts component', async () => {
    const { AgentThoughts } = await import('../../AgentThoughts');
    expect(AgentThoughts).toBeDefined();
    expect(typeof AgentThoughts).toBe('function');
  });

  it('should validate ThoughtDisplayProps interface', async () => {
    const { ThoughtDisplay } = await import('../../ThoughtDisplay');

    // Test that component accepts required props without error
    const minimalProps = {
      thinking: 'test',
      agent: 'test-agent',
    };

    expect(() => {
      // This is a type check - if it compiles, the interface is correct
      const element = ThoughtDisplay(minimalProps);
      expect(element).toBeDefined();
    }).not.toThrow();
  });

  it('should validate AgentInfo interface with thinking', async () => {
    const { AgentPanel } = await import('../AgentPanel');

    const minimalAgentWithThinking = {
      name: 'test-agent',
      status: 'active' as const,
      debugInfo: {
        thinking: 'test thinking content',
      },
    };

    const props = {
      agents: [minimalAgentWithThinking],
      currentAgent: 'test-agent',
      showThoughts: true,
    };

    expect(() => {
      const element = AgentPanel(props);
      expect(element).toBeDefined();
    }).not.toThrow();
  });

  it('should validate test utilities are available', async () => {
    const testUtils = await import('../../../__tests__/test-utils');

    expect(testUtils.render).toBeDefined();
    expect(testUtils.screen).toBeDefined();
    expect(testUtils.waitFor).toBeDefined();
    expect(typeof testUtils.render).toBe('function');
  });
});