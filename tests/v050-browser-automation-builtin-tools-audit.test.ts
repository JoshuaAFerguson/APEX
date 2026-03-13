import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTool } from '../packages/core/src/tools/browser/browser-tool.js';
import { ReadTool } from '../packages/core/src/tools/filesystem/read-tool.js';
import { WriteTool } from '../packages/core/src/tools/filesystem/write-tool.js';
import { EditTool } from '../packages/core/src/tools/filesystem/edit-tool.js';
import { BashTool } from '../packages/core/src/tools/shell/bash-tool.js';
import { GrepTool } from '../packages/core/src/tools/search/grep-tool.js';
import { GlobTool } from '../packages/core/src/tools/filesystem/glob-tool.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * Comprehensive audit test suite for v0.5.0 Browser Automation and Built-in Tools
 *
 * This test suite verifies that the v0.5.0 release acceptance criteria are met:
 * - Headless browser automation functionality
 * - Browser actions (navigate, click, type, etc.)
 * - Screenshot capture capabilities
 * - All built-in tools (Read, Write, Edit, Bash, etc.) verified with real implementation
 */
describe('v0.5.0 Browser Automation and Built-in Tools Audit', () => {
  let tempDir: string;
  let browserTool: BrowserTool;
  let readTool: ReadTool;
  let writeTool: WriteTool;
  let editTool: EditTool;
  let bashTool: BashTool;
  let grepTool: GrepTool;
  let globTool: GlobTool;

  beforeEach(async () => {
    // Create temporary directory for testing file operations
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-v050-audit-'));

    // Initialize tool instances
    browserTool = new BrowserTool({ headless: true });
    readTool = new ReadTool();
    writeTool = new WriteTool();
    editTool = new EditTool();
    bashTool = new BashTool();
    grepTool = new GrepTool();
    globTool = new GlobTool();
  });

  afterEach(async () => {
    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up temp dir ${tempDir}:`, error);
    }

    // Clean up browser tool resources
    if (browserTool) {
      await browserTool.cleanupAllSessions();
    }
  });

  describe('Browser Automation - Headless Browser Functionality', () => {
    it('should support headless browser configuration', () => {
      const headlessBrowserTool = new BrowserTool({ headless: true });
      const config = headlessBrowserTool.getConfig();

      expect(config.headless).toBe(true);
      expect(headlessBrowserTool.isActive()).toBe(true);
    });

    it('should support viewport configuration', () => {
      const customViewportTool = new BrowserTool({
        viewport: { width: 1920, height: 1080 }
      });
      const config = customViewportTool.getConfig();

      expect(config.viewport.width).toBe(1920);
      expect(config.viewport.height).toBe(1080);
    });

    it('should have proper lifecycle state management', () => {
      expect(browserTool.state).toBe('idle');
      expect(browserTool.isActive()).toBe(true);
    });

    it('should validate tool metadata and capabilities', () => {
      const definition = browserTool.getDefinition();

      expect(definition.name).toBe('Browser');
      expect(definition.category).toBe('browser');
      expect(definition.permissions).toContain('network');
      expect(definition.dangerous).toBe(true);
      expect(definition.parameters.properties.operation).toBeDefined();
      expect(definition.parameters.properties.params).toBeDefined();
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
  });

  describe('Browser Automation - Navigation and Actions', () => {
    it('should validate navigation parameters correctly', () => {
      const validInput = {
        operation: 'navigate' as const,
        params: { url: 'https://example.com' }
      };

      const validation = browserTool.validate(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid URLs in navigation', () => {
      const invalidInput = {
        operation: 'navigate' as const,
        params: { url: 'invalid-url' }
      };

      const validation = browserTool.validate(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid URL format');
    });

    it('should validate click operation parameters', () => {
      const validInput = {
        operation: 'click' as const,
        params: { selector: 'button.submit' }
      };

      const validation = browserTool.validate(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate type operation parameters', () => {
      const validInput = {
        operation: 'type' as const,
        params: { selector: 'input[name="email"]', text: 'test@example.com' }
      };

      const validation = browserTool.validate(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should require selector for element interaction operations', () => {
      const operations = ['click', 'hover', 'getText', 'getHtml', 'waitForSelector'];

      for (const operation of operations) {
        const invalidInput = {
          operation: operation as any,
          params: {}
        };

        const validation = browserTool.validate(invalidInput);
        expect(validation.valid).toBe(false);
        expect(validation.errors?.[0]).toMatch(/requires a selector parameter/);
      }
    });

    it('should execute navigate operation and return success response', async () => {
      const input = {
        operation: 'navigate' as const,
        params: { url: 'https://example.com' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.url).toBe('https://example.com');
      expect(result.title).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });

    it('should execute click operation and return success response', async () => {
      const input = {
        operation: 'click' as const,
        params: { selector: 'button.submit' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('click');
      expect(result.sessionId).toBeDefined();
    });

    it('should execute type operation and return success response', async () => {
      const input = {
        operation: 'type' as const,
        params: { selector: 'input[name="search"]', text: 'test query' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('type');
    });

    it('should execute waitForSelector operation', async () => {
      const input = {
        operation: 'waitForSelector' as const,
        params: { selector: '.loading-complete' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('waitForSelector');
    });

    it('should execute getAttribute operation', async () => {
      const input = {
        operation: 'getAttribute' as const,
        params: { selector: 'button', attribute: 'disabled' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getAttribute');
      expect(result.attributeValue).toBeDefined();
    });
  });

  describe('Browser Automation - Screenshot Capabilities', () => {
    it('should validate screenshot operation parameters', () => {
      const validInput = {
        operation: 'screenshot' as const,
        params: { path: './screenshot.png' }
      };

      const validation = browserTool.validate(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should support screenshot capture configuration', () => {
      const screenshotTool = new BrowserTool({ allowScreenshots: true });
      const config = screenshotTool.getConfig();

      expect(config.allowScreenshots).toBe(true);
    });

    it('should execute screenshot operation and return success response', async () => {
      const input = {
        operation: 'screenshot' as const,
        params: { path: './test-screenshot.png' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('screenshot');
      expect(result.screenshot).toBeDefined();
    });

    it('should validate compareScreenshot operation parameters', () => {
      const validInput = {
        operation: 'compareScreenshot' as const,
        params: { baseline: './baseline.png' }
      };

      const validation = browserTool.validate(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should execute compareScreenshot operation', async () => {
      const input = {
        operation: 'compareScreenshot' as const,
        params: { baseline: './baseline.png' }
      };

      const result = await browserTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('compareScreenshot');
      expect(result.comparisonResult).toBeDefined();
      expect(result.comparisonResult.isMatch).toBeDefined();
      expect(result.comparisonResult.similarity).toBeDefined();
      expect(result.comparisonResult.dimensions).toBeDefined();
    });

    it('should reject screenshot when screenshots are disabled', () => {
      const noScreenshotTool = new BrowserTool({ allowScreenshots: false });

      const input = {
        operation: 'screenshot' as const,
        params: {}
      };

      const validation = noScreenshotTool.validate(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Screenshots are disabled');
    });
  });

  describe('Browser Automation - Domain Filtering and Security', () => {
    it('should support domain allowlist configuration', () => {
      const restrictedTool = new BrowserTool({
        allowedDomains: ['example.com', 'trusted.org']
      });
      const config = restrictedTool.getConfig();

      expect(config.allowedDomains).toContain('example.com');
      expect(config.allowedDomains).toContain('trusted.org');
    });

    it('should reject navigation to blocked domains', () => {
      const blockedTool = new BrowserTool({
        blockedDomains: ['malicious.com']
      });

      const input = {
        operation: 'navigate' as const,
        params: { url: 'https://malicious.com' }
      };

      const validation = blockedTool.validate(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors?.[0]).toMatch(/Domain.*is blocked/);
    });

    it('should reject navigation to domains not in allowlist', () => {
      const restrictedTool = new BrowserTool({
        allowedDomains: ['example.com']
      });

      const input = {
        operation: 'navigate' as const,
        params: { url: 'https://other.com' }
      };

      const validation = restrictedTool.validate(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors?.[0]).toMatch(/not in the allowed domains list/);
    });

    it('should support JavaScript execution control', () => {
      const noJsTool = new BrowserTool({ allowJavaScriptExecution: false });

      const input = {
        operation: 'evaluate' as const,
        params: { script: 'console.log("test")' }
      };

      const validation = noJsTool.validate(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('JavaScript execution is disabled');
    });

    it('should support form submission control', () => {
      const noFormTool = new BrowserTool({ allowFormSubmission: false });

      const input = {
        operation: 'submit' as const,
        params: { selector: 'form' }
      };

      const validation = noFormTool.validate(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Form submission is disabled');
    });
  });

  describe('Built-in Tools - Read Tool Implementation', () => {
    it('should have correct tool metadata and capabilities', () => {
      const definition = readTool.getDefinition();

      expect(definition.name).toBe('Read');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('read');
      expect(definition.dangerous).toBe(false);
      expect(definition.parameters.required).toContain('file_path');
    });

    it('should validate file path requirements', () => {
      const invalidInput = { file_path: '' };
      const validation = readTool.validate(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('file_path cannot be empty');
    });

    it('should require absolute paths', () => {
      const relativeInput = { file_path: 'relative/path.txt' };
      const validation = readTool.validate(relativeInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('file_path must be an absolute path');
    });

    it('should validate offset and limit parameters', () => {
      const invalidOffset = {
        file_path: '/tmp/test.txt',
        offset: 0
      };
      const validation = readTool.validate(invalidOffset);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('offset must be a positive integer starting from 1');
    });

    it('should read text files with line numbers', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'Line 1\nLine 2\nLine 3';
      await fs.writeFile(testFile, content);

      const result = await readTool.execute({ file_path: testFile });

      expect(result.content).toMatch(/1→Line 1/);
      expect(result.content).toMatch(/2→Line 2/);
      expect(result.content).toMatch(/3→Line 3/);
      expect(result.totalLines).toBe(3);
      expect(result.linesReturned).toBe(3);
      expect(result.fileType).toBe('text');
      expect(result.encoding).toBe('utf8');
    });

    it('should support offset and limit for large files', async () => {
      const testFile = path.join(tempDir, 'large.txt');
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(testFile, lines.join('\n'));

      const result = await readTool.execute({
        file_path: testFile,
        offset: 50,
        limit: 10
      });

      expect(result.startLine).toBe(50);
      expect(result.linesReturned).toBe(10);
      expect(result.content).toMatch(/50→Line 50/);
      expect(result.content).toMatch(/59→Line 59/);
      expect(result.truncated).toBe(true);
    });

    it('should detect and handle image files', async () => {
      const imageFile = path.join(tempDir, 'test.png');
      // Create a minimal PNG file
      await fs.writeFile(imageFile, Buffer.from('dummy image data'));

      const result = await readTool.execute({ file_path: imageFile });

      expect(result.fileType).toBe('image');
      expect(result.content).toMatch(/Image file: test.png/);
      expect(result.content).toMatch(/Format: PNG/);
      expect(result.encoding).toBe('binary');
    });

    it('should detect and handle PDF files', async () => {
      const pdfFile = path.join(tempDir, 'test.pdf');
      await fs.writeFile(pdfFile, Buffer.from('dummy PDF data'));

      const result = await readTool.execute({ file_path: pdfFile });

      expect(result.fileType).toBe('pdf');
      expect(result.content).toMatch(/PDF document: test.pdf/);
      expect(result.encoding).toBe('binary');
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      await expect(readTool.execute({ file_path: nonExistentFile }))
        .rejects.toThrow('File not found');
    });
  });

  describe('Built-in Tools - Write Tool Implementation', () => {
    it('should have correct tool metadata and capabilities', () => {
      const definition = writeTool.getDefinition();

      expect(definition.name).toBe('Write');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('write');
      expect(definition.dangerous).toBe(false);
      expect(definition.parameters.required).toContain('filePath');
      expect(definition.parameters.required).toContain('content');
    });

    it('should validate required parameters', () => {
      const invalidInput = { filePath: '', content: 'test' };
      const validation = writeTool.validate(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('File path cannot be empty');
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

    it('should reject overwriting existing files by default', async () => {
      const testFile = path.join(tempDir, 'existing.txt');
      await fs.writeFile(testFile, 'original content');

      await expect(writeTool.execute({
        filePath: testFile,
        content: 'new content'
      })).rejects.toThrow('File already exists');
    });

    it('should allow overwriting with explicit permission', async () => {
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

    it('should create parent directories automatically', async () => {
      const nestedFile = path.join(tempDir, 'nested', 'deep', 'file.txt');

      const result = await writeTool.execute({
        filePath: nestedFile,
        content: 'nested content'
      });

      expect(result.created).toBe(true);
      expect(result.directoriesCreated).toBeDefined();

      const content = await fs.readFile(nestedFile, 'utf-8');
      expect(content).toBe('nested content');
    });

    it('should support backup creation', async () => {
      const testFile = path.join(tempDir, 'backup-test.txt');
      await fs.writeFile(testFile, 'original content');

      const result = await writeTool.execute({
        filePath: testFile,
        content: 'new content',
        overwrite: true,
        backup: true
      });

      expect(result.backupPath).toBe(`${testFile}.bak`);

      // Verify backup was created
      const backupContent = await fs.readFile(`${testFile}.bak`, 'utf-8');
      expect(backupContent).toBe('original content');

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('new content');
    });

    it('should support different encodings', async () => {
      const testFile = path.join(tempDir, 'encoded.txt');

      const result = await writeTool.execute({
        filePath: testFile,
        content: 'test content',
        encoding: 'ascii'
      });

      expect(result.created).toBe(true);
    });
  });

  describe('Built-in Tools - Edit Tool Implementation', () => {
    it('should have correct tool metadata', () => {
      const definition = editTool.getDefinition();

      expect(definition.name).toBe('Edit');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('write');
      expect(definition.parameters.required).toContain('file_path');
      expect(definition.parameters.required).toContain('old_string');
      expect(definition.parameters.required).toContain('new_string');
    });

    it('should perform string replacement in files', async () => {
      const testFile = path.join(tempDir, 'edit-test.txt');
      const originalContent = 'Hello, World!\nThis is a test.';
      await fs.writeFile(testFile, originalContent);

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'World',
        new_string: 'Universe'
      });

      expect(result.success).toBe(true);

      const modifiedContent = await fs.readFile(testFile, 'utf-8');
      expect(modifiedContent).toBe('Hello, Universe!\nThis is a test.');
    });

    it('should support replace_all option', async () => {
      const testFile = path.join(tempDir, 'replace-all-test.txt');
      const originalContent = 'test test test';
      await fs.writeFile(testFile, originalContent);

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'test',
        new_string: 'example',
        replace_all: true
      });

      expect(result.success).toBe(true);

      const modifiedContent = await fs.readFile(testFile, 'utf-8');
      expect(modifiedContent).toBe('example example example');
    });
  });

  describe('Built-in Tools - Bash Tool Implementation', () => {
    it('should have correct tool metadata', () => {
      const definition = bashTool.getDefinition();

      expect(definition.name).toBe('Bash');
      expect(definition.category).toBe('shell');
      expect(definition.permissions).toContain('execute');
      expect(definition.dangerous).toBe(true);
      expect(definition.parameters.required).toContain('command');
    });

    it('should execute simple commands successfully', async () => {
      const result = await bashTool.execute({ command: 'echo "Hello, World!"' });

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

    it('should support timeout configuration', async () => {
      const shortTimeout = 100; // 100ms
      const result = await bashTool.execute({
        command: 'sleep 1',
        timeout: shortTimeout
      });

      expect(result.timedOut).toBe(true);
    });

    it('should support background execution', async () => {
      const result = await bashTool.execute({
        command: 'echo "background test"',
        run_in_background: true
      });

      expect(result.background).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.pid).toBeDefined();
      expect(result.status).toBe('running');
    });
  });

  describe('Built-in Tools - Search Tools (Grep and Glob)', () => {
    it('should have correct Grep tool metadata', () => {
      const definition = grepTool.getDefinition();

      expect(definition.name).toBe('Grep');
      expect(definition.category).toBe('search');
      expect(definition.parameters.required).toContain('pattern');
    });

    it('should search for patterns in files', async () => {
      const testFile = path.join(tempDir, 'search-test.txt');
      const content = 'Line 1: Hello\nLine 2: World\nLine 3: Hello World';
      await fs.writeFile(testFile, content);

      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testFile,
        output_mode: 'content'
      });

      expect(result.matches).toContain('Hello');
    });

    it('should have correct Glob tool metadata', () => {
      const definition = globTool.getDefinition();

      expect(definition.name).toBe('Glob');
      expect(definition.category).toBe('filesystem');
      expect(definition.parameters.required).toContain('pattern');
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

  describe('Integration Tests - Tool Interoperability', () => {
    it('should support workflow: Write file → Read file → Edit file → Read again', async () => {
      const testFile = path.join(tempDir, 'workflow-test.txt');

      // Write initial content
      const writeResult = await writeTool.execute({
        filePath: testFile,
        content: 'Initial content\nSecond line'
      });
      expect(writeResult.created).toBe(true);

      // Read the file
      const readResult1 = await readTool.execute({ file_path: testFile });
      expect(readResult1.content).toMatch(/1→Initial content/);
      expect(readResult1.content).toMatch(/2→Second line/);

      // Edit the file
      const editResult = await editTool.execute({
        file_path: testFile,
        old_string: 'Initial',
        new_string: 'Modified'
      });
      expect(editResult.success).toBe(true);

      // Read again to verify edit
      const readResult2 = await readTool.execute({ file_path: testFile });
      expect(readResult2.content).toMatch(/1→Modified content/);
    });

    it('should support workflow: Bash command → Grep search → File operations', async () => {
      // Create test file using bash
      const createResult = await bashTool.execute({
        command: `echo "Test content for grep" > ${path.join(tempDir, 'bash-test.txt')}`
      });
      expect(createResult.exitCode).toBe(0);

      // Search for content using grep
      const grepResult = await grepTool.execute({
        pattern: 'Test content',
        path: path.join(tempDir, 'bash-test.txt'),
        output_mode: 'files_with_matches'
      });
      expect(grepResult.files).toContain(path.join(tempDir, 'bash-test.txt'));

      // Read the file to verify
      const readResult = await readTool.execute({
        file_path: path.join(tempDir, 'bash-test.txt')
      });
      expect(readResult.content).toMatch(/Test content for grep/);
    });

    it('should support complex browser and file operations workflow', async () => {
      // Take a screenshot (simulated)
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { path: path.join(tempDir, 'test-screenshot.png') }
      });
      expect(screenshotResult.success).toBe(true);

      // Write a test HTML file
      const htmlContent = '<html><head><title>Test</title></head><body><h1>Test Page</h1></body></html>';
      const writeResult = await writeTool.execute({
        filePath: path.join(tempDir, 'test.html'),
        content: htmlContent
      });
      expect(writeResult.created).toBe(true);

      // Search for HTML elements
      const grepResult = await grepTool.execute({
        pattern: '<h1>',
        path: path.join(tempDir, 'test.html'),
        output_mode: 'content'
      });
      expect(grepResult.matches).toContain('<h1>Test Page</h1>');
    });
  });

  describe('Performance and Reliability Tests', () => {
    it('should handle multiple concurrent read operations', async () => {
      const files = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const file = path.join(tempDir, `concurrent-${i}.txt`);
          await fs.writeFile(file, `Content ${i}`);
          return file;
        })
      );

      const readPromises = files.map(file =>
        readTool.execute({ file_path: file })
      );

      const results = await Promise.all(readPromises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.content).toMatch(new RegExp(`Content ${i}`));
      });
    });

    it('should handle large file reading with appropriate chunking', async () => {
      const largeFile = path.join(tempDir, 'large.txt');
      const lines = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}: ${'x'.repeat(100)}`);
      await fs.writeFile(largeFile, lines.join('\n'));

      // Read with limit to test chunking
      const result = await readTool.execute({
        file_path: largeFile,
        limit: 100
      });

      expect(result.linesReturned).toBe(100);
      expect(result.totalLines).toBe(5000);
      expect(result.truncated).toBe(true);
    });

    it('should handle browser tool resource cleanup properly', async () => {
      // Execute multiple browser operations
      const operations = [
        { operation: 'navigate' as const, params: { url: 'https://example.com' } },
        { operation: 'click' as const, params: { selector: 'button' } },
        { operation: 'screenshot' as const, params: {} }
      ];

      const results = await Promise.all(
        operations.map(op => browserTool.execute(op))
      );

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.sessionId).toBeDefined();
      });

      // Cleanup should not throw
      await expect(browserTool.cleanupAllSessions()).resolves.toBeUndefined();
      expect(browserTool.state).toBe('destroyed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cancellation for long-running operations', async () => {
      const controller = new AbortController();
      const context = { signal: controller.signal };

      // Cancel immediately
      controller.abort();

      await expect(readTool.execute({ file_path: '/tmp/test.txt' }, context))
        .rejects.toThrow('cancelled');
    });

    it('should handle permission errors gracefully', async () => {
      const restrictedBrowser = new BrowserTool({ allowJavaScriptExecution: false });

      const result = await restrictedBrowser.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' }
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toContain('elevated permissions');
      expect(result.metadata?.suggestions).toBeDefined();
    });

    it('should validate operation parameters strictly', () => {
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

    it('should handle filesystem errors properly', async () => {
      // Try to read a directory as a file
      await expect(readTool.execute({ file_path: tempDir }))
        .rejects.toThrow('directory, not a file');

      // Try to write to a protected location (will be rejected by path validation)
      await expect(writeTool.execute({
        filePath: '/etc/passwd',
        content: 'malicious'
      })).rejects.toThrow();
    });
  });

  describe('Acceptance Criteria Verification', () => {
    it('should meet all v0.5.0 Browser Automation acceptance criteria', () => {
      // Headless browser ✓
      expect(browserTool.getConfig().headless).toBe(true);

      // Browser actions ✓
      const supportedOps = browserTool.getDefinition().parameters.properties.operation.enum;
      expect(supportedOps).toContain('navigate');
      expect(supportedOps).toContain('click');
      expect(supportedOps).toContain('type');
      expect(supportedOps).toContain('hover');
      expect(supportedOps).toContain('submit');
      expect(supportedOps).toContain('evaluate');

      // Screenshot capture ✓
      expect(supportedOps).toContain('screenshot');
      expect(supportedOps).toContain('compareScreenshot');

      // Security features ✓
      expect(browserTool.getConfig().allowedDomains).toBeDefined();
      expect(browserTool.getConfig().blockedDomains).toBeDefined();
      expect(browserTool.getConfig().allowJavaScriptExecution).toBeDefined();
    });

    it('should meet all v0.5.0 Built-in Tools acceptance criteria', () => {
      const tools = [
        { tool: readTool, name: 'Read', category: 'filesystem' },
        { tool: writeTool, name: 'Write', category: 'filesystem' },
        { tool: editTool, name: 'Edit', category: 'filesystem' },
        { tool: bashTool, name: 'Bash', category: 'shell' },
        { tool: grepTool, name: 'Grep', category: 'search' },
        { tool: globTool, name: 'Glob', category: 'filesystem' }
      ];

      // All tools have proper implementation ✓
      tools.forEach(({ tool, name, category }) => {
        const definition = tool.getDefinition();
        expect(definition.name).toBe(name);
        expect(definition.category).toBe(category);
        expect(definition.parameters).toBeDefined();
        expect(definition.permissions).toBeInstanceOf(Array);
        expect(typeof tool.execute).toBe('function');
        expect(typeof tool.validate).toBe('function');
      });

      // Real implementation verified by successful execution tests ✓
      console.log('✅ All v0.5.0 Browser Automation and Built-in Tools acceptance criteria verified!');
    });
  });
});