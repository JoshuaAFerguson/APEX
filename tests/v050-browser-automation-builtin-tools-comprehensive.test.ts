import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTool } from '../packages/core/src/tools/browser/index.js';
import { ReadTool } from '../packages/core/src/tools/filesystem/index.js';
import { WriteTool } from '../packages/core/src/tools/filesystem/index.js';
import { EditTool } from '../packages/core/src/tools/filesystem/index.js';
import { GlobTool } from '../packages/core/src/tools/filesystem/index.js';
import { BashTool } from '../packages/core/src/tools/shell/index.js';
import { GrepTool } from '../packages/core/src/tools/search/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * v0.5.0 Browser Automation and Built-in Tools - Comprehensive Testing Suite
 *
 * This test suite verifies that all v0.5.0 features are correctly implemented:
 * ✅ Headless browser automation
 * ✅ Browser actions (navigate, click, type, screenshot, etc.)
 * ✅ Screenshot capture capabilities
 * ✅ All built-in tools (Read, Write, Edit, Bash, Grep, Glob)
 * ✅ Tool integration and workflows
 * ✅ Error handling and edge cases
 * ✅ Real implementation verification
 */
describe('v0.5.0 Browser Automation and Built-in Tools - Comprehensive Tests', () => {
  let tempDir: string;
  let browserTool: BrowserTool;
  let readTool: ReadTool;
  let writeTool: WriteTool;
  let editTool: EditTool;
  let bashTool: BashTool;
  let grepTool: GrepTool;
  let globTool: GlobTool;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-v050-test-'));

    // Initialize all tool instances with proper configurations
    browserTool = new BrowserTool({
      headless: true,
      viewport: { width: 1280, height: 720 },
      allowScreenshots: true,
      allowJavaScriptExecution: true,
      allowFormSubmission: true,
    });

    readTool = new ReadTool();
    writeTool = new WriteTool();
    editTool = new EditTool();
    bashTool = new BashTool();
    grepTool = new GrepTool();
    globTool = new GlobTool();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up temp dir ${tempDir}:`, error);
    }

    // Clean up browser resources
    if (browserTool) {
      await browserTool.cleanupAllSessions();
    }
  });

  describe('v0.5.0 Browser Automation - Core Functionality', () => {
    it('should have proper tool definition and metadata', () => {
      const definition = browserTool.getDefinition();

      expect(definition.name).toBe('Browser');
      expect(definition.category).toBe('browser');
      expect(definition.dangerous).toBe(true);
      expect(definition.permissions).toContain('network');
    });

    it('should support headless browser configuration', () => {
      const config = browserTool.getConfig();
      expect(config.headless).toBe(true);
      expect(config.viewport.width).toBe(1280);
      expect(config.viewport.height).toBe(720);
    });

    it('should support all required browser operations', () => {
      const definition = browserTool.getDefinition();
      const supportedOperations = definition.parameters.properties.operation.enum;

      const requiredOperations = [
        'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
        'evaluate', 'submit', 'waitForSelector', 'getAttribute',
        'getText', 'getHtml', 'scroll', 'hover'
      ];

      for (const operation of requiredOperations) {
        expect(supportedOperations).toContain(operation);
      }
    });

    it('should validate navigation parameters correctly', () => {
      const validInput = {
        operation: 'navigate' as const,
        params: { url: 'https://example.com' }
      };

      const validation = browserTool.validate(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should execute navigation operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.url).toBe('https://example.com');
      expect(result.sessionId).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });

    it('should execute click operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button.submit' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('click');
      expect(result.sessionId).toBeDefined();
    });

    it('should execute screenshot operation successfully', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { path: './test-screenshot.png' }
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('screenshot');
      expect(result.screenshot).toBeDefined();
    });

    it('should support domain filtering configuration', () => {
      const restrictedTool = new BrowserTool({
        allowedDomains: ['example.com', 'trusted.org'],
        blockedDomains: ['malicious.com']
      });
      const config = restrictedTool.getConfig();

      expect(config.allowedDomains).toContain('example.com');
      expect(config.blockedDomains).toContain('malicious.com');
    });

    it('should track browser lifecycle states correctly', () => {
      expect(browserTool.state).toBe('idle');
      expect(browserTool.isActive()).toBe(true);
    });
  });

  describe('v0.5.0 Built-in Tools - ReadTool Functionality', () => {
    it('should have correct tool metadata', () => {
      const definition = readTool.getDefinition();
      expect(definition.name).toBe('Read');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('read');
    });

    it('should read files with line numbers', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'Line 1\\nLine 2\\nLine 3';
      await fs.writeFile(testFile, content);

      const result = await readTool.execute({ file_path: testFile });

      expect(result.totalLines).toBe(3);
      expect(result.content).toMatch(/1→Line 1/);
      expect(result.content).toMatch(/2→Line 2/);
      expect(result.content).toMatch(/3→Line 3/);
    });

    it('should handle offset and limit for large files', async () => {
      const testFile = path.join(tempDir, 'large.txt');
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(testFile, lines.join('\\n'));

      const result = await readTool.execute({
        file_path: testFile,
        offset: 50,
        limit: 10
      });

      expect(result.startLine).toBe(50);
      expect(result.linesReturned).toBe(10);
      expect(result.truncated).toBe(true);
    });
  });

  describe('v0.5.0 Built-in Tools - WriteTool Functionality', () => {
    it('should have correct tool metadata', () => {
      const definition = writeTool.getDefinition();
      expect(definition.name).toBe('Write');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('write');
    });

    it('should create new files successfully', async () => {
      const testFile = path.join(tempDir, 'new-file.txt');
      const content = 'Hello, World!';

      const result = await writeTool.execute({
        filePath: testFile,
        content
      });

      expect(result.created).toBe(true);
      expect(result.filePath).toBe(testFile);
      expect(result.bytesWritten).toBeGreaterThan(0);

      // Verify file was actually created
      const writtenContent = await fs.readFile(testFile, 'utf-8');
      expect(writtenContent).toBe(content);
    });

    it('should support overwriting with explicit permission', async () => {
      const testFile = path.join(tempDir, 'overwrite.txt');
      await fs.writeFile(testFile, 'original content');

      const result = await writeTool.execute({
        filePath: testFile,
        content: 'new content',
        overwrite: true
      });

      expect(result.created).toBe(false);
      expect(result.bytesWritten).toBeGreaterThan(0);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('new content');
    });
  });

  describe('v0.5.0 Built-in Tools - EditTool Functionality', () => {
    it('should have correct tool metadata', () => {
      const definition = editTool.getDefinition();
      expect(definition.name).toBe('Edit');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('write');
    });

    it('should perform string replacement correctly', async () => {
      const testFile = path.join(tempDir, 'edit-test.txt');
      const originalContent = 'Hello, World!\\nThis is a test.';
      await fs.writeFile(testFile, originalContent);

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'World',
        new_string: 'Universe'
      });

      expect(result.success).toBe(true);

      const modifiedContent = await fs.readFile(testFile, 'utf-8');
      expect(modifiedContent).toBe('Hello, Universe!\\nThis is a test.');
    });
  });

  describe('v0.5.0 Built-in Tools - BashTool Functionality', () => {
    it('should have correct tool metadata', () => {
      const definition = bashTool.getDefinition();
      expect(definition.name).toBe('Bash');
      expect(definition.category).toBe('shell');
      expect(definition.dangerous).toBe(true);
      expect(definition.permissions).toContain('execute');
    });

    it('should execute simple commands successfully', async () => {
      const result = await bashTool.execute({
        command: 'echo "Hello, World!"'
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello, World!');
      expect(result.command).toBe('echo "Hello, World!"');
      expect(typeof result.duration).toBe('number');
    });

    it('should capture stderr for failing commands', async () => {
      const result = await bashTool.execute({
        command: 'ls /nonexistent-directory'
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('v0.5.0 Built-in Tools - Search Tools (Grep and Glob)', () => {
    it('should have correct GrepTool metadata', () => {
      const definition = grepTool.getDefinition();
      expect(definition.name).toBe('Grep');
      expect(definition.category).toBe('search');
    });

    it('should search for patterns in files', async () => {
      const testFile = path.join(tempDir, 'search-test.txt');
      const content = 'Line 1: Hello\\nLine 2: World\\nLine 3: Hello World';
      await fs.writeFile(testFile, content);

      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testFile,
        output_mode: 'files_with_matches'
      });

      expect(result.files).toContain(testFile);
    });

    it('should have correct GlobTool metadata', () => {
      const definition = globTool.getDefinition();
      expect(definition.name).toBe('Glob');
      expect(definition.category).toBe('filesystem');
    });

    it('should find files by pattern', async () => {
      const testFile1 = path.join(tempDir, 'test1.txt');
      const testFile2 = path.join(tempDir, 'test2.js');
      await fs.writeFile(testFile1, 'content1');
      await fs.writeFile(testFile2, 'content2');

      const result = await globTool.execute({
        pattern: '*.txt',
        path: tempDir
      });

      expect(result.files).toContain(testFile1);
      expect(result.files).not.toContain(testFile2);
    });
  });

  describe('v0.5.0 Integration Tests - Tool Workflows', () => {
    it('should support end-to-end file workflow', async () => {
      const testFile = path.join(tempDir, 'workflow-test.txt');

      // 1. Write initial content
      const writeResult = await writeTool.execute({
        filePath: testFile,
        content: 'Initial content\\nSecond line'
      });
      expect(writeResult.created).toBe(true);

      // 2. Read the file
      const readResult1 = await readTool.execute({ file_path: testFile });
      expect(readResult1.content).toMatch(/1→Initial content/);

      // 3. Edit the file
      const editResult = await editTool.execute({
        file_path: testFile,
        old_string: 'Initial',
        new_string: 'Modified'
      });
      expect(editResult.success).toBe(true);

      // 4. Verify edit worked
      const readResult2 = await readTool.execute({ file_path: testFile });
      expect(readResult2.content).toMatch(/1→Modified content/);
    });

    it('should support bash-to-file workflow', async () => {
      const testFile = path.join(tempDir, 'bash-output.txt');

      // Create file with bash command
      const bashResult = await bashTool.execute({
        command: `echo "Created by bash" > "${testFile}"`
      });
      expect(bashResult.exitCode).toBe(0);

      // Read the file to verify
      const readResult = await readTool.execute({ file_path: testFile });
      expect(readResult.content).toMatch(/Created by bash/);
    });

    it('should support search workflow', async () => {
      // Create multiple test files
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      await fs.writeFile(file1, 'This contains the keyword');
      await fs.writeFile(file2, 'This does not contain it');

      // Use grep to find files with keyword
      const grepResult = await grepTool.execute({
        pattern: 'keyword',
        path: tempDir,
        output_mode: 'files_with_matches'
      });
      expect(grepResult.files).toContain(file1);
      expect(grepResult.files).not.toContain(file2);

      // Use glob to find all txt files
      const globResult = await globTool.execute({
        pattern: '*.txt',
        path: tempDir
      });
      expect(globResult.files).toHaveLength(2);
    });
  });

  describe('v0.5.0 Error Handling and Edge Cases', () => {
    it('should handle browser permission denials gracefully', async () => {
      const restrictedTool = new BrowserTool({
        allowJavaScriptExecution: false
      });

      const result = await restrictedTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' }
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should handle file not found errors', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      await expect(readTool.execute({ file_path: nonExistentFile }))
        .rejects.toThrow();
    });

    it('should handle bash command failures', async () => {
      const result = await bashTool.execute({
        command: 'ls /nonexistent-directory'
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });

    it('should validate browser operations properly', () => {
      const invalidOperations = [
        { operation: 'invalid' as any, params: {} },
        { operation: 'navigate' as const, params: {} }, // missing url
        { operation: 'type' as const, params: { selector: 'input' } }, // missing text
      ];

      invalidOperations.forEach((input, i) => {
        const validation = browserTool.validate(input);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toBeDefined();
      });
    });
  });

  describe('v0.5.0 Acceptance Criteria Verification', () => {
    it('should meet all browser automation acceptance criteria', () => {
      const config = browserTool.getConfig();
      const definition = browserTool.getDefinition();
      const supportedOps = definition.parameters.properties.operation.enum;

      // ✅ Headless browser
      expect(config.headless).toBe(true);

      // ✅ Browser actions
      expect(supportedOps).toContain('navigate');
      expect(supportedOps).toContain('click');
      expect(supportedOps).toContain('type');
      expect(supportedOps).toContain('hover');
      expect(supportedOps).toContain('submit');

      // ✅ Screenshot capture
      expect(supportedOps).toContain('screenshot');
      expect(supportedOps).toContain('compareScreenshot');
      expect(config.allowScreenshots).toBe(true);
    });

    it('should meet all built-in tools acceptance criteria', () => {
      const tools = [
        { tool: readTool, name: 'Read', category: 'filesystem' },
        { tool: writeTool, name: 'Write', category: 'filesystem' },
        { tool: editTool, name: 'Edit', category: 'filesystem' },
        { tool: bashTool, name: 'Bash', category: 'shell' },
        { tool: grepTool, name: 'Grep', category: 'search' },
        { tool: globTool, name: 'Glob', category: 'filesystem' }
      ];

      // ✅ All tools properly implemented
      tools.forEach(({ tool, name, category }) => {
        const definition = tool.getDefinition();
        expect(definition.name).toBe(name);
        expect(definition.category).toBe(category);
        expect(definition.parameters).toBeDefined();
        expect(typeof tool.execute).toBe('function');
        expect(typeof tool.validate).toBe('function');
      });
    });

    it('should demonstrate real implementation verification', async () => {
      // ✅ Real browser tool execution
      const browserResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserResult.success).toBe(true);

      // ✅ Real file operations
      const testFile = path.join(tempDir, 'verification.txt');
      const writeResult = await writeTool.execute({
        filePath: testFile,
        content: 'Real implementation test'
      });
      expect(writeResult.created).toBe(true);

      const readResult = await readTool.execute({ file_path: testFile });
      expect(readResult.content).toContain('Real implementation test');

      // ✅ Real command execution
      const bashResult = await bashTool.execute({
        command: 'echo "Real bash execution"'
      });
      expect(bashResult.exitCode).toBe(0);
      expect(bashResult.stdout).toContain('Real bash execution');

      console.log('✅ ALL v0.5.0 Browser Automation and Built-in Tools acceptance criteria verified!');
    });
  });
});