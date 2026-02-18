/**
 * @fileoverview Tool registration and system integration tests for NotebookEditTool
 *
 * These tests verify that the NotebookEditTool integrates properly with the
 * APEX tool registry system, can be registered and discovered correctly,
 * and works within the broader APEX ecosystem.
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool.registration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry, DuplicateToolError } from '../../tool-registry.js';
import {
  NotebookEditTool,
  type NotebookEditParams
} from '../notebook-edit-tool.js';
import {
  registerFilesystemTools,
  registerNotebookEditTool,
  createNotebookEditTool
} from '../register.js';
import type { ToolDefinition, ToolExecutionResult } from '../../../types.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotebookEditTool - Registration and System Integration', () => {
  let registry: ToolRegistry;
  let tempDir: string;

  beforeEach(async () => {
    registry = new ToolRegistry();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-registration-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper function to create a test notebook
  const createTestNotebook = async (filename: string = 'test.ipynb') => {
    const notebookPath = path.join(tempDir, filename);
    const notebook = {
      cells: [
        {
          cell_type: 'code',
          id: 'test-cell-1',
          source: ['print("Hello, World!")'],
          metadata: {},
          execution_count: null,
          outputs: []
        }
      ],
      metadata: { kernelspec: { name: 'python3' } },
      nbformat: 4,
      nbformat_minor: 4
    };
    await fs.writeFile(notebookPath, JSON.stringify(notebook, null, 2));
    return notebookPath;
  };

  // ============================================================================
  // Basic Registration Tests
  // ============================================================================

  describe('Basic Registration', () => {
    it('should register NotebookEditTool successfully', () => {
      const tool = new NotebookEditTool();

      expect(() => registry.register(tool)).not.toThrow();
      expect(registry.has('NotebookEdit')).toBe(true);

      const retrievedTool = registry.get('NotebookEdit');
      expect(retrievedTool).toBe(tool);
    });

    it('should register using convenience function', () => {
      // Mock the getToolRegistry to return our test registry
      const originalGetToolRegistry = require('../../tool-registry.js').getToolRegistry;
      const mockGetToolRegistry = () => registry;

      // Temporarily replace the function
      require('../../tool-registry.js').getToolRegistry = mockGetToolRegistry;

      try {
        registerNotebookEditTool();
        expect(registry.has('NotebookEdit')).toBe(true);
      } finally {
        // Restore original function
        require('../../tool-registry.js').getToolRegistry = originalGetToolRegistry;
      }
    });

    it('should create tool instances correctly', () => {
      const tool1 = createNotebookEditTool();
      const tool2 = createNotebookEditTool();

      expect(tool1).toBeInstanceOf(NotebookEditTool);
      expect(tool2).toBeInstanceOf(NotebookEditTool);
      expect(tool1).not.toBe(tool2); // Should be different instances
    });

    it('should prevent duplicate registration', () => {
      const tool1 = new NotebookEditTool();
      const tool2 = new NotebookEditTool();

      registry.register(tool1);
      expect(() => registry.register(tool2)).toThrow(DuplicateToolError);
    });

    it('should register with filesystem tools bundle', () => {
      // Mock the getToolRegistry to return our test registry
      const originalGetToolRegistry = require('../../tool-registry.js').getToolRegistry;
      const mockGetToolRegistry = () => registry;

      require('../../tool-registry.js').getToolRegistry = mockGetToolRegistry;

      try {
        registerFilesystemTools();

        // Should have all filesystem tools including NotebookEdit
        expect(registry.has('NotebookEdit')).toBe(true);
        expect(registry.has('Read')).toBe(true);
        expect(registry.has('Write')).toBe(true);
        expect(registry.has('Edit')).toBe(true);
        expect(registry.has('Glob')).toBe(true);
        expect(registry.has('MultiEdit')).toBe(true);
      } finally {
        require('../../tool-registry.js').getToolRegistry = originalGetToolRegistry;
      }
    });
  });

  // ============================================================================
  // Tool Definition Validation Tests
  // ============================================================================

  describe('Tool Definition Validation', () => {
    it('should have valid tool definition structure', () => {
      const tool = new NotebookEditTool();
      const definition = tool.getDefinition();

      // Basic structure validation
      expect(definition).toBeDefined();
      expect(typeof definition.name).toBe('string');
      expect(typeof definition.description).toBe('string');
      expect(typeof definition.category).toBe('string');
      expect(Array.isArray(definition.permissions)).toBe(true);
      expect(typeof definition.dangerous).toBe('boolean');
      expect(typeof definition.version).toBe('string');
      expect(typeof definition.enabled).toBe('boolean');
      expect(Array.isArray(definition.tags)).toBe(true);
      expect(typeof definition.parameters).toBe('object');
      expect(Array.isArray(definition.examples)).toBe(true);
    });

    it('should have correct tool metadata', () => {
      const tool = new NotebookEditTool();
      const definition = tool.getDefinition();

      expect(definition.name).toBe('NotebookEdit');
      expect(definition.description).toContain('Jupyter notebook');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toEqual(['read', 'write']);
      expect(definition.dangerous).toBe(false);
      expect(definition.version).toBe('1.0.0');
      expect(definition.enabled).toBe(true);
    });

    it('should have appropriate tags', () => {
      const tool = new NotebookEditTool();
      const definition = tool.getDefinition();

      expect(definition.tags).toContain('notebook');
      expect(definition.tags).toContain('jupyter');
      expect(definition.tags).toContain('edit');
      expect(definition.tags).toContain('cell');
      expect(definition.tags).toContain('ipynb');
      expect(definition.tags).toContain('filesystem');
    });

    it('should have valid parameter schema', () => {
      const tool = new NotebookEditTool();
      const definition = tool.getDefinition();
      const schema = definition.parameters;

      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['notebook_path', 'new_source']);
      expect(schema.additionalProperties).toBe(false);

      // Validate individual parameters
      expect(schema.properties?.notebook_path?.type).toBe('string');
      expect(schema.properties?.new_source?.type).toBe('string');
      expect(schema.properties?.cell_id?.type).toBe('string');
      expect(schema.properties?.cell_type?.enum).toEqual(['code', 'markdown', 'raw']);
      expect(schema.properties?.edit_mode?.enum).toEqual(['replace', 'insert', 'delete']);
    });

    it('should have comprehensive examples', () => {
      const tool = new NotebookEditTool();
      const definition = tool.getDefinition();

      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThanOrEqual(4);

      // Check that examples cover main operations
      const exampleModes = definition.examples!.map(ex =>
        (ex.input as any).edit_mode || 'replace'
      );
      expect(exampleModes).toContain('replace');
      expect(exampleModes).toContain('insert');
      expect(exampleModes).toContain('delete');

      // Validate example structure
      definition.examples!.forEach(example => {
        expect(example.name).toBeTruthy();
        expect(example.description).toBeTruthy();
        expect(example.input).toBeDefined();

        // Input should be valid parameters
        const input = example.input as NotebookEditParams;
        expect(input.notebook_path).toBeTruthy();
        expect(input.new_source).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Registry Integration Tests
  // ============================================================================

  describe('Registry Integration', () => {
    it('should be discoverable in registry listings', () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const allTools = registry.list();
      const notebookTool = allTools.find(t => t.name === 'NotebookEdit');

      expect(notebookTool).toBeDefined();
      expect(notebookTool!.category).toBe('filesystem');
      expect(notebookTool!.permissions).toEqual(['read', 'write']);
    });

    it('should be filterable by category', () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const filesystemTools = registry.list().filter(t => t.category === 'filesystem');
      const notebookTool = filesystemTools.find(t => t.name === 'NotebookEdit');

      expect(notebookTool).toBeDefined();
    });

    it('should be filterable by tags', () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const allTools = registry.list();
      const notebookTools = allTools.filter(t => t.tags?.includes('notebook'));

      expect(notebookTools.length).toBeGreaterThan(0);
      expect(notebookTools.some(t => t.name === 'NotebookEdit')).toBe(true);
    });

    it('should support tool discovery by capabilities', () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const allTools = registry.list();
      const writeTools = allTools.filter(t => t.permissions?.includes('write'));
      const notebookWriteTools = writeTools.filter(t => t.tags?.includes('notebook'));

      expect(notebookWriteTools.length).toBe(1);
      expect(notebookWriteTools[0].name).toBe('NotebookEdit');
    });

    it('should work with registry execution methods', async () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const notebookPath = await createTestNotebook();

      // Test execution through registry
      const retrievedTool = registry.get('NotebookEdit');
      const result = await retrievedTool.execute({
        notebook_path: notebookPath,
        cell_id: 'test-cell-1',
        new_source: 'print("Updated via registry")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify the change was made
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].source.join('')).toContain('Updated via registry');
    });
  });

  // ============================================================================
  // System Integration Tests
  // ============================================================================

  describe('System Integration', () => {
    it('should integrate with tool execution context', async () => {
      const tool = new NotebookEditTool();
      const notebookPath = await createTestNotebook();

      const context = {
        user: 'test-user',
        sessionId: 'test-session-123',
        permissions: ['read', 'write'] as const,
        workingDirectory: tempDir
      };

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'test-cell-1',
        new_source: 'print("Context test")',
        edit_mode: 'replace'
      }, context);

      expect(result.success).toBe(true);
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(typeof result.duration).toBe('number');
    });

    it('should validate permissions through execution context', async () => {
      const tool = new NotebookEditTool();
      const notebookPath = await createTestNotebook();

      // Context with insufficient permissions
      const limitedContext = {
        user: 'limited-user',
        sessionId: 'test-session-456',
        permissions: ['read'] as const, // Missing 'write' permission
        workingDirectory: tempDir
      };

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'test-cell-1',
        new_source: 'print("Should fail")',
        edit_mode: 'replace'
      }, limitedContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient permissions');
    });

    it('should work within APEX workflow context', async () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const notebookPath = await createTestNotebook();

      // Simulate APEX workflow execution
      const workflowContext = {
        user: 'apex-system',
        sessionId: 'workflow-789',
        permissions: ['read', 'write'] as const,
        workingDirectory: tempDir,
        workflow: {
          id: 'test-workflow',
          step: 'data-preparation',
          agent: 'tester'
        }
      };

      const operations = [
        {
          notebook_path: notebookPath,
          new_source: '# Data Preparation\n\nThis notebook is used for data preparation in the testing workflow.',
          cell_type: 'markdown' as const,
          edit_mode: 'insert' as const
        },
        {
          notebook_path: notebookPath,
          cell_id: 'test-cell-1',
          new_source: 'import pandas as pd\nimport numpy as np\nprint("Libraries imported")',
          edit_mode: 'replace' as const
        }
      ];

      const results = await Promise.all(
        operations.map(params => tool.execute(params, workflowContext))
      );

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify notebook structure
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells).toHaveLength(2);
      expect(finalNotebook.cells[0].source.join('')).toContain('Data Preparation');
      expect(finalNotebook.cells[1].source.join('')).toContain('import pandas');
    });

    it('should support tool chaining with other filesystem tools', async () => {
      // Register multiple tools
      const notebookTool = new NotebookEditTool();
      const readTool = require('../read-tool.js').ReadTool;
      const writeTool = require('../write-tool.js').WriteTool;

      registry.register(notebookTool);
      registry.register(new readTool());
      registry.register(new writeTool());

      const notebookPath = await createTestNotebook();

      // Chain operations: Create data file -> Update notebook -> Read result

      // 1. Create a data file
      const dataPath = path.join(tempDir, 'data.csv');
      const dataResult = await registry.get('Write').execute({
        file_path: dataPath,
        content: 'name,value\ntest,123\nexample,456'
      });
      expect(dataResult.success).toBe(true);

      // 2. Update notebook to reference the data file
      const notebookResult = await notebookTool.execute({
        notebook_path: notebookPath,
        cell_id: 'test-cell-1',
        new_source: `# Load data from file\ndf = pd.read_csv("${dataPath}")\nprint(f"Loaded {len(df)} rows")`,
        edit_mode: 'replace'
      });
      expect(notebookResult.success).toBe(true);

      // 3. Read back the notebook to verify
      const readResult = await registry.get('Read').execute({
        file_path: notebookPath
      });
      expect(readResult.success).toBe(true);
      expect(readResult.output).toContain('pd.read_csv');
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error Handling in Registry Context', () => {
    it('should handle registry-related errors gracefully', () => {
      const tool = new NotebookEditTool();

      // Test getting unregistered tool
      expect(() => registry.get('NotebookEdit')).toThrow();

      // Register tool
      registry.register(tool);

      // Test successful retrieval
      expect(() => registry.get('NotebookEdit')).not.toThrow();

      // Test duplicate registration
      expect(() => registry.register(new NotebookEditTool())).toThrow(DuplicateToolError);
    });

    it('should provide detailed error information in registry context', async () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const nonExistentPath = path.join(tempDir, 'nonexistent.ipynb');

      const result = await tool.execute({
        notebook_path: nonExistentPath,
        cell_id: 'test',
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read notebook');
      expect(result.error).toContain(nonExistentPath);
    });

    it('should handle tool metadata validation errors', () => {
      // Create a mock invalid tool
      class InvalidTool extends NotebookEditTool {
        getDefinition(): ToolDefinition {
          return {
            ...super.getDefinition(),
            name: '', // Invalid empty name
          };
        }
      }

      const invalidTool = new InvalidTool();

      // Registry should reject tools with invalid definitions
      expect(() => registry.register(invalidTool)).toThrow();
    });

    it('should maintain registry state consistency after errors', () => {
      const tool1 = new NotebookEditTool();
      const tool2 = new NotebookEditTool();

      // Register first tool successfully
      registry.register(tool1);
      expect(registry.has('NotebookEdit')).toBe(true);

      // Attempt to register duplicate (should fail)
      expect(() => registry.register(tool2)).toThrow(DuplicateToolError);

      // Registry should still have the first tool
      expect(registry.has('NotebookEdit')).toBe(true);
      expect(registry.get('NotebookEdit')).toBe(tool1);
    });
  });

  // ============================================================================
  // Performance in Registry Context
  // ============================================================================

  describe('Performance in Registry Context', () => {
    it('should not degrade performance when accessed through registry', async () => {
      const directTool = new NotebookEditTool();
      const registryTool = new NotebookEditTool();
      registry.register(registryTool);

      const notebookPath1 = await createTestNotebook('direct.ipynb');
      const notebookPath2 = await createTestNotebook('registry.ipynb');

      // Time direct access
      const directStart = performance.now();
      await directTool.execute({
        notebook_path: notebookPath1,
        cell_id: 'test-cell-1',
        new_source: 'print("direct")',
        edit_mode: 'replace'
      });
      const directDuration = performance.now() - directStart;

      // Time registry access
      const registryStart = performance.now();
      await registry.get('NotebookEdit').execute({
        notebook_path: notebookPath2,
        cell_id: 'test-cell-1',
        new_source: 'print("registry")',
        edit_mode: 'replace'
      });
      const registryDuration = performance.now() - registryStart;

      // Registry access should not be significantly slower (less than 50% overhead)
      expect(registryDuration).toBeLessThan(directDuration * 1.5);

      console.log(`Direct: ${directDuration.toFixed(2)}ms, Registry: ${registryDuration.toFixed(2)}ms`);
    });

    it('should handle concurrent registry operations efficiently', async () => {
      const tool = new NotebookEditTool();
      registry.register(tool);

      const notebooks = await Promise.all([
        createTestNotebook('concurrent1.ipynb'),
        createTestNotebook('concurrent2.ipynb'),
        createTestNotebook('concurrent3.ipynb')
      ]);

      const startTime = performance.now();

      const operations = notebooks.map((notebookPath, index) =>
        registry.get('NotebookEdit').execute({
          notebook_path: notebookPath,
          cell_id: 'test-cell-1',
          new_source: `print("concurrent operation ${index}")`,
          edit_mode: 'replace'
        })
      );

      const results = await Promise.all(operations);
      const totalDuration = performance.now() - startTime;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(totalDuration).toBeLessThan(1000); // Less than 1 second

      console.log(`Concurrent registry operations (3): ${totalDuration.toFixed(2)}ms`);
    });
  });
});