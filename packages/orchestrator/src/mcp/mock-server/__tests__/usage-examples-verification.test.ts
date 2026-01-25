/**
 * @fileoverview Verification tests for builder pattern usage examples
 *
 * These tests verify that the new builder pattern examples in usage-examples.ts
 * can be instantiated without errors and return proper MockMCPServerFacade instances.
 */

import {
  createBuilderWithStaticResponses,
  createBuilderWithDynamicHandlers,
  createBuilderWithResponseSequences,
  createComprehensiveBuilderExample,
} from '../usage-examples.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';

describe('Usage Examples - Builder Pattern Verification', () => {
  describe('createBuilderWithStaticResponses', () => {
    it('should create a MockMCPServerFacade with static responses', () => {
      const server = createBuilderWithStaticResponses();
      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.getDefinition().serverConfig.name).toBe('static-response-server');
    });
  });

  describe('createBuilderWithDynamicHandlers', () => {
    it('should create a MockMCPServerFacade with dynamic handlers', () => {
      const server = createBuilderWithDynamicHandlers();
      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.getDefinition().serverConfig.name).toBe('dynamic-handler-server');
    });
  });

  describe('createBuilderWithResponseSequences', () => {
    it('should create a MockMCPServerFacade with response sequences', () => {
      const server = createBuilderWithResponseSequences();
      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.getDefinition().serverConfig.name).toBe('sequence-server');
    });
  });

  describe('createComprehensiveBuilderExample', () => {
    it('should create a MockMCPServerFacade with comprehensive configuration', () => {
      const server = createComprehensiveBuilderExample();
      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.getDefinition().serverConfig.name).toBe('comprehensive-server');
    });
  });

  describe('All builder examples', () => {
    it('should create servers with proper tool definitions', () => {
      const staticServer = createBuilderWithStaticResponses();
      const dynamicServer = createBuilderWithDynamicHandlers();
      const sequenceServer = createBuilderWithResponseSequences();
      const comprehensiveServer = createComprehensiveBuilderExample();

      // Verify static server has expected tools
      const staticDefinition = staticServer.getDefinition();
      const staticToolNames = staticDefinition.defaultBehavior.toolHandlers.map(h => h.toolName);
      expect(staticToolNames).toContain('read_file');
      expect(staticToolNames).toContain('get_info');
      expect(staticToolNames).toContain('list_files');

      // Verify dynamic server has expected tools
      const dynamicDefinition = dynamicServer.getDefinition();
      const dynamicToolNames = dynamicDefinition.defaultBehavior.toolHandlers.map(h => h.toolName);
      expect(dynamicToolNames).toContain('calculate');
      expect(dynamicToolNames).toContain('echo');

      // Verify sequence server has expected tools
      const sequenceDefinition = sequenceServer.getDefinition();
      const sequenceToolNames = sequenceDefinition.defaultBehavior.toolHandlers.map(h => h.toolName);
      expect(sequenceToolNames).toContain('get_status');
      expect(sequenceToolNames).toContain('next_item');
      expect(sequenceToolNames).toContain('countdown');

      // Verify comprehensive server has expected tools
      const comprehensiveDefinition = comprehensiveServer.getDefinition();
      const comprehensiveToolNames = comprehensiveDefinition.defaultBehavior.toolHandlers.map(h => h.toolName);
      expect(comprehensiveToolNames).toContain('get_version');
      expect(comprehensiveToolNames).toContain('process_data');
      expect(comprehensiveToolNames).toContain('startup_sequence');
    });

    it('should demonstrate different builder features correctly', () => {
      // Test static responses
      const staticServer = createBuilderWithStaticResponses();
      const staticDefinition = staticServer.getDefinition();
      const readFileHandler = staticDefinition.defaultBehavior.toolHandlers.find(h => h.toolName === 'read_file');
      expect(readFileHandler?.response?.content[0].text).toBe('Static file content from builder');

      // Test comprehensive server has scenarios
      const comprehensiveServer = createComprehensiveBuilderExample();
      const comprehensiveDefinition = comprehensiveServer.getDefinition();
      expect(comprehensiveDefinition.scenarios).toBeDefined();
      expect(comprehensiveDefinition.scenarios.length).toBeGreaterThan(0);

      const scenarioNames = comprehensiveDefinition.scenarios.map(s => s.name);
      expect(scenarioNames).toContain('fast-mode');
      expect(scenarioNames).toContain('slow-mode');
      expect(scenarioNames).toContain('error-prone');
    });
  });
});