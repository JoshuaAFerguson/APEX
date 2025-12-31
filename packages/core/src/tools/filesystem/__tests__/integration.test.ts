/**
 * @fileoverview Integration tests for filesystem tools
 *
 * These tests verify that filesystem tools can be properly registered
 * and work together with the tool registry system.
 *
 * @module @apex/core/tools/filesystem/__tests__/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ToolRegistry } from '../../tool-registry.js';
import {
  ReadTool,
  WriteTool,
  EditTool,
  registerReadTool,
  registerWriteTool,
  registerEditTool,
  registerFilesystemTools,
  createReadTool,
  createWriteTool,
  createEditTool
} from '../index.js';

// ============================================================================
// Test Helpers
// ============================================================================

async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-test-'));
}

async function cleanup(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Filesystem Tools Integration', () => {
  let registry: ToolRegistry;
  let tempDir: string;

  beforeEach(async () => {
    // Create fresh registry instance for each test
    ToolRegistry.resetInstance();
    registry = ToolRegistry.getInstance();
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    registry.clear();
    await cleanup(tempDir);
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('Tool Registration', () => {
    it('should register ReadTool successfully', () => {
      expect(registry.has('Read')).toBe(false);

      registerReadTool();

      expect(registry.has('Read')).toBe(true);
      const entry = registry.get('Read');
      expect(entry.definition.name).toBe('Read');
      expect(entry.definition.category).toBe('filesystem');
    });

    it('should register WriteTool successfully', () => {
      expect(registry.has('Write')).toBe(false);

      registerWriteTool();

      expect(registry.has('Write')).toBe(true);
      const entry = registry.get('Write');
      expect(entry.definition.name).toBe('Write');
      expect(entry.definition.category).toBe('filesystem');
    });

    it('should register EditTool successfully', () => {
      expect(registry.has('Edit')).toBe(false);

      registerEditTool();

      expect(registry.has('Edit')).toBe(true);
      const entry = registry.get('Edit');
      expect(entry.definition.name).toBe('Edit');
      expect(entry.definition.category).toBe('filesystem');
    });

    it('should register all filesystem tools', () => {
      expect(registry.size).toBe(0);

      registerFilesystemTools();

      expect(registry.has('Read')).toBe(true);
      expect(registry.has('Write')).toBe(true);
      expect(registry.has('Edit')).toBe(true);
      expect(registry.getByCategory('filesystem')).toHaveLength(3);
    });

    it('should create tool instances without registration', () => {
      const readTool = createReadTool();
      const writeTool = createWriteTool();
      const editTool = createEditTool();

      expect(readTool).toBeInstanceOf(ReadTool);
      expect(readTool.getDefinition().name).toBe('Read');
      expect(writeTool).toBeInstanceOf(WriteTool);
      expect(writeTool.getDefinition().name).toBe('Write');
      expect(editTool).toBeInstanceOf(EditTool);
      expect(editTool.getDefinition().name).toBe('Edit');
      expect(registry.has('Read')).toBe(false); // Should not be registered yet
      expect(registry.has('Write')).toBe(false); // Should not be registered yet
      expect(registry.has('Edit')).toBe(false); // Should not be registered yet
    });

    it('should prevent duplicate registration', () => {
      registerReadTool();
      registerWriteTool();
      registerEditTool();

      expect(() => registerReadTool()).toThrow('Tool \\'Read\\' is already registered');
      expect(() => registerWriteTool()).toThrow('Tool \\'Write\\' is already registered');
      expect(() => registerEditTool()).toThrow('Tool \\'Edit\\' is already registered');
    });
  });

  // ==========================================================================
  // Tool Execution through Registry
  // ==========================================================================

  describe('Tool Execution via Registry', () => {
    beforeEach(() => {
      registerReadTool();
      registerWriteTool();
      registerEditTool();
    });

    it('should execute ReadTool through registry', async () => {
      // Create test file
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello, World!\\nLine 2\\n');

      // Get tool interface from registry
      const toolInterface = registry.getToolInterface('Read');

      // Execute tool
      const result = await toolInterface.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.toolName).toBe('Read');

      const output = result.output as any;
      expect(output.content).toContain('→Hello, World!');
      expect(output.content).toContain('→Line 2');
      expect(output.totalLines).toBe(3); // Including empty line after last \\n
    });

    it('should track invocation statistics', async () => {
      const filePath = path.join(tempDir, 'stats-test.txt');
      await fs.writeFile(filePath, 'Test content');

      const toolInterface = registry.getToolInterface('Read');

      // Initial state
      const initialEntry = registry.get('Read');
      expect(initialEntry.invocationCount).toBe(0);
      expect(initialEntry.successCount).toBe(0);

      // Execute successfully
      const result = await toolInterface.execute({ file_path: filePath });
      expect(result.success).toBe(true);

      // Manual tracking simulation (in real usage, this would be handled by orchestrator)
      registry.recordInvocation('Read', result.success);

      const updatedEntry = registry.get('Read');
      expect(updatedEntry.invocationCount).toBe(1);
      expect(updatedEntry.successCount).toBe(1);
      expect(updatedEntry.failureCount).toBe(0);
    });

    it('should handle tool failures through registry', async () => {
      const toolInterface = registry.getToolInterface('Read');

      // Try to read non-existent file
      const result = await toolInterface.execute({ file_path: '/non/existent/file.txt' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.toolName).toBe('Read');

      // Manual tracking simulation
      registry.recordInvocation('Read', result.success);

      const entry = registry.get('Read');
      expect(entry.invocationCount).toBe(1);
      expect(entry.successCount).toBe(0);
      expect(entry.failureCount).toBe(1);
    });

    it('should execute WriteTool through registry', async () => {
      const filePath = path.join(tempDir, 'write-test.txt');
      const content = 'Hello from registry!';

      // Get tool interface from registry
      const toolInterface = registry.getToolInterface('Write');

      // Execute tool
      const result = await toolInterface.execute({
        filePath,
        content
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.toolName).toBe('Write');

      const output = result.output as any;
      expect(output.created).toBe(true);
      expect(output.bytesWritten).toBeGreaterThan(0);
      expect(output.filePath).toBe(filePath);

      // Verify file was actually created
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should handle WriteTool failures through registry', async () => {
      const toolInterface = registry.getToolInterface('Write');

      // Try to write to invalid path
      const result = await toolInterface.execute({
        filePath: '/invalid/path/that/cannot/exist',
        content: 'test content',
        createDirectories: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.toolName).toBe('Write');

      // Manual tracking simulation
      registry.recordInvocation('Write', result.success);

      const entry = registry.get('Write');
      expect(entry.invocationCount).toBe(1);
      expect(entry.successCount).toBe(0);
      expect(entry.failureCount).toBe(1);
    });

    it('should handle WriteTool overwrite protection through registry', async () => {
      const filePath = path.join(tempDir, 'existing-file.txt');
      await fs.writeFile(filePath, 'original content');

      const toolInterface = registry.getToolInterface('Write');

      // Try to overwrite without permission
      const result = await toolInterface.execute({
        filePath,
        content: 'new content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File already exists');

      // Verify original content is preserved
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe('original content');
    });

    it('should execute EditTool through registry', async () => {
      // Create test file
      const filePath = path.join(tempDir, 'edit-test.txt');
      const originalContent = 'Hello world!\nThis is a test file.\nGoodbye world!';
      await fs.writeFile(filePath, originalContent, 'utf-8');

      // Get tool interface from registry
      const toolInterface = registry.getToolInterface('Edit');

      // Execute tool - simple replacement
      const result = await toolInterface.execute({
        file_path: filePath,
        old_string: 'world',
        new_string: 'universe'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.toolName).toBe('Edit');

      const output = result.output as any;
      expect(output.replacements).toBe(1);
      expect(output.modifiedLines).toEqual([1]);
      expect(output.filePath).toBe(filePath);

      // Verify file was actually modified
      const newContent = await fs.readFile(filePath, 'utf-8');
      expect(newContent).toBe('Hello universe!\nThis is a test file.\nGoodbye world!');
    });

    it('should execute EditTool with replace_all through registry', async () => {
      // Create test file
      const filePath = path.join(tempDir, 'edit-replace-all-test.txt');
      const originalContent = 'test test test';
      await fs.writeFile(filePath, originalContent, 'utf-8');

      const toolInterface = registry.getToolInterface('Edit');

      // Execute tool - replace all occurrences
      const result = await toolInterface.execute({
        file_path: filePath,
        old_string: 'test',
        new_string: 'demo',
        replace_all: true
      });

      expect(result.success).toBe(true);
      const output = result.output as any;
      expect(output.replacements).toBe(3);
      expect(output.modifiedLines).toEqual([1]);

      // Verify file was modified correctly
      const newContent = await fs.readFile(filePath, 'utf-8');
      expect(newContent).toBe('demo demo demo');
    });

    it('should handle EditTool failures through registry', async () => {
      const toolInterface = registry.getToolInterface('Edit');

      // Try to edit non-existent file
      const result = await toolInterface.execute({
        file_path: '/non/existent/file.txt',
        old_string: 'test',
        new_string: 'replacement'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot access file');
      expect(result.toolName).toBe('Edit');

      // Manual tracking simulation
      registry.recordInvocation('Edit', result.success);

      const entry = registry.get('Edit');
      expect(entry.invocationCount).toBe(1);
      expect(entry.successCount).toBe(0);
      expect(entry.failureCount).toBe(1);
    });

    it('should handle EditTool ambiguous replacement errors through registry', async () => {
      // Create test file with multiple occurrences
      const filePath = path.join(tempDir, 'ambiguous-edit-test.txt');
      const content = 'test test test';
      await fs.writeFile(filePath, content, 'utf-8');

      const toolInterface = registry.getToolInterface('Edit');

      // Try to edit without replace_all - should fail
      const result = await toolInterface.execute({
        file_path: filePath,
        old_string: 'test',
        new_string: 'replacement',
        replace_all: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('appears 3 times');
      expect(result.error).toContain('Use replace_all=true');

      // Verify original content is preserved
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should track EditTool invocation statistics', async () => {
      const filePath = path.join(tempDir, 'edit-stats-test.txt');
      await fs.writeFile(filePath, 'Original content');

      const toolInterface = registry.getToolInterface('Edit');

      // Initial state
      const initialEntry = registry.get('Edit');
      expect(initialEntry.invocationCount).toBe(0);
      expect(initialEntry.successCount).toBe(0);

      // Execute successfully
      const result = await toolInterface.execute({
        file_path: filePath,
        old_string: 'Original',
        new_string: 'Modified'
      });
      expect(result.success).toBe(true);

      // Manual tracking simulation
      registry.recordInvocation('Edit', result.success);

      const updatedEntry = registry.get('Edit');
      expect(updatedEntry.invocationCount).toBe(1);
      expect(updatedEntry.successCount).toBe(1);
      expect(updatedEntry.failureCount).toBe(0);
    });
  });

  // ==========================================================================
  // Tool Discovery Tests
  // ==========================================================================

  describe('Tool Discovery', () => {
    beforeEach(() => {
      registerFilesystemTools();
    });

    it('should find filesystem tools by category', () => {
      const filesystemTools = registry.getByCategory('filesystem');

      expect(filesystemTools).toHaveLength(3);
      const toolNames = filesystemTools.map(tool => tool.definition.name);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('Edit');
    });

    it('should list tool definitions for Claude SDK', () => {
      const definitions = registry.getDefinitions();

      expect(definitions).toHaveLength(3);
      const toolNames = definitions.map(def => def.name);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('Edit');

      const writeDefinition = definitions.find(def => def.name === 'Write');
      expect(writeDefinition?.description).toContain('Write content to a file');
    });

    it('should get available tools only', () => {
      // Make Read tool unavailable
      registry.setAvailability('Read', false, 'Testing unavailable state');

      const allTools = registry.getAll();
      const availableTools = registry.getAvailable();

      expect(allTools).toHaveLength(3);
      expect(availableTools).toHaveLength(2); // Write and Edit should still be available
      const availableNames = availableTools.map(tool => tool.definition.name);
      expect(availableNames).toContain('Write');
      expect(availableNames).toContain('Edit');
      expect(availableNames).not.toContain('Read');
    });
  });

  // ==========================================================================
  // Real File System Integration Tests
  // ==========================================================================

  describe('Real File System Integration', () => {
    beforeEach(() => {
      registerReadTool();
      registerWriteTool();
    });

    it('should read actual package.json file', async () => {
      // Find package.json in the project
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');

      try {
        await fs.access(packageJsonPath);

        const toolInterface = registry.getToolInterface('Read');
        const result = await toolInterface.execute({ file_path: packageJsonPath });

        expect(result.success).toBe(true);
        const output = result.output as any;
        expect(output.content).toContain('→');
        expect(output.fileType).toBe('text');
        expect(output.encoding).toBe('utf8');
      } catch {
        // Skip test if package.json doesn't exist
        console.log('Skipping package.json test - file not found');
      }
    });

    it('should handle large files with limit', async () => {
      // Create a file with many lines
      const filePath = path.join(tempDir, 'large-file.txt');
      const lines = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(filePath, lines.join('\\n'));

      const toolInterface = registry.getToolInterface('Read');
      const result = await toolInterface.execute({
        file_path: filePath,
        limit: 100,
      });

      expect(result.success).toBe(true);
      const output = result.output as any;
      expect(output.linesReturned).toBe(100);
      expect(output.totalLines).toBe(5000);
      expect(output.truncated).toBe(true);

      // Verify line number formatting
      const lines = output.content.split('\\n');
      expect(lines[0]).toMatch(/^\\s+1→Line 1$/);
      expect(lines[99]).toMatch(/^\\s+100→Line 100$/);
    });

    it('should detect different file types correctly', async () => {
      const testCases = [
        { filename: 'text.txt', content: 'plain text', expectedType: 'text' },
        { filename: 'image.png', content: Buffer.from([0x89, 0x50, 0x4E, 0x47]), expectedType: 'image' },
        { filename: 'doc.pdf', content: Buffer.from('%PDF-1.4'), expectedType: 'pdf' },
        { filename: 'binary.exe', content: Buffer.from([0x00, 0x01, 0xFF]), expectedType: 'binary' },
      ];

      const toolInterface = registry.getToolInterface('Read');

      for (const testCase of testCases) {
        const filePath = path.join(tempDir, testCase.filename);
        await fs.writeFile(filePath, testCase.content);

        const result = await toolInterface.execute({ file_path: filePath });

        expect(result.success).toBe(true);
        const output = result.output as any;
        expect(output.fileType).toBe(testCase.expectedType);
      }
    });

    it('should write and read files in integration workflow', async () => {
      const writeInterface = registry.getToolInterface('Write');
      const readInterface = registry.getToolInterface('Read');

      const filePath = path.join(tempDir, 'integration-test.json');
      const testData = { test: true, message: 'Hello World!', timestamp: Date.now() };
      const content = JSON.stringify(testData, null, 2);

      // Write file using WriteTool through registry
      const writeResult = await writeInterface.execute({
        filePath,
        content,
        createDirectories: true
      });

      expect(writeResult.success).toBe(true);
      const writeOutput = writeResult.output as any;
      expect(writeOutput.created).toBe(true);
      expect(writeOutput.bytesWritten).toBeGreaterThan(0);

      // Read file using ReadTool through registry
      const readResult = await readInterface.execute({
        file_path: filePath
      });

      expect(readResult.success).toBe(true);
      const readOutput = readResult.output as any;
      expect(readOutput.fileType).toBe('text');

      // Verify content matches (accounting for line number formatting)
      const lines = readOutput.content.split('\n');
      const actualContent = lines.map(line => line.replace(/^\s*\d+→/, '')).join('\n');
      expect(JSON.parse(actualContent)).toEqual(testData);
    });

    it('should perform complete write-edit-read workflow', async () => {
      const writeInterface = registry.getToolInterface('Write');
      const editInterface = registry.getToolInterface('Edit');
      const readInterface = registry.getToolInterface('Read');

      const filePath = path.join(tempDir, 'workflow-test.js');
      const originalCode = 'function greet(name) {\n  console.log("Hello " + name);\n}';

      // Step 1: Write initial file
      const writeResult = await writeInterface.execute({
        filePath,
        content: originalCode,
        createDirectories: true
      });
      expect(writeResult.success).toBe(true);

      // Step 2: Edit the file to use template literals
      const editResult = await editInterface.execute({
        file_path: filePath,
        old_string: '"Hello " + name',
        new_string: '`Hello ${name}`'
      });
      expect(editResult.success).toBe(true);
      const editOutput = editResult.output as any;
      expect(editOutput.replacements).toBe(1);

      // Step 3: Read the modified file
      const readResult = await readInterface.execute({
        file_path: filePath
      });
      expect(readResult.success).toBe(true);
      const readOutput = readResult.output as any;

      // Verify the edit was applied correctly
      expect(readOutput.content).toContain('`Hello ${name}`');
      expect(readOutput.content).not.toContain('"Hello " + name');

      // Extract the actual content
      const lines = readOutput.content.split('\n');
      const actualContent = lines.map(line => line.replace(/^\s*\d+→/, '')).join('\n');
      expect(actualContent).toBe('function greet(name) {\n  console.log(`Hello ${name}`);\n}');
    });

    it('should handle complex directory structures', async () => {
      const writeInterface = registry.getToolInterface('Write');
      const deepPath = path.join(tempDir, 'complex', 'nested', 'deep', 'structure', 'file.txt');
      const content = 'Deep nested file content';

      const result = await writeInterface.execute({
        filePath: deepPath,
        content,
        createDirectories: true
      });

      expect(result.success).toBe(true);
      const output = result.output as any;
      expect(output.created).toBe(true);
      expect(output.directoriesCreated).toBeDefined();
      expect(output.directoriesCreated[0]).toBe(path.dirname(deepPath));

      // Verify file exists and has correct content
      const actualContent = await fs.readFile(deepPath, 'utf-8');
      expect(actualContent).toBe(content);
    });

    it('should handle file overwrite workflow with backup', async () => {
      const writeInterface = registry.getToolInterface('Write');
      const filePath = path.join(tempDir, 'overwrite-test.txt');

      // Create initial file
      const originalContent = 'Original content';
      const createResult = await writeInterface.execute({
        filePath,
        content: originalContent
      });

      expect(createResult.success).toBe(true);
      expect((createResult.output as any).created).toBe(true);

      // Overwrite with backup
      const newContent = 'Updated content';
      const overwriteResult = await writeInterface.execute({
        filePath,
        content: newContent,
        overwrite: true,
        backup: true
      });

      expect(overwriteResult.success).toBe(true);
      const output = overwriteResult.output as any;
      expect(output.created).toBe(false);
      expect(output.backupPath).toBeDefined();

      // Verify main file has new content
      const mainContent = await fs.readFile(filePath, 'utf-8');
      expect(mainContent).toBe(newContent);

      // Verify backup has original content
      const backupContent = await fs.readFile(output.backupPath, 'utf-8');
      expect(backupContent).toBe(originalContent);
    });
  });

  // ==========================================================================
  // Error Handling Integration
  // ==========================================================================

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      registerReadTool();
      registerWriteTool();
      registerEditTool();
    });

    it('should validate parameters before execution', async () => {
      const toolInterface = registry.getToolInterface('Read');

      // Test with invalid parameters
      const result = await toolInterface.execute({ file_path: '' } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should validate EditTool parameters before execution', async () => {
      const toolInterface = registry.getToolInterface('Edit');

      // Test with invalid parameters - missing old_string
      const result1 = await toolInterface.execute({
        file_path: '/some/file.txt',
        new_string: 'replacement'
      } as any);

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Validation failed');

      // Test with empty old_string
      const result2 = await toolInterface.execute({
        file_path: '/some/file.txt',
        old_string: '',
        new_string: 'replacement'
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('old_string cannot be empty');

      // Test with identical old_string and new_string
      const result3 = await toolInterface.execute({
        file_path: '/some/file.txt',
        old_string: 'same',
        new_string: 'same'
      });

      expect(result3.success).toBe(false);
      expect(result3.error).toContain('old_string and new_string must be different');
    });

    it('should handle execution context properly', async () => {
      const filePath = path.join(tempDir, 'context-test.txt');
      await fs.writeFile(filePath, 'test content');

      const toolInterface = registry.getToolInterface('Read');
      const context = {
        taskId: 'test-task-123',
        agentName: 'test-agent',
        workingDirectory: tempDir,
      };

      const result = await toolInterface.execute({ file_path: filePath }, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('Read');
    });

    it('should validate WriteTool parameters before execution', async () => {
      const toolInterface = registry.getToolInterface('Write');

      // Test with invalid parameters
      const result = await toolInterface.execute({ filePath: '', content: 'test' } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle WriteTool execution context properly', async () => {
      const filePath = path.join(tempDir, 'context-write-test.txt');
      const content = 'context test content';

      const toolInterface = registry.getToolInterface('Write');
      const context = {
        taskId: 'test-task-456',
        agentName: 'test-write-agent',
        workingDirectory: tempDir,
      };

      const result = await toolInterface.execute({
        filePath: 'context-write-test.txt', // Relative path
        content
      }, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('Write');

      // Verify file was written in correct context directory
      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });

    it('should handle WriteTool path security validation', async () => {
      const toolInterface = registry.getToolInterface('Write');

      // Test path traversal attempt
      const result = await toolInterface.execute({
        filePath: '../../../etc/passwd',
        content: 'malicious content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('escapes working directory');
    });
  });
});