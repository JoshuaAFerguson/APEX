/**
 * @fileoverview Documentation coverage validation tests
 *
 * These tests ensure that the usage examples comprehensively demonstrate
 * all major features of the MockMCPServerBuilder, providing complete
 * coverage for documentation and learning purposes.
 */

import { describe, it, expect } from 'vitest';
import {
  createBuilderWithStaticResponses,
  createBuilderWithDynamicHandlers,
  createBuilderWithResponseSequences,
  createComprehensiveBuilderExample,
} from '../usage-examples.js';

describe('Documentation Coverage Validation', () => {
  describe('Feature Coverage Analysis', () => {
    it('should demonstrate all basic configuration features', () => {
      const servers = [
        createBuilderWithStaticResponses(),
        createBuilderWithDynamicHandlers(),
        createBuilderWithResponseSequences(),
        createComprehensiveBuilderExample(),
      ];

      // Collect all server configurations
      const definitions = servers.map(server => server.getDefinition());

      // Verify server naming is demonstrated
      const serverNames = definitions.map(def => def.serverConfig.name);
      expect(serverNames).toContain('static-response-server');
      expect(serverNames).toContain('dynamic-handler-server');
      expect(serverNames).toContain('sequence-server');
      expect(serverNames).toContain('comprehensive-server');

      // Verify transport configuration is shown
      const transports = definitions.map(def => def.serverConfig.transport);
      expect(transports).toContain('stdio'); // Default and explicit

      // Verify capabilities are demonstrated
      const capabilityDefs = definitions.filter(def =>
        def.serverConfig.capabilities &&
        Object.keys(def.serverConfig.capabilities).length > 0
      );
      expect(capabilityDefs.length).toBeGreaterThan(0);
    });

    it('should demonstrate all tool handler types', () => {
      const comprehensive = createComprehensiveBuilderExample();
      const definition = comprehensive.getDefinition();

      // Static handlers
      const staticHandlers = definition.defaultBehavior.toolHandlers || [];
      expect(staticHandlers.length).toBeGreaterThan(0);

      // Dynamic handlers
      const dynamicHandlers = definition.defaultBehavior.dynamicHandlers || [];
      expect(dynamicHandlers.length).toBeGreaterThan(0);

      // Response sequences
      const responseSequences = definition.defaultBehavior.responseSequences || [];
      expect(responseSequences.length).toBeGreaterThan(0);

      // Verify different sequence modes are shown
      const static_ = createBuilderWithStaticResponses();
      const dynamic = createBuilderWithDynamicHandlers();
      const sequence = createBuilderWithResponseSequences();

      expect(static_.getDefinition().defaultBehavior.toolHandlers?.length).toBeGreaterThan(0);
      expect(dynamic.getDefinition().defaultBehavior.dynamicHandlers?.length).toBeGreaterThan(0);
      expect(sequence.getDefinition().defaultBehavior.responseSequences?.length).toBeGreaterThan(0);
    });

    it('should demonstrate delay configuration patterns', () => {
      const servers = [
        createBuilderWithStaticResponses(),
        createBuilderWithDynamicHandlers(),
        createComprehensiveBuilderExample(),
      ];

      const definitions = servers.map(server => server.getDefinition());

      // All should have delay configuration
      for (const def of definitions) {
        expect(def.defaultBehavior.responseDelay).toBeDefined();
      }

      // Comprehensive should show per-method delays
      const comprehensiveDef = createComprehensiveBuilderExample().getDefinition();
      expect(comprehensiveDef.defaultBehavior.responseDelay?.perMethod).toBeDefined();
      expect(Object.keys(comprehensiveDef.defaultBehavior.responseDelay?.perMethod || {})).toContain('initialize');
    });

    it('should demonstrate error injection capabilities', () => {
      const comprehensive = createComprehensiveBuilderExample();
      const definition = comprehensive.getDefinition();

      expect(definition.defaultBehavior.errorInjection).toBeDefined();
      expect(definition.defaultBehavior.errorInjection?.enabled).toBe(true);
      expect(definition.defaultBehavior.errorInjection?.probability).toBe(0.1);
      expect(definition.defaultBehavior.errorInjection?.afterRequestCount).toBe(5);
    });

    it('should demonstrate scenario management', () => {
      const comprehensive = createComprehensiveBuilderExample();
      const definition = comprehensive.getDefinition();

      expect(definition.scenarios).toHaveLength(3);

      const scenarioNames = definition.scenarios.map(s => s.name);
      expect(scenarioNames).toContain('fast-mode');
      expect(scenarioNames).toContain('slow-mode');
      expect(scenarioNames).toContain('error-prone');

      // Verify scenarios have different configurations
      const fastScenario = definition.scenarios.find(s => s.name === 'fast-mode');
      const slowScenario = definition.scenarios.find(s => s.name === 'slow-mode');
      const errorScenario = definition.scenarios.find(s => s.name === 'error-prone');

      expect(fastScenario?.behaviorConfig.errorInjection?.enabled).toBe(false);
      expect(slowScenario?.behaviorConfig.responseDelay?.minMs).toBe(500);
      expect(errorScenario?.behaviorConfig.errorInjection?.probability).toBe(0.3);
    });

    it('should demonstrate response sequence modes', () => {
      const sequence = createBuilderWithResponseSequences();
      const definition = sequence.getDefinition();

      const sequences = definition.defaultBehavior.responseSequences || [];
      expect(sequences.length).toBeGreaterThan(0);

      // Should demonstrate different cycle modes
      const cycleModes = sequences.map(seq => seq.cycleMode);
      expect(cycleModes).toContain('repeat_last');
      expect(cycleModes).toContain('cycle');
      expect(cycleModes).toContain('repeat_all');
    });

    it('should provide realistic usage patterns', () => {
      // Static responses example should show typical file system operations
      const static_ = createBuilderWithStaticResponses();
      const staticDef = static_.getDefinition();
      const staticTools = staticDef.defaultBehavior.toolHandlers?.map(h => h.toolName) || [];
      expect(staticTools).toContain('read_file');
      expect(staticTools).toContain('list_files');

      // Dynamic handlers should show computational examples
      const dynamic = createBuilderWithDynamicHandlers();
      const dynamicDef = dynamic.getDefinition();
      const dynamicTools = dynamicDef.defaultBehavior.dynamicHandlers?.map(h => h.toolName) || [];
      expect(dynamicTools).toContain('calculate');
      expect(dynamicTools).toContain('echo');

      // Sequences should show stateful operations
      const sequence = createBuilderWithResponseSequences();
      const sequenceDef = sequence.getDefinition();
      const sequenceTools = sequenceDef.defaultBehavior.responseSequences?.map(s => s.toolName) || [];
      expect(sequenceTools).toContain('get_status');
      expect(sequenceTools).toContain('startup_sequence');
    });
  });

  describe('Code Quality and Documentation Standards', () => {
    it('should have descriptive server names and descriptions', () => {
      const comprehensive = createComprehensiveBuilderExample();
      const definition = comprehensive.getDefinition();

      expect(definition.serverConfig.name).toBe('comprehensive-server');
      expect(definition.serverConfig.description).toContain('Full-featured server');
    });

    it('should demonstrate error handling patterns', () => {
      // Dynamic handlers should show error cases
      const dynamic = createBuilderWithDynamicHandlers();

      // This is tested functionally in other test files, but we verify
      // the configuration exists to demonstrate error patterns
      const definition = dynamic.getDefinition();
      expect(definition.defaultBehavior.dynamicHandlers?.length).toBeGreaterThan(0);
    });

    it('should show progressive complexity', () => {
      const examples = [
        { name: 'static', server: createBuilderWithStaticResponses() },
        { name: 'dynamic', server: createBuilderWithDynamicHandlers() },
        { name: 'sequence', server: createBuilderWithResponseSequences() },
        { name: 'comprehensive', server: createComprehensiveBuilderExample() },
      ];

      // Complexity should increase through the examples
      const complexityMetrics = examples.map(example => {
        const def = example.server.getDefinition();
        return {
          name: example.name,
          staticHandlers: def.defaultBehavior.toolHandlers?.length || 0,
          dynamicHandlers: def.defaultBehavior.dynamicHandlers?.length || 0,
          sequences: def.defaultBehavior.responseSequences?.length || 0,
          scenarios: def.scenarios.length,
          hasDelayConfig: !!def.defaultBehavior.responseDelay,
          hasErrorInjection: !!def.defaultBehavior.errorInjection?.enabled,
        };
      });

      // Static example: simple, few features
      const staticMetric = complexityMetrics.find(m => m.name === 'static');
      expect(staticMetric?.staticHandlers).toBeGreaterThan(0);
      expect(staticMetric?.dynamicHandlers).toBe(0);
      expect(staticMetric?.scenarios).toBe(0);

      // Dynamic example: more complex, introduces dynamic handlers
      const dynamicMetric = complexityMetrics.find(m => m.name === 'dynamic');
      expect(dynamicMetric?.dynamicHandlers).toBeGreaterThan(0);

      // Sequence example: introduces stateful behavior
      const sequenceMetric = complexityMetrics.find(m => m.name === 'sequence');
      expect(sequenceMetric?.sequences).toBeGreaterThan(0);

      // Comprehensive: all features
      const compMetric = complexityMetrics.find(m => m.name === 'comprehensive');
      expect(compMetric?.staticHandlers).toBeGreaterThan(0);
      expect(compMetric?.dynamicHandlers).toBeGreaterThan(0);
      expect(compMetric?.sequences).toBeGreaterThan(0);
      expect(compMetric?.scenarios).toBeGreaterThan(0);
      expect(compMetric?.hasErrorInjection).toBe(true);
    });

    it('should provide complete API coverage in examples', () => {
      // Collect all the builder methods demonstrated across examples
      const comprehensive = createComprehensiveBuilderExample();
      const definition = comprehensive.getDefinition();

      // Core configuration methods
      expect(definition.serverConfig.name).toBeTruthy();
      expect(definition.serverConfig.transport).toBeTruthy();
      expect(definition.serverConfig.capabilities).toBeTruthy();

      // Tool configuration methods
      expect(definition.defaultBehavior.toolHandlers?.length).toBeGreaterThan(0);
      expect(definition.defaultBehavior.dynamicHandlers?.length).toBeGreaterThan(0);
      expect(definition.defaultBehavior.responseSequences?.length).toBeGreaterThan(0);

      // Delay configuration methods
      expect(definition.defaultBehavior.responseDelay).toBeTruthy();
      expect(definition.defaultBehavior.responseDelay?.perMethod).toBeTruthy();

      // Error injection methods
      expect(definition.defaultBehavior.errorInjection).toBeTruthy();

      // Scenario methods
      expect(definition.scenarios.length).toBeGreaterThan(0);

      // This validates that the comprehensive example demonstrates
      // the full range of builder capabilities
    });
  });

  describe('Usage Pattern Validation', () => {
    it('should demonstrate proper fluent API usage', () => {
      // All examples should use method chaining effectively
      // This is validated by the fact that the examples compile and run
      const examples = [
        createBuilderWithStaticResponses,
        createBuilderWithDynamicHandlers,
        createBuilderWithResponseSequences,
        createComprehensiveBuilderExample,
      ];

      for (const createExample of examples) {
        expect(() => {
          const server = createExample();
          expect(server).toBeDefined();
        }).not.toThrow();
      }
    });

    it('should show realistic test scenarios', () => {
      // Examples should represent real-world testing needs

      // File system simulation
      const staticServer = createBuilderWithStaticResponses();
      const staticTools = staticServer.getDefinition().defaultBehavior.toolHandlers?.map(h => h.toolName) || [];
      expect(staticTools).toEqual(expect.arrayContaining(['read_file', 'get_info', 'list_files']));

      // Computational services
      const dynamicServer = createBuilderWithDynamicHandlers();
      const dynamicTools = dynamicServer.getDefinition().defaultBehavior.dynamicHandlers?.map(h => h.toolName) || [];
      expect(dynamicTools).toEqual(expect.arrayContaining(['calculate', 'echo']));

      // Stateful processes
      const sequenceServer = createBuilderWithResponseSequences();
      const sequenceTools = sequenceServer.getDefinition().defaultBehavior.responseSequences?.map(s => s.toolName) || [];
      expect(sequenceTools).toEqual(expect.arrayContaining(['get_status', 'next_item', 'countdown']));
    });

    it('should provide patterns for different testing needs', () => {
      // Each example serves a specific testing purpose:

      // 1. Static: Fast, predictable responses for unit tests
      const static_ = createBuilderWithStaticResponses();
      const staticDelay = static_.getDefinition().defaultBehavior.responseDelay?.fixedMs;
      expect(staticDelay).toBe(50); // Fast but not instant

      // 2. Dynamic: Complex logic testing
      const dynamic = createBuilderWithDynamicHandlers();
      const dynamicHandlers = dynamic.getDefinition().defaultBehavior.dynamicHandlers || [];
      expect(dynamicHandlers.length).toBeGreaterThan(0);

      // 3. Sequence: Stateful interaction testing
      const sequence = createBuilderWithResponseSequences();
      const sequences = sequence.getDefinition().defaultBehavior.responseSequences || [];
      expect(sequences.length).toBeGreaterThan(0);

      // 4. Comprehensive: Integration and robustness testing
      const comprehensive = createComprehensiveBuilderExample();
      const compDef = comprehensive.getDefinition();
      expect(compDef.defaultBehavior.errorInjection?.enabled).toBe(true);
      expect(compDef.scenarios.length).toBeGreaterThan(0);
    });
  });
});